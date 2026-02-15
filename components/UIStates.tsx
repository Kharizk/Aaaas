
import React from 'react';
import { Box, Search, PackageOpen } from 'lucide-react';

export const LoadingSkeleton = ({ count = 5, type = 'row' }: { count?: number, type?: 'row' | 'card' }) => {
  if (type === 'card') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
            <div className="h-32 bg-gray-100 rounded-xl w-full"></div>
            <div className="h-4 bg-gray-100 rounded w-3/4"></div>
            <div className="h-3 bg-gray-100 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-16 bg-white border border-gray-100 rounded-xl w-full"></div>
      ))}
    </div>
  );
};

export const EmptyState = ({ 
  title, 
  subtitle, 
  icon: Icon = PackageOpen, 
  action 
}: { 
  title: string, 
  subtitle: string, 
  icon?: any, 
  action?: React.ReactNode 
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center h-full min-h-[300px] bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-200">
      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
        <Icon size={40} className="text-gray-300" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-black text-gray-800 mb-1">{title}</h3>
      <p className="text-sm text-gray-400 font-bold max-w-xs mx-auto mb-6">{subtitle}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
