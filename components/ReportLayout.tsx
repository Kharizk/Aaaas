
import React, { useState, useEffect } from 'react';
import { Award, ShieldCheck, Globe, Calendar, Clock, FileText } from 'lucide-react';
import { db } from '../services/supabase';

interface ReportLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showSignatures?: boolean;
  showHeader?: boolean;
  orientation?: 'portrait' | 'landscape';
  branchName?: string;
  dateRange?: string;
}

export const ReportLayout: React.FC<ReportLayoutProps> = ({ 
  title, 
  subtitle,
  children,
  showSignatures = true,
  showHeader = true,
  orientation = 'portrait',
  branchName,
  dateRange
}) => {
  const [orgName, setOrgName] = useState(localStorage.getItem('print_org_name') || 'مؤسسة المدير برو التجارية');
  
  const currentDate = new Date().toLocaleDateString('ar-SA');
  const currentTime = new Date().toLocaleTimeString('ar-SA');

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const settings = await db.settings.get();
        if (settings?.orgName) setOrgName(settings.orgName);
      } catch (e) { console.error(e); }
    };
    fetchOrg();
  }, []);

  return (
    <div className="report-container bg-white p-12 print:p-0 print:m-0 overflow-visible relative text-right font-sans" dir="rtl">
      
      {showHeader && (
        <div className="report-header mb-10 print:mb-6">
          {/* Top Gold Bar */}
          <div className="h-2 w-full bg-sap-secondary mb-6 print:mb-4"></div>

          <div className="flex justify-between items-start pb-6 border-b-2 border-gray-100">
            {/* Right Side: Org Info */}
            <div className="space-y-2">
              <h1 className="text-3xl print:text-2xl font-black text-sap-shell leading-tight">{orgName}</h1>
              <p className="text-sm print:text-[10px] font-bold text-sap-secondary uppercase tracking-[2px]">Enterprise Resource Planning</p>
              <div className="flex items-center gap-2 mt-2 text-[10px] font-medium text-gray-500">
                  <Globe size={12}/>
                  <span>نظام الإدارة الموحد</span>
              </div>
            </div>
            
            {/* Center: Logo Placeholder (Optional) */}
            <div className="hidden print:block absolute left-1/2 -translate-x-1/2 top-10 opacity-10">
                 <div className="text-6xl font-black text-sap-shell">SF</div>
            </div>

            {/* Left Side: Document Meta */}
            <div className="text-left space-y-2">
              <div className="bg-sap-highlight px-4 py-2 rounded-lg border border-sap-primary/10">
                  <div className="text-[10px] font-black text-sap-primary uppercase tracking-widest mb-1">وثيقة رسمية</div>
                  <div className="text-[12px] font-bold text-gray-800 font-mono">{crypto.randomUUID().slice(0,8).toUpperCase()}</div>
              </div>
              <div className="text-[10px] text-gray-500 font-medium flex flex-col items-end">
                 <span>{currentDate}</span>
                 <span>{currentTime}</span>
              </div>
            </div>
          </div>

          {/* Context Bar */}
          <div className="flex justify-between items-center py-2 px-1 mt-2 text-[10px] font-bold text-gray-600 border-b border-gray-100 bg-gray-50/50">
              <div className="flex gap-6">
                  {branchName && <span className="flex items-center gap-1"><span className="text-sap-secondary">●</span> الفرع: {branchName}</span>}
                  {dateRange && <span className="flex items-center gap-1"><span className="text-sap-secondary">●</span> الفترة: {dateRange}</span>}
              </div>
              <div className="text-sap-primary">نسخة أصلية</div>
          </div>
        </div>
      )}

      {/* Title Section */}
      <div className="text-center mb-8 print:mb-6">
          <h2 className="text-2xl print:text-xl font-black text-sap-shell mb-2 inline-block border-b-4 border-sap-secondary pb-1">
            {title}
          </h2>
          {subtitle && <p className="text-sm font-bold text-gray-400 mt-2">{subtitle}</p>}
      </div>

      {/* Main Content */}
      <div className="report-body min-h-[400px] print:min-h-0">
        {children}
      </div>

      {showSignatures && (
        <div className="mt-16 print:mt-10 pt-8 border-t border-gray-200 break-inside-avoid">
          <div className="flex justify-between items-end px-8 print:px-0">
            <div className="text-center">
                <div className="mb-4 text-xs font-bold text-gray-400">المحاسب / المستلم</div>
                <div className="h-12 border-b border-gray-300 w-40 mx-auto"></div>
            </div>
            
            <div className="text-center">
                <div className="mb-4 text-xs font-bold text-gray-400">ختم المؤسسة</div>
                <div className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-full mx-auto flex items-center justify-center text-[8px] text-gray-300">Stamp</div>
            </div>

            <div className="text-center">
                <div className="mb-4 text-xs font-bold text-sap-primary">المدير العام</div>
                <div className="h-12 border-b border-gray-300 w-40 mx-auto"></div>
            </div>
          </div>
          
          <div className="mt-8 text-center">
              <p className="text-[8px] text-gray-400">تم استخراج هذا المستند آلياً عبر نظام StoreFlow - {new Date().getFullYear()}</p>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4 ${orientation}; margin: 10mm; }
          body { background: white !important; }
          .report-container { width: 100% !important; padding: 0 !important; }
          .bg-sap-shell { background-color: #2D3748 !important; color: white !important; }
          .bg-sap-secondary { background-color: #C5A059 !important; }
          .text-sap-primary { color: #800020 !important; }
          .border-sap-secondary { border-color: #C5A059 !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th { background-color: #F3F4F6 !important; color: #2D3748 !important; font-weight: 900 !important; border: 1px solid #E5E7EB !important; }
          td { border: 1px solid #E5E7EB !important; }
        }
      `}</style>
    </div>
  );
};
