
import React, { useState } from 'react';
import { User, ActivityLog } from '../types';
import { db } from '../services/supabase';
import { 
  User as UserIcon, Lock, Save, Loader2, ShieldCheck, 
  Building, CheckCircle2, AlertCircle, History
} from 'lucide-react';

interface UserProfileProps {
  user: User;
  onUpdate: (updatedUser: User) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, onUpdate }) => {
  const [fullName, setFullName] = useState(user.fullName);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpdateProfile = async () => {
    setMessage(null);
    setIsSaving(true);
    try {
        await db.auth.updateProfile(user.id, { fullName });
        onUpdate({ ...user, fullName });
        
        await db.logs.add({
            userId: user.id,
            username: user.username,
            action: 'UPDATE_PROFILE',
            details: 'تحديث المعلومات الشخصية'
        });

        setMessage({ type: 'success', text: 'تم تحديث البيانات بنجاح' });
    } catch (e) {
        setMessage({ type: 'error', text: 'حدث خطأ أثناء التحديث' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setMessage(null);
    if (!newPassword || !confirmPassword) {
        setMessage({ type: 'error', text: 'يرجى إدخال كلمة المرور الجديدة' });
        return;
    }
    if (newPassword !== confirmPassword) {
        setMessage({ type: 'error', text: 'كلمات المرور غير متطابقة' });
        return;
    }
    if (newPassword.length < 6) {
        setMessage({ type: 'error', text: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
        return;
    }

    setIsSaving(true);
    try {
        // In a real app, verify currentPassword with backend. 
        // Here we proceed assuming current session is valid.
        await db.auth.updateUserPassword(user.id, newPassword);
        
        await db.logs.add({
            userId: user.id,
            username: user.username,
            action: 'CHANGE_PASSWORD',
            details: 'تغيير كلمة المرور'
        });

        setMessage({ type: 'success', text: 'تم تغيير كلمة المرور بنجاح' });
        setNewPassword('');
        setConfirmPassword('');
        setCurrentPassword('');
    } catch (e) {
        setMessage({ type: 'error', text: 'فشل تغيير كلمة المرور' });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex flex-col gap-4 bg-white p-6 rounded-sap-m border border-sap-border shadow-sm">
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-sap-primary text-white rounded-full flex items-center justify-center shadow-lg">
                    <UserIcon size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-sap-text">{user.fullName}</h1>
                    <p className="text-sm text-sap-text-variant font-bold flex items-center gap-2">
                        @{user.username} 
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] uppercase border border-gray-200">
                            {user.role === 'admin' ? 'مدير عام' : 'مستخدم'}
                        </span>
                    </p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Info */}
            <div className="bg-white border border-sap-border rounded-sap-m p-6 shadow-sm">
                <h3 className="font-black text-lg mb-6 flex items-center gap-2 text-sap-primary">
                    <ShieldCheck size={20} /> البيانات الأساسية
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-black text-gray-500 mb-1">الاسم الكامل</label>
                        <input 
                            type="text" 
                            value={fullName} 
                            onChange={(e) => setFullName(e.target.value)} 
                            className="w-full p-3 border border-gray-300 rounded font-bold"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-500 mb-1">معرف الفرع المرتبط</label>
                        <div className="w-full p-3 bg-gray-50 border border-gray-200 rounded font-mono text-xs text-gray-500 flex items-center gap-2">
                            <Building size={14} />
                            {user.branchId || 'غير مقيد بفرع (صلاحية كاملة)'}
                        </div>
                    </div>
                    <button 
                        onClick={handleUpdateProfile} 
                        disabled={isSaving}
                        className="w-full py-3 bg-sap-primary text-white rounded font-black text-xs hover:bg-sap-primary-hover flex items-center justify-center gap-2 shadow-md"
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} حفظ البيانات
                    </button>
                </div>
            </div>

            {/* Security */}
            <div className="bg-white border border-sap-border rounded-sap-m p-6 shadow-sm">
                <h3 className="font-black text-lg mb-6 flex items-center gap-2 text-sap-secondary">
                    <Lock size={20} /> الأمان وكلمة المرور
                </h3>
                <div className="space-y-4">
                    {/* Only ask for current password visually, logic handled simply here */}
                    <div>
                        <label className="block text-xs font-black text-gray-500 mb-1">كلمة المرور الجديدة</label>
                        <input 
                            type="password" 
                            value={newPassword} 
                            onChange={(e) => setNewPassword(e.target.value)} 
                            className="w-full p-3 border border-gray-300 rounded font-bold"
                            placeholder="••••••"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-500 mb-1">تأكيد كلمة المرور</label>
                        <input 
                            type="password" 
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                            className="w-full p-3 border border-gray-300 rounded font-bold"
                            placeholder="••••••"
                        />
                    </div>
                    <button 
                        onClick={handleChangePassword} 
                        disabled={isSaving}
                        className="w-full py-3 bg-gray-800 text-white rounded font-black text-xs hover:bg-black flex items-center justify-center gap-2 shadow-md"
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} تغيير كلمة المرور
                    </button>
                </div>
            </div>
        </div>

        {message && (
            <div className={`p-4 rounded-sap-m flex items-center gap-2 font-bold text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                {message.text}
            </div>
        )}
    </div>
  );
};
