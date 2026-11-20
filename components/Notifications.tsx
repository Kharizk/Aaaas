
import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastMessage } from '../types';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

interface NotificationContextType {
  notify: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within a NotificationProvider');
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const playSound = useCallback((type: 'success' | 'error' | 'info' | 'warning') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const playTone = (freq: number, duration: number, startTime: number, typeOsc: 'sine' | 'triangle' = 'sine') => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.type = typeOsc;
        osc.frequency.setValueAtTime(freq, startTime);
        
        gainNode.gain.setValueAtTime(0.04, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      if (type === 'success') {
        playTone(523.25, 0.15, now); // C5
        playTone(659.25, 0.3, now + 0.08); // E5
      } else if (type === 'error') {
        playTone(220, 0.25, now, 'triangle'); // A3
        playTone(207.65, 0.3, now + 0.05, 'triangle'); // G#3
      } else if (type === 'warning') {
        playTone(440, 0.15, now); // A4
        playTone(440, 0.15, now + 0.15); // A4
      } else {
        playTone(392, 0.2, now); // G4
      }
      window.setTimeout(() => {
        ctx.close().catch(() => {});
      }, 600);
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  }, []);

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    playSound(type);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, [playSound]);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-16 left-4 z-[9999] flex flex-col gap-2 pointer-events-none" dir="rtl">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`pointer-events-auto min-w-[290px] max-w-sm p-3.5 rounded-xl shadow-2xl border flex items-start gap-3 animate-in slide-in-from-left-5 fade-in duration-300 bg-white dark:bg-slate-900 ${
              toast.type === 'success' ? 'border-emerald-500/60 text-emerald-700 dark:text-emerald-300' :
              toast.type === 'error' ? 'border-red-500/60 text-red-700 dark:text-red-300' :
              toast.type === 'warning' ? 'border-amber-500/60 text-amber-700 dark:text-amber-300' :
              'border-blue-500/60 text-blue-700 dark:text-blue-300'
            }`}
          >
            <div className={`p-1 rounded-full shrink-0 ${
               toast.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-950/60' :
               toast.type === 'error' ? 'bg-red-100 dark:bg-red-950/60' :
               toast.type === 'warning' ? 'bg-amber-100 dark:bg-amber-950/60' : 'bg-blue-100 dark:bg-blue-950/60'
            }`}>
              {toast.type === 'success' && <CheckCircle size={17} />}
              {toast.type === 'error' && <AlertCircle size={17} />}
              {toast.type === 'warning' && <AlertTriangle size={17} />}
              {toast.type === 'info' && <Info size={17} />}
            </div>
            <div className="flex-1 pt-0.5 text-xs font-bold leading-relaxed">{toast.message}</div>
            <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5" aria-label="إغلاق">
              <X size={15}/>
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
