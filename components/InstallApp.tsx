
import React, { useEffect, useState } from 'react';
import { Download, Monitor, Smartphone, X } from 'lucide-react';

export const InstallApp: React.FC<{ sidebarOpen: boolean }> = ({ sidebarOpen }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showButton, setShowButton] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check for iOS
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowButton(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // If app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowButton(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowButton(false);
    }
    setDeferredPrompt(null);
  };

  if (!showButton && !isIOS) return null;

  // iOS Instructions (Since iOS doesn't support beforeinstallprompt)
  if (isIOS && !window.matchMedia('(display-mode: standalone)').matches) {
      return (
        <div className={`mx-3 mb-4 p-3 bg-sap-shell text-white rounded-lg text-[10px] relative ${!sidebarOpen && 'hidden'}`}>
            <p className="font-bold mb-1 flex items-center gap-2"><Smartphone size={14}/> تثبيت التطبيق على آيفون</p>
            <p className="opacity-80 leading-relaxed">اضغط على زر <span className="font-black">مشاركة</span> في متصفح سفاري ثم اختر <span className="font-black">إضافة إلى الصفحة الرئيسية</span>.</p>
        </div>
      );
  }

  if (!showButton) return null;

  return (
    <button
      onClick={handleInstallClick}
      className={`mx-3 mb-2 flex items-center gap-3 px-3 py-2.5 bg-gradient-to-r from-sap-secondary to-yellow-600 text-white rounded-lg shadow-lg hover:shadow-xl transition-all group overflow-hidden relative ${!sidebarOpen ? 'justify-center px-0 w-10 h-10 mx-auto' : ''}`}
      title="تثبيت التطبيق على الجهاز"
    >
      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
      <Download size={18} className="relative z-10 animate-bounce" />
      {sidebarOpen && (
        <div className="text-right relative z-10">
            <div className="text-[10px] font-black uppercase">تثبيت التطبيق</div>
            <div className="text-[8px] opacity-90 font-bold">للكمبيوتر والجوال</div>
        </div>
      )}
    </button>
  );
};
