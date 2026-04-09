
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { PriceGroup, PriceGroupBoard, PriceGroupItem, Product, Unit, PriceGroupStyles, PriceGroupTheme } from '../types';
import { db } from '../services/supabase';
import { useSystemSettings } from './SystemSettingsContext';
import { CurrencySymbolRenderer } from './CurrencySymbolRenderer';
import { toPng } from 'html-to-image';
import { 
  Plus, Trash2, Save, Printer, FolderOpen, Loader2, Download,
  X, ZoomIn, ZoomOut, Search, Copy, 
  LayoutGrid, Star, FilePlus, Layers, 
  Smartphone, Monitor, Layout, Zap, Flame, Crown, Boxes, Type, 
  Paintbrush, Palette, Check, ArrowRight, Eye, Grid, Shapes, Diamond,
  Trophy, Activity, AlignRight, Bold, Maximize2, Move, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown,
  ArrowLeftRight, RefreshCw, Trash, Sparkles, Moon, Sun, Ghost, Wand2, Calendar, Leaf, ShoppingBag
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

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isProgrammaticChange = React.useRef(true); // Start true to ignore initial render

  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'content' | 'styling'>('content');
  const [boardsPerPage, setBoardsPerPage] = useState<1 | 2>(2);
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, message: string, onConfirm: () => void} | null>(null);
  const [downloadDialog, setDownloadDialog] = useState<{isOpen: boolean, fileName: string, targetId?: string} | null>(null);
  const [saveProjectDialog, setSaveProjectDialog] = useState<{isOpen: boolean, projectName: string} | null>(null);
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
    currencySymbolType: settings.currencySymbolType || 'icon',
    currencySymbolImage: settings.currencySymbolImage || null
  });

  useEffect(() => {
      if (isProgrammaticChange.current) {
          isProgrammaticChange.current = false;
          return;
      }
      setHasUnsavedChanges(true);
  }, [boards, styles, themeId, projectName, showLogo, logoUrl, boardsPerPage]);

  useEffect(() => {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
          if (hasUnsavedChanges) {
              e.preventDefault();
              e.returnValue = '';
          }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
      if (!(window as any).sf_unsaved_changes) {
          (window as any).sf_unsaved_changes = {};
      }
      (window as any).sf_unsaved_changes['price_groups'] = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
      setStyles(prev => ({
          ...prev,
          currencySymbolType: settings.currencySymbolType || prev.currencySymbolType,
          currencySymbolImage: settings.currencySymbolImage || prev.currencySymbolImage,
      }));
  }, [settings.currencySymbolType, settings.currencySymbolImage]);

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

  const executeSave = async (finalName: string) => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const projectData: PriceGroup = {
        id: activeProjectId || crypto.randomUUID(),
        name: finalName,
        date: new Date().toISOString(),
        boards,
        showLogo,
        logoUrl: null, // Strip logo
        themeId,
        styles: { ...styles, boardsPerPage, currencySymbolImage: null } // Strip currency image
      };
      await db.priceGroups.upsert(projectData);
      
      isProgrammaticChange.current = true;
      setActiveProjectId(projectData.id);
      setProjectName(finalName);
      setHasUnsavedChanges(false);
      
      fetchData();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) { alert("حدث خطأ أثناء الحفظ"); }
    finally { setIsSaving(false); }
  };

  const handleSave = () => {
    if (!activeProjectId) {
      setSaveProjectDialog({ isOpen: true, projectName: projectName });
    } else {
      executeSave(projectName);
    }
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

  const executeSaveAsImage = async (fileName: string, targetId: string = 'board-preview-container') => {
    const element = document.getElementById(targetId);
    if (!element) return;
    try {
      const dataUrl = await toPng(element, { quality: 1, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error saving image:', err);
      alert('حدث خطأ أثناء حفظ الصورة');
    }
  };

  const handleSaveAsImage = () => {
    setDownloadDialog({ isOpen: true, fileName: projectName });
  };

  const handleDuplicateProject = async (e: React.MouseEvent, pj: PriceGroup) => {
    e.stopPropagation();
    const newProject: PriceGroup = {
      ...pj,
      id: crypto.randomUUID(),
      name: `${pj.name} (نسخة)`,
      date: new Date().toISOString()
    };
    try {
      await db.priceGroups.upsert(newProject);
      setProjects([newProject, ...projects]);
      loadProject(newProject);
    } catch (err) {
      alert("حدث خطأ أثناء النسخ");
    }
  };

  const loadProject = (pj: PriceGroup) => {
    isProgrammaticChange.current = true;
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
        setStyles({
            ...styles, 
            ...pj.styles,
            currencySymbolImage: pj.styles.currencySymbolImage || settings.currencySymbolImage || null
        });
        setBoardsPerPage(pj.styles.boardsPerPage || 2);
    }
    setActiveTab('content');
    setHasUnsavedChanges(false);
  };

  const createNew = () => {
    isProgrammaticChange.current = true;
    setActiveProjectId(null);
    setProjectName('مشروع جديد');
    setBoards([
        { id: 'board_a', title: 'قائمة الأصناف - أ', items: [], isActive: true },
        { id: 'board_b', title: 'قائمة الأصناف - ب', items: [], isActive: true }
    ]);
    setActiveTab('content');
    setHasUnsavedChanges(false);
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
      { id: 'abstract_gradient', name: 'الناعم العضوي', icon: Sparkles },
      { id: 'ramadan_vibes', name: 'رمضاني', icon: Moon },
      { id: 'super_market', name: 'سوبر ماركت', icon: ShoppingBag },
      { id: 'elegant_gold', name: 'ذهبي فاخر', icon: Diamond },
      { id: 'fresh_nature', name: 'طبيعة طازجة', icon: Leaf }
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
                                <div className="font-bold break-words whitespace-normal" style={{ fontSize: `${s.itemFontSize * scale}px`, color: s.textColor, lineHeight: '1.4' }}>{item.label}</div>
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
                                <div></div>
                                {item.isOffer && <div className="bg-red-500 text-white text-[10px] font-bold px-3 py-1 animate-pulse rounded shrink-0">عرض خاص</div>}
                            </div>
                            <div className="font-bold leading-tight mb-5 break-words whitespace-normal" style={{ fontSize: `${s.itemFontSize * scale * 0.9}px`, color: s.textColor, lineHeight: '1.4' }}>{item.label}</div>
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
                            <div className="font-bold break-words whitespace-normal shrink-0 max-w-[50%]" style={{ fontSize: `${s.itemFontSize * scale}px`, color: s.textColor, lineHeight: '1.4' }}>{item.label}</div>
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
                            <div className="flex-1 flex items-center justify-between p-5 min-w-0 flex-nowrap">
                                <div className="font-black break-words whitespace-normal flex-1 min-w-0" style={{ fontSize: `${s.itemFontSize * scale * 1.1}px`, color: s.textColor, lineHeight: '1.4' }}>{item.label}</div>
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
    if (themeId === 'abstract_gradient') {
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
                                <div className="font-bold break-words whitespace-normal" style={{ fontSize: `${s.itemFontSize * scale}px`, color: s.textColor, lineHeight: '1.4' }}>{item.label}</div>
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
    }

    // Theme 6: ramadan_vibes (رمضاني)
    if (themeId === 'ramadan_vibes') {
        return (
            <div className="w-full h-full flex flex-col relative text-right overflow-hidden" style={{ padding: `${s.padding * scale}px`, backgroundColor: s.backgroundColor, border: `${s.borderWidth * scale}px solid ${s.primaryColor}` }}>
                {/* Islamic geometric pattern overlay (simplified with CSS) */}
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(45deg, ${s.primaryColor} 25%, transparent 25%, transparent 75%, ${s.primaryColor} 75%, ${s.primaryColor}), repeating-linear-gradient(45deg, ${s.primaryColor} 25%, ${s.backgroundColor} 25%, ${s.backgroundColor} 75%, ${s.primaryColor} 75%, ${s.primaryColor})`, backgroundPosition: '0 0, 20px 20px', backgroundSize: '40px 40px' }}></div>
                
                {/* Crescent moon decoration */}
                <div className="absolute top-4 left-4 opacity-20 pointer-events-none">
                    <Moon size={120 * scale} fill={s.secondaryColor} color={s.secondaryColor} />
                </div>

                <div className="flex flex-col items-center mb-8 relative z-10">
                    {showLogo && logoUrl ? <img src={logoUrl} className={`${isSmall ? 'h-16' : 'h-24'} object-contain mb-4`} /> : null}
                    <div className="relative inline-block px-12 py-4 border-y-2" style={{ borderColor: s.secondaryColor }}>
                        <div className="absolute top-0 left-0 w-2 h-full border-l-2" style={{ borderColor: s.secondaryColor }}></div>
                        <div className="absolute top-0 right-0 w-2 h-full border-r-2" style={{ borderColor: s.secondaryColor }}></div>
                        <h1 className="font-black text-center tracking-tight" style={{ fontSize: `${s.titleFontSize * scale}px`, color: s.textColor }}>{board.title}</h1>
                    </div>
                </div>
                
                <div className="flex-1 grid grid-cols-1 gap-4 relative z-10">
                    {board.items.length === 0 ? <EmptyState /> : board.items.map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between py-2 border-b border-dashed" style={{ borderColor: `${s.primaryColor}40` }}>
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Star size={16 * scale} fill={s.secondaryColor} color={s.secondaryColor} className="shrink-0" />
                                <div className="font-bold break-words whitespace-normal" style={{ fontSize: `${s.itemFontSize * scale}px`, color: s.textColor, lineHeight: '1.4' }}>{item.label}</div>
                            </div>
                            <div className="flex items-baseline gap-1.5 shrink-0 mr-4 flex-nowrap bg-white/80 px-4 py-1 rounded-full shadow-sm border" style={{ borderColor: `${s.secondaryColor}30` }}>
                                <span className="font-black shrink-0" style={{ fontSize: `${s.priceFontSize * scale}px`, color: item.isOffer ? '#ef4444' : s.priceColor }}>{item.price}</span>
                                <CurrencySymbolRenderer type={s.currencySymbolType || 'icon'} imageUrl={s.currencySymbolImage} color={s.textColor} style={{ width: `${s.currencyFontSize * scale}px`, height: `${s.currencyFontSize * scale}px` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Theme 7: super_market (سوبر ماركت)
    if (themeId === 'super_market') {
        return (
            <div className="w-full h-full flex flex-col relative text-right overflow-hidden" style={{ padding: `${s.padding * scale}px`, backgroundColor: s.backgroundColor, border: `${s.borderWidth * scale}px solid ${s.primaryColor}` }}>
                <div className="flex justify-between items-center mb-6 px-6 py-4 rounded-xl shadow-md relative z-10" style={{ backgroundImage: `linear-gradient(to left, ${s.primaryColor}, ${s.secondaryColor})`, backgroundColor: s.primaryColor }}>
                    <h1 className="font-black tracking-tight text-white" style={{ fontSize: `${s.titleFontSize * scale}px` }}>{board.title}</h1>
                    {showLogo && logoUrl ? <img src={logoUrl} className={`${isSmall ? 'h-12' : 'h-16'} object-contain bg-white p-2 rounded-lg`} /> : null}
                </div>
                
                <div className="flex-1 grid grid-cols-2 gap-4 relative z-10 content-start">
                    {board.items.length === 0 ? <div className="col-span-2"><EmptyState /></div> : board.items.map((item, idx) => (
                        <div key={item.id} className="flex flex-col justify-between bg-white border-2 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden" style={{ borderColor: `${s.primaryColor}30` }}>
                            {item.isOffer && (
                                <div className="absolute top-0 left-0 bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-br-xl">عرض خاص</div>
                            )}
                            <div className="font-black break-words whitespace-normal mb-4 mt-2 text-center" style={{ fontSize: `${s.itemFontSize * scale}px`, color: s.textColor, lineHeight: '1.3' }}>{item.label}</div>
                            <div className="flex items-center justify-center gap-1.5 flex-nowrap bg-yellow-100 py-2 rounded-xl border-2 border-yellow-300">
                                <span className="font-black shrink-0" style={{ fontSize: `${s.priceFontSize * scale * 1.1}px`, color: '#dc2626' }}>{item.price}</span>
                                <CurrencySymbolRenderer type={s.currencySymbolType || 'icon'} imageUrl={s.currencySymbolImage} color="#dc2626" style={{ width: `${s.currencyFontSize * scale}px`, height: `${s.currencyFontSize * scale}px` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Theme 8: elegant_gold (ذهبي فاخر)
    if (themeId === 'elegant_gold') {
        return (
            <div className="w-full h-full flex flex-col relative text-right overflow-hidden bg-slate-900" style={{ padding: `${s.padding * scale}px`, backgroundColor: s.backgroundColor }}>
                <div className="absolute inset-4 border border-opacity-50 pointer-events-none" style={{ borderColor: s.secondaryColor }}></div>
                <div className="absolute inset-5 border border-opacity-20 pointer-events-none" style={{ borderColor: s.secondaryColor }}></div>
                
                <div className="flex flex-col items-center mb-12 relative z-10 pt-8">
                    {showLogo && logoUrl ? <img src={logoUrl} className={`${isSmall ? 'h-16' : 'h-20'} object-contain mb-6`} /> : null}
                    <h1 className="font-serif font-black tracking-widest text-center" style={{ fontSize: `${s.titleFontSize * scale}px`, color: s.secondaryColor }}>{board.title}</h1>
                    <div className="flex items-center gap-4 mt-4">
                        <div className="h-px w-16" style={{ backgroundColor: s.secondaryColor }}></div>
                        <Diamond size={16 * scale} color={s.secondaryColor} fill={s.secondaryColor} />
                        <div className="h-px w-16" style={{ backgroundColor: s.secondaryColor }}></div>
                    </div>
                </div>
                
                <div className="flex-1 px-8 relative z-10">
                    {board.items.length === 0 ? <EmptyState /> : board.items.map((item, idx) => (
                        <div key={item.id} className="flex items-end justify-between py-4 mb-4 group flex-nowrap">
                            <div className="flex-1 min-w-0 pr-4">
                                <div className="font-serif font-bold break-words whitespace-normal" style={{ fontSize: `${s.itemFontSize * scale}px`, color: s.textColor, lineHeight: '1.4' }}>{item.label}</div>
                            </div>
                            <div className="flex-1 border-b border-dotted mx-4 mb-2 opacity-30" style={{ borderColor: s.secondaryColor }}></div>
                            <div className="flex items-baseline gap-1.5 shrink-0 pl-4 flex-nowrap">
                                <span className="font-serif font-black shrink-0" style={{ fontSize: `${s.priceFontSize * scale}px`, color: s.secondaryColor }}>{item.price}</span>
                                <CurrencySymbolRenderer type={s.currencySymbolType || 'icon'} imageUrl={s.currencySymbolImage} color={s.secondaryColor} style={{ width: `${s.currencyFontSize * scale}px`, height: `${s.currencyFontSize * scale}px` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Theme 9: fresh_nature (طبيعة طازجة)
    if (themeId === 'fresh_nature') {
        return (
            <div className="w-full h-full flex flex-col relative text-right overflow-hidden rounded-[2rem]" style={{ padding: `${s.padding * scale}px`, backgroundColor: s.backgroundColor, border: `${s.borderWidth * scale}px solid ${s.primaryColor}` }}>
                {/* Subtle leaf pattern background */}
                <div className="absolute top-0 left-0 w-full h-32 opacity-10 pointer-events-none" style={{ background: `linear-gradient(to bottom, ${s.primaryColor}, transparent)` }}></div>
                <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none transform rotate-45">
                    <Leaf size={200 * scale} color={s.primaryColor} fill={s.primaryColor} />
                </div>
                <div className="absolute -bottom-10 -left-10 opacity-5 pointer-events-none transform -rotate-45">
                    <Leaf size={200 * scale} color={s.primaryColor} fill={s.primaryColor} />
                </div>

                <div className="flex justify-between items-center mb-8 bg-white/80 backdrop-blur-sm p-6 rounded-3xl shadow-sm border relative z-10" style={{ borderColor: `${s.primaryColor}20` }}>
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl" style={{ backgroundColor: `${s.primaryColor}15`, color: s.primaryColor }}>
                            <Leaf size={32 * scale} />
                        </div>
                        <h1 className="font-black tracking-tight" style={{ fontSize: `${s.titleFontSize * scale}px`, color: s.textColor }}>{board.title}</h1>
                    </div>
                    {showLogo && logoUrl ? <img src={logoUrl} className={`${isSmall ? 'h-14' : 'h-20'} object-contain`} /> : null}
                </div>
                
                <div className="flex-1 grid grid-cols-1 gap-3 relative z-10">
                    {board.items.length === 0 ? <EmptyState /> : board.items.map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border hover:shadow-md transition-shadow flex-nowrap" style={{ borderColor: `${s.primaryColor}15` }}>
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.secondaryColor }}></div>
                                <div className="font-bold break-words whitespace-normal" style={{ fontSize: `${s.itemFontSize * scale}px`, color: s.textColor, lineHeight: '1.4' }}>{item.label}</div>
                            </div>
                            <div className="flex items-baseline gap-1.5 shrink-0 mr-4 flex-nowrap bg-green-50 px-5 py-2 rounded-xl" style={{ backgroundColor: `${s.primaryColor}10` }}>
                                <span className="font-black shrink-0" style={{ fontSize: `${s.priceFontSize * scale}px`, color: s.priceColor }}>{item.price}</span>
                                <CurrencySymbolRenderer type={s.currencySymbolType || 'icon'} imageUrl={s.currencySymbolImage} color={s.priceColor} style={{ width: `${s.currencyFontSize * scale}px`, height: `${s.currencyFontSize * scale}px` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Fallback to geometric_luxe if theme not found
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
                            <div className="font-bold break-words whitespace-normal" style={{ fontSize: `${s.itemFontSize * scale}px`, color: s.textColor, lineHeight: '1.4' }}>{item.label}</div>
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
          @page { size: A4 landscape; margin: 0 !important; } 
          @media print { 
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
    <div className="h-full w-full flex flex-row-reverse overflow-hidden animate-in fade-in duration-500 bg-slate-50 relative font-sans" dir="rtl">
      
      {/* 1. PORTAL FOR PRINTING - This goes to the top-level #print-container */}
      <FullPagePrint />

      {/* 2. MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col overflow-hidden relative no-print">
        <div className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 flex justify-between items-center px-8 shrink-0 z-40 shadow-sm">
            <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-gradient-to-br from-sap-primary to-sap-primary/80 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-sap-primary/20"><Monitor size={24} strokeWidth={1.5}/></div>
                <div>
                   <h2 className="text-lg font-black text-slate-800 tracking-tight">مصمم الشاشات الذكية</h2>
                   <p className="text-xs font-bold text-slate-500">تصميم وعرض لوحات الأسعار (A4 عرضي)</p>
                </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/60">
                <button onClick={() => setPreviewZoom(z => Math.max(10, z - 5))} className="p-2 text-slate-500 hover:text-sap-primary hover:bg-white rounded-xl transition-all"><ZoomOut size={18}/></button>
                <span className="text-xs font-black text-slate-700 min-w-[50px] text-center font-mono">{previewZoom}%</span>
                <button onClick={() => setPreviewZoom(z => Math.min(200, z + 5))} className="p-2 text-slate-500 hover:text-sap-primary hover:bg-white rounded-xl transition-all"><ZoomIn size={18}/></button>
            </div>

            <div className="flex items-center gap-3">
                <button onClick={() => setShowArchiveModal(true)} className="bg-white text-slate-600 border border-slate-200 px-6 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 shadow-sm hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all">
                    <FolderOpen size={18}/> الأرشيف
                </button>
                <button onClick={handleSaveAsImage} className="bg-white text-sap-primary border border-sap-primary/20 px-6 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 shadow-sm hover:bg-sap-highlight hover:border-sap-primary/40 active:scale-95 transition-all">
                    <Download size={18}/> حفظ كصورة
                </button>
                <button onClick={() => window.print()} className="bg-gradient-to-r from-sap-primary to-sap-primary/90 text-white px-8 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg shadow-sap-primary/20 hover:shadow-xl hover:shadow-sap-primary/30 active:scale-95 transition-all">
                    <Printer size={18}/> طباعة اللوحة
                </button>
            </div>
        </div>

        {/* WORKSTATION CANVAS - STRICT LANDSCAPE A4 */}
        <div className="flex-1 overflow-auto p-10 md:p-20 flex justify-center items-start custom-scrollbar relative" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            <div style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: 'top center' }}>
                <div 
                  id="board-preview-container"
                  className="bg-white shadow-[0_40px_100px_rgba(0,0,0,0.15)] origin-top transition-all duration-300 relative border border-slate-200" 
                  style={{ 
                    width: '297mm', // A4 Landscape
                    height: '210mm', // A4 Landscape
                    display: 'grid', 
                    gridTemplateColumns: boardsPerPage === 2 ? '1fr 1fr' : '1fr', // Side by Side
                    gridTemplateRows: '1fr',
                    boxSizing: 'border-box' 
                  } as any}
                >
                <div className={`w-full h-full relative group cursor-pointer transition-all ${activeBoardIdx === 0 ? 'ring-8 ring-sap-primary ring-inset' : 'hover:opacity-95'}`} onClick={() => setActiveBoardIdx(0)}>
                    <div id={`board-preview-${boards[0].id}`} className="w-full h-full bg-white">
                        <BoardRenderer board={boards[0]} s={styles} isSmall={boardsPerPage === 2} />
                    </div>
                    <div className="absolute top-6 left-6 bg-sap-primary text-white px-5 py-2 rounded-full text-[11px] font-black z-20 shadow-xl no-print">اللوحة الأولى (أ)</div>
                    {activeBoardIdx === 0 && (
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white shadow-xl rounded-lg flex items-center gap-1 p-1.5 border border-gray-200 z-50 no-print">
                            <button onClick={(e) => { e.stopPropagation(); setDownloadDialog({ isOpen: true, fileName: `${projectName} - اللوحة الأولى`, targetId: `board-preview-${boards[0].id}` }); }} className="p-2 hover:bg-gray-100 text-gray-600 rounded" title="حفظ كصورة"><Download size={16}/></button>
                        </div>
                    )}
                </div>

                {boardsPerPage === 2 && (
                    <div className={`w-full h-full relative group cursor-pointer border-r-4 border-dashed border-slate-200 transition-all ${activeBoardIdx === 1 ? 'ring-8 ring-sap-primary ring-inset' : 'hover:opacity-95'}`} onClick={() => setActiveBoardIdx(1)}>
                        <div id={`board-preview-${boards[1].id}`} className="w-full h-full bg-white">
                            <BoardRenderer board={boards[1]} s={styles} isSmall={true} />
                        </div>
                        <div className="absolute top-6 right-6 bg-sap-secondary text-white px-5 py-2 rounded-full text-[11px] font-black z-20 shadow-xl no-print">اللوحة الثانية (ب)</div>
                        <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 bg-slate-900 text-white px-2 py-6 rounded-full text-[12px] font-black z-30 shadow-2xl opacity-40 writing-vertical-lr no-print" style={{ writingMode: 'vertical-rl' }}>خط القص</div>
                        {activeBoardIdx === 1 && (
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white shadow-xl rounded-lg flex items-center gap-1 p-1.5 border border-gray-200 z-50 no-print">
                                <button onClick={(e) => { e.stopPropagation(); setDownloadDialog({ isOpen: true, fileName: `${projectName} - اللوحة الثانية`, targetId: `board-preview-${boards[1].id}` }); }} className="p-2 hover:bg-gray-100 text-gray-600 rounded" title="حفظ كصورة"><Download size={16}/></button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            </div>
        </div>

        <button onClick={() => setShowProductPicker(true)} className="absolute bottom-10 right-10 w-20 h-20 bg-sap-secondary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 hover:rotate-90 transition-all z-50">
            <Plus size={40} strokeWidth={3} />
        </button>
      </main>

      {/* 3. SETTINGS SIDEBAR */}
      <aside className="w-[340px] border-l border-slate-200/60 bg-white/95 backdrop-blur-xl flex flex-col shrink-0 no-print z-50 shadow-2xl overflow-hidden">
        <div className="p-6 bg-white border-b border-slate-100">
            <input 
                type="text" 
                value={projectName} 
                onChange={e => setProjectName(e.target.value)} 
                placeholder="اسم المشروع..."
                className="w-full text-2xl font-black bg-transparent border-none focus:ring-0 p-0 text-slate-800 placeholder:text-slate-300"
            />
            <div className="text-[11px] font-bold text-slate-400 mt-2 flex items-center gap-1.5">
                <FolderOpen size={14} /> {activeProjectId ? 'مشروع محفوظ' : 'مشروع جديد (غير محفوظ)'}
            </div>
        </div>

        <div className="flex bg-slate-100/50 p-1.5 gap-1 shrink-0 m-4 rounded-2xl border border-slate-200/50">
            {[
                { id: 'content', icon: Type, label: 'المحتوى' },
                { id: 'styling', icon: Paintbrush, label: 'التنسيق' }
            ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 py-3 flex flex-col items-center justify-center gap-1.5 transition-all rounded-xl ${activeTab === tab.id ? 'bg-white text-sap-primary shadow-sm font-black scale-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 scale-95'}`}>
                    <tab.icon size={18} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
                </button>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
            {activeTab === 'content' && (
                <div className="space-y-8">
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-[2rem] text-white space-y-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                        <div className="flex justify-between items-center relative z-10">
                           <span className="text-[10px] font-black text-slate-300 uppercase tracking-[4px]">تعديل اللوحة النشطة</span>
                           {boardsPerPage === 2 && (
                               <div className="flex gap-1 bg-black/20 p-1 rounded-xl">
                                   <button onClick={() => setActiveBoardIdx(0)} className={`px-5 py-1.5 rounded-lg text-xs font-black transition-all ${activeBoardIdx === 0 ? 'bg-sap-primary text-white shadow-md' : 'text-white/60 hover:bg-white/10'}`}>اللوحة أ</button>
                                   <button onClick={() => setActiveBoardIdx(1)} className={`px-5 py-1.5 rounded-lg text-xs font-black transition-all ${activeBoardIdx === 1 ? 'bg-sap-primary text-white shadow-md' : 'text-white/60 hover:bg-white/10'}`}>اللوحة ب</button>
                               </div>
                           )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 relative z-10">
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
                        <input type="text" value={boards[activeBoardIdx].title} onChange={e => setBoards(prev => prev.map((b, i) => i === activeBoardIdx ? { ...b, title: e.target.value } : b))} className="w-full p-5 text-lg font-black bg-slate-50 border border-slate-200/60 rounded-[1.5rem] focus:border-sap-primary focus:bg-white focus:ring-4 focus:ring-sap-primary/10 transition-all outline-none" />
                    </div>

                    <div className="space-y-5">
                        <div className="flex justify-between items-center px-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Boxes size={16}/> القائمة ({boards[activeBoardIdx].items.length})</span>
                            <button onClick={() => setShowProductPicker(true)} className="text-[10px] font-black text-sap-primary hover:underline flex items-center gap-1"><Plus size={12}/> إضافة منتج</button>
                        </div>
                        <div className="space-y-3">
                            {boards[activeBoardIdx].items.length === 0 ? (
                                <div className="p-10 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-center gap-4 bg-slate-50/50">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100">
                                        <Boxes size={32} className="text-slate-300" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-600 text-sm">اللوحة فارغة</h4>
                                        <p className="text-[10px] font-bold text-slate-400 mt-1">قم بإضافة منتجات للبدء في تصميم اللوحة</p>
                                    </div>
                                    <button onClick={() => setShowProductPicker(true)} className="mt-2 px-6 py-2.5 bg-sap-primary text-white rounded-xl text-xs font-black hover:bg-sap-primary-hover transition-all shadow-md">
                                        + إضافة منتج
                                    </button>
                                </div>
                            ) : (
                                boards[activeBoardIdx].items.map((item, idx) => (
                                    <div key={item.id} className={`p-4 rounded-[1.5rem] border-2 transition-all duration-300 hover:shadow-md ${item.isOffer ? 'bg-red-50/50 border-red-200' : 'bg-white border-slate-100 hover:border-sap-primary/30'}`}>
                                        <div className="flex justify-between items-center mb-4">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-2.5 py-1 rounded-lg">#{idx+1}</span>
                                                {item.isOffer && <span className="bg-red-100 text-red-600 text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1"><Flame size={12}/> عرض خاص</span>}
                                            </div>
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
                                                    const itemToCopy = n[activeBoardIdx].items[idx];
                                                    const newItem = { ...itemToCopy, id: crypto.randomUUID() };
                                                    n[activeBoardIdx].items.splice(idx + 1, 0, newItem);
                                                    setBoards(n);
                                                }} className="p-1.5 text-slate-400 hover:text-sap-primary hover:bg-white rounded-lg transition-all" title="نسخ"><Copy size={14}/></button>
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
                                            }} className="col-span-8 p-3 text-xs font-black bg-slate-50 border border-slate-100 rounded-xl focus:border-sap-primary focus:bg-white outline-none transition-all" placeholder="اسم المنتج" />
                                            <input type="text" value={item.price} onChange={e => {
                                                const n = [...boards];
                                                n[activeBoardIdx].items[idx].price = e.target.value;
                                                setBoards(n);
                                            }} className="col-span-4 p-3 text-xs font-black text-left text-sap-primary bg-sap-highlight border border-sap-primary/10 rounded-xl focus:border-sap-primary focus:bg-white outline-none transition-all" placeholder="السعر" />
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
                                    className={`relative p-4 rounded-[1.5rem] border-2 flex flex-col items-center gap-3 transition-all overflow-hidden ${themeId === t.id ? 'bg-gradient-to-br from-sap-primary to-sap-primary/80 text-white border-transparent shadow-lg shadow-sap-primary/20 scale-[1.02]' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}
                                >
                                    {themeId === t.id && (
                                        <div className="absolute top-2 right-2 bg-white/20 backdrop-blur-sm text-white rounded-full p-0.5 shadow-sm">
                                            <Check size={12} strokeWidth={4} />
                                        </div>
                                    )}
                                    <t.icon size={28} className={themeId === t.id ? 'text-white' : 'text-slate-300'} strokeWidth={1.5}/>
                                    <span className="text-[11px] font-black">{t.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6 pt-6 border-t border-slate-100">
                        <div className="flex justify-between items-center px-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الألوان والتنسيق</label>
                            <button 
                                onClick={() => setStyles(prev => ({
                                    ...prev,
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
                                }))}
                                className="text-[9px] font-bold text-sap-primary hover:text-sap-primary/80 transition-colors"
                            >
                                استعادة الافتراضي
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <p className="text-[10px] font-bold text-slate-400 px-2">ألوان جاهزة (اختر لتطبيق سريع):</p>
                            <div className="flex gap-3 px-2 overflow-x-auto custom-scrollbar pb-3">
                                {colorPresets.map((preset, i) => (
                                    <button 
                                        key={i}
                                        onClick={() => setStyles({ ...styles, ...preset.colors })}
                                        className="shrink-0 flex flex-col items-center gap-2 group"
                                    >
                                        <div className="w-14 h-14 rounded-full border-2 border-slate-100 flex overflow-hidden shadow-sm group-hover:scale-110 group-hover:border-sap-primary group-hover:shadow-md transition-all">
                                            <div className="flex-1 h-full" style={{ backgroundColor: preset.colors.primaryColor }}></div>
                                            <div className="flex-1 h-full" style={{ backgroundColor: preset.colors.secondaryColor }}></div>
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-500 group-hover:text-sap-primary transition-colors">{preset.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="px-2">
                            <button 
                                onClick={() => setShowAdvancedColors(!showAdvancedColors)}
                                className="w-full py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black flex items-center justify-between px-5 transition-all border border-slate-100"
                            >
                                <span>تخصيص الألوان المتقدم</span>
                                <ChevronDown size={14} className={`transition-transform duration-300 ${showAdvancedColors ? 'rotate-180' : ''}`} />
                            </button>
                        </div>

                        {showAdvancedColors && (
                            <div className="grid grid-cols-2 gap-3 px-2 animate-in slide-in-from-top-2 duration-200">
                                {[
                                    { label: 'خلفية اللوحة', key: 'backgroundColor' },
                                    { label: 'لون الإطار', key: 'borderColor' },
                                    { label: 'لون العناوين', key: 'textColor' },
                                    { label: 'اللون الأساسي', key: 'primaryColor' },
                                    { label: 'لون الأسعار', key: 'priceColor' },
                                    { label: 'لون العناصر', key: 'secondaryColor' }
                                ].map(color => (
                                    <div key={color.key} className="space-y-2 bg-white p-3 rounded-2xl border border-slate-100 hover:border-sap-primary/30 hover:shadow-sm transition-all">
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
                            <div key={font.key} className="space-y-3 px-2 bg-white p-3 rounded-2xl border border-slate-50 shadow-sm">
                                <div className="flex justify-between items-center text-[10px] font-black text-slate-500">
                                    <span>{font.label}</span>
                                    <span className="text-sap-primary bg-sap-highlight px-2 py-1 rounded-md font-mono">{Number((styles as any)[font.key])}px</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] text-slate-300 font-bold">A</span>
                                    <input type="range" min={font.min} max={font.max} value={(styles as any)[font.key]} onChange={e => setStyles({...styles, [font.key]: Number(e.target.value)})} className="flex-1 accent-sap-primary h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer hover:bg-slate-200 transition-colors" />
                                    <span className="text-[14px] text-slate-400 font-black">A</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-4 pt-6 border-t border-slate-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">رمز العملة</label>
                        <div className="space-y-3 px-2">
                            <div className="relative">
                                <select 
                                    value={styles.currencySymbolType || 'icon'} 
                                    onChange={e => setStyles({...styles, currencySymbolType: e.target.value as any})}
                                    className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 focus:border-sap-primary focus:ring-4 focus:ring-sap-primary/10 outline-none appearance-none transition-all shadow-sm"
                                >
                                    <option value="icon">رمز (أيقونة)</option>
                                    <option value="text">نص (ر.س)</option>
                                    <option value="custom_image">صورة مخصصة</option>
                                </select>
                                <ChevronDown size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                            
                            {styles.currencySymbolType === 'custom_image' && (
                                <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                                    <span className="text-[11px] font-black text-slate-500">صورة العملة</span>
                                    <div className="flex items-center gap-3">
                                        {styles.currencySymbolImage && <img src={styles.currencySymbolImage} className="w-10 h-10 object-contain border border-slate-100 rounded-lg bg-slate-50 p-1" />}
                                        <label className="cursor-pointer bg-slate-50 hover:bg-sap-highlight text-sap-primary px-4 py-2 rounded-lg text-[11px] font-black border border-slate-200 hover:border-sap-primary/30 transition-all">
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

                    <div className="space-y-4 pt-6 border-t border-slate-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">تخطيط الورقة (A4)</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => { setBoardsPerPage(1); setActiveBoardIdx(0); }} className={`p-6 rounded-[2rem] border-2 flex flex-col items-center gap-3 transition-all ${boardsPerPage === 1 ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}>
                                <Monitor size={28} strokeWidth={1.5}/> <span className="text-[12px] font-black">لوحة واحدة</span>
                            </button>
                            <button onClick={() => setBoardsPerPage(2)} className={`p-6 rounded-[2rem] border-2 flex flex-col items-center gap-3 transition-all ${boardsPerPage === 2 ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}>
                                <LayoutGrid size={28} strokeWidth={1.5}/> <span className="text-[12px] font-black">لوحة مزدوجة</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>

        <div className="p-6 border-t border-slate-100 bg-white shrink-0">
             <button onClick={handleSave} disabled={isSaving || saveSuccess} className={`w-full py-3.5 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${saveSuccess ? 'bg-green-500 hover:bg-green-600' : 'bg-slate-900 hover:bg-slate-800'}`}>
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : saveSuccess ? <Check size={18} /> : <Save size={18} />} 
                <span>{saveSuccess ? 'تم الحفظ بنجاح' : 'حفظ المشروع سحابياً'}</span>
            </button>
        </div>
      </aside>

      {/* ARCHIVE MODAL */}
      {showArchiveModal && (
          <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-slate-100">
                <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                   <h3 className="font-black text-xl text-slate-800 flex items-center gap-3"><Layers size={24} className="text-sap-primary"/> أرشيف المشاريع</h3>
                   <button onClick={() => setShowArchiveModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onClick={() => { createNew(); setShowArchiveModal(false); }} className="p-8 border-2 border-dashed border-slate-200 text-slate-400 hover:border-sap-primary hover:text-sap-primary hover:bg-sap-primary/5 rounded-[1.5rem] font-black text-sm flex flex-col items-center justify-center gap-3 transition-all h-full min-h-[160px]">
                            <FilePlus size={32} strokeWidth={1.5}/> إنشاء مشروع جديد
                        </button>
                        {projects.length === 0 ? (
                            <div className="p-8 flex flex-col items-center justify-center text-center gap-4 opacity-50 border-2 border-transparent rounded-[1.5rem] min-h-[160px]">
                                <FolderOpen size={48} className="text-slate-300" strokeWidth={1.5} />
                                <div>
                                    <h4 className="font-black text-slate-600 text-sm">لا توجد مشاريع محفوظة</h4>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1">قم بإنشاء مشروع جديد للبدء</p>
                                </div>
                            </div>
                        ) : (
                            projects.map(pj => (
                                <div key={pj.id} className={`p-6 bg-white border-2 rounded-[1.5rem] hover:border-sap-primary hover:shadow-lg cursor-pointer flex flex-col justify-between group transition-all duration-300 min-h-[160px] ${activeProjectId === pj.id ? 'border-sap-primary shadow-md ring-4 ring-sap-primary/10' : 'border-slate-100'}`} onClick={() => { loadProject(pj); setShowArchiveModal(false); }}>
                                    <div className="flex justify-between items-start">
                                        <div className="text-right">
                                            <div className="font-black text-slate-800 text-lg">{pj.name}</div>
                                            <div className="text-xs text-gray-400 font-bold mt-1.5 flex items-center gap-1.5"><Calendar size={12}/> {new Date(pj.date).toLocaleDateString('ar-SA')}</div>
                                        </div>
                                        {activeProjectId === pj.id && (
                                            <span className="bg-sap-primary/10 text-sap-primary text-[10px] px-2 py-1 rounded-lg font-bold">النشط حالياً</span>
                                        )}
                                    </div>
                                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); handleDuplicateProject(e, pj); }} className="flex-1 py-2 bg-slate-50 text-slate-500 hover:text-sap-primary hover:bg-sap-highlight rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"><Copy size={14}/> نسخ</button>
                                        <button onClick={(e) => { 
                                            e.stopPropagation(); 
                                            setConfirmDialog({
                                                isOpen: true,
                                                message: 'هل أنت متأكد من حذف هذا المشروع نهائياً؟',
                                                onConfirm: () => {
                                                    db.priceGroups.delete(pj.id); 
                                                    fetchData();
                                                    if (activeProjectId === pj.id) {
                                                        isProgrammaticChange.current = true;
                                                        setActiveProjectId(null);
                                                        setProjectName('مشروع جديد');
                                                        setBoards([
                                                            { id: 'board_a', title: 'قائمة الأصناف المختارة', items: [], isActive: true },
                                                            { id: 'board_b', title: 'لوحة إضافية فارغة', items: [], isActive: true }
                                                        ]);
                                                        setHasUnsavedChanges(false);
                                                    }
                                                    setConfirmDialog(null);
                                                }
                                            });
                                        }} className="flex-1 py-2 bg-slate-50 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"><Trash2 size={14}/> حذف</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
             </div>
          </div>
      )}

      {/* PRODUCT PICKER MODAL */}
      {showProductPicker && (
          <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-slate-100">
                <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                   <h3 className="font-black text-xl text-slate-800 flex items-center gap-3"><Boxes size={24} className="text-sap-primary"/> إضافة منتج للوحة</h3>
                   <button onClick={() => setShowProductPicker(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all"><X size={24}/></button>
                </div>
                <div className="p-6 border-b border-slate-100 bg-white">
                    <div className="relative">
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="ابحث باسم المنتج أو الكود..." className="w-full p-4 pr-12 text-base font-black bg-slate-50 border border-slate-200 rounded-2xl focus:border-sap-primary focus:bg-white focus:ring-4 focus:ring-sap-primary/10 transition-all outline-none" autoFocus />
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3 bg-slate-50/50">
                        <button onClick={() => addProductToBoard()} className="w-full p-4 border-2 border-dashed border-sap-primary/30 text-sap-primary bg-sap-highlight/30 hover:bg-sap-highlight/60 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all">
                            <Plus size={18}/> إضافة صنف يدوي
                        </button>
                        {filteredProducts.map((p) => (
                            <div key={p.id} onClick={() => addProductToBoard(p)} className="p-4 bg-white border border-slate-200 rounded-2xl hover:border-sap-primary hover:shadow-md cursor-pointer flex justify-between items-center transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="text-[10px] font-mono font-black text-sap-primary bg-sap-highlight px-3 py-1.5 rounded-lg">{p.code}</div>
                                    <div className="font-black text-base text-slate-800">{p.name}</div>
                                </div>
                                <ArrowRight size={20} className="text-slate-300 group-hover:text-sap-primary transition-colors" />
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

      {/* DOWNLOAD IMAGE DIALOG */}
      {downloadDialog?.isOpen && (
          <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="p-8 text-center space-y-4">
                      <div className="w-16 h-16 bg-sap-primary/10 text-sap-primary rounded-full flex items-center justify-center mx-auto mb-6">
                          <Download size={32} />
                      </div>
                      <h3 className="font-black text-xl text-slate-800">حفظ اللوحة كصورة</h3>
                      <p className="text-slate-500 font-bold text-sm">أدخل اسماً للصورة قبل حفظها</p>
                      <input 
                          type="text" 
                          value={downloadDialog.fileName} 
                          onChange={e => setDownloadDialog({...downloadDialog, fileName: e.target.value})}
                          className="w-full p-4 text-center font-black bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-sap-primary outline-none"
                          autoFocus
                      />
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                      <button onClick={() => setDownloadDialog(null)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-sm hover:bg-slate-50 transition-all">
                          إلغاء
                      </button>
                      <button onClick={() => {
                          executeSaveAsImage(downloadDialog.fileName, downloadDialog.targetId);
                          setDownloadDialog(null);
                      }} className="flex-1 py-3 bg-sap-primary text-white rounded-xl font-black text-sm hover:bg-sap-primary-hover transition-all shadow-md">
                          حفظ وتنزيل
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* SAVE PROJECT DIALOG */}
      {saveProjectDialog?.isOpen && (
          <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="p-8 text-center space-y-4">
                      <div className="w-16 h-16 bg-sap-primary/10 text-sap-primary rounded-full flex items-center justify-center mx-auto mb-6">
                          <Save size={32} />
                      </div>
                      <h3 className="font-black text-xl text-slate-800">حفظ المشروع</h3>
                      <p className="text-slate-500 font-bold text-sm">أدخل اسماً للمشروع الجديد</p>
                      <input 
                          type="text" 
                          value={saveProjectDialog.projectName} 
                          onChange={e => setSaveProjectDialog({...saveProjectDialog, projectName: e.target.value})}
                          className="w-full p-4 text-center font-black bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-sap-primary outline-none"
                          autoFocus
                      />
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                      <button onClick={() => setSaveProjectDialog(null)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-sm hover:bg-slate-50 transition-all">
                          إلغاء
                      </button>
                      <button onClick={() => {
                          executeSave(saveProjectDialog.projectName);
                          setSaveProjectDialog(null);
                      }} className="flex-1 py-3 bg-sap-primary text-white rounded-xl font-black text-sm hover:bg-sap-primary-hover transition-all shadow-md">
                          حفظ المشروع
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
