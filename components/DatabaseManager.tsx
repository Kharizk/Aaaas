
import React, { useState, useEffect } from 'react';
import { db } from '../services/supabase';
import { Database, RefreshCw, Table as TableIcon, CheckCircle2, AlertCircle, HardDrive, LayoutList, MapPin, DollarSign } from 'lucide-react';

export const DatabaseManager: React.FC = () => {
    const [activeTable, setActiveTable] = useState<'products' | 'units' | 'branches' | 'daily_sales'>('products');
    const [data, setData] = useState<any[]>([]);
    const [counts, setCounts] = useState({ products: 0, units: 0, branches: 0, sales: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const [lastSync, setLastSync] = useState<string>('');

    const fetchCounts = async () => {
        try {
            const [p, u, b, s] = await Promise.all([
                db.products.getAll(),
                db.units.getAll(),
                db.branches.getAll(),
                db.dailySales.getAll()
            ]);
            setCounts({ products: p.length, units: u.length, branches: b.length, sales: s.length });
            setLastSync(new Date().toLocaleTimeString('ar-SA'));
        } catch (e) { console.error(e); }
    };

    const fetchTableData = async (tableName: typeof activeTable) => {
        setIsLoading(true);
        try {
            let result: any[] = [];
            if (tableName === 'products') result = await db.products.getAll();
            else if (tableName === 'units') result = await db.units.getAll();
            else if (tableName === 'branches') result = await db.branches.getAll();
            else if (tableName === 'daily_sales') result = await db.dailySales.getAll();
            setData(result);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchCounts(); fetchTableData(activeTable); }, [activeTable]);

    const TableCard = ({ title, count, icon: Icon, id }: any) => (
        <button 
            onClick={() => setActiveTable(id)}
            className={`flex-1 p-5 rounded-m3-xl border transition-all flex flex-col items-center gap-3 ${activeTable === id ? 'bg-md-primary text-md-on-primary border-md-primary elevation-2 scale-105' : 'bg-md-surface border-md-outline/10 text-md-on-surface-variant hover:elevation-1'}`}
        >
            <Icon size={24} />
            <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
            <span className="text-2xl font-black font-mono">{count}</span>
        </button>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-md-on-surface flex items-center gap-3">
                        <Database className="text-md-primary" size={32} /> مستكشف البيانات
                    </h2>
                    <p className="text-sm font-medium text-md-on-surface-variant mt-1">معاينة ومراقبة البيانات المخزنة سحابياً</p>
                </div>
                <div className="flex items-center gap-4 bg-md-surface-container/50 p-2 pr-4 rounded-m3-full border border-md-outline/5">
                    <div className="text-right">
                        <div className="text-[10px] text-md-on-surface-variant font-black uppercase">آخر مزامنة</div>
                        <div className="text-xs font-black text-emerald-600">{lastSync || '...'}</div>
                    </div>
                    <button onClick={() => { fetchCounts(); fetchTableData(activeTable); }} className="p-3 bg-md-primary text-md-on-primary rounded-full hover:elevation-2 transition-all">
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <TableCard title="المنتجات" count={counts.products} icon={HardDrive} id="products" />
                <TableCard title="الوحدات" count={counts.units} icon={LayoutList} id="units" />
                <TableCard title="الفروع" count={counts.branches} icon={MapPin} id="branches" />
                <TableCard title="المبيعات" count={counts.sales} icon={DollarSign} id="daily_sales" />
            </div>

            <div className="bg-md-surface rounded-[32px] border border-md-outline/10 elevation-1 flex flex-col h-[550px] overflow-hidden">
                <div className="p-6 border-b border-md-outline/5 bg-md-surface-container/30 flex justify-between items-center">
                    <h3 className="font-black text-md-on-surface flex items-center gap-3">
                        <TableIcon size={20} className="text-md-primary" /> 
                        جدول: {
                            activeTable === 'products' ? 'المنتجات' : 
                            activeTable === 'units' ? 'الوحدات' : 
                            activeTable === 'branches' ? 'الفروع' : 'المبيعات اليومية'
                        }
                    </h3>
                    {isLoading && <RefreshCw size={18} className="animate-spin text-md-primary" />}
                </div>

                <div className="flex-1 overflow-auto">
                    {data.length === 0 && !isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-md-outline/30">
                            <AlertCircle size={64} className="opacity-10 mb-4" />
                            <p className="text-lg font-black italic">لا توجد سجلات حالياً</p>
                        </div>
                    ) : (
                        <table className="w-full text-right text-xs">
                            <thead className="bg-md-surface-container/50 sticky top-0 z-10 font-black text-md-on-surface-variant text-[10px] uppercase tracking-widest border-b border-md-outline/5">
                                <tr>
                                    <th className="p-4 w-24">ID المعرف</th>
                                    <th className="p-4">البيانات الأساسية</th>
                                    <th className="p-4">القيم الوصفية</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-md-outline/5">
                                {data.map((item, idx) => (
                                    <tr key={item.id || idx} className="hover:bg-md-primary-container/20 transition-colors">
                                        <td className="p-4 font-mono text-md-outline/40">#{item.id?.slice(0,6)}</td>
                                        <td className="p-4">
                                            <div className="font-black text-sm text-md-on-surface">{item.name || item.date || item.amount}</div>
                                            <div className="text-[10px] text-md-on-surface-variant font-mono mt-0.5">{item.code || item.location || item.branch_id}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-2">
                                                {Object.entries(item).slice(0, 5).map(([key, val]: any) => (
                                                    <span key={key} className="bg-md-surface-variant/50 px-2 py-1 rounded-m3-s text-[9px] font-medium border border-md-outline/5">
                                                        <span className="font-black text-md-primary">{key}:</span> {String(val)}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
