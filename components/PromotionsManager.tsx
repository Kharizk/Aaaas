import React, { useState, useEffect } from 'react';
import { Promotion, Product } from '../types';
import { db } from '../services/supabase';
import { Plus, Trash2, Save, Tag, Calendar, Percent, Gift, Settings, Search } from 'lucide-react';

interface PromotionsManagerProps {
    products: Product[];
}

export const PromotionsManager: React.FC<PromotionsManagerProps> = ({ products }) => {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [name, setName] = useState('');
    const [type, setType] = useState<Promotion['type']>('discount_percentage');
    const [value, setValue] = useState('');
    const [targetType, setTargetType] = useState<Promotion['targetType']>('all');
    const [targetId, setTargetId] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [isActive, setIsActive] = useState(true);

    const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

    useEffect(() => {
        const load = async () => {
            const data = await db.promotions.getAll();
            setPromotions(data as Promotion[]);
        };
        load();
    }, []);

    const handleSave = async () => {
        if (!name || !value) {
            alert('يرجى تعبئة الحقول المطلوبة');
            return;
        }

        const newPromo: Promotion = {
            id: crypto.randomUUID(),
            name,
            type,
            value: parseFloat(value),
            targetType,
            targetId: targetType === 'all' ? undefined : targetId,
            startDate,
            endDate,
            isActive
        };

        await db.promotions.upsert(newPromo);
        setPromotions(prev => [newPromo, ...prev]);
        
        // Reset form
        setName('');
        setValue('');
    };

    const handleDelete = async (id: string) => {
        if (confirm('هل أنت متأكد من حذف هذا العرض؟')) {
            await db.promotions.delete(id);
            setPromotions(prev => prev.filter(p => p.id !== id));
        }
    };

    const toggleActive = async (promo: Promotion) => {
        const updated = { ...promo, isActive: !promo.isActive };
        await db.promotions.upsert(updated);
        setPromotions(prev => prev.map(p => p.id === promo.id ? updated : p));
    };

    return (
        <div className="flex gap-6 h-full animate-in fade-in relative">
            <div className="w-96 bg-white p-6 rounded-3xl shadow-sm border border-gray-200 h-fit overflow-y-auto max-h-full">
                <h3 className="font-black text-lg mb-4 flex items-center gap-2 text-purple-600"><Tag/> إضافة عرض جديد</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">اسم العرض</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border rounded-xl font-bold" placeholder="مثال: خصم نهاية العام"/>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">نوع العرض</label>
                        <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-3 border rounded-xl font-bold bg-white">
                            <option value="discount_percentage">خصم نسبة مئوية (%)</option>
                            <option value="discount_amount">خصم مبلغ ثابت</option>
                            <option value="bogo">اشتر X واحصل على Y (مجاناً)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">
                            {type === 'discount_percentage' ? 'نسبة الخصم (%)' : type === 'discount_amount' ? 'مبلغ الخصم' : 'الكمية المطلوبة للحصول على المجاني'}
                        </label>
                        <input type="number" value={value} onChange={e => setValue(e.target.value)} className="w-full p-3 border rounded-xl font-bold font-mono" placeholder="القيمة"/>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">الهدف</label>
                        <select value={targetType} onChange={e => setTargetType(e.target.value as any)} className="w-full p-3 border rounded-xl font-bold bg-white">
                            <option value="all">كل المنتجات</option>
                            <option value="category">تصنيف محدد</option>
                            <option value="product">منتج محدد</option>
                        </select>
                    </div>

                    {targetType === 'category' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">اختر التصنيف</label>
                            <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full p-3 border rounded-xl font-bold bg-white">
                                <option value="">-- اختر التصنيف --</option>
                                {categories.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
                            </select>
                        </div>
                    )}

                    {targetType === 'product' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">اختر المنتج</label>
                            <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full p-3 border rounded-xl font-bold bg-white">
                                <option value="">-- اختر المنتج --</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">تاريخ البدء</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-3 border rounded-xl font-bold bg-gray-50"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">تاريخ الانتهاء</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-3 border rounded-xl font-bold bg-gray-50"/>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                        <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-5 h-5 accent-purple-600"/>
                        <span className="font-bold text-sm text-gray-700">تفعيل العرض فوراً</span>
                    </div>

                    <button onClick={handleSave} className="w-full py-3 bg-purple-600 text-white rounded-xl font-black hover:bg-purple-700 transition-all flex justify-center gap-2 mt-4"><Save size={18}/> حفظ العرض</button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-black text-xl">العروض الترويجية الحالية</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4 content-start">
                    {promotions.map(promo => (
                        <div key={promo.id} className={`border rounded-2xl p-4 transition-all ${promo.isActive ? 'border-purple-200 bg-purple-50/30' : 'border-gray-200 bg-gray-50 opacity-70'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h4 className="font-black text-lg text-gray-800">{promo.name}</h4>
                                    <div className="flex items-center gap-2 text-xs font-bold mt-1">
                                        <span className={`px-2 py-0.5 rounded-full ${promo.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                            {promo.isActive ? 'نشط' : 'غير نشط'}
                                        </span>
                                        <span className="text-gray-500 flex items-center gap-1"><Calendar size={12}/> {promo.endDate}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => toggleActive(promo)} className={`p-2 rounded-lg ${promo.isActive ? 'text-green-600 hover:bg-green-100' : 'text-gray-400 hover:bg-gray-200'}`} title={promo.isActive ? 'إيقاف' : 'تفعيل'}>
                                        <Settings size={18}/>
                                    </button>
                                    <button onClick={() => handleDelete(promo.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                                </div>
                            </div>
                            
                            <div className="bg-white rounded-xl p-3 border border-gray-100">
                                <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                    {promo.type === 'discount_percentage' && <><Percent size={16} className="text-purple-500"/> خصم {promo.value}%</>}
                                    {promo.type === 'discount_amount' && <><Tag size={16} className="text-purple-500"/> خصم {promo.value} SAR</>}
                                    {promo.type === 'bogo' && <><Gift size={16} className="text-purple-500"/> اشتر {promo.value} واحصل على 1 مجاناً</>}
                                </div>
                                <div className="text-xs text-gray-500 font-bold">
                                    الهدف: {promo.targetType === 'all' ? 'جميع المنتجات' : promo.targetType === 'category' ? `تصنيف (${promo.targetId})` : `منتج (${products.find(p => p.id === promo.targetId)?.name || 'غير معروف'})`}
                                </div>
                            </div>
                        </div>
                    ))}
                    {promotions.length === 0 && (
                        <div className="col-span-full text-center py-20 text-gray-400">
                            <Tag size={48} className="mx-auto mb-4 opacity-50"/>
                            <p>لا توجد عروض ترويجية مسجلة</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
