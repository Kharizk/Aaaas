
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { PriceGroup, PriceGroupBoard, PriceGroupItem, Product, Unit, PriceGroupStyles, PriceGroupTheme } from '../types';
import { db } from '../services/supabase';
import { 
  Plus, Trash2, Save, Printer, FolderOpen, Loader2, 
  X, ZoomIn, ZoomOut, Search, Copy, 
  LayoutGrid, Star, FilePlus, Layers, 
  Smartphone, Monitor, Layout, Zap, Flame, Crown, Boxes, Type, 
  Paintbrush, Palette, Check, ArrowRight, Eye, Grid, Shapes, Diamond,
  Trophy, Activity, AlignRight, Bold, Maximize2, Move, ChevronLeft, ChevronRight,
  ArrowLeftRight, RefreshCw, Trash, Sparkles, Moon, Sun, Ghost, Wand2
} from 'lucide-react';

export const PriceGroupManager: React.FC = () => {
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
  const [previewZoom, setPreviewZoom] = useState(45);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'content' | 'styling' | 'projects'>('content');
  const [boardsPerPage, setBoardsPerPage] = useState<1 | 2>(2);

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
    showGeometricPattern: true
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
      alert("تم حفظ المشروع بنجاح");
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
      { id: 'geometric_luxe', name: 'النمط الهندسي', icon: Shapes },
      { id: 'modern_grid', name: 'الشبكة العصرية', icon: Grid },
      { id: 'royal_minimal', name: 'ملكي فاخر', icon: Crown },
      { id: 'digital_punch', name: 'رقمي جريء', icon: Zap },
      { id: 'abstract_gradient', name: 'تدرج تجريدي', icon: Sparkles }
  ];

  const GeometricPattern = ({ color }: { color: string }) => (
    <svg className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="geo-pattern" width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M0 80L80 0M-20 20L20 -20M60 100L100 60" stroke={color} strokeWidth="1.5" fill="none" />
          <circle cx="40" cy="40" r="3" fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#geo-pattern)" />
    </svg>
  );

  const BoardRenderer = ({ board, s, isSmall = false, isPrinting = false }: { board: PriceGroupBoard, s: PriceGroupStyles, isSmall?: boolean, isPrinting?: boolean }) => {
    const scale = isSmall ? 0.75 : 1;
    const themeStyles: Record<PriceGroupTheme, any> = {
        geometric_luxe: { container: "border-solid", header: "flex-row border-b-4", itemContainer: "items-center", pattern: true },
        modern_grid: { container: "border-double", header: "flex-col items-center text-center border-b-8", itemContainer: "items-end bg-black/5 rounded-2xl p-2", pattern: false },
        royal_minimal: { container: "border-solid rounded-[3rem]", header: "flex-row-reverse border-b-2 italic", itemContainer: "items-baseline", pattern: false },
        digital_punch: { container: "border-solid", header: "flex-row bg-black text-white p-6 mb-10", itemContainer: "items-center border-r-8", pattern: false },
        abstract_gradient: { container: "border-none shadow-2xl rounded-[4rem]", header: "flex-col items-start border-none", itemContainer: "items-center backdrop-blur-md bg-white/30 rounded-[2rem] p-4", pattern: false }
    };
    const currentTheme = themeStyles[themeId] || themeStyles.geometric_luxe;

    return (
      <div 
        className={`w-full h-full flex flex-col relative text-right overflow-hidden ${currentTheme.container}`}
        style={{ 
          backgroundColor: s.backgroundColor, 
          padding: `${isSmall ? s.padding * 0.8 : s.padding}px`,
          border: `${isSmall ? s.borderWidth * 0.8 : s.borderWidth}px solid ${s.borderColor || s.primaryColor}`,
          background: themeId === 'abstract_gradient' ? `linear-gradient(135deg, ${s.backgroundColor}, ${s.primaryColor}20)` : s.backgroundColor,
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        } as any}
      >
        {s.showGeometricPattern && currentTheme.pattern && <GeometricPattern color={s.primaryColor} />}
        
        <div className={`flex justify-between items-center mb-8 pb-4 ${currentTheme.header}`} style={{ borderColor: s.secondaryColor }}>
          {showLogo && logoUrl ? (
            <img src={logoUrl} className={`${isSmall ? 'h-12' : 'h-20'} object-contain`} />
          ) : (
            <div className="w-14 h-14 text-white flex items-center justify-center font-black rounded-2xl text-2xl rotate-3 shadow-lg" style={{ backgroundColor: s.primaryColor }}>SF</div>
          )}
          <div className={`flex-1 text-right ${themeId === 'digital_punch' ? 'mr-0' : 'mr-6'}`}>
              <h1 className="font-black leading-none" style={{ fontSize: `${isSmall ? s.titleFontSize * 0.85 : s.titleFontSize}px`, color: themeId === 'digital_punch' ? 'white' : s.textColor, fontWeight: s.titleWeight }}>{board.title}</h1>
              <div className="h-1 mt-2 rounded-full w-24" style={{ backgroundColor: s.secondaryColor }}></div>
          </div>
        </div>

        <div className="flex-1 space-y-5">
            {board.items.map((item, idx) => (
                <div key={item.id} className={`flex transition-all ${currentTheme.itemContainer} ${item.isOffer ? 'animate-pulse' : ''}`}>
                    <div 
                        className={`w-10 h-10 flex items-center justify-center font-black text-white shrink-0 shadow-md`} 
                        style={{ 
                            backgroundColor: item.isOffer ? '#ef4444' : s.primaryColor,
                            clipPath: themeId === 'geometric_luxe' ? 'polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)' : 'none'
                        }}
                    >
                        {idx + 1}
                    </div>
                    <div className="flex-1 flex justify-between items-end border-b-2 pb-2 mr-4" style={{ borderColor: `${s.primaryColor}20` }}>
                        <div className="font-black" style={{ fontSize: `${s.itemFontSize * scale}px`, color: s.textColor, WebkitPrintColorAdjust: 'exact' }}>{item.label}</div>
                        <div className="flex items-baseline gap-1 bg-gray-50/50 px-4 py-1 rounded-lg">
                            <span className="font-black font-mono" style={{ fontSize: `${s.priceFontSize * scale}px`, color: item.isOffer ? '#ef4444' : s.priceColor, WebkitPrintColorAdjust: 'exact' }}>{item.price}</span>
                            <span className="font-bold opacity-30 text-[10px]" style={{ color: s.textColor }}>SR</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>

        <div className="mt-6 pt-4 border-t-2 border-gray-100 flex justify-between items-center opacity-40">
            <span className="text-[10px] font-black uppercase tracking-[3px]" style={{ color: s.textColor }}>Official Inventory Display</span>
            <div className="flex gap-2">
                {[1,2,3,4].map(i => <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: s.secondaryColor, opacity: i * 0.2 }}></div>)}
            </div>
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
        <style>{`@media print { @page { size: A4 landscape; margin: 0 !important; } }`}</style>
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
                           <div className="flex gap-2">
                               <button onClick={() => setActiveBoardIdx(0)} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeBoardIdx === 0 ? 'bg-sap-primary text-white' : 'bg-white/10 text-white/40'}`}>أ</button>
                               <button onClick={() => setActiveBoardIdx(1)} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeBoardIdx === 1 ? 'bg-sap-primary text-white' : 'bg-white/10 text-white/40'}`}>ب</button>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                             <button onClick={duplicateBoard} className="py-3 bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black text-white flex items-center justify-center gap-2 hover:bg-white/20 transition-all">
                                 <Copy size={16}/> نسخ أ إلى ب
                             </button>
                             <button onClick={() => setBoards(prev => prev.map((b, i) => i === activeBoardIdx ? { ...b, items: [] } : b))} className="py-3 bg-red-500/20 text-red-400 rounded-2xl text-[10px] font-black flex items-center justify-center gap-2">
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
                            {boards[activeBoardIdx].items.map((item, idx) => (
                                <div key={item.id} className={`p-5 rounded-[2rem] border-2 transition-all ${item.isOffer ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}>
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="bg-slate-100 text-slate-400 text-[9px] font-black px-3 py-1 rounded-full">#{idx+1}</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => {
                                                const n = [...boards];
                                                n[activeBoardIdx].items[idx].isOffer = !n[activeBoardIdx].items[idx].isOffer;
                                                setBoards(n);
                                            }} className={`p-2 rounded-xl ${item.isOffer ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-300'}`}><Zap size={14}/></button>
                                            <button onClick={() => {
                                                const n = [...boards];
                                                n[activeBoardIdx].items = n[activeBoardIdx].items.filter(i => i.id !== item.id);
                                                setBoards(n);
                                            }} className="p-2 text-slate-200 hover:text-red-500"><Trash size={14}/></button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-12 gap-4">
                                        <input type="text" value={item.label} onChange={e => {
                                            const n = [...boards];
                                            n[activeBoardIdx].items[idx].label = e.target.value;
                                            setBoards(n);
                                        }} className="col-span-8 p-3 text-sm font-black bg-slate-50 border border-slate-100 rounded-xl" />
                                        <input type="text" value={item.price} onChange={e => {
                                            const n = [...boards];
                                            n[activeBoardIdx].items[idx].price = e.target.value;
                                            setBoards(n);
                                        }} className="col-span-4 p-3 text-sm font-black text-left text-sap-primary bg-sap-highlight border border-sap-primary/10 rounded-xl" />
                                    </div>
                                </div>
                            ))}
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
                                    className={`p-4 rounded-[1.5rem] border-2 flex flex-col items-center gap-2 transition-all ${themeId === t.id ? 'bg-sap-primary text-white border-sap-primary shadow-lg scale-105' : 'bg-white text-slate-400 border-slate-100'}`}
                                >
                                    <t.icon size={20}/>
                                    <span className="text-[10px] font-black">{t.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6 pt-6 border-t border-slate-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">باليتة الألوان المخصصة</label>
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { label: 'خلفية اللوحة', key: 'backgroundColor' },
                                { label: 'لون الإطار', key: 'borderColor' },
                                { label: 'لون العناوين', key: 'textColor' },
                                { label: 'اللون الأساسي', key: 'primaryColor' },
                                { label: 'لون الأسعار', key: 'priceColor' },
                                { label: 'لون العناصر', key: 'secondaryColor' }
                            ].map(color => (
                                <div key={color.key} className="space-y-2 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                    <span className="text-[9px] font-black text-slate-400">{color.label}</span>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="color" 
                                            value={(styles as any)[color.key]} 
                                            onChange={e => setStyles({...styles, [color.key]: e.target.value})} 
                                            className="w-10 h-8 rounded border-none cursor-pointer p-0" 
                                        />
                                        <span className="text-[8px] font-mono font-bold uppercase">{(styles as any)[color.key]}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-8 pt-6 border-t">
                        <h4 className="text-xs font-black text-sap-primary flex items-center gap-2">أحجام الخطوط</h4>
                        {[
                            { label: 'حجم العنوان', key: 'titleFontSize', min: 20, max: 120 },
                            { label: 'حجم المنتج', key: 'itemFontSize', min: 10, max: 60 },
                            { label: 'حجم السعر', key: 'priceFontSize', min: 20, max: 150 }
                        ].map(font => (
                            <div key={font.key} className="space-y-3">
                                <div className="flex justify-between items-center text-[10px] font-black text-slate-400">
                                    <span>{font.label}</span>
                                    <span className="text-sap-primary">{(styles as any)[font.key]}px</span>
                                </div>
                                <input type="range" min={font.min} max={font.max} value={(styles as any)[font.key]} onChange={e => setStyles({...styles, [font.key]: Number(e.target.value)})} className="w-full accent-sap-primary" />
                            </div>
                        ))}
                    </div>

                    <div className="space-y-4 pt-6 border-t">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">تخطيط الورقة (A4)</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setBoardsPerPage(1)} className={`p-6 rounded-[2rem] border-4 flex flex-col items-center gap-3 transition-all ${boardsPerPage === 1 ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400'}`}>
                                <Monitor size={28}/> <span className="text-[12px] font-black">لوحة واحدة</span>
                            </button>
                            <button onClick={() => setBoardsPerPage(2)} className={`p-6 rounded-[2rem] border-4 flex flex-col items-center gap-3 transition-all ${boardsPerPage === 2 ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400'}`}>
                                <LayoutGrid size={28}/> <span className="text-[12px] font-black">لوحة مزدوجة</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'projects' && (
                <div className="space-y-4">
                    <button onClick={createNew} className="w-full p-12 border-4 border-dashed border-slate-100 text-slate-300 hover:border-sap-primary hover:text-sap-primary rounded-[3rem] font-black text-sm flex flex-col items-center gap-4 transition-all">
                        <FilePlus size={40}/> إنشاء مشروع جديد
                    </button>
                    {projects.map(pj => (
                        <div key={pj.id} className="p-6 bg-white border border-slate-100 rounded-[2rem] hover:border-sap-primary hover:shadow-xl cursor-pointer flex justify-between items-center group transition-all" onClick={() => loadProject(pj)}>
                             <div className="text-right">
                                 <div className="font-black text-slate-800 text-lg">{pj.name}</div>
                                 <div className="text-[10px] text-gray-400 font-bold mt-1">{new Date(pj.date).toLocaleDateString('ar-SA')}</div>
                             </div>
                             <button onClick={(e) => { e.stopPropagation(); db.priceGroups.delete(pj.id); fetchData(); }} className="p-3 text-red-300 hover:text-red-500"><Trash2 size={20}/></button>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <div className="p-8 border-t border-slate-100 bg-white shrink-0">
             <button onClick={handleSave} disabled={isSaving} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-base flex items-center justify-center gap-4 shadow-2xl">
                {isSaving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />} 
                <span>حفظ المشروع سحابياً</span>
            </button>
        </div>
      </aside>

      {/* PRODUCT PICKER MODAL */}
      {showProductPicker && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in">
              <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-8 bg-sap-shell text-white flex justify-between items-center">
                   <h3 className="font-black text-2xl flex items-center gap-4"><Boxes size={32} className="text-sap-secondary"/> قاعدة البيانات</h3>
                   <button onClick={() => setShowProductPicker(false)} className="p-3 hover:bg-white/10 rounded-full"><X size={28}/></button>
                </div>
                <div className="p-8 border-b">
                    <div className="relative">
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="بحث ذكي بالأصناف..." className="w-full p-6 pr-14 text-xl font-black bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:border-sap-primary" autoFocus />
                        <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300" size={32} />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-4">
                        <button onClick={() => addProductToBoard()} className="w-full p-8 border-4 border-dashed border-slate-100 text-sap-primary hover:bg-sap-highlight/20 rounded-[2.5rem] font-black text-lg flex items-center justify-center gap-4">
                            <Plus size={28}/> إضافة صنف يدوي
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
    </div>
  );
};
