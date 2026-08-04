
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Product, Unit, CatalogProject, CatalogItem, CatalogStyleConfig, CatalogLayoutType, CatalogBadgeType } from '../types';
import { db } from '../services/supabase';
import { useSystemSettings } from './SystemSettingsContext';
import { CurrencySymbolRenderer } from './CurrencySymbolRenderer';
import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { 
  Plus, Image as ImageIcon, Trash2, Search, X, Palette, Upload, 
  ShoppingCart, Sparkles, Save, FolderOpen, Loader2, Printer, 
  ChevronRight, ArrowRight, Layers, Tag as TagIcon, LayoutGrid,
  Zap, MousePointer2, ZoomIn, ZoomOut, Box, Clock, ScanLine, 
  Maximize2, MoreHorizontal, Square, Hash, Ruler, MessageCircle,
  QrCode, ShoppingBag, Send, Minus, Share2, Download, ExternalLink, Info, AlertCircle, MapPin, Building, FileText,
  Smartphone, Layout, Type, Grid, Coffee, Gem, Flame, CheckCircle2, Eye, PaintBucket, Moon, Package
} from 'lucide-react';

interface CatalogGeneratorProps {
  products: Product[];
  units: Unit[];
  viewModeData?: CatalogProject; // Optional prop for direct viewer mode
}

