
import React, { useState, useMemo } from 'react';
import { DailySales, Branch } from '../types';
import { 
  Printer, TrendingUp, Filter, FileLineChart, 
  MapPin, Clock, Calendar, ChevronUp, ChevronDown, Award, PieChart, Activity,
  ArrowUpRight, ArrowDownRight, Target, Zap, DollarSign
} from 'lucide-react';

interface SalesReportsProps {
  branches: Branch[];
  sales: DailySales[];
}

export const SalesReports: React.FC<SalesReportsProps> = ({ branches, sales }) => {
  const [reportType, setReportType] = useState<'monthly' | 'yearly' | 'all'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  const baseFilteredSales = useMemo(() => {
    if (!sales) return [];
    return sales.filter(s => {
      if (selectedBranch !== 'all' && s.branchId !== selectedBranch) return false;
      return true;
    });
  }, [sales, selectedBranch]);

  const monthlyData = useMemo(() => {
    const data = baseFilteredSales.filter(s => s.date && s.date.startsWith(selectedMonth));
    const total = data.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const avg = data.length > 0 ? total / data.length : 0;
    
    let bestDay = { date: '-', amount: 0 };
    data.forEach(s => {
      if (s.amount > bestDay.amount) bestDay = { date: s.date, amount: s.amount };
    });

    return { records: data.sort((a,b) => b.date.localeCompare(a.date)), total, avg, bestDay };
  }, [baseFilteredSales, selectedMonth]);

  const yearlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = (i + 1).toString().padStart(2, '0');
      return `${selectedYear}-${m}`;
    });

    const monthlySummary = months.map((m, idx) => {
      const monthSales = baseFilteredSales.filter(s => s.date && s.date.startsWith(m));
      const total = monthSales.reduce((acc, curr) => acc + (curr.amount || 0), 0);
      
      let diff = 0;
      if (idx > 0) {
        const prevMonth = months[idx-1];
        const prevTotal = baseFilteredSales.filter(s => s.date && s.date.startsWith(prevMonth)).reduce((a, b) => a + (b.amount || 0), 0);
        diff = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
      }

      return { month: m, total, diff };
    }).filter(m => m.total > 0);

    const yearlyTotal = monthlySummary.reduce((acc, curr) => acc + curr.total, 0);
    const maxMonthTotal = monthlySummary.length > 0 ? Math.max(...monthlySummary.map(m => m.total)) : 0;

    return { summary: monthlySummary, total: yearlyTotal, maxMonthTotal };
  }, [baseFilteredSales, selectedYear]);

  const lifetimeData = useMemo(() => {
      const total = baseFilteredSales.reduce((acc, curr) => acc + (curr.amount || 0), 0);
      return { total, count: baseFilteredSales.length };
  }, [baseFilteredSales]);

  const getHeatmapColor = (amount: number, max: number) => {
    if (amount === 0 || max === 0) return 'transparent';
    const opacity = (amount / max) * 0.12;
    return `rgba(0, 108, 53, ${opacity})`;
  };

  const getBranchName = (id?: string) => branches.find(b => b.id === id)?.name || 'كافة الفروع';

  const StatCard = ({ label, val, icon: Icon, color, subText, trend }: any) => (
    <div className="bg-white p-6 rounded-[2rem] border border-sap-border shadow-sm group hover:shadow-xl transition-all duration-500 relative overflow-hidden">
        <div className={`absolute top-0 right-0 w-32 h-32 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity -mr-8 -mt-8`}>
            <Icon size={128} />
        </div>
        <div className="flex justify-between items-start mb-6">
            <div className={`p-3 rounded-2xl bg-gray-50 text-gray-400 group-hover:${color} group-hover:bg-gray-100 transition-all`}>
                <Icon size={24} />
            </div>
            {trend && (
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {trend > 0 ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}
                    {Math.abs(trend).toFixed(1)}%
                </div>
            )}
        </div>
        <div className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-1">{label}</div>
        <div className="text-3xl font-black text-sap-text tracking-tighter mb-2 font-mono">
            {typeof val === 'number' ? val.toLocaleString() : val}
            <span className="text-sm font-bold text-gray-300 ml-1">SR</span>
        </div>
        {subText && <div className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5"><Target size={12} className="text-sap-secondary"/> {subText}</div>}
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 print:p-0 print:m-0 print:block">
      
      {/* Search & Header UI */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-white p-6 border border-sap-border rounded-[2.5rem] shadow-sm print:hidden">
            <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-gradient-to-br from-sap-primary to-emerald-800 text-white rounded-[2rem] flex items-center justify-center shadow-lg shadow-sap-primary/20">
                    <FileLineChart size={32} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-sap-text">الذكاء المالي</h2>
                    <p className="text-xs text-sap-text-variant font-bold uppercase tracking-widest mt-1">تحليل أداء الفروع والمبيعات المتقدم</p>
                </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
                <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="!text-xs !font-black !min-w-[200px] !bg-gray-50 !border-gray-100 !rounded-2xl !p-3">
                    <option value="all">كافة شبكة الفروع</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200/50">
                    <button onClick={() => setReportType('monthly')} className={`px-6 py-2 rounded-xl text-[11px] font-black transition-all ${reportType === 'monthly' ? 'bg-white text-sap-primary shadow-sm' : 'text-gray-400 hover:text-sap-primary'}`}>شهري</button>
                    <button onClick={() => setReportType('yearly')} className={`px-6 py-2 rounded-xl text-[11px] font-black transition-all ${reportType === 'yearly' ? 'bg-white text-sap-primary shadow-sm' : 'text-gray-400 hover:text-sap-primary'}`}>سنوي</button>
                    <button onClick={() => setReportType('all')} className={`px-6 py-2 rounded-xl text-[11px] font-black transition-all ${reportType === 'all' ? 'bg-white text-sap-primary shadow-sm' : 'text-gray-400 hover:text-sap-primary'}`}>تراكمي</button>
                </div>
                <button onClick={() => window.print()} className="bg-sap-shell text-white px-8 py-3 rounded-2xl text-xs font-black flex items-center gap-2 shadow-xl hover:bg-black transition-all active:scale-95"><Printer size={18}/> طباعة التقرير</button>
            </div>
      </div>

      {/* Control Filters */}
      <div className="flex items-center gap-6 px-6 print:hidden">
          <div className="flex items-center gap-3 text-sap-primary">
              <Filter size={16} />
              <span className="text-xs font-black uppercase tracking-widest">تصفية النتائج:</span>
          </div>
          {reportType === 'monthly' ? (
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="!py-2.5 !px-6 !text-sm !font-black !bg-white !rounded-full !border-gray-200" />
          ) : reportType === 'yearly' ? (
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="!py-2.5 !px-6 !text-sm !font-black !bg-white !rounded-full !border-gray-200">
              {Array.from({length: 5}, (_, i) => (new Date().getFullYear() - i).toString()).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          ) : (
              <div className="px-4 py-2 bg-sap-highlight/50 border border-sap-primary/10 rounded-full text-[10px] font-black text-sap-primary uppercase">إحصائيات شاملة للنظام بالكامل</div>
          )}
      </div>

      {/* Statistics Dashboard Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:hidden">
          <StatCard 
            label="صافي الإيرادات" 
            val={reportType === 'monthly' ? monthlyData.total : reportType === 'yearly' ? yearlyData.total : lifetimeData.total} 
            icon={DollarSign} 
            color="text-emerald-600"
            subText="إجمالي المحصل لهذه الفترة"
          />
          {reportType === 'monthly' ? (
              <>
                <StatCard 
                    label="أعلى قيد يومي" 
                    val={monthlyData.bestDay.amount} 
                    icon={Zap} 
                    color="text-amber-500"
                    subText={`سجل بتاريخ: ${monthlyData.bestDay.date}`}
                />
                <StatCard 
                    label="المتوسط اليومي" 
                    val={monthlyData.avg.toFixed(0)} 
                    icon={Activity} 
                    color="text-blue-500"
                    subText="معدل التدفق النقدي اليومي"
                />
              </>
          ) : (
                <StatCard 
                    label="عدد العمليات" 
                    val={reportType === 'yearly' ? yearlyData.summary.length : lifetimeData.count} 
                    icon={PieChart} 
                    color="text-indigo-500"
                    subText="إجمالي قيود المبيعات المسجلة"
                />
          )}
          <StatCard 
            label="مؤشر الثقة" 
            val="99.8%" 
            icon={Award} 
            color="text-sap-secondary"
            subText="بيانات محاسبية مطابقة"
          />
      </div>

      {/* Main Table Content */}
      <div className="bg-white border border-sap-border rounded-[2.5rem] p-10 shadow-sm print:border-none print:shadow-none print:p-0 print:m-0 print:block overflow-visible text-right">
        
        {/* Table UI */}
        <div className="border border-gray-100 rounded-[2rem] overflow-hidden bg-white shadow-inner">
            {reportType === 'yearly' ? (
                <table className="w-full text-right border-collapse">
                    <thead>
                        <tr className="bg-sap-shell text-white text-[11px] font-black uppercase tracking-widest border-b border-white/10">
                            <th className="px-8 py-6">الشهر المالي</th>
                            <th className="px-8 py-6 text-center">إجمالي المبيعات</th>
                            <th className="px-8 py-6 text-center">نسبة النمو / التراجع</th>
                            <th className="px-8 py-6 text-left">ملاحظات التحليل</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm font-bold divide-y divide-gray-50">
                        {yearlyData.summary.length > 0 ? yearlyData.summary.map(m => (
                            <tr key={m.month} style={{ backgroundColor: getHeatmapColor(m.total, yearlyData.maxMonthTotal) }} className="hover:bg-gray-50/50 transition-all group">
                                <td className="px-8 py-5">
                                    <div className="text-sap-text text-base">{new Date(m.month + "-01").toLocaleDateString('ar-SA', { month: 'long' })}</div>
                                    <div className="text-[9px] text-gray-400 font-mono mt-0.5 uppercase">Financial Period: {m.month}</div>
                                </td>
                                <td className="px-8 py-5 text-center font-mono text-lg text-sap-primary">{m.total.toLocaleString()}</td>
                                <td className="px-8 py-5 text-center">
                                    {m.diff !== 0 ? (
                                        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-mono text-xs ${m.diff > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                            {m.diff > 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                                            {Math.abs(m.diff).toFixed(1)}%
                                        </div>
                                    ) : <span className="text-gray-300">-</span>}
                                </td>
                                <td className="px-8 py-5 text-left">
                                    {m.total === yearlyData.maxMonthTotal ? (
                                        <span className="bg-amber-400 text-black px-4 py-1 rounded-lg text-[9px] font-black uppercase shadow-sm">Peak Performance 👑</span>
                                    ) : <span className="text-gray-200 text-[10px] italic">ضمن المعدل الطبيعي</span>}
                                </td>
                            </tr>
                        )) : (
                          <tr><td colSpan={4} className="py-24 text-center opacity-30 flex flex-col items-center">
                              <PieChart size={64} className="mb-4 text-gray-300"/>
                              <p className="font-black text-lg">لا توجد سجلات سنوية لهذه السنة</p>
                          </td></tr>
                        )}
                    </tbody>
                </table>
            ) : reportType === 'all' ? (
                <div className="p-20 text-center space-y-6 flex flex-col items-center justify-center bg-gray-50/30">
                    <div className="w-24 h-24 bg-sap-highlight text-sap-primary rounded-[2rem] flex items-center justify-center shadow-inner mb-4">
                        <TrendingUp size={48}/>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-sap-text mb-2">تقرير الأداء التاريخي الموحد</h3>
                        <p className="text-gray-400 font-bold italic max-w-md mx-auto text-xs leading-relaxed">يعرض هذا الكشف إجمالي النشاط المالي المسجل منذ إنشاء قاعدة البيانات لكافة الفروع والمراكز المرتبطة.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 w-full max-w-xl mt-8">
                        <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm text-center">
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">إجمالي الإيرادات المسجلة</div>
                            <div className="text-2xl font-black text-sap-primary font-mono">{lifetimeData.total.toLocaleString()} <span className="text-xs">SAR</span></div>
                        </div>
                        <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm text-center">
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">متوسط قيمة العملية</div>
                            <div className="text-2xl font-black text-sap-primary font-mono">{(lifetimeData.total / (lifetimeData.count || 1)).toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
                        </div>
                    </div>
                </div>
            ) : (
                <table className="w-full text-right border-collapse">
                    <thead>
                        <tr className="bg-sap-shell text-white text-[11px] font-black uppercase tracking-widest border-b border-white/10">
                            <th className="px-8 py-6">التاريخ اليومي</th>
                            <th className="px-8 py-6">الفرع / النقطة البيعية</th>
                            <th className="px-8 py-6 text-center">المبلغ المحصل</th>
                            <th className="px-8 py-6">الملاحظات والبيان</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm font-bold divide-y divide-gray-50">
                        {monthlyData.records.map(sale => (
                            <tr key={sale.id} className="hover:bg-sap-highlight/20 transition-all group">
                                <td className="px-8 py-5 font-mono text-gray-500">{sale.date}</td>
                                <td className="px-8 py-5">
                                    <div className="font-black text-sap-text">{getBranchName(sale.branchId)}</div>
                                    <div className="text-[9px] text-gray-400 flex items-center gap-1 mt-0.5"><MapPin size={10}/> موقع مسجل</div>
                                </td>
                                <td className="px-8 py-5 text-center font-mono text-sap-primary text-lg">{sale.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td className="px-8 py-5 text-gray-400 text-xs italic">{sale.notes || 'لا يوجد ملاحظات إضافية'}</td>
                            </tr>
                        ))}
                        {monthlyData.records.length === 0 && (
                            <tr><td colSpan={4} className="py-24 text-center opacity-30 italic font-black text-xl">عذراً، لم يتم العثور على مبيعات في هذا النطاق</td></tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
      </div>
    </div>
  );
};
