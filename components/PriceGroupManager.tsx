
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { PriceGroup, PriceGroupBoard, PriceGroupItem, Product, Unit, PriceGroupStyles, PriceGroupTheme } from '../types';
import { db } from '../services/supabase';
import { useSystemSettings } from './SystemSettingsContext';
import { CurrencySymbolRenderer } from './CurrencySymbolRenderer';
import { 
  Plus, Trash2, Save, Printer, FolderOpen, Loader2, 
  X, ZoomIn, ZoomOut, Search, Copy, 
  LayoutGrid, Star, FilePlus, Layers, 
  Smartphone, Monitor, Layout, Zap, Flame, Crown, Boxes, Type, 
  Paintbrush, Palette, Check, ArrowRight, Eye, Grid, Shapes, Diamond,
  Trophy, Activity, AlignRight, Bold, Maximize2, Move, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown,
  ArrowLeftRight, RefreshCw, Trash, Sparkles, Moon, Sun, Ghost, Wand2
} from 'lucide-react';

export const PriceGroupManager: React.FC = () => {
  const { settings } = useSystemSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [projects, setProjects] = useState<PriceGroup[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  
  // Project State
  const [projectName, setProjectName] = useState('لوحة أسعار عرضية');
  const [boards, setBoards] = useState<PriceGroupBoard[]>([
    { id: 'board_a', title: 'قائمة الأصناف المختارة', items: [], isActive: true },
    { id: 'board_b', title: 'لوحة إضافية فارغة', items: [], isActive: true }
  ]);
  const [activeBoardIdx, setActiveBoardIdx] = useState(0);

  const [showLogo, setShowLogo] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [themeId, setThemeId] = useState<PriceGroupTheme>('geometric_luxe');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(45);

  const [showProductPicker, setShowProductPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'content' | 'styling' | 'projects'>('content');
  const [boardsPerPage, setBoardsPerPage] = useState<1 | 2>(2);
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, message: string, onConfirm: () => void} | null>(null);
  const [showAdvancedColors, setShowAdvancedColors] = useState(false);

  const [styles, setStyles] = useState<PriceGroupStyles>({
    primaryColor: '#006C35',
    backgroundColor: '#ffffff',
    textColor: '#1e293b',
    priceColor: '#006C35',
    secondaryColor: '#C5A059',
    borderColor: '#006C35',
    titleFontSize: 52,
    itemFontSize: 24,
    priceFontSize: 42,
    currencyFontSize: 14,
    titleWeight: '900',
    itemWeight: '700',
    priceWeight: '900',
    columns: 1,
    borderWidth: 10,
    padding: 30,
    boardsPerPage: 2,
    showGeometricPattern: true,
    currencySymbolType: 'icon',
    currencySymbolImage: null
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [pjs, p, u] = await Promise.all([
        db.priceGroups.getAll(),
        db.products.getAll(),
        db.units.getAll()
      ]);
      setProjects(pjs as PriceGroup[]);
      setProducts(p);
      setUnits(u);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const projectData: PriceGroup = {
        id: activeProjectId || crypto.randomUUID(),
        name: projectName,
        date: new Date().toISOString(),
        boards,
        showLogo,
        logoUrl,
        themeId,
        styles: { ...styles, boardsPerPage }
      };
      await db.priceGroups.upsert(projectData);
      setActiveProjectId(projectData.id);
      fetchData();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) { alert("حدث خطأ أثناء الحفظ"); }
    finally { setIsSaving(false); }
  };

  const addProductToBoard = (product?: Product) => {
    const newItem: PriceGroupItem = {
      id: crypto.randomUUID(),
      label: product?.name || 'صنف جديد',
      price: product?.price || '0.00',
      isOffer: false
    };
    const newBoards = [...boards];
    newBoards[activeBoardIdx].items.push(newItem);
    setBoards(newBoards);
    setShowProductPicker(false);
  };

  const duplicateBoard = () => {
    const source = boards[activeBoardIdx];
    const targetIdx = activeBoardIdx === 0 ? 1 : 0;
    const newBoards = [...boards];
    newBoards[targetIdx].items = source.items.map(i => ({ ...i, id: crypto.randomUUID() }));
    newBoards[targetIdx].title = source.title;
    setBoards(newBoards);
  };

  const loadProject = (pj: PriceGroup) => {
    setActiveProjectId(pj.id);
    setProjectName(pj.name);
    const legacyItems = (pj as any).items || [];
    const migratedBoards = (pj.boards && pj.boards.length > 0) ? pj.boards : [
        { id: 'board_a', title: pj.name || 'اللوحة أ', items: legacyItems, isActive: true },
        { id: 'board_b', title: 'اللوحة ب (إضافية)', items: [], isActive: true }
    ];
    setBoards(migratedBoards);
    setShowLogo(pj.showLogo ?? true);
    setLogoUrl(pj.logoUrl || null);
    setThemeId(pj.themeId || 'geometric_luxe');
    if (pj.styles) {
        setStyles({...styles, ...pj.styles});
        setBoardsPerPage(pj.styles.boardsPerPage || 2);
    }
    setActiveTab('content');
  };

  const createNew = () => {
    setActiveProjectId(null);
    setProjectName('مشروع جديد');
    setBoards([
        { id: 'board_a', title: 'قائمة الأصناف - أ', items: [], isActive: true },
        { id: 'board_b', title: 'قائمة الأصناف - ب', items: [], isActive: true }
    ]);
    setActiveTab('content');
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term)).slice(0, 15);
  }, [searchTerm, products]);

  const themesList = [
      { id: 'geometric_luxe', name: 'الحديث النظيف', icon: Layout },
      { id: 'modern_grid', name: 'الشبكة التقنية', icon: Grid },
      { id: 'royal_minimal', name: 'الكلاسيكي الفاخر', icon: Crown },
      { id: 'digital_punch', name: 'العروض الجريئة', icon: Zap },
      { id: 'abstract_gradient', name: 'الناعم العضوي', icon: Sparkles }
  ];

  const colorPresets = [
      { name: 'أخضر كلاسيكي', colors: { primaryColor: '#006C35', secondaryColor: '#C5A059', backgroundColor: '#ffffff', textColor: '#1e293b', priceColor: '#006C35', borderColor: '#006C35' } },
      { name: 'أسود ملكي', colors: { primaryColor: '#0f172a', secondaryColor: '#fbbf24', backgroundColor: '#ffffff', textColor: '#0f172a', priceColor: '#0f172a', borderColor: '#0f172a' } },
      { name: 'أزرق تقني', colors: { primaryColor: '#2563eb', secondaryColor: '#0ea5e9', backgroundColor: '#f8fafc', textColor: '#0f172a', priceColor: '#2563eb', borderColor: '#e2e8f0' } },
      { name: 'أحمر ناري', colors: { primaryColor: '#dc2626', secondaryColor: '#f97316', backgroundColor: '#fff1f2', textColor: '#450a0a', priceColor: '#dc2626', borderColor: '#fecdd3' } },
  ];

  const BoardRenderer = ({ board, s, isSmall = false, isPrinting = false }: { board: PriceGroupBoard, s: PriceGroupStyles, isSmall?: boolean, isPrinting?: boolean }) => {
    const scale = isSmall ? 0.75 : 1;
    
    const EmptyState = () => (
        <div className="h-full flex flex-col items-center justify-center opacity-30">
            <Boxes size={64} className="mb-4" style={{ color: s.primaryColor }} />
            <p className="font-black text-2xl" style={{ color: s.textColor }}>اللوحة فارغة</p>
            <p className="font-bold text-sm mt-2" style={{ color: s.textColor }}>قم بإضافة منتجات من القائمة الجانبية</p>
        </div>
    );

    // Theme 1: geometric_luxe (الحديث النظيف)
    if (themeId === 'geometric_luxe') {
        return (
            <div className="w-full h-full flex flex-col relative text-right overflow-hidden bg-white shadow-sm" style={{ padding: `${s.padding * scale}px`, border: `${s.borderWidth * scale}px solid ${s.borderColor || s.primaryColor}`, backgroundColor: s.backgroundColor }}>
                <div className="flex flex-col items-center mb-10 pb-8 border-b" style={{ borderColor: `${s.secondaryColor}30` }}>
                    {showLogo && logoUrl ? <img src={logoUrl} className={`${isSmall ? 'h-16' : 'h-24'} object-contain mb-6`} /> : null}
                    <h1 className="font-black text-center tracking-tight" style={{ fontSize: `${s.titleFontSize * scale * 1.1}px`, color: s.textColor }}>{board.title}</h1>
                </div>
                <div className="flex-1 space-y-5">
                    {board.items.length === 0 ? <EmptyState /> : board.items.map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between py-3 group hover:bg-gray-50/50 transition-colors px-4 rounded-xl flex-nowrap">
                            <div className="flex items-center gap-5 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-sm shrink-0" style={{ backgroundColor: s.primaryColor }}>{idx + 1}</div>
                                <div className="font-bold truncate" style={{ fontSize: `${s.itemFontSize * scale}px`, color: s.textColor }}>{item.label}</div>
                            </div>
                            <div className="flex items-baseline gap-1.5 shrink-0 mr-4 flex-nowrap">
                                <span className="font-black shrink-0" style={{ fontSize: `${s.priceFontSize * scale}px`, color: item.isOffer ? '#ef4444' : s.priceColor }}>{item.price}</span>
                                <CurrencySymbolRenderer type={s.currencySymbolType || 'icon'} imageUrl={s.currencySymbolImage} color={s.textColor} style={{ width: `${s.currencyFontSize * scale}px`, height: `${s.currencyFontSize * scale}px` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Theme 2: modern_grid (الشبكة التقنية)
    if (themeId === 'modern_grid') {
        return (
            <div className="w-full h-full flex flex-col relative text-right overflow-hidden" style={{ padding: `${s.padding * scale}px`, border: `${s.borderWidth * scale}px solid ${s.borderColor || s.primaryColor}`, backgroundColor: s.backgroundColor }}>
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `linear-gradient(${s.primaryColor} 2px, transparent 2px), linear-gradient(90deg, ${s.primaryColor} 2px, transparent 2px)`, backgroundSize: '30px 30px' }}></div>
                <div className="flex justify-between items-end mb-10 border-b-4 pb-4 relative z-10" style={{ borderColor: s.primaryColor }}>
                    <div className="bg-black text-white px-8 py-3 inline-block shadow-[4px_4px_0px_rgba(0,0,0,0.2)]" style={{ backgroundColor: s.primaryColor }}>
                        <h1 className="font-mono font-black uppercase tracking-widest" style={{ fontSize: `${s.titleFontSize * scale * 0.8}px` }}>{board.title}</h1>
                    </div>
                    {showLogo && logoUrl ? <img src={logoUrl} className={`${isSmall ? 'h-12' : 'h-16'} object-contain`} /> : null}
                </div>
                <div className="flex-1 grid grid-cols-2 gap-6 relative z-10 content-start">
                    {board.items.length === 0 ? <div className="col-span-2"><EmptyState /></div> : board.items.map((item, idx) => (
                        <div key={item.id} className="border-2 p-5 flex flex-col justify-between bg-white shadow-[4px_4px_0px_rgba(0,0,0,0.05)] hover:shadow-[6px_6px_0px_rgba(0,0,0,0.1)] transition-shadow" style={{ borderColor: `${s.secondaryColor}40` }}>
                            <div className="flex justify-between items-start mb-5 flex-nowrap">
                                <div className="font-mono text-xs font-bold px-3 py-1 bg-gray-100 rounded shrink-0" style={{ color: s.primaryColor }}>#{String(idx + 1).padStart(2, '0')}</div>
                                {item.isOffer && <div className="bg-red-500 text-white text-[10px] font-bold px-3 py-1 animate-pulse rounded shrink-0">عرض خاص</div>}
                            </div>
                            <div className="font-bold leading-tight mb-5" style={{ fontSize: `${s.itemFontSize * scale * 0.9}px`, color: s.textColor }}>{item.label}</div>
                            <div className="flex items-baseline gap-1.5 justify-end mt-auto pt-4 border-t border-dashed flex-nowrap shrink-0" style={{ borderColor: `${s.secondaryColor}30` }}>
                                <span className="font-black font-mono shrink-0" style={{ fontSize: `${s.priceFontSize * scale}px`, color: item.isOffer ? '#ef4444' : s.priceColor }}>{item.price}</span>
                                <CurrencySymbolRenderer type={s.currencySymbolType || 'icon'} imageUrl={s.currencySymbolImage} color={s.textColor} style={{ width: `${s.currencyFontSize * scale}px`, height: `${s.currencyFontSize * scale}px` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Theme 3: royal_minimal (الكلاسيكي الفاخر)
    if (themeId === 'royal_minimal') {
        return (
            <div className="w-full h-full flex flex-col relative text-right overflow-hidden rounded-[2rem]" style={{ padding: `${s.padding * scale}px`, border: `${s.borderWidth * scale}px double ${s.borderColor || s.primaryColor}`, backgroundColor: s.backgroundColor }}>
                <div className="absolute inset-0 border-[8px] border-transparent rounded-[1.5rem] pointer-events-none" style={{ borderColor: `${s.secondaryColor}15` }}></div>
                <div className="flex flex-col items-center mb-12 relative z-10">
                    {showLogo && logoUrl ? <img src={logoUrl} className={`${isSmall ? 'h-16' : 'h-20'} object-contain mb-8`} /> : null}
                    <h1 className="font-black text-center" style={{ fontSize: `${s.titleFontSize * scale * 1.1}px`, color: s.textColor, fontFamily: 'Georgia, serif' }}>{board.title}</h1>
                    <div className="flex items-center gap-3 mt-6 w-2/3 mx-auto opacity-70">
                        <div className="h-[2px] flex-1" style={{ backgroundColor: s.secondaryColor }}></div>
                        <div className="w-3 h-3 rotate-45" style={{ backgroundColor: s.primaryColor }}></div>
                        <div className="h-[2px] flex-1" style={{ backgroundColor: s.secondaryColor }}></div>
                    </div>
                </div>
                <div className="flex-1 space-y-8 px-10 relative z-10">
                    {board.items.length === 0 ? <EmptyState /> : board.items.map((item, idx) => (
                        <div key={item.id} className="flex items-baseline w-full group flex-nowrap">
                            <div className="font-bold truncate shrink-0 max-w-[50%]" style={{ fontSize: `${s.itemFontSize * scale}px`, color: s.textColor }}>{item.label}</div>
                            <div className="flex-1 border-b-2 border-dotted mx-6 relative top-[-8px] opacity-40 group-hover:opacity-70 transition-opacity min-w-[20px]" style={{ borderColor: s.secondaryColor }}></div>
                            <div className="flex items-baseline gap-1.5 whitespace-nowrap shrink-0">
                                <span className="font-black" style={{ fontSize: `${s.priceFontSize * scale}px`, color: item.isOffer ? '#ef4444' : s.priceColor }}>{item.price}</span>
                                <CurrencySymbolRenderer type={s.currencySymbolType || 'icon'} imageUrl={s.currencySymbolImage} color={s.textColor} style={{ width: `${s.currencyFontSize * scale}px`, height: `${s.currencyFontSize * scale}px` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Theme 4: digital_punch (العروض الجريئة)
    if (themeId === 'digital_punch') {
        return (
            <div className="w-full h-full flex flex-col relative text-right overflow-hidden" style={{ padding: `${s.padding * scale}px`, border: `${s.borderWidth * scale}px solid ${s.borderColor || s.primaryColor}`, backgroundColor: s.backgroundColor }}>
                <div className="flex justify-between items-center mb-8 p-8 rounded-3xl shadow-xl" style={{ backgroundColor: s.primaryColor }}>
                    <h1 className="font-black text-white leading-none tracking-tight" style={{ fontSize: `${s.titleFontSize * scale * 1.2}px` }}>{board.title}</h1>
                    {showLogo && logoUrl ? <img src={logoUrl} className={`${isSmall ? 'h-16' : 'h-20'} object-contain brightness-0 invert drop-shadow-md`} /> : null}
                </div>
                <div className="flex-1 space-y-5">
                    {board.items.length === 0 ? <EmptyState /> : board.items.map((item, idx) => (
                        <div key={item.id} className="flex items-stretch border-4 rounded-2xl overflow-hidden shadow-md bg-white transform transition-transform hover:scale-[1.01] flex-nowrap" style={{ borderColor: item.isOffer ? '#ef4444' : s.secondaryColor }}>
                            <div className="w-20 flex items-center justify-center font-black text-3xl text-white shadow-inner shrink-0" style={{ backgroundColor: item.isOffer ? '#ef4444' : s.secondaryColor }}>
                                {idx + 1}
                            </div>
                            <div className="flex-1 flex items-center justify-between p-5 min-w-0 flex-nowrap">
                                <div className="font-black leading-tight truncate flex-1 min-w-0" style={{ fontSize: `${s.itemFontSize * scale * 1.1}px`, color: s.textColor }}>{item.label}</div>
                                <div className="flex items-baseline gap-1.5 bg-gray-100 px-6 py-3 rounded-xl shadow-inner border border-gray-200 shrink-0 mr-4 flex-nowrap">
                                    <span className="font-black shrink-0" style={{ fontSize: `${s.priceFontSize * scale * 1.3}px`, color: item.isOffer ? '#ef4444' : s.priceColor }}>{item.price}</span>
                                    <CurrencySymbolRenderer type={s.currencySymbolType || 'icon'} imageUrl={s.currencySymbolImage} color={s.textColor} style={{ width: `${s.currencyFontSize * scale}px`, height: `${s.currencyFontSize * scale}px` }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Theme 5: abstract_gradient (الناعم العضوي)
    return (
        <div className="w-full h-full flex flex-col relative text-right overflow-hidden rounded-[3rem] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]" style={{ padding: `${s.padding * scale}px`, background: `linear-gradient(135deg, ${s.backgroundColor}, ${s.primaryColor}15)` }}>
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full mix-blend-multiply filter blur-3xl opacity-30 pointer-events-none" style={{ backgroundColor: s.primaryColor, transform: 'translate(30%, -30%)' }}></div>
            <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full mix-blend-multiply filter blur-3xl opacity-30 pointer-events-none" style={{ backgroundColor: s.secondaryColor, transform: 'translate(-30%, 30%)' }}></div>
            
            <div className="flex justify-between items-center mb-10 relative z-10">
                <div className="flex-1">
                    <h1 className="font-black tracking-tight" style={{ fontSize: `${s.titleFontSize * scale * 1.1}px`, color: s.textColor }}>{board.title}</h1>
                    <div className="w-16 h-2 rounded-full mt-3" style={{ backgroundColor: s.primaryColor }}></div>
                </div>
                {showLogo && logoUrl ? <img src={logoUrl} className={`${isSmall ? 'h-16' : 'h-20'} object-contain`} /> : null}
            </div>
            
            <div className="flex-1 space-y-4 relative z-10">
                {board.items.length === 0 ? <EmptyState /> : board.items.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between bg-white/70 backdrop-blur-md p-3 rounded-full shadow-sm border border-white/60 hover:bg-white/90 transition-colors flex-nowrap">
                        <div className="flex items-center gap-4 pl-4 flex-1 min-w-0">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-inner shrink-0" style={{ backgroundColor: item.isOffer ? '#ef4444' : s.primaryColor }}>{idx + 1}</div>
                            <div className="font-bold truncate" style={{ fontSize: `${s.itemFontSize * scale}px`, color: s.textColor }}>{item.label}</div>
                        </div>
                        <div className="flex items-baseline gap-1.5 bg-white px-6 py-3 rounded-full shadow-sm border border-gray-100 shrink-0 mr-4 flex-nowrap">
                            <span className="font-black shrink-0" style={{ fontSize: `${s.priceFontSize * scale}px`, color: item.isOffer ? '#ef4444' : s.priceColor }}>{item.price}</span>
                            <CurrencySymbolRenderer type={s.currencySymbolType || 'icon'} imageUrl={s.currencySymbolImage} color={s.textColor} style={{ width: `${s.currencyFontSize * scale}px`, height: `${s.currencyFontSize * scale}px` }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
  };

  const FullPagePrint = () => {
    const portalNode = document.getElementById('print-container');
    if (!portalNode) return null;

    return createPortal(
      <div 
        style={{ 
          width: '297mm', // A4 Landscape
          height: '210mm', // A4 Landscape
          display: 'grid', 
          gridTemplateColumns: boardsPerPage === 2 ? '1fr 1fr' : '1fr', // Side-by-side for landscape
          gridTemplateRows: '1fr',
          boxSizing: 'border-box',
          overflow: 'hidden',
          background: 'white'
        }}
      >
        <style>{`
          @media print { 
            @page { size: A4 landscape; margin: 0 !important; } 
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow) !important;
              text-shadow: var(--tw-text-shadow, none) !important;
              animation: none !important;
              transition: none !important;
            }
            body, html {
              margin: 0 !important;
              padding: 0 !important;
              background-color: white !important;
            }
            #print-container {
              width: 297mm !important;
              height: 210mm !important;
              overflow: hidden !important;
            }
          }
        `}</style>
        <div className="w-full h-full relative overflow-hidden">
            <BoardRenderer board={boards[0]} s={styles} isSmall={boardsPerPage === 2} isPrinting={true} />
        </div>
        {boardsPerPage === 2 && (
            <div className="w-full h-full border-r-4 border-dashed border-gray-200 relative overflow-hidden">
                <BoardRenderer board={boards[1]} s={styles} isSmall={true} isPrinting={true} />
            </div>
        )}
      </div>,
      portalNode
    );
  };

  return (
    <div className="h-full w-full flex overflow-hidden animate-in fade-in duration-500 bg-[#F1F5F9] relative font-sans" dir="rtl">
      
      {/* 1. PORTAL FOR PRINTING - This goes to the top-level #print-container */}
      <FullPagePrint />

      {/* 2. MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col overflow-hidden relative no-print">
        <div className="h-16 bg-white border-b border-slate-200 flex justify-between items-center px-6 shrink-0 z-40 shadow-sm">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-sap-primary text-white rounded-xl flex items-center justify-center shadow-lg"><Layout size={20}/></div>
                <div>
                   <h2 className="text-sm font-black text-slate-800">مصمم اللوحات (A4 عرضي)</h2>
                   <p className="text-[10px] font-bold text-slate-400">تنبيه: تم تثبيت خيار الطباعة لتجنب الصفحة البيضاء</p>
                </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                <button onClick={() => setPreviewZoom(z => Math.max(10, z - 5))} className="p-2 text-slate-400 hover:text-sap-primary transition-all"><ZoomOut size={16}/></button>
                <span className="text-xs font-black text-slate-600 min-w-[50px] text-center font-mono">{previewZoom}%</span>
                <button onClick={() => setPreviewZoom(z => Math.min(200, z + 5))} className="p-2 text-slate-400 hover:text-sap-primary transition-all"><ZoomIn size={16}/></button>
            </div>

            <button onClick={() => window.print()} className="bg-sap-primary text-white px-10 py-3 rounded-2xl font-black text-xs flex items-center gap-3 shadow-xl hover:bg-sap-primary-hover active:scale-95 transition-all">
                <Printer size={18}/> طباعة اللوحة النهائية
            </button>
        </div>

        {/* WORKSTATION CANVAS - STRICT LANDSCAPE A4 */}
        <div className="flex-1 overflow-auto p-20 bg-slate-300/40 flex justify-center items-start custom-scrollbar">
            <div 
              className="bg-white shadow-[0_40px_100px_rgba(0,0,0,0.15)] origin-top transition-all duration-300 relative border border-slate-200" 
              style={{ 
                width: '297mm', // A4 Landscape
                height: '210mm', // A4 Landscape
                transform: `scale(${previewZoom / 100})`, 
                display: 'grid', 
                gridTemplateColumns: boardsPerPage === 2 ? '1fr 1fr' : '1fr', // Side by Side
                gridTemplateRows: '1fr',
                boxSizing: 'border-box' 
              } as any}
            >
                <div className={`w-full h-full relative group cursor-pointer transition-all ${activeBoardIdx === 0 ? 'ring-8 ring-sap-primary ring-inset' : 'hover:opacity-95'}`} onClick={() => setActiveBoardIdx(0)}>
                    <BoardRenderer board={boards[0]} s={styles} isSmall={boardsPerPage === 2} />
                    <div className="absolute top-6 left-6 bg-sap-primary text-white px-5 py-2 rounded-full text-[11px] font-black z-20 shadow-xl">اللوحة الأولى (أ)</div>
                </div>

                {boardsPerPage === 2 && (
                    <div className={`w-full h-full relative group cursor-pointer border-r-4 border-dashed border-slate-200 transition-all ${activeBoardIdx === 1 ? 'ring-8 ring-sap-primary ring-inset' : 'hover:opacity-95'}`} onClick={() => setActiveBoardIdx(1)}>
                        <BoardRenderer board={boards[1]} s={styles} isSmall={true} />
                        <div className="absolute top-6 right-6 bg-sap-secondary text-white px-5 py-2 rounded-full text-[11px] font-black z-20 shadow-xl">اللوحة الثانية (ب)</div>
                        <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 bg-slate-900 text-white px-2 py-6 rounded-full text-[12px] font-black z-30 shadow-2xl opacity-40 writing-vertical-lr" style={{ writingMode: 'vertical-rl' }}>خط القص</div>
                    </div>
                )}
            </div>
        </div>

        <button onClick={() => setShowProductPicker(true)} className="absolute bottom-10 right-10 w-20 h-20 bg-sap-secondary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 hover:rotate-90 transition-all z-50">
            <Plus size={40} strokeWidth={3} />
        </button>
      </main>

      {/* 3. SETTINGS SIDEBAR */}
      <aside className="w-[420px] border-l border-slate-200 bg-white flex flex-col shrink-0 no-print z-50 shadow-2xl overflow-hidden">
        <div className="p-6 bg-slate-50 border-b border-slate-100">
            <input 
                type="text" 
                value={projectName} 
                onChange={e => setProjectName(e.target.value)} 
                placeholder="اسم المشروع..."
                className="w-full text-xl font-black bg-transparent border-none focus:ring-0 p-0 text-slate-800 placeholder:text-slate-300"
            />
            <div className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1">
                <FolderOpen size={12} /> {activeProjectId ? 'مشروع محفوظ' : 'مشروع جديد (غير محفوظ)'}
            </div>
        </div>

        <div className="flex bg-slate-50 border-b border-slate-100 p-2 gap-1 shrink-0">
            {[
                { id: 'content', icon: Type, label: 'المحتوى' },
                { id: 'styling', icon: Paintbrush, label: 'التنسيق' },
                { id: 'projects', icon: Layers, label: 'الأرشيف' }
            ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 py-4 flex items-center justify-center gap-3 transition-all rounded-2xl ${activeTab === tab.id ? 'bg-white text-sap-primary shadow-sm font-black' : 'text-slate-400 hover:text-slate-600'}`}>
                    <tab.icon size={20} />
                    <span className="text-[12px] font-bold uppercase">{tab.label}</span>
                </button>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
            {activeTab === 'content' && (
                <div className="space-y-8">
                    <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white space-y-6 shadow-xl">
                        <div className="flex justify-between items-center">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-[4px]">تعديل اللوحة النشطة</span>
                           {boardsPerPage === 2 && (
                               <div className="flex gap-2">
                                   <button onClick={() => setActiveBoardIdx(0)} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeBoardIdx === 0 ? 'bg-sap-primary text-white shadow-md' : 'bg-white/10 text-white/40 hover:bg-white/20'}`}>اللوحة أ</button>
                                   <button onClick={() => setActiveBoardIdx(1)} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeBoardIdx === 1 ? 'bg-sap-primary text-white shadow-md' : 'bg-white/10 text-white/40 hover:bg-white/20'}`}>اللوحة ب</button>
                               </div>
                           )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                             {boardsPerPage === 2 && (
                                 <button onClick={duplicateBoard} disabled={boards[activeBoardIdx].items.length === 0} className="py-3 bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black text-white flex items-center justify-center gap-2 hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                     <Copy size={16}/> نسخ أ إلى ب
                                 </button>
                             )}
                             <button onClick={() => {
                                 setConfirmDialog({
                                     isOpen: true,
                                     message: 'هل أنت متأكد من مسح جميع المنتجات من هذه اللوحة؟',
                                     onConfirm: () => {
                                         setBoards(prev => prev.map((b, i) => i === activeBoardIdx ? { ...b, items: [] } : b));
                                         setConfirmDialog(null);
                                     }
                                 });
                             }} disabled={boards[activeBoardIdx].items.length === 0} className={`py-3 bg-red-500/20 text-red-400 rounded-2xl text-[10px] font-black flex items-center justify-center gap-2 hover:bg-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${boardsPerPage === 1 ? 'col-span-2' : ''}`}>
                                 <Trash size={16}/> مسح اللوحة
                             </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">عنوان اللوحة</label>
                        <input type="text" value={boards[activeBoardIdx].title} onChange={e => setBoards(prev => prev.map((b, i) => i === activeBoardIdx ? { ...b, title: e.target.value } : b))} className="w-full p-5 text-lg font-black bg-slate-50 border border-slate-200 rounded-[2rem] focus:border-sap-primary transition-all" />
                    </div>

                    <div className="space-y-5">
                        <div className="flex justify-between items-center px-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Boxes size={16}/> القائمة ({boards[activeBoardIdx].items.length})</span>
                            <button onClick={() => setShowProductPicker(true)} className="text-[10px] font-black text-sap-primary hover:underline">+ إضافة منتج</button>
                        </div>
                        <div className="space-y-3">
                            {boards[activeBoardIdx].items.length === 0 ? (
                                <div className="p-10 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-center gap-4 bg-slate-50">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                                        <Boxes size={32} className="text-slate-300" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-600 text-sm">اللوحة فارغة</h4>
                                        <p className="text-[10px] font-bold text-slate-400 mt-1">قم بإضافة منتجات للبدء في تصميم اللوحة</p>
                                    </div>
                                    <button onClick={() => setShowProductPicker(true)} className="mt-2 px-6 py-2 bg-sap-primary text-white rounded-xl text-xs font-black hover:bg-sap-primary-hover transition-all shadow-md">
                                        + إضافة منتج
                                    </button>
                                </div>
                            ) : (
                                boards[activeBoardIdx].items.map((item, idx) => (
                                    <div key={item.id} className={`p-4 rounded-[1.5rem] border-2 transition-all ${item.isOffer ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}>
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="bg-slate-100 text-slate-400 text-[9px] font-black px-3 py-1 rounded-full">#{idx+1}</span>
                                            <div className="flex gap-1 items-center bg-slate-50 p-1 rounded-xl border border-slate-100">
                                                <button onClick={() => {
                                                    if (idx === 0) return;
                                                    const n = [...boards];
                                                    const items = n[activeBoardIdx].items;
                                                    [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
                                                    setBoards(n);
                                                }} disabled={idx === 0} className="p-1.5 text-slate-400 hover:text-sap-primary hover:bg-white rounded-lg disabled:opacity-30 transition-all"><ChevronUp size={14}/></button>
                                                <button onClick={() => {
                                                    const n = [...boards];
                                                    const items = n[activeBoardIdx].items;
                                                    if (idx === items.length - 1) return;
                                                    [items[idx + 1], items[idx]] = [items[idx], items[idx + 1]];
                                                    setBoards(n);
                                                }} disabled={idx === boards[activeBoardIdx].items.length - 1} className="p-1.5 text-slate-400 hover:text-sap-primary hover:bg-white rounded-lg disabled:opacity-30 transition-all"><ChevronDown size={14}/></button>
                                                <div className="w-px h-4 bg-slate-200 mx-1"></div>
                                                <button onClick={() => {
                                                    const n = [...boards];
                                                    n[activeBoardIdx].items[idx].isOffer = !n[activeBoardIdx].items[idx].isOffer;
                                                    setBoards(n);
                                                }} className={`p-1.5 rounded-lg transition-all ${item.isOffer ? 'bg-red-500 text-white shadow-sm' : 'text-slate-400 hover:bg-white hover:text-amber-500'}`} title="تحديد كعرض خاص"><Zap size={14}/></button>
                                                <button onClick={() => {
                                                    const n = [...boards];
                                                    n[activeBoardIdx].items = n[activeBoardIdx].items.filter(i => i.id !== item.id);
                                                    setBoards(n);
                                                }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-all" title="حذف"><Trash size={14}/></button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-12 gap-3">
                                            <input type="text" value={item.label} onChange={e => {
                                                const n = [...boards];
                                                n[activeBoardIdx].items[idx].label = e.target.value;
                                                setBoards(n);
                                            }} className="col-span-8 p-3 text-xs font-black bg-slate-50 border border-slate-100 rounded-xl focus:border-sap-primary outline-none transition-all" placeholder="اسم المنتج" />
                                            <input type="text" value={item.price} onChange={e => {
                                                const n = [...boards];
                                                n[activeBoardIdx].items[idx].price = e.target.value;
                                                setBoards(n);
                                            }} className="col-span-4 p-3 text-xs font-black text-left text-sap-primary bg-sap-highlight border border-sap-primary/10 rounded-xl focus:border-sap-primary outline-none transition-all" placeholder="السعر" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'styling' && (
                <div className="space-y-10">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">قالب التصميم</label>
                        <div className="grid grid-cols-2 gap-3">
                            {themesList.map(t => (
                                <button 
                                    key={t.id} 
                                    onClick={() => setThemeId(t.id as PriceGroupTheme)}
                                    className={`relative p-4 rounded-[1.5rem] border-2 flex flex-col items-center gap-2 transition-all overflow-hidden ${themeId === t.id ? 'bg-sap-primary text-white border-sap-primary shadow-lg scale-[1.02]' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}
                                >
                                    {themeId === t.id && (
                                        <div className="absolute top-2 right-2 bg-white text-sap-primary rounded-full p-0.5 shadow-sm">
                                            <Check size={12} strokeWidth={4} />
                                        </div>
                                    )}
                                    <t.icon size={24} className={themeId === t.id ? 'text-white' : 'text-slate-300'}/>
                                    <span className="text-[11px] font-black">{t.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6 pt-6 border-t border-slate-100">
                        <div className="flex justify-between items-center px-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الألوان والتنسيق</label>
                            <button 
                                onClick={() => setStyles({
                                    primaryColor: '#006C35',
                                    secondaryColor: '#C5A059',
                                    backgroundColor: '#ffffff',
                                    textColor: '#1e293b',
                                    priceColor: '#006C35',
                                    borderColor: '#006C35',
                                    titleFontSize: 60,
                                    itemFontSize: 24,
                                    priceFontSize: 48,
                                    currencyFontSize: 24,
                                    currencySymbolType: 'icon'
                                })}
                                className="text-[9px] font-bold text-sap-primary hover:text-sap-primary/80 transition-colors"
                            >
                                استعادة الافتراضي
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <p className="text-[10px] font-bold text-slate-400 px-2">ألوان جاهزة (اختر لتطبيق سريع):</p>
                            <div className="flex gap-2 px-2 overflow-x-auto custom-scrollbar pb-2">
                                {colorPresets.map((preset, i) => (
                                    <button 
                                        key={i}
                                        onClick={() => setStyles({ ...styles, ...preset.colors })}
                                        className="shrink-0 flex flex-col items-center gap-2 group"
                                    >
                                        <div className="w-12 h-12 rounded-full border-2 border-slate-200 flex overflow-hidden shadow-sm group-hover:scale-110 group-hover:border-sap-primary transition-all">
                                            <div className="flex-1 h-full" style={{ backgroundColor: preset.colors.primaryColor }}></div>
                                            <div className="flex-1 h-full" style={{ backgroundColor: preset.colors.secondaryColor }}></div>
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-500">{preset.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="px-2">
                            <button 
                                onClick={() => setShowAdvancedColors(!showAdvancedColors)}
                                className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black flex items-center justify-between px-4 transition-all"
                            >
                                <span>تخصيص الألوان المتقدم</span>
                                <ChevronDown size={14} className={`transition-transform duration-300 ${showAdvancedColors ? 'rotate-180' : ''}`} />
                            </button>
                        </div>

                        {showAdvancedColors && (
                            <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                                {[
                                    { label: 'خلفية اللوحة', key: 'backgroundColor' },
                                    { label: 'لون الإطار', key: 'borderColor' },
                                    { label: 'لون العناوين', key: 'textColor' },
                                    { label: 'اللون الأساسي', key: 'primaryColor' },
                                    { label: 'لون الأسعار', key: 'priceColor' },
                                    { label: 'لون العناصر', key: 'secondaryColor' }
                                ].map(color => (
                                    <div key={color.key} className="space-y-2 bg-gray-50 p-3 rounded-2xl border border-gray-100 hover:border-sap-primary/30 transition-all">
                                        <span className="text-[9px] font-black text-slate-500">{color.label}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="relative w-8 h-8 rounded-lg overflow-hidden shadow-sm border border-slate-200 shrink-0">
                                                <input 
                                                    type="color" 
                                                    value={(styles as any)[color.key]} 
                                                    onChange={e => setStyles({...styles, [color.key]: e.target.value})} 
                                                    className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer" 
                                                />
                                            </div>
                                            <span className="text-[9px] font-mono font-bold uppercase text-slate-600">{(styles as any)[color.key]}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-8 pt-6 border-t border-slate-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">أحجام الخطوط</label>
                        {[
                            { label: 'حجم العنوان', key: 'titleFontSize', min: 20, max: 120 },
                            { label: 'حجم المنتج', key: 'itemFontSize', min: 10, max: 60 },
                            { label: 'حجم السعر', key: 'priceFontSize', min: 20, max: 150 },
                            { label: 'حجم رمز العملة', key: 'currencyFontSize', min: 10, max: 100 }
                        ].map(font => (
                            <div key={font.key} className="space-y-3 px-2">
                                <div className="flex justify-between items-center text-[10px] font-black text-slate-500">
                                    <span>{font.label}</span>
                                    <span className="text-sap-primary bg-sap-highlight px-2 py-0.5 rounded-md">{(styles as any)[font.key]}px</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] text-slate-300 font-bold">A</span>
                                    <input type="range" min={font.min} max={font.max} value={(styles as any)[font.key]} onChange={e => setStyles({...styles, [font.key]: Number(e.target.value)})} className="flex-1 accent-sap-primary h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                                    <span className="text-[14px] text-slate-400 font-bold">A</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-4 pt-6 border-t">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">رمز العملة</label>
                        <div className="space-y-3">
                            <select 
                                value={styles.currencySymbolType || 'icon'} 
                                onChange={e => setStyles({...styles, currencySymbolType: e.target.value as any})}
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:border-sap-primary outline-none"
                            >
                                <option value="icon">رمز (أيقونة)</option>
                                <option value="text">نص (ر.س)</option>
                                <option value="custom_image">صورة مخصصة</option>
                            </select>
                            
                            {styles.currencySymbolType === 'custom_image' && (
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <span className="text-xs font-bold text-gray-500">صورة العملة</span>
                                    <div className="flex items-center gap-2">
                                        {styles.currencySymbolImage && <img src={styles.currencySymbolImage} className="w-8 h-8 object-contain border border-gray-200 rounded bg-white" />}
                                        <label className="cursor-pointer bg-white hover:bg-gray-100 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 shadow-sm transition-all">
                                            رفع صورة
                                            <input type="file" className="hidden" onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) { 
                                                    const reader = new FileReader(); 
                                                    reader.onload = (re) => setStyles({...styles, currencySymbolImage: re.target?.result as string}); 
                                                    reader.readAsDataURL(file); 
                                                }
                                            }} />
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 pt-6 border-t">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">تخطيط الورقة (A4)</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => { setBoardsPerPage(1); setActiveBoardIdx(0); }} className={`p-6 rounded-[2rem] border-4 flex flex-col items-center gap-3 transition-all ${boardsPerPage === 1 ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 hover:border-slate-200'}`}>
                                <Monitor size={28}/> <span className="text-[12px] font-black">لوحة واحدة</span>
                            </button>
                            <button onClick={() => setBoardsPerPage(2)} className={`p-6 rounded-[2rem] border-4 flex flex-col items-center gap-3 transition-all ${boardsPerPage === 2 ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 hover:border-slate-200'}`}>
                                <LayoutGrid size={28}/> <span className="text-[12px] font-black">لوحة مزدوجة</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'projects' && (
                <div className="space-y-4">
                    <button onClick={createNew} className="w-full p-12 border-4 border-dashed border-slate-100 text-slate-300 hover:border-sap-primary hover:text-sap-primary hover:bg-sap-primary/5 rounded-[3rem] font-black text-sm flex flex-col items-center gap-4 transition-all">
                        <FilePlus size={40}/> إنشاء مشروع جديد
                    </button>
                    {projects.length === 0 ? (
                        <div className="p-10 flex flex-col items-center justify-center text-center gap-4 opacity-50">
                            <FolderOpen size={48} className="text-slate-300" />
                            <div>
                                <h4 className="font-black text-slate-600 text-sm">لا توجد مشاريع محفوظة</h4>
                                <p className="text-[10px] font-bold text-slate-400 mt-1">قم بإنشاء مشروع جديد للبدء</p>
                            </div>
                        </div>
                    ) : (
                        projects.map(pj => (
                            <div key={pj.id} className={`p-6 bg-white border-2 rounded-[2rem] hover:border-sap-primary hover:shadow-xl cursor-pointer flex justify-between items-center group transition-all ${activeProjectId === pj.id ? 'border-sap-primary shadow-md' : 'border-slate-100'}`} onClick={() => loadProject(pj)}>
                                 <div className="text-right">
                                     <div className="font-black text-slate-800 text-lg">{pj.name}</div>
                                     <div className="text-[10px] text-gray-400 font-bold mt-1">{new Date(pj.date).toLocaleDateString('ar-SA')}</div>
                                 </div>
                                 <button onClick={(e) => { 
                                     e.stopPropagation(); 
                                     setConfirmDialog({
                                         isOpen: true,
                                         message: 'هل أنت متأكد من حذف هذا المشروع نهائياً؟',
                                         onConfirm: () => {
                                             db.priceGroups.delete(pj.id); 
                                             fetchData();
                                             setConfirmDialog(null);
                                         }
                                     });
                                 }} className="p-3 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={20}/></button>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>

        <div className="p-8 border-t border-slate-100 bg-white shrink-0">
             <button onClick={handleSave} disabled={isSaving || saveSuccess} className={`w-full py-5 text-white rounded-[2rem] font-black text-base flex items-center justify-center gap-4 shadow-2xl transition-all ${saveSuccess ? 'bg-green-500 hover:bg-green-600' : 'bg-slate-900 hover:bg-slate-800'}`}>
                {isSaving ? <Loader2 size={24} className="animate-spin" /> : saveSuccess ? <Check size={24} /> : <Save size={24} />} 
                <span>{saveSuccess ? 'تم الحفظ بنجاح' : 'حفظ المشروع سحابياً'}</span>
            </button>
        </div>
      </aside>

      {/* PRODUCT PICKER MODAL */}
      {showProductPicker && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                <div className="p-8 bg-sap-shell text-white flex justify-between items-center">
                   <h3 className="font-black text-2xl flex items-center gap-4"><Boxes size={32} className="text-sap-secondary"/> قاعدة البيانات</h3>
                   <button onClick={() => setShowProductPicker(false)} className="p-3 hover:bg-white/10 rounded-full transition-all"><X size={28}/></button>
                </div>
                <div className="p-8 border-b">
                    <div className="relative">
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="بحث ذكي بالأصناف..." className="w-full p-6 pr-14 text-xl font-black bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:border-sap-primary" autoFocus />
                        <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300" size={32} />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-3">
                        <button onClick={() => addProductToBoard()} className="w-full p-4 border-2 border-dashed border-sap-primary/30 text-sap-primary bg-sap-highlight/10 hover:bg-sap-highlight/30 rounded-[1.5rem] font-black text-sm flex items-center justify-center gap-3 transition-all">
                            <Plus size={20}/> إضافة صنف يدوي
                        </button>
                        {filteredProducts.map((p) => (
                            <div key={p.id} onClick={() => addProductToBoard(p)} className="p-6 border-2 border-slate-50 rounded-[2rem] hover:border-sap-primary hover:shadow-xl cursor-pointer flex justify-between items-center transition-all group">
                                <div className="flex items-center gap-6">
                                    <div className="text-[11px] font-mono font-black text-sap-primary bg-sap-highlight px-4 py-2 rounded-xl">{p.code}</div>
                                    <div className="font-black text-xl text-slate-800">{p.name}</div>
                                </div>
                                <ArrowRight size={24} className="text-slate-200 group-hover:text-sap-primary" />
                            </div>
                        ))}
                </div>
             </div>
          </div>
      )}
      {/* CONFIRMATION DIALOG */}
      {confirmDialog?.isOpen && (
          <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="p-8 text-center space-y-4">
                      <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                          <Trash2 size={32} />
                      </div>
                      <h3 className="font-black text-xl text-slate-800">تأكيد الحذف</h3>
                      <p className="text-slate-500 font-bold text-sm">{confirmDialog.message}</p>
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                      <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-sm hover:bg-slate-50 transition-all">
                          إلغاء
                      </button>
                      <button onClick={confirmDialog.onConfirm} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-black text-sm hover:bg-red-600 transition-all shadow-md shadow-red-500/20">
                          نعم، احذف
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
