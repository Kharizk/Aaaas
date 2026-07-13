
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
    }, 4000); // Auto close after 4s
  }, [playSound]);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 left-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`pointer-events-auto min-w-[300px] max-w-sm p-4 rounded-xl shadow-2xl border flex items-start gap-3 animate-in slide-in-from-left-5 fade-in duration-300 ${
              toast.type === 'success' ? 'bg-white border-green-500 text-green-700' :
              toast.type === 'error' ? 'bg-white border-red-500 text-red-700' :
              toast.type === 'warning' ? 'bg-white border-amber-500 text-amber-700' :
              'bg-white border-blue-500 text-blue-700'
            }`}
          >
            <div className={`p-1 rounded-full shrink-0 ${
               toast.type === 'success' ? 'bg-green-100' :
               toast.type === 'error' ? 'bg-red-100' :
               toast.type === 'warning' ? 'bg-amber-100' : 'bg-blue-100'
            }`}>
              {toast.type === 'success' && <CheckCircle size={18} />}
              {toast.type === 'error' && <AlertCircle size={18} />}
              {toast.type === 'warning' && <AlertTriangle size={18} />}
              {toast.type === 'info' && <Info size={18} />}
            </div>
            <div className="flex-1 pt-0.5 text-sm font-bold">{toast.message}</div>
            <button onClick={() => removeToast(toast.id)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