export const CatalogGenerator: React.FC<CatalogGeneratorProps> = ({ products, units, viewModeData }) => {
  const { settings } = useSystemSettings();
  // --- STATE ---
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>(crypto.randomUUID());
  
  // Project Metadata
  const [projectName, setProjectName] = useState('كتالوج العروض الجديد');
  const [pageTitle, setPageTitle] = useState('عروض نهاية الأسبوع');
  const [pageSubtitle, setPageSubtitle] = useState('تسوق الآن واكتشف أفضل الأسعار');
  const [whatsappNumber, setWhatsappNumber] = useState('966500000000');
  
  // Styling & Config
  const [styleConfig, setStyleConfig] = useState<CatalogStyleConfig>({
    primaryColor: '#006C35', // Saudi Green
    secondaryColor: '#C5A059', // Gold
    backgroundColor: '#F8FAFC',
    fontFamily: 'Cairo',
    borderRadius: 16,
    layoutType: 'app_modern',
    showHeader: true,
    currencySymbolType: 'icon',
    currencySymbolImage: null,
    cardSize: 'normal',
    columnsCount: 2,
    companyName: 'مؤسسة مسارات التجارية',
    companyLogo: null,
    companyPhone: '966500000000',
    companyEmail: 'info@masarat.sa',
    companyAddress: 'الرياض، المملكة العربية السعودية',
    companyTaxNumber: '310123456700003',
    showCompanyFooter: true,
    isQuotationMode: true,
    footerTerms: 'هذا العرض ساري لمدة 15 يوماً من تاريخ الإصدار أو حتى نفاد الكمية. الأسعار تشمل ضريبة القيمة المضافة.'
  });

  // Sync styleConfig with global settings
  useEffect(() => {
    setStyleConfig(prev => ({
      ...prev,
      currencySymbolType: settings.currencySymbolType,
      currencySymbolImage: settings.currencySymbolImage
    }));
  }, [settings.currencySymbolType, settings.currencySymbolImage]);

  // UI State
  const [zoom, setZoom] = useState(100);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [savedCatalogs, setSavedCatalogs] = useState<CatalogProject[]>([]);
  const [activeTab, setActiveTab] = useState<'content' | 'design' | 'style'>('content');
  const [isViewerMode, setIsViewerMode] = useState(false); // New: Viewer Mode

  // Cart
  const [cart, setCart] = useState<{item: CatalogItem, qty: number, unit: string}[]>([]);
  const [showCart, setShowCart] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // URL Handling for Sharing
  const shareableUrl = useMemo(() => {
    return `${window.location.origin}/?catalog=${projectId}`;
  }, [projectId]);

  const qrCodeImageUrl = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareableUrl)}`;
  }, [shareableUrl]);

  // Load Catalogs on Mount
  useEffect(() => { 
      if (viewModeData) {
          loadProject(viewModeData);
          setIsViewerMode(true);
      } else {
          loadCatalogs(); 
          // Check URL for Viewer Mode hash (legacy)
          if (window.location.hash.includes('view')) {
            setIsViewerMode(true);
          }
      }
  }, [viewModeData]);

  const loadCatalogs = async () => {
    try {
      const data = await db.catalogs.getAll();
      setSavedCatalogs(data as CatalogProject[]);
    } catch (e) { console.error("Error loading catalogs:", e); }
  };

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600; // Increased for better quality
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    });
  };

  const handleSave = async () => {
    if (!projectName.trim()) return alert('يرجى تسمية المشروع');
    setIsSaving(true);
    try {
      const project: CatalogProject = {
        id: projectId,
        name: projectName.trim(),
        date: new Date().toISOString(),
        title: pageTitle.trim(),
        subtitle: pageSubtitle,
        items,
        whatsappNumber,
        styleConfig
      };
      
      // Check size roughly
      const dataSize = JSON.stringify(project).length;
      if (dataSize > 950000) {
          if(!confirm('حجم المجلة كبير بسبب الصور. قد يفشل الحفظ. هل تريد المحاولة؟')) {
             setIsSaving(false); return;
          }
      }

      await db.catalogs.upsert(project);
      await loadCatalogs();
      alert('تم حفظ الكتالوج بنجاح! يمكن فتحه الآن من الأرشيف.');
    } catch (e) { console.error(e); alert('فشل الحفظ. حاول تقليل عدد الصور.'); }
    finally { setIsSaving(false); }
  };

  const loadProject = (p: CatalogProject) => {
    setProjectId(p.id);
    setProjectName(p.name);
    setPageTitle(p.title);
    setPageSubtitle(p.subtitle || '');
    setWhatsappNumber(p.whatsappNumber || '');
    setItems(p.items || []);
    if (p.styleConfig) setStyleConfig(p.styleConfig);
    setShowSavedModal(false);
  };

  // --- AI IMAGE GENERATION (REALISTIC) ---
  const generateAiImage = async (item: CatalogItem) => {
    setIsGenerating(true);
    try {
      const prompt = `Professional advertising product photography of ${item.name} (${item.description || 'food product'}). 
          Hyper-realistic, 8k resolution, cinematic lighting, appetizing, isolated on a clean soft studio background. 
          High detailed texture, commercial look.`;

      const response = await fetch('/api/generate-catalog-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate image');
      }

      const resData = await response.json();
      if (resData.base64Image) {
        const compressed = await compressImage(resData.base64Image);
        updateItem(item.id, { image: compressed });
      } else {
        console.warn("No image data found in model response");
      }
    } catch (e: any) { 
      console.error(e);
      alert('لم نتمكن من توليد الصورة. تأكد من إعدادات الخادم.'); 
    }
    finally { setIsGenerating(false); }
  };

  const addItem = (product?: Product) => {
    const unitName = units.find(u => u.id === product?.unitId)?.name || 'قطعة';
    const newItem: CatalogItem = {
      id: crypto.randomUUID(),
      productId: product?.code || '',
      name: product?.name || 'منتج جديد',
      price: product?.price || '0.00',
      originalPrice: '',
      sectionName: product?.category || 'عام',
      unitName: unitName,
      badge: 'none',
      description: product?.description || ''
    };
    setItems(prev => [...prev, newItem]);
    setActiveItemId(newItem.id);
    setShowProductPicker(false);
  };

  const moveItem = (id: string, direction: 'up' | 'down') => {
      setItems(prev => {
          const index = prev.findIndex(i => i.id === id);
          if (index < 0) return prev;
          if (direction === 'up' && index === 0) return prev;
          if (direction === 'down' && index === prev.length - 1) return prev;
          
          const newItems = [...prev];
          const swapIndex = direction === 'up' ? index - 1 : index + 1;
          const temp = newItems[index];
          newItems[index] = newItems[swapIndex];
          newItems[swapIndex] = temp;
          
          return newItems;
      });
  };

  const updateItem = (id: string, updates: Partial<CatalogItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const addToCart = (item: CatalogItem, unit: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id && c.unit === unit);
      if (existing) return prev.map(c => c.item.id === item.id && c.unit === unit ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { item, qty: 1, unit }];
    });
    setShowCart(true);
  };

  const sendOrderToWhatsapp = () => {
    if (cart.length === 0) return;
    let msg = `*مرحباً، أود طلب المنتجات التالية من الكتالوج: ${pageTitle}*\n\n`;
    let total = 0;
    cart.forEach((c, idx) => {
      const sub = parseFloat(c.item.price) * c.qty;
      total += sub;
      msg += `${idx+1}. *${c.item.name}*\n   الكمية: ${c.qty} ${c.unit} | السعر: ${sub.toFixed(2)}\n`;
    });
    msg += `\n*الإجمالي الكلي: ${total.toFixed(2)} ريال*`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const canvasRef = useRef<HTMLDivElement>(null);

  const downloadAsImage = async () => {
    if (!canvasRef.current) return;
    setIsGenerating(true);
    try {
      const originalTransform = canvasRef.current.style.transform;
      canvasRef.current.style.transform = 'none';
      
      const dataUrl = await toPng(canvasRef.current, {
        quality: 1,
        pixelRatio: 3,
        style: {
          transform: 'none',
          margin: '0',
        }
      });
      
      canvasRef.current.style.transform = originalTransform;
      
      const link = document.createElement('a');
      link.download = `${projectName || 'catalog'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Error downloading image:', e);
      alert('فشل تصدير الصورة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAsPdf = async () => {
    if (!canvasRef.current) return;
    setIsGenerating(true);
    try {
      const originalTransform = canvasRef.current.style.transform;
      canvasRef.current.style.transform = 'none';
      
      const dataUrl = await toJpeg(canvasRef.current, {
        quality: 1,
        pixelRatio: 3,
        style: {
          transform: 'none',
          margin: '0',
        }
      });
      
      canvasRef.current.style.transform = originalTransform;
      
      const isA4 = styleConfig.isQuotationMode;
      
      if (isA4) {
        const rect = canvasRef.current.getBoundingClientRect();
        const canvasWidth = rect.width || 794;
        const canvasHeight = rect.height || 1123;
        
        const pdf = new jsPDF({
          orientation: 'p',
          unit: 'mm',
          format: 'a4'
        });
        
        // At 794px width of A4, 1mm = 794 / 210 = 3.78 pixels.
        // Full height of image in mm = (canvasHeight / 794) * 210
        const imgHeightMm = (canvasHeight / canvasWidth) * 210;
        const pageHeightMm = 297;
        
        // 1123px is the height of a single A4 page on the canvas
        const numPages = Math.ceil(canvasHeight / 1123) || 1;
        
        for (let i = 0; i < numPages; i++) {
          if (i > 0) {
            pdf.addPage();
          }
          // Offset the image Y coordinate by -i * 297mm to render the corresponding slice on each page
          pdf.addImage(dataUrl, 'JPEG', 0, -i * pageHeightMm, 210, imgHeightMm, undefined, 'FAST');
        }
        
        pdf.save(`${projectName || 'catalog'}.pdf`);
      } else {
        const rect = canvasRef.current.getBoundingClientRect();
        const imgWidth = 375;
        const imgHeight = (rect.height / rect.width) * imgWidth;
        
        const pdfWidthMm = 100;
        const pdfHeightMm = (imgHeight / imgWidth) * pdfWidthMm;
        
        const pdf = new jsPDF({
          orientation: pdfHeightMm > pdfWidthMm ? 'p' : 'l',
          unit: 'mm',
          format: [pdfWidthMm, pdfHeightMm]
        });
        
        pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidthMm, pdfHeightMm, undefined, 'FAST');
        pdf.save(`${projectName || 'catalog'}.pdf`);
      }
    } catch (e) {
      console.error('Error downloading PDF:', e);
      alert('فشل تصدير ملف PDF. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsGenerating(false);
    }
  };

  const printCatalog = () => {
    if (!canvasRef.current) return;
    const printContainer = document.getElementById('print-container');
    if (printContainer) {
      printContainer.innerHTML = '';
      const clone = canvasRef.current.cloneNode(true) as HTMLDivElement;
      clone.style.transform = 'none';
      clone.style.width = '210mm';
      clone.style.minHeight = '297mm';
      clone.style.boxShadow = 'none';
      clone.style.margin = '0 auto';
      clone.style.padding = '0';
      clone.style.backgroundColor = styleConfig.backgroundColor || '#ffffff';
      printContainer.appendChild(clone);
      window.print();
    } else {
      window.print();
    }
  };

  const activeItem = items.find(i => i.id === activeItemId);
  const filteredProducts = useMemo(() => products.filter(p => p.name.includes(searchTerm) || p.code.includes(searchTerm)).slice(0, 20), [searchTerm, products]);

  // Group Items by Section
  const groupedItems = useMemo<Record<string, CatalogItem[]>>(() => {
    const groups: Record<string, CatalogItem[]> = {};
    items.forEach(item => {
      const sec = item.sectionName || 'منتجات متنوعة';
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(item);
    });
    return groups;
  }, [items]);

  // --- RENDERERS ---

  const Badge = ({ type, text }: { type: CatalogBadgeType, text?: string }) => {
    if (type === 'none') return null;
    const styles: Record<string, string> = {
      sale: 'bg-red-600 text-white',
      new: 'bg-blue-600 text-white',
      best_seller: 'bg-amber-500 text-white',
      limited: 'bg-black text-white',
      '1plus1': 'bg-purple-600 text-white',
      organic: 'bg-green-600 text-white'
    };
    const labels: Record<string, string> = {
      sale: 'خصم خاص', new: 'جديد', best_seller: 'الأكثر مبيعاً', limited: 'كمية محدودة', '1plus1': '1+1 مجاناً', organic: 'عضوي'
    };
    return (
      <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-black shadow-md z-10 ${styles[type]}`}>
        {text || labels[type]}
      </div>
    );
  };

  const ItemCard: React.FC<{ item: CatalogItem }> = ({ item }) => {
    const isActive = activeItemId === item.id;
    const [int, dec] = item.price.split('.');
    
    // Style Variations based on layoutType
    const isGrid = styleConfig.layoutType === 'geometric_grid';
    const isLux = styleConfig.layoutType === 'luxury_cards';
    const isRamadan = styleConfig.layoutType === 'ramadan_special';
    const isCompact = styleConfig.cardSize === 'compact';
    
    if (isRamadan) {
        const [cartonInt, cartonDec] = (item.cartonPrice || '').split('.');
        return (
            <div 
                onClick={() => !isViewerMode && setActiveItemId(item.id)}
                className={`relative group bg-white overflow-hidden transition-all duration-300 cursor-pointer flex flex-col h-full print:break-inside-avoid
                  ${isCompact ? 'rounded-2xl border' : 'rounded-[2rem] border-2'}
                  ${isViewerMode ? '' : isActive ? 'ring-4 ring-[#C5A059] z-10 scale-[1.02]' : 'hover:shadow-[0_0_20px_rgba(197,160,89,0.3)] hover:-translate-y-1'}
                  border-white/10 shadow-lg
                `}
            >
                {/* Image Area */}
                <div className={`${isCompact ? 'h-24 p-3' : 'h-36 p-5'} w-full flex items-center justify-center bg-white relative`}>
                    {item.image ? (
                        <img src={item.image} className="w-full h-full object-contain hover:scale-110 transition-transform duration-500" alt={item.name} referrerPolicy="no-referrer" />
                    ) : (
                        <div className="flex flex-col items-center opacity-20"><ImageIcon size={isCompact ? 20 : 32}/><span className="text-[7px] font-black mt-1">NO IMAGE</span></div>
                    )}
                    
                    {/* Floating Badge for Discount / Sale */}
                    <Badge type={item.badge || 'none'} text={item.discountPercent ? `خصم ${item.discountPercent}%` : undefined} />

                    {/* Add Buttons */}
                    <div className="absolute bottom-1.5 right-1.5 flex gap-1 z-10">
                        <button 
                            onClick={(e) => { e.stopPropagation(); addToCart(item, 'حبة'); }}
                            className={`rounded-full flex items-center justify-center text-white shadow-md bg-[#002b49] hover:bg-[#C5A059] transition-colors ${isCompact ? 'w-5 h-5 text-[9px] font-black' : 'w-8 h-8'}`}
                            title="إضافة حبة لسلة التسوق"
                        >
                            {isCompact ? 'ح' : <Plus size={16} strokeWidth={3} />}
                        </button>
                        {item.cartonPrice && (
                           <button 
                               onClick={(e) => { e.stopPropagation(); addToCart(item, 'كرتون'); }}
                               className={`rounded-full flex items-center justify-center text-white shadow-md bg-emerald-700 hover:bg-emerald-600 transition-colors ${isCompact ? 'w-5 h-5 text-[9px] font-black' : 'w-8 h-8'}`}
                               title="إضافة كرتون لسلة التسوق"
                           >
                               {isCompact ? 'ك' : 'ك'}
                           </button>
                        )}
                    </div>
                </div>

                {/* Info & Dual Prices Area */}
                <div className={`${isCompact ? 'p-1.5' : 'p-3'} text-center flex-1 flex flex-col justify-between bg-white border-t border-gray-50 relative`}>
                    <div>
                        <h3 className={`font-black text-[#002b49] leading-tight line-clamp-2 ${isCompact ? 'text-[9px] min-h-[2em]' : 'text-sm font-bold'}`}>{item.name}</h3>
                        {!isCompact && item.description && <div className="text-[10px] text-gray-400 font-bold mt-1 font-sans line-clamp-1">{item.description}</div>}
                    </div>

                    <div className="mt-2 space-y-1">
                        {/* Piece Price Tag */}
                        <div className="flex justify-between items-center bg-[#FFD700]/10 border border-[#FFD700]/20 px-1.5 py-0.5 rounded-lg">
                           <span className="text-[8px] font-black text-[#002b49]">الحبة:</span>
                           <div className="flex items-center gap-1">
                              {item.originalPrice && <span className="text-[7px] text-gray-400 line-through decoration-red-500 font-bold">{item.originalPrice}</span>}
                              <div className="flex items-start text-red-600 leading-none">
                                 <span className={`${isCompact ? 'text-[11px]' : 'text-xs'} font-black`}>{int}</span>
                                 <span className="text-[7px] font-black mt-0.5">.{dec||'00'}</span>
                              </div>
                           </div>
                        </div>

                        {/* Carton Price Tag */}
                        {item.cartonPrice && (
                           <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-lg">
                              <span className="text-[8px] font-black text-emerald-800">الكرتون:</span>
                              <div className="flex items-center gap-1">
                                 {item.originalCartonPrice && <span className="text-[7px] text-gray-400 line-through decoration-red-500 font-bold">{item.originalCartonPrice}</span>}
                                 <div className="flex items-start text-emerald-700 leading-none">
                                    <span className={`${isCompact ? 'text-[11px]' : 'text-xs'} font-black`}>{cartonInt}</span>
                                    <span className="text-[7px] font-black mt-0.5">.{cartonDec||'00'}</span>
                                 </div>
                              </div>
                           </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Default Rendering
    const [cartonInt, cartonDec] = (item.cartonPrice || '').split('.');
    return (
      <div 
        onClick={() => !isViewerMode && setActiveItemId(item.id)}
        className={`relative group bg-white overflow-hidden transition-all duration-300 cursor-pointer flex flex-col h-full print:break-inside-avoid
          ${isViewerMode ? '' : isActive ? 'ring-4 ring-sap-secondary z-10 scale-[1.02]' : 'hover:shadow-xl hover:-translate-y-1'}
          ${isGrid ? 'border-2 border-black rounded-none shadow-[4px_4px_0px_rgba(0,0,0,1)]' : ''}
          ${isLux ? 'rounded-tl-[2rem] rounded-br-[2rem] border-none shadow-lg' : isCompact ? 'rounded-xl border border-gray-100 shadow-sm' : 'rounded-[1.5rem] border border-gray-100 shadow-sm'}
        `}
      >
        <Badge type={item.badge || 'none'} text={item.discountPercent ? `خصم ${item.discountPercent}%` : undefined} />
        
        {/* Image */}
        <div className={`${isCompact ? 'h-24 p-3' : 'h-40 p-4'} w-full flex items-center justify-center bg-white relative overflow-hidden ${isGrid ? 'border-b-2 border-black' : ''}`}>
           {item.image ? (
             <img src={item.image} className="w-full h-full object-contain hover:scale-110 transition-transform duration-500 mix-blend-multiply" alt={item.name} referrerPolicy="no-referrer" />
           ) : (
             <div className="flex flex-col items-center opacity-20"><ImageIcon size={isCompact ? 20 : 40}/><span className="text-[8px] font-black mt-1">NO IMAGE</span></div>
           )}
           
           {/* Add To Cart Overlay Buttons */}
           <div className="absolute bottom-2 left-2 flex gap-1 z-10">
              <button 
                onClick={(e) => { e.stopPropagation(); addToCart(item, 'حبة'); }}
                className={`rounded-full flex items-center justify-center text-white shadow-lg transition-all bg-black hover:bg-sap-primary ${isCompact ? 'w-5 h-5 text-[8px] font-bold' : 'w-8 h-8 text-xs'}`}
                title="إضافة حبة"
              >
                {isCompact ? 'ح' : <Plus size={14} strokeWidth={3} />}
              </button>
              {item.cartonPrice && (
                 <button 
                   onClick={(e) => { e.stopPropagation(); addToCart(item, 'كرتون'); }}
                   className={`rounded-full flex items-center justify-center text-white shadow-lg transition-all bg-emerald-700 hover:bg-emerald-600 ${isCompact ? 'w-5 h-5 text-[8px] font-bold' : 'w-8 h-8 text-xs'}`}
                   title="إضافة كرتون"
                 >
                   {isCompact ? 'ك' : 'ك'}
                 </button>
              )}
           </div>
        </div>

        {/* Content */}
        <div className={`${isCompact ? 'p-1.5' : 'p-4'} flex-1 flex flex-col justify-between bg-white`}>
           <div className="mb-2">
              <h3 className={`font-black text-gray-800 leading-tight line-clamp-2 ${isCompact ? 'text-[9px] min-h-[2em]' : 'text-sm font-bold'}`}>{item.name}</h3>
           </div>
           
           <div className="space-y-1">
              {/* Piece Price Row */}
              <div className="flex items-center justify-between border-b border-gray-50 pb-0.5">
                 <div className="flex items-center gap-1">
                    <span className="text-[8px] font-bold text-gray-400 bg-gray-100 px-1 py-0.5 rounded">حبة</span>
                    {item.originalPrice && <span className="text-[8px] text-gray-400 line-through decoration-red-500 font-bold">{item.originalPrice}</span>}
                 </div>
                 <div className="flex items-start leading-none" style={{ color: styleConfig.primaryColor }}>
                    <span className={`${isCompact ? 'text-[11px]' : 'text-sm'} font-black`}>{int}</span>
                    <div className="flex flex-col items-start ml-0.5">
                       <span className="text-[7px] font-black">.{dec||'00'}</span>
                    </div>
                 </div>
              </div>

              {/* Carton Price Row */}
              {item.cartonPrice && (
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                       <span className="text-[8px] font-bold text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded">كرتون</span>
                       {item.originalCartonPrice && <span className="text-[8px] text-gray-400 line-through decoration-red-500 font-bold">{item.originalCartonPrice}</span>}
                    </div>
                    <div className="flex items-start leading-none text-emerald-700">
                       <span className={`${isCompact ? 'text-[11px]' : 'text-sm'} font-black`}>{cartonInt}</span>
                       <div className="flex flex-col items-start ml-0.5">
                          <span className="text-[7px] font-black font-mono">.{cartonDec||'00'}</span>
                       </div>
                    </div>
                 </div>
              )}
           </div>
        </div>
      </div>
    );
  };

  // --- VIEWER MODE RENDER ---
  if (isViewerMode) {
    const isRamadan = styleConfig.layoutType === 'ramadan_special';
    
    return (
      <div className={`min-h-screen font-sans ${isRamadan ? 'bg-[#002b49]' : 'bg-gray-100'} pb-24`} dir="rtl" style={{ fontFamily: styleConfig.fontFamily }}>
         {/* Mobile Header */}
         <div className={`sticky top-0 z-50 shadow-sm border-b px-4 py-3 flex justify-between items-center backdrop-blur-md ${isRamadan ? 'bg-[#001f35]/90 border-[#C5A059]/30 text-white' : 'bg-white/90 border-gray-200'}`}>
            <div>
               <h1 className={`text-lg font-black ${isRamadan ? 'text-[#C5A059]' : 'text-sap-primary'}`}>{pageTitle}</h1>
               <p className={`text-[10px] font-bold ${isRamadan ? 'text-gray-300' : 'text-gray-500'}`}>{pageSubtitle}</p>
            </div>
            {cart.length > 0 && (
               <button onClick={() => setShowCart(true)} className="relative p-2 bg-sap-secondary text-white rounded-full shadow-lg animate-bounce">
                  <ShoppingCart size={20} />
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full">{cart.length}</span>
               </button>
            )}
         </div>

         <div className={`mx-auto bg-white shadow-md ${styleConfig.isQuotationMode ? 'max-w-[794px] w-full rounded-2xl overflow-hidden my-6 border border-gray-200 shadow-xl' : 'max-w-lg rounded-none'}`} style={{ backgroundColor: styleConfig.backgroundColor }}>
            {/* Company & Quotation Formal Header */}
            {styleConfig.isQuotationMode && (
               <div className="p-6 bg-white border-b-2 border-slate-200 text-slate-800 space-y-4">
                  <div className="flex justify-between items-start">
                     <div className="flex items-center gap-3">
                        {styleConfig.companyLogo ? (
                           <img src={styleConfig.companyLogo} className="w-16 h-16 object-contain" alt="Logo" />
                        ) : (
                           <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
                              <Building size={32} className="text-sap-primary" />
                           </div>
                        )}
                        <div>
                           <h1 className="text-xl font-black text-slate-900">{styleConfig.companyName || 'اسم الشركة'}</h1>
                           {styleConfig.companyTaxNumber && (
                              <p className="text-[10px] text-slate-400 font-bold mt-1">الالرقم الضريبي: {styleConfig.companyTaxNumber}</p>
                           )}
                        </div>
                     </div>
                     <div className="text-left bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
                        <div className="font-black text-sap-primary text-sm mb-1">عرض سعر رسمي</div>
                        <div className="text-[10px] text-slate-400 font-bold">التاريخ: {new Date().toLocaleDateString('ar-SA')}</div>
                        <div className="text-[10px] text-slate-400 font-bold">الرقم: #{projectId.substring(0, 8).toUpperCase()}</div>
                     </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-500 pt-2 border-t border-dashed border-slate-100">
                     {styleConfig.companyPhone && (
                        <div className="flex items-center gap-1.5 font-bold">
                           <span className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center text-slate-400">📞</span>
                           <span>{styleConfig.companyPhone}</span>
                        </div>
                     )}
                     {styleConfig.companyEmail && (
                        <div className="flex items-center gap-1.5 font-bold">
                           <span className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center text-slate-400">✉️</span>
                           <span>{styleConfig.companyEmail}</span>
                        </div>
                     )}
                     {styleConfig.companyAddress && (
                        <div className="flex items-center gap-1.5 font-bold">
                           <span className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center text-slate-400">📍</span>
                           <span>{styleConfig.companyAddress}</span>
                        </div>
                     )}
                  </div>
               </div>
            )}

            {/* Content */}
            <div className="p-6 space-y-8">
               {(Object.entries(groupedItems) as [string, CatalogItem[]][]).map(([section, sectionItems]) => {
                  const cols = styleConfig.columnsCount || (styleConfig.cardSize === 'compact' ? 3 : 2);
                  const gridColsClass = 
                     cols === 1 ? 'grid-cols-1 gap-4' : 
                     cols === 3 ? 'grid-cols-3 gap-2' : 
                     cols === 4 ? 'grid-cols-4 gap-1.5' : 
                     'grid-cols-2 gap-3';
                  
                  return (
                     <div key={section} className="space-y-4">
                        <div className="flex items-center gap-3">
                           <div className={`h-6 w-1 rounded-full ${isRamadan ? 'bg-[#C5A059]' : 'bg-sap-secondary'}`}></div>
                           <h2 className={`text-base font-black ${isRamadan ? 'text-white' : 'text-gray-800'}`}>{section}</h2>
                        </div>
                        <div className={`grid ${gridColsClass}`}>
                           {Array.isArray(sectionItems) && sectionItems.map(item => <ItemCard key={item.id} item={item} />)}
                        </div>
                     </div>
                  );
               })}
            </div>

            {/* Official Footer with Terms, Signature, and Contact */}
            {styleConfig.showCompanyFooter !== false && (
               <div className="p-6 bg-slate-50 border-t border-slate-200 text-slate-700 text-xs space-y-4">
                  {styleConfig.footerTerms && (
                     <div className="space-y-1.5">
                        <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-wider">شروط وتفاصيل العرض:</h4>
                        <p className="text-[10px] text-slate-500 whitespace-pre-line leading-relaxed bg-white p-3 rounded-xl border border-slate-100">{styleConfig.footerTerms}</p>
                     </div>
                  )}
                  
                  <div className="flex justify-between items-center pt-4 border-t border-dashed border-slate-200">
                     <div className="space-y-1">
                        <div className="font-black text-[10px] text-slate-400 uppercase tracking-wider">توقيع واعتماد المؤسسة:</div>
                        <div className="w-32 h-12 border border-slate-200 bg-white/50 rounded-xl border-dashed flex items-center justify-center text-[10px] text-slate-300">الختم والتوقيع الرسمي</div>
                     </div>
                     <div className="text-left">
                        <div className="font-black text-slate-800">{styleConfig.companyName || 'اسم الشركة'}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">نشكركم على ثقتكم الغالية بمنتجاتنا</div>
                     </div>
                  </div>
               </div>
            )}
         </div>

         {/* Cart Sheet */}
         {showCart && (
            <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
               <div className="bg-white w-full sm:max-w-md h-[80vh] sm:h-auto sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom">
                  <div className="p-5 bg-gray-50 border-b flex justify-between items-center">
                     <h3 className="font-black text-lg flex items-center gap-2"><ShoppingBag size={20}/> سلة المشتريات</h3>
                     <button onClick={() => setShowCart(false)} className="bg-white p-2 rounded-full shadow-sm"><X size={18}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                     {cart.map((c, i) => {
                        const price = c.unit === 'كرتون' && c.item.cartonPrice ? parseFloat(c.item.cartonPrice) : parseFloat(c.item.price);
                        return (
                           <div key={i} className="flex gap-4 items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                              <div className="w-14 h-14 bg-gray-50 rounded-lg flex items-center justify-center">
                                 {c.item.image ? <img src={c.item.image} className="w-full h-full object-contain"/> : <Box size={20} className="opacity-20"/>}
                              </div>
                              <div className="flex-1">
                                 <div className="text-xs font-black line-clamp-1">{c.item.name}</div>
                                 <div className="text-[10px] text-gray-500 mt-1">الكمية: {c.qty} × {c.unit} | السعر: {price.toFixed(2)} ريال</div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                 <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                                    <button onClick={() => setCart(prev => prev.map((x, idx) => idx === i ? {...x, qty: x.qty+1} : x))}><Plus size={14}/></button>
                                    <span className="text-xs font-black w-4 text-center">{c.qty}</span>
                                    <button onClick={() => { if(c.qty>1) setCart(prev => prev.map((x, idx) => idx === i ? {...x, qty: x.qty-1} : x)); else setCart(prev => prev.filter((_, idx) => idx !== i)); }}><Minus size={14}/></button>
                                 </div>
                                 <div className="text-xs font-black text-sap-primary">{(price*c.qty).toFixed(2)}</div>
                              </div>
                           </div>
                        );
                     })}
                  </div>
                  <div className="p-5 border-t bg-white space-y-4">
                     <div className="flex justify-between items-end">
                        <span className="text-xs font-bold text-gray-500">الإجمالي التقريبي</span>
                        <span className="text-2xl font-black font-mono">{cart.reduce((a, b) => {
                           const price = b.unit === 'كرتون' && b.item.cartonPrice ? parseFloat(b.item.cartonPrice) : parseFloat(b.item.price);
                           return a + (price * b.qty);
                        }, 0).toFixed(2)} <span className="text-xs">SAR</span></span>
                     </div>
                     <button onClick={sendOrderToWhatsapp} className="w-full py-4 bg-[#25D366] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform">
                        <Send size={18}/> إرسال الطلب عبر واتساب
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
    );
  }

  // --- EDITOR MODE ---
  return (
    <div className="h-full flex bg-[#F0F2F5] overflow-hidden" dir="rtl">
      
      {/* 1. LEFT SIDEBAR: CONTROLS */}
      <aside className="w-[380px] bg-white border-l border-gray-200 flex flex-col shrink-0 z-20 shadow-xl h-full">
         
         {/* Sidebar Tabs */}
         <div className="flex border-b border-gray-100">
            <button onClick={() => setActiveTab('content')} className={`flex-1 py-4 text-xs font-black border-b-2 transition-all ${activeTab === 'content' ? 'border-sap-primary text-sap-primary bg-sap-highlight/20' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>المحتوى</button>
            <button onClick={() => setActiveTab('design')} className={`flex-1 py-4 text-xs font-black border-b-2 transition-all ${activeTab === 'design' ? 'border-sap-primary text-sap-primary bg-sap-highlight/20' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>التصميم</button>
            <button onClick={() => setActiveTab('style')} className={`flex-1 py-4 text-xs font-black border-b-2 transition-all ${activeTab === 'style' ? 'border-sap-primary text-sap-primary bg-sap-highlight/20' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>الهوية</button>
         </div>

         <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
            
            {activeTab === 'content' && (
               <div className="space-y-6 animate-in slide-in-from-right-4">
                  {/* Global Info */}
                  <div className="space-y-4 bg-slate-50 p-5 rounded-3xl border border-slate-200/60 shadow-sm">
                     <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2"><FolderOpen size={16} strokeWidth={2.5}/> إعدادات المشروع الأساسية</h4>
                     
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 ml-1">اسم المشروع (للحفظ الداخلي)</label>
                        <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} className="w-full text-sm font-bold p-3 border-slate-200 border rounded-xl focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary transition-all bg-white" placeholder="مثال: مجلة رمضان 2026" />
                     </div>
                     
                     <div className="space-y-1 mt-4">
                        <h4 className="text-[10px] font-bold text-slate-500 ml-1 mt-4 mb-2 flex items-center gap-2"><Type size={14}/> نصوص واجهة المجلة</h4>
                        <input type="text" value={pageTitle} onChange={e => setPageTitle(e.target.value)} className="w-full text-sm font-bold p-3 border-slate-200 border rounded-xl focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary transition-all bg-white" placeholder="العنوان الرئيسي للمجلة" />
                     </div>
                     
                     <div className="space-y-1">
                        <input type="text" value={pageSubtitle} onChange={e => setPageSubtitle(e.target.value)} className="w-full text-xs p-3 border-slate-200 border rounded-xl focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary transition-all bg-white" placeholder="العنوان الفرعي الوصفي..." />
                     </div>

                     <div className="space-y-1 pt-2">
                        <label className="text-[10px] font-bold text-slate-500 ml-1 flex items-center gap-1"><MessageCircle size={12}/> رقم استقبال الطلبات (واتساب)</label>
                        <div className="relative">
                           <input type="text" value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} className="w-full text-xs font-bold font-mono p-3 border-slate-200 border rounded-xl pr-10 focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all bg-white" placeholder="966500000000" dir="ltr" />
                           <MessageCircle size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#25D366]"/>
                        </div>
                     </div>
                  </div>

                  {/* Active Item Editor */}
                  {activeItem ? (
                     <div className="space-y-4 border-t pt-6 mt-4 border-slate-100">
                        <div className="flex justify-between items-center bg-sap-highlight/20 p-2 rounded-xl">
                           <span className="text-[11px] font-black text-sap-primary pr-2 px-3 flex items-center gap-2"><Sparkles size={14}/> تعديل: {activeItem.name}</span>
                           <button onClick={() => { setActiveItemId(null); }} className="text-gray-400 hover:text-gray-600 bg-white p-1 rounded-full shadow-sm hover:shadow transition-all"><X size={16}/></button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-3xl border border-slate-200/60 shadow-sm">
                           <div className="col-span-2">
                              <label className="text-[10px] font-bold text-slate-500 block mb-1">اسم المنتج</label>
                              <input type="text" value={activeItem.name} onChange={e => updateItem(activeItem.id, { name: e.target.value })} className="w-full p-2.5 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary transition-all" />
                           </div>
                           <div className="col-span-2">
                              <label className="text-[10px] font-bold text-slate-500 block mb-1">وصف قصير (يظهر في بعض القوالب)</label>
                              <textarea value={activeItem.description || ''} onChange={e => updateItem(activeItem.id, { description: e.target.value })} rows={2} className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary transition-all resize-none" placeholder="وصف المنتج..." />
                           </div>
                           <div>
                              <label className="text-[10px] font-bold text-slate-500 block mb-1">سعر الحبة (شامل الضريبة)</label>
                              <input type="text" value={activeItem.price} onChange={e => updateItem(activeItem.id, { price: e.target.value })} className="w-full p-2.5 text-sm font-black text-sap-primary border border-slate-200 rounded-xl focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary transition-all bg-sap-highlight/5" />
                           </div>
                           <div>
                              <label className="text-[10px] font-bold text-slate-500 block mb-1">السعر السابق للحبة</label>
                              <input type="text" value={activeItem.originalPrice || ''} onChange={e => updateItem(activeItem.id, { originalPrice: e.target.value })} className="w-full p-2.5 text-sm font-bold text-red-500 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all line-through bg-red-50/50" />
                           </div>
                           <div>
                              <label className="text-[10px] font-bold text-slate-500 block mb-1">سعر الكرتون</label>
                              <input type="text" value={activeItem.cartonPrice || ''} onChange={e => updateItem(activeItem.id, { cartonPrice: e.target.value })} className="w-full p-2.5 text-sm font-black text-emerald-700 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-emerald-50/30" placeholder="مثال: 45.00" />
                           </div>
                           <div>
                              <label className="text-[10px] font-bold text-slate-500 block mb-1">السعر السابق للكرتون</label>
                              <input type="text" value={activeItem.originalCartonPrice || ''} onChange={e => updateItem(activeItem.id, { originalCartonPrice: e.target.value })} className="w-full p-2.5 text-sm font-bold text-red-500 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all line-through bg-red-50/50" placeholder="مثال: 55.00" />
                           </div>
                           <div>
                              <label className="text-[10px] font-bold text-slate-500 block mb-1">القسم الأب</label>
                              <input type="text" value={activeItem.sectionName} onChange={e => updateItem(activeItem.id, { sectionName: e.target.value })} className="w-full p-2.5 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary transition-all" list="sections" />
                              <datalist id="sections">
                                 <option value="خضروات وفواكه" />
                                 <option value="لحوم ودواجن" />
                                 <option value="مخبوزات" />
                                 <option value="معلبات" />
                              </datalist>
                           </div>
                           <div>
                              <label className="text-[10px] font-bold text-slate-500 block mb-1">وحدة البيع</label>
                              <select value={activeItem.unitName} onChange={e => updateItem(activeItem.id, { unitName: e.target.value })} className="w-full p-2.5 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary transition-all bg-white">
                                 <option value="قطعة">قطعة</option>
                                 <option value="كرتون">كرتون</option>
                                 <option value="كيلو">كيلو</option>
                                 <option value="حبة">حبة</option>
                                 <option value="ربطة">ربطة</option>
                                 {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                              </select>
                           </div>
                        </div>

                        {/* Order Arranger */}
                        <div className="bg-slate-50 p-3 rounded-2xl flex items-center justify-between border border-slate-200">
                           <span className="text-[10px] font-bold text-slate-600">ترتيب المنتج:</span>
                           <div className="flex gap-2">
                              <button onClick={() => moveItem(activeItem.id, 'up')} className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm hover:border-sap-primary hover:text-sap-primary transition-colors text-slate-500" title="تحريك لأعلى">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                              </button>
                              <button onClick={() => moveItem(activeItem.id, 'down')} className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm hover:border-sap-primary hover:text-sap-primary transition-colors text-slate-500" title="تحريك لأسفل">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                              </button>
                           </div>
                        </div>

                        {/* Badges */}
                        <div>
                           <label className="text-[10px] font-bold text-slate-500 block mb-2">شارة العرض (Badge)</label>
                           <div className="flex flex-wrap gap-2">
                              {['sale', 'new', '1plus1', 'limited', 'best_seller'].map((b: any) => (
                                 <button 
                                    key={b} 
                                    onClick={() => updateItem(activeItem.id, { badge: activeItem.badge === b ? 'none' : b })}
                                    className={`px-3 py-1 rounded-full text-[10px] font-black border transition-all ${activeItem.badge === b ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200'}`}
                                 >
                                    {b}
                                 </button>
                              ))}
                           </div>
                        </div>

                        {/* AI Image Gen */}
                        <div className="pt-2">
                           <button onClick={() => generateAiImage(activeItem)} disabled={isGenerating} className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all">
                              {isGenerating ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} توليد صورة واقعية (AI Studio)
                           </button>
                           <p className="text-[9px] text-gray-400 mt-2 text-center">يستخدم Gemini 3 Pro لإنتاج صور دعائية عالية الدقة</p>
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" onChange={async(e) => {
                           const file = e.target.files?.[0];
                           if(file) {
                              const reader = new FileReader();
                              reader.onload = async(re) => {
                                 const c = await compressImage(re.target?.result as string);
                                 updateItem(activeItem.id, { image: c });
                              }
                              reader.readAsDataURL(file);
                           }
                        }} />
                        <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 border border-gray-300 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50">رفع صورة يدوياً</button>
                        
                        <button onClick={() => { setItems(items.filter(i => i.id !== activeItem.id)); setActiveItemId(null); }} className="w-full py-2 text-red-500 text-xs font-bold hover:bg-red-50 rounded-xl flex items-center justify-center gap-2"><Trash2 size={14}/> حذف المنتج</button>
                     </div>
                  ) : (
                     <div className="flex flex-col items-center justify-center py-12 text-gray-300 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
                        <MousePointer2 size={32} className="mb-2 opacity-50"/>
                        <p className="text-xs font-bold">اضغط على أي منتج في المعاينة لتعديله</p>
                     </div>
                  )}
               </div>
            )}

            {activeTab === 'design' && (
               <div className="space-y-6 animate-in slide-in-from-right-4">
                  {/* Presentation Mode */}
                  <div className="space-y-3 bg-slate-50 p-5 rounded-3xl border border-slate-200/60 shadow-sm">
                     <h4 className="text-xs font-black text-slate-500 flex items-center gap-2 mb-2"><Smartphone size={16} strokeWidth={2.5}/> مقاس وحجم التصميم</h4>
                     <div className="grid grid-cols-2 gap-3">
                        <button 
                           onClick={() => setStyleConfig({...styleConfig, isQuotationMode: false})} 
                           className={`p-3 border rounded-xl flex flex-col items-center gap-1 transition-all ${!styleConfig.isQuotationMode ? 'bg-sap-primary text-white border-sap-primary shadow-md' : 'bg-white hover:border-slate-300 text-slate-600'}`}
                        >
                           <span className="text-[11px] font-black">شاشة الجوال (375px)</span>
                        </button>
                        <button 
                           onClick={() => setStyleConfig({...styleConfig, isQuotationMode: true})} 
                           className={`p-3 border rounded-xl flex flex-col items-center gap-1 transition-all ${styleConfig.isQuotationMode ? 'bg-sap-primary text-white border-sap-primary shadow-md' : 'bg-white hover:border-slate-300 text-slate-600'}`}
                        >
                           <span className="text-[11px] font-black">مقاس ورقة A4 للطباعة</span>
                        </button>
                     </div>
                     <p className="text-[10px] text-gray-400 mt-1">نمط ورقة A4 يضبط أبعاد التصميم لتطابق تماماً قياسات الطباعة الورقية (210mm x 297mm) مع الهوامش الرسمية.</p>
                  </div>

                  {/* Columns Count Control */}
                  <div className="space-y-3 bg-slate-50 p-5 rounded-3xl border border-slate-200/60 shadow-sm">
                     <h4 className="text-xs font-black text-slate-500 flex items-center gap-2 mb-2"><Grid size={16} strokeWidth={2.5}/> عدد المنتجات بالعرض (أعمدة)</h4>
                     <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map(cols => (
                           <button 
                              key={cols}
                              onClick={() => setStyleConfig({...styleConfig, columnsCount: cols})} 
                              className={`py-2 px-1 border rounded-xl text-center font-black text-xs transition-all ${styleConfig.columnsCount === cols || (!styleConfig.columnsCount && cols === 2) ? 'bg-sap-primary text-white border-sap-primary shadow-sm' : 'bg-white text-slate-600'}`}
                           >
                              {cols === 1 ? '1 عمود' : cols === 2 ? '2 عمود' : cols === 3 ? '3 أعمدة' : '4 أعمدة'}
                           </button>
                        ))}
                     </div>
                  </div>

                  {/* Layout Style Templates */}
                  <div className="space-y-3 bg-slate-50 p-5 rounded-3xl border border-slate-200/60 shadow-sm">
                     <h4 className="text-xs font-black text-slate-500 flex items-center gap-2 mb-2"><Smartphone size={16} strokeWidth={2.5}/> تصميم الكروت ونمط العرض</h4>
                     <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setStyleConfig({...styleConfig, layoutType: 'app_modern'})} className={`p-3 border rounded-xl flex flex-col items-center gap-1 transition-all ${styleConfig.layoutType === 'app_modern' ? 'bg-sap-primary text-white border-sap-primary' : 'bg-white text-slate-600'}`}>
                           <span className="text-[10px] font-bold">تطبيق عصري</span>
                        </button>
                        <button onClick={() => setStyleConfig({...styleConfig, layoutType: 'geometric_grid'})} className={`p-3 border rounded-xl flex flex-col items-center gap-1 transition-all ${styleConfig.layoutType === 'geometric_grid' ? 'bg-sap-primary text-white border-sap-primary' : 'bg-white text-slate-600'}`}>
                           <span className="text-[10px] font-bold">شبكة هندسية</span>
                        </button>
                        <button onClick={() => setStyleConfig({...styleConfig, layoutType: 'restaurant_menu'})} className={`p-3 border rounded-xl flex flex-col items-center gap-1 transition-all ${styleConfig.layoutType === 'restaurant_menu' ? 'bg-sap-primary text-white border-sap-primary' : 'bg-white text-slate-600'}`}>
                           <span className="text-[10px] font-bold">قائمة مطعم</span>
                        </button>
                        <button onClick={() => setStyleConfig({...styleConfig, layoutType: 'luxury_cards'})} className={`p-3 border rounded-xl flex flex-col items-center gap-1 transition-all ${styleConfig.layoutType === 'luxury_cards' ? 'bg-sap-primary text-white border-sap-primary' : 'bg-white text-slate-600'}`}>
                           <span className="text-[10px] font-bold">نمط فاخر</span>
                        </button>
                        <button onClick={() => setStyleConfig({...styleConfig, layoutType: 'ramadan_special', backgroundColor: '#002b49', primaryColor: '#C5A059'})} className={`col-span-2 p-3 border rounded-xl flex items-center justify-center gap-2 transition-all ${styleConfig.layoutType === 'ramadan_special' ? 'bg-[#002b49] text-[#C5A059] border-[#C5A059]' : 'bg-white text-slate-600'}`}>
                           <Moon size={14}/> <span className="text-[10px] font-black">تصميم رمضاني خاص</span>
                        </button>
                     </div>
                  </div>

                  {/* Card Border Radius */}
                  <div className="space-y-4 bg-slate-50 p-5 rounded-3xl border border-slate-200/60 shadow-sm">
                     <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-500">انحناء زوايا الكروت</label>
                        <span className="text-xs font-bold bg-slate-200 px-2 py-0.5 rounded-full text-slate-600">{styleConfig.borderRadius}px</span>
                     </div>
                     <input type="range" min="0" max="32" value={styleConfig.borderRadius} onChange={e => setStyleConfig({...styleConfig, borderRadius: Number(e.target.value)})} className="w-full accent-sap-primary" />
                  </div>
               </div>
            )}

            {activeTab === 'style' && (
               <div className="space-y-6 animate-in slide-in-from-right-4">
                  {/* Company Info */}
                  <div className="space-y-4 bg-slate-50 p-5 rounded-3xl border border-slate-200/60 shadow-sm">
                     <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-widest"><Building size={14}/> بيانات ومعلومات الشركة</label>
                     
                     {/* Company Logo Upload */}
                     <div className="space-y-2 pt-2">
                        <label className="text-[10px] font-bold text-slate-400 block">شعار الشركة (Logo)</label>
                        <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-inner">
                           <div className="w-14 h-14 bg-slate-50 rounded-xl border flex items-center justify-center overflow-hidden">
                              {styleConfig.companyLogo ? (
                                 <img src={styleConfig.companyLogo} className="w-full h-full object-contain" alt="Logo" />
                              ) : (
                                 <Building size={24} className="text-slate-300" />
                              )}
                           </div>
                           <div className="flex-1 space-y-1">
                              <input 
                                 type="file" 
                                 ref={logoFileInputRef} 
                                 className="hidden" 
                                 accept="image/*"
                                 onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if(file) {
                                       const reader = new FileReader();
                                       reader.onload = async(re) => {
                                          const compressed = await compressImage(re.target?.result as string);
                                          setStyleConfig(prev => ({ ...prev, companyLogo: compressed }));
                                       }
                                       reader.readAsDataURL(file);
                                    }
                                 }} 
                              />
                              <button 
                                 onClick={() => logoFileInputRef.current?.click()} 
                                 className="px-3 py-1.5 bg-sap-primary text-white rounded-lg text-[10px] font-black shadow-sm hover:bg-sap-primary-hover transition-colors"
                              >
                                 رفع الشعار
                              </button>
                              {styleConfig.companyLogo && (
                                 <button 
                                    onClick={() => setStyleConfig(prev => ({ ...prev, companyLogo: null }))} 
                                    className="px-2 py-1.5 text-red-500 text-[10px] font-bold block"
                                 >
                                    إزالة الشعار
                                 </button>
                              )}
                           </div>
                        </div>
                     </div>

                     {/* Company Name */}
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 block">اسم الشركة / المؤسسة</label>
                        <input 
                           type="text" 
                           value={styleConfig.companyName || ''} 
                           onChange={e => setStyleConfig({ ...styleConfig, companyName: e.target.value })} 
                           className="w-full p-2.5 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-sap-primary bg-white" 
                           placeholder="مؤسسة مسارات التجارية" 
                        />
                     </div>

                     {/* Tax Number */}
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 block">الرقم الضريبي (VAT)</label>
                        <input 
                           type="text" 
                           value={styleConfig.companyTaxNumber || ''} 
                           onChange={e => setStyleConfig({ ...styleConfig, companyTaxNumber: e.target.value })} 
                           className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-sap-primary bg-white font-mono" 
                           placeholder="310123456700003" 
                        />
                     </div>

                     {/* Phone & Email */}
                     <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold text-slate-400 block">الهاتف / الجوال</label>
                           <input 
                              type="text" 
                              value={styleConfig.companyPhone || ''} 
                              onChange={e => setStyleConfig({ ...styleConfig, companyPhone: e.target.value })} 
                              className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-sap-primary bg-white font-mono" 
                              placeholder="966500000000" 
                           />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold text-slate-400 block">البريد الإلكتروني</label>
                           <input 
                              type="text" 
                              value={styleConfig.companyEmail || ''} 
                              onChange={e => setStyleConfig({ ...styleConfig, companyEmail: e.target.value })} 
                              className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-sap-primary bg-white" 
                              placeholder="info@company.com" 
                           />
                        </div>
                     </div>

                     {/* Address */}
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 block">العنوان الجغرافي</label>
                        <input 
                           type="text" 
                           value={styleConfig.companyAddress || ''} 
                           onChange={e => setStyleConfig({ ...styleConfig, companyAddress: e.target.value })} 
                           className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-sap-primary bg-white" 
                           placeholder="الرياض، المملكة العربية السعودية" 
                        />
                     </div>
                  </div>

                  {/* Document Footer Terms */}
                  <div className="space-y-4 bg-slate-50 p-5 rounded-3xl border border-slate-200/60 shadow-sm">
                     <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-widest"><FileText size={14}/> الشروط والتذييل (Footer)</label>
                     <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-400">إظهار تذييل المستند</label>
                        <input 
                           type="checkbox" 
                           checked={styleConfig.showCompanyFooter !== false} 
                           onChange={e => setStyleConfig({ ...styleConfig, showCompanyFooter: e.target.checked })} 
                           className="w-4 h-4 rounded text-sap-primary focus:ring-sap-primary" 
                        />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 block">ملاحظات وشروط العرض</label>
                        <textarea 
                           value={styleConfig.footerTerms || ''} 
                           onChange={e => setStyleConfig({ ...styleConfig, footerTerms: e.target.value })} 
                           rows={3} 
                           className="w-full p-2.5 text-[10px] border border-slate-200 rounded-xl focus:ring-2 focus:ring-sap-primary bg-white resize-none" 
                           placeholder="شروط وتفاصيل العرض..." 
                        />
                     </div>
                  </div>

                  {/* Colors and Fonts */}
                  <div className="space-y-4 bg-slate-50 p-5 rounded-3xl border border-slate-200/60 shadow-sm">
                     <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-widest"><Palette size={14}/> الألوان والخطوط</label>
                     <div className="space-y-2 pt-2">
                        <label className="text-[10px] font-bold text-slate-400">اللون الأساسي (Primary Color)</label>
                        <div className="flex flex-wrap gap-2">
                           {['#00A09D', '#006C35', '#DC2626', '#2563EB', '#000000', '#7C3AED', '#C5A059'].map(c => (
                              <button key={c} onClick={() => setStyleConfig({...styleConfig, primaryColor: c})} className={`w-9 h-9 rounded-full shadow-sm transition-all ${styleConfig.primaryColor === c ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'}`} style={{ backgroundColor: c }} />
                           ))}
                           <div className="relative group">
                               <input type="color" value={styleConfig.primaryColor} onChange={e => setStyleConfig({...styleConfig, primaryColor: e.target.value})} className="w-9 h-9 rounded-full overflow-hidden border-none p-0 cursor-pointer shadow-sm opacity-0 absolute inset-0 z-10" />
                               <div className="w-9 h-9 rounded-full bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)] flex items-center justify-center opacity-80 group-hover:opacity-100 transition-all"><Plus size={16} color="white" className="drop-shadow-md"/></div>
                           </div>
                        </div>
                     </div>
                     <div className="space-y-2 pt-2 border-t">
                        <label className="text-[10px] font-bold text-slate-400">نوع الخط (Typography)</label>
                        <select value={styleConfig.fontFamily} onChange={e => setStyleConfig({...styleConfig, fontFamily: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold">
                           <option value="Cairo">Cairo (عصري - موصى به)</option>
                           <option value="Segoe UI">Segoe UI (رسمي)</option>
                           <option value="Tahoma">Tahoma (كلاسيكي)</option>
                        </select>
                     </div>
                  </div>
               </div>
            )}

         </div>

         {/* Bottom Actions */}
         <div className="p-4 border-t bg-white shadow-lg space-y-2">
            <button onClick={() => setShowProductPicker(true)} className="w-full py-3 bg-black text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 hover:bg-gray-800 transition-all shadow-lg"><Plus size={16}/> إضافة منتج</button>
            <button onClick={handleSave} disabled={isSaving} className="w-full py-3 bg-sap-primary text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 hover:bg-sap-primary-hover transition-all shadow-lg">
               {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} حفظ المجلة
            </button>
         </div>
      </aside>

      {/* 2. MAIN CANVAS */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
         
         {/* Toolbar */}
         <div className="h-14 bg-white border-b flex justify-between items-center px-6 shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-2">
               <button onClick={() => setZoom(z => Math.max(50, z-10))} className="p-2 hover:bg-gray-100 rounded-lg" title="تصغير"><ZoomOut size={18}/></button>
               <span className="text-xs font-mono font-bold w-8 text-center">{zoom}%</span>
               <button onClick={() => setZoom(z => Math.min(150, z+10))} className="p-2 hover:bg-gray-100 rounded-lg" title="تكبير"><ZoomIn size={18}/></button>
               
               <div className="h-6 w-[1px] bg-gray-200 mx-2"></div>
               
               <button 
                  onClick={downloadAsImage} 
                  disabled={isGenerating} 
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-black flex items-center gap-1 transition-all"
                  title="تحميل المجلة كصورة PNG عالية الدقة"
               >
                  {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                  <span>تحميل كصورة</span>
               </button>
               <button 
                  onClick={downloadAsPdf} 
                  disabled={isGenerating} 
                  className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-black flex items-center gap-1 transition-all"
                  title="تحميل المجلة كملف PDF"
               >
                  {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  <span>تحميل PDF</span>
               </button>
               <button 
                  onClick={printCatalog} 
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-black flex items-center gap-1 transition-all"
                  title="طباعة العرض مباشرة بتنسيق A4"
               >
                  <Printer size={14} />
                  <span>طباعة ورقة A4</span>
               </button>
            </div>
            <div className="flex items-center gap-2">
               <button onClick={() => setShowShareModal(true)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold flex items-center gap-2"><QrCode size={16}/> نشر</button>
               <button onClick={() => window.open(shareableUrl, '_blank')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold flex items-center gap-2"><Eye size={16}/> معاينة</button>
               <button onClick={() => setShowSavedModal(true)} className="p-2 hover:bg-gray-100 rounded-lg"><FolderOpen size={18}/></button>
            </div>
         </div>

         {/* Canvas Area */}
         <div className="flex-1 overflow-auto bg-[#E5E7EB] flex justify-center items-start p-10 custom-scrollbar">
            <div 
               ref={canvasRef}
               className="bg-white shadow-[0_20px_60px_rgba(0,0,0,0.15)] transition-all origin-top relative overflow-hidden"
               style={{
                  width: styleConfig.isQuotationMode ? '794px' : '375px',
                  minHeight: styleConfig.isQuotationMode ? '1123px' : '812px',
                  transform: `scale(${zoom / 100})`,
                  backgroundColor: styleConfig.backgroundColor,
                  fontFamily: styleConfig.fontFamily
               }}
            >
               {/* App Header Simulation */}
                {/* Company & Quotation Formal Header */}
                {styleConfig.isQuotationMode && (
                   <div className="p-6 bg-white border-b-2 border-slate-200 text-slate-800 space-y-4 text-right" dir="rtl">
                      <div className="flex justify-between items-start">
                         <div className="flex items-center gap-3">
                            {styleConfig.companyLogo ? (
                               <img src={styleConfig.companyLogo} className="w-16 h-16 object-contain" alt="Logo" />
                            ) : (
                               <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
                                  <Building size={32} className="text-sap-primary" />
                                </div>
                            )}
                            <div>
                               <h1 className="text-xl font-black text-slate-900">{styleConfig.companyName || 'اسم الشركة'}</h1>
                               {styleConfig.companyTaxNumber && (
                                  <p className="text-[10px] text-slate-400 font-bold mt-1">الرقم الضريبي: {styleConfig.companyTaxNumber}</p>
                               )}
                            </div>
                         </div>
                         <div className="text-left bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
                            <div className="font-black text-sap-primary text-sm mb-1">عرض سعر رسمي</div>
                            <div className="text-[10px] text-slate-400 font-bold">التاريخ: {new Date().toLocaleDateString('ar-SA')}</div>
                            <div className="text-[10px] text-slate-400 font-bold">الرقم: #{projectId.substring(0, 8).toUpperCase()}</div>
                         </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-500 pt-2 border-t border-dashed border-slate-100">
                         {styleConfig.companyPhone && (
                            <div className="flex items-center gap-1.5 font-bold">
                               <span className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center text-slate-400">📞</span>
                               <span>{styleConfig.companyPhone}</span>
                            </div>
                         )}
                         {styleConfig.companyEmail && (
                            <div className="flex items-center gap-1.5 font-bold">
                               <span className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center text-slate-400">✉️</span>
                               <span>{styleConfig.companyEmail}</span>
                            </div>
                         )}
                         {styleConfig.companyAddress && (
                            <div className="flex items-center gap-1.5 font-bold">
                               <span className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center text-slate-400">📍</span>
                               <span>{styleConfig.companyAddress}</span>
                            </div>
                         )}
                      </div>
                   </div>
                )}

                {/* App Header Simulation */}
                {!styleConfig.isQuotationMode && styleConfig.showHeader && (
                  <div className={`backdrop-blur-sm sticky top-0 z-20 px-4 py-4 border-b shadow-sm ${styleConfig.layoutType === 'ramadan_special' ? 'bg-[#002b49]/90 border-[#C5A059]/30 text-white' : 'bg-white/80 border-black/5 text-gray-800'}`}>
                     <div className="flex justify-between items-center">
                        <div>
                           <h2 className={`text-lg font-black leading-none ${styleConfig.layoutType === 'ramadan_special' ? 'text-[#C5A059]' : 'text-gray-800'}`}>{pageTitle}</h2>
                           <p className={`text-[10px] font-bold mt-1 ${styleConfig.layoutType === 'ramadan_special' ? 'text-gray-300' : 'text-gray-500'}`}>{pageSubtitle}</p>
                        </div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${styleConfig.layoutType === 'ramadan_special' ? 'bg-[#C5A059] text-white' : 'bg-sap-secondary text-white'}`}>
                           <ShoppingBag size={14}/>
                        </div>
                     </div>
                  </div>
               )}

               {/* Sections & Items */}
               <div className="p-4 space-y-6 pb-20">
                  {Object.keys(groupedItems).length === 0 && (
                     <div className="py-20 text-center opacity-30">
                        <ShoppingBag size={48} className={`mx-auto mb-2 ${styleConfig.layoutType === 'ramadan_special' ? 'text-white' : 'text-gray-400'}`}/>
                        <p className={`text-xs font-bold ${styleConfig.layoutType === 'ramadan_special' ? 'text-white' : 'text-gray-600'}`}>أضف منتجات للبدء</p>
                     </div>
                  )}
                  {Object.entries(groupedItems).map(([section, sectionItems]) => {
                     const cols = styleConfig.columnsCount || (styleConfig.cardSize === 'compact' ? 3 : 2);
                     const gridColsClass = 
                        cols === 1 ? 'grid-cols-1 gap-4' : 
                        cols === 3 ? 'grid-cols-3 gap-2' : 
                        cols === 4 ? 'grid-cols-4 gap-1.5' : 
                        'grid-cols-2 gap-3';
                     
                     return (
                        <div key={section} className="space-y-3">
                           <div className="flex items-center gap-2">
                              <div className={`w-1 h-4 rounded-full ${styleConfig.layoutType === 'ramadan_special' ? 'bg-[#C5A059]' : ''}`} style={{ backgroundColor: styleConfig.layoutType !== 'ramadan_special' ? styleConfig.primaryColor : undefined }}></div>
                              <h3 className={`font-black text-sm ${styleConfig.layoutType === 'ramadan_special' ? 'text-white' : 'text-gray-700'}`}>{section}</h3>
                           </div>
                           <div className={`grid ${gridColsClass}`}>
                              {Array.isArray(sectionItems) && sectionItems.map(item => <ItemCard key={item.id} item={item} />)}
                           </div>
                        </div>
                     );
                  })}
                {/* Official Footer with Terms, Signature, and Contact */}
                {styleConfig.showCompanyFooter !== false && (
                   <div className="p-6 bg-slate-50 border-t border-slate-200 mt-8 text-slate-700 text-xs space-y-4 text-right" dir="rtl">
                      {styleConfig.footerTerms && (
                         <div className="space-y-1.5">
                            <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-wider">شروط وتفاصيل العرض:</h4>
                            <p className="text-[10px] text-slate-500 whitespace-pre-line leading-relaxed bg-white p-3 rounded-xl border border-slate-100">{styleConfig.footerTerms}</p>
                         </div>
                      )}
                      
                      <div className="flex justify-between items-center pt-4 border-t border-dashed border-slate-200">
                         <div className="space-y-1">
                            <div className="font-black text-[10px] text-slate-400 uppercase tracking-wider">توقيع واعتماد المؤسسة:</div>
                            <div className="w-32 h-12 border border-slate-200 bg-white/50 rounded-xl border-dashed flex items-center justify-center text-[10px] text-slate-300">الختم والتوقيع الرسمي</div>
                         </div>
                         <div className="text-left">
                            <div className="font-black text-slate-800">{styleConfig.companyName || 'اسم الشركة'}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">نشكركم على ثقتكم الغالية بمنتجاتنا</div>
                         </div>
                      </div>
                   </div>
                )}
               </div>

               {/* Floating Cart Button Sim */}
               {!styleConfig.isQuotationMode && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 text-xs font-black cursor-pointer hover:scale-105 transition-transform">
                     <ShoppingBag size={16}/> <span>سلة الشراء</span>
                  </div>
               )}
            </div>
         </div>
      </main>

      {/* --- MODALS --- */}
      
      {/* Product Picker */}
      {showProductPicker && (
         <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-in fade-in">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
               <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-black text-lg text-slate-800 flex items-center gap-2"><ShoppingBag size={20} className="text-sap-primary"/> إضافة منتج للمجلة</h3>
                  <button onClick={() => setShowProductPicker(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><X size={20}/></button>
               </div>
               <div className="p-5 bg-white border-b border-slate-100 relative">
                  <input type="text" placeholder="البحث بالاسم أو الباركود..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-4 pl-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary font-bold text-sm transition-all" autoFocus />
                  <div className="absolute left-9 top-1/2 -translate-y-1/2 text-slate-400 bg-white p-1 rounded-md shadow-sm border border-slate-100 font-mono text-[10px]">كيبورد</div>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/30">
                  <button onClick={() => addItem()} className="w-full py-4 border-2 border-dashed border-sap-primary/30 bg-sap-highlight/5 rounded-2xl text-sap-primary font-bold hover:bg-sap-highlight/20 hover:border-sap-primary transition-all mb-4 flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"><Plus size={18}/> إضافة عنصر مخصص (فارغ)</button>
                  <div className="grid gap-2">
                     {(filteredProducts as Product[]).map(p => (
                        <div key={p.id} onClick={() => addItem(p)} className="flex justify-between items-center p-4 bg-white hover:bg-sap-highlight/10 cursor-pointer rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-sap-primary/30 transition-all group">
                           <div>
                              <div className="font-bold text-slate-800 group-hover:text-sap-primary transition-colors">{p.name}</div>
                              <div className="text-[11px] font-bold text-slate-400 font-mono mt-1 flex items-center gap-1"><QrCode size={12}/> {p.code}</div>
                           </div>
                           <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-sap-primary group-hover:text-white transition-all shadow-sm">
                              <Plus size={16}/>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* Saved Projects */}
      {showSavedModal && (
         <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95">
               <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-black text-lg text-slate-800 flex items-center gap-2"><FolderOpen size={20} className="text-sap-primary"/> الأرشيف: مشاريع المجلات</h3>
                  <button onClick={() => setShowSavedModal(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><X size={20}/></button>
               </div>
               <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/30">
                  {(savedCatalogs as CatalogProject[]).map(cat => (
                     <div key={cat.id} onClick={() => loadProject(cat)} className="flex justify-between items-center p-4 bg-white hover:bg-sap-highlight/10 cursor-pointer rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-sap-primary/30 transition-all group">
                        <div>
                           <div className="font-bold text-sm text-slate-800 group-hover:text-sap-primary transition-colors">{cat.name}</div>
                           <div className="text-[11px] font-bold text-slate-400 mt-1 flex items-center gap-1">
                               <MapPin size={10} className="text-slate-300"/> 
                               {new Date(cat.date).toLocaleString('ar-SA')} 
                               <span className="mx-1">•</span>
                               <Package size={10} className="text-slate-300"/>
                               {cat.items?.length || 0} منتج
                           </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-sap-primary group-hover:text-white transition-all shadow-sm">
                           <ArrowRight size={16}/>
                        </div>
                     </div>
                  ))}
                  {savedCatalogs.length === 0 && (
                     <div className="py-12 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                        <FolderOpen size={32} className="mb-3 opacity-20"/>
                        <p className="font-bold text-sm">لا توجد مشاريع سابقة</p>
                     </div>
                  )}
               </div>
            </div>
         </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
         <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-8 animate-in zoom-in">
            <div className="bg-white w-full max-w-md rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-sap-primary to-sap-secondary"></div>
               <h3 className="text-2xl font-black mb-2 text-gray-900">نشر المجلة</h3>
               <p className="text-xs text-gray-500 font-bold mb-8">امسح الباركود لفتح المجلة في وضع المشاهدة (التطبيق)</p>
               
               <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100 inline-block mb-8">
                  <img src={qrCodeImageUrl} alt="QR Code" className="w-48 h-48 mix-blend-multiply" />
               </div>

               <div className="flex flex-col gap-3">
                  <button onClick={() => window.open(shareableUrl, '_blank')} className="w-full py-3 bg-black text-white rounded-xl font-black text-xs hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
                     <ExternalLink size={16}/> فتح الرابط المباشر
                  </button>
                  <button onClick={() => setShowShareModal(false)} className="text-gray-400 text-xs font-bold hover:text-gray-600">إغلاق</button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
};
