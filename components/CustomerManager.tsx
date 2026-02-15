
import React, { useState, useEffect } from 'react';
import { Customer, DailySales } from '../types';
import { db } from '../services/supabase';
import { User, Phone, Save, Search, Trash2, Wallet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export const CustomerManager: React.FC = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [salesData, setSalesData] = useState<DailySales[]>([]);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        const load = async () => {
            const [custs, sales] = await Promise.all([
                db.customers.getAll(),
                db.dailySales.getAll()
            ]);
            setCustomers(custs as Customer[]);
            setSalesData(sales as DailySales[]);
        };
        load();
    }, []);

    const handleSave = async () => {
        if(!name || !phone) return alert('الاسم والجوال مطلوبان');
        const newItem: Customer = {
            id: crypto.randomUUID(),
            name,
            phone,
            lastVisit: new Date().toISOString().split('T')[0]
        };
        await db.customers.upsert(newItem);
        setCustomers(prev => [newItem, ...prev]);
        setName(''); setPhone('');
    };

    const handleDelete = async (id: string) => {
        if(confirm('حذف العميل؟')) {
            await db.customers.delete(id);
            setCustomers(prev => prev.filter(c => c.id !== id));
        }
    };

    const getCustomerBalance = (customerId: string) => {
        // Filter sales linked to this customer (by ID or legacy Name matching)
        const customerTxns = salesData.filter(s => s.linkedSaleId === customerId || s.customerName === customers.find(c=>c.id===customerId)?.name);
        
        let totalDebt = 0;
        let totalPaid = 0;

        customerTxns.forEach(txn => {
            if (txn.transactionType === 'sale' && txn.remainingAmount > 0) {
                totalDebt += txn.remainingAmount;
            }
            if (txn.transactionType === 'collection') {
                totalPaid += txn.paidAmount;
            }
        });

        // Simple Balance: (Total Credit Sales) - (Total Payments)
        // If system tracks invoice-by-invoice, we sum 'remainingAmount'.
        // But for ledger style: Balance = Sum(Debts) - Sum(Collections)
        // However, in the new POS, Credit Sale adds to remainingAmount, Collection adds to paidAmount.
        // Let's refine:
        // Credit Sale Record: remainingAmount = X. 
        // Collection Record: paidAmount = Y.
        // Balance = Sum(All Remaining Amounts of Sales) - Sum(All Paid Amounts of Collections) 
        // *Correction*: Actually, collections reduce the balance.
        
        // Let's calculate purely based on transaction types from the new POS:
        // 1. Credit Sales: Add to Balance.
        // 2. Collections: Subtract from Balance.
        
        const debts = customerTxns
            .filter(t => t.transactionType === 'sale' && t.remainingAmount > 0)
            .reduce((acc, curr) => acc + (curr.remainingAmount || 0), 0);
            
        const payments = customerTxns
            .filter(t => t.transactionType === 'collection')
            .reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);

        return debts - payments;
    };

    const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

    return (
        <div className="flex gap-6 h-full animate-in fade-in">
            <div className="w-80 bg-white p-6 rounded-3xl shadow-sm border border-gray-200 h-fit">
                <h3 className="font-black text-lg mb-4 flex items-center gap-2 text-sap-primary"><User/> إضافة عميل</h3>
                <div className="space-y-3">
                    <input type="text" placeholder="اسم العميل" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border rounded-xl font-bold"/>
                    <input type="text" placeholder="رقم الجوال" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3 border rounded-xl font-bold"/>
                    <button onClick={handleSave} className="w-full py-3 bg-sap-primary text-white rounded-xl font-black hover:bg-sap-primary-hover transition-all flex justify-center gap-2"><Save size={18}/> حفظ العميل</button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-black text-xl">دليل العملاء والأرصدة</h3>
                    <div className="relative w-64">
                        <input type="text" placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} className="w-full p-2 pr-8 border rounded-xl text-sm font-bold"/>
                        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 content-start">
                    {filtered.map(c => {
                        const balance = getCustomerBalance(c.id);
                        return (
                            <div key={c.id} className="p-5 border border-gray-100 rounded-2xl flex justify-between items-center hover:bg-gray-50 group bg-white shadow-sm">
                                <div>
                                    <div className="font-black text-gray-800 text-lg">{c.name}</div>
                                    <div className="text-sm text-gray-500 font-mono flex items-center gap-1 mt-1"><Phone size={12}/> {c.phone}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black text-gray-400 uppercase mb-1">الرصيد الحالي</div>
                                    <div className={`font-mono font-black text-xl flex items-center justify-end gap-2 ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {balance > 0 ? <ArrowDownLeft size={16}/> : <ArrowUpRight size={16}/>}
                                        {Math.abs(balance).toLocaleString()} <span className="text-xs">SAR</span>
                                    </div>
                                    {balance > 0 ? <span className="text-[10px] text-red-500 font-bold">مستحق عليه</span> : balance < 0 ? <span className="text-[10px] text-emerald-500 font-bold">له رصيد</span> : <span className="text-[10px] text-gray-400 font-bold">خالص</span>}
                                </div>
                                <button onClick={() => handleDelete(c.id)} className="absolute top-2 left-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
