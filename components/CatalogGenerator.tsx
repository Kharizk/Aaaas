import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Product,
  Unit,
  CatalogProject,
  CatalogItem,
  CatalogStyleConfig,
  CatalogLayoutType,
  CatalogBadgeType,
} from '../types';
import { db } from '../services/supabase';
import { useSystemSettings } from './SystemSettingsContext';
import { CurrencySymbolRenderer } from './CurrencySymbolRenderer';
import { useNotification } from './Notifications';
import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import {
  Plus,
  Image as ImageIcon,
  Trash2,
  Search,
  X,
  Palette,
  ShoppingCart,
  Sparkles,
  Save,
  FolderOpen,
  Loader2,
  Printer,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  Box,
  MessageCircle,
  QrCode,
  ShoppingBag,
  Send,
  Minus,
  ExternalLink,
  Building,
  FileText,
  Smartphone,
  Type,
  Grid,
  Moon,
  Package,
  Eye,
  ArrowRight,
  Copy,
  Check,
  RefreshCw,
  FilePlus2,
  SlidersHorizontal,
  Layers,
  ChevronUp,
  ChevronDown,
  Phone,
  Mail,
  MapPin,
  Store,
  UtensilsCrossed,
  Gem,
  LayoutGrid,
  AlertTriangle,
} from 'lucide-react';

interface CatalogGeneratorProps {
  products: Product[];
  units: Unit[];
  viewModeData?: CatalogProject;
}

const LEGACY_PLACEHOLDER_COMPANY = 'مؤسسة مسارات التجارية';
const LEGACY_PLACEHOLDER_EMAIL = 'info@masarat.sa';
const LEGACY_PLACEHOLDER_TAX = '310123456700003';
const DEFAULT_TERMS =
  'هذا العرض ساري لمدة 15 يوماً من تاريخ الإصدار أو حتى نفاد الكمية. الأسعار تشمل ضريبة القيمة المضافة.';

const BADGE_OPTIONS: { id: CatalogBadgeType; label: string; chipClass: string }[] = [
  { id: 'sale', label: 'خصم خاص', chipClass: 'bg-red-600 text-white' },
  { id: 'new', label: 'جديد', chipClass: 'bg-blue-600 text-white' },
  { id: 'best_seller', label: 'الأكثر مبيعاً', chipClass: 'bg-amber-500 text-white' },
  { id: 'limited', label: 'كمية محدودة', chipClass: 'bg-slate-900 text-white' },
  { id: '1plus1', label: '1+1 مجاناً', chipClass: 'bg-violet-600 text-white' },
  { id: 'organic', label: 'عضوي / طازج', chipClass: 'bg-emerald-600 text-white' },
];

const LAYOUT_OPTIONS: { id: CatalogLayoutType; label: string; icon: React.ReactNode }[] = [
  { id: 'app_modern', label: 'تطبيق عصري', icon: <Smartphone size={14} /> },
  { id: 'geometric_grid', label: 'شبكة هندسية', icon: <LayoutGrid size={14} /> },
  { id: 'restaurant_menu', label: 'قائمة مطعم / أصناف', icon: <UtensilsCrossed size={14} /> },
  { id: 'luxury_cards', label: 'نمط فاخر', icon: <Gem size={14} /> },
  { id: 'ramadan_special', label: 'تصميم رمضاني خاص', icon: <Moon size={14} /> },
];

