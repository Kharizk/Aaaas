
import React, { useState, useEffect, useRef } from 'react';
import { Save, Building2, Layout, CheckCircle2, ShieldCheck, Sparkles, Loader2, Lock, UserCog, AlertCircle, CalendarClock, Coins, Download, Upload, Database, Trash2 } from 'lucide-react';
import { db } from '../services/supabase';
import { useSystemSettings } from './SystemSettingsContext';

export const Settings: React.FC = () => {
    const { settings, updateSettings, isLoading: isSettingsLoading } = useSystemSettings();
    const [orgName, setOrgName] = useState('');
    const [expiryAlertDays, setExpiryAlertDays] = useState(60);
    const [currencySymbolType, setCurrencySymbolType] = useState<'text' | 'icon' | 'custom_image'>('text');
    const [currencySymbolImage, setCurrencySymbolImage] = useState<string | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    // Password State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passError, setPassError] = useState('');
    const [passSuccess, setPassSuccess] = useState('');
    const [isPassSaving, setIsPassSaving] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isSettingsLoading) {
            setOrgName(settings.orgName);
            setExpiryAlertDays(settings.expiryAlertDays);
            setCurrencySymbolType(settings.currencySymbolType);
            setCurrencySymbolImage(settings.currencySymbolImage);
        }
    }, [settings, isSettingsLoading]);

    const handleSaveOrg = async () => {
        setIsSaving(true);
        try {
            await updateSettings({ 
                orgName, 
                expiryAlertDays: Number(expiryAlertDays),
                currencySymbolType,
                currencySymbolImage
            });
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
            localStorage.setItem('print_org_name', orgName);
        } catch (error) {
            alert("حدث خطأ أثناء الحفظ سحابياً");
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async () => {
        setPassError('');
        setPassSuccess('');
        
        if (!currentPassword || !newPassword || !confirmPassword) {
            setPassError('يرجى تعبئة جميع الحقول');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPassError('كلمة المرور الجديدة غير متطابقة');
            return;
        }
        if (newPassword.length < 6) {
            setPassError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            return;
        }

        setIsPassSaving(true);
        try {
            const realCurrentPass = await db.auth.getAdminPassword();
            if (currentPassword !== realCurrentPass) {
                setPassError('كلمة المرور الحالية غير صحيحة');
                setIsPassSaving(false);
                return;
            }

            await db.auth.setAdminPassword(newPassword);
            setPassSuccess('تم تغيير كلمة المرور بنجاح');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (e) {
            setPassError('حدث خطأ أثناء الاتصال بقاعدة البيانات');
        } finally {
            setIsPassSaving(false);
        }
    };

    const handleBackup = async () => {
        try {
            const data = {
                products: await db.products.getAll(),
                units: await db.units.getAll(),
                branches: await db.branches.getAll(),
                dailySales: await db.dailySales.getAll(),
                customers: await db.customers.getAll(),
                expenses: await db.expenses.getAll(),
                settings: await db.settings.get(),
                timestamp: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `storeflow_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('فشل إنشاء النسخة الاحتياطية');
            console.error(e);
        }
    };

    const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm('تحذير: استعادة النسخة الاحتياطية سيقوم باستبدال البيانات الحالية. هل أنت متأكد؟')) {
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                
                // Basic validation
                if (!data.products || !data.units || !data.timestamp) {
                    throw new Error('ملف غير صالح');
                }

                // Restore logic (This is simplified, ideally should be transactional)
                // In a real app, you might want to clear existing data first or merge
                // For now, we'll just upsert everything which acts as a merge/overwrite
                
                await Promise.all([
                    ...data.products.map((p: any) => db.products.upsert(p)),
                    ...data.units.map((u: any) => db.units.upsert(u)),
                    ...(data.branches || []).map((b: any) => db.branches.upsert(b)),
                    ...(data.dailySales || []).map((s: any) => db.dailySales.upsert(s)),
                    ...(data.customers || []).map((c: any) => db.customers.upsert(c)),
                    ...(data.expenses || []).map((ex: any) => db.expenses.upsert(ex)),
                ]);

                if (data.settings) {
                    await db.settings.update(data.settings);
                }

                alert('تم استعادة البيانات بنجاح! يرجى تحديث الصفحة.');
                window.location.reload();
            } catch (err) {
                alert('فشل استعادة البيانات: ملف غير صالح أو تالف');
                console.error(err);
            }
        };
        reader.readAsText(file);
    };

    if (isSettingsLoading) {
        return (
            <div className="h-64 flex items-center justify-center">
                <Loader2 className="animate-spin text-md-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col gap-4">
                <h1 className="text-4xl font-black text-md-on-surface flex items-center gap-4">
                  <div className="p-4 bg-md-primary text-md-on-primary rounded-m3-xl shadow-lg shadow-md-primary/20">
                    <Building2 size={32} />
                  </div>
                  إعدادات النظام
                </h1>
                <p className="text-md-on-surface-variant font-medium text-lg">تخصيص هوية المؤسسة وإدارة حساب المسؤول</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Org Settings */}
                <div className="space-y-8">
                    <div className="bg-md-surface rounded-[32px] border border-md-outline/10 p-8 elevation-1 relative overflow-hidden h-full">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-md-primary/5 rounded-full blur-3xl"></div>
                        
                        <h3 className="text-xl font-black text-md-on-surface mb-8 flex items-center gap-3">
                            <Layout className="text-md-secondary" size={24} />
                            هوية المطبوعات والتفضيلات
                        </h3>
                        
                        <div className="space-y-8 relative z-10">
                            <div className="space-y-4">
                                <label className="block text-xs font-black text-md-on-surface-variant uppercase tracking-widest px-1">اسم المؤسسة (الترويسة)</label>
                                <input 
                                    type="text" 
                                    value={orgName} 
                                    onChange={(e) => setOrgName(e.target.value)}
                                    className="w-full !text-2xl !font-black !p-6"
                                    placeholder="أدخل اسم مؤسستك..."
                                />
                                <div className="flex items-start gap-3 p-4 bg-md-secondary-container/30 rounded-m3-xl border border-md-secondary/10">
                                  <ShieldCheck size={20} className="text-md-on-secondary-container mt-1 shrink-0" />
                                  <p className="text-sm text-md-on-secondary-container font-medium leading-relaxed">
                                    سيتم حفظ هذا الاسم ليظهر في ترويسة جميع التقارير والملصقات لجميع المستخدمين.
                                  </p>
                                </div>
                            </div>

                            <div className="space-y-4 border-t border-dashed border-gray-200 pt-6">
                                <label className="block text-xs font-black text-md-on-surface-variant uppercase tracking-widest px-1 flex items-center gap-2">
                                    <Coins size={16} /> رمز العملة (الريال السعودي)
                                </label>
                                <div className="space-y-3">
                                    <select 
                                        value={currencySymbolType} 
                                        onChange={(e) => setCurrencySymbolType(e.target.value as any)}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm"
                                    >
                                        <option value="text">نص (ر.س)</option>
                                        <option value="icon">رمز (أيقونة)</option>
                                        <option value="custom_image">صورة مخصصة</option>
                                    </select>

                                    {currencySymbolType === 'custom_image' && (
                                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 border-dashed">
                                            {currencySymbolImage ? (
                                                <img src={currencySymbolImage} className="w-12 h-12 object-contain" alt="Currency" />
                                            ) : (
                                                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs font-bold">لا توجد</div>
                                            )}
                                            <label className="cursor-pointer bg-white border border-gray-300 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm">
                                                رفع صورة
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (re) => setCurrencySymbolImage(re.target?.result as string);
                                                        reader.readAsDataURL(file);
                                                    }
                                                }} />
                                            </label>
                                            {currencySymbolImage && (
                                                <button onClick={() => setCurrencySymbolImage(null)} className="text-red-500 text-xs font-bold hover:underline">حذف</button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4 border-t border-dashed border-gray-200 pt-6">
                                <label className="block text-xs font-black text-md-on-surface-variant uppercase tracking-widest px-1 flex items-center gap-2">
                                    <CalendarClock size={16} /> تنبيهات الصلاحية
                                </label>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="number" 
                                        value={expiryAlertDays} 
                                        onChange={(e) => setExpiryAlertDays(Number(e.target.value))}
                                        className="w-32 !text-lg !font-black !p-3 text-center"
                                        min="1"
                                    />
                                    <span className="text-sm font-bold text-gray-500">يوم قبل تاريخ الانتهاء</span>
                                </div>
                                <p className="text-[10px] text-gray-400">سيقوم النظام بإظهار تنبيه في لوحة التحكم للمنتجات التي يتبقى على صلاحيتها أقل من هذه المدة.</p>
                            </div>

                            <button 
                                onClick={handleSaveOrg}
                                disabled={isSaving}
                                className={`w-full py-5 rounded-m3-full font-black text-xl transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg ${isSaved ? 'bg-emerald-600 text-white' : 'bg-md-primary text-md-on-primary shadow-md-primary/20 hover:elevation-2'}`}
                            >
                                {isSaving ? <Loader2 size={24} className="animate-spin" /> : (isSaved ? <CheckCircle2 size={24} /> : <Save size={24} />)}
                                <span>{isSaved ? 'تم الحفظ بنجاح' : 'حفظ الإعدادات'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Account Settings & Backup */}
                <div className="space-y-8">
                    <div className="bg-white rounded-[32px] border border-gray-200 p-8 shadow-sm flex flex-col">
                        <h3 className="text-xl font-black text-gray-800 mb-8 flex items-center gap-3">
                            <UserCog className="text-sap-secondary" size={24} />
                            أمان الحساب (المدير)
                        </h3>

                        <div className="space-y-5 flex-1">
                            <div>
                                <label className="block text-xs font-black text-gray-500 mb-2">كلمة المرور الحالية</label>
                                <div className="relative">
                                    <input 
                                        type="password" 
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-sap-primary focus:bg-white"
                                        placeholder="••••••"
                                    />
                                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-black text-gray-500 mb-2">كلمة المرور الجديدة</label>
                                <input 
                                    type="password" 
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-sap-primary focus:bg-white"
                                    placeholder="أدخل كلمة المرور الجديدة"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-500 mb-2">تأكيد كلمة المرور</label>
                                <input 
                                    type="password" 
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-sap-primary focus:bg-white"
                                    placeholder="أعد كتابة كلمة المرور"
                                />
                            </div>

                            {passError && (
                                <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg flex items-center gap-2">
                                    <AlertCircle size={16} /> {passError}
                                </div>
                            )}
                            
                            {passSuccess && (
                                <div className="p-3 bg-green-50 text-green-600 text-xs font-bold rounded-lg flex items-center gap-2">
                                    <CheckCircle2 size={16} /> {passSuccess}
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={handleChangePassword}
                            disabled={isPassSaving}
                            className="w-full mt-8 py-4 bg-gray-900 text-white rounded-xl font-black text-sm hover:bg-black transition-all flex items-center justify-center gap-2"
                        >
                            {isPassSaving ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
                            تحديث كلمة المرور
                        </button>
                    </div>

                    {/* Backup & Restore Section */}
                    <div className="bg-white rounded-[32px] border border-gray-200 p-8 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                        <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-3">
                            <Database className="text-blue-600" size={24} />
                            النسخ الاحتياطي والاستعادة
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={handleBackup}
                                className="flex flex-col items-center justify-center gap-3 p-6 bg-blue-50 border border-blue-100 rounded-2xl hover:bg-blue-100 transition-colors group"
                            >
                                <div className="p-3 bg-white rounded-full text-blue-600 shadow-sm group-hover:scale-110 transition-transform">
                                    <Download size={24} />
                                </div>
                                <span className="font-bold text-blue-800">تصدير نسخة احتياطية</span>
                            </button>

                            <div className="relative">
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    onChange={handleRestore}
                                    accept=".json"
                                    className="hidden"
                                    id="restore-upload"
                                />
                                <label 
                                    htmlFor="restore-upload"
                                    className="flex flex-col items-center justify-center gap-3 p-6 bg-purple-50 border border-purple-100 rounded-2xl hover:bg-purple-100 transition-colors group cursor-pointer h-full"
                                >
                                    <div className="p-3 bg-white rounded-full text-purple-600 shadow-sm group-hover:scale-110 transition-transform">
                                        <Upload size={24} />
                                    </div>
                                    <span className="font-bold text-purple-800">استعادة بيانات</span>
                                </label>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-4 text-center">
                            تنبيه: عملية الاستعادة ستقوم بدمج البيانات الجديدة مع الموجودة، وقد تستبدل البيانات المتطابقة.
                        </p>
                    </div>

                    {/* Danger Zone */}
                    <div className="bg-red-50 rounded-[32px] border border-red-100 p-8 shadow-sm relative overflow-hidden">
                        <h3 className="text-xl font-black text-red-800 mb-6 flex items-center gap-3">
                            <AlertCircle className="text-red-600" size={24} />
                            منطقة الخطر
                        </h3>
                        
                        <div className="space-y-4">
                            <button 
                                onClick={async () => {
                                    if (confirm('تحذير شديد: هل أنت متأكد من حذف جميع سجلات المبيعات؟ لا يمكن التراجع عن هذا الإجراء.')) {
                                        if (confirm('تأكيد نهائي: سيتم مسح كل تاريخ المبيعات. هل تريد الاستمرار؟')) {
                                            try {
                                                const sales = await db.dailySales.getAll();
                                                const ids = sales.map((s: any) => s.id);
                                                await db.dailySales.deleteMany(ids);
                                                alert('تم حذف سجلات المبيعات بنجاح.');
                                                window.location.reload();
                                            } catch (e) {
                                                alert('حدث خطأ أثناء الحذف');
                                            }
                                        }
                                    }
                                }}
                                className="w-full py-4 bg-white border border-red-200 text-red-600 rounded-xl font-black text-sm hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                                <Trash2 size={18} />
                                حذف جميع المبيعات
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
