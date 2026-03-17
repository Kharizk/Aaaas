
import React, { useState, useEffect } from 'react';
import { Expense, ExpenseCategory } from '../types';
import { db } from '../services/supabase';
import { Plus, Trash2, Save, TrendingDown, Calendar, Tag, Settings, FileSpreadsheet, X } from 'lucide-react';
import { exportDataToExcel } from '../services/excelService';

export const ExpenseManager: React.FC = () => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    
    // Custom Categories State
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [newCategory, setNewCategory] = useState('');
    const [showCategoryModal, setShowCategoryModal] = useState(false);

    useEffect(() => {
        const load = async () => {
            const [expData, catData] = await Promise.all([
                db.expenses.getAll(),
                db.expenseCategories.getAll()
            ]);
            setExpenses(expData as Expense[]);
            
            if (catData.length === 0) {
                // Initialize default categories
                const defaultCats = ['تشغيلية', 'رواتب', 'صيانة', 'تسويق', 'نثريات', 'إيجار', 'مشتريات'];
                const newCats = await Promise.all(defaultCats.map(async (name) => {
                    const cat = { id: crypto.randomUUID(), name };
                    await db.expenseCategories.upsert(cat);
                    return cat;
                }));
                setCategories(newCats);
                setCategory(newCats[0].name);
            } else {
                setCategories(catData as ExpenseCategory[]);
                if (catData.length > 0) setCategory((catData[0] as ExpenseCategory).name);
            }
        };
        load();
    }, []);

    const handleAddCategory = async () => {
        if (!newCategory) return;
        if (categories.find(c => c.name === newCategory)) {
            alert('التصنيف موجود مسبقاً');
            return;
        }
        
        const cat: ExpenseCategory = { id: crypto.randomUUID(), name: newCategory };
        await db.expenseCategories.upsert(cat);
        setCategories(prev => [...prev, cat]);
        setNewCategory('');
    };

    const handleRemoveCategory = async (catId: string, catName: string) => {
        if (confirm(`هل أنت متأكد من حذف تصنيف "${catName}"؟`)) {
            await db.expenseCategories.delete(catId);
            const updatedCats = categories.filter(c => c.id !== catId);
            setCategories(updatedCats);
            if (category === catName && updatedCats.length > 0) {
                setCategory(updatedCats[0].name);
            } else if (category === catName) {
                setCategory('');
            }
        }
    };

    const handleSave = async () => {
        if(!title || !amount || !category) {
            alert('البيانات ناقصة');
            return;
        }
        const newItem: Expense = {
            id: crypto.randomUUID(),
            title,
            amount: parseFloat(amount),
            date,
            category
        };
        await db.expenses.upsert(newItem);
        setExpenses(prev => [newItem, ...prev]);
        setTitle(''); 
        setAmount('');
        // Keep the category and date as is for easier entry of multiple items
    };

    const handleDelete = async (id: string) => {
        if(confirm('حذف؟')) {
            await db.expenses.delete(id);
            setExpenses(prev => prev.filter(x => x.id !== id));
        }
    };

    const handleExport = () => {
        const dataToExport = expenses.map(e => ({
            'البند': e.title,
            'المبلغ': e.amount,
            'التصنيف': e.category,
            'التاريخ': e.date
        }));
        exportDataToExcel(dataToExport, `expenses_export_${new Date().toISOString().split('T')[0]}`);
    };

    const total = expenses.reduce((a,b) => a + b.amount, 0);

    return (
        <div className="flex gap-6 h-full animate-in fade-in relative">
            <div className="w-80 bg-white p-6 rounded-3xl shadow-sm border border-gray-200 h-fit">
                <h3 className="font-black text-lg mb-4 flex items-center gap-2 text-red-600"><TrendingDown/> تسجيل مصروف</h3>
                <div className="space-y-3">
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-3 border rounded-xl font-bold bg-gray-50"/>
                    <input type="text" placeholder="البند (مثال: فاتورة كهرباء)" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 border rounded-xl font-bold"/>
                    <input type="number" placeholder="المبلغ (0.00)" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-3 border rounded-xl font-bold font-mono text-lg"/>
                    
                    <div className="flex gap-2">
                        <select value={category} onChange={e => setCategory(e.target.value)} className="flex-1 p-3 border rounded-xl font-bold bg-white">
                            {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                        </select>
                        <button onClick={() => setShowCategoryModal(true)} className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200" title="إدارة التصنيفات">
                            <Settings size={20}/>
                        </button>
                    </div>

                    <button onClick={handleSave} className="w-full py-3 bg-red-600 text-white rounded-xl font-black hover:bg-red-700 transition-all flex justify-center gap-2"><Save size={18}/> حفظ المصروف</button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-black text-xl">سجل المصروفات</h3>
                    <div className="flex items-center gap-3">
                        <button onClick={handleExport} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 flex items-center gap-2 text-xs font-bold" title="تصدير Excel">
                            <FileSpreadsheet size={16}/> تصدير
                        </button>
                        <div className="text-xl font-black text-red-600 bg-red-50 px-4 py-1 rounded-xl">الإجمالي: {total.toLocaleString()} ريال</div>
                    </div>
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
                    {expenses.length === 0 && (
                        <div className="col-span-full p-16 text-center bg-white border border-gray-200 rounded-md">
                            <div className="flex flex-col items-center justify-center text-gray-400">
                                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                                    <TrendingDown size={32} className="text-gray-300" />
                                </div>
                                <p className="text-lg font-bold text-gray-500 mb-1">لا توجد مصروفات</p>
                                <p className="text-sm">لم يتم العثور على أي مصروفات مسجلة.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Categories Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold">إدارة تصنيفات المصروفات</h3>
                            <button onClick={() => setShowCategoryModal(false)}><X size={18}/></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={newCategory} 
                                    onChange={e => setNewCategory(e.target.value)} 
                                    placeholder="تصنيف جديد..." 
                                    className="flex-1 p-2 border rounded-lg text-sm"
                                />
                                <button onClick={handleAddCategory} className="bg-sap-primary text-white px-4 rounded-lg font-bold text-sm">إضافة</button>
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-2">
                                {categories.map(cat => (
                                    <div key={cat.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg border border-gray-100">
                                        <span className="text-sm font-bold">{cat.name}</span>
                                        <button onClick={() => handleRemoveCategory(cat.id, cat.name)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
