import React, { useState, useEffect } from 'react';
import { db } from '../services/supabase';
import { CustomerTrust, Customer, Product } from '../types';
import { Package, Plus, Search, Filter, ArrowDownToLine, History, X, Save, Trash2, Edit, Printer, Share2 } from 'lucide-react';

interface CustomerTrustsProps {
    products: Product[];
}

export const CustomerTrusts: React.FC<CustomerTrustsProps> = ({ products }) => {
    const [trusts, setTrusts] = useState<CustomerTrust[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('active');
    
    const [showModal, setShowModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    
    const [selectedTrust, setSelectedTrust] = useState<CustomerTrust | null>(null);
    const [withdrawQty, setWithdrawQty] = useState<number | ''>('');
    const [withdrawNote, setWithdrawNote] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);

    const [formData, setFormData] = useState<Partial<CustomerTrust>>({
        customerId: '',
        productId: '',
        totalQty: 0,
        takenQty: 0,
        notes: '',
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [trustsData, customersData] = await Promise.all([
                db.customerTrusts.getAll(),
                db.customers.getAll()
            ]);
            setTrusts(trustsData as CustomerTrust[]);
            setCustomers(customersData as Customer[]);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.customerId || !formData.productId || !formData.totalQty) {
            alert('الرجاء تعبئة الحقول المطلوبة (العميل، المنتج، إجمالي الكمية)');
            return;
        }

        const customer = customers.find(c => c.id === formData.customerId);
        const product = products.find(p => p.id === formData.productId);

        if (!customer || !product) return;

        const totalQty = Number(formData.totalQty);
        const takenQty = Number(formData.takenQty || 0);
        const remainingQty = totalQty - takenQty;

        const newTrust: CustomerTrust = {
            id: selectedTrust?.id || crypto.randomUUID(),
            customerId: customer.id,
            customerName: customer.name,
            productId: product.id,
            productName: product.name,
            totalQty,
            takenQty,
            remainingQty,
            date: selectedTrust?.date || new Date().toISOString(),
            lastUpdate: new Date().toISOString(),
            notes: formData.notes || '',
            status: remainingQty <= 0 ? 'completed' : 'active',
            history: selectedTrust?.history || [{
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                qty: totalQty,
                type: 'add',
                note: 'إضافة رصيد أمانات جديد'
            }]
        };

        try {
            await db.customerTrusts.upsert(newTrust);
            await fetchData();
            setShowModal(false);
            resetForm();
        } catch (error) {
            console.error("Error saving trust:", error);
            alert('حدث خطأ أثناء الحفظ');
        }
    };

    const handleWithdraw = async () => {
        if (!selectedTrust || !withdrawQty || Number(withdrawQty) <= 0) return;
        
        const qtyToWithdraw = Number(withdrawQty);
        if (qtyToWithdraw > selectedTrust.remainingQty) {
            alert('الكمية المسحوبة أكبر من الرصيد المتبقي!');
            return;
        }

        const newTakenQty = selectedTrust.takenQty + qtyToWithdraw;
        const newRemainingQty = selectedTrust.totalQty - newTakenQty;

        const updatedTrust: CustomerTrust = {
            ...selectedTrust,
            takenQty: newTakenQty,
            remainingQty: newRemainingQty,
            lastUpdate: new Date().toISOString(),
            status: newRemainingQty <= 0 ? 'completed' : 'active',
            history: [
                {
                    id: crypto.randomUUID(),
                    date: new Date().toISOString(),
                    qty: qtyToWithdraw,
                    type: 'withdraw',
                    note: withdrawNote || 'سحب من الرصيد'
                },
                ...selectedTrust.history
            ]
        };

        try {
            await db.customerTrusts.upsert(updatedTrust);
            await fetchData();
            setShowWithdrawModal(false);
            setWithdrawQty('');
            setWithdrawNote('');
            setSelectedTrust(null);
        } catch (error) {
            console.error("Error withdrawing:", error);
            alert('حدث خطأ أثناء السحب');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا السجل؟')) return;
        try {
            await db.customerTrusts.delete(id);
            await fetchData();
        } catch (error) {
            console.error("Error deleting trust:", error);
            alert('حدث خطأ أثناء الحذف');
        }
    };

    const handleShareHistory = async () => {
        if (!selectedTrust) return;

        let text = `سجل حركات الأمانة\n`;
        text += `العميل: ${selectedTrust.customerName}\n`;
        text += `المنتج: ${selectedTrust.productName}\n`;
        text += `إجمالي الكمية: ${selectedTrust.totalQty} | المتبقي: ${selectedTrust.remainingQty}\n`;
        text += `---------------------------\n`;

        selectedTrust.history.forEach(h => {
            const dateStr = new Date(h.date).toLocaleString('en-GB');
            const typeStr = h.type === 'add' ? 'إضافة رصيد' : 'سحب';
            text += `[${dateStr}] ${typeStr} - الكمية: ${h.qty}\n`;
            if (h.note) text += `ملاحظات: ${h.note}\n`;
            text += `-\n`;
        });

        try {
            if (navigator.share) {
                await navigator.share({
                    title: `سجل أمانة - ${selectedTrust.customerName}`,
                    text: text
                });
            } else {
                await navigator.clipboard.writeText(text);
                alert('تم نسخ النص إلى الحافظة');
            }
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const resetForm = () => {
        setFormData({
            customerId: '',
            productId: '',
            totalQty: 0,
            takenQty: 0,
            notes: '',
        });
        setSelectedTrust(null);
        setProductSearch('');
        setShowProductDropdown(false);
    };

    const filteredTrusts = trusts.filter(t => {
        const matchesSearch = t.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              t.productName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 print:p-0 print:m-0" dir="rtl">
            {/* Print Only Section */}
            {showHistoryModal && selectedTrust && (
                <div className="hidden print:block bg-white p-8">
                    <div className="text-center mb-8 border-b border-gray-200 pb-6">
                        <h2 className="text-3xl font-black text-gray-800 mb-2">سجل حركات الأمانة</h2>
                        <p className="text-gray-500">تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')} - {new Date().toLocaleTimeString('ar-SA')}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6 mb-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
                        <div>
                            <div className="text-sm text-gray-500 mb-1">اسم العميل</div>
                            <div className="font-bold text-lg text-gray-800">{selectedTrust.customerName}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">المنتج</div>
                            <div className="font-bold text-lg text-gray-800">{selectedTrust.productName}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">إجمالي الكمية المودعة</div>
                            <div className="font-black text-xl text-sap-primary">{selectedTrust.totalQty}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">الرصيد المتبقي</div>
                            <div className="font-black text-xl text-red-600">{selectedTrust.remainingQty}</div>
                        </div>
                    </div>

                    <table className="w-full text-right text-sm border border-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-3 font-bold text-gray-800 border-b border-gray-300">التاريخ</th>
                                <th className="px-4 py-3 font-bold text-gray-800 border-b border-gray-300">الحركة</th>
                                <th className="px-4 py-3 font-bold text-gray-800 text-center border-b border-gray-300">الكمية</th>
                                <th className="px-4 py-3 font-bold text-gray-800 border-b border-gray-300">ملاحظات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {selectedTrust.history.map(h => (
                                <tr key={h.id}>
                                    <td className="px-4 py-3 text-gray-800" dir="ltr">{new Date(h.date).toLocaleString('en-GB')}</td>
                                    <td className="px-4 py-3 font-bold text-gray-800">
                                        {h.type === 'add' ? 'إضافة رصيد' : 'سحب'}
                                    </td>
                                    <td className="px-4 py-3 text-center font-black text-gray-900">{h.qty}</td>
                                    <td className="px-4 py-3 text-gray-600">{h.note || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className={`flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 ${showHistoryModal ? 'print:hidden' : ''}`}>
                <div>
                    <h1 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                        <Package className="text-sap-primary" size={28} />
                        أمانات العملاء
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm">إدارة بضائع العملاء المحجوزة والمتبقية في المستودع</p>
                </div>
                <button 
                    onClick={() => { resetForm(); setShowModal(true); }}
                    className="bg-sap-primary text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-sap-primary/90 transition-colors shadow-lg shadow-sap-primary/20"
                >
                    <Plus size={20} />
                    إضافة أمانة جديدة
                </button>
            </div>

            <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col md:flex-row gap-4 justify-between items-center ${showHistoryModal ? 'print:hidden' : ''}`}>
                <div className="relative w-full md:w-96">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="بحث باسم العميل أو المنتج..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-sap-primary focus:ring-1 focus:ring-sap-primary transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter size={18} className="text-gray-400" />
                    <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-sap-primary font-bold text-sm"
                    >
                        <option value="all">جميع الحالات</option>
                        <option value="active">نشط (يوجد رصيد)</option>
                        <option value="completed">مكتمل (تم السحب بالكامل)</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className={`text-center py-20 text-gray-400 font-bold ${showHistoryModal ? 'print:hidden' : ''}`}>جاري التحميل...</div>
            ) : (
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${showHistoryModal ? 'print:hidden' : ''}`}>
                    {filteredTrusts.map(trust => (
                        <div key={trust.id} className={`bg-white rounded-2xl border ${trust.status === 'active' ? 'border-sap-primary/20 shadow-sm' : 'border-gray-200 opacity-75'} overflow-hidden flex flex-col`}>
                            <div className={`p-4 border-b ${trust.status === 'active' ? 'bg-sap-primary/5 border-sap-primary/10' : 'bg-gray-50 border-gray-100'} flex justify-between items-start`}>
                                <div>
                                    <h3 className="font-black text-gray-800 text-lg">{trust.customerName}</h3>
                                    <p className="text-xs text-gray-500 mt-1">{new Date(trust.date).toLocaleDateString('ar-SA')}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black ${trust.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                    {trust.status === 'active' ? 'نشط' : 'مكتمل'}
                                </span>
                            </div>
                            
                            <div className="p-5 flex-1 flex flex-col gap-4">
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">المنتج</div>
                                    <div className="font-bold text-gray-800">{trust.productName}</div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <div>
                                        <div className="text-[10px] text-gray-500 font-bold mb-1">الإجمالي</div>
                                        <div className="font-black text-gray-800">{trust.totalQty}</div>
                                    </div>
                                    <div className="border-r border-l border-gray-200">
                                        <div className="text-[10px] text-gray-500 font-bold mb-1">المستلم</div>
                                        <div className="font-black text-blue-600">{trust.takenQty}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-gray-500 font-bold mb-1">المتبقي</div>
                                        <div className={`font-black ${trust.remainingQty > 0 ? 'text-red-600' : 'text-gray-400'}`}>{trust.remainingQty}</div>
                                    </div>
                                </div>

                                {trust.notes && (
                                    <div className="text-xs text-gray-600 bg-yellow-50 p-2 rounded-lg border border-yellow-100">
                                        <span className="font-bold">ملاحظات: </span>{trust.notes}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => { setSelectedTrust(trust); setShowHistoryModal(true); }}
                                        className="p-2 text-gray-500 hover:text-sap-primary hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200"
                                        title="سجل الحركات"
                                    >
                                        <History size={18} />
                                    </button>
                                    <button 
                                        onClick={() => { 
                                            setSelectedTrust(trust); 
                                            setFormData({
                                                customerId: trust.customerId,
                                                productId: trust.productId,
                                                totalQty: trust.totalQty,
                                                takenQty: trust.takenQty,
                                                notes: trust.notes
                                            });
                                            setShowModal(true); 
                                        }}
                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200"
                                        title="تعديل"
                                    >
                                        <Edit size={18} />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(trust.id)}
                                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200"
                                        title="حذف"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                                <button 
                                    onClick={() => { setSelectedTrust(trust); setShowWithdrawModal(true); }}
                                    disabled={trust.status === 'completed'}
                                    className={`px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2 transition-colors ${trust.status === 'completed' ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-sap-primary text-white hover:bg-sap-primary/90 shadow-sm'}`}
                                >
                                    <ArrowDownToLine size={16} />
                                    سحب كمية
                                </button>
                            </div>
                        </div>
                    ))}
                    {filteredTrusts.length === 0 && (
                        <div className="col-span-full text-center py-20 bg-white rounded-2xl border border-gray-100 border-dashed">
                            <Package size={48} className="mx-auto text-gray-300 mb-4" />
                            <h3 className="text-lg font-bold text-gray-600">لا توجد سجلات أمانات</h3>
                            <p className="text-gray-400 text-sm mt-1">قم بإضافة أمانة جديدة للبدء في المتابعة</p>
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 text-lg">{selectedTrust ? 'تعديل الأمانة' : 'إضافة أمانة جديدة'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">العميل *</label>
                                <select 
                                    value={formData.customerId}
                                    onChange={e => setFormData({...formData, customerId: e.target.value})}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-sap-primary"
                                >
                                    <option value="">اختر العميل...</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="relative">
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">المنتج *</label>
                                <div className="relative">
                                    <input 
                                        type="text"
                                        placeholder="ابحث باسم المنتج أو الكود..."
                                        value={showProductDropdown ? productSearch : (products.find(p => p.id === formData.productId)?.name || '')}
                                        onChange={(e) => {
                                            setProductSearch(e.target.value);
                                            setShowProductDropdown(true);
                                            if (!e.target.value) setFormData({...formData, productId: ''});
                                        }}
                                        onFocus={() => {
                                            setShowProductDropdown(true);
                                            setProductSearch('');
                                        }}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-sap-primary"
                                    />
                                    {showProductDropdown && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setShowProductDropdown(false)}></div>
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                                {products.filter(p => 
                                                    p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
                                                    (p.code && p.code.toLowerCase().includes(productSearch.toLowerCase()))
                                                ).length > 0 ? (
                                                    products.filter(p => 
                                                        p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
                                                        (p.code && p.code.toLowerCase().includes(productSearch.toLowerCase()))
                                                    ).map(p => (
                                                        <div 
                                                            key={p.id}
                                                            onClick={() => {
                                                                setFormData({...formData, productId: p.id});
                                                                setShowProductDropdown(false);
                                                                setProductSearch('');
                                                            }}
                                                            className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                                                        >
                                                            <div className="font-bold text-sm text-gray-800">{p.name}</div>
                                                            {p.code && <div className="text-xs text-gray-500 font-mono mt-0.5">{p.code}</div>}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-3 text-sm text-gray-500 text-center">لا توجد منتجات مطابقة</div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1.5">إجمالي الكمية *</label>
                                    <input 
                                        type="number" 
                                        value={formData.totalQty || ''}
                                        onChange={e => setFormData({...formData, totalQty: Number(e.target.value)})}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-sap-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1.5">الكمية المستلمة حالياً</label>
                                    <input 
                                        type="number" 
                                        value={formData.takenQty || ''}
                                        onChange={e => setFormData({...formData, takenQty: Number(e.target.value)})}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-sap-primary"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">ملاحظات</label>
                                <textarea 
                                    value={formData.notes || ''}
                                    onChange={e => setFormData({...formData, notes: e.target.value})}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-sap-primary resize-none h-24"
                                    placeholder="أي ملاحظات إضافية..."
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                            <button onClick={() => setShowModal(false)} className="px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors">إلغاء</button>
                            <button onClick={handleSave} className="px-6 py-2.5 bg-sap-primary text-white font-bold rounded-xl hover:bg-sap-primary/90 transition-colors flex items-center gap-2">
                                <Save size={18} />
                                حفظ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Withdraw Modal */}
            {showWithdrawModal && selectedTrust && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 text-lg">سحب كمية</h3>
                            <button onClick={() => setShowWithdrawModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-sm border border-blue-100">
                                <div className="font-bold mb-1">{selectedTrust.customerName}</div>
                                <div>{selectedTrust.productName}</div>
                                <div className="mt-2 font-black text-red-600">الرصيد المتبقي: {selectedTrust.remainingQty}</div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">الكمية المراد سحبها *</label>
                                <input 
                                    type="number" 
                                    value={withdrawQty}
                                    onChange={e => setWithdrawQty(Number(e.target.value))}
                                    max={selectedTrust.remainingQty}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-sap-primary font-black text-lg text-center"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">ملاحظات السحب</label>
                                <input 
                                    type="text" 
                                    value={withdrawNote}
                                    onChange={e => setWithdrawNote(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-sap-primary"
                                    placeholder="مثال: استلمها السائق أحمد..."
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                            <button onClick={() => setShowWithdrawModal(false)} className="px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors">إلغاء</button>
                            <button 
                                onClick={handleWithdraw} 
                                disabled={!withdrawQty || Number(withdrawQty) <= 0 || Number(withdrawQty) > selectedTrust.remainingQty}
                                className="px-6 py-2.5 bg-sap-primary text-white font-bold rounded-xl hover:bg-sap-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ArrowDownToLine size={18} />
                                تأكيد السحب
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {showHistoryModal && selectedTrust && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                <History size={20} className="text-sap-primary" />
                                سجل حركات الأمانة
                            </h3>
                            <div className="flex items-center gap-2">
                                <button onClick={() => window.print()} className="text-gray-500 hover:text-sap-primary p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-colors" title="طباعة">
                                    <Printer size={18} />
                                </button>
                                <button onClick={handleShareHistory} className="text-gray-500 hover:text-sap-primary p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-colors" title="مشاركة">
                                    <Share2 size={18} />
                                </button>
                                <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-200 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 bg-white border-b border-gray-100 shrink-0">
                            <div className="font-black text-gray-800">{selectedTrust.customerName}</div>
                            <div className="text-sm text-gray-500">{selectedTrust.productName}</div>
                        </div>
                        <div className="p-0 overflow-y-auto flex-1">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 font-bold text-gray-600">التاريخ</th>
                                        <th className="px-4 py-3 font-bold text-gray-600">الحركة</th>
                                        <th className="px-4 py-3 font-bold text-gray-600 text-center">الكمية</th>
                                        <th className="px-4 py-3 font-bold text-gray-600">ملاحظات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {selectedTrust.history.map(h => (
                                        <tr key={h.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-xs text-gray-500" dir="ltr">{new Date(h.date).toLocaleString('en-GB')}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-[10px] font-black ${h.type === 'add' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {h.type === 'add' ? 'إضافة رصيد' : 'سحب'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center font-black text-gray-800">{h.qty}</td>
                                            <td className="px-4 py-3 text-xs text-gray-600">{h.note}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
