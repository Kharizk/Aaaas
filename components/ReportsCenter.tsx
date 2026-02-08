
import React, { useState, useMemo } from 'react';
import { Branch, DailySales, Product, Unit } from '../types';
import { SalesReports } from './SalesReports';
import { SalesMatrixReport } from './SalesMatrixReport';
import { ReportLayout } from './ReportLayout';
import { FileLineChart, LayoutGrid, BarChart3, TrendingUp, Package, Printer, Eye, EyeOff, Boxes, Search, CheckCircle2 } from 'lucide-react';

interface ReportsCenterProps {
  branches: Branch[];
  sales: DailySales[];
  products: Product[];
  units: Unit[];
}

export const ReportsCenter: React.FC<ReportsCenterProps> = ({ branches, sales, products, units }) => {
  const [activeSubTab, setActiveSubTab] = useState<'standard' | 'matrix' | 'products'>('standard');
  const [showHeader, setShowHeader] = useState(true);
  const [productSearch, setProductSearch] = useState('');

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
      <div className="bg-white/80 backdrop-blur-md border border-sap-border rounded-[2rem] p-2 flex items-center gap-2 shadow-sm w-fit print:hidden sticky top-0 z-50">
        <button onClick={() => setActiveSubTab('standard')} className={`flex items-center gap-3 px-8 py-3 rounded-2xl text-[11px] font-black transition-all duration-300 ${activeSubTab === 'standard' ? 'bg-sap-primary text-white shadow-lg' : 'text-gray-500 hover:bg-sap-highlight hover:text-sap-primary'}`}>
          <BarChart3 size={18} /> التقارير والنمو
        </button>
        <button onClick={() => setActiveSubTab('matrix')} className={`flex items-center gap-3 px-8 py-3 rounded-2xl text-[11px] font-black transition-all duration-300 ${activeSubTab === 'matrix' ? 'bg-sap-primary text-white shadow-lg' : 'text-gray-500 hover:bg-sap-highlight hover:text-sap-primary'}`}>
          <LayoutGrid size={18} /> مصفوفة المقارنة
        </button>
        <button onClick={() => setActiveSubTab('products')} className={`flex items-center gap-3 px-8 py-3 rounded-2xl text-[11px] font-black transition-all duration-300 ${activeSubTab === 'products' ? 'bg-sap-primary text-white shadow-lg' : 'text-gray-500 hover:bg-sap-highlight hover:text-sap-primary'}`}>
          <Package size={18} /> كشف المنتجات
        </button>
      </div>

      <div className="min-h-[700px] overflow-visible">
        {activeSubTab === 'standard' && <SalesReports branches={branches} sales={sales} />}
        {activeSubTab === 'matrix' && <SalesMatrixReport branches={branches} sales={sales} />}
        {activeSubTab === 'products' && <ProductReport />}
      </div>
    </div>
  );
};
