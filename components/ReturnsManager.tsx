import React, { useState, useEffect } from 'react';
import { Product, DailySales, ReturnRecord, ReturnItem, User } from '../types';
import { db } from '../services/supabase';
import { useLanguage } from './LanguageContext';
import { Search, RotateCcw, Package, AlertTriangle, Check, Calendar, FileText, User as UserIcon } from 'lucide-react';

interface ReturnsManagerProps {
    products: Product[];
    currentUser: User;
    sales: DailySales[];
}

export const ReturnsManager: React.FC<ReturnsManagerProps> = ({ products, currentUser, sales }) => {
    const { t, language } = useLanguage();
    const [returns, setReturns] = useState<ReturnRecord[]>([]);
    const [searchReceipt, setSearchReceipt] = useState('');
    const [foundSale, setFoundSale] = useState<DailySales | null>(null);
    const [returnItems, setReturnItems] = useState<Record<string, { qty: number, reason: string }>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

    useEffect(() => {
        loadReturns();
    }, []);

    const loadReturns = async () => {
        setIsLoading(true);
        try {
            const data = await db.returns.getAll();
            setReturns(data as ReturnRecord[]);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = () => {
        if (!searchReceipt.trim()) return;
        
        // Find sale by receipt number (id)
        const sale = sales.find(s => s.id === searchReceipt.trim() || s.id.includes(searchReceipt.trim()));
        if (sale) {
            setFoundSale(sale);
            setReturnItems({});
        } else {
            setFoundSale(null);
            alert(t('returns.no_receipt'));
        }
    };

    const handleQtyChange = (productId: string, qty: number, maxQty: number) => {
        if (qty < 0) qty = 0;
        if (qty > maxQty) qty = maxQty;
        
        setReturnItems(prev => ({
            ...prev,
            [productId]: { ...prev[productId], qty, reason: prev[productId]?.reason || '' }
        }));
    };

    const handleReasonChange = (productId: string, reason: string) => {
        setReturnItems(prev => ({
            ...prev,
            [productId]: { ...prev[productId], qty: prev[productId]?.qty || 0, reason }
        }));
    };

    const calculateTotalRefund = () => {
        if (!foundSale || !foundSale.cart) return 0;
        let total = 0;
        foundSale.cart.forEach(item => {
            const returnQty = returnItems[item.productId]?.qty || 0;
            total += returnQty * item.price;
        });
        return total;
    };

    const handleSubmitReturn = async () => {
        if (!foundSale || !foundSale.cart) return;

        const itemsToReturn: ReturnItem[] = [];
        foundSale.cart.forEach(item => {
            const returnData = returnItems[item.productId];
            if (returnData && returnData.qty > 0) {
                itemsToReturn.push({
                    productId: item.productId,
                    quantity: returnData.qty,
                    price: item.price,
                    reason: returnData.reason || 'غير محدد'
                });
            }
        });

        if (itemsToReturn.length === 0) {
            alert(t('returns.select_items'));
            return;
        }

        setIsLoading(true);
        try {
            const totalAmount = calculateTotalRefund();
            const returnRecord: ReturnRecord = {
                id: `RET-${Date.now()}`,
                originalSaleId: foundSale.id,
                date: new Date().toISOString(),
                items: itemsToReturn,
                totalAmount,
                branchId: currentUser.branchId || 'default',
                userId: currentUser.id,
                status: 'completed'
            };

            // Save return record
            await db.returns.add(returnRecord);

            // Update inventory
            for (const item of itemsToReturn) {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    await db.products.upsert({
                        ...product,
                        stock: (product.stock || 0) + item.quantity
                    });
                }
            }

            // Log activity
            await db.activityLogs.add({
                action: 'مرتجع جديد',
                details: `تم تسجيل مرتجع للفاتورة ${foundSale.id} بقيمة ${totalAmount}`,
                user: currentUser.fullName,
                type: 'warning'
            });

            alert(t('returns.success'));
            setFoundSale(null);
            setSearchReceipt('');
            setReturnItems({});
            loadReturns();
            setActiveTab('history');
        } catch (error) {
            console.error(error);
            alert(t('returns.error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 animate-in fade-in">
            {/* Header */}
            <div className="bg-white p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                        <RotateCcw size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-800">{t('returns.title')}</h2>
                        <p className="text-sm text-gray-500 font-bold mt-1">إدارة المرتجعات وتحديث المخزون</p>
                    </div>
                </div>
                
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('new')}
                        className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'new' ? 'bg-white text-sap-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {t('returns.new')}
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'history' ? 'bg-white text-sap-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {t('returns.history')}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'new' ? (
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Search Box */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t('returns.search_receipt')}</label>
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <input 
                                        type="text" 
                                        value={searchReceipt}
                                        onChange={e => setSearchReceipt(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                        placeholder="مثال: INV-123456"
                                        className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sap-primary focus:bg-white transition-all font-mono"
                                    />
                                    <Search className={`absolute ${language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-gray-400`} size={20} />
                                </div>
                                <button 
                                    onClick={handleSearch}
                                    className="px-8 py-3 bg-sap-primary text-white rounded-xl font-bold hover:bg-sap-primary-hover transition-colors shadow-sm"
                                >
                                    {t('common.search')}
                                </button>
                            </div>
                        </div>

                        {/* Search Results */}
                        {foundSale && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-4">
                                <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                    <div>
                                        <h3 className="font-black text-lg text-gray-800 flex items-center gap-2">
                                            <FileText size={20} className="text-sap-primary" />
                                            تفاصيل الفاتورة: <span className="font-mono text-sap-primary">{foundSale.id}</span>
                                        </h3>
                                        <p className="text-sm text-gray-500 font-bold mt-1 flex items-center gap-2">
                                            <Calendar size={14} /> {new Date(foundSale.date).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                                        </p>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm text-gray-500 font-bold">إجمالي الفاتورة</p>
                                        <p className="font-black text-xl text-gray-800">{foundSale.totalAmount} SAR</p>
                                    </div>
                                </div>

                                <div className="p-6">
                                    <h4 className="font-bold text-gray-700 mb-4">{t('returns.select_items')}</h4>
                                    <div className="space-y-4">
                                        {foundSale.cart?.map(item => {
                                            const product = products.find(p => p.id === item.productId);
                                            const returnData = returnItems[item.productId] || { qty: 0, reason: '' };
                                            
                                            // Calculate already returned qty if we had a history of returns for this sale
                                            // For simplicity, we just use the original sale qty as max
                                            const maxQty = item.quantity;

                                            return (
                                                <div key={item.productId} className={`p-4 rounded-xl border transition-all ${returnData.qty > 0 ? 'border-red-200 bg-red-50/30' : 'border-gray-100 bg-white'}`}>
                                                    <div className="flex items-center justify-between flex-wrap gap-4">
                                                        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                                                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                                                                <Package size={20} className="text-gray-500" />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-gray-800">{product?.name || 'منتج غير معروف'}</p>
                                                                <p className="text-sm text-gray-500 font-mono">{item.price} SAR × {item.quantity}</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-4 flex-wrap">
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-500 mb-1">{t('returns.quantity_to_return')}</label>
                                                                <div className="flex items-center gap-2">
                                                                    <button 
                                                                        onClick={() => handleQtyChange(item.productId, returnData.qty - 1, maxQty)}
                                                                        className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded text-gray-700 font-bold hover:bg-gray-300"
                                                                    >-</button>
                                                                    <input 
                                                                        type="number" 
                                                                        value={returnData.qty}
                                                                        onChange={e => handleQtyChange(item.productId, parseInt(e.target.value) || 0, maxQty)}
                                                                        className="w-16 h-8 text-center font-bold border border-gray-300 rounded focus:outline-none focus:border-sap-primary"
                                                                    />
                                                                    <button 
                                                                        onClick={() => handleQtyChange(item.productId, returnData.qty + 1, maxQty)}
                                                                        className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded text-gray-700 font-bold hover:bg-gray-300"
                                                                    >+</button>
                                                                </div>
                                                                <p className="text-[10px] text-gray-400 mt-1 text-center">{t('returns.max_quantity', { max: maxQty })}</p>
                                                            </div>

                                                            {returnData.qty > 0 && (
                                                                <div className="w-48 animate-in fade-in">
                                                                    <label className="block text-xs font-bold text-gray-500 mb-1">{t('returns.reason')}</label>
                                                                    <select 
                                                                        value={returnData.reason}
                                                                        onChange={e => handleReasonChange(item.productId, e.target.value)}
                                                                        className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-sap-primary bg-white"
                                                                    >
                                                                        <option value="">-- اختر السبب --</option>
                                                                        <option value="defective">تالف / عيب مصنعي</option>
                                                                        <option value="wrong_item">منتج خاطئ</option>
                                                                        <option value="customer_changed_mind">تغيير رأي العميل</option>
                                                                        <option value="expired">منتهي الصلاحية</option>
                                                                        <option value="other">أخرى</option>
                                                                    </select>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-gray-500">{t('returns.total_refund')}</p>
                                        <p className="text-2xl font-black text-red-600">{calculateTotalRefund()} SAR</p>
                                    </div>
                                    <button 
                                        onClick={handleSubmitReturn}
                                        disabled={isLoading || calculateTotalRefund() === 0}
                                        className="px-8 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isLoading ? <RotateCcw className="animate-spin" size={20} /> : <Check size={20} />}
                                        {t('returns.confirm')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="p-4 font-bold text-gray-600">رقم المرتجع</th>
                                        <th className="p-4 font-bold text-gray-600">رقم الفاتورة الأصلية</th>
                                        <th className="p-4 font-bold text-gray-600">التاريخ</th>
                                        <th className="p-4 font-bold text-gray-600">المبلغ المسترد</th>
                                        <th className="p-4 font-bold text-gray-600">العناصر</th>
                                        <th className="p-4 font-bold text-gray-600">المستخدم</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {returns.length > 0 ? returns.map(ret => (
                                        <tr key={ret.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-mono font-bold text-sm">{ret.id}</td>
                                            <td className="p-4 font-mono text-sm text-gray-500">{ret.originalSaleId || '-'}</td>
                                            <td className="p-4 text-sm font-bold text-gray-700">{new Date(ret.date).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}</td>
                                            <td className="p-4 font-black text-red-600">{ret.totalAmount} SAR</td>
                                            <td className="p-4 text-sm text-gray-600">
                                                {ret.items.length} عناصر
                                            </td>
                                            <td className="p-4 text-sm font-bold text-gray-600 flex items-center gap-2">
                                                <UserIcon size={14} /> {ret.userId}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={6} className="p-16 text-center">
                                                <div className="flex flex-col items-center justify-center text-gray-400">
                                                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                                                        <RotateCcw size={32} className="text-gray-300" />
                                                    </div>
                                                    <p className="text-lg font-bold text-gray-500 mb-1">لا توجد سجلات مرتجعات</p>
                                                    <p className="text-sm">لم يتم العثور على أي مرتجعات مسجلة.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
