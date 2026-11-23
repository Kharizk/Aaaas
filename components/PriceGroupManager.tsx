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
  Snowflake,
  Coffee,
  Table2,
  Cpu,
  Edit3,
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
  const [themeCategory, setThemeCategory] = useState<'all' | 'tv_dark' | 'retail_promo' | 'editorial'>('all');
  const [showBoardFloatingBar, setShowBoardFloatingBar] = useState(false);
  const [inlineEditEnabled, setInlineEditEnabled] = useState(true);
  const [isExportingPng, setIsExportingPng] = useState(false);
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

  // Item Operations (active-board & boardId-scoped for inline canvas editing)
  const updateBoardField = (
    boardId: string,
    patch: Partial<Pick<PriceGroupBoard, 'title' | 'subtitle'>>
  ) => {
    setBoards((prev) => prev.map((b) => (b.id === boardId ? { ...b, ...patch } : b)));
  };

  const updateBoardItem = (
    boardId: string,
    itemId: string,
    patch: Partial<PriceGroupItem>
  ) => {
    setBoards((prev) =>
      prev.map((b) =>
        b.id === boardId
          ? {
              ...b,
              items: b.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
            }
          : b
      )
    );
  };

  const addManualItemToBoard = (boardId: string) => {
    const idx = boards.findIndex((b) => b.id === boardId);
    if (idx >= 0) setActiveBoardIdx(idx);
    const newItem: PriceGroupItem = {
      id: crypto.randomUUID(),
      label: 'صنف جديد',
      price: '0.00',
      originalPrice: '',
      unit: '',
      isOffer: false,
    };
    setBoards((prev) =>
      prev.map((b) => (b.id === boardId ? { ...b, items: [...b.items, newItem] } : b))
    );
  };

  const removeBoardItem = (boardId: string, itemId: string) => {
    setBoards((prev) =>
      prev.map((b) =>
        b.id === boardId ? { ...b, items: b.items.filter((it) => it.id !== itemId) } : b
      )
    );
  };

  const moveBoardItem = (boardId: string, itemId: string, dir: -1 | 1) => {
    setBoards((prev) =>
      prev.map((b) => {
        if (b.id !== boardId) return b;
        const idx = b.items.findIndex((it) => it.id === itemId);
        const target = idx + dir;
        if (idx < 0 || target < 0 || target >= b.items.length) return b;
        const next = [...b.items];
        [next[idx], next[target]] = [next[target], next[idx]];
        return { ...b, items: next };
      })
    );
  };

  const openCatalogForBoard = (boardId: string) => {
    const idx = boards.findIndex((b) => b.id === boardId);
    if (idx >= 0) setActiveBoardIdx(idx);
    setSelectedProductIds(new Set());
    setShowProductPicker(true);
  };

  const addManualItem = () => {
    const targetBoard = boards[safeBoardIdx];
    if (targetBoard) {
      addManualItemToBoard(targetBoard.id);
    }
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
    setIsExportingPng(true);
    try {
      await new Promise((r) => setTimeout(r, 90));
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
    } finally {
      setIsExportingPng(false);
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
    subtitle: string;
    category: 'tv_dark' | 'retail_promo' | 'editorial';
    icon: React.ComponentType<{ size?: number | string; className?: string }>;
    previewBg: string;
    previewHeader: string;
    previewCardBg: string;
    previewAccent: string;
    previewLayout: 'rows' | 'grid' | 'ledger';
    isDark?: boolean;
  }> = [
    {
      id: 'dark_menu_board',
      name: 'منيو شاشات داكن',
      subtitle: 'مطاعم وبوفيهات TV',
      category: 'tv_dark',
      icon: Tv,
      previewBg: '#0f172a',
      previewHeader: '#f59e0b',
      previewCardBg: '#1e293b',
      previewAccent: '#fbbf24',
      previewLayout: 'rows',
      isDark: true,
    },
    {
      id: 'neon_promo_tv',
      name: 'عروض TV جريئة',
      subtitle: 'شاشات خصومات حية',
      category: 'tv_dark',
      icon: Flame,
      previewBg: '#0b0f19',
      previewHeader: '#dc2626',
      previewCardBg: '#171f30',
      previewAccent: '#facc15',
      previewLayout: 'grid',
      isDark: true,
    },
    {
      id: 'cafe_artisan',
      name: 'كافيه ومخبوزات',
      subtitle: 'إسبريسو دافئ وأنيق',
      category: 'tv_dark',
      icon: Coffee,
      previewBg: '#1c1917',
      previewHeader: '#d97706',
      previewCardBg: '#292524',
      previewAccent: '#fbbf24',
      previewLayout: 'rows',
      isDark: true,
    },
    {
      id: 'electronics_sleek',
      name: 'إلكترونيات وتقنية',
      subtitle: 'تصميم فحمي حديث',
      category: 'tv_dark',
      icon: Cpu,
      previewBg: '#09090b',
      previewHeader: '#0284c7',
      previewCardBg: '#18181b',
      previewAccent: '#38bdf8',
      previewLayout: 'grid',
      isDark: true,
    },
    {
      id: 'elegant_gold',
      name: 'ذهبي فاخر',
      subtitle: 'كحلي ليلي وبريق ذهبي',
      category: 'tv_dark',
      icon: Diamond,
      previewBg: '#0f172a',
      previewHeader: '#c5a059',
      previewCardBg: '#172033',
      previewAccent: '#eab308',
      previewLayout: 'rows',
      isDark: true,
    },
    {
      id: 'super_market',
      name: 'سوبر ماركت',
      subtitle: 'بطاقات عروض واضحة',
      category: 'retail_promo',
      icon: ShoppingBag,
      previewBg: '#fff7ed',
      previewHeader: '#ea580c',
      previewCardBg: '#ffffff',
      previewAccent: '#dc2626',
      previewLayout: 'grid',
    },
    {
      id: 'digital_punch',
      name: 'العروض القوية',
      subtitle: 'شريط أسعار عالي التباين',
      category: 'retail_promo',
      icon: Zap,
      previewBg: '#ffffff',
      previewHeader: '#dc2626',
      previewCardBg: '#f8fafc',
      previewAccent: '#dc2626',
      previewLayout: 'rows',
    },
    {
      id: 'butcher_frozen',
      name: 'مجمدات ولحوم',
      subtitle: 'أزرق جليدي للتبريد',
      category: 'retail_promo',
      icon: Snowflake,
      previewBg: '#f0f9ff',
      previewHeader: '#0c2340',
      previewCardBg: '#ffffff',
      previewAccent: '#0284c7',
      previewLayout: 'rows',
    },
    {
      id: 'wholesale_ledger',
      name: 'جملة ومستودعات',
      subtitle: 'جدول مؤسسي منسق',
      category: 'retail_promo',
      icon: Table2,
      previewBg: '#ffffff',
      previewHeader: '#0f172a',
      previewCardBg: '#f1f5f9',
      previewAccent: '#0f766e',
      previewLayout: 'ledger',
    },
    {
      id: 'minimal_kiosk',
      name: 'كيوسك حديث',
      subtitle: 'نظيف ومرتب للخدمة',
      category: 'editorial',
      icon: Monitor,
      previewBg: '#f8fafc',
      previewHeader: '#0284c7',
      previewCardBg: '#ffffff',
      previewAccent: '#0284c7',
      previewLayout: 'rows',
    },
    {
      id: 'geometric_luxe',
      name: 'الحديث النظيف',
      subtitle: 'إطار تحريري متوازن',
      category: 'editorial',
      icon: Layout,
      previewBg: '#ffffff',
      previewHeader: '#006c35',
      previewCardBg: '#f8fafc',
      previewAccent: '#006c35',
      previewLayout: 'rows',
    },
    {
      id: 'modern_grid',
      name: 'الشبكة التقنية',
      subtitle: 'خلايا مواصفات دقيقة',
      category: 'editorial',
      icon: Grid,
      previewBg: '#f8fafc',
      previewHeader: '#2563eb',
      previewCardBg: '#ffffff',
      previewAccent: '#2563eb',
      previewLayout: 'grid',
    },
    {
      id: 'royal_minimal',
      name: 'الكلاسيكي الفاخر',
      subtitle: 'حواف مزدوجة وأنيقة',
      category: 'editorial',
      icon: Crown,
      previewBg: '#fffbeb',
      previewHeader: '#92400e',
      previewCardBg: '#fef3c7',
      previewAccent: '#92400e',
      previewLayout: 'rows',
    },
    {
      id: 'fresh_nature',
      name: 'طبيعة طازجة',
      subtitle: 'خضار وفواكه ومخبز',
      category: 'editorial',
      icon: Leaf,
      previewBg: '#f0fdf4',
      previewHeader: '#15803d',
      previewCardBg: '#ffffff',
      previewAccent: '#15803d',
      previewLayout: 'rows',
    },
    {
      id: 'abstract_gradient',
      name: 'الناعم العضوي',
      subtitle: 'تدرج هادئ ومريح',
      category: 'editorial',
      icon: Sparkles,
      previewBg: '#ecfdf5',
      previewHeader: '#059669',
      previewCardBg: '#ffffff',
      previewAccent: '#059669',
      previewLayout: 'rows',
    },
    {
      id: 'ramadan_vibes',
      name: 'رمضاني ومواسم',
      subtitle: 'زخرفة هلالية راقية',
      category: 'editorial',
      icon: Moon,
      previewBg: '#fefce8',
      previewHeader: '#854d0e',
      previewCardBg: '#ffffff',
      previewAccent: '#a16207',
      previewLayout: 'rows',
    },
  ];

  const DARK_THEME_IDS: PriceGroupTheme[] = [
    'dark_menu_board',
    'neon_promo_tv',
    'elegant_gold',
    'cafe_artisan',
    'electronics_sleek',
  ];

  const applyThemeWithRecommendedColors = (newThemeId: PriceGroupTheme) => {
    setThemeId(newThemeId);
    const themeColorMap: Partial<Record<PriceGroupTheme, Partial<PriceGroupStyles>>> = {
      dark_menu_board: {
        backgroundColor: '#0f172a',
        textColor: '#f8fafc',
        primaryColor: '#f59e0b',
        secondaryColor: '#334155',
        priceColor: '#fbbf24',
        borderColor: '#334155',
      },
      neon_promo_tv: {
        backgroundColor: '#0b0f19',
        textColor: '#ffffff',
        primaryColor: '#dc2626',
        secondaryColor: '#facc15',
        priceColor: '#facc15',
        borderColor: '#dc2626',
      },
      cafe_artisan: {
        backgroundColor: '#1c1917',
        textColor: '#fef3c7',
        primaryColor: '#d97706',
        secondaryColor: '#b45309',
        priceColor: '#fbbf24',
        borderColor: '#44403c',
      },
      electronics_sleek: {
        backgroundColor: '#09090b',
        textColor: '#f4f4f5',
        primaryColor: '#0284c7',
        secondaryColor: '#38bdf8',
        priceColor: '#38bdf8',
        borderColor: '#27272a',
      },
      elegant_gold: {
        backgroundColor: '#0f172a',
        textColor: '#f8fafc',
        primaryColor: '#C5A059',
        secondaryColor: '#C5A059',
        priceColor: '#eab308',
        borderColor: '#C5A059',
      },
      butcher_frozen: {
        backgroundColor: '#f0f9ff',
        textColor: '#0c2340',
        primaryColor: '#0c2340',
        secondaryColor: '#0284c7',
        priceColor: '#0369a1',
        borderColor: '#0284c7',
      },
      wholesale_ledger: {
        backgroundColor: '#ffffff',
        textColor: '#0f172a',
        primaryColor: '#0f172a',
        secondaryColor: '#0f766e',
        priceColor: '#0f766e',
        borderColor: '#cbd5e1',
      },
      super_market: {
        backgroundColor: '#fff7ed',
        textColor: '#1e293b',
        primaryColor: '#ea580c',
        secondaryColor: '#f59e0b',
        priceColor: '#dc2626',
        borderColor: '#ea580c',
      },
      digital_punch: {
        backgroundColor: '#ffffff',
        textColor: '#0f172a',
        primaryColor: '#dc2626',
        secondaryColor: '#f59e0b',
        priceColor: '#dc2626',
        borderColor: '#dc2626',
      },
      minimal_kiosk: {
        backgroundColor: '#f8fafc',
        textColor: '#0f172a',
        primaryColor: '#0284c7',
        secondaryColor: '#38bdf8',
        priceColor: '#0284c7',
        borderColor: '#e2e8f0',
      },
      modern_grid: {
        backgroundColor: '#f8fafc',
        textColor: '#0f172a',
        primaryColor: '#2563eb',
        secondaryColor: '#64748b',
        priceColor: '#2563eb',
        borderColor: '#cbd5e1',
      },
      royal_minimal: {
        backgroundColor: '#fffbeb',
        textColor: '#451a03',
        primaryColor: '#92400e',
        secondaryColor: '#d97706',
        priceColor: '#92400e',
        borderColor: '#b45309',
      },
      fresh_nature: {
        backgroundColor: '#f0fdf4',
        textColor: '#052e16',
        primaryColor: '#15803d',
        secondaryColor: '#84cc16',
        priceColor: '#15803d',
        borderColor: '#16a34a',
      },
      abstract_gradient: {
        backgroundColor: '#ecfdf5',
        textColor: '#064e3b',
        primaryColor: '#059669',
        secondaryColor: '#10b981',
        priceColor: '#047857',
        borderColor: '#a7f3d0',
      },
      ramadan_vibes: {
        backgroundColor: '#fefce8',
        textColor: '#422006',
        primaryColor: '#854d0e',
        secondaryColor: '#ca8a04',
        priceColor: '#854d0e',
        borderColor: '#ca8a04',
      },
      geometric_luxe: {
        backgroundColor: '#ffffff',
        textColor: '#0f172a',
        primaryColor: '#006C35',
        secondaryColor: '#C5A059',
        priceColor: '#006C35',
        borderColor: '#006C35',
      },
    };

    const nextColors = themeColorMap[newThemeId];
    if (nextColors) {
      setStyles((prev) => ({ ...prev, ...nextColors }));
    } else if (DARK_THEME_IDS.includes(themeId)) {
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
      name: 'أزرق جليدي',
      colors: {
        primaryColor: '#0c2340',
        secondaryColor: '#0284c7',
        backgroundColor: '#f0f9ff',
        textColor: '#0c2340',
        priceColor: '#0369a1',
        borderColor: '#0284c7',
      },
    },
    {
      name: 'إسبريسو دافئ',
      colors: {
        primaryColor: '#d97706',
        secondaryColor: '#78350f',
        backgroundColor: '#1c1917',
        textColor: '#fef3c7',
        priceColor: '#fbbf24',
        borderColor: '#44403c',
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
        backgroundColor: '#0b0f19',
        textColor: '#ffffff',
        priceColor: '#facc15',
        borderColor: '#ef4444',
      },
    },
  ];

  // Shared Price Block Renderer (supports direct inline editing of price & originalPrice)
  const renderPriceBlock = (
    item: PriceGroupItem,
    s: PriceGroupStyles,
    scale: number,
    options?: {
      priceColorOverride?: string;
      currencyColorOverride?: string;
      fontMono?: boolean;
      priceBoost?: number;
      boardId?: string;
      canEdit?: boolean;
      darkSurface?: boolean;
    }
  ) => {
    const discountPct = calcDiscountPercent(item.price, item.originalPrice);
    const pColor =
      options?.priceColorOverride || (item.isOffer ? '#ef4444' : s.priceColor);
    const cColor = options?.currencyColorOverride || s.textColor;
    const boost = options?.priceBoost || 1;
    const isEditable = Boolean(options?.canEdit && options?.boardId);

    return (
      <div className="flex flex-col items-end shrink-0">
        <div className="flex items-baseline gap-1.5 flex-nowrap">
          {isEditable && options?.boardId ? (
            <input
              type="text"
              dir="ltr"
              value={item.originalPrice || ''}
              onChange={(e) =>
                updateBoardItem(options.boardId!, item.id, { originalPrice: e.target.value })
              }
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              placeholder="قبل"
              title="السعر قبل الخصم"
              className={`bg-transparent text-center line-through font-bold tabular-nums outline-none rounded border border-transparent transition-all ml-0.5 ${
                item.originalPrice
                  ? 'opacity-65 hover:border-dashed'
                  : 'max-w-0 px-0 opacity-0 group-hover/row:max-w-[54px] group-hover/row:px-1 group-hover/row:opacity-65 focus:max-w-[54px] focus:px-1 focus:opacity-95 overflow-hidden'
              } ${
                options?.darkSurface
                  ? 'hover:border-white/35 focus:border-white/75 focus:bg-white/10 placeholder:text-white/40'
                  : 'hover:border-slate-400/50 focus:border-sap-primary focus:bg-white/80 placeholder:text-slate-400'
              }`}
              style={{
                fontSize: `${Math.max(11, s.itemFontSize * scale * 0.72)}px`,
                color: cColor,
                width: item.originalPrice
                  ? `${Math.max(3.5, item.originalPrice.length + 1)}ch`
                  : undefined,
              }}
            />
          ) : (
            item.originalPrice && (
              <span
                className="line-through opacity-55 font-bold tabular-nums ml-1"
                style={{
                  fontSize: `${Math.max(11, s.itemFontSize * scale * 0.72)}px`,
                  color: cColor,
                }}
              >
                {item.originalPrice}
              </span>
            )
          )}

          {isEditable && options?.boardId ? (
            <input
              type="text"
              dir="ltr"
              value={item.price}
              onChange={(e) =>
                updateBoardItem(options.boardId!, item.id, { price: e.target.value })
              }
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              placeholder="0.00"
              title="اضغط لتعديل السعر"
              className={`bg-transparent text-left font-black tabular-nums leading-none outline-none rounded px-1 -mx-1 border border-transparent hover:border-dashed focus:border-solid transition-colors ${
                options?.fontMono ? 'font-mono' : ''
              } ${
                options?.darkSurface
                  ? 'hover:border-white/40 focus:border-white/80 focus:bg-white/10 placeholder:text-white/35'
                  : 'hover:border-slate-400/60 focus:border-sap-primary focus:bg-white/85 placeholder:text-slate-400'
              }`}
              style={{
                fontSize: `${s.priceFontSize * scale * boost}px`,
                color: pColor,
                width: `${Math.max(3.4, (item.price || '0').length + 0.9)}ch`,
              }}
            />
          ) : (
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
          )}

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

  // Board Content Render Helper (plain function — preserves input focus on every keystroke)
  const renderBoardContent = ({
    board,
    s,
    isSmall = false,
    editable = false,
  }: {
    board: PriceGroupBoard;
    s: PriceGroupStyles;
    isSmall?: boolean;
    editable?: boolean;
  }) => {
    const canEdit = Boolean(editable && !isExportingPng && inlineEditEnabled);
    const isPortraitScreen = aspectMode === 'screen_9_16';
    const scale = isSmall ? 0.75 : isPortraitScreen ? 0.92 : 1;
    const cols = Math.max(1, Math.min(3, s.columns || 1));
    const gridColsClass =
      cols === 3 ? 'grid-cols-3' : cols === 2 ? 'grid-cols-2' : 'grid-cols-1';

    const timeStr = liveTime.toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const renderTitle = (
      className: string,
      style?: React.CSSProperties,
      darkHeader = false,
      extraWidthClass = 'w-full'
    ) => {
      if (!canEdit) {
        return (
          <h1 className={className} style={style}>
            {board.title}
          </h1>
        );
      }
      return (
        <input
          type="text"
          value={board.title}
          onChange={(e) => updateBoardField(board.id, { title: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="عنوان القائمة..."
          title="اضغط لتعديل عنوان القائمة"
          className={`${className} ${extraWidthClass} bg-transparent outline-none rounded-md px-1.5 -mx-1.5 border border-transparent hover:border-dashed focus:border-solid transition-colors ${
            darkHeader
              ? 'hover:border-white/40 focus:border-white/85 focus:bg-black/25 placeholder:text-white/45'
              : 'hover:border-slate-400/55 focus:border-sap-primary focus:bg-white/75 placeholder:text-slate-400'
          }`}
          style={style}
        />
      );
    };

    const renderSubtitle = (
      className: string,
      style?: React.CSSProperties,
      darkHeader = false
    ) => {
      if (!canEdit) {
        return board.subtitle ? (
          <p className={className} style={style}>
            {board.subtitle}
          </p>
        ) : null;
      }
      return (
        <input
          type="text"
          value={board.subtitle || ''}
          onChange={(e) => updateBoardField(board.id, { subtitle: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="أضف وصفاً فرعياً..."
          title="اضغط لتعديل الوصف الفرعي"
          className={`${className} w-full bg-transparent outline-none rounded px-1.5 -mx-1.5 border border-transparent hover:border-dashed focus:border-solid transition-colors ${
            !board.subtitle ? 'opacity-45 focus:opacity-95' : ''
          } ${
            darkHeader
              ? 'hover:border-white/35 focus:border-white/80 focus:bg-black/25 placeholder:text-white/40'
              : 'hover:border-slate-400/50 focus:border-sap-primary focus:bg-white/75 placeholder:text-slate-400'
          }`}
          style={style}
        />
      );
    };

    const renderItemLabel = (
      item: PriceGroupItem,
      className: string,
      style?: React.CSSProperties,
      darkSurface = false
    ) => {
      if (!canEdit) {
        return (
          <span className={className} style={style}>
            {item.label}
          </span>
        );
      }
      return (
        <input
          type="text"
          value={item.label}
          onChange={(e) => updateBoardItem(board.id, item.id, { label: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="اسم الصنف..."
          title="اضغط لتعديل اسم الصنف"
          className={`${className} w-full min-w-0 bg-transparent outline-none rounded px-1 -mx-1 border border-transparent hover:border-dashed focus:border-solid transition-colors ${
            darkSurface
              ? 'hover:border-white/35 focus:border-white/80 focus:bg-white/10 placeholder:text-white/35'
              : 'hover:border-slate-400/55 focus:border-sap-primary focus:bg-white/85 placeholder:text-slate-400'
          }`}
          style={style}
        />
      );
    };

    const renderItemUnit = (
      item: PriceGroupItem,
      className: string,
      style?: React.CSSProperties,
      darkSurface = false,
      inlineMode = false
    ) => {
      if (!canEdit) {
        if (!item.unit) return null;
        return inlineMode ? (
          <span className={className} style={style}>
            · {item.unit}
          </span>
        ) : (
          <div className={className} style={style}>
            {item.unit}
          </div>
        );
      }
      if (inlineMode) {
        return (
          <input
            type="text"
            value={item.unit || ''}
            onChange={(e) => updateBoardItem(board.id, item.id, { unit: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="الوحدة..."
            title="اضغط لتعديل الوحدة أو الوزن"
            style={{
              ...style,
              width: item.unit ? `${Math.max(4, item.unit.length + 1.5)}ch` : undefined,
            }}
            className={`${className} bg-transparent outline-none rounded px-1 border border-transparent hover:border-dashed focus:border-solid transition-all ${
              !item.unit
                ? 'max-w-0 px-0 opacity-0 group-hover/row:max-w-[110px] group-hover/row:px-1 group-hover/row:opacity-80 focus:max-w-[110px] focus:px-1 focus:opacity-100 overflow-hidden'
                : ''
            } ${
              darkSurface
                ? 'hover:border-white/35 focus:border-white/75 focus:bg-white/10 placeholder:text-white/35'
                : 'hover:border-slate-400/50 focus:border-sap-primary focus:bg-white/85 placeholder:text-slate-400'
            }`}
          />
        );
      }
      return (
        <input
          type="text"
          value={item.unit || ''}
          onChange={(e) => updateBoardItem(board.id, item.id, { unit: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="الوحدة / الوزن..."
          title="اضغط لتعديل الوحدة أو الوزن"
          style={style}
          className={`${className} w-full bg-transparent outline-none rounded px-1 -mx-1 border border-transparent hover:border-dashed focus:border-solid transition-all ${
            !item.unit
              ? 'max-h-0 opacity-0 group-hover/row:max-h-7 group-hover/row:opacity-85 focus:max-h-7 focus:opacity-100 overflow-hidden'
              : ''
          } ${
            darkSurface
              ? 'hover:border-white/35 focus:border-white/75 focus:bg-white/10 placeholder:text-white/35'
              : 'hover:border-slate-400/50 focus:border-sap-primary focus:bg-white/85 placeholder:text-slate-400'
          }`}
        />
      );
    };

    const renderItemBadge = (
      item: PriceGroupItem,
      className: string,
      style?: React.CSSProperties,
      fallbackText = 'عرض'
    ) => {
      if (!(item.isOffer || item.badgeText)) return null;
      if (!canEdit) {
        return (
          <span className={className} style={style}>
            {item.badgeText || fallbackText}
          </span>
        );
      }
      return (
        <input
          type="text"
          value={item.badgeText ?? ''}
          placeholder={fallbackText}
          onChange={(e) => updateBoardItem(board.id, item.id, { badgeText: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          title="اضغط لتعديل نص الشارة"
          style={{
            ...style,
            width: `${Math.max(4.5, (item.badgeText || fallbackText).length + 1.5)}ch`,
          }}
          className={`${className} text-center outline-none border border-transparent focus:border-white/85 cursor-text`}
        />
      );
    };

    const renderRowHoverActions = (
      item: PriceGroupItem,
      idx: number,
      total: number,
      darkSurface = false
    ) => {
      if (!canEdit) return null;
      return (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`hidden group-hover/row:flex group-focus-within/row:flex items-center gap-0.5 rounded-md border px-1 py-0.5 shrink-0 ${
            darkSurface
              ? 'bg-slate-900/90 border-white/20 text-white/85'
              : 'bg-white/95 border-slate-200 text-slate-600 shadow-xs'
          }`}
        >
          <button
            type="button"
            onClick={() => updateBoardItem(board.id, item.id, { isOffer: !item.isOffer })}
            className={`p-1 rounded transition-colors ${
              item.isOffer
                ? 'bg-amber-500 text-slate-950'
                : darkSurface
                ? 'hover:bg-white/15 text-amber-300'
                : 'hover:bg-amber-50 text-amber-600'
            }`}
            title={item.isOffer ? 'إلغاء تمييز العرض' : 'تمييز كعرض'}
          >
            <Zap size={12} fill={item.isOffer ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            disabled={idx === 0}
            onClick={() => moveBoardItem(board.id, item.id, -1)}
            className={`p-1 rounded disabled:opacity-25 transition-colors ${
              darkSurface ? 'hover:bg-white/15' : 'hover:bg-slate-100'
            }`}
            title="تحريك لأعلى"
          >
            <ChevronUp size={12} />
          </button>
          <button
            type="button"
            disabled={idx === total - 1}
            onClick={() => moveBoardItem(board.id, item.id, 1)}
            className={`p-1 rounded disabled:opacity-25 transition-colors ${
              darkSurface ? 'hover:bg-white/15' : 'hover:bg-slate-100'
            }`}
            title="تحريك لأسفل"
          >
            <ChevronDown size={12} />
          </button>
          <button
            type="button"
            onClick={() => removeBoardItem(board.id, item.id)}
            className={`p-1 rounded transition-colors ${
              darkSurface ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-50'
            }`}
            title="حذف الصنف"
          >
            <Trash2 size={12} />
          </button>
        </div>
      );
    };

    const renderInlineAddFooter = (darkSurface = false) => {
      if (!canEdit || board.items.length === 0) return null;
      return (
        <div
          onClick={(e) => e.stopPropagation()}
          className="pt-2.5 mt-1 flex items-center justify-center gap-2 relative z-10 shrink-0"
        >
          <button
            type="button"
            onClick={() => addManualItemToBoard(board.id)}
            className={`px-3 py-1 rounded-lg border border-dashed text-[11px] font-black flex items-center gap-1.5 transition-colors ${
              darkSurface
                ? 'border-white/25 text-white/85 hover:border-white/65 hover:bg-white/10'
                : 'border-slate-300 text-slate-600 hover:border-sap-primary hover:text-sap-primary hover:bg-white/90'
            }`}
          >
            <Plus size={13} />
            <span>إضافة صنف يدوي</span>
          </button>
          <button
            type="button"
            onClick={() => openCatalogForBoard(board.id)}
            className={`px-3 py-1 rounded-lg border text-[11px] font-black flex items-center gap-1.5 transition-colors ${
              darkSurface
                ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                : 'border-slate-200 bg-white/95 text-slate-700 hover:border-sap-primary hover:text-sap-primary'
            }`}
          >
            <ShoppingBag size={12} />
            <span>من المتجر</span>
          </button>
        </div>
      );
    };

    const renderEmptyState = (darkSurface = false) => (
      <div className="h-full min-h-[240px] flex flex-col items-center justify-center col-span-full">
        <Boxes
          size={52}
          className="mb-3 opacity-35"
          style={{ color: s.primaryColor }}
        />
        <p className="font-black text-xl opacity-55" style={{ color: s.textColor }}>
          الشاشة فارغة حالياً
        </p>
        <p className="font-bold text-xs mt-1 opacity-45" style={{ color: s.textColor }}>
          {canEdit
            ? 'أضف أول صنف مباشرة من هنا أو استورد منتجاتك من المتجر'
            : 'أضف منتجات من المتجر أو أنشئ أصنافاً يدوية'}
        </p>
        {canEdit && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2.5 mt-4"
          >
            <button
              type="button"
              onClick={() => addManualItemToBoard(board.id)}
              className="px-3.5 py-2 rounded-lg text-white text-xs font-black flex items-center gap-1.5 shadow-sm hover:opacity-95 transition-opacity"
              style={{ backgroundColor: s.primaryColor }}
            >
              <Plus size={14} />
              <span>إضافة صنف يدوي</span>
            </button>
            <button
              type="button"
              onClick={() => openCatalogForBoard(board.id)}
              className={`px-3.5 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                darkSurface
                  ? 'border-white/25 bg-white/10 text-white hover:bg-white/20'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-sap-primary hover:text-sap-primary'
              }`}
            >
              <ShoppingBag size={14} />
              <span>استيراد من المتجر</span>
            </button>
          </div>
        )}
      </div>
    );

    const renderTickerAndClockBar = (darkSurface = false) => {
      if (!s.showClock && !s.showTicker && !s.showBoardFooter) return null;
      return (
        <div
          className="mt-auto pt-3 border-t flex items-center justify-between gap-4 relative z-10 shrink-0"
          style={{
            borderColor: darkSurface ? 'rgba(255,255,255,0.12)' : `${s.primaryColor}22`,
          }}
        >
          {s.showTicker && s.tickerText ? (
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <span
                className="px-2 py-0.5 rounded text-[11px] font-black text-white shrink-0"
                style={{ backgroundColor: s.primaryColor }}
              >
                إعلان
              </span>
              <p
                className="font-bold truncate"
                style={{
                  fontSize: `${Math.max(12, 13.5 * scale)}px`,
                  color: s.textColor,
                }}
              >
                {s.tickerText}
              </p>
            </div>
          ) : (
            <div
              className="text-[11px] font-bold opacity-65 truncate"
              style={{ color: s.textColor }}
            >
              {s.showBoardFooter !== false
                ? board.subtitle || 'الأسعار شاملة ضريبة القيمة المضافة'
                : ''}
            </div>
          )}

          {s.showClock && aspectMode !== 'a4_landscape' && (
            <div
              className="flex items-center gap-1.5 font-black tabular-nums font-mono shrink-0 opacity-85"
              style={{
                fontSize: `${Math.max(13, 15 * scale)}px`,
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

    // Theme 1: dark_menu_board (منيو شاشات داكن - مطاعم وكافيهات TV)
    if (themeId === 'dark_menu_board') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden"
          style={{
            padding: `${s.padding * scale}px`,
            backgroundColor: s.backgroundColor || '#0f172a',
            border: `${s.borderWidth * scale}px solid ${s.borderColor || '#334155'}`,
            borderTop: `${Math.max(6, s.borderWidth * scale * 1.3)}px solid ${s.primaryColor}`,
          }}
        >
          <div className="flex items-center justify-between gap-4 pb-4 mb-5 border-b border-white/15 shrink-0">
            <div className="min-w-0 flex-1">
              {renderTitle(
                'font-black tracking-tight leading-tight text-balance',
                { fontSize: `${s.titleFontSize * scale}px`, color: s.primaryColor },
                true
              )}
              {renderSubtitle(
                'font-semibold mt-1 opacity-75',
                {
                  fontSize: `${Math.max(12, s.itemFontSize * scale * 0.65)}px`,
                  color: s.textColor,
                },
                true
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
            className={`flex-1 grid ${gridColsClass} gap-x-8 gap-y-2.5 content-start overflow-hidden`}
          >
            {board.items.length === 0 ? (
              renderEmptyState(true)
            ) : (
              board.items.map((item, idx) => (
                <div
                  key={item.id}
                  className={`group/row flex items-center justify-between gap-3 py-2.5 px-3.5 rounded-lg border transition-colors ${
                    item.isOffer
                      ? 'border-amber-400/45 bg-amber-500/10'
                      : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        {renderItemLabel(
                          item,
                          'font-bold break-words',
                          {
                            fontSize: `${s.itemFontSize * scale}px`,
                            color: s.textColor,
                            lineHeight: 1.3,
                          },
                          true
                        )}
                      </div>
                      {renderItemBadge(
                        item,
                        'px-2 py-0.5 rounded text-[10px] font-black text-slate-950 shrink-0',
                        { backgroundColor: s.primaryColor },
                        'عرض'
                      )}
                    </div>
                    {renderItemUnit(
                      item,
                      'text-xs opacity-65 font-medium mt-0.5',
                      { color: s.textColor },
                      true
                    )}
                  </div>
                  {renderRowHoverActions(item, idx, board.items.length, true)}
                  {renderPriceBlock(item, s, scale, {
                    priceColorOverride: item.isOffer ? '#fb923c' : s.priceColor,
                    currencyColorOverride: s.textColor,
                    fontMono: true,
                    boardId: board.id,
                    canEdit,
                    darkSurface: true,
                  })}
                </div>
              ))
            )}
          </div>

          {renderInlineAddFooter(true)}
          {renderTickerAndClockBar(true)}
        </div>
      );
    }

    // Theme 2: neon_promo_tv (عروض TV جريئة)
    if (themeId === 'neon_promo_tv') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden"
          style={{
            padding: `${s.padding * scale}px`,
            backgroundColor: s.backgroundColor || '#0b0f19',
            border: `${s.borderWidth * scale}px solid ${s.primaryColor}`,
          }}
        >
          <div
            className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl mb-5 shrink-0"
            style={{ backgroundColor: s.primaryColor }}
          >
            <div className="min-w-0 flex-1">
              {renderTitle(
                'font-black text-white leading-tight text-balance',
                { fontSize: `${s.titleFontSize * scale}px` },
                true
              )}
              {renderSubtitle('text-white/90 font-bold text-sm mt-1', undefined, true)}
            </div>
            {showLogo && logoUrl && (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-12' : 'h-16'} object-contain bg-white/95 p-1.5 rounded-lg shrink-0`}
              />
            )}
          </div>

          <div
            className={`flex-1 grid ${
              cols === 1 ? 'grid-cols-2' : gridColsClass
            } gap-3.5 content-start overflow-hidden`}
          >
            {board.items.length === 0 ? (
              renderEmptyState(true)
            ) : (
              board.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="group/row rounded-xl border overflow-hidden flex flex-col justify-between bg-white/[0.05]"
                  style={{
                    borderColor: item.isOffer ? s.secondaryColor : 'rgba(255,255,255,0.14)',
                  }}
                >
                  <div className="p-3.5 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {renderItemLabel(
                        item,
                        'font-black break-words',
                        {
                          fontSize: `${s.itemFontSize * scale}px`,
                          color: s.textColor,
                          lineHeight: 1.3,
                        },
                        true
                      )}
                      {renderItemUnit(
                        item,
                        'text-xs opacity-70 font-semibold mt-1',
                        { color: s.textColor },
                        true
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {renderRowHoverActions(item, idx, board.items.length, true)}
                      {renderItemBadge(
                        item,
                        'px-2 py-0.5 rounded text-[10px] font-black text-slate-950 shrink-0',
                        { backgroundColor: s.secondaryColor || '#facc15' },
                        'عرض'
                      )}
                    </div>
                  </div>
                  <div
                    className="px-3.5 py-2 flex justify-end border-t"
                    style={{
                      borderColor: 'rgba(255,255,255,0.1)',
                      backgroundColor: item.isOffer ? `${s.primaryColor}30` : 'rgba(0,0,0,0.22)',
                    }}
                  >
                    {renderPriceBlock(item, s, scale, {
                      priceColorOverride: s.priceColor || '#facc15',
                      currencyColorOverride: s.textColor,
                      fontMono: true,
                      boardId: board.id,
                      canEdit,
                      darkSurface: true,
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {renderInlineAddFooter(true)}
          {renderTickerAndClockBar(true)}
        </div>
      );
    }

    // Theme 3: cafe_artisan (كافيه ومخبوزات)
    if (themeId === 'cafe_artisan') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden"
          style={{
            padding: `${s.padding * scale}px`,
            backgroundColor: s.backgroundColor || '#1c1917',
            border: `${s.borderWidth * scale}px solid ${s.borderColor || '#44403c'}`,
          }}
        >
          <div
            className="flex items-center justify-between gap-4 pb-4 mb-5 border-b-2 shrink-0"
            style={{ borderColor: s.primaryColor }}
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${s.primaryColor}22`, color: s.primaryColor }}
              >
                <Coffee size={24 * scale} />
              </div>
              <div className="min-w-0 flex-1">
                {renderTitle(
                  'font-black leading-tight text-balance',
                  { fontSize: `${s.titleFontSize * scale}px`, color: s.primaryColor },
                  true
                )}
                {renderSubtitle(
                  'font-semibold opacity-80 mt-0.5',
                  {
                    fontSize: `${Math.max(12, s.itemFontSize * scale * 0.65)}px`,
                    color: s.textColor,
                  },
                  true
                )}
              </div>
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
              renderEmptyState(true)
            ) : (
              board.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="group/row flex items-baseline gap-3 py-2 border-b"
                  style={{ borderColor: 'rgba(254,243,199,0.1)' }}
                >
                  <div className="min-w-0 max-w-[58%] flex-1">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        {renderItemLabel(
                          item,
                          'font-bold break-words',
                          { fontSize: `${s.itemFontSize * scale}px`, color: s.textColor },
                          true
                        )}
                      </div>
                      {renderItemBadge(
                        item,
                        'px-1.5 py-0.5 rounded text-[10px] font-black text-stone-950 shrink-0',
                        { backgroundColor: s.primaryColor },
                        'مميز'
                      )}
                    </div>
                    {renderItemUnit(
                      item,
                      'text-xs opacity-65 mt-0.5',
                      { color: s.textColor },
                      true
                    )}
                  </div>
                  <div
                    className="flex-1 border-b border-dotted opacity-35 min-w-[20px]"
                    style={{ borderColor: s.primaryColor }}
                  />
                  {renderRowHoverActions(item, idx, board.items.length, true)}
                  {renderPriceBlock(item, s, scale, {
                    priceColorOverride: s.priceColor || '#fbbf24',
                    currencyColorOverride: s.textColor,
                    fontMono: true,
                    boardId: board.id,
                    canEdit,
                    darkSurface: true,
                  })}
                </div>
              ))
            )}
          </div>

          {renderInlineAddFooter(true)}
          {renderTickerAndClockBar(true)}
        </div>
      );
    }

    // Theme 4: electronics_sleek (إلكترونيات وتقنية)
    if (themeId === 'electronics_sleek') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden"
          style={{
            padding: `${s.padding * scale}px`,
            backgroundColor: s.backgroundColor || '#09090b',
            border: `${s.borderWidth * scale}px solid ${s.borderColor || '#27272a'}`,
          }}
        >
          {s.showGeometricPattern !== false && (
            <div
              className="absolute inset-0 opacity-[0.06] pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(${s.secondaryColor || '#38bdf8'} 1px, transparent 1px)`,
                backgroundSize: '20px 20px',
              }}
            />
          )}

          <div
            className="flex items-center justify-between gap-4 pb-4 mb-5 border-b relative z-10 shrink-0"
            style={{ borderColor: 'rgba(255,255,255,0.12)' }}
          >
            <div className="min-w-0 flex-1">
              {renderTitle(
                'font-black tracking-tight leading-tight text-balance',
                { fontSize: `${s.titleFontSize * scale}px`, color: s.textColor },
                true
              )}
              {renderSubtitle(
                'font-semibold mt-1',
                {
                  fontSize: `${Math.max(12, s.itemFontSize * scale * 0.65)}px`,
                  color: s.secondaryColor || '#38bdf8',
                },
                true
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
            className={`flex-1 grid ${
              cols === 1 ? 'grid-cols-2' : gridColsClass
            } gap-3 relative z-10 content-start overflow-hidden`}
          >
            {board.items.length === 0 ? (
              renderEmptyState(true)
            ) : (
              board.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="group/row p-3.5 rounded-lg border bg-zinc-900/80 flex flex-col justify-between"
                  style={{
                    borderColor: item.isOffer ? s.primaryColor : 'rgba(255,255,255,0.1)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="min-w-0 flex-1">
                      {renderItemLabel(
                        item,
                        'font-bold leading-snug break-words',
                        {
                          fontSize: `${s.itemFontSize * scale * 0.92}px`,
                          color: s.textColor,
                        },
                        true
                      )}
                      {renderItemUnit(
                        item,
                        'text-[11px] font-mono text-zinc-400 mt-0.5',
                        undefined,
                        true
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {renderRowHoverActions(item, idx, board.items.length, true)}
                      {renderItemBadge(
                        item,
                        'px-2 py-0.5 rounded text-[10px] font-black text-white shrink-0',
                        { backgroundColor: s.primaryColor },
                        'عرض'
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end pt-2 border-t border-zinc-800">
                    {renderPriceBlock(item, s, scale, {
                      priceColorOverride: s.priceColor || '#38bdf8',
                      currencyColorOverride: s.textColor,
                      fontMono: true,
                      boardId: board.id,
                      canEdit,
                      darkSurface: true,
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {renderInlineAddFooter(true)}
          {renderTickerAndClockBar(true)}
        </div>
      );
    }

    // Theme 5: butcher_frozen (مجمدات ولحوم ودواجن)
    if (themeId === 'butcher_frozen') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden"
          style={{
            padding: `${s.padding * scale}px`,
            backgroundColor: s.backgroundColor || '#f0f9ff',
            border: `${s.borderWidth * scale}px solid ${s.borderColor || '#0284c7'}`,
          }}
        >
          <div
            className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl mb-5 shrink-0 text-white"
            style={{ backgroundColor: s.primaryColor || '#0c2340' }}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 bg-white/15"
                style={{ color: '#bae6fd' }}
              >
                <Snowflake size={22 * scale} />
              </div>
              <div className="min-w-0 flex-1">
                {renderTitle(
                  'font-black leading-tight text-balance',
                  { fontSize: `${s.titleFontSize * scale}px` },
                  true
                )}
                {renderSubtitle('text-sky-100/85 font-semibold text-xs mt-0.5', undefined, true)}
              </div>
            </div>
            {showLogo && logoUrl && (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-11' : 'h-14'} object-contain bg-white p-1 rounded-lg shrink-0`}
              />
            )}
          </div>

          <div
            className={`flex-1 grid ${gridColsClass} gap-2.5 content-start overflow-hidden`}
          >
            {board.items.length === 0 ? (
              renderEmptyState(false)
            ) : (
              board.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="group/row flex items-center justify-between gap-3 bg-white px-4 py-2.5 rounded-lg border"
                  style={{
                    borderColor: item.isOffer ? '#ef4444' : '#bae6fd',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        {renderItemLabel(
                          item,
                          'font-extrabold break-words',
                          {
                            fontSize: `${s.itemFontSize * scale}px`,
                            color: s.textColor,
                            lineHeight: 1.3,
                          },
                          false
                        )}
                      </div>
                      {renderItemBadge(
                        item,
                        'px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-black shrink-0',
                        undefined,
                        'عرض'
                      )}
                    </div>
                    {renderItemUnit(
                      item,
                      'text-xs font-semibold text-sky-700/80 mt-0.5',
                      undefined,
                      false
                    )}
                  </div>
                  {renderRowHoverActions(item, idx, board.items.length, false)}
                  <div className="shrink-0 pl-1">
                    {renderPriceBlock(item, s, scale, {
                      fontMono: true,
                      boardId: board.id,
                      canEdit,
                      darkSurface: false,
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {renderInlineAddFooter(false)}
          {renderTickerAndClockBar(false)}
        </div>
      );
    }

    // Theme 6: wholesale_ledger (جملة ومستودعات - جدول مؤسسي عالي الكثافة)
    if (themeId === 'wholesale_ledger') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden bg-white"
          style={{
            padding: `${s.padding * scale}px`,
            backgroundColor: s.backgroundColor || '#ffffff',
            border: `${s.borderWidth * scale}px solid ${s.borderColor || '#cbd5e1'}`,
          }}
        >
          <div
            className="flex items-center justify-between gap-4 pb-3.5 mb-4 border-b-2 shrink-0"
            style={{ borderColor: s.primaryColor }}
          >
            <div className="min-w-0 flex-1">
              {renderTitle(
                'font-black leading-tight text-balance',
                { fontSize: `${s.titleFontSize * scale}px`, color: s.primaryColor },
                false
              )}
              {renderSubtitle(
                'font-semibold opacity-70 mt-0.5',
                {
                  fontSize: `${Math.max(12, s.itemFontSize * scale * 0.62)}px`,
                  color: s.textColor,
                },
                false
              )}
            </div>
            {showLogo && logoUrl && (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-11' : 'h-14'} object-contain shrink-0`}
              />
            )}
          </div>

          {board.items.length === 0 ? (
            renderEmptyState(false)
          ) : (
            <div
              className="flex-1 rounded-lg border overflow-hidden flex flex-col"
              style={{ borderColor: '#e2e8f0' }}
            >
              {cols === 1 && (
                <div
                  className="px-4 py-2 text-[11px] font-black text-white flex items-center justify-between shrink-0"
                  style={{ backgroundColor: s.primaryColor }}
                >
                  <span>الصنف والوحدة</span>
                  <span>السعر الصافي</span>
                </div>
              )}
              <div
                className={`flex-1 grid ${gridColsClass} divide-y divide-slate-200/80 content-start overflow-hidden`}
              >
                {board.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`group/row flex items-center justify-between gap-3 px-4 py-2 ${
                      idx % 2 === 1 ? 'bg-slate-50/90' : 'bg-white'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          {renderItemLabel(
                            item,
                            'font-bold break-words',
                            {
                              fontSize: `${s.itemFontSize * scale}px`,
                              color: s.textColor,
                            },
                            false
                          )}
                        </div>
                        {renderItemUnit(
                          item,
                          'text-xs font-semibold text-slate-500 shrink-0',
                          undefined,
                          false,
                          true
                        )}
                        {renderItemBadge(
                          item,
                          'px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-black shrink-0',
                          undefined,
                          'عرض'
                        )}
                      </div>
                    </div>
                    {renderRowHoverActions(item, idx, board.items.length, false)}
                    {renderPriceBlock(item, s, scale, {
                      fontMono: true,
                      boardId: board.id,
                      canEdit,
                      darkSurface: false,
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {renderInlineAddFooter(false)}
          {renderTickerAndClockBar(false)}
        </div>
      );
    }

    // Theme 7: minimal_kiosk (كيوسك حديث)
    if (themeId === 'minimal_kiosk') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden"
          style={{
            padding: `${s.padding * scale}px`,
            backgroundColor: s.backgroundColor || '#f8fafc',
            border: `${s.borderWidth * scale}px solid ${s.borderColor || '#e2e8f0'}`,
          }}
        >
          <div
            className="flex items-center justify-between gap-4 pb-4 mb-5 border-b-2 shrink-0"
            style={{ borderColor: s.primaryColor }}
          >
            <div className="flex items-center gap-4 min-w-0 flex-1">
              {showLogo && logoUrl && (
                <img
                  src={logoUrl}
                  alt="شعار المتجر"
                  referrerPolicy="no-referrer"
                  className={`${isSmall ? 'h-12' : 'h-16'} object-contain shrink-0`}
                />
              )}
              <div className="min-w-0 flex-1">
                {renderTitle(
                  'font-black tracking-tight text-balance',
                  { fontSize: `${s.titleFontSize * scale}px`, color: s.textColor },
                  false
                )}
                {renderSubtitle(
                  'font-semibold opacity-65 mt-0.5',
                  {
                    fontSize: `${Math.max(12, s.itemFontSize * scale * 0.65)}px`,
                    color: s.textColor,
                  },
                  false
                )}
              </div>
            </div>
            {s.showClock && (
              <div
                className="px-3.5 py-1.5 rounded-lg font-black tabular-nums font-mono text-white shrink-0"
                style={{
                  backgroundColor: s.primaryColor,
                  fontSize: `${Math.max(13, 16 * scale)}px`,
                }}
              >
                {timeStr}
              </div>
            )}
          </div>

          <div
            className={`flex-1 grid ${gridColsClass} gap-2.5 content-start overflow-hidden`}
          >
            {board.items.length === 0 ? (
              renderEmptyState(false)
            ) : (
              board.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="group/row flex items-center justify-between gap-4 bg-white px-4 py-3 rounded-lg border border-slate-200/90"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        {renderItemLabel(
                          item,
                          'font-extrabold break-words',
                          {
                            fontSize: `${s.itemFontSize * scale}px`,
                            color: s.textColor,
                            lineHeight: 1.35,
                          },
                          false
                        )}
                      </div>
                      {renderItemBadge(
                        item,
                        'px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-black shrink-0',
                        undefined,
                        'عرض'
                      )}
                    </div>
                    {renderItemUnit(
                      item,
                      'text-xs font-medium text-slate-500 mt-0.5',
                      undefined,
                      false
                    )}
                  </div>
                  {renderRowHoverActions(item, idx, board.items.length, false)}
                  {renderPriceBlock(item, s, scale, {
                    fontMono: true,
                    boardId: board.id,
                    canEdit,
                    darkSurface: false,
                  })}
                </div>
              ))
            )}
          </div>

          {renderInlineAddFooter(false)}
          {renderTickerAndClockBar(false)}
        </div>
      );
    }

    // Theme 8: geometric_luxe (الحديث النظيف)
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
          {s.showGeometricPattern !== false && (
            <div
              className="absolute inset-3 border pointer-events-none opacity-25"
              style={{ borderColor: s.secondaryColor }}
            />
          )}
          <div
            className="flex flex-col items-center mb-5 pb-4 border-b relative z-10 shrink-0"
            style={{ borderColor: `${s.secondaryColor}45` }}
          >
            {showLogo && logoUrl ? (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-12' : 'h-18'} object-contain mb-3`}
              />
            ) : null}
            <div className="w-full max-w-[90%]">
              {renderTitle(
                'font-black text-center tracking-tight text-balance',
                { fontSize: `${s.titleFontSize * scale * 1.02}px`, color: s.textColor },
                false
              )}
              {renderSubtitle(
                'font-semibold opacity-65 mt-1 text-center',
                {
                  fontSize: `${Math.max(12, s.itemFontSize * scale * 0.65)}px`,
                  color: s.textColor,
                },
                false
              )}
            </div>
          </div>
          <div
            className={`flex-1 grid ${gridColsClass} gap-x-8 gap-y-2 content-start overflow-hidden relative z-10`}
          >
            {board.items.length === 0 ? (
              renderEmptyState(false)
            ) : (
              board.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="group/row flex items-center justify-between py-2.5 px-2 border-b gap-3"
                  style={{ borderColor: 'rgba(15,23,42,0.08)' }}
                >
                  <div className="flex-1 min-w-0 pl-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        {renderItemLabel(
                          item,
                          'font-bold break-words',
                          {
                            fontSize: `${s.itemFontSize * scale}px`,
                            color: s.textColor,
                            lineHeight: 1.35,
                          },
                          false
                        )}
                      </div>
                      {renderItemBadge(
                        item,
                        'px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-black shrink-0',
                        undefined,
                        'عرض خاص'
                      )}
                    </div>
                    {renderItemUnit(
                      item,
                      'text-xs opacity-60 font-medium block mt-0.5',
                      { color: s.textColor },
                      false
                    )}
                  </div>
                  {renderRowHoverActions(item, idx, board.items.length, false)}
                  {renderPriceBlock(item, s, scale, {
                    fontMono: true,
                    boardId: board.id,
                    canEdit,
                    darkSurface: false,
                  })}
                </div>
              ))
            )}
          </div>
          {renderInlineAddFooter(false)}
          {renderTickerAndClockBar(false)}
        </div>
      );
    }

    // Theme 9: modern_grid (الشبكة التقنية)
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
          {s.showGeometricPattern !== false && (
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{
                backgroundImage: `linear-gradient(${s.primaryColor} 1px, transparent 1px), linear-gradient(90deg, ${s.primaryColor} 1px, transparent 1px)`,
                backgroundSize: '28px 28px',
              }}
            />
          )}
          <div
            className="flex justify-between items-end gap-4 mb-5 border-b-2 pb-3.5 relative z-10 shrink-0"
            style={{ borderColor: s.primaryColor }}
          >
            <div className="min-w-0 flex-1">
              <div
                className="px-5 py-2 inline-block rounded-md max-w-full"
                style={{ backgroundColor: s.primaryColor }}
              >
                {renderTitle(
                  'font-black text-white tracking-tight',
                  { fontSize: `${s.titleFontSize * scale * 0.85}px` },
                  true
                )}
              </div>
              {renderSubtitle(
                'text-xs font-bold opacity-65 mt-1.5',
                { color: s.textColor },
                false
              )}
            </div>
            {showLogo && logoUrl ? (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-12' : 'h-16'} object-contain shrink-0`}
              />
            ) : null}
          </div>
          <div
            className={`flex-1 grid ${
              cols === 1 ? 'grid-cols-2' : gridColsClass
            } gap-3.5 relative z-10 content-start overflow-hidden`}
          >
            {board.items.length === 0 ? (
              renderEmptyState(false)
            ) : (
              board.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="group/row border p-3.5 flex flex-col justify-between bg-white rounded-lg"
                  style={{ borderColor: item.isOffer ? '#ef4444' : '#cbd5e1' }}
                >
                  <div className="flex justify-between items-start gap-2 mb-2.5">
                    <div className="min-w-0 flex-1">
                      {renderItemLabel(
                        item,
                        'font-bold leading-snug break-words',
                        {
                          fontSize: `${s.itemFontSize * scale * 0.9}px`,
                          color: s.textColor,
                        },
                        false
                      )}
                      {renderItemUnit(
                        item,
                        'text-xs opacity-60 font-medium mt-0.5',
                        { color: s.textColor },
                        false
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {renderRowHoverActions(item, idx, board.items.length, false)}
                      {renderItemBadge(
                        item,
                        'bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded shrink-0',
                        undefined,
                        'عرض'
                      )}
                    </div>
                  </div>
                  <div
                    className="flex justify-end mt-auto pt-2.5 border-t"
                    style={{ borderColor: 'rgba(15,23,42,0.08)' }}
                  >
                    {renderPriceBlock(item, s, scale, {
                      fontMono: true,
                      boardId: board.id,
                      canEdit,
                      darkSurface: false,
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          {renderInlineAddFooter(false)}
          {renderTickerAndClockBar(false)}
        </div>
      );
    }

    // Theme 10: royal_minimal (الكلاسيكي الفاخر)
    if (themeId === 'royal_minimal') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden rounded-[1.25rem]"
          style={{
            padding: `${s.padding * scale}px`,
            border: `${s.borderWidth * scale}px double ${s.borderColor || s.primaryColor}`,
            backgroundColor: s.backgroundColor,
          }}
        >
          <div className="flex flex-col items-center mb-6 relative z-10 shrink-0">
            {showLogo && logoUrl ? (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-12' : 'h-18'} object-contain mb-3`}
              />
            ) : null}
            <div className="w-full max-w-[90%]">
              {renderTitle(
                'font-black text-center text-balance',
                { fontSize: `${s.titleFontSize * scale * 1.02}px`, color: s.textColor },
                false
              )}
              {renderSubtitle(
                'font-semibold opacity-70 mt-1 text-center',
                {
                  fontSize: `${Math.max(12, s.itemFontSize * scale * 0.65)}px`,
                  color: s.textColor,
                },
                false
              )}
            </div>
            <div className="flex items-center gap-3 mt-3 w-1/2 mx-auto opacity-75">
              <div className="h-[1.5px] flex-1" style={{ backgroundColor: s.secondaryColor }} />
              <div className="w-2.5 h-2.5 rotate-45" style={{ backgroundColor: s.primaryColor }} />
              <div className="h-[1.5px] flex-1" style={{ backgroundColor: s.secondaryColor }} />
            </div>
          </div>
          <div className={`flex-1 grid ${gridColsClass} gap-x-8 gap-y-4 px-3 relative z-10 content-start overflow-hidden`}>
            {board.items.length === 0 ? (
              renderEmptyState(false)
            ) : (
              board.items.map((item, idx) => (
                <div key={item.id} className="group/row flex items-baseline w-full gap-3">
                  <div className="min-w-0 max-w-[58%] flex items-baseline gap-1.5 flex-1">
                    <div className="min-w-0 flex-1">
                      {renderItemLabel(
                        item,
                        'font-bold break-words',
                        { fontSize: `${s.itemFontSize * scale}px`, color: s.textColor },
                        false
                      )}
                    </div>
                    {renderItemUnit(
                      item,
                      'text-xs opacity-60 font-semibold shrink-0',
                      { color: s.textColor },
                      false,
                      true
                    )}
                  </div>
                  <div
                    className="flex-1 border-b-2 border-dotted opacity-40 min-w-[20px]"
                    style={{ borderColor: s.secondaryColor }}
                  />
                  {renderRowHoverActions(item, idx, board.items.length, false)}
                  {renderPriceBlock(item, s, scale, {
                    boardId: board.id,
                    canEdit,
                    darkSurface: false,
                  })}
                </div>
              ))
            )}
          </div>
          {renderInlineAddFooter(false)}
          {renderTickerAndClockBar(false)}
        </div>
      );
    }

    // Theme 11: digital_punch (العروض القوية - شريط أسعار بارز بدون صناديق متداخلة)
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
            className="flex justify-between items-center mb-5 px-6 py-4 rounded-xl shrink-0 gap-4"
            style={{ backgroundColor: s.primaryColor }}
          >
            <div className="min-w-0 flex-1">
              {renderTitle(
                'font-black text-white leading-tight text-balance',
                { fontSize: `${s.titleFontSize * scale * 1.05}px` },
                true
              )}
              {renderSubtitle('text-white/90 font-bold text-sm mt-1', undefined, true)}
            </div>
            {showLogo && logoUrl ? (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-12' : 'h-16'} object-contain bg-white/95 p-1.5 rounded-lg shrink-0`}
              />
            ) : null}
          </div>
          <div className={`flex-1 grid ${gridColsClass} gap-3 content-start overflow-hidden`}>
            {board.items.length === 0 ? (
              renderEmptyState(false)
            ) : (
              board.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="group/row flex items-stretch justify-between border-2 rounded-xl overflow-hidden bg-white"
                  style={{ borderColor: item.isOffer ? '#ef4444' : `${s.primaryColor}45` }}
                >
                  <div className="flex-1 min-w-0 px-4 py-3 flex flex-col justify-center">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        {renderItemLabel(
                          item,
                          'font-black break-words',
                          {
                            fontSize: `${s.itemFontSize * scale * 1.02}px`,
                            color: s.textColor,
                          },
                          false
                        )}
                      </div>
                      {renderItemBadge(
                        item,
                        'px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-black shrink-0',
                        undefined,
                        'عرض'
                      )}
                    </div>
                    {renderItemUnit(
                      item,
                      'text-xs font-semibold text-slate-500 mt-0.5',
                      undefined,
                      false
                    )}
                  </div>
                  <div className="flex items-center px-1.5">
                    {renderRowHoverActions(item, idx, board.items.length, false)}
                  </div>
                  <div
                    className="px-4 py-2.5 flex items-center justify-center shrink-0 border-r"
                    style={{
                      backgroundColor: `${s.primaryColor}10`,
                      borderColor: `${s.primaryColor}25`,
                    }}
                  >
                    {renderPriceBlock(item, s, scale, {
                      priceBoost: 1.1,
                      fontMono: true,
                      boardId: board.id,
                      canEdit,
                      darkSurface: false,
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          {renderInlineAddFooter(false)}
          {renderTickerAndClockBar(false)}
        </div>
      );
    }

    // Theme 12: abstract_gradient (الناعم العضوي)
    if (themeId === 'abstract_gradient') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden rounded-[1.5rem]"
          style={{
            padding: `${s.padding * scale}px`,
            background: `linear-gradient(135deg, ${s.backgroundColor}, ${s.primaryColor}18)`,
          }}
        >
          <div className="flex justify-between items-center mb-5 relative z-10 shrink-0 gap-4">
            <div className="min-w-0 flex-1">
              {renderTitle(
                'font-black tracking-tight text-balance',
                { fontSize: `${s.titleFontSize * scale}px`, color: s.textColor },
                false
              )}
              {renderSubtitle(
                'text-xs font-semibold opacity-75 mt-1',
                { color: s.textColor },
                false
              )}
              <div className="w-16 h-1 rounded-full mt-2" style={{ backgroundColor: s.primaryColor }} />
            </div>
            {showLogo && logoUrl ? (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-12' : 'h-16'} object-contain shrink-0`}
              />
            ) : null}
          </div>
          <div className={`flex-1 grid ${gridColsClass} gap-2.5 relative z-10 content-start overflow-hidden`}>
            {board.items.length === 0 ? (
              renderEmptyState(false)
            ) : (
              board.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="group/row flex items-center justify-between gap-4 bg-white/90 px-4 py-3 rounded-xl border"
                  style={{ borderColor: `${s.primaryColor}20` }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        {renderItemLabel(
                          item,
                          'font-bold break-words',
                          { fontSize: `${s.itemFontSize * scale}px`, color: s.textColor },
                          false
                        )}
                      </div>
                      {renderItemBadge(
                        item,
                        'px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black shrink-0',
                        undefined,
                        'عرض'
                      )}
                    </div>
                    {renderItemUnit(
                      item,
                      'text-xs opacity-65 font-medium mt-0.5',
                      { color: s.textColor },
                      false
                    )}
                  </div>
                  {renderRowHoverActions(item, idx, board.items.length, false)}
                  {renderPriceBlock(item, s, scale, {
                    fontMono: true,
                    boardId: board.id,
                    canEdit,
                    darkSurface: false,
                  })}
                </div>
              ))
            )}
          </div>
          {renderInlineAddFooter(false)}
          {renderTickerAndClockBar(false)}
        </div>
      );
    }

    // Theme 13: ramadan_vibes (رمضاني ومواسم - بدون تكرار أيقونة النجمة في كل صف)
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
          <div className="flex flex-col items-center mb-5 relative z-10 shrink-0">
            {showLogo && logoUrl ? (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-12' : 'h-16'} object-contain mb-2.5`}
              />
            ) : null}
            <div
              className="px-8 py-2.5 border-y-2 flex items-center gap-3 max-w-[90%]"
              style={{ borderColor: s.secondaryColor }}
            >
              <Moon size={20 * scale} fill={s.secondaryColor} color={s.secondaryColor} className="shrink-0" />
              {renderTitle(
                'font-black text-center text-balance',
                { fontSize: `${s.titleFontSize * scale}px`, color: s.textColor },
                false,
                'min-w-[140px] flex-1'
              )}
            </div>
            <div className="w-full max-w-[80%]">
              {renderSubtitle(
                'font-semibold opacity-75 mt-1.5 text-center',
                {
                  fontSize: `${Math.max(12, s.itemFontSize * scale * 0.65)}px`,
                  color: s.textColor,
                },
                false
              )}
            </div>
          </div>

          <div className={`flex-1 grid ${gridColsClass} gap-x-8 gap-y-2 relative z-10 content-start overflow-hidden`}>
            {board.items.length === 0 ? (
              renderEmptyState(false)
            ) : (
              board.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="group/row flex items-center justify-between gap-3 py-2.5 px-2 border-b border-dashed"
                  style={{ borderColor: `${s.primaryColor}35` }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        {renderItemLabel(
                          item,
                          'font-bold break-words',
                          { fontSize: `${s.itemFontSize * scale}px`, color: s.textColor },
                          false
                        )}
                      </div>
                      {renderItemBadge(
                        item,
                        'px-2 py-0.5 rounded text-[10px] font-black text-white shrink-0',
                        { backgroundColor: s.primaryColor },
                        'عرض'
                      )}
                    </div>
                    {renderItemUnit(
                      item,
                      'text-xs opacity-65 font-medium mt-0.5',
                      { color: s.textColor },
                      false
                    )}
                  </div>
                  {renderRowHoverActions(item, idx, board.items.length, false)}
                  {renderPriceBlock(item, s, scale, {
                    boardId: board.id,
                    canEdit,
                    darkSurface: false,
                  })}
                </div>
              ))
            )}
          </div>
          {renderInlineAddFooter(false)}
          {renderTickerAndClockBar(false)}
        </div>
      );
    }

    // Theme 14: super_market (سوبر ماركت - شريط سعر سفلي مدمج بدون تداخل)
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
            className="flex justify-between items-center mb-4 px-5 py-3.5 rounded-xl relative z-10 shrink-0 gap-4"
            style={{
              backgroundImage: `linear-gradient(to left, ${s.primaryColor}, ${s.secondaryColor})`,
              backgroundColor: s.primaryColor,
            }}
          >
            <div className="min-w-0 flex-1">
              {renderTitle(
                'font-black text-white text-balance',
                { fontSize: `${s.titleFontSize * scale}px` },
                true
              )}
              {renderSubtitle('text-white/90 font-bold text-xs mt-0.5', undefined, true)}
            </div>
            {showLogo && logoUrl ? (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-11' : 'h-15'} object-contain bg-white p-1.5 rounded-lg shrink-0`}
              />
            ) : null}
          </div>

          <div
            className={`flex-1 grid ${
              cols === 1 ? 'grid-cols-2' : gridColsClass
            } gap-3 relative z-10 content-start overflow-hidden`}
          >
            {board.items.length === 0 ? (
              renderEmptyState(false)
            ) : (
              board.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="group/row flex flex-col justify-between bg-white border rounded-xl overflow-hidden relative"
                  style={{ borderColor: item.isOffer ? '#dc2626' : `${s.primaryColor}35` }}
                >
                  <div className="p-3 text-center flex-1 flex flex-col justify-center">
                    {(canEdit || item.isOffer || item.badgeText) && (
                      <div className="flex items-center justify-center gap-1.5 mb-1.5 min-h-[20px]">
                        {renderItemBadge(
                          item,
                          'bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded',
                          undefined,
                          'عرض خاص'
                        )}
                        {renderRowHoverActions(item, idx, board.items.length, false)}
                      </div>
                    )}
                    {renderItemLabel(
                      item,
                      'font-black break-words text-center',
                      {
                        fontSize: `${s.itemFontSize * scale}px`,
                        color: s.textColor,
                        lineHeight: 1.3,
                      },
                      false
                    )}
                    {renderItemUnit(
                      item,
                      'text-xs font-bold text-slate-400 mt-0.5 text-center',
                      undefined,
                      false
                    )}
                  </div>
                  <div className="flex items-center justify-center bg-amber-100/90 py-2 px-3 border-t border-amber-200">
                    {renderPriceBlock(item, s, scale, {
                      priceColorOverride: '#dc2626',
                      currencyColorOverride: '#dc2626',
                      priceBoost: 1.05,
                      boardId: board.id,
                      canEdit,
                      darkSurface: false,
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          {renderInlineAddFooter(false)}
          {renderTickerAndClockBar(false)}
        </div>
      );
    }

    // Theme 15: elegant_gold (ذهبي فاخر)
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
            className="absolute inset-3.5 border pointer-events-none"
            style={{ borderColor: 'rgba(197, 160, 89, 0.45)' }}
          />
          <div className="flex flex-col items-center mb-6 relative z-10 pt-2 shrink-0">
            {showLogo && logoUrl ? (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-12' : 'h-16'} object-contain mb-3`}
              />
            ) : null}
            <div className="w-full max-w-[90%]">
              {renderTitle(
                'font-black tracking-wide text-center text-balance',
                { fontSize: `${s.titleFontSize * scale}px`, color: s.secondaryColor },
                true
              )}
              {renderSubtitle(
                'font-semibold opacity-75 mt-1 text-center',
                {
                  fontSize: `${Math.max(12, s.itemFontSize * scale * 0.65)}px`,
                  color: s.textColor,
                },
                true
              )}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="h-px w-14" style={{ backgroundColor: s.secondaryColor }} />
              <Diamond size={13 * scale} color={s.secondaryColor} fill={s.secondaryColor} />
              <div className="h-px w-14" style={{ backgroundColor: s.secondaryColor }} />
            </div>
          </div>

          <div
            className={`flex-1 grid ${gridColsClass} gap-x-8 gap-y-2.5 px-5 relative z-10 content-start overflow-hidden`}
          >
            {board.items.length === 0 ? (
              renderEmptyState(true)
            ) : (
              board.items.map((item, idx) => (
                <div key={item.id} className="group/row flex items-baseline justify-between py-2 gap-3">
                  <div className="min-w-0 max-w-[58%] flex-1">
                    {renderItemLabel(
                      item,
                      'font-bold break-words',
                      { fontSize: `${s.itemFontSize * scale}px`, color: s.textColor },
                      true
                    )}
                    {renderItemUnit(
                      item,
                      'text-xs opacity-60 mt-0.5',
                      { color: s.textColor },
                      true
                    )}
                  </div>
                  <div
                    className="flex-1 border-b border-dotted opacity-30 min-w-[20px]"
                    style={{ borderColor: s.secondaryColor }}
                  />
                  {renderRowHoverActions(item, idx, board.items.length, true)}
                  {renderPriceBlock(item, s, scale, {
                    priceColorOverride: s.secondaryColor,
                    currencyColorOverride: s.secondaryColor,
                    boardId: board.id,
                    canEdit,
                    darkSurface: true,
                  })}
                </div>
              ))
            )}
          </div>
          {renderInlineAddFooter(true)}
          {renderTickerAndClockBar(true)}
        </div>
      );
    }

    // Theme 16: fresh_nature (طبيعة طازجة)
    if (themeId === 'fresh_nature') {
      return (
        <div
          className="w-full h-full flex flex-col relative text-right overflow-hidden rounded-[1.25rem]"
          style={{
            padding: `${s.padding * scale}px`,
            backgroundColor: s.backgroundColor,
            border: `${s.borderWidth * scale}px solid ${s.primaryColor}`,
          }}
        >
          <div
            className="flex justify-between items-center mb-5 bg-white px-5 py-4 rounded-xl border relative z-10 shrink-0 gap-4"
            style={{ borderColor: `${s.primaryColor}25` }}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className="p-2.5 rounded-xl shrink-0"
                style={{ backgroundColor: `${s.primaryColor}15`, color: s.primaryColor }}
              >
                <Leaf size={24 * scale} />
              </div>
              <div className="min-w-0 flex-1">
                {renderTitle(
                  'font-black text-balance',
                  { fontSize: `${s.titleFontSize * scale}px`, color: s.textColor },
                  false
                )}
                {renderSubtitle(
                  'text-xs font-semibold opacity-65 mt-0.5',
                  { color: s.textColor },
                  false
                )}
              </div>
            </div>
            {showLogo && logoUrl ? (
              <img
                src={logoUrl}
                alt="شعار المتجر"
                referrerPolicy="no-referrer"
                className={`${isSmall ? 'h-11' : 'h-15'} object-contain shrink-0`}
              />
            ) : null}
          </div>

          <div
            className={`flex-1 grid ${gridColsClass} gap-2.5 relative z-10 content-start overflow-hidden`}
          >
            {board.items.length === 0 ? (
              renderEmptyState(false)
            ) : (
              board.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="group/row flex items-stretch justify-between bg-white rounded-xl border overflow-hidden"
                  style={{ borderColor: `${s.primaryColor}25` }}
                >
                  <div className="flex-1 min-w-0 px-4 py-2.5 flex flex-col justify-center">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        {renderItemLabel(
                          item,
                          'font-bold break-words',
                          { fontSize: `${s.itemFontSize * scale}px`, color: s.textColor },
                          false
                        )}
                      </div>
                      {renderItemBadge(
                        item,
                        'px-2 py-0.5 rounded text-[10px] font-black text-white shrink-0',
                        { backgroundColor: s.primaryColor },
                        'طازج'
                      )}
                    </div>
                    {renderItemUnit(
                      item,
                      'text-xs opacity-60 font-medium mt-0.5',
                      undefined,
                      false
                    )}
                  </div>
                  <div className="flex items-center px-1.5">
                    {renderRowHoverActions(item, idx, board.items.length, false)}
                  </div>
                  <div
                    className="px-4 py-2 flex items-center shrink-0 border-r"
                    style={{
                      backgroundColor: `${s.primaryColor}10`,
                      borderColor: `${s.primaryColor}20`,
                    }}
                  >
                    {renderPriceBlock(item, s, scale, {
                      currencyColorOverride: s.priceColor,
                      fontMono: true,
                      boardId: board.id,
                      canEdit,
                      darkSurface: false,
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          {renderInlineAddFooter(false)}
          {renderTickerAndClockBar(false)}
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

  const renderFullPagePrint = () => {
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
          {renderBoardContent({
            board: firstBoard,
            s: styles,
            isSmall: effectiveBoardsPerPage === 2 && Boolean(secondBoard),
            editable: false,
          })}
        </div>
        {effectiveBoardsPerPage === 2 && secondBoard && (
          <div className="w-full h-full border-r-2 border-dashed border-gray-300 relative overflow-hidden">
            {renderBoardContent({
              board: secondBoard,
              s: styles,
              isSmall: true,
              editable: false,
            })}
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
      {renderFullPagePrint()}

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
            onClick={() => setInlineEditEnabled((v) => !v)}
            className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              inlineEditEnabled
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
            title={
              inlineEditEnabled
                ? 'التعديل المباشر على التصميم مفعّل — اضغط للتبديل إلى معاينة صافية'
                : 'معاينة صافية بدون حقول تعديل'
            }
          >
            {inlineEditEnabled ? <Edit3 size={14} /> : <Eye size={14} />}
            <span className="hidden xl:inline">
              {inlineEditEnabled ? 'التعديل المباشر مفعّل' : 'معاينة صافية'}
            </span>
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
                {/* Templates Gallery with Visual Miniatures & Category Filter */}
                <div className="space-y-3">
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

                  {/* Template Category Filter Bar */}
                  <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {(
                      [
                        { id: 'all', label: 'الكل' },
                        { id: 'tv_dark', label: 'تلفاز' },
                        { id: 'retail_promo', label: 'أسواق' },
                        { id: 'editorial', label: 'كلاسيك' },
                      ] as const
                    ).map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setThemeCategory(cat.id)}
                        className={`py-1.5 px-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${
                          themeCategory === cat.id
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {themesList
                      .filter((t) => themeCategory === 'all' || t.category === themeCategory)
                      .map((t) => {
                        const active = themeId === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => applyThemeWithRecommendedColors(t.id)}
                            className={`rounded-xl border overflow-hidden text-right transition-all group ${
                              active
                                ? 'border-sap-primary ring-2 ring-sap-primary/25 bg-sap-primary/5 dark:bg-sap-primary/15'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            {/* Visual Miniature Layout Preview */}
                            <div
                              className="h-16 p-2 flex flex-col gap-1.5 border-b border-black/5"
                              style={{ backgroundColor: t.previewBg }}
                            >
                              {/* Mini Header Bar */}
                              <div
                                className="h-3 rounded-sm w-full flex items-center justify-between px-1.5"
                                style={{ backgroundColor: t.previewHeader }}
                              >
                                <span className="w-8 h-1 rounded-full bg-white/85" />
                                <span className="w-2 h-2 rounded-full bg-white/75" />
                              </div>

                              {/* Mini Body Preview */}
                              {t.previewLayout === 'grid' ? (
                                <div className="grid grid-cols-2 gap-1 flex-1">
                                  {[0, 1].map((idx) => (
                                    <div
                                      key={idx}
                                      className="rounded-sm p-1 flex flex-col justify-between border border-black/5"
                                      style={{ backgroundColor: t.previewCardBg }}
                                    >
                                      <span
                                        className="w-7 h-1 rounded-full opacity-40"
                                        style={{ backgroundColor: t.isDark ? '#fff' : '#0f172a' }}
                                      />
                                      <span
                                        className="w-4 h-1.5 rounded-sm self-end"
                                        style={{ backgroundColor: t.previewAccent }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1 flex-1">
                                  {[0, 1].map((idx) => (
                                    <div
                                      key={idx}
                                      className="flex-1 rounded-sm px-1.5 flex items-center justify-between border border-black/5"
                                      style={{
                                        backgroundColor:
                                          t.previewLayout === 'ledger' && idx === 1
                                            ? 'transparent'
                                            : t.previewCardBg,
                                      }}
                                    >
                                      <span
                                        className="w-10 h-1 rounded-full opacity-45"
                                        style={{ backgroundColor: t.isDark ? '#fff' : '#0f172a' }}
                                      />
                                      <span
                                        className="w-4 h-1.5 rounded-sm"
                                        style={{ backgroundColor: t.previewAccent }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Template Title & Subtitle */}
                            <div className="p-2 flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border border-black/5"
                                style={{ backgroundColor: t.previewBg, color: t.previewAccent }}
                              >
                                <t.icon size={13} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-black truncate leading-tight">
                                  {t.name}
                                </div>
                                <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  {t.subtitle}
                                </div>
                              </div>
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
                      {renderBoardContent({
                        board: firstBoard,
                        s: styles,
                        isSmall: effectiveBoardsPerPage === 2 && Boolean(secondBoard),
                        editable: true,
                      })}
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
                        {renderBoardContent({
                          board: secondBoard,
                          s: styles,
                          isSmall: true,
                          editable: true,
                        })}
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
              {renderBoardContent({
                board: activeSlides[presentSlideIdx],
                s: styles,
                editable: false,
              })}
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
