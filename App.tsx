import React, { useState, useEffect, useCallback, Component, ErrorInfo, useMemo, useRef } from 'react';
import { ProductManager } from './components/ProductManager';
import { UnitManager } from './components/UnitManager';
import { ProductListBuilder } from './components/ProductListBuilder';
import { Dashboard } from './components/Dashboard';
import { BranchManager } from './components/BranchManager';
import { SalesRecorder } from './components/SalesRecorder';
import { ReportsCenter } from './components/ReportsCenter';
import { AdvancedReports } from './components/AdvancedReports';
import { Settings } from './components/Settings';
import { DatabaseManager } from './components/DatabaseManager';
import { PriceTagGenerator } from './components/PriceTagGenerator';
import { OfferGenerator } from './components/OfferGenerator';
import { PriceGroupManager } from './components/PriceGroupManager';
import { CatalogGenerator } from './components/CatalogGenerator';
import { SettlementManager } from './components/SettlementManager';
import { POSManagement } from './components/POSManagement';
import { POSInterface } from './components/POSInterface';
import { ExpenseManager } from './components/ExpenseManager';
import { SupplierManager } from './components/SupplierManager';
import { PurchaseOrderManager } from './components/PurchaseOrderManager';
import { CustomerManager } from './components/CustomerManager';
import { PromotionsManager } from './components/PromotionsManager';
import { MobileInventory } from './components/MobileInventory';
import { ReturnsManager } from './components/ReturnsManager';
import { MarketPriceDiscoverer } from './components/MarketPriceDiscoverer';
import { CustomerTrusts } from './components/CustomerTrusts';
import { LanguageProvider, useLanguage } from './components/LanguageContext';
import { LoginScreen } from './components/LoginScreen';
import { UserManager } from './components/UserManager';
import { UserProfile } from './components/UserProfile';
import { ActivityLogViewer } from './components/ActivityLog';
import { InstallApp } from './components/InstallApp';
import { NotificationProvider, useNotification } from './components/Notifications';
import { SystemSettingsProvider, useSystemSettings } from './components/SystemSettingsContext';
import { DesktopWindow, WindowBounds, WindowSnapPreset, computeSnapBounds } from './components/DesktopWindow';
import { FileManager, DesktopAppDef, VfsNode, loadVfsNodes } from './components/FileManager';
import {
  DesktopWidgets,
  DesktopWidgetId,
  DESKTOP_WIDGET_CATALOG,
  DEFAULT_ACTIVE_WIDGETS,
} from './components/DesktopWidgets';
import { Product, Unit, Branch, DailySales, User, Permission, CatalogProject } from './types';
import { db } from './services/supabase';
import {
  Package, Ruler, LayoutDashboard, FileText, DollarSign,
  Settings as SettingsIcon, Tag, Layout,
  Percent, Wallet, LogOut, Users, BookOpen, Monitor,
  ShoppingBag, TrendingDown, Moon, Sun, Loader2, Keyboard, Search,
  Building2, Calculator, Truck, BarChart4, Receipt, AlertTriangle, Star,
  Trash2, History, RotateCcw, Archive, CheckCircle2,
  FolderOpen, HardDrive, Folder, FolderPlus, RefreshCw, Image as ImageIcon,
  Layers, Minimize2, X, Languages, Database, ExternalLink,
  Power, ChevronLeft, ChevronRight, SlidersHorizontal, Maximize2,
  LayoutGrid, ArrowUpDown, Plus, Check, ChevronUp, ChevronDown
} from 'lucide-react';
import { THEMES, AppTheme } from './utils/themes';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { Calculator as CalculatorComponent } from './components/Calculator';

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 text-gray-800 p-4 text-center" dir="rtl">
          <div className="bg-red-100 p-4 rounded-full mb-4">
            <AlertTriangle size={48} className="text-red-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">حدث خطأ غير متوقع</h1>
          <p className="text-gray-600 mb-6">نعتذر عن هذا الخطأ. يرجى محاولة تحديث الصفحة.</p>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 max-w-lg w-full overflow-auto text-left mb-6" dir="ltr">
            <pre className="text-xs text-red-500 font-mono">{this.state.error?.toString()}</pre>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-sap-primary text-white rounded-lg hover:bg-sap-primary-hover transition-colors font-bold"
          >
            تحديث الصفحة
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

interface DesktopWindowState {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  color: string;
  bounds: WindowBounds;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
}

type WallpaperKey =
  | 'win11_bloom_dark'
  | 'win11_bloom_light'
  | 'slate_pro'
  | 'emerald_horizon'
  | 'burgundy_exec'
  | 'nordic_daylight'
  | 'custom';

const WALLPAPERS: Record<
  Exclude<WallpaperKey, 'custom'>,
  { name: string; isLight: boolean; className: string; bloomStyle?: string; gridColor: string }
> = {
  win11_bloom_dark: {
    name: 'ويندوز 11 — بلوم الليلي',
    isLight: false,
    className: 'bg-[#071124]',
    bloomStyle:
      'radial-gradient(circle at 52% 48%, rgba(56, 189, 248, 0.34) 0%, rgba(37, 99, 235, 0.24) 28%, rgba(30, 58, 138, 0.14) 52%, transparent 74%), radial-gradient(circle at 38% 62%, rgba(99, 102, 241, 0.26) 0%, transparent 52%), radial-gradient(circle at 68% 36%, rgba(14, 165, 233, 0.22) 0%, transparent 45%)',
    gridColor: 'rgba(148, 163, 184, 0.025)',
  },
  win11_bloom_light: {
    name: 'ويندوز 11 — بلوم النهاري',
    isLight: true,
    className: 'bg-gradient-to-br from-[#DCEBFB] via-[#EBF3FE] to-[#D4E6FA]',
    bloomStyle:
      'radial-gradient(circle at 52% 48%, rgba(59, 130, 246, 0.26) 0%, rgba(96, 165, 250, 0.18) 32%, transparent 66%), radial-gradient(circle at 65% 38%, rgba(14, 165, 233, 0.18) 0%, transparent 48%)',
    gridColor: 'rgba(15, 23, 42, 0.02)',
  },
  slate_pro: {
    name: 'سليت احترافي (داكن)',
    isLight: false,
    className: 'bg-gradient-to-br from-[#0B1120] via-[#151F32] to-[#0F172A]',
    gridColor: 'rgba(148, 163, 184, 0.04)',
  },
  emerald_horizon: {
    name: 'الأفق الزمردي',
    isLight: false,
    className: 'bg-gradient-to-br from-[#041C18] via-[#0B2E28] to-[#06181A]',
    gridColor: 'rgba(52, 211, 153, 0.04)',
  },
  burgundy_exec: {
    name: 'عنابي تنفيذي',
    isLight: false,
    className: 'bg-gradient-to-br from-[#160B10] via-[#26121A] to-[#111827]',
    gridColor: 'rgba(197, 160, 89, 0.04)',
  },
  nordic_daylight: {
    name: 'نهار مكتبي (فاتح)',
    isLight: true,
    className: 'bg-gradient-to-br from-[#E2E8F0] via-[#EEF2F6] to-[#DDE5EE]',
    gridColor: 'rgba(15, 23, 42, 0.03)',
  },
};

const DENSE_MAXIMIZED_APPS = new Set([
  'pos',
  'products',
  'list',
  'offers',
  'price_tags',
  'price_groups',
  'catalog',
  'reports_center',
  'advanced_reports',
  'dashboard',
  'sales_entry',
]);

