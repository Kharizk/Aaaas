import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { ToastMessage } from '../types';
import { useSystemSettings } from './SystemSettingsContext';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, HelpCircle } from 'lucide-react';

interface NotificationContextType {
  notify: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);
const ConfirmContext = createContext<ConfirmContextType | null>(null);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within a NotificationProvider');
  return context;
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within a NotificationProvider');
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useSystemSettings();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<
    (ConfirmOptions & { id: string }) | null
  >(null);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  const playSound = useCallback(
    (type: 'success' | 'error' | 'info' | 'warning') => {
      if (settings.enableSoundEffects === false) return;
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        const playTone = (
          freq: number,
          duration: number,
          startTime: number,
          typeOsc: 'sine' | 'triangle' = 'sine'
        ) => {
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
          playTone(523.25, 0.15, now);
          playTone(659.25, 0.3, now + 0.08);
        } else if (type === 'error') {
          playTone(220, 0.25, now, 'triangle');
          playTone(207.65, 0.3, now + 0.05, 'triangle');
        } else if (type === 'warning') {
          playTone(440, 0.15, now);
          playTone(440, 0.15, now + 0.15);
        } else {
          playTone(392, 0.2, now);
        }
        window.setTimeout(() => {
          ctx.close().catch(() => {});
        }, 600);
      } catch (e) {
        console.warn('Audio feedback failed:', e);
      }
    },
    [settings.enableSoundEffects]
  );

  const notify = useCallback(
    (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
      const id = crypto.randomUUID();
      setToasts(prev => [...prev.slice(-4), { id, message, type }]);
      playSound(type);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
    },
    [playSound]
  );

  const resolveConfirm = useCallback((result: boolean) => {
    setConfirmDialog(null);
    if (confirmResolverRef.current) {
      confirmResolverRef.current(result);
      confirmResolverRef.current = null;
    }
  }, []);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const normalized: ConfirmOptions =
      typeof options === 'string'
        ? { title: 'تأكيد الإجراء', message: options, variant: 'warning' }
        : options;

    if (confirmResolverRef.current) {
      confirmResolverRef.current(false);
    }

    return new Promise<boolean>(resolve => {
      confirmResolverRef.current = resolve;
      setConfirmDialog({
        id: crypto.randomUUID(),
        title: normalized.title || 'تأكيد الإجراء',
        message: normalized.message,
        confirmLabel: normalized.confirmLabel || 'تأكيد',
        cancelLabel: normalized.cancelLabel || 'إلغاء',
        variant: normalized.variant || 'warning',
      });
    });
  }, []);

  useEffect(() => {
    if (!confirmDialog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        resolveConfirm(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDialog, resolveConfirm]);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notify }}>
      <ConfirmContext.Provider value={{ confirm }}>
        {children}

        {/* Toast Stack */}
        <div
          className="fixed bottom-16 left-4 z-[9999] flex flex-col gap-2 pointer-events-none print:hidden"
          dir="rtl"
        >
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`pointer-events-auto min-w-[290px] max-w-sm p-3.5 rounded-xl shadow-2xl border flex items-start gap-3 animate-in slide-in-from-left-5 fade-in duration-200 bg-white/95 dark:bg-[#242424]/95 backdrop-blur-xl ${
                toast.type === 'success'
                  ? 'border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                  : toast.type === 'error'
                  ? 'border-red-500/50 text-red-700 dark:text-red-300'
                  : toast.type === 'warning'
                  ? 'border-amber-500/50 text-amber-700 dark:text-amber-300'
                  : 'border-blue-500/50 text-blue-700 dark:text-blue-300'
              }`}
            >
              <div
                className={`p-1 rounded-full shrink-0 ${
                  toast.type === 'success'
                    ? 'bg-emerald-100 dark:bg-emerald-950/60'
                    : toast.type === 'error'
                    ? 'bg-red-100 dark:bg-red-950/60'
                    : toast.type === 'warning'
                    ? 'bg-amber-100 dark:bg-amber-950/60'
                    : 'bg-blue-100 dark:bg-blue-950/60'
                }`}
              >
                {toast.type === 'success' && <CheckCircle size={17} />}
                {toast.type === 'error' && <AlertCircle size={17} />}
                {toast.type === 'warning' && <AlertTriangle size={17} />}
                {toast.type === 'info' && <Info size={17} />}
              </div>
              <div className="flex-1 pt-0.5 text-xs font-bold leading-relaxed text-slate-800 dark:text-slate-100">
                {toast.message}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                aria-label="إغلاق"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>

        {/* Global Fluent Confirmation Modal */}
        {confirmDialog && (
          <div
            className="fixed inset-0 z-[10000] bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 print:hidden"
            dir="rtl"
            onClick={() => resolveConfirm(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-[#202020] border border-slate-200 dark:border-white/12 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            >
              <div className="p-6 flex items-start gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    confirmDialog.variant === 'danger'
                      ? 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                      : confirmDialog.variant === 'primary'
                      ? 'bg-blue-50 dark:bg-blue-950/50 text-sap-primary'
                      : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {confirmDialog.variant === 'danger' ? (
                    <AlertTriangle size={20} />
                  ) : confirmDialog.variant === 'primary' ? (
                    <HelpCircle size={20} />
                  ) : (
                    <AlertCircle size={20} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                    {confirmDialog.title}
                  </h3>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed whitespace-pre-line">
                    {confirmDialog.message}
                  </p>
                </div>
              </div>

              <div className="px-6 py-3.5 bg-slate-50 dark:bg-white/[0.03] border-t border-slate-200/80 dark:border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => resolveConfirm(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/12 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                >
                  {confirmDialog.cancelLabel}
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => resolveConfirm(true)}
                  className={`px-5 py-2 rounded-xl text-xs font-black text-white transition-colors whitespace-nowrap shadow-xs ${
                    confirmDialog.variant === 'danger'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-sap-primary hover:bg-sap-primary-hover'
                  }`}
                >
                  {confirmDialog.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </ConfirmContext.Provider>
    </NotificationContext.Provider>
  );
};
