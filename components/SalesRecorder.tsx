
import React, { useState, useRef, useMemo } from 'react';
import { DailySales, Branch } from '../types';
import { db } from '../services/supabase';
import { generateSalesTemplate } from '../services/excelService';
import { Save, DollarSign, FileSpreadsheet, Trash2, Loader2, Edit2, Download, Filter, RefreshCcw } from 'lucide-react';

interface SalesRecorderProps {
  branches: Branch[];
  sales: DailySales[];
  setSales: React.Dispatch<React.SetStateAction<DailySales[]>>;
}

export const SalesRecorder: React.FC<SalesRecorderProps> = ({ branches, sales, setSales }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [branchId, setBranchId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Transaction Type (Sale vs Return)
  const [txnType, setTxnType] = useState<'sale' | 'return'>('sale');
  
  const [filterStart, setFilterStart] = useState(() => {
      const d = new Date();
      d.setDate(1); 
      return d.toISOString().split('T')[0];
  });
  const [filterEnd, setFilterEnd] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredSales = useMemo(() => {
      return sales.filter(s => {
          const dateMatch = s.date >= filterStart && s.date <= filterEnd;
          const branchMatch = selectedBranchFilter === 'all' || s.branchId === selectedBranchFilter;
          return dateMatch && branchMatch;
      });
  }, [sales, filterStart, filterEnd, selectedBranchFilter]);

  const paginatedSales = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredSales.slice(start, start + itemsPerPage);
  }, [filteredSales, currentPage]);

  const stats = useMemo(() => ({
      total: filteredSales.reduce((sum, s) => sum + (s.amount || 0), 0),
      count: filteredSales.length,
      avg: filteredSales.length ? filteredSales.reduce((sum, s) => sum + (s.amount || 0), 0) / filteredSales.length : 0
  }), [filteredSales]);

  const handleSave = async () => {
    if (!date || !amount || !branchId) { alert("البيانات ناقصة"); return; }
    setIsSaving(true);
    try {
      let finalAmount = parseFloat(amount);
      if (txnType === 'return' && finalAmount > 0) finalAmount = -finalAmount;

      const saleData: DailySales = { 
        id: editingId || crypto.randomUUID(), 
        branchId, 
        date, 
        amount: finalAmount, 
        notes: notes.trim(),
        // Default values for new fields required by DailySales interface
        totalAmount: Math.abs(finalAmount),
        paidAmount: Math.abs(finalAmount),
        remainingAmount: 0,
        paymentMethod: 'cash',
        transactionType: txnType,
        isPending: false,
        isClosed: false
      };
      await db.dailySales.upsert(saleData);
      setSales(prev => editingId ? prev.map(s => s.id === editingId ? saleData : s) : [saleData, ...prev]);
      setAmount(''); setNotes(''); setEditingId(null); setTxnType('sale');
    } catch (error) { alert("خطأ في الحفظ"); }
    finally { setIsSaving(false); }
  };

  const handleEdit = (sale: DailySales) => {
    setEditingId(sale.id); 
    setDate(sale.date); 
    setBranchId(sale.branchId || ''); 
    setAmount(Math.abs(sale.amount || 0).toString()); 
    setNotes(sale.notes || '');
    setTxnType((sale.amount || 0) < 0 ? 'return' : 'sale');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('حذف السجل؟')) {
      try {
        await db.dailySales.delete(id);
        setSales(prev => prev.filter(s => s.id !== id));
      } catch (e) { alert("فشل الحذف"); }
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-300">
        {/* Top Action Bar */}
        <div className="bg-white border border-gray-300 p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
                 <div className="bg-sap-secondary text-white p-2 rounded-[2px]"><DollarSign size={24} /></div>
                 <div>
                    <h2 className="text-lg font-black text-gray-800">إدخال المبيعات اليومية</h2>
                    <p className="text-xs text-gray-500">سجل الإيرادات وتتبع الأداء المالي للفروع</p>
                 </div>
            </div>
            <div className="flex gap-2">
                <button onClick={generateSalesTemplate} className="px-4 py-2 bg-gray-100 border border-gray-300 text-gray-700 text-xs font-bold hover:bg-white flex items-center gap-2">
                  <Download size={16} /> قالب Excel
                </button>
                <div className="relative">
                    <input type="file" ref={fileInputRef} className="hidden" id="sales-upload" />
                    <label htmlFor="sales-upload" className="cursor-pointer px-4 py-2 bg-sap-primary text-white border border-sap-primary text-xs font-bold hover:bg-sap-primary-hover flex items-center gap-2">
                        <FileSpreadsheet size={16} /> استيراد بيانات
                    </label>
                </div>
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 flex-1 overflow-hidden">
            {/* Input Form Panel */}
            <div className="w-full lg:w-80 bg-gray-50 border border-gray-300 p-4 flex flex-col gap-4 shrink-0 overflow-y-auto h-fit">
                <h3 className="font-bold text-sap-primary border-b border-gray-300 pb-2 text-sm">{editingId ? 'تعديل قيد' : 'قيد جديد'}</h3>
                
                {/* Transaction Type Toggle */}
                <div className="flex bg-white rounded-lg border border-gray-300 p-1">
                    <button onClick={() => setTxnType('sale')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${txnType === 'sale' ? 'bg-sap-highlight text-sap-primary' : 'text-gray-500'}`}>بيع (إيراد)</button>
                    <button onClick={() => setTxnType('return')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${txnType === 'return' ? 'bg-red-100 text-red-600' : 'text-gray-500'}`}>مرتجع (خصم)</button>
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">تاريخ العملية</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border border-gray-300 text-sm font-bold bg-white" />
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">الفرع / المستودع</label>
                    <select value={branchId} onChange={e => setBranchId(e.target.value)} className="w-full p-2 border border-gray-300 text-sm font-bold bg-white">
                        <option value="">-- اختر --</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">المبلغ (ريال)</label>
                    <div className="relative">
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className={`w-full p-2 border border-gray-300 text-lg font-mono font-black bg-white ${txnType === 'return' ? 'text-red-600' : 'text-sap-primary'}`} placeholder="0.00" />
                        {txnType === 'return' && <RefreshCcw className="absolute left-2 top-1/2 -translate-y-1/2 text-red-300" size={16}/>}
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">ملاحظات</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full p-2 border border-gray-300 text-sm bg-white" />
                </div>

                <div className="flex gap-2 mt-2">
                    {editingId && <button onClick={() => {setEditingId(null); setAmount(''); setNotes(''); setTxnType('sale');}} className="flex-1 py-2 bg-white border border-gray-300 text-gray-600 text-xs font-bold hover:bg-gray-100">إلغاء</button>}
                    <button onClick={handleSave} disabled={isSaving} className="flex-1 py-2 bg-sap-primary text-white border border-sap-primary text-xs font-bold hover:bg-sap-primary-hover flex justify-center items-center gap-2">
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {editingId ? 'تحديث' : 'حفظ'}
                    </button>
                </div>
            </div>

            {/* Data Grid Panel */}
            <div className="flex-1 flex flex-col bg-white border border-gray-300 overflow-hidden shadow-sm">
                {/* Filters */}
                <div className="p-2 bg-gray-100 border-b border-gray-300 flex flex-wrap items-center gap-2 text-xs">
                    <Filter size={14} className="text-gray-500" />
                    <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="p-1 border border-gray-300 w-28 bg-white" />
                    <span className="text-gray-400">-</span>
                    <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="p-1 border border-gray-300 w-28 bg-white" />
                    <select value={selectedBranchFilter} onChange={e => setSelectedBranchFilter(e.target.value)} className="p-1 border border-gray-300 bg-white">
                        <option value="all">كل الفروع</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <div className="mr-auto flex gap-4 font-bold text-gray-700">
                        <span>العدد: {stats.count}</span>
                        <span>الإجمالي: <span className={`font-mono ${stats.total >= 0 ? 'text-sap-primary' : 'text-red-500'}`}>{(stats.total || 0).toLocaleString()}</span></span>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="w-full text-right">
                        <thead>
                            <tr>
                                <th>التاريخ</th>
                                <th>الفرع</th>
                                <th>القيمة</th>
                                <th>ملاحظات</th>
                                <th className="w-20"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedSales.map(sale => (
                                <tr key={sale.id} className={`group ${(sale.amount || 0) < 0 ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-[#E8F5E9]'}`}>
                                    <td className="font-mono text-gray-700 font-bold">{sale.date}</td>
                                    <td className="font-bold text-sap-text">{(branches.find(b=>b.id===sale.branchId)?.name) || '-'}</td>
                                    <td className={`font-mono font-black ${(sale.amount || 0) < 0 ? 'text-red-600' : 'text-sap-primary'}`}>{(sale.amount || 0).toLocaleString()}</td>
                                    <td className="text-gray-500 text-xs truncate max-w-[200px]">
                                        {(sale.amount || 0) < 0 && <span className="text-[9px] bg-red-200 text-red-800 px-1 rounded ml-1">مرتجع</span>}
                                        {sale.notes}
                                    </td>
                                    <td className="text-center">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(sale)} className="p-1 text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200"><Edit2 size={14}/></button>
                                            <button onClick={() => handleDelete(sale.id)} className="p-1 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200"><Trash2 size={14}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredSales.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-gray-400 italic">لا توجد سجلات مطابقة</td></tr>}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination (Simple) */}
                <div className="p-2 border-t border-gray-300 bg-gray-50 flex justify-between items-center text-xs">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1 bg-white border border-gray-300 disabled:opacity-50">السابق</button>
                    <span className="font-bold text-gray-600">صفحة {currentPage}</span>
                    <button disabled={filteredSales.length <= currentPage * itemsPerPage} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1 bg-white border border-gray-300 disabled:opacity-50">التالي</button>
                </div>
            </div>
        </div>
    </div>
  );
};