const AppContent: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const { settings, updateSettings } = useSystemSettings();
  const { notify } = useNotification();

  const [showCalculator, setShowCalculator] = useState(false);
  const [showStartMenu, setShowStartMenu] = useState(false);
  const [startSearch, setStartSearch] = useState('');
  const [startShowAllApps, setStartShowAllApps] = useState(false);
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [showWindowMenu, setShowWindowMenu] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [viewCatalogId, setViewCatalogId] = useState<string | null>(null);
  const [viewCatalogData, setViewCatalogData] = useState<CatalogProject | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);

  const [hiddenApps, setHiddenApps] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sf_hidden_apps');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [wallpaper, setWallpaper] = useState<WallpaperKey>(() => {
    const saved = localStorage.getItem('sf_desktop_wallpaper') as WallpaperKey;
    if (saved === 'custom' || (saved && saved in WALLPAPERS)) return saved;
    return 'win11_bloom_dark';
  });

  const [customWallpaperUrl, setCustomWallpaperUrl] = useState<string>(() => {
    return localStorage.getItem('sf_custom_wallpaper') || '';
  });

  const [iconSize, setIconSize] = useState<'sm' | 'md' | 'lg'>(() => {
    return (localStorage.getItem('sf_desktop_icon_size') as 'sm' | 'md' | 'lg') || 'md';
  });

  const [desktopAlignFlow, setDesktopAlignFlow] = useState<'vertical' | 'horizontal'>(() => {
    return (localStorage.getItem('sf_desktop_align_flow_v1') as 'vertical' | 'horizontal') || 'vertical';
  });

  const [desktopIconOrder, setDesktopIconOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sf_desktop_icon_order_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [draggedDesktopIconId, setDraggedDesktopIconId] = useState<string | null>(null);
  const [dragOverDesktopIconId, setDragOverDesktopIconId] = useState<string | null>(null);

  const [activeWidgets, setActiveWidgets] = useState<DesktopWidgetId[]>(() => {
    try {
      const saved = localStorage.getItem('sf_desktop_widgets_v1');
      if (saved) {
        const parsed: DesktopWidgetId[] = JSON.parse(saved);
        if (!localStorage.getItem('sf_widgets_expiry_migrated_v1')) {
          localStorage.setItem('sf_widgets_expiry_migrated_v1', '1');
          if (!parsed.includes('expiry_alerts')) {
            const idx = parsed.indexOf('sales_pulse');
            if (idx !== -1) parsed.splice(idx + 1, 0, 'expiry_alerts');
            else parsed.push('expiry_alerts');
            localStorage.setItem('sf_desktop_widgets_v1', JSON.stringify(parsed));
          }
        }
        return parsed;
      }
      return DEFAULT_ACTIVE_WIDGETS;
    } catch {
      return DEFAULT_ACTIVE_WIDGETS;
    }
  });
  const [showDesktopWidgets, setShowDesktopWidgets] = useState<boolean>(() => {
    const saved = localStorage.getItem('sf_show_desktop_widgets_v1');
    return saved !== 'false';
  });
  const [showWidgetsBoard, setShowWidgetsBoard] = useState(false);
  const [showWidgetPickerModal, setShowWidgetPickerModal] = useState(false);

  const [selectedDesktopIcon, setSelectedDesktopIcon] = useState<string | null>(null);
  const [desktopContextMenu, setDesktopContextMenu] = useState<{
    x: number;
    y: number;
    appId?: string;
    nodeId?: string;
  } | null>(null);

  const [vfsNodes, setVfsNodes] = useState<VfsNode[]>(() => loadVfsNodes());
  const refreshVfs = () => setVfsNodes(loadVfsNodes());
  const [fileManagerFolder, setFileManagerFolder] = useState<string>('this_pc');

  // Window Manager State
  const [openWindows, setOpenWindows] = useState<DesktopWindowState[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const topZRef = useRef<number>(100);

  // Live Clock
  const [nowTime, setNowTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [targetListParams, setTargetListParams] = useState<{ listId: string; rowId?: string } | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [dailySales, setDailySales] = useState<DailySales[]>([]);

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('sf_theme') === 'dark');
  const [showCmdPalette, setShowCmdPalette] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [cmdSelectedIdx, setCmdSelectedIdx] = useState(0);
  const [osConfirmDialog, setOsConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const [newFolderModal, setNewFolderModal] = useState<{ open: boolean; name: string }>({
    open: false,
    name: '',
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sf_favorites');
      return saved ? JSON.parse(saved) : ['file_manager', 'pos', 'products'];
    } catch {
      return ['file_manager', 'pos', 'products'];
    }
  });

  const wallpaperUploadRef = useRef<HTMLInputElement>(null);

  const COLORS = {
    GOLD: '#C5A059',
    BURGUNDY: '#800020',
    DARK_GRAY: '#334155',
    SLATE: '#475569',
    BLUE: '#0284C7',
    EMERALD: '#059669',
  };

  // Grouped Apps Definition (includes File Manager & Recycle Bin)
  const appGroups: Array<{
    title: string;
    apps: Array<{
      id: string;
      label: string;
      icon: React.ComponentType<{ size?: number | string; className?: string }>;
      color: string;
      permission?: Permission;
      permissions?: Permission[];
    }>;
  }> = useMemo(
    () => [
      {
        title: 'النظام والملفات',
        apps: [
          { id: 'file_manager', label: t('nav.file_manager'), icon: FolderOpen, color: COLORS.BLUE },
          { id: 'recycle_bin', label: t('nav.recycle_bin'), icon: Trash2, color: COLORS.SLATE },
          { id: 'user_profile', label: 'الملف الشخصي', icon: Users, color: COLORS.DARK_GRAY },
        ],
      },
      {
        title: t('nav.sales'),
        apps: [
          { id: 'pos', label: t('nav.pos'), icon: ShoppingBag, color: COLORS.GOLD, permission: 'record_sales' },
          { id: 'sales_entry', label: t('nav.sales'), icon: DollarSign, color: COLORS.BURGUNDY, permission: 'record_sales' },
          { id: 'returns', label: t('nav.returns'), icon: RotateCcw, color: COLORS.SLATE, permission: 'manage_returns' },
          { id: 'customers', label: t('nav.customers'), icon: Users, color: COLORS.DARK_GRAY, permission: 'manage_customers' },
          { id: 'customer_trusts', label: 'أمانات العملاء', icon: Archive, color: COLORS.GOLD, permission: 'manage_customers' },
        ],
      },
      {
        title: t('nav.inventory'),
        apps: [
          { id: 'products', label: t('nav.products'), icon: Package, color: COLORS.DARK_GRAY, permissions: ['view_products', 'manage_products'] },
          { id: 'list', label: t('nav.inventory'), icon: FileText, color: COLORS.BURGUNDY, permission: 'manage_products' },
          { id: 'mobile_inventory', label: t('nav.mobile_inventory'), icon: Package, color: COLORS.GOLD, permission: 'manage_products' },
          { id: 'market_prices', label: 'مكتشف الأسعار', icon: Search, color: COLORS.SLATE, permissions: ['view_products', 'manage_products'] },
          { id: 'units', label: t('nav.units'), icon: Ruler, color: COLORS.SLATE, permission: 'manage_products' },
          { id: 'suppliers', label: t('nav.suppliers'), icon: Truck, color: COLORS.GOLD, permission: 'manage_suppliers' },
          { id: 'purchase_orders', label: t('nav.purchase_orders'), icon: ShoppingBag, color: COLORS.DARK_GRAY, permission: 'manage_purchase_orders' },
        ],
      },
      {
        title: t('nav.reports'),
        apps: [
          { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, color: COLORS.BURGUNDY, permission: 'view_dashboard' },
          { id: 'reports_center', label: t('nav.reports'), icon: BarChart4, color: COLORS.GOLD, permission: 'view_reports' },
          { id: 'advanced_reports', label: 'تقارير متقدمة', icon: BarChart4, color: COLORS.BURGUNDY, permission: 'view_advanced_reports' },
          { id: 'settlement', label: t('nav.settlement'), icon: Wallet, color: COLORS.DARK_GRAY, permission: 'manage_settlements' },
          { id: 'expenses', label: t('nav.expenses'), icon: TrendingDown, color: COLORS.BURGUNDY, permission: 'manage_expenses' },
        ],
      },
      {
        title: t('nav.promotions'),
        apps: [
          { id: 'promotions', label: t('nav.promotions'), icon: Percent, color: COLORS.BURGUNDY, permission: 'manage_products' },
          { id: 'offers', label: t('nav.offers'), icon: Percent, color: COLORS.GOLD, permission: 'print_labels' },
          { id: 'price_tags', label: t('nav.price_tags'), icon: Tag, color: COLORS.DARK_GRAY, permission: 'print_labels' },
          { id: 'catalog', label: t('nav.catalog'), icon: BookOpen, color: COLORS.GOLD, permission: 'print_labels' },
          { id: 'price_groups', label: t('nav.price_groups'), icon: Monitor, color: COLORS.SLATE, permission: 'print_labels' },
        ],
      },
      {
        title: t('nav.settings'),
        apps: [
          { id: 'users', label: t('nav.users'), icon: Users, color: COLORS.DARK_GRAY, permission: 'manage_users' },
          { id: 'branches', label: t('nav.branches'), icon: Building2, color: COLORS.BURGUNDY, permission: 'manage_branches' },
          { id: 'pos_setup', label: t('nav.pos_setup'), icon: Calculator, color: COLORS.SLATE, permission: 'manage_settlements' },
          { id: 'settings', label: t('nav.settings'), icon: SettingsIcon, color: COLORS.GOLD, permission: 'manage_settings' },
          { id: 'database', label: t('nav.database'), icon: Layout, color: COLORS.DARK_GRAY, permission: 'manage_database' },
          { id: 'activity_log', label: t('nav.activity_log'), icon: History, color: COLORS.BURGUNDY, permission: 'manage_settings' },
        ],
      },
    ],
    [t]
  );

  const hasPermission = useCallback(
    (perm: Permission) => (!currentUser ? false : currentUser.role === 'admin' ? true : currentUser.permissions.includes(perm)),
    [currentUser]
  );

  const hasAnyPermission = useCallback(
    (perms: Permission[]) => (!currentUser ? false : currentUser.role === 'admin' ? true : perms.some(p => currentUser.permissions.includes(p))),
    [currentUser]
  );

  const flattenApps: DesktopAppDef[] = useMemo(() => {
    const out: DesktopAppDef[] = [];
    appGroups.forEach(group => {
      group.apps.forEach((app: any) => {
        if (app.permission && !hasPermission(app.permission)) return;
        if (app.permissions && !hasAnyPermission(app.permissions)) return;
        out.push({
          id: app.id,
          label: app.label,
          groupTitle: group.title,
          icon: app.icon,
          color: app.color,
        });
      });
    });
    return out;
  }, [appGroups, hasPermission, hasAnyPermission]);

  const toggleAppVisibility = (appId: string) => {
    setHiddenApps(prev => {
      const isHidden = prev.includes(appId);
      const newHidden = isHidden ? prev.filter(id => id !== appId) : [...prev, appId];
      localStorage.setItem('sf_hidden_apps', JSON.stringify(newHidden));
      return newHidden;
    });
  };

  const toggleFavorite = (appId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites(prev => {
      const newFavs = prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId];
      localStorage.setItem('sf_favorites', JSON.stringify(newFavs));
      return newFavs;
    });
  };

  // --- Window Manager Operations ---
  const handleFocusWindow = useCallback((winId: string) => {
    topZRef.current += 1;
    const nextZ = topZRef.current;
    setOpenWindows(prev =>
      prev.map(w => (w.id === winId ? { ...w, isMinimized: false, zIndex: nextZ } : w))
    );
    setActiveWindowId(winId);
  }, []);

  const handleOpenApp = useCallback(
    (rawAppId: string, folderOverride?: string) => {
      setShowStartMenu(false);
      setShowQuickSettings(false);
      setShowWindowMenu(false);
      setShowCmdPalette(false);
      setShowWidgetsBoard(false);
      setDesktopContextMenu(null);

      let targetId = rawAppId;
      if (rawAppId === 'recycle_bin') {
        setFileManagerFolder('recycle_bin');
        targetId = 'file_manager';
      } else if (rawAppId === 'file_manager' && folderOverride) {
        setFileManagerFolder(folderOverride);
      } else if (rawAppId === 'file_manager') {
        setFileManagerFolder('this_pc');
      }

      const appMeta =
        flattenApps.find(a => a.id === targetId) ||
        (targetId === 'user_profile'
          ? { id: 'user_profile', label: 'الملف الشخصي', groupTitle: 'النظام والملفات', icon: Users, color: COLORS.GOLD }
          : null);

      if (!appMeta) return;

      setOpenWindows(prev => {
        const existing = prev.find(w => w.id === targetId);
        topZRef.current += 1;
        const nextZ = topZRef.current;

        if (existing) {
          return prev.map(w => (w.id === targetId ? { ...w, isMinimized: false, zIndex: nextZ } : w));
        }

        const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
        const vh = typeof window !== 'undefined' ? window.innerHeight - 48 : 720;
        const defaultW = Math.min(targetId === 'file_manager' ? 1120 : 1060, Math.max(480, vw - 80));
        const defaultH = Math.min(targetId === 'file_manager' ? 680 : 660, Math.max(360, vh - 64));
        const offset = (prev.length % 6) * 26;
        const startX = Math.max(16, Math.round((vw - defaultW) / 2) + offset - 40);
        const startY = Math.max(12, Math.round((vh - defaultH) / 2) + offset - 20);

        const newWin: DesktopWindowState = {
          id: targetId,
          title: appMeta.label,
          subtitle: targetId === 'file_manager' ? 'مستكشف الملفات والبيانات' : appMeta.groupTitle,
          icon: appMeta.icon,
          color: appMeta.color,
          bounds: { x: startX, y: startY, width: defaultW, height: defaultH },
          isMinimized: false,
          isMaximized: DENSE_MAXIMIZED_APPS.has(targetId),
          zIndex: nextZ,
        };
        return [...prev, newWin];
      });

      setActiveWindowId(targetId);
    },
    [flattenApps]
  );

  const forceCloseWindow = useCallback(
    (winId: string) => {
      if ((window as any).sf_unsaved_changes) {
        (window as any).sf_unsaved_changes[winId] = false;
      }
      setOpenWindows(prev => {
        const remaining = prev.filter(w => w.id !== winId);
        if (activeWindowId === winId) {
          const topVisible = [...remaining]
            .filter(w => !w.isMinimized)
            .sort((a, b) => b.zIndex - a.zIndex)[0];
          setActiveWindowId(topVisible ? topVisible.id : null);
        }
        return remaining;
      });
    },
    [activeWindowId]
  );

  const handleCloseWindow = useCallback(
    (winId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      if ((window as any).sf_unsaved_changes?.[winId]) {
        const targetWin = openWindows.find(w => w.id === winId);
        setOsConfirmDialog({
          title: 'تغييرات غير محفوظة',
          message: `يوجد تعديلات غير محفوظة في نافذة "${targetWin?.title || 'التطبيق'}". هل تريد الإغلاق دون حفظ؟`,
          confirmLabel: 'إغلاق دون حفظ',
          danger: true,
          onConfirm: () => {
            forceCloseWindow(winId);
            setOsConfirmDialog(null);
          },
        });
        return;
      }
      forceCloseWindow(winId);
    },
    [forceCloseWindow, openWindows]
  );

  const handleMinimizeWindow = useCallback(
    (winId: string) => {
      setOpenWindows(prev => {
        const next = prev.map(w => (w.id === winId ? { ...w, isMinimized: true } : w));
        if (activeWindowId === winId) {
          const topVisible = [...next]
            .filter(w => !w.isMinimized)
            .sort((a, b) => b.zIndex - a.zIndex)[0];
          setActiveWindowId(topVisible ? topVisible.id : null);
        }
        return next;
      });
    },
    [activeWindowId]
  );

  const handleMaximizeToggle = useCallback((winId: string) => {
    topZRef.current += 1;
    const nextZ = topZRef.current;
    setOpenWindows(prev =>
      prev.map(w => (w.id === winId ? { ...w, isMaximized: !w.isMaximized, zIndex: nextZ } : w))
    );
    setActiveWindowId(winId);
  }, []);

  const handleMoveWindow = useCallback((winId: string, x: number, y: number) => {
    setOpenWindows(prev => prev.map(w => (w.id === winId ? { ...w, bounds: { ...w.bounds, x, y } } : w)));
  }, []);

  const handleResizeWindow = useCallback((winId: string, bounds: WindowBounds) => {
    setOpenWindows(prev => prev.map(w => (w.id === winId ? { ...w, bounds } : w)));
  }, []);

  const handleSnapWindow = useCallback((winId: string, preset: WindowSnapPreset) => {
    topZRef.current += 1;
    const nextZ = topZRef.current;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight - 48 : 720;
    const { bounds, isMaximized } = computeSnapBounds(preset, vw, vh);

    setOpenWindows(prev =>
      prev.map(w =>
        w.id !== winId
          ? w
          : {
              ...w,
              isMinimized: false,
              isMaximized,
              zIndex: nextZ,
              bounds,
            }
      )
    );
    setActiveWindowId(winId);
  }, []);

  const handleTaskbarWindowClick = (win: DesktopWindowState) => {
    if (win.isMinimized) {
      handleFocusWindow(win.id);
    } else if (activeWindowId === win.id) {
      handleMinimizeWindow(win.id);
    } else {
      handleFocusWindow(win.id);
    }
  };

  const handleShowDesktop = () => {
    const anyVisible = openWindows.some(w => !w.isMinimized);
    if (anyVisible) {
      setOpenWindows(prev => prev.map(w => ({ ...w, isMinimized: true })));
      setActiveWindowId(null);
    } else if (openWindows.length > 0) {
      setOpenWindows(prev => prev.map(w => ({ ...w, isMinimized: false })));
      const top = [...openWindows].sort((a, b) => b.zIndex - a.zIndex)[0];
      if (top) setActiveWindowId(top.id);
    }
  };

  const handleCascadeWindows = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight - 48;
    const w = Math.min(980, vw - 100);
    const h = Math.min(620, vh - 80);
    setOpenWindows(prev =>
      prev.map((win, idx) => ({
        ...win,
        isMinimized: false,
        isMaximized: false,
        bounds: {
          x: 24 + (idx % 6) * 32,
          y: 20 + (idx % 6) * 32,
          width: w,
          height: h,
        },
        zIndex: topZRef.current + idx + 1,
      }))
    );
    topZRef.current += openWindows.length + 2;
    setShowWindowMenu(false);
  };

  const handleTileWindows = () => {
    const visible = openWindows.filter(w => !w.isMinimized);
    const targets = visible.length > 0 ? visible : openWindows;
    if (targets.length === 0) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight - 48;
    const cols = targets.length === 1 ? 1 : 2;
    const rows = Math.ceil(targets.length / cols);
    const cellW = Math.floor(vw / cols);
    const cellH = Math.floor(vh / rows);

    setOpenWindows(prev =>
      prev.map(win => {
        const idx = targets.findIndex(t => t.id === win.id);
        if (idx === -1) return win;
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        return {
          ...win,
          isMinimized: false,
          isMaximized: false,
          bounds: {
            x: col * cellW + 4,
            y: row * cellH + 4,
            width: cellW - 8,
            height: cellH - 8,
          },
        };
      })
    );
    setShowWindowMenu(false);
  };

  const handleSplitPairWindows = (mode: 'even' | 'wide_right') => {
    const sorted = [...openWindows].sort((a, b) => b.zIndex - a.zIndex);
    const visible = sorted.filter(w => !w.isMinimized);
    const pair = (visible.length >= 2 ? visible : sorted).slice(0, 2);
    if (pair.length === 0) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight - 48;
    const primaryWin = pair[0];
    const secondaryWin = pair[1];
    const primaryPreset: WindowSnapPreset = mode === 'wide_right' ? 'right_wide' : 'right';
    const secondaryPreset: WindowSnapPreset = mode === 'wide_right' ? 'left_narrow' : 'left';
    const pGeom = computeSnapBounds(primaryPreset, vw, vh);
    const sGeom = computeSnapBounds(secondaryPreset, vw, vh);

    setOpenWindows(prev =>
      prev.map(w => {
        if (w.id === primaryWin.id) {
          return { ...w, isMinimized: false, isMaximized: false, bounds: pGeom.bounds, zIndex: topZRef.current + 2 };
        }
        if (secondaryWin && w.id === secondaryWin.id) {
          return { ...w, isMinimized: false, isMaximized: false, bounds: sGeom.bounds, zIndex: topZRef.current + 1 };
        }
        return w;
      })
    );
    topZRef.current += 3;
    setActiveWindowId(primaryWin.id);
    setShowWindowMenu(false);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCmdPalette(prev => {
          const next = !prev;
          if (next) {
            setCmdQuery('');
            setCmdSelectedIdx(0);
          }
          return next;
        });
      }
      if (e.key === 'Escape') {
        setShowCmdPalette(false);
        setShowStartMenu(false);
        setShowQuickSettings(false);
        setShowWindowMenu(false);
        setShowWidgetsBoard(false);
        setShowWidgetPickerModal(false);
        setDesktopContextMenu(null);
        setOsConfirmDialog(null);
        setNewFolderModal({ open: false, name: '' });
      }
      if (e.altKey && activeWindowId) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleSnapWindow(activeWindowId, 'right');
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handleSnapWindow(activeWindowId, 'left');
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          handleSnapWindow(activeWindowId, 'maximize');
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          handleSnapWindow(activeWindowId, 'center');
        }
      }
      if (e.altKey && (e.key === 'w' || e.key === 'W' || e.key === 'ص')) {
        if (activeWindowId) {
          handleCloseWindow(activeWindowId);
        }
      }
      if (e.altKey && !isNaN(parseInt(e.key)) && parseInt(e.key) > 0) {
        const index = parseInt(e.key) - 1;
        if (index < openWindows.length) {
          handleFocusWindow(openWindows[index].id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeWindowId, openWindows, handleCloseWindow, handleFocusWindow, handleSnapWindow]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sf_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('sf_theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    const closeOverlays = () => {
      setDesktopContextMenu(null);
    };
    window.addEventListener('click', closeOverlays);
    return () => window.removeEventListener('click', closeOverlays);
  }, []);

  // Init & Auth
  useEffect(() => {
    const performInit = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const catId = params.get('catalog');
        if (catId) {
          setAuthChecking(false);
          setIsCatalogLoading(true);
          setViewCatalogId(catId);
          try {
            const catalog = await Promise.race([
              db.catalogs.get(catId),
              new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
            ]).catch(() => null);
            if (catalog) setViewCatalogData(catalog as CatalogProject);
            else {
              notify('المجلة غير موجودة أو تم حذفها', 'warning');
              setViewCatalogId(null);
            }
          } catch {
            setViewCatalogId(null);
          } finally {
            setIsCatalogLoading(false);
          }
          return;
        }
        try {
          await Promise.race([
            db.auth.initAdminIfNeeded(),
            new Promise((_, reject) => setTimeout(() => reject('DB_TIMEOUT'), 3000)),
          ]);
        } catch {
          console.warn('DB Init warning');
        }
        const savedUserStr = localStorage.getItem('sf_user_session');
        if (savedUserStr) {
          try {
            setCurrentUser(JSON.parse(savedUserStr));
          } catch {
            localStorage.removeItem('sf_user_session');
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setAuthChecking(false);
      }
    };
    const failsafeTimer = setTimeout(() => {
      setAuthChecking(false);
    }, 4000);
    performInit().then(() => clearTimeout(failsafeTimer));
    return () => clearTimeout(failsafeTimer);
  }, []);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const isConnected = await db.testConnection();
      setDbStatus(isConnected ? 'connected' : 'error');
      const [u, p, b, s] = await Promise.all([
        db.units.getAll(),
        db.products.getAll(),
        db.branches.getAll(),
        db.dailySales.getAll(),
      ]);
      setUnits(u as Unit[]);
      setProducts(p as Product[]);
      setBranches(b as Branch[]);
      const sales = s as DailySales[];
      if (currentUser.role === 'admin') setDailySales(sales);
      else if (currentUser.branchId) setDailySales(sales.filter(sale => sale.branchId === currentUser.branchId));
      else setDailySales([]);
    } catch {
      setDbStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) fetchData();
  }, [currentUser, fetchData]);

  const handleLogin = async (username: string, pass: string): Promise<boolean> => {
    try {
      const user = await db.auth.login(username);
      if (user && user.password === pass) {
        if (user.role !== 'admin' && !user.isActive) {
          notify('هذا الحساب غير نشط حالياً. تواصل مع المدير.', 'warning');
          return false;
        }
        const safeUser: User = {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          branchId: user.branchId,
          permissions: user.permissions,
          isActive: user.isActive,
        };
        setCurrentUser(safeUser);
        localStorage.setItem('sf_user_session', JSON.stringify(safeUser));
        return true;
      }
      if (username.trim() === 'admin' && pass.trim() === 'admin123') {
        const safeUser: User = {
          id: 'default-admin',
          username: 'admin',
          fullName: 'المدير العام',
          role: 'admin',
          permissions: [
            'manage_users', 'view_dashboard', 'view_products', 'manage_products',
            'manage_branches', 'record_sales', 'view_reports', 'manage_settlements',
            'print_labels', 'manage_settings', 'manage_database',
          ],
          isActive: true,
        };
        setCurrentUser(safeUser);
        localStorage.setItem('sf_user_session', JSON.stringify(safeUser));
        return true;
      }
    } catch (e) {
      console.warn('Login attempt note:', e);
    }
    return false;
  };

  const handleGoogleLogin = async (): Promise<{ success: boolean; error?: string; errorCode?: string }> => {
    try {
      const user = await db.auth.loginWithGoogle();
      if (user) {
        if (user.role !== 'admin' && !user.isActive) {
          notify('هذا الحساب غير نشط حالياً. تواصل مع المدير.', 'warning');
          return { success: false, error: 'الحساب غير نشط' };
        }
        const safeUser: User = {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          branchId: user.branchId,
          permissions: user.permissions,
          isActive: user.isActive,
        };
        setCurrentUser(safeUser);
        localStorage.setItem('sf_user_session', JSON.stringify(safeUser));
        return { success: true };
      }
      return { success: false };
    } catch (e: any) {
      return {
        success: false,
        errorCode: e?.code || (e?.message?.includes('auth/configuration-not-found') ? 'auth/configuration-not-found' : ''),
        error: e?.message || 'خطأ أثناء تسجيل الدخول بواسطة جوجل',
      };
    }
  };

  const handleDemoLogin = (role: 'admin' | 'user' = 'admin') => {
    const demoUser: User = {
      id: `demo-${role}-${Date.now()}`,
      username: role === 'admin' ? 'admin' : 'google.user',
      fullName: role === 'admin' ? 'المدير العام' : 'مستخدم جوجل (تجريبي)',
      role,
      isActive: true,
      permissions:
        role === 'admin'
          ? [
              'manage_users', 'view_dashboard', 'view_products', 'manage_products',
              'manage_branches', 'record_sales', 'view_reports', 'manage_settlements',
              'print_labels', 'manage_settings', 'manage_database',
            ]
          : ['view_dashboard', 'view_products', 'record_sales', 'view_reports'],
    };
    setCurrentUser(demoUser);
    localStorage.setItem('sf_user_session', JSON.stringify(demoUser));
    return true;
  };

  const handleLogout = () => {
    setShowStartMenu(false);
    setOsConfirmDialog({
      title: 'تسجيل الخروج',
      message: 'هل تريد إنهاء جلستك الحالية والعودة إلى شاشة تسجيل الدخول؟',
      confirmLabel: 'تسجيل الخروج',
      danger: true,
      onConfirm: () => {
        localStorage.removeItem('sf_user_session');
        setCurrentUser(null);
        setOsConfirmDialog(null);
        window.location.reload();
      },
    });
  };

  const handleProfileUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('sf_user_session', JSON.stringify(updatedUser));
  };

  const handleNavigateToList = (listId: string, rowId?: string) => {
    setTargetListParams({ listId, rowId });
    handleOpenApp('list');
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  const handleSelectWallpaper = (key: WallpaperKey) => {
    setWallpaper(key);
    localStorage.setItem('sf_desktop_wallpaper', key);
  };

  const handleUploadWallpaper = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      notify('يرجى اختيار صورة أقل من 3 ميجابايت', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setCustomWallpaperUrl(dataUrl);
      localStorage.setItem('sf_custom_wallpaper', dataUrl);
      handleSelectWallpaper('custom');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCreateDesktopFolder = () => {
    setNewFolderModal({ open: true, name: 'مجلد جديد' });
  };

  const confirmCreateDesktopFolder = () => {
    const trimmed = newFolderModal.name.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    const current = loadVfsNodes();
    const newFolder: VfsNode = {
      id: `vfs_${crypto.randomUUID()}`,
      parentId: 'desktop',
      name: trimmed,
      kind: 'folder',
      sizeBytes: 0,
      createdAt: now,
      updatedAt: now,
      isPinnedToDesktop: true,
    };
    const next = [newFolder, ...current];
    localStorage.setItem('sf_vfs_nodes_v1', JSON.stringify(next));
    setVfsNodes(next);
    setNewFolderModal({ open: false, name: '' });
  };

  // Desktop Icons List & Ordering (computed unconditionally before early returns for Rules of Hooks)
  const visibleDesktopApps = useMemo(
    () => flattenApps.filter(app => !hiddenApps.includes(app.id)),
    [flattenApps, hiddenApps]
  );
  const pinnedVfsDesktopItems = useMemo(
    () => vfsNodes.filter(n => !n.isDeleted && (n.parentId === 'desktop' || n.isPinnedToDesktop)),
    [vfsNodes]
  );

  type DesktopIconEntry =
    | { kind: 'app'; id: string; label: string; groupTitle: string; app: DesktopAppDef }
    | { kind: 'vfs'; id: string; label: string; groupTitle: string; node: VfsNode };

  const orderedDesktopEntries: DesktopIconEntry[] = useMemo(() => {
    const raw: DesktopIconEntry[] = [
      ...visibleDesktopApps.map(app => ({
        kind: 'app' as const,
        id: app.id,
        label: app.label,
        groupTitle: app.groupTitle,
        app,
      })),
      ...pinnedVfsDesktopItems.map(node => ({
        kind: 'vfs' as const,
        id: node.id,
        label: node.name,
        groupTitle: 'الملفات والمجلدات',
        node,
      })),
    ];

    if (desktopIconOrder.length === 0) return raw;
    const rankMap = new Map<string, number>();
    desktopIconOrder.forEach((id, idx) => rankMap.set(id, idx));

    return [...raw].sort((a, b) => {
      const ra = rankMap.get(a.id);
      const rb = rankMap.get(b.id);
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra !== undefined) return -1;
      if (rb !== undefined) return 1;
      return 0;
    });
  }, [visibleDesktopApps, pinnedVfsDesktopItems, desktopIconOrder]);

  if (authChecking || isCatalogLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950 text-white">
        <Loader2 className="animate-spin text-sap-secondary" size={44} />
      </div>
    );
  }
  if (viewCatalogId && viewCatalogData) return <CatalogGenerator products={[]} units={[]} viewModeData={viewCatalogData} />;
  if (!currentUser) return <LoginScreen onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} onDemoLogin={handleDemoLogin} />;

  const persistDesktopIconOrder = (nextOrder: string[]) => {
    setDesktopIconOrder(nextOrder);
    try {
      if (nextOrder.length === 0) {
        localStorage.removeItem('sf_desktop_icon_order_v1');
      } else {
        localStorage.setItem('sf_desktop_icon_order_v1', JSON.stringify(nextOrder));
      }
    } catch {
      // ignore storage errors
    }
  };

  const reorderDesktopIconByDrop = (draggedId: string, targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const currentIds = orderedDesktopEntries.map(e => e.id);
    const fromIdx = currentIds.indexOf(draggedId);
    const toIdx = currentIds.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const nextIds = [...currentIds];
    const [moved] = nextIds.splice(fromIdx, 1);
    nextIds.splice(toIdx, 0, moved);
    persistDesktopIconOrder(nextIds);
  };

  const moveDesktopIconStep = (id: string, delta: -1 | 1) => {
    const currentIds = orderedDesktopEntries.map(e => e.id);
    const idx = currentIds.indexOf(id);
    if (idx === -1) return;
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= currentIds.length) return;
    const nextIds = [...currentIds];
    const [moved] = nextIds.splice(idx, 1);
    nextIds.splice(nextIdx, 0, moved);
    persistDesktopIconOrder(nextIds);
  };

  const sortDesktopIcons = (mode: 'name' | 'group' | 'favorites' | 'default') => {
    if (mode === 'default') {
      persistDesktopIconOrder([]);
      return;
    }
    const next = [...orderedDesktopEntries];
    if (mode === 'name') {
      next.sort((a, b) => a.label.localeCompare(b.label, 'ar'));
    } else if (mode === 'group') {
      next.sort((a, b) => {
        const g = a.groupTitle.localeCompare(b.groupTitle, 'ar');
        return g !== 0 ? g : a.label.localeCompare(b.label, 'ar');
      });
    } else if (mode === 'favorites') {
      next.sort((a, b) => {
        const fa = a.kind === 'app' && favorites.includes(a.id) ? 0 : 1;
        const fb = b.kind === 'app' && favorites.includes(b.id) ? 0 : 1;
        if (fa !== fb) return fa - fb;
        return a.label.localeCompare(b.label, 'ar');
      });
    }
    persistDesktopIconOrder(next.map(e => e.id));
  };

  const persistActiveWidgets = (next: DesktopWidgetId[]) => {
    setActiveWidgets(next);
    try {
      localStorage.setItem('sf_desktop_widgets_v1', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const toggleDesktopWidget = (id: DesktopWidgetId) => {
    const exists = activeWidgets.includes(id);
    const next = exists ? activeWidgets.filter(w => w !== id) : [...activeWidgets, id];
    persistActiveWidgets(next);
  };

  const toggleDesktopWidgetsVisibility = (visible?: boolean) => {
    const next = typeof visible === 'boolean' ? visible : !showDesktopWidgets;
    setShowDesktopWidgets(next);
    try {
      localStorage.setItem('sf_show_desktop_widgets_v1', String(next));
    } catch {
      // ignore
    }
  };

  const toggleDesktopAlignFlow = (flow: 'vertical' | 'horizontal') => {
    setDesktopAlignFlow(flow);
    try {
      localStorage.setItem('sf_desktop_align_flow_v1', flow);
    } catch {
      // ignore
    }
  };

  const isLightWallpaper = wallpaper === 'nordic_daylight' || wallpaper === 'win11_bloom_light';
  const activeWallpaperConfig = wallpaper !== 'custom' ? WALLPAPERS[wallpaper] : null;

  const filteredCmdApps = flattenApps.filter(i =>
    i.label.toLowerCase().includes(cmdQuery.toLowerCase()) ||
    i.groupTitle.toLowerCase().includes(cmdQuery.toLowerCase())
  );

  const filteredStartApps = flattenApps.filter(i =>
    i.label.toLowerCase().includes(startSearch.toLowerCase()) ||
    i.groupTitle.toLowerCase().includes(startSearch.toLowerCase())
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = dailySales.filter(s => (s.date || '').startsWith(todayStr));
  const todayAmount =
    todaySales.reduce((sum, s) => sum + Math.round((Number(s.totalAmount ?? s.amount) || 0) * 100), 0) / 100;
  const canViewDashboard = hasPermission('view_dashboard');

  const timeFormatted = nowTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const dateFormatted = nowTime.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });

  const iconBoxSize =
    iconSize === 'sm' ? 'w-11 h-11' : iconSize === 'lg' ? 'w-14 h-14' : 'w-12 h-12';
  const iconGlyphSize = iconSize === 'sm' ? 20 : iconSize === 'lg' ? 26 : 23;
  const iconTileWidth = iconSize === 'sm' ? 'w-22' : iconSize === 'lg' ? 'w-28' : 'w-24';

  const renderWindowAppContent = (appId: string) => {
    switch (appId) {
      case 'file_manager':
        return (
          <FileManager
            apps={flattenApps.filter(a => a.id !== 'file_manager' && a.id !== 'recycle_bin')}
            products={products}
            units={units}
            branches={branches}
            dailySales={dailySales}
            currentUser={currentUser}
            favorites={favorites}
            hiddenApps={hiddenApps}
            initialFolder={fileManagerFolder}
            onOpenApp={(id) => handleOpenApp(id)}
            onNavigateToList={handleNavigateToList}
            onToggleFavorite={(id) => toggleFavorite(id)}
            onToggleDesktopPin={(id) => toggleAppVisibility(id)}
            onVfsChanged={refreshVfs}
          />
        );
      case 'dashboard':
        return <Dashboard products={products} units={units} switchToTab={(tab) => handleOpenApp(tab)} onNavigateToList={handleNavigateToList} currentUser={currentUser} />;
      case 'pos':
        return <POSInterface products={products} setDailySales={setDailySales} currentUser={currentUser} />;
      case 'returns':
        return <ReturnsManager products={products} currentUser={currentUser} sales={dailySales} />;
      case 'products':
        return <ProductManager products={products} setProducts={setProducts} units={units} setUnits={setUnits} currentUser={currentUser} />;
      case 'market_prices':
        return <MarketPriceDiscoverer />;
      case 'mobile_inventory':
        return <MobileInventory products={products} setProducts={setProducts} units={units} onClose={() => handleCloseWindow('mobile_inventory')} />;
      case 'promotions':
        return <PromotionsManager products={products} />;
      case 'expenses':
        return <ExpenseManager />;
      case 'customers':
        return <CustomerManager />;
      case 'customer_trusts':
        return <CustomerTrusts products={products} />;
      case 'suppliers':
        return <SupplierManager />;
      case 'purchase_orders':
        return <PurchaseOrderManager />;
      case 'list':
        return (
          <ProductListBuilder
            products={products}
            setProducts={setProducts}
            units={units}
            onNewProductsAdded={fetchData}
            initialListParams={targetListParams}
            clearInitialParams={() => setTargetListParams(null)}
          />
        );
      case 'sales_entry':
        return (
          <SalesRecorder
            branches={currentUser.role === 'admin' ? branches : branches.filter(b => b.id === currentUser.branchId)}
            sales={dailySales}
            setSales={setDailySales}
          />
        );
      case 'reports_center':
        return (
          <ReportsCenter
            branches={currentUser.role === 'admin' ? branches : branches.filter(b => b.id === currentUser.branchId)}
            sales={dailySales}
            products={products}
            units={units}
          />
        );
      case 'advanced_reports':
        return (
          <AdvancedReports
            branches={currentUser.role === 'admin' ? branches : branches.filter(b => b.id === currentUser.branchId)}
            sales={dailySales}
            products={products}
            units={units}
          />
        );
      case 'settlement':
        return <SettlementManager currentUser={currentUser} />;
      case 'pos_setup':
        return <POSManagement branches={branches} />;
      case 'branches':
        return <BranchManager branches={branches} setBranches={setBranches} sales={dailySales} />;
      case 'units':
        return <UnitManager units={units} setUnits={setUnits} />;
      case 'database':
        return <DatabaseManager />;
      case 'settings':
        return <Settings />;
      case 'user_profile':
        return <UserProfile user={currentUser} onUpdate={handleProfileUpdate} />;
      case 'users':
        return <UserManager currentUser={currentUser} branches={branches} />;
      case 'price_tags':
        return <PriceTagGenerator products={products} units={units} />;
      case 'offers':
        return <OfferGenerator products={products} units={units} />;
      case 'price_groups':
        return <PriceGroupManager />;
      case 'catalog':
        return <CatalogGenerator products={products} units={units} />;
      case 'activity_log':
        return <ActivityLogViewer />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`relative h-screen w-screen overflow-hidden flex flex-col font-sans print:h-auto print:bg-white print:text-black print:overflow-visible ${
        darkMode ? 'dark' : ''
      }`}
    >
      {/* Hidden Wallpaper File Input */}
      <input
        ref={wallpaperUploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUploadWallpaper}
      />

      {/* DESKTOP CANVAS */}
      <div
        onClick={() => {
          setSelectedDesktopIcon(null);
          setShowStartMenu(false);
          setShowQuickSettings(false);
          setShowWindowMenu(false);
          setShowWidgetsBoard(false);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setDesktopContextMenu({ x: e.clientX, y: e.clientY });
        }}
        style={
          wallpaper === 'custom' && customWallpaperUrl
            ? { backgroundImage: `url(${customWallpaperUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : activeWallpaperConfig?.bloomStyle
            ? { backgroundImage: activeWallpaperConfig.bloomStyle }
            : activeWallpaperConfig
            ? {
                backgroundImage: `linear-gradient(to right, ${activeWallpaperConfig.gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${activeWallpaperConfig.gridColor} 1px, transparent 1px)`,
                backgroundSize: '48px 48px',
              }
            : undefined
        }
        className={`flex-1 relative overflow-hidden select-none print:hidden ${
          activeWallpaperConfig ? activeWallpaperConfig.className : 'bg-slate-900'
        }`}
      >
        {wallpaper === 'custom' && (
          <div className="absolute inset-0 bg-black/25 pointer-events-none" />
        )}

        {/* Desktop Icons Grid (Unified Draggable Apps + Pinned Files/Folders) */}
        <div
          className={`relative z-10 h-full w-full p-4 sm:p-5 ${
            showDesktopWidgets ? 'xl:pl-[356px]' : ''
          } overflow-y-auto ${
            desktopAlignFlow === 'vertical' ? 'md:overflow-x-auto md:overflow-y-hidden' : ''
          } custom-scrollbar`}
        >
          <div
            className={
              desktopAlignFlow === 'vertical'
                ? 'flex flex-wrap md:flex-col md:flex-wrap content-start gap-2.5 md:h-full'
                : 'flex flex-wrap content-start gap-2.5'
            }
          >
            {orderedDesktopEntries.map(entry => {
              const isSelected = selectedDesktopIcon === entry.id;
              const isDragging = draggedDesktopIconId === entry.id;
              const isDragOver = dragOverDesktopIconId === entry.id && draggedDesktopIconId !== entry.id;

              const IconComp =
                entry.kind === 'app'
                  ? entry.app.icon
                  : entry.node.kind === 'folder'
                  ? Folder
                  : FileText;
              const iconBg =
                entry.kind === 'app'
                  ? entry.app.color
                  : entry.node.kind === 'folder'
                  ? '#D97706'
                  : '#475569';

              const openEntry = () => {
                if (entry.kind === 'app') {
                  handleOpenApp(entry.id);
                } else {
                  handleOpenApp('file_manager', entry.node.kind === 'folder' ? entry.node.id : 'desktop');
                }
              };

              return (
                <button
                  key={entry.id}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    setDraggedDesktopIconId(entry.id);
                    setSelectedDesktopIcon(entry.id);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/desktop-icon-id', entry.id);
                  }}
                  onDragOver={(e) => {
                    if (!draggedDesktopIconId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverDesktopIconId !== entry.id) {
                      setDragOverDesktopIconId(entry.id);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverDesktopIconId === entry.id) {
                      setDragOverDesktopIconId(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const sourceId = draggedDesktopIconId || e.dataTransfer.getData('text/desktop-icon-id');
                    if (sourceId) {
                      reorderDesktopIconByDrop(sourceId, entry.id);
                    }
                    setDraggedDesktopIconId(null);
                    setDragOverDesktopIconId(null);
                  }}
                  onDragEnd={() => {
                    setDraggedDesktopIconId(null);
                    setDragOverDesktopIconId(null);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDesktopIcon(entry.id);
                    if (window.innerWidth < 768) {
                      openEntry();
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    openEntry();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      openEntry();
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedDesktopIcon(entry.id);
                    setDesktopContextMenu(
                      entry.kind === 'app'
                        ? { x: e.clientX, y: e.clientY, appId: entry.id }
                        : { x: e.clientX, y: e.clientY, nodeId: entry.id }
                    );
                  }}
                  className={`${iconTileWidth} p-2 rounded-lg flex flex-col items-center gap-1.5 transition-all border text-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0078D4] ${
                    isDragging ? 'opacity-40 scale-95' : ''
                  } ${
                    isDragOver
                      ? 'ring-2 ring-[#0078D4] bg-[#0078D4]/25 border-[#60CDFF] scale-105'
                      : isSelected
                      ? isLightWallpaper
                        ? 'bg-slate-900/12 border-slate-900/25'
                        : 'bg-white/15 border-white/25 backdrop-blur-xs'
                      : isLightWallpaper
                      ? 'border-transparent hover:bg-slate-900/8'
                      : 'border-transparent hover:bg-white/10'
                  }`}
                >
                  <div
                    className={`${iconBoxSize} rounded-xl flex items-center justify-center text-white shadow-md shrink-0 pointer-events-none`}
                    style={{ backgroundColor: iconBg }}
                  >
                    <IconComp size={iconGlyphSize} />
                  </div>
                  <span
                    className={`text-[11px] font-bold leading-snug line-clamp-2 w-full pointer-events-none ${
                      isLightWallpaper
                        ? 'text-slate-900'
                        : 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]'
                    }`}
                  >
                    {entry.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop Interactive App Widgets Stack (Top-Left in RTL on xl+ screens) */}
        {showDesktopWidgets ? (
          <div
            onClick={(e) => e.stopPropagation()}
            className="hidden xl:flex flex-col w-80 fixed top-5 left-5 max-h-[calc(100vh-84px)] z-10 overflow-y-auto custom-scrollbar pr-0.5"
          >
            <DesktopWidgets
              variant="desktop"
              isLightSurface={isLightWallpaper}
              activeWidgets={activeWidgets}
              onReorderWidgets={persistActiveWidgets}
              onToggleWidget={toggleDesktopWidget}
              onOpenPickerModal={() => setShowWidgetPickerModal(true)}
              onHideDesktopWidgets={() => toggleDesktopWidgetsVisibility(false)}
              timeFormatted={timeFormatted}
              dateFormatted={dateFormatted}
              userFullName={currentUser.fullName}
              products={products}
              dailySales={dailySales}
              permittedApps={flattenApps}
              favorites={favorites}
              onOpenApp={(appId) => handleOpenApp(appId)}
              onNavigateToList={handleNavigateToList}
              onOpenSearch={() => {
                setCmdQuery('');
                setCmdSelectedIdx(0);
                setShowCmdPalette(true);
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleDesktopWidgetsVisibility(true);
            }}
            className={`hidden xl:flex items-center gap-1.5 fixed top-5 left-5 z-10 px-3 py-1.5 rounded-xl border backdrop-blur-2xl text-xs font-bold shadow-lg transition-colors ${
              isLightWallpaper
                ? 'bg-white/85 border-slate-300/80 text-slate-800 hover:bg-white'
                : 'bg-[#202020]/80 border-white/12 text-white hover:bg-[#2a2a2a]/90'
            }`}
          >
            <LayoutGrid size={14} className="text-[#0078D4] dark:text-[#60CDFF]" />
            <span>إظهار الويدجت</span>
          </button>
        )}

        {/* Loading Indicator Banner */}
        {isLoading && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-4 py-1.5 rounded-lg border border-white/15 shadow-lg z-[950] flex items-center gap-2 text-xs font-bold">
            <Loader2 className="animate-spin text-sap-secondary" size={14} />
            <span>جاري مزامنة بيانات المتجر...</span>
          </div>
        )}
      </div>

      {/* OPEN WINDOWS LAYER */}
      {openWindows.map(win => (
        <DesktopWindow
          key={win.id}
          id={win.id}
          title={win.title}
          subtitle={win.subtitle}
          icon={win.icon}
          accentColor={win.color}
          isActive={activeWindowId === win.id && !win.isMinimized}
          isMinimized={win.isMinimized}
          isMaximized={win.isMaximized}
          zIndex={win.zIndex}
          bounds={win.bounds}
          onFocus={() => handleFocusWindow(win.id)}
          onMinimize={() => handleMinimizeWindow(win.id)}
          onMaximizeToggle={() => handleMaximizeToggle(win.id)}
          onSnap={(preset) => handleSnapWindow(win.id, preset)}
          onClose={() => handleCloseWindow(win.id)}
          onMove={(x, y) => handleMoveWindow(win.id, x, y)}
          onResize={(bounds) => handleResizeWindow(win.id, bounds)}
        >
          <div className={win.id === 'file_manager' || win.id === 'price_groups' || win.id === 'catalog' ? 'h-full print:h-auto' : 'p-4 md:p-6 min-h-full print:p-0'}>
            {renderWindowAppContent(win.id)}
          </div>
        </DesktopWindow>
      ))}

      {/* DESKTOP CONTEXT MENU */}
      {desktopContextMenu && (
        <div
          style={{
            top: Math.min(desktopContextMenu.y, window.innerHeight - 400),
            left: Math.min(desktopContextMenu.x, window.innerWidth - 240),
          }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-[1200] w-60 bg-white/92 dark:bg-[#242424]/95 backdrop-blur-2xl border border-slate-200/80 dark:border-white/12 rounded-xl shadow-2xl py-1.5 text-xs text-slate-800 dark:text-slate-100 print:hidden"
        >
          {desktopContextMenu.appId || desktopContextMenu.nodeId ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (desktopContextMenu.appId) {
                    handleOpenApp(desktopContextMenu.appId);
                  } else if (desktopContextMenu.nodeId) {
                    const node = vfsNodes.find(n => n.id === desktopContextMenu.nodeId);
                    handleOpenApp('file_manager', node?.kind === 'folder' ? node.id : 'desktop');
                  }
                }}
                className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 font-bold"
              >
                <ExternalLink size={14} />
                <span>فتح</span>
              </button>

              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400">تغيير الترتيب</div>
              <div className="px-2 py-1 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const targetId = desktopContextMenu.appId || desktopContextMenu.nodeId!;
                    moveDesktopIconStep(targetId, -1);
                  }}
                  className="flex-1 py-1.5 px-2 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1 text-[11px] font-semibold"
                >
                  <ChevronUp size={13} />
                  <span>للأمام</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetId = desktopContextMenu.appId || desktopContextMenu.nodeId!;
                    moveDesktopIconStep(targetId, 1);
                  }}
                  className="flex-1 py-1.5 px-2 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1 text-[11px] font-semibold"
                >
                  <ChevronDown size={13} />
                  <span>للخلف</span>
                </button>
              </div>

              {desktopContextMenu.appId && (
                <>
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                  <button
                    type="button"
                    onClick={() => {
                      toggleFavorite(desktopContextMenu.appId!);
                      setDesktopContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Star size={14} />
                    <span>{favorites.includes(desktopContextMenu.appId) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toggleAppVisibility(desktopContextMenu.appId!);
                      setDesktopContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-right text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <X size={14} />
                    <span>إخفاء من سطح المكتب</span>
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleOpenApp('file_manager')}
                className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 font-bold"
              >
                <FolderOpen size={14} className="text-blue-600" />
                <span>فتح مدير الملفات</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDesktopContextMenu(null);
                  handleCreateDesktopFolder();
                }}
                className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <FolderPlus size={14} className="text-amber-600" />
                <span>مجلد جديد على سطح المكتب</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  fetchData();
                  refreshVfs();
                  setDesktopContextMenu(null);
                }}
                className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <RefreshCw size={14} />
                <span>تحديث سطح المكتب</span>
              </button>

              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 flex items-center justify-between">
                <span>ترتيب الأيقونات</span>
                <span className="text-[10px] font-normal">أو بالسحب والإفلات</span>
              </div>
              <div className="px-2.5 py-1 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    sortDesktopIcons('name');
                    setDesktopContextMenu(null);
                  }}
                  className="py-1 px-2 rounded text-[11px] font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  حسب الاسم (أ-ي)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sortDesktopIcons('group');
                    setDesktopContextMenu(null);
                  }}
                  className="py-1 px-2 rounded text-[11px] font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  حسب القسم
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sortDesktopIcons('favorites');
                    setDesktopContextMenu(null);
                  }}
                  className="py-1 px-2 rounded text-[11px] font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  المفضلة أولاً
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sortDesktopIcons('default');
                    setDesktopContextMenu(null);
                  }}
                  className="py-1 px-2 rounded text-[11px] font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  الافتراضي
                </button>
              </div>

              <div className="px-3 pt-1.5 pb-1 text-[11px] font-bold text-slate-400">محاذاة الشبكة والحجم</div>
              <div className="px-2.5 pb-1 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    toggleDesktopAlignFlow('vertical');
                    setDesktopContextMenu(null);
                  }}
                  className={`flex-1 py-1 rounded text-[11px] font-semibold border ${
                    desktopAlignFlow === 'vertical'
                      ? 'bg-[#0078D4] text-white border-[#0078D4]'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  أعمدة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toggleDesktopAlignFlow('horizontal');
                    setDesktopContextMenu(null);
                  }}
                  className={`flex-1 py-1 rounded text-[11px] font-semibold border ${
                    desktopAlignFlow === 'horizontal'
                      ? 'bg-[#0078D4] text-white border-[#0078D4]'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  صفوف
                </button>
              </div>
              <div className="px-2.5 py-1 flex items-center gap-1">
                {(['sm', 'md', 'lg'] as const).map(sz => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => {
                      setIconSize(sz);
                      localStorage.setItem('sf_desktop_icon_size', sz);
                      setDesktopContextMenu(null);
                    }}
                    className={`flex-1 py-1 rounded text-[11px] font-semibold border ${
                      iconSize === sz
                        ? 'bg-sap-primary text-white border-sap-primary'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {sz === 'sm' ? 'صغير' : sz === 'md' ? 'متوسط' : 'كبير'}
                  </button>
                ))}
              </div>

              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

              <button
                type="button"
                onClick={() => {
                  setShowWidgetPickerModal(true);
                  setDesktopContextMenu(null);
                }}
                className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 font-bold text-[#0078D4] dark:text-[#60CDFF]"
              >
                <LayoutGrid size={14} />
                <span>إدارة ويدجت التطبيقات</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleDesktopWidgetsVisibility();
                  setDesktopContextMenu(null);
                }}
                className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <Layers size={14} />
                <span>{showDesktopWidgets ? 'إخفاء الويدجت من سطح المكتب' : 'إظهار الويدجت على سطح المكتب'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowWallpaperModal(true);
                  setDesktopContextMenu(null);
                }}
                className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <ImageIcon size={14} />
                <span>تغيير خلفية سطح المكتب</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCustomizeModal(true);
                  setDesktopContextMenu(null);
                }}
                className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <SettingsIcon size={14} />
                <span>تخصيص أيقونات سطح المكتب</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDarkMode(!darkMode);
                  setDesktopContextMenu(null);
                }}
                className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                {darkMode ? <Sun size={14} /> : <Moon size={14} />}
                <span>{darkMode ? 'الوضع النهاري للنوافذ' : 'الوضع الليلي للنوافذ'}</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* WINDOWS 11 CENTERED START MENU */}
      {showStartMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed bottom-14 left-1/2 -translate-x-1/2 z-[1050] w-[620px] max-w-[calc(100vw-20px)] h-[580px] max-h-[calc(100vh-74px)] bg-white/88 dark:bg-[#202020]/90 backdrop-blur-2xl border border-slate-200/80 dark:border-white/12 rounded-2xl shadow-[0_28px_75px_rgba(0,0,0,0.42)] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 print:hidden animate-in fade-in slide-in-from-bottom-3 duration-150"
        >
          {/* Win11 Search Bar */}
          <div className="px-6 pt-5 pb-3">
            <div className="relative">
              <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#0078D4]" />
              <input
                type="text"
                value={startSearch}
                onChange={(e) => setStartSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && startSearch.trim() && filteredStartApps[0]) {
                    handleOpenApp(filteredStartApps[0].id);
                  }
                }}
                placeholder="اكتب هنا للبحث عن البرامج والأدوات..."
                autoFocus
                className="w-full bg-white dark:bg-[#191919] border border-slate-200 dark:border-white/10 border-b-2 focus:border-b-[#0078D4] rounded-full pr-10 pl-4 py-2 text-xs font-semibold focus:outline-none shadow-xs"
              />
            </div>
          </div>

          {/* Start Body */}
          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-5 custom-scrollbar">
            {startSearch.trim() ? (
              <div>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">
                  نتائج البحث ({filteredStartApps.length})
                </div>
                {filteredStartApps.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    لا توجد برامج مطابقة
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {filteredStartApps.map(app => (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => handleOpenApp(app.id)}
                        className="p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/8 flex flex-col items-center gap-2 text-center transition-colors"
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: app.color }}>
                          <app.icon size={19} />
                        </div>
                        <span className="text-[11px] font-semibold line-clamp-2">{app.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : startShowAllApps ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold">جميع التطبيقات</span>
                  <button
                    type="button"
                    onClick={() => setStartShowAllApps(false)}
                    className="px-2.5 py-1 rounded-md bg-white/70 dark:bg-white/8 border border-slate-200 dark:border-white/10 text-[11px] font-bold flex items-center gap-1 hover:bg-white dark:hover:bg-white/14"
                  >
                    <ChevronRight size={13} />
                    <span>رجوع</span>
                  </button>
                </div>
                {appGroups.map((group, idx) => {
                  const permitted = group.apps.filter((app: any) => {
                    if (app.permission) return hasPermission(app.permission);
                    if (app.permissions) return hasAnyPermission(app.permissions);
                    return true;
                  });
                  if (permitted.length === 0) return null;
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-400 px-1">{group.title}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {permitted.map((app: any) => (
                          <button
                            key={app.id}
                            type="button"
                            onClick={() => handleOpenApp(app.id)}
                            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/8 flex items-center gap-2.5 text-right transition-colors"
                          >
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: app.color }}>
                              <app.icon size={14} />
                            </div>
                            <span className="text-[11px] font-semibold truncate">{app.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                {/* Pinned Grid */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-extrabold">مثبّت</span>
                    <button
                      type="button"
                      onClick={() => setStartShowAllApps(true)}
                      className="px-2.5 py-1 rounded-md bg-white/70 dark:bg-white/8 border border-slate-200 dark:border-white/10 text-[11px] font-bold flex items-center gap-1 hover:bg-white dark:hover:bg-white/14"
                    >
                      <span>كل التطبيقات</span>
                      <ChevronLeft size={13} />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                    {flattenApps.slice(0, 18).map(app => (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => handleOpenApp(app.id)}
                        className="p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/8 flex flex-col items-center gap-1.5 text-center transition-colors"
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: app.color }}>
                          <app.icon size={19} />
                        </div>
                        <span className="text-[11px] font-semibold line-clamp-2 leading-tight">{app.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recommended Section */}
                <div className="pt-2 border-t border-slate-200/70 dark:border-white/8">
                  <div className="text-xs font-extrabold mb-2.5">مقترح لك</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {flattenApps
                      .filter(a => ['file_manager', 'pos', 'price_groups', 'dashboard'].includes(a.id))
                      .slice(0, 4)
                      .map(app => (
                        <button
                          key={app.id}
                          type="button"
                          onClick={() => handleOpenApp(app.id)}
                          className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/8 flex items-center gap-3 text-right transition-colors"
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: app.color }}>
                            <app.icon size={15} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{app.label}</div>
                            <div className="text-[10px] text-slate-400 truncate">{app.groupTitle}</div>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Win11 Start Footer */}
          <div className="px-6 py-3 border-t border-slate-200/70 dark:border-white/8 bg-black/[0.03] dark:bg-black/25 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => handleOpenApp('user_profile')}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/8 transition-colors"
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-xs bg-[#0078D4]">
                {currentUser.fullName.charAt(0)}
              </div>
              <div className="text-right">
                <div className="text-xs font-bold leading-tight">{currentUser.fullName}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {currentUser.role === 'admin' ? 'المدير العام' : 'مستخدم'}
                </div>
              </div>
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleOpenApp('settings')}
                className="p-2 rounded-lg hover:bg-black/6 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"
                title="الإعدادات"
              >
                <SettingsIcon size={16} />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-red-500/15 text-red-600 dark:text-red-400"
                title="تسجيل الخروج"
              >
                <Power size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WINDOWS 11 QUICK SETTINGS CONTROL CENTER FLYOUT */}
      {showQuickSettings && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed bottom-14 left-3 z-[1050] w-[340px] max-w-[calc(100vw-24px)] bg-white/90 dark:bg-[#242424]/92 backdrop-blur-2xl border border-slate-200/80 dark:border-white/12 rounded-2xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 print:hidden animate-in fade-in slide-in-from-bottom-3 duration-150"
        >
          <div className="p-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-[11px] font-bold transition-colors ${
                darkMode
                  ? 'bg-[#0078D4] text-white border-[#0078D4]'
                  : 'bg-white/80 dark:bg-white/6 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/12'
              }`}
            >
              {darkMode ? <Moon size={16} /> : <Sun size={16} />}
              <span>{darkMode ? 'داكن' : 'نهاري'}</span>
            </button>

            <button
              type="button"
              onClick={toggleFullScreen}
              className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/6 hover:bg-slate-100 dark:hover:bg-white/12 flex flex-col items-center gap-1.5 text-[11px] font-bold transition-colors"
            >
              <Maximize2 size={16} />
              <span>ملء الشاشة</span>
            </button>

            <button
              type="button"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/6 hover:bg-slate-100 dark:hover:bg-white/12 flex flex-col items-center gap-1.5 text-[11px] font-bold transition-colors"
            >
              <Languages size={16} />
              <span>{language === 'ar' ? 'العربية' : 'English'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowCalculator(!showCalculator);
                setShowQuickSettings(false);
              }}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-[11px] font-bold transition-colors ${
                showCalculator
                  ? 'bg-[#0078D4] text-white border-[#0078D4]'
                  : 'bg-white/80 dark:bg-white/6 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/12'
              }`}
            >
              <Calculator size={16} />
              <span>الحاسبة</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowWallpaperModal(true);
                setShowQuickSettings(false);
              }}
              className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/6 hover:bg-slate-100 dark:hover:bg-white/12 flex flex-col items-center gap-1.5 text-[11px] font-bold transition-colors"
            >
              <ImageIcon size={16} />
              <span>الخلفية</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowShortcuts(true);
                setShowQuickSettings(false);
              }}
              className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/6 hover:bg-slate-100 dark:hover:bg-white/12 flex flex-col items-center gap-1.5 text-[11px] font-bold transition-colors"
            >
              <Keyboard size={16} />
              <span>الاختصارات</span>
            </button>
          </div>

          <div className="px-4 pb-3 space-y-2 border-t border-slate-200/70 dark:border-white/8 pt-3">
            <div className="text-[11px] font-bold text-slate-400">لون التمييز (Theme)</div>
            <div className="flex items-center gap-2 flex-wrap">
              {(Object.entries(THEMES) as [AppTheme, typeof THEMES[AppTheme]][]).map(([key, theme]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateSettings({ appTheme: key })}
                  title={theme.name}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    settings.appTheme === key ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: theme.colors['--sap-primary'] }}
                />
              ))}
            </div>
          </div>

          <div className="px-4 py-2.5 bg-black/[0.04] dark:bg-black/25 border-t border-slate-200/70 dark:border-white/8 flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 font-semibold">
              <Database size={13} className={dbStatus === 'connected' ? 'text-emerald-500' : 'text-amber-500'} />
              <span>{dbStatus === 'connected' ? 'قاعدة البيانات متصلة' : 'وضع محلي'}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                handleOpenApp('settings');
                setShowQuickSettings(false);
              }}
              className="p-1 rounded hover:bg-black/6 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300"
              title="إعدادات النظام"
            >
              <SettingsIcon size={14} />
            </button>
          </div>
        </div>
      )}

      {/* WINDOWS 11 CENTERED ACRYLIC TASKBAR */}
      <footer
        onClick={(e) => e.stopPropagation()}
        className="h-12 bg-white/80 dark:bg-[#1C1C1C]/82 backdrop-blur-2xl border-t border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-white flex items-center justify-between px-2.5 gap-2 shrink-0 z-[900] print:hidden"
      >
        {/* Right Side (RTL Start): Windows 11 Widgets Board Trigger */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowWidgetsBoard(prev => !prev);
              setShowStartMenu(false);
              setShowQuickSettings(false);
              setShowWindowMenu(false);
            }}
            className={`h-9 px-2.5 rounded-lg flex items-center gap-2 transition-colors text-right ${
              showWidgetsBoard
                ? 'bg-black/8 dark:bg-white/14'
                : 'hover:bg-black/5 dark:hover:bg-white/10'
            }`}
            title="لوحة ويدجت التطبيقات"
          >
            <div className="w-6 h-6 rounded-md bg-[#0078D4]/15 text-[#0078D4] dark:text-[#60CDFF] flex items-center justify-center shrink-0">
              <LayoutGrid size={14} />
            </div>
            {canViewDashboard ? (
              <div className="hidden md:block leading-tight">
                <div className="text-[11px] font-black tabular-nums">{todayAmount.toLocaleString()} ر.س</div>
                <div className="text-[9px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {todaySales.length} فاتورة · الويدجت
                </div>
              </div>
            ) : (
              <span className="hidden md:inline text-[11px] font-bold">الويدجت</span>
            )}
          </button>
        </div>

        {/* Center: Windows 11 Start + Search + Pinned & Open Apps */}
        <div className="flex items-center justify-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
          {/* Authentic Windows 11 4-Pane Start Button */}
          <button
            type="button"
            onClick={() => {
              setShowStartMenu(!showStartMenu);
              setStartShowAllApps(false);
              setStartSearch('');
              setShowQuickSettings(false);
              setShowWindowMenu(false);
            }}
            className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
              showStartMenu ? 'bg-black/8 dark:bg-white/14' : 'hover:bg-black/6 dark:hover:bg-white/10'
            }`}
            title="ابدأ (Start)"
            aria-label="قائمة ابدأ"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="win11grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#60CDFF" />
                  <stop offset="100%" stopColor="#0078D4" />
                </linearGradient>
              </defs>
              <rect x="2" y="2" width="9" height="9" rx="1.2" fill="url(#win11grad)" />
              <rect x="13" y="2" width="9" height="9" rx="1.2" fill="url(#win11grad)" />
              <rect x="2" y="13" width="9" height="9" rx="1.2" fill="url(#win11grad)" />
              <rect x="13" y="13" width="9" height="9" rx="1.2" fill="url(#win11grad)" />
            </svg>
          </button>

          {/* Win11 Taskbar Search Pill */}
          <button
            type="button"
            onClick={() => {
              setCmdQuery('');
              setCmdSelectedIdx(0);
              setShowCmdPalette(true);
            }}
            className="h-8 px-3 rounded-full bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-white/80 flex items-center gap-2 text-xs transition-colors shrink-0"
            title="بحث سريع (Ctrl+K)"
          >
            <Search size={13} className="text-[#0078D4] dark:text-[#60CDFF]" />
            <span className="hidden sm:inline text-[11px] font-semibold">بحث</span>
          </button>

          {/* Pinned File Explorer (shown if not already in openWindows) */}
          {!openWindows.some(w => w.id === 'file_manager') && (
            <button
              type="button"
              onClick={() => handleOpenApp('file_manager')}
              className="h-9 w-9 rounded-lg hover:bg-black/6 dark:hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
              title="مستكشف الملفات"
            >
              <FolderOpen size={18} className="text-amber-500" />
            </button>
          )}

          {openWindows.length > 0 && (
            <div className="h-5 w-px bg-slate-300 dark:bg-white/15 mx-1 shrink-0" />
          )}

          {/* Open Window Tabs with Win11 Active Pill Indicator */}
          {openWindows.map(win => {
            const isFocused = activeWindowId === win.id && !win.isMinimized;
            return (
              <div
                key={win.id}
                onClick={() => handleTaskbarWindowClick(win)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleTaskbarWindowClick(win);
                  }
                }}
                role="button"
                tabIndex={0}
                title={win.title}
                className={`group relative h-9 px-2.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors shrink-0 max-w-[165px] ${
                  isFocused
                    ? 'bg-black/8 dark:bg-white/14 font-bold'
                    : win.isMinimized
                    ? 'opacity-65 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/8'
                    : 'hover:bg-black/6 dark:hover:bg-white/10'
                }`}
              >
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0 shadow-xs"
                  style={{ backgroundColor: win.color }}
                >
                  <win.icon size={12} />
                </span>
                <span className="text-[11px] truncate whitespace-nowrap hidden sm:inline">{win.title}</span>
                <button
                  type="button"
                  onClick={(e) => handleCloseWindow(win.id, e)}
                  className="p-0.5 rounded hover:bg-[#C42B1C] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  title="إغلاق النافذة"
                  aria-label={`إغلاق ${win.title}`}
                >
                  <X size={11} />
                </button>
                {/* Win11 bottom indicator bar */}
                <span
                  className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 h-[3px] rounded-full transition-all ${
                    isFocused
                      ? 'w-4 bg-[#0078D4] dark:bg-[#60CDFF]'
                      : 'w-1.5 bg-slate-400 dark:bg-white/40'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Left Side (RTL End): Windows 11 System Tray */}
        <div className="flex items-center gap-1 shrink-0 text-xs">
          {openWindows.length > 0 && (
            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={() => {
                  setShowWindowMenu(!showWindowMenu);
                  setShowQuickSettings(false);
                }}
                className="h-8 px-2 rounded-lg hover:bg-black/6 dark:hover:bg-white/10 flex items-center justify-center transition-colors"
                title="ترتيب النوافذ"
              >
                <Layers size={14} />
              </button>
              {showWindowMenu && (
                <div className="absolute bottom-12 left-0 w-56 bg-white/95 dark:bg-[#242424]/95 backdrop-blur-xl border border-slate-200 dark:border-white/12 rounded-xl shadow-2xl py-1.5 text-xs text-slate-800 dark:text-slate-100 z-[1050]">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400">تقسيم الشاشة</div>
                  <button
                    type="button"
                    onClick={() => handleSplitPairWindows('even')}
                    className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-white/8 font-semibold"
                  >
                    تقسيم نافذتين (50% / 50%)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSplitPairWindows('wide_right')}
                    className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-white/8 font-semibold"
                  >
                    تقسيم رئيسية + جانبية (65% / 35%)
                  </button>
                  <button
                    type="button"
                    onClick={handleTileWindows}
                    className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-white/8"
                  >
                    تقسيم جميع النوافذ (شبكة)
                  </button>
                  <button
                    type="button"
                    onClick={handleCascadeWindows}
                    className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-white/8"
                  >
                    ترتيب متتالي (Cascade)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleShowDesktop();
                      setShowWindowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-white/8"
                  >
                    تصغير كافة النوافذ
                  </button>
                  <div className="my-1 border-t border-slate-100 dark:border-white/10" />
                  <button
                    type="button"
                    onClick={() => {
                      setShowWindowMenu(false);
                      const hasAnyUnsaved = openWindows.some(
                        w => Boolean((window as any).sf_unsaved_changes?.[w.id])
                      );
                      if (hasAnyUnsaved) {
                        setOsConfirmDialog({
                          title: 'إغلاق جميع النوافذ',
                          message: 'توجد نوافذ تحتوي على تغييرات غير محفوظة. هل تريد إغلاق الجميع؟',
                          confirmLabel: 'إغلاق الجميع',
                          danger: true,
                          onConfirm: () => {
                            (window as any).sf_unsaved_changes = {};
                            setOpenWindows([]);
                            setActiveWindowId(null);
                            setOsConfirmDialog(null);
                          },
                        });
                        return;
                      }
                      setOpenWindows([]);
                      setActiveWindowId(null);
                    }}
                    className="w-full px-3 py-2 text-right text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    إغلاق جميع النوافذ
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Settings Trigger Pill */}
          <button
            type="button"
            onClick={() => {
              setShowQuickSettings(!showQuickSettings);
              setShowStartMenu(false);
              setShowWindowMenu(false);
            }}
            className={`h-8 px-2.5 rounded-lg flex items-center gap-2 transition-colors ${
              showQuickSettings
                ? 'bg-black/8 dark:bg-white/14'
                : 'hover:bg-black/6 dark:hover:bg-white/10'
            }`}
            title="الإعدادات السريعة"
          >
            <Database size={13} className={dbStatus === 'connected' ? 'text-emerald-500' : 'text-amber-500'} />
            {darkMode ? <Moon size={13} /> : <Sun size={13} />}
            <SlidersHorizontal size={13} className="hidden sm:inline opacity-75" />
          </button>

          {/* Clock & Date Stack */}
          <button
            type="button"
            onClick={() => setShowQuickSettings(!showQuickSettings)}
            className="hidden sm:flex flex-col items-end leading-tight px-2 py-1 rounded-lg hover:bg-black/6 dark:hover:bg-white/10 tabular-nums transition-colors"
            title={dateFormatted}
          >
            <span className="text-[11px] font-bold">{timeFormatted}</span>
            <span className="text-[10px] text-slate-500 dark:text-white/65">{dateFormatted}</span>
          </button>

          {/* Windows 11 Far-Corner Show Desktop Edge */}
          <button
            type="button"
            onClick={handleShowDesktop}
            className="h-8 w-2 rounded-xs border-r border-slate-300 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
            title={t('desktop.show_desktop')}
            aria-label={t('desktop.show_desktop')}
          />
        </div>
      </footer>

      {/* COMMAND PALETTE (Ctrl+K) */}
      {showCmdPalette && (
        <div
          className="fixed inset-0 z-[1300] bg-black/50 backdrop-blur-xs flex items-start justify-center pt-[16vh] p-4"
          onClick={() => setShowCmdPalette(false)}
        >
          <div
            className="bg-white/95 dark:bg-[#202020]/96 backdrop-blur-2xl w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200/80 dark:border-white/12 text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <Search className="text-slate-400" size={18} />
              <input
                type="text"
                value={cmdQuery}
                onChange={(e) => {
                  setCmdQuery(e.target.value);
                  setCmdSelectedIdx(0);
                }}
                onKeyDown={(e) => {
                  if (filteredCmdApps.length === 0) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setCmdSelectedIdx(i => (i + 1) % filteredCmdApps.length);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setCmdSelectedIdx(i => (i - 1 + filteredCmdApps.length) % filteredCmdApps.length);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const picked = filteredCmdApps[cmdSelectedIdx] || filteredCmdApps[0];
                    if (picked) handleOpenApp(picked.id);
                  }
                }}
                placeholder="اكتب اسم البرنامج أو الأداة..."
                className="flex-1 bg-transparent outline-none text-sm font-semibold"
                autoFocus
              />
              <span className="text-[11px] text-slate-400 font-mono">Esc</span>
            </div>
            <div className="max-h-[320px] overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
              {filteredCmdApps.length === 0 ? (
                <div className="py-8 text-center text-xs font-semibold text-slate-400">
                  لا توجد نتائج مطابقة
                </div>
              ) : (
                filteredCmdApps.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setCmdSelectedIdx(idx)}
                    onClick={() => handleOpenApp(item.id)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-right transition-colors ${
                      idx === cmdSelectedIdx
                        ? 'bg-sap-primary/10 dark:bg-sap-primary/25 text-sap-primary dark:text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg text-white shrink-0" style={{ backgroundColor: item.color }}>
                        <item.icon size={15} />
                      </div>
                      <span className="font-bold text-xs truncate">{item.label}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">{item.groupTitle}</span>
                  </button>
                ))
              )}
            </div>
            <div className="px-3.5 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400">
              <span>استخدم الأسهم للتنقل و Enter للفتح</span>
              <span className="tabular-nums">{filteredCmdApps.length} برنامج</span>
            </div>
          </div>
        </div>
      )}

      {/* WINDOWS 11 WIDGETS BOARD SLIDE-OVER DRAWER */}
      {showWidgetsBoard && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed bottom-14 right-3 z-[1050] w-[360px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-76px)] overflow-y-auto custom-scrollbar bg-white/88 dark:bg-[#202020]/92 backdrop-blur-2xl border border-slate-200/80 dark:border-white/12 rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.38)] p-3 print:hidden"
        >
          <DesktopWidgets
            variant="board"
            isLightSurface={!darkMode}
            activeWidgets={activeWidgets}
            onReorderWidgets={persistActiveWidgets}
            onToggleWidget={toggleDesktopWidget}
            onOpenPickerModal={() => setShowWidgetPickerModal(true)}
            onCloseBoard={() => setShowWidgetsBoard(false)}
            timeFormatted={timeFormatted}
            dateFormatted={dateFormatted}
            userFullName={currentUser.fullName}
            products={products}
            dailySales={dailySales}
            permittedApps={flattenApps}
            favorites={favorites}
            onOpenApp={(appId) => handleOpenApp(appId)}
            onNavigateToList={handleNavigateToList}
            onOpenSearch={() => {
              setShowWidgetsBoard(false);
              setCmdQuery('');
              setCmdSelectedIdx(0);
              setShowCmdPalette(true);
            }}
          />
        </div>
      )}

      {/* WIDGET PICKER & ORGANIZATION MODAL */}
      {showWidgetPickerModal && (
        <div
          className="fixed inset-0 z-[1320] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowWidgetPickerModal(false)}
        >
          <div
            className="bg-white/95 dark:bg-[#202020]/96 backdrop-blur-2xl border border-slate-200/80 dark:border-white/12 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">إدارة ويدجت التطبيقات</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  فعّل أو أزل الويدجت واسحبها على سطح المكتب لتغيير ترتيبها
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowWidgetPickerModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-2.5 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {DESKTOP_WIDGET_CATALOG.map(widget => {
                const isActive = activeWidgets.includes(widget.id);
                const hasAnyRequired =
                  !widget.requiredAppIds ||
                  widget.requiredAppIds.some(req => flattenApps.some(a => a.id === req));
                if (!hasAnyRequired) return null;

                return (
                  <button
                    key={widget.id}
                    type="button"
                    onClick={() => toggleDesktopWidget(widget.id)}
                    className={`w-full p-3.5 rounded-xl border text-right flex items-center justify-between gap-3 transition-colors ${
                      isActive
                        ? 'bg-[#0078D4]/8 dark:bg-[#0078D4]/15 border-[#0078D4]/40'
                        : 'bg-slate-50 dark:bg-white/4 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/8'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold">{widget.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {widget.description}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 flex items-center gap-1 ${
                        isActive
                          ? 'bg-[#0078D4] text-white'
                          : 'bg-slate-200/80 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {isActive ? <Check size={12} /> : <Plus size={12} />}
                      <span>{isActive ? 'مُضاف' : 'إضافة'}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#191919] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleDesktopWidgetsVisibility()}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  {showDesktopWidgets ? 'إخفاء من سطح المكتب' : 'إظهار على سطح المكتب'}
                </button>
                <button
                  type="button"
                  onClick={() => persistActiveWidgets(DEFAULT_ACTIVE_WIDGETS)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  استعادة الافتراضي
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowWidgetPickerModal(false)}
                className="px-5 py-1.5 rounded-lg bg-[#0078D4] hover:bg-[#106EBE] text-white text-xs font-bold"
              >
                تم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMIZE DESKTOP ICONS MODAL */}
      {showCustomizeModal && (
        <div
          className="fixed inset-0 z-[1300] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowCustomizeModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[85vh] text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-bold">تخصيص وتنظيم أيقونات سطح المكتب</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  اختر التطبيقات الظاهرة، أو اسحب وأفلت الأيقونات مباشرة على سطح المكتب لتغيير ترتيبها
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomizeModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 ml-1">
                  <ArrowUpDown size={12} />
                  <span>ترتيب سريع:</span>
                </span>
                <button
                  type="button"
                  onClick={() => sortDesktopIcons('name')}
                  className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  حسب الاسم (أ-ي)
                </button>
                <button
                  type="button"
                  onClick={() => sortDesktopIcons('group')}
                  className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  حسب القسم
                </button>
                <button
                  type="button"
                  onClick={() => sortDesktopIcons('favorites')}
                  className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  المفضلة أولاً
                </button>
                <button
                  type="button"
                  onClick={() => sortDesktopIcons('default')}
                  className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  الافتراضي
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleDesktopAlignFlow('vertical')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                    desktopAlignFlow === 'vertical'
                      ? 'bg-[#0078D4] text-white border-[#0078D4]'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}
                >
                  أعمدة
                </button>
                <button
                  type="button"
                  onClick={() => toggleDesktopAlignFlow('horizontal')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                    desktopAlignFlow === 'horizontal'
                      ? 'bg-[#0078D4] text-white border-[#0078D4]'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}
                >
                  صفوف
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
              {appGroups.map((group, gIdx) => {
                const permittedApps = group.apps.filter((app: any) => {
                  if (app.permission) return hasPermission(app.permission);
                  if (app.permissions) return hasAnyPermission(app.permissions);
                  return true;
                });
                if (permittedApps.length === 0) return null;
                return (
                  <div key={gIdx} className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 pb-1 border-b border-slate-100 dark:border-slate-800">
                      {group.title}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {permittedApps.map((app: any) => {
                        const isHidden = hiddenApps.includes(app.id);
                        return (
                          <button
                            key={app.id}
                            type="button"
                            onClick={() => toggleAppVisibility(app.id)}
                            className={`flex items-center gap-3 p-3 rounded-lg border text-right transition-colors ${
                              !isHidden
                                ? 'bg-sap-primary/5 border-sap-primary/30 dark:bg-slate-800/70'
                                : 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800 opacity-60'
                            }`}
                          >
                            <div className="w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0" style={{ backgroundColor: app.color }}>
                              <app.icon size={14} />
                            </div>
                            <span className="flex-1 text-xs font-bold truncate">{app.label}</span>
                            <span className={`text-[11px] font-semibold ${!isHidden ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {!isHidden ? 'ظاهر' : 'مخفي'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHiddenApps([]);
                    localStorage.setItem('sf_hidden_apps', JSON.stringify([]));
                  }}
                  className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-sap-primary px-2.5 py-1.5"
                >
                  إظهار الكل
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const allIds = appGroups.flatMap(g => g.apps).map((a: any) => a.id);
                    const toHide = allIds.filter(id => !['file_manager', 'recycle_bin', 'dashboard', 'products', 'list', 'pos'].includes(id));
                    setHiddenApps(toHide);
                    localStorage.setItem('sf_hidden_apps', JSON.stringify(toHide));
                  }}
                  className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-red-500 px-2.5 py-1.5"
                >
                  الأساسيات فقط
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomizeModal(false)}
                className="px-5 py-2 bg-sap-primary text-white rounded-lg text-xs font-bold hover:bg-sap-primary-hover"
              >
                تم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WALLPAPER PICKER MODAL */}
      {showWallpaperModal && (
        <div
          className="fixed inset-0 z-[1300] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowWallpaperModal(false)}
        >
          <div
            className="bg-white/95 dark:bg-[#202020]/96 backdrop-blur-2xl border border-slate-200/80 dark:border-white/12 rounded-2xl shadow-2xl w-full max-w-lg p-5 text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold">خلفية سطح المكتب</h3>
              <button type="button" onClick={() => setShowWallpaperModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {(Object.entries(WALLPAPERS) as [Exclude<WallpaperKey, 'custom'>, typeof WALLPAPERS['slate_pro']][]).map(([key, wp]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectWallpaper(key)}
                  className={`p-2 rounded-xl border text-right transition-all ${
                    wallpaper === key
                      ? 'border-[#0078D4] ring-2 ring-[#0078D4]/30'
                      : 'border-slate-200 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/25'
                  }`}
                >
                  <div
                    className={`h-20 w-full rounded-lg mb-2 ${wp.className} border border-black/10`}
                    style={wp.bloomStyle ? { backgroundImage: wp.bloomStyle } : undefined}
                  />
                  <div className="text-xs font-bold">{wp.name}</div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => wallpaperUploadRef.current?.click()}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-2"
              >
                <ImageIcon size={15} />
                <span>رفع صورة خلفية من جهازك</span>
              </button>
              <button
                type="button"
                onClick={() => setShowWallpaperModal(false)}
                className="px-4 py-2 rounded-lg bg-sap-primary text-white text-xs font-bold hover:bg-sap-primary-hover"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OS CONFIRMATION MODAL */}
      {osConfirmDialog && (
        <div
          className="fixed inset-0 z-[1400] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 print:hidden"
          onClick={() => setOsConfirmDialog(null)}
        >
          <div
            className="bg-white/95 dark:bg-[#202020]/96 backdrop-blur-2xl border border-slate-200/80 dark:border-white/12 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="p-5 space-y-2">
              <h3 className="text-sm font-black">{osConfirmDialog.title}</h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                {osConfirmDialog.message}
              </p>
            </div>
            <div className="px-4 py-3 bg-slate-50 dark:bg-[#191919] border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOsConfirmDialog(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/8 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/14"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={osConfirmDialog.onConfirm}
                className={`px-3.5 py-1.5 rounded-lg text-white text-xs font-black ${
                  osConfirmDialog.danger
                    ? 'bg-[#C42B1C] hover:bg-red-700'
                    : 'bg-[#0078D4] hover:bg-[#106EBE]'
                }`}
              >
                {osConfirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW DESKTOP FOLDER MODAL */}
      {newFolderModal.open && (
        <div
          className="fixed inset-0 z-[1400] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 print:hidden"
          onClick={() => setNewFolderModal({ open: false, name: '' })}
        >
          <div
            className="bg-white/95 dark:bg-[#202020]/96 backdrop-blur-2xl border border-slate-200/80 dark:border-white/12 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="p-5 space-y-3">
              <h3 className="text-sm font-black flex items-center gap-2">
                <FolderPlus size={16} className="text-amber-500" />
                <span>مجلد جديد على سطح المكتب</span>
              </h3>
              <input
                type="text"
                value={newFolderModal.name}
                onChange={(e) => setNewFolderModal({ open: true, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmCreateDesktopFolder();
                }}
                placeholder="أدخل اسم المجلد..."
                className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-sap-primary"
                autoFocus
              />
            </div>
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewFolderModal({ open: false, name: '' })}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={!newFolderModal.name.trim()}
                onClick={confirmCreateDesktopFolder}
                className="px-3.5 py-1.5 rounded-lg bg-sap-primary hover:bg-sap-primary-hover text-white text-xs font-black disabled:opacity-40"
              >
                إنشاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Calculator */}
      {showCalculator && (
        <div className="fixed bottom-16 left-4 z-[950] print:hidden">
          <CalculatorComponent onClose={() => setShowCalculator(false)} />
        </div>
      )}

      <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <div className="hidden">
        <InstallApp sidebarOpen={false} />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <SystemSettingsProvider>
        <NotificationProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </NotificationProvider>
      </SystemSettingsProvider>
    </ErrorBoundary>
  );
};

export default App;
