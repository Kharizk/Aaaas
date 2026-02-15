
import React, { useState, useEffect } from 'react';
import { Expense } from '../types';
import { db } from '../services/supabase';
import { Plus, Trash2, Save, TrendingDown, Calendar, Tag } from 'lucide-react';

export const ExpenseManager: React.FC = () => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('تشغيلية');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        const load = async () => {
            const data = await db.expenses.getAll();
            setExpenses(data as Expense[]);
        };
        load();
    }, []);

    const handleSave = async () => {
        if(!title || !amount) return alert('البيانات ناقصة');
        const newItem: Expense = {
            id: crypto.randomUUID(),
            title,
            amount: parseFloat(amount),
            date,
            category
        };
        await db.expenses.upsert(newItem);
        setExpenses(prev => [newItem, ...prev]);
        setTitle(''); setAmount('');
    };

    const handleDelete = async (id: string) => {
        if(confirm('حذف؟')) {
            await db.expenses.delete(id);
            setExpenses(prev => prev.filter(x => x.id !== id));
        }
    };

    const total = expenses.reduce((a,b) => a + b.amount, 0);

    return (
        <div className="flex gap-6 h-full animate-in fade-in">
            <div className="w-80 bg-white p-6 rounded-3xl shadow-sm border border-gray-200 h-fit">
                <h3 className="font-black text-lg mb-4 flex items-center gap-2 text-red-600"><TrendingDown/> تسجيل مصروف</h3>
                <div className="space-y-3">
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-3 border rounded-xl font-bold bg-gray-50"/>
                    <input type="text" placeholder="البند (مثال: فاتورة كهرباء)" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 border rounded-xl font-bold"/>
                    <input type="number" placeholder="المبلغ (0.00)" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-3 border rounded-xl font-bold font-mono text-lg"/>
                    <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-3 border rounded-xl font-bold bg-white">
                        <option>تشغيلية</option>
                        <option>رواتب</option>
                        <option>صيانة</option>
                        <option>تسويق</option>
                        <option>نثريات</option>
                    </select>
                    <button onClick={handleSave} className="w-full py-3 bg-red-600 text-white rounded-xl font-black hover:bg-red-700 transition-all flex justify-center gap-2"><Save size={18}/> حفظ المصروف</button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-black text-xl">سجل المصروفات</h3>
                    <div className="text-xl font-black text-red-600 bg-red-50 px-4 py-1 rounded-xl">الإجمالي: {total.toLocaleString()} ريال</div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {expenses.map(ex => (
                        <div key={ex.id} className="flex justify-between items-center p-4 border-b hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-red-50 text-red-500 rounded-full"><Tag size={18}/></div>
                                <div>
                                    <div className="font-black text-gray-800">{ex.title}</div>
                                    <div className="text-xs text-gray-400 font-bold flex gap-2">
                                        <span className="flex items-center gap-1"><Calendar size={10}/> {ex.date}</span>
                                        <span className="bg-gray-100 px-2 rounded-full">{ex.category}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="font-mono font-black text-lg text-red-600">-{ex.amount}</div>
                                <button onClick={() => handleDelete(ex.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={18}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
