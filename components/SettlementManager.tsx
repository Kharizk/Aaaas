
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom'; // Added for printing
import { POSPoint, Cashier, Settlement, SettlementEntry, User, Branch } from '../types';
import { db } from '../services/supabase';
import { ReportLayout } from './ReportLayout'; // Added for consistent printing
import { 
  Plus, Trash2, Save, Printer, Edit2, X, Loader2, Eye,
  Wallet, Monitor, Users, History, Calculator, CreditCard, 
  CheckCircle2, ChevronLeft, ChevronRight, Receipt, 
  TrendingUp, AlertCircle, ArrowRight, Coins, Banknote, Calendar,
  Building2, Scale, FileText, ScrollText
} from 'lucide-react';

interface SettlementManagerProps {
    currentUser?: User;
}

export const SettlementManager: React.FC<SettlementManagerProps> = ({ currentUser }) => {
  // Data State
  const [posPoints, setPosPoints] = useState<POSPoint[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI State
  const [mode, setMode] = useState<'list' | 'create' | 'view'>('list');
  const [step, setStep] = useState(1); // 1: Setup, 2: Sales, 3: Networks, 4: Cash & Finalize
  const [viewingSettlement, setViewingSettlement] = useState<Settlement | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
      date: new Date().toISOString().split('T')[0],
      posId: '',
      branchId: '',
      cashierId: '',
      totalSales: '' as any,
      networks: [] as SettlementEntry[],
      transfers: [] as SettlementEntry[],
      actualCash: '' as any,
      notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [pos, cash, sett, brs] = await Promise.all([
        db.posPoints.getAll(),
        db.cashiers.getAll(),
        db.settlements.getAll(),
        db.branches.getAll()
      ]);
      setPosPoints(pos);
      setCashiers(cash);
      setSettlements(sett);
      setBranches(brs);
      
      // Auto-set branch if user is linked
      if (currentUser?.branchId) {
          setFormData(prev => ({ ...prev, branchId: currentUser.branchId || '' }));
      }
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  // --- Computed Values ---
  const filteredSettlements = useMemo(() => {
      let data = settlements;
      if (currentUser?.role !== 'admin' && currentUser?.branchId) {
          data = data.filter(s => s.branchId === currentUser.branchId);
      }
      return data;
  }, [settlements, currentUser]);

  const totalNetworks = useMemo(() => {
      const n = formData.networks.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      const t = formData.transfers.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      return n + t;
  }, [formData.networks, formData.transfers]);

  const expectedCash = useMemo(() => {
      return Math.max(0, (Number(formData.totalSales) || 0) - totalNetworks);
  }, [formData.totalSales, totalNetworks]);

  const variance = useMemo(() => {
      return (Number(formData.actualCash) || 0) - expectedCash;
  }, [formData.actualCash, expectedCash]);

  // --- Handlers ---
  const handleStartNew = () => {
      setFormData({
          date: new Date().toISOString().split('T')[0],
          posId: '',
          branchId: currentUser?.branchId || '',
          cashierId: '',
          totalSales: '',
          networks: [{ id: crypto.randomUUID(), name: 'مدى', amount: 0 }, { id: crypto.randomUUID(), name: 'فيزا/ماستر', amount: 0 }],
          transfers: [],
          actualCash: '',
          notes: ''
      });
      setStep(1);
      setMode('create');
  };

  const handleSave = async () => {
      if (!formData.posId || !formData.cashierId) return alert("بيانات غير مكتملة");
      setIsSaving(true);
      try {
          const settlement: Settlement = {
              id: crypto.randomUUID(),
              ...formData,
              totalSales: Number(formData.totalSales),
              actualCash: Number(formData.actualCash),
              networks: formData.networks.filter(n => Number(n.amount) > 0).map(n => ({...n, amount: Number(n.amount)})),
              transfers: formData.transfers.filter(t => Number(t.amount) > 0).map(t => ({...t, amount: Number(t.amount)})),
              createdAt: new Date().toISOString()
          };
          await db.settlements.upsert(settlement);
          await fetchData();
          setMode('list');
      } catch (e) { alert("حدث خطأ أثناء الحفظ"); }
      finally { setIsSaving(false); }
  };

  const handleDelete = async (id: string) => {
      if(confirm('هل أنت متأكد من حذف هذه التسوية؟')) {
          await db.settlements.delete(id);
          fetchData();
      }
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // --- Sub-Components ---

  const SettlementDetailModal = () => {
      // Local state for print mode inside the modal
      const [printMode, setPrintMode] = useState<'a4' | 'thermal'>('a4');

      if (!viewingSettlement) return null;

      const net = viewingSettlement.networks.reduce((a,b)=>a+b.amount,0) + viewingSettlement.transfers.reduce((a,b)=>a+b.amount,0);
      const expected = viewingSettlement.totalSales - net;
      const diff = viewingSettlement.actualCash - expected;
      
      const posName = posPoints.find(p => p.id === viewingSettlement.posId)?.name || '-';
      const cashierName = cashiers.find(c => c.id === viewingSettlement.cashierId)?.name || '-';
      const branchName = branches.find(b => b.id === viewingSettlement.branchId)?.name || '-';

      const PrintContent = () => {
          if (printMode === 'thermal') {
              return (
                  <div className="p-2 font-mono text-black" style={{ width: '78mm', margin: '0 auto', fontSize: '11px', lineHeight: '1.2' }} dir="rtl">
                      <style>{`
                          @media print {
                              @page { size: 80mm auto; margin: 0; }
                              body { margin: 0; padding: 0; background: white; }
                              #print-container { width: 80mm !important; }
                          }
                      `}</style>
                      <div className="text-center mb-2 border-b-2 border-dashed border-black pb-2">
                          <h2 className="text-sm font-black">{localStorage.getItem('print_org_name') || 'StoreFlow'}</h2>
                          <div className="text-[10px] font-bold mt-1">{branchName}</div>
                          <div className="text-[9px] mt-1">{viewingSettlement.date} | {new Date(viewingSettlement.createdAt).toLocaleTimeString('ar-SA')}</div>
                      </div>

                      <div className="flex justify-between mb-1"><span>الكاشير:</span><span className="font-bold">{cashierName}</span></div>
                      <div className="flex justify-between mb-2"><span>النقطة:</span><span className="font-bold">{posName}</span></div>

                      <div className="border-t border-dashed border-black my-2"></div>

                      <div className="flex justify-between font-bold text-sm mb-1">
                          <span>إجمالي المبيعات</span>
                          <span>{fmt(viewingSettlement.totalSales)}</span>
                      </div>
                      
                      <div className="my-2">
                          <div className="text-[10px] underline mb-1">الشبكات والمدفوعات:</div>
                          {viewingSettlement.networks.map((n, i) => (
                              <div key={i} className="flex justify-between text-[10px] pl-2">
                                  <span>- {n.name}</span>
                                  <span>{fmt(n.amount)}</span>
                              </div>
                          ))}
                          <div className="flex justify-between border-t border-dotted border-black mt-1 pt-1 font-bold">
                              <span>مجموع الشبكات</span>
                              <span>{fmt(net)}</span>
                          </div>
                      </div>

                      <div className="border-t border-dashed border-black my-2 pt-2">
                          <div className="flex justify-between mb-1"><span>النقد المتوقع:</span><span>{fmt(expected)}</span></div>
                          <div className="flex justify-between font-black text-sm mb-1">
                              <span>النقد الفعلي:</span>
                              <span className="border px-1 border-black rounded">{fmt(viewingSettlement.actualCash)}</span>
                          </div>
                          <div className="flex justify-between items-center mt-2">
                              <span>الفرق (العجز/الزيادة):</span>
                              <span className={`font-black text-sm ${diff !== 0 ? 'bg-black text-white px-1' : ''}`}>
                                  {diff > 0 ? '+' : ''}{fmt(diff)}
                              </span>
                          </div>
                      </div>

                      {viewingSettlement.notes && (
                          <div className="mt-2 text-[10px] border border-black p-1">
                              ملاحظات: {viewingSettlement.notes}
                          </div>
                      )}

                      <div className="text-center mt-4 text-[9px] border-t border-dashed border-black pt-2">
                          *** نهاية التقرير ***
                          <br/>
                          Ref: {viewingSettlement.id.slice(0,6)}
                      </div>
                  </div>
              );
          }

          // A4 Mode
          return (
            <ReportLayout 
                title="تقرير إغلاق وردية (تسوية)" 
                subtitle={`رقم مرجعي: ${viewingSettlement.id.slice(0,8)}`}
                branchName={branchName}
            >
                <div className="grid grid-cols-2 gap-4 mb-6 text-sm font-bold border-b border-gray-200 pb-4">
                    <div>التاريخ: <span className="font-mono">{viewingSettlement.date}</span></div>
                    <div>الكاشير: <span>{cashierName}</span></div>
                    <div>نقطة البيع: <span>{posName}</span></div>
                    <div>وقت الإنشاء: <span className="font-mono">{new Date(viewingSettlement.createdAt).toLocaleTimeString('ar-SA')}</span></div>
                </div>

                <div className="space-y-6">
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                        <h4 className="font-black text-sm mb-3">ملخص المبيعات</h4>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="text-[10px] text-gray-500 mb-1">إجمالي المبيعات</div>
                                <div className="font-mono font-black text-lg">{fmt(viewingSettlement.totalSales)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-500 mb-1">المدفوعات الإلكترونية</div>
                                <div className="font-mono font-black text-lg">{fmt(net)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-500 mb-1">النقد المتوقع</div>
                                <div className="font-mono font-black text-lg">{fmt(expected)}</div>
                            </div>
                        </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-right text-xs">
                            <thead className="bg-gray-100 font-bold border-b border-gray-200">
                                <tr>
                                    <th className="p-3">بيان الشبكة / التحويل</th>
                                    <th className="p-3 text-left">المبلغ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-medium">
                                {viewingSettlement.networks.map((n, i) => (
                                    <tr key={i}>
                                        <td className="p-3">{n.name}</td>
                                        <td className="p-3 text-left font-mono">{fmt(n.amount)}</td>
                                    </tr>
                                ))}
                                {viewingSettlement.networks.length === 0 && <tr><td colSpan={2} className="p-3 text-center text-gray-400">لا توجد شبكات</td></tr>}
                            </tbody>
                        </table>
                    </div>

                    <div className="border-t-2 border-black pt-4 mt-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold">النقد الفعلي (المسلم):</span>
                            <span className="font-mono font-black text-xl">{fmt(viewingSettlement.actualCash)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-bold">نتيجة العجز / الزيادة:</span>
                            <span className={`font-mono font-black text-lg ${diff < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {diff > 0 ? '+' : ''}{fmt(diff)}
                            </span>
                        </div>
                    </div>

                    {viewingSettlement.notes && (
                        <div className="mt-4 p-3 border border-gray-200 rounded text-xs">
                            <strong>ملاحظات:</strong> {viewingSettlement.notes}
                        </div>
                    )}
                </div>
            </ReportLayout>
          );
      }

      // Render Portal for printing
      const printContainer = document.getElementById('print-container');

      return (
          <>
            {/* Hidden Print Content */}
            {printContainer && createPortal(<PrintContent />, printContainer)}

            {/* Screen Modal */}
            <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in zoom-in-95">
              <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-[2.5rem] overflow-hidden flex flex-col relative shadow-2xl">
                  <div className="bg-sap-shell text-white p-6 flex justify-between items-start">
                      <div>
                          <div className="text-[10px] font-mono opacity-60 mb-1">{viewingSettlement.date}</div>
                          <h3 className="font-black text-xl">تفاصيل التسوية</h3>
                      </div>
                      <button onClick={() => setViewingSettlement(null)} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><X size={20}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 bg-gray-50 custom-scrollbar space-y-6">
                      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 text-center">
                          <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">صافي النتيجة</div>
                          <div className={`text-4xl font-mono font-black ${diff === 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                              {fmt(Math.abs(diff))}
                          </div>
                          <div className="text-xs font-bold mt-2 text-gray-500">
                              {diff === 0 ? 'مطابقة ناجحة' : diff < 0 ? 'عجز مالي' : 'فائض مالي'}
                          </div>
                      </div>

                      <div className="space-y-4">
                          <div className="flex justify-between items-center p-3 border-b border-gray-200">
                              <span className="text-xs font-bold text-gray-500">إجمالي المبيعات</span>
                              <span className="font-mono font-black text-lg">{fmt(viewingSettlement.totalSales)}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 border-b border-gray-200">
                              <span className="text-xs font-bold text-gray-500">مجموع الشبكات</span>
                              <span className="font-mono font-bold text-gray-700">{fmt(net)}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 border-b border-gray-200 bg-emerald-50/50 rounded-xl">
                              <span className="text-xs font-black text-emerald-700">النقد الفعلي المستلم</span>
                              <span className="font-mono font-black text-xl text-emerald-700">{fmt(viewingSettlement.actualCash)}</span>
                          </div>
                      </div>

                      <div className="bg-gray-100 p-4 rounded-2xl">
                          <div className="text-[10px] font-black text-gray-400 mb-2 uppercase">تفاصيل الشبكات</div>
                          {viewingSettlement.networks.map((n, i) => (
                              <div key={i} className="flex justify-between text-xs font-bold text-gray-600 mb-1">
                                  <span>{n.name}</span>
                                  <span className="font-mono">{fmt(n.amount)}</span>
                              </div>
                          ))}
                      </div>

                      {viewingSettlement.notes && (
                          <div className="p-4 bg-yellow-50 rounded-2xl border border-yellow-100 text-xs font-bold text-yellow-800">
                              ملاحظات: {viewingSettlement.notes}
                          </div>
                      )}
                  </div>

                  <div className="p-4 bg-white border-t border-gray-100">
                      <div className="flex gap-2 mb-3">
                          <button onClick={() => setPrintMode('a4')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border ${printMode === 'a4' ? 'bg-sap-highlight border-sap-primary text-sap-primary' : 'bg-white border-gray-200 text-gray-500'}`}>
                              <FileText size={16}/> ورق A4
                          </button>
                          <button onClick={() => setPrintMode('thermal')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border ${printMode === 'thermal' ? 'bg-sap-highlight border-sap-primary text-sap-primary' : 'bg-white border-gray-200 text-gray-500'}`}>
                              <ScrollText size={16}/> ورق حراري (إيصال)
                          </button>
                      </div>
                      <button onClick={() => window.print()} className="w-full py-4 bg-black text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-gray-800 transition-all">
                          <Printer size={18}/> {printMode === 'a4' ? 'طباعة التقرير (A4)' : 'طباعة الإيصال (حراري)'}
                      </button>
                  </div>
              </div>
            </div>
          </>
      );
  }

  // --- RENDERERS ---

  // 1. LIST VIEW (Dashboard)
  if (mode === 'list') {
      return (
          <div className="space-y-6 animate-in fade-in pb-24 relative">
              {/* Header Stats */}
              <div className="bg-sap-primary text-white p-6 rounded-b-[2.5rem] shadow-lg -mt-6 mx-[-1.5rem] mb-6">
                  <div className="flex justify-between items-center mb-6 px-4">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-white/20 rounded-xl"><Wallet size={24}/></div>
                          <div>
                              <h1 className="font-black text-lg">إدارة التسويات</h1>
                              <p className="text-xs text-white/80">متابعة إغلاقات الوردية</p>
                          </div>
                      </div>
                      <button onClick={fetchData} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><History size={20}/></button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 px-2">
                      <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                          <div className="text-xs font-bold text-white/70 mb-1">تسويات اليوم</div>
                          <div className="text-2xl font-black">{filteredSettlements.filter(s => s.date === new Date().toISOString().split('T')[0]).length}</div>
                      </div>
                      <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                          <div className="text-xs font-bold text-white/70 mb-1">إجمالي النقد</div>
                          <div className="text-xl font-black font-mono">
                              {fmt(filteredSettlements.filter(s => s.date === new Date().toISOString().split('T')[0]).reduce((a,b)=>a+b.actualCash,0))}
                          </div>
                      </div>
                  </div>
              </div>

              {/* Action Button */}
              <div className="px-4">
                  <button onClick={handleStartNew} className="w-full py-4 bg-sap-secondary text-white rounded-2xl font-black text-sm shadow-lg shadow-sap-secondary/20 flex items-center justify-center gap-3 active:scale-95 transition-all">
                      <Plus size={20}/> بدء تسوية وردية جديدة
                  </button>
              </div>

              {/* History Cards */}
              <div className="px-4 space-y-4">
                  <h3 className="font-black text-sm text-gray-500 flex items-center gap-2"><Receipt size={16}/> آخر العمليات</h3>
                  {filteredSettlements.length === 0 ? (
                      <div className="text-center py-10 text-gray-400">لا توجد تسويات مسجلة</div>
                  ) : (
                      filteredSettlements.map(settlement => {
                          const net = settlement.networks.reduce((a,b)=>a+b.amount,0) + settlement.transfers.reduce((a,b)=>a+b.amount,0);
                          const expected = settlement.totalSales - net;
                          const diff = settlement.actualCash - expected;
                          const isMatched = Math.abs(diff) < 1;

                          return (
                              <div key={settlement.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                                  <div className={`absolute top-0 right-0 w-1.5 h-full ${isMatched ? 'bg-emerald-500' : diff < 0 ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                                  <div className="flex justify-between items-start mb-3 pl-2">
                                      <div>
                                          <div className="font-black text-gray-800 text-sm">{cashiers.find(c=>c.id===settlement.cashierId)?.name}</div>
                                          <div className="text-[10px] text-gray-400 font-bold mt-0.5 flex items-center gap-1">
                                              <Building2 size={10}/> {branches.find(b=>b.id===settlement.branchId)?.name}
                                          </div>
                                      </div>
                                      <div className="text-left">
                                          <div className="font-mono font-bold text-gray-500 text-[10px]">{settlement.date}</div>
                                          <div className={`text-[10px] font-black px-2 py-0.5 rounded-full mt-1 inline-block ${isMatched ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                              {isMatched ? 'مطابق' : 'يوجد فرق'}
                                          </div>
                                      </div>
                                  </div>
                                  
                                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded-2xl">
                                      <div className="text-center">
                                          <div className="text-[9px] text-gray-400 font-bold mb-1">المبيعات</div>
                                          <div className="font-mono font-black text-sap-primary">{fmt(settlement.totalSales)}</div>
                                      </div>
                                      <div className="w-px h-8 bg-gray-200"></div>
                                      <div className="text-center">
                                          <div className="text-[9px] text-gray-400 font-bold mb-1">النقد الفعلي</div>
                                          <div className="font-mono font-black text-gray-700">{fmt(settlement.actualCash)}</div>
                                      </div>
                                      <div className="w-px h-8 bg-gray-200"></div>
                                      <div className="text-center">
                                          <div className="text-[9px] text-gray-400 font-bold mb-1">الفرق</div>
                                          <div className={`font-mono font-black ${diff === 0 ? 'text-emerald-500' : 'text-red-500'}`}>{fmt(diff)}</div>
                                      </div>
                                  </div>

                                  <div className="mt-4 flex gap-2">
                                      <button onClick={() => setViewingSettlement(settlement)} className="flex-1 py-2 bg-sap-highlight text-sap-primary rounded-xl text-xs font-bold flex items-center justify-center gap-2"><Eye size={14}/> تفاصيل</button>
                                      {/* Short cut print button can set viewing first then print, but let's stick to detail view flow */}
                                      <button onClick={() => handleDelete(settlement.id)} className="p-2 bg-red-50 text-red-500 rounded-xl"><Trash2 size={16}/></button>
                                  </div>
                              </div>
                          );
                      })
                  )}
              </div>

              {/* Detail Modal Component Rendered Here */}
              <SettlementDetailModal />
          </div>
      );
  }

  // 2. WIZARD VIEW (Create)
  if (mode === 'create') {
      return (
          <div className="fixed inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-bottom">
              {/* Wizard Header */}
              <div className="px-6 py-4 border-b flex justify-between items-center bg-sap-shell text-white shrink-0">
                  <div className="flex items-center gap-3">
                      <button onClick={() => setMode('list')} className="p-2 hover:bg-white/10 rounded-full"><X size={20}/></button>
                      <h2 className="font-black text-sm">تسوية جديدة</h2>
                  </div>
                  <div className="flex gap-1">
                      {[1,2,3,4].map(i => (
                          <div key={i} className={`w-2 h-2 rounded-full transition-all ${step >= i ? 'bg-sap-secondary scale-125' : 'bg-white/20'}`}></div>
                      ))}
                  </div>
              </div>

              {/* Wizard Content */}
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50 custom-scrollbar">
                  
                  {step === 1 && (
                      <div className="space-y-6 animate-in slide-in-from-right">
                          <div className="text-center mb-8">
                              <div className="w-16 h-16 bg-sap-highlight text-sap-primary rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm">
                                  <Monitor size={32}/>
                              </div>
                              <h3 className="font-black text-xl text-gray-800">بيانات الوردية</h3>
                              <p className="text-xs text-gray-500 mt-1">حدد المعلومات الأساسية للبدء</p>
                          </div>

                          <div className="bg-white p-5 rounded-3xl shadow-sm space-y-4 border border-gray-100">
                              <div>
                                  <label className="text-xs font-black text-gray-500 mb-2 block">تاريخ الوردية</label>
                                  <div className="relative">
                                      <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-sm focus:ring-2 focus:ring-sap-primary" />
                                      <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
                                  </div>
                              </div>
                              
                              <div>
                                  <label className="text-xs font-black text-gray-500 mb-2 block">الفرع</label>
                                  <select value={formData.branchId} onChange={e => setFormData({...formData, branchId: e.target.value})} disabled={currentUser?.role !== 'admin' && !!currentUser?.branchId} className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-sm focus:ring-2 focus:ring-sap-primary appearance-none">
                                      <option value="">-- اختر الفرع --</option>
                                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                  </select>
                              </div>

                              <div>
                                  <label className="text-xs font-black text-gray-500 mb-2 block">نقطة البيع (الكاشير)</label>
                                  <select value={formData.posId} onChange={e => setFormData({...formData, posId: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-sm focus:ring-2 focus:ring-sap-primary appearance-none">
                                      <option value="">-- اختر النقطة --</option>
                                      {posPoints.filter(p => !formData.branchId || p.branchId === formData.branchId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                              </div>

                              <div>
                                  <label className="text-xs font-black text-gray-500 mb-2 block">الموظف المسؤول</label>
                                  <select value={formData.cashierId} onChange={e => setFormData({...formData, cashierId: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-sm focus:ring-2 focus:ring-sap-primary appearance-none">
                                      <option value="">-- اختر الموظف --</option>
                                      {cashiers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                              </div>
                          </div>
                      </div>
                  )}

                  {step === 2 && (
                      <div className="space-y-6 animate-in slide-in-from-right">
                          <div className="text-center mb-8">
                              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm">
                                  <TrendingUp size={32}/>
                              </div>
                              <h3 className="font-black text-xl text-gray-800">إجمالي المبيعات</h3>
                              <p className="text-xs text-gray-500 mt-1">أدخل إجمالي المبيعات كما يظهر في النظام</p>
                          </div>

                          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 text-center">
                              <label className="text-xs font-black text-gray-400 uppercase mb-4 block">المبلغ الإجمالي</label>
                              <input 
                                type="number" 
                                value={formData.totalSales} 
                                onChange={e => setFormData({...formData, totalSales: e.target.value})} 
                                className="w-full text-center text-5xl font-black text-sap-primary bg-transparent border-none focus:ring-0 placeholder:text-gray-200 font-mono"
                                placeholder="0.00"
                                autoFocus
                              />
                              <div className="h-1 w-20 bg-gray-100 mx-auto mt-4 rounded-full"></div>
                          </div>
                      </div>
                  )}

                  {step === 3 && (
                      <div className="space-y-6 animate-in slide-in-from-right">
                          <div className="text-center mb-6">
                              <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm">
                                  <CreditCard size={32}/>
                              </div>
                              <h3 className="font-black text-xl text-gray-800">المدفوعات الإلكترونية</h3>
                              <p className="text-xs text-gray-500 mt-1">مدى، فيزا، تحويلات بنكية</p>
                          </div>

                          <div className="space-y-4">
                              {formData.networks.map((net, idx) => (
                                  <div key={net.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                                          <CreditCard size={20}/>
                                      </div>
                                      <div className="flex-1">
                                          <input 
                                            type="text" 
                                            value={net.name} 
                                            onChange={e => {
                                                const ns = [...formData.networks];
                                                ns[idx].name = e.target.value;
                                                setFormData({...formData, networks: ns});
                                            }}
                                            className="w-full text-xs font-black text-gray-600 border-none p-0 focus:ring-0 bg-transparent"
                                          />
                                          <div className="text-[10px] text-gray-400">اسم الشبكة</div>
                                      </div>
                                      <input 
                                        type="number" 
                                        value={net.amount || ''} 
                                        onChange={e => {
                                            const ns = [...formData.networks];
                                            ns[idx].amount = Number(e.target.value);
                                            setFormData({...formData, networks: ns});
                                        }}
                                        className="w-28 text-right font-mono font-black text-lg border-b border-gray-200 focus:border-sap-primary text-sap-primary bg-transparent focus:ring-0 p-1"
                                        placeholder="0.00"
                                      />
                                      <button onClick={() => setFormData({...formData, networks: formData.networks.filter(n => n.id !== net.id)})} className="text-red-300 hover:text-red-500"><X size={18}/></button>
                                  </div>
                              ))}
                              
                              <button onClick={() => setFormData({...formData, networks: [...formData.networks, { id: crypto.randomUUID(), name: 'شبكة جديدة', amount: 0 }]})} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold text-xs hover:bg-gray-50 flex items-center justify-center gap-2">
                                  <Plus size={16}/> إضافة شبكة أخرى
                              </button>
                          </div>

                          <div className="bg-sap-highlight/20 p-4 rounded-2xl flex justify-between items-center mt-6">
                              <span className="text-xs font-black text-sap-primary">إجمالي الشبكات</span>
                              <span className="text-xl font-mono font-black text-sap-primary">{fmt(totalNetworks)}</span>
                          </div>
                      </div>
                  )}

                  {step === 4 && (
                      <div className="space-y-6 animate-in slide-in-from-right">
                          <div className="text-center mb-6">
                              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm">
                                  <Coins size={32}/>
                              </div>
                              <h3 className="font-black text-xl text-gray-800">الجرد النقدي</h3>
                              <p className="text-xs text-gray-500 mt-1">أدخل المبلغ النقدي الموجود فعلياً في الدرج</p>
                          </div>

                          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm text-center space-y-6">
                              <div>
                                  <div className="text-[10px] font-black text-gray-400 uppercase mb-2">النقد المتوقع (حسب النظام)</div>
                                  <div className="text-2xl font-mono font-black text-gray-800">{fmt(expectedCash)}</div>
                              </div>
                              
                              <div className="border-t border-gray-100 pt-6">
                                  <label className="text-xs font-black text-sap-secondary uppercase mb-4 block">النقد الفعلي (الموجود)</label>
                                  <input 
                                    type="number" 
                                    value={formData.actualCash} 
                                    onChange={e => setFormData({...formData, actualCash: e.target.value})} 
                                    className="w-full text-center text-5xl font-black text-sap-primary bg-transparent border-none focus:ring-0 placeholder:text-gray-200 font-mono"
                                    placeholder="0.00"
                                    autoFocus
                                  />
                              </div>
                          </div>

                          <div className={`p-6 rounded-3xl text-center border-2 ${variance === 0 ? 'bg-emerald-50 border-emerald-100' : variance < 0 ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                              <div className="text-[10px] font-black uppercase opacity-60 mb-2">نتيجة المطابقة</div>
                              <div className={`text-3xl font-mono font-black ${variance === 0 ? 'text-emerald-600' : variance < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                  {fmt(Math.abs(variance))} {variance !== 0 && (variance > 0 ? '+' : '-')}
                              </div>
                              <div className="text-xs font-bold mt-2">
                                  {variance === 0 ? 'مطابق تماماً ✅' : variance < 0 ? 'عجز في الصندوق ⚠️' : 'زيادة في الصندوق ℹ️'}
                              </div>
                          </div>

                          <textarea 
                            value={formData.notes} 
                            onChange={e => setFormData({...formData, notes: e.target.value})}
                            placeholder="ملاحظات إضافية..."
                            className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-sap-primary h-24 resize-none"
                          ></textarea>
                      </div>
                  )}

              </div>

              {/* Wizard Actions */}
              <div className="p-4 bg-white border-t border-gray-100 flex gap-3 shrink-0">
                  {step > 1 && (
                      <button onClick={() => setStep(step - 1)} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm flex items-center justify-center gap-2">
                          <ChevronRight size={18}/> السابق
                      </button>
                  )}
                  {step < 4 ? (
                      <button onClick={() => {
                          if(step===1 && (!formData.posId || !formData.cashierId)) return alert('أكمل البيانات');
                          setStep(step + 1);
                      }} className="flex-[2] py-4 bg-sap-primary text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-sap-primary/20">
                          التالي <ChevronLeft size={18}/>
                      </button>
                  ) : (
                      <button onClick={handleSave} disabled={isSaving} className="flex-[2] py-4 bg-sap-secondary text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-sap-secondary/20">
                          {isSaving ? <Loader2 size={18} className="animate-spin"/> : <CheckCircle2 size={18}/>} اعتماد وترحيل
                      </button>
                  )}
              </div>
          </div>
      );
  }

  return <div>Loading...</div>;
};
