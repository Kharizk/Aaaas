
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
  const [orgName, setOrgName] = useState(localStorage.getItem('print_org_name') || 'مؤسسة إدارة المتجر');
  
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
    <div className="report-container bg-white p-12 print:p-0 print:m-0 overflow-visible relative text-right" dir="rtl">
      
      {showHeader && (
        <div className="report-header relative mb-10 print:mb-4">
          <div className="flex justify-between items-start pb-6 print:pb-2 border-b-[3px] border-sap-primary print:border-b-2">
            {/* Right Side: Org Info */}
            <div className="space-y-1">
              <h1 className="text-3xl print:text-xl font-black text-sap-primary leading-tight">{orgName}</h1>
              <p className="text-sm print:text-[10px] font-bold text-gray-400 uppercase tracking-[2px]">Inventory & Sales Management System</p>
              <div className="flex items-center gap-2 mt-2 text-[10px] print:text-[8px] font-black text-sap-secondary">
                  <Globe size={12} className="print:w-3 print:h-3"/>
                  <span>نظام التقارير السحابي الموحد</span>
              </div>
            </div>
            
            {/* Center: Badge */}
            <div className="absolute left-1/2 -translate-x-1/2 top-0 flex flex-col items-center print:hidden">
                 <div className="w-20 h-20 bg-sap-shell text-white rounded-2xl flex items-center justify-center font-black text-3xl shadow-xl border-4 border-white">SF</div>
                 <div className="bg-sap-primary text-white px-4 py-1 rounded-full text-[9px] font-black mt-2 shadow-sm uppercase tracking-widest">Official</div>
            </div>

            {/* Left Side: Meta Info */}
            <div className="text-left space-y-1.5 pt-1">
              <div className="text-[11px] print:text-[9px] font-black text-gray-700 flex items-center justify-end gap-2">
                {currentDate} <Calendar size={14} className="text-sap-primary print:w-3 print:h-3" />
              </div>
              <div className="text-[11px] print:text-[9px] font-black text-gray-700 flex items-center justify-end gap-2">
                {currentTime} <Clock size={14} className="text-sap-primary print:w-3 print:h-3" />
              </div>
              <div className="text-[9px] print:text-[8px] font-mono text-gray-400 uppercase">Ref: {crypto.randomUUID().slice(0,8).toUpperCase()}</div>
            </div>
          </div>

          {/* Quick Stats Bar under header */}
          <div className="flex justify-between items-center py-3 print:py-1 px-6 print:px-2 bg-gray-50 print:bg-transparent border-b border-gray-200 text-[10px] print:text-[9px] font-black text-gray-500 uppercase">
              <div className="flex gap-6">
                  <span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-sap-success"/> بيانات مصادق عليها</span>
                  {branchName && <span className="flex items-center gap-1.5">الفرع: <span className="text-sap-text">{branchName}</span></span>}
                  {dateRange && <span className="flex items-center gap-1.5">الفترة: <span className="text-sap-text">{dateRange}</span></span>}
              </div>
              <div className="flex items-center gap-1.5">
                  <FileText size={12}/> مستند آلي
              </div>
          </div>
        </div>
      )}

      <div className="text-center mb-12 print:mb-4">
          <h2 className="text-4xl print:text-2xl font-black text-sap-text mb-4 print:mb-1 inline-block relative">
            {title}
            <div className="absolute -bottom-2 right-0 w-full h-1 bg-sap-secondary/30 rounded-full print:hidden"></div>
          </h2>
          {subtitle && <p className="text-lg print:text-sm font-bold text-gray-400 mt-2 print:mt-0">{subtitle}</p>}
      </div>

      <div className="report-body min-h-[500px] print:min-h-0">
        {children}
      </div>

      {showSignatures && (
        <div className="mt-20 print:mt-8 pt-10 print:pt-4 border-t-2 border-dashed border-gray-200 break-inside-avoid">
          <div className="flex justify-between items-end px-10 print:px-0">
            <div className="text-center group">
                <div className="w-24 h-24 print:w-16 print:h-16 bg-gray-50 border-2 border-gray-100 rounded-2xl flex items-center justify-center mb-3 opacity-30 grayscale group-hover:opacity-100 transition-all">
                    {/* Simulated QR Code */}
                    <div className="grid grid-cols-4 gap-1 p-2">
                        {Array.from({length:16}).map((_,i) => <div key={i} className={`w-3 h-3 print:w-2 print:h-2 ${Math.random() > 0.5 ? 'bg-black' : 'bg-transparent'}`}></div>)}
                    </div>
                </div>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-[2px]">Verification Code</p>
            </div>
            
            <div className="flex gap-24 print:gap-10">
                <div className="text-center space-y-6 print:space-y-4">
                    <div className="w-48 print:w-32 h-[1px] bg-gray-300"></div>
                    <p className="text-xs print:text-[10px] font-black text-gray-500 uppercase tracking-widest">توقيع المراجعة والتدقيق</p>
                </div>
                <div className="text-center space-y-6 print:space-y-4">
                    <div className="w-48 print:w-32 h-[1px] bg-sap-primary shadow-sm"></div>
                    <p className="text-xs print:text-[10px] font-black text-sap-primary uppercase tracking-widest">اعتماد الإدارة المالية</p>
                </div>
            </div>
          </div>
          <div className="mt-12 print:mt-4 text-center text-[9px] print:text-[8px] font-bold text-gray-300 uppercase tracking-[4px]">
              StoreFlow Cloud Solutions © {new Date().getFullYear()} - All Rights Reserved
          </div>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4 ${orientation}; margin: 5mm; }
          body { background: white !important; -webkit-print-color-adjust: exact !important; }
          .report-container { width: 100% !important; padding: 0 !important; }
          .report-header { border-bottom-width: 2px !important; }
          table { width: 100% !important; page-break-inside: auto !important; }
          tr { page-break-inside: avoid !important; page-break-after: auto !important; }
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
        }
      `}</style>
    </div>
  );
};
