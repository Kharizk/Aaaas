
import React, { useState, useMemo, useEffect } from 'react';
import { Branch, DailySales, Product, Unit, SavedList, ListRow } from '../types';
import { SalesReports } from './SalesReports';
import { SalesMatrixReport } from './SalesMatrixReport';
import { ReportLayout } from './ReportLayout';
import { db } from '../services/supabase';
import { 
  FileLineChart, LayoutGrid, BarChart3, TrendingUp, Package, Printer, 
  Eye, EyeOff, Boxes, Search, CheckCircle2, ClipboardList, Calendar, Filter, ArrowLeft 
} from 'lucide-react';

interface ReportsCenterProps {
  branches: Branch[];
  sales: DailySales[];
  products: Product[];
  units: Unit[];
}

export const ReportsCenter: React.FC<ReportsCenterProps> = ({ branches, sales, products, units }) => {
  const [activeSubTab, setActiveSubTab] = useState<'standard' | 'matrix' | 'products' | 'inventory'>('standard');
  const [showHeader, setShowHeader] = useState(true);
  const [productSearch, setProductSearch] = useState('');

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

    useEffect(() => {
        const fetchLists = async () => {
            try {
                const data = await db.lists.getAll();
                // Filter only inventory types
                setLists(data.filter((l: any) => l.type === 'inventory') as SavedList[]);
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
                            row: row,
                            unitName: units.find(u => u.id === row.unitId)?.name || '-'
                        });
                    }
                });
            }
        });

        return flatRows;
    }, [lists, dateFrom, dateTo, selectedListId, units]);

    const totalQty = filteredData.reduce((acc, curr) => acc + (Number(curr.row.qty) || 0), 0);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Controls */}
            <div className="bg-white border border-sap-border rounded-[2.5rem] p-6 shadow-sm print:hidden">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-800 text-white rounded-[2rem] flex items-center justify-center shadow-lg">
                            <ClipboardList size={32} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-sap-text">أرشيف الجرد المخزني</h2>
                            <p className="text-xs text-sap-text-variant font-bold uppercase tracking-widest mt-1">سجل تفصيلي للأصناف التي تم جردها</p>
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
                        
                        <select value={selectedListId} onChange={e => setSelectedListId(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold min-w-[150px]">
                            <option value="all">كافة قوائم الجرد</option>
                            {lists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.date})</option>)}
                        </select>

                        <button onClick={() => window.print()} className="bg-sap-shell text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-black transition-all shadow-lg">
                            <Printer size={16}/> طباعة
                        </button>
                    </div>
                </div>
            </div>

            {/* Report Content */}
            <ReportLayout 
                title="تقرير تفصيلي للجرد المخزني" 
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
                                    <th className="px-6 py-4 border-l border-white/5 w-32">التاريخ</th>
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
                                    <tr><td colSpan={7} className="p-10 text-center text-gray-400 italic">لا توجد بيانات مطابقة للبحث</td></tr>
                                ) : (
                                    filteredData.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-indigo-50/30 transition-all group">
                                            <td className="px-6 py-3 font-mono text-gray-500">{item.listDate}</td>
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
      </div>

      <div className="min-h-[700px] overflow-visible">
        {activeSubTab === 'standard' && <SalesReports branches={branches} sales={sales} />}
        {activeSubTab === 'matrix' && <SalesMatrixReport branches={branches} sales={sales} />}
        {activeSubTab === 'inventory' && <InventoryReportView />}
        {activeSubTab === 'products' && <ProductReport />}
      </div>
    </div>
  );
};
