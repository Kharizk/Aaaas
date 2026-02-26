
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

const SaudiRiyalIcon = ({ className, style, color }: { className?: string, style?: React.CSSProperties, color?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M16 3v18" />
    <path d="M8 3v14c0 2.5-2 4-4 4" />
    <path d="M3 10h18" />
    <path d="M3 14h18" />
  </svg>
);

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info' | 'warning', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-amber-500'
  };

  const icons = {
    success: <CheckCircle2 size={18} />,
    error: <X size={18} />,
    info: <Zap size={18} />,
    warning: <Zap size={18} />
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg shadow-black/5 text-white ${bgColors[type]} transition-all animate-in slide-in-from-bottom-5 fade-in duration-300 min-w-[300px] justify-between`}>
      <div className="flex items-center gap-3">
          {icons[type]}
          <span className="text-sm font-bold">{message}</span>
      </div>
      <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X size={14} /></button>
    </div>
  );
};

interface PriceTagGeneratorProps {
  products: Product[];
  units: Unit[];
}

export const PriceTagGenerator: React.FC<PriceTagGeneratorProps> = ({ products, units }) => {
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>([]);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
  };
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));
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
    backgroundColor: '#ffffff',
    nameBackgroundColor: '#ffffff',
    currencySymbolType: 'icon',
    currencySymbolImage: null,
    currencySymbolSize: 14,
    currencySymbolPosition: 'after',
    currencySymbolMargin: 4
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
    if (!listName.trim()) { addToast("الرجاء إدخل اسم المشروع", "error"); return; }
    if (selectedTags.length === 0) { addToast("المشروع فارغ", "warning"); return; }
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
      addToast("تم الحفظ بنجاح", "success");
    } catch (e) { addToast("خطأ في الحفظ", "error"); }
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
    addToast("تم تحميل المشروع", "success");
  };

  const deleteProject = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await db.tagLists.delete(id);
      if (activeListId === id) { setActiveListId(null); setListName('مشروع جديد'); setSelectedTags([]); }
      fetchSavedLists();
      addToast("تم الحذف بنجاح", "success");
    } catch (e) { addToast("فشل الحذف", "error"); }
  };

  const addTag = (product?: Product) => {
    if (selectedTags.length >= 16) { addToast("الصفحة ممتلئة (16 ملصق كحد أقصى)", "warning"); return; }
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
      backgroundColor: tag.styles?.backgroundColor ?? globalStyles.backgroundColor,
      nameBackgroundColor: tag.styles?.nameBackgroundColor ?? globalStyles.nameBackgroundColor,
      currencySymbolType: tag.styles?.currencySymbolType ?? globalStyles.currencySymbolType,
      currencySymbolImage: tag.styles?.currencySymbolImage ?? globalStyles.currencySymbolImage,
      currencySymbolSize: tag.styles?.currencySymbolSize ?? globalStyles.currencySymbolSize,
      currencySymbolPosition: tag.styles?.currencySymbolPosition ?? globalStyles.currencySymbolPosition,
      currencySymbolMargin: tag.styles?.currencySymbolMargin ?? globalStyles.currencySymbolMargin
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
      <button onClick={onClick} className={`w-full flex items-center justify-between px-5 py-4 border-b border-gray-100 transition-all duration-200 group ${isOpen ? 'bg-white' : 'bg-gray-50/50 hover:bg-gray-50'}`}>
          <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-all ${isOpen ? 'bg-sap-primary text-white shadow-md shadow-sap-primary/20' : 'bg-white border border-gray-200 text-gray-400 group-hover:border-sap-primary/50 group-hover:text-sap-primary'}`}>
                <Icon size={16} strokeWidth={isOpen ? 2.5 : 2} />
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider ${isOpen ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'}`}>{title}</span>
          </div>
          <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-sap-primary' : 'text-gray-300'}`}>
             <ChevronDown size={16} />
          </div>
      </button>
  );

  const PropertyRow = ({ label, children }: { label: string, children?: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 mb-3 last:mb-0">
      <span className="text-xs font-semibold text-gray-600 w-24 shrink-0 truncate text-right">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );

  const CurrencySymbolRenderer = ({ type, imageUrl, color, size, style, className }: { type: any, imageUrl?: string | null, color?: string, size?: number, style?: React.CSSProperties, className?: string }) => {
      const sizeStyle = size ? { width: `${size}px`, height: `${size}px`, fontSize: `${size}px` } : {};
      
      if (type === 'custom_image' && imageUrl) {
          return <img src={imageUrl} alt="Currency" className={className} style={{ ...style, ...sizeStyle, objectFit: 'contain' }} />;
      }
      if (type === 'text') {
          return <span className={className} style={{ ...style, color, fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: size ? `${size}pt` : 'inherit' }}>ر.س</span>;
      }
      return <SaudiRiyalIcon className={className} style={{ ...style, ...sizeStyle }} color={color} />;
  };

  const renderTagLayout = (tag: SelectedTag | undefined, s: any) => {
      if (!tag) {
          return (
            <div className="h-full w-full flex items-center justify-center group cursor-pointer bg-gray-50/30 hover:bg-gray-50 transition-colors duration-300" onClick={() => setShowProductPicker(true)}>
                <div className="w-10 h-10 rounded-full bg-white border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 group-hover:border-sap-primary group-hover:text-sap-primary group-hover:scale-110 transition-all duration-300 shadow-sm">
                    <Plus size={20} strokeWidth={2.5} />
                </div>
            </div>
          );
      }

      // Helper to render price with currency symbol based on position
      const PriceWithCurrency = ({ priceComponent, scale = 1 }: { priceComponent?: React.ReactNode, scale?: number } = {}) => {
          const margin = s.currencySymbolMargin || 4;
          const position = s.currencySymbolPosition || 'after';
          
          const symbol = (
              <CurrencySymbolRenderer 
                  type={s.currencySymbolType} 
                  imageUrl={s.currencySymbolImage} 
                  color={s.currencyColor} 
                  size={s.currencySymbolSize || 14}
              />
          );

          const price = priceComponent || <span style={{ fontSize: `${s.priceFontSize * scale}pt`, color: s.priceColor, fontWeight: s.priceWeight, fontFamily: 'monospace' }}>{tag.price}</span>;

          if (position === 'before') {
              return <div className="flex items-center" style={{ gap: `${margin}px` }}>{symbol}{price}</div>;
          }
          if (position === 'after') {
              return <div className="flex items-center" style={{ gap: `${margin}px` }}>{price}{symbol}</div>;
          }
          if (position === 'superscript_before') {
              return <div className="flex items-start" style={{ gap: `${margin}px` }}><div className="mt-1">{symbol}</div>{price}</div>;
          }
          if (position === 'superscript_after') {
              return <div className="flex items-start" style={{ gap: `${margin}px` }}>{price}<div className="mt-1">{symbol}</div></div>;
          }
          return <div className="flex items-center gap-1">{price}{symbol}</div>;
      };

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
                        <PriceWithCurrency />
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
                <div className="w-[38%] flex flex-col items-center justify-center border-l-2 border-gray-200 p-2 relative" style={{ backgroundColor: s.backgroundColor }}>
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
                        <PriceWithCurrency 
                            priceComponent={
                                <div className="flex items-baseline">
                                    <span style={{ fontSize: `${s.priceFontSize * 1.4}pt`, color: s.priceColor, fontWeight: '900', fontFamily: 'monospace', letterSpacing: '-2px' }} className="leading-none">
                                      {intPart}
                                    </span>
                                    <span className="text-[12pt] font-black leading-none ml-1" style={{color: s.priceColor}}>
                                       .{decPart || '00'}
                                    </span>
                                </div>
                            }
                        />
                    </div>
                    <span className="text-[6px] text-gray-400 font-bold mt-1 text-center w-full">شامل الضريبة</span>
                </div>

                {/* Right Side (Information Section) */}
                <div className="w-[62%] flex flex-col justify-between p-3" style={{ backgroundColor: s.backgroundColor }}>
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
                    {s.showUnit && tag.unitName && <span className="text-[10px] font-bold bg-white text-black px-1 rounded-sm" style={{ color: s.unitColor }}>{tag.unitName}</span>}
                </div>
                <div className="flex-1 flex items-center justify-center p-2 text-center" style={{ backgroundColor: s.backgroundColor }}>
                    <div style={{ fontSize: `${s.nameFontSize}pt`, color: s.nameColor, fontWeight: '900', textTransform: 'uppercase' }} className="leading-tight">
                        {tag.name}
                    </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2 border-t-4 border-black" style={{ backgroundColor: s.backgroundColor }}>
                    {s.showOriginalPrice && tag.originalPrice && (
                        <div className="flex flex-col">
                            <span className="text-[7px] font-bold text-gray-500">WAS</span>
                            <span className="text-xs font-bold line-through text-gray-400">{tag.originalPrice}</span>
                        </div>
                    )}
                    <div className="flex items-baseline gap-1 ml-auto">
                        <div className="flex flex-col items-end">
                            <PriceWithCurrency />
                            <span className="text-[7px] text-gray-400 font-bold">السعر شامل الضريبة</span>
                        </div>
                    </div>
                </div>
            </div>
          );
      }

      if (s.template === 'big_impact') {
          return (
            <div className="flex flex-col h-full w-full bg-white relative overflow-hidden border border-gray-200 shadow-sm group">
                {/* Top Section - Price */}
                <div 
                    className="h-[65%] flex items-center justify-center relative overflow-hidden"
                    style={{ backgroundColor: s.backgroundColor }}
                >
                     {/* Subtle Background Pattern */}
                     <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '12px 12px' }}></div>
                     
                     {/* Shine Effect */}
                     <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-br from-white/30 to-transparent rounded-full blur-3xl pointer-events-none"></div>
                     
                     <div className="flex flex-col items-center z-10 relative transform transition-transform group-hover:scale-105 duration-300">
                        {s.showOriginalPrice && tag.originalPrice && (
                            <div className="relative mb-0.5">
                                <span className="text-lg font-bold opacity-60 line-through decoration-red-500/50 decoration-2" style={{ color: s.priceColor }}>{tag.originalPrice}</span>
                            </div>
                        )}
                        <div className="flex items-start leading-none drop-shadow-sm">
                            <PriceWithCurrency scale={1.8} />
                        </div>
                        <span className="text-[10px] font-bold mt-1 opacity-70" style={{ color: s.priceColor }}>السعر شامل الضريبة</span>
                     </div>
                </div>

                {/* Bottom Section - Name */}
                <div className="h-[35%] p-2 flex flex-col items-center justify-center text-center relative border-t border-black/5" style={{ backgroundColor: s.nameBackgroundColor || '#f8fafc' }}>
                    <div style={{ fontSize: `${s.nameFontSize}pt`, color: s.nameColor, fontWeight: '800' }} className="leading-tight line-clamp-2 font-sans w-full px-1">
                        {tag.name}
                    </div>
                    
                    {s.showUnit && tag.unitName && (
                        <span className="absolute bottom-1 right-2 text-[9px] font-bold bg-gray-200/50 px-1.5 py-0.5 rounded text-gray-600">
                            {tag.unitName}
                        </span>
                    )}

                    {s.showLogo && globalStyles.logoUrl && (
                        <div className="absolute bottom-1 left-2 opacity-40 grayscale hover:grayscale-0 transition-all">
                            <img src={globalStyles.logoUrl} alt="Logo" className="h-3 object-contain" />
                        </div>
                    )}
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
                            {s.showUnit && tag.unitName && <span className="text-[9px] font-bold" style={{ color: s.unitColor }}>{tag.unitName}</span>}
                        </div>
                        <div className="flex flex-col items-end">
                            <PriceWithCurrency />
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
                        style={{ fontSize: `${s.nameFontSize}pt`, color: s.nameColor }}
                    >
                        {tag.name}
                    </div>
                    
                    {/* Bottom Details */}
                    <div className="mt-auto text-[9px] font-bold space-y-0.5 pt-1">
                        <div className="flex justify-between items-center" style={{ color: s.unitColor }}>
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
                        <PriceWithCurrency />
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
          <div className="h-full w-full bg-gray-50 flex items-center justify-center p-4">
              <div className="bg-white border border-gray-200 shadow-xl w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[80vh]">
                  <div className="p-8 bg-gradient-to-br from-sap-primary to-sap-primary/80 text-white">
                      <h1 className="text-3xl font-black mb-2 flex items-center gap-3"><LayoutGrid size={32}/> معالج طباعة الملصقات</h1>
                      <p className="text-white/80 text-sm font-medium">قم بإنشاء وطباعة ملصقات الأسعار بسهولة واحترافية</p>
                  </div>
                  
                  <div className="p-8 overflow-y-auto custom-scrollbar">
                      <button onClick={() => setHasStarted(true)} className="w-full flex items-center gap-5 p-5 border-2 border-dashed border-gray-200 hover:border-sap-primary hover:bg-sap-highlight/10 rounded-xl transition-all group mb-8 text-right">
                          <div className="bg-sap-primary/10 text-sap-primary p-4 rounded-full group-hover:scale-110 transition-transform"><FilePlus size={28} /></div>
                          <div>
                              <div className="font-black text-lg text-gray-800 group-hover:text-sap-primary transition-colors">مشروع جديد فارغ</div>
                              <div className="text-sm text-gray-500">بدء صفحة A4 جديدة للملصقات</div>
                          </div>
                      </button>

                      <div className="flex items-center gap-4 mb-4">
                          <div className="h-px bg-gray-200 flex-1"></div>
                          <span className="text-xs font-black text-gray-400 uppercase tracking-widest">المشاريع الأخيرة</span>
                          <div className="h-px bg-gray-200 flex-1"></div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                          {savedLists.map(list => (
                              <div key={list.id} onClick={() => loadProject(list)} className="p-4 border border-gray-100 hover:border-sap-primary/30 hover:bg-sap-highlight/5 rounded-xl cursor-pointer flex justify-between items-center group transition-all shadow-sm hover:shadow-md">
                                  <div className="flex items-center gap-3">
                                      <div className="bg-gray-100 p-2 rounded-lg text-gray-500 group-hover:text-sap-primary group-hover:bg-white transition-colors"><FolderOpen size={18}/></div>
                                      <div>
                                          <div className="font-bold text-gray-800 group-hover:text-sap-primary transition-colors">{list.name}</div>
                                          <div className="text-xs text-gray-400 font-mono mt-0.5">{new Date(list.date).toLocaleDateString('ar-SA')}</div>
                                      </div>
                                  </div>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-sap-primary text-xs font-bold bg-sap-highlight/20 px-3 py-1 rounded-full">فتح</div>
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

      {/* Toasts */}
      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 pointer-events-none">
        <div className="pointer-events-auto flex flex-col gap-2">
            {toasts.map(t => (
                <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
            ))}
        </div>
      </div>

      {/* Sidebar */}
      <aside className="w-[340px] bg-white border-l border-gray-200 flex flex-col shrink-0 print:hidden z-30 shadow-xl shadow-gray-200/50 h-full font-sans">
        <div className={`px-5 py-4 flex items-center justify-between transition-colors relative overflow-hidden ${activeTagId ? 'bg-sap-primary' : 'bg-white border-b border-gray-100'}`}>
            {activeTagId && <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none"></div>}
            
            <div className="flex items-center gap-3 relative z-10">
                <div className={`p-2 rounded-lg ${activeTagId ? 'bg-white/20 text-white' : 'bg-sap-primary/10 text-sap-primary'}`}>
                    <Settings size={18} strokeWidth={2.5}/> 
                </div>
                <div>
                    <div className={`text-xs font-bold uppercase tracking-wider ${activeTagId ? 'text-white/80' : 'text-gray-400'}`}>الإعدادات</div>
                    <div className={`font-black text-sm ${activeTagId ? 'text-white' : 'text-gray-800'}`}>{activeTagId ? 'تخصيص الملصق' : 'الإعدادات العامة'}</div>
                </div>
            </div>
            {activeTagId && (
                <button onClick={() => setActiveTagId(null)} className="relative z-10 text-[10px] font-bold bg-white text-sap-primary px-3 py-1.5 rounded-full shadow-sm hover:bg-gray-50 transition-colors">
                    عودة للعام
                </button>
            )}
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50">
            
            {/* 1. Structural Templates */}
            <AccordionHeader title="هيكل وتصميم الملصق" isOpen={openSections.templates} onClick={() => toggleSection('templates')} icon={LayoutGrid} />
            {openSections.templates && (
                <div className="p-4 bg-white border-b border-gray-100">
                    <div className="grid grid-cols-1 gap-3">
                        {templatesList.map(t => (
                            <button
                                key={t.id}
                                onClick={() => {
                                    handleStyleChange('template', t.id);
                                    if (t.id === 'yellow_shelf_label') {
                                        handleStyleChange('backgroundColor', '#fde047');
                                    } else if (t.id === 'big_impact') {
                                        handleStyleChange('backgroundColor', '#1e293b'); // Dark Slate
                                        handleStyleChange('nameBackgroundColor', '#1e293b');
                                        handleStyleChange('priceColor', '#ffffff');
                                        handleStyleChange('currencyColor', '#ffffff');
                                    } else {
                                        handleStyleChange('backgroundColor', '#ffffff');
                                        handleStyleChange('nameBackgroundColor', '#ffffff');
                                        handleStyleChange('priceColor', '#DC2626'); // Default Red
                                        handleStyleChange('currencyColor', '#000000');
                                    }
                                }}
                                className={`p-3 border rounded-xl flex items-center gap-3 transition-all duration-200 group ${currentScopeStyles.template === t.id ? 'bg-sap-primary/5 border-sap-primary ring-1 ring-sap-primary shadow-sm' : 'bg-white border-gray-200 hover:border-sap-primary/50 hover:bg-gray-50'}`}
                            >
                                <div className={`p-2.5 rounded-lg transition-colors ${currentScopeStyles.template === t.id ? 'bg-sap-primary text-white shadow-md shadow-sap-primary/20' : 'bg-gray-100 text-gray-500 group-hover:bg-white group-hover:text-sap-primary'}`}>
                                    <t.icon size={20} />
                                </div>
                                <div className="text-right flex-1">
                                    <div className={`font-bold text-sm mb-0.5 ${currentScopeStyles.template === t.id ? 'text-sap-primary' : 'text-gray-700'}`}>{t.name}</div>
                                    <div className="text-[10px] text-gray-400 font-medium">{t.desc}</div>
                                </div>
                                {currentScopeStyles.template === t.id && <div className="w-2 h-2 rounded-full bg-sap-primary shadow-sm"></div>}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 2. Page Setup */}
            <AccordionHeader title="إعدادات الهوامش والأبعاد" isOpen={openSections.pageSetup} onClick={() => toggleSection('pageSetup')} icon={AppWindow} />
            {openSections.pageSetup && (
                <div className="p-4 space-y-4 border-b border-gray-100 bg-white">
                    <div className="grid grid-cols-2 gap-4">
                        <PropertyRow label="الهامش العلوي">
                            <div className="relative">
                                <input type="number" step="0.1" value={globalStyles.topMargin} onChange={e => setGlobalStyles({...globalStyles, topMargin: Number(e.target.value)})} className="w-full p-2 border border-gray-200 rounded-lg focus:border-sap-primary focus:ring-2 focus:ring-sap-primary/10 font-mono text-center text-sm bg-gray-50/50 transition-all" />
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold pointer-events-none">mm</span>
                            </div>
                        </PropertyRow>
                        <PropertyRow label="الهامش السفلي">
                            <div className="relative">
                                <input type="number" step="0.1" value={globalStyles.bottomMargin} onChange={e => setGlobalStyles({...globalStyles, bottomMargin: Number(e.target.value)})} className="w-full p-2 border border-gray-200 rounded-lg focus:border-sap-primary focus:ring-2 focus:ring-sap-primary/10 font-mono text-center text-sm bg-gray-50/50 transition-all" />
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold pointer-events-none">mm</span>
                            </div>
                        </PropertyRow>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <PropertyRow label="الهامش الأيمن">
                            <div className="relative">
                                <input type="number" step="0.1" value={globalStyles.rightMargin} onChange={e => setGlobalStyles({...globalStyles, rightMargin: Number(e.target.value)})} className="w-full p-2 border border-gray-200 rounded-lg focus:border-sap-primary focus:ring-2 focus:ring-sap-primary/10 font-mono text-center text-sm bg-gray-50/50 transition-all" />
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold pointer-events-none">mm</span>
                            </div>
                        </PropertyRow>
                        <PropertyRow label="الهامش الأيسر">
                            <div className="relative">
                                <input type="number" step="0.1" value={globalStyles.leftMargin} onChange={e => setGlobalStyles({...globalStyles, leftMargin: Number(e.target.value)})} className="w-full p-2 border border-gray-200 rounded-lg focus:border-sap-primary focus:ring-2 focus:ring-sap-primary/10 font-mono text-center text-sm bg-gray-50/50 transition-all" />
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold pointer-events-none">mm</span>
                            </div>
                        </PropertyRow>
                    </div>
                    <PropertyRow label="ارتفاع الملصق">
                        <div className="relative">
                            <input type="number" step="0.1" value={globalStyles.tagHeight} onChange={e => setGlobalStyles({...globalStyles, tagHeight: Number(e.target.value)})} className="w-full p-2 border border-gray-200 rounded-lg focus:border-sap-primary focus:ring-2 focus:ring-sap-primary/10 font-mono text-center text-sm bg-gray-50/50 transition-all" />
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold pointer-events-none">mm</span>
                        </div>
                    </PropertyRow>
                    
                    <div className="pt-3 border-t border-dashed border-gray-200">
                        <div onClick={() => logoInputRef.current?.click()} className="h-20 border-2 border-dashed border-gray-300 bg-gray-50/50 flex flex-col items-center justify-center cursor-pointer hover:bg-sap-primary/5 hover:border-sap-primary transition-all rounded-xl group">
                            {globalStyles.logoUrl ? (
                                <img src={globalStyles.logoUrl} className="h-full object-contain p-2" />
                            ) : (
                                <>
                                    <div className="p-2 bg-white rounded-full shadow-sm mb-1 group-hover:scale-110 transition-transform">
                                        <ImageIcon size={16} className="text-gray-400 group-hover:text-sap-primary" />
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-500 group-hover:text-sap-primary">تغيير الشعار</span>
                                </>
                            )}
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
                <div className="p-4 space-y-4 border-b border-gray-100 bg-white min-h-[150px]">
                    {activeTag ? (
                        <>
                            <div className="mb-2">
                                <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">اسم المنتج</label>
                                <textarea ref={nameInputRef} value={activeTag.name} onChange={e => updateTag(activeTag.id, { name: e.target.value })} className="w-full p-3 border border-gray-200 rounded-lg text-sm h-20 resize-none focus:border-sap-primary focus:ring-2 focus:ring-sap-primary/10 font-bold transition-all" placeholder="أدخل اسم المنتج..." />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-sap-primary mb-1.5 uppercase tracking-wider">السعر الحالي</label>
                                    <div className="relative">
                                        <input type="text" value={activeTag.price} onChange={e => updateTag(activeTag.id, { price: e.target.value })} className="w-full p-2 border border-sap-primary/30 rounded-lg font-mono font-black text-sap-primary text-center bg-sap-primary/5 focus:border-sap-primary focus:ring-2 focus:ring-sap-primary/20 transition-all" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-red-500 mb-1.5 uppercase tracking-wider">السعر السابق</label>
                                    <div className="relative">
                                        <input type="text" value={activeTag.originalPrice || ''} onChange={e => updateTag(activeTag.id, { originalPrice: e.target.value })} className="w-full p-2 border border-red-200 rounded-lg font-mono font-bold text-red-500 text-center bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all" placeholder="0.00" />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">الوحدة</label>
                                <input type="text" value={activeTag.unitName || ''} onChange={e => updateTag(activeTag.id, { unitName: e.target.value })} className="w-full p-2 border border-gray-200 rounded-lg text-center font-bold text-sm focus:border-sap-primary focus:ring-2 focus:ring-sap-primary/10 transition-all" placeholder="مثال: حبة، كجم..." />
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-10 opacity-60 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
                            <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                                <MousePointer2 size={20} className="text-gray-400"/>
                            </div>
                            <p className="font-bold text-gray-600 text-sm">حدد ملصقاً لتعديل بياناته</p>
                            <p className="text-[10px] text-gray-400 mt-1">اضغط على أي ملصق في المعاينة</p>
                        </div>
                    )}
                </div>
            )}

            {/* 4. Colors & Fonts */}
            <AccordionHeader title="الألوان والخطوط" isOpen={openSections.typography} onClick={() => toggleSection('typography')} icon={Palette} />
            {openSections.typography && (
                <div className="p-4 space-y-4 border-b border-gray-100 bg-white">
                    <PropertyRow label="حجم الاسم">
                        <div className="flex items-center gap-2">
                             <input type="range" min="8" max="72" value={currentScopeStyles.nameFontSize} onChange={e => handleStyleChange('nameFontSize', Number(e.target.value))} className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sap-primary" />
                             <input type="number" value={currentScopeStyles.nameFontSize} onChange={e => handleStyleChange('nameFontSize', Number(e.target.value))} className="w-12 p-1 border border-gray-200 rounded-md text-center text-xs font-bold" />
                        </div>
                    </PropertyRow>
                    <PropertyRow label="حجم السعر">
                        <div className="flex items-center gap-2">
                             <input type="range" min="12" max="120" value={currentScopeStyles.priceFontSize} onChange={e => handleStyleChange('priceFontSize', Number(e.target.value))} className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sap-primary" />
                             <input type="number" value={currentScopeStyles.priceFontSize} onChange={e => handleStyleChange('priceFontSize', Number(e.target.value))} className="w-12 p-1 border border-gray-200 rounded-md text-center text-xs font-bold" />
                        </div>
                    </PropertyRow>
                    
                    <div className="border-t border-dashed border-gray-200 pt-4 mt-2">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">خصائص العملة</div>
                        <PropertyRow label="حجم الرمز">
                            <input type="number" value={currentScopeStyles.currencySymbolSize || 14} onChange={e => handleStyleChange('currencySymbolSize', Number(e.target.value))} className="w-full p-2 border border-gray-200 rounded-lg text-center text-sm focus:border-sap-primary focus:ring-2 focus:ring-sap-primary/10 transition-all" />
                        </PropertyRow>
                        <PropertyRow label="الموقع">
                            <select 
                                value={currentScopeStyles.currencySymbolPosition || 'after'} 
                                onChange={e => handleStyleChange('currencySymbolPosition', e.target.value)}
                                className="w-full p-2 border border-gray-200 rounded-lg text-xs font-bold focus:border-sap-primary focus:ring-2 focus:ring-sap-primary/10 transition-all bg-white"
                            >
                                <option value="after">بعد السعر (يسار)</option>
                                <option value="before">قبل السعر (يمين)</option>
                                <option value="superscript_after">علوي بعد السعر</option>
                                <option value="superscript_before">علوي قبل السعر</option>
                            </select>
                        </PropertyRow>
                        <PropertyRow label="المسافة">
                            <input type="number" value={currentScopeStyles.currencySymbolMargin || 4} onChange={e => handleStyleChange('currencySymbolMargin', Number(e.target.value))} className="w-full p-2 border border-gray-200 rounded-lg text-center text-sm focus:border-sap-primary focus:ring-2 focus:ring-sap-primary/10 transition-all" />
                        </PropertyRow>
                    </div>

                    <div className="border-t border-dashed border-gray-200 pt-4 mt-2 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">نوع العملة</span>
                            <select 
                                value={currentScopeStyles.currencySymbolType} 
                                onChange={e => handleStyleChange('currencySymbolType', e.target.value)}
                                className="text-xs p-1.5 border border-gray-200 rounded-lg font-bold focus:border-sap-primary focus:ring-2 focus:ring-sap-primary/10 transition-all bg-white"
                            >
                                <option value="icon">رمز (أيقونة)</option>
                                <option value="text">نص (ر.س)</option>
                                <option value="custom_image">صورة مخصصة</option>
                            </select>
                        </div>
                        
                        {currentScopeStyles.currencySymbolType === 'custom_image' && (
                            <div className="flex items-center justify-between mb-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                                <span className="text-[10px] font-bold text-gray-500">صورة العملة</span>
                                <div className="flex items-center gap-2">
                                    {currentScopeStyles.currencySymbolImage && <img src={currentScopeStyles.currencySymbolImage} className="w-8 h-8 object-contain border border-gray-200 rounded bg-white" />}
                                    <label className="cursor-pointer bg-white hover:bg-gray-50 px-3 py-1.5 rounded-md text-[10px] font-bold border border-gray-200 shadow-sm transition-all">
                                        رفع صورة
                                        <input type="file" className="hidden" onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) { const reader = new FileReader(); reader.onload = (re) => handleStyleChange('currencySymbolImage', re.target?.result as string); reader.readAsDataURL(file); }
                                        }} />
                                    </label>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center justify-between p-2 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors">
                                <span className="text-[10px] font-bold text-gray-600">العملة</span>
                                <div className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-200 shadow-sm">
                                    <input type="color" value={currentScopeStyles.currencyColor} onChange={e => handleStyleChange('currencyColor', e.target.value)} className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer p-0 border-0" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-2 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors">
                                <span className="text-[10px] font-bold text-gray-600">المنتج</span>
                                <div className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-200 shadow-sm">
                                    <input type="color" value={currentScopeStyles.nameColor} onChange={e => handleStyleChange('nameColor', e.target.value)} className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer p-0 border-0" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-2 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors">
                                <span className="text-[10px] font-bold text-gray-600">السعر</span>
                                <div className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-200 shadow-sm">
                                    <input type="color" value={currentScopeStyles.priceColor} onChange={e => handleStyleChange('priceColor', e.target.value)} className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer p-0 border-0" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-2 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors">
                                <span className="text-[10px] font-bold text-gray-600">الوحدة</span>
                                <div className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-200 shadow-sm">
                                    <input type="color" value={currentScopeStyles.unitColor} onChange={e => handleStyleChange('unitColor', e.target.value)} className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer p-0 border-0" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-2 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors col-span-2">
                                <span className="text-[10px] font-bold text-gray-600">خلفية السعر</span>
                                <div className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-200 shadow-sm">
                                    <input type="color" value={currentScopeStyles.backgroundColor} onChange={e => handleStyleChange('backgroundColor', e.target.value)} className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer p-0 border-0" />
                                </div>
                            </div>
                            {currentScopeStyles.template === 'big_impact' && (
                                <div className="flex items-center justify-between p-2 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors col-span-2">
                                    <span className="text-[10px] font-bold text-gray-600">خلفية الاسم</span>
                                    <div className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-200 shadow-sm">
                                        <input type="color" value={currentScopeStyles.nameBackgroundColor || currentScopeStyles.backgroundColor} onChange={e => handleStyleChange('nameBackgroundColor', e.target.value)} className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer p-0 border-0" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 5. Visibility */}
            <AccordionHeader title="إظهار / إخفاء" isOpen={openSections.visibility} onClick={() => toggleSection('visibility')} icon={Eye} />
            {openSections.visibility && (
                <div className="p-4 space-y-2 border-b border-gray-100 bg-white">
                    <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                        <div className="relative flex items-center">
                            <input type="checkbox" checked={currentScopeStyles.showLogo} onChange={e => handleStyleChange('showLogo', e.target.checked)} className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-gray-300 shadow-sm checked:border-sap-primary checked:bg-sap-primary focus:ring-2 focus:ring-sap-primary/20 transition-all" />
                            <CheckCircle2 size={10} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                        </div>
                        <span className="font-bold text-xs text-gray-700">إظهار الشعار</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                        <div className="relative flex items-center">
                            <input type="checkbox" checked={currentScopeStyles.showUnit} onChange={e => handleStyleChange('showUnit', e.target.checked)} className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-gray-300 shadow-sm checked:border-sap-primary checked:bg-sap-primary focus:ring-2 focus:ring-sap-primary/20 transition-all" />
                            <CheckCircle2 size={10} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                        </div>
                        <span className="font-bold text-xs text-gray-700">إظهار الوحدة</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                        <div className="relative flex items-center">
                            <input type="checkbox" checked={currentScopeStyles.showBorder} onChange={e => handleStyleChange('showBorder', e.target.checked)} className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-gray-300 shadow-sm checked:border-sap-primary checked:bg-sap-primary focus:ring-2 focus:ring-sap-primary/20 transition-all" />
                            <CheckCircle2 size={10} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                        </div>
                        <span className="font-bold text-xs text-gray-700">إطار الملصق</span>
                    </label>
                    <div className="border-t border-dashed border-gray-200 my-2"></div>
                    <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100">
                        <div className="relative flex items-center">
                            <input type="checkbox" checked={currentScopeStyles.showOriginalPrice} onChange={e => handleStyleChange('showOriginalPrice', e.target.checked)} className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-red-300 shadow-sm checked:border-red-500 checked:bg-red-500 focus:ring-2 focus:ring-red-500/20 transition-all" />
                            <CheckCircle2 size={10} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                        </div>
                        <span className="font-bold text-xs text-red-600">إظهار السعر السابق</span>
                    </label>
                </div>
            )}

            {/* 6. Actions */}
            <AccordionHeader title="إجراءات" isOpen={openSections.actions} onClick={() => toggleSection('actions')} icon={Layers} />
            {openSections.actions && (
                <div className="p-4 space-y-3 bg-white">
                    <button onClick={() => setShowProductPicker(true)} className="w-full py-2.5 bg-sap-primary text-white font-bold shadow-md shadow-sap-primary/20 hover:bg-sap-primary-hover hover:shadow-lg hover:shadow-sap-primary/30 flex items-center justify-center gap-2 rounded-xl transition-all transform active:scale-[0.98]">
                        <Plus size={18}/> إضافة منتج جديد
                    </button>
                    {activeTag && (
                        <div className="flex gap-3">
                            <button onClick={() => { setSelectedTags(prev => prev.filter(t => t.id !== activeTag.id)); setActiveTagId(null); }} className="flex-1 py-2.5 bg-white text-red-500 border border-red-200 hover:bg-red-50 hover:border-red-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm">
                                <Trash2 size={14} /> حذف
                            </button>
                            <button onClick={() => setActiveTagId(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 font-bold rounded-xl text-xs transition-all shadow-sm">
                                إلغاء التحديد
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
      </aside>

      {/* Main Canvas */}
      <main className="flex-1 flex flex-col overflow-hidden relative print:hidden">
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm relative">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                    <div className="bg-white shadow-sm border border-gray-100 p-1.5 rounded-md">
                        <LayoutGrid size={18} className="text-sap-primary"/>
                    </div>
                    <input type="text" value={listName} onChange={e => setListName(e.target.value)} className="bg-transparent border-none text-sm w-56 focus:ring-0 font-bold text-gray-700 placeholder-gray-400" placeholder="اسم المشروع..." />
                </div>
                
                <div className="h-8 w-px bg-gray-200 mx-2"></div>

                <div className="flex items-center gap-2">
                    <button onClick={handleSaveProject} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-all shadow-sm text-xs font-bold">
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16}/>}
                        <span>حفظ</span>
                    </button>
                    <button onClick={() => setShowSavedLists(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-all shadow-sm text-xs font-bold">
                        <FolderOpen size={16}/>
                        <span>فتح</span>
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 bg-white border border-gray-200 p-1 rounded-lg shadow-sm">
                    <button onClick={() => setGlobalStyles(s => ({...s, previewZoom: Math.max(20, s.previewZoom - 10)}))} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"><ZoomOut size={16}/></button>
                    <span className="text-xs font-black w-12 text-center font-mono text-gray-700">{globalStyles.previewZoom}%</span>
                    <button onClick={() => setGlobalStyles(s => ({...s, previewZoom: Math.min(200, s.previewZoom + 10)}))} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"><ZoomIn size={16}/></button>
                </div>
                
                <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-sap-primary text-white rounded-lg hover:bg-sap-primary-hover shadow-lg shadow-sap-primary/20 transition-all text-xs font-black tracking-wide">
                    <Printer size={18}/> 
                    <span>طباعة الملصقات</span>
                </button>
            </div>
        </div>

        <div className="flex-1 bg-slate-100 overflow-auto p-8 relative flex justify-center custom-scrollbar">
            <div 
              className="bg-white shadow-2xl transition-all ring-1 ring-black/5"
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
                          className={`relative overflow-hidden transition-all ${tag ? 'cursor-pointer hover:shadow-md' : ''} ${isActive ? 'ring-2 ring-sap-primary z-10 shadow-lg' : ''}`}
                          style={{ 
                              width: `${labelWidth}mm`, 
                              height: `${globalStyles.tagHeight}mm`, 
                              boxSizing: 'border-box', 
                              border: s.showBorder ? '1px solid #e5e7eb' : '1px dashed #e5e7eb', 
                              backgroundColor: tag ? s.backgroundColor : 'transparent' 
                          }}
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
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-10 backdrop-blur-sm transition-all">
              <div className="bg-white w-[500px] shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="bg-gray-900 text-white px-5 py-4 flex justify-between items-center text-sm font-black shadow-md">
                    <div className="flex items-center gap-2"><FolderOpen size={18}/> <span>فتح مشروع محفوظ</span></div>
                    <button onClick={() => setShowSavedLists(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X size={16}/></button>
                </div>
                <div className="p-0 overflow-y-auto custom-scrollbar bg-gray-50">
                    {savedLists.length === 0 ? <div className="p-12 text-center text-gray-400 italic flex flex-col items-center gap-2"><FolderOpen size={32} className="opacity-20"/>لا توجد مشاريع محفوظة</div> : (
                        <div className="divide-y divide-gray-100">
                            {savedLists.map(list => (
                                <div key={list.id} onClick={() => loadProject(list)} className="p-4 bg-white hover:bg-sap-highlight/5 cursor-pointer flex justify-between items-center group transition-all">
                                    <div>
                                        <div className="font-bold text-gray-800 text-sm group-hover:text-sap-primary transition-colors">{list.name}</div>
                                        <div className="text-xs text-gray-400 font-mono mt-1 flex items-center gap-1"><Clock size={10}/> {new Date(list.date).toLocaleDateString('ar-SA')}</div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); deleteProject(list.id); }} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
              </div>
          </div>
      )}
      {showProductPicker && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm transition-all">
             <div className="bg-white w-[600px] shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="bg-gray-900 text-white px-5 py-4 flex justify-between items-center text-sm font-black shadow-md shrink-0">
                    <div className="flex items-center gap-2"><Search size={18}/> <span>قاعدة البيانات: اختيار منتج</span></div>
                    <button onClick={() => setShowProductPicker(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X size={16}/></button>
                </div>
                
                <div className="p-4 bg-gray-50 border-b border-gray-200 shrink-0">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={handlePickerKeyDown} placeholder="بحث باسم المنتج أو الكود..." className="w-full pl-3 pr-9 py-2.5 border border-gray-300 text-sm focus:border-sap-primary focus:ring-1 focus:ring-sap-primary font-bold rounded-lg shadow-sm" autoFocus />
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                        </div>
                        <button onClick={() => addTag()} className="px-4 py-2 bg-white border border-gray-300 hover:border-sap-primary text-xs font-bold hover:bg-sap-highlight hover:text-sap-primary rounded-lg transition-all shadow-sm flex items-center gap-2">
                            <Plus size={16}/>
                            <span>إضافة يدوي</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto bg-white custom-scrollbar flex-1">
                    <table className="w-full text-xs text-right">
                        <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 w-24">الكود</th>
                                <th className="p-4">اسم المنتج</th>
                                <th className="p-4 w-24">الوحدة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredProducts.map((p, index) => (
                                <tr key={p.id} onClick={() => addTag(p)} className={`cursor-pointer transition-colors group ${pickerSelectedIndex === index + 1 ? 'bg-sap-primary text-white' : 'hover:bg-gray-50'}`}>
                                    <td className={`p-4 font-mono font-bold ${pickerSelectedIndex === index + 1 ? 'text-white' : 'text-sap-primary'}`}>{p.code}</td>
                                    <td className="p-4 font-bold text-sm">{p.name}</td>
                                    <td className={`p-4 ${pickerSelectedIndex === index + 1 ? 'text-white/80' : 'text-gray-400'}`}>{(units.find(u => u.id === p.unitId))?.name}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};
