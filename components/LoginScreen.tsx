
import React, { useState, useEffect } from 'react';
import { Lock, User, Key, Crown, ArrowRight, Loader2, ShieldCheck, Check, Fingerprint, AlertTriangle, Sparkles, X, ChevronDown, ChevronUp } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (username: string, pass: string) => Promise<boolean>;
  onGoogleLogin: () => Promise<{ success: boolean; error?: string; errorCode?: string } | boolean>;
  onDemoLogin?: (role?: 'admin' | 'user') => boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onGoogleLogin, onDemoLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfigAlert, setShowConfigAlert] = useState(false);
  const [showFirebaseInstructions, setShowFirebaseInstructions] = useState(false);

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

  const handleQuickAdminFill = () => {
    setUsername('admin');
    setPassword('admin123');
    setError('');
  };

  const handleQuickAdminLogin = async () => {
    setUsername('admin');
    setPassword('admin123');
    setLoading(true);
    setError('');
    setShowConfigAlert(false);
    const success = await onLogin('admin', 'admin123');
    if (!success && onDemoLogin) {
        onDemoLogin('admin');
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    setTimeout(async () => {
        const success = await onLogin(username, password);
        if (!success) {
            setError('بيانات الدخول غير صحيحة. يمكنك استخدام حساب المدير: admin / admin123');
            setLoading(false);
        } else {
            if (rememberMe) {
                localStorage.setItem('sf_saved_username', username);
                localStorage.setItem('sf_saved_password', password);
            } else {
                localStorage.removeItem('sf_saved_username');
                localStorage.removeItem('sf_saved_password');
            }
        }
    }, 400);
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
        const res = await onGoogleLogin();
        if (typeof res === 'object' && !res.success) {
            if (res.errorCode === 'auth/configuration-not-found' || res.error?.includes('auth/configuration-not-found')) {
                setShowConfigAlert(true);
            } else if (res.errorCode === 'auth/popup-closed-by-user') {
                setError('تم إلغاء نافذة تسجيل الدخول.');
            } else {
                setError(res.error || 'فشل تسجيل الدخول بواسطة جوجل');
            }
        } else if (res === false) {
            setShowConfigAlert(true);
        }
    } catch (err: any) {
        if (err?.code === 'auth/configuration-not-found' || err?.message?.includes('auth/configuration-not-found')) {
            setShowConfigAlert(true);
        } else {
            setError('حدث خطأ أثناء تسجيل الدخول');
        }
    } finally {
        setGoogleLoading(false);
    }
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

                    <button
                        type="button"
                        onClick={handleQuickAdminFill}
                        className="text-[11px] font-bold text-sap-primary hover:underline"
                    >
                        تعبئة المدير الافتراضي
                    </button>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-red-600 text-xs font-bold animate-in fade-in slide-in-from-top-1">
                        <div className="p-1 bg-red-100 rounded-full flex-shrink-0 mt-0.5"><Fingerprint size={14}/></div>
                        <span className="leading-tight">{error}</span>
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={loading || googleLoading}
                    className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-black text-sm hover:bg-black shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:translate-y-0"
                >
                    {loading ? <Loader2 size={18} className="animate-spin"/> : <>دخول للنظام <ArrowRight size={18} className="rotate-180" /></>}
                </button>
                
                <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-gray-200"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-bold">أو</span>
                    <div className="flex-grow border-t border-gray-200"></div>
                </div>

                <button 
                    type="button" 
                    onClick={handleGoogleLogin}
                    disabled={loading || googleLoading}
                    className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-black text-sm hover:bg-gray-50 shadow-sm transition-all flex items-center justify-center gap-3 disabled:opacity-70"
                >
                    {googleLoading ? <Loader2 size={18} className="animate-spin text-gray-500"/> : (
                        <>
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            تسجيل الدخول بواسطة جوجل
                        </>
                    )}
                </button>

                {onDemoLogin && (
                    <div className="text-center pt-1">
                        <button
                            type="button"
                            onClick={() => onDemoLogin('admin')}
                            className="text-xs text-gray-500 hover:text-sap-primary flex items-center justify-center gap-1.5 mx-auto font-bold transition-colors"
                        >
                            <Sparkles size={13} className="text-amber-500"/>
                            دخول تجريبي مباشر (Demo Mode)
                        </button>
                    </div>
                )}
            </form>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 text-center border-t border-gray-100 flex items-center justify-between px-6">
            <p className="text-[11px] text-gray-500 font-mono font-bold">Admin: admin / admin123</p>
            <button 
                type="button" 
                onClick={handleQuickAdminFill}
                className="text-[11px] text-sap-primary font-bold hover:underline"
            >
                استخدام
            </button>
        </div>
      </div>

      {/* Firebase Configuration Modal */}
      {showConfigAlert && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 relative">
                  <button 
                      onClick={() => setShowConfigAlert(false)}
                      className="absolute top-4 left-4 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                      <X size={20} />
                  </button>

                  <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle size={24} />
                      </div>
                      <div>
                          <h3 className="font-black text-gray-900 text-base">تنبيه موفّر تسجيل الدخول (Firebase Auth)</h3>
                          <p className="text-xs text-gray-500 font-mono font-bold">auth/configuration-not-found</p>
                      </div>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed mb-4">
                      لم يتم تفعيل موفّر تسجيل الدخول بواسطة <strong>Google</strong> في لوحة تحكم <strong>Firebase Console</strong> لمشروعك الحالي (<code className="bg-gray-100 px-1 py-0.5 rounded text-[11px] text-gray-800 font-mono">sales-495ee</code>).
                  </p>

                  <div className="space-y-2.5 mb-5">
                      <button
                          type="button"
                          onClick={handleQuickAdminLogin}
                          className="w-full py-3 px-4 bg-sap-primary text-white rounded-xl font-bold text-xs hover:bg-sap-primary-hover flex items-center justify-center gap-2 shadow-md transition-all"
                      >
                          <ShieldCheck size={16} />
                          الدخول المباشر بحساب المدير العام (admin / admin123)
                      </button>

                      {onDemoLogin && (
                          <button
                              type="button"
                              onClick={() => { setShowConfigAlert(false); onDemoLogin('admin'); }}
                              className="w-full py-2.5 px-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs hover:bg-emerald-100 flex items-center justify-center gap-2 transition-all"
                          >
                              <Sparkles size={16} className="text-emerald-600" />
                              الدخول التجريبي الفوري بنقرة واحدة (Demo Mode)
                          </button>
                      )}

                      <button
                          type="button"
                          onClick={() => setShowFirebaseInstructions(!showFirebaseInstructions)}
                          className="w-full py-2.5 px-4 bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-bold text-xs hover:bg-gray-100 flex items-center justify-between transition-all"
                      >
                          <span>خطوات تفعيل Google Provider في Firebase Console</span>
                          {showFirebaseInstructions ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                      </button>
                  </div>

                  {showFirebaseInstructions && (
                      <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 text-xs text-gray-700 space-y-2 mb-4 leading-relaxed animate-in fade-in">
                          <p className="font-bold text-gray-800">لتفعيل موفّر Google في Firebase Console:</p>
                          <ol className="list-decimal list-inside space-y-1 text-gray-600 text-[11px] pr-2">
                              <li>افتح لوحة تحكم <strong>Firebase Console</strong> للمشروع <strong>sales-495ee</strong>.</li>
                              <li>انتقل إلى قسم <strong>Authentication</strong> ثم تبويب <strong>Sign-in method</strong>.</li>
                              <li>اضغط على موفر <strong>Google</strong>، وفعل خيار <strong>Enable</strong>.</li>
                              <li>اختر البريد الإلكتروني المعتمد للدعم واضغط <strong>Save</strong>.</li>
                          </ol>
                      </div>
                  )}

                  <div className="flex justify-end">
                      <button
                          type="button"
                          onClick={() => setShowConfigAlert(false)}
                          className="px-5 py-2 text-xs font-bold text-gray-500 hover:text-gray-800"
                      >
                          إغلاق
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
