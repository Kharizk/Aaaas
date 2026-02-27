
import React, { useState, useMemo, useEffect } from 'react';
import { Branch, DailySales, Product, Unit, SavedList, ListRow, Expense } from '../types';
import { SalesReports } from './SalesReports';
import { SalesMatrixReport } from './SalesMatrixReport';
import { ReportLayout } from './ReportLayout';
import { db } from '../services/supabase';
import { 
  FileLineChart, LayoutGrid, BarChart3, TrendingUp, TrendingDown, Package, Printer, 
  Eye, EyeOff, Boxes, Search, CheckCircle2, ClipboardList, Calendar, Filter, ArrowLeft, AlertTriangle, Wallet 
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ReportsCenterProps {
  branches: Branch[];
  sales: DailySales[];
  products: Product[];
  units: Unit[];
}

export const ReportsCenter: React.FC<ReportsCenterProps> = ({ branches, sales, products, units }) => {
  const [activeSubTab, setActiveSubTab] = useState<'standard' | 'matrix' | 'products' | 'inventory' | 'expiry' | 'low_stock' | 'profit'>('standard');
  const [showHeader, setShowHeader] = useState(true);
  const [productSearch, setProductSearch] = useState('');

  // --- Profit Report Sub-Component ---
  const ProfitReportView = () => {
      const [expenses, setExpenses] = useState<Expense[]>([]);
      const [loading, setLoading] = useState(true);
      const [dateFrom, setDateFrom] = useState(() => {
          const d = new Date();
          d.setMonth(d.getMonth() - 1);
          return d.toISOString().split('T')[0];
      });
      const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

      useEffect(() => {
          const load = async () => {
              try {
                  const exp = await db.expenses.getAll();
                  setExpenses(exp as Expense[]);
              } catch (e) { console.error(e); }
              finally { setLoading(false); }
          };
          load();
      }, []);

      const profitData = useMemo(() => {
          // Filter by date
          const filteredSales = sales.filter(s => s.date >= dateFrom && s.date <= dateTo);
          const filteredExpenses = expenses.filter(e => e.date >= dateFrom && e.date <= dateTo);

          const totalSales = filteredSales.reduce((sum, s) => sum + (s.amount || 0), 0);
          const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
          const netProfit = totalSales - totalExpenses;

          // Group by Day for Chart
          const daysMap = new Map<string, { date: string, sales: number, expenses: number, profit: number }>();
          
          // Init days
          const start = new Date(dateFrom);
          const end = new Date(dateTo);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              const dateStr = d.toISOString().split('T')[0];
              daysMap.set(dateStr, { date: dateStr, sales: 0, expenses: 0, profit: 0 });
          }

          filteredSales.forEach(s => {
              const d = daysMap.get(s.date);
              if (d) d.sales += (s.amount || 0);
          });

          filteredExpenses.forEach(e => {
              const d = daysMap.get(e.date);
              if (d) d.expenses += (e.amount || 0);
          });

          // Calculate profit per day
          daysMap.forEach(v => v.profit = v.sales - v.expenses);

          return {
              totalSales,
              totalExpenses,
              netProfit,
              chartData: Array.from(daysMap.values())
          };
      }, [sales, expenses, dateFrom, dateTo]);

      return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 printable">
              <div className="bg-white border border-sap-border rounded-[2.5rem] p-6 shadow-sm print:hidden">
                  <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                      <div className="flex items-center gap-5">
                          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-[2rem] flex items-center justify-center shadow-lg">
                              <Wallet size={32} />
                          </div>
                          <div>
                              <h2 className="text-2xl font-black text-sap-text">تحليل الربحية</h2>
                              <p className="text-xs text-sap-text-variant font-bold uppercase tracking-widest mt-1">صافي الدخل = المبيعات - المصروفات</p>
                          </div>
                      </div>

                      <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold" />
                          <ArrowLeft size={14} className="text-gray-400"/>
                          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold" />
                          <button onClick={() => window.print()} className="bg-sap-shell text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-black transition-all shadow-lg">
                              <Printer size={16}/> طباعة
                          </button>
                      </div>
                  </div>
              </div>

              <ReportLayout 
                  title="تقرير صافي الدخل والربحية" 
                  subtitle={`الفترة من ${dateFrom} إلى ${dateTo}`}
                  showHeader={showHeader}
              >
                  <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                      <div className="p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100 shadow-sm">
                          <div className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-2">إجمالي المبيعات</div>
                          <div className="text-3xl font-black text-emerald-700 font-mono">{profitData.totalSales.toLocaleString()}</div>
                      </div>
                      <div className="p-6 bg-rose-50 rounded-[2rem] border border-rose-100 shadow-sm">
                          <div className="text-xs font-black text-rose-600 uppercase tracking-widest mb-2">إجمالي المصروفات</div>
                          <div className="text-3xl font-black text-rose-700 font-mono">{profitData.totalExpenses.toLocaleString()}</div>
                      </div>
                      <div className={`p-6 rounded-[2rem] border shadow-sm ${profitData.netProfit >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
                          <div className={`text-xs font-black uppercase tracking-widest mb-2 ${profitData.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>صافي الربح / الخسارة</div>
                          <div className={`text-3xl font-black font-mono ${profitData.netProfit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{profitData.netProfit.toLocaleString()}</div>
                      </div>
                  </div>

                  <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={profitData.chartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                              <XAxis dataKey="date" tick={{fontSize: 10, fontWeight: 'bold'}} stroke="#9ca3af" />
                              <YAxis tick={{fontSize: 10, fontWeight: 'bold'}} stroke="#9ca3af" />
                              <Tooltip 
                                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)'}}
                                  cursor={{fill: '#f3f4f6'}}
                              />
                              <Legend />
                              <Bar dataKey="sales" name="المبيعات" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                              <Bar dataKey="expenses" name="المصروفات" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                              <Bar dataKey="profit" name="الصافي" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </ReportLayout>
          </div>
      );
  };

  // --- Expiry Report Sub-Component ---
  const ExpiryReportView = () => {
    const [lists, setLists] = useState<SavedList[]>([]);
    const [loading, setLoading] = useState(true);
    const [daysThreshold, setDaysThreshold] = useState(90);

    useEffect(() => {
        const fetchLists = async () => {
            try {
                const data = await db.lists.getAll();
                setLists(data as SavedList[]);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchLists();
    }, []);

    const expiryData = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const thresholdDate = new Date(today);
        thresholdDate.setDate(today.getDate() + daysThreshold);

        let alerts: {
            productName: string;
            code: string;
            expiryDate: string;
            daysRemaining: number;
            qty: number;
            listName: string;
            listDate: string;
            unitName: string;
        }[] = [];

        lists.forEach(list => {
            if (list.rows && Array.isArray(list.rows)) {
                list.rows.forEach(row => {
                    if (row.expiryDate) {
                        const exp = new Date(row.expiryDate);
                        exp.setHours(0, 0, 0, 0);
                        
                        // Calculate difference in days
                        const diffTime = exp.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        // Check if within threshold (or expired)
                        if (diffDays <= daysThreshold) {
                            alerts.push({
                                productName: row.name,
                                code: row.code,
                                expiryDate: row.expiryDate,
                                daysRemaining: diffDays,
                                qty: Number(row.qty) || 0,
                                listName: list.name,
                                listDate: list.date.split('T')[0],
                                unitName: units.find(u => u.id === row.unitId)?.name || '-'
                            });
                        }
                    }
                });
            }
        });

        // Sort: Expired first, then soonest to expire
        return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
    }, [lists, daysThreshold, units]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 printable">
            <div className="bg-white border border-sap-border rounded-[2.5rem] p-6 shadow-sm print:hidden">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-[2rem] flex items-center justify-center shadow-lg">
                            <AlertTriangle size={32} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-sap-text">تنبيهات الصلاحية</h2>
                            <p className="text-xs text-sap-text-variant font-bold uppercase tracking-widest mt-1">المنتجات التي قاربت على الانتهاء</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-2 px-2">
                            <Filter size={16} className="text-sap-primary"/>
                            <span className="text-[10px] font-bold text-gray-500">نطاق التنبيه:</span>
                        </div>
                        <select 
                            value={daysThreshold} 
                            onChange={e => setDaysThreshold(Number(e.target.value))} 
                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold min-w-[120px]"
                        >
                            <option value={30}>أقل من 30 يوم</option>
                            <option value={60}>أقل من 60 يوم</option>
                            <option value={90}>أقل من 90 يوم</option>
                            <option value={180}>أقل من 6 أشهر</option>
                            <option value={365}>أقل من سنة</option>
                        </select>
                        
                        <button onClick={() => window.print()} className="bg-sap-shell text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-black transition-all shadow-lg">
                            <Printer size={16}/> طباعة التقرير
                        </button>
                    </div>
                </div>
            </div>

            <ReportLayout 
                title="تقرير صلاحية المنتجات" 
                subtitle={`المنتجات التي تنتهي صلاحيتها خلال ${daysThreshold} يوم`}
                showHeader={showHeader}
            >
                 <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                        <div className="text-[10px] font-black text-red-400 uppercase">منتهية الصلاحية</div>
                        <div className="text-2xl font-black text-red-600 mt-1">{expiryData.filter(i => i.daysRemaining < 0).length}</div>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                        <div className="text-[10px] font-black text-orange-400 uppercase">تنتهي خلال 30 يوم</div>
                        <div className="text-2xl font-black text-orange-600 mt-1">{expiryData.filter(i => i.daysRemaining >= 0 && i.daysRemaining <= 30).length}</div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                        <div className="text-[10px] font-black text-blue-400 uppercase">إجمالي التنبيهات</div>
                        <div className="text-2xl font-black text-blue-600 mt-1">{expiryData.length}</div>
                    </div>
                </div>

                <div className="border-2 border-gray-100 rounded-[2rem] overflow-hidden bg-white shadow-sm">
                    {loading ? (
                        <div className="p-10 text-center text-gray-400">جاري تحميل البيانات...</div>
                    ) : (
                        <table className="w-full text-right border-collapse">
                            <thead>
                                <tr className="bg-sap-shell text-white text-[10px] font-black uppercase tracking-widest border-b border-white/10">
                                    <th className="px-6 py-4 border-l border-white/5 w-32">تاريخ الانتهاء</th>
                                    <th className="px-6 py-4 border-l border-white/5 w-32">المتبقي (يوم)</th>
                                    <th className="px-6 py-4 border-l border-white/5">اسم المنتج</th>
                                    <th className="px-6 py-4 border-l border-white/5 w-32">كود الصنف</th>
                                    <th className="px-6 py-4 border-l border-white/5 w-24 text-center">الكمية</th>
                                    <th className="px-6 py-4 border-l border-white/5 w-24">الوحدة</th>
                                    <th className="px-6 py-4">المصدر</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs font-bold divide-y divide-gray-50">
                                {expiryData.length === 0 ? (
                                    <tr><td colSpan={7} className="p-10 text-center text-gray-400 italic">لا توجد منتجات قاربت على الانتهاء</td></tr>
                                ) : (
                                    expiryData.map((item, idx) => {
                                        const isExpired = item.daysRemaining < 0;
                                        const isUrgent = item.daysRemaining <= 30;
                                        return (
                                            <tr key={idx} className={`hover:bg-gray-50 transition-all group ${isExpired ? 'bg-red-50/30' : ''}`}>
                                                <td className={`px-6 py-3 font-mono font-black ${isExpired ? 'text-red-600' : 'text-gray-700'}`}>{item.expiryDate}</td>
                                                <td className="px-6 py-3">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-black ${isExpired ? 'bg-red-100 text-red-700' : (isUrgent ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700')}`}>
                                                        {isExpired ? `منتهي منذ ${Math.abs(item.daysRemaining)}` : `باقي ${item.daysRemaining}`}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-gray-800">{item.productName}</td>
                                                <td className="px-6 py-3 font-mono text-gray-500">{item.code || '-'}</td>
                                                <td className="px-6 py-3 text-center font-black text-sap-text bg-gray-50/50">{item.qty}</td>
                                                <td className="px-6 py-3 text-gray-500">{item.unitName}</td>
                                                <td className="px-6 py-3 text-gray-400 text-[10px]">{item.listName} ({item.listDate})</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </ReportLayout>
        </div>
    );
  };

  // --- Inventory Report Sub-Component ---
  const InventoryReportView = () => {
    const [lists, setLists] = useState<SavedList[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [selectedListId, setSelectedListId] = useState<string>('all');
    const [itemSearch, setItemSearch] = useState('');

    useEffect(() => {
        const fetchLists = async () => {
            try {
                const data = await db.lists.getAll();
                // Sort by date descending (newest first) and include ALL types
                const sortedLists = data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setLists(sortedLists as SavedList[]);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchLists();
    }, []);

    const filteredData = useMemo(() => {
        // 1. Filter Lists based on Date and Selection
        const relevantLists = lists.filter(l => {
            const listDate = l.date.split('T')[0];
            const inDate = listDate >= dateFrom && listDate <= dateTo;
            const isSelected = selectedListId === 'all' || l.id === selectedListId;
            return inDate && isSelected;
        });

        // 2. Flatten Rows
        let flatRows: { 
            listName: string; 
            listDate: string; 
            listType: string;
            row: ListRow; 
            unitName: string 
        }[] = [];

        relevantLists.forEach(list => {
            if (list.rows && Array.isArray(list.rows)) {
                list.rows.forEach(row => {
                    // Only include actual items
                    if (row.name) {
                        flatRows.push({
                            listName: list.name,
                            listDate: list.date,
                            listType: list.type || 'inventory',
                            row: row,
                            unitName: units.find(u => u.id === row.unitId)?.name || '-'
                        });
                    }
                });
            }
        });

        // 3. Filter by Item Search
        if (itemSearch.trim()) {
            const term = itemSearch.toLowerCase();
            flatRows = flatRows.filter(item => 
                item.row.name.toLowerCase().includes(term) || 
                item.row.code.toLowerCase().includes(term)
            );
        }

        return flatRows;
    }, [lists, dateFrom, dateTo, selectedListId, units, itemSearch]);

    const totalQty = filteredData.reduce((acc, curr) => acc + (Number(curr.row.qty) || 0), 0);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 printable">
            {/* Controls */}
            <div className="bg-white border border-sap-border rounded-[2.5rem] p-6 shadow-sm print:hidden">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-800 text-white rounded-[2rem] flex items-center justify-center shadow-lg">
                            <ClipboardList size={32} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-sap-text">أرشيف العمليات المخزنية</h2>
                            <p className="text-xs text-sap-text-variant font-bold uppercase tracking-widest mt-1">سجل الجرد وسندات الاستلام</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-2 px-2">
                            <Filter size={16} className="text-sap-primary"/>
                            <span className="text-[10px] font-bold text-gray-500">الفترة:</span>
                        </div>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold" />
                        <ArrowLeft size={14} className="text-gray-400"/>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold" />
                        
                        <div className="w-px h-8 bg-gray-200 mx-2"></div>
                        
                        <select value={selectedListId} onChange={e => setSelectedListId(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold min-w-[180px]">
                            <option value="all">كافة القوائم (جرد + استلام)</option>
                            {lists.map(l => (
                                <option key={l.id} value={l.id}>
                                    {l.name} ({l.type === 'inventory' ? 'جرد' : 'استلام'}) - {l.date}
                                </option>
                            ))}
                        </select>

                        <div className="w-px h-8 bg-gray-200 mx-2"></div>

                        <div className="relative">
                            <input 
                                type="text" 
                                value={itemSearch} 
                                onChange={e => setItemSearch(e.target.value)} 
                                placeholder="بحث في الأصناف..."
                                className="bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-xs font-bold w-40 focus:w-60 transition-all focus:border-sap-primary"
                            />
                            <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                        </div>

                        <button onClick={() => window.print()} className="bg-sap-shell text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-black transition-all shadow-lg">
                            <Printer size={16}/> طباعة
                        </button>
                    </div>
                </div>
            </div>

            {/* Report Content */}
            <ReportLayout 
                title="تقرير تفصيلي لحركة المخزون" 
                subtitle={`الفترة من ${dateFrom} إلى ${dateTo}`}
                showHeader={showHeader}
            >
                <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="text-[10px] font-black text-gray-400 uppercase">عدد الأصناف</div>
                        <div className="text-2xl font-black text-sap-text mt-1">{filteredData.length}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="text-[10px] font-black text-gray-400 uppercase">إجمالي الكميات</div>
                        <div className="text-2xl font-black text-sap-primary mt-1 font-mono">{totalQty}</div>
                    </div>
                </div>

                <div className="border-2 border-gray-100 rounded-[2rem] overflow-hidden bg-white shadow-sm">
                    {loading ? (
                        <div className="p-10 text-center text-gray-400">جاري تحميل البيانات...</div>
                    ) : (
                        <table className="w-full text-right border-collapse">
                            <thead>
                                <tr className="bg-sap-shell text-white text-[10px] font-black uppercase tracking-widest border-b border-white/10">
                                    <th className="px-6 py-4 border-l border-white/5 w-28">التاريخ</th>
                                    <th className="px-6 py-4 border-l border-white/5 w-24">النوع</th>
                                    <th className="px-6 py-4 border-l border-white/5">المستند / القائمة</th>
                                    <th className="px-6 py-4 border-l border-white/5 w-32">كود الصنف</th>
                                    <th className="px-6 py-4 border-l border-white/5">اسم المنتج</th>
                                    <th className="px-6 py-4 border-l border-white/5 w-24 text-center">الكمية</th>
                                    <th className="px-6 py-4 border-l border-white/5 w-24">الوحدة</th>
                                    <th className="px-6 py-4 w-32">الصلاحية</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs font-bold divide-y divide-gray-50">
                                {filteredData.length === 0 ? (
                                    <tr><td colSpan={8} className="p-10 text-center text-gray-400 italic">لا توجد بيانات مطابقة للبحث</td></tr>
                                ) : (
                                    filteredData.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-indigo-50/30 transition-all group">
                                            <td className="px-6 py-3 font-mono text-gray-500">{item.listDate}</td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-1 rounded text-[9px] font-black ${item.listType === 'inventory' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                                    {item.listType === 'inventory' ? 'جرد' : 'استلام'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-sap-primary">{item.listName}</td>
                                            <td className="px-6 py-3 font-mono text-gray-600 bg-gray-50/50">{item.row.code || '-'}</td>
                                            <td className="px-6 py-3 text-gray-800">{item.row.name}</td>
                                            <td className="px-6 py-3 text-center font-black text-sap-text bg-indigo-50/20">{item.row.qty}</td>
                                            <td className="px-6 py-3 text-gray-500">{item.unitName}</td>
                                            <td className="px-6 py-3 font-mono text-red-500">{item.row.expiryDate || '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </ReportLayout>
        </div>
    );
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.toLowerCase().includes(productSearch.toLowerCase()));
  }, [products, productSearch]);

  const ProductReport = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 printable">
        <div className="bg-white border border-sap-border rounded-[2.5rem] p-6 flex flex-col md:flex-row justify-between items-center print:hidden shadow-sm gap-6">
            <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-gradient-to-br from-sap-shell to-slate-900 text-white rounded-[2rem] flex items-center justify-center shadow-lg">
                    <Boxes size={32} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-sap-text">كشف المنتجات الموحد</h2>
                    <p className="text-xs text-sap-text-variant font-bold uppercase tracking-widest mt-1">كود المنتج • اسم الصنف • وحدة القياس</p>
                </div>
            </div>
            
            <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                    <input 
                        type="text" 
                        value={productSearch} 
                        onChange={e => setProductSearch(e.target.value)} 
                        placeholder="بحث في الكود أو الاسم..." 
                        className="w-full pr-10 pl-4 py-3 !bg-gray-50 !border-none !rounded-2xl !text-xs !font-black"
                    />
                    <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
                </div>
                <button onClick={() => window.print()} className="bg-sap-shell text-white px-8 py-3 rounded-2xl text-xs font-black flex items-center gap-2 shadow-xl hover:bg-black active:scale-95">
                    <Printer size={18}/> طباعة الكشف
                </button>
            </div>
        </div>

        <ReportLayout 
          title="دليل المنتجات والأصناف المعتمد" 
          subtitle="سجل رسمي شامل لبيانات المخزون"
          showHeader={showHeader}
        >
            <div className="border-2 border-gray-100 rounded-[2rem] overflow-hidden bg-white">
                <table className="w-full text-right border-collapse">
                    <thead>
                        <tr className="bg-sap-shell text-white text-[11px] font-black uppercase tracking-widest border-b border-white/10">
                            <th className="px-8 py-6 w-48 border-l border-white/5">كود المنتج</th>
                            <th className="px-8 py-6">اسم الصنف / المنتج</th>
                            <th className="px-8 py-6 w-40 text-center">وحدة القياس</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm font-bold divide-y divide-gray-50">
                        {filteredProducts.map(p => (
                            <tr key={p.id} className="hover:bg-sap-highlight/20 transition-all group">
                                <td className="px-8 py-5">
                                    <div className="font-mono text-base font-black text-sap-primary">{p.code}</div>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="text-sap-text text-base">{p.name}</div>
                                </td>
                                <td className="px-8 py-5 text-center">
                                    <span className="inline-flex px-4 py-1.5 bg-gray-100 rounded-full text-[10px] font-black text-gray-500 uppercase">
                                        {units.find(u => u.id === p.unitId)?.name || 'قطعة'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </ReportLayout>
    </div>
  );

  // --- Low Stock Report Sub-Component ---
  const LowStockReportView = () => {
    const [lists, setLists] = useState<SavedList[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLists = async () => {
            try {
                const data = await db.lists.getAll();
                setLists(data as SavedList[]);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchLists();
    }, []);

    const lowStockData = useMemo(() => {
        const stockMap = new Map<string, number>();

        // Initialize with 0
        products.forEach(p => stockMap.set(p.id, 0));

        // Add from Lists (Inventory/Receipts)
        lists.forEach(list => {
            if (list.rows && Array.isArray(list.rows)) {
                list.rows.forEach(row => {
                    // Try to find product by code
                    const product = products.find(p => p.code === row.code);
                    if (product) {
                        const current = stockMap.get(product.id) || 0;
                        stockMap.set(product.id, current + (Number(row.qty) || 0));
                    }
                });
            }
        });

        // Subtract Sales
        sales.forEach(sale => {
            if (sale.cart && Array.isArray(sale.cart)) {
                sale.cart.forEach(item => {
                    const current = stockMap.get(item.productId) || 0;
                    stockMap.set(item.productId, current - (item.quantity || 0));
                });
            }
        });

        // Filter for Low Stock
        const alerts = products
            .map(p => ({
                ...p,
                currentStock: stockMap.get(p.id) || 0
            }))
            .filter(p => {
                const threshold = p.lowStockThreshold || 0;
                return threshold > 0 && p.currentStock <= threshold;
            });

        return alerts.sort((a, b) => a.currentStock - b.currentStock);
    }, [products, lists, sales]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 printable">
            <div className="bg-white border border-sap-border rounded-[2.5rem] p-6 shadow-sm print:hidden">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-[2rem] flex items-center justify-center shadow-lg">
                            <TrendingDown size={32} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-sap-text">تنبيهات نقص المخزون</h2>
                            <p className="text-xs text-sap-text-variant font-bold uppercase tracking-widest mt-1">المنتجات التي وصلت للحد الأدنى</p>
                        </div>
                    </div>
                    <button onClick={() => window.print()} className="bg-sap-shell text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-black transition-all shadow-lg">
                        <Printer size={16}/> طباعة التقرير
                    </button>
                </div>
            </div>

            <ReportLayout 
                title="تقرير نواقص المخزون" 
                subtitle="المنتجات التي تتطلب إعادة طلب"
                showHeader={showHeader}
            >
                 <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                        <div className="text-[10px] font-black text-red-400 uppercase">نفذت من المخزون</div>
                        <div className="text-2xl font-black text-red-600 mt-1">{lowStockData.filter(i => i.currentStock <= 0).length}</div>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                        <div className="text-[10px] font-black text-amber-400 uppercase">تحت الحد الأدنى</div>
                        <div className="text-2xl font-black text-amber-600 mt-1">{lowStockData.filter(i => i.currentStock > 0).length}</div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                        <div className="text-[10px] font-black text-blue-400 uppercase">إجمالي التنبيهات</div>
                        <div className="text-2xl font-black text-blue-600 mt-1">{lowStockData.length}</div>
                    </div>
                </div>

                <div className="border-2 border-gray-100 rounded-[2rem] overflow-hidden bg-white shadow-sm">
                    {loading ? (
                        <div className="p-10 text-center text-gray-400">جاري تحميل البيانات...</div>
                    ) : (
                        <table className="w-full text-right border-collapse">
                            <thead>
                                <tr className="bg-sap-shell text-white text-[10px] font-black uppercase tracking-widest border-b border-white/10">
                                    <th className="px-6 py-4 border-l border-white/5 w-32">كود الصنف</th>
                                    <th className="px-6 py-4 border-l border-white/5">اسم المنتج</th>
                                    <th className="px-6 py-4 border-l border-white/5 w-32 text-center">المخزون الحالي</th>
                                    <th className="px-6 py-4 border-l border-white/5 w-32 text-center">الحد الأدنى</th>
                                    <th className="px-6 py-4 w-32 text-center">الحالة</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs font-bold divide-y divide-gray-50">
                                {lowStockData.length === 0 ? (
                                    <tr><td colSpan={5} className="p-10 text-center text-gray-400 italic">لا توجد منتجات تحت الحد الأدنى</td></tr>
                                ) : (
                                    lowStockData.map((item, idx) => {
                                        const isZero = item.currentStock <= 0;
                                        return (
                                            <tr key={idx} className={`hover:bg-gray-50 transition-all group ${isZero ? 'bg-red-50/30' : ''}`}>
                                                <td className="px-6 py-3 font-mono text-gray-500">{item.code}</td>
                                                <td className="px-6 py-3 text-gray-800">{item.name}</td>
                                                <td className={`px-6 py-3 text-center font-black ${isZero ? 'text-red-600' : 'text-sap-text'}`}>{item.currentStock}</td>
                                                <td className="px-6 py-3 text-center text-gray-500">{item.lowStockThreshold}</td>
                                                <td className="px-6 py-3 text-center">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-black ${isZero ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {isZero ? 'نفذت الكمية' : 'منخفض'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </ReportLayout>
        </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 overflow-visible relative">
      <div className="bg-white/80 backdrop-blur-md border border-sap-border rounded-[2rem] p-2 flex flex-wrap items-center gap-2 shadow-sm w-fit print:hidden sticky top-0 z-50">
        <button onClick={() => setActiveSubTab('standard')} className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[11px] font-black transition-all duration-300 ${activeSubTab === 'standard' ? 'bg-sap-primary text-white shadow-lg' : 'text-gray-500 hover:bg-sap-highlight hover:text-sap-primary'}`}>
          <BarChart3 size={18} /> التقارير والنمو
        </button>
        <button onClick={() => setActiveSubTab('matrix')} className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[11px] font-black transition-all duration-300 ${activeSubTab === 'matrix' ? 'bg-sap-primary text-white shadow-lg' : 'text-gray-500 hover:bg-sap-highlight hover:text-sap-primary'}`}>
          <LayoutGrid size={18} /> مصفوفة المقارنة
        </button>
        <button onClick={() => setActiveSubTab('inventory')} className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[11px] font-black transition-all duration-300 ${activeSubTab === 'inventory' ? 'bg-sap-primary text-white shadow-lg' : 'text-gray-500 hover:bg-sap-highlight hover:text-sap-primary'}`}>
          <ClipboardList size={18} /> تقارير الجرد
        </button>
        <button onClick={() => setActiveSubTab('products')} className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[11px] font-black transition-all duration-300 ${activeSubTab === 'products' ? 'bg-sap-primary text-white shadow-lg' : 'text-gray-500 hover:bg-sap-highlight hover:text-sap-primary'}`}>
          <Package size={18} /> كشف المنتجات
        </button>
        <button onClick={() => setActiveSubTab('expiry')} className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[11px] font-black transition-all duration-300 ${activeSubTab === 'expiry' ? 'bg-sap-primary text-white shadow-lg' : 'text-gray-500 hover:bg-sap-highlight hover:text-sap-primary'}`}>
          <AlertTriangle size={18} /> تنبيهات الصلاحية
        </button>
        <button onClick={() => setActiveSubTab('low_stock')} className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[11px] font-black transition-all duration-300 ${activeSubTab === 'low_stock' ? 'bg-sap-primary text-white shadow-lg' : 'text-gray-500 hover:bg-sap-highlight hover:text-sap-primary'}`}>
          <TrendingDown size={18} /> نواقص المخزون
        </button>
        <button onClick={() => setActiveSubTab('profit')} className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[11px] font-black transition-all duration-300 ${activeSubTab === 'profit' ? 'bg-sap-primary text-white shadow-lg' : 'text-gray-500 hover:bg-sap-highlight hover:text-sap-primary'}`}>
          <Wallet size={18} /> تحليل الربحية
        </button>
      </div>

      <div className="min-h-[700px] overflow-visible">
        {activeSubTab === 'standard' && <SalesReports branches={branches} sales={sales} />}
        {activeSubTab === 'matrix' && <SalesMatrixReport branches={branches} sales={sales} />}
        {activeSubTab === 'inventory' && <InventoryReportView />}
        {activeSubTab === 'products' && <ProductReport />}
        {activeSubTab === 'expiry' && <ExpiryReportView />}
        {activeSubTab === 'low_stock' && <LowStockReportView />}
        {activeSubTab === 'profit' && <ProfitReportView />}
      </div>
    </div>
  );
};
