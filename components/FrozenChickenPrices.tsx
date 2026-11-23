import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FrozenChickenBoard,
  FrozenChickenCompany,
  FrozenChickenPriceItem,
  FrozenChickenThemeId,
  Product,
  Unit,
} from '../types';
import { db } from '../services/supabase';
import { useSystemSettings } from './SystemSettingsContext';
import { CurrencySymbolRenderer } from './CurrencySymbolRenderer';
import { useNotification, useConfirm } from './Notifications';
import { toPng } from 'html-to-image';
import {
  Snowflake,
  Plus,
  Trash2,
  Save,
  FolderOpen,
  Printer,
  Download,
  Maximize2,
  Minimize2,
  Copy,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Building2,
  Upload,
  X,
  Search,
  Check,
  Loader2,
  RotateCcw,
  FilePlus,
  Clock,
  Palette,
  Edit3,
} from 'lucide-react';

interface FrozenChickenPricesProps {
  products: Product[];
  units: Unit[];
}

const makeId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `fc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const COMPANY_PRESETS: Array<{
  name: string;
  subtitle: string;
  accentColor: string;
}> = [
  { name: 'ساديا (Sadia)', subtitle: 'دجاج برازيلي مجمد · حلال', accentColor: '#B91C1C' },
  { name: 'دو (Doux)', subtitle: 'دجاج فرنسي مجمد · حلال', accentColor: '#1D4ED8' },
  { name: 'رضوى (Radwa)', subtitle: 'دجاج وطني طازج مجمد', accentColor: '#047857' },
  { name: 'الوطنية (Al Watania)', subtitle: 'دجاج محلي · جودة عالية', accentColor: '#15803D' },
  { name: 'التنمية (Tanmiah)', subtitle: 'إنتاج محلي · حلال 100%', accentColor: '#0F766E' },
  { name: 'سيارا (Seara)', subtitle: 'دجاج برازيلي فاخر', accentColor: '#C2410C' },
  { name: 'برديكس (Perdix)', subtitle: 'دجاج مجمد ممتاز', accentColor: '#0369A1' },
  { name: 'داري (Dari)', subtitle: 'دجاج مجمد مختار', accentColor: '#4338CA' },
];

const QUICK_WEIGHTS: Array<{ weightLabel: string; unitLabel: string }> = [
  { weightLabel: 'دجاج كامل 700 جم', unitLabel: 'حبة' },
  { weightLabel: 'دجاج كامل 800 جم', unitLabel: 'حبة' },
  { weightLabel: 'دجاج كامل 900 جم', unitLabel: 'حبة' },
  { weightLabel: 'دجاج كامل 1000 جم', unitLabel: 'حبة' },
  { weightLabel: 'دجاج كامل 1100 جم', unitLabel: 'حبة' },
  { weightLabel: 'دجاج كامل 1200 جم', unitLabel: 'حبة' },
  { weightLabel: 'دجاج كامل 1300 جم', unitLabel: 'حبة' },
  { weightLabel: 'دجاج كامل 1400 جم', unitLabel: 'حبة' },
  { weightLabel: 'كرتون دجاج 10×1000 جم', unitLabel: 'كرتون' },
  { weightLabel: 'صدور دجاج بدون عظم 1 كجم', unitLabel: 'كيس' },
];

const ACCENT_SWATCHES = [
  '#0369A1',
  '#B91C1C',
  '#1D4ED8',
  '#047857',
  '#C2410C',
  '#4338CA',
  '#800020',
  '#334155',
];

const THEME_STYLES: Record<
  FrozenChickenThemeId,
  {
    label: string;
    pageBg: string;
    pageText: string;
    mutedText: string;
    cardBg: string;
    cardBorder: string;
    rowDivider: string;
    rowHover: string;
    priceText: string;
    headerBannerBg: string;
  }
> = {
  frost: {
    label: 'ثلجي أزرق',
    pageBg: '#F4F8FC',
    pageText: '#0F172A',
    mutedText: '#475569',
    cardBg: '#FFFFFF',
    cardBorder: '#CBD5E1',
    rowDivider: '#E2E8F0',
    rowHover: '#F8FAFC',
    priceText: '#0369A1',
    headerBannerBg: '#FFFFFF',
  },
  classic: {
    label: 'كلاسيك أبيض',
    pageBg: '#FFFFFF',
    pageText: '#111827',
    mutedText: '#6B7280',
    cardBg: '#FFFFFF',
    cardBorder: '#D1D5DB',
    rowDivider: '#E5E7EB',
    rowHover: '#F9FAFB',
    priceText: '#800020',
    headerBannerBg: '#F9FAFB',
  },
  dark_tv: {
    label: 'شاشة عرض داكنة',
    pageBg: '#0B1220',
    pageText: '#F8FAFC',
    mutedText: '#94A3B8',
    cardBg: '#131C2E',
    cardBorder: '#24324B',
    rowDivider: '#1E293B',
    rowHover: '#19243A',
    priceText: '#38BDF8',
    headerBannerBg: '#0F172A',
  },
  fresh: {
    label: 'سوق طازج',
    pageBg: '#F5FAF7',
    pageText: '#0F172A',
    mutedText: '#475569',
    cardBg: '#FFFFFF',
    cardBorder: '#BBF7D0',
    rowDivider: '#E2E8F0',
    rowHover: '#F0FDF4',
    priceText: '#047857',
    headerBannerBg: '#FFFFFF',
  },
};

const createStarterBoard = (): FrozenChickenBoard => ({
  id: makeId(),
  name: 'لوحة أسعار الدجاج المجمد',
  title: 'أسعار الدجاج المجمد اليومية',
  subtitle: 'قائمة الأسعار المعتمدة حسب الشركة والوزن',
  date: new Date().toISOString().split('T')[0],
  config: {
    columns: 3,
    theme: 'frost',
    showHeader: true,
    showDate: true,
    showTaxNote: true,
    showOldPrices: true,
    showUnits: true,
    titleSize: 18,
    itemSize: 14,
    priceSize: 18,
    printOrientation: 'auto',
    printSinglePage: true,
  },
  companies: [
    {
      id: makeId(),
      name: 'ساديا (Sadia)',
      subtitle: 'دجاج برازيلي مجمد · حلال',
      accentColor: '#B91C1C',
      isVisible: true,
      items: [
        { id: makeId(), weightLabel: 'دجاج كامل 900 جم', unitLabel: 'حبة', price: '16.50', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 1000 جم', unitLabel: 'حبة', price: '18.25', oldPrice: '20.00', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 1100 جم', unitLabel: 'حبة', price: '19.75', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 1200 جم', unitLabel: 'حبة', price: '21.50', isAvailable: true },
        { id: makeId(), weightLabel: 'كرتون 10×1000 جم', unitLabel: 'كرتون', price: '175.00', isAvailable: true },
      ],
    },
    {
      id: makeId(),
      name: 'دو (Doux)',
      subtitle: 'دجاج فرنسي مجمد · حلال',
      accentColor: '#1D4ED8',
      isVisible: true,
      items: [
        { id: makeId(), weightLabel: 'دجاج كامل 800 جم', unitLabel: 'حبة', price: '14.95', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 900 جم', unitLabel: 'حبة', price: '16.75', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 1000 جم', unitLabel: 'حبة', price: '18.50', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 1100 جم', unitLabel: 'حبة', price: '20.00', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 1200 جم', unitLabel: 'حبة', price: '21.95', isAvailable: true },
      ],
    },
    {
      id: makeId(),
      name: 'رضوى (Radwa)',
      subtitle: 'دجاج وطني · إنتاج محلي',
      accentColor: '#047857',
      isVisible: true,
      items: [
        { id: makeId(), weightLabel: 'دجاج كامل 800 جم', unitLabel: 'حبة', price: '16.00', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 900 جم', unitLabel: 'حبة', price: '17.50', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 1000 جم', unitLabel: 'حبة', price: '19.25', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 1100 جم', unitLabel: 'حبة', price: '20.75', isAvailable: true },
        { id: makeId(), weightLabel: 'صدور بدون عظم 1 كجم', unitLabel: 'كيس', price: '28.50', oldPrice: '32.00', isAvailable: true },
      ],
    },
    {
      id: makeId(),
      name: 'الوطنية (Al Watania)',
      subtitle: 'دجاج محلي فاخر',
      accentColor: '#15803D',
      isVisible: true,
      items: [
        { id: makeId(), weightLabel: 'دجاج كامل 800 جم', unitLabel: 'حبة', price: '15.50', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 900 جم', unitLabel: 'حبة', price: '17.25', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 1000 جم', unitLabel: 'حبة', price: '18.95', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 1100 جم', unitLabel: 'حبة', price: '20.50', isAvailable: true },
        { id: makeId(), weightLabel: 'كرتون 10×1000 جم', unitLabel: 'كرتون', price: '182.00', isAvailable: true },
      ],
    },
    {
      id: makeId(),
      name: 'سيارا (Seara)',
      subtitle: 'دجاج برازيلي مجمد',
      accentColor: '#C2410C',
      isVisible: true,
      items: [
        { id: makeId(), weightLabel: 'دجاج كامل 900 جم', unitLabel: 'حبة', price: '15.95', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 1000 جم', unitLabel: 'حبة', price: '17.75', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 1100 جم', unitLabel: 'حبة', price: '19.25', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 1200 جم', unitLabel: 'حبة', price: '20.95', isAvailable: true },
      ],
    },
    {
      id: makeId(),
      name: 'التنمية (Tanmiah)',
      subtitle: 'إنتاج محلي · حلال 100%',
      accentColor: '#0F766E',
      isVisible: true,
      items: [
        { id: makeId(), weightLabel: 'دجاج كامل 900 جم', unitLabel: 'حبة', price: '17.00', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 1000 جم', unitLabel: 'حبة', price: '18.95', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 1100 جم', unitLabel: 'حبة', price: '20.50', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 1200 جم', unitLabel: 'حبة', price: '22.00', isAvailable: true },
      ],
    },
  ],
});

export const FrozenChickenPrices: React.FC<FrozenChickenPricesProps> = ({ products, units }) => {
  const { settings } = useSystemSettings();
  const { notify } = useNotification();
  const { confirm } = useConfirm();

  const [board, setBoard] = useState<FrozenChickenBoard>(createStarterBoard);
  const [savedBoards, setSavedBoards] = useState<FrozenChickenBoard[]>([]);
  const [isLoadingBoards, setIsLoadingBoards] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [inlineEditEnabled, setInlineEditEnabled] = useState(true);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [openColorCompanyId, setOpenColorCompanyId] = useState<string | null>(null);
  const [openQuickWeightCompanyId, setOpenQuickWeightCompanyId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorTab, setEditorTab] = useState<'companies' | 'design'>('companies');
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveTime, setLiveTime] = useState(() => new Date());

  const boardCanvasRef = useRef<HTMLDivElement>(null);
  const printMeasureRef = useRef<HTMLDivElement>(null);
  const logoUploadRef = useRef<HTMLInputElement>(null);
  const canvasLogoUploadRef = useRef<HTMLInputElement>(null);
  const logoTargetCompanyIdRef = useRef<string | null>(null);
  const [printRoot] = useState(() =>
    typeof document !== 'undefined' ? document.getElementById('print-container') : null
  );
  const [printFit, setPrintFit] = useState<{ scale: number; scaledHeightPx: number | null }>({
    scale: 1,
    scaledHeightPx: null,
  });

  // Load saved boards on mount
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoadingBoards(true);
      try {
        const list = (await db.frozenChickenBoards.getAll()) as FrozenChickenBoard[];
        if (!mounted) return;
        setSavedBoards(list);
        if (list.length > 0) {
          setBoard(list[0]);
          if (list[0].companies?.length > 0) {
            setSelectedCompanyId(list[0].companies[0].id);
          }
        } else {
          setSelectedCompanyId(prev => prev || board.companies[0]?.id || '');
        }
      } catch (e) {
        console.error('Error loading frozen chicken boards:', e);
      } finally {
        if (mounted) setIsLoadingBoards(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Keep selectedCompanyId valid
  useEffect(() => {
    if (board.companies.length > 0 && !board.companies.some(c => c.id === selectedCompanyId)) {
      setSelectedCompanyId(board.companies[0].id);
    }
  }, [board.companies, selectedCompanyId]);

  // Live clock for fullscreen signage
  useEffect(() => {
    if (!isFullscreen) return;
    const timer = window.setInterval(() => setLiveTime(new Date()), 1000);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen]);

  const activeCompany = useMemo(
    () => board.companies.find(c => c.id === selectedCompanyId) || null,
    [board.companies, selectedCompanyId]
  );

  const visibleCompanies = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    return board.companies.filter(c => {
      if (c.isVisible === false) return false;
      if (!q) return true;
      const companyMatch =
        c.name.toLowerCase().includes(q) || (c.subtitle || '').toLowerCase().includes(q);
      const itemMatch = c.items.some(it => it.weightLabel.toLowerCase().includes(q));
      return companyMatch || itemMatch;
    });
  }, [board.companies, companySearch]);

  const filteredStoreProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const list = q
      ? products.filter(
          p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
        )
      : products.filter(p => /دجاج|فراخ|ساديا|دو|رضوى|الوطنية|سيارا|التنمية|مجمد/i.test(p.name));
    return (list.length > 0 ? list : products).slice(0, 30);
  }, [products, productSearch]);

  const theme = THEME_STYLES[board.config.theme] || THEME_STYLES.frost;

  const printSinglePage = board.config.printSinglePage !== false;
  const effectivePrintOrientation: 'portrait' | 'landscape' = useMemo(() => {
    const pref = board.config.printOrientation || 'auto';
    if (pref === 'portrait' || pref === 'landscape') return pref;
    return board.config.columns >= 4 ? 'landscape' : 'portrait';
  }, [board.config.printOrientation, board.config.columns]);

  const printTargetBox = useMemo(
    () =>
      effectivePrintOrientation === 'landscape'
        ? { pageW: 1060, pageH: 710 }
        : { pageW: 748, pageH: 1030 },
    [effectivePrintOrientation]
  );

  const printBaseMeasureWidth = useMemo(() => {
    const minColsW =
      board.config.columns === 4 ? 1140 : board.config.columns === 3 ? 900 : 748;
    return Math.max(printTargetBox.pageW, minColsW);
  }, [board.config.columns, printTargetBox.pageW]);

  const computePrintFitLayout = () => {
    const el = printMeasureRef.current;
    if (!el) return null;
    const measuredH = el.scrollHeight || 0;
    if (measuredH <= 0) return null;
    const widthScale = printTargetBox.pageW / printBaseMeasureWidth;
    const heightScale = printSinglePage ? printTargetBox.pageH / measuredH : 1;
    const scale = Math.min(1, widthScale, heightScale);
    const scaledHeightPx = printSinglePage
      ? Math.min(printTargetBox.pageH, Math.ceil(measuredH * scale) + 2)
      : null;
    return { scale, scaledHeightPx };
  };

  useLayoutEffect(() => {
    const next = computePrintFitLayout();
    if (!next) return;
    setPrintFit(prev => {
      if (
        Math.abs(prev.scale - next.scale) <= 0.002 &&
        prev.scaledHeightPx === next.scaledHeightPx
      ) {
        return prev;
      }
      return next;
    });
  }, [
    board,
    companySearch,
    effectivePrintOrientation,
    printSinglePage,
    printTargetBox,
    printBaseMeasureWidth,
  ]);

  const handlePrint = () => {
    const next = computePrintFitLayout();
    if (next) {
      setPrintFit(next);
    }
    window.setTimeout(() => window.print(), 60);
  };

  // --- CRUD Handlers ---
  const handleSaveBoard = async (asCopy = false) => {
    if (!board.name.trim()) {
      notify('يرجى إدخال اسم اللوحة قبل الحفظ', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      const targetBoard: FrozenChickenBoard = asCopy
        ? {
            ...board,
            id: makeId(),
            name: `${board.name.trim()} - نسخة`,
            date: new Date().toISOString().split('T')[0],
          }
        : {
            ...board,
            name: board.name.trim(),
          };
      await db.frozenChickenBoards.upsert(targetBoard);
      setBoard(targetBoard);
      const updatedList = (await db.frozenChickenBoards.getAll()) as FrozenChickenBoard[];
      setSavedBoards(updatedList);
      notify(asCopy ? 'تم حفظ نسخة جديدة من اللوحة' : 'تم حفظ لوحة أسعار الدجاج بنجاح', 'success');
    } catch (e) {
      console.error(e);
      notify('تم حفظ اللوحة محلياً وتعذر المزامنة السحابية حالياً', 'warning');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSavedBoard = async (id: string) => {
    const ok = await confirm({
      title: 'حذف اللوحة المحفوظة',
      message: 'هل أنت متأكد من حذف لوحة الأسعار هذه؟',
      confirmLabel: 'حذف',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await db.frozenChickenBoards.delete(id);
      setSavedBoards(prev => prev.filter(b => b.id !== id));
      notify('تم حذف اللوحة بنجاح', 'success');
    } catch {
      notify('تعذر حذف اللوحة', 'error');
    }
  };

  const handleNewEmptyBoard = async () => {
    const ok = await confirm({
      title: 'إنشاء لوحة جديدة',
      message: 'سيتم فتح لوحة فارغة جديدة لإدخال شركات وأسعار جديدة. هل تريد المتابعة؟',
      confirmLabel: 'لوحة جديدة',
      variant: 'primary',
    });
    if (!ok) return;
    const freshId = makeId();
    const firstCompanyId = makeId();
    setBoard({
      id: freshId,
      name: 'لوحة دجاج مجمد جديدة',
      title: 'أسعار الدجاج المجمد',
      subtitle: 'قائمة الأسعار حسب الشركة والوزن',
      date: new Date().toISOString().split('T')[0],
      config: { ...board.config },
      companies: [
        {
          id: firstCompanyId,
          name: 'شركة جديدة',
          subtitle: 'دجاج مجمد',
          accentColor: '#0369A1',
          isVisible: true,
          items: [
            { id: makeId(), weightLabel: 'دجاج كامل 1000 جم', unitLabel: 'حبة', price: '18.00', isAvailable: true },
          ],
        },
      ],
    });
    setSelectedCompanyId(firstCompanyId);
  };

  const handleResetStarter = async () => {
    const ok = await confirm({
      title: 'استعادة النموذج الافتراضي',
      message: 'هل تريد تحميل نموذج الشركات الجاهز (ساديا، دو، رضوى، الوطنية، سيارا، التنمية)؟',
      confirmLabel: 'تحميل النموذج',
      variant: 'warning',
    });
    if (!ok) return;
    const starter = createStarterBoard();
    setBoard(starter);
    setSelectedCompanyId(starter.companies[0]?.id || '');
    notify('تم تحميل القائمة الافتراضية للشركات', 'info');
  };

  const handleAddCompany = (preset?: { name: string; subtitle: string; accentColor: string }) => {
    const newComp: FrozenChickenCompany = {
      id: makeId(),
      name: preset?.name || `شركة ${board.companies.length + 1}`,
      subtitle: preset?.subtitle || 'دجاج مجمد · حلال',
      accentColor: preset?.accentColor || ACCENT_SWATCHES[board.companies.length % ACCENT_SWATCHES.length],
      isVisible: true,
      items: [
        { id: makeId(), weightLabel: 'دجاج كامل 900 جم', unitLabel: 'حبة', price: '16.50', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 1000 جم', unitLabel: 'حبة', price: '18.00', isAvailable: true },
        { id: makeId(), weightLabel: 'دجاج كامل 1100 جم', unitLabel: 'حبة', price: '19.50', isAvailable: true },
      ],
    };
    setBoard(prev => ({ ...prev, companies: [...prev.companies, newComp] }));
    setSelectedCompanyId(newComp.id);
    setShowPresetsModal(false);
    setEditorTab('companies');
  };

  const updateCompany = (companyId: string, patch: Partial<FrozenChickenCompany>) => {
    setBoard(prev => ({
      ...prev,
      companies: prev.companies.map(c => (c.id === companyId ? { ...c, ...patch } : c)),
    }));
  };

  const moveCompany = (companyId: string, dir: -1 | 1) => {
    setBoard(prev => {
      const idx = prev.companies.findIndex(c => c.id === companyId);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.companies.length) return prev;
      const copy = [...prev.companies];
      const [moved] = copy.splice(idx, 1);
      copy.splice(target, 0, moved);
      return { ...prev, companies: copy };
    });
  };

  const duplicateCompany = (company: FrozenChickenCompany) => {
    const cloned: FrozenChickenCompany = {
      ...company,
      id: makeId(),
      name: `${company.name} (نسخة)`,
      items: company.items.map(it => ({ ...it, id: makeId() })),
    };
    setBoard(prev => ({ ...prev, companies: [...prev.companies, cloned] }));
    setSelectedCompanyId(cloned.id);
  };

  const removeCompany = async (companyId: string) => {
    if (board.companies.length <= 1) {
      notify('يجب أن تحتوي اللوحة على شركة واحدة على الأقل', 'warning');
      return;
    }
    const target = board.companies.find(c => c.id === companyId);
    const ok = await confirm({
      title: 'حذف الشركة',
      message: `هل تريد حذف "${target?.name || 'هذه الشركة'}" وجميع أسعارها من اللوحة؟`,
      confirmLabel: 'حذف الشركة',
      variant: 'danger',
    });
    if (!ok) return;
    setBoard(prev => ({
      ...prev,
      companies: prev.companies.filter(c => c.id !== companyId),
    }));
  };

  const addItemToCompany = (
    companyId: string,
    preset?: Partial<FrozenChickenPriceItem>
  ) => {
    const newItem: FrozenChickenPriceItem = {
      id: makeId(),
      weightLabel: preset?.weightLabel || 'دجاج كامل 1000 جم',
      unitLabel: preset?.unitLabel || 'حبة',
      price: preset?.price || '0.00',
      oldPrice: preset?.oldPrice || '',
      productId: preset?.productId,
      isAvailable: true,
    };
    setBoard(prev => ({
      ...prev,
      companies: prev.companies.map(c =>
        c.id === companyId ? { ...c, items: [...c.items, newItem] } : c
      ),
    }));
  };

  const updateItemInCompany = (
    companyId: string,
    itemId: string,
    patch: Partial<FrozenChickenPriceItem>
  ) => {
    setBoard(prev => ({
      ...prev,
      companies: prev.companies.map(c =>
        c.id === companyId
          ? {
              ...c,
              items: c.items.map(it => (it.id === itemId ? { ...it, ...patch } : it)),
            }
          : c
      ),
    }));
  };

  const moveItemInCompany = (companyId: string, itemId: string, dir: -1 | 1) => {
    setBoard(prev => ({
      ...prev,
      companies: prev.companies.map(c => {
        if (c.id !== companyId) return c;
        const idx = c.items.findIndex(it => it.id === itemId);
        const target = idx + dir;
        if (idx < 0 || target < 0 || target >= c.items.length) return c;
        const copy = [...c.items];
        const [moved] = copy.splice(idx, 1);
        copy.splice(target, 0, moved);
        return { ...c, items: copy };
      }),
    }));
  };

  const removeItemFromCompany = (companyId: string, itemId: string) => {
    setBoard(prev => ({
      ...prev,
      companies: prev.companies.map(c =>
        c.id === companyId
          ? { ...c, items: c.items.filter(it => it.id !== itemId) }
          : c
      ),
    }));
  };

  const handleUploadCompanyLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCompany) return;
    const reader = new FileReader();
    reader.onload = ev => {
      updateCompany(activeCompany.id, { logoUrl: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleUploadCanvasCompanyLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = logoTargetCompanyIdRef.current;
    if (!file || !targetId) return;
    const reader = new FileReader();
    reader.onload = ev => {
      updateCompany(targetId, { logoUrl: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleExportPng = async () => {
    if (!boardCanvasRef.current) return;
    setIsExportingPng(true);
    try {
      await new Promise(r => setTimeout(r, 80));
      const dataUrl = await toPng(boardCanvasRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: theme.pageBg,
        skipFonts: true,
      });
      const link = document.createElement('a');
      link.download = `${board.name || 'frozen-chicken-prices'}.png`;
      link.href = dataUrl;
      link.click();
      notify('تم تصدير صورة لوحة الأسعار بنجاح', 'success');
    } catch (e) {
      console.error('Export PNG failed:', e);
      notify('حدث خطأ أثناء تصدير الصورة', 'error');
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleSelectProductFromCatalog = (product: Product) => {
    if (!activeCompany) return;
    const u = units.find(unit => unit.id === product.unitId);
    addItemToCompany(activeCompany.id, {
      weightLabel: product.name,
      unitLabel: u?.name || 'حبة',
      price: product.price || '0.00',
      oldPrice: product.originalPrice || '',
      productId: product.id,
    });
    setShowProductPicker(false);
    setProductSearch('');
    notify(`تمت إضافة "${product.name}" تحت ${activeCompany.name}`, 'success');
  };

  const currencyType = settings.currencySymbolType || 'text';
  const currencyImage = settings.currencySymbolImage || null;

  const gridColumnsClass =
    board.config.columns === 4
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      : board.config.columns === 3
      ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
      : 'grid-cols-1 md:grid-cols-2';

  // Reusable Multi-Company Board Sheet (Rendered in Canvas, Fullscreen TV, and Print Portal)
  const renderPriceBoardSheet = (mode: 'canvas' | 'tv' | 'print') => {
    const isTv = mode === 'tv';
    const isPrint = mode === 'print';
    const forPrintOrTv = isTv || isPrint;
    const canEdit = mode === 'canvas' && !isExportingPng && inlineEditEnabled;

    return (
      <div
        ref={mode === 'canvas' ? boardCanvasRef : undefined}
        style={{
          backgroundColor: theme.pageBg,
          color: theme.pageText,
          borderColor: theme.cardBorder,
        }}
        className={`w-full transition-colors ${
          isPrint
            ? 'p-4'
            : isTv || isExportingPng
            ? 'p-6 sm:p-8 min-h-full'
            : 'rounded-2xl border p-5 sm:p-8 shadow-sm'
        }`}
      >
        {/* Page Header */}
        {board.config.showHeader && (
          <div
            style={{ borderColor: theme.rowDivider }}
            className={`${
              isPrint ? 'pb-3 mb-3.5' : 'pb-5 mb-6'
            } border-b flex flex-col sm:flex-row sm:items-end justify-between gap-4`}
          >
            <div className="space-y-1 flex-1 min-w-0">
              <div
                style={{ color: theme.mutedText }}
                className="flex items-center gap-2 text-xs font-bold flex-wrap"
              >
                <span>{settings.orgName || 'مؤسسة المدير برو التجارية'}</span>
                <span aria-hidden="true">·</span>
                <span>قسم المجمدات والدواجن</span>
                {board.config.showDate && (
                  <>
                    <span aria-hidden="true">·</span>
                    {canEdit ? (
                      <input
                        type="date"
                        value={board.date}
                        onChange={e => setBoard(prev => ({ ...prev, date: e.target.value }))}
                        className="tabular-nums bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-sky-500 rounded px-1.5 py-0.5 focus:outline-none text-xs font-bold"
                      />
                    ) : (
                      <span className="tabular-nums">{board.date}</span>
                    )}
                  </>
                )}
              </div>

              {canEdit ? (
                <input
                  type="text"
                  value={board.title}
                  onChange={e => setBoard(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="عنوان صفحة الأسعار..."
                  className="w-full text-2xl sm:text-3xl font-black tracking-tight bg-transparent border border-transparent hover:border-slate-300/70 dark:hover:border-slate-700 focus:border-sky-500 focus:bg-white/70 dark:focus:bg-slate-800/70 rounded-lg px-2 py-0.5 -mx-2 focus:outline-none"
                />
              ) : (
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-balance">
                  {board.title || 'أسعار الدجاج المجمد'}
                </h1>
              )}

              {canEdit ? (
                <input
                  type="text"
                  value={board.subtitle || ''}
                  onChange={e => setBoard(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="أضف وصفاً أو عبارة أسفل العنوان..."
                  style={{ color: theme.mutedText }}
                  className="w-full text-xs sm:text-sm font-medium bg-transparent border border-transparent hover:border-slate-300/70 dark:hover:border-slate-700 focus:border-sky-500 focus:bg-white/70 dark:focus:bg-slate-800/70 rounded-lg px-2 py-0.5 -mx-2 focus:outline-none"
                />
              ) : (
                board.subtitle && (
                  <p style={{ color: theme.mutedText }} className="text-xs sm:text-sm font-medium">
                    {board.subtitle}
                  </p>
                )
              )}
            </div>

            <div className="flex items-center gap-4 shrink-0">
              {isFullscreen && (
                <div
                  style={{ color: theme.mutedText }}
                  className="flex items-center gap-1.5 text-sm font-bold tabular-nums font-mono"
                >
                  <Clock size={15} />
                  <span>{liveTime.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
              <div style={{ color: theme.mutedText }} className="text-xs font-bold tabular-nums">
                {visibleCompanies.length} شركات
              </div>
            </div>
          </div>
        )}

        {/* Multi-Company Grid */}
        {visibleCompanies.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <Snowflake size={40} className="mx-auto opacity-30" />
            <p className="text-base font-bold">لا توجد شركات ظاهرة حالياً</p>
            <p style={{ color: theme.mutedText }} className="text-xs">
              أضف شركة جديدة أو امسح نص البحث لإظهار الشركات.
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowPresetsModal(true)}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>إضافة شركة</span>
              </button>
            )}
          </div>
        ) : (
          <div
            className={isPrint ? 'grid items-stretch' : `grid ${gridColumnsClass} gap-5 items-stretch`}
            style={
              isPrint
                ? {
                    gridTemplateColumns: `repeat(${board.config.columns}, minmax(0, 1fr))`,
                    gap: '10px',
                  }
                : undefined
            }
          >
            {visibleCompanies.map((company, compIdx) => {
              const isSelected = canEdit && selectedCompanyId === company.id;
              const showColors = canEdit && openColorCompanyId === company.id;
              const showQuickWeights = canEdit && openQuickWeightCompanyId === company.id;

              return (
                <section
                  key={company.id}
                  onClick={() => {
                    if (canEdit) {
                      setSelectedCompanyId(company.id);
                    }
                  }}
                  style={{
                    backgroundColor: theme.cardBg,
                    borderColor: isSelected ? company.accentColor : theme.cardBorder,
                    breakInside: 'avoid',
                    pageBreakInside: 'avoid',
                  }}
                  className={`flex flex-col rounded-xl border overflow-hidden transition-all break-inside-avoid ${
                    isSelected ? 'ring-2 ring-offset-1 ring-sky-500/35' : ''
                  }`}
                >
                  {/* Company Header Bar (Directly Editable) */}
                  <div
                    style={{
                      backgroundColor: company.accentColor,
                    }}
                    className={`${isPrint ? 'px-3 py-2 space-y-1' : 'px-3.5 py-3 space-y-2'} text-white`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Direct Logo Upload/Preview */}
                        <div className="relative group/logo shrink-0">
                          {company.logoUrl ? (
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={e => {
                                e.stopPropagation();
                                if (!canEdit) return;
                                logoTargetCompanyIdRef.current = company.id;
                                canvasLogoUploadRef.current?.click();
                              }}
                              title={canEdit ? 'تغيير شعار الشركة' : undefined}
                              className="w-10 h-10 rounded-lg bg-white p-1 flex items-center justify-center overflow-hidden"
                            >
                              <img
                                src={company.logoUrl}
                                alt={company.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain"
                              />
                            </button>
                          ) : canEdit ? (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                logoTargetCompanyIdRef.current = company.id;
                                canvasLogoUploadRef.current?.click();
                              }}
                              title="رفع شعار للشركة"
                              className="w-10 h-10 rounded-lg bg-white/15 hover:bg-white/25 flex flex-col items-center justify-center shrink-0 transition-colors"
                            >
                              <span className="font-black text-sm leading-none group-hover/logo:hidden">
                                {company.name.trim().charAt(0) || 'ش'}
                              </span>
                              <Upload size={14} className="hidden group-hover/logo:block" />
                            </button>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0 font-black text-base">
                              {company.name.trim().charAt(0)}
                            </div>
                          )}

                          {canEdit && company.logoUrl && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                updateCompany(company.id, { logoUrl: null });
                              }}
                              title="إزالة الشعار"
                              className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-red-600 text-white hidden group-hover/logo:flex items-center justify-center shadow"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          {canEdit ? (
                            <input
                              type="text"
                              value={company.name}
                              onChange={e => updateCompany(company.id, { name: e.target.value })}
                              onClick={e => e.stopPropagation()}
                              placeholder="اسم الشركة..."
                              style={{ fontSize: `${board.config.titleSize}px` }}
                              className="w-full font-black leading-tight bg-transparent border border-transparent hover:border-white/35 focus:border-white focus:bg-black/20 rounded px-1.5 py-0.5 -mx-1.5 text-white placeholder:text-white/60 focus:outline-none"
                            />
                          ) : (
                            <h2
                              style={{ fontSize: `${board.config.titleSize}px` }}
                              className="font-black leading-tight truncate"
                            >
                              {company.name}
                            </h2>
                          )}

                          {canEdit ? (
                            <input
                              type="text"
                              value={company.subtitle || ''}
                              onChange={e =>
                                updateCompany(company.id, { subtitle: e.target.value })
                              }
                              onClick={e => e.stopPropagation()}
                              placeholder="وصف مختصر (اختياري)..."
                              className="w-full text-[11px] font-medium bg-transparent border border-transparent hover:border-white/30 focus:border-white/70 focus:bg-black/20 rounded px-1.5 py-0.5 -mx-1.5 text-white/90 placeholder:text-white/50 focus:outline-none mt-0.5"
                            />
                          ) : (
                            company.subtitle && (
                              <p className="text-[11px] font-medium text-white/85 truncate mt-0.5">
                                {company.subtitle}
                              </p>
                            )
                          )}
                        </div>
                      </div>

                      {/* Direct Company Header Controls */}
                      {canEdit ? (
                        <div
                          className="flex items-center gap-0.5 shrink-0 bg-black/15 rounded-lg p-0.5"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setOpenColorCompanyId(prev =>
                                prev === company.id ? null : company.id
                              )
                            }
                            title="تغيير لون الشركة"
                            className="p-1 rounded hover:bg-white/20 text-white transition-colors"
                          >
                            <Palette size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveCompany(company.id, -1)}
                            disabled={compIdx === 0}
                            title="نقل لليمين"
                            className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-30 transition-colors"
                          >
                            <ChevronRight size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveCompany(company.id, 1)}
                            disabled={compIdx === visibleCompanies.length - 1}
                            title="نقل لليسار"
                            className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-30 transition-colors"
                          >
                            <ChevronLeft size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateCompany(company)}
                            title="نسخ الشركة"
                            className="p-1 rounded hover:bg-white/20 text-white transition-colors"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCompany(company.id)}
                            title="حذف الشركة"
                            className="p-1 rounded hover:bg-red-500/80 text-white transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] font-bold text-white/80 tabular-nums shrink-0 pt-1">
                          {company.items.length} أصناف
                        </span>
                      )}
                    </div>

                    {/* Inline Color Picker Bar for Company */}
                    {showColors && (
                      <div
                        onClick={e => e.stopPropagation()}
                        className="flex items-center justify-between gap-2 pt-2 border-t border-white/20"
                      >
                        <span className="text-[11px] font-bold text-white/90">لون الشركة:</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {ACCENT_SWATCHES.map(color => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => {
                                updateCompany(company.id, { accentColor: color });
                                setOpenColorCompanyId(null);
                              }}
                              style={{ backgroundColor: color }}
                              className={`w-5 h-5 rounded border border-white/60 flex items-center justify-center ${
                                company.accentColor === color ? 'ring-2 ring-white scale-110' : ''
                              }`}
                            >
                              {company.accentColor === color && <Check size={11} />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Prices Table Underneath the Company */}
                  <div className="flex-1 flex flex-col">
                    <div
                      style={{
                        backgroundColor: theme.headerBannerBg,
                        borderColor: theme.rowDivider,
                        color: theme.mutedText,
                      }}
                      className={`${
                        isPrint ? 'px-3 py-1.5 text-[10px]' : 'px-3.5 py-2 text-[11px]'
                      } border-b flex items-center justify-between font-bold`}
                    >
                      <span>الصنف والوزن</span>
                      <span>السعر</span>
                    </div>

                    <div className="divide-y flex-1" style={{ borderColor: theme.rowDivider }}>
                      {company.items.length === 0 ? (
                        <div
                          style={{ color: theme.mutedText }}
                          className="px-4 py-8 text-center text-xs font-medium"
                        >
                          لا توجد أصناف مسجلة لهذه الشركة بعد
                        </div>
                      ) : (
                        company.items.map((item, itemIdx) => {
                          const available = item.isAvailable !== false;
                          return (
                            <div
                              key={item.id}
                              style={{
                                borderColor: theme.rowDivider,
                              }}
                              className={`group/row ${
                                isPrint ? 'px-3 py-1' : 'px-3.5 py-2'
                              } flex items-center justify-between gap-2 transition-colors ${
                                !available ? 'opacity-55' : ''
                              }`}
                            >
                              {/* Weight / Item Name + Unit (Editable Inline) */}
                              <div className="min-w-0 flex-1">
                                {canEdit ? (
                                  <input
                                    type="text"
                                    value={item.weightLabel}
                                    onChange={e =>
                                      updateItemInCompany(company.id, item.id, {
                                        weightLabel: e.target.value,
                                      })
                                    }
                                    placeholder="اكتب الصنف أو الوزن..."
                                    style={{ fontSize: `${board.config.itemSize}px` }}
                                    className={`w-full font-bold leading-snug bg-transparent border border-transparent hover:border-slate-300/80 dark:hover:border-slate-600 focus:border-sky-500 focus:bg-white/90 dark:focus:bg-slate-800/90 rounded px-1.5 py-0.5 -mx-1.5 focus:outline-none ${
                                      !available ? 'line-through' : ''
                                    }`}
                                  />
                                ) : (
                                  <div
                                    style={{ fontSize: `${board.config.itemSize}px` }}
                                    className={`font-bold leading-snug ${
                                      !available ? 'line-through' : ''
                                    }`}
                                  >
                                    {item.weightLabel}
                                  </div>
                                )}

                                {canEdit ? (
                                  <div
                                    style={{ color: theme.mutedText }}
                                    className="text-[11px] font-medium flex items-center gap-1.5 mt-0.5 flex-wrap"
                                  >
                                    {board.config.showUnits && (
                                      <input
                                        type="text"
                                        value={item.unitLabel || ''}
                                        onChange={e =>
                                          updateItemInCompany(company.id, item.id, {
                                            unitLabel: e.target.value,
                                          })
                                        }
                                        placeholder="الوحدة (حبة/كرتون)"
                                        className="w-24 text-[11px] font-medium bg-transparent border border-transparent hover:border-slate-300/80 dark:hover:border-slate-600 focus:border-sky-500 focus:bg-white/90 dark:focus:bg-slate-800/90 rounded px-1 -mx-1 focus:outline-none"
                                      />
                                    )}
                                    {!available && (
                                      <span className="text-red-500 font-bold">غير متوفر</span>
                                    )}

                                    {/* Row Hover Actions */}
                                    <div className="opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 flex items-center gap-0.5 transition-opacity mr-auto">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateItemInCompany(company.id, item.id, {
                                            isAvailable: !available,
                                          })
                                        }
                                        title={available ? 'تعيين كغير متوفر' : 'تعيين كمتوفر'}
                                        className="p-0.5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700"
                                      >
                                        {available ? <Eye size={12} /> : <EyeOff size={12} />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => moveItemInCompany(company.id, item.id, -1)}
                                        disabled={itemIdx === 0}
                                        title="لأعلى"
                                        className="p-0.5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700 disabled:opacity-30"
                                      >
                                        <ChevronUp size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => moveItemInCompany(company.id, item.id, 1)}
                                        disabled={itemIdx === company.items.length - 1}
                                        title="لأسفل"
                                        className="p-0.5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700 disabled:opacity-30"
                                      >
                                        <ChevronDown size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeItemFromCompany(company.id, item.id)}
                                        title="حذف الصنف"
                                        className="p-0.5 rounded text-red-500 hover:bg-red-500/15"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                ) : (board.config.showUnits && item.unitLabel) || !available ? (
                                  <div
                                    style={{ color: theme.mutedText }}
                                    className="text-[11px] font-medium flex items-center gap-1.5 mt-0.5"
                                  >
                                    {board.config.showUnits && item.unitLabel && (
                                      <span>{item.unitLabel}</span>
                                    )}
                                    {!available && (
                                      <>
                                        {board.config.showUnits && item.unitLabel && (
                                          <span aria-hidden="true">·</span>
                                        )}
                                        <span className="text-red-500 font-bold">غير متوفر</span>
                                      </>
                                    )}
                                  </div>
                                ) : null}
                              </div>

                              {/* Prices (Old Price + Current Price Editable Inline) */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                {board.config.showOldPrices &&
                                  (canEdit ? (
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={item.oldPrice || ''}
                                      onChange={e =>
                                        updateItemInCompany(company.id, item.id, {
                                          oldPrice: e.target.value,
                                        })
                                      }
                                      placeholder="سابق"
                                      style={{ color: theme.mutedText }}
                                      className={`w-12 text-center text-xs line-through tabular-nums font-mono bg-transparent border border-transparent hover:border-slate-300/80 focus:border-sky-500 focus:bg-white/90 dark:focus:bg-slate-800/90 rounded px-1 py-0.5 focus:outline-none ${
                                        !item.oldPrice
                                          ? 'opacity-0 group-hover/row:opacity-65 focus:opacity-100'
                                          : ''
                                      }`}
                                    />
                                  ) : (
                                    item.oldPrice &&
                                    Number(item.oldPrice) > 0 && (
                                      <span
                                        style={{ color: theme.mutedText }}
                                        className="text-xs line-through tabular-nums font-mono"
                                      >
                                        {item.oldPrice}
                                      </span>
                                    )
                                  ))}

                                <div
                                  style={{
                                    color: theme.priceText,
                                    fontSize: `${board.config.priceSize}px`,
                                  }}
                                  className="font-black tabular-nums font-mono flex items-center gap-1 leading-none"
                                >
                                  {canEdit ? (
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={item.price}
                                      onChange={e =>
                                        updateItemInCompany(company.id, item.id, {
                                          price: e.target.value,
                                        })
                                      }
                                      onFocus={e => e.target.select()}
                                      style={{
                                        color: theme.priceText,
                                        fontSize: `${board.config.priceSize}px`,
                                      }}
                                      className="w-20 text-left font-black tabular-nums font-mono bg-transparent border border-transparent hover:border-slate-300/80 dark:hover:border-slate-600 focus:border-sky-500 focus:bg-white/95 dark:focus:bg-slate-800/95 rounded px-1 py-0.5 focus:outline-none leading-none"
                                    />
                                  ) : (
                                    <span>{item.price || '0.00'}</span>
                                  )}

                                  <CurrencySymbolRenderer
                                    type={currencyType}
                                    imageUrl={currencyImage}
                                    color={theme.priceText}
                                    className="inline-block shrink-0"
                                    style={{
                                      width: `${Math.max(
                                        12,
                                        Math.round(board.config.priceSize * 0.65)
                                      )}px`,
                                      height: `${Math.max(
                                        12,
                                        Math.round(board.config.priceSize * 0.65)
                                      )}px`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Quick Weights Picker Drawer inside Card */}
                    {showQuickWeights && (
                      <div
                        style={{ borderColor: theme.rowDivider }}
                        className="p-2.5 border-t bg-slate-50/90 dark:bg-slate-900/70 space-y-1.5"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                          <span>اختر وزناً للإضافة السريعة:</span>
                          <button
                            type="button"
                            onClick={() => setOpenQuickWeightCompanyId(null)}
                            className="p-0.5 hover:text-slate-800"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {QUICK_WEIGHTS.map(w => (
                            <button
                              key={w.weightLabel}
                              type="button"
                              onClick={() => {
                                addItemToCompany(company.id, {
                                  weightLabel: w.weightLabel,
                                  unitLabel: w.unitLabel,
                                  price: '0.00',
                                });
                              }}
                              className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-sky-500 text-[11px] font-bold text-slate-700 dark:text-slate-200"
                            >
                              + {w.weightLabel.replace('دجاج كامل ', '')}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick Inline Add Row Bar directly on Card */}
                    {canEdit && (
                      <div
                        style={{
                          borderColor: theme.rowDivider,
                          color: theme.mutedText,
                        }}
                        className="px-3 py-2 border-t flex items-center justify-between gap-2 text-xs font-bold"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCompanyId(company.id);
                            addItemToCompany(company.id);
                          }}
                          className="flex-1 py-1 px-2 rounded-md hover:bg-sky-500/10 hover:text-sky-600 transition-colors flex items-center justify-center gap-1"
                        >
                          <Plus size={14} />
                          <span>صنف / وزن</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenQuickWeightCompanyId(prev =>
                              prev === company.id ? null : company.id
                            )
                          }
                          className="py-1 px-2 rounded-md hover:bg-slate-500/10 transition-colors whitespace-nowrap text-[11px]"
                        >
                          أوزان جاهزة
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCompanyId(company.id);
                            setShowProductPicker(true);
                          }}
                          className="py-1 px-2 rounded-md hover:bg-slate-500/10 transition-colors whitespace-nowrap text-[11px]"
                        >
                          من المتجر
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}

            {/* Direct "+ Add Company" Tile inside the Grid */}
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowPresetsModal(true)}
                style={{
                  borderColor: theme.cardBorder,
                  color: theme.mutedText,
                }}
                className="min-h-[240px] rounded-xl border-2 border-dashed hover:border-sky-500 hover:text-sky-600 hover:bg-sky-500/5 transition-colors flex flex-col items-center justify-center gap-2 p-6"
              >
                <div className="w-11 h-11 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
                  <Plus size={22} />
                </div>
                <span className="text-sm font-black">إضافة شركة دجاج جديدة</span>
                <span className="text-[11px] font-medium opacity-80">
                  اختر من الشركات الجاهزة أو أضف شركة مخصصة
                </span>
              </button>
            )}
          </div>
        )}

        {/* Board Footer */}
        {board.config.showTaxNote && (
          <div
            style={{ borderColor: theme.rowDivider, color: theme.mutedText }}
            className={`${
              isPrint ? 'mt-3 pt-2.5 text-[11px]' : 'mt-6 pt-4 text-xs'
            } border-t flex flex-wrap items-center justify-between gap-2 font-bold`}
          >
            <span>الأسعار شاملة ضريبة القيمة المضافة · تخضع للتحديث اليومي حسب التوريد</span>
            <span className="tabular-nums">
              إجمالي الأصناف المعروضة:{' '}
              {visibleCompanies.reduce((acc, c) => acc + c.items.length, 0)}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden print:hidden">
      {/* Hidden input for uploading company logo directly from canvas */}
      <input
        ref={canvasLogoUploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUploadCanvasCompanyLogo}
      />

      {/* Studio Top Action Bar */}
      <header className="px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
            <Snowflake size={18} />
          </div>
          <input
            type="text"
            value={board.name}
            onChange={e => setBoard(prev => ({ ...prev, name: e.target.value }))}
            className="font-black text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 w-48 sm:w-60 focus:outline-none focus:border-sky-500"
            placeholder="اسم لوحة الأسعار..."
          />
          <div className="relative hidden xl:block">
            <Search
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={companySearch}
              onChange={e => setCompanySearch(e.target.value)}
              placeholder="بحث عن شركة أو وزن..."
              className="pr-8 pl-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg w-44 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setInlineEditEnabled(prev => !prev)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              inlineEditEnabled
                ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            {inlineEditEnabled ? <Edit3 size={14} /> : <Eye size={14} />}
            <span>{inlineEditEnabled ? 'التعديل المباشر مفعّل' : 'معاينة صافية'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPresetsModal(true)}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Plus size={14} />
            <span>إضافة شركة</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSavedModal(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <FolderOpen size={14} />
            <span>المحفوظة ({savedBoards.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveBoard(false)}
            disabled={isSaving}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>حفظ</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Maximize2 size={14} />
            <span>شاشة عرض</span>
          </button>

          <button
            type="button"
            onClick={handleExportPng}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Download size={14} />
            <span>صورة</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Printer size={14} />
            <span>طباعة</span>
          </button>

          <button
            type="button"
            onClick={() => setShowEditor(prev => !prev)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              showEditor
                ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>{showEditor ? 'إخفاء التخصيص' : 'تخصيص المظهر'}</span>
          </button>
        </div>
      </header>

      {/* Main Split Workspace: Live Multi-Company Board + Side Editor */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Live Board Canvas */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoadingBoards ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 size={28} className="animate-spin text-sky-600" />
              <span className="text-xs font-bold">جاري تحميل لوحة الأسعار...</span>
            </div>
          ) : (
            renderPriceBoardSheet('canvas')
          )}
        </main>

        {/* Side Editor Drawer */}
        {showEditor && (
          <aside className="w-full lg:w-[390px] bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 max-h-[50vh] lg:max-h-full overflow-hidden">
            {/* Editor Tabs */}
            <div className="p-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1 bg-slate-50 dark:bg-slate-950/40 shrink-0">
              <button
                type="button"
                onClick={() => setEditorTab('companies')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  editorTab === 'companies'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                الشركات والأسعار ({board.companies.length})
              </button>
              <button
                type="button"
                onClick={() => setEditorTab('design')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  editorTab === 'design'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                تخطيط الصفحة والمظهر
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {editorTab === 'companies' ? (
                <>
                  {/* Company Selector List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-600 dark:text-slate-300">
                        الشركات المعروضة في الصفحة
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPresetsModal(true)}
                        className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                      >
                        <Plus size={13} /> إضافة شركة
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pl-1">
                      {board.companies.map((comp, index) => {
                        const active = comp.id === selectedCompanyId;
                        return (
                          <div
                            key={comp.id}
                            onClick={() => setSelectedCompanyId(comp.id)}
                            className={`p-2 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                              active
                                ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-300 dark:border-sky-700'
                                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-3 h-3 rounded-sm shrink-0"
                                style={{ backgroundColor: comp.accentColor }}
                              />
                              <span className="text-xs font-bold truncate">{comp.name}</span>
                              <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                                ({comp.items.length})
                              </span>
                            </div>
                            <div
                              className="flex items-center gap-0.5 shrink-0"
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  updateCompany(comp.id, { isVisible: comp.isVisible === false })
                                }
                                title={comp.isVisible === false ? 'إظهار' : 'إخفاء'}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              >
                                {comp.isVisible === false ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => moveCompany(comp.id, -1)}
                                disabled={index === 0}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                              >
                                <ChevronUp size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveCompany(comp.id, 1)}
                                disabled={index === board.companies.length - 1}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                              >
                                <ChevronDown size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => duplicateCompany(comp)}
                                title="نسخ الشركة"
                                className="p-1 text-slate-400 hover:text-sky-600"
                              >
                                <Copy size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeCompany(comp.id)}
                                title="حذف الشركة"
                                className="p-1 text-slate-400 hover:text-red-500"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Company Details & Items */}
                  {activeCompany && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                      <div className="space-y-3">
                        <label className="block text-xs font-black text-slate-600 dark:text-slate-300">
                          بيانات الشركة المحددة
                        </label>
                        <input
                          type="text"
                          value={activeCompany.name}
                          onChange={e => updateCompany(activeCompany.id, { name: e.target.value })}
                          placeholder="اسم الشركة (مثال: ساديا)"
                          className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-sky-500"
                        />
                        <input
                          type="text"
                          value={activeCompany.subtitle || ''}
                          onChange={e =>
                            updateCompany(activeCompany.id, { subtitle: e.target.value })
                          }
                          placeholder="وصف فرعي (مثال: دجاج برازيلي مجمد · حلال)"
                          className="w-full px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-sky-500"
                        />

                        {/* Accent Color & Logo */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {ACCENT_SWATCHES.map(color => (
                              <button
                                key={color}
                                type="button"
                                onClick={() =>
                                  updateCompany(activeCompany.id, { accentColor: color })
                                }
                                style={{ backgroundColor: color }}
                                className={`w-6 h-6 rounded-md flex items-center justify-center text-white transition-transform ${
                                  activeCompany.accentColor === color
                                    ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white scale-110'
                                    : 'opacity-85 hover:opacity-100'
                                }`}
                              >
                                {activeCompany.accentColor === color && <Check size={12} />}
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <input
                              ref={logoUploadRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleUploadCompanyLogo}
                            />
                            <button
                              type="button"
                              onClick={() => logoUploadRef.current?.click()}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1"
                            >
                              <Upload size={12} />
                              <span>شعار</span>
                            </button>
                            {activeCompany.logoUrl && (
                              <button
                                type="button"
                                onClick={() => updateCompany(activeCompany.id, { logoUrl: null })}
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                                title="إزالة الشعار"
                              >
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick Weight Presets & Product Link */}
                      <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-600 dark:text-slate-300">
                            إضافة سريعة للأوزان
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowProductPicker(true)}
                            className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                          >
                            <Search size={12} /> استيراد من أصناف المتجر
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {QUICK_WEIGHTS.map(w => (
                            <button
                              key={w.weightLabel}
                              type="button"
                              onClick={() =>
                                addItemToCompany(activeCompany.id, {
                                  weightLabel: w.weightLabel,
                                  unitLabel: w.unitLabel,
                                  price: '0.00',
                                })
                              }
                              className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-sky-900/40 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-colors"
                            >
                              + {w.weightLabel.replace('دجاج كامل ', '')}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Editable Prices List for Active Company */}
                      <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-600 dark:text-slate-300">
                            أسعار {activeCompany.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => addItemToCompany(activeCompany.id)}
                            className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold flex items-center gap-1"
                          >
                            <Plus size={12} /> صف جديد
                          </button>
                        </div>

                        <div className="space-y-2">
                          {activeCompany.items.map((item, itemIdx) => (
                            <div
                              key={item.id}
                              className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2"
                            >
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={item.weightLabel}
                                  onChange={e =>
                                    updateItemInCompany(activeCompany.id, item.id, {
                                      weightLabel: e.target.value,
                                    })
                                  }
                                  placeholder="الوزن / الصنف"
                                  className="flex-1 px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:border-sky-500"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    moveItemInCompany(activeCompany.id, item.id, -1)
                                  }
                                  disabled={itemIdx === 0}
                                  className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                >
                                  <ChevronUp size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    moveItemInCompany(activeCompany.id, item.id, 1)
                                  }
                                  disabled={itemIdx === activeCompany.items.length - 1}
                                  className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                >
                                  <ChevronDown size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeItemFromCompany(activeCompany.id, item.id)
                                  }
                                  className="p-1 text-slate-400 hover:text-red-500"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>

                              <div className="grid grid-cols-3 gap-1.5">
                                <div>
                                  <span className="block text-[10px] text-slate-400 mb-0.5">
                                    السعر
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={item.price}
                                    onChange={e =>
                                      updateItemInCompany(activeCompany.id, item.id, {
                                        price: e.target.value,
                                      })
                                    }
                                    className="w-full px-2 py-1 text-xs font-black font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-sky-700 dark:text-sky-400 focus:outline-none focus:border-sky-500"
                                  />
                                </div>
                                <div>
                                  <span className="block text-[10px] text-slate-400 mb-0.5">
                                    قبل الخصم
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={item.oldPrice || ''}
                                    onChange={e =>
                                      updateItemInCompany(activeCompany.id, item.id, {
                                        oldPrice: e.target.value,
                                      })
                                    }
                                    placeholder="اختياري"
                                    className="w-full px-2 py-1 text-xs font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:border-sky-500"
                                  />
                                </div>
                                <div>
                                  <span className="block text-[10px] text-slate-400 mb-0.5">
                                    الوحدة
                                  </span>
                                  <input
                                    type="text"
                                    value={item.unitLabel || ''}
                                    onChange={e =>
                                      updateItemInCompany(activeCompany.id, item.id, {
                                        unitLabel: e.target.value,
                                      })
                                    }
                                    placeholder="حبة"
                                    className="w-full px-2 py-1 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:border-sky-500"
                                  />
                                </div>
                              </div>

                              <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 cursor-pointer pt-0.5">
                                <input
                                  type="checkbox"
                                  checked={item.isAvailable !== false}
                                  onChange={e =>
                                    updateItemInCompany(activeCompany.id, item.id, {
                                      isAvailable: e.target.checked,
                                    })
                                  }
                                  className="accent-sky-600 rounded"
                                />
                                <span>متوفر في الثلاجة</span>
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Design & Layout Tab */
                <div className="space-y-5">
                  <div className="space-y-3">
                    <label className="block text-xs font-black text-slate-600 dark:text-slate-300">
                      عنوان الصفحة والتاريخ
                    </label>
                    <input
                      type="text"
                      value={board.title}
                      onChange={e => setBoard(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="العنوان الرئيسي للوحة"
                      className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                    <input
                      type="text"
                      value={board.subtitle || ''}
                      onChange={e => setBoard(prev => ({ ...prev, subtitle: e.target.value }))}
                      placeholder="وصف مختصر أسفل العنوان"
                      className="w-full px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                    <input
                      type="date"
                      value={board.date}
                      onChange={e => setBoard(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                  </div>

                  {/* Columns per Row */}
                  <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <label className="block text-xs font-black text-slate-600 dark:text-slate-300">
                      عدد الشركات في الصف الواحد
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                      {([2, 3, 4] as const).map(cols => (
                        <button
                          key={cols}
                          type="button"
                          onClick={() =>
                            setBoard(prev => ({
                              ...prev,
                              config: { ...prev.config, columns: cols },
                            }))
                          }
                          className={`py-2 rounded-md text-xs font-bold transition-colors ${
                            board.config.columns === cols
                              ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-sm'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {cols} شركات
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Themes */}
                  <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <label className="block text-xs font-black text-slate-600 dark:text-slate-300">
                      نمط الألوان
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(THEME_STYLES) as FrozenChickenThemeId[]).map(key => {
                        const th = THEME_STYLES[key];
                        const active = board.config.theme === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              setBoard(prev => ({
                                ...prev,
                                config: { ...prev.config, theme: key },
                              }))
                            }
                            className={`p-2.5 rounded-lg border text-right flex items-center gap-2.5 transition-colors ${
                              active
                                ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/30'
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span
                              className="w-5 h-5 rounded border shrink-0"
                              style={{
                                backgroundColor: th.pageBg,
                                borderColor: th.cardBorder,
                              }}
                            />
                            <span className="text-xs font-bold truncate">{th.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Font Scales */}
                  <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <label className="block text-xs font-black text-slate-600 dark:text-slate-300">
                      أحجام الخطوط
                    </label>
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                        <span>اسم الشركة</span>
                        <span className="tabular-nums">{board.config.titleSize}px</span>
                      </div>
                      <input
                        type="range"
                        min={14}
                        max={28}
                        value={board.config.titleSize}
                        onChange={e =>
                          setBoard(prev => ({
                            ...prev,
                            config: { ...prev.config, titleSize: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-sky-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                        <span>الوزن / الصنف</span>
                        <span className="tabular-nums">{board.config.itemSize}px</span>
                      </div>
                      <input
                        type="range"
                        min={12}
                        max={22}
                        value={board.config.itemSize}
                        onChange={e =>
                          setBoard(prev => ({
                            ...prev,
                            config: { ...prev.config, itemSize: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-sky-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                        <span>السعر</span>
                        <span className="tabular-nums">{board.config.priceSize}px</span>
                      </div>
                      <input
                        type="range"
                        min={14}
                        max={30}
                        value={board.config.priceSize}
                        onChange={e =>
                          setBoard(prev => ({
                            ...prev,
                            config: { ...prev.config, priceSize: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-sky-600"
                      />
                    </div>
                  </div>

                  {/* Display Toggles */}
                  <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <label className="block text-xs font-black text-slate-600 dark:text-slate-300">
                      خيارات العرض
                    </label>
                    {[
                      { key: 'showHeader' as const, label: 'إظهار ترويسة الصفحة' },
                      { key: 'showDate' as const, label: 'إظهار التاريخ' },
                      { key: 'showUnits' as const, label: 'إظهار الوحدة (حبة / كرتون)' },
                      { key: 'showOldPrices' as const, label: 'إظهار السعر السابق عند العرض' },
                      { key: 'showTaxNote' as const, label: 'إظهار ملاحظة شمول الضريبة' },
                    ].map(opt => (
                      <label
                        key={opt.key}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 cursor-pointer text-xs font-bold"
                      >
                        <span>{opt.label}</span>
                        <input
                          type="checkbox"
                          checked={board.config[opt.key]}
                          onChange={e =>
                            setBoard(prev => ({
                              ...prev,
                              config: { ...prev.config, [opt.key]: e.target.checked },
                            }))
                          }
                          className="accent-sky-600 w-4 h-4"
                        />
                      </label>
                    ))}
                  </div>

                  {/* Print Settings */}
                  <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <label className="block text-xs font-black text-slate-600 dark:text-slate-300">
                      إعدادات الطباعة (A4)
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                      {([
                        { id: 'auto', label: 'تلقائي' },
                        { id: 'portrait', label: 'عمودي' },
                        { id: 'landscape', label: 'أفقي' },
                      ] as const).map(orient => {
                        const active = (board.config.printOrientation || 'auto') === orient.id;
                        return (
                          <button
                            key={orient.id}
                            type="button"
                            onClick={() =>
                              setBoard(prev => ({
                                ...prev,
                                config: { ...prev.config, printOrientation: orient.id },
                              }))
                            }
                            className={`py-1.5 rounded-md text-xs font-bold transition-colors ${
                              active
                                ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {orient.label}
                          </button>
                        );
                      })}
                    </div>
                    <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 cursor-pointer text-xs font-bold">
                      <span>طباعة جميع الجداول في صفحة واحدة</span>
                      <input
                        type="checkbox"
                        checked={board.config.printSinglePage !== false}
                        onChange={e =>
                          setBoard(prev => ({
                            ...prev,
                            config: { ...prev.config, printSinglePage: e.target.checked },
                          }))
                        }
                        className="accent-sky-600 w-4 h-4"
                      />
                    </label>
                  </div>

                  {/* Board Utility Actions */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveBoard(true)}
                      className="flex-1 py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <Copy size={13} /> حفظ كنسخة
                    </button>
                    <button
                      type="button"
                      onClick={handleNewEmptyBoard}
                      className="flex-1 py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <FilePlus size={13} /> لوحة جديدة
                    </button>
                    <button
                      type="button"
                      onClick={handleResetStarter}
                      className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-300"
                    >
                      <RotateCcw size={13} /> استعادة قائمة الشركات الجاهزة
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Add Company Modal (Presets or Custom) */}
      {showPresetsModal && (
        <div
          onClick={() => setShowPresetsModal(false)}
          className="fixed inset-0 z-[1500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm">
                <Building2 size={18} className="text-sky-600" />
                <span>إضافة شركة دجاج مجمد</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPresetsModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                اختر شركة جاهزة لإضافتها فوراً مع الأوزان الافتراضية، أو أنشئ شركة مخصصة:
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {COMPANY_PRESETS.map(preset => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleAddCompany(preset)}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-sky-500 bg-slate-50 dark:bg-slate-800/60 text-right flex items-center gap-3 transition-colors"
                  >
                    <span
                      className="w-8 h-8 rounded-lg text-white font-black flex items-center justify-center shrink-0 text-sm"
                      style={{ backgroundColor: preset.accentColor }}
                    >
                      {preset.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-black truncate">{preset.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {preset.subtitle}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => handleAddCompany()}
                className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-sky-600 hover:bg-black dark:hover:bg-sky-700 text-white text-xs font-black flex items-center justify-center gap-2 transition-colors"
              >
                <Plus size={15} />
                <span>إضافة شركة باسم مخصص</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Catalog Picker Modal */}
      {showProductPicker && activeCompany && (
        <div
          onClick={() => setShowProductPicker(false)}
          className="fixed inset-0 z-[1500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="font-black text-sm">
                استيراد صنف إلى ({activeCompany.name})
              </div>
              <button
                type="button"
                onClick={() => setShowProductPicker(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  autoFocus
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="ابحث باسم الصنف أو الباركود..."
                  className="w-full pr-9 pl-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStoreProducts.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-bold">
                  لا توجد أصناف مطابقة في قاعدة البيانات
                </div>
              ) : (
                filteredStoreProducts.map(prod => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleSelectProductFromCatalog(prod)}
                    className="w-full px-4 py-3 text-right hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{prod.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{prod.code}</div>
                    </div>
                    <span className="text-xs font-black font-mono tabular-nums text-sky-600 shrink-0">
                      {prod.price || '0.00'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Saved Boards Modal */}
      {showSavedModal && (
        <div
          onClick={() => setShowSavedModal(false)}
          className="fixed inset-0 z-[1500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm">
                <FolderOpen size={17} className="text-sky-600" />
                <span>اللوحات المحفوظة</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSavedModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {savedBoards.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-400 font-bold">
                  لا توجد لوحات محفوظة حتى الآن. اضغط على "حفظ" لحفظ اللوحة الحالية.
                </div>
              ) : (
                savedBoards.map(sb => (
                  <div
                    key={sb.id}
                    className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div
                      onClick={() => {
                        setBoard(sb);
                        setSelectedCompanyId(sb.companies?.[0]?.id || '');
                        setShowSavedModal(false);
                        notify(`تم فتح لوحة "${sb.name}"`, 'info');
                      }}
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="text-sm font-black truncate">{sb.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{sb.companies?.length || 0} شركات</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{sb.date}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteSavedBoard(sb.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                      title="حذف"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Offscreen Print Height Measurement Box */}
      <div
        ref={printMeasureRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: '-30000px',
          width: `${printBaseMeasureWidth}px`,
          visibility: 'hidden',
          pointerEvents: 'none',
          zIndex: -1,
        }}
        className="print:hidden"
      >
        {renderPriceBoardSheet('print')}
      </div>

      {/* Fullscreen TV Signage Overlay */}
      {isFullscreen &&
        createPortal(
          <div
            style={{ backgroundColor: theme.pageBg }}
            className="fixed inset-0 z-[9000] overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="fixed bottom-5 left-5 z-[9010] px-4 py-2 rounded-xl bg-slate-900/85 hover:bg-black text-white text-xs font-bold backdrop-blur-md shadow-xl flex items-center gap-2 transition-colors"
            >
              <Minimize2 size={15} />
              <span>إنهاء العرض (Esc)</span>
            </button>
            {renderPriceBoardSheet('tv')}
          </div>,
          document.body
        )}

      {/* Print Portal Overlay (Single-page fit & anti-split rules) */}
      {printRoot &&
        createPortal(
          <div
            id="chicken-print-wrapper"
            dir="rtl"
            style={
              printSinglePage && printFit.scaledHeightPx
                ? {
                    width: '100%',
                    height: `${printFit.scaledHeightPx}px`,
                    position: 'relative',
                    overflow: 'hidden',
                    breakInside: 'avoid',
                    pageBreakInside: 'avoid',
                  }
                : {
                    width: '100%',
                    position: 'relative',
                  }
            }
          >
            <style>{`
              @page {
                size: A4 ${effectivePrintOrientation};
                margin: 5mm;
              }
              @media print {
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  height: auto !important;
                  min-height: 0 !important;
                  background: #ffffff !important;
                }
                #print-container {
                  width: 100% !important;
                  height: auto !important;
                  min-height: 0 !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  overflow: ${printSinglePage ? 'hidden' : 'visible'} !important;
                }
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  animation: none !important;
                  transition: none !important;
                }
              }
            `}</style>
            <div
              style={
                printFit.scale < 1
                  ? {
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: `${(100 / printFit.scale).toFixed(4)}%`,
                      transform: `scale(${printFit.scale})`,
                      transformOrigin: 'top right',
                    }
                  : { width: '100%' }
              }
            >
              {renderPriceBoardSheet('print')}
            </div>
          </div>,
          printRoot
        )}
    </div>
  );
};
