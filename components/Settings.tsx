
import React, { useState, useEffect } from 'react';
import { Save, Building2, Layout, CheckCircle2, ShieldCheck, Sparkles, Loader2, Lock, UserCog, AlertCircle, CalendarClock } from 'lucide-react';
import { db } from '../services/supabase';

export const Settings: React.FC = () => {
    const [orgName, setOrgName] = useState('');
    const [expiryAlertDays, setExpiryAlertDays] = useState(60); // Default 60 days
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaved, setIsSaved] = useState(false);

    // Password State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passError, setPassError] = useState('');
    const [passSuccess, setPassSuccess] = useState('');
    const [isPassSaving, setIsPassSaving] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settings = await db.settings.get();
                setOrgName(settings.orgName || 'مؤسسة إدارة المتجر');
                setExpiryAlertDays(settings.expiryAlertDays || 60);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        loadSettings();
    }, []);

    const handleSaveOrg = async () => {
        setIsSaving(true);
        try {
            await db.settings.upsert({ orgName, expiryAlertDays: Number(expiryAlertDays) });
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

    if (isLoading) {
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

                {/* Account Settings */}
                <div className="space-y-8">
                    <div className="bg-white rounded-[32px] border border-gray-200 p-8 shadow-sm h-full flex flex-col">
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
                </div>
            </div>
        </div>
    );
};
