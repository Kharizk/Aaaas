
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Product, Unit, OfferTag, OfferTemplate, SavedOfferList } from '../types';
import { db } from '../services/supabase';
import { useSystemSettings } from './SystemSettingsContext';
import { CurrencySymbolRenderer } from './CurrencySymbolRenderer';
import { Saudi95Logo } from './Saudi95Logo';
import { toPng } from 'html-to-image';
import { 
  Printer, Plus, Trash2, Search, ZoomIn, ZoomOut, X, Save, FolderOpen, 
  Layout, Tag as TagIcon, Settings2, Monitor, Sliders, Zap, Bomb, 
  Type as TypeIcon, ChevronDown, ChevronUp, Loader2, Scissors, 
  Paintbrush, Maximize, Smartphone, MoveHorizontal, Boxes, Palette, Clock, ArrowRight, Languages,
  Download, Copy, RefreshCw, Eye, EyeOff, Image as ImageIcon, Sparkles, Upload, Layers
} from 'lucide-react';

interface OfferGeneratorProps {
  products: Product[];
  units: Unit[];
}

type LabelsCount = 1 | 2 | 4 | 6 | 8 | 12 | 14 | 16 | 20 | 24;

const generateId = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const OfferGenerator: React.FC<OfferGeneratorProps> = ({ products, units }) => {
  const { settings } = useSystemSettings();
  const [selectedTags, setSelectedTags] = useState<OfferTag[]>([]);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [changingTagId, setChangingTagId] = useState<string | null>(null);
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

  const isLightColor = (hex?: string | null): boolean => {
    if (!hex) return true;
    const lower = hex.toLowerCase().trim();
    if (lower === '#ffffff' || lower === '#fff' || lower === 'white') return true;
    if (lower === '#f8faf8' || lower === '#fafafa' || lower === '#fdf8ee' || lower === '#f3f4f6' || lower === '#fcfcfa' || lower === '#f0fdf4') return true;
    const clean = lower.replace('#', '');
    if (clean.length === 6) {
        const r = parseInt(clean.substring(0, 2), 16);
        const g = parseInt(clean.substring(2, 4), 16);
        const b = parseInt(clean.substring(4, 6), 16);
        if (isNaN(r) || isNaN(g) || isNaN(b)) return true;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        return lum > 165;
    }
    return false;
  };

  const [globalBorderColor, setGlobalBorderColor] = useState('#000000');
  const [globalBorderWidth, setGlobalBorderWidth] = useState(1);

  const [openSections, setOpenSections] = useState({
      template: true, // NEW SECTION
      data: true,
      visibility: false,
      background: false,
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
        id: activeListId || generateId(), 
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

  const handleSaveAsCopy = async () => {
    if (!listName.trim()) { alert("يرجى تسمية المشروع"); return; }
    setIsSaving(true);
    try {
      const newId = generateId();
      const listData: SavedOfferList = { 
        id: newId, 
        name: `${listName.trim()} - نسخة`, 
        date: new Date().toISOString(), 
        tags: selectedTags, 
        styles: { labelsPerPage, logoUrl: null, logoSize: 50, orientation, showUnit, numberFormat } as any
      };
      await db.offerLists.upsert(listData);
      setActiveListId(newId);
      setListName(listData.name);
      fetchSavedLists();
      alert("تم حفظ نسخة جديدة بنجاح");
    } catch (e) { alert("فشل الحفظ"); }
    finally { setIsSaving(false); }
  };

  const handleDuplicateProject = async (list: SavedOfferList, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSaving(true);
    try {
      const duplicatedList: SavedOfferList = {
        ...list,
        id: generateId(),
        name: `${list.name} - نسخة`,
        date: new Date().toISOString()
      };
      await db.offerLists.upsert(duplicatedList);
      fetchSavedLists();
      alert("تم نسخ المشروع بنجاح");
    } catch (err) {
      alert("فشل نسخ المشروع");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('هل أنت متأكد من حذف هذا المشروع؟')) return;
    try {
      await db.offerLists.delete(id);
      if (activeListId === id) {
        setActiveListId(null);
        setListName('عرض ترويجي جديد');
        setSelectedTags([]);
        setActiveTagId(null);
      }
      fetchSavedLists();
    } catch (err) {
      alert("فشل حذف المشروع");
    }
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
    if (labelsPerPage === 1) {
        columns = 1;
    } else if (orientation === 'landscape') {
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

  const handleProductSelect = (product?: Product) => {
    let unitName = '';
    if (product && product.unitId) {
        const u = units.find(unit => unit.id === product.unitId);
        if (u) unitName = u.name;
    }

    if (changingTagId) {
      updateTag(changingTagId, {
        productId: product?.code || '',
        name: product?.name || 'صنف جديد',
        originalPrice: product?.price || '0.00',
        offerPrice: product?.price || '0.00',
        offerQuantity: '1',
        // @ts-ignore
        unitName: unitName || 'حبة'
      });
      setChangingTagId(null);
      setShowProductPicker(false);
      setSearchTerm('');
      return;
    }

    if (selectedTags.length >= labelsPerPage) { 
      alert(`الحد الأقصى للملصقات حالياً هو (${labelsPerPage}).`); 
      return; 
    }

    const newTag: OfferTag = {
      id: generateId(),
      productId: product?.code || '',
      name: product?.name || 'صنف جديد',
      originalPrice: product?.price || '0.00',
      offerPrice: product?.price || '0.00',
      showCartonPrice: true,
      template: 'mega_sale_50',
      discountText: 'خصم 10%', // Updated default to be specific
      topBannerText: 'العروض معك تفرق',
      showLogo: true,
      hideOriginalPrice: false,
      customCurrencyImage: null,
      customBackgroundImage: null,
      bgOpacity: 100,
      bgOverlayDarkness: 25,
      customLogoImage: null,
      visibility: {
        showLogo: true,
        showTopBanner: true,
        showProductName: true,
        showBarcode: true,
        showOfferPrice: true,
        showPriceBox: true,
        showOriginalPrice: true,
        showCartonPrice: true,
        showUnit: true,
        showDiscountBadge: true,
        showCurrency: true,
        showTaxText: true,
        showFooter: true,
      },
      offerQuantity: '1',
      // @ts-ignore
      unitName: unitName || 'حبة', 
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
        // @ts-ignore
        taxFontSize: 12,
        // @ts-ignore
        currencySize: 32,
        background: product?.color || '#ffffff'
      }
    };
    setSelectedTags([...selectedTags, newTag]);
    setActiveTagId(newTag.id);
    setShowProductPicker(false);
    setSearchTerm('');
  };

  const handleRemove = (id: string) => {
    setSelectedTags(prev => prev.filter(tag => tag.id !== id));
    if (activeTagId === id) setActiveTagId(null);
  };

  const handleDuplicate = (tag: OfferTag) => {
    if (selectedTags.length >= labelsPerPage) {
      alert(`الحد الأقصى للملصقات حالياً هو (${labelsPerPage}).`);
      return;
    }
    const newTag = { ...tag, id: generateId() };
    setSelectedTags([...selectedTags, newTag]);
    setActiveTagId(newTag.id);
  };

  const handleSaveImage = async (id: string) => {
    const node = document.getElementById(`offer-preview-${id}`);
    if (node) {
      try {
        const dataUrl = await toPng(node, { quality: 1, pixelRatio: 3, skipFonts: true });
        const link = document.createElement('a');
        link.download = `offer-${id}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Failed to save image', err);
        alert('حدث خطأ أثناء حفظ الصورة');
      }
    }
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
    // @ts-ignore
    const taxFontSize = tag.customColors?.taxFontSize || 12;
    // @ts-ignore
    const currencySize = tag.customColors?.currencySize || 32;
    const bgColor = tag.customColors?.background || '#ffffff';

    const currencyType = tag.customCurrencyImage ? 'custom_image' : settings.currencySymbolType;
    const currencyImage = tag.customCurrencyImage || settings.currencySymbolImage;

    const unitText = showUnit ? `${tag.offerQuantity ? formatNum(tag.offerQuantity) + ' ' : ''}${tag.unitName || ''}`.trim() : '';
    
    const displayOfferPrice = formatNum(tag.offerPrice);
    const displayOriginalPrice = formatNum(tag.originalPrice);
    const displayCartonPrice = tag.showCartonPrice !== false && tag.cartonPrice ? formatNum(tag.cartonPrice) : null;
    const defaultDec = numberFormat === 'ar' ? '٠٠' : '00';

    const [priceMain, priceDec] = displayOfferPrice.includes('.') ? displayOfferPrice.split('.') : [displayOfferPrice, defaultDec];

    // --- DESIGN 2: MODERN CLEAN (YELLOW/INDUSTRIAL) ---
    if (tag.template === 'modern_clean') {
        return (
            <div 
                className={`w-full h-full flex flex-col relative overflow-hidden ${showCuttingBorders ? 'border-dashed' : ''}`} 
                dir="rtl"
                style={{ 
                    backgroundColor: bgColor,
                    border: `${globalBorderWidth}px solid ${globalBorderColor}`,
                    borderStyle: showCuttingBorders ? 'dashed' : 'solid'
                }}
            >
                {/* Yellow Header for Discount Text */}
                <div className="bg-[#FFD700] text-black w-full py-2 flex items-center justify-center border-b-[3px] border-black relative z-10 shrink-0" style={{ minHeight: '65px' }}>
                    <span className="font-black uppercase tracking-widest text-center leading-none" style={{ fontSize: `${discFontSize}px` }}>
                        {formatNum(tag.discountText)}
                    </span>
                </div>

                {/* Body */}
                <div className="flex-1 flex flex-col p-4 relative z-10">
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <h2 className="font-black leading-tight text-black w-full" style={{ fontSize: `${nFontSize}px` }}>
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
                             {tag.originalPrice && tag.originalPrice !== '0.00' && !tag.hideOriginalPrice && (
                                 <div className="flex flex-col items-start mb-1">
                                     <span className="text-[9px] font-black text-black bg-[#FFD700] px-1 mb-0.5">كان سابقاً</span>
                                     <span 
                                         className="font-black line-through decoration-red-600 decoration-[3px] font-mono text-gray-400" 
                                         style={{ fontSize: `${origFontSize}px` }}
                                     >
                                         {displayOriginalPrice}
                                     </span>
                                 </div>
                             )}
                             {displayCartonPrice && (
                                 <div className="flex flex-col items-start">
                                     <span className="text-[9px] font-black text-black bg-gray-200 px-1 mb-0.5">سعر الكرتون</span>
                                     <span className="font-black text-black" style={{ fontSize: `${tag.customColors?.cartonPriceFontSize || origFontSize * 1.2}px` }}>{displayCartonPrice}</span>
                                 </div>
                             )}
                        </div>
                        <div className="flex flex-col items-end">
                            {displayCartonPrice && <span className="text-[10px] font-black text-black mb-1">سعر الحبة</span>}
                            <div className="flex items-baseline flex-nowrap shrink-0" dir="ltr">
                                <CurrencySymbolRenderer type={currencyType} imageUrl={currencyImage} color="black" className="shrink-0 mr-1" style={{ width: `${currencySize}px`, height: `${currencySize}px` }} />
                                <span className="font-black tracking-tighter text-black shrink-0" style={{ fontSize: `${pFontSize}px` }}>{priceMain}</span>
                                <div className="flex flex-col items-start ml-1 leading-none shrink-0">
                                    <span className="font-black text-black" style={{ fontSize: `${dFontSize}px` }}>.{priceDec}</span>
                                </div>
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

    // --- DESIGN 3: YELLOW RED BANNER ---
    if (tag.template === 'yellow_red_banner') {
        return (
            <div 
                className={`w-full h-full flex flex-col relative overflow-hidden ${showCuttingBorders ? 'border-dashed' : ''}`} 
                dir="rtl"
                style={{ 
                    backgroundColor: '#FFEA00', // Yellow background
                    border: `${globalBorderWidth}px solid ${globalBorderColor}`,
                    borderStyle: showCuttingBorders ? 'dashed' : 'solid'
                }}
            >
                {/* Top Banner */}
                <div className="bg-[#B22222] text-white w-full py-1 flex flex-col items-center justify-center border-b-[3px] border-[#B22222] relative z-10 shrink-0" style={{ minHeight: '85px' }}>
                    <span className="font-black tracking-widest text-center leading-none" style={{ fontSize: `${discFontSize * 1.2}px`, color: '#FFEA00' }}>
                        {tag.topBannerText || 'العروض معك تفرق'}
                    </span>
                    <span className="font-bold tracking-widest text-center leading-none mt-1" style={{ fontSize: `${discFontSize * 0.6}px`, color: '#FFEA00' }}>
                        {tag.discountText || 'عرض خاص PROMOTION'}
                    </span>
                </div>

                {/* Body */}
                <div className="flex-1 flex flex-col p-4 relative z-10 justify-between">
                    {/* Top Section: Unit (Right) & Regular Price (Left) */}
                    <div className="flex justify-between items-start w-full mb-2">
                        {/* Right: Unit & Quantity */}
                        <div className="flex flex-col items-start">
                            {unitText && (
                                <div className="bg-[#B22222] text-white px-4 py-2 rounded-lg font-black shadow-sm" style={{ fontSize: `${dFontSize * 0.5}px` }}>
                                    {unitText}
                                </div>
                            )}
                            {displayCartonPrice && (
                                <div className="mt-2 border-2 border-[#B22222] rounded-lg px-3 py-1 flex flex-col items-center bg-white">
                                    <span className="text-[#5C2C16] font-bold text-[10px] leading-none mb-1">سعر الكرتون</span>
                                    <span className="font-black text-[#5C2C16]" style={{ fontSize: `${tag.customColors?.cartonPriceFontSize || origFontSize}px` }}>{displayCartonPrice}</span>
                                </div>
                            )}
                        </div>

                        {/* Left: Regular Price */}
                        <div className="flex flex-col items-end">
                            {!tag.hideOriginalPrice && tag.originalPrice && tag.originalPrice !== '0.00' && (
                                <div className="border-2 border-[#B22222] rounded-lg px-3 py-1 flex flex-col items-center">
                                    <span className="text-[#5C2C16] font-bold text-[10px] leading-none mb-1">السعر العادي Regular Price</span>
                                    <div className="relative inline-block">
                                        <span className="font-black text-[#5C2C16] line-through decoration-2 decoration-[#B22222]" style={{ fontSize: `${origFontSize}px` }}>
                                            {formatNum(tag.originalPrice)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Center: Large Price */}
                    <div className="flex-1 flex flex-col items-center justify-center">
                        {displayCartonPrice && <span className="font-bold text-[#5C2C16] text-[12px] mb-1">سعر الحبة</span>}
                        <div className="flex items-center gap-2 flex-nowrap shrink-0 text-[#5C2C16]" dir="ltr">
                            <CurrencySymbolRenderer type={currencyType} imageUrl={currencyImage} color="#5C2C16" className="shrink-0" style={{ width: `${currencySize}px`, height: `${currencySize}px` }} />
                            <div className="flex items-baseline gap-1">
                                <span className="font-black shrink-0" style={{ fontSize: `${pFontSize * 1.5}px`, lineHeight: 0.8 }}>
                                    {formatNum(priceMain)}
                                </span>
                                <div className="flex flex-col items-start justify-end h-full">
                                    <span className="font-black shrink-0" style={{ fontSize: `${dFontSize * 1.5}px`, lineHeight: 0.8 }}>
                                        {formatNum(priceDec)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <span className="font-bold shrink-0 mt-2 opacity-80 text-[#5C2C16]" style={{ fontSize: `${taxFontSize}px` }}>
                            السعر شامل الضريبة
                        </span>
                    </div>

                    {/* Bottom: Product Name */}
                    <div className="w-full text-center mt-2">
                        <h2 className="font-black leading-tight text-[#5C2C16] w-full" style={{ fontSize: `${nFontSize}px`, wordBreak: 'break-word' }}>
                            {tag.name}
                        </h2>
                        {tag.productId && (
                            <div className="text-left w-full mt-1">
                                <span className="text-[#5C2C16] text-[8px] font-mono font-bold tracking-widest">{formatNum(tag.productId)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // --- DESIGN 4: BLACK & WHITE BANNER ---
    if (tag.template === 'bw_banner') {
        return (
            <div 
                className={`w-full h-full flex flex-col relative overflow-hidden ${showCuttingBorders ? 'border-dashed' : ''}`} 
                dir="rtl"
                style={{ 
                    backgroundColor: '#FFFFFF', // White background
                    border: `${globalBorderWidth}px solid ${globalBorderColor}`,
                    borderStyle: showCuttingBorders ? 'dashed' : 'solid'
                }}
            >
                {/* Top Banner */}
                <div className="bg-black text-white w-full py-1 flex flex-col items-center justify-center border-b-[3px] border-black relative z-10 shrink-0" style={{ minHeight: '85px' }}>
                    <span className="font-black tracking-widest text-center leading-none" style={{ fontSize: `${discFontSize * 1.2}px`, color: '#FFFFFF' }}>
                        {tag.topBannerText || 'العروض معك تفرق'}
                    </span>
                    <span className="font-bold tracking-widest text-center leading-none mt-1" style={{ fontSize: `${discFontSize * 0.6}px`, color: '#FFFFFF' }}>
                        {tag.discountText || 'عرض خاص PROMOTION'}
                    </span>
                </div>

                {/* Body */}
                <div className="flex-1 flex flex-col p-4 relative z-10 justify-between">
                    {/* Top Section: Unit (Right) & Regular Price (Left) */}
                    <div className="flex justify-between items-start w-full mb-2">
                        {/* Right: Unit & Quantity */}
                        <div className="flex flex-col items-start">
                            {unitText && (
                                <div className="bg-black text-white px-4 py-2 rounded-lg font-black shadow-sm" style={{ fontSize: `${dFontSize * 0.5}px` }}>
                                    {unitText}
                                </div>
                            )}
                            {displayCartonPrice && (
                                <div className="mt-2 border-2 border-black rounded-lg px-3 py-1 flex flex-col items-center bg-white">
                                    <span className="text-black font-bold text-[10px] leading-none mb-1">سعر الكرتون</span>
                                    <span className="font-black text-black" style={{ fontSize: `${tag.customColors?.cartonPriceFontSize || origFontSize}px` }}>{displayCartonPrice}</span>
                                </div>
                            )}
                        </div>

                        {/* Left: Regular Price */}
                        <div className="flex flex-col items-end">
                            {!tag.hideOriginalPrice && tag.originalPrice && tag.originalPrice !== '0.00' && (
                                <div className="border-2 border-black rounded-lg px-3 py-1 flex flex-col items-center">
                                    <span className="text-black font-bold text-[10px] leading-none mb-1">السعر العادي Regular Price</span>
                                    <div className="relative inline-block">
                                        <span className="font-black text-black line-through decoration-2 decoration-black" style={{ fontSize: `${origFontSize}px` }}>
                                            {formatNum(tag.originalPrice)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Center: Large Price */}
                    <div className="flex-1 flex flex-col items-center justify-center">
                        {displayCartonPrice && <span className="font-bold text-black text-[12px] mb-1">سعر الحبة</span>}
                        <div className="flex items-center gap-2 flex-nowrap shrink-0 text-black" dir="ltr">
                            <CurrencySymbolRenderer type={currencyType} imageUrl={currencyImage} color="black" className="shrink-0" style={{ width: `${currencySize}px`, height: `${currencySize}px` }} />
                            <div className="flex items-baseline gap-1">
                                <span className="font-black shrink-0" style={{ fontSize: `${pFontSize * 1.5}px`, lineHeight: 0.8 }}>
                                    {formatNum(priceMain)}
                                </span>
                                <div className="flex flex-col items-start justify-end h-full">
                                    <span className="font-black shrink-0" style={{ fontSize: `${dFontSize * 1.5}px`, lineHeight: 0.8 }}>
                                        {formatNum(priceDec)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <span className="font-bold shrink-0 mt-2 opacity-80 text-black" style={{ fontSize: `${taxFontSize}px` }}>
                            السعر شامل الضريبة
                        </span>
                    </div>

                    {/* Bottom: Product Name */}
                    <div className="w-full text-center mt-2">
                        <h2 className="font-black leading-tight text-black w-full" style={{ fontSize: `${nFontSize}px`, wordBreak: 'break-word' }}>
                            {tag.name}
                        </h2>
                        {tag.productId && (
                            <div className="text-left w-full mt-1">
                                <span className="text-black text-[8px] font-mono font-bold tracking-widest">{formatNum(tag.productId)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // --- DESIGN 5: SAUDI FIRE OFFER ---
    if (tag.template === 'saudi_fire_offer') {
        return (
            <div 
                className={`w-full h-full flex flex-col relative overflow-hidden ${showCuttingBorders ? 'border-dashed' : ''}`} 
                dir="rtl"
                style={{ 
                    backgroundColor: '#FFFFFF',
                    border: `${globalBorderWidth}px solid ${globalBorderColor}`,
                    borderStyle: showCuttingBorders ? 'dashed' : 'solid'
                }}
            >
                {/* Black Premium Header with Flame Icons */}
                <div className="bg-[#111111] text-white w-full py-3 px-4 flex flex-col items-center justify-center border-b-[4px] border-[#FFD700] relative z-10 shrink-0" style={{ minHeight: '90px' }}>
                    <div className="flex items-center gap-2 justify-center">
                        <span className="text-lg md:text-xl animate-pulse">🔥</span>
                        <span className="font-black text-center leading-none tracking-wide text-white" style={{ fontSize: `${discFontSize * 1.1}px` }}>
                            {tag.topBannerText || 'عرض خاص'}
                        </span>
                        <span className="text-lg md:text-xl animate-pulse">🔥</span>
                    </div>
                    <span className="font-black tracking-widest text-center leading-none mt-1.5 text-[#FFD700]" style={{ fontSize: `${discFontSize * 0.65}px` }}>
                        {tag.discountText || 'SPECIAL OFFER'}
                    </span>
                </div>

                {/* Body Content */}
                <div className="flex-1 flex flex-col p-4 relative z-10 justify-between items-center bg-white">
                    {/* Saudi Flag / Ribbon Badge */}
                    <div className="absolute top-0 left-3 bg-[#006C35] text-white px-2.5 py-1.5 rounded-b-md text-[9px] font-black z-20 shadow-sm flex items-center gap-1">
                        <span>🇸🇦</span>
                        <span className="tracking-tighter">المملكة</span>
                    </div>

                    {/* Product Name (Explicit User Request) */}
                    <div className="w-full text-center mt-2 px-2 shrink-0">
                        <h2 className="font-black text-slate-900 leading-tight tracking-tight line-clamp-2" style={{ fontSize: `${nFontSize}px` }}>
                            {tag.name}
                        </h2>
                        {tag.productId && (
                            <span className="text-gray-400 text-[10px] font-mono font-bold tracking-widest block mt-0.5">CODE: {formatNum(tag.productId)}</span>
                        )}
                    </div>

                    {/* Prices Area */}
                    <div className="flex-1 flex flex-col items-center justify-center my-auto py-2">
                        {/* Original Price (Crossed out) */}
                        {tag.originalPrice && tag.originalPrice !== '0.00' && !tag.hideOriginalPrice && (
                            <div className="relative inline-flex items-center gap-1.5 mb-3">
                                <span className="text-gray-400 font-black font-mono leading-none" style={{ fontSize: `${origFontSize * 1.3}px` }}>
                                    {displayOriginalPrice}
                                </span>
                                <CurrencySymbolRenderer 
                                    type={currencyType} 
                                    imageUrl={currencyImage} 
                                    color="#94a3b8" 
                                    className="shrink-0" 
                                    style={{ width: `${currencySize * 0.7}px`, height: `${currencySize * 0.7}px` }} 
                                />
                                <div className="absolute inset-x-[-12px] h-[3.5px] bg-red-600 rounded-full transform -rotate-12 pointer-events-none shadow-sm"></div>
                            </div>
                        )}

                        {/* Large Special Price */}
                        <div className="flex flex-col items-center justify-center">
                            <div className="flex items-center gap-2 flex-nowrap shrink-0 text-slate-950" dir="ltr">
                                <CurrencySymbolRenderer 
                                    type={currencyType} 
                                    imageUrl={currencyImage} 
                                    color="#006C35" 
                                    className="shrink-0" 
                                    style={{ width: `${currencySize * 1.3}px`, height: `${currencySize * 1.3}px` }} 
                                />
                                <div className="flex items-baseline gap-1">
                                    <span className="font-black tracking-tighter shrink-0" style={{ fontSize: `${pFontSize * 1.8}px`, lineHeight: 0.8 }}>
                                        {priceMain}
                                    </span>
                                    {priceDec && priceDec !== '00' && priceDec !== '٠٠' && (
                                        <div className="flex flex-col items-start justify-end h-full">
                                            <span className="font-black shrink-0 text-slate-900" style={{ fontSize: `${dFontSize * 1.5}px`, lineHeight: 0.8 }}>
                                                .{priceDec}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="text-slate-500 font-bold text-[10px] text-center tracking-wider leading-none mt-3">
                                ريال سعودي
                            </div>
                        </div>
                    </div>

                    {/* Unit / Packing Details */}
                    {unitText && (
                        <div className="text-slate-800 font-black text-center pb-5 z-10 leading-none" style={{ fontSize: `${dFontSize * 0.7}px` }}>
                            {unitText}
                        </div>
                    )}
                </div>

                {/* Curved Saudi Green Wave Bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-10 overflow-hidden pointer-events-none">
                    <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="w-full h-full text-[#006C35] fill-current">
                        <path d="M0 10 C 30 3, 70 3, 100 10 Z" />
                    </svg>
                </div>
            </div>
        );
    }

    // --- DESIGN 6: SAUDI NATIONAL DAY (اليوم الوطني السعودي) ---
    if (tag.template === 'saudi_national_day') {
        return (
            <div 
                className={`w-full h-full flex flex-col relative overflow-hidden ${showCuttingBorders ? 'border-dashed' : ''}`} 
                dir="rtl"
                style={{ 
                    backgroundColor: '#FFFFFF',
                    border: `${globalBorderWidth}px solid ${globalBorderColor}`,
                    borderStyle: showCuttingBorders ? 'dashed' : 'solid'
                }}
            >
                {/* Background Subtle Saudi Pattern & Watermark */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#006C35 2px, transparent 0)', backgroundSize: '16px 16px' }}></div>
                
                {/* Luxurious Saudi National Day Header */}
                <div className="bg-gradient-to-r from-[#004d25] via-[#006C35] to-[#004d25] text-white w-full py-2.5 px-3 flex flex-col items-center justify-center border-b-[3.5px] border-[#D4AF37] relative z-10 shrink-0 shadow-md" style={{ minHeight: '94px' }}>
                    {/* Golden decorative accent lines */}
                    <div className="absolute top-1 left-2 right-2 flex items-center justify-between pointer-events-none opacity-80">
                        <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-[#F5D061]"></div>
                        <div className="flex items-center gap-1 text-[#F5D061] text-[9px] font-bold">
                            <span>✦</span>
                            <span>دام عزك يا وطن</span>
                            <span>✦</span>
                        </div>
                        <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-[#F5D061]"></div>
                    </div>

                    {/* Top Main Title */}
                    <div className="flex items-center gap-2 justify-center mt-1">
                        <span className="text-[#F5D061] text-sm">🇸🇦</span>
                        <span className="font-black text-center leading-none tracking-wide text-white drop-shadow-sm" style={{ fontSize: `${discFontSize * 1.15}px` }}>
                            {tag.topBannerText || 'عروض اليوم الوطني'}
                        </span>
                        <span className="text-[#F5D061] text-sm">🇸🇦</span>
                    </div>

                    {/* Sub-banner ribbon with gold styling */}
                    <div className="flex items-center justify-center gap-2 mt-1.5 px-3 py-0.5 rounded-full bg-black/25 border border-[#F5D061]/50 backdrop-blur-xs">
                        <span className="font-black tracking-wider text-center leading-none text-[#F5D061]" style={{ fontSize: `${discFontSize * 0.62}px` }}>
                            {tag.discountText || 'نحلم ونحقق • عروض خاصة'}
                        </span>
                    </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 flex flex-col p-3.5 relative z-10 justify-between items-center bg-white">
                    {/* Saudi National Emblem Badge (Top Left Corner) */}
                    <div className="absolute top-0 left-3 bg-gradient-to-b from-[#006C35] to-[#004d25] text-[#F5D061] px-2 py-1.5 rounded-b-lg text-[9px] font-black z-20 shadow-md border-x border-b border-[#D4AF37]/50 flex items-center gap-1">
                        <span className="text-white text-xs">🌴</span>
                        <span className="text-[10px] font-extrabold tracking-tight">اليوم الوطني</span>
                    </div>

                    {/* Top Section: Unit (Right) & Regular Price (Left) */}
                    <div className="flex justify-between items-start w-full px-1 mb-1">
                        {/* Right: Unit & Quantity */}
                        <div className="flex flex-col items-start">
                            {unitText && (
                                <div className="bg-[#EBF7EE] text-[#006C35] border border-[#006C35]/30 px-3 py-1 rounded-md font-black shadow-xs flex items-center gap-1" style={{ fontSize: `${dFontSize * 0.52}px` }}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#006C35]"></span>
                                    {unitText}
                                </div>
                            )}
                            {displayCartonPrice && (
                                <div className="mt-1.5 border border-[#D4AF37] bg-amber-50/70 rounded-md px-2.5 py-0.5 flex flex-col items-center shadow-xs">
                                    <span className="text-[#854d0e] font-bold text-[9px] leading-none mb-0.5">سعر الكرتون</span>
                                    <span className="font-black text-[#006C35]" style={{ fontSize: `${tag.customColors?.cartonPriceFontSize || origFontSize}px` }}>
                                        {displayCartonPrice}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Left: Original Regular Price */}
                        <div className="flex flex-col items-end">
                            {!tag.hideOriginalPrice && tag.originalPrice && tag.originalPrice !== '0.00' && (
                                <div className="border border-gray-200 bg-gray-50/90 rounded-md px-2.5 py-0.5 flex flex-col items-center">
                                    <span className="text-gray-500 font-bold text-[9px] leading-none mb-0.5">السعر السابق</span>
                                    <div className="relative inline-flex items-center gap-1">
                                        <span className="font-black text-gray-400 line-through decoration-red-600 decoration-[2.5px] font-mono" style={{ fontSize: `${origFontSize}px` }}>
                                            {displayOriginalPrice}
                                        </span>
                                        <CurrencySymbolRenderer 
                                            type={currencyType} 
                                            imageUrl={currencyImage} 
                                            color="#9ca3af" 
                                            className="shrink-0" 
                                            style={{ width: `${currencySize * 0.55}px`, height: `${currencySize * 0.55}px` }} 
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Center: Hero National Offer Price */}
                    <div className="flex-1 flex flex-col items-center justify-center my-auto py-1">
                        {displayCartonPrice && <span className="font-extrabold text-[#006C35] text-[11px] mb-0.5">سعر الحبة بالعرض</span>}
                        <div className="flex items-center gap-2 flex-nowrap shrink-0 text-[#006C35]" dir="ltr">
                            <CurrencySymbolRenderer 
                                type={currencyType} 
                                imageUrl={currencyImage} 
                                color="#006C35" 
                                className="shrink-0 drop-shadow-xs" 
                                style={{ width: `${currencySize * 1.3}px`, height: `${currencySize * 1.3}px` }} 
                            />
                            <div className="flex items-baseline gap-1">
                                <span className="font-black tracking-tighter shrink-0 text-[#006C35] drop-shadow-xs" style={{ fontSize: `${pFontSize * 1.7}px`, lineHeight: 0.85 }}>
                                    {priceMain}
                                </span>
                                {priceDec && priceDec !== '00' && priceDec !== '٠٠' && (
                                    <div className="flex flex-col items-start justify-end h-full">
                                        <span className="font-black shrink-0 text-[#D4AF37]" style={{ fontSize: `${dFontSize * 1.4}px`, lineHeight: 0.85 }}>
                                            .{priceDec}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="h-[1px] w-6 bg-[#006C35]/30"></span>
                            <span className="font-extrabold text-[#006C35] shrink-0" style={{ fontSize: `${taxFontSize * 0.95}px` }}>
                                ريال سعودي شامل الضريبة
                            </span>
                            <span className="h-[1px] w-6 bg-[#006C35]/30"></span>
                        </div>
                    </div>

                    {/* Bottom: Product Name (prominent and distinct) */}
                    <div className="w-full text-center mt-1 px-2 z-10">
                        <h2 className="font-black text-slate-900 leading-tight tracking-tight line-clamp-2" style={{ fontSize: `${nFontSize}px`, wordBreak: 'break-word' }}>
                            {tag.name}
                        </h2>
                        {tag.productId && (
                            <div className="text-center w-full mt-1">
                                <span className="text-gray-400 text-[8.5px] font-mono font-bold tracking-widest bg-gray-100 px-2 py-0.5 rounded">
                                    CODE: {formatNum(tag.productId)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Luxurious Border Ribbon in Green & Gold */}
                <div className="w-full bg-[#006C35] h-3.5 relative overflow-hidden flex items-center justify-between px-3 shrink-0 border-t border-[#D4AF37]">
                    <span className="text-[8px] font-bold text-[#F5D061] tracking-widest">همة حتى القمة</span>
                    <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#F5D061]"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#F5D061]"></span>
                    </div>
                    <span className="text-[8px] font-bold text-white tracking-widest">94 عاماً من المجد</span>
                </div>
            </div>
        );
    }

    // --- DESIGN 7: SAUDI ROYAL CREST & SADU VECTOR (اليوم الوطني - الشعار الملكي والسدو) ---
    if (tag.template === 'saudi_royal_crest') {
        return (
            <div 
                className={`w-full h-full flex flex-col relative overflow-hidden ${showCuttingBorders ? 'border-dashed' : ''}`} 
                dir="rtl"
                style={{ 
                    backgroundColor: '#FCFCFA',
                    border: `${globalBorderWidth}px solid ${globalBorderColor}`,
                    borderStyle: showCuttingBorders ? 'dashed' : 'solid'
                }}
            >
                {/* SVG Vector Definitions for Gradients & Crest */}
                <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true" focusable="false">
                    <defs>
                        <linearGradient id="goldMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#FFF2B2" />
                            <stop offset="25%" stopColor="#E5C158" />
                            <stop offset="50%" stopColor="#AA7C11" />
                            <stop offset="75%" stopColor="#F5D77F" />
                            <stop offset="100%" stopColor="#8A630A" />
                        </linearGradient>
                        <linearGradient id="royalGreenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#083D20" />
                            <stop offset="50%" stopColor="#0B572E" />
                            <stop offset="100%" stopColor="#042614" />
                        </linearGradient>
                        <pattern id="saduPattern" width="24" height="12" patternUnits="userSpaceOnUse">
                            <polygon points="12,0 24,6 12,12 0,6" fill="#D4AF37" opacity="0.4" />
                            <polygon points="12,2 20,6 12,10 4,6" fill="#0B572E" />
                            <circle cx="12" cy="6" r="1.5" fill="#FFF2B2" />
                        </pattern>
                    </defs>
                </svg>

                {/* Royal Arched Header with Handcrafted SVG Crest & Medallion */}
                <div className="w-full relative z-10 shrink-0 bg-gradient-to-b from-[#05321A] via-[#0B572E] to-[#084223] text-white pt-2.5 pb-3 px-3 shadow-lg border-b-2 border-[#D4AF37]/80 flex flex-col items-center justify-between" style={{ minHeight: '102px' }}>
                    {/* Top Vector Sadu Geometric Bar */}
                    <div className="w-full h-1.5 mb-1.5 opacity-90 rounded-full overflow-hidden" style={{ background: 'repeating-linear-gradient(45deg, #D4AF37, #D4AF37 4px, #05321A 4px, #05321A 8px, #F5D77F 8px, #F5D77F 12px)' }}></div>

                    {/* Top Row: Crest + Royal Typography + 94 Seal */}
                    <div className="w-full flex items-center justify-between gap-2 px-1">
                        {/* Right: Golden Palms & Swords SVG Vector */}
                        <div className="flex items-center gap-1.5">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-b from-[#052915] to-[#0E6838] border border-[#D4AF37] p-1 flex items-center justify-center shadow-inner shrink-0">
                                <svg viewBox="0 0 100 100" className="w-8 h-8" fill="none">
                                    {/* Palm Fronds */}
                                    <path d="M50 14 C50 14 53 23 50 35 C47 23 50 14 50 14 Z" fill="url(#goldMetallic)" />
                                    <path d="M50 20 C54 18 64 22 66 32 C58 29 52 26 50 20 Z" fill="url(#goldMetallic)" />
                                    <path d="M50 20 C46 18 36 22 34 32 C42 29 48 26 50 20 Z" fill="url(#goldMetallic)" />
                                    <path d="M50 24 C57 26 68 33 66 45 C60 38 54 33 50 24 Z" fill="url(#goldMetallic)" />
                                    <path d="M50 24 C43 26 32 33 34 45 C40 38 46 33 50 24 Z" fill="url(#goldMetallic)" />
                                    {/* Palm Trunk */}
                                    <path d="M48 35 L52 35 L53 58 L47 58 Z" fill="url(#goldMetallic)" />
                                    {/* Crossed Curved Swords */}
                                    <path d="M26 65 Q48 54 74 72 Q70 65 48 50 Q30 55 26 65 Z" fill="url(#goldMetallic)" />
                                    <path d="M74 65 Q52 54 26 72 Q30 65 52 50 Q70 55 74 65 Z" fill="url(#goldMetallic)" />
                                    {/* Sword Hilts */}
                                    <circle cx="28" cy="69" r="3" fill="#FFF2B2" />
                                    <circle cx="72" cy="69" r="3" fill="#FFF2B2" />
                                </svg>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-[10px] font-black tracking-widest text-[#F5D77F] leading-none">المملكة العربية السعودية</span>
                                <span className="text-[8px] font-bold text-emerald-100 opacity-90 leading-tight mt-0.5">عز وفخر وتاريخ</span>
                            </div>
                        </div>

                        {/* Left: 94 Golden Medallion Badge */}
                        <div className="relative shrink-0 flex items-center justify-center">
                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#AA7C11] via-[#F5D77F] to-[#6A4E08] p-[1.5px] shadow-md">
                                <div className="w-full h-full rounded-full bg-[#06331B] flex flex-col items-center justify-center text-center p-0.5 border border-[#FFF2B2]/40">
                                    <span className="text-[12px] font-black text-[#F5D77F] leading-none tracking-tighter drop-shadow-sm font-mono">94</span>
                                    <span className="text-[6.5px] font-black text-white leading-none tracking-tight mt-0.5">عاماً</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Arched Center Banner Ribbon with Gold Filigree */}
                    <div className="w-full mt-2 relative flex items-center justify-center">
                        <div className="w-full bg-gradient-to-r from-transparent via-[#F5D77F]/20 to-transparent absolute h-[1px] top-1/2 -translate-y-1/2"></div>
                        <div className="bg-gradient-to-r from-[#AA7C11] via-[#F5D77F] to-[#AA7C11] text-[#07381D] px-4 py-0.5 rounded-full font-black text-center shadow-md flex items-center gap-2 relative z-10 border border-white/40">
                            <span className="text-xs">✦</span>
                            <span className="leading-none tracking-wider font-extrabold" style={{ fontSize: `${discFontSize * 0.9}px` }}>
                                {tag.topBannerText || 'عروض اليوم الوطني الملكية'}
                            </span>
                            <span className="text-xs">✦</span>
                        </div>
                    </div>

                    {/* Sub slogan pill */}
                    <div className="mt-1 text-center">
                        <span className="text-[#F5D77F] text-[9.5px] font-black tracking-wide bg-black/30 px-3 py-0.5 rounded-md border border-[#D4AF37]/30">
                            {tag.discountText || 'نحلم ونحقق • عروض استثنائية'}
                        </span>
                    </div>
                </div>

                {/* Body Area */}
                <div className="flex-1 flex flex-col p-3 relative z-10 justify-between items-center bg-[#FCFCFA]">
                    {/* Geometric Islamic Corner Accents */}
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 border-t-2 border-r-2 border-[#D4AF37]/60 pointer-events-none"></div>
                    <div className="absolute top-1.5 left-1.5 w-5 h-5 border-t-2 border-l-2 border-[#D4AF37]/60 pointer-events-none"></div>
                    <div className="absolute bottom-1.5 right-1.5 w-5 h-5 border-b-2 border-r-2 border-[#D4AF37]/60 pointer-events-none"></div>
                    <div className="absolute bottom-1.5 left-1.5 w-5 h-5 border-b-2 border-l-2 border-[#D4AF37]/60 pointer-events-none"></div>

                    {/* Top Row: Units / Carton Price (Right) & Original Price (Left) */}
                    <div className="flex justify-between items-start w-full px-1 mb-1">
                        {/* Unit badge & carton */}
                        <div className="flex flex-col items-start gap-1">
                            {unitText && (
                                <div className="bg-gradient-to-r from-[#EBF7EE] to-[#DEF3E3] text-[#084223] border border-[#0B572E]/40 px-2.5 py-0.5 rounded-md font-black shadow-xs flex items-center gap-1.5" style={{ fontSize: `${dFontSize * 0.52}px` }}>
                                    <span className="text-[#0B572E] text-xs">🏷️</span>
                                    <span>{unitText}</span>
                                </div>
                            )}
                            {displayCartonPrice && (
                                <div className="border border-[#D4AF37] bg-gradient-to-r from-amber-50 to-[#FFF9E6] rounded-md px-2 py-0.5 flex flex-col items-center shadow-xs">
                                    <span className="text-[#854d0e] font-bold text-[8.5px] leading-none mb-0.5">سعر الكرتون بالعرض</span>
                                    <span className="font-black text-[#084223]" style={{ fontSize: `${tag.customColors?.cartonPriceFontSize || origFontSize}px` }}>
                                        {displayCartonPrice}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Strikethrough Original Price */}
                        <div className="flex flex-col items-end">
                            {!tag.hideOriginalPrice && tag.originalPrice && tag.originalPrice !== '0.00' && (
                                <div className="border border-[#E5C158]/50 bg-white shadow-xs rounded-md px-2.5 py-0.5 flex flex-col items-center">
                                    <span className="text-gray-400 font-bold text-[8.5px] leading-none mb-0.5">بدلاً من</span>
                                    <div className="relative inline-flex items-center gap-1">
                                        <span className="font-black text-gray-400 line-through decoration-red-600 decoration-[2.5px] font-mono" style={{ fontSize: `${origFontSize}px` }}>
                                            {displayOriginalPrice}
                                        </span>
                                        <CurrencySymbolRenderer 
                                            type={currencyType} 
                                            imageUrl={currencyImage} 
                                            color="#9ca3af" 
                                            className="shrink-0" 
                                            style={{ width: `${currencySize * 0.55}px`, height: `${currencySize * 0.55}px` }} 
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Central Royal Price Plaque (Golden & Emerald Framed Box) */}
                    <div className="my-auto w-full max-w-[92%] py-2 px-3 bg-gradient-to-b from-[#FFFFFF] via-[#FAF6EB] to-[#F3ECD8] rounded-2xl border-2 border-[#D4AF37] shadow-md flex flex-col items-center justify-center relative">
                        {/* Decorative top pill label */}
                        <div className="absolute -top-2.5 bg-[#084223] text-[#F5D77F] px-3 py-0.5 rounded-full text-[9px] font-black border border-[#D4AF37] flex items-center gap-1 shadow-xs">
                            <span>🇸🇦</span>
                            <span>السعر الخاص</span>
                        </div>

                        {/* Big Offer Price with Golden Outline & Currency */}
                        <div className="flex items-center justify-center gap-2.5 flex-nowrap shrink-0 mt-1" dir="ltr">
                            <CurrencySymbolRenderer 
                                type={currencyType} 
                                imageUrl={currencyImage} 
                                color="#084223" 
                                className="shrink-0 drop-shadow-xs" 
                                style={{ width: `${currencySize * 1.35}px`, height: `${currencySize * 1.35}px` }} 
                            />
                            <div className="flex items-baseline gap-1">
                                <span className="font-black tracking-tighter shrink-0 text-[#084223] drop-shadow-sm font-sans" style={{ fontSize: `${pFontSize * 1.75}px`, lineHeight: 0.85 }}>
                                    {priceMain}
                                </span>
                                {priceDec && priceDec !== '00' && priceDec !== '٠٠' && (
                                    <div className="flex flex-col items-start justify-end h-full">
                                        <span className="font-black shrink-0 text-[#AA7C11] font-mono" style={{ fontSize: `${dFontSize * 1.45}px`, lineHeight: 0.85 }}>
                                            .{priceDec}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tax Included Sub-text with Islamic Stars */}
                        <div className="flex items-center gap-2 mt-1 text-[#084223]">
                            <span className="text-[#D4AF37] text-[10px]">✦</span>
                            <span className="font-black text-[10px] tracking-wide" style={{ fontSize: `${taxFontSize * 0.95}px` }}>
                                ر.س شامل ضريبة القيمة المضافة
                            </span>
                            <span className="text-[#D4AF37] text-[10px]">✦</span>
                        </div>
                    </div>

                    {/* Product Name Banner */}
                    <div className="w-full text-center mt-2 px-1 z-10">
                        <h2 className="font-black text-gray-900 leading-tight tracking-tight line-clamp-2" style={{ fontSize: `${nFontSize}px`, wordBreak: 'break-word' }}>
                            {tag.name}
                        </h2>
                        {tag.productId && (
                            <div className="text-center w-full mt-1">
                                <span className="text-gray-500 text-[8.5px] font-mono font-black tracking-widest bg-[#EFECE3] border border-[#DDD6C5] px-2.5 py-0.5 rounded-full">
                                    BARCODE: {formatNum(tag.productId)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sadu & National Day Vector Footer */}
                <div className="w-full bg-[#084223] h-5 relative overflow-hidden flex items-center justify-between px-3 shrink-0 border-t-2 border-[#D4AF37]">
                    <div className="flex items-center gap-1 text-[8.5px] font-black text-[#F5D77F]">
                        <span>🇸🇦</span>
                        <span>دام عزك يا وطن</span>
                    </div>

                    {/* Center SVG Sadu Pattern Accent */}
                    <div className="flex items-center gap-1 opacity-80">
                        <svg width="60" height="10" viewBox="0 0 60 10">
                            <polygon points="10,0 20,5 10,10 0,5" fill="#D4AF37" />
                            <polygon points="30,0 40,5 30,10 20,5" fill="#FFF2B2" />
                            <polygon points="50,0 60,5 50,10 40,5" fill="#D4AF37" />
                        </svg>
                    </div>

                    <span className="text-[8px] font-extrabold text-emerald-100 tracking-wider">نحلم ونحقق 94</span>
                </div>
            </div>
        );
    }

    // --- DESIGN 8: SAUDI NATIONAL DAY 95 - "عِزّنا بطبعنا" (اليوم الوطني 95 مع الشعار الرسمي وإظهار/إخفاء كافة العناصر والخلفية المخصصة) ---
    if (tag.template === 'saudi_nd_95_ezna') {
        const vis = tag.visibility || {};
        const showLogoEl = vis.showLogo !== false && tag.showLogo !== false;
        const showTopBannerEl = vis.showTopBanner !== false;
        const showProductNameEl = vis.showProductName !== false;
        const showBarcodeEl = vis.showBarcode !== false;
        const showOfferPriceEl = vis.showOfferPrice !== false;
        const showOriginalPriceEl = vis.showOriginalPrice !== false && !tag.hideOriginalPrice;
        const showCartonPriceEl = vis.showCartonPrice !== false && tag.showCartonPrice !== false;
        const showUnitEl = vis.showUnit !== false;
        const showDiscountBadgeEl = vis.showDiscountBadge !== false;
        const showCurrencyEl = vis.showCurrency !== false;
        const showTaxTextEl = vis.showTaxText !== false;
        const showFooterEl = vis.showFooter !== false;
        const showPriceBoxEl = vis.showPriceBox !== false;

        const bgOpacityVal = (tag.bgOpacity ?? 100) / 100;
        const bgOverlayDarkVal = (tag.bgOverlayDarkness ?? 25) / 100;

        // Dynamic background support (clean white vs deep emerald)
        const customBg = tag.customColors?.background;
        const isWhiteOrLight = isLightColor(customBg || '#ffffff');
        const resolvedBgColor = customBg || '#ffffff';

        return (
            <div 
                className={`w-full h-full flex flex-col relative overflow-hidden ${isWhiteOrLight ? 'text-[#063321]' : 'text-white'} ${showCuttingBorders ? 'border-dashed' : ''}`} 
                dir="rtl"
                style={{ 
                    backgroundColor: resolvedBgColor,
                    border: `${globalBorderWidth}px solid ${globalBorderColor}`,
                    borderStyle: showCuttingBorders ? 'dashed' : 'solid'
                }}
            >
                {/* 1. Custom Background Image Layer */}
                {tag.customBackgroundImage && (
                    <div 
                        className="absolute inset-0 bg-cover bg-center z-0 pointer-events-none transition-all"
                        style={{ 
                            backgroundImage: `url(${tag.customBackgroundImage})`,
                            opacity: bgOpacityVal
                        }}
                    />
                )}

                {/* 2. Darkness / Contrast Overlay */}
                {tag.customBackgroundImage && bgOverlayDarkVal > 0 && (
                    <div 
                        className="absolute inset-0 bg-black z-0 pointer-events-none"
                        style={{ opacity: bgOverlayDarkVal }}
                    />
                )}

                {/* 3. Default Saudi 95 Background Layer (if no custom background image) */}
                {!tag.customBackgroundImage && (
                    isWhiteOrLight ? (
                        <div className="absolute inset-0 bg-white z-0 pointer-events-none">
                            {/* Subtle geometric dot grid watermark for official crisp white stationery */}
                            <div className="absolute inset-0 opacity-[0.035] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#00A651 2px, transparent 0)', backgroundSize: '16px 16px' }}></div>
                        </div>
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-b from-[#042419] via-[#073625] to-[#041F15] z-0 pointer-events-none">
                            {/* Decorative Pixel Mosaic Grid */}
                            <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#00A651 2px, transparent 0)', backgroundSize: '12px 12px' }}></div>
                        </div>
                    )
                )}

                {/* 4. Top Header with Official Saudi 95 "عِزّنا بطبعنا" Logo */}
                {showTopBannerEl && (
                    <div className={`w-full relative z-10 shrink-0 ${isWhiteOrLight ? 'bg-gradient-to-b from-[#F0FDF4] to-[#E6F8EE] border-b-2 border-[#00A651]/40' : 'bg-[#042418]/90 backdrop-blur-xs border-b border-[#00A651]/40'} px-3 py-2 flex flex-col items-center justify-center shadow-sm`}>
                        {/* Top Pixel Sadu Accent Bar */}
                        <div className="w-full flex items-center justify-center gap-1 mb-1.5 opacity-85">
                            <span className="w-2 h-1 bg-[#00A651] rounded-xs"></span>
                            <span className="w-2 h-1 bg-[#0B4D31] rounded-xs"></span>
                            <span className="w-2 h-1 bg-[#00A651] rounded-xs"></span>
                            <span className={`w-2 h-1 ${isWhiteOrLight ? 'bg-[#007A3D]' : 'bg-white/70'} rounded-xs`}></span>
                            <span className="w-2 h-1 bg-[#00A651] rounded-xs"></span>
                            <span className="w-2 h-1 bg-[#0B4D31] rounded-xs"></span>
                            <span className="w-2 h-1 bg-[#00A651] rounded-xs"></span>
                        </div>

                        {/* Official "عِزّنا بطبعنا" 95 Logo Component (or Custom Logo) */}
                        {showLogoEl && (
                            <Saudi95Logo 
                                customLogoUrl={tag.customLogoImage} 
                                variant={isWhiteOrLight ? 'green_on_light' : 'white_on_dark'}
                                className="w-full max-w-[94%] my-0.5" 
                            />
                        )}

                        {/* Additional Sub-Banner or Discount Badge */}
                        <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
                            {tag.topBannerText && tag.topBannerText !== 'عِزّنا بطبعنا' && (
                                <span className={`${isWhiteOrLight ? 'text-[#007A3D]' : 'text-[#99f6b4]'} text-[10px] font-black tracking-wide`} style={{ fontSize: `${discFontSize * 0.85}px` }}>
                                    {tag.topBannerText}
                                </span>
                            )}
                            {showDiscountBadgeEl && tag.discountText && (
                                <span className={`bg-[#00A651] text-white px-3 py-0.5 rounded-full font-black text-[10.5px] shadow-sm ${isWhiteOrLight ? 'border border-[#007A3D]/30' : 'border border-white/20'} flex items-center gap-1`}>
                                    <span>✨</span>
                                    <span>{tag.discountText}</span>
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* 5. Main Card Content Area */}
                <div className="flex-1 flex flex-col p-3 relative z-10 justify-between items-center w-full">
                    {/* Top Details Row: Unit/Carton (Right) & Previous Price (Left) */}
                    <div className="flex justify-between items-start w-full px-1 mb-1">
                        {/* Unit badge & carton */}
                        <div className="flex flex-col items-start gap-1">
                            {showUnitEl && unitText && (
                                <div className={`${isWhiteOrLight ? 'bg-[#E8F8EE] text-[#007A3D] border border-[#00A651]/50' : 'bg-[#08452B]/85 text-emerald-100 border border-[#00A651]/50'} px-2.5 py-0.5 rounded-md font-black shadow-xs flex items-center gap-1`} style={{ fontSize: `${dFontSize * 0.52}px` }}>
                                    <span className="text-[#00A651] text-xs">🏷️</span>
                                    <span>{unitText}</span>
                                </div>
                            )}
                            {showCartonPriceEl && displayCartonPrice && (
                                <div className={`border border-[#00A651]/60 ${isWhiteOrLight ? 'bg-[#F0FDF4]' : 'bg-[#05291C]/80'} rounded-md px-2 py-0.5 flex flex-col items-center shadow-xs`}>
                                    <span className={`${isWhiteOrLight ? 'text-[#074D2E]' : 'text-emerald-300'} font-bold text-[8.5px] leading-none mb-0.5`}>سعر الكرتون بالعرض</span>
                                    <span className={`font-black ${isWhiteOrLight ? 'text-[#007A3D]' : 'text-[#85e8a5]'}`} style={{ fontSize: `${tag.customColors?.cartonPriceFontSize || origFontSize}px` }}>
                                        {displayCartonPrice}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Strikethrough Original Price */}
                        <div className="flex flex-col items-end">
                            {showOriginalPriceEl && tag.originalPrice && tag.originalPrice !== '0.00' && (
                                <div className={`border ${isWhiteOrLight ? 'border-gray-300 bg-white/95 shadow-xs' : 'border-white/20 bg-black/40'} backdrop-blur-xs rounded-md px-2.5 py-0.5 flex flex-col items-center`}>
                                    <span className={`${isWhiteOrLight ? 'text-gray-500' : 'text-gray-300'} font-bold text-[8.5px] leading-none mb-0.5`}>بدلاً من</span>
                                    <div className="relative inline-flex items-center gap-1">
                                        <span className={`font-black ${isWhiteOrLight ? 'text-gray-500' : 'text-gray-300'} line-through decoration-red-500 decoration-[2.5px] font-mono`} style={{ fontSize: `${origFontSize}px` }}>
                                            {displayOriginalPrice}
                                        </span>
                                        {showCurrencyEl && (
                                            <CurrencySymbolRenderer 
                                                type={currencyType} 
                                                imageUrl={currencyImage} 
                                                color={isWhiteOrLight ? '#6b7280' : '#d1d5db'} 
                                                className="shrink-0" 
                                                style={{ width: `${currencySize * 0.55}px`, height: `${currencySize * 0.55}px` }} 
                                            />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Central Price Plaque */}
                    {showOfferPriceEl && (
                        <div className={`my-auto w-full max-w-[94%] py-2.5 px-3 flex flex-col items-center justify-center relative transition-all ${
                            showPriceBoxEl 
                                ? (isWhiteOrLight 
                                    ? 'bg-gradient-to-b from-[#FFFFFF] via-[#F4FCF7] to-[#E8F8EF] rounded-2xl border-2 border-[#00A651] shadow-md' 
                                    : 'bg-gradient-to-b from-[#052D1E]/95 via-[#073B28]/95 to-[#042015]/95 rounded-2xl border-2 border-[#00A651] shadow-xl backdrop-blur-xs') 
                                : 'bg-transparent'
                        }`}>
                            {/* Decorative Top Tag */}
                            {showPriceBoxEl && (
                                <div className="absolute -top-3 bg-[#00A651] text-white px-3 py-0.5 rounded-full text-[9px] font-black border border-white/30 flex items-center gap-1 shadow-sm">
                                    <span>🇸🇦</span>
                                    <span>عرض اليوم الوطني 95</span>
                                </div>
                            )}

                            {/* Big Offer Price with Currency */}
                            <div className="flex items-center justify-center gap-2.5 flex-nowrap shrink-0 mt-1" dir="ltr">
                                {showCurrencyEl && (
                                    <CurrencySymbolRenderer 
                                        type={currencyType} 
                                        imageUrl={currencyImage} 
                                        color={(tag.customColors as any)?.currencyColor || (isWhiteOrLight ? '#074D2E' : '#a7f3d0')} 
                                        className="shrink-0 drop-shadow-sm" 
                                        style={{ width: `${currencySize * 1.35}px`, height: `${currencySize * 1.35}px` }} 
                                    />
                                )}
                                <div className="flex items-baseline gap-1">
                                    <span className={`font-black tracking-tighter shrink-0 ${isWhiteOrLight ? 'text-[#063321]' : 'text-white'} drop-shadow-sm font-sans`} style={{ fontSize: `${pFontSize * 1.8}px`, lineHeight: 0.85 }}>
                                        {priceMain}
                                    </span>
                                    {priceDec && priceDec !== '00' && priceDec !== '٠٠' && (
                                        <div className="flex flex-col items-start justify-end h-full">
                                            <span className={`font-black shrink-0 ${isWhiteOrLight ? 'text-[#074D2E]' : 'text-emerald-200'} font-mono drop-shadow-xs`} style={{ fontSize: `${dFontSize * 1.45}px`, lineHeight: 0.85 }}>
                                                .{priceDec}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tax Text */}
                            {showTaxTextEl && (
                                <div className={`flex items-center gap-1.5 mt-1 ${isWhiteOrLight ? 'text-[#074D2E]' : 'text-emerald-200'}`} style={(tag.customColors as any)?.currencyColor ? { color: (tag.customColors as any).currencyColor } : undefined}>
                                    <span className="text-[#00A651] text-[10px]">■</span>
                                    <span className="font-black text-[10px] tracking-wide" style={{ fontSize: `${taxFontSize * 0.95}px` }}>
                                        ر.س شامل ضريبة القيمة المضافة
                                    </span>
                                    <span className="text-[#00A651] text-[10px]">■</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Product Name & Barcode */}
                    <div className="w-full text-center mt-2 px-1 z-10">
                        {showProductNameEl && (
                            <h2 className={`font-black ${isWhiteOrLight ? 'text-[#062E1F]' : 'text-white'} leading-tight tracking-tight line-clamp-2 drop-shadow-xs`} style={{ fontSize: `${nFontSize}px`, wordBreak: 'break-word' }}>
                                {tag.name}
                            </h2>
                        )}
                        {showBarcodeEl && tag.productId && (
                            <div className="text-center w-full mt-1">
                                <span className={`${isWhiteOrLight ? 'text-[#063B25] bg-[#EBF8F1] border border-[#00A651]/40' : 'text-emerald-100 bg-[#042418]/80 border border-[#00A651]/40'} text-[8.5px] font-mono font-black tracking-widest px-2.5 py-0.5 rounded-full shadow-2xs`}>
                                    BARCODE: {formatNum(tag.productId)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 6. Footer Banner with Mosaic Squares */}
                {showFooterEl && (
                    <div className={`w-full ${isWhiteOrLight ? 'bg-[#EBF8F1] border-t-2 border-[#00A651] text-[#063321]' : 'bg-[#042418] border-t border-[#00A651]/60 text-white'} h-5 relative overflow-hidden flex items-center justify-between px-3 shrink-0`}>
                        <div className="flex items-center gap-1.5 text-[8.5px] font-black">
                            <span className="text-[#00A651]">■</span>
                            <span>عِـزّنـا بِـطَـبْـعِـنـا</span>
                        </div>

                        {/* Center Pixel Mosaic Motif */}
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-[#00A651]"></span>
                            <span className={`w-1.5 h-1.5 ${isWhiteOrLight ? 'bg-[#007A3D]' : 'bg-[#08452B]'}`}></span>
                            <span className="w-1.5 h-1.5 bg-[#00A651]"></span>
                            <span className={`w-1.5 h-1.5 ${isWhiteOrLight ? 'bg-[#073623]' : 'bg-white/70'}`}></span>
                            <span className="w-1.5 h-1.5 bg-[#00A651]"></span>
                        </div>

                        <span className={`text-[8px] font-extrabold ${isWhiteOrLight ? 'text-[#007A3D]' : 'text-emerald-200'} tracking-wider font-mono`}>
                            🇸🇦 95 عاماً من العز
                        </span>
                    </div>
                )}
            </div>
        );
    }

    // --- DESIGN 1: CLASSIC (DEFAULT) ---
    return (
        <div 
            className={`w-full h-full flex flex-col relative overflow-hidden ${showCuttingBorders ? 'border-dashed' : ''}`} 
            dir="rtl"
            style={{ 
                backgroundColor: bgColor,
                border: `${globalBorderWidth}px solid ${globalBorderColor}`,
                borderStyle: showCuttingBorders ? 'dashed' : 'solid'
            }}
        >
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 0)', backgroundSize: '15px 15px' }}></div>
            
            <div className="pt-4 flex justify-center relative z-10 shrink-0">
                <div 
                    className="bg-red-600 text-white px-6 py-2 rounded-[1.5rem] shadow-xl border-[3px] border-white flex flex-col items-center justify-center leading-none transform -rotate-1"
                    style={{ minWidth: `${discFontSize * 2.5}px` }}
                >
                    <span className="font-black uppercase italic" style={{ fontSize: `${discFontSize}px` }}>
                        {formatNum(tag.discountText)}
                    </span>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-3 relative z-10 text-center">
                <h2 className="font-black leading-tight text-slate-900 w-full" style={{ fontSize: `${nFontSize}px`, wordBreak: 'break-word' }}>
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
                                    fontSize: `${origFontSize}px`,
                                    color: '#CCFF00' 
                                }}
                            >
                                {displayOriginalPrice}
                            </span>
                        </div>
                    )}

                    {displayCartonPrice && (
                        <div className="flex flex-col items-center pl-4 border-l border-white/10 shrink-0">
                            <span className="text-[7px] font-black text-slate-400 uppercase mb-0.5">الكرتون</span>
                            <span 
                                className="font-black font-mono leading-none" 
                                style={{ 
                                    fontSize: `${tag.customColors?.cartonPriceFontSize || origFontSize}px`,
                                    color: '#CCFF00' 
                                }}
                            >
                                {displayCartonPrice}
                            </span>
                        </div>
                    )}

                    <div className="flex-1 flex flex-col items-center justify-center gap-1.5 flex-nowrap" dir="ltr">
                        {displayCartonPrice && <span className="text-[8px] font-black text-slate-400 uppercase mb-[-4px]">سعر الحبة</span>}
                        <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                            <CurrencySymbolRenderer type={currencyType} imageUrl={currencyImage} color="#94a3b8" className="shrink-0" style={{ width: `${currencySize}px`, height: `${currencySize}px` }} />
                            <div className="flex items-baseline leading-none flex-nowrap shrink-0">
                                <span className="font-black tracking-tighter shrink-0" style={{ fontSize: `${pFontSize}px` }}>
                                    {priceMain}
                                </span>
                            </div>

                            <div className="flex items-center h-full shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                            </div>

                            <div className="flex flex-col items-start leading-none pt-1 shrink-0">
                                <span className="font-black text-red-500" style={{ fontSize: `${dFontSize}px` }}>
                                    {priceDec}
                                </span>
                            </div>
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
          width: `${layoutConfig.pageWidth}mm`, 
          height: `${layoutConfig.pageHeight}mm`, 
          display: 'grid', 
          gridTemplateColumns: `repeat(${layoutConfig.columns}, ${layoutConfig.widthPerLabel}mm)`,
          gridTemplateRows: `repeat(${layoutConfig.rows}, ${layoutConfig.heightPerLabel}mm)`,
          backgroundColor: 'white',
          boxSizing: 'border-box'
        }}
      >
        <style>{`
            @page {
                size: A4 ${orientation};
                margin: 0 !important;
            }
            @media print {
                * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow) !important;
                    text-shadow: var(--tw-text-shadow, none) !important;
                    animation: none !important;
                    transition: none !important;
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
                    <button onClick={() => updateTag(activeTag.id, { template: 'yellow_red_banner' })} className={`p-3 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${activeTag.template === 'yellow_red_banner' ? 'border-sap-primary bg-sap-highlight text-sap-primary' : 'border-gray-100 hover:border-gray-300'}`}>
                        <div className="w-8 h-8 bg-[#FFEA00] rounded-sm border-t-[8px] border-[#B22222] flex items-center justify-center text-[#5C2C16] font-bold text-[8px] shadow-sm">OFFER</div>
                        <span className="text-[10px] font-black">بانر أحمر وأصفر</span>
                    </button>
                    <button onClick={() => updateTag(activeTag.id, { template: 'bw_banner' })} className={`p-3 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${activeTag.template === 'bw_banner' ? 'border-sap-primary bg-sap-highlight text-sap-primary' : 'border-gray-100 hover:border-gray-300'}`}>
                        <div className="w-8 h-8 bg-white rounded-sm border-t-[8px] border-black flex items-center justify-center text-black font-bold text-[8px] shadow-sm">OFFER</div>
                        <span className="text-[10px] font-black">بانر أبيض وأسود</span>
                    </button>
                    <button onClick={() => updateTag(activeTag.id, { template: 'saudi_fire_offer' })} className={`p-3 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${activeTag.template === 'saudi_fire_offer' ? 'border-sap-primary bg-sap-highlight text-sap-primary' : 'border-gray-100 hover:border-gray-300'}`}>
                        <div className="w-8 h-8 bg-black border-2 border-amber-400 rounded-sm flex items-center justify-center text-amber-400 font-bold text-[12px] shadow-sm">🔥</div>
                        <span className="text-[10px] font-black">العرض الناري (سعودي)</span>
                    </button>
                    <button onClick={() => updateTag(activeTag.id, { template: 'saudi_national_day' })} className={`p-3 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${activeTag.template === 'saudi_national_day' ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20' : 'border-gray-100 hover:border-gray-300'}`}>
                        <div className="w-8 h-8 bg-[#006C35] border-2 border-[#D4AF37] rounded-sm flex items-center justify-center text-[#F5D061] font-bold text-[12px] shadow-sm">🇸🇦</div>
                        <span className="text-[10px] font-black text-center leading-tight text-[#006C35]">اليوم الوطني الكلاسيكي</span>
                    </button>
                    <button onClick={() => updateTag(activeTag.id, { template: 'saudi_royal_crest' })} className={`p-3 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${activeTag.template === 'saudi_royal_crest' ? 'border-amber-600 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20' : 'border-gray-100 hover:border-gray-300'}`}>
                        <div className="w-8 h-8 bg-[#05321A] border-2 border-[#D4AF37] rounded-sm flex items-center justify-center text-[#F5D77F] font-bold text-[12px] shadow-sm">🌴</div>
                        <span className="text-[10px] font-black text-center leading-tight text-amber-900">اليوم الوطني الفيكتور والسدو</span>
                    </button>
                    <button onClick={() => updateTag(activeTag.id, { 
                        template: 'saudi_nd_95_ezna',
                        topBannerText: activeTag.topBannerText || 'عِزّنا بطبعنا',
                        discountText: activeTag.discountText || 'عروض اليوم الوطني 95'
                    })} className={`p-3 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${activeTag.template === 'saudi_nd_95_ezna' ? 'border-[#00A651] bg-emerald-50 text-[#072F20] ring-2 ring-[#00A651]/30 font-bold' : 'border-gray-100 hover:border-gray-300'}`}>
                        <div className="w-8 h-8 bg-[#072F20] border-2 border-[#00A651] rounded-sm flex items-center justify-center text-[#00A651] font-black text-[10px] shadow-sm">
                            95
                        </div>
                        <span className="text-[10px] font-black text-center leading-tight text-[#072F20]">اليوم الوطني 95 (عزنا بطبعنا)</span>
                    </button>

                    <div className="col-span-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => {
                                if (activeTag) {
                                    setSelectedTags(prev => prev.map(t => ({ 
                                        ...t, 
                                        template: activeTag.template,
                                        topBannerText: activeTag.template === 'saudi_nd_95_ezna'
                                            ? (t.topBannerText || 'عِزّنا بطبعنا')
                                            : (activeTag.template === 'saudi_national_day' || activeTag.template === 'saudi_royal_crest') 
                                                ? (t.topBannerText || (activeTag.template === 'saudi_royal_crest' ? 'عروض اليوم الوطني الملكية' : 'عروض اليوم الوطني')) 
                                                : t.topBannerText,
                                        discountText: activeTag.template === 'saudi_nd_95_ezna'
                                            ? (t.discountText || 'عروض اليوم الوطني 95')
                                            : (activeTag.template === 'saudi_national_day' || activeTag.template === 'saudi_royal_crest') 
                                                ? (t.discountText || (activeTag.template === 'saudi_royal_crest' ? 'نحلم ونحقق • عروض استثنائية' : 'نحلم ونحقق • عروض خاصة')) 
                                                : t.discountText
                                    })));
                                }
                            }}
                            className="w-full py-1.5 px-2 bg-gray-50 hover:bg-emerald-50 text-gray-700 hover:text-emerald-800 border border-gray-200 hover:border-emerald-200 rounded text-[10px] font-bold transition-all text-center"
                        >
                            تطبيق هذا القالب على جميع الملصقات ({selectedTags.length})
                        </button>
                    </div>
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
                            <label className="text-[9px] font-black text-sap-primary uppercase tracking-tighter">سعر العرض (الحبة)</label>
                            <input type="text" value={activeTag.offerPrice} onChange={e => updateTag(activeTag.id, { offerPrice: e.target.value })} className="w-full p-2 border font-black text-sap-primary text-xs rounded" />
                        </div>
                        <div className="space-y-1 col-span-2 bg-blue-50 p-2 rounded-lg border border-blue-100">
                            <div className="flex items-center justify-between">
                                <label className="text-[9px] font-black text-blue-800 uppercase tracking-tighter">سعر الكرتون (اختياري)</label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="checkbox" checked={activeTag.showCartonPrice !== false} onChange={e => updateTag(activeTag.id, { showCartonPrice: e.target.checked })} className="w-3 h-3 accent-blue-600" />
                                    <span className="text-[8px] font-bold text-blue-800">إظهار في الملصق</span>
                                </label>
                            </div>
                            <input type="text" value={activeTag.cartonPrice || ''} onChange={e => updateTag(activeTag.id, { cartonPrice: e.target.value })} className="w-full p-2 border border-blue-200 text-xs rounded" placeholder="أدخل سعر الكرتون هنا..." />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">الكمية (للعرض)</label>
                            <input type="text" value={activeTag.offerQuantity || ''} onChange={e => updateTag(activeTag.id, { offerQuantity: e.target.value })} className="w-full p-2 border text-xs rounded" placeholder="مثال: 1" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">الوحدة</label>
                            <input type="text" value={activeTag.unitName || ''} onChange={e => updateTag(activeTag.id, { unitName: e.target.value })} className="w-full p-2 border text-xs rounded" placeholder="مثال: حبة، كرتون" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-red-500 uppercase">نص شارة العرض (كامل)</label>
                        <input type="text" value={activeTag.discountText} onChange={e => updateTag(activeTag.id, { discountText: e.target.value })} className="w-full p-2 border font-bold text-xs rounded text-red-600" placeholder="مثال: خصم 50% / عرض خاص" />
                    </div>
                    {(activeTag.template === 'yellow_red_banner' || activeTag.template === 'bw_banner' || activeTag.template === 'saudi_fire_offer' || activeTag.template === 'saudi_national_day' || activeTag.template === 'saudi_royal_crest' || activeTag.template === 'saudi_nd_95_ezna') && (
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-red-500 uppercase">نص البانر العلوي</label>
                            <input type="text" value={activeTag.topBannerText || ''} onChange={e => updateTag(activeTag.id, { topBannerText: e.target.value })} className="w-full p-2 border font-bold text-xs rounded text-red-600" placeholder="مثال: عِزّنا بطبعنا / عروض اليوم الوطني 95" />
                        </div>
                    )}

                    <div className="space-y-1 pt-2 border-t border-gray-100 mt-2">
                        <label className="text-[9px] font-black text-blue-600 uppercase">صورة رمز العملة المخصصة لهذا العرض</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            updateTag(activeTag.id, { customCurrencyImage: reader.result as string });
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                                className="hidden"
                                id={`currency-upload-${activeTag.id}`}
                            />
                            <label
                                htmlFor={`currency-upload-${activeTag.id}`}
                                className="cursor-pointer bg-blue-50 text-blue-600 px-3 py-1.5 rounded text-xs font-bold border border-blue-200 hover:bg-blue-100 flex-1 text-center"
                            >
                                {activeTag.customCurrencyImage ? 'تغيير الصورة' : 'رفع صورة'}
                            </label>
                            {activeTag.customCurrencyImage && (
                                <button
                                    onClick={() => updateTag(activeTag.id, { customCurrencyImage: null })}
                                    className="p-1.5 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100"
                                    title="حذف الصورة"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : openSections.data && <div className="p-4 text-center text-gray-400 italic">حدد ملصقاً لتعديله</div>}

            <AccordionHeader title="إظهار وإخفاء عناصر التصميم" isOpen={openSections.visibility} onClick={() => toggleSection('visibility')} icon={Eye} />
            {openSections.visibility && activeTag && (
                <div className="p-3 bg-white border-b border-sap-border space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                        <span className="text-[10px] font-black text-gray-700">التحكم في ظهور عناصر الملصق</span>
                        <button
                            type="button"
                            onClick={() => {
                                const allVisible = {
                                    showLogo: true,
                                    showTopBanner: true,
                                    showProductName: true,
                                    showBarcode: true,
                                    showOfferPrice: true,
                                    showOriginalPrice: true,
                                    showCartonPrice: true,
                                    showUnit: true,
                                    showDiscountBadge: true,
                                    showCurrency: true,
                                    showTaxText: true,
                                    showFooter: true,
                                    showPriceBox: true,
                                };
                                updateTag(activeTag.id, { visibility: allVisible, showLogo: true, hideOriginalPrice: false });
                            }}
                            className="text-[9px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                        >
                            إظهار الكل
                        </button>
                    </div>

                    <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-0.5">
                        {[
                            { key: 'showLogo', label: 'الشعار الرسمي (عزنا بطبعنا / الشعار المرفوع)', defaultVal: true },
                            { key: 'showTopBanner', label: 'البانر والترويسة العلوية', defaultVal: true },
                            { key: 'showProductName', label: 'اسم الصنف', defaultVal: true },
                            { key: 'showBarcode', label: 'باركود وكود الصنف', defaultVal: true },
                            { key: 'showOfferPrice', label: 'سعر العرض الأساسي', defaultVal: true },
                            { key: 'showPriceBox', label: 'إطار وبوكس سعر العرض', defaultVal: true },
                            { key: 'showOriginalPrice', label: 'السعر السابق المشطوب (بدلاً من)', defaultVal: true },
                            { key: 'showCartonPrice', label: 'سعر الكرتون (إن وجد)', defaultVal: true },
                            { key: 'showUnit', label: 'شارة الوحدة والكمية', defaultVal: true },
                            { key: 'showDiscountBadge', label: 'شارة الخصم / العرض', defaultVal: true },
                            { key: 'showCurrency', label: 'رمز وصورة العملة (ر.س)', defaultVal: true },
                            { key: 'showTaxText', label: 'عبارة شامل ضريبة القيمة المضافة', defaultVal: true },
                            { key: 'showFooter', label: 'الشريط السفلي (الفوتر)', defaultVal: true },
                        ].map((item) => {
                            const isChecked = activeTag.visibility?.[item.key as keyof typeof activeTag.visibility] ?? item.defaultVal;
                            return (
                                <label 
                                    key={item.key} 
                                    className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                                >
                                    <span className="text-xs font-bold text-gray-800">{item.label}</span>
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                            const newVis = {
                                                ...(activeTag.visibility || {}),
                                                [item.key]: e.target.checked
                                            };
                                            const extraUpdates: Partial<OfferTag> = {};
                                            if (item.key === 'showLogo') extraUpdates.showLogo = e.target.checked;
                                            if (item.key === 'showOriginalPrice') extraUpdates.hideOriginalPrice = !e.target.checked;
                                            updateTag(activeTag.id, { visibility: newVis, ...extraUpdates });
                                        }}
                                        className="w-4 h-4 accent-[#00A651] rounded cursor-pointer"
                                    />
                                </label>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            if (activeTag) {
                                const currentVis = activeTag.visibility || {};
                                setSelectedTags(prev => prev.map(t => ({
                                    ...t,
                                    visibility: { ...currentVis },
                                    showLogo: activeTag.showLogo,
                                    hideOriginalPrice: activeTag.hideOriginalPrice
                                })));
                            }
                        }}
                        className="w-full mt-2 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5"
                    >
                        <span>👁️</span>
                        <span>تطبيق خيارات الإظهار/الإخفاء على كافة الملصقات ({selectedTags.length})</span>
                    </button>
                </div>
            )}

            <AccordionHeader title="خلفية الملصق والشعار المخصص" isOpen={openSections.background} onClick={() => toggleSection('background')} icon={ImageIcon} />
            {openSections.background && activeTag && (
                <div className="p-3 bg-white border-b border-sap-border space-y-4">
                    {/* Background Color Quick Selector: White vs Emerald */}
                    <div className="space-y-2 p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                                <Paintbrush className="w-3.5 h-3.5 text-[#00A651]" />
                                <span>لون خلفية الملصق</span>
                            </span>
                            <span className="text-[10px] font-bold text-gray-500 font-mono uppercase bg-white px-2 py-0.5 rounded border border-emerald-200">
                                {activeTag.customColors?.background || '#ffffff'}
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => updateTag(activeTag.id, { customColors: { ...activeTag.customColors, background: '#ffffff' } })}
                                className={`py-2.5 px-2 rounded-lg border-2 text-xs font-black transition-all flex flex-col items-center justify-center gap-1 shadow-xs ${
                                    isLightColor(activeTag.customColors?.background || '#ffffff')
                                        ? 'border-[#00A651] bg-white text-[#063321] ring-2 ring-[#00A651]/20'
                                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                                }`}
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded-full border-2 border-gray-300 bg-white shadow-xs"></span>
                                    <span>الخلفية البيضاء</span>
                                </div>
                                <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">وفر حبر الطباعة ✨</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => updateTag(activeTag.id, { customColors: { ...activeTag.customColors, background: '#062E20' } })}
                                className={`py-2.5 px-2 rounded-lg border-2 text-xs font-black transition-all flex flex-col items-center justify-center gap-1 shadow-xs ${
                                    !isLightColor(activeTag.customColors?.background) && (activeTag.customColors?.background || '').toLowerCase() !== '#ffffff'
                                        ? 'border-[#00A651] bg-[#062E20] text-white ring-2 ring-[#00A651]/30'
                                        : 'border-gray-300 bg-[#062E20] text-white hover:bg-[#083E2B]'
                                }`}
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded-full border-2 border-emerald-400 bg-[#062E20] shadow-xs"></span>
                                    <span>خضراء زمردية</span>
                                </div>
                                <span className="text-[9px] text-emerald-200 font-bold bg-white/10 px-1.5 py-0.2 rounded">هوية اليوم الوطني 95</span>
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                const currentBg = activeTag.customColors?.background || '#ffffff';
                                setSelectedTags(prev => prev.map(t => ({
                                    ...t,
                                    customColors: {
                                        ...t.customColors,
                                        background: currentBg
                                    }
                                })));
                            }}
                            className="w-full mt-1 py-1 px-2 bg-white hover:bg-emerald-100/60 text-emerald-900 border border-emerald-300 rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1"
                        >
                            <span>🎨</span>
                            <span>تطبيق لون الخلفية ({activeTag.customColors?.background || '#ffffff'}) على كل الملصقات</span>
                        </button>
                    </div>

                    {/* Background Image Upload */}
                    <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <Upload className="w-4 h-4 text-emerald-600" />
                                <span className="text-xs font-black text-slate-800">رفع صورة خلفية للملصق</span>
                            </div>
                            {activeTag.customBackgroundImage && (
                                <button
                                    type="button"
                                    onClick={() => updateTag(activeTag.id, { customBackgroundImage: null })}
                                    className="text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 flex items-center gap-1"
                                >
                                    <X className="w-3 h-3" />
                                    <span>إزالة</span>
                                </button>
                            )}
                        </div>

                        <p className="text-[10px] text-gray-500 leading-normal">
                            يمكنك رفع أي صورة خلفية خاصة باليوم الوطني أو تصميم متجرك لتظهر كخلفية لملصق العرض.
                        </p>

                        {activeTag.customBackgroundImage && (
                            <div className="relative w-full h-20 rounded-lg overflow-hidden border border-emerald-300 bg-black/5 shadow-inner flex items-center justify-center">
                                <img 
                                    src={activeTag.customBackgroundImage} 
                                    alt="معاينة الخلفية" 
                                    className="w-full h-full object-cover" 
                                />
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                                    <span className="text-white text-[9px] font-bold bg-black/60 px-2 py-0.5 rounded">معاينة الخلفية</span>
                                </div>
                            </div>
                        )}

                        <div>
                            <input
                                type="file"
                                accept="image/*"
                                id={`bg-upload-${activeTag.id}`}
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            updateTag(activeTag.id, { 
                                                customBackgroundImage: reader.result as string,
                                                bgOpacity: activeTag.bgOpacity ?? 100,
                                                bgOverlayDarkness: activeTag.bgOverlayDarkness ?? 25
                                            });
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                            <label
                                htmlFor={`bg-upload-${activeTag.id}`}
                                className="cursor-pointer w-full py-2 px-3 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                            >
                                <Upload className="w-4 h-4 text-emerald-600" />
                                <span>{activeTag.customBackgroundImage ? 'تغيير صورة الخلفية' : 'اختر صورة الخلفية من جهازك'}</span>
                            </label>
                        </div>

                        {activeTag.customBackgroundImage && (
                            <div className="space-y-3 pt-2 border-t border-slate-200">
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-600">
                                        <span>شفافية صورة الخلفية</span>
                                        <span className="font-mono text-emerald-700 font-black">{activeTag.bgOpacity ?? 100}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="10"
                                        max="100"
                                        value={activeTag.bgOpacity ?? 100}
                                        onChange={e => updateTag(activeTag.id, { bgOpacity: Number(e.target.value) })}
                                        className="w-full accent-[#00A651]"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-600">
                                        <span>طبقة تعتيم الخلفية (لزيادة وضوح النصوص)</span>
                                        <span className="font-mono text-emerald-700 font-black">{activeTag.bgOverlayDarkness ?? 25}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="90"
                                        value={activeTag.bgOverlayDarkness ?? 25}
                                        onChange={e => updateTag(activeTag.id, { bgOverlayDarkness: Number(e.target.value) })}
                                        className="w-full accent-[#00A651]"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (activeTag.customBackgroundImage) {
                                            setSelectedTags(prev => prev.map(t => ({
                                                ...t,
                                                customBackgroundImage: activeTag.customBackgroundImage,
                                                bgOpacity: activeTag.bgOpacity ?? 100,
                                                bgOverlayDarkness: activeTag.bgOverlayDarkness ?? 25
                                            })));
                                        }
                                    }}
                                    className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1 shadow-sm"
                                >
                                    <span>🖼️</span>
                                    <span>تطبيق هذه الخلفية على جميع الملصقات ({selectedTags.length})</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Custom Logo Upload */}
                    <div className="space-y-2 p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-[#00A651]" />
                                <span className="text-xs font-black text-emerald-950">شعار العرض المخصص</span>
                            </div>
                            {activeTag.customLogoImage && (
                                <button
                                    type="button"
                                    onClick={() => updateTag(activeTag.id, { customLogoImage: null })}
                                    className="text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 flex items-center gap-1"
                                >
                                    <X className="w-3 h-3" />
                                    <span>الرجوع للشعار المدمج</span>
                                </button>
                            )}
                        </div>

                        <p className="text-[10px] text-gray-600 leading-normal">
                            القالب مزود تلقائياً بهوية وشعار اليوم الوطني 95 الرسمي "عِزّنا بطبعنا". يمكنك أيضاً رفع صورة شعار بديلة من جهازك.
                        </p>

                        {activeTag.customLogoImage && (
                            <div className="relative w-full h-16 rounded-lg overflow-hidden border border-emerald-300 bg-emerald-950 p-2 flex items-center justify-center">
                                <img 
                                    src={activeTag.customLogoImage} 
                                    alt="معاينة الشعار" 
                                    className="max-h-full max-w-full object-contain" 
                                />
                            </div>
                        )}

                        <div>
                            <input
                                type="file"
                                accept="image/*"
                                id={`logo-upload-${activeTag.id}`}
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            updateTag(activeTag.id, { customLogoImage: reader.result as string });
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                            <label
                                htmlFor={`logo-upload-${activeTag.id}`}
                                className="cursor-pointer w-full py-2 px-3 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs"
                            >
                                <Upload className="w-4 h-4 text-[#00A651]" />
                                <span>{activeTag.customLogoImage ? 'تغيير الشعار المخصص' : 'رفع شعار مخصص من الجهاز'}</span>
                            </label>
                        </div>

                        {activeTag.customLogoImage && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (activeTag.customLogoImage) {
                                        setSelectedTags(prev => prev.map(t => ({
                                            ...t,
                                            customLogoImage: activeTag.customLogoImage
                                        })));
                                    }
                                }}
                                className="w-full py-1.5 px-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1 shadow-sm"
                            >
                                <span>🇸🇦</span>
                                <span>تطبيق هذا الشعار على جميع الملصقات ({selectedTags.length})</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

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

                    {(activeTag.template === 'yellow_red_banner' || activeTag.template === 'bw_banner' || activeTag.template === 'saudi_fire_offer' || activeTag.template === 'saudi_national_day' || activeTag.template === 'saudi_royal_crest' || activeTag.template === 'saudi_nd_95_ezna') && (
                        <>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-[9px] font-black text-gray-600 uppercase">
                                    <span>حجم نص الضريبة / التسمية التوضيحية</span>
                                    <span className="text-gray-600 font-mono">{(activeTag.customColors as any)?.taxFontSize || 12}px</span>
                                </div>
                                <input type="range" min="8" max="50" value={(activeTag.customColors as any)?.taxFontSize || 12} onChange={e => updateTag(activeTag.id, { customColors: { ...activeTag.customColors, taxFontSize: Number(e.target.value) } })} className="w-full accent-gray-600" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-[9px] font-black text-blue-600 uppercase">
                                    <span>حجم رمز العملة</span>
                                    <span className="text-blue-600 font-mono">{(activeTag.customColors as any)?.currencySize || 32}px</span>
                                </div>
                                <input type="range" min="10" max="150" value={(activeTag.customColors as any)?.currencySize || 32} onChange={e => updateTag(activeTag.id, { customColors: { ...activeTag.customColors, currencySize: Number(e.target.value) } })} className="w-full accent-blue-600" />
                            </div>
                        </>
                    )}
                </div>
            )}

            <AccordionHeader title="الألوان والخلفية" isOpen={openSections.colors} onClick={() => toggleSection('colors')} icon={Palette} />
            {openSections.colors && activeTag && (
                <div className="p-3 bg-white border-b border-sap-border space-y-4">
                    {/* Dedicated White Background Fast Button */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-700 uppercase flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Paintbrush size={12} className="text-[#00A651]" />
                                <span>اختيار خلفية الملصق</span>
                            </span>
                            <span className="font-mono font-bold text-[10px] uppercase text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                {activeTag.customColors?.background || '#ffffff'}
                            </span>
                        </label>

                        <button
                            type="button"
                            onClick={() => updateTag(activeTag.id, { customColors: { ...activeTag.customColors, background: '#ffffff' } })}
                            className={`w-full py-2.5 px-3 rounded-lg border-2 text-xs font-black transition-all flex items-center justify-between shadow-xs ${
                                (activeTag.customColors?.background || '#ffffff').toLowerCase() === '#ffffff'
                                    ? 'border-[#00A651] bg-emerald-50/80 text-emerald-950 ring-2 ring-[#00A651]/20'
                                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full border-2 border-gray-300 bg-white shadow-xs"></span>
                                <div className="flex flex-col items-start">
                                    <span className="font-black text-xs">خلفية بيضاء (توفير الحبر للطباعة)</span>
                                    <span className="text-[9px] text-emerald-700 font-bold">أنسب وأوضح خيار لطباعة الملصقات الورقية</span>
                                </div>
                            </div>
                            <span className="text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded font-mono font-bold text-gray-600">
                                #FFFFFF
                            </span>
                        </button>
                    </div>

                    {/* Pre-set Color Swatches */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 flex items-center justify-between">
                            <span>باليتات ألوان سريعة</span>
                            <span className="text-[9px] text-gray-400">انقر للاختيار المباشر</span>
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                            {[
                                { name: 'أبيض ناصع', hex: '#ffffff', border: 'border-gray-300' },
                                { name: 'أخضر زمردي 95', hex: '#062E20', border: 'border-emerald-800' },
                                { name: 'أخضر سعودي', hex: '#007A3D', border: 'border-[#007A3D]' },
                                { name: 'نعناعي فاتح', hex: '#F0FDF4', border: 'border-emerald-200' },
                                { name: 'بيج أوف وايت', hex: '#FDF8EE', border: 'border-amber-200' },
                                { name: 'أسود فاخر', hex: '#111827', border: 'border-gray-800' },
                            ].map((c) => {
                                const isSelected = (activeTag.customColors?.background || '#ffffff').toLowerCase() === c.hex.toLowerCase();
                                return (
                                    <button
                                        key={c.hex}
                                        type="button"
                                        onClick={() => updateTag(activeTag.id, { customColors: { ...activeTag.customColors, background: c.hex } })}
                                        className={`py-1.5 px-2 rounded-md border text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                                            isSelected
                                                ? 'ring-2 ring-[#00A651] border-[#00A651] bg-emerald-50 text-emerald-950 font-black'
                                                : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                                        }`}
                                    >
                                        <span 
                                            className={`w-3.5 h-3.5 rounded-full shrink-0 border ${c.border}`} 
                                            style={{ backgroundColor: c.hex }}
                                        />
                                        <span className="truncate">{c.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom Color Input */}
                    <div className="space-y-1.5 pt-1 border-t border-gray-100">
                        <label className="text-[10px] font-bold text-gray-500 flex items-center justify-between">
                            <span>تخصيص أي لون كود HEX</span>
                            <span className="text-[9px] text-gray-400">منتقي الألوان</span>
                        </label>
                        <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
                            <input 
                                type="color" 
                                value={activeTag.customColors?.background || '#ffffff'} 
                                onChange={e => updateTag(activeTag.id, { customColors: { ...activeTag.customColors, background: e.target.value } })} 
                                className="w-10 h-10 border-none cursor-pointer rounded-lg bg-transparent" 
                            />
                            <div className="flex-1 flex items-center justify-between">
                                <input
                                    type="text"
                                    value={activeTag.customColors?.background || '#ffffff'}
                                    onChange={e => updateTag(activeTag.id, { customColors: { ...activeTag.customColors, background: e.target.value } })}
                                    className="w-24 px-2 py-1 bg-white border border-gray-300 rounded font-mono font-bold text-xs uppercase text-gray-700 focus:outline-none focus:border-emerald-500"
                                    placeholder="#FFFFFF"
                                />
                                <button
                                    type="button"
                                    onClick={() => updateTag(activeTag.id, { customColors: { ...activeTag.customColors, background: '#ffffff' } })}
                                    className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold bg-white px-2 py-1 rounded border border-emerald-300"
                                >
                                    إعادة للأبيض
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Currency & Tax Color Control */}
                    <div className="space-y-1.5 pt-2 border-t border-gray-100">
                        <label className="text-[10px] font-bold text-gray-700 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-black text-gray-800">
                                <span>🪙</span>
                                <span>لون رمز الريال وضريبة القيمة المضافة</span>
                            </span>
                            <span className="text-[9px] text-emerald-800 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase">
                                {(activeTag.customColors as any)?.currencyColor || (isLightColor(activeTag.customColors?.background || '#ffffff') ? '#074D2E' : '#A7F3D0')}
                            </span>
                        </label>
                        <div className="flex items-center gap-3 p-2 bg-emerald-50/40 rounded-lg border border-emerald-200">
                            <input 
                                type="color" 
                                value={(activeTag.customColors as any)?.currencyColor || (isLightColor(activeTag.customColors?.background || '#ffffff') ? '#074D2E' : '#a7f3d0')} 
                                onChange={e => updateTag(activeTag.id, { customColors: { ...activeTag.customColors, currencyColor: e.target.value } })} 
                                className="w-10 h-10 border-none cursor-pointer rounded-lg bg-transparent" 
                            />
                            <div className="flex-1 flex items-center justify-between gap-2">
                                <input
                                    type="text"
                                    value={(activeTag.customColors as any)?.currencyColor || (isLightColor(activeTag.customColors?.background || '#ffffff') ? '#074D2E' : '#a7f3d0')}
                                    onChange={e => updateTag(activeTag.id, { customColors: { ...activeTag.customColors, currencyColor: e.target.value } })}
                                    className="w-24 px-2 py-1 bg-white border border-gray-300 rounded font-mono font-bold text-xs uppercase text-gray-700 focus:outline-none focus:border-emerald-500"
                                    placeholder="#074D2E"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const defaultColor = isLightColor(activeTag.customColors?.background || '#ffffff') ? '#074D2E' : '#a7f3d0';
                                        updateTag(activeTag.id, { customColors: { ...activeTag.customColors, currencyColor: defaultColor } });
                                    }}
                                    className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold bg-white px-2 py-1 rounded border border-emerald-300 shadow-2xs"
                                >
                                    مطابقة تلقائية
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Apply Color to all tags */}
                    <button
                        type="button"
                        onClick={() => {
                            const currentBg = activeTag.customColors?.background || '#ffffff';
                            const currentCurrColor = (activeTag.customColors as any)?.currencyColor;
                            setSelectedTags(prev => prev.map(t => ({
                                ...t,
                                customColors: {
                                    ...t.customColors,
                                    background: currentBg,
                                    ...(currentCurrColor ? { currencyColor: currentCurrColor } : {})
                                }
                            })));
                        }}
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs"
                    >
                        <span>🎨</span>
                        <span>تطبيق الألوان على جميع الملصقات ({selectedTags.length})</span>
                    </button>
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
                            {[1,2,4,6,8,12,16,20,24].map(n => <option key={n} value={n}>{n === 1 ? '1 ملصق (صفحة كاملة)' : `${n} ملصق بالصفحة`}</option>)}
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
                <button onClick={handleSaveAsCopy} disabled={isSaving} className="p-2 hover:bg-sap-highlight rounded-lg text-sap-primary transition-all" title="حفظ كنسخة جديدة"><Copy size={18}/></button>
                
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
                            {tag ? (
                                <>
                                    <div id={`offer-preview-${tag.id}`} className="w-full h-full">
                                        <OfferPreview tag={tag} />
                                    </div>
                                    {isActive && (
                                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md shadow-2xl rounded-full flex items-center gap-1 p-1.5 border border-gray-200 z-50">
                                            <button onClick={(e) => { e.stopPropagation(); handleSaveImage(tag.id); }} className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-full" title="حفظ كصورة"><Download size={16}/></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDuplicate(tag); }} className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-full" title="تكرار"><Copy size={16}/></button>
                                            <button onClick={(e) => { e.stopPropagation(); setChangingTagId(tag.id); setShowProductPicker(true); }} className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-full" title="تغيير المنتج"><RefreshCw size={16}/></button>
                                            
                                            <div className="w-px h-4 bg-gray-300 mx-1"></div>
                                            
                                            <button onClick={(e) => { e.stopPropagation(); updateTag(tag.id, { customColors: { ...(tag.customColors || {}), cartonPriceFontSize: (tag.customColors?.cartonPriceFontSize || 10) + 1 }}); }} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-full flex items-center gap-1" title="تكبير سعر الكرتون">
                                                <span className="text-[10px] font-bold">A+</span>
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); updateTag(tag.id, { customColors: { ...(tag.customColors || {}), cartonPriceFontSize: Math.max(4, (tag.customColors?.cartonPriceFontSize || 10) - 1) }}); }} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-full flex items-center gap-1" title="تصغير سعر الكرتون">
                                                <span className="text-[10px] font-bold">A-</span>
                                            </button>

                                            <div className="w-px h-4 bg-gray-300 mx-1"></div>

                                            <button onClick={(e) => { e.stopPropagation(); handleRemove(tag.id); }} className="p-1.5 hover:bg-red-50 text-red-600 rounded-full" title="حذف"><Trash2 size={16}/></button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ border: `1px dashed #ccc` }}>
                                    <button onClick={() => { setChangingTagId(null); setShowProductPicker(true); }} className="p-2 bg-white border-2 border-sap-primary text-sap-primary text-[10px] font-black rounded-lg shadow-lg hover:bg-sap-primary hover:text-white transition-all">+ إضافة</button>
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
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={(e) => handleDuplicateProject(list, e)} 
                      className="p-2 text-gray-400 hover:text-sap-primary hover:bg-sap-highlight rounded-lg transition-all"
                      title="نسخ المشروع"
                    >
                      <Copy size={18} />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteProject(list.id, e)} 
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="حذف المشروع"
                    >
                      <Trash2 size={18} />
                    </button>
                    <ArrowRight size={20} className="text-gray-200 group-hover:text-sap-primary transition-all" />
                  </div>
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
                   <span className="flex items-center gap-2"><Boxes size={20} className="text-sap-secondary"/> {changingTagId ? 'تغيير المنتج' : 'قاعدة بيانات المنتجات'}</span>
                   <button onClick={() => { setChangingTagId(null); setShowProductPicker(false); }} className="hover:bg-white/10 p-1 rounded-full"><X size={20}/></button>
                </div>
                <div className="p-6 bg-gray-50 border-b">
                    <div className="relative">
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="بحث ذكي بالأسم أو الكود..." className="w-full !p-4 !pr-12 !text-sm !font-black !bg-white border-2 border-gray-200 rounded-xl focus:border-sap-primary" autoFocus />
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300" size={20}/>
                    </div>
                </div>
                <div className="max-h-[400px] overflow-y-auto bg-white custom-scrollbar">
                    <button onClick={() => handleProductSelect()} className="w-full text-right p-5 border-b-4 border-dashed border-gray-100 text-sm font-black text-sap-primary hover:bg-sap-highlight transition-all">
                        {changingTagId ? 'تغيير إلى صنف مخصص جديد +' : 'إضافة صنف مخصص جديد +'}
                    </button>
                    {filteredProducts.map((p) => (
                        <div key={p.id} onClick={() => handleProductSelect(p)} className="p-5 border-b hover:bg-sap-highlight cursor-pointer flex justify-between items-center transition-all group">
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
