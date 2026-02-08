
import React, { useState, useMemo } from 'react';
import { DailySales, Branch } from '../types';
import { ReportLayout } from './ReportLayout';
import { Printer, LayoutGrid, RectangleVertical, RectangleHorizontal, Eye, EyeOff, CalendarCheck, HelpCircle, ArrowRightLeft, Info } from 'lucide-react';

interface SalesMatrixReportProps {
  branches: Branch[];
  sales: DailySales[];
}

export const SalesMatrixReport: React.FC<SalesMatrixReportProps> = ({ branches, sales }) => {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [reportMode, setReportMode] = useState<'range' | 'compare'>('compare');
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [showHeader, setShowHeader] = useState(true);
  
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [startMonth, setStartMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  });
  const [endMonth, setEndMonth] = useState(currentMonthStr);
  const [compareMonth, setCompareMonth] = useState(startMonth);

  const monthsToDisplay = useMemo(() => {
    if (reportMode === 'compare') {
      return compareMonth === currentMonthStr ? [currentMonthStr] : [compareMonth, currentMonthStr];
    } else {
      const months = [];
      let current = new Date(startMonth + "-01");
      const last = new Date(endMonth + "-01");
      while (current <= last && months.length < 12) {
        months.push(current.toISOString().slice(0, 7));
        current.setMonth(current.getMonth() + 1);
      }
      return months.length > 0 ? months : [currentMonthStr];
    }
  }, [reportMode, startMonth, endMonth, compareMonth, currentMonthStr]);

  const filteredSales = useMemo(() => {
    return sales.filter(s => selectedBranch === 'all' || s.branchId === selectedBranch);
  }, [sales, selectedBranch]);

  const matrixData = useMemo(() => {
    const data: Record<string, Record<number, number>> = {};
    monthsToDisplay.forEach(m => {
        data[m] = {};
        for(let i=1; i<=31; i++) data[m][i] = 0;
    });
    filteredSales.forEach(s => {
        const sMonth = s.date.slice(0, 7);
        const sDay = parseInt(s.date.split('-')[2]);
        if (data[sMonth]) {
            data[sMonth][sDay] += s.amount;
        }
    });
    return data;
  }, [filteredSales, monthsToDisplay]);

  // Calculate dynamic max for heatmap
  const maxSaleInPeriod = useMemo(() => {
      let max = 1;
      Object.values(matrixData).forEach(m => {
          Object.values(m).forEach(val => { if(val > max) max = val; });
      });
      return max;
  }, [matrixData]);

  const getHeatmapColor = (amount: number) => {
    if (amount === 0) return 'transparent';
    const intensity = Math.min(amount / (maxSaleInPeriod * 0.8), 1); // Adjust intensity based on local max
    const opacity = 0.05 + (intensity * 0.25);
    return `rgba(0, 108, 53, ${opacity})`;
  };

  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name || 'كافة الفروع المتاحة';

  return (
    <div className="space-y-6 pb-20 overflow-visible relative animate-in fade-in duration-700">
      
      {/* Controls Card */}
      <div className="bg-white border border-sap-border rounded-[2rem] p-6 space-y-6 print:hidden shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 text-right">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-sap-highlight text-sap-primary rounded-2xl flex items-center justify-center shadow-inner">
                    <LayoutGrid size={28} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-sap-text">مصفوفة المقارنة المتقاطعة</h2>
                    <p className="text-[10px] text-sap-text-variant font-bold uppercase tracking-widest mt-1">تحليل تجميعي لشهور السنة - الأداء اليومي</p>
                </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200">
                    <button onClick={() => setReportMode('compare')} className={`px-5 py-1.5 rounded-lg text-[10px] font-black transition-all ${reportMode === 'compare' ? 'bg-white text-sap-primary shadow-sm' : 'text-gray-400 hover:text-sap-primary'}`}>مقارنة</button>
                    <button onClick={() => setReportMode('range')} className={`px-5 py-1.5 rounded-lg text-[10px] font-black transition-all ${reportMode === 'range' ? 'bg-white text-sap-primary shadow-sm' : 'text-gray-400 hover:text-sap-primary'}`}>نطاق زمني</button>
                </div>
                
                <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="!text-xs !font-bold !min-w-[180px] !bg-gray-50 !rounded-xl !p-2">
                    <option value="all">كل الفروع</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                
                <button onClick={() => window.print()} className="bg-sap-primary text-white px-8 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg hover:bg-sap-primary-hover transition-all active:scale-95">
                  <Printer size={18}/> طباعة المصفوفة
                </button>
            </div>
        </div>

        <div className="flex flex-wrap items-center justify-between pt-4 border-t border-gray-100 gap-4">
            <div className="flex items-center gap-6">
                {reportMode === 'compare' ? (
                  <div className="flex items-center gap-4">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><ArrowRightLeft size={12}/> مقارنة مع شهر:</span>
                      <input type="month" value={compareMonth} onChange={e => setCompareMonth(e.target.value)} className="!text-xs !font-black !bg-sap-highlight/20 !rounded-full !px-4" />
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">من:</span>
                      <input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)} className="!text-xs !font-black !bg-white !rounded-full !px-4" />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">إلى:</span>
                      <input type="month" value={endMonth} onChange={e => setEndMonth(e.target.value)} className="!text-xs !font-black !bg-white !rounded-full !px-4" />
                  </div>
                )}
            </div>
            
            <div className="flex items-center gap-3">
                 <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                    <button title="طولي" onClick={() => setPrintOrientation('portrait')} className={`p-2 rounded-lg ${printOrientation === 'portrait' ? 'bg-white text-sap-primary shadow-sm' : 'text-gray-300'}`}><RectangleVertical size={16} /></button>
                    <button title="عرضي" onClick={() => setPrintOrientation('landscape')} className={`p-2 rounded-lg ${printOrientation === 'landscape' ? 'bg-white text-sap-primary shadow-sm' : 'text-gray-300'}`}><RectangleHorizontal size={16} /></button>
                </div>
                <button onClick={() => setShowHeader(!showHeader)} className={`text-[10px] font-black px-4 py-2 rounded-xl border transition-all ${showHeader ? 'bg-sap-highlight text-sap-primary border-sap-primary' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                    {showHeader ? 'إخفاء الترويسة' : 'إظهار الترويسة'}
                </button>
            </div>
        </div>
      </div>

      {/* Main Report View */}
      <ReportLayout 
        title="مصفوفة المبيعات اليومية المقارنة" 
        branchName={getBranchName(selectedBranch)}
        dateRange={`${monthsToDisplay[0]} - ${monthsToDisplay[monthsToDisplay.length-1]}`}
        showSignatures={true}
        orientation={printOrientation}
        showHeader={showHeader}
      >
        <div className={`matrix-table-wrapper border-2 border-sap-shell/10 rounded-2xl overflow-hidden bg-white shadow-sm ${printOrientation === 'landscape' ? 'landscape-mode' : 'portrait-mode'}`}>
            <table className="w-full text-right border-collapse table-fixed">
                <thead>
                    <tr className="bg-sap-shell text-white font-black uppercase tracking-wider">
                        <th className="p-3 border-l border-white/5 w-12 text-center text-[10px] print:text-[11px] bg-black">اليوم</th>
                        {monthsToDisplay.map(m => (
                            <th key={m} className="p-3 border-l border-white/5 text-center text-[10px] print:text-[11px]">
                                {new Date(m + "-01").toLocaleDateString('ar-SA', { month: 'short', year: 'numeric' })}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="font-bold text-sap-text divide-y divide-gray-100">
                    {Array.from({ length: 31 }).map((_, i) => {
                        const day = i + 1;
                        return (
                            <tr key={day} className="hover:bg-gray-50 transition-colors">
                                <td className="p-1 border-l border-gray-100 text-center bg-gray-50 text-gray-400 font-mono font-black text-[9px] print:text-[10px]">{day}</td>
                                {monthsToDisplay.map((m) => {
                                    const amount = matrixData[m][day];
                                    return (
                                        <td key={m} className="p-1 border-l border-gray-100 text-center text-[9px] print:text-[10px] relative group/cell" style={{ backgroundColor: getHeatmapColor(amount) }}>
                                            <span className={amount > 0 ? 'font-black text-sap-primary' : 'opacity-[0.05]'}>
                                              {amount > 0 ? amount.toLocaleString() : '0'}
                                            </span>
                                            {amount > 0 && (
                                                <div className="absolute inset-0 border-2 border-sap-primary opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none"></div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot className="bg-sap-background text-sap-primary font-black border-t-2 border-sap-shell">
                    <tr className="text-[11px] print:text-[12px]">
                        <td className="p-4 border-l border-sap-border text-center uppercase font-sans tracking-widest bg-sap-shell text-white">SUM</td>
                        {monthsToDisplay.map(m => {
                            const total = (Object.values(matrixData[m]) as number[]).reduce((a, b) => a + b, 0);
                            return (
                                <td key={m} className="p-4 border-l border-sap-border text-center font-mono text-lg">
                                    {total.toLocaleString()}
                                </td>
                            );
                        })}
                    </tr>
                </tfoot>
            </table>
        </div>
        
        {/* Heatmap Legend */}
        <div className="mt-6 flex items-center justify-end gap-3 print:hidden">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">تدرج الكثافة البيعية:</span>
            <div className="flex items-center gap-1">
                <span className="text-[9px] font-bold text-gray-400">منخفض</span>
                <div className="flex gap-0.5">
                    {[0.1, 0.2, 0.3, 0.5, 0.8].map(o => <div key={o} className="w-4 h-4 rounded-sm" style={{ backgroundColor: `rgba(0, 108, 53, ${o * 0.3})` }}></div>)}
                </div>
                <span className="text-[9px] font-bold text-gray-400">مرتفع</span>
            </div>
        </div>
      </ReportLayout>

      <style>{`
        @media print {
            .matrix-table-wrapper { border: 2px solid #006C35 !important; border-radius: 0 !important; }
            th { background-color: #1F2937 !important; color: white !important; }
            .bg-sap-shell { background-color: #1F2937 !important; }
            .bg-gray-50 { background-color: #F9FAFB !important; }
            .text-sap-primary { color: #006C35 !important; }
        }
      `}</style>
    </div>
  );
};
