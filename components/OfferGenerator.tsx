
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Product, Unit, OfferTag, OfferTemplate, SavedOfferList } from '../types';
import { db } from '../services/supabase';
import { 
  Printer, Plus, Trash2, Search, ZoomIn, ZoomOut, X, Save, FolderOpen, 
  Layout, Tag as TagIcon, Settings2, Monitor, Sliders, Zap, Bomb, 
  Type as TypeIcon, ChevronDown, ChevronUp, Loader2, Scissors, 
  Paintbrush, Maximize, Smartphone, MoveHorizontal, Boxes, Palette, Clock, ArrowRight, Languages
} from 'lucide-react';

interface OfferGeneratorProps {
  products: Product[];
  units: Unit[];
}

type LabelsCount = 2 | 4 | 6 | 8 | 12 | 14 | 16 | 20 | 24;

export const OfferGenerator: React.FC<OfferGeneratorProps> = ({ products, units }) => {
  const [selectedTags, setSelectedTags] = useState<OfferTag[]>([]);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [labelsPerPage, setLabelsPerPage] = useState<LabelsCount>(12);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [listName, setListName] = useState('عرض ترويجي جديد');
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [savedLists, setSavedLists] = useState<SavedOfferList[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewZoom, setPreviewZoom] = useState(65);
  const [showUnit, setShowUnit] = useState(true);
  const [showCuttingBorders, setShowCuttingBorders] = useState(true);
  
  const [numberFormat, setNumberFormat] = useState<'ar' | 'en'>('ar');

  const formatNum = (n: string | number) => {
    if (n === undefined || n === null) return '';
    const str = n.toString();
    if (numberFormat === 'en') return str;
    return str.replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
  };

  const [globalBorderColor, setGlobalBorderColor] = useState('#000000');
  const [globalBorderWidth, setGlobalBorderWidth] = useState(1);

  const [openSections, setOpenSections] = useState({
      template: true, // NEW SECTION
      data: true,
      typography: false,
      style: false,
      colors: false
  });
  const toggleSection = (s: keyof typeof openSections) => setOpenSections(prev => ({...prev, [s]: !prev[s]}));

  const activeTag = useMemo(() => selectedTags.find(t => t.id === activeTagId), [selectedTags, activeTagId]);

  useEffect(() => {
    fetchSavedLists();
  }, []);

  const fetchSavedLists = async () => {
    setIsLoadingLists(true);
    try {
      const lists = await db.offerLists.getAll();
      setSavedLists(lists as SavedOfferList[]);
    } catch (e) { console.error(e); }
    finally { setIsLoadingLists(false); }
  };

  const handleSaveProject = async () => {
    if (!listName.trim()) { alert("يرجى تسمية المشروع"); return; }
    setIsSaving(true);
    try {
      const listData: SavedOfferList = { 
        id: activeListId || crypto.randomUUID(), 
        name: listName.trim(), 
        date: new Date().toISOString(), 
        tags: selectedTags, 
        styles: { labelsPerPage, logoUrl: null, logoSize: 50, orientation, showUnit, numberFormat } as any
      };
      await db.offerLists.upsert(listData);
      setActiveListId(listData.id);
      fetchSavedLists();
      alert("تم حفظ المشروع بنجاح");
    } catch (e) { alert("فشل الحفظ"); }
    finally { setIsSaving(false); }
  };

  const loadProject = (list: SavedOfferList) => {
    setListName(list.name);
    setSelectedTags(list.tags || []);
    setActiveListId(list.id);
    if (list.styles) {
        setLabelsPerPage(list.styles.labelsPerPage as LabelsCount || 12);
        setOrientation(list.styles.orientation || 'landscape');
        setShowUnit(list.styles.showUnit ?? true);
        if ((list.styles as any).numberFormat) {
          setNumberFormat((list.styles as any).numberFormat);
        }
    }
    setShowSavedModal(false);
    setActiveTagId(null);
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products.slice(0, 10);
    return products.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.code.toLowerCase().includes(term)
    ).slice(0, 10);
  }, [searchTerm, products]);

  const layoutConfig = useMemo(() => {
    let columns = 2;
    if (orientation === 'landscape') {
        if (labelsPerPage === 2) columns = 2;
        else if (labelsPerPage >= 6) columns = 3;
        if (labelsPerPage >= 12) columns = 4;
        if (labelsPerPage >= 20) columns = 6;
    } else {
        if (labelsPerPage >= 8) columns = 2;
        if (labelsPerPage >= 16) columns = 3;
    }
    
    const rows = Math.ceil(labelsPerPage / columns);
    const pageWidth = orientation === 'portrait' ? 210 : 297;
    const pageHeight = orientation === 'portrait' ? 297 : 210;
    const widthPerLabel = pageWidth / columns;
    const heightPerLabel = pageHeight / rows;
    
    return { columns, rows, widthPerLabel, heightPerLabel, pageWidth, pageHeight };
  }, [labelsPerPage, orientation]);

  const addTag = (product?: Product) => {
    if (selectedTags.length >= labelsPerPage) { 
      alert(`الحد الأقصى للملصقات حالياً هو (${labelsPerPage}).`); 
      return; 
    }
    let unitName = '';
    if (product && product.unitId) {
        const u = units.find(unit => unit.id === product.unitId);
        if (u) unitName = u.name;
    }

    const newTag: OfferTag = {
      id: crypto.randomUUID(),
      productId: product?.code || '',
      name: product?.name || 'صنف جديد',
      originalPrice: product?.price || '0.00',
      offerPrice: product?.price || '0.00',
      template: 'mega_sale_50',
      discountText: 'خصم 10%', // Updated default to be specific
      showLogo: true,
      hideOriginalPrice: false,
      // @ts-ignore
      unitName: unitName, 
      customColors: {
        // @ts-ignore
        nameFontSize: 40,
        // @ts-ignore
        priceFontSize: 80,
        // @ts-ignore
        decimalFontSize: 35,
        // @ts-ignore
        discountFontSize: 35,
        // @ts-ignore
        originalPriceFontSize: 30,
        background: product?.color || '#ffffff'
      }
    };
    setSelectedTags([...selectedTags, newTag]);
    setActiveTagId(newTag.id);
    setShowProductPicker(false);
    setSearchTerm('');
  };

  const updateTag = (id: string, updates: Partial<OfferTag>) => {
    setSelectedTags(prev => prev.map(tag => tag.id === id ? { ...tag, ...updates } : tag));
  };

  const OfferPreview = ({ tag, isPrint = false }: { tag: OfferTag, isPrint?: boolean }) => {
    // @ts-ignore
    const nFontSize = tag.customColors?.nameFontSize || 40;
    // @ts-ignore
    const pFontSize = tag.customColors?.priceFontSize || 80;
    // @ts-ignore
    const dFontSize = tag.customColors?.decimalFontSize || 35;
    // @ts-ignore
    const discFontSize = tag.customColors?.discountFontSize || 35;
    // @ts-ignore
    const origFontSize = tag.customColors?.originalPriceFontSize || 30;
    const bgColor = tag.customColors?.background || '#ffffff';

    const unitText = showUnit && tag.unitName ? tag.unitName : '';
    
    const displayOfferPrice = formatNum(tag.offerPrice);
    const displayOriginalPrice = formatNum(tag.originalPrice);
    const defaultDec = numberFormat === 'ar' ? '٠٠' : '00';

    const [priceMain, priceDec] = displayOfferPrice.includes('.') ? displayOfferPrice.split('.') : [displayOfferPrice, defaultDec];

    // --- DESIGN 2: MODERN CLEAN (YELLOW/INDUSTRIAL) ---
    if (tag.template === 'modern_clean') {
        return (
            <div 
                className={`w-full h-full flex flex-col relative overflow-hidden ${!isPrint && showCuttingBorders ? 'border-dashed' : ''}`} 
                dir="rtl"
                style={{ 
                    backgroundColor: bgColor,
                    border: `${globalBorderWidth}px solid ${globalBorderColor}`,
                    borderStyle: isPrint ? 'solid' : (showCuttingBorders ? 'dashed' : 'solid')
                }}
            >
                {/* Yellow Header for Discount Text */}
                <div className="bg-[#FFD700] text-black w-full py-2 flex items-center justify-center border-b-[3px] border-black relative z-10 shrink-0" style={{ minHeight: isPrint ? '18%' : '65px' }}>
                    <span className="font-black uppercase tracking-widest text-center leading-none" style={{ fontSize: isPrint ? `${discFontSize * 0.75}pt` : `${discFontSize}px` }}>
                        {formatNum(tag.discountText)}
                    </span>
                </div>

                {/* Body */}
                <div className="flex-1 flex flex-col p-4 relative z-10">
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <h2 className="font-black leading-tight text-black w-full" style={{ fontSize: isPrint ? `${nFontSize * 0.75}pt` : `${nFontSize}px` }}>
                            {tag.name}
                        </h2>
                        <div className="flex items-center gap-2 mt-2">
                            {tag.productId && <span className="bg-black text-white px-2 py-0.5 text-[8px] font-mono font-bold rounded-sm tracking-widest">{formatNum(tag.productId)}</span>}
                            {unitText && <span className="bg-gray-100 border border-black text-black px-2 py-0.5 text-[8px] font-bold rounded-sm">{unitText}</span>}
                        </div>
                    </div>
                    
                    {/* Price Section */}
                    <div className="flex items-end justify-between border-t-[3px] border-black pt-2 mt-2">
                        <div className="flex flex-col items-start pl-2">
                             <span className="text-[9px] font-black text-black bg-[#FFD700] px-1 mb-1">كان سابقاً</span>
                             {tag.originalPrice && tag.originalPrice !== '0.00' && !tag.hideOriginalPrice && (
                                <span 
                                    className="font-black line-through decoration-red-600 decoration-[3px] font-mono text-gray-400" 
                                    style={{ fontSize: isPrint ? `${origFontSize * 0.75}pt` : `${origFontSize}px` }}
                                >
                                    {displayOriginalPrice}
                                </span>
                             )}
                        </div>
                        <div className="flex items-baseline" dir="ltr">
                            <span className="font-black tracking-tighter text-black" style={{ fontSize: isPrint ? `${pFontSize * 0.85}pt` : `${pFontSize}px` }}>{priceMain}</span>
                            <div className="flex flex-col items-start ml-1 leading-none">
                                <span className="font-black text-black" style={{ fontSize: isPrint ? `${dFontSize * 0.75}pt` : `${dFontSize}px` }}>.{priceDec}</span>
                                <span className="text-[10px] font-black uppercase bg-black text-white px-1 mt-1">SAR</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Decorative corners */}
                <div className="absolute top-0 right-0 w-3 h-3 bg-black z-20"></div>
                <div className="absolute top-0 left-0 w-3 h-3 bg-black z-20"></div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-black z-20"></div>
                <div className="absolute bottom-0 left-0 w-3 h-3 bg-black z-20"></div>
            </div>
        );
    }

    // --- DESIGN 1: CLASSIC (DEFAULT) ---
    return (
        <div 
            className={`w-full h-full flex flex-col relative overflow-hidden ${!isPrint && showCuttingBorders ? 'border-dashed' : ''}`} 
            dir="rtl"
            style={{ 
                backgroundColor: bgColor,
                border: `${globalBorderWidth}px solid ${globalBorderColor}`,
                borderStyle: isPrint ? 'solid' : (showCuttingBorders ? 'dashed' : 'solid')
            }}
        >
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 0)', backgroundSize: '15px 15px' }}></div>
            
            <div className="pt-4 flex justify-center relative z-10 shrink-0">
                <div 
                    className="bg-red-600 text-white px-6 py-2 rounded-[1.5rem] shadow-xl border-[3px] border-white flex flex-col items-center justify-center leading-none transform -rotate-1"
                    style={{ minWidth: isPrint ? `${discFontSize * 2}pt` : `${discFontSize * 2.5}px` }}
                >
                    <span className="font-black uppercase italic" style={{ fontSize: isPrint ? `${discFontSize * 0.75}pt` : `${discFontSize}px` }}>
                        {formatNum(tag.discountText)}
                    </span>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-3 relative z-10 text-center">
                <h2 className="font-black leading-tight text-slate-900 w-full" style={{ fontSize: isPrint ? `${nFontSize * 0.75}pt` : `${nFontSize}px`, wordBreak: 'break-word' }}>
                    {tag.name}
                </h2>
                <div className="flex items-center gap-3 mt-2">
                   {tag.productId && <span className="text-[8px] font-black text-gray-400 font-mono bg-white/80 px-2 py-0.5 rounded-full border border-gray-100 shadow-sm">CODE: {formatNum(tag.productId)}</span>}
                   {unitText && <span className="text-[8px] font-black text-white bg-slate-900 px-2 py-0.5 rounded-full shadow-sm">{unitText}</span>}
                </div>
            </div>

            <div className="pb-4 px-4 relative z-10">
                <div className="flex items-center justify-between gap-2 bg-slate-900 text-white p-4 rounded-[2rem] shadow-2xl border-t-[5px] border-red-600">
                    
                    {tag.originalPrice && tag.originalPrice !== '0.00' && !tag.hideOriginalPrice && (
                        <div className="flex flex-col items-center pl-4 border-l border-white/10 shrink-0">
                            <span className="text-[7px] font-black text-slate-400 uppercase mb-0.5">كان</span>
                            <span 
                                className="font-black line-through decoration-red-600 decoration-[2.5px] font-mono leading-none" 
                                style={{ 
                                    fontSize: isPrint ? `${origFontSize * 0.75}pt` : `${origFontSize}px`,
                                    color: '#CCFF00' 
                                }}
                            >
                                {displayOriginalPrice}
                            </span>
                        </div>
                    )}

                    <div className="flex-1 flex items-center justify-center gap-1.5" dir="ltr">
                        <div className="flex items-baseline leading-none">
                            <span className="font-black tracking-tighter" style={{ fontSize: isPrint ? `${pFontSize * 0.75}pt` : `${pFontSize}px` }}>
                                {priceMain}
                            </span>
                        </div>

                        <div className="flex items-center h-full">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                        </div>

                        <div className="flex flex-col items-start leading-none pt-1">
                            <span className="font-black text-red-500" style={{ fontSize: isPrint ? `${dFontSize * 0.75}pt` : `${dFontSize}px` }}>
                                {priceDec}
                            </span>
                            <span className="text-[8px] font-black text-slate-400 uppercase mt-1">ريال</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const AccordionHeader = ({ title, isOpen, onClick, icon: Icon }: any) => (
      <button onClick={onClick} className="w-full flex items-center justify-between px-3 py-2 bg-[#E8F5E9] border-y border-sap-border hover:bg-[#C8E6C9] transition-colors group">
          <div className="flex items-center gap-2">
              <Icon size={16} className="text-sap-primary" />
              <span className="text-xs font-bold text-sap-text uppercase tracking-wide">{title}</span>
          </div>
          {isOpen ? <ChevronUp size={14} className="text-sap-text-variant"/> : <ChevronDown size={14} className="text-sap-text-variant"/>}
      </button>
  );

  const FullPagePrint = () => {
    const portalNode = document.getElementById('print-container');
    if (!portalNode) return null;

    return createPortal(
      <div 
        style={{ 
          width: '100%', 
          height: '100%', 
          display: 'grid', 
          gridTemplateColumns: `repeat(${layoutConfig.columns}, ${layoutConfig.widthPerLabel}mm)`,
          gridTemplateRows: `repeat(${layoutConfig.rows}, ${layoutConfig.heightPerLabel}mm)`,
          backgroundColor: 'white',
          boxSizing: 'border-box'
        }}
      >
        <style>{`
            @media print {
                @page {
                    size: A4 ${orientation};
                    margin: 0 !important;
                }
            }
        `}</style>
        {Array.from({ length: labelsPerPage }).map((_, i) => (
            <div key={i} className="overflow-hidden" style={{ width: `${layoutConfig.widthPerLabel}mm`, height: `${layoutConfig.heightPerLabel}mm` }}>
                {selectedTags[i] && <OfferPreview tag={selectedTags[i]} isPrint={true} />}
            </div>
        ))}
      </div>,
      portalNode
    );
  };

  return (
    <div className="h-full w-full flex overflow-hidden animate-in fade-in duration-500 relative bg-[#e5e7eb]">
      
      {/* 1. PORTAL FOR PRINTING */}
      <FullPagePrint />

      <aside className="w-[320px] bg-white border-l-2 border-sap-secondary flex flex-col shrink-0 print:hidden z-30 shadow-lg text-xs h-full">
        <div className="bg-sap-shell text-white px-3 py-2 font-black flex items-center gap-2 shadow-md">
            <Sliders size={16} className="text-sap-secondary"/> استوديو العروض المطور
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#F9FAFB]">
            
            <AccordionHeader title="قالب التصميم" isOpen={openSections.template} onClick={() => toggleSection('template')} icon={Layout} />
            {openSections.template && activeTag ? (
                <div className="p-3 bg-white border-b border-sap-border grid grid-cols-2 gap-2">
                    <button onClick={() => updateTag(activeTag.id, { template: 'mega_sale_50' })} className={`p-3 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${activeTag.template === 'mega_sale_50' ? 'border-sap-primary bg-sap-highlight text-sap-primary' : 'border-gray-100 hover:border-gray-300'}`}>
                        <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-[8px] shadow-sm">SALE</div>
                        <span className="text-[10px] font-black">كلاسيكي (أحمر)</span>
                    </button>
                    <button onClick={() => updateTag(activeTag.id, { template: 'modern_clean' })} className={`p-3 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${activeTag.template === 'modern_clean' ? 'border-sap-primary bg-sap-highlight text-sap-primary' : 'border-gray-100 hover:border-gray-300'}`}>
                        <div className="w-8 h-8 bg-[#FFD700] rounded-sm border border-black flex items-center justify-center text-black font-bold text-[8px] shadow-sm">NEW</div>
                        <span className="text-[10px] font-black">صناعي (أصفر)</span>
                    </button>
                </div>
            ) : openSections.template && <div className="p-4 text-center text-gray-400 italic">حدد ملصقاً لتغيير تصميمه</div>}

            <AccordionHeader title="البيانات والأسعار" isOpen={openSections.data} onClick={() => toggleSection('data')} icon={Monitor} />
            {openSections.data && activeTag ? (
                <div className="p-3 space-y-3 bg-white border-b border-sap-border">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase">اسم الصنف</label>
                        <input type="text" value={activeTag.name} onChange={e => updateTag(activeTag.id, { name: e.target.value })} className="w-full p-2 border font-bold text-xs rounded" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">السعر السابق</label>
                            <input type="text" value={activeTag.originalPrice} onChange={e => updateTag(activeTag.id, { originalPrice: e.target.value })} className="w-full p-2 border text-xs rounded" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-sap-primary uppercase tracking-tighter">سعر العرض</label>
                            <input type="text" value={activeTag.offerPrice} onChange={e => updateTag(activeTag.id, { offerPrice: e.target.value })} className="w-full p-2 border font-black text-sap-primary text-xs rounded" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-red-500 uppercase">نص شارة العرض (كامل)</label>
                        <input type="text" value={activeTag.discountText} onChange={e => updateTag(activeTag.id, { discountText: e.target.value })} className="w-full p-2 border font-bold text-xs rounded text-red-600" placeholder="مثال: خصم 50% / عرض خاص" />
                    </div>
                </div>
            ) : openSections.data && <div className="p-4 text-center text-gray-400 italic">حدد ملصقاً لتعديله</div>}

            <AccordionHeader title="أحجام العناصر" isOpen={openSections.typography} onClick={() => toggleSection('typography')} icon={TypeIcon} />
            {openSections.typography && activeTag && (
                <div className="p-3 bg-white border-b border-sap-border space-y-5">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[9px] font-black text-gray-500 uppercase">
                            <span>حجم اسم المنتج</span>
                            <span className="text-sap-primary font-mono">{(activeTag.customColors as any)?.nameFontSize}px</span>
                        </div>
                        <input type="range" min="10" max="150" value={(activeTag.customColors as any)?.nameFontSize} onChange={e => updateTag(activeTag.id, { customColors: { ...activeTag.customColors, nameFontSize: Number(e.target.value) } })} className="w-full accent-sap-primary" />
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[9px] font-black text-gray-500 uppercase">
                            <span>حجم سعر العرض</span>
                            <span className="text-sap-primary font-mono">{(activeTag.customColors as any)?.priceFontSize}px</span>
                        </div>
                        <input type="range" min="20" max="300" value={(activeTag.customColors as any)?.priceFontSize} onChange={e => updateTag(activeTag.id, { customColors: { ...activeTag.customColors, priceFontSize: Number(e.target.value) } })} className="w-full accent-sap-primary" />
                    </div>
                    
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[9px] font-black text-red-500 uppercase">
                            <span>حجم الكسر (الهللة)</span>
                            <span className="text-red-500 font-mono">{(activeTag.customColors as any)?.decimalFontSize}px</span>
                        </div>
                        <input type="range" min="10" max="150" value={(activeTag.customColors as any)?.decimalFontSize} onChange={e => updateTag(activeTag.id, { customColors: { ...activeTag.customColors, decimalFontSize: Number(e.target.value) } })} className="w-full accent-red-500" />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[9px] font-black text-emerald-600 uppercase">
                            <span>حجم السعر قبل الخصم (كان)</span>
                            <span className="text-emerald-600 font-mono">{(activeTag.customColors as any)?.originalPriceFontSize}px</span>
                        </div>
                        <input type="range" min="10" max="150" value={(activeTag.customColors as any)?.originalPriceFontSize} onChange={e => updateTag(activeTag.id, { customColors: { ...activeTag.customColors, originalPriceFontSize: Number(e.target.value) } })} className="w-full accent-emerald-500" />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[9px] font-black text-red-600 uppercase">
                            <span>حجم شارة الخصم</span>
                            <span className="text-red-600 font-mono">{(activeTag.customColors as any)?.discountFontSize}px</span>
                        </div>
                        <input type="range" min="10" max="200" value={(activeTag.customColors as any)?.discountFontSize} onChange={e => updateTag(activeTag.id, { customColors: { ...activeTag.customColors, discountFontSize: Number(e.target.value) } })} className="w-full accent-red-600" />
                    </div>
                </div>
            )}

            <AccordionHeader title="الألوان والخلفية" isOpen={openSections.colors} onClick={() => toggleSection('colors')} icon={Palette} />
            {openSections.colors && activeTag && (
                <div className="p-3 bg-white border-b border-sap-border space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-2">
                            <Paintbrush size={12}/> لون خلفية الملصق
                        </label>
                        <div className="flex items-center gap-3 p-2 bg-gray-50 rounded border">
                           <input 
                              type="color" 
                              value={activeTag.customColors?.background || '#ffffff'} 
                              onChange={e => updateTag(activeTag.id, { customColors: { ...activeTag.customColors, background: e.target.value } })} 
                              className="w-10 h-10 border-none cursor-pointer rounded" 
                           />
                           <span className="font-mono font-bold text-[10px] uppercase text-gray-400">{activeTag.customColors?.background || '#ffffff'}</span>
                        </div>
                    </div>
                </div>
            )}

            <AccordionHeader title="تنسيق الورقة والحدود" isOpen={openSections.style} onClick={() => toggleSection('style')} icon={Settings2} />
            {openSections.style && (
                <div className="p-3 bg-white border-b border-sap-border space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase">لغة الأرقام (الترقيم)</label>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => setNumberFormat('ar')} className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-md transition-all ${numberFormat === 'ar' ? 'bg-white shadow-sm text-sap-primary' : 'text-gray-400'}`}>
                                <Languages size={14}/> عربية (١٢٣)
                            </button>
                            <button onClick={() => setNumberFormat('en')} className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-md transition-all ${numberFormat === 'en' ? 'bg-white shadow-sm text-sap-primary' : 'text-gray-400'}`}>
                                <Languages size={14}/> إنجليزية (123)
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase">اتجاه الصفحة</label>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => setOrientation('portrait')} className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-md transition-all ${orientation === 'portrait' ? 'bg-white shadow-sm text-sap-primary' : 'text-gray-400'}`}>
                                <Smartphone size={14}/> طولي
                            </button>
                            <button onClick={() => setOrientation('landscape')} className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-md transition-all ${orientation === 'landscape' ? 'bg-white shadow-sm text-sap-primary' : 'text-gray-400'}`}>
                                <MoveHorizontal size={14}/> عرضي
                            </button>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase">عدد الملصقات بالصفحة</label>
                        <select value={labelsPerPage} onChange={e => setLabelsPerPage(Number(e.target.value) as LabelsCount)} className="w-full p-2 border text-xs font-bold rounded">
                            {[2,4,6,8,12,16,20,24].map(n => <option key={n} value={n}>{n} ملصق بالصفحة</option>)}
                        </select>
                    </div>

                    <div className="pt-2 border-t border-gray-100 space-y-3">
                         <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-gray-500 uppercase">لون حدود الملصق</label>
                            <input type="color" value={globalBorderColor} onChange={e => setGlobalBorderColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-none shadow-sm" />
                         </div>
                         <div className="space-y-1">
                            <div className="flex justify-between items-center text-[9px] font-black text-gray-500">
                                <span>سمك الحدود</span>
                                <span>{globalBorderWidth}px</span>
                            </div>
                            <input type="range" min="0" max="10" value={globalBorderWidth} onChange={e => setGlobalBorderWidth(Number(e.target.value))} className="w-full accent-sap-primary" />
                         </div>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-sap-border">
                        <div className="flex items-center gap-2">
                            <Scissors size={14} className="text-sap-primary"/>
                            <span className="text-[10px] font-black">حدود القص الوهمية</span>
                        </div>
                        <input type="checkbox" checked={showCuttingBorders} onChange={e => setShowCuttingBorders(e.target.checked)} className="accent-sap-primary w-4 h-4" />
                    </div>
                </div>
            )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative print:hidden">
        <div className="h-12 bg-white border-b border-sap-border flex items-center justify-between px-4 shrink-0 z-20 shadow-sm">
            <div className="flex items-center gap-3">
                <input type="text" value={listName} onChange={e => setListName(e.target.value)} className="h-8 text-xs border w-48 px-2 font-bold focus:border-sap-primary rounded-lg" />
                <button onClick={handleSaveProject} disabled={isSaving} className="p-2 hover:bg-sap-highlight rounded-lg text-sap-primary transition-all" title="حفظ المشروع"><Save size={18}/></button>
                
                <button onClick={() => { fetchSavedLists(); setShowSavedModal(true); }} className="p-2 hover:bg-sap-highlight rounded-lg text-sap-secondary transition-all" title="المشاريع المحفوظة"><FolderOpen size={18}/></button>
                
                <button onClick={() => window.print()} className="bg-sap-primary text-white px-4 py-1.5 rounded-lg text-xs font-black shadow-sm flex items-center gap-2 transition-transform active:scale-95"><Printer size={16}/> طباعة</button>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => setPreviewZoom(z => Math.max(10, z - 5))} className="p-1 hover:bg-gray-100 rounded-lg"><ZoomOut size={16}/></button>
                <span className="text-xs font-black w-10 text-center font-mono">{previewZoom}%</span>
                <button onClick={() => setPreviewZoom(z => Math.min(150, z + 5))} className="p-1 hover:bg-gray-100 rounded-lg"><ZoomIn size={16}/></button>
            </div>
        </div>

        <div className="flex-1 overflow-auto p-12 bg-[#808080] flex justify-center items-start custom-scrollbar">
            <div 
              className="bg-white shadow-[0_30px_100px_rgba(0,0,0,0.5)] origin-top transition-all duration-500"
              style={{
                width: `${layoutConfig.pageWidth}mm`, 
                height: `${layoutConfig.pageHeight}mm`,
                transform: `scale(${previewZoom / 100})`, 
                display: 'grid', 
                gridTemplateColumns: `repeat(${layoutConfig.columns}, ${layoutConfig.widthPerLabel}mm)`,
                gridTemplateRows: `repeat(${layoutConfig.rows}, ${layoutConfig.heightPerLabel}mm)`,
              } as any}
            >
                {Array.from({ length: labelsPerPage }).map((_, i) => {
                    const tag = selectedTags[i];
                    const isActive = tag && activeTagId === tag.id;
                    return (
                        <div 
                          key={i} 
                          onClick={() => tag ? setActiveTagId(tag.id) : null}
                          className={`relative group ${tag ? 'cursor-pointer' : 'bg-gray-50/50'} ${isActive ? 'outline outline-[6px] outline-sap-primary z-10 shadow-2xl scale-[1.01]' : ''}`}
                        >
                            {tag ? <OfferPreview tag={tag} /> : (
                                <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ border: `1px dashed #ccc` }}>
                                    <button onClick={() => setShowProductPicker(true)} className="p-2 bg-white border-2 border-sap-primary text-sap-primary text-[10px] font-black rounded-lg shadow-lg hover:bg-sap-primary hover:text-white transition-all">+ إضافة</button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
      </main>

      {showSavedModal && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in">
          <div className="bg-white w-full max-w-xl border-4 border-sap-shell overflow-hidden flex flex-col shadow-2xl rounded-sap-m">
            <div className="p-6 bg-sap-shell text-white flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-[5px] flex items-center gap-2"><FolderOpen size={18}/> أرشيف العروض السحابية</h3>
              <button onClick={() => setShowSavedModal(false)}><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[500px] divide-y divide-gray-100 bg-white">
              {savedLists.map(list => (
                <div key={list.id} className="p-6 hover:bg-gray-50 flex justify-between items-center group cursor-pointer transition-all" onClick={() => loadProject(list)}>
                  <div>
                    <div className="text-sm font-black uppercase group-hover:text-sap-primary">{list.name}</div>
                    <div className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-widest flex items-center gap-2"><Clock size={12}/> {new Date(list.date).toLocaleDateString('ar-SA')} • {list.tags?.length || 0} ملصق</div>
                  </div>
                  <ArrowRight size={20} className="text-gray-200 group-hover:text-sap-primary transition-all" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showProductPicker && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
             <div className="bg-white w-full max-w-2xl shadow-2xl rounded-sap-m overflow-hidden">
                <div className="px-6 py-4 bg-sap-shell text-white flex justify-between items-center font-black">
                   <span className="flex items-center gap-2"><Boxes size={20} className="text-sap-secondary"/> قاعدة بيانات المنتجات</span>
                   <button onClick={() => setShowProductPicker(false)} className="hover:bg-white/10 p-1 rounded-full"><X size={20}/></button>
                </div>
                <div className="p-6 bg-gray-50 border-b">
                    <div className="relative">
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="بحث ذكي بالأسم أو الكود..." className="w-full !p-4 !pr-12 !text-sm !font-black !bg-white border-2 border-gray-200 rounded-xl focus:border-sap-primary" autoFocus />
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300" size={20}/>
                    </div>
                </div>
                <div className="max-h-[400px] overflow-y-auto bg-white custom-scrollbar">
                    <button onClick={() => addTag()} className="w-full text-right p-5 border-b-4 border-dashed border-gray-100 text-sm font-black text-sap-primary hover:bg-sap-highlight transition-all">إضافة صنف مخصص جديد +</button>
                    {filteredProducts.map((p) => (
                        <div key={p.id} onClick={() => addTag(p)} className="p-5 border-b hover:bg-sap-highlight cursor-pointer flex justify-between items-center transition-all group">
                            <div className="flex items-center gap-4">
                                {p.color && p.color !== '#ffffff' && <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: p.color }}></div>}
                                <div>
                                    <div className="text-sm font-black text-gray-800 group-hover:text-sap-primary">{p.name}</div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Barcode: {p.code}</div>
                                </div>
                            </div>
                            <span className="px-3 py-1 bg-gray-100 text-gray-400 text-[10px] font-black rounded-full uppercase">{(units.find(u => u.id === p.unitId))?.name}</span>
                        </div>
                    ))}
                </div>
             </div>
          </div>
      )}
    </div>
  );
};
