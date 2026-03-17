
import React, { useState, useEffect } from 'react';
import { Customer, DailySales } from '../types';
import { db } from '../services/supabase';
import { Plus, Search, Trash2, Edit, User, Phone, FileText, Wallet, CreditCard, CheckCircle2, XCircle, History, Star, Crown, Shield, FileSpreadsheet } from 'lucide-react';
import { exportDataToExcel } from '../services/excelService';
import { useNotification } from './Notifications';
import { CustomerStatement } from './CustomerStatement';

export const CustomerManager: React.FC = () => {
    const { notify } = useNotification();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedCustomerForStatement, setSelectedCustomerForStatement] = useState<Customer | null>(null);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [balance, setBalance] = useState('');
    const [creditLimit, setCreditLimit] = useState('');

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        setIsLoading(true);
        try {
            const data = await db.customers.getAll();
            setCustomers(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const getCustomerTier = (totalPurchases: number = 0) => {
        if (totalPurchases > 10000) return { name: 'Gold', color: 'text-yellow-500', bg: 'bg-yellow-50', icon: Crown };
        if (totalPurchases > 5000) return { name: 'Silver', color: 'text-gray-500', bg: 'bg-gray-100', icon: Shield };
        return { name: 'Bronze', color: 'text-orange-700', bg: 'bg-orange-50', icon: Star };
    };

    const handleViewHistory = async (customer: Customer) => {
        setSelectedCustomerForStatement(customer);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !phone) return notify('يرجى تعبئة الحقول المطلوبة', 'error');

        const customer: Customer = {
            id: editingCustomer ? editingCustomer.id : crypto.randomUUID(),
            name,
            phone,
            notes,
            balance: parseFloat(balance || '0'),
            creditLimit: parseFloat(creditLimit || '0'),
            lastVisit: editingCustomer?.lastVisit,
            totalPurchases: editingCustomer?.totalPurchases || 0,
            loyaltyPoints: editingCustomer?.loyaltyPoints || 0
        };

        try {
            await db.customers.upsert(customer);
            setCustomers(prev => editingCustomer ? prev.map(c => c.id === customer.id ? customer : c) : [customer, ...prev]);
            setShowModal(false);
            resetForm();
            notify(editingCustomer ? 'تم تحديث العميل' : 'تم إضافة العميل', 'success');
        } catch (e) {
            notify('حدث خطأ أثناء الحفظ', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('هل أنت متأكد من حذف هذا العميل؟')) {
            try {
                await db.customers.delete(id);
                setCustomers(prev => prev.filter(c => c.id !== id));
                notify('تم حذف العميل', 'success');
            } catch (e) {
                notify('حدث خطأ أثناء الحذف', 'error');
            }
        }
    };

    const handleEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        setName(customer.name);
        setPhone(customer.phone);
        setNotes(customer.notes || '');
        setBalance(customer.balance?.toString() || '0');
        setCreditLimit(customer.creditLimit?.toString() || '0');
        setShowModal(true);
    };

    const resetForm = () => {
        setEditingCustomer(null);
        setName('');
        setPhone('');
        setNotes('');
        setBalance('');
        setCreditLimit('');
    };

    const handleExport = () => {
        const dataToExport = customers.map(c => ({
            'الاسم': c.name,
            'رقم الهاتف': c.phone,
            'الرصيد': c.balance,
            'سقف الائتمان': c.creditLimit,
            'نقاط الولاء': c.loyaltyPoints,
            'إجمالي المشتريات': c.totalPurchases,
            'ملاحظات': c.notes
        }));
        exportDataToExcel(dataToExport, `customers_export_${new Date().toISOString().split('T')[0]}`);
    };

    const filteredCustomers = customers.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.phone.includes(searchQuery)
    );

    return (
        <div className="h-full flex flex-col bg-gray-50 p-6 animate-in fade-in">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                        <User className="text-sap-primary" /> إدارة العملاء
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">إدارة بيانات العملاء والديون</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleExport}
                        className="bg-green-600 text-white px-4 py-3 rounded-xl font-bold shadow-lg hover:bg-green-700 transition-all flex items-center gap-2"
                        title="تصدير إلى Excel"
                    >
                        <FileSpreadsheet size={20} /> تصدير
                    </button>
                    <button 
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="bg-sap-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-sap-primary-hover transition-all flex items-center gap-2"
                    >
                        <Plus size={20} /> إضافة عميل
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                    <div className="relative max-w-md">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="بحث باسم العميل أو رقم الهاتف..." 
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pr-10 pl-4 font-bold focus:border-sap-primary outline-none"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50 text-gray-500 font-bold text-sm sticky top-0">
                            <tr>
                                <th className="p-4">اسم العميل</th>
                                <th className="p-4">رقم الهاتف</th>
                                <th className="p-4">المستوى</th>
                                <th className="p-4">نقاط الولاء</th>
                                <th className="p-4">الرصيد (عليه)</th>
                                <th className="p-4">سقف الائتمان</th>
                                <th className="p-4">ملاحظات</th>
                                <th className="p-4 w-40">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredCustomers.map(customer => {
                                const tier = getCustomerTier(customer.totalPurchases);
                                const TierIcon = tier.icon;
                                return (
                                <tr key={customer.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="p-4 font-bold text-gray-800">{customer.name}</td>
                                    <td className="p-4 font-mono text-gray-600" dir="ltr">{customer.phone}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-lg text-xs font-black flex items-center gap-1 w-fit ${tier.bg} ${tier.color}`}>
                                            <TierIcon size={12} /> {tier.name}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-black flex items-center gap-1 w-fit">
                                            {customer.loyaltyPoints || 0} نقطة
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-black ${(customer.balance || 0) > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                            {(customer.balance || 0).toLocaleString()} SAR
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-600 font-bold">
                                        {(customer.creditLimit || 0).toLocaleString()} SAR
                                    </td>
                                    <td className="p-4 text-gray-500 text-sm max-w-xs truncate">{customer.notes || '-'}</td>
                                    <td className="p-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleViewHistory(customer)} className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100" title="كشف حساب"><FileText size={16}/></button>
                                        <button onClick={() => handleEdit(customer)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit size={16}/></button>
                                        <button onClick={() => handleDelete(customer.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            )})}
                            {filteredCustomers.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-16 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                                                <User size={32} className="text-gray-300" />
                                            </div>
                                            <p className="text-lg font-bold text-gray-500 mb-1">لا يوجد عملاء</p>
                                            <p className="text-sm">لم يتم العثور على أي عملاء يطابقون بحثك.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit/Add Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-black text-gray-800">{editingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500"><XCircle size={24} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">اسم العميل <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-sap-primary outline-none pl-10" placeholder="الاسم الثلاثي" required />
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">رقم الجوال <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-sap-primary outline-none pl-10" placeholder="05xxxxxxxx" required dir="ltr" />
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">الرصيد الافتتاحي (عليه)</label>
                                    <div className="relative">
                                        <input type="number" value={balance} onChange={e => setBalance(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-sap-primary outline-none pl-10" placeholder="0.00" />
                                        <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">سقف الائتمان</label>
                                    <div className="relative">
                                        <input type="number" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-sap-primary outline-none pl-10" placeholder="0.00" />
                                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات</label>
                                <div className="relative">
                                    <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-sap-primary outline-none pl-10 min-h-[100px]" placeholder="ملاحظات إضافية..." />
                                    <FileText className="absolute left-3 top-4 text-gray-400" size={18}/>
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200">إلغاء</button>
                                <button type="submit" className="flex-[2] py-3 bg-sap-primary text-white rounded-xl font-bold shadow-lg hover:bg-sap-primary-hover flex items-center justify-center gap-2">
                                    <CheckCircle2 size={20} /> حفظ البيانات
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {selectedCustomerForStatement && (
                <div className="absolute inset-0 bg-white z-[60]">
                    <CustomerStatement 
                        customer={selectedCustomerForStatement} 
                        onBack={() => {
                            setSelectedCustomerForStatement(null);
                            loadCustomers(); // Reload to get updated balances
                        }} 
                    />
                </div>
            )}
        </div>
    );
};
