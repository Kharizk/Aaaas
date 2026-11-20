import React from 'react';
import { PackageOpen } from 'lucide-react';

export const LoadingSkeleton = ({
  count = 5,
  type = 'row',
}: {
  count?: number;
  type?: 'row' | 'card';
}) => {
  if (type === 'card') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 space-y-3"
          >
            <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl w-full" />
            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-16 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-xl w-full"
        />
      ))}
    </div>
  );
};

export const EmptyState = ({
  title,
  subtitle,
  icon: Icon = PackageOpen,
  action,
}: {
  title: string;
  subtitle: string;
  icon?: any;
  action?: React.ReactNode;
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center h-full min-h-[300px] bg-slate-50/70 dark:bg-slate-900/40 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
      <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700 mb-4">
        <Icon size={32} className="text-slate-400 dark:text-slate-500" strokeWidth={1.6} />
      </div>
      <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto mb-5 leading-relaxed">
        {subtitle}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
};
