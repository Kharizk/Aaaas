
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Product, Unit, ListRow } from '../types';
import { db } from '../services/supabase';
import { ReportLayout } from './ReportLayout';
import { 
  Package, Ruler, FileText, Clock, 
  ArrowUpRight, AlertCircle, ShoppingBag, Plus, DollarSign, Crown,
  AlertTriangle, CheckCircle, Trash2, Calendar, Zap, Layout, Printer, Wallet
} from 'lucide-react';

interface DashboardProps {
  products: Product[];
  units: Unit[];
  switchToTab: (tab: any) => void;
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

export const Dashboard: React.FC<DashboardProps> = ({ products, units, switchToTab }) => {
  const [stats, setStats] = useState({ lists: 0, sales: 0 });
  const [recentLists, setRecentLists] = useState<any[]>([]);
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlert[]>([]);
  const [isUpdatingAlert, setIsUpdatingAlert] = useState<string | null>(null);
  const [alertDaysThreshold, setAlertDaysThreshold] = useState(60);

  const fetchStats = async () => {
    try {
      const [lists, sales, settings] = await Promise.all([
          db.lists.getAll(), 
          db.dailySales.getAll(),
          db.settings.get()
      ]);
      
      const threshold = settings?.expiryAlertDays || 60;
      setAlertDaysThreshold(threshold);

      setStats({ lists: lists.length, sales: sales.reduce((acc, curr) => acc + curr.amount, 0) });
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

                      // Alert if expires within configured days
                      if (daysDiff <= threshold) {
                          alerts.push({
                              listId: list.id,
                              rowId: row.id,
                              productName: row.name,
                              productCode: row.code,
                              expiryDate: row.expiryDate,
                              daysLeft: daysDiff,
                              qty: Number(row.qty) || 0,
                              listType: list.type || 'inventory'
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

  const handleDismissAlert = async (alertItem: ExpiryAlert) => {
      setIsUpdatingAlert(alertItem.rowId);
      try {
          await db.lists.updateRowDismissed(alertItem.listId, alertItem.rowId);
          setExpiryAlerts(prev => prev.filter(a => a.rowId !== alertItem.rowId));
      } catch (e) { alert("فشل تحديث الحالة"); }
      finally { setIsUpdatingAlert(null); }
  };

  const SAPTile = ({ title, value, subValue, icon: Icon, onClick, colorClass = "from-emerald-500 to-teal-600" }: any) => (
    <div 
      onClick={onClick} 
      className="relative overflow-hidden bg-white border border-gray-100 rounded-2xl shadow-sap-1 hover:shadow-sap-2 transition-all cursor-pointer group hover:-translate-y-1 h-36"
    >
      <div className={`absolute top-0 right-0 w-full h-1 bg-gradient-to-r ${colorClass}`}></div>
      <div className="absolute -right-6 -bottom-6 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon size={120} />
      </div>
      
      <div className="p-5 flex flex-col h-full justify-between relative z-10">
          <div className="flex justify-between items-start">
            <div className={`p-2 rounded-lg bg-gray-50 text-gray-500 group-hover:text-white group-hover:bg-gradient-to-br ${colorClass} transition-colors shadow-sm`}>
                <Icon size={22} />
            </div>
            {subValue && <span className="text-[10px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{subValue}</span>}
          </div>
          
          <div className="mt-2">
            <div className="text-3xl font-black text-gray-800 tracking-tight">{value}</div>
            <div className="text-xs font-bold text-gray-400 mt-1">{title}</div>
          </div>
      </div>
    </div>
  );

  const QuickAction = ({ label, icon: Icon, action }: any) => (
      <button onClick={() => switchToTab(action)} className="flex flex-col items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-sap-primary hover:bg-sap-highlight/30 transition-all group shadow-sm hover:shadow-md">
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-sap-primary group-hover:bg-sap-primary group-hover:text-white transition-colors">
              <Icon size={20} />
          </div>
          <span className="text-xs font-black text-gray-600 group-hover:text-sap-primary">{label}</span>
      </button>
  );

  const ExpiryPrintView = () => {
    const portalNode = document.getElementById('print-container');
    if (!portalNode) return null;

    return createPortal(
        <ReportLayout 
            title="تقرير متابعة صلاحيات المنتجات" 
            subtitle="كشف بالمنتجات المنتهية أو التي قاربت على الانتهاء"
        >
            <div className="mb-6 grid grid-cols-2 gap-4 text-xs font-bold bg-gray-50 p-4 border border-sap-border">
                <div>إجمالي التنبيهات: <span className="text-red-600">{expiryAlerts.length}</span></div>
                <div>تاريخ التقرير: <span>{new Date().toLocaleDateString('ar-SA')}</span></div>
            </div>
            
            <table className="w-full text-right text-[11px]">
                <thead>
                    <tr className="bg-sap-shell text-white uppercase font-black">
                        <th className="p-3 w-12 text-center">#</th>
                        <th className="p-3">كود المنتج</th>
                        <th className="p-3">اسم المنتج</th>
                        <th className="p-3 text-center">الكمية الحالية</th>
                        <th className="p-3">تاريخ الانتهاء</th>
                        <th className="p-3 text-center">الأيام المتبقية</th>
                        <th className="p-3">الحالة</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-bold">
                    {expiryAlerts.map((alert, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                            <td className="p-3 text-center bg-gray-50">{idx + 1}</td>
                            <td className="p-3 font-mono">{alert.productCode}</td>
                            <td className="p-3">{alert.productName}</td>
                            <td className="p-3 text-center">{alert.qty}</td>
                            <td className="p-3 font-mono text-red-600">{alert.expiryDate}</td>
                            <td className="p-3 text-center">{alert.daysLeft}</td>
                            <td className="p-3">
                                {alert.daysLeft <= 0 ? (
                                    <span className="text-red-600 font-black">منتهي الصلاحية</span>
                                ) : (
                                    <span className="text-orange-500 font-bold">قارب على الانتهاء</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </ReportLayout>,
        portalNode
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Expiry Print Portal (Rendered always but hidden via CSS until printed) */}
      {expiryAlerts.length > 0 && <ExpiryPrintView />}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 flex items-center gap-2">
             <Crown size={32} className="text-sap-secondary fill-current" /> 
             لوحة القيادة
          </h1>
          <p className="text-gray-500 text-sm font-medium mt-1 pr-1">نظرة عامة على أداء المتجر والعمليات الجارية</p>
        </div>
        <div className="text-left hidden md:block">
            <div className="text-xs font-bold text-gray-400">{new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <QuickAction label="جرد جديد" icon={Plus} action="list" />
          <QuickAction label="تسجيل مبيعات" icon={DollarSign} action="sales_entry" />
          <QuickAction label="تسوية وردية" icon={Wallet} action="settlement" />
          <QuickAction label="طباعة ملصقات" icon={Printer} action="price_tags" />
          <QuickAction label="لوحة أسعار" icon={Layout} action="price_groups" />
          <QuickAction label="التقارير" icon={FileText} action="reports_center" />
      </div>

      {/* Stats Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <SAPTile 
            title="المنتجات المسجلة" 
            value={products.length.toLocaleString()} 
            subValue="صنف" 
            icon={Package} 
            onClick={() => switchToTab('products')} 
            colorClass="from-blue-500 to-indigo-600" 
        />
        <SAPTile 
            title="إجمالي الإيرادات" 
            value={stats.sales.toLocaleString()} 
            subValue="ريال" 
            icon={DollarSign} 
            onClick={() => switchToTab('reports_center')} 
            colorClass="from-sap-secondary to-yellow-600" 
        />
        <SAPTile 
            title="المستندات المحفوظة" 
            value={stats.lists} 
            subValue="عملية" 
            icon={FileText} 
            onClick={() => switchToTab('list')} 
            colorClass="from-sap-primary to-emerald-700" 
        />
        <SAPTile 
            title="الوحدات النشطة" 
            value={units.length} 
            subValue="وحدة" 
            icon={Ruler} 
            onClick={() => switchToTab('units')} 
            colorClass="from-slate-500 to-gray-700" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl shadow-sap-1 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <span className="text-sm font-black text-gray-700 flex items-center gap-2"><Clock size={18} className="text-sap-primary"/> آخر العمليات المخزنية</span>
                <button onClick={() => switchToTab('list')} className="text-xs font-bold text-sap-primary hover:underline">عرض الكل</button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                    <thead>
                        <tr className="text-gray-400 font-bold border-b border-gray-100">
                            <th className="p-4 bg-transparent font-black">اسم المستند</th>
                            <th className="p-4 bg-transparent font-black">التاريخ</th>
                            <th className="p-4 bg-transparent font-black">النوع</th>
                            <th className="p-4 bg-transparent"></th>
                        </tr>
                    </thead>
                    <tbody className="font-bold text-gray-700">
                        {recentLists.map((list) => (
                            <tr key={list.id} className="border-b border-gray-50 hover:bg-gray-50/80 transition-all cursor-pointer group last:border-0">
                                <td className="p-4 group-hover:text-sap-primary transition-colors">{list.name || 'مستند بدون عنوان'}</td>
                                <td className="p-4 font-mono text-gray-500">{list.date}</td>
                                <td className="p-4">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${list.type === 'receipt' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                        {list.type === 'receipt' ? 'استلام طلبية' : 'جرد مخزون'}
                                    </span>
                                </td>
                                <td className="p-4 text-left"><ArrowUpRight size={16} className="text-gray-300 group-hover:text-sap-primary transition-all" /></td>
                            </tr>
                        ))}
                        {recentLists.length === 0 && <tr><td colSpan={4} className="p-12 text-center text-gray-400 italic font-medium">لا توجد سجلات حديثة لعرضها</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Action Card */}
        <div className="bg-gradient-to-br from-sap-shell to-gray-900 text-white p-6 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[300px]">
            <div className="absolute top-0 right-0 w-48 h-48 bg-sap-primary/20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-sap-secondary/20 rounded-full -ml-10 -mb-10 blur-2xl"></div>
            
            <div className="relative z-10">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm mb-6 border border-white/10">
                    <Zap size={24} className="text-sap-secondary" />
                </div>
                <h3 className="text-2xl font-black mb-2 leading-tight">إدارة متكاملة<br/>للمخزون والمبيعات</h3>
                <p className="text-gray-400 text-xs leading-relaxed font-medium mt-4">نظام StoreFlow يساعدك على تتبع حركة الأصناف بدقة متناهية وإصدار تقارير مالية معتمدة.</p>
            </div>
            
            <div className="relative z-10 space-y-3 mt-8">
                <button onClick={() => switchToTab('list')} className="w-full py-3 bg-white text-gray-900 rounded-xl font-black text-xs hover:bg-gray-100 shadow-lg transition-all flex items-center justify-center gap-2">
                    <Plus size={16}/> عملية جديدة
                </button>
                <button onClick={() => switchToTab('reports_center')} className="w-full py-3 bg-white/10 text-white rounded-xl font-black text-xs hover:bg-white/20 border border-white/10 backdrop-blur-sm transition-all">
                    الذهاب للتقارير
                </button>
            </div>
        </div>
      </div>

      {/* Alerts Section */}
      {expiryAlerts.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-2xl overflow-hidden shadow-sm animate-in slide-in-from-bottom-4">
              <div className="px-6 py-4 border-b border-red-100/50 flex justify-between items-center bg-red-100/30">
                  <div className="flex items-center gap-2 text-red-700 font-black">
                      <AlertTriangle size={20} /> تنبيهات الصلاحية (أقل من {alertDaysThreshold} يوم) - ({expiryAlerts.length})
                  </div>
                  <button onClick={() => window.print()} className="flex items-center gap-2 text-[10px] font-black bg-white text-red-600 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-all shadow-sm">
                      <Printer size={14}/> طباعة التقرير
                  </button>
              </div>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-right text-xs">
                      <thead className="text-red-400 font-bold sticky top-0 bg-red-50/95 backdrop-blur-sm">
                          <tr>
                              <th className="p-4 bg-transparent">المنتج</th>
                              <th className="p-4 bg-transparent">تاريخ الانتهاء</th>
                              <th className="p-4 bg-transparent">الحالة</th>
                              <th className="p-4 bg-transparent text-center">إجراء</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100/50">
                          {expiryAlerts.map(alert => (
                              <tr key={alert.rowId} className="hover:bg-red-100/30 transition-colors">
                                  <td className="p-4">
                                      <div className="font-black text-gray-800">{alert.productName}</div>
                                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">{alert.productCode}</div>
                                  </td>
                                  <td className="p-4 font-mono font-bold text-red-600">{alert.expiryDate}</td>
                                  <td className="p-4">
                                      {alert.daysLeft <= 0 ? (
                                          <span className="inline-flex items-center px-2 py-1 rounded bg-red-600 text-white text-[10px] font-black">منتهي</span>
                                      ) : (
                                          <span className="text-red-600 font-bold text-[11px]">باقي {alert.daysLeft} يوم</span>
                                      )}
                                  </td>
                                  <td className="p-4 text-center">
                                      <button 
                                        onClick={() => handleDismissAlert(alert)}
                                        disabled={isUpdatingAlert === alert.rowId}
                                        className="text-[10px] font-bold underline text-gray-500 hover:text-sap-success transition-colors"
                                      >
                                          {isUpdatingAlert === alert.rowId ? 'جاري...' : 'تجاهل / تم المعالجة'}
                                      </button>
                                  </td>
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
