
import React, { useState, useEffect, useCallback } from 'react';
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
import { NotificationProvider } from './components/Notifications'; // IMPORTED
import { Product, Unit, Branch, DailySales, User, Permission, CatalogProject } from './types';
import { db } from './services/supabase';
import { 
  Package, Ruler, LayoutDashboard, FileText, DollarSign, 
  MapPin, Settings as SettingsIcon, Database, Tag, Layout, 
  Percent, FileLineChart, Wallet, PanelLeftClose, PanelLeftOpen, Crown, LogOut, Users, UserCircle, BookOpen, Monitor,
  ShoppingBag, TrendingDown, Bell, Moon, Sun, Loader2, Command, Keyboard, Search
} from 'lucide-react';

const AppContent: React.FC = () => { // Moved main logic here to be inside provider
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [viewCatalogId, setViewCatalogId] = useState<string | null>(null);
  const [viewCatalogData, setViewCatalogData] = useState<CatalogProject | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'list' | 'price_tags' | 'offers' | 'price_groups' | 'catalog' | 'sales_entry' | 'reports_center' | 'settlement' | 'pos_setup' | 'units' | 'branches' | 'settings' | 'database' | 'users' | 'user_profile' | 'pos' | 'expenses' | 'customers'>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dbStatus, setDbStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [targetListParams, setTargetListParams] = useState<{ listId: string, rowId?: string } | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  
  // Dark Mode Persistence
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('sf_theme') === 'dark');
  const [showCmdPalette, setShowCmdPalette] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');

  useEffect(() => {
    if(darkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('sf_theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('sf_theme', 'light');
    }
  }, [darkMode]);

  // Global Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
              e.preventDefault();
              setShowCmdPalette(prev => !prev);
          }
          if (e.shiftKey && e.key === '?') {
              e.preventDefault();
              setShowShortcuts(prev => !prev);
          }
          if (e.key === 'Escape') {
              setShowCmdPalette(false);
              setShowShortcuts(false);
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

  // Command Palette Logic
  const navItems = [
      { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
      { id: 'pos', label: 'نقطة البيع POS', icon: ShoppingBag },
      { id: 'products', label: 'المنتجات', icon: Package },
      { id: 'sales_entry', label: 'سجل المبيعات', icon: DollarSign },
      { id: 'offers', label: 'مصمم العروض', icon: Percent },
      { id: 'reports_center', label: 'التقارير', icon: FileLineChart },
      { id: 'settings', label: 'الإعدادات', icon: SettingsIcon },
      { id: 'pos_setup', label: 'إعداد الكاشير', icon: Monitor },
  ];
  
  const filteredNavItems = navItems.filter(i => i.label.includes(cmdQuery));

  if (authChecking || isCatalogLoading) return <div className="h-screen w-full flex items-center justify-center bg-white"><Loader2 className="animate-spin text-sap-primary" size={48}/></div>;
  if (viewCatalogId && viewCatalogData) return <CatalogGenerator products={[]} units={[]} viewModeData={viewCatalogData} />;
  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

  const NavItem = ({ id, icon: Icon, label, permission, permissions }: any) => {
      let allowed = false;
      if (permission) allowed = hasPermission(permission);
      if (permissions) allowed = hasAnyPermission(permissions);
      if (!allowed) return null;
      const isActive = activeTab === id;
      
      return (
        <button 
            onClick={() => setActiveTab(id as any)} 
            className={`
                group relative flex items-center gap-3 px-3 py-2.5 mx-3 mb-1 rounded-xl transition-all duration-200 outline-none
                ${isActive 
                    ? 'bg-white dark:bg-slate-800 text-sap-primary shadow-sm ring-1 ring-gray-100 dark:ring-slate-700' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-gray-200'
                }
                ${!sidebarOpen ? 'justify-center' : ''}
            `}
        >
            <Icon 
                size={20} 
                strokeWidth={isActive ? 2.5 : 2} 
                className={`transition-colors shrink-0 ${isActive ? 'text-sap-primary' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} 
            />
            
            {sidebarOpen && (
                <span className={`text-[11px] font-black truncate ${isActive ? 'text-sap-primary' : ''}`}>
                    {label}
                </span>
            )}

            {!sidebarOpen && (
                <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 pointer-events-none whitespace-nowrap z-50 shadow-xl">
                    {label}
                    <div className="absolute top-1/2 -right-1 -translate-y-1/2 border-4 border-transparent border-l-gray-900"></div>
                </div>
            )}
        </button>
      );
  };

  return (
    <div className={`flex flex-col h-screen w-full bg-[#F8FAFC] text-[#0F172A] font-sans print:h-auto print:bg-white print:overflow-visible transition-colors duration-300 ${darkMode ? 'dark:bg-slate-900 dark:text-white' : ''}`}>
      
      {/* Command Palette Modal */}
      {showCmdPalette && (
          <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[20vh]" onClick={() => setShowCmdPalette(false)}>
              <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
                      <Search className="text-gray-400"/>
                      <input 
                        type="text" 
                        value={cmdQuery} 
                        onChange={e => setCmdQuery(e.target.value)}
                        placeholder="ابحث عن صفحة أو إجراء..." 
                        className="flex-1 bg-transparent outline-none text-lg font-bold"
                        autoFocus
                      />
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">Esc</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto p-2">
                      {filteredNavItems.map(item => (
                          <button key={item.id} onClick={() => { setActiveTab(item.id as any); setShowCmdPalette(false); }} className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-right transition-colors">
                              <item.icon size={20} className="text-gray-500"/>
                              <span className="font-bold">{item.label}</span>
                          </button>
                      ))}
                      {filteredNavItems.length === 0 && <div className="p-4 text-center text-gray-400">لا توجد نتائج</div>}
                  </div>
              </div>
          </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
          <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}>
              <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-md w-full relative">
                  <h3 className="text-xl font-black mb-6 flex items-center gap-2"><Keyboard/> اختصارات النظام</h3>
                  <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                          <span>البحث السريع</span>
                          <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono font-black border-b-2 border-gray-300">Ctrl + K</kbd>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                          <span>دليل الاختصارات</span>
                          <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono font-black border-b-2 border-gray-300">Shift + ?</kbd>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                          <span>الماسح الضوئي (POS)</span>
                          <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono font-black border-b-2 border-gray-300">F9</kbd>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                          <span>طباعة</span>
                          <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono font-black border-b-2 border-gray-300">Ctrl + P</kbd>
                      </div>
                  </div>
                  <button onClick={() => setShowShortcuts(false)} className="mt-6 w-full py-3 bg-sap-primary text-white rounded-xl font-black">فهمت</button>
              </div>
          </div>
      )}

      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 z-50 shadow-sm print:hidden dark:bg-slate-800 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-gradient-to-br from-sap-primary to-emerald-700 rounded-lg flex items-center justify-center text-white shadow-md"><Crown size={16} fill="#C5A059" className="text-sap-secondary" /></div>
             <div className="flex flex-col hidden sm:flex"><span className="text-sm font-black tracking-tight leading-none text-gray-800 dark:text-gray-100">StoreFlow</span></div>
          </div>
          <div className="h-6 w-[1px] bg-gray-200 mx-2"></div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-50 rounded-lg text-gray-500 dark:hover:bg-slate-700">{sidebarOpen ? <PanelLeftClose size={20}/> : <PanelLeftOpen size={20}/>}</button>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-bold">
          <div className="hidden md:flex items-center gap-1 text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => setShowCmdPalette(true)}>
              <Command size={12}/> <span className="font-mono">Ctrl+K</span>
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500">{darkMode ? <Sun size={18} className="text-orange-400"/> : <Moon size={18}/>}</button>
          <div className="relative group cursor-pointer p-2 hover:bg-gray-100 rounded-full"><Bell size={18} className="text-gray-500"/><span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span></div>
          <div className={`px-3 py-1 rounded-full flex items-center gap-1.5 border ${dbStatus === 'connected' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            <div className={`w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-50'}`}></div>{dbStatus === 'connected' ? 'متصل' : 'غير متصل'}
          </div>
          <button onClick={() => setActiveTab('user_profile')} className="flex items-center gap-3 pl-1 pr-3 py-1 rounded-full bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all group dark:bg-slate-700 dark:border-slate-600">
             <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center border border-gray-200 text-gray-400"><UserCircle size={16}/></div>
             <div className="flex flex-col items-start leading-none gap-0.5"><span className="text-gray-800 dark:text-gray-200">{currentUser.fullName}</span><span className="text-[9px] text-gray-400 uppercase">{currentUser.role === 'admin' ? 'مدير' : 'مستخدم'}</span></div>
          </button>
          <button onClick={handleLogout} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all border border-red-100"><LogOut size={16} /></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden print:overflow-visible print:block">
        <nav className={`${sidebarOpen ? 'w-64' : 'w-[80px]'} bg-[#F1F5F9] dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 flex flex-col py-4 shrink-0 transition-all duration-300 ease-in-out overflow-y-auto overflow-x-hidden print:hidden z-40`}>
          <div className={`px-5 pb-2 text-[10px] font-black text-gray-400 uppercase tracking-widest ${!sidebarOpen && 'hidden'}`}>الرئيسية</div>
          <NavItem id="dashboard" icon={LayoutDashboard} label="لوحة التحكم" permission="view_dashboard" />
          <NavItem id="pos" icon={ShoppingBag} label="نقطة البيع (POS)" permission="record_sales" /> 
          
          <div className="my-2 border-t border-gray-200/60 mx-4"></div>
          <div className={`px-5 pb-2 text-[10px] font-black text-gray-400 uppercase tracking-widest ${!sidebarOpen && 'hidden'}`}>الإدارة المالية</div>
          <NavItem id="sales_entry" icon={DollarSign} label="سجل المبيعات" permission="record_sales" />
          <NavItem id="expenses" icon={TrendingDown} label="المصروفات" permission="manage_settlements" />
          <NavItem id="settlement" icon={Wallet} label="التسوية" permission="manage_settlements" />
          
          <div className="my-2 border-t border-gray-200/60 mx-4"></div>
          <div className={`px-5 pb-2 text-[10px] font-black text-gray-400 uppercase tracking-widest ${!sidebarOpen && 'hidden'}`}>قاعدة البيانات</div>
          <NavItem id="products" icon={Package} label="المنتجات" permissions={['view_products', 'manage_products']} />
          <NavItem id="customers" icon={Users} label="العملاء" permission="record_sales" />
          <NavItem id="list" icon={FileText} label="قوائم الجرد" permission="manage_products" />
          <NavItem id="price_tags" icon={Tag} label="ملصقات الأرفف" permission="print_labels" />
          <NavItem id="offers" icon={Percent} label="العروض الترويجية" permission="print_labels" />
          <NavItem id="catalog" icon={BookOpen} label="المجلة" permission="print_labels" />
          <NavItem id="price_groups" icon={Layout} label="الشاشات" permission="print_labels" />
          
          <div className="mt-auto pt-4 pb-20 border-t border-gray-200">
            <InstallApp sidebarOpen={sidebarOpen} />
            <div className={`px-5 pb-2 text-[10px] font-black text-gray-400 uppercase tracking-widest ${!sidebarOpen && 'hidden'}`}>إعدادات النظام</div>
            <NavItem id="pos_setup" icon={Monitor} label="إعداد الكاشير" permission="manage_settlements" />
            <NavItem id="reports_center" icon={FileLineChart} label="التقارير" permission="view_reports" />
            <NavItem id="users" icon={Users} label="المستخدمين" permission="manage_users" />
            <NavItem id="settings" icon={SettingsIcon} label="الإعدادات العامة" permission="manage_settings" />
          </div>
        </nav>

        <main className="flex-1 overflow-hidden bg-[#F8FAFC] dark:bg-slate-800 relative print:bg-white print:overflow-visible print:p-0 print:block">
          <div className="absolute inset-2 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col print:static print:border-none print:shadow-none print:inset-0">
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar print:p-0">
                {isLoading && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-sap-primary text-white px-6 py-2 rounded-full shadow-lg z-50 flex items-center gap-3 text-xs font-bold animate-in slide-in-from-top-4 fade-in"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div><span>جاري مزامنة البيانات...</span></div>}
                {activeTab === 'dashboard' && <Dashboard products={products} units={units} switchToTab={(t) => setActiveTab(t as any)} onNavigateToList={handleNavigateToList} />}
                {activeTab === 'pos' && <POSInterface products={products} setDailySales={setDailySales} />}
                {activeTab === 'products' && hasAnyPermission(['view_products', 'manage_products']) && <ProductManager products={products} setProducts={setProducts} units={units} setUnits={setUnits} currentUser={currentUser} />}
                {activeTab === 'expenses' && hasPermission('manage_settlements') && <ExpenseManager />}
                {activeTab === 'customers' && hasPermission('record_sales') && <CustomerManager />}
                {activeTab === 'list' && hasPermission('manage_products') && <ProductListBuilder products={products} units={units} onNewProductsAdded={fetchData} initialListParams={targetListParams} clearInitialParams={() => setTargetListParams(null)} />}
                {activeTab === 'sales_entry' && hasPermission('record_sales') && <SalesRecorder branches={currentUser.role === 'admin' ? branches : branches.filter(b => b.id === currentUser.branchId)} sales={dailySales} setSales={setDailySales} />}
                {activeTab === 'reports_center' && hasPermission('view_reports') && <ReportsCenter branches={currentUser.role === 'admin' ? branches : branches.filter(b => b.id === currentUser.branchId)} sales={dailySales} products={products} units={units} />}
                {activeTab === 'settlement' && hasPermission('manage_settlements') && <SettlementManager currentUser={currentUser} />}
                {activeTab === 'pos_setup' && hasPermission('manage_settlements') && <POSManagement branches={branches} />}
                {activeTab === 'branches' && hasPermission('manage_branches') && <BranchManager branches={branches} setBranches={setBranches} sales={dailySales} />}
                {activeTab === 'units' && hasPermission('manage_products') && <UnitManager units={units} setUnits={setUnits} />}
                {activeTab === 'database' && hasPermission('manage_database') && <DatabaseManager />}
                {activeTab === 'settings' && hasPermission('manage_settings') && <Settings />}
                {activeTab === 'user_profile' && <UserProfile user={currentUser} onUpdate={handleProfileUpdate} />}
                {activeTab === 'users' && hasPermission('manage_users') && <UserManager currentUser={currentUser} branches={branches} />}
                {activeTab === 'price_tags' && hasPermission('print_labels') && <PriceTagGenerator products={products} units={units} />}
                {activeTab === 'offers' && hasPermission('print_labels') && <OfferGenerator products={products} units={units} />}
                {activeTab === 'price_groups' && hasPermission('print_labels') && <PriceGroupManager />}
                {activeTab === 'catalog' && hasPermission('print_labels') && <CatalogGenerator products={products} units={units} />}
            </div>
          </div>
        </main>
      </div>
      <footer className="h-7 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between px-4 text-[10px] font-bold text-gray-500 shrink-0 print:hidden z-50">
          <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-sap-secondary"></div><span>النظام جاهز - {darkMode ? 'الوضع الليلي' : 'الوضع النهاري'}</span></div>
          <div className="font-mono flex items-center gap-2">
              <span className="bg-gray-100 dark:bg-slate-700 px-1 rounded">Shift + ? للاختصارات</span>
              v3.2.0
          </div>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
};

export default App;
