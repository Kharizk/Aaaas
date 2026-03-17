import React, { useState, useEffect, useMemo } from 'react';
import { Customer, CustomerTransaction, DailySales } from '../types';
import { db } from '../services/supabase';
import { ArrowRight, Printer, Plus, FileText, DollarSign, Package, Calendar, User, XCircle } from 'lucide-react';
import { useNotification } from './Notifications';
import { ReportLayout } from './ReportLayout';

interface CustomerStatementProps {
    customer: Customer;
    onBack: () => void;
}

export const CustomerStatement: React.FC<CustomerStatementProps> = ({ customer, onBack }) => {
    const { notify } = useNotification();
    const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
    const [sales, setSales] = useState<DailySales[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    // Form State
    const [txType, setTxType] = useState<'payment' | 'note' | 'partial_delivery'>('payment');
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [referenceId, setReferenceId] = useState('');

    useEffect(() => {
        loadData();
    }, [customer.id]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const allTx = await db.customerTransactions.getAll();
            const customerTx = (allTx as CustomerTransaction[]).filter(t => t.customerId === customer.id);
            
            const allSales = await db.dailySales.getAll();
            const customerSales = (allSales as DailySales[]).filter(s => s.customerId === customer.id);
            
            setTransactions(customerTx);
            setSales(customerSales);
        } catch (e) {
            notify('فشل تحميل كشف الحساب', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount && txType !== 'partial_delivery') return notify('الرجاء إدخال المبلغ', 'error');

        const numAmount = parseFloat(amount || '0');
        // If payment, it decreases debt (negative). If note/charge, it increases debt (positive).
        const finalAmount = txType === 'payment' ? -Math.abs(numAmount) : Math.abs(numAmount);

        const newTx: CustomerTransaction = {
            id: crypto.randomUUID(),
            customerId: customer.id,
            date: new Date().toISOString(),
            type: txType,
            amount: txType === 'partial_delivery' ? 0 : finalAmount,
            notes,
            referenceId
        };

        try {
            await db.customerTransactions.upsert(newTx);
            
            // Update customer balance
            if (txType !== 'partial_delivery') {
                const updatedCustomer = { ...customer, balance: (customer.balance || 0) + finalAmount };
                await db.customers.upsert(updatedCustomer);
                // We should ideally update the parent component's customer state, but for now we'll just reload
            }

            setTransactions([newTx, ...transactions]);
            setShowAddModal(false);
            setAmount('');
            setNotes('');
            setReferenceId('');
            notify('تم تسجيل العملية بنجاح', 'success');
            
            // Reload to get updated balance if needed, or just rely on local state
            customer.balance = (customer.balance || 0) + finalAmount;
        } catch (error) {
            notify('حدث خطأ أثناء الحفظ', 'error');
        }
    };

    // Combine sales (invoices) and transactions into a single ledger
    const ledger = useMemo(() => {
        const items: any[] = [];
        
        // Add sales (invoices)
        sales.forEach(sale => {
            if (sale.remainingAmount > 0) {
                items.push({
                    id: sale.id,
                    date: sale.date,
                    type: 'invoice',
                    description: `فاتورة مبيعات رقم ${sale.id.slice(0,8)}`,
                    debit: sale.remainingAmount, // Customer owes us
                    credit: 0,
                    balance: 0 // Calculated later
                });
            }
        });

        // Add transactions
        transactions.forEach(tx => {
            let desc = '';
            if (tx.type === 'payment') desc = 'سداد دفعة نقدية / تحويل';
            if (tx.type === 'note') desc = 'تسجيل قيد / ملاحظة مالية';
            if (tx.type === 'partial_delivery') desc = 'ملاحظة: بضاعة متبقية / تسليم جزئي';
            if (tx.notes) desc += ` - ${tx.notes}`;
            if (tx.referenceId) desc += ` (مرجع: ${tx.referenceId})`;

            items.push({
                id: tx.id,
                date: tx.date,
                type: tx.type,
                description: desc,
                debit: tx.amount > 0 ? tx.amount : 0,
                credit: tx.amount < 0 ? Math.abs(tx.amount) : 0,
                balance: 0
            });
        });

        // Sort by date ascending to calculate running balance
        items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let runningBalance = 0;
        let openingBalance = 0;
        const filteredItems: any[] = [];

        items.forEach(item => {
            const itemDate = new Date(item.date).toISOString().split('T')[0];
            
            runningBalance += item.debit;
            runningBalance -= item.credit;
            item.balance = runningBalance;

            if (startDate && itemDate < startDate) {
                openingBalance = runningBalance;
            } else if (endDate && itemDate > endDate) {
                // Skip items after end date
            } else {
                filteredItems.push(item);
            }
        });

        if (startDate) {
            filteredItems.unshift({
                id: 'opening-balance',
                date: startDate,
                type: 'opening',
                description: 'رصيد افتتاحي للفترة',
                debit: openingBalance > 0 ? openingBalance : 0,
                credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
                balance: openingBalance,
                isOpening: true
            });
        }

        // Return descending for display
        return filteredItems.reverse();
    }, [sales, transactions, startDate, endDate]);

    return (
        <div className="h-full flex flex-col bg-gray-50 animate-in slide-in-from-left-8">
            {/* Header */}
            <div className="bg-white p-6 border-b border-gray-200 flex justify-between items-center print:hidden">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowRight size={24} className="text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                            <User className="text-sap-primary" /> كشف حساب: {customer.name}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1 font-mono" dir="ltr">{customer.phone}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setShowAddModal(true)} className="bg-sap-primary text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-sap-primary-hover transition-all flex items-center gap-2">
                        <Plus size={18} /> إضافة عملية / ملاحظة
                    </button>
                    <button onClick={() => window.print()} className="bg-gray-800 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-black transition-all flex items-center gap-2">
                        <Printer size={18} /> طباعة الكشف
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white px-6 py-4 border-b border-gray-200 flex gap-4 items-end print:hidden">
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">من تاريخ</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-sap-primary" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">إلى تاريخ</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-sap-primary" />
                </div>
                {(startDate || endDate) && (
                    <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-sm text-red-500 hover:text-red-600 font-bold mb-2">
                        إلغاء الفلتر
                    </button>
                )}
            </div>

            {/* Printable Content */}
            <div className="flex-1 overflow-auto p-6 print:p-0">
                <div className="max-w-5xl mx-auto printable">
                    <ReportLayout printOnly={true} title={`كشف حساب عميل`} subtitle={`العميل: ${customer.name} ${startDate || endDate ? `(من ${startDate || 'البداية'} إلى ${endDate || 'النهاية'})` : ''}`}>
                        
                        {/* Summary Cards */}
                        <div className="grid grid-cols-3 gap-6 mb-8 print:hidden">
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="text-gray-500 text-sm font-bold mb-2">الرصيد الحالي (المطلوب)</div>
                                <div className={`text-3xl font-black ${(customer.balance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {(customer.balance || 0).toLocaleString()} <span className="text-sm">SAR</span>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="text-gray-500 text-sm font-bold mb-2">إجمالي المشتريات</div>
                                <div className="text-3xl font-black text-sap-shell">
                                    {(customer.totalPurchases || 0).toLocaleString()} <span className="text-sm">SAR</span>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="text-gray-500 text-sm font-bold mb-2">سقف الائتمان</div>
                                <div className="text-3xl font-black text-blue-600">
                                    {(customer.creditLimit || 0).toLocaleString()} <span className="text-sm">SAR</span>
                                </div>
                            </div>
                        </div>

                        {/* Ledger Table */}
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden print:border-none print:rounded-none">
                            <table className="w-full text-right">
                                <thead className="bg-sap-shell text-white font-bold text-sm print:text-black print:bg-gray-100">
                                    <tr>
                                        <th className="p-4">التاريخ</th>
                                        <th className="p-4">البيان / الملاحظات</th>
                                        <th className="p-4 text-center">مدين (عليه)</th>
                                        <th className="p-4 text-center">دائن (له)</th>
                                        <th className="p-4 text-center">الرصيد</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {ledger.map((item, index) => (
                                        <tr key={item.id + index} className={`hover:bg-gray-50 ${item.isOpening ? 'bg-yellow-50/50' : ''}`}>
                                            <td className="p-4 text-gray-600 whitespace-nowrap">{item.isOpening ? '-' : new Date(item.date).toLocaleDateString('ar-SA')} {!item.isOpening && <span className="text-xs text-gray-400 block">{new Date(item.date).toLocaleTimeString('ar-SA')}</span>}</td>
                                            <td className="p-4 font-bold text-gray-800 max-w-md">{item.description}</td>
                                            <td className="p-4 text-center font-mono text-red-600 font-bold">{item.debit > 0 ? item.debit.toLocaleString() : '-'}</td>
                                            <td className="p-4 text-center font-mono text-green-600 font-bold">{item.credit > 0 ? item.credit.toLocaleString() : '-'}</td>
                                            <td className="p-4 text-center font-mono font-black text-sap-primary" dir="ltr">{item.balance.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    {ledger.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-16 text-center">
                                                <div className="flex flex-col items-center justify-center text-gray-400">
                                                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                                                        <FileText size={32} className="text-gray-300" />
                                                    </div>
                                                    <p className="text-lg font-bold text-gray-500 mb-1">لا توجد حركات مسجلة</p>
                                                    <p className="text-sm">لم يتم العثور على أي حركات مالية لهذا العميل.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                    </ReportLayout>
                </div>
            </div>

            {/* Add Transaction Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-black text-gray-800">إضافة عملية / ملاحظة</h2>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-red-500"><XCircle size={24} /></button>
                        </div>
                        <form onSubmit={handleAddTransaction} className="p-6 space-y-5">
                            
                            <div className="grid grid-cols-3 gap-2">
                                <button type="button" onClick={() => setTxType('payment')} className={`p-3 rounded-xl border-2 font-bold text-xs flex flex-col items-center gap-2 transition-all ${txType === 'payment' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}>
                                    <DollarSign size={20} /> سداد دفعة
                                </button>
                                <button type="button" onClick={() => setTxType('note')} className={`p-3 rounded-xl border-2 font-bold text-xs flex flex-col items-center gap-2 transition-all ${txType === 'note' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}>
                                    <FileText size={20} /> قيد مالي (عليه)
                                </button>
                                <button type="button" onClick={() => setTxType('partial_delivery')} className={`p-3 rounded-xl border-2 font-bold text-xs flex flex-col items-center gap-2 transition-all ${txType === 'partial_delivery' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}>
                                    <Package size={20} /> بضاعة متبقية
                                </button>
                            </div>

                            {txType !== 'partial_delivery' && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ <span className="text-red-500">*</span></label>
                                    <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-black text-lg focus:border-sap-primary outline-none" placeholder="0.00" required />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">البيان / الملاحظات <span className="text-red-500">*</span></label>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-sap-primary outline-none min-h-[100px]" placeholder="اكتب تفاصيل العملية هنا..." required />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">رقم المرجع / الفاتورة (اختياري)</label>
                                <input type="text" value={referenceId} onChange={e => setReferenceId(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-sap-primary outline-none" placeholder="مثال: INV-1234" />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200">إلغاء</button>
                                <button type="submit" className="flex-[2] py-3 bg-sap-primary text-white rounded-xl font-bold shadow-lg hover:bg-sap-primary-hover">حفظ العملية</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
