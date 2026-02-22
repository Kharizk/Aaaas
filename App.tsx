
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
  Calculator, Truck, BarChart4, Receipt, CreditCard, AlertTriangle
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

  // --- Render App Grid (Refined & Smaller) ---
  const AppLauncher = () => (
    <div className="absolute inset-0 overflow-y-auto bg-[#F5F5F5] dark:bg-slate-900 animate-in zoom-in-95 duration-300">
        <div className="max-w-screen-2xl mx-auto p-6 md:p-10 pb-32">
            {appGroups.map((group, groupIdx) => {
                const visibleApps = group.apps.filter(app => {
                    if (app.permission) return hasPermission(app.permission as any);
                    if (app.permissions) return hasAnyPermission(app.permissions as any);
                    return true;
                });

                if (visibleApps.length === 0) return null;

                return (
                    <div key={groupIdx} className="mb-8">
                        {/* Group Title - Minimal */}
                        <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 mb-3 px-2 uppercase tracking-widest border-b border-gray-200 dark:border-gray-700 pb-2">
                            {group.title}
                        </h3>
                        
                        {/* Flexible Grid - Smaller Icons */}
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-y-6 gap-x-2">
                            {visibleApps.map(app => (
                                <button 
                                    key={app.id} 
                                    onClick={() => setActiveTab(app.id as any)}
                                    className="flex flex-col items-center gap-2 group outline-none"
                                >
                                    {/* App Icon - Smaller Size (w-14 h-14) */}
                                    <div 
                                        className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-white shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg group-hover:-translate-y-1 active:scale-95"
                                        style={{ backgroundColor: app.color }}
                                    >
                                        <app.icon size={28} strokeWidth={1.5} className="md:w-8 md:h-8" />
                                    </div>
                                    
                                    {/* App Label */}
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 text-center leading-tight px-1 group-hover:text-black dark:group-hover:text-white transition-colors">
                                        {app.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })}
            
            {/* Install App Button */}
            <div className="flex justify-center mt-12 opacity-40 hover:opacity-100 transition-opacity">
                <InstallApp sidebarOpen={true} />
            </div>
        </div>
    </div>
  );

  const activeAppInfo = flattenApps.find(a => a.id === activeTab);

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

      {/* Main Content Area */}
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
