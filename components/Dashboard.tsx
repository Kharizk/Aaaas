
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Product, Unit, ListRow, DailySales, Expense, Shift } from '../types';
import { db } from '../services/supabase';
import { ReportLayout } from './ReportLayout';
import { useNotification } from './Notifications';
import { 
  Package, Ruler, FileText, Clock, 
  ArrowUpRight, AlertCircle, ShoppingBag, Plus, DollarSign, Crown,
  AlertTriangle, CheckCircle, Trash2, Calendar, Zap, Layout, Printer, Wallet, ExternalLink, TrendingUp, TrendingDown, Truck,
  LogOut, LogIn, Copy, Share2
} from 'lucide-react';

interface DashboardProps {
  products: Product[];
  units: Unit[];
  switchToTab: (tab: any) => void;
  onNavigateToList?: (listId: string, rowId?: string) => void;
}

interface ExpiryAlert {
    listId: string;
    rowId: string;
    productName: string;
    productCode: string;
    expiryDate: string;
    daysLeft: number;
    qty: number;
    listType: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ products, units, switchToTab, onNavigateToList }) => {
  const [stats, setStats] = useState({ lists: 0, sales: 0, expenses: 0 });
  const [recentLists, setRecentLists] = useState<any[]>([]);
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlert[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<Product[]>([]);
  const [isUpdatingAlert, setIsUpdatingAlert] = useState<string | null>(null);
  const [alertDaysThreshold, setAlertDaysThreshold] = useState(60);
  const [salesData, setSalesData] = useState<DailySales[]>([]);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const { notify } = useNotification();
  const [showExpiryPrint, setShowExpiryPrint] = useState(false);

  const handlePrintExpiry = () => {
      setShowExpiryPrint(true);
      setTimeout(() => window.print(), 100);
  };

  const handleCopyExpiry = () => {
      const header = "المنتج\tالكود\tتاريخ الانتهاء\tالأيام المتبقية\tالكمية\n";
      const text = expiryAlerts.map(a => 
          `${a.productName}\t${a.productCode}\t${a.expiryDate}\t${a.daysLeft}\t${a.qty}`
      ).join('\n');
      navigator.clipboard.writeText(header + text);
      notify('تم نسخ التقرير للحافظة', 'success');
  };

  const handleShareExpiry = async () => {
      const text = expiryAlerts.map(a => 
          `- ${a.productName} (${a.expiryDate}) [باقي ${a.daysLeft} يوم]`
      ).join('\n');
      
      if (navigator.share) {
          try {
              await navigator.share({
                  title: 'تنبيهات صلاحية المنتجات',
                  text: `تقرير تنبيهات الصلاحية:\n\n${text}`,
              });
          } catch (err) {
              console.error(err);
          }
      } else {
          handleCopyExpiry();
      }
  };

  const checkOpenShift = async () => {
      try {
          const shifts = await db.shifts.getAll();
          const open = shifts.find((s: Shift) => s.status === 'open');
          setCurrentShift(open || null);
      } catch (e) {
          console.error(e);
      }
  };

  const handleShiftAction = async () => {
      if (currentShift) {
          const endCashStr = prompt('الرجاء إدخال المبلغ النقدي في الدرج عند الإغلاق:', '0');
          if (endCashStr === null) return; // Cancelled
          const endCash = parseFloat(endCashStr);
          if (isNaN(endCash)) return alert('المبلغ غير صحيح');

          if (confirm('هل أنت متأكد من إغلاق الوردية الحالية؟')) {
              const expectedCash = (currentShift.startCash || 0) + stats.sales - stats.expenses; // Simplified
              const updatedShift: Shift = {
                  ...currentShift,
                  endTime: new Date().toISOString(),
                  status: 'closed',
                  endCash: endCash,
                  expectedCash: expectedCash,
                  difference: endCash - expectedCash
              };
              await db.shifts.upsert(updatedShift);
              setCurrentShift(null);
              notify(`تم إغلاق الوردية. العجز/الزيادة: ${updatedShift.difference?.toFixed(2)}`, 'success');
              
              await db.activityLogs.add({
                  action: 'إغلاق وردية',
                  details: `تم إغلاق الوردية رقم ${updatedShift.id.substring(0,8)} - العجز/الزيادة: ${updatedShift.difference}`,
                  user: 'الكاشير',
                  type: 'info'
              });
          }
      } else {
          const startCashStr = prompt('الرجاء إدخال المبلغ النقدي الافتتاحي:', '0');
          if (startCashStr === null) return;
          const startCash = parseFloat(startCashStr);
          if (isNaN(startCash)) return alert('المبلغ غير صحيح');

          const newShift: Shift = {
              id: crypto.randomUUID(),
              userId: 'current-user-id', 
              userName: 'الكاشير', 
              startTime: new Date().toISOString(),
              startCash: startCash, 
              status: 'open'
          };
          await db.shifts.upsert(newShift);
          setCurrentShift(newShift);
          notify('تم فتح وردية جديدة', 'success');

          await db.activityLogs.add({
              action: 'فتح وردية',
              details: `تم فتح وردية جديدة - رصيد افتتاحي: ${startCash}`,
              user: 'الكاشير',
              type: 'info'
          });
      }
  };

  const fetchStats = async () => {
    try {
      const [lists, sales, expenses, settings] = await Promise.all([
          db.lists.getAll(), 
          db.dailySales.getAll(),
          db.expenses.getAll(),
          db.settings.get()
      ]);
      
      const threshold = settings?.expiryAlertDays || 60;
      setAlertDaysThreshold(threshold);
      setSalesData(sales as DailySales[]);

      setStats({ 
          lists: lists.length, 
          sales: sales.reduce((acc: number, curr: DailySales) => acc + (curr.amount || 0), 0),
          expenses: expenses.reduce((acc: number, curr: Expense) => acc + (curr.amount || 0), 0)
      });
      setRecentLists(lists.slice(0, 5));

      const alerts: ExpiryAlert[] = [];
      const today = new Date();
      
      lists.forEach((list: any) => {
          if (list.rows && Array.isArray(list.rows)) {
              list.rows.forEach((row: ListRow) => {
                  if (row.expiryDate && !row.isDismissed) {
                      const exp = new Date(row.expiryDate);
                      const timeDiff = exp.getTime() - today.getTime();
                      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
                      if (daysDiff <= threshold) {
                          alerts.push({
                              listId: list.id, rowId: row.id, productName: row.name, productCode: row.code, expiryDate: row.expiryDate, daysLeft: daysDiff, qty: Number(row.qty) || 0, listType: list.type || 'inventory'
                          });
                      }
                  }
              });
          }
      });
      setExpiryAlerts(alerts.sort((a, b) => a.daysLeft - b.daysLeft));

      // Calculate Low Stock Alerts
      const lowStock = products.filter(p => {
          const threshold = p.lowStockThreshold || 5; // Default threshold is 5
          return (p.stock || 0) <= threshold;
      });
      setLowStockAlerts(lowStock);

    } catch (e) { console.error(e); }
  };

  useEffect(() => { 
      fetchStats(); 
      checkOpenShift();
  }, [products]); // Add products to dependency array to refresh when products change

  const handleDismissAlert = async (e: React.MouseEvent, alertItem: ExpiryAlert) => {
      e.stopPropagation(); 
      setIsUpdatingAlert(alertItem.rowId);
      try {
          await db.lists.updateRowDismissed(alertItem.listId, alertItem.rowId);
          setExpiryAlerts(prev => prev.filter(a => a.rowId !== alertItem.rowId));
      } catch (e) { alert("فشل تحديث الحالة"); }
      finally { setIsUpdatingAlert(null); }
  };

  const SAPTile = ({ title, value, subValue, icon: Icon, onClick, colorClass }: any) => (
    <div onClick={onClick} className="relative overflow-hidden bg-white/50 backdrop-blur-md border border-white/40 rounded-[2rem] shadow-sap-1 hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer group h-40">
      <div className={`absolute inset-0 bg-gradient-to-br ${colorClass} opacity-[0.03] group-hover:opacity-[0.08] transition-opacity`}></div>
      <div className={`absolute -right-6 -bottom-6 opacity-[0.07] group-hover:opacity-[0.15] transition-opacity text-black`}><Icon size={140} /></div>
      <div className="p-6 flex flex-col h-full justify-between relative z-10">
          <div className="flex justify-between items-start">
            <div className={`p-3 rounded-2xl bg-white shadow-sm text-gray-600 group-hover:text-white group-hover:bg-gradient-to-br ${colorClass} transition-all duration-300`}><Icon size={24} /></div>
            {subValue && <span className="text-[10px] font-black bg-white/80 text-gray-500 px-3 py-1 rounded-full shadow-sm">{subValue}</span>}
          </div>
          <div className="mt-2"><div className="text-2xl font-black text-gray-800 tracking-tight font-mono">{value}</div><div className="text-xs font-bold text-gray-500 mt-1">{title}</div></div>
      </div>
    </div>
  );

  const QuickAction = ({ label, icon: Icon, action }: any) => (
      <button onClick={() => switchToTab(action)} className="flex flex-col items-center gap-3 p-4 bg-white border border-gray-100 rounded-2xl hover:border-sap-primary hover:bg-sap-highlight/10 transition-all group shadow-sm hover:shadow-lg active:scale-95">
          <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-sap-primary group-hover:bg-sap-primary group-hover:text-white transition-colors shadow-inner"><Icon size={22} /></div>
          <span className="text-xs font-black text-gray-600 group-hover:text-sap-primary">{label}</span>
      </button>
  );

  // SVG Chart Logic
  const getLast7DaysSales = () => {
      const days = [];
      for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          days.push(d.toISOString().split('T')[0]);
      }
      return days.map(day => {
          const total = salesData.filter(s => s.date === day).reduce((a,b) => a + (b.amount || 0), 0);
          return { day, total };
      });
  };
  
  const chartData = getLast7DaysSales();
  const maxVal = Math.max(...chartData.map(d => d.total), 1);
  const points = chartData.map((d, i) => `${(i / 6) * 100},${100 - (d.total / maxVal) * 100}`).join(' ');
  
  if (showExpiryPrint) {
      return (
          <div className="fixed inset-0 bg-white z-[9999] overflow-auto">
              <ReportLayout title="تقرير تنبيهات صلاحية المنتجات" subtitle={`تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`}>
                  <div className="p-4">
                      <table className="w-full text-right border-collapse">
                          <thead>
                              <tr className="bg-gray-100 border-b border-gray-300">
                                  <th className="p-3 border border-gray-200">المنتج</th>
                                  <th className="p-3 border border-gray-200">الكود</th>
                                  <th className="p-3 border border-gray-200">تاريخ الانتهاء</th>
                                  <th className="p-3 border border-gray-200">الأيام المتبقية</th>
                                  <th className="p-3 border border-gray-200">الكمية</th>
                              </tr>
                          </thead>
                          <tbody>
                              {expiryAlerts.map((alert, idx) => (
                                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                      <td className="p-3 border border-gray-200 font-bold">{alert.productName}</td>
                                      <td className="p-3 border border-gray-200 font-mono">{alert.productCode}</td>
                                      <td className="p-3 border border-gray-200 font-mono" dir="ltr">{alert.expiryDate}</td>
                                      <td className="p-3 border border-gray-200 font-bold text-red-600">{alert.daysLeft} يوم</td>
                                      <td className="p-3 border border-gray-200 font-mono">{alert.qty}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                      <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between text-sm text-gray-500">
                          <span>عدد التنبيهات: {expiryAlerts.length}</span>
                          <span>تم الاستخراج من نظام StoreFlow</span>
                      </div>
                  </div>
              </ReportLayout>
              <button onClick={() => setShowExpiryPrint(false)} className="fixed top-4 left-4 bg-red-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg hover:bg-red-700 transition-colors print:hidden">
                  إغلاق
              </button>
          </div>
      );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sap-primary to-emerald-700 flex items-center gap-3">
                <Crown size={36} className="text-sap-secondary fill-current" /> لوحة القيادة
            </h1>
            <p className="text-gray-400 text-sm font-bold mt-1 pr-1">نظرة عامة على أداء المتجر والعمليات الحيوية</p>
        </div>
        
        <button 
            onClick={handleShiftAction}
            className={`px-6 py-3 rounded-2xl font-black text-sm shadow-lg flex items-center gap-3 transition-all ${
                currentShift 
                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' 
                : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
            }`}
        >
            {currentShift ? <LogOut size={20}/> : <LogIn size={20}/>}
            {currentShift ? 'إغلاق الوردية' : 'بدء وردية جديدة'}
        </button>
      </div>

      {/* Stats Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <SAPTile title="المنتجات المسجلة" value={products.length.toLocaleString()} subValue="صنف" icon={Package} onClick={() => switchToTab('products')} colorClass="from-blue-500 to-indigo-600" />
        <SAPTile title="إجمالي الإيرادات" value={stats.sales.toLocaleString()} subValue="ريال" icon={DollarSign} onClick={() => switchToTab('reports_center')} colorClass="from-sap-secondary to-yellow-600" />
        <SAPTile title="صافي الربح التقريبي" value={(stats.sales - stats.expenses).toLocaleString()} subValue="مبيعات - مصروفات" icon={Wallet} onClick={() => switchToTab('expenses')} colorClass={(stats.sales - stats.expenses) >= 0 ? "from-emerald-500 to-teal-600" : "from-red-500 to-pink-600"} />
        <SAPTile title="الوحدات النشطة" value={units.length} subValue="وحدة" icon={Ruler} onClick={() => switchToTab('units')} colorClass="from-slate-500 to-gray-700" />
      </div>

      {/* Cash Drawer Management */}
      {currentShift && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Wallet size={20}/></div>
                  <div>
                      <h4 className="font-bold text-sm text-gray-800">إدارة الدرج النقدي</h4>
                      <p className="text-xs text-gray-400">الرصيد الحالي المتوقع: <span className="font-mono font-black text-green-600">{(currentShift.startCash + stats.sales - stats.expenses).toLocaleString()}</span> ريال</p>
                  </div>
              </div>
              <div className="flex gap-2">
                  <button 
                      onClick={() => {
                          const amount = prompt('أدخل المبلغ للإيداع (نثريات واردة):');
                          if (amount && !isNaN(parseFloat(amount))) {
                              // Ideally we should have a transaction log for this, for now we just update startCash or track it separately
                              // Since we don't have a separate table for cash movements yet, we will treat it as a "negative expense" or just update startCash for simplicity in this iteration
                              // Better: Add to startCash
                              const val = parseFloat(amount);
                              db.shifts.upsert({ ...currentShift, startCash: currentShift.startCash + val });
                              setCurrentShift({ ...currentShift, startCash: currentShift.startCash + val });
                              notify(`تم إيداع ${val} ريال`, 'success');
                          }
                      }}
                      className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100"
                  >
                      + إيداع
                  </button>
                  <button 
                      onClick={() => {
                          const amount = prompt('أدخل المبلغ للسحب (نثريات صادرة):');
                          if (amount && !isNaN(parseFloat(amount))) {
                              const val = parseFloat(amount);
                              db.shifts.upsert({ ...currentShift, startCash: currentShift.startCash - val });
                              setCurrentShift({ ...currentShift, startCash: currentShift.startCash - val });
                              notify(`تم سحب ${val} ريال`, 'success');
                          }
                      }}
                      className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100"
                  >
                      - سحب
                  </button>
              </div>
          </div>
      )}

      {/* Quick Actions */}
      <div>
          <h3 className="text-sm font-black text-gray-400 mb-4 uppercase tracking-widest">الوصول السريع</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <QuickAction label="نقطة البيع" icon={ShoppingBag} action="pos" />
              <QuickAction label="جرد جديد" icon={Plus} action="list" />
              <QuickAction label="مصروفات" icon={TrendingDown} action="expenses" />
              <QuickAction label="طباعة ملصقات" icon={Printer} action="price_tags" />
              <QuickAction label="الموردين" icon={Truck} action="suppliers" />
              <QuickAction label="التقارير" icon={FileText} action="reports_center" />
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales Chart */}
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-gray-200 rounded-[2.5rem] shadow-sm p-8 relative overflow-hidden">
            <h3 className="font-black text-gray-800 mb-6 flex items-center gap-2 text-lg"><TrendingUp size={22} className="text-sap-primary"/> منحنى المبيعات (7 أيام)</h3>
            <div className="h-56 flex items-end justify-between relative z-10 px-2">
               <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible drop-shadow-md">
                   <defs>
                       <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#006C35" stopOpacity="0.3"/><stop offset="100%" stopColor="#006C35" stopOpacity="0"/></linearGradient>
                   </defs>
                   <path d={`M0,100 ${points.split(' ').map(p => 'L' + p).join(' ')} L100,100 Z`} fill="url(#grad)" />
                   <polyline points={points} fill="none" stroke="#006C35" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                   {chartData.map((d, i) => (
                       <circle key={i} cx={`${(i/6)*100}`} cy={`${100 - (d.total/maxVal)*100}`} r="4" fill="white" stroke="#006C35" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                   ))}
               </svg>
            </div>
            <div className="flex justify-between mt-4 text-[10px] font-black text-gray-400 border-t border-gray-100 pt-4">
                {chartData.map(d => <div key={d.day} className="text-center"><div className="mb-1">{new Date(d.day).toLocaleDateString('ar-SA', {weekday: 'short'})}</div><div className="text-sap-primary opacity-60">{d.total > 0 ? d.total : '-'}</div></div>)}
            </div>
            </div>

            {/* Low Stock Widget */}
            <div className="bg-amber-50 border border-amber-100 rounded-[2.5rem] shadow-sm p-6">
                <h3 className="font-black text-amber-800 mb-4 flex items-center gap-2 text-sm"><AlertTriangle size={18}/> تنبيهات المخزون المنخفض</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {products.filter(p => (p.stock || 0) <= (p.lowStockThreshold || 0) && (p.lowStockThreshold || 0) > 0).map(p => (
                        <div key={p.id} className="flex justify-between items-center p-3 bg-white/60 rounded-xl border border-amber-100/50 hover:bg-white transition-colors">
                            <div>
                                <div className="font-bold text-gray-800 text-xs">{p.name}</div>
                                <div className="text-[10px] text-gray-400 font-mono">المتوفر: {p.stock || 0} / الحد: {p.lowStockThreshold}</div>
                            </div>
                            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[10px] font-black">منخفض</span>
                        </div>
                    ))}
                    {products.filter(p => (p.stock || 0) <= (p.lowStockThreshold || 0) && (p.lowStockThreshold || 0) > 0).length === 0 && (
                        <div className="text-center text-amber-400 text-xs py-4 flex flex-col items-center gap-2">
                            <CheckCircle size={24} />
                            المخزون في حالة جيدة
                        </div>
                    )}
                </div>
            </div>

            {/* Shift Summary Widget */}
            {currentShift && (
                <div className="bg-blue-50 border border-blue-100 rounded-[2.5rem] shadow-sm p-6 mt-6">
                    <h3 className="font-black text-blue-800 mb-4 flex items-center gap-2 text-sm"><Clock size={18}/> ملخص الوردية الحالية</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-white/60 rounded-xl border border-blue-100/50">
                            <span className="text-xs text-gray-500 font-bold">وقت البدء</span>
                            <span className="text-xs font-mono font-black text-blue-600">{new Date(currentShift.startTime).toLocaleTimeString('ar-SA')}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-white/60 rounded-xl border border-blue-100/50">
                            <span className="text-xs text-gray-500 font-bold">الكاشير</span>
                            <span className="text-xs font-bold text-gray-800">{currentShift.userName}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-white/60 rounded-xl border border-blue-100/50">
                            <span className="text-xs text-gray-500 font-bold">المبيعات (تقريبي)</span>
                            <span className="text-xs font-mono font-black text-emerald-600">
                                {salesData
                                    .filter(s => new Date(s.date) >= new Date(currentShift.startTime.split('T')[0])) // Rough filter by date
                                    .reduce((acc, curr) => acc + curr.amount, 0)
                                    .toLocaleString()} SAR
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>

            {/* Top Customers Widget */}
            <div className="bg-purple-50 border border-purple-100 rounded-[2.5rem] shadow-sm p-6 mt-6">
                <h3 className="font-black text-purple-800 mb-4 flex items-center gap-2 text-sm"><Crown size={18}/> كبار العملاء</h3>
                <div className="space-y-2">
                    {Object.values(salesData.reduce((acc: any, sale) => {
                        if (!sale.customerId || !sale.customerName) return acc;
                        if (!acc[sale.customerId]) acc[sale.customerId] = { id: sale.customerId, name: sale.customerName, total: 0, count: 0 };
                        acc[sale.customerId].total += sale.amount;
                        acc[sale.customerId].count += 1;
                        return acc;
                    }, {})).sort((a: any, b: any) => b.total - a.total).slice(0, 5).map((c: any, idx) => (
                        <div key={c.id} className="flex justify-between items-center p-3 bg-white/60 rounded-xl border border-purple-100/50 hover:bg-white transition-colors">
                            <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${idx === 0 ? 'bg-yellow-400 text-yellow-900' : 'bg-purple-200 text-purple-700'}`}>
                                    {idx + 1}
                                </span>
                                <div>
                                    <div className="font-bold text-gray-800 text-xs">{c.name}</div>
                                    <div className="text-[10px] text-gray-400 font-mono">{c.count} عملية شراء</div>
                                </div>
                            </div>
                            <span className="font-black text-purple-700 text-xs font-mono">{c.total.toLocaleString()}</span>
                        </div>
                    ))}
                    {salesData.length === 0 && <div className="text-center text-purple-400 text-xs py-4">لا توجد بيانات كافية</div>}
                </div>
            </div>

            {/* Top Products Widget */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-[2.5rem] shadow-sm p-6 mt-6">
                <h3 className="font-black text-indigo-800 mb-4 flex items-center gap-2 text-sm"><ShoppingBag size={18}/> المنتجات الأكثر مبيعاً</h3>
                <div className="space-y-2">
                    {Object.values(salesData.reduce((acc: any, sale) => {
                        if (!sale.cart) return acc;
                        sale.cart.forEach((item: any) => {
                            if (!acc[item.productId]) acc[item.productId] = { id: item.productId, name: item.name, total: 0, count: 0 };
                            acc[item.productId].total += (item.price * item.quantity);
                            acc[item.productId].count += item.quantity;
                        });
                        return acc;
                    }, {})).sort((a: any, b: any) => b.total - a.total).slice(0, 5).map((p: any, idx) => (
                        <div key={p.id} className="flex justify-between items-center p-3 bg-white/60 rounded-xl border border-indigo-100/50 hover:bg-white transition-colors">
                            <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${idx === 0 ? 'bg-yellow-400 text-yellow-900' : 'bg-indigo-200 text-indigo-700'}`}>
                                    {idx + 1}
                                </span>
                                <div>
                                    <div className="font-bold text-gray-800 text-xs">{p.name}</div>
                                    <div className="text-[10px] text-gray-400 font-mono">{p.count} قطعة</div>
                                </div>
                            </div>
                            <span className="font-black text-indigo-700 text-xs font-mono">{p.total.toLocaleString()}</span>
                        </div>
                    ))}
                    {salesData.length === 0 && <div className="text-center text-indigo-400 text-xs py-4">لا توجد بيانات كافية</div>}
                </div>
            </div>
        </div>

        {/* Action Card & Recent Transactions */}
        <div className="flex flex-col gap-6">
            <div className="bg-[#1e293b] text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[300px] group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-sap-primary/20 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-sap-primary/30 transition-all duration-1000"></div>
                <div className="relative z-10">
                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md mb-6 border border-white/10 shadow-inner"><Zap size={28} className="text-sap-secondary fill-current" /></div>
                    <h3 className="text-3xl font-black mb-3 leading-tight">جاهز للبدء؟</h3>
                    <p className="text-gray-400 text-sm leading-relaxed font-medium">ابدأ ببيع منتجاتك الآن.</p>
                </div>
                <div className="relative z-10 space-y-3 mt-8">
                    <button onClick={() => switchToTab('pos')} className="w-full py-4 bg-white text-gray-900 rounded-2xl font-black text-sm hover:bg-gray-100 shadow-xl transition-all flex items-center justify-center gap-3 transform hover:-translate-y-1"><ShoppingBag size={18}/> فتح الكاشير</button>
                </div>
            </div>

            {/* Recent Transactions List */}
            <div className="bg-white border border-gray-200 rounded-[2.5rem] shadow-sm p-6 flex-1">
                <h4 className="font-black text-gray-600 text-sm mb-4 flex items-center gap-2"><Clock size={16}/> آخر العمليات</h4>
                <div className="space-y-3">
                    {salesData.slice(0, 5).map(sale => (
                        <div key={sale.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${sale.amount >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                    {sale.amount >= 0 ? '+' : '-'}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-800 text-xs">{sale.customerName || 'مبيعات عامة'}</div>
                                    <div className="text-[10px] text-gray-400 font-mono">{sale.date}</div>
                                </div>
                            </div>
                            <div className={`font-black font-mono text-sm ${sale.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {sale.amount.toLocaleString()}
                            </div>
                        </div>
                    ))}
                    {salesData.length === 0 && <div className="text-center text-gray-400 text-xs py-4">لا توجد عمليات حديثة</div>}
                </div>
            </div>
        </div>

      {/* Alerts Section */}
      {expiryAlerts.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-[2rem] overflow-hidden shadow-sm animate-in slide-in-from-bottom-4">
              <div className="px-8 py-5 border-b border-red-100/50 flex flex-col md:flex-row justify-between items-center gap-4 bg-red-100/30">
                  <div className="flex items-center gap-3 text-red-700 font-black text-lg">
                      <AlertTriangle size={24} /> 
                      تنبيهات الصلاحية 
                      <span className="text-sm font-normal text-red-600 opacity-80">(أقل من {alertDaysThreshold} يوم)</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                      <span className="bg-red-200 text-red-800 px-3 py-1 rounded-full text-xs font-black ml-2">{expiryAlerts.length} تنبيه</span>
                      
                      <button onClick={handlePrintExpiry} className="p-2 bg-white text-red-600 rounded-lg hover:bg-red-50 border border-red-100 shadow-sm transition-colors" title="طباعة تقرير">
                          <Printer size={18} />
                      </button>
                      <button onClick={handleCopyExpiry} className="p-2 bg-white text-red-600 rounded-lg hover:bg-red-50 border border-red-100 shadow-sm transition-colors" title="نسخ">
                          <Copy size={18} />
                      </button>
                      <button onClick={handleShareExpiry} className="p-2 bg-white text-red-600 rounded-lg hover:bg-red-50 border border-red-100 shadow-sm transition-colors" title="مشاركة">
                          <Share2 size={18} />
                      </button>
                  </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2">
                  <table className="w-full text-right text-xs">
                      <thead className="text-red-400 font-bold sticky top-0 bg-red-50 z-10"><tr><th className="p-4">المنتج</th><th className="p-4">تاريخ الانتهاء</th><th className="p-4">الحالة</th><th className="p-4 text-center">إجراء</th></tr></thead>
                      <tbody className="divide-y divide-red-100/50">
                          {expiryAlerts.map(alert => (
                              <tr key={alert.rowId} onClick={() => onNavigateToList?.(alert.listId, alert.rowId)} className="hover:bg-red-100/40 transition-colors cursor-pointer group rounded-xl">
                                  <td className="p-4 group-hover:text-red-800 transition-colors">
                                      <div className="font-black text-gray-800 group-hover:text-red-900 text-sm">{alert.productName}</div>
                                      <div className="text-[10px] text-gray-500 font-mono mt-0.5 opacity-60">REF: {alert.productCode}</div>
                                  </td>
                                  <td className="p-4 font-mono font-bold text-red-600">{alert.expiryDate}</td>
                                  <td className="p-4">{alert.daysLeft <= 0 ? <span className="bg-red-600 text-white px-2 py-1 rounded text-[10px] font-black">منتهي الصلاحية</span> : <span className="text-red-600 font-bold bg-red-100 px-2 py-1 rounded text-[10px]">باقي {alert.daysLeft} يوم</span>}</td>
                                  <td className="p-4 text-center"><button onClick={(e) => handleDismissAlert(e, alert)} disabled={isUpdatingAlert === alert.rowId} className="text-[10px] font-bold text-gray-400 hover:text-sap-primary transition-colors px-3 py-1.5 rounded hover:bg-white border border-transparent hover:border-gray-200 shadow-sm">تجاهل</button></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}
    </div>
  );
};
