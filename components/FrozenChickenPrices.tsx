import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  const [showEditor, setShowEditor] = useState(true);
  const [editorTab, setEditorTab] = useState<'companies' | 'design'>('companies');
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveTime, setLiveTime] = useState(() => new Date());

  const boardCanvasRef = useRef<HTMLDivElement>(null);
  const logoUploadRef = useRef<HTMLInputElement>(null);
  const [printRoot] = useState(() =>
    typeof document !== 'undefined' ? document.getElementById('print-container') : null
  );

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
    setShowEditor(true);
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

  const handleExportPng = async () => {
    if (!boardCanvasRef.current) return;
    try {
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

  // Reusable Multi-Company Board Sheet (Rendered in Canvas, Fullscreen, and Print Portal)
  const renderPriceBoardSheet = (forPrintOrTv: boolean) => (
    <div
      ref={!forPrintOrTv ? boardCanvasRef : undefined}
      style={{
        backgroundColor: theme.pageBg,
        color: theme.pageText,
        borderColor: theme.cardBorder,
      }}
      className={`w-full transition-colors ${
        forPrintOrTv
          ? 'p-6 sm:p-8 min-h-full'
          : 'rounded-2xl border p-5 sm:p-8 shadow-sm'
      }`}
    >
      {/* Page Header */}
      {board.config.showHeader && (
        <div
          style={{ borderColor: theme.rowDivider }}
          className="pb-5 mb-6 border-b flex flex-col sm:flex-row sm:items-end justify-between gap-4"
        >
          <div className="space-y-1">
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
                  <span className="tabular-nums">{board.date}</span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-balance">
              {board.title || 'أسعار الدجاج المجمد'}
            </h1>
            {board.subtitle && (
              <p style={{ color: theme.mutedText }} className="text-xs sm:text-sm font-medium">
                {board.subtitle}
              </p>
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
        <div className="py-20 text-center">
          <Snowflake size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-base font-bold">لا توجد شركات ظاهرة حالياً</p>
          <p style={{ color: theme.mutedText }} className="text-xs mt-1">
            أضف شركة جديدة أو امسح نص البحث لإظهار الشركات.
          </p>
        </div>
      ) : (
        <div className={`grid ${gridColumnsClass} gap-5 items-stretch`}>
          {visibleCompanies.map(company => {
            const isSelected = !forPrintOrTv && selectedCompanyId === company.id;
            return (
              <section
                key={company.id}
                onClick={() => {
                  if (!forPrintOrTv) {
                    setSelectedCompanyId(company.id);
                    setEditorTab('companies');
                  }
                }}
                style={{
                  backgroundColor: theme.cardBg,
                  borderColor: isSelected ? company.accentColor : theme.cardBorder,
                }}
                className={`flex flex-col rounded-xl border overflow-hidden transition-all ${
                  !forPrintOrTv ? 'cursor-pointer hover:-translate-y-0.5' : ''
                } ${isSelected ? 'ring-2 ring-offset-1 ring-sky-500/40' : ''}`}
              >
                {/* Company Header Bar */}
                <div
                  style={{
                    backgroundColor: company.accentColor,
                  }}
                  className="px-4 py-3.5 text-white flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {company.logoUrl ? (
                      <img
                        src={company.logoUrl}
                        alt={company.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-lg object-contain bg-white p-1 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0 font-black text-base">
                        {company.name.trim().charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2
                        style={{ fontSize: `${board.config.titleSize}px` }}
                        className="font-black leading-tight truncate"
                      >
                        {company.name}
                      </h2>
                      {company.subtitle && (
                        <p className="text-[11px] font-medium text-white/85 truncate mt-0.5">
                          {company.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-white/80 tabular-nums shrink-0">
                    {company.items.length} أصناف
                  </span>
                </div>

                {/* Prices Table Underneath the Company */}
                <div className="flex-1 flex flex-col">
                  <div
                    style={{
                      backgroundColor: theme.headerBannerBg,
                      borderColor: theme.rowDivider,
                      color: theme.mutedText,
                    }}
                    className="px-4 py-2 border-b flex items-center justify-between text-[11px] font-bold"
                  >
                    <span>الوزن / الصنف</span>
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
                      company.items.map(item => {
                        const available = item.isAvailable !== false;
                        return (
                          <div
                            key={item.id}
                            style={{
                              borderColor: theme.rowDivider,
                            }}
                            className={`px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                              !available ? 'opacity-50' : ''
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div
                                style={{ fontSize: `${board.config.itemSize}px` }}
                                className={`font-bold leading-snug ${
                                  !available ? 'line-through' : ''
                                }`}
                              >
                                {item.weightLabel}
                              </div>
                              {(board.config.showUnits && item.unitLabel) || !available ? (
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

                            <div className="flex items-baseline gap-2 shrink-0">
                              {board.config.showOldPrices &&
                                item.oldPrice &&
                                Number(item.oldPrice) > 0 && (
                                  <span
                                    style={{ color: theme.mutedText }}
                                    className="text-xs line-through tabular-nums font-mono"
                                  >
                                    {item.oldPrice}
                                  </span>
                                )}
                              <div
                                style={{
                                  color: theme.priceText,
                                  fontSize: `${board.config.priceSize}px`,
                                }}
                                className="font-black tabular-nums font-mono flex items-center gap-1 leading-none"
                              >
                                <span>{item.price || '0.00'}</span>
                                <CurrencySymbolRenderer
                                  type={currencyType}
                                  imageUrl={currencyImage}
                                  color={theme.priceText}
                                  className="inline-block"
                                  style={{
                                    width: `${Math.max(12, Math.round(board.config.priceSize * 0.65))}px`,
                                    height: `${Math.max(12, Math.round(board.config.priceSize * 0.65))}px`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Quick Inline Add Row Button in Edit Mode */}
                  {!forPrintOrTv && showEditor && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedCompanyId(company.id);
                        addItemToCompany(company.id);
                      }}
                      style={{
                        borderColor: theme.rowDivider,
                        color: theme.mutedText,
                      }}
                      className="w-full py-2 px-4 border-t text-xs font-bold hover:text-sky-600 transition-colors flex items-center justify-center gap-1.5 print:hidden"
                    >
                      <Plus size={14} />
                      <span>إضافة وزن / صنف</span>
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Board Footer */}
      {board.config.showTaxNote && (
        <div
          style={{ borderColor: theme.rowDivider, color: theme.mutedText }}
          className="mt-6 pt-4 border-t flex flex-wrap items-center justify-between gap-2 text-xs font-bold"
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

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden print:hidden">
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
            className="font-black text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 w-52 sm:w-64 focus:outline-none focus:border-sky-500"
            placeholder="اسم لوحة الأسعار..."
          />
          <div className="relative hidden md:block">
            <Search
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={companySearch}
              onChange={e => setCompanySearch(e.target.value)}
              placeholder="بحث عن شركة أو وزن..."
              className="pr-8 pl-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg w-48 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
            onClick={() => window.print()}
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
            <span>{showEditor ? 'إخفاء المحرر' : 'إظهار المحرر'}</span>
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
            renderPriceBoardSheet(false)
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
            {renderPriceBoardSheet(true)}
          </div>,
          document.body
        )}

      {/* Print Portal Overlay */}
      {printRoot && createPortal(renderPriceBoardSheet(true), printRoot)}
    </div>
  );
};
