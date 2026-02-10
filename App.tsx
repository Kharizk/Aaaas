
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
import { LoginScreen } from './components/LoginScreen';
import { UserManager } from './components/UserManager';
import { UserProfile } from './components/UserProfile';
import { InstallApp } from './components/InstallApp';
import { Product, Unit, Branch, DailySales, User, Permission, CatalogProject } from './types';
import { db } from './services/supabase';
import { 
  Package, Ruler, LayoutDashboard, FileText, DollarSign, 
  MapPin, Settings as SettingsIcon, Database, Tag, Layout, 
  Percent, FileLineChart, Wallet, PanelLeftClose, PanelLeftOpen, Crown, LogOut, Users, UserCircle, BookOpen, Monitor
} from 'lucide-react';

const App: React.FC = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Viewer State (For Public Catalog)
  const [viewCatalogId, setViewCatalogId] = useState<string | null>(null);
  const [viewCatalogData, setViewCatalogData] = useState<CatalogProject | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'list' | 'price_tags' | 'offers' | 'price_groups' | 'catalog' | 'sales_entry' | 'reports_center' | 'settlement' | 'pos_setup' | 'units' | 'branches' | 'settings' | 'database' | 'users' | 'user_profile'>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dbStatus, setDbStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  
  // Navigation Params for deep linking internally
  const [targetListParams, setTargetListParams] = useState<{ listId: string, rowId?: string } | null>(null);

  const [units, setUnits] = useState<Unit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [dailySales, setDailySales] = useState<DailySales[]>([]);

  // Init Check (Auth or Viewer)
  useEffect(() => {
    const init = async () => {
        // 1. Check for Catalog View Mode URL
        const params = new URLSearchParams(window.location.search);
        const catId = params.get('catalog');
        
        if (catId) {
            setAuthChecking(false); // Stop waiting for auth
            setIsCatalogLoading(true);
            setViewCatalogId(catId);
            try {
                const catalog = await db.catalogs.get(catId);
                if (catalog) {
                    setViewCatalogData(catalog as CatalogProject);
                } else {
                    alert('المجلة غير موجودة أو تم حذفها');
                    setViewCatalogId(null);
                }
            } catch (e) {
                console.error("Failed to load catalog", e);
                alert("حدث خطأ أثناء تحميل المجلة");
                setViewCatalogId(null);
            } finally {
                setIsCatalogLoading(false);
            }
            return; // Stop further init
        }

        // 2. Normal Admin Init
        await db.auth.initAdminIfNeeded(); // Ensure at least one admin exists
        const savedUserStr = localStorage.getItem('sf_user_session');
        if (savedUserStr) {
            try {
                const user = JSON.parse(savedUserStr);
                setCurrentUser(user);
            } catch (e) {
                localStorage.removeItem('sf_user_session');
            }
        }
        setAuthChecking(false);
    };
    init();
  }, []);

  // Fetch Data Based on Role & Branch (Only if logged in)
  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
        const isConnected = await db.testConnection();
        setDbStatus(isConnected ? 'connected' : 'error');

        // Parallel Fetch
        const [u, p, b, s] = await Promise.all([
            db.units.getAll(),
            db.products.getAll(),
            db.branches.getAll(),
            db.dailySales.getAll()
        ]);

        setUnits(u);
        setProducts(p);
        setBranches(b);

        // DATA FILTERING LOGIC
        if (currentUser.role === 'admin') {
            setDailySales(s); // Admin sees all
        } else if (currentUser.branchId) {
            // User sees only their branch data
            setDailySales(s.filter(sale => sale.branchId === currentUser.branchId));
        } else {
            setDailySales([]);
        }

    } catch (error) {
        setDbStatus('error');
    } finally {
        setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
        fetchData();
    }
  }, [currentUser, fetchData]);

  const handleLogin = async (username: string, pass: string): Promise<boolean> => {
      try {
          const user = await db.auth.login(username);
          if (user && user.password === pass) {
              if (user.role !== 'admin' && !user.isActive) {
                  alert("هذا الحساب غير نشط. يرجى مراجعة الإدارة.");
                  return false;
              }
              const safeUser: User = {
                  id: user.id,
                  username: user.username,
                  fullName: user.fullName,
                  role: user.role,
                  branchId: user.branchId,
                  permissions: user.permissions,
                  isActive: user.isActive
              };
              setCurrentUser(safeUser);
              localStorage.setItem('sf_user_session', JSON.stringify(safeUser));
              await db.users.updateLastLogin(user.id);
              await db.logs.add({
                  userId: user.id,
                  username: user.username,
                  action: 'LOGIN',
                  details: 'تسجيل دخول ناجح'
              });
              return true;
          }
      } catch (e) { console.error("Login Error", e); }
      return false;
  };

  const handleLogout = () => {
      if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        localStorage.removeItem('sf_user_session');
        setCurrentUser(null);
        window.location.reload();
      }
  };

  const handleProfileUpdate = (updatedUser: User) => {
      setCurrentUser(updatedUser);
      localStorage.setItem('sf_user_session', JSON.stringify(updatedUser));
  };

  const handleNavigateToList = (listId: string, rowId?: string) => {
      setTargetListParams({ listId, rowId });
      setActiveTab('list');
  };

  const hasPermission = (perm: Permission) => {
      if (!currentUser) return false;
      if (currentUser.role === 'admin') return true;
      return currentUser.permissions.includes(perm);
  };

  const hasAnyPermission = (perms: Permission[]) => {
      if (!currentUser) return false;
      if (currentUser.role === 'admin') return true;
      return perms.some(p => currentUser.permissions.includes(p));
  }

  // --- RENDERING LOGIC ---

  // 1. Loading State
  if (authChecking || isCatalogLoading) {
      return (
          <div className="h-screen w-full flex items-center justify-center bg-white">
              <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-sap-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-500 font-bold text-sm">جاري التحميل...</p>
              </div>
          </div>
      );
  }

  // 2. Public Catalog Viewer (No Login Required)
  if (viewCatalogId && viewCatalogData) {
      return (
          <CatalogGenerator 
              products={[]} // Not needed in viewer mode
              units={[]}    // Not needed in viewer mode
              viewModeData={viewCatalogData} 
          />
      );
  }

  // 3. Login Screen
  if (!currentUser) {
      return <LoginScreen onLogin={handleLogin} />;
  }

  // 4. Main App (Admin Dashboard)
  const NavItem = ({ id, icon: Icon, label, permission, permissions }: { id: string, icon: any, label: string, permission?: Permission, permissions?: Permission[] }) => {
      let allowed = false;
      if (permission) allowed = hasPermission(permission);
      if (permissions) allowed = hasAnyPermission(permissions);
      
      if (!allowed) return null;

      const isActive = activeTab === id;
      return (
        <button 
        onClick={() => setActiveTab(id as any)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-black transition-all mb-1 rounded-l-md border-r-[3px] relative overflow-hidden group ${isActive ? 'bg-white text-sap-primary border-sap-primary shadow-sm' : 'text-gray-500 border-transparent hover:bg-white/50 hover:text-gray-800'}`}
        title={label}
        >
        {isActive && <div className="absolute inset-y-0 right-0 w-1 bg-sap-primary"></div>}
        <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={`transition-colors ${isActive ? 'text-sap-primary' : 'text-gray-400 group-hover:text-gray-600'}`} />
        {sidebarOpen && <span className="truncate">{label}</span>}
        </button>
      );
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#F8FAFC] text-[#0F172A] font-sans print:h-auto print:bg-white print:overflow-visible">
      
      {/* Header */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 z-50 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-gradient-to-br from-sap-primary to-emerald-700 rounded-lg flex items-center justify-center text-white shadow-md">
                <Crown size={16} fill="#C5A059" className="text-sap-secondary" />
             </div>
             <div className="flex flex-col hidden sm:flex">
                <span className="text-sm font-black tracking-tight leading-none text-gray-800">StoreFlow</span>
             </div>
          </div>
          <div className="h-6 w-[1px] bg-gray-200 mx-2"></div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-50 rounded-lg text-gray-500 transition-colors">
            {sidebarOpen ? <PanelLeftClose size={20}/> : <PanelLeftOpen size={20}/>}
          </button>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-bold">
          <div className={`px-3 py-1 rounded-full flex items-center gap-1.5 border ${dbStatus === 'connected' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            <div className={`w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-50'}`}></div>
            {dbStatus === 'connected' ? 'متصل' : 'غير متصل'}
          </div>
          
          <button onClick={() => setActiveTab('user_profile')} className="flex items-center gap-3 pl-1 pr-3 py-1 rounded-full bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all group">
             <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center border border-gray-200 text-gray-400 group-hover:text-sap-primary group-hover:border-sap-primary transition-colors">
                <UserCircle size={16}/>
             </div>
             <div className="flex flex-col items-start leading-none gap-0.5">
                 <span className="text-gray-800">{currentUser.fullName}</span>
                 <span className="text-[9px] text-gray-400 uppercase">{currentUser.role === 'admin' ? 'مدير عام' : (branches.find(b=>b.id===currentUser.branchId)?.name || 'مستخدم')}</span>
             </div>
          </button>

          <button onClick={handleLogout} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all border border-red-100" title="تسجيل الخروج">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden print:overflow-visible print:block">
        {/* Navigation Pane */}
        <nav className={`${sidebarOpen ? 'w-64' : 'w-[70px]'} bg-[#F1F5F9] border-l border-gray-200 flex flex-col py-4 shrink-0 transition-all duration-300 ease-in-out overflow-y-auto overflow-x-hidden print:hidden`}>
          <div className="px-5 pb-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {sidebarOpen ? 'الرئيسية' : '•'}
          </div>
          <NavItem id="dashboard" icon={LayoutDashboard} label="لوحة التحكم" permission="view_dashboard" />
          
          <div className="my-4 border-t border-gray-200/60 mx-4"></div>
          
          <div className="px-5 pb-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {sidebarOpen ? 'التصميم والطباعة' : '•'}
          </div>
          <NavItem id="price_tags" icon={Tag} label="مصمم الملصقات" permission="print_labels" />
          <NavItem id="offers" icon={Percent} label="العروض الترويجية" permission="print_labels" />
          <NavItem id="catalog" icon={BookOpen} label="مجلة العروض" permission="print_labels" />
          <NavItem id="price_groups" icon={Layout} label="لوحات الأسعار" permission="print_labels" />
          
          <div className="my-4 border-t border-gray-200/60 mx-4"></div>

          <div className="px-5 pb-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {sidebarOpen ? 'قاعدة البيانات' : '•'}
          </div>
          <NavItem id="products" icon={Package} label="المنتجات" permissions={['view_products', 'manage_products']} />
          <NavItem id="units" icon={Ruler} label="الوحدات" permission="manage_products" />
          <NavItem id="list" icon={FileText} label="قوائم الجرد" permission="manage_products" />
          
          <div className="my-4 border-t border-gray-200/60 mx-4"></div>

          <div className="px-5 pb-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {sidebarOpen ? 'العمليات' : '•'}
          </div>
          <NavItem id="sales_entry" icon={DollarSign} label="المبيعات" permission="record_sales" />
          <NavItem id="settlement" icon={Wallet} label="التسوية" permission="manage_settlements" />
          <NavItem id="pos_setup" icon={Monitor} label="نقاط البيع والكادر" permission="manage_settlements" />
          <NavItem id="reports_center" icon={FileLineChart} label="التقارير" permission="view_reports" />
          <NavItem id="branches" icon={MapPin} label="الفروع" permission="manage_branches" />
          
          <div className="mt-auto pt-4 pb-20 border-t border-gray-200">
            {/* Install PWA Button */}
            <InstallApp sidebarOpen={sidebarOpen} />
            
            <NavItem id="users" icon={Users} label="إدارة المستخدمين" permission="manage_users" />
            <NavItem id="database" icon={Database} label="البيانات" permission="manage_database" />
            <NavItem id="settings" icon={SettingsIcon} label="الإعدادات" permission="manage_settings" />
          </div>
        </nav>

        {/* Workspace Area */}
        <main className="flex-1 overflow-hidden bg-[#F8FAFC] relative print:bg-white print:overflow-visible print:p-0 print:block">
          {/* Inner Window Frame */}
          <div className="absolute inset-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col print:static print:border-none print:shadow-none print:inset-0">
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar print:p-0">
                {isLoading && (
                     <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-sap-primary text-white px-6 py-2 rounded-full shadow-lg z-50 flex items-center gap-3 text-xs font-bold animate-in slide-in-from-top-4 fade-in">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>جاري مزامنة البيانات...</span>
                     </div>
                )}

                {activeTab === 'dashboard' && <Dashboard products={products} units={units} switchToTab={(t) => setActiveTab(t as any)} onNavigateToList={handleNavigateToList} />}
                {activeTab === 'products' && hasAnyPermission(['view_products', 'manage_products']) && <ProductManager products={products} setProducts={setProducts} units={units} setUnits={setUnits} currentUser={currentUser} />}
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
      
      {/* Footer Status Bar */}
      <footer className="h-7 bg-white border-t border-gray-200 flex items-center justify-between px-4 text-[10px] font-bold text-gray-500 shrink-0 print:hidden z-50">
          <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-sap-secondary"></div>
              <span>النظام جاهز</span>
          </div>
          <div className="font-mono">v2.5.0 (Build 2024.10)</div>
      </footer>
    </div>
  );
};

export default App;
