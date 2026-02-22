
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Product, Unit, SavedTagList, SelectedTag, TagStyles, TagStyleOverrides, TagTemplate } from '../types';
import { db } from '../services/supabase';
import { 
  Printer, Plus, Trash2, Search, RefreshCw, 
  ZoomIn, ZoomOut, Image as ImageIcon, X, Save, FolderOpen, Loader2,
  Monitor, Paintbrush, AlignCenter, AlignRight, AlignLeft,
  MousePointer2, AppWindow, Type as TypeIcon, Hash, Receipt, LayoutGrid, Clock, FilePlus, SlidersHorizontal, Palette, Frame, Layers, ChevronDown, ChevronUp, Settings, Eye,
  ScanLine, Tag as TagIcon, Zap, CheckCircle2, LayoutTemplate, Columns, Rows, Barcode as BarcodeIcon
} from 'lucide-react';

interface PriceTagGeneratorProps {
  products: Product[];
  units: Unit[];
}

export const PriceTagGenerator: React.FC<PriceTagGeneratorProps> = ({ products, units }) => {
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>([]);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [listName, setListName] = useState('مشروع ملصقات جديد');
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [savedLists, setSavedLists] = useState<SavedTagList[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showSavedLists, setShowSavedLists] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [pickerSelectedIndex, setPickerSelectedIndex] = useState(0);

  // Accordion State
  const [openSections, setOpenSections] = useState({
      templates: true,
      pageSetup: true,
      itemProps: true,
      typography: false,
      visibility: false,
      actions: true
  });

  const toggleSection = (section: keyof typeof openSections) => {
      setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const logoInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLTextAreaElement>(null);
  
  // DEFAULT STYLES: 16 Labels per page (105mm x 37mm) with 0 margins
  const [globalStyles, setGlobalStyles] = useState<TagStyles>({
    nameFontSize: 14,
    priceFontSize: 28,
    nameColor: '#000000',
    priceColor: '#DC2626', 
    unitColor: '#6B7280',
    currencyColor: '#000000',
    originalPriceColor: '#EF4444',
    previewZoom: 100, 
    showLogo: true,
    logoUrl: null,
    logoSize: 30, // Adjusted slightly for smaller height
    topMargin: 0, // mm
    bottomMargin: 0, // mm
    leftMargin: 0, // mm
    rightMargin: 0, // mm
    tagHeight: 37, // mm (Fits 8 rows exactly on A4 approx 297mm)
    showBorder: true,
    showUnit: true,
    showOriginalPrice: false,
    template: 'classic_vertical',
    backgroundColor: '#ffffff'
  });

  const templatesList = [
    { id: 'classic_vertical', name: 'كلاسيك عمودي', icon: Rows, desc: 'الاسم أعلى والسعر أسفل' },
    { id: 'side_horizontal', name: 'أفقي (السوبرماركت)', icon: Columns, desc: 'السعر يسار والاسم يمين' },
    { id: 'industrial_grid', name: 'صناعي (مُخطط)', icon: LayoutGrid, desc: 'حدود قوية وتصميم صلب' },
    { id: 'big_impact', name: 'السعر الكبير', icon: Zap, desc: 'التركيز الكامل على السعر' },
    { id: 'discount_red', name: 'تخفيضات', icon: TagIcon, desc: 'إطار أحمر للسعر السابق' },
    { id: 'yellow_shelf_label', name: 'ملصق الرف (أصفر)', icon: LayoutTemplate, desc: 'تصميم الرف القياسي' },
  ];

  useEffect(() => { fetchSavedLists(); }, []);
  useEffect(() => { if (activeTagId && nameInputRef.current) nameInputRef.current.focus(); }, [activeTagId]);
  useEffect(() => { setPickerSelectedIndex(0); }, [searchTerm]);

  const fetchSavedLists = async () => {
    setIsLoadingLists(true);
    try {
      const lists = await db.tagLists.getAll();
      setSavedLists(lists as any);
    } catch (e) { console.error(e); }
    finally { setIsLoadingLists(false); }
  };

  const handleSaveProject = async () => {
    if (!listName.trim()) { alert("الرجاء إدخل اسم المشروع"); return; }
    if (selectedTags.length === 0) { alert("المشروع فارغ"); return; }
    setIsSaving(true);
    try {
      const listData = { 
        id: activeListId || crypto.randomUUID(), 
        name: listName.trim(), 
        date: new Date().toISOString(), 
        tags: selectedTags, 
        styles: { ...globalStyles }
      };
      await db.tagLists.upsert(listData);
      setActiveListId(listData.id);
      fetchSavedLists();
      alert("تم الحفظ بنجاح");
    } catch (e) { alert("خطأ في الحفظ"); }
    finally { setIsSaving(false); }
  };

  const loadProject = (list: SavedTagList) => {
    setListName(list.name);
    setSelectedTags(list.tags);
    setActiveListId(list.id);
    if (list.styles) {
      setGlobalStyles(prev => ({ ...prev, ...list.styles, previewZoom: prev.previewZoom }));
    }
    setShowSavedLists(false);
    setActiveTagId(null);
    setHasStarted(true);
  };

  const deleteProject = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await db.tagLists.delete(id);
      if (activeListId === id) { setActiveListId(null); setListName('مشروع جديد'); setSelectedTags([]); }
      fetchSavedLists();
    } catch (e) { alert("فشل الحذف"); }
  };

  const addTag = (product?: Product) => {
    if (selectedTags.length >= 16) { alert("الصفحة ممتلئة (16 ملصق كحد أقصى)"); return; }
    let unitName = '';
    if (product && product.unitId) {
        const u = units.find(unit => unit.id === product.unitId);
        if (u) unitName = u.name;
    }
    const newTag: SelectedTag = {
      id: crypto.randomUUID(),
      productId: product?.id || '',
      name: product?.name || 'صنف جديد',
      price: '0.00',
      originalPrice: '',
      unitName: unitName
    };
    setSelectedTags([...selectedTags, newTag]);
    setActiveTagId(newTag.id);
    setShowProductPicker(false);
    setHasStarted(true);
  };

  const updateTag = (id: string, updates: Partial<SelectedTag>) => {
    setSelectedTags(prev => prev.map(tag => tag.id === id ? { ...tag, ...updates } : tag));
  };

  const handleStyleChange = (key: keyof TagStyleOverrides | keyof TagStyles, value: any) => {
      if (activeTagId) {
          setSelectedTags(prev => prev.map(tag => {
              if (tag.id === activeTagId) {
                  return { ...tag, styles: { ...(tag.styles || {}), [key]: value } };
              }
              return tag;
          }));
      } else {
          setGlobalStyles(prev => ({ ...prev, [key]: value }));
      }
  };

  const activeTag = useMemo(() => selectedTags.find(t => t.id === activeTagId), [selectedTags, activeTagId]);

  const getEffectiveStyle = (tag?: SelectedTag) => {
    if (!tag) return { ...globalStyles, textAlign: 'center', nameWeight: '700', priceWeight: '700' };
    return {
      nameFontSize: tag.styles?.nameFontSize ?? globalStyles.nameFontSize,
      priceFontSize: tag.styles?.priceFontSize ?? globalStyles.priceFontSize,
      nameColor: tag.styles?.nameColor ?? globalStyles.nameColor,
      priceColor: tag.styles?.priceColor ?? globalStyles.priceColor,
      unitColor: tag.styles?.unitColor ?? globalStyles.unitColor,
      currencyColor: tag.styles?.currencyColor ?? globalStyles.currencyColor,
      originalPriceColor: tag.styles?.originalPriceColor ?? globalStyles.originalPriceColor,
      textAlign: tag.styles?.textAlign ?? 'center',
      nameWeight: tag.styles?.nameWeight ?? '700',
      priceWeight: tag.styles?.priceWeight ?? '700',
      showLogo: tag.styles?.showLogo ?? globalStyles.showLogo,
      showBorder: tag.styles?.showBorder ?? globalStyles.showBorder,
      showUnit: tag.styles?.showUnit ?? globalStyles.showUnit,
      showOriginalPrice: tag.styles?.showOriginalPrice ?? globalStyles.showOriginalPrice,
      template: tag.styles?.template ?? globalStyles.template,
      backgroundColor: tag.styles?.backgroundColor ?? globalStyles.backgroundColor
    };
  };

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return products.slice(0, 10);
    return products.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)).slice(0, 10);
  }, [searchTerm, products]);

  const handlePickerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPickerSelectedIndex(prev => (prev < filteredProducts.length ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPickerSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (pickerSelectedIndex === 0) { addTag(); } else { const product = filteredProducts[pickerSelectedIndex - 1]; if (product) addTag(product); }
    } else if (e.key === 'Escape') { setShowProductPicker(false); }
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

  const PropertyRow = ({ label, children }: { label: string, children?: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-2 mb-2 last:mb-0">
      <span className="text-[10px] font-bold text-sap-text-variant w-24 truncate text-right">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );

  const renderTagLayout = (tag: SelectedTag | undefined, s: any) => {
      if (!tag) {
          return (
            <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <button onClick={() => setShowProductPicker(true)} className="text-sap-primary text-xs font-bold bg-white border border-sap-primary px-3 py-1.5 shadow-sm rounded-sap-s flex items-center gap-1">
                    <Plus size={14}/> إضافة
                </button>
            </div>
          );
      }

      if (s.template === 'classic_vertical') {
          return (
            <div className="flex flex-col h-full justify-between p-2">
                {s.showLogo && globalStyles.logoUrl && (
                    <div className="flex justify-center mb-1">
                        <img src={globalStyles.logoUrl} alt="Logo" style={{ height: `${globalStyles.logoSize}px` }} className="object-contain" />
                    </div>
                )}
                <div 
                    className="flex-1 flex items-center break-words leading-tight"
                    style={{ fontSize: `${s.nameFontSize}pt`, color: s.nameColor, fontWeight: s.nameWeight, justifyContent: s.textAlign === 'center' ? 'center' : s.textAlign === 'right' ? 'flex-end' : 'flex-start', textAlign: s.textAlign }}
                >
                    {tag.name}
                </div>
                <div 
                    className="pt-1 mt-1 flex flex-col items-center gap-0.5 border-t border-gray-100"
                    style={{ justifyContent: s.textAlign === 'center' ? 'center' : s.textAlign === 'right' ? 'flex-end' : 'flex-start' }}
                >
                    <div className="flex items-baseline gap-1">
                        {s.showOriginalPrice && tag.originalPrice && <span style={{ fontSize: '9pt', color: s.originalPriceColor, textDecoration: 'line-through' }} className="font-bold">{tag.originalPrice}</span>}
                        <span style={{ fontSize: `${s.priceFontSize}pt`, color: s.priceColor, fontWeight: s.priceWeight, fontFamily: 'monospace' }}>{tag.price}</span>
                        <span style={{ fontSize: '10pt', color: s.currencyColor, fontWeight: 'bold' }}>SAR</span>
                        {s.showUnit && tag.unitName && <span style={{ color: s.unitColor }} className="text-[10px] font-bold self-center ml-2 border px-1 rounded bg-gray-50">{tag.unitName}</span>}
                    </div>
                    <span className="text-[7px] text-gray-400 font-bold">السعر شامل الضريبة</span>
                </div>
            </div>
          );
      }

      if (s.template === 'side_horizontal') {
          const [intPart, decPart] = tag.price.split('.');
          return (
            <div className="flex flex-row h-full w-full relative overflow-hidden font-sans">
                {/* Left Side (Price Focus Section) */}
                <div className="w-[38%] bg-[#f8f9fa] flex flex-col items-center justify-center border-l-2 border-gray-200 p-2 relative">
                    <div className="absolute top-1 left-2 flex flex-col items-start gap-0.5 opacity-20">
                       <BarcodeIcon size={12} />
                       <div className="w-8 h-1 bg-black rounded-full"></div>
                    </div>
                    
                    {s.showOriginalPrice && tag.originalPrice && (
                      <div className="absolute top-2 flex flex-col items-center">
                        <span className="text-[7px] font-bold uppercase opacity-40 leading-none">Original</span>
                        <span style={{ fontSize: '8pt', color: s.originalPriceColor, textDecoration: 'line-through' }} className="font-black">{tag.originalPrice}</span>
                      </div>
                    )}
                    
                    <div className="flex items-start mt-2">
                        <span style={{ fontSize: `${s.priceFontSize * 1.4}pt`, color: s.priceColor, fontWeight: '900', fontFamily: 'monospace', letterSpacing: '-2px' }} className="leading-none">
                          {intPart}
                        </span>
                        <div className="flex flex-col ml-1 border-r border-gray-300 pr-1 mr-1">
                            <span className="text-[12pt] font-black leading-none" style={{color: s.priceColor}}>
                              .{decPart || '00'}
                            </span>
                            <span className="text-[8pt] font-black tracking-tighter mt-1" style={{color: s.currencyColor}}>
                              SAR
                            </span>
                        </div>
                    </div>
                    <span className="text-[6px] text-gray-400 font-bold mt-1 text-center w-full">شامل الضريبة</span>
                </div>

                {/* Right Side (Information Section) */}
                <div className="w-[62%] flex flex-col justify-between p-3 bg-white">
                    <div className="flex justify-between items-start">
                        {s.showLogo && globalStyles.logoUrl ? (
                            <img src={globalStyles.logoUrl} alt="Logo" style={{ height: `${globalStyles.logoSize * 0.7}px` }} className="object-contain" />
                        ) : (
                           <div className="text-[8px] font-black opacity-10 tracking-[3px] uppercase">PREMIUM QUALITY</div>
                        )}
                    </div>

                    <div 
                        className="flex-1 flex items-center justify-end text-right break-words leading-tight my-1"
                        style={{ fontSize: `${s.nameFontSize}pt`, color: s.nameColor, fontWeight: s.nameWeight }}
                    >
                        {tag.name}
                    </div>

                    <div className="flex justify-between items-end border-t border-gray-100 pt-2">
                        <div className="flex flex-col gap-0.5">
                            <div className="flex gap-[1px] items-end h-3 opacity-30">
                                {[2,4,1,3,2,1,4,2,3,1,2,4,1,3].map((h, i) => (
                                    <div key={i} className="bg-black" style={{ width: h%2 === 0 ? '1px' : '2px', height: `${h * 20}%` }}></div>
                                ))}
                            </div>
                            <span className="text-[6px] font-mono opacity-40">ITEM: {tag.productId.slice(0,8).toUpperCase() || 'REF-001'}</span>
                        </div>
                        
                        {s.showUnit && tag.unitName && (
                            <div className="flex flex-col items-end">
                                <span className="text-[6px] font-bold text-gray-400 uppercase">Unit Measure</span>
                                <span style={{ color: s.unitColor }} className="text-[10px] font-black px-2 py-0.5 bg-gray-50 border border-gray-100 rounded-sm">
                                  {tag.unitName}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="absolute bottom-0 right-0 w-16 h-1 bg-sap-primary/20"></div>
            </div>
          );
      }

      if (s.template === 'industrial_grid') {
          return (
            <div className="flex flex-col h-full border-4 border-black">
                <div className="bg-black text-white px-2 py-1 flex justify-between items-center h-8 shrink-0">
                    <span className="text-[8px] font-mono tracking-widest">ITEM CODE</span>
                    {s.showUnit && tag.unitName && <span className="text-[10px] font-bold bg-white text-black px-1 rounded-sm">{tag.unitName}</span>}
                </div>
                <div className="flex-1 flex items-center justify-center p-2 text-center bg-gray-100">
                    <div style={{ fontSize: `${s.nameFontSize}pt`, color: '#000', fontWeight: '900', textTransform: 'uppercase' }} className="leading-tight">
                        {tag.name}
                    </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2 border-t-4 border-black bg-white">
                    {s.showOriginalPrice && tag.originalPrice && (
                        <div className="flex flex-col">
                            <span className="text-[7px] font-bold text-gray-500">WAS</span>
                            <span className="text-xs font-bold line-through text-gray-400">{tag.originalPrice}</span>
                        </div>
                    )}
                    <div className="flex items-baseline gap-1 ml-auto">
                        <div className="flex flex-col items-end">
                            <div className="flex items-baseline gap-1">
                                <span style={{ fontSize: `${s.priceFontSize}pt`, color: s.priceColor, fontWeight: '900', fontFamily: 'monospace' }}>{tag.price}</span>
                                <span className="text-[10px] font-bold">SR</span>
                            </div>
                            <span className="text-[7px] text-gray-400 font-bold">السعر شامل الضريبة</span>
                        </div>
                    </div>
                </div>
            </div>
          );
      }

      if (s.template === 'big_impact') {
          return (
            <div className="flex flex-col h-full">
                <div className="h-[65%] bg-sap-primary flex items-center justify-center relative overflow-hidden">
                    <div className="absolute top-[-20%] left-[-20%] w-[150%] h-[150%] bg-white/10 rounded-full blur-xl"></div>
                    <div className="flex flex-col items-center z-10 text-white">
                        {s.showOriginalPrice && tag.originalPrice && <span className="text-sm font-bold opacity-60 line-through mb-1">{tag.originalPrice}</span>}
                        <div className="flex items-start leading-none">
                            <span style={{ fontSize: `${s.priceFontSize * 1.5}pt`, fontWeight: '900' }}>{tag.price}</span>
                            <span className="text-xs font-bold mt-2 ml-1">SR</span>
                        </div>
                        <span className="text-[8px] text-white/70 font-bold mt-1">السعر شامل الضريبة</span>
                    </div>
                </div>
                <div className="h-[35%] bg-white p-2 flex items-center justify-center text-center">
                    <div style={{ fontSize: `${s.nameFontSize}pt`, color: s.nameColor, fontWeight: 'bold' }} className="leading-tight line-clamp-2">
                        {tag.name}
                    </div>
                </div>
            </div>
          );
      }

      if (s.template === 'discount_red') {
          return (
            <div className="flex flex-col h-full border-2 border-red-600 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-bold px-3 py-1 rounded-bl-lg z-10">SALE</div>
                <div className="flex-1 p-2 flex flex-col justify-start pt-6">
                    <div style={{ fontSize: `${s.nameFontSize}pt`, color: s.nameColor, fontWeight: s.nameWeight }} className="leading-tight text-right mb-auto">
                        {tag.name}
                    </div>
                    <div className="flex items-end justify-between mt-1">
                        <div>
                            {s.showOriginalPrice && tag.originalPrice && (
                                <div className="bg-red-50 text-red-600 px-1 rounded mb-1 w-fit">
                                    <span className="text-[9px] font-bold">كان: </span>
                                    <span className="text-xs font-bold line-through">{tag.originalPrice}</span>
                                </div>
                            )}
                            {s.showUnit && tag.unitName && <span className="text-[9px] text-gray-500 font-bold">{tag.unitName}</span>}
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="flex items-baseline gap-0.5">
                                <span style={{ fontSize: `${s.priceFontSize}pt`, color: '#DC2626', fontWeight: '900' }}>{tag.price}</span>
                                <span className="text-[8px] font-bold text-red-600">ر.س</span>
                            </div>
                            <span className="text-[7px] text-gray-400 font-bold">شامل الضريبة</span>
                        </div>
                    </div>
                </div>
            </div>
          );
      }

      if (s.template === 'yellow_shelf_label') {
          const product = products.find(p => p.id === tag.productId);
          const barcode = product?.code || '---';
          const itemCode = product?.code || '---';
          const [intPart, decPart] = tag.price.split('.');
          const unitDisplay = (s.showUnit && tag.unitName) ? tag.unitName : 'حبة';
          
          return (
            <div className="flex flex-row h-full w-full border border-black relative overflow-hidden font-sans text-black" style={{ backgroundColor: s.backgroundColor, direction: 'rtl' }}>
                {/* Right Section (Product Details) */}
                <div className="w-[65%] flex flex-col p-2 relative border-l border-black/20">
                    {/* Product Name */}
                    <div 
                        className="flex-1 flex items-start justify-start text-right leading-snug break-words mb-1 font-bold"
                        style={{ fontSize: `${s.nameFontSize}pt`, color: '#000' }}
                    >
                        {tag.name}
                    </div>
                    
                    {/* Bottom Details */}
                    <div className="mt-auto text-[9px] font-bold space-y-0.5 pt-1">
                        <div className="flex justify-between items-center text-black/70">
                            <span>العبوة: 1</span>
                            <span>الوحدة: {unitDisplay}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-mono tracking-tighter">Barcode: {barcode}</span>
                        </div>
                    </div>
                </div>

                {/* Left Section (Price) */}
                <div className="w-[35%] flex flex-col items-center justify-between p-1" style={{ backgroundColor: s.backgroundColor }}>
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <span style={{ fontSize: `${s.priceFontSize}pt`, fontWeight: '900', color: '#000', lineHeight: 1 }}>{tag.price}</span>
                        <span className="text-sm font-black mt-1">S.R</span>
                    </div>
                    
                    <div className="w-full text-center border-t border-black/20 pt-1">
                        <div className="text-[10px] font-black">السعر شامل الضريبة</div>
                        <div className="text-[8px] font-mono opacity-70" dir="ltr">{new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>
                </div>
            </div>
          );
      }

      return <div>Error</div>;
  };

  const currentScopeStyles = activeTag ? getEffectiveStyle(activeTag) : globalStyles;

  // Calculate Label Width based on margins
  const labelWidth = useMemo(() => {
      // 210mm is A4 Width. If margins are 0, we have 210mm / 2 = 105mm per sticker.
      return (210 - globalStyles.leftMargin - globalStyles.rightMargin) / 2;
  }, [globalStyles.leftMargin, globalStyles.rightMargin]);

  // PORTAL PRINT COMPONENT
  const FullPagePrint = () => {
    const portalNode = document.getElementById('print-container');
    if (!portalNode) return null;

    return createPortal(
      <div 
        style={{
            width: '210mm', 
            height: '297mm',
            display: 'grid', 
            gridTemplateColumns: `repeat(2, ${labelWidth}mm)`, 
            gridTemplateRows: `repeat(8, ${globalStyles.tagHeight}mm)`, 
            paddingTop: `${globalStyles.topMargin}mm`, 
            paddingBottom: `${globalStyles.bottomMargin}mm`, 
            paddingLeft: `${globalStyles.leftMargin}mm`, 
            paddingRight: `${globalStyles.rightMargin}mm`,
            margin: 0,
            backgroundColor: 'white',
            boxSizing: 'border-box'
        } as any}>
            {Array.from({ length: 16 }).map((_, i) => {
                const tag = selectedTags[i];
                const s = getEffectiveStyle(tag);
                return (
                  <div key={i} className="overflow-hidden" style={{ 
                      width: `${labelWidth}mm`, 
                      height: `${globalStyles.tagHeight}mm`, 
                      boxSizing: 'border-box', 
                      border: s.showBorder ? '1px solid #ddd' : '1px solid transparent', 
                      backgroundColor: s.backgroundColor,
                      WebkitPrintColorAdjust: 'exact',
                      printColorAdjust: 'exact'
                  }}>
                        {renderTagLayout(tag, s)}
                  </div>
                );
            })}
      </div>,
      portalNode
    );
  };

  if (!hasStarted && savedLists.length > 0) {
      return (
          <div className="h-full w-full bg-sap-background flex items-center justify-center">
              <div className="bg-white border border-sap-border p-8 shadow-sm w-[600px] rounded-sap-s">
                  <h1 className="text-2xl font-black text-sap-primary mb-6 flex items-center gap-2"><LayoutGrid size={24}/> معالج طباعة الملصقات</h1>
                  <div className="space-y-4">
                      <button onClick={() => setHasStarted(true)} className="w-full flex items-center gap-4 p-4 border border-sap-border hover:bg-sap-highlight hover:border-sap-primary text-right transition-colors group bg-gray-50">
                          <div className="bg-sap-primary text-white p-3 rounded-sap-s group-hover:bg-sap-primary-hover shadow-sm"><FilePlus size={24} /></div>
                          <div><div className="font-bold text-sm text-sap-text">مشروع جديد فارغ</div><div className="text-xs text-sap-text-variant">بدء صفحة A4 جديدة للملصقات</div></div>
                      </button>
                      <div className="text-xs font-black text-sap-text-variant uppercase tracking-widest mt-6 mb-2 border-b border-sap-border pb-1">المشاريع الأخيرة</div>
                      <div className="border border-sap-border bg-white max-h-[300px] overflow-y-auto">
                          {savedLists.map(list => (
                              <div key={list.id} onClick={() => loadProject(list)} className="p-3 border-b border-sap-border hover:bg-sap-highlight cursor-pointer flex justify-between items-center text-xs group">
                                  <span className="font-bold text-sap-text group-hover:text-sap-primary">{list.name}</span>
                                  <span className="text-sap-text-variant font-mono">{new Date(list.date).toLocaleDateString('ar-SA')}</span>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )
  }

  return (
    <div className="h-full w-full flex overflow-hidden relative bg-[#e5e7eb]">
      
      {/* --- PORTAL FOR PRINTING --- */}
      <FullPagePrint />

      {/* Sidebar */}
      <aside className="w-[320px] bg-white border-l-2 border-sap-secondary flex flex-col shrink-0 print:hidden z-30 shadow-lg text-xs h-full">
        <div className={`px-3 py-2 font-black text-sm flex items-center justify-between shadow-md transition-colors ${activeTagId ? 'bg-sap-primary text-white' : 'bg-sap-shell text-white'}`}>
            <div className="flex items-center gap-2">
                <Settings size={16} className="text-sap-secondary"/> 
                <span>{activeTagId ? 'تعديل ملصق محدد' : 'الإعدادات العامة'}</span>
            </div>
            {activeTagId && <button onClick={() => setActiveTagId(null)} className="text-[10px] bg-white/20 px-2 py-0.5 rounded hover:bg-white/30">عودة للعام</button>}
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#F9FAFB]">
            
            {/* 1. Structural Templates */}
            <AccordionHeader title="هيكل وتصميم الملصق" isOpen={openSections.templates} onClick={() => toggleSection('templates')} icon={LayoutGrid} />
            {openSections.templates && (
                <div className="p-3 bg-white border-b border-sap-border">
                    <div className="grid grid-cols-1 gap-2">
                        {templatesList.map(t => (
                            <button
                                key={t.id}
                                onClick={() => {
                                    handleStyleChange('template', t.id);
                                    if (t.id === 'yellow_shelf_label') {
                                        handleStyleChange('backgroundColor', '#fde047');
                                    } else {
                                        handleStyleChange('backgroundColor', '#ffffff');
                                    }
                                }}
                                className={`p-3 border rounded-[2px] flex items-center gap-3 transition-all ${currentScopeStyles.template === t.id ? 'bg-sap-highlight border-sap-primary ring-1 ring-sap-primary' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                            >
                                <div className={`p-2 rounded ${currentScopeStyles.template === t.id ? 'bg-sap-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
                                    <t.icon size={18} />
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-xs">{t.name}</div>
                                    <div className="text-[10px] text-gray-400">{t.desc}</div>
                                </div>
                                {currentScopeStyles.template === t.id && <CheckCircle2 size={16} className="mr-auto text-sap-primary"/>}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 2. Page Setup */}
            <AccordionHeader title="إعدادات الهوامش والأبعاد" isOpen={openSections.pageSetup} onClick={() => toggleSection('pageSetup')} icon={AppWindow} />
            {openSections.pageSetup && (
                <div className="p-3 space-y-4 border-b border-sap-border bg-white">
                    <div className="grid grid-cols-2 gap-3">
                        <PropertyRow label="الهامش العلوي">
                            <input type="number" step="0.1" value={globalStyles.topMargin} onChange={e => setGlobalStyles({...globalStyles, topMargin: Number(e.target.value)})} className="w-full p-1 border border-sap-border focus:border-sap-primary font-mono text-center bg-gray-50" />
                        </PropertyRow>
                        <PropertyRow label="الهامش السفلي">
                            <input type="number" step="0.1" value={globalStyles.bottomMargin} onChange={e => setGlobalStyles({...globalStyles, bottomMargin: Number(e.target.value)})} className="w-full p-1 border border-sap-border focus:border-sap-primary font-mono text-center bg-gray-50" />
                        </PropertyRow>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <PropertyRow label="الهامش الأيمن">
                            <input type="number" step="0.1" value={globalStyles.rightMargin} onChange={e => setGlobalStyles({...globalStyles, rightMargin: Number(e.target.value)})} className="w-full p-1 border border-sap-border focus:border-sap-primary font-mono text-center bg-gray-50" />
                        </PropertyRow>
                        <PropertyRow label="الهامش الأيسر">
                            <input type="number" step="0.1" value={globalStyles.leftMargin} onChange={e => setGlobalStyles({...globalStyles, leftMargin: Number(e.target.value)})} className="w-full p-1 border border-sap-border focus:border-sap-primary font-mono text-center bg-gray-50" />
                        </PropertyRow>
                    </div>
                    <PropertyRow label="ارتفاع الملصق">
                        <input type="number" step="0.1" value={globalStyles.tagHeight} onChange={e => setGlobalStyles({...globalStyles, tagHeight: Number(e.target.value)})} className="w-full p-1 border border-sap-border focus:border-sap-primary font-mono text-center bg-gray-50" />
                    </PropertyRow>
                    
                    <div className="pt-2 border-t border-dashed border-sap-border">
                        <div onClick={() => logoInputRef.current?.click()} className="h-16 border-2 border-dashed border-sap-border bg-gray-50 flex items-center justify-center cursor-pointer hover:bg-sap-highlight hover:border-sap-primary transition-all rounded-sap-s">
                            {globalStyles.logoUrl ? <img src={globalStyles.logoUrl} className="h-full object-contain p-1" /> : <div className="text-center text-sap-text-variant"><span className="text-[10px] font-bold">تغيير الشعار</span></div>}
                            <input type="file" ref={logoInputRef} className="hidden" onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) { const reader = new FileReader(); reader.onload = (re) => setGlobalStyles({...globalStyles, logoUrl: re.target?.result as string}); reader.readAsDataURL(file); }
                            }} />
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Item Data */}
            <AccordionHeader title="بيانات العنصر" isOpen={openSections.itemProps} onClick={() => toggleSection('itemProps')} icon={SlidersHorizontal} />
            {openSections.itemProps && (
                <div className="p-3 space-y-3 border-b border-sap-border bg-white min-h-[150px]">
                    {activeTag ? (
                        <>
                            <div className="mb-2">
                                <label className="block text-[10px] font-bold text-sap-text-variant mb-1">اسم المنتج</label>
                                <textarea ref={nameInputRef} value={activeTag.name} onChange={e => updateTag(activeTag.id, { name: e.target.value })} className="w-full p-2 border border-sap-border text-xs h-12 resize-none focus:border-sap-primary font-bold" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-sap-text-variant mb-1 text-sap-primary">السعر الحالي</label>
                                    <input type="text" value={activeTag.price} onChange={e => updateTag(activeTag.id, { price: e.target.value })} className="w-full p-1 border border-sap-primary font-mono font-black text-sap-primary text-center bg-green-50" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-sap-text-variant mb-1 text-red-500">السعر السابق</label>
                                    <input type="text" value={activeTag.originalPrice || ''} onChange={e => updateTag(activeTag.id, { originalPrice: e.target.value })} className="w-full p-1 border border-red-200 font-mono font-bold text-red-500 text-center bg-red-50" placeholder="مثال: 50.00" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-sap-text-variant mb-1">الوحدة</label>
                                <input type="text" value={activeTag.unitName || ''} onChange={e => updateTag(activeTag.id, { unitName: e.target.value })} className="w-full p-1 border border-sap-border text-center font-bold" />
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8 opacity-50 flex flex-col items-center">
                            <MousePointer2 size={24} className="mb-2"/>
                            <p className="font-bold">حدد ملصقاً لتعديل بياناته</p>
                        </div>
                    )}
                </div>
            )}

            {/* 4. Colors & Fonts */}
            <AccordionHeader title="الألوان والخطوط" isOpen={openSections.typography} onClick={() => toggleSection('typography')} icon={Palette} />
            {openSections.typography && (
                <div className="p-3 space-y-3 border-b border-sap-border bg-white">
                    <PropertyRow label="حجم الاسم">
                        <input type="number" value={currentScopeStyles.nameFontSize} onChange={e => handleStyleChange('nameFontSize', Number(e.target.value))} className="w-full p-1 border border-sap-border text-center" />
                    </PropertyRow>
                    <PropertyRow label="حجم السعر">
                        <input type="number" value={currentScopeStyles.priceFontSize} onChange={e => handleStyleChange('priceFontSize', Number(e.target.value))} className="w-full p-1 border border-sap-border text-center" />
                    </PropertyRow>
                    
                    <div className="border-t border-dashed border-gray-200 pt-2 mt-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold">لون المنتج</span>
                            <input type="color" value={currentScopeStyles.nameColor} onChange={e => handleStyleChange('nameColor', e.target.value)} className="w-6 h-6 border-none cursor-pointer" />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold">لون السعر</span>
                            <input type="color" value={currentScopeStyles.priceColor} onChange={e => handleStyleChange('priceColor', e.target.value)} className="w-6 h-6 border-none cursor-pointer" />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold">لون الوحدة</span>
                            <input type="color" value={currentScopeStyles.unitColor} onChange={e => handleStyleChange('unitColor', e.target.value)} className="w-6 h-6 border-none cursor-pointer" />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold">لون الخلفية</span>
                            <input type="color" value={currentScopeStyles.backgroundColor} onChange={e => handleStyleChange('backgroundColor', e.target.value)} className="w-6 h-6 border-none cursor-pointer" />
                        </div>
                    </div>
                </div>
            )}

            {/* 5. Visibility */}
            <AccordionHeader title="إظهار / إخفاء" isOpen={openSections.visibility} onClick={() => toggleSection('visibility')} icon={Eye} />
            {openSections.visibility && (
                <div className="p-3 space-y-2 border-b border-sap-border bg-white">
                    <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-50 rounded">
                        <input type="checkbox" checked={currentScopeStyles.showLogo} onChange={e => handleStyleChange('showLogo', e.target.checked)} className="accent-sap-primary" />
                        <span className="font-bold">إظهار الشعار</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-50 rounded">
                        <input type="checkbox" checked={currentScopeStyles.showUnit} onChange={e => handleStyleChange('showUnit', e.target.checked)} className="accent-sap-primary" />
                        <span className="font-bold">إظهار الوحدة</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-50 rounded">
                        <input type="checkbox" checked={currentScopeStyles.showBorder} onChange={e => handleStyleChange('showBorder', e.target.checked)} className="accent-sap-primary" />
                        <span className="font-bold">إطار الملصق</span>
                    </label>
                    <div className="border-t border-dashed border-gray-200 my-2"></div>
                    <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-red-50 rounded">
                        <input type="checkbox" checked={currentScopeStyles.showOriginalPrice} onChange={e => handleStyleChange('showOriginalPrice', e.target.checked)} className="accent-red-500" />
                        <span className="font-bold text-red-600">إظهار السعر السابق</span>
                    </label>
                </div>
            )}

            {/* 6. Actions */}
            <AccordionHeader title="إجراءات" isOpen={openSections.actions} onClick={() => toggleSection('actions')} icon={Layers} />
            {openSections.actions && (
                <div className="p-3 space-y-2 bg-white">
                    <button onClick={() => setShowProductPicker(true)} className="w-full py-2 bg-sap-primary text-white font-bold shadow-sm hover:bg-sap-primary-hover flex items-center justify-center gap-2 rounded-sap-s">
                        <Plus size={16}/> إضافة منتج جديد
                    </button>
                    {activeTag && (
                        <div className="flex gap-2">
                            <button onClick={() => { setSelectedTags(prev => prev.filter(t => t.id !== activeTag.id)); setActiveTagId(null); }} className="flex-1 py-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 font-bold rounded-sap-s text-xs">
                                حذف
                            </button>
                            <button onClick={() => setActiveTagId(null)} className="flex-1 py-2 border border-sap-border hover:bg-gray-50 font-bold rounded-sap-s text-xs">
                                إلغاء
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
      </aside>

      {/* Main Canvas */}
      <main className="flex-1 flex flex-col overflow-hidden relative print:hidden">
        <div className="h-12 bg-white border-b border-sap-border flex items-center justify-between px-4 shrink-0 z-20 shadow-sm">
            <div className="flex items-center gap-3">
                <span className="text-xs text-sap-text font-black">المشروع:</span>
                <input type="text" value={listName} onChange={e => setListName(e.target.value)} className="bg-gray-50 border border-sap-border px-3 py-1 text-xs w-56 focus:border-sap-primary font-bold rounded-sap-s" />
                <button onClick={handleSaveProject} disabled={isSaving} className="p-2 hover:bg-sap-highlight rounded-sap-s text-sap-primary border border-transparent hover:border-sap-primary transition-all">{isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18}/>}</button>
                <button onClick={() => setShowSavedLists(true)} className="p-2 hover:bg-sap-highlight rounded-sap-s text-sap-primary border border-transparent hover:border-sap-primary transition-all"><FolderOpen size={18}/></button>
                <button onClick={() => window.print()} className="p-2 bg-sap-primary text-white rounded-sap-s hover:bg-sap-primary-hover shadow-sm transition-all flex items-center gap-2 px-4"><Printer size={18}/> <span className="text-xs font-bold">طباعة</span></button>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 border border-sap-border px-2 py-1 rounded-sap-s">
                <button onClick={() => setGlobalStyles(s => ({...s, previewZoom: Math.max(20, s.previewZoom - 10)}))} className="hover:text-sap-primary"><ZoomOut size={16}/></button>
                <span className="text-xs font-black w-10 text-center font-mono">{globalStyles.previewZoom}%</span>
                <button onClick={() => setGlobalStyles(s => ({...s, previewZoom: Math.min(200, s.previewZoom + 10)}))} className="hover:text-sap-primary"><ZoomIn size={16}/></button>
            </div>
        </div>

        <div className="flex-1 bg-[#808080] overflow-auto p-8 relative flex justify-center custom-scrollbar">
            <div 
              className="bg-white shadow-2xl transition-all"
              style={{
                width: '210mm', height: '297mm', transform: `scale(${globalStyles.previewZoom / 100})`, transformOrigin: 'top center',
                display: 'grid', 
                gridTemplateColumns: `repeat(2, ${labelWidth}mm)`, 
                gridTemplateRows: `repeat(8, ${globalStyles.tagHeight}mm)`,
                boxSizing: 'border-box', 
                paddingTop: `${globalStyles.topMargin}mm`, 
                paddingBottom: `${globalStyles.bottomMargin}mm`,
                paddingLeft: `${globalStyles.leftMargin}mm`, 
                paddingRight: `${globalStyles.rightMargin}mm`,
                border: '1px solid #333'
              } as any}
            >
                {Array.from({ length: 16 }).map((_, i) => {
                    const tag = selectedTags[i];
                    const s = getEffectiveStyle(tag);
                    const isActive = tag && activeTagId === tag.id;
                    return (
                        <div 
                          key={i} 
                          onClick={() => tag ? setActiveTagId(tag.id) : null}
                          className={`relative overflow-hidden transition-all ${tag ? 'cursor-pointer hover:bg-sap-highlight/20' : 'bg-gray-100 opacity-50'} ${isActive ? 'outline outline-2 outline-sap-primary z-10 shadow-lg' : ''}`}
                          style={{ width: `${labelWidth}mm`, height: `${globalStyles.tagHeight}mm`, boxSizing: 'border-box', border: s.showBorder ? '1px solid #ccc' : '1px dashed #e0e0e0', backgroundColor: s.backgroundColor }}
                        >
                            {renderTagLayout(tag, s)}
                        </div>
                    );
                })}
            </div>
        </div>
      </main>

      {/* Modals: Saved Lists & Product Picker */}
      {showSavedLists && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-10 backdrop-blur-sm">
              <div className="bg-white w-[500px] border border-sap-primary shadow-2xl rounded-sap-m overflow-hidden">
                <div className="bg-sap-primary text-white px-4 py-3 flex justify-between items-center text-sm font-black shadow-md"><span>فتح مشروع محفوظ</span><button onClick={() => setShowSavedLists(false)} className="hover:bg-white/20 p-1 rounded"><X size={16}/></button></div>
                <div className="p-0 max-h-[400px] overflow-y-auto">
                    {savedLists.length === 0 ? <div className="p-12 text-center text-gray-400 italic">لا توجد مشاريع محفوظة</div> : (
                        <table className="w-full text-right text-xs"><thead className="bg-gray-100 text-gray-600 font-bold border-b border-gray-300"><tr><th className="p-3">اسم المشروع</th><th className="p-3">التاريخ</th><th className="p-3 w-16 text-center">إجراء</th></tr></thead><tbody>{savedLists.map(list => (<tr key={list.id} className="border-b border-gray-100 hover:bg-sap-highlight cursor-pointer transition-colors" onClick={() => loadProject(list)}><td className="p-3 font-bold text-sap-text">{list.name}</td><td className="p-3 text-gray-500 font-mono">{new Date(list.date).toLocaleDateString('ar-SA')}</td><td className="p-3 text-center"><button onClick={(e) => { e.stopPropagation(); deleteProject(list.id); }} className="text-red-500 hover:bg-red-50 p-2 rounded transition-all"><Trash2 size={14}/></button></td></tr>))}</tbody></table>
                    )}
                </div>
              </div>
          </div>
      )}
      {showProductPicker && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white w-[600px] border border-sap-primary shadow-2xl rounded-sap-m overflow-hidden">
                <div className="bg-sap-primary text-white px-4 py-3 flex justify-between items-center text-sm font-black shadow-md"><span>قاعدة البيانات: اختيار منتج</span><button onClick={() => setShowProductPicker(false)} className="hover:bg-white/20 p-1 rounded"><X size={16}/></button></div>
                <div className="p-4 bg-gray-50 border-b border-gray-200"><div className="flex gap-2"><div className="relative flex-1"><input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={handlePickerKeyDown} placeholder="بحث باسم المنتج أو الكود..." className="w-full pl-2 pr-8 py-2 border border-gray-300 text-xs focus:border-sap-primary font-bold rounded-sap-s" autoFocus /><Search className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" size={14}/></div><button onClick={() => addTag()} className="px-4 py-2 bg-white border border-gray-300 hover:border-sap-primary text-xs font-bold hover:bg-sap-highlight rounded-sap-s transition-all">إضافة يدوي</button></div></div>
                <div className="max-h-[350px] overflow-y-auto bg-white custom-scrollbar"><table className="w-full text-xs text-right"><thead className="bg-gray-100 text-gray-600 font-bold border-b border-gray-300 sticky top-0"><tr><th className="p-3">الكود</th><th className="p-3">اسم المنتج</th><th className="p-3">الوحدة</th></tr></thead><tbody className="divide-y divide-gray-100">{filteredProducts.map((p, index) => (<tr key={p.id} onClick={() => addTag(p)} className={`cursor-pointer transition-colors ${pickerSelectedIndex === index + 1 ? 'bg-sap-primary text-white' : 'hover:bg-sap-highlight'}`}><td className={`p-3 font-mono font-bold ${pickerSelectedIndex === index + 1 ? 'text-white' : 'text-sap-primary'}`}>{p.code}</td><td className="p-3 font-bold">{p.name}</td><td className={`p-3 ${pickerSelectedIndex === index + 1 ? 'text-white/80' : 'text-gray-500'}`}>{(units.find(u => u.id === p.unitId))?.name}</td></tr>))}</tbody></table></div>
             </div>
          </div>
      )}
    </div>
  );
};
