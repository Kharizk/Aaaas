
import React, { useState, useEffect, useCallback, Component, ErrorInfo } from 'react';
import { ProductManager } from './components/ProductManager';
import { UnitManager } from './components/UnitManager';
import { ProductListBuilder } from './components/ProductListBuilder';
import { Dashboard } from './components/Dashboard';
import { BranchManager } from './components/BranchManager';
import { SalesRecorder } from './components/SalesRecorder';
import { ReportsCenter } from './components/ReportsCenter';
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
import { CustomerManager } from './components/CustomerManager';
import { LoginScreen } from './components/LoginScreen';
import { UserManager } from './components/UserManager';
import { UserProfile } from './components/UserProfile';
import { InstallApp } from './components/InstallApp';
import { NotificationProvider } from './components/Notifications';
import { Product, Unit, Branch, DailySales, User, Permission, CatalogProject } from './types';
import { db } from './services/supabase';
import { 
  Package, Ruler, LayoutDashboard, FileText, DollarSign, 
  Settings as SettingsIcon, Tag, Layout, 
  Percent, FileLineChart, Wallet, Crown, LogOut, Users, UserCircle, BookOpen, Monitor,
  ShoppingBag, TrendingDown, Bell, Moon, Sun, Loader2, Command, Keyboard, Search,
  Grid, ArrowRight, Home, Menu, X, ChevronRight, Building2,
  Calculator, Truck, BarChart4, Receipt, CreditCard, AlertTriangle, Star
} from 'lucide-react';

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
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

