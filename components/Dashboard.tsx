
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Product, Unit, ListRow, DailySales, Expense } from '../types';
import { db } from '../services/supabase';
import { ReportLayout } from './ReportLayout';
import { 
  Package, Ruler, FileText, Clock, 
  ArrowUpRight, AlertCircle, ShoppingBag, Plus, DollarSign, Crown,
  AlertTriangle, CheckCircle, Trash2, Calendar, Zap, Layout, Printer, Wallet, ExternalLink, TrendingUp, TrendingDown
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
  const [isUpdatingAlert, setIsUpdatingAlert] = useState<string | null>(null);
  const [alertDaysThreshold, setAlertDaysThreshold] = useState(60);
  const [salesData, setSalesData] = useState<DailySales[]>([]);

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
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchStats(); }, []);

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

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sap-primary to-emerald-700 flex items-center gap-3">
                <Crown size={36} className="text-sap-secondary fill-current" /> لوحة القيادة
            </h1>
            <p className="text-gray-400 text-sm font-bold mt-1 pr-1">نظرة عامة على أداء المتجر والعمليات الحيوية</p>
        </div>
      </div>

      {/* Stats Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <SAPTile title="المنتجات المسجلة" value={products.length.toLocaleString()} subValue="صنف" icon={Package} onClick={() => switchToTab('products')} colorClass="from-blue-500 to-indigo-600" />
        <SAPTile title="إجمالي الإيرادات" value={stats.sales.toLocaleString()} subValue="ريال" icon={DollarSign} onClick={() => switchToTab('reports_center')} colorClass="from-sap-secondary to-yellow-600" />
        <SAPTile title="صافي الربح التقريبي" value={(stats.sales - stats.expenses).toLocaleString()} subValue="مبيعات - مصروفات" icon={Wallet} onClick={() => switchToTab('expenses')} colorClass={stats.sales - stats.expenses >= 0 ? "from-emerald-500 to-teal-600" : "from-red-500 to-pink-600"} />
        <SAPTile title="الوحدات النشطة" value={units.length} subValue="وحدة" icon={Ruler} onClick={() => switchToTab('units')} colorClass="from-slate-500 to-gray-700" />
      </div>

      {/* Quick Actions */}
      <div>
          <h3 className="text-sm font-black text-gray-400 mb-4 uppercase tracking-widest">الوصول السريع</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <QuickAction label="نقطة البيع" icon={ShoppingBag} action="pos" />
              <QuickAction label="جرد جديد" icon={Plus} action="list" />
              <QuickAction label="مصروفات" icon={TrendingDown} action="expenses" />
              <QuickAction label="طباعة ملصقات" icon={Printer} action="price_tags" />
              <QuickAction label="العملاء" icon={Wallet} action="customers" />
              <QuickAction label="التقارير" icon={FileText} action="reports_center" />
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-[2.5rem] shadow-sm p-8 relative overflow-hidden">
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

        {/* Action Card */}
        <div className="bg-[#1e293b] text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[340px] group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-sap-primary/20 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-sap-primary/30 transition-all duration-1000"></div>
            <div className="relative z-10">
                <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md mb-6 border border-white/10 shadow-inner"><Zap size={28} className="text-sap-secondary fill-current" /></div>
                <h3 className="text-3xl font-black mb-3 leading-tight">جاهز للبدء؟</h3>
                <p className="text-gray-400 text-sm leading-relaxed font-medium">ابدأ ببيع منتجاتك الآن. النظام مهيأ لتسجيل العمليات بسرعة فائقة.</p>
            </div>
            <div className="relative z-10 space-y-3 mt-8">
                <button onClick={() => switchToTab('pos')} className="w-full py-4 bg-white text-gray-900 rounded-2xl font-black text-sm hover:bg-gray-100 shadow-xl transition-all flex items-center justify-center gap-3 transform hover:-translate-y-1"><ShoppingBag size={18}/> فتح الكاشير</button>
            </div>
        </div>
      </div>

      {/* Alerts Section */}
      {expiryAlerts.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-[2rem] overflow-hidden shadow-sm animate-in slide-in-from-bottom-4">
              <div className="px-8 py-5 border-b border-red-100/50 flex justify-between items-center bg-red-100/30">
                  <div className="flex items-center gap-3 text-red-700 font-black text-lg"><AlertTriangle size={24} /> تنبيهات الصلاحية (أقل من {alertDaysThreshold} يوم)</div>
                  <span className="bg-red-200 text-red-800 px-3 py-1 rounded-full text-xs font-black">{expiryAlerts.length} تنبيه</span>
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
