import React from 'react';
import { Command, X, Keyboard } from 'lucide-react';
import { KeyboardShortcut } from '../types';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts: KeyboardShortcut[] = [
    { keys: ['Alt', '1-9'], description: 'التنقل بين التطبيقات المفتوحة' },
    { keys: ['Alt', 'W'], description: 'إغلاق التطبيق الحالي' },
    { keys: ['Ctrl', 'K'], description: 'فتح البحث السريع' },
    { keys: ['Esc'], description: 'إغلاق النوافذ المنبثقة' },
    { keys: ['Enter'], description: 'تأكيد / حفظ' },
    { keys: ['F11'], description: 'ملء الشاشة' },
  ];

  return (
    <div className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900">
          <h3 className="font-bold text-lg flex items-center gap-2 text-gray-800 dark:text-white">
            <Keyboard size={20} className="text-sap-primary" /> اختصارات لوحة المفاتيح
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors text-gray-500">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex justify-between items-center p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors border border-transparent hover:border-gray-100 dark:hover:border-slate-700">
              <span className="text-gray-600 dark:text-gray-300 font-bold text-sm">{s.description}</span>
              <div className="flex gap-1" dir="ltr">
                {s.keys.map((k, j) => (
                  <kbd key={j} className="px-2.5 py-1 bg-gray-100 dark:bg-slate-800 border-b-2 border-gray-300 dark:border-slate-600 rounded-lg text-xs font-mono font-black text-gray-700 dark:text-gray-200 min-w-[32px] text-center shadow-sm">
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 bg-gray-50 dark:bg-slate-900 text-center text-[10px] text-gray-400 font-bold border-t border-gray-100 dark:border-slate-800">
            StoreFlow Shortcuts v1.0
        </div>
      </div>
    </div>
  );
};
