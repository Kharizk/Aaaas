
import React, { useState, useEffect } from 'react';
import { Lock, User, Key, Crown, ArrowRight, Loader2, ShieldCheck, Check, Fingerprint } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (username: string, pass: string) => Promise<boolean>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // استرجاع البيانات المحفوظة عند تحميل الصفحة
  useEffect(() => {
    const savedUser = localStorage.getItem('sf_saved_username');
    const savedPass = localStorage.getItem('sf_saved_password');
    if (savedUser && savedPass) {
        setUsername(savedUser);
        setPassword(savedPass);
        setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Simulate network delay for effect
    setTimeout(async () => {
        const success = await onLogin(username, password);
        if (!success) {
            setError('بيانات الدخول غير صحيحة');
            setLoading(false);
        } else {
            // حفظ البيانات إذا تم تفعيل "تذكرني" عند نجاح الدخول
            if (rememberMe) {
                localStorage.setItem('sf_saved_username', username);
                localStorage.setItem('sf_saved_password', password);
            } else {
                localStorage.removeItem('sf_saved_username');
                localStorage.removeItem('sf_saved_password');
            }
        }
    }, 800);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8FAFC] p-4 font-sans relative overflow-hidden" dir="rtl">
      
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-sap-primary/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-sap-secondary/5 rounded-full blur-3xl"></div>

      <div className="bg-white w-full max-w-[400px] rounded-[32px] shadow-2xl overflow-hidden border border-white/50 backdrop-blur-xl relative z-10">
        
        {/* Header */}
        <div className="pt-12 pb-6 px-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-sap-primary to-emerald-700 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-sap-primary/30 mb-6 rotate-3 hover:rotate-0 transition-all duration-500">
                <Crown size={40} className="text-sap-secondary drop-shadow-md" fill="currentColor" />
            </div>
            <h1 className="text-3xl font-black text-gray-800 tracking-tight">StoreFlow</h1>
        </div>

        {/* Form */}
        <div className="p-8 pt-2">
            <div className="mb-8 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full border border-gray-100">
                    <ShieldCheck size={14} className="text-sap-primary"/>
                    <span className="text-[10px] font-black text-gray-500">بوابة الدخول الآمن</span>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                    <label className="text-xs font-black text-gray-600 mr-1 block">المعرف الوظيفي</label>
                    <div className="relative group">
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-sap-primary transition-colors">
                            <User size={18} />
                        </div>
                        <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full pr-10 pl-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-sap-primary focus:bg-white focus:shadow-[0_0_0_4px_rgba(0,108,53,0.1)] transition-all font-bold text-sm text-left placeholder:text-gray-300"
                            placeholder="username"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-black text-gray-600 mr-1 block">رمز المرور</label>
                    <div className="relative group">
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-sap-primary transition-colors">
                            <Lock size={18} />
                        </div>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pr-10 pl-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-sap-primary focus:bg-white focus:shadow-[0_0_0_4px_rgba(0,108,53,0.1)] transition-all font-bold text-sm text-left placeholder:text-gray-300"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between px-1">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className="relative flex items-center">
                            <input 
                                type="checkbox" 
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-gray-300 bg-white transition-all checked:border-sap-primary checked:bg-sap-primary"
                            />
                            <Check size={10} strokeWidth={4} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100" />
                        </div>
                        <span className="text-[11px] font-bold text-gray-500 group-hover:text-gray-700 transition-colors">حفظ البيانات</span>
                    </label>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-xs font-bold animate-in fade-in slide-in-from-top-1">
                        <div className="p-1 bg-red-100 rounded-full"><Fingerprint size={14}/></div>
                        {error}
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-4 bg-gray-900 text-white rounded-xl font-black text-sm hover:bg-black shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:translate-y-0"
                >
                    {loading ? <Loader2 size={18} className="animate-spin"/> : <>دخول للنظام <ArrowRight size={18} className="rotate-180" /></>}
                </button>
            </form>
        </div>

        {/* Footer */}
        <div className="p-5 bg-gray-50 text-center border-t border-gray-100">
            <p className="text-[10px] text-gray-400 font-mono font-bold">Secure System v2.5.0</p>
        </div>
      </div>
    </div>
  );
};