const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [viewCatalogId, setViewCatalogId] = useState<string | null>(null);
  const [viewCatalogData, setViewCatalogData] = useState<CatalogProject | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

  // 'launcher' means the main grid view. Any other value is a specific app.
  const [activeTab, setActiveTab] = useState<'launcher' | 'dashboard' | 'products' | 'list' | 'price_tags' | 'offers' | 'price_groups' | 'catalog' | 'sales_entry' | 'reports_center' | 'settlement' | 'pos_setup' | 'units' | 'branches' | 'settings' | 'database' | 'users' | 'user_profile' | 'pos' | 'expenses' | 'customers'>('launcher');
  
  const [isLoading, setIsLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [targetListParams, setTargetListParams] = useState<{ listId: string, rowId?: string } | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('sf_theme') === 'dark');
  const [showCmdPalette, setShowCmdPalette] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => {
      try {
          const saved = localStorage.getItem('sf_favorites');
          return saved ? JSON.parse(saved) : [];
      } catch (e) { return []; }
  });

  const toggleFavorite = (appId: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setFavorites(prev => {
          const newFavs = prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId];
          localStorage.setItem('sf_favorites', JSON.stringify(newFavs));
          return newFavs;
      });
  };

  // --- Theme Colors ---
  const COLORS = {
      GOLD: '#C5A059',
      BURGUNDY: '#800020',
      DARK_GRAY: '#2D3748',
      SLATE: '#4A5568'
  };

  // --- Grouped Apps Definition ---
  const appGroups = [
    {
        title: "المبيعات والعملاء",
        apps: [
            { id: 'pos', label: 'نقطة البيع', icon: ShoppingBag, color: COLORS.GOLD, permission: 'record_sales' },
            { id: 'sales_entry', label: 'المبيعات', icon: DollarSign, color: COLORS.BURGUNDY, permission: 'record_sales' },
            { id: 'customers', label: 'العملاء', icon: Users, color: COLORS.DARK_GRAY, permission: 'record_sales' },
            { id: 'offers', label: 'العروض', icon: Percent, color: COLORS.GOLD, permission: 'print_labels' },
        ]
    },
    {
        title: "المخزون والمنتجات",
        apps: [
            { id: 'products', label: 'المنتجات', icon: Package, color: COLORS.DARK_GRAY, permissions: ['view_products', 'manage_products'] },
            { id: 'list', label: 'الجرد', icon: ClipboardListIcon, color: COLORS.BURGUNDY, permission: 'manage_products' },
            { id: 'units', label: 'الوحدات', icon: Ruler, color: COLORS.SLATE, permission: 'manage_products' },
        ]
    },
    {
        title: "الحسابات والتقارير",
        apps: [
            { id: 'dashboard', label: 'لوحة البيانات', icon: LayoutDashboard, color: COLORS.BURGUNDY, permission: 'view_dashboard' },
            { id: 'reports_center', label: 'التقارير', icon: BarChart4, color: COLORS.GOLD, permission: 'view_reports' },
            { id: 'settlement', label: 'إغلاق اليومية', icon: Wallet, color: COLORS.DARK_GRAY, permission: 'manage_settlements' },
            { id: 'expenses', label: 'المصروفات', icon: TrendingDown, color: COLORS.BURGUNDY, permission: 'manage_settlements' },
        ]
    },
    {
        title: "التسويق والعرض",
        apps: [
            { id: 'price_tags', label: 'ملصقات الباركود', icon: Tag, color: COLORS.DARK_GRAY, permission: 'print_labels' },
            { id: 'catalog', label: 'المجلة الرقمية', icon: BookOpen, color: COLORS.GOLD, permission: 'print_labels' },
            { id: 'price_groups', label: 'الشاشات', icon: Monitor, color: COLORS.SLATE, permission: 'print_labels' },
        ]
    },
    {
        title: "الإعدادات",
        apps: [
            { id: 'users', label: 'المستخدمين', icon: Users, color: COLORS.DARK_GRAY, permission: 'manage_users' },
            { id: 'branches', label: 'الفروع', icon: Building2, color: COLORS.BURGUNDY, permission: 'manage_branches' },
            { id: 'pos_setup', label: 'تهيئة الكاشير', icon: Calculator, color: COLORS.SLATE, permission: 'manage_settlements' },
            { id: 'settings', label: 'الإعدادات', icon: SettingsIcon, color: COLORS.GOLD, permission: 'manage_settings' },
            { id: 'database', label: 'قاعدة البيانات', icon: Layout, color: COLORS.DARK_GRAY, permission: 'manage_database' },
        ]
    }
  ];

  function ClipboardListIcon(props: any) {
      return <FileText {...props} />
  }

  useEffect(() => {
    if(darkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('sf_theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('sf_theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
              e.preventDefault();
              setShowCmdPalette(prev => !prev);
          }
          if (e.key === 'Escape') {
              setShowCmdPalette(false);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
                const catalog = await Promise.race([db.catalogs.get(catId), new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))]).catch(() => null);
                if (catalog) setViewCatalogData(catalog as CatalogProject);
                else { alert('المجلة غير موجودة'); setViewCatalogId(null); }
            } catch (e) { setViewCatalogId(null); } finally { setIsCatalogLoading(false); }
            return;
        }
        try {
            await Promise.race([db.auth.initAdminIfNeeded(), new Promise((_, reject) => setTimeout(() => reject("DB_TIMEOUT"), 3000))]);
        } catch (dbError) { console.warn("DB Init warning"); }
        const savedUserStr = localStorage.getItem('sf_user_session');
        if (savedUserStr) { try { setCurrentUser(JSON.parse(savedUserStr)); } catch (e) { localStorage.removeItem('sf_user_session'); } }
      } catch (err) { console.error(err); } finally { setAuthChecking(false); }
    };
    const failsafeTimer = setTimeout(() => { setAuthChecking(false); }, 4000);
    performInit().then(() => clearTimeout(failsafeTimer));
    return () => clearTimeout(failsafeTimer);
  }, []);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
        const isConnected = await db.testConnection();
        setDbStatus(isConnected ? 'connected' : 'error');
        const [u, p, b, s] = await Promise.all([db.units.getAll(), db.products.getAll(), db.branches.getAll(), db.dailySales.getAll()]);
        setUnits(u); setProducts(p); setBranches(b);
        if (currentUser.role === 'admin') setDailySales(s);
        else if (currentUser.branchId) setDailySales(s.filter(sale => sale.branchId === currentUser.branchId));
        else setDailySales([]);
    } catch (error) { setDbStatus('error'); } finally { setIsLoading(false); }
  }, [currentUser]);

  useEffect(() => { if (currentUser) fetchData(); }, [currentUser, fetchData]);

  const handleLogin = async (username: string, pass: string): Promise<boolean> => {
      try {
          const user = await db.auth.login(username);
          if (user && user.password === pass) {
              if (user.role !== 'admin' && !user.isActive) { alert("الحساب غير نشط"); return false; }
              const safeUser: User = { id: user.id, username: user.username, fullName: user.fullName, role: user.role, branchId: user.branchId, permissions: user.permissions, isActive: user.isActive };
              setCurrentUser(safeUser);
              localStorage.setItem('sf_user_session', JSON.stringify(safeUser));
              return true;
          }
      } catch (e) { console.error(e); }
      return false;
  };

  const handleLogout = () => { if (confirm('تسجيل الخروج؟')) { localStorage.removeItem('sf_user_session'); setCurrentUser(null); window.location.reload(); } };
  const handleProfileUpdate = (updatedUser: User) => { setCurrentUser(updatedUser); localStorage.setItem('sf_user_session', JSON.stringify(updatedUser)); };
  const handleNavigateToList = (listId: string, rowId?: string) => { setTargetListParams({ listId, rowId }); setActiveTab('list'); };
  const hasPermission = (perm: Permission) => (!currentUser ? false : currentUser.role === 'admin' ? true : currentUser.permissions.includes(perm));
  const hasAnyPermission = (perms: Permission[]) => (!currentUser ? false : currentUser.role === 'admin' ? true : perms.some(p => currentUser.permissions.includes(p)));

  const flattenApps = appGroups.flatMap(g => g.apps);
  const filteredNavItems = flattenApps.filter(i => i.label.includes(cmdQuery));

  if (authChecking || isCatalogLoading) return <div className="h-screen w-full flex items-center justify-center bg-white"><Loader2 className="animate-spin text-sap-primary" size={48}/></div>;
  if (viewCatalogId && viewCatalogData) return <CatalogGenerator products={[]} units={[]} viewModeData={viewCatalogData} />;
  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

  // --- Render App Grid (Refined & Modern) ---
  const AppLauncher = () => {
    const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const date = new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
    
    // Quick Stats Calculation
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySales = dailySales.filter(s => s.date.startsWith(todayStr));
    const totalAmount = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalOrders = todaySales.length;
    const canViewDashboard = hasPermission('view_dashboard');

    return (
    <div className="absolute inset-0 overflow-y-auto bg-[#F8FAFC] dark:bg-[#0F172A] animate-in fade-in duration-500">
        {/* Hero Section */}
        <div className="relative bg-gradient-to-b from-sap-primary/5 to-transparent pt-12 pb-12 px-6 md:px-12">
           <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-end gap-6">
              <div>
                 <h1 className="text-3xl md:text-4xl font-black text-sap-primary dark:text-white mb-2 tracking-tight">
                    مرحباً، {currentUser?.fullName.split(' ')[0]} 👋
                 </h1>
                 <p className="text-slate-500 dark:text-slate-400 font-medium text-lg flex items-center gap-2">
                    <span className="opacity-70">{date}</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <span className="opacity-70" dir="ltr">{time}</span>
                 </p>
              </div>
              
              {/* Quick Search Trigger */}
              <button 
                onClick={() => setShowCmdPalette(true)}
                className="w-full md:w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex items-center gap-3 text-slate-400 hover:border-sap-primary/50 hover:shadow-lg hover:shadow-sap-primary/5 transition-all group cursor-text"
              >
                 <Search className="text-sap-secondary group-hover:scale-110 transition-transform" />
                 <span className="flex-1 text-right text-sm font-bold group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">ابحث عن تطبيق أو تقرير...</span>
                 <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md text-[10px] font-mono border border-slate-200 dark:border-slate-600">Ctrl K</span>
              </button>
           </div>
        </div>

        {/* Quick Stats for Admin/Dashboard Viewers */}
        {canViewDashboard && (
            <div className="max-w-7xl mx-auto px-6 md:px-12 -mt-6 mb-8 relative z-10 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                            <DollarSign size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold mb-0.5">مبيعات اليوم</p>
                            <p className="text-xl font-black text-slate-800 dark:text-white">{totalAmount.toLocaleString()} <span className="text-xs font-medium text-slate-400">ر.س</span></p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                         <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <Receipt size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold mb-0.5">عدد الطلبات</p>
                            <p className="text-xl font-black text-slate-800 dark:text-white">{totalOrders}</p>
                        </div>
                    </div>
                     <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 flex items-center gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group" onClick={() => setActiveTab('dashboard')}>
                         <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition-transform">
                            <BarChart4 size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold mb-0.5">لوحة البيانات</p>
                            <p className="text-sm font-bold text-purple-600 flex items-center gap-1">عرض التفاصيل <ArrowRight size={14} className="rotate-180"/></p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div className="max-w-7xl mx-auto px-6 md:px-12 pb-24">
            {appGroups.map((group, groupIdx) => {
                const visibleApps = group.apps.filter(app => {
                    if (app.permission) return hasPermission(app.permission as any);
                    if (app.permissions) return hasAnyPermission(app.permissions as any);
                    return true;
                });

                if (visibleApps.length === 0) return null;

                return (
                    <div key={groupIdx} className="mb-10">
                        <div className="flex items-center gap-4 mb-6">
                           <div className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-200 dark:via-slate-800 to-transparent"></div>
                           <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4 py-1 bg-slate-50 dark:bg-slate-900 rounded-full border border-slate-100 dark:border-slate-800">
                               {group.title}
                           </h3>
                           <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent"></div>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {visibleApps.map(app => (
                                <div 
                                    key={app.id} 
                                    onClick={() => setActiveTab(app.id as any)}
                                    role="button"
                                    tabIndex={0}
                                    className="relative flex flex-col items-center p-6 bg-white dark:bg-slate-800 rounded-3xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700/50 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] hover:border-sap-primary/20 hover:-translate-y-1.5 transition-all duration-300 group overflow-hidden cursor-pointer"
                                >
                                    {/* Hover Gradient Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-slate-50/50 dark:to-slate-700/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    
                                    {/* Icon Container */}
                                    <div 
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-gray-200/50 dark:shadow-none mb-5 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 relative z-10"
                                        style={{ backgroundColor: app.color }}
                                    >
                                        <app.icon size={30} strokeWidth={1.5} className="drop-shadow-md" />
                                        {/* Glossy reflection */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-2xl" />
                                    </div>
                                    
                                    {/* Favorite Button */}
                                    <button 
                                        onClick={(e) => toggleFavorite(app.id, e)}
                                        className={`absolute top-3 left-3 p-1.5 rounded-full z-20 transition-all hover:scale-110 ${favorites.includes(app.id) ? 'text-yellow-400 bg-white shadow-sm opacity-100' : 'text-slate-300 bg-slate-50/50 hover:bg-white hover:text-yellow-400'}`}
                                        title={favorites.includes(app.id) ? "إزالة من المفضلة" : "إضافة للمفضلة"}
                                    >
                                        <Star size={16} fill={favorites.includes(app.id) ? "currentColor" : "none"} />
                                    </button>
                                    
                                    {/* Label */}
                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300 group-hover:text-sap-primary dark:group-hover:text-white transition-colors relative z-10">
                                        {app.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
            
            {/* Footer / Install */}
            <div className="mt-16 flex flex-col items-center justify-center gap-4 opacity-60 hover:opacity-100 transition-opacity pb-10">
                <InstallApp sidebarOpen={true} />
                <p className="text-[10px] text-slate-400 font-mono">StoreFlow System v2.5.0</p>
            </div>
        </div>
    </div>
  );
  };

  const activeAppInfo = flattenApps.find(a => a.id === activeTab);

  // --- Favorites Sidebar ---
  const FavoritesSidebar = () => {
      const favApps = flattenApps.filter(app => favorites.includes(app.id));
      if (favApps.length === 0) return null;

      return (
          <div className="w-[70px] bg-white dark:bg-slate-950 border-l border-gray-200 dark:border-slate-800 flex flex-col items-center py-6 gap-4 z-40 hidden md:flex shrink-0 shadow-sm">
              <div className="mb-2">
                  <div className="w-8 h-8 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-500">
                      <Star size={16} fill="currentColor" />
                  </div>
              </div>
              <div className="w-8 h-px bg-gray-100 dark:bg-slate-800 mb-2"></div>
              {favApps.map(app => (
                  <button 
                      key={app.id}
                      onClick={() => setActiveTab(app.id as any)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative group ${activeTab === app.id ? 'bg-sap-primary text-white shadow-lg shadow-sap-primary/30' : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600'}`}
                      title={app.label}
                  >
                      <app.icon size={20} strokeWidth={2} />
                      
                      {/* Tooltip */}
                      <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-all translate-x-2 group-hover:translate-x-0 shadow-xl">
                          {app.label}
                          <div className="absolute top-1/2 -right-1 -translate-y-1/2 border-4 border-transparent border-l-gray-900"></div>
                      </div>
                  </button>
              ))}
          </div>
      );
  };

  return (
    <div className={`flex flex-col h-screen w-full bg-[#F0F2F5] dark:bg-slate-900 text-[#0F172A] font-sans print:h-auto print:bg-white print:overflow-visible transition-colors duration-300 ${darkMode ? 'dark:bg-slate-900 dark:text-white' : ''}`}>
      
      {/* Command Palette */}
      {showCmdPalette && (
          <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[20vh]" onClick={() => setShowCmdPalette(false)}>
              <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
                      <Search className="text-gray-400"/>
                      <input 
                        type="text" 
                        value={cmdQuery} 
                        onChange={e => setCmdQuery(e.target.value)}
                        placeholder="اكتب للبحث عن تطبيق..." 
                        className="flex-1 bg-transparent outline-none text-lg font-bold"
                        autoFocus
                      />
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">Esc</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto p-2">
                      {filteredNavItems.map(item => (
                          <button key={item.id} onClick={() => { setActiveTab(item.id as any); setShowCmdPalette(false); }} className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-right transition-colors">
                              <div className="p-2 rounded-lg text-white" style={{ backgroundColor: item.color }}><item.icon size={16}/></div>
                              <span className="font-bold">{item.label}</span>
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Top Navigation Bar */}
      <header className="h-[46px] bg-[#1A202C] dark:bg-slate-950 text-white flex items-center justify-between px-3 shrink-0 z-50 shadow-md print:hidden">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveTab('launcher')} 
            className="p-1.5 hover:bg-white/10 rounded-[4px] transition-colors flex items-center justify-center"
            title="التطبيقات"
          >
             <Grid size={18} className="text-white/80 hover:text-white transition-colors"/>
          </button>
          
          {activeTab !== 'launcher' && (
              <div className="flex items-center gap-2 text-sm font-bold text-white animate-in fade-in slide-in-from-right-4">
                  <span className="text-white/40">/</span>
                  <span className="text-white">{activeAppInfo?.label}</span>
              </div>
          )}
        </div>

        {/* Center Search (Fake Odoo Search) */}
        {activeTab === 'launcher' && (
            <div className="hidden md:flex flex-1 max-w-lg mx-auto">
                <button onClick={() => setShowCmdPalette(true)} className="w-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white py-1.5 px-4 rounded-[6px] text-xs flex items-center justify-between transition-all group border border-transparent hover:border-white/10">
                    <span className="flex items-center gap-2"><Search size={12}/> ابحث...</span>
                    <span className="bg-black/20 px-1.5 rounded text-[10px] font-mono opacity-50 group-hover:opacity-100">Ctrl+K</span>
                </button>
            </div>
        )}

        <div className="flex items-center gap-2 text-xs font-bold">
          <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 rounded-[4px] hover:bg-white/10 transition-colors text-white/80 hover:text-white">
              {darkMode ? <Sun size={16}/> : <Moon size={16}/>}
          </button>
          
          <div className="h-4 w-px bg-white/20 mx-1"></div>

          <button onClick={() => setActiveTab('user_profile')} className="flex items-center gap-2 px-2 py-1 rounded-[4px] hover:bg-white/10 transition-all group">
             <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-black text-[10px] border border-white/20" style={{ backgroundColor: COLORS.GOLD }}>
                 {currentUser.fullName.charAt(0)}
             </div>
             <span className="hidden sm:inline text-white/90 group-hover:text-white">{currentUser.fullName}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area with Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
          <FavoritesSidebar />
          <main className="flex-1 relative overflow-hidden print:p-0 print:block">
              {activeTab === 'launcher' ? (
                  <AppLauncher />
              ) : (
                  <div className="absolute inset-0 bg-white dark:bg-slate-900 overflow-hidden flex flex-col animate-in fade-in zoom-in-[0.99] duration-200">
                      <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar print:p-0">
                          {isLoading && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#00A09D] text-white px-6 py-2 rounded-full shadow-lg z-50 flex items-center gap-3 text-xs font-bold animate-in slide-in-from-top-4 fade-in"><Loader2 className="animate-spin" size={16}/><span>جاري التحميل...</span></div>}
                          
                          {/* Render Active Component */}
                          {activeTab === 'dashboard' && <Dashboard products={products} units={units} switchToTab={(t) => setActiveTab(t as any)} onNavigateToList={handleNavigateToList} />}
                          {activeTab === 'pos' && <POSInterface products={products} setDailySales={setDailySales} />}
                          {activeTab === 'products' && <ProductManager products={products} setProducts={setProducts} units={units} setUnits={setUnits} currentUser={currentUser} />}
                          {activeTab === 'expenses' && <ExpenseManager />}
                          {activeTab === 'customers' && <CustomerManager />}
                          {activeTab === 'list' && <ProductListBuilder products={products} units={units} onNewProductsAdded={fetchData} initialListParams={targetListParams} clearInitialParams={() => setTargetListParams(null)} />}
                          {activeTab === 'sales_entry' && <SalesRecorder branches={currentUser.role === 'admin' ? branches : branches.filter(b => b.id === currentUser.branchId)} sales={dailySales} setSales={setDailySales} />}
                          {activeTab === 'reports_center' && <ReportsCenter branches={currentUser.role === 'admin' ? branches : branches.filter(b => b.id === currentUser.branchId)} sales={dailySales} products={products} units={units} />}
                          {activeTab === 'settlement' && <SettlementManager currentUser={currentUser} />}
                          {activeTab === 'pos_setup' && <POSManagement branches={branches} />}
                          {activeTab === 'branches' && <BranchManager branches={branches} setBranches={setBranches} sales={dailySales} />}
                          {activeTab === 'units' && <UnitManager units={units} setUnits={setUnits} />}
                          {activeTab === 'database' && <DatabaseManager />}
                          {activeTab === 'settings' && <Settings />}
                          {activeTab === 'user_profile' && <UserProfile user={currentUser} onUpdate={handleProfileUpdate} />}
                          {activeTab === 'users' && <UserManager currentUser={currentUser} branches={branches} />}
                          {activeTab === 'price_tags' && <PriceTagGenerator products={products} units={units} />}
                          {activeTab === 'offers' && <OfferGenerator products={products} units={units} />}
                          {activeTab === 'price_groups' && <PriceGroupManager />}
                          {activeTab === 'catalog' && <CatalogGenerator products={products} units={units} />}
                      </div>
                  </div>
              )}
          </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </ErrorBoundary>
  );
};

export default App;