const toCents = (val?: string | number): number => {
  const n = typeof val === 'number' ? val : parseFloat(String(val || '0'));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

const formatFromCents = (cents: number): string => (cents / 100).toFixed(2);

export const CatalogGenerator: React.FC<CatalogGeneratorProps> = ({
  products,
  units,
  viewModeData,
}) => {
  const { settings, isLoading: isSettingsLoading } = useSystemSettings();
  const { notify } = useNotification();

  // --- CORE STATE ---
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>(() => crypto.randomUUID());
  const [hasLoadedExistingProject, setHasLoadedExistingProject] = useState<boolean>(!!viewModeData);

  // Project Metadata
  const [projectName, setProjectName] = useState('المجلة الرقمية الجديدة');
  const [pageTitle, setPageTitle] = useState('عروض وتخفيضات الأسبوع');
  const [pageSubtitle, setPageSubtitle] = useState('تسوق الآن واكتشف أفضل الأسعار');
  const [whatsappNumber, setWhatsappNumber] = useState('966500000000');

  // Styling & Config (seeded from System Settings as soon as settings finish loading)
  const [styleConfig, setStyleConfig] = useState<CatalogStyleConfig>({
    primaryColor: '#006C35',
    secondaryColor: '#C5A059',
    backgroundColor: '#F8FAFC',
    fontFamily: 'Cairo',
    borderRadius: 16,
    layoutType: 'app_modern',
    showHeader: true,
    currencySymbolType: settings.currencySymbolType || 'text',
    currencySymbolImage: settings.currencySymbolImage || null,
    cardSize: 'normal',
    columnsCount: 2,
    companyName: settings.orgName || '',
    companyLogo: settings.receiptLogo || null,
    companyPhone: '',
    companyEmail: '',
    companyAddress: settings.receiptHeader || '',
    companyTaxNumber: settings.taxNumber || '',
    showCompanyFooter: true,
    isQuotationMode: true,
    footerTerms: settings.invoiceTerms || DEFAULT_TERMS,
  });

  // UI & Modal States
  const [zoom, setZoom] = useState(100);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pickerCategory, setPickerCategory] = useState<string>('الكل');
  const [savedCatalogs, setSavedCatalogs] = useState<CatalogProject[]>([]);
  const [activeTab, setActiveTab] = useState<'content' | 'design' | 'style'>('content');
  const [isViewerMode, setIsViewerMode] = useState<boolean>(!!viewModeData);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Viewer Mode interactive filters
  const [viewerSearch, setViewerSearch] = useState('');
  const [viewerCategory, setViewerCategory] = useState('الكل');

  // Confirmation modal (replaces window.confirm)
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // Cart
  const [cart, setCart] = useState<{ item: CatalogItem; qty: number; unit: string }[]>([]);
  const [showCart, setShowCart] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Resolve real company identity from settings if missing or legacy placeholder
  const resolvedCompanyName = useMemo(() => {
    const raw = styleConfig.companyName?.trim();
    if (!raw || raw === LEGACY_PLACEHOLDER_COMPANY) {
      return settings.orgName?.trim() || 'اسم الشركة';
    }
    return raw;
  }, [styleConfig.companyName, settings.orgName]);

  const resolvedCompanyLogo = styleConfig.companyLogo ?? settings.receiptLogo ?? null;
  const resolvedTaxNumber =
    styleConfig.companyTaxNumber && styleConfig.companyTaxNumber !== LEGACY_PLACEHOLDER_TAX
      ? styleConfig.companyTaxNumber
      : settings.taxNumber || '';

  const resolvedCurrencyType = styleConfig.currencySymbolType || settings.currencySymbolType || 'text';
  const resolvedCurrencyImage =
    styleConfig.currencySymbolImage !== undefined
      ? styleConfig.currencySymbolImage
      : settings.currencySymbolImage;

  // Sync styleConfig with global System Settings when settings finish loading
  useEffect(() => {
    if (isSettingsLoading) return;
    setStyleConfig(prev => {
      const prevName = prev.companyName?.trim() || '';
      const shouldSyncCompany =
        !hasLoadedExistingProject || !prevName || prevName === LEGACY_PLACEHOLDER_COMPANY;

      return {
        ...prev,
        currencySymbolType: settings.currencySymbolType,
        currencySymbolImage: settings.currencySymbolImage,
        companyName: shouldSyncCompany ? settings.orgName : prev.companyName,
        companyLogo: shouldSyncCompany
          ? prev.companyLogo || settings.receiptLogo || null
          : prev.companyLogo,
        companyTaxNumber: shouldSyncCompany
          ? !prev.companyTaxNumber || prev.companyTaxNumber === LEGACY_PLACEHOLDER_TAX
            ? settings.taxNumber || ''
            : prev.companyTaxNumber
          : prev.companyTaxNumber,
        companyAddress: shouldSyncCompany
          ? prev.companyAddress || settings.receiptHeader || ''
          : prev.companyAddress,
        companyEmail:
          prev.companyEmail === LEGACY_PLACEHOLDER_EMAIL ? '' : prev.companyEmail,
        footerTerms: shouldSyncCompany
          ? prev.footerTerms === DEFAULT_TERMS && settings.invoiceTerms
            ? settings.invoiceTerms
            : prev.footerTerms
          : prev.footerTerms,
      };
    });
  }, [
    isSettingsLoading,
    hasLoadedExistingProject,
    settings.orgName,
    settings.receiptLogo,
    settings.taxNumber,
    settings.receiptHeader,
    settings.invoiceTerms,
    settings.currencySymbolType,
    settings.currencySymbolImage,
  ]);

  const handleSyncFromSettings = (silent = false) => {
    setStyleConfig(prev => ({
      ...prev,
      companyName: settings.orgName || prev.companyName,
      companyLogo: settings.receiptLogo || prev.companyLogo || null,
      companyTaxNumber: settings.taxNumber || prev.companyTaxNumber || '',
      companyAddress: settings.receiptHeader || prev.companyAddress || '',
      footerTerms: settings.invoiceTerms || prev.footerTerms || DEFAULT_TERMS,
      currencySymbolType: settings.currencySymbolType,
      currencySymbolImage: settings.currencySymbolImage,
    }));
    if (!silent) {
      notify(`تمت مزامنة بيانات "${settings.orgName}" من إعدادات النظام`, 'success');
    }
  };

  // URL Handling for Sharing
  const shareableUrl = useMemo(() => {
    return `${window.location.origin}/?catalog=${projectId}`;
  }, [projectId]);

  const qrCodeImageUrl = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      shareableUrl
    )}`;
  }, [shareableUrl]);

  const loadProject = (p: CatalogProject) => {
    setHasLoadedExistingProject(true);
    setProjectId(p.id);
    setProjectName(p.name);
    setPageTitle(p.title);
    setPageSubtitle(p.subtitle || '');
    setWhatsappNumber(p.whatsappNumber || '');
    setItems(p.items || []);
    setActiveItemId(null);
    if (p.styleConfig) {
      const sc = p.styleConfig;
      const cleanName =
        !sc.companyName || sc.companyName === LEGACY_PLACEHOLDER_COMPANY
          ? settings.orgName
          : sc.companyName;
      setStyleConfig({
        ...sc,
        companyName: cleanName,
        companyLogo: sc.companyLogo ?? settings.receiptLogo ?? null,
        companyEmail: sc.companyEmail === LEGACY_PLACEHOLDER_EMAIL ? '' : sc.companyEmail,
        companyTaxNumber:
          sc.companyTaxNumber === LEGACY_PLACEHOLDER_TAX
            ? settings.taxNumber || ''
            : sc.companyTaxNumber,
        currencySymbolType: sc.currencySymbolType || settings.currencySymbolType,
        currencySymbolImage:
          sc.currencySymbolImage !== undefined
            ? sc.currencySymbolImage
            : settings.currencySymbolImage,
      });
    }
    setShowSavedModal(false);
  };

  const loadCatalogs = async () => {
    try {
      const data = await db.catalogs.getAll();
      setSavedCatalogs(data as CatalogProject[]);
    } catch (e) {
      console.error('Error loading catalogs:', e);
    }
  };

  useEffect(() => {
    if (viewModeData) {
      loadProject(viewModeData);
      setIsViewerMode(true);
    } else {
      loadCatalogs();
      if (window.location.hash.includes('view')) {
        setIsViewerMode(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewModeData]);

  const handleNewCatalog = () => {
    const startFresh = () => {
      setHasLoadedExistingProject(false);
      setProjectId(crypto.randomUUID());
      setProjectName(`مجلة ${settings.orgName || 'جديدة'}`);
      setPageTitle('عروض وتخفيضات خاصة');
      setPageSubtitle('تسوق الآن واكتشف أفضل الأسعار');
      setItems([]);
      setActiveItemId(null);
      setStyleConfig(prev => ({
        ...prev,
        companyName: settings.orgName || '',
        companyLogo: settings.receiptLogo || null,
        companyTaxNumber: settings.taxNumber || '',
        companyAddress: settings.receiptHeader || '',
        footerTerms: settings.invoiceTerms || DEFAULT_TERMS,
        currencySymbolType: settings.currencySymbolType,
        currencySymbolImage: settings.currencySymbolImage,
      }));
      notify('تم إنشاء مشروع مجلة جديد ببيانات الشركة المسجلة', 'info');
    };

    if (items.length > 0) {
      setConfirmState({
        title: 'إنشاء مجلة رقمية جديدة',
        message: 'سيتم تفريغ لوحة العمل الحالية والبدء بمجلة جديدة. تأكد من حفظ عملك الحالي أولاً.',
        confirmLabel: 'بدء مجلة جديدة',
        onConfirm: () => {
          startFresh();
          setConfirmState(null);
        },
      });
    } else {
      startFresh();
    }
  };

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise(resolve => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 640;
        const scaleSize = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
        canvas.width = Math.round(img.width * scaleSize);
        canvas.height = Math.round(img.height * scaleSize);
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const executeSave = async () => {
    setIsSaving(true);
    try {
      const syncedStyleConfig: CatalogStyleConfig = {
        ...styleConfig,
        companyName: resolvedCompanyName,
        companyLogo: resolvedCompanyLogo,
        companyTaxNumber: resolvedTaxNumber,
      };
      const project: CatalogProject = {
        id: projectId,
        name: projectName.trim(),
        date: new Date().toISOString(),
        title: pageTitle.trim(),
        subtitle: pageSubtitle,
        items,
        whatsappNumber,
        styleConfig: syncedStyleConfig,
      };

      await db.catalogs.upsert(project);
      setHasLoadedExistingProject(true);
      await loadCatalogs();
      notify('تم حفظ المجلة الرقمية بنجاح في الأرشيف', 'success');
    } catch (e) {
      console.error(e);
      notify('فشل الحفظ. حاول تقليل عدد أو حجم الصور.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!projectName.trim()) {
      notify('يرجى إدخال اسم المشروع قبل الحفظ', 'warning');
      return;
    }

    const previewProject: CatalogProject = {
      id: projectId,
      name: projectName.trim(),
      date: new Date().toISOString(),
      title: pageTitle.trim(),
      subtitle: pageSubtitle,
      items,
      whatsappNumber,
      styleConfig: { ...styleConfig, companyName: resolvedCompanyName },
    };

    const dataSize = JSON.stringify(previewProject).length;
    if (dataSize > 950000) {
      setConfirmState({
        title: 'حجم المجلة كبير',
        message: 'حجم الصور المرفقة كبير جداً وقد يتجاوز الحد المسموح للحفظ السحابي. هل تريد المتابعة؟',
        confirmLabel: 'محاولة الحفظ',
        onConfirm: async () => {
          setConfirmState(null);
          await executeSave();
        },
      });
      return;
    }

    await executeSave();
  };

  const handleDeleteSavedCatalog = (e: React.MouseEvent, cat: CatalogProject) => {
    e.stopPropagation();
    setConfirmState({
      title: 'حذف المجلة المحفوظة',
      message: `هل أنت متأكد من حذف "${cat.name}" نهائياً من الأرشيف؟`,
      confirmLabel: 'حذف نهائي',
      danger: true,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await db.catalogs.delete(cat.id);
          setSavedCatalogs(prev => prev.filter(c => c.id !== cat.id));
          notify('تم حذف المجلة من الأرشيف', 'info');
        } catch (err) {
          console.error(err);
          notify('تعذر حذف المجلة', 'error');
        }
      },
    });
  };

  // --- AI IMAGE GENERATION ---
  const generateAiImage = async (item: CatalogItem) => {
    setIsGenerating(true);
    try {
      const prompt = `Professional advertising product photography of ${item.name} (${
        item.description || 'retail commercial product'
      }). Hyper-realistic, 8k resolution, cinematic studio lighting, clean soft neutral studio background, high detailed texture.`;

      const response = await fetch('/api/generate-catalog-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate image');
      }

      const resData = await response.json();
      if (resData.base64Image) {
        const compressed = await compressImage(resData.base64Image);
        updateItem(item.id, { image: compressed });
        notify('تم توليد صورة المنتج بنجاح', 'success');
      } else {
        notify('لم يتم إرجاع صورة من الخادم', 'warning');
      }
    } catch (e) {
      console.error(e);
      notify('تعذر توليد الصورة بالذكاء الاصطناعي. يمكنك رفع صورة يدوياً.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // --- ITEMS CRUD ---
  const addItem = (product?: Product, keepOpen = false) => {
    const unitName = units.find(u => u.id === product?.unitId)?.name || 'قطعة';
    const newItem: CatalogItem = {
      id: crypto.randomUUID(),
      productId: product?.code || '',
      name: product?.name || 'منتج جديد',
      price: product?.price || '0.00',
      originalPrice: '',
      sectionName: product?.category || 'عام',
      unitName,
      badge: 'none',
      description: product?.description || '',
    };
    setItems(prev => [...prev, newItem]);
    setActiveItemId(newItem.id);
    if (!keepOpen) {
      setShowProductPicker(false);
    } else if (product) {
      notify(`تمت إضافة "${product.name}" إلى المجلة`, 'success');
    }
  };

  const addCategoryBulk = (categoryName: string) => {
    const targetProducts =
      categoryName === 'الكل'
        ? filteredProducts
        : products.filter(p => (p.category || 'عام') === categoryName);

    const existingCodes = new Set(items.map(i => i.productId).filter(Boolean));
    const toAdd = targetProducts.filter(p => !existingCodes.has(p.code)).slice(0, 40);

    if (toAdd.length === 0) {
      notify('جميع منتجات هذا القسم مضافة بالفعل في المجلة', 'info');
      return;
    }

    const newItems: CatalogItem[] = toAdd.map(p => ({
      id: crypto.randomUUID(),
      productId: p.code || '',
      name: p.name,
      price: p.price || '0.00',
      originalPrice: '',
      sectionName: p.category || 'عام',
      unitName: units.find(u => u.id === p.unitId)?.name || 'قطعة',
      badge: 'none',
      description: p.description || '',
    }));

    setItems(prev => [...prev, ...newItems]);
    setShowProductPicker(false);
    notify(`تم استيراد ${newItems.length} منتج من قسم "${categoryName}"`, 'success');
  };

  const duplicateItem = (item: CatalogItem) => {
    const copy: CatalogItem = { ...item, id: crypto.randomUUID(), name: `${item.name} (نسخة)` };
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === item.id);
      if (idx === -1) return [...prev, copy];
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setActiveItemId(copy.id);
    notify('تم تكرار العنصر', 'info');
  };

  const moveItem = (id: string, direction: 'up' | 'down') => {
    setItems(prev => {
      const index = prev.findIndex(i => i.id === id);
      if (index < 0) return prev;
      if (direction === 'up' && index === 0) return prev;
      if (direction === 'down' && index === prev.length - 1) return prev;

      const next = [...prev];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      const temp = next[index];
      next[index] = next[swapIndex];
      next[swapIndex] = temp;
      return next;
    });
  };

  const updateItem = (id: string, updates: Partial<CatalogItem>) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...updates } : item)));
  };

  // --- CART ---
  const addToCart = (item: CatalogItem, unit: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id && c.unit === unit);
      if (existing) {
        return prev.map(c =>
          c.item.id === item.id && c.unit === unit ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [...prev, { item, qty: 1, unit }];
    });
    notify(`تمت إضافة "${item.name}" (${unit}) إلى السلة`, 'success');
  };

  const cartTotalCents = useMemo(() => {
    return cart.reduce((acc, c) => {
      const unitPrice =
        c.unit === 'كرتون' && c.item.cartonPrice ? c.item.cartonPrice : c.item.price;
      return acc + toCents(unitPrice) * c.qty;
    }, 0);
  }, [cart]);

  const sendOrderToWhatsapp = () => {
    if (cart.length === 0) return;
    let msg = `*مرحباً ${resolvedCompanyName}، أود طلب المنتجات التالية من المجلة: ${pageTitle}*\n\n`;
    cart.forEach((c, idx) => {
      const unitPrice =
        c.unit === 'كرتون' && c.item.cartonPrice ? c.item.cartonPrice : c.item.price;
      const subCents = toCents(unitPrice) * c.qty;
      msg += `${idx + 1}. *${c.item.name}*\n   الكمية: ${c.qty} ${c.unit} | السعر: ${formatFromCents(
        subCents
      )}\n`;
    });
    msg += `\n*الإجمالي التقديري: ${formatFromCents(cartTotalCents)}*`;
    const cleanPhone = (whatsappNumber || styleConfig.companyPhone || '').replace(/[^\d]/g, '');
    if (!cleanPhone) {
      notify('يرجى تحديد رقم الواتساب أولاً', 'warning');
      return;
    }
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  // --- EXPORTS ---
  const downloadAsImage = async () => {
    if (!canvasRef.current) return;
    setIsGenerating(true);
    try {
      const originalTransform = canvasRef.current.style.transform;
      canvasRef.current.style.transform = 'none';

      const dataUrl = await toPng(canvasRef.current, {
        quality: 1,
        pixelRatio: 3,
        skipFonts: true,
        style: { transform: 'none', margin: '0' },
      });

      canvasRef.current.style.transform = originalTransform;

      const link = document.createElement('a');
      link.download = `${projectName || 'catalog'}.png`;
      link.href = dataUrl;
      link.click();
      notify('تم تصدير المجلة كصورة عالية الدقة', 'success');
    } catch (e) {
      console.error('Error downloading image:', e);
      notify('فشل تصدير الصورة. يرجى المحاولة مرة أخرى.', 'error');
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
        quality: 0.98,
        pixelRatio: 3,
        skipFonts: true,
        style: { transform: 'none', margin: '0' },
      });

      canvasRef.current.style.transform = originalTransform;
      const isA4 = styleConfig.isQuotationMode;

      if (isA4) {
        const rect = canvasRef.current.getBoundingClientRect();
        const canvasWidth = rect.width || 794;
        const canvasHeight = rect.height || 1123;

        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const imgHeightMm = (canvasHeight / canvasWidth) * 210;
        const pageHeightMm = 297;
        const numPages = Math.ceil(canvasHeight / 1123) || 1;

        for (let i = 0; i < numPages; i++) {
          if (i > 0) pdf.addPage();
          pdf.addImage(
            dataUrl,
            'JPEG',
            0,
            -i * pageHeightMm,
            210,
            imgHeightMm,
            undefined,
            'FAST'
          );
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
          format: [pdfWidthMm, pdfHeightMm],
        });

        pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidthMm, pdfHeightMm, undefined, 'FAST');
        pdf.save(`${projectName || 'catalog'}.pdf`);
      }
      notify('تم تصدير ملف PDF بنجاح', 'success');
    } catch (e) {
      console.error('Error downloading PDF:', e);
      notify('فشل تصدير ملف PDF. يرجى المحاولة مرة أخرى.', 'error');
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

  // --- DERIVED LISTS ---
  const activeItem = items.find(i => i.id === activeItemId);

  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => cats.add(p.category || 'عام'));
    return ['الكل', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return products
      .filter(p => {
        const matchesCat =
          pickerCategory === 'الكل' || (p.category || 'عام') === pickerCategory;
        const matchesQuery =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q);
        return matchesCat && matchesQuery;
      })
      .slice(0, 40);
  }, [searchTerm, pickerCategory, products]);

  const addedProductCodes = useMemo(
    () => new Set(items.map(i => i.productId).filter(Boolean)),
    [items]
  );

  const itemSections = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => set.add(i.sectionName || 'منتجات متنوعة'));
    return ['الكل', ...Array.from(set)];
  }, [items]);

  const groupedItems = useMemo<Record<string, CatalogItem[]>>(() => {
    const groups: Record<string, CatalogItem[]> = {};
    const q = isViewerMode ? viewerSearch.trim().toLowerCase() : '';

    items.forEach(item => {
      const sec = item.sectionName || 'منتجات متنوعة';
      if (isViewerMode && viewerCategory !== 'الكل' && sec !== viewerCategory) return;
      if (
        isViewerMode &&
        q &&
        !item.name.toLowerCase().includes(q) &&
        !(item.description || '').toLowerCase().includes(q) &&
        !sec.toLowerCase().includes(q)
      ) {
        return;
      }
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(item);
    });
    return groups;
  }, [items, isViewerMode, viewerSearch, viewerCategory]);

  // --- SUB-RENDERERS ---
  const CurrencyInline = ({ color, size = 12 }: { color?: string; size?: number }) => (
    <CurrencySymbolRenderer
      type={resolvedCurrencyType}
      imageUrl={resolvedCurrencyImage}
      color={color}
      className="inline-block shrink-0"
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );

  const Badge = ({ type, text }: { type: CatalogBadgeType; text?: string }) => {
    if (!type || type === 'none') return null;
    const match = BADGE_OPTIONS.find(b => b.id === type);
    return (
      <div
        className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-sm z-10 whitespace-nowrap ${
          match?.chipClass || 'bg-slate-900 text-white'
        }`}
      >
        {text || match?.label || type}
      </div>
    );
  };

  const ItemCard: React.FC<{ item: CatalogItem }> = ({ item }) => {
    const isActive = activeItemId === item.id;
    const [int, dec] = (item.price || '0.00').split('.');
    const [cartonInt, cartonDec] = (item.cartonPrice || '').split('.');

    const isGrid = styleConfig.layoutType === 'geometric_grid';
    const isLux = styleConfig.layoutType === 'luxury_cards';
    const isMenu = styleConfig.layoutType === 'restaurant_menu';
    const isRamadan = styleConfig.layoutType === 'ramadan_special';
    const isCompact = styleConfig.cardSize === 'compact';

    // 1. Restaurant / Editorial Horizontal List Layout
    if (isMenu) {
      return (
        <div
          onClick={() => !isViewerMode && setActiveItemId(item.id)}
          className={`relative group bg-white overflow-hidden transition-all duration-200 cursor-pointer flex items-center gap-3 p-3 print:break-inside-avoid border ${
            isViewerMode
              ? 'border-slate-200/80 hover:border-slate-300'
              : isActive
              ? 'ring-2 ring-sap-primary border-sap-primary z-10'
              : 'border-slate-200/80 hover:shadow-md'
          }`}
          style={{ borderRadius: `${Math.min(styleConfig.borderRadius, 20)}px` }}
        >
          <Badge
            type={item.badge || 'none'}
            text={item.discountPercent ? `خصم ${item.discountPercent}%` : undefined}
          />
          <div className="w-20 h-20 rounded-xl bg-slate-50 border border-slate-100 shrink-0 flex items-center justify-center p-1.5 overflow-hidden">
            {item.image ? (
              <img
                src={item.image}
                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                alt={item.name}
                referrerPolicy="no-referrer"
              />
            ) : (
              <ImageIcon size={24} className="text-slate-300" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-black text-slate-900 text-sm leading-snug line-clamp-1">
              {item.name}
            </h3>
            {item.description && (
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500">{item.unitName || 'حبة'}:</span>
                {item.originalPrice && (
                  <span className="text-[10px] text-slate-400 line-through tabular-nums">
                    {item.originalPrice}
                  </span>
                )}
                <span
                  className="font-black text-sm tabular-nums flex items-center gap-1"
                  style={{ color: styleConfig.primaryColor }}
                >
                  {int}.{dec || '00'}
                  <CurrencyInline color={styleConfig.primaryColor} size={12} />
                </span>
              </div>

              {item.cartonPrice && (
                <div className="flex items-center gap-1 text-emerald-700">
                  <span className="text-[10px] font-bold">كرتون:</span>
                  <span className="font-black text-xs tabular-nums flex items-center gap-0.5">
                    {cartonInt}.{cartonDec || '00'}
                    <CurrencyInline color="#047857" size={11} />
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1 shrink-0">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                addToCart(item, item.unitName || 'حبة');
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm transition-transform active:scale-95"
              style={{ backgroundColor: styleConfig.primaryColor }}
              title="إضافة للسلة"
            >
              <Plus size={15} strokeWidth={2.75} />
            </button>
            {item.cartonPrice && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  addToCart(item, 'كرتون');
                }}
                className="w-8 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black bg-emerald-700 hover:bg-emerald-600 shadow-sm"
                title="إضافة كرتون للسلة"
              >
                كرتون
              </button>
            )}
          </div>
        </div>
      );
    }

    // 2. Ramadan Special Card
    if (isRamadan) {
      return (
        <div
          onClick={() => !isViewerMode && setActiveItemId(item.id)}
          className={`relative group bg-white overflow-hidden transition-all duration-200 cursor-pointer flex flex-col h-full print:break-inside-avoid ${
            isCompact ? 'rounded-2xl border' : 'rounded-3xl border-2'
          } ${
            isViewerMode
              ? ''
              : isActive
              ? 'ring-4 ring-[#C5A059] z-10'
              : 'hover:shadow-[0_0_20px_rgba(197,160,89,0.28)] hover:-translate-y-0.5'
          } border-white/15 shadow-lg`}
        >
          <div
            className={`${
              isCompact ? 'h-24 p-3' : 'h-36 p-4'
            } w-full flex items-center justify-center bg-white relative`}
          >
            {item.image ? (
              <img
                src={item.image}
                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                alt={item.name}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex flex-col items-center opacity-20">
                <ImageIcon size={isCompact ? 20 : 32} />
                <span className="text-[8px] font-bold mt-1">بدون صورة</span>
              </div>
            )}

            <Badge
              type={item.badge || 'none'}
              text={item.discountPercent ? `خصم ${item.discountPercent}%` : undefined}
            />

            <div className="absolute bottom-2 left-2 flex gap-1 z-10">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  addToCart(item, item.unitName || 'حبة');
                }}
                className={`rounded-full flex items-center justify-center text-white shadow-md bg-[#002b49] hover:bg-[#C5A059] transition-colors ${
                  isCompact ? 'w-6 h-6 text-[9px] font-black' : 'w-8 h-8'
                }`}
                title="إضافة لسلة التسوق"
              >
                <Plus size={isCompact ? 12 : 16} strokeWidth={2.75} />
              </button>
              {item.cartonPrice && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    addToCart(item, 'كرتون');
                  }}
                  className={`rounded-full flex items-center justify-center text-white shadow-md bg-emerald-700 hover:bg-emerald-600 transition-colors font-black ${
                    isCompact ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-[10px]'
                  }`}
                  title="إضافة كرتون لسلة التسوق"
                >
                  ك
                </button>
              )}
            </div>
          </div>

          <div
            className={`${
              isCompact ? 'p-2' : 'p-3.5'
            } text-center flex-1 flex flex-col justify-between bg-white border-t border-slate-100`}
          >
            <div>
              <h3
                className={`font-black text-[#002b49] leading-snug line-clamp-2 ${
                  isCompact ? 'text-[10px]' : 'text-sm'
                }`}
              >
                {item.name}
              </h3>
              {!isCompact && item.description && (
                <div className="text-[10px] text-slate-400 font-medium mt-1 line-clamp-1">
                  {item.description}
                </div>
              )}
            </div>

            <div className="mt-2.5 space-y-1">
              <div className="flex justify-between items-center bg-[#FFD700]/10 border border-[#FFD700]/25 px-2 py-1 rounded-lg">
                <span className="text-[9px] font-black text-[#002b49]">
                  {item.unitName || 'الحبة'}:
                </span>
                <div className="flex items-center gap-1.5 tabular-nums">
                  {item.originalPrice && (
                    <span className="text-[9px] text-slate-400 line-through">
                      {item.originalPrice}
                    </span>
                  )}
                  <div className="flex items-center gap-0.5 text-red-600 font-black leading-none">
                    <span className={isCompact ? 'text-xs' : 'text-sm'}>{int}</span>
                    <span className="text-[8px]">.{dec || '00'}</span>
                    <CurrencyInline color="#dc2626" size={11} />
                  </div>
                </div>
              </div>

              {item.cartonPrice && (
                <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg">
                  <span className="text-[9px] font-black text-emerald-800">الكرتون:</span>
                  <div className="flex items-center gap-1.5 tabular-nums">
                    {item.originalCartonPrice && (
                      <span className="text-[9px] text-slate-400 line-through">
                        {item.originalCartonPrice}
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 text-emerald-700 font-black leading-none">
                      <span className={isCompact ? 'text-xs' : 'text-sm'}>{cartonInt}</span>
                      <span className="text-[8px]">.{cartonDec || '00'}</span>
                      <CurrencyInline color="#047857" size={11} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 3. Modern / Geometric Grid / Luxury Cards
    return (
      <div
        onClick={() => !isViewerMode && setActiveItemId(item.id)}
        className={`relative group bg-white overflow-hidden transition-all duration-200 cursor-pointer flex flex-col h-full print:break-inside-avoid ${
          isViewerMode
            ? 'hover:shadow-md'
            : isActive
            ? 'ring-3 ring-sap-primary z-10 shadow-lg'
            : 'hover:shadow-md hover:-translate-y-0.5'
        } ${
          isGrid
            ? 'border-2 border-slate-900 rounded-none shadow-[4px_4px_0px_rgba(15,23,42,1)]'
            : isLux
            ? 'border border-amber-200/80 shadow-sm'
            : 'border border-slate-200/80 shadow-sm'
        }`}
        style={{
          borderRadius: isGrid
            ? '0px'
            : isLux
            ? `${Math.max(16, styleConfig.borderRadius)}px 4px ${Math.max(
                16,
                styleConfig.borderRadius
              )}px 4px`
            : `${styleConfig.borderRadius}px`,
        }}
      >
        <Badge
          type={item.badge || 'none'}
          text={item.discountPercent ? `خصم ${item.discountPercent}%` : undefined}
        />

        {/* Image */}
        <div
          className={`${
            isCompact ? 'h-24 p-2.5' : 'h-40 p-4'
          } w-full flex items-center justify-center bg-white relative overflow-hidden ${
            isGrid ? 'border-b-2 border-slate-900' : 'border-b border-slate-100'
          }`}
        >
          {item.image ? (
            <img
              src={item.image}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
              alt={item.name}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex flex-col items-center opacity-20">
              <ImageIcon size={isCompact ? 20 : 36} />
              <span className="text-[8px] font-bold mt-1">بدون صورة</span>
            </div>
          )}

          {/* Add To Cart Buttons */}
          <div className="absolute bottom-2 left-2 flex gap-1 z-10">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                addToCart(item, item.unitName || 'حبة');
              }}
              className={`rounded-full flex items-center justify-center text-white shadow-md transition-colors bg-slate-900 hover:bg-sap-primary ${
                isCompact ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-xs'
              }`}
              title="إضافة للسلة"
            >
              <Plus size={isCompact ? 12 : 15} strokeWidth={2.75} />
            </button>
            {item.cartonPrice && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  addToCart(item, 'كرتون');
                }}
                className={`rounded-full flex items-center justify-center text-white shadow-md transition-colors bg-emerald-700 hover:bg-emerald-600 font-black ${
                  isCompact ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-[10px]'
                }`}
                title="إضافة كرتون"
              >
                ك
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div
          className={`${
            isCompact ? 'p-2' : 'p-3.5'
          } flex-1 flex flex-col justify-between bg-white`}
        >
          <div className="mb-2">
            <h3
              className={`font-black text-slate-900 leading-snug line-clamp-2 ${
                isCompact ? 'text-[10px] min-h-[2.4em]' : 'text-sm'
              }`}
            >
              {item.name}
            </h3>
            {!isCompact && item.description && (
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{item.description}</p>
            )}
          </div>

          <div className="space-y-1.5">
            {/* Unit Price Row */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500">
                  {item.unitName || 'حبة'}
                </span>
                {item.originalPrice && (
                  <span className="text-[10px] text-slate-400 line-through tabular-nums">
                    {item.originalPrice}
                  </span>
                )}
              </div>
              <div
                className="flex items-center gap-0.5 leading-none font-black tabular-nums"
                style={{ color: styleConfig.primaryColor }}
              >
                <span className={isCompact ? 'text-xs' : 'text-base'}>{int}</span>
                <span className="text-[9px]">.{dec || '00'}</span>
                <CurrencyInline color={styleConfig.primaryColor} size={isCompact ? 10 : 12} />
              </div>
            </div>

            {/* Carton Price Row */}
            {item.cartonPrice && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-emerald-700">كرتون</span>
                  {item.originalCartonPrice && (
                    <span className="text-[10px] text-slate-400 line-through tabular-nums">
                      {item.originalCartonPrice}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 leading-none font-black text-emerald-700 tabular-nums">
                  <span className={isCompact ? 'text-xs' : 'text-sm'}>{cartonInt}</span>
                  <span className="text-[9px]">.{cartonDec || '00'}</span>
                  <CurrencyInline color="#047857" size={isCompact ? 10 : 12} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- REUSABLE DOCUMENT HEADER (A4 Quotation OR Storefront Branded Header) ---
  const renderCatalogHeader = () => {
    const isRamadan = styleConfig.layoutType === 'ramadan_special';

    if (styleConfig.isQuotationMode) {
      return (
        <div
          className="p-6 bg-white border-b-2 border-slate-200 text-slate-800 space-y-4 text-right"
          dir="rtl"
        >
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              {resolvedCompanyLogo ? (
                <img
                  src={resolvedCompanyLogo}
                  className="w-16 h-16 object-contain rounded-xl border border-slate-100 bg-white p-1 shrink-0"
                  alt={resolvedCompanyName}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
                  style={{ backgroundColor: styleConfig.primaryColor }}
                >
                  <Building size={28} />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-xl font-black text-slate-900 leading-tight truncate">
                  {resolvedCompanyName}
                </h1>
                {pageTitle && (
                  <p
                    className="text-xs font-bold mt-0.5 truncate"
                    style={{ color: styleConfig.primaryColor }}
                  >
                    {pageTitle}
                  </p>
                )}
                {resolvedTaxNumber && (
                  <p className="text-[11px] text-slate-500 font-bold mt-1 tabular-nums">
                    الرقم الضريبي: {resolvedTaxNumber}
                  </p>
                )}
              </div>
            </div>

            <div className="text-left bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs shrink-0">
              <div
                className="font-black text-sm mb-1"
                style={{ color: styleConfig.primaryColor }}
              >
                عرض سعر / مجلة عروض
              </div>
              <div className="text-[11px] text-slate-500 font-bold tabular-nums">
                التاريخ: {new Date().toLocaleDateString('ar-SA')}
              </div>
              <div className="text-[11px] text-slate-500 font-bold tabular-nums">
                المرجع: #{projectId.substring(0, 8).toUpperCase()}
              </div>
            </div>
          </div>

          {(styleConfig.companyPhone || styleConfig.companyEmail || styleConfig.companyAddress) && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[11px] text-slate-600 pt-3 border-t border-dashed border-slate-200">
              {styleConfig.companyPhone && (
                <div className="flex items-center gap-1.5 font-bold tabular-nums">
                  <Phone size={12} className="text-slate-400" />
                  <span dir="ltr">{styleConfig.companyPhone}</span>
                </div>
              )}
              {styleConfig.companyEmail && (
                <div className="flex items-center gap-1.5 font-bold">
                  <Mail size={12} className="text-slate-400" />
                  <span>{styleConfig.companyEmail}</span>
                </div>
              )}
              {styleConfig.companyAddress && (
                <div className="flex items-center gap-1.5 font-bold">
                  <MapPin size={12} className="text-slate-400" />
                  <span>{styleConfig.companyAddress}</span>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (!styleConfig.showHeader) return null;

    return (
      <div
        className={`px-4 py-4 border-b ${
          isRamadan
            ? 'bg-[#001f35] border-[#C5A059]/30 text-white'
            : 'bg-white border-slate-200/80 text-slate-900'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {resolvedCompanyLogo ? (
              <img
                src={resolvedCompanyLogo}
                className="w-10 h-10 object-contain rounded-xl bg-white p-0.5 border border-slate-200 shrink-0"
                alt={resolvedCompanyName}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{
                  backgroundColor: isRamadan ? '#C5A059' : styleConfig.primaryColor,
                }}
              >
                <Store size={18} />
              </div>
            )}
            <div className="min-w-0">
              <div
                className={`text-[11px] font-black truncate ${
                  isRamadan ? 'text-[#C5A059]' : 'text-slate-500'
                }`}
              >
                {resolvedCompanyName}
              </div>
              <h2
                className={`text-base font-black leading-tight truncate ${
                  isRamadan ? 'text-white' : 'text-slate-900'
                }`}
              >
                {pageTitle}
              </h2>
            </div>
          </div>

          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm"
            style={{
              backgroundColor: isRamadan ? '#C5A059' : styleConfig.primaryColor,
            }}
          >
            <ShoppingBag size={14} />
          </div>
        </div>
        {pageSubtitle && (
          <p
            className={`text-[11px] font-bold mt-2 ${
              isRamadan ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            {pageSubtitle}
          </p>
        )}
      </div>
    );
  };

  const renderCatalogFooter = () => {
    if (styleConfig.showCompanyFooter === false) return null;
    const isRamadan = styleConfig.layoutType === 'ramadan_special';

    return (
      <div
        className={`p-6 border-t text-xs space-y-4 text-right ${
          isRamadan
            ? 'bg-[#001a2d] border-[#C5A059]/30 text-slate-200'
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}
        dir="rtl"
      >
        {styleConfig.footerTerms && (
          <div className="space-y-1.5">
            <h4 className="font-black text-[11px] opacity-60">شروط وتفاصيل العرض</h4>
            <p
              className={`text-[11px] whitespace-pre-line leading-relaxed p-3 rounded-xl border ${
                isRamadan
                  ? 'bg-[#002b49] border-[#C5A059]/20 text-slate-200'
                  : 'bg-white border-slate-200/80 text-slate-600'
              }`}
            >
              {styleConfig.footerTerms}
            </p>
          </div>
        )}

        <div
          className={`flex justify-between items-center pt-4 border-t border-dashed ${
            isRamadan ? 'border-[#C5A059]/30' : 'border-slate-200'
          }`}
        >
          <div className="space-y-1">
            <div className="font-black text-[11px] opacity-60">اعتماد المؤسسة</div>
            <div
              className={`w-36 h-11 border border-dashed rounded-xl flex items-center justify-center text-[10px] ${
                isRamadan
                  ? 'border-[#C5A059]/40 text-slate-400'
                  : 'border-slate-300 bg-white/70 text-slate-400'
              }`}
            >
              الختم والتوقيع الرسمي
            </div>
          </div>
          <div className="text-left">
            <div className={`font-black text-sm ${isRamadan ? 'text-[#C5A059]' : 'text-slate-900'}`}>
              {resolvedCompanyName}
            </div>
            <div className="text-[11px] opacity-65 mt-0.5">نشكركم على ثقتكم بمنتجاتنا</div>
          </div>
        </div>
      </div>
    );
  };

  // --- CONFIRMATION MODAL COMPONENT ---
  const renderConfirmModal = () =>
    confirmState && (
      <div className="fixed inset-0 z-[150] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                confirmState.danger
                  ? 'bg-red-50 dark:bg-red-950/50 text-red-600'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600'
              }`}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {confirmState.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                {confirmState.message}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setConfirmState(null)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={confirmState.onConfirm}
              className={`px-4 py-2 rounded-xl text-xs font-black text-white whitespace-nowrap ${
                confirmState.danger
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-sap-primary hover:bg-sap-primary-hover'
              }`}
            >
              {confirmState.confirmLabel || 'تأكيد'}
            </button>
          </div>
        </div>
      </div>
    );

  // --- VIEWER MODE RENDER ---
  if (isViewerMode) {
    const isRamadan = styleConfig.layoutType === 'ramadan_special';
    const totalCartUnits = cart.reduce((acc, c) => acc + c.qty, 0);

    return (
      <div
        className={`min-h-screen flex flex-col ${
          isRamadan ? 'bg-[#001a2d]' : 'bg-slate-100 dark:bg-slate-950'
        } pb-24`}
        dir="rtl"
        style={{ fontFamily: styleConfig.fontFamily }}
      >
        {/* Top Storefront Navigation Bar */}
        <header
          className={`sticky top-0 z-40 border-b px-4 md:px-6 py-3 backdrop-blur-md transition-colors ${
            isRamadan
              ? 'bg-[#001f35]/95 border-[#C5A059]/30 text-white'
              : 'bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100'
          }`}
        >
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {!viewModeData && (
                <button
                  type="button"
                  onClick={() => setIsViewerMode(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <ArrowRight size={14} />
                  <span>العودة للمحرر</span>
                </button>
              )}
              {resolvedCompanyLogo ? (
                <img
                  src={resolvedCompanyLogo}
                  className="w-9 h-9 rounded-xl object-contain bg-white border border-slate-200 p-0.5 shrink-0"
                  alt={resolvedCompanyName}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: styleConfig.primaryColor }}
                >
                  <Building size={18} />
                </div>
              )}
              <div className="min-w-0">
                <div
                  className={`text-xs font-black truncate ${
                    isRamadan ? 'text-[#C5A059]' : 'text-sap-primary'
                  }`}
                >
                  {resolvedCompanyName}
                </div>
                <div className="text-sm font-black truncate">{pageTitle}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCart(true)}
              className="relative px-3.5 py-2 rounded-xl text-xs font-black text-white shadow-sm flex items-center gap-2 whitespace-nowrap shrink-0"
              style={{ backgroundColor: styleConfig.primaryColor }}
            >
              <ShoppingCart size={16} />
              <span>سلة الطلب</span>
              {totalCartUnits > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-white text-slate-900 text-[10px] font-black tabular-nums">
                  {totalCartUnits}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Viewer Search & Section Filter Bar */}
        <div className="max-w-5xl w-full mx-auto px-4 pt-5 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={viewerSearch}
                onChange={e => setViewerSearch(e.target.value)}
                placeholder="ابحث عن منتج داخل المجلة..."
                className={`w-full pr-10 pl-4 py-2.5 rounded-xl border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sap-primary/30 ${
                  isRamadan
                    ? 'bg-[#002b49] border-[#C5A059]/30 text-white placeholder:text-slate-400'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100'
                }`}
              />
            </div>

            {itemSections.length > 2 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {itemSections.map(sec => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setViewerCategory(sec)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                      viewerCategory === sec
                        ? 'text-white shadow-sm'
                        : isRamadan
                        ? 'bg-[#002b49] text-slate-300 hover:text-white border border-[#C5A059]/20'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                    }`}
                    style={
                      viewerCategory === sec
                        ? { backgroundColor: styleConfig.primaryColor }
                        : undefined
                    }
                  >
                    {sec}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Magazine Sheet */}
        <div
          className={`mx-auto shadow-xl overflow-hidden my-5 border ${
            styleConfig.isQuotationMode
              ? 'max-w-[820px] w-[calc(100%-2rem)] rounded-2xl border-slate-200/80'
              : 'max-w-lg w-[calc(100%-1.5rem)] rounded-3xl border-slate-200/80'
          }`}
          style={{ backgroundColor: styleConfig.backgroundColor }}
        >
          {renderCatalogHeader()}

          <div className="p-5 sm:p-6 space-y-8">
            {Object.keys(groupedItems).length === 0 ? (
              <div className="py-16 text-center opacity-50">
                <ShoppingBag
                  size={40}
                  className={`mx-auto mb-2 ${isRamadan ? 'text-white' : 'text-slate-400'}`}
                />
                <p className={`text-xs font-bold ${isRamadan ? 'text-white' : 'text-slate-600'}`}>
                  لا توجد منتجات مطابقة للبحث
                </p>
              </div>
            ) : (
              Object.entries(groupedItems).map(([section, sectionItems]) => {
                const cols =
                  styleConfig.layoutType === 'restaurant_menu'
                    ? styleConfig.columnsCount === 1
                      ? 1
                      : 2
                    : styleConfig.columnsCount || (styleConfig.cardSize === 'compact' ? 3 : 2);

                const gridColsClass =
                  cols === 1
                    ? 'grid-cols-1 gap-4'
                    : cols === 3
                    ? 'grid-cols-2 sm:grid-cols-3 gap-3'
                    : cols === 4
                    ? 'grid-cols-2 sm:grid-cols-4 gap-2.5'
                    : 'grid-cols-1 sm:grid-cols-2 gap-3.5';

                return (
                  <section key={section} className="space-y-4">
                    <div className="flex items-center gap-2.5 border-b border-slate-200/60 pb-2">
                      <div
                        className="h-5 w-1 rounded-full"
                        style={{
                          backgroundColor: isRamadan ? '#C5A059' : styleConfig.primaryColor,
                        }}
                      />
                      <h2
                        className={`text-base font-black ${
                          isRamadan ? 'text-white' : 'text-slate-800'
                        }`}
                      >
                        {section}
                      </h2>
                      <span
                        className={`text-[11px] font-bold tabular-nums ${
                          isRamadan ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        · {sectionItems.length} صنف
                      </span>
                    </div>
                    <div className={`grid ${gridColsClass}`}>
                      {sectionItems.map(item => (
                        <ItemCard key={item.id} item={item} />
                      ))}
                    </div>
                  </section>
                );
              })
            )}
          </div>

          {renderCatalogFooter()}
        </div>

        {/* Floating WhatsApp Bar when cart has items */}
        {cart.length > 0 && !showCart && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
            <button
              type="button"
              onClick={() => setShowCart(true)}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-2xl flex items-center gap-3 text-xs font-black whitespace-nowrap"
            >
              <ShoppingBag size={16} />
              <span>عرض السلة ({totalCartUnits})</span>
              <span className="text-emerald-400 tabular-nums flex items-center gap-1">
                {formatFromCents(cartTotalCents)}
                <CurrencyInline color="#34d399" size={12} />
              </span>
            </button>
          </div>
        )}

        {/* Cart Drawer / Sheet */}
        {showCart && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md max-h-[85vh] sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom">
              <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <ShoppingBag size={18} /> سلة المشتريات
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                    {resolvedCompanyName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCart(false)}
                  className="bg-white dark:bg-slate-800 p-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <ShoppingCart size={36} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-bold">السلة فارغة حالياً</p>
                  </div>
                ) : (
                  cart.map((c, i) => {
                    const unitPrice =
                      c.unit === 'كرتون' && c.item.cartonPrice
                        ? c.item.cartonPrice
                        : c.item.price;
                    const lineCents = toCents(unitPrice) * c.qty;

                    return (
                      <div
                        key={`${c.item.id}-${c.unit}-${i}`}
                        className="flex gap-3 items-center bg-white dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800"
                      >
                        <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 p-1">
                          {c.item.image ? (
                            <img
                              src={c.item.image}
                              className="w-full h-full object-contain"
                              alt={c.item.name}
                            />
                          ) : (
                            <Box size={20} className="opacity-25" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black text-slate-900 dark:text-slate-100 line-clamp-1">
                            {c.item.name}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 tabular-nums flex items-center gap-1">
                            <span>
                              {c.qty} × {c.unit} ({unitPrice})
                            </span>
                            <CurrencyInline size={10} />
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                            <button
                              type="button"
                              onClick={() =>
                                setCart(prev =>
                                  prev.map((x, idx) =>
                                    idx === i ? { ...x, qty: x.qty + 1 } : x
                                  )
                                )
                              }
                              className="p-0.5 hover:text-sap-primary"
                            >
                              <Plus size={14} />
                            </button>
                            <span className="text-xs font-black w-5 text-center tabular-nums">
                              {c.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (c.qty > 1) {
                                  setCart(prev =>
                                    prev.map((x, idx) =>
                                      idx === i ? { ...x, qty: x.qty - 1 } : x
                                    )
                                  );
                                } else {
                                  setCart(prev => prev.filter((_, idx) => idx !== i));
                                }
                              }}
                              className="p-0.5 hover:text-red-500"
                            >
                              <Minus size={14} />
                            </button>
                          </div>
                          <div className="text-xs font-black text-sap-primary tabular-nums flex items-center gap-1">
                            {formatFromCents(lineCents)}
                            <CurrencyInline size={11} />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">الإجمالي التقديري</span>
                    <span className="text-xl font-black text-slate-900 dark:text-slate-100 tabular-nums flex items-center gap-1.5">
                      {formatFromCents(cartTotalCents)}
                      <CurrencyInline size={15} />
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={sendOrderToWhatsapp}
                    className="w-full py-3.5 bg-[#25D366] hover:bg-[#1fb857] text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
                  >
                    <Send size={16} /> إرسال الطلب عبر واتساب
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {renderConfirmModal()}
      </div>
    );
  }

  // --- EDITOR MODE ---
  const renderSidebarBody = () => (
    <>
      {/* Sidebar Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 shrink-0">
        {[
          { id: 'content', label: 'المحتوى' },
          { id: 'design', label: 'التصميم' },
          { id: 'style', label: 'هوية الشركة' },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3.5 text-xs font-black border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'border-sap-primary text-sap-primary bg-sap-primary/5'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
        {activeTab === 'content' && (
          <div className="space-y-5">
            {/* Project Core Info */}
            <div className="space-y-3.5 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <FolderOpen size={15} /> إعدادات المجلة الأساسية
                </h4>
                <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                  {items.length} منتج
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  اسم المشروع (للأرشيف الداخلي)
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary"
                  placeholder="مثال: مجلة عروض نهاية الأسبوع"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Type size={13} /> عنوان المجلة الظاهر للعملاء
                </label>
                <input
                  type="text"
                  value={pageTitle}
                  onChange={e => setPageTitle(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary"
                  placeholder="العنوان الرئيسي للمجلة"
                />
              </div>

              <div className="space-y-1">
                <input
                  type="text"
                  value={pageSubtitle}
                  onChange={e => setPageSubtitle(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary"
                  placeholder="العنوان الفرعي الوصفي..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <MessageCircle size={13} /> رقم استقبال الطلبات (واتساب)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={whatsappNumber}
                    onChange={e => setWhatsappNumber(e.target.value)}
                    className="w-full text-xs font-bold font-mono p-2.5 pr-9 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366]"
                    placeholder="966500000000"
                    dir="ltr"
                  />
                  <MessageCircle
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#25D366]"
                  />
                </div>
              </div>
            </div>

            {/* Active Item Editor */}
            {activeItem ? (
              <div className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-5">
                <div className="flex justify-between items-center bg-sap-primary/10 dark:bg-sap-primary/20 px-3 py-2 rounded-xl">
                  <span className="text-xs font-black text-sap-primary truncate flex items-center gap-1.5">
                    <Sparkles size={14} /> تعديل: {activeItem.name}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => duplicateItem(activeItem)}
                      className="p-1.5 text-slate-500 hover:text-sap-primary rounded-lg bg-white dark:bg-slate-800 shadow-xs"
                      title="تكرار المنتج"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveItemId(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg bg-white dark:bg-slate-800 shadow-xs"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="col-span-2">
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">
                      اسم المنتج
                    </label>
                    <input
                      type="text"
                      value={activeItem.name}
                      onChange={e => updateItem(activeItem.id, { name: e.target.value })}
                      className="w-full p-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">
                      وصف مختصر (اختياري)
                    </label>
                    <input
                      type="text"
                      value={activeItem.description || ''}
                      onChange={e => updateItem(activeItem.id, { description: e.target.value })}
                      className="w-full p-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      placeholder="المواصفات أو العبوة..."
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">
                      سعر البيع
                    </label>
                    <input
                      type="text"
                      value={activeItem.price}
                      onChange={e => updateItem(activeItem.id, { price: e.target.value })}
                      className="w-full p-2 text-xs font-black border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 tabular-nums"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">
                      السعر السابق
                    </label>
                    <input
                      type="text"
                      value={activeItem.originalPrice || ''}
                      onChange={e => updateItem(activeItem.id, { originalPrice: e.target.value })}
                      className="w-full p-2 text-xs font-bold text-red-500 border border-slate-200 dark:border-slate-700 rounded-xl line-through bg-red-50/40 dark:bg-red-950/20 tabular-nums"
                      placeholder="اختياري"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">
                      سعر الكرتون
                    </label>
                    <input
                      type="text"
                      value={activeItem.cartonPrice || ''}
                      onChange={e => updateItem(activeItem.id, { cartonPrice: e.target.value })}
                      className="w-full p-2 text-xs font-black text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 rounded-xl bg-emerald-50/30 dark:bg-emerald-950/20 tabular-nums"
                      placeholder="اختياري"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">
                      السابق للكرتون
                    </label>
                    <input
                      type="text"
                      value={activeItem.originalCartonPrice || ''}
                      onChange={e =>
                        updateItem(activeItem.id, { originalCartonPrice: e.target.value })
                      }
                      className="w-full p-2 text-xs font-bold text-red-500 border border-slate-200 dark:border-slate-700 rounded-xl line-through bg-red-50/40 dark:bg-red-950/20 tabular-nums"
                      placeholder="اختياري"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">
                      القسم / التصنيف
                    </label>
                    <input
                      type="text"
                      value={activeItem.sectionName}
                      onChange={e => updateItem(activeItem.id, { sectionName: e.target.value })}
                      className="w-full p-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      list="catalog-sections-list"
                    />
                    <datalist id="catalog-sections-list">
                      {productCategories
                        .filter(c => c !== 'الكل')
                        .map(c => (
                          <option key={c} value={c} />
                        ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">
                      وحدة البيع
                    </label>
                    <select
                      value={activeItem.unitName}
                      onChange={e => updateItem(activeItem.id, { unitName: e.target.value })}
                      className="w-full p-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="قطعة">قطعة</option>
                      <option value="كرتون">كرتون</option>
                      <option value="كيلو">كيلو</option>
                      <option value="حبة">حبة</option>
                      <option value="ربطة">ربطة</option>
                      {units.map(u => (
                        <option key={u.id} value={u.name}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Order & Discount */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl flex items-center justify-between border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    ترتيب المنتج في القسم:
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => moveItem(activeItem.id, 'up')}
                      className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-sap-primary text-slate-600 dark:text-slate-300"
                      title="تحريك لأعلى"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(activeItem.id, 'down')}
                      className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-sap-primary text-slate-600 dark:text-slate-300"
                      title="تحريك لأسفل"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>

                {/* Badges */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-2">
                    شارة التمييز (Badge)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {BADGE_OPTIONS.map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() =>
                          updateItem(activeItem.id, {
                            badge: activeItem.badge === b.id ? 'none' : b.id,
                          })
                        }
                        className={`px-3 py-1 rounded-full text-[11px] font-black border transition-colors whitespace-nowrap ${
                          activeItem.badge === b.id
                            ? 'bg-slate-900 dark:bg-sap-primary text-white border-transparent'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product Image Controls */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => generateAiImage(activeItem)}
                    disabled={isGenerating}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-sap-primary dark:hover:bg-sap-primary-hover text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Sparkles size={15} />
                    )}
                    <span>توليد صورة دعائية بالذكاء الاصطناعي</span>
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file && activeItem) {
                        const reader = new FileReader();
                        reader.onload = async re => {
                          const c = await compressImage(re.target?.result as string);
                          updateItem(activeItem.id, { image: c });
                        };
                        reader.readAsDataURL(file);
                      }
                      e.target.value = '';
                    }}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      رفع صورة من الجهاز
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setItems(prev => prev.filter(i => i.id !== activeItem.id));
                        setActiveItemId(null);
                      }}
                      className="py-2 text-red-600 border border-red-200 dark:border-red-900/50 rounded-xl text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={14} /> حذف المنتج
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 text-center px-4">
                <MousePointer2 size={28} className="mb-2 opacity-50" />
                <p className="text-xs font-bold">
                  اضغط على أي منتج داخل لوحة المجلة لتعديل سعره أو صورته أو قسمه
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'design' && (
          <div className="space-y-5">
            {/* Paper / Mobile Presentation Mode */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <h4 className="text-xs font-black text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <Smartphone size={15} /> مقاس وحجم التصميم
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setStyleConfig({ ...styleConfig, isQuotationMode: false })}
                  className={`p-3 border rounded-xl text-center transition-colors ${
                    !styleConfig.isQuotationMode
                      ? 'bg-sap-primary text-white border-sap-primary shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="text-xs font-black">شاشة الجوال</div>
                  <div className="text-[10px] opacity-75 mt-0.5 tabular-nums">375px</div>
                </button>
                <button
                  type="button"
                  onClick={() => setStyleConfig({ ...styleConfig, isQuotationMode: true })}
                  className={`p-3 border rounded-xl text-center transition-colors ${
                    styleConfig.isQuotationMode
                      ? 'bg-sap-primary text-white border-sap-primary shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="text-xs font-black">مقاس ورقة A4</div>
                  <div className="text-[10px] opacity-75 mt-0.5 tabular-nums">للطباعة الرسمية</div>
                </button>
              </div>
            </div>

            {/* Columns & Card Density */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <h4 className="text-xs font-black text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <Grid size={15} /> توزيع الأعمدة وحجم البطاقات
              </h4>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map(cols => (
                  <button
                    key={cols}
                    type="button"
                    onClick={() => setStyleConfig({ ...styleConfig, columnsCount: cols })}
                    className={`py-2 px-1 border rounded-xl text-center font-black text-[11px] transition-colors tabular-nums ${
                      (styleConfig.columnsCount || 2) === cols
                        ? 'bg-sap-primary text-white border-sap-primary shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {cols === 1 ? '1' : cols === 2 ? '2' : cols === 3 ? '3' : '4'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStyleConfig({ ...styleConfig, cardSize: 'normal' })}
                  className={`py-2 rounded-xl text-xs font-bold border ${
                    (styleConfig.cardSize || 'normal') === 'normal'
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-transparent'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  حجم قياسي
                </button>
                <button
                  type="button"
                  onClick={() => setStyleConfig({ ...styleConfig, cardSize: 'compact' })}
                  className={`py-2 rounded-xl text-xs font-bold border ${
                    styleConfig.cardSize === 'compact'
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-transparent'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  حجم مضغوط (كثيف)
                </button>
              </div>
            </div>

            {/* Layout Templates */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <h4 className="text-xs font-black text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <Layers size={15} /> قوالب عرض الكروت
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {LAYOUT_OPTIONS.map(opt => {
                  const active = styleConfig.layoutType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        if (opt.id === 'ramadan_special') {
                          setStyleConfig({
                            ...styleConfig,
                            layoutType: 'ramadan_special',
                            backgroundColor: '#002b49',
                            primaryColor: '#C5A059',
                          });
                        } else {
                          setStyleConfig({
                            ...styleConfig,
                            layoutType: opt.id,
                            backgroundColor:
                              styleConfig.backgroundColor === '#002b49'
                                ? '#F8FAFC'
                                : styleConfig.backgroundColor,
                          });
                        }
                      }}
                      className={`p-3 border rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-black transition-colors ${
                        opt.id === 'ramadan_special' ? 'col-span-2' : ''
                      } ${
                        active
                          ? opt.id === 'ramadan_special'
                            ? 'bg-[#002b49] text-[#C5A059] border-[#C5A059]'
                            : 'bg-sap-primary text-white border-sap-primary'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card Radius */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-600 dark:text-slate-300">
                  انحناء زوايا الكروت
                </label>
                <span className="text-xs font-bold text-slate-500 tabular-nums">
                  {styleConfig.borderRadius}px
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="28"
                value={styleConfig.borderRadius}
                onChange={e =>
                  setStyleConfig({ ...styleConfig, borderRadius: Number(e.target.value) })
                }
                className="w-full accent-sap-primary"
              />
            </div>
          </div>
        )}

        {activeTab === 'style' && (
          <div className="space-y-5">
            {/* Sync Banner with Registered System Company Name */}
            <div className="p-4 rounded-2xl bg-sap-primary/10 border border-sap-primary/25 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-sap-primary">
                    الشركة المسجلة في إعدادات النظام:
                  </div>
                  <div className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                    {settings.orgName}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSyncFromSettings(false)}
                  className="px-3 py-1.5 bg-sap-primary hover:bg-sap-primary-hover text-white rounded-xl text-[11px] font-black flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
                >
                  <RefreshCw size={13} />
                  <span>مزامنة الآن</span>
                </button>
              </div>
            </div>

            {/* Company Info */}
            <div className="space-y-3.5 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <label className="text-xs font-black text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <Building size={15} /> بيانات الشركة على المجلة
              </label>

              {/* Logo Upload */}
              <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                  {resolvedCompanyLogo ? (
                    <img
                      src={resolvedCompanyLogo}
                      className="w-full h-full object-contain"
                      alt="Logo"
                    />
                  ) : (
                    <Building size={20} className="text-slate-400" />
                  )}
                </div>
                <div className="flex-1 flex flex-wrap gap-2">
                  <input
                    type="file"
                    ref={logoFileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = async re => {
                          const compressed = await compressImage(re.target?.result as string);
                          setStyleConfig(prev => ({ ...prev, companyLogo: compressed }));
                        };
                        reader.readAsDataURL(file);
                      }
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => logoFileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-sap-primary text-white rounded-lg text-[11px] font-black hover:bg-sap-primary-hover"
                  >
                    تغيير الشعار
                  </button>
                  {styleConfig.companyLogo && (
                    <button
                      type="button"
                      onClick={() => setStyleConfig(prev => ({ ...prev, companyLogo: null }))}
                      className="px-2 py-1.5 text-red-500 text-[11px] font-bold"
                    >
                      إزالة
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  اسم الشركة / المؤسسة
                </label>
                <input
                  type="text"
                  value={resolvedCompanyName}
                  onChange={e => setStyleConfig({ ...styleConfig, companyName: e.target.value })}
                  className="w-full p-2.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  placeholder={settings.orgName || 'اسم الشركة'}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  الرقم الضريبي (VAT)
                </label>
                <input
                  type="text"
                  value={resolvedTaxNumber}
                  onChange={e =>
                    setStyleConfig({ ...styleConfig, companyTaxNumber: e.target.value })
                  }
                  className="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
                  placeholder="الرقم الضريبي من الإعدادات"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    الهاتف
                  </label>
                  <input
                    type="text"
                    value={styleConfig.companyPhone || ''}
                    onChange={e =>
                      setStyleConfig({ ...styleConfig, companyPhone: e.target.value })
                    }
                    className="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
                    placeholder="966500000000"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="text"
                    value={styleConfig.companyEmail || ''}
                    onChange={e =>
                      setStyleConfig({ ...styleConfig, companyEmail: e.target.value })
                    }
                    className="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    placeholder="info@company.com"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  العنوان أو ترويسة المؤسسة
                </label>
                <input
                  type="text"
                  value={styleConfig.companyAddress || ''}
                  onChange={e =>
                    setStyleConfig({ ...styleConfig, companyAddress: e.target.value })
                  }
                  className="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  placeholder="المدينة، العنوان..."
                />
              </div>
            </div>

            {/* Footer & Terms */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <FileText size={14} /> تذييل وشروط العرض
                </label>
                <input
                  type="checkbox"
                  checked={styleConfig.showCompanyFooter !== false}
                  onChange={e =>
                    setStyleConfig({ ...styleConfig, showCompanyFooter: e.target.checked })
                  }
                  className="w-4 h-4 rounded accent-sap-primary"
                />
              </div>
              <textarea
                value={styleConfig.footerTerms || ''}
                onChange={e => setStyleConfig({ ...styleConfig, footerTerms: e.target.value })}
                rows={3}
                className="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 resize-none"
                placeholder="شروط وتفاصيل العرض..."
              />
            </div>

            {/* Colors & Typography */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <label className="text-xs font-black text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <Palette size={14} /> الألوان والخطوط
              </label>

              <div className="flex flex-wrap gap-2">
                {['#006C35', '#00A09D', '#DC2626', '#2563EB', '#0F172A', '#7C3AED', '#C5A059'].map(
                  c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setStyleConfig({ ...styleConfig, primaryColor: c })}
                      className={`w-8 h-8 rounded-full shadow-xs transition-transform ${
                        styleConfig.primaryColor === c
                          ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  )
                )}
                <div className="relative">
                  <input
                    type="color"
                    value={styleConfig.primaryColor}
                    onChange={e =>
                      setStyleConfig({ ...styleConfig, primaryColor: e.target.value })
                    }
                    className="w-8 h-8 opacity-0 absolute inset-0 cursor-pointer"
                  />
                  <div className="w-8 h-8 rounded-full bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)] flex items-center justify-center border border-slate-300">
                    <Plus size={14} className="text-white drop-shadow" />
                  </div>
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-700">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  الخط الأساسي
                </label>
                <select
                  value={styleConfig.fontFamily}
                  onChange={e => setStyleConfig({ ...styleConfig, fontFamily: e.target.value })}
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100"
                >
                  <option value="Cairo">Cairo (عصري - موصى به)</option>
                  <option value="Tajawal">Tajawal (واضح ومتناسق)</option>
                  <option value="Segoe UI">Segoe UI (رسمي)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Bottom Actions */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 shrink-0">
        <button
          type="button"
          onClick={() => setShowProductPicker(true)}
          className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-colors"
        >
          <Plus size={16} /> إضافة منتجات للمجلة
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-2.5 bg-sap-primary hover:bg-sap-primary-hover text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
        >
          {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          <span>حفظ المجلة</span>
        </button>
      </div>
    </>
  );

  return (
    <div
      className="h-full flex bg-slate-100 dark:bg-slate-950 overflow-hidden relative"
      dir="rtl"
    >
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[360px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex-col shrink-0 z-20 h-full">
        {renderSidebarBody()}
      </aside>

      {/* Mobile / Split-Screen Drawer Sidebar */}
      {isMobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex"
          onClick={() => setIsMobileSidebarOpen(false)}
        >
          <aside
            className="w-[340px] max-w-[90vw] bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl border-l border-slate-200 dark:border-slate-800"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                أدوات تحرير المجلة
              </span>
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            {renderSidebarBody()}
          </aside>
        </div>
      )}

      {/* MAIN STUDIO CANVAS */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Top Studio Toolbar */}
        <div className="min-h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-2 px-4 py-2 shrink-0 z-10">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden px-3 py-1.5 bg-sap-primary text-white rounded-lg text-xs font-black flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal size={14} />
              <span>التحرير</span>
            </button>

            <button
              type="button"
              onClick={() => setShowProductPicker(true)}
              className="lg:hidden px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-black flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Plus size={14} />
              <span>منتج</span>
            </button>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setZoom(z => Math.max(50, z - 10))}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300"
                title="تصغير"
              >
                <ZoomOut size={15} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(100)}
                className="text-[11px] font-mono font-bold px-2 text-slate-700 dark:text-slate-200 tabular-nums"
                title="إعادة ضبط التكبير إلى 100%"
              >
                {zoom}%
              </button>
              <button
                type="button"
                onClick={() => setZoom(z => Math.min(150, z + 10))}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300"
                title="تكبير"
              >
                <ZoomIn size={15} />
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />

            <button
              type="button"
              onClick={downloadAsImage}
              disabled={isGenerating}
              className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg text-xs font-black flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {isGenerating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ImageIcon size={14} />
              )}
              <span>صورة PNG</span>
            </button>

            <button
              type="button"
              onClick={downloadAsPdf}
              disabled={isGenerating}
              className="px-3 py-1.5 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg text-xs font-black flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {isGenerating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileText size={14} />
              )}
              <span>ملف PDF</span>
            </button>

            <button
              type="button"
              onClick={printCatalog}
              className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg text-xs font-black flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Printer size={14} />
              <span>طباعة</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleNewCatalog}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="إنشاء مجلة جديدة"
            >
              <FilePlus2 size={14} />
              <span>جديد</span>
            </button>

            <button
              type="button"
              onClick={() => setIsViewerMode(true)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Eye size={14} />
              <span>معاينة تفاعلية</span>
            </button>

            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="px-3 py-1.5 bg-sap-primary text-white hover:bg-sap-primary-hover rounded-lg text-xs font-black flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <QrCode size={14} />
              <span>مشاركة</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSavedModal(true)}
              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg shrink-0"
              title="الأرشيف والمجلات المحفوظة"
            >
              <FolderOpen size={16} />
            </button>
          </div>
        </div>

        {/* Canvas Backdrop */}
        <div className="flex-1 overflow-auto bg-slate-200/80 dark:bg-slate-950 flex justify-center items-start p-6 sm:p-10 custom-scrollbar">
          <div
            ref={canvasRef}
            className="bg-white shadow-2xl transition-transform origin-top relative overflow-hidden shrink-0"
            style={{
              width: styleConfig.isQuotationMode ? '794px' : '375px',
              minHeight: styleConfig.isQuotationMode ? '1123px' : '780px',
              transform: `scale(${zoom / 100})`,
              backgroundColor: styleConfig.backgroundColor,
              fontFamily: styleConfig.fontFamily,
            }}
          >
            {renderCatalogHeader()}

            {/* Sections & Items */}
            <div className={`p-5 space-y-6 ${!styleConfig.isQuotationMode ? 'pb-20' : ''}`}>
              {Object.keys(groupedItems).length === 0 ? (
                <div className="py-24 text-center opacity-40">
                  <ShoppingBag
                    size={44}
                    className={`mx-auto mb-3 ${
                      styleConfig.layoutType === 'ramadan_special'
                        ? 'text-white'
                        : 'text-slate-400'
                    }`}
                  />
                  <p
                    className={`text-sm font-black ${
                      styleConfig.layoutType === 'ramadan_special'
                        ? 'text-white'
                        : 'text-slate-600'
                    }`}
                  >
                    ابدأ بإضافة منتجات لإنشاء مجلة {resolvedCompanyName}
                  </p>
                </div>
              ) : (
                Object.entries(groupedItems).map(([section, sectionItems]) => {
                  const cols =
                    styleConfig.layoutType === 'restaurant_menu'
                      ? styleConfig.columnsCount === 1
                        ? 1
                        : 2
                      : styleConfig.columnsCount || (styleConfig.cardSize === 'compact' ? 3 : 2);

                  const gridColsClass =
                    cols === 1
                      ? 'grid-cols-1 gap-4'
                      : cols === 3
                      ? 'grid-cols-3 gap-2.5'
                      : cols === 4
                      ? 'grid-cols-4 gap-2'
                      : 'grid-cols-2 gap-3';

                  return (
                    <div key={section} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-1 h-4 rounded-full"
                          style={{
                            backgroundColor:
                              styleConfig.layoutType === 'ramadan_special'
                                ? '#C5A059'
                                : styleConfig.primaryColor,
                          }}
                        />
                        <h3
                          className={`font-black text-sm ${
                            styleConfig.layoutType === 'ramadan_special'
                              ? 'text-white'
                              : 'text-slate-800'
                          }`}
                        >
                          {section}
                        </h3>
                      </div>
                      <div className={`grid ${gridColsClass}`}>
                        {Array.isArray(sectionItems) &&
                          sectionItems.map(item => <ItemCard key={item.id} item={item} />)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {renderCatalogFooter()}

            {/* Floating Cart Simulation for Mobile Layout */}
            {!styleConfig.isQuotationMode && (
              <div className="sticky bottom-4 mx-auto w-fit bg-slate-900 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 text-xs font-black mb-4">
                <ShoppingBag size={15} />
                <span>سلة الشراء ({cart.reduce((a, b) => a + b.qty, 0)})</span>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* --- MODALS --- */}

      {/* Product Picker Modal (with Category Bulk Import & Quick Add) */}
      {showProductPicker && (
        <div className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
              <h3 className="font-black text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShoppingBag size={18} className="text-sap-primary" /> إضافة منتجات إلى المجلة
              </h3>
              <button
                type="button"
                onClick={() => setShowProductPicker(false)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو الباركود أو القسم..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
                  {productCategories.slice(0, 10).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setPickerCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors ${
                        pickerCategory === cat
                          ? 'bg-sap-primary text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {pickerCategory !== 'الكل' && (
                  <button
                    type="button"
                    onClick={() => addCategoryBulk(pickerCategory)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black whitespace-nowrap shrink-0"
                  >
                    استيراد القسم بالكامل
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
              <button
                type="button"
                onClick={() => addItem()}
                className="w-full py-3.5 border-2 border-dashed border-sap-primary/40 bg-sap-primary/5 rounded-2xl text-sap-primary font-black text-xs hover:bg-sap-primary/10 transition-colors flex items-center justify-center gap-2 mb-3"
              >
                <Plus size={16} /> إضافة عنصر مخصص جديد (يدوي)
              </button>

              {filteredProducts.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-bold">
                  لا توجد منتجات مطابقة
                </div>
              ) : (
                filteredProducts.map(p => {
                  const isAdded = addedProductCodes.has(p.code);
                  return (
                    <div
                      key={p.id}
                      onClick={() => addItem(p, true)}
                      className="flex justify-between items-center p-3.5 bg-white dark:bg-slate-900 hover:border-sap-primary cursor-pointer rounded-2xl border border-slate-200/80 dark:border-slate-800 transition-colors group"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {p.name}
                          </span>
                          {isAdded && (
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                              مضاف ✓
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                          <span>{p.code}</span>
                          <span>·</span>
                          <span className="font-sans">{p.category || 'عام'}</span>
                          <span>·</span>
                          <span className="font-black text-slate-600 dark:text-slate-300 tabular-nums">
                            {p.price}
                          </span>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-sap-primary group-hover:text-white transition-colors shrink-0">
                        <Plus size={15} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Saved Catalogs Archive Modal */}
      {showSavedModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
              <h3 className="font-black text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FolderOpen size={18} className="text-sap-primary" /> أرشيف المجلات المحفوظة
              </h3>
              <button
                type="button"
                onClick={() => setShowSavedModal(false)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-slate-50/50 dark:bg-slate-950/40">
              {savedCatalogs.length === 0 ? (
                <div className="py-14 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                  <FolderOpen size={30} className="mb-2 opacity-30" />
                  <p className="font-bold text-xs">لا توجد مجلات محفوظة في الأرشيف بعد</p>
                </div>
              ) : (
                savedCatalogs.map(cat => (
                  <div
                    key={cat.id}
                    onClick={() => loadProject(cat)}
                    className="flex justify-between items-center p-4 bg-white dark:bg-slate-900 hover:border-sap-primary cursor-pointer rounded-2xl border border-slate-200/80 dark:border-slate-800 transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="font-black text-xs text-slate-900 dark:text-slate-100 group-hover:text-sap-primary truncate">
                        {cat.name}
                      </div>
                      <div className="text-[11px] font-bold text-slate-400 mt-1 flex items-center gap-2 tabular-nums">
                        <span>{new Date(cat.date).toLocaleDateString('ar-SA')}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Package size={11} /> {cat.items?.length || 0} منتج
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={e => handleDeleteSavedCatalog(e, cat)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        title="حذف المجلة"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share & QR Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden space-y-5">
            <div
              className="absolute top-0 left-0 w-full h-1.5"
              style={{ backgroundColor: styleConfig.primaryColor }}
            />
            <div className="flex items-center justify-between">
              <div className="text-right">
                <div className="text-[11px] font-black text-sap-primary">{resolvedCompanyName}</div>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  مشاركة المجلة الرقمية
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-200 inline-block shadow-sm">
              <img src={qrCodeImageUrl} alt="QR Code" className="w-44 h-44" />
            </div>

            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
              <input
                type="text"
                readOnly
                value={shareableUrl}
                className="flex-1 bg-transparent text-[11px] font-mono text-slate-600 dark:text-slate-300 px-2 focus:outline-none"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(shareableUrl);
                  setCopiedLink(true);
                  notify('تم نسخ رابط المجلة بنجاح', 'success');
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-100 shadow-xs flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                {copiedLink ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{copiedLink ? 'تم النسخ' : 'نسخ'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowShareModal(false);
                  setIsViewerMode(true);
                }}
                className="py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl font-black text-xs flex items-center justify-center gap-1.5"
              >
                <Eye size={15} /> معاينة داخلية
              </button>
              <a
                href={shareableUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 bg-sap-primary hover:bg-sap-primary-hover text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5"
              >
                <ExternalLink size={15} /> فتح الرابط
              </a>
            </div>
          </div>
        </div>
      )}

      {renderConfirmModal()}
    </div>
  );
};
