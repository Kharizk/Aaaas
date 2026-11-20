import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  PriceGroup,
  PriceGroupBoard,
  PriceGroupItem,
  Product,
  Unit,
  PriceGroupStyles,
  PriceGroupTheme,
} from '../types';
import { db } from '../services/supabase';
import { useSystemSettings } from './SystemSettingsContext';
import { CurrencySymbolRenderer } from './CurrencySymbolRenderer';
import { toPng } from 'html-to-image';
import {
  Plus,
  Trash2,
  Save,
  Printer,
  FolderOpen,
  Loader2,
  Download,
  X,
  ZoomIn,
  ZoomOut,
  Search,
  Copy,
  LayoutGrid,
  Star,
  FilePlus,
  Layers,
  Smartphone,
  Monitor,
  Layout,
  Zap,
  Flame,
  Crown,
  Boxes,
  Type,
  Paintbrush,
  Check,
  Grid,
  Diamond,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Trash,
  Sparkles,
  Moon,
  Calendar,
  Leaf,
  ShoppingBag,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Tv,
  Clock,
  Megaphone,
  Upload,
  CheckSquare,
  Square,
  SlidersHorizontal,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react';

type AspectMode = 'a4_landscape' | 'screen_16_9' | 'screen_9_16';

const ASPECT_DIMENSIONS: Record<
  AspectMode,
  { width: number; height: number; cssWidth: string; cssHeight: string; label: string }
> = {
  a4_landscape: {
    width: 1122,
    height: 794,
    cssWidth: '297mm',
    cssHeight: '210mm',
    label: 'A4 عرضي (طباعة)',
  },
  screen_16_9: {
    width: 1280,
    height: 720,
    cssWidth: '1280px',
    cssHeight: '720px',
    label: 'شاشة عرضية 16:9',
  },
  screen_9_16: {
    width: 720,
    height: 1280,
    cssWidth: '720px',
    cssHeight: '1280px',
    label: 'شاشة طولية 9:16',
  },
};

const DEFAULT_STYLES: PriceGroupStyles = {
  primaryColor: '#006C35',
  backgroundColor: '#ffffff',
  textColor: '#0f172a',
  priceColor: '#006C35',
  secondaryColor: '#C5A059',
  borderColor: '#006C35',
  titleFontSize: 48,
  itemFontSize: 22,
  priceFontSize: 38,
  currencyFontSize: 16,
  titleWeight: '900',
  itemWeight: '700',
  priceWeight: '900',
  columns: 1,
  borderWidth: 8,
  padding: 32,
  boardsPerPage: 2,
  showGeometricPattern: true,
  currencySymbolType: 'icon',
  currencySymbolImage: null,
  aspectMode: 'a4_landscape',
  showClock: true,
  showTicker: false,
  tickerText: 'أهلاً بكم — عروض وتخفيضات طازجة يومياً، الأسعار شاملة ضريبة القيمة المضافة 15%',
  slideDurationSec: 10,
  showBoardFooter: true,
};

const compressImageToDataUrl = (file: File, maxDim = 360): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png', 0.85));
      };
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const calcDiscountPercent = (priceStr?: string, originalStr?: string): number | null => {
  const p = parseFloat(String(priceStr || '').replace(/[^\d.]/g, ''));
  const o = parseFloat(String(originalStr || '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(p) || !Number.isFinite(o) || o <= p || o <= 0) return null;
  const pct = Math.round(((o - p) / o) * 100);
  return pct > 0 && pct < 100 ? pct : null;
};

export const PriceGroupManager: React.FC = () => {
  const { settings } = useSystemSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [projects, setProjects] = useState<PriceGroup[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Project State
  const [projectName, setProjectName] = useState('شاشة عروض الأسعار');
  const [boards, setBoards] = useState<PriceGroupBoard[]>([
    {
      id: 'board_a',
      title: 'قائمة الأصناف المختارة',
      subtitle: 'الأسعار شاملة ضريبة القيمة المضافة',
      items: [],
      isActive: true,
    },
    {
      id: 'board_b',
      title: 'عروض اليوم المميزة',
      subtitle: 'سارية حتى نفاد الكمية',
      items: [],
      isActive: true,
    },
  ]);
  const [activeBoardIdx, setActiveBoardIdx] = useState(0);

  const [showLogo, setShowLogo] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [themeId, setThemeId] = useState<PriceGroupTheme>('geometric_luxe');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(55);
  const [autoFitEnabled, setAutoFitEnabled] = useState(true);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isProgrammaticChange = useRef(true);

  // UI / Modals
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [archiveSearch, setArchiveSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'content' | 'styling' | 'display'>('content');
  const [boardsPerPage, setBoardsPerPage] = useState<1 | 2>(2);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [downloadDialog, setDownloadDialog] = useState<{
    isOpen: boolean;
    fileName: string;
    targetId?: string;
  } | null>(null);
  const [saveProjectDialog, setSaveProjectDialog] = useState<{
    isOpen: boolean;
    projectName: string;
  } | null>(null);
  const [showAdvancedColors, setShowAdvancedColors] = useState(false);
  const [showBoardFloatingBar, setShowBoardFloatingBar] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Live Presentation / Digital Signage Mode
  const [isPresenting, setIsPresenting] = useState(false);
  const [presentSlideIdx, setPresentSlideIdx] = useState(0);
  const [isSlidePlaying, setIsSlidePlaying] = useState(true);
  const [hudVisible, setHudVisible] = useState(true);
  const [liveTime, setLiveTime] = useState(() => new Date());
  const [presentScale, setPresentScale] = useState(1);

  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const presentationRef = useRef<HTMLDivElement>(null);
  const hudTimeoutRef = useRef<number | null>(null);

  const [styles, setStyles] = useState<PriceGroupStyles>({
    ...DEFAULT_STYLES,
    currencySymbolType: settings.currencySymbolType || 'icon',
    currencySymbolImage: settings.currencySymbolImage || null,
  });

  const aspectMode: AspectMode = styles.aspectMode || 'a4_landscape';
  const currentAspect = ASPECT_DIMENSIONS[aspectMode];
  const effectiveBoardsPerPage: 1 | 2 = aspectMode === 'a4_landscape' ? boardsPerPage : 1;

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  // Track unsaved changes
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
    setStyles((prev) => ({
      ...prev,
      currencySymbolType: settings.currencySymbolType || prev.currencySymbolType,
      currencySymbolImage: settings.currencySymbolImage || prev.currencySymbolImage,
    }));
  }, [settings.currencySymbolType, settings.currencySymbolImage]);

  useEffect(() => {
    fetchData();
  }, []);

  // Live clock tick (used in TV clock & preview)
  useEffect(() => {
    const timer = window.setInterval(() => setLiveTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Auto-Fit canvas zoom to viewport
  const computeFitZoom = useCallback(() => {
    const el = canvasViewportRef.current;
    if (!el) return;
    const availW = Math.max(240, el.clientWidth - 64);
    const availH = Math.max(200, el.clientHeight - 88);
    const scaleX = availW / currentAspect.width;
    const scaleY = availH / currentAspect.height;
    const fitPct = Math.max(20, Math.min(130, Math.floor(Math.min(scaleX, scaleY) * 100)));
    setPreviewZoom(fitPct);
  }, [currentAspect.width, currentAspect.height]);

  useEffect(() => {
    if (!autoFitEnabled) return;
    computeFitZoom();
    const el = canvasViewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(() => computeFitZoom());
    obs.observe(el);
    return () => obs.disconnect();
  }, [autoFitEnabled, computeFitZoom]);

  // Active boards for live slideshow
  const activeSlides = useMemo(() => {
    const filtered = boards.filter((b) => b.isActive !== false);
    return filtered.length > 0 ? filtered : boards;
  }, [boards]);

  // Auto-advance slideshow in presentation mode
  useEffect(() => {
    if (!isPresenting || !isSlidePlaying || activeSlides.length <= 1) return;
    const sec = Math.max(3, styles.slideDurationSec || 10);
    const timer = window.setInterval(() => {
      setPresentSlideIdx((prev) => (prev + 1) % activeSlides.length);
    }, sec * 1000);
    return () => window.clearInterval(timer);
  }, [isPresenting, isSlidePlaying, activeSlides.length, styles.slideDurationSec]);

  // Scale presentation screen to fit full viewport
  useEffect(() => {
    if (!isPresenting) return;
    const calcScale = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const s = Math.min(vw / currentAspect.width, vh / currentAspect.height);
      setPresentScale(s);
    };
    calcScale();
    window.addEventListener('resize', calcScale);
    return () => window.removeEventListener('resize', calcScale);
  }, [isPresenting, currentAspect.width, currentAspect.height]);

  // Keyboard shortcuts in presentation mode
  useEffect(() => {
    if (!isPresenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitPresentation();
      } else if (e.key === 'ArrowLeft') {
        setPresentSlideIdx((p) => (p + 1) % activeSlides.length);
      } else if (e.key === 'ArrowRight') {
        setPresentSlideIdx((p) => (p - 1 + activeSlides.length) % activeSlides.length);
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsSlidePlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPresenting, activeSlides.length]);

  const wakeHud = () => {
    setHudVisible(true);
    if (hudTimeoutRef.current) window.clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = window.setTimeout(() => setHudVisible(false), 3200);
  };

  const enterPresentation = () => {
    const activeIdxInSlides = activeSlides.findIndex((b) => b.id === boards[activeBoardIdx]?.id);
    setPresentSlideIdx(activeIdxInSlides >= 0 ? activeIdxInSlides : 0);
    setIsSlidePlaying(activeSlides.length > 1);
    setIsPresenting(true);
    wakeHud();
    if (presentationRef.current?.requestFullscreen) {
      presentationRef.current.requestFullscreen().catch(() => {});
    }
  };

  const exitPresentation = () => {
    setIsPresenting(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [pjs, p, u] = await Promise.all([
        db.priceGroups.getAll(),
        db.products.getAll(),
        db.units.getAll(),
      ]);
      setProjects(pjs as PriceGroup[]);
      setProducts(p);
      setUnits(u);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const unitMap = useMemo(() => {
    const m = new Map<string, string>();
    units.forEach((u) => m.set(u.id, u.name));
    return m;
  }, [units]);

  const executeSave = async (finalName: string) => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      // Keep small compressed logo (<120KB) safely; strip oversized strings to respect Firestore limits
      const safeLogo = logoUrl && logoUrl.length < 140000 ? logoUrl : null;
      const safeCurrencyImg =
        styles.currencySymbolImage && styles.currencySymbolImage.length < 120000
          ? styles.currencySymbolImage
          : null;

      const projectData: PriceGroup = {
        id: activeProjectId || crypto.randomUUID(),
        name: finalName.trim() || 'مشروع شاشات',
        date: new Date().toISOString(),
        boards,
        showLogo,
        logoUrl: safeLogo,
        themeId,
        styles: {
          ...styles,
          boardsPerPage,
          currencySymbolImage: safeCurrencyImg,
        },
      };
      await db.priceGroups.upsert(projectData);

      isProgrammaticChange.current = true;
      setActiveProjectId(projectData.id);
      setProjectName(projectData.name);
      setHasUnsavedChanges(false);

      fetchData();
      setSaveSuccess(true);
      showToast('تم حفظ مشروع الشاشات بنجاح');
      setTimeout(() => setSaveSuccess(false), 2600);
    } catch (e) {
      console.error(e);
      showToast('حدث خطأ أثناء حفظ المشروع', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    if (!activeProjectId) {
      setSaveProjectDialog({ isOpen: true, projectName });
    } else {
      executeSave(projectName);
    }
  };

  // Board Operations
  const safeBoardIdx = Math.min(activeBoardIdx, Math.max(0, boards.length - 1));
  const currentBoard = boards[safeBoardIdx] || boards[0];

  const addNewBoard = () => {
    const nextNum = boards.length + 1;
    const newBoard: PriceGroupBoard = {
      id: crypto.randomUUID(),
      title: `شاشة العرض ${nextNum}`,
      subtitle: 'الأسعار شاملة ضريبة القيمة المضافة',
      items: [],
      isActive: true,
    };
    setBoards((prev) => [...prev, newBoard]);
    setActiveBoardIdx(boards.length);
    showToast(`تمت إضافة ${newBoard.title}`);
  };

  const duplicateCurrentBoard = () => {
    if (!currentBoard) return;
    const copyBoard: PriceGroupBoard = {
      ...currentBoard,
      id: crypto.randomUUID(),
      title: `${currentBoard.title} (نسخة)`,
      items: currentBoard.items.map((item) => ({ ...item, id: crypto.randomUUID() })),
    };
    setBoards((prev) => {
      const next = [...prev];
      next.splice(safeBoardIdx + 1, 0, copyBoard);
      return next;
    });
    setActiveBoardIdx(safeBoardIdx + 1);
    showToast('تم نسخ الشاشة بنجاح');
  };

  const deleteBoard = (idx: number) => {
    if (boards.length <= 1) return;
    setConfirmDialog({
      isOpen: true,
      title: 'حذف الشاشة',
      message: `هل تريد حذف "${boards[idx].title}" وجميع الأصناف بداخلها؟`,
      onConfirm: () => {
        setBoards((prev) => prev.filter((_, i) => i !== idx));
        setActiveBoardIdx((prevIdx) => Math.max(0, prevIdx >= idx ? prevIdx - 1 : prevIdx));
        setConfirmDialog(null);
      },
    });
  };

  const moveBoardOrder = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= boards.length) return;
    setBoards((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setActiveBoardIdx(target);
  };

  // Item Operations
  const addManualItem = () => {
    const newItem: PriceGroupItem = {
      id: crypto.randomUUID(),
      label: 'صنف جديد',
      price: '0.00',
      originalPrice: '',
      unit: '',
      isOffer: false,
    };
    setBoards((prev) =>
      prev.map((b, i) => (i === safeBoardIdx ? { ...b, items: [...b.items, newItem] } : b))
    );
  };

  const addProductsToBoard = (itemsToAdd: Product[]) => {
    if (itemsToAdd.length === 0) return;
    const mapped: PriceGroupItem[] = itemsToAdd.map((product) => {
      const unitName = product.unitId ? unitMap.get(product.unitId) || '' : '';
      const hasDiscount =
        product.originalPrice &&
        parseFloat(product.originalPrice) > parseFloat(product.price || '0');
      return {
        id: crypto.randomUUID(),
        label: product.name,
        price: product.price || '0.00',
        originalPrice: product.originalPrice || '',
        unit: unitName,
        isOffer: Boolean(hasDiscount),
      };
    });
    setBoards((prev) =>
      prev.map((b, i) =>
        i === safeBoardIdx ? { ...b, items: [...b.items, ...mapped] } : b
      )
    );
    setSelectedProductIds(new Set());
    setShowProductPicker(false);
    showToast(`تمت إضافة ${mapped.length} صنف إلى الشاشة`);
  };

  const executeSaveAsImage = async (
    fileName: string,
    targetId: string = 'board-preview-container'
  ) => {
    const element = document.getElementById(targetId);
    if (!element) return;
    try {
      const dataUrl = await toPng(element, {
        quality: 1,
        pixelRatio: 2,
        skipFonts: true,
      });
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = dataUrl;
      link.click();
      showToast('تم تصدير الصورة بنجاح');
    } catch (err) {
      console.error('Error saving image:', err);
      showToast('حدث خطأ أثناء تصدير الصورة', 'error');
    }
  };

  const handleDuplicateProject = async (e: React.MouseEvent, pj: PriceGroup) => {
    e.stopPropagation();
    const newProject: PriceGroup = {
      ...pj,
      id: crypto.randomUUID(),
      name: `${pj.name} (نسخة)`,
      date: new Date().toISOString(),
    };
    try {
      await db.priceGroups.upsert(newProject);
      setProjects([newProject, ...projects]);
      loadProject(newProject);
      showToast('تم نسخ المشروع');
    } catch (err) {
      showToast('حدث خطأ أثناء النسخ', 'error');
    }
  };

  const loadProject = (pj: PriceGroup) => {
    isProgrammaticChange.current = true;
    setActiveProjectId(pj.id);
    setProjectName(pj.name);
    const legacyItems = (pj as any).items || [];
    const migratedBoards: PriceGroupBoard[] =
      pj.boards && pj.boards.length > 0
        ? pj.boards.map((b) => ({ ...b, isActive: b.isActive !== false }))
        : [
            {
              id: 'board_a',
              title: pj.name || 'الشاشة الأولى',
              items: legacyItems,
              isActive: true,
            },
            { id: 'board_b', title: 'الشاشة الثانية', items: [], isActive: true },
          ];
    setBoards(migratedBoards);
    setActiveBoardIdx(0);
    setShowLogo(pj.showLogo ?? true);
    setLogoUrl(pj.logoUrl || null);
    setThemeId(pj.themeId || 'geometric_luxe');
    if (pj.styles) {
      setStyles({
        ...DEFAULT_STYLES,
        ...pj.styles,
        currencySymbolImage:
          pj.styles.currencySymbolImage || settings.currencySymbolImage || null,
      });
      setBoardsPerPage(pj.styles.boardsPerPage || 2);
    }
    setActiveTab('content');
    setHasUnsavedChanges(false);
  };

  const createNew = () => {
    isProgrammaticChange.current = true;
    setActiveProjectId(null);
    setProjectName('شاشة عروض جديدة');
    setBoards([
      {
        id: 'board_a',
        title: 'قائمة الأصناف - 1',
        subtitle: 'الأسعار شاملة ضريبة القيمة المضافة',
        items: [],
        isActive: true,
      },
      {
        id: 'board_b',
        title: 'عروض اليوم - 2',
        subtitle: 'تخفيضات مميزة',
        items: [],
        isActive: true,
      },
    ]);
    setActiveBoardIdx(0);
    setActiveTab('content');
    setHasUnsavedChanges(false);
  };

  // Categories & Filtered Products for Picker
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return products
      .filter((p) => {
        if (selectedCategory !== 'ALL' && (p.category || '').trim() !== selectedCategory) {
          return false;
        }
        if (!term) return true;
        return (
          p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term)
        );
      })
      .slice(0, 60);
  }, [searchTerm, products, selectedCategory]);

  const filteredProjects = useMemo(() => {
    const q = archiveSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, archiveSearch]);

  const themesList: Array<{
    id: PriceGroupTheme;
    name: string;
    icon: React.ComponentType<{ size?: number | string; className?: string }>;
    previewBg: string;
    previewAccent: string;
    isDark?: boolean;
  }> = [
    { id: 'geometric_luxe', name: 'الحديث النظيف', icon: Layout, previewBg: '#ffffff', previewAccent: '#006C35' },
    { id: 'dark_menu_board', name: 'منيو شاشات داكن', icon: Tv, previewBg: '#0f172a', previewAccent: '#f59e0b', isDark: true },
    { id: 'neon_promo_tv', name: 'عروض TV جريئة', icon: Flame, previewBg: '#111827', previewAccent: '#ef4444', isDark: true },
    { id: 'minimal_kiosk', name: 'كيوسك حديث', icon: Monitor, previewBg: '#f8fafc', previewAccent: '#0284c7' },
    { id: 'modern_grid', name: 'الشبكة التقنية', icon: Grid, previewBg: '#ffffff', previewAccent: '#2563eb' },
    { id: 'royal_minimal', name: 'الكلاسيكي الفاخر', icon: Crown, previewBg: '#fffbeb', previewAccent: '#92400e' },
    { id: 'digital_punch', name: 'العروض القوية', icon: Zap, previewBg: '#ffffff', previewAccent: '#dc2626' },
    { id: 'abstract_gradient', name: 'الناعم العضوي', icon: Sparkles, previewBg: '#f0fdf4', previewAccent: '#16a34a' },
    { id: 'ramadan_vibes', name: 'رمضاني', icon: Moon, previewBg: '#fefce8', previewAccent: '#854d0e' },
    { id: 'super_market', name: 'سوبر ماركت', icon: ShoppingBag, previewBg: '#ffffff', previewAccent: '#ea580c' },
    { id: 'elegant_gold', name: 'ذهبي فاخر', icon: Diamond, previewBg: '#0f172a', previewAccent: '#eab308', isDark: true },
    { id: 'fresh_nature', name: 'طبيعة طازجة', icon: Leaf, previewBg: '#f0fdf4', previewAccent: '#15803d' },
  ];

  const applyThemeWithRecommendedColors = (newThemeId: PriceGroupTheme) => {
    setThemeId(newThemeId);
    if (newThemeId === 'dark_menu_board') {
      setStyles((prev) => ({
        ...prev,
        backgroundColor: '#0f172a',
        textColor: '#f8fafc',
        primaryColor: '#f59e0b',
        secondaryColor: '#334155',
        priceColor: '#fbbf24',
        borderColor: '#334155',
      }));
    } else if (newThemeId === 'neon_promo_tv') {
      setStyles((prev) => ({
        ...prev,
        backgroundColor: '#111827',
        textColor: '#ffffff',
        primaryColor: '#dc2626',
        secondaryColor: '#facc15',
        priceColor: '#facc15',
        borderColor: '#dc2626',
      }));
    } else if (newThemeId === 'elegant_gold') {
      setStyles((prev) => ({
        ...prev,
        backgroundColor: '#0f172a',
        textColor: '#f8fafc',
        primaryColor: '#C5A059',
        secondaryColor: '#C5A059',
        priceColor: '#eab308',
        borderColor: '#C5A059',
      }));
    } else if (
      themeId === 'dark_menu_board' ||
      themeId === 'neon_promo_tv' ||
      themeId === 'elegant_gold'
    ) {
      // Switching back from a dark theme to a light theme
      setStyles((prev) => ({
        ...prev,
        backgroundColor: '#ffffff',
        textColor: '#0f172a',
        primaryColor: '#006C35',
        secondaryColor: '#C5A059',
        priceColor: '#006C35',
        borderColor: '#006C35',
      }));
    }
  };

  const colorPresets = [
    {
      name: 'أخضر كلاسيكي',
      colors: {
        primaryColor: '#006C35',
        secondaryColor: '#C5A059',
        backgroundColor: '#ffffff',
        textColor: '#0f172a',
        priceColor: '#006C35',
        borderColor: '#006C35',
      },
    },
    {
      name: 'شاشة داكنة ذهبي',
      colors: {
        primaryColor: '#f59e0b',
        secondaryColor: '#475569',
        backgroundColor: '#0f172a',
        textColor: '#f8fafc',
        priceColor: '#fbbf24',
        borderColor: '#334155',
      },
    },
    {
      name: 'أزرق تقني',
      colors: {
        primaryColor: '#2563eb',
        secondaryColor: '#0ea5e9',
        backgroundColor: '#f8fafc',
        textColor: '#0f172a',
        priceColor: '#2563eb',
        borderColor: '#cbd5e1',
      },
    },
    {
      name: 'عروض حمراء',
      colors: {
        primaryColor: '#dc2626',
        secondaryColor: '#f97316',
        backgroundColor: '#ffffff',
        textColor: '#1e293b',
        priceColor: '#dc2626',
        borderColor: '#dc2626',
      },
    },
    {
      name: 'شاشة ليل أحمر',
      colors: {
        primaryColor: '#ef4444',
        secondaryColor: '#facc15',
        backgroundColor: '#111827',
        textColor: '#ffffff',
        priceColor: '#facc15',
        borderColor: '#ef4444',
      },
    },
  ];

  // Shared Price Block Renderer (with original price strikethrough & discount %)
  const renderPriceBlock = (
    item: PriceGroupItem,
    s: PriceGroupStyles,
    scale: number,
    options?: {
      priceColorOverride?: string;
      currencyColorOverride?: string;
      fontMono?: boolean;
      priceBoost?: number;
    }
  ) => {
    const discountPct = calcDiscountPercent(item.price, item.originalPrice);
    const pColor =
      options?.priceColorOverride || (item.isOffer ? '#ef4444' : s.priceColor);
    const cColor = options?.currencyColorOverride || s.textColor;
    const boost = options?.priceBoost || 1;

    return (
      <div className="flex flex-col items-end shrink-0">
        <div className="flex items-baseline gap-1.5 flex-nowrap">
          {item.originalPrice && (
            <span
              className="line-through opacity-55 font-bold tabular-nums ml-1"
              style={{
                fontSize: `${Math.max(11, s.itemFontSize * scale * 0.72)}px`,
                color: cColor,
              }}
            >
              {item.originalPrice}
            </span>
          )}
          <span
            className={`font-black tabular-nums leading-none ${
              options?.fontMono ? 'font-mono' : ''
            }`}
            style={{
              fontSize: `${s.priceFontSize * scale * boost}px`,
              color: pColor,
            }}
          >
            {item.price}
          </span>
          <CurrencySymbolRenderer
            type={s.currencySymbolType || 'icon'}
            imageUrl={s.currencySymbolImage}
            color={cColor}
            style={{
              width: `${s.currencyFontSize * scale}px`,
              height: `${s.currencyFontSize * scale}px`,
            }}
          />
        </div>
        {discountPct && (
          <span
            className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-600 text-white mt-1 tabular-nums"
            style={{ fontSize: `${Math.max(9, 10 * scale)}px` }}
          >
            وفر {discountPct}%
          </span>
        )}
      </div>
    );
  };

  // Board Renderer (all 12 themes + live clock + ticker footer)
  const BoardRenderer = ({
    board,
    s,
    isSmall = false,
  }: {
    board: PriceGroupBoard;
    s: PriceGroupStyles;
    isSmall?: boolean;
  }) => {
    const isPortraitScreen = aspectMode === 'screen_9_16';
    const scale = isSmall ? 0.75 : isPortraitScreen ? 0.92 : 1;
    const cols = Math.max(1, Math.min(3, s.columns || 1));
    const gridColsClass =
      cols === 3 ? 'grid-cols-3' : cols === 2 ? 'grid-cols-2' : 'grid-cols-1';

    const timeStr = liveTime.toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const EmptyState = () => (
      <div className="h-full min-h-[260px] flex flex-col items-center justify-center opacity-35 col-span-full">
        <Boxes size={56} className="mb-3" style={{ color: s.primaryColor }} />
        <p className="font-black text-xl" style={{ color: s.textColor }}>
          الشاشة فارغة حالياً
        </p>
        <p className="font-bold text-xs mt-1.5" style={{ color: s.textColor }}>
          أضف منتجات من المتجر أو أنشئ أصنافاً يدوية من الشريط الجانبي
        </p>
      </div>
    );

    const TickerAndClockBar = ({ darkSurface = false }: { darkSurface?: boolean }) => {
      if (!s.showClock && !s.showTicker && !s.showBoardFooter) return null;
      return (
        <div
          className="mt-auto pt-3 border-t flex items-center justify-between gap-4 relative z-10 shrink-0"
          style={{
            borderColor: darkSurface ? 'rgba(255,255,255,0.12)' : `${s.primaryColor}25`,
          }}
        >
          {s.showTicker && s.tickerText ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span
                className="px-2.5 py-1 rounded text-[11px] font-black text-white shrink-0"
                style={{ backgroundColor: s.primaryColor }}
              >
                إعلان
              </span>
              <p
                className="font-bold truncate"
                style={{
                  fontSize: `${Math.max(12, 14 * scale)}px`,
                  color: s.textColor,
                }}
              >
                {s.tickerText}
              </p>
            </div>
          ) : (
            <div
              className="text-[11px] font-bold opacity-60"
              style={{ color: s.textColor }}
            >
              {s.showBoardFooter !== false
                ? board.subtitle || 'الأسعار شاملة ضريبة القيمة المضافة'
                : ''}
            </div>
          )}

          {s.showClock && aspectMode !== 'a4_landscape' && (
            <div
              className="flex items-center gap-1.5 font-black tabular-nums shrink-0 opacity-85"
              style={{
                fontSize: `${Math.max(13, 16 * scale)}px`,
                color: s.textColor,
              }}
            >
              <Clock size={14 * scale} style={{ color: s.primaryColor }} />
              <span>{timeStr}</span>
            </div>
          )}
        </div>
      );
    };

    // Theme: dark_menu_board (شاشة منيو داكنة)
    if (themeId === 'dark_menu_board') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden"
          style={{
            padding: `${s.padding * scale}px`,
            backgroundColor: s.backgroundColor || '#0f172a',
            border: `${s.borderWidth * scale}px solid ${s.borderColor || '#334155'}`,
          }}
        >
          <div className="flex items-center justify-between gap-4 pb-5 mb-6 border-b border-white/10">
            <div className="min-w-0">
              <h1
                className="font-black tracking-tight leading-tight"
                style={{ fontSize: `${s.titleFontSize * scale}px`, color: s.primaryColor }}
              >
                {board.title}
              </h1>
              {board.subtitle && (
                <p
                  className="font-bold mt-1 opacity-75"
                  style={{
                    fontSize: `${Math.max(12, s.itemFontSize * scale * 0.65)}px`,
                    color: s.textColor,
                  }}
                >
                  {board.subtitle}
                </p>
              )}
            </div>
            {showLogo && logoUrl && (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-12' : 'h-16'} object-contain shrink-0`}
              />
            )}
          </div>

          <div
            className={`flex-1 grid ${gridColsClass} gap-x-8 gap-y-3 content-start overflow-hidden`}
          >
            {board.items.length === 0 ? (
              <EmptyState />
            ) : (
              board.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl border border-white/10 bg-white/[0.04]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-bold break-words"
                        style={{
                          fontSize: `${s.itemFontSize * scale}px`,
                          color: s.textColor,
                          lineHeight: 1.3,
                        }}
                      >
                        {item.label}
                      </span>
                      {(item.isOffer || item.badgeText) && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-slate-950 shrink-0">
                          {item.badgeText || 'عرض'}
                        </span>
                      )}
                    </div>
                    {item.unit && (
                      <div
                        className="text-xs opacity-60 font-semibold mt-0.5"
                        style={{ color: s.textColor }}
                      >
                        {item.unit}
                      </div>
                    )}
                  </div>
                  {renderPriceBlock(item, s, scale, {
                    priceColorOverride: item.isOffer ? '#f87171' : s.priceColor,
                    currencyColorOverride: s.textColor,
                  })}
                </div>
              ))
            )}
          </div>

          <TickerAndClockBar darkSurface />
        </div>
      );
    }

    // Theme: neon_promo_tv (عروض TV جريئة)
    if (themeId === 'neon_promo_tv') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden"
          style={{
            padding: `${s.padding * scale}px`,
            backgroundColor: s.backgroundColor || '#111827',
            border: `${s.borderWidth * scale}px solid ${s.primaryColor}`,
          }}
        >
          <div
            className="flex items-center justify-between gap-4 px-6 py-4 rounded-2xl mb-6 shrink-0"
            style={{ backgroundColor: s.primaryColor }}
          >
            <div className="min-w-0">
              <h1
                className="font-black text-white leading-tight"
                style={{ fontSize: `${s.titleFontSize * scale}px` }}
              >
                {board.title}
              </h1>
              {board.subtitle && (
                <p className="text-white/85 font-bold text-sm mt-1">{board.subtitle}</p>
              )}
            </div>
            {showLogo && logoUrl && (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-12' : 'h-16'} object-contain bg-white/95 p-1.5 rounded-xl shrink-0`}
              />
            )}
          </div>

          <div
            className={`flex-1 grid ${
              cols === 1 ? 'grid-cols-2' : gridColsClass
            } gap-4 content-start overflow-hidden`}
          >
            {board.items.length === 0 ? (
              <EmptyState />
            ) : (
              board.items.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border flex flex-col justify-between bg-white/[0.06]"
                  style={{
                    borderColor: item.isOffer ? s.secondaryColor : 'rgba(255,255,255,0.14)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <div
                        className="font-black break-words"
                        style={{
                          fontSize: `${s.itemFontSize * scale}px`,
                          color: s.textColor,
                          lineHeight: 1.3,
                        }}
                      >
                        {item.label}
                      </div>
                      {item.unit && (
                        <div
                          className="text-xs opacity-65 font-bold mt-1"
                          style={{ color: s.textColor }}
                        >
                          {item.unit}
                        </div>
                      )}
                    </div>
                    {(item.isOffer || item.badgeText) && (
                      <span
                        className="px-2.5 py-1 rounded-lg text-[10px] font-black text-slate-950 shrink-0"
                        style={{ backgroundColor: s.secondaryColor || '#facc15' }}
                      >
                        {item.badgeText || 'عرض خاص'}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-end pt-2 border-t border-white/10">
                    {renderPriceBlock(item, s, scale, {
                      priceColorOverride: s.priceColor || '#facc15',
                      currencyColorOverride: s.textColor,
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <TickerAndClockBar darkSurface />
        </div>
      );
    }

    // Theme: minimal_kiosk (كيوسك حديث)
    if (themeId === 'minimal_kiosk') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden"
          style={{
            padding: `${s.padding * scale}px`,
            backgroundColor: s.backgroundColor || '#f8fafc',
            border: `${s.borderWidth * scale}px solid ${s.borderColor || s.primaryColor}`,
          }}
        >
          <div
            className="flex items-center justify-between gap-4 pb-5 mb-6 border-b-2"
            style={{ borderColor: s.primaryColor }}
          >
            <div className="flex items-center gap-4 min-w-0">
              {showLogo && logoUrl && (
                <img
                  src={logoUrl}
                  alt="شعار المتجر"
                  referrerPolicy="no-referrer"
                  className={`${isSmall ? 'h-12' : 'h-16'} object-contain shrink-0`}
                />
              )}
              <div className="min-w-0">
                <h1
                  className="font-black tracking-tight"
                  style={{ fontSize: `${s.titleFontSize * scale}px`, color: s.textColor }}
                >
                  {board.title}
                </h1>
                {board.subtitle && (
                  <p
                    className="font-bold opacity-65 mt-0.5"
                    style={{
                      fontSize: `${Math.max(12, s.itemFontSize * scale * 0.65)}px`,
                      color: s.textColor,
                    }}
                  >
                    {board.subtitle}
                  </p>
                )}
              </div>
            </div>
            {s.showClock && (
              <div
                className="px-4 py-2 rounded-xl font-black tabular-nums text-white shrink-0"
                style={{
                  backgroundColor: s.primaryColor,
                  fontSize: `${Math.max(14, 18 * scale)}px`,
                }}
              >
                {timeStr}
              </div>
            )}
          </div>

          <div
            className={`flex-1 grid ${gridColsClass} gap-3 content-start overflow-hidden`}
          >
            {board.items.length === 0 ? (
              <EmptyState />
            ) : (
              board.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 bg-white px-5 py-3.5 rounded-xl border border-slate-200/80 shadow-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-extrabold break-words"
                        style={{
                          fontSize: `${s.itemFontSize * scale}px`,
                          color: s.textColor,
                          lineHeight: 1.35,
                        }}
                      >
                        {item.label}
                      </span>
                      {(item.isOffer || item.badgeText) && (
                        <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-black shrink-0">
                          {item.badgeText || 'عرض'}
                        </span>
                      )}
                    </div>
                    {item.unit && (
                      <div className="text-xs font-semibold text-slate-400 mt-0.5">
                        {item.unit}
                      </div>
                    )}
                  </div>
                  {renderPriceBlock(item, s, scale)}
                </div>
              ))
            )}
          </div>

          <TickerAndClockBar />
        </div>
      );
    }

    // Theme 1: geometric_luxe (الحديث النظيف)
    if (themeId === 'geometric_luxe') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden bg-white"
          style={{
            padding: `${s.padding * scale}px`,
            border: `${s.borderWidth * scale}px solid ${s.borderColor || s.primaryColor}`,
            backgroundColor: s.backgroundColor,
          }}
        >
          <div
            className="flex flex-col items-center mb-6 pb-5 border-b"
            style={{ borderColor: `${s.secondaryColor}40` }}
          >
            {showLogo && logoUrl ? (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-14' : 'h-20'} object-contain mb-4`}
              />
            ) : null}
            <h1
              className="font-black text-center tracking-tight"
              style={{ fontSize: `${s.titleFontSize * scale * 1.05}px`, color: s.textColor }}
            >
              {board.title}
            </h1>
            {board.subtitle && (
              <p
                className="font-bold opacity-65 mt-1"
                style={{
                  fontSize: `${Math.max(12, s.itemFontSize * scale * 0.65)}px`,
                  color: s.textColor,
                }}
              >
                {board.subtitle}
              </p>
            )}
          </div>
          <div className={`flex-1 grid ${gridColsClass} gap-x-8 gap-y-3 content-start overflow-hidden`}>
            {board.items.length === 0 ? (
              <EmptyState />
            ) : (
              board.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-xl border-b border-slate-100/80"
                >
                  <div className="flex-1 min-w-0 pl-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-bold break-words"
                        style={{
                          fontSize: `${s.itemFontSize * scale}px`,
                          color: s.textColor,
                          lineHeight: 1.35,
                        }}
                      >
                        {item.label}
                      </span>
                      {(item.isOffer || item.badgeText) && (
                        <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-black shrink-0">
                          {item.badgeText || 'عرض خاص'}
                        </span>
                      )}
                    </div>
                    {item.unit && (
                      <span
                        className="text-xs opacity-60 font-semibold block mt-0.5"
                        style={{ color: s.textColor }}
                      >
                        {item.unit}
                      </span>
                    )}
                  </div>
                  {renderPriceBlock(item, s, scale)}
                </div>
              ))
            )}
          </div>
          <TickerAndClockBar />
        </div>
      );
    }

    // Theme 2: modern_grid (الشبكة التقنية)
    if (themeId === 'modern_grid') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden"
          style={{
            padding: `${s.padding * scale}px`,
            border: `${s.borderWidth * scale}px solid ${s.borderColor || s.primaryColor}`,
            backgroundColor: s.backgroundColor,
          }}
        >
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(${s.primaryColor} 1px, transparent 1px), linear-gradient(90deg, ${s.primaryColor} 1px, transparent 1px)`,
              backgroundSize: '28px 28px',
            }}
          />
          <div
            className="flex justify-between items-end mb-6 border-b-2 pb-4 relative z-10"
            style={{ borderColor: s.primaryColor }}
          >
            <div className="px-6 py-2.5 inline-block" style={{ backgroundColor: s.primaryColor }}>
              <h1
                className="font-black text-white tracking-tight"
                style={{ fontSize: `${s.titleFontSize * scale * 0.85}px` }}
              >
                {board.title}
              </h1>
            </div>
            {showLogo && logoUrl ? (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-12' : 'h-16'} object-contain`}
              />
            ) : null}
          </div>
          <div
            className={`flex-1 grid ${
              cols === 1 ? 'grid-cols-2' : gridColsClass
            } gap-4 relative z-10 content-start overflow-hidden`}
          >
            {board.items.length === 0 ? (
              <EmptyState />
            ) : (
              board.items.map((item) => (
                <div
                  key={item.id}
                  className="border p-4 flex flex-col justify-between bg-white rounded-lg shadow-xs"
                  style={{ borderColor: `${s.secondaryColor}55` }}
                >
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div>
                      <div
                        className="font-bold leading-snug break-words"
                        style={{
                          fontSize: `${s.itemFontSize * scale * 0.9}px`,
                          color: s.textColor,
                        }}
                      >
                        {item.label}
                      </div>
                      {item.unit && (
                        <div className="text-xs opacity-60 font-semibold mt-0.5" style={{ color: s.textColor }}>
                          {item.unit}
                        </div>
                      )}
                    </div>
                    {(item.isOffer || item.badgeText) && (
                      <span className="bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded shrink-0">
                        {item.badgeText || 'عرض خاص'}
                      </span>
                    )}
                  </div>
                  <div
                    className="flex justify-end mt-auto pt-3 border-t border-dashed"
                    style={{ borderColor: `${s.secondaryColor}40` }}
                  >
                    {renderPriceBlock(item, s, scale, { fontMono: true })}
                  </div>
                </div>
              ))
            )}
          </div>
          <TickerAndClockBar />
        </div>
      );
    }

    // Theme 3: royal_minimal (الكلاسيكي الفاخر)
    if (themeId === 'royal_minimal') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden rounded-[1.5rem]"
          style={{
            padding: `${s.padding * scale}px`,
            border: `${s.borderWidth * scale}px double ${s.borderColor || s.primaryColor}`,
            backgroundColor: s.backgroundColor,
          }}
        >
          <div className="flex flex-col items-center mb-8 relative z-10">
            {showLogo && logoUrl ? (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-14' : 'h-20'} object-contain mb-4`}
              />
            ) : null}
            <h1
              className="font-black text-center"
              style={{ fontSize: `${s.titleFontSize * scale * 1.05}px`, color: s.textColor }}
            >
              {board.title}
            </h1>
            <div className="flex items-center gap-3 mt-4 w-1/2 mx-auto opacity-75">
              <div className="h-[2px] flex-1" style={{ backgroundColor: s.secondaryColor }} />
              <div className="w-2.5 h-2.5 rotate-45" style={{ backgroundColor: s.primaryColor }} />
              <div className="h-[2px] flex-1" style={{ backgroundColor: s.secondaryColor }} />
            </div>
          </div>
          <div className={`flex-1 grid ${gridColsClass} gap-x-8 gap-y-5 px-4 relative z-10 content-start overflow-hidden`}>
            {board.items.length === 0 ? (
              <EmptyState />
            ) : (
              board.items.map((item) => (
                <div key={item.id} className="flex items-baseline w-full gap-3">
                  <div className="min-w-0 max-w-[55%]">
                    <span
                      className="font-bold break-words"
                      style={{ fontSize: `${s.itemFontSize * scale}px`, color: s.textColor }}
                    >
                      {item.label}
                    </span>
                    {item.unit && (
                      <span className="text-xs opacity-60 mr-2 font-semibold" style={{ color: s.textColor }}>
                        ({item.unit})
                      </span>
                    )}
                  </div>
                  <div
                    className="flex-1 border-b-2 border-dotted opacity-40 min-w-[20px]"
                    style={{ borderColor: s.secondaryColor }}
                  />
                  {renderPriceBlock(item, s, scale)}
                </div>
              ))
            )}
          </div>
          <TickerAndClockBar />
        </div>
      );
    }

    // Theme 4: digital_punch (العروض القوية)
    if (themeId === 'digital_punch') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden"
          style={{
            padding: `${s.padding * scale}px`,
            border: `${s.borderWidth * scale}px solid ${s.borderColor || s.primaryColor}`,
            backgroundColor: s.backgroundColor,
          }}
        >
          <div
            className="flex justify-between items-center mb-6 px-6 py-5 rounded-2xl shadow-md"
            style={{ backgroundColor: s.primaryColor }}
          >
            <div>
              <h1
                className="font-black text-white leading-none"
                style={{ fontSize: `${s.titleFontSize * scale * 1.1}px` }}
              >
                {board.title}
              </h1>
              {board.subtitle && <p className="text-white/85 font-bold text-sm mt-1.5">{board.subtitle}</p>}
            </div>
            {showLogo && logoUrl ? (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-14' : 'h-18'} object-contain bg-white/95 p-1.5 rounded-xl`}
              />
            ) : null}
          </div>
          <div className={`flex-1 grid ${gridColsClass} gap-3.5 content-start overflow-hidden`}>
            {board.items.length === 0 ? (
              <EmptyState />
            ) : (
              board.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 border-2 rounded-xl px-4 py-3 bg-white shadow-xs"
                  style={{ borderColor: item.isOffer ? '#ef4444' : s.secondaryColor }}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-black break-words"
                      style={{
                        fontSize: `${s.itemFontSize * scale * 1.05}px`,
                        color: s.textColor,
                      }}
                    >
                      {item.label}
                    </div>
                    {item.unit && (
                      <div className="text-xs font-semibold text-slate-500 mt-0.5">{item.unit}</div>
                    )}
                  </div>
                  <div className="bg-slate-100 px-4 py-2 rounded-lg border border-slate-200 shrink-0">
                    {renderPriceBlock(item, s, scale, { priceBoost: 1.15 })}
                  </div>
                </div>
              ))
            )}
          </div>
          <TickerAndClockBar />
        </div>
      );
    }

    // Theme 5: abstract_gradient (الناعم العضوي)
    if (themeId === 'abstract_gradient') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden rounded-[2rem]"
          style={{
            padding: `${s.padding * scale}px`,
            background: `linear-gradient(135deg, ${s.backgroundColor}, ${s.primaryColor}18)`,
          }}
        >
          <div className="flex justify-between items-center mb-6 relative z-10">
            <div>
              <h1
                className="font-black tracking-tight"
                style={{ fontSize: `${s.titleFontSize * scale}px`, color: s.textColor }}
              >
                {board.title}
              </h1>
              <div className="w-14 h-1.5 rounded-full mt-2" style={{ backgroundColor: s.primaryColor }} />
            </div>
            {showLogo && logoUrl ? (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-14' : 'h-18'} object-contain`}
              />
            ) : null}
          </div>
          <div className={`flex-1 grid ${gridColsClass} gap-3 relative z-10 content-start overflow-hidden`}>
            {board.items.length === 0 ? (
              <EmptyState />
            ) : (
              board.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 bg-white/85 px-5 py-3 rounded-2xl border border-white shadow-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-bold break-words"
                      style={{ fontSize: `${s.itemFontSize * scale}px`, color: s.textColor }}
                    >
                      {item.label}
                    </div>
                    {item.unit && (
                      <div className="text-xs opacity-60 font-semibold mt-0.5" style={{ color: s.textColor }}>
                        {item.unit}
                      </div>
                    )}
                  </div>
                  <div className="bg-white px-4 py-1.5 rounded-xl border border-slate-100 shrink-0">
                    {renderPriceBlock(item, s, scale)}
                  </div>
                </div>
              ))
            )}
          </div>
          <TickerAndClockBar />
        </div>
      );
    }

    // Theme 6: ramadan_vibes (رمضاني)
    if (themeId === 'ramadan_vibes') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden"
          style={{
            padding: `${s.padding * scale}px`,
            backgroundColor: s.backgroundColor,
            border: `${s.borderWidth * scale}px solid ${s.primaryColor}`,
          }}
        >
          <div className="flex flex-col items-center mb-6 relative z-10">
            {showLogo && logoUrl ? (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-14' : 'h-20'} object-contain mb-3`}
              />
            ) : null}
            <div
              className="px-10 py-3 border-y-2 flex items-center gap-3"
              style={{ borderColor: s.secondaryColor }}
            >
              <Moon size={22 * scale} fill={s.secondaryColor} color={s.secondaryColor} />
              <h1
                className="font-black text-center"
                style={{ fontSize: `${s.titleFontSize * scale}px`, color: s.textColor }}
              >
                {board.title}
              </h1>
            </div>
          </div>

          <div className={`flex-1 grid ${gridColsClass} gap-3 relative z-10 content-start overflow-hidden`}>
            {board.items.length === 0 ? (
              <EmptyState />
            ) : (
              board.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-2.5 border-b border-dashed"
                  style={{ borderColor: `${s.primaryColor}40` }}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <Star
                      size={14 * scale}
                      fill={s.secondaryColor}
                      color={s.secondaryColor}
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <div
                        className="font-bold break-words"
                        style={{ fontSize: `${s.itemFontSize * scale}px`, color: s.textColor }}
                      >
                        {item.label}
                      </div>
                      {item.unit && (
                        <div className="text-xs opacity-60 font-semibold">{item.unit}</div>
                      )}
                    </div>
                  </div>
                  <div
                    className="bg-white/90 px-4 py-1.5 rounded-xl border shrink-0"
                    style={{ borderColor: `${s.secondaryColor}50` }}
                  >
                    {renderPriceBlock(item, s, scale)}
                  </div>
                </div>
              ))
            )}
          </div>
          <TickerAndClockBar />
        </div>
      );
    }

    // Theme 7: super_market (سوبر ماركت)
    if (themeId === 'super_market') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden"
          style={{
            padding: `${s.padding * scale}px`,
            backgroundColor: s.backgroundColor,
            border: `${s.borderWidth * scale}px solid ${s.primaryColor}`,
          }}
        >
          <div
            className="flex justify-between items-center mb-5 px-6 py-3.5 rounded-xl shadow-sm relative z-10"
            style={{
              backgroundImage: `linear-gradient(to left, ${s.primaryColor}, ${s.secondaryColor})`,
              backgroundColor: s.primaryColor,
            }}
          >
            <h1
              className="font-black text-white"
              style={{ fontSize: `${s.titleFontSize * scale}px` }}
            >
              {board.title}
            </h1>
            {showLogo && logoUrl ? (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-12' : 'h-16'} object-contain bg-white p-1.5 rounded-lg`}
              />
            ) : null}
          </div>

          <div
            className={`flex-1 grid ${
              cols === 1 ? 'grid-cols-2' : gridColsClass
            } gap-3.5 relative z-10 content-start overflow-hidden`}
          >
            {board.items.length === 0 ? (
              <EmptyState />
            ) : (
              board.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col justify-between bg-white border-2 rounded-xl p-3.5 relative overflow-hidden"
                  style={{ borderColor: `${s.primaryColor}35` }}
                >
                  {(item.isOffer || item.badgeText) && (
                    <div className="bg-red-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded self-start mb-1.5">
                      {item.badgeText || 'عرض خاص'}
                    </div>
                  )}
                  <div className="text-center mb-3">
                    <div
                      className="font-black break-words"
                      style={{
                        fontSize: `${s.itemFontSize * scale}px`,
                        color: s.textColor,
                        lineHeight: 1.3,
                      }}
                    >
                      {item.label}
                    </div>
                    {item.unit && (
                      <div className="text-xs font-bold text-slate-400 mt-0.5">{item.unit}</div>
                    )}
                  </div>
                  <div className="flex items-center justify-center bg-yellow-100 py-2 rounded-lg border border-yellow-300">
                    {renderPriceBlock(item, s, scale, {
                      priceColorOverride: '#dc2626',
                      currencyColorOverride: '#dc2626',
                      priceBoost: 1.05,
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          <TickerAndClockBar />
        </div>
      );
    }

    // Theme 8: elegant_gold (ذهبي فاخر)
    if (themeId === 'elegant_gold') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden"
          style={{
            padding: `${s.padding * scale}px`,
            backgroundColor: s.backgroundColor || '#0f172a',
          }}
        >
          <div
            className="absolute inset-3.5 border border-opacity-45 pointer-events-none"
            style={{ borderColor: s.secondaryColor }}
          />
          <div className="flex flex-col items-center mb-8 relative z-10 pt-4">
            {showLogo && logoUrl ? (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-14' : 'h-18'} object-contain mb-4`}
              />
            ) : null}
            <h1
              className="font-black tracking-wide text-center"
              style={{ fontSize: `${s.titleFontSize * scale}px`, color: s.secondaryColor }}
            >
              {board.title}
            </h1>
            <div className="flex items-center gap-4 mt-3">
              <div className="h-px w-14" style={{ backgroundColor: s.secondaryColor }} />
              <Diamond size={14 * scale} color={s.secondaryColor} fill={s.secondaryColor} />
              <div className="h-px w-14" style={{ backgroundColor: s.secondaryColor }} />
            </div>
          </div>

          <div
            className={`flex-1 grid ${gridColsClass} gap-x-8 gap-y-3 px-6 relative z-10 content-start overflow-hidden`}
          >
            {board.items.length === 0 ? (
              <EmptyState />
            ) : (
              board.items.map((item) => (
                <div key={item.id} className="flex items-end justify-between py-2.5 gap-3">
                  <div className="min-w-0 max-w-[58%]">
                    <div
                      className="font-bold break-words"
                      style={{ fontSize: `${s.itemFontSize * scale}px`, color: s.textColor }}
                    >
                      {item.label}
                    </div>
                    {item.unit && (
                      <div className="text-xs opacity-60" style={{ color: s.textColor }}>
                        {item.unit}
                      </div>
                    )}
                  </div>
                  <div
                    className="flex-1 border-b border-dotted mb-2 opacity-30 min-w-[20px]"
                    style={{ borderColor: s.secondaryColor }}
                  />
                  {renderPriceBlock(item, s, scale, {
                    priceColorOverride: s.secondaryColor,
                    currencyColorOverride: s.secondaryColor,
                  })}
                </div>
              ))
            )}
          </div>
          <TickerAndClockBar darkSurface />
        </div>
      );
    }

    // Theme 9: fresh_nature (طبيعة طازجة)
    if (themeId === 'fresh_nature') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden rounded-[1.5rem]"
          style={{
            padding: `${s.padding * scale}px`,
            backgroundColor: s.backgroundColor,
            border: `${s.borderWidth * scale}px solid ${s.primaryColor}`,
          }}
        >
          <div
            className="flex justify-between items-center mb-6 bg-white/90 p-5 rounded-2xl border relative z-10"
            style={{ borderColor: `${s.primaryColor}25` }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="p-2.5 rounded-xl"
                style={{ backgroundColor: `${s.primaryColor}15`, color: s.primaryColor }}
              >
                <Leaf size={26 * scale} />
              </div>
              <h1
                className="font-black"
                style={{ fontSize: `${s.titleFontSize * scale}px`, color: s.textColor }}
              >
                {board.title}
              </h1>
            </div>
            {showLogo && logoUrl ? (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-12' : 'h-16'} object-contain`}
              />
            ) : null}
          </div>

          <div
            className={`flex-1 grid ${gridColsClass} gap-3 relative z-10 content-start overflow-hidden`}
          >
            {board.items.length === 0 ? (
              <EmptyState />
            ) : (
              board.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border"
                  style={{ borderColor: `${s.primaryColor}20` }}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-bold break-words"
                      style={{ fontSize: `${s.itemFontSize * scale}px`, color: s.textColor }}
                    >
                      {item.label}
                    </div>
                    {item.unit && (
                      <div className="text-xs opacity-60 font-semibold">{item.unit}</div>
                    )}
                  </div>
                  <div
                    className="px-4 py-1.5 rounded-lg shrink-0"
                    style={{ backgroundColor: `${s.primaryColor}12` }}
                  >
                    {renderPriceBlock(item, s, scale, { currencyColorOverride: s.priceColor })}
                  </div>
                </div>
              ))
            )}
          </div>
          <TickerAndClockBar />
        </div>
      );
    }

    return null;
  };

  // Compute the pair of boards shown in A4 dual mode
  const pairStartIdx =
    effectiveBoardsPerPage === 2 ? Math.floor(safeBoardIdx / 2) * 2 : safeBoardIdx;
  const firstBoard = boards[pairStartIdx] || boards[0];
  const secondBoard =
    effectiveBoardsPerPage === 2 ? boards[pairStartIdx + 1] || null : null;

  const FullPagePrint = () => {
    const portalNode = document.getElementById('print-container');
    if (!portalNode) return null;

    return createPortal(
      <div
        style={{
          width: '297mm',
          height: '210mm',
          display: 'grid',
          gridTemplateColumns:
            effectiveBoardsPerPage === 2 && secondBoard ? '1fr 1fr' : '1fr',
          gridTemplateRows: '1fr',
          boxSizing: 'border-box',
          overflow: 'hidden',
          background: 'white',
        }}
      >
        <style>{`
          @page { size: A4 landscape; margin: 0 !important; }
          @media print {
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
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
          <BoardRenderer
            board={firstBoard}
            s={styles}
            isSmall={effectiveBoardsPerPage === 2 && Boolean(secondBoard)}
          />
        </div>
        {effectiveBoardsPerPage === 2 && secondBoard && (
          <div className="w-full h-full border-r-2 border-dashed border-gray-300 relative overflow-hidden">
            <BoardRenderer board={secondBoard} s={styles} isSmall={true} />
          </div>
        )}
      </div>,
      portalNode
    );
  };

  return (
    <div
      className="h-full w-full flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative font-sans"
      dir="rtl"
    >
      {/* 1. PORTAL FOR PRINTING */}
      <FullPagePrint />

      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-16 left-1/2 -translate-x-1/2 z-[1500] px-4 py-2.5 rounded-lg shadow-xl text-xs font-bold flex items-center gap-2 border ${
            toastMsg.type === 'error'
              ? 'bg-red-600 text-white border-red-500'
              : 'bg-slate-900 dark:bg-slate-800 text-white border-slate-700'
          }`}
        >
          {toastMsg.type === 'error' ? <X size={15} /> : <Check size={15} className="text-emerald-400" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* TOP STUDIO TOOLBAR */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 z-30 no-print">
        {/* Right side (Start): Identity & Project Actions */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-sap-primary text-white flex items-center justify-center shrink-0">
            <Tv size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black truncate max-w-[180px] sm:max-w-[240px]">
                {projectName || 'مشروع شاشات'}
              </h1>
              {hasUnsavedChanges && (
                <span
                  className="w-2 h-2 rounded-full bg-amber-500 shrink-0"
                  title="تغييرات غير محفوظة"
                />
              )}
            </div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate tabular-nums">
              {currentAspect.label} · {boards.length} شاشات
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 mr-2 pr-3 border-r border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={createNew}
              className="px-2.5 py-1.5 rounded-md text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              title="مشروع جديد"
            >
              <FilePlus size={14} />
              <span>جديد</span>
            </button>
            <button
              type="button"
              onClick={() => setShowArchiveModal(true)}
              className="px-2.5 py-1.5 rounded-md text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <FolderOpen size={14} />
              <span>الأرشيف</span>
              <span className="text-[11px] opacity-60 tabular-nums">({projects.length})</span>
            </button>
          </div>
        </div>

        {/* Center: Screen Aspect Mode & Zoom Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            {[
              { id: 'a4_landscape' as AspectMode, label: 'A4 طباعة', icon: Printer },
              { id: 'screen_16_9' as AspectMode, label: 'TV 16:9', icon: Monitor },
              { id: 'screen_9_16' as AspectMode, label: 'طولي 9:16', icon: Smartphone },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  setStyles((prev) => ({ ...prev, aspectMode: mode.id }));
                  setAutoFitEnabled(true);
                }}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  aspectMode === mode.id
                    ? 'bg-white dark:bg-slate-700 text-sap-primary dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <mode.icon size={13} />
                <span>{mode.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setAutoFitEnabled(false);
                setPreviewZoom((z) => Math.max(15, z - 5));
              }}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-md"
              title="تصغير"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[11px] font-bold tabular-nums min-w-[42px] text-center">
              {previewZoom}%
            </span>
            <button
              type="button"
              onClick={() => {
                setAutoFitEnabled(false);
                setPreviewZoom((z) => Math.min(160, z + 5));
              }}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-md"
              title="تكبير"
            >
              <ZoomIn size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                setAutoFitEnabled(true);
                computeFitZoom();
              }}
              className={`px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors ${
                autoFitEnabled
                  ? 'bg-sap-primary/15 text-sap-primary dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'
              }`}
              title="ملاءمة تلقائية للنافذة"
            >
              احتواء
            </button>
          </div>
        </div>

        {/* Left side (End): Primary Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowArchiveModal(true)}
            className="sm:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            title="الأرشيف"
          >
            <FolderOpen size={16} />
          </button>

          <button
            type="button"
            onClick={enterPresentation}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs transition-colors"
          >
            <Play size={14} fill="currentColor" />
            <span>عرض مباشر</span>
          </button>

          <button
            type="button"
            onClick={() => setDownloadDialog({ isOpen: true, fileName: projectName })}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Download size={14} />
            <span className="hidden md:inline">صورة PNG</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Printer size={14} />
            <span className="hidden md:inline">طباعة</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`px-3.5 py-2 rounded-lg text-white text-xs font-black flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              saveSuccess
                ? 'bg-emerald-600'
                : 'bg-sap-primary hover:bg-sap-primary-hover'
            }`}
          >
            {isSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : saveSuccess ? (
              <Check size={14} />
            ) : (
              <Save size={14} />
            )}
            <span>{saveSuccess ? 'تم الحفظ' : 'حفظ'}</span>
          </button>
        </div>
      </header>

      {/* MAIN STUDIO SPLIT: INSPECTOR SIDEBAR + CANVAS */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* INSPECTOR SIDEBAR (Right in RTL) */}
        <aside className="w-full lg:w-[360px] xl:w-[390px] bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 max-h-[44vh] lg:max-h-full overflow-hidden no-print">
          {/* Project Title Input */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="اسم مشروع الشاشات..."
              className="flex-1 min-w-0 text-sm font-black bg-transparent border-none focus:ring-0 p-0 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
            />
            <span className="text-[11px] font-bold text-slate-400 shrink-0">
              {activeProjectId ? 'محفوظ' : 'مسودة'}
            </span>
          </div>

          {/* Inspector Tabs */}
          <div className="grid grid-cols-3 gap-1 p-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 shrink-0">
            {[
              { id: 'content', icon: Boxes, label: 'المحتوى' },
              { id: 'styling', icon: Paintbrush, label: 'التصميم' },
              { id: 'display', icon: SlidersHorizontal, label: 'البث والشعار' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-2 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-700 text-sap-primary dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <tab.icon size={14} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Inspector Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
            {/* TAB 1: CONTENT & BOARDS */}
            {activeTab === 'content' && (
              <div className="space-y-5">
                {/* Multi-Board Manager */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                      الشاشات / اللوحات ({boards.length})
                    </span>
                    <button
                      type="button"
                      onClick={addNewBoard}
                      className="text-xs font-bold text-sap-primary dark:text-emerald-400 hover:underline flex items-center gap-1 whitespace-nowrap"
                    >
                      <Plus size={13} />
                      <span>شاشة جديدة</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                    {boards.map((b, idx) => {
                      const isSelected = idx === safeBoardIdx;
                      return (
                        <div
                          key={b.id}
                          onClick={() => setActiveBoardIdx(idx)}
                          className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-white dark:bg-slate-700 border-sap-primary text-slate-900 dark:text-white shadow-xs'
                              : 'bg-white/60 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/70'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-[11px] font-black tabular-nums opacity-60 shrink-0">
                              {idx + 1}.
                            </span>
                            <span className="text-xs font-bold truncate">{b.title}</span>
                            <span className="text-[10px] opacity-55 tabular-nums shrink-0">
                              ({b.items.length})
                            </span>
                          </div>
                          <div
                            className="flex items-center gap-0.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setBoards((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, isActive: item.isActive === false } : item
                                  )
                                )
                              }
                              className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-600 ${
                                b.isActive === false
                                  ? 'text-slate-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                              title={
                                b.isActive === false
                                  ? 'مخفية من العرض التلقائي (اضغط للتفعيل)'
                                  : 'مفعلة في العرض التلقائي'
                              }
                            >
                              {b.isActive === false ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => moveBoardOrder(idx, -1)}
                              disabled={idx === 0}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-25"
                              title="تحريك لأعلى"
                            >
                              <ChevronUp size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveBoardOrder(idx, 1)}
                              disabled={idx === boards.length - 1}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-25"
                              title="تحريك لأسفل"
                            >
                              <ChevronDown size={13} />
                            </button>
                            {boards.length > 1 && (
                              <button
                                type="button"
                                onClick={() => deleteBoard(idx)}
                                className="p-1 rounded text-slate-400 hover:text-red-600"
                                title="حذف الشاشة"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={duplicateCurrentBoard}
                      className="flex-1 py-1.5 px-2.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                    >
                      <Copy size={12} />
                      <span>تكرار الشاشة</span>
                    </button>
                    <button
                      type="button"
                      disabled={!currentBoard || currentBoard.items.length === 0}
                      onClick={() =>
                        setConfirmDialog({
                          isOpen: true,
                          title: 'تفريغ الشاشة',
                          message: 'هل أنت متأكد من مسح جميع الأصناف في هذه الشاشة؟',
                          onConfirm: () => {
                            setBoards((prev) =>
                              prev.map((b, i) =>
                                i === safeBoardIdx ? { ...b, items: [] } : b
                              )
                            );
                            setConfirmDialog(null);
                          },
                        })
                      }
                      className="flex-1 py-1.5 px-2.5 rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-40 transition-colors"
                    >
                      <Trash size={12} />
                      <span>مسح الأصناف</span>
                    </button>
                  </div>
                </div>

                {/* Active Board Title & Subtitle */}
                <div className="space-y-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      عنوان الشاشة النشطة
                    </label>
                    <input
                      type="text"
                      value={currentBoard?.title || ''}
                      onChange={(e) =>
                        setBoards((prev) =>
                          prev.map((b, i) =>
                            i === safeBoardIdx ? { ...b, title: e.target.value } : b
                          )
                        )
                      }
                      className="w-full px-3 py-2 text-sm font-black bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-sap-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      عنوان فرعي / ملاحظة الضريبة
                    </label>
                    <input
                      type="text"
                      value={currentBoard?.subtitle || ''}
                      onChange={(e) =>
                        setBoards((prev) =>
                          prev.map((b, i) =>
                            i === safeBoardIdx ? { ...b, subtitle: e.target.value } : b
                          )
                        )
                      }
                      placeholder="مثال: الأسعار شاملة ضريبة القيمة المضافة"
                      className="w-full px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-sap-primary outline-none"
                    />
                  </div>
                </div>

                {/* Items Header & Quick Actions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 tabular-nums">
                      الأصناف ({currentBoard?.items.length || 0})
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={addManualItem}
                        className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 whitespace-nowrap"
                      >
                        <Plus size={12} />
                        <span>يدوي</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProductIds(new Set());
                          setShowProductPicker(true);
                        }}
                        className="px-2.5 py-1 rounded-md bg-sap-primary text-white text-[11px] font-bold hover:bg-sap-primary-hover flex items-center gap-1 whitespace-nowrap"
                      >
                        <Boxes size={12} />
                        <span>من المنتجات</span>
                      </button>
                    </div>
                  </div>

                  {!currentBoard || currentBoard.items.length === 0 ? (
                    <div className="p-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center space-y-3 bg-slate-50/50 dark:bg-slate-800/30">
                      <Boxes size={28} className="mx-auto text-slate-400" />
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        لا توجد أصناف في هذه الشاشة
                      </p>
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductIds(new Set());
                            setShowProductPicker(true);
                          }}
                          className="px-3.5 py-1.5 bg-sap-primary text-white rounded-lg text-xs font-bold"
                        >
                          استيراد منتجات
                        </button>
                        <button
                          type="button"
                          onClick={addManualItem}
                          className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold"
                        >
                          إضافة يدوية
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {currentBoard.items.map((item, idx) => (
                        <div
                          key={item.id}
                          className={`p-3 rounded-xl border transition-colors ${
                            item.isOffer
                              ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/60'
                              : 'bg-slate-50/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-black tabular-nums text-slate-400">
                                #{idx + 1}
                              </span>
                              {item.isOffer && (
                                <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <Flame size={10} />
                                  عرض
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => {
                                  if (idx === 0) return;
                                  setBoards((prev) =>
                                    prev.map((b, bIdx) => {
                                      if (bIdx !== safeBoardIdx) return b;
                                      const items = [...b.items];
                                      [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
                                      return { ...b, items };
                                    })
                                  );
                                }}
                                className="p-1 text-slate-400 hover:text-sap-primary disabled:opacity-25"
                                title="تحريك لأعلى"
                              >
                                <ChevronUp size={13} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === currentBoard.items.length - 1}
                                onClick={() => {
                                  if (idx === currentBoard.items.length - 1) return;
                                  setBoards((prev) =>
                                    prev.map((b, bIdx) => {
                                      if (bIdx !== safeBoardIdx) return b;
                                      const items = [...b.items];
                                      [items[idx + 1], items[idx]] = [items[idx], items[idx + 1]];
                                      return { ...b, items };
                                    })
                                  );
                                }}
                                className="p-1 text-slate-400 hover:text-sap-primary disabled:opacity-25"
                                title="تحريك لأسفل"
                              >
                                <ChevronDown size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setBoards((prev) =>
                                    prev.map((b, bIdx) =>
                                      bIdx === safeBoardIdx
                                        ? {
                                            ...b,
                                            items: b.items.map((it, i) =>
                                              i === idx ? { ...it, isOffer: !it.isOffer } : it
                                            ),
                                          }
                                        : b
                                    )
                                  )
                                }
                                className={`p-1 rounded ${
                                  item.isOffer
                                    ? 'bg-red-600 text-white'
                                    : 'text-slate-400 hover:text-amber-500'
                                }`}
                                title="تحديد كعرض خاص"
                              >
                                <Zap size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setBoards((prev) =>
                                    prev.map((b, bIdx) => {
                                      if (bIdx !== safeBoardIdx) return b;
                                      const items = [...b.items];
                                      items.splice(idx + 1, 0, {
                                        ...item,
                                        id: crypto.randomUUID(),
                                      });
                                      return { ...b, items };
                                    })
                                  )
                                }
                                className="p-1 text-slate-400 hover:text-sap-primary"
                                title="تكرار"
                              >
                                <Copy size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setBoards((prev) =>
                                    prev.map((b, bIdx) =>
                                      bIdx === safeBoardIdx
                                        ? {
                                            ...b,
                                            items: b.items.filter((i) => i.id !== item.id),
                                          }
                                        : b
                                    )
                                  )
                                }
                                className="p-1 text-slate-400 hover:text-red-600"
                                title="حذف"
                              >
                                <Trash size={13} />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-12 gap-2">
                            <input
                              type="text"
                              value={item.label}
                              onChange={(e) =>
                                setBoards((prev) =>
                                  prev.map((b, bIdx) =>
                                    bIdx === safeBoardIdx
                                      ? {
                                          ...b,
                                          items: b.items.map((it, i) =>
                                            i === idx ? { ...it, label: e.target.value } : it
                                          ),
                                        }
                                      : b
                                  )
                                )
                              }
                              placeholder="اسم الصنف"
                              className="col-span-8 px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:border-sap-primary"
                            />
                            <input
                              type="text"
                              value={item.price}
                              onChange={(e) =>
                                setBoards((prev) =>
                                  prev.map((b, bIdx) =>
                                    bIdx === safeBoardIdx
                                      ? {
                                          ...b,
                                          items: b.items.map((it, i) =>
                                            i === idx ? { ...it, price: e.target.value } : it
                                          ),
                                        }
                                      : b
                                  )
                                )
                              }
                              placeholder="السعر"
                              className="col-span-4 px-2.5 py-1.5 text-xs font-black text-left tabular-nums text-sap-primary dark:text-emerald-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:border-sap-primary"
                            />
                            <input
                              type="text"
                              value={item.unit || ''}
                              onChange={(e) =>
                                setBoards((prev) =>
                                  prev.map((b, bIdx) =>
                                    bIdx === safeBoardIdx
                                      ? {
                                          ...b,
                                          items: b.items.map((it, i) =>
                                            i === idx ? { ...it, unit: e.target.value } : it
                                          ),
                                        }
                                      : b
                                  )
                                )
                              }
                              placeholder="الوحدة / الوزن"
                              className="col-span-5 px-2.5 py-1 text-[11px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:border-sap-primary"
                            />
                            <input
                              type="text"
                              value={item.originalPrice || ''}
                              onChange={(e) =>
                                setBoards((prev) =>
                                  prev.map((b, bIdx) =>
                                    bIdx === safeBoardIdx
                                      ? {
                                          ...b,
                                          items: b.items.map((it, i) =>
                                            i === idx
                                              ? { ...it, originalPrice: e.target.value }
                                              : it
                                          ),
                                        }
                                      : b
                                  )
                                )
                              }
                              placeholder="قبل الخصم"
                              className="col-span-4 px-2.5 py-1 text-[11px] font-semibold text-left tabular-nums bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:border-sap-primary"
                            />
                            <input
                              type="text"
                              value={item.badgeText || ''}
                              onChange={(e) =>
                                setBoards((prev) =>
                                  prev.map((b, bIdx) =>
                                    bIdx === safeBoardIdx
                                      ? {
                                          ...b,
                                          items: b.items.map((it, i) =>
                                            i === idx ? { ...it, badgeText: e.target.value } : it
                                          ),
                                        }
                                      : b
                                  )
                                )
                              }
                              placeholder="شارة"
                              className="col-span-3 px-2 py-1 text-[11px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:border-sap-primary"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: DESIGN & TEMPLATES */}
            {activeTab === 'styling' && (
              <div className="space-y-6">
                {/* Templates */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-200">
                      قوالب الشاشات ({themesList.length})
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setStyles((prev) => ({
                          ...DEFAULT_STYLES,
                          aspectMode: prev.aspectMode,
                          currencySymbolType: prev.currencySymbolType,
                          currencySymbolImage: prev.currencySymbolImage,
                        }))
                      }
                      className="text-[11px] font-bold text-sap-primary dark:text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <RotateCcw size={11} />
                      <span>افتراضي</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {themesList.map((t) => {
                      const active = themeId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => applyThemeWithRecommendedColors(t.id)}
                          className={`p-2.5 rounded-xl border text-right flex items-center gap-2.5 transition-all ${
                            active
                              ? 'border-sap-primary bg-sap-primary/5 dark:bg-sap-primary/20 ring-1 ring-sap-primary'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <div
                            className="w-8 h-8 rounded-lg border border-black/10 flex items-center justify-center shrink-0"
                            style={{ backgroundColor: t.previewBg, color: t.previewAccent }}
                          >
                            <t.icon size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-black truncate">{t.name}</div>
                            {t.isDark && (
                              <div className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
                                مثالي للتلفاز
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Columns & A4 Split */}
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                    تخطيط الشبكة والأعمدة
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setStyles((prev) => ({ ...prev, columns: col }))}
                        className={`py-2 rounded-lg border text-xs font-bold tabular-nums transition-colors ${
                          (styles.columns || 1) === col
                            ? 'bg-slate-900 dark:bg-sap-primary text-white border-transparent'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {col} {col === 1 ? 'عمود' : 'أعمدة'}
                      </button>
                    ))}
                  </div>

                  {aspectMode === 'a4_landscape' && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setBoardsPerPage(1)}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 ${
                          boardsPerPage === 1
                            ? 'bg-slate-900 dark:bg-sap-primary text-white border-transparent'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <Monitor size={14} />
                        <span>لوحة بالصفحة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBoardsPerPage(2)}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 ${
                          boardsPerPage === 2
                            ? 'bg-slate-900 dark:bg-sap-primary text-white border-transparent'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <LayoutGrid size={14} />
                        <span>لوحتان (أ + ب)</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Color Presets */}
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                    سمات الألوان السريعة
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {colorPresets.map((preset, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setStyles((prev) => ({ ...prev, ...preset.colors }))}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-sap-primary text-[11px] font-bold transition-colors"
                      >
                        <span className="flex w-4 h-4 rounded overflow-hidden border border-black/10 shrink-0">
                          <span
                            className="flex-1 h-full"
                            style={{ backgroundColor: preset.colors.backgroundColor }}
                          />
                          <span
                            className="flex-1 h-full"
                            style={{ backgroundColor: preset.colors.primaryColor }}
                          />
                        </span>
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdvancedColors((v) => !v)}
                    className="w-full py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center justify-between"
                  >
                    <span>تخصيص الألوان يدوياً</span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${showAdvancedColors ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {showAdvancedColors && (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'الخلفية', key: 'backgroundColor' },
                        { label: 'الإطار', key: 'borderColor' },
                        { label: 'النصوص', key: 'textColor' },
                        { label: 'الأساسي', key: 'primaryColor' },
                        { label: 'الأسعار', key: 'priceColor' },
                        { label: 'الثانوي', key: 'secondaryColor' },
                      ].map((color) => (
                        <div
                          key={color.key}
                          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between gap-2"
                        >
                          <span className="text-[11px] font-bold">{color.label}</span>
                          <input
                            type="color"
                            value={(styles as any)[color.key] || '#000000'}
                            onChange={(e) =>
                              setStyles({ ...styles, [color.key]: e.target.value })
                            }
                            className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Typography Sliders */}
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                    أحجام الخطوط والهوامش
                  </label>
                  {[
                    { label: 'حجم العنوان', key: 'titleFontSize', min: 20, max: 100 },
                    { label: 'اسم الصنف', key: 'itemFontSize', min: 12, max: 52 },
                    { label: 'حجم السعر', key: 'priceFontSize', min: 18, max: 110 },
                    { label: 'رمز العملة', key: 'currencyFontSize', min: 10, max: 60 },
                    { label: 'الهامش الداخلي', key: 'padding', min: 12, max: 64 },
                  ].map((font) => (
                    <div key={font.key} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-600 dark:text-slate-300">{font.label}</span>
                        <span className="tabular-nums text-sap-primary dark:text-emerald-400">
                          {Number((styles as any)[font.key] || 0)}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={font.min}
                        max={font.max}
                        value={Number((styles as any)[font.key] || font.min)}
                        onChange={(e) =>
                          setStyles({ ...styles, [font.key]: Number(e.target.value) })
                        }
                        className="w-full accent-sap-primary h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: DISPLAY, SIGNAGE, LOGO & CURRENCY */}
            {activeTab === 'display' && (
              <div className="space-y-5">
                {/* TV / Digital Signage Controls */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black">
                    <Tv size={15} className="text-sap-primary" />
                    <span>إعدادات البث والعرض المباشر</span>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-bold mb-1">
                      <span>مدة عرض كل شاشة (تبديل تلقائي)</span>
                      <span className="tabular-nums text-sap-primary dark:text-emerald-400">
                        {styles.slideDurationSec || 10} ثانية
                      </span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={60}
                      step={2}
                      value={styles.slideDurationSec || 10}
                      onChange={(e) =>
                        setStyles((prev) => ({
                          ...prev,
                          slideDurationSec: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-sap-primary h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                    />
                  </div>

                  <label className="flex items-center justify-between gap-2 cursor-pointer py-1">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <Clock size={14} className="text-slate-400" />
                      <span>إظهار الساعة الحية على الشاشة</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={styles.showClock !== false}
                      onChange={(e) =>
                        setStyles((prev) => ({ ...prev, showClock: e.target.checked }))
                      }
                      className="rounded accent-sap-primary"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-2 cursor-pointer py-1">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <Megaphone size={14} className="text-slate-400" />
                      <span>إظهار شريط الإعلانات السفلي</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(styles.showTicker)}
                      onChange={(e) =>
                        setStyles((prev) => ({ ...prev, showTicker: e.target.checked }))
                      }
                      className="rounded accent-sap-primary"
                    />
                  </label>

                  {styles.showTicker && (
                    <textarea
                      rows={2}
                      value={styles.tickerText || ''}
                      onChange={(e) =>
                        setStyles((prev) => ({ ...prev, tickerText: e.target.value }))
                      }
                      placeholder="نص الشريط الإعلاني..."
                      className="w-full p-2.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-sap-primary"
                    />
                  )}

                  <button
                    type="button"
                    onClick={enterPresentation}
                    className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-2 transition-colors"
                  >
                    <Play size={14} fill="currentColor" />
                    <span>تشغيل وضع الشاشة الكاملة الآن</span>
                  </button>
                </div>

                {/* Store Logo */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black">شعار المتجر</span>
                    <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showLogo}
                        onChange={(e) => setShowLogo(e.target.checked)}
                        className="rounded accent-sap-primary"
                      />
                      <span>إظهار</span>
                    </label>
                  </div>

                  {showLogo && (
                    <div className="flex items-center gap-3">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="شعار المتجر"
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 object-contain rounded-lg border border-slate-200 dark:border-slate-600 bg-white p-1 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 shrink-0">
                          <Upload size={18} />
                        </div>
                      )}
                      <div className="flex-1 flex flex-col gap-1.5">
                        <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold text-center hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">
                          رفع شعار المتجر
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const compressed = await compressImageToDataUrl(file, 360);
                                setLogoUrl(compressed);
                              } catch {
                                showToast('تعذر قراءة ملف الصورة', 'error');
                              }
                            }}
                          />
                        </label>
                        {logoUrl && (
                          <button
                            type="button"
                            onClick={() => setLogoUrl(null)}
                            className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline text-right"
                          >
                            إزالة الشعار
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Currency Symbol */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
                  <label className="text-xs font-black block">رمز العملة</label>
                  <select
                    value={styles.currencySymbolType || 'icon'}
                    onChange={(e) =>
                      setStyles({ ...styles, currencySymbolType: e.target.value as any })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold outline-none"
                  >
                    <option value="icon">رمز الريال الجديد (أيقونة)</option>
                    <option value="text">نص (ر.س)</option>
                    <option value="custom_image">صورة مخصصة</option>
                  </select>

                  {styles.currencySymbolType === 'custom_image' && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      {styles.currencySymbolImage && (
                        <img
                          src={styles.currencySymbolImage}
                          alt="رمز العملة"
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 object-contain border border-slate-200 rounded bg-white p-1"
                        />
                      )}
                      <label className="cursor-pointer px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold">
                        رفع صورة الرمز
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const compressed = await compressImageToDataUrl(file, 160);
                              setStyles({ ...styles, currencySymbolImage: compressed });
                            } catch {
                              showToast('تعذر تحميل الصورة', 'error');
                            }
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* WORKSTATION CANVAS */}
        <main className="flex-1 flex flex-col overflow-hidden relative no-print min-w-0">
          <div
            ref={canvasViewportRef}
            onClick={() => setShowBoardFloatingBar(false)}
            className="flex-1 overflow-auto p-6 pt-14 md:p-10 md:pt-14 flex justify-center items-start custom-scrollbar relative bg-slate-100 dark:bg-slate-950"
            style={{
              backgroundImage:
                'radial-gradient(rgba(148,163,184,0.35) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          >
            <div
              style={{
                width: `${(currentAspect.width * previewZoom) / 100}px`,
                height: `${(currentAspect.height * previewZoom) / 100}px`,
              }}
              className="relative shrink-0"
            >
              {/* Floating Compact Top Bar on Board Click (Export to Image & Quick Actions) */}
              {showBoardFloatingBar && currentBoard && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute -top-12 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl rounded-full flex items-center gap-1 px-2 py-1 border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-1 duration-150 ${
                    effectiveBoardsPerPage === 2 && secondBoard
                      ? safeBoardIdx === pairStartIdx
                        ? 'right-1/4 translate-x-1/2'
                        : 'left-1/4 -translate-x-1/2'
                      : 'left-1/2 -translate-x-1/2'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setDownloadDialog({
                        isOpen: true,
                        fileName: currentBoard.title || projectName || 'قائمة-الاصناف',
                        targetId: `board-preview-${currentBoard.id}`,
                      })
                    }
                    className="px-2.5 py-1 rounded-full bg-sap-primary hover:bg-sap-primary-hover text-white text-[11px] font-black flex items-center gap-1.5 whitespace-nowrap transition-colors"
                    title="تصدير هذه الشاشة إلى صورة PNG"
                  >
                    <Download size={13} />
                    <span>التصدير إلى صورة</span>
                  </button>

                  {effectiveBoardsPerPage === 2 && secondBoard && (
                    <button
                      type="button"
                      onClick={() =>
                        setDownloadDialog({
                          isOpen: true,
                          fileName: projectName || 'شاشات-الاسعار',
                          targetId: 'board-preview-container',
                        })
                      }
                      className="px-2 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-bold whitespace-nowrap transition-colors"
                      title="تصدير الصفحة كاملة (الشاشتين) كصورة"
                    >
                      الشاشتين
                    </button>
                  )}

                  <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />

                  <button
                    type="button"
                    onClick={duplicateCurrentBoard}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full transition-colors"
                    title="تكرار الشاشة"
                  >
                    <Copy size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProductIds(new Set());
                      setShowProductPicker(true);
                    }}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full transition-colors"
                    title="إضافة أصناف للشاشة"
                  >
                    <Plus size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={enterPresentation}
                    className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-emerald-600 rounded-full transition-colors"
                    title="عرض مباشر"
                  >
                    <Play size={14} />
                  </button>

                  {boards.length > 1 && (
                    <button
                      type="button"
                      onClick={() => deleteBoard(safeBoardIdx)}
                      className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 rounded-full transition-colors"
                      title="حذف الشاشة"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}

              <div
                style={{
                  transform: `scale(${previewZoom / 100})`,
                  transformOrigin: 'top right',
                  width: `${currentAspect.width}px`,
                  height: `${currentAspect.height}px`,
                }}
              >
                <div
                  id="board-preview-container"
                  className="bg-white shadow-[0_28px_80px_rgba(0,0,0,0.22)] relative border border-slate-300/70"
                  style={{
                    width: currentAspect.cssWidth,
                    height: currentAspect.cssHeight,
                    display: 'grid',
                    gridTemplateColumns:
                      effectiveBoardsPerPage === 2 && secondBoard ? '1fr 1fr' : '1fr',
                    gridTemplateRows: '1fr',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Primary Board */}
                  <div
                    className={`w-full h-full relative cursor-pointer ${
                      showBoardFloatingBar && safeBoardIdx === pairStartIdx
                        ? 'ring-4 ring-sap-primary ring-inset'
                        : safeBoardIdx === pairStartIdx && effectiveBoardsPerPage === 2
                        ? 'ring-4 ring-sap-primary ring-inset'
                        : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveBoardIdx(pairStartIdx);
                      setShowBoardFloatingBar(true);
                    }}
                  >
                    <div id={`board-preview-${firstBoard.id}`} className="w-full h-full bg-white">
                      <BoardRenderer
                        board={firstBoard}
                        s={styles}
                        isSmall={effectiveBoardsPerPage === 2 && Boolean(secondBoard)}
                      />
                    </div>
                  </div>

                  {/* Secondary Board (A4 Dual Mode) */}
                  {effectiveBoardsPerPage === 2 && secondBoard && (
                    <div
                      className={`w-full h-full relative cursor-pointer border-r-2 border-dashed border-slate-300 ${
                        safeBoardIdx === pairStartIdx + 1
                          ? 'ring-4 ring-sap-primary ring-inset'
                          : ''
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveBoardIdx(pairStartIdx + 1);
                        setShowBoardFloatingBar(true);
                      }}
                    >
                      <div
                        id={`board-preview-${secondBoard.id}`}
                        className="w-full h-full bg-white"
                      >
                        <BoardRenderer board={secondBoard} s={styles} isSmall={true} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Board Switcher Bar */}
          <div className="bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
              {boards.map((b, idx) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setActiveBoardIdx(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    safeBoardIdx === idx
                      ? 'bg-sap-primary text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="tabular-nums opacity-75">{idx + 1}.</span>
                  <span className="max-w-[140px] truncate">{b.title}</span>
                  <span className="text-[10px] tabular-nums opacity-75">({b.items.length})</span>
                </button>
              ))}
              <button
                type="button"
                onClick={addNewBoard}
                className="px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-500 dark:text-slate-400 hover:border-sap-primary hover:text-sap-primary flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
              >
                <Plus size={13} />
                <span>شاشة</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedProductIds(new Set());
                setShowProductPicker(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-sap-secondary text-white text-xs font-black flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:opacity-95 transition-opacity"
            >
              <Plus size={14} />
              <span>إضافة أصناف</span>
            </button>
          </div>
        </main>
      </div>

      {/* LIVE DIGITAL SIGNAGE PRESENTATION OVERLAY */}
      {isPresenting && (
        <div
          ref={presentationRef}
          onMouseMove={wakeHud}
          onClick={wakeHud}
          className="fixed inset-0 z-[2000] bg-black flex items-center justify-center overflow-hidden select-none"
        >
          {activeSlides[presentSlideIdx] && (
            <div
              style={{
                width: `${currentAspect.width}px`,
                height: `${currentAspect.height}px`,
                transform: `scale(${presentScale})`,
                transformOrigin: 'center center',
              }}
              className="shrink-0 shadow-2xl"
            >
              <BoardRenderer board={activeSlides[presentSlideIdx]} s={styles} />
            </div>
          )}

          {/* Auto-hiding Presentation Control HUD */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white border border-white/15 rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-2xl transition-opacity duration-300 ${
              hudVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <button
              type="button"
              onClick={() =>
                setPresentSlideIdx(
                  (p) => (p - 1 + activeSlides.length) % activeSlides.length
                )
              }
              disabled={activeSlides.length <= 1}
              className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30"
              title="الشاشة السابقة"
            >
              <ChevronRight size={18} />
            </button>

            <button
              type="button"
              onClick={() => setIsSlidePlaying((p) => !p)}
              disabled={activeSlides.length <= 1}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-black flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap"
            >
              {isSlidePlaying ? <Pause size={14} /> : <Play size={14} />}
              <span>{isSlidePlaying ? 'إيقاف مؤقت' : 'تشغيل تلقائي'}</span>
            </button>

            <button
              type="button"
              onClick={() => setPresentSlideIdx((p) => (p + 1) % activeSlides.length)}
              disabled={activeSlides.length <= 1}
              className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30"
              title="الشاشة التالية"
            >
              <ChevronLeft size={18} />
            </button>

            <span className="text-xs font-bold tabular-nums px-2 text-slate-300">
              {presentSlideIdx + 1} / {activeSlides.length}
            </span>

            <div className="w-px h-5 bg-white/15" />

            <button
              type="button"
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen().catch(() => {});
                } else {
                  presentationRef.current?.requestFullscreen?.().catch(() => {});
                }
              }}
              className="p-2 rounded-lg hover:bg-white/10"
              title="ملء الشاشة"
            >
              <Maximize2 size={16} />
            </button>

            <button
              type="button"
              onClick={exitPresentation}
              className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-red-600 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <Minimize2 size={14} />
              <span>إنهاء العرض</span>
            </button>
          </div>
        </div>
      )}

      {/* ARCHIVE MODAL */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-[1200] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200 dark:border-slate-700">
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center gap-3">
              <h3 className="font-black text-base flex items-center gap-2">
                <Layers size={18} className="text-sap-primary" />
                <span>أرشيف مشاريع الشاشات</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowArchiveModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  placeholder="بحث في المشاريع المحفوظة..."
                  className="w-full pr-9 pl-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-sap-primary"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  createNew();
                  setShowArchiveModal(false);
                }}
                className="px-3.5 py-2 rounded-lg bg-sap-primary text-white text-xs font-black flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <FilePlus size={14} />
                <span>مشروع جديد</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {filteredProjects.length === 0 ? (
                <div className="py-16 text-center space-y-2 text-slate-400">
                  <FolderOpen size={40} className="mx-auto opacity-50" />
                  <p className="text-sm font-bold">لا توجد مشاريع مطابقة</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredProjects.map((pj) => {
                    const totalItems = (pj.boards || []).reduce(
                      (acc, b) => acc + (b.items?.length || 0),
                      0
                    );
                    const pjAspect =
                      ASPECT_DIMENSIONS[pj.styles?.aspectMode || 'a4_landscape']?.label ||
                      'A4';
                    return (
                      <div
                        key={pj.id}
                        onClick={() => {
                          loadProject(pj);
                          setShowArchiveModal(false);
                        }}
                        className={`p-4 rounded-xl border cursor-pointer flex flex-col justify-between gap-3 transition-colors ${
                          activeProjectId === pj.id
                            ? 'border-sap-primary bg-sap-primary/5 dark:bg-sap-primary/15'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-sap-primary/60'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-black text-sm">{pj.name}</div>
                            {activeProjectId === pj.id && (
                              <span className="text-[10px] font-black text-sap-primary dark:text-emerald-400 shrink-0">
                                نشط
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-1.5 tabular-nums">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {new Date(pj.date).toLocaleDateString('ar-SA')}
                            </span>
                            <span>·</span>
                            <span>{pj.boards?.length || 1} شاشات</span>
                            <span>·</span>
                            <span>{totalItems} صنف</span>
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 mt-1">
                            {pjAspect}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={(e) => handleDuplicateProject(e, pj)}
                            className="flex-1 py-1.5 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-bold flex items-center justify-center gap-1.5"
                          >
                            <Copy size={12} />
                            <span>نسخ</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDialog({
                                isOpen: true,
                                title: 'حذف المشروع',
                                message: `هل أنت متأكد من حذف "${pj.name}" نهائياً؟`,
                                onConfirm: async () => {
                                  await db.priceGroups.delete(pj.id);
                                  fetchData();
                                  if (activeProjectId === pj.id) {
                                    createNew();
                                  }
                                  setConfirmDialog(null);
                                  showToast('تم حذف المشروع');
                                },
                              });
                            }}
                            className="flex-1 py-1.5 rounded-md bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 text-xs font-bold flex items-center justify-center gap-1.5"
                          >
                            <Trash2 size={12} />
                            <span>حذف</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* UPGRADED MULTI-SELECT & CATEGORY PRODUCT PICKER MODAL */}
      {showProductPicker && (
        <div className="fixed inset-0 z-[1200] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200 dark:border-slate-700">
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-black text-base flex items-center gap-2">
                <Boxes size={18} className="text-sap-primary" />
                <span>استيراد أصناف إلى "{currentBoard?.title}"</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowProductPicker(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ابحث باسم المنتج أو الكود..."
                    className="w-full pr-9 pl-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-sap-primary"
                    autoFocus
                  />
                </div>
                {categories.length > 0 && (
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
                  >
                    <option value="ALL">كل الأقسام ({products.length})</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allVisibleIds = new Set(filteredProducts.map((p) => p.id));
                      setSelectedProductIds(allVisibleIds);
                    }}
                    className="text-[11px] font-bold text-sap-primary dark:text-emerald-400 hover:underline"
                  >
                    تحديد الكل ({filteredProducts.length})
                  </button>
                  {selectedProductIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedProductIds(new Set())}
                      className="text-[11px] font-bold text-slate-400 hover:underline"
                    >
                      إلغاء التحديد
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    addManualItem();
                    setShowProductPicker(false);
                  }}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-md border border-dashed border-sap-primary text-sap-primary dark:text-emerald-400 hover:bg-sap-primary/5 flex items-center gap-1"
                >
                  <Plus size={12} />
                  <span>إضافة صنف يدوي</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
              {filteredProducts.length === 0 ? (
                <div className="py-12 text-center text-xs font-bold text-slate-400">
                  لا توجد منتجات مطابقة لبحثك
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const checked = selectedProductIds.has(p.id);
                  const unitName = p.unitId ? unitMap.get(p.unitId) : '';
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProductIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(p.id)) next.delete(p.id);
                          else next.add(p.id);
                          return next;
                        });
                      }}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                        checked
                          ? 'border-sap-primary bg-sap-primary/5 dark:bg-sap-primary/15'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {checked ? (
                          <CheckSquare size={18} className="text-sap-primary shrink-0" />
                        ) : (
                          <Square size={18} className="text-slate-300 dark:text-slate-600 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-xs sm:text-sm truncate">{p.name}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 tabular-nums">
                            <span>{p.code}</span>
                            {unitName && <span>· {unitName}</span>}
                            {p.category && <span>· {p.category}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-sm tabular-nums text-sap-primary dark:text-emerald-400">
                          {p.price || '0.00'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addProductsToBoard([p]);
                          }}
                          className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-sap-primary hover:text-white text-[11px] font-bold transition-colors"
                        >
                          إضافة سريعة
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                تم تحديد {selectedProductIds.size} منتج
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowProductPicker(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-bold"
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  disabled={selectedProductIds.size === 0}
                  onClick={() =>
                    addProductsToBoard(
                      products.filter((p) => selectedProductIds.has(p.id))
                    )
                  }
                  className="px-4 py-2 rounded-lg bg-sap-primary text-white text-xs font-black disabled:opacity-40 tabular-nums"
                >
                  إضافة المحدد ({selectedProductIds.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[1300] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-950/40 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={22} />
              </div>
              <h3 className="font-black text-base">{confirmDialog.title || 'تأكيد الحذف'}</h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {confirmDialog.message}
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg font-bold text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-black text-xs"
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOWNLOAD IMAGE DIALOG */}
      {downloadDialog?.isOpen && (
        <div className="fixed inset-0 z-[1300] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-sap-primary/10 text-sap-primary rounded-full flex items-center justify-center mx-auto">
                <Download size={22} />
              </div>
              <h3 className="font-black text-base">تصدير الشاشة كصورة PNG</h3>
              <input
                type="text"
                value={downloadDialog.fileName}
                onChange={(e) =>
                  setDownloadDialog({ ...downloadDialog, fileName: e.target.value })
                }
                className="w-full px-3 py-2.5 text-center text-sm font-black bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-sap-primary outline-none"
                autoFocus
              />
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex gap-2">
              <button
                type="button"
                onClick={() => setDownloadDialog(null)}
                className="flex-1 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg font-bold text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  executeSaveAsImage(downloadDialog.fileName, downloadDialog.targetId);
                  setDownloadDialog(null);
                }}
                className="flex-1 py-2 bg-sap-primary text-white rounded-lg font-black text-xs"
              >
                تنزيل الصورة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE PROJECT DIALOG */}
      {saveProjectDialog?.isOpen && (
        <div className="fixed inset-0 z-[1300] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-sap-primary/10 text-sap-primary rounded-full flex items-center justify-center mx-auto">
                <Save size={22} />
              </div>
              <h3 className="font-black text-base">حفظ مشروع الشاشات</h3>
              <input
                type="text"
                value={saveProjectDialog.projectName}
                onChange={(e) =>
                  setSaveProjectDialog({
                    ...saveProjectDialog,
                    projectName: e.target.value,
                  })
                }
                placeholder="اسم المشروع..."
                className="w-full px-3 py-2.5 text-center text-sm font-black bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-sap-primary outline-none"
                autoFocus
              />
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex gap-2">
              <button
                type="button"
                onClick={() => setSaveProjectDialog(null)}
                className="flex-1 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg font-bold text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  executeSave(saveProjectDialog.projectName);
                  setSaveProjectDialog(null);
                }}
                className="flex-1 py-2 bg-sap-primary text-white rounded-lg font-black text-xs"
              >
                حفظ المشروع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
