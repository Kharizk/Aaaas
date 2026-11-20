
import React, { useState, useEffect, useRef } from 'react';
import { Save, Building2, Layout, CheckCircle2, ShieldCheck, Sparkles, Loader2, Lock, UserCog, AlertCircle, CalendarClock, Coins, Download, Upload, Database, Trash2, Palette } from 'lucide-react';
import { db } from '../services/supabase';
import { useSystemSettings } from './SystemSettingsContext';
import { useNotification, useConfirm } from './Notifications';
import { THEMES, AppTheme } from '../utils/themes';

export const Settings: React.FC = () => {
    const { settings, updateSettings, isLoading: isSettingsLoading } = useSystemSettings();
    const { notify } = useNotification();
    const confirm = useConfirm().confirm;
    const [orgName, setOrgName] = useState('');
    const [expiryAlertDays, setExpiryAlertDays] = useState(60);
    const [currencySymbolType, setCurrencySymbolType] = useState<'text' | 'icon' | 'custom_image'>('text');
    const [currencySymbolImage, setCurrencySymbolImage] = useState<string | null>(null);
    
    // New Settings
    const [taxRate, setTaxRate] = useState(15);
    const [taxNumber, setTaxNumber] = useState('');
    const [invoiceTerms, setInvoiceTerms] = useState('');
    const [receiptHeader, setReceiptHeader] = useState('');
    const [receiptFooter, setReceiptFooter] = useState('');
    const [receiptLogo, setReceiptLogo] = useState<string | null>(null);
    const [showLogoOnReceipt, setShowLogoOnReceipt] = useState(true);
    const [showHeaderOnReceipt, setShowHeaderOnReceipt] = useState(true);
    const [showFooterOnReceipt, setShowFooterOnReceipt] = useState(true);
    const [enableSoundEffects, setEnableSoundEffects] = useState(true);
    const [appTheme, setAppTheme] = useState('burgundy');
    const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<'cash' | 'card'>('cash');

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
            setTaxRate(settings.taxRate || 15);
            setTaxNumber(settings.taxNumber || '');
            setInvoiceTerms(settings.invoiceTerms || '');
            setReceiptHeader(settings.receiptHeader || '');
            setReceiptFooter(settings.receiptFooter || '');
            setReceiptLogo(settings.receiptLogo || null);
            setShowLogoOnReceipt(settings.showLogoOnReceipt ?? true);
            setShowHeaderOnReceipt(settings.showHeaderOnReceipt ?? true);
            setShowFooterOnReceipt(settings.showFooterOnReceipt ?? true);
            setEnableSoundEffects(settings.enableSoundEffects ?? true);
            setAppTheme(settings.appTheme || 'burgundy');
            setDefaultPaymentMethod(settings.defaultPaymentMethod || 'cash');
        }
    }, [settings, isSettingsLoading]);

    const handleSaveOrg = async () => {
        setIsSaving(true);
        try {
            await updateSettings({ 
                orgName, 
                expiryAlertDays: Number(expiryAlertDays),
                currencySymbolType,
                currencySymbolImage,
                taxRate: Number(taxRate),
                taxNumber,
                invoiceTerms,
                receiptHeader,
                receiptFooter,
                receiptLogo,
                showLogoOnReceipt,
                showHeaderOnReceipt,
                showFooterOnReceipt,
                enableSoundEffects,
                appTheme,
                defaultPaymentMethod
            });

            // Log Activity
            await db.activityLogs.add({
                action: 'تحديث الإعدادات',
                details: 'تم تحديث إعدادات النظام وتخصيص الإيصال',
                user: 'المدير',
                type: 'info'
            });

            setIsSaved(true);
            notify('تم حفظ إعدادات النظام بنجاح', 'success');
            setTimeout(() => setIsSaved(false), 2000);
            localStorage.setItem('print_org_name', orgName);
        } catch (error) {
            notify('حدث خطأ أثناء الحفظ سحابياً', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleBackup = async () => {
        try {
            const data = {
                products: await db.products.getAll(),
                customers: await db.customers.getAll(),
                suppliers: await db.suppliers.getAll(),
                purchaseOrders: await db.purchaseOrders.getAll(),
                supplierTransactions: await db.supplierTransactions.getAll(),
                sales: await db.dailySales.getAll(),
                expenses: await db.expenses.getAll(),
                settings: await db.settings.get(),
                units: await db.units.getAll(),
                branches: await db.branches.getAll(),
                users: await db.users.getAll(),
                shifts: await db.shifts.getAll(),
                timestamp: new Date().toISOString(),
                version: '2.5.0'
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
            
            notify('تم تحميل النسخة الاحتياطية بنجاح', 'success');
        } catch (e) {
            notify('فشل إنشاء النسخة الاحتياطية', 'error');
            console.error(e);
        }
    };

    const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const accepted = await confirm({
            title: 'استعادة نسخة احتياطية',
            message: 'تحذير: استعادة البيانات قد تؤدي إلى تكرار السجلات أو استبدال البيانات الحالية. هل أنت متأكد من المتابعة؟',
            confirmLabel: 'متابعة الاستعادة',
            variant: 'warning'
        });
        if (!accepted) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (!data.timestamp || !data.products) throw new Error('Invalid backup file');

                if (data.products) await Promise.all(data.products.map((p: any) => db.products.upsert(p)));
                if (data.customers) await Promise.all(data.customers.map((c: any) => db.customers.upsert(c)));
                if (data.suppliers) await Promise.all(data.suppliers.map((s: any) => db.suppliers.upsert(s)));
                if (data.purchaseOrders) await Promise.all(data.purchaseOrders.map((po: any) => db.purchaseOrders.upsert(po)));
                if (data.supplierTransactions) await Promise.all(data.supplierTransactions.map((st: any) => db.supplierTransactions.upsert(st)));
                if (data.sales) await Promise.all(data.sales.map((s: any) => db.dailySales.upsert(s)));
                if (data.expenses) await Promise.all(data.expenses.map((e: any) => db.expenses.upsert(e)));
                if (data.units) await Promise.all(data.units.map((u: any) => db.units.upsert(u)));
                if (data.branches) await Promise.all(data.branches.map((b: any) => db.branches.upsert(b)));
                if (data.users) await Promise.all(data.users.map((u: any) => db.users.upsert(u)));
                if (data.shifts) await Promise.all(data.shifts.map((s: any) => db.shifts.upsert(s)));
                if (data.settings) await updateSettings(data.settings);

                notify('تم استعادة البيانات بنجاح. يُفضّل إعادة تحميل التطبيق لتحديث كل القوائم.', 'success');
            } catch (err) {
                notify('فشل استعادة البيانات. تأكد من صلاحية الملف.', 'error');
                console.error(err);
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
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
            
            // Log Activity
            await db.activityLogs.add({
                action: 'تغيير كلمة المرور',
                details: 'تم تغيير كلمة مرور المدير العام',
                user: 'المدير',
                type: 'warning'
            });

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

    return (
        <div className="flex-1 bg-slate-50 dark:bg-slate-950 overflow-y-auto p-4 md:p-8 animate-in fade-in pb-20">
            <div className="max-w-4xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-center text-sap-primary">
                        <UserCog size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">إعدادات النظام</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">تخصيص المتجر، الضرائب، المظهر، وإدارة الأمان</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Main Settings Form */}
                    <div className="lg:col-span-2 space-y-6">
                        
                        {/* Organization Info */}
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-sap-primary/5 rounded-bl-[100px] -mr-10 -mt-10"></div>
                            
                            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-5 flex items-center gap-2.5 relative z-10">
                                <Building2 className="text-sap-primary" size={20} />
                                بيانات المؤسسة
                            </h3>

                            <div className="space-y-6 relative z-10">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-2">اسم المتجر / المؤسسة</label>
                                    <input 
                                        type="text" 
                                        value={orgName} 
                                        onChange={(e) => setOrgName(e.target.value)}
                                        className="w-full text-base font-bold p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-2xl focus:border-sap-primary focus:bg-white dark:focus:bg-slate-800 transition-colors"
                                        placeholder="أدخل اسم المتجر هنا..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-2">نوع العملة</label>
                                        <div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <button onClick={() => setCurrencySymbolType('text')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${currencySymbolType === 'text' ? 'bg-white dark:bg-slate-700 shadow-sm text-sap-primary dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'}`}>نص (SAR)</button>
                                            <button onClick={() => setCurrencySymbolType('icon')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${currencySymbolType === 'icon' ? 'bg-white dark:bg-slate-700 shadow-sm text-sap-primary dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'}`}>رمز ($)</button>
                                            <button onClick={() => setCurrencySymbolType('custom_image')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${currencySymbolType === 'custom_image' ? 'bg-white dark:bg-slate-700 shadow-sm text-sap-primary dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'}`}>صورة مخصصة</button>
                                        </div>
                                        {currencySymbolType === 'custom_image' && (
                                            <div className="mt-3 flex items-center gap-3">
                                                {currencySymbolImage && <img src={currencySymbolImage} alt="Currency" className="w-10 h-10 object-contain border border-slate-200 dark:border-slate-700 rounded-lg bg-white" />}
                                                <label className="cursor-pointer px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                                                    رفع صورة العملة
                                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onload = (re) => setCurrencySymbolImage(re.target?.result as string);
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }} />
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-2">تنبيه انتهاء الصلاحية (أيام)</label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                value={expiryAlertDays} 
                                                onChange={(e) => setExpiryAlertDays(Number(e.target.value))}
                                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-bold pl-12 focus:border-sap-primary"
                                            />
                                            <CalendarClock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                        </div>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">سيقوم النظام بإظهار تنبيه للمنتجات التي يتبقى على صلاحيتها أقل من هذه المدة.</p>
                                    </div>
                                </div>

                                <div className="space-y-4 border-t border-dashed border-slate-200 dark:border-slate-700 pt-6">
                                    <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">إعدادات الفاتورة والضريبة</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex items-center gap-4">
                                            <label className="text-sm font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">نسبة الضريبة (VAT)</label>
                                            <div className="flex items-center">
                                                <input 
                                                    type="number" 
                                                    value={taxRate} 
                                                    onChange={(e) => setTaxRate(Number(e.target.value))}
                                                    className="w-20 !text-lg !font-black !p-2 text-center bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                                                    min="0" max="100"
                                                />
                                                <span className="text-sm font-bold text-slate-500 dark:text-slate-400 mr-2">%</span>
                                            </div>
                                        </div>
                                        <div>
                                            <input 
                                                type="text" 
                                                value={taxNumber} 
                                                onChange={(e) => setTaxNumber(e.target.value)}
                                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-bold text-sm"
                                                placeholder="الرقم الضريبي (مثال: 300...)"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 border-t border-dashed border-slate-200 dark:border-slate-700 pt-6">
                                    <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">طريقة الدفع الافتراضية</label>
                                    <div className="flex gap-4">
                                        <button 
                                            onClick={() => setDefaultPaymentMethod('cash')}
                                            className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all ${defaultPaymentMethod === 'cash' ? 'bg-sap-primary text-white border-sap-primary' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                        >
                                            نقدي
                                        </button>
                                        <button 
                                            onClick={() => setDefaultPaymentMethod('card')}
                                            className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all ${defaultPaymentMethod === 'card' ? 'bg-sap-primary text-white border-sap-primary' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                        >
                                            شبكة / بطاقة
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4 border-t border-dashed border-slate-200 dark:border-slate-700 pt-6">
                                    <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">تخصيص الإيصال</label>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all">
                                            <input type="checkbox" checked={showLogoOnReceipt} onChange={e => setShowLogoOnReceipt(e.target.checked)} className="w-5 h-5 accent-sap-primary rounded-md"/>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">إظهار الشعار</span>
                                        </label>
                                        <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all">
                                            <input type="checkbox" checked={showHeaderOnReceipt} onChange={e => setShowHeaderOnReceipt(e.target.checked)} className="w-5 h-5 accent-sap-primary rounded-md"/>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">إظهار الترويسة</span>
                                        </label>
                                        <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all">
                                            <input type="checkbox" checked={showFooterOnReceipt} onChange={e => setShowFooterOnReceipt(e.target.checked)} className="w-5 h-5 accent-sap-primary rounded-md"/>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">إظهار التذييل</span>
                                        </label>
                                        <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all">
                                            <input type="checkbox" checked={enableSoundEffects} onChange={e => setEnableSoundEffects(e.target.checked)} className="w-5 h-5 accent-sap-primary rounded-md"/>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">تفعيل المؤثرات الصوتية</span>
                                        </label>
                                    </div>

                                    {showLogoOnReceipt && (
                                        <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                                            <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-2">شعار الإيصال</label>
                                            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 border-dashed">
                                                {receiptLogo ? (
                                                    <img src={receiptLogo} className="w-16 h-16 object-contain bg-white rounded-lg border border-slate-100 p-1" alt="Receipt Logo" />
                                                ) : (
                                                    <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 text-xs font-bold">لا يوجد</div>
                                                )}
                                                <div className="flex flex-col gap-2">
                                                    <label className="cursor-pointer bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-center">
                                                        رفع شعار
                                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                const reader = new FileReader();
                                                                reader.onload = (re) => setReceiptLogo(re.target?.result as string);
                                                                reader.readAsDataURL(file);
                                                            }
                                                        }} />
                                                    </label>
                                                    {receiptLogo && (
                                                        <button onClick={() => setReceiptLogo(null)} className="text-red-500 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/30 px-2 py-1 rounded transition-colors">حذف الشعار</button>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[150px]">يفضل استخدام صورة مربعة أو مستطيلة بخلفية شفافة (PNG)</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-4 border-t border-dashed border-slate-200 dark:border-slate-700 pt-6">
                                        <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                            <Palette size={16} /> ثيم وتصميم النظام
                                        </label>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {(Object.entries(THEMES) as [AppTheme, typeof THEMES[AppTheme]][]).map(([key, theme]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => setAppTheme(key)}
                                                    className={`p-4 rounded-2xl border-2 flex flex-col gap-3 transition-all ${appTheme === key ? 'border-sap-primary bg-sap-highlight/10 shadow-md transform scale-[1.02]' : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                                                >
                                                    <div className="flex gap-2 w-full justify-center">
                                                        <div className="w-10 h-10 rounded-full shadow-sm" style={{ backgroundColor: theme.colors['--sap-primary'] }}></div>
                                                        <div className="w-10 h-10 rounded-full shadow-sm" style={{ backgroundColor: theme.colors['--sap-secondary'] }}></div>
                                                    </div>
                                                    <span className={`text-xs font-bold text-center w-full ${appTheme === key ? 'text-sap-primary dark:text-sky-400' : 'text-slate-600 dark:text-slate-300'}`}>{theme.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <button 
                                        onClick={handleSaveOrg}
                                        disabled={isSaving}
                                        className={`w-full py-3.5 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2.5 active:scale-[0.99] shadow-md ${isSaved ? 'bg-emerald-600 text-white' : 'bg-sap-primary hover:bg-sap-primary-hover text-white'}`}
                                    >
                                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : (isSaved ? <CheckCircle2 size={18} /> : <Save size={18} />)}
                                        <span>{isSaved ? 'تم الحفظ بنجاح' : 'حفظ الإعدادات'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Account Settings & Backup */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col">
                            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2.5">
                                <UserCog className="text-sap-secondary" size={20} />
                                أمان الحساب (المدير)
                            </h3>

                            <div className="space-y-5 flex-1">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-2">كلمة المرور الحالية</label>
                                    <div className="relative">
                                        <input 
                                            type="password" 
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:border-sap-primary focus:bg-white dark:focus:bg-slate-800"
                                            placeholder="••••••"
                                        />
                                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-2">كلمة المرور الجديدة</label>
                                    <input 
                                        type="password" 
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:border-sap-primary focus:bg-white dark:focus:bg-slate-800"
                                        placeholder="أدخل كلمة المرور الجديدة"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-2">تأكيد كلمة المرور</label>
                                    <input 
                                        type="password" 
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:border-sap-primary focus:bg-white dark:focus:bg-slate-800"
                                        placeholder="أعد كتابة كلمة المرور"
                                    />
                                </div>

                                {passError && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg flex items-center gap-2">
                                        <AlertCircle size={16} /> {passError}
                                    </div>
                                )}
                                
                                {passSuccess && (
                                    <div className="p-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-bold rounded-lg flex items-center gap-2">
                                        <CheckCircle2 size={16} /> {passSuccess}
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={handleChangePassword}
                                disabled={isPassSaving}
                                className="w-full mt-8 py-3.5 bg-slate-900 dark:bg-slate-800 hover:bg-black dark:hover:bg-slate-700 text-white rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2"
                            >
                                {isPassSaving ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
                                تحديث كلمة المرور
                            </button>
                        </div>

                        {/* Backup & Restore Section */}
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 mb-5 flex items-center gap-2.5">
                                <Database className="text-blue-600" size={20} />
                                النسخ الاحتياطي والاستعادة
                            </h3>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={handleBackup}
                                    className="flex flex-col items-center justify-center gap-2.5 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-2xl hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors group"
                                >
                                    <div className="p-2.5 bg-white dark:bg-slate-800 rounded-full text-blue-600 shadow-sm group-hover:scale-105 transition-transform">
                                        <Download size={20} />
                                    </div>
                                    <span className="font-bold text-xs text-blue-800 dark:text-blue-300">تصدير نسخة احتياطية</span>
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
                                        className="flex flex-col items-center justify-center gap-2.5 p-4 bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/50 rounded-2xl hover:bg-violet-100 dark:hover:bg-violet-950/50 transition-colors group cursor-pointer h-full"
                                    >
                                        <div className="p-2.5 bg-white dark:bg-slate-800 rounded-full text-violet-600 shadow-sm group-hover:scale-105 transition-transform">
                                            <Upload size={20} />
                                        </div>
                                        <span className="font-bold text-xs text-violet-800 dark:text-violet-300">استعادة بيانات</span>
                                    </label>
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-3 text-center">
                                تنبيه: عملية الاستعادة تدمج البيانات الجديدة مع الموجودة وقد تستبدل المتطابقة.
                            </p>
                        </div>

                        {/* Danger Zone */}
                        <div className="bg-red-50 dark:bg-red-950/20 rounded-3xl border border-red-200/80 dark:border-red-900/50 p-6 shadow-sm relative overflow-hidden">
                            <h3 className="text-base font-black text-red-800 dark:text-red-300 mb-4 flex items-center gap-2.5">
                                <AlertCircle className="text-red-600" size={20} />
                                منطقة الخطر
                            </h3>
                            
                            <div className="space-y-3">
                                <button 
                                    onClick={async () => {
                                        const step1 = await confirm({
                                            title: 'حذف جميع سجلات المبيعات',
                                            message: 'تحذير شديد: هل أنت متأكد من حذف جميع سجلات المبيعات؟ لا يمكن التراجع عن هذا الإجراء.',
                                            confirmLabel: 'متابعة',
                                            variant: 'danger'
                                        });
                                        if (!step1) return;
                                        const step2 = await confirm({
                                            title: 'تأكيد نهائي قبل المسح',
                                            message: 'سيتم مسح كل تاريخ المبيعات بالكامل من قاعدة البيانات. هل تريد الاستمرار؟',
                                            confirmLabel: 'نعم، احذف السجلات',
                                            variant: 'danger'
                                        });
                                        if (!step2) return;
                                        try {
                                            const sales = await db.dailySales.getAll();
                                            const ids = sales.map((s: any) => s.id);
                                            await db.dailySales.deleteMany(ids);
                                            notify('تم حذف جميع سجلات المبيعات بنجاح', 'success');
                                        } catch (e) {
                                            notify('حدث خطأ أثناء حذف السجلات', 'error');
                                        }
                                    }}
                                    className="w-full py-3 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 rounded-xl font-black text-xs hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center gap-2 shadow-xs"
                                >
                                    <Trash2 size={16} />
                                    حذف جميع المبيعات
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
