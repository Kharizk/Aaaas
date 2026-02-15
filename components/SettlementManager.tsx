
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Settlement, User, DailySales, Expense, POSPoint, Network } from '../types';
import { db } from '../services/supabase';
import { ReportLayout } from './ReportLayout';
import { 
  Wallet, TrendingUp, AlertTriangle, CheckCircle2, History, 
  ArrowRight, Coins, Banknote, Calendar, Receipt, 
  MinusCircle, PlusCircle, Scale, Printer, Lock, Monitor, Wifi, Landmark
} from 'lucide-react';

interface SettlementManagerProps {
    currentUser?: User;
}

export const SettlementManager: React.FC<SettlementManagerProps> = ({ currentUser }) => {
  // --- Data ---
  const [sales, setSales] = useState<DailySales[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [posPoints, setPosPoints] = useState<POSPoint[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- UI State ---
  const [mode, setMode] = useState<'list' | 'closing'>('list');
  const [closingDate, setClosingDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPosId, setSelectedPosId] = useState<string>(''); // For filtering which POS to close
  
  // --- Closing Logic State ---
  const [openingBalance, setOpeningBalance] = useState<string>('');
  const [bankDeposit, setBankDeposit] = useState<string>('');
  const [actualCash, setActualCash] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [s, e, st, pp, nn] = await Promise.all([
        db.dailySales.getAll(),
        db.expenses.getAll(),
        db.settlements.getAll(),
        db.posPoints.getAll(),
        db.networks.getAll()
      ]);
      setSales(s as DailySales[]);
      setExpenses(e as Expense[]);
      setSettlements(st as Settlement[]);
      setPosPoints(pp as POSPoint[]);
      setNetworks(nn as Network[]);
      if (pp.length > 0) setSelectedPosId(pp[0].id);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  // --- Logic Engine for Selected Date AND POS ---
  const dailyData = useMemo(() => {
      // Filter for closing Date AND POS Point
      if (!selectedPosId) return { cashSalesIn: 0, cashCollectionsIn: 0, cashExpensesOut: 0, networkSales: 0, pendingTransfers: 0, networkBreakdown: [], bankTransfers: 0 };

      const daySales = sales.filter(s => s.date === closingDate && !s.isClosed && s.posPointId === selectedPosId);
      const dayExpenses = expenses.filter(e => e.date === closingDate);

      // 1. Calculate Revenue (Sales) vs Cash Flow (Money In)
      const cashSalesIn = daySales
        .filter(s => (s.paymentMethod === 'cash' || !s.paymentMethod) && (s.transactionType === 'sale' || !s.transactionType))
        .reduce((sum, s) => sum + (s.paidAmount ?? s.amount ?? 0), 0);

      // 2. Collections (Debts paid today)
      const cashCollectionsIn = daySales
        .filter(s => (s.paymentMethod === 'cash' || !s.paymentMethod) && s.transactionType === 'collection')
        .reduce((sum, s) => sum + (s.paidAmount ?? s.amount ?? 0), 0);

      // 3. Expenses (Money Out)
      const cashExpensesOut = dayExpenses.reduce((sum, e) => sum + e.amount, 0);

      // 4. Non-Cash: Networks
      const networkSalesRecords = daySales.filter(s => s.paymentMethod === 'card');
      const networkSalesTotal = networkSalesRecords.reduce((sum, s) => sum + (s.paidAmount ?? s.amount ?? 0), 0);
      
      const networkBreakdown = networks.map(net => {
          const total = networkSalesRecords.filter(s => s.networkId === net.id).reduce((sum, s) => sum + (s.paidAmount || 0), 0);
          return { id: net.id, name: net.name, amount: total };
      }).filter(n => n.amount > 0);

      const unknownNetworkTotal = networkSalesRecords.filter(s => !s.networkId).reduce((sum, s) => sum + (s.paidAmount || 0), 0);
      if (unknownNetworkTotal > 0) networkBreakdown.push({ id: 'unknown', name: 'شبكة غير محددة', amount: unknownNetworkTotal });

      // 5. Non-Cash: Bank Transfers
      const bankTransfers = daySales
        .filter(s => s.paymentMethod === 'transfer')
        .reduce((sum, s) => sum + (s.paidAmount ?? s.amount ?? 0), 0);

      const pendingTransfers = daySales
        .filter(s => s.isPending)
        .reduce((sum, s) => sum + (s.paidAmount ?? s.amount ?? 0), 0);

      return { cashSalesIn, cashCollectionsIn, cashExpensesOut, networkSales: networkSalesTotal, pendingTransfers, networkBreakdown, bankTransfers };
  }, [sales, expenses, closingDate, selectedPosId, networks]);

  const theoreticalCash = useMemo(() => {
      const open = parseFloat(openingBalance) || 0;
      const deposit = parseFloat(bankDeposit) || 0;
      // Formula: Open + Sales(Cash) + Collections(Cash) - Expenses - Deposits
      return (open + dailyData.cashSalesIn + dailyData.cashCollectionsIn) - (dailyData.cashExpensesOut + deposit);
  }, [openingBalance, bankDeposit, dailyData]);

  const variance = useMemo(() => {
      const actual = parseFloat(actualCash) || 0;
      return actual - theoreticalCash;
  }, [actualCash, theoreticalCash]);

  const handleCloseDay = async () => {
      if (!selectedPosId) return alert("يرجى اختيار نقطة البيع");
      if (!actualCash) return alert("يرجى إدخال الجرد الفعلي");
      if (variance !== 0 && !notes) return alert("يوجد فرق في الصندوق. يرجى كتابة ملاحظة تبريرية.");
      
      if (!confirm("هل أنت متأكد من إغلاق الوردية لهذه النقطة؟")) return;

      setIsSaving(true);
      try {
          const activePos = posPoints.find(p => p.id === selectedPosId);
          const settlement: Settlement = {
              id: crypto.randomUUID(),
              date: closingDate,
              posId: selectedPosId, 
              branchId: activePos?.branchId || currentUser?.branchId || 'MAIN',
              cashierId: currentUser?.id || 'ADMIN',
              
              openingBalance: parseFloat(openingBalance) || 0,
              totalCashSales: dailyData.cashSalesIn,
              totalCollections: dailyData.cashCollectionsIn,
              totalExpenses: dailyData.cashExpensesOut,
              bankDeposit: parseFloat(bankDeposit) || 0,
              
              theoreticalCash: theoreticalCash,
              actualCash: parseFloat(actualCash),
              variance: variance,
              
              totalSales: dailyData.cashSalesIn + dailyData.networkSales + dailyData.bankTransfers, // Include transfers in Total Sales
              networks: dailyData.networkBreakdown, 
              transfers: [{ id: 'bank_transfer', name: 'تحويلات بنكية', amount: dailyData.bankTransfers }], // Add to transfers array
              
              notes,
              createdAt: new Date().toISOString(),
              status: 'closed'
          };

          // 1. Save Settlement
          await db.settlements.upsert(settlement);

          // 2. Mark sales as Closed
          await fetchData();
          setMode('list');
          alert("تم إغلاق الوردية بنجاح");
      } catch (e) { alert("خطأ في الإغلاق"); }
      finally { setIsSaving(false); }
  };

  const fmt = (n: any) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

  if (mode === 'list') {
      return (
          <div className="space-y-6 animate-in fade-in pb-20">
              <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-sap-border shadow-sm">
                  <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-sap-shell text-white rounded-2xl flex items-center justify-center shadow-lg"><Wallet size={32}/></div>
                      <div>
                          <h1 className="text-2xl font-black text-sap-text">إغلاق الصندوق اليومي</h1>
                          <p className="text-xs text-sap-text-variant font-bold mt-1">نظام المطابقة الذكي وتتبع النقدية</p>
                      </div>
                  </div>
                  <button onClick={() => setMode('closing')} className="bg-sap-primary text-white px-8 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg shadow-sap-primary/20 hover:bg-sap-primary-hover transition-all">
                      <Scale size={18}/> بدء مطابقة جديدة
                  </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                  {settlements.sort((a,b) => b.date.localeCompare(a.date)).map(s => {
                      const posName = posPoints.find(p => p.id === s.posId)?.name || 'Unknown POS';
                      const netTotal = (s.networks || []).reduce((a, b) => a + b.amount, 0);
                      const transferTotal = (s.transfers || []).reduce((a, b) => a + b.amount, 0);
                      
                      return (
                          <div key={s.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                              <div className="flex items-center gap-4">
                                  <div className={`p-3 rounded-full ${s.variance === 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                      {s.variance === 0 ? <CheckCircle2 size={24}/> : <AlertTriangle size={24}/>}
                                  </div>
                                  <div>
                                      <div className="font-black text-lg text-gray-800 flex items-center gap-2">
                                          {new Date(s.date).toLocaleDateString('ar-SA')} 
                                          <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">{posName}</span>
                                      </div>
                                      <div className="text-xs text-gray-400 font-bold mt-1 flex items-center gap-2">
                                          <History size={12}/> تم الإغلاق: {new Date(s.createdAt).toLocaleTimeString('ar-SA')}
                                      </div>
                                  </div>
                              </div>
                              
                              <div className="flex gap-8 text-center">
                                  <div>
                                      <div className="text-[10px] font-black text-gray-400 uppercase">مقبوضات الكاش</div>
                                      <div className="font-mono font-black text-lg text-sap-primary">{fmt((s.totalCashSales || 0) + (s.totalCollections || 0))}</div>
                                  </div>
                                  <div>
                                      <div className="text-[10px] font-black text-gray-400 uppercase">شبكة / تحويل</div>
                                      <div className="font-mono font-black text-lg text-blue-600">
                                          {fmt(netTotal + transferTotal)}
                                      </div>
                                  </div>
                                  <div className="bg-gray-50 px-4 py-1 rounded-xl">
                                      <div className="text-[10px] font-black text-gray-400 uppercase">نتيجة المطابقة</div>
                                      <div className={`font-mono font-black text-xl ${s.variance === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {s.variance === 0 ? 'مطابق' : `${(s.variance || 0) > 0 ? '+' : ''}${fmt(s.variance || 0)}`}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      );
                  })}
                  {settlements.length === 0 && <div className="text-center py-20 text-gray-400 font-bold">لا توجد إغلاقات سابقة</div>}
              </div>
          </div>
      )
  }

  return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom pb-20">
          <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                  <button onClick={() => setMode('list')} className="p-2 bg-white rounded-full border shadow-sm hover:bg-gray-50"><ArrowRight/></button>
                  <h2 className="text-2xl font-black text-gray-800">تسوية اليومية: <span className="font-mono text-sap-primary">{closingDate}</span></h2>
              </div>
              <select value={selectedPosId} onChange={(e) => setSelectedPosId(e.target.value)} className="bg-white border border-gray-200 rounded-xl p-3 font-bold text-sm min-w-[200px]">
                  {posPoints.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  {posPoints.length === 0 && <option value="">لا توجد نقاط بيع</option>}
              </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Column: Automated Calculation */}
              <div className="space-y-6">
                  <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
                      <h3 className="font-black text-lg flex items-center gap-2"><TrendingUp size={20} className="text-sap-secondary"/> التدفقات الداخلة (القبض)</h3>
                      
                      <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl border border-green-100">
                          <span className="text-xs font-bold text-green-800">مبيعات نقدية (Cash)</span>
                          <span className="font-mono font-black text-lg text-green-700">+{fmt(dailyData.cashSalesIn)}</span>
                      </div>
                      
                      <div className="flex justify-between items-center p-3 bg-amber-50 rounded-xl border border-amber-100">
                          <span className="text-xs font-bold text-amber-800">تحصيل ذمم (Collections)</span>
                          <span className="font-mono font-black text-lg text-amber-700">+{fmt(dailyData.cashCollectionsIn)}</span>
                      </div>

                      {/* Detailed Breakdown */}
                      <div className="pt-2 border-t border-dashed border-gray-200">
                          <h4 className="text-xs font-black text-gray-400 mb-2 flex items-center gap-1"><Wifi size={12}/> تفصيل غير النقدي (آلي)</h4>
                          <div className="space-y-2">
                              {/* Networks */}
                              {dailyData.networkBreakdown.length > 0 && dailyData.networkBreakdown.map(net => (
                                  <div key={net.id} className="flex justify-between items-center p-2 bg-blue-50/50 rounded-lg text-xs">
                                      <span className="font-bold text-blue-800">{net.name}</span>
                                      <span className="font-mono font-black text-blue-600">{fmt(net.amount)}</span>
                                  </div>
                              ))}
                              
                              {/* Bank Transfers */}
                              {dailyData.bankTransfers > 0 && (
                                  <div className="flex justify-between items-center p-2 bg-purple-50/50 rounded-lg text-xs">
                                      <span className="font-bold text-purple-800 flex items-center gap-1"><Landmark size={10}/> تحويلات بنكية</span>
                                      <span className="font-mono font-black text-purple-600">{fmt(dailyData.bankTransfers)}</span>
                                  </div>
                              )}

                              {dailyData.networkBreakdown.length === 0 && dailyData.bankTransfers === 0 && (
                                  <div className="text-[10px] text-gray-400 italic text-center">لا توجد عمليات غير نقدية</div>
                              )}
                          </div>
                      </div>
                  </div>

                  <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
                      <h3 className="font-black text-lg flex items-center gap-2 text-red-500"><MinusCircle size={20}/> التدفقات الخارجة</h3>
                      
                      <div className="flex justify-between items-center p-3 bg-red-50 rounded-xl border border-red-100">
                          <span className="text-xs font-bold text-red-800">مصروفات تشغيلية</span>
                          <span className="font-mono font-black text-lg text-red-700">-{fmt(dailyData.cashExpensesOut)}</span>
                      </div>
                  </div>
              </div>

              {/* Right Column: Reconciliation Form */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-sap-border shadow-xl space-y-6 h-fit">
                  <div className="text-center pb-4 border-b border-gray-100">
                      <h3 className="font-black text-xl text-sap-text">حاسبة المطابقة</h3>
                      <div className="text-xs text-gray-400 mt-1">الخاصة بنقطة: {posPoints.find(p => p.id === selectedPosId)?.name}</div>
                  </div>

                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-black text-gray-500 uppercase mb-1 block">رصيد أول المدة (الافتتاح)</label>
                          <input type="number" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-mono font-black text-lg focus:ring-2 focus:ring-sap-primary focus:bg-white transition-all" placeholder="0.00" />
                      </div>

                      <div>
                          <label className="text-xs font-black text-blue-600 uppercase mb-1 block">إيداع بنكي (تم ترحيله للبنك)</label>
                          <input type="number" value={bankDeposit} onChange={e => setBankDeposit(e.target.value)} className="w-full p-4 bg-blue-50 border border-blue-100 rounded-2xl font-mono font-black text-lg focus:ring-2 focus:ring-blue-500 transition-all text-blue-800" placeholder="0.00" />
                      </div>

                      <div className="py-4 border-y border-dashed border-gray-200">
                          <div className="flex justify-between items-center">
                              <span className="text-sm font-black text-gray-600">الرصيد النظري المتوقع</span>
                              <span className="text-2xl font-mono font-black text-sap-primary">{fmt(theoreticalCash)}</span>
                          </div>
                      </div>

                      <div>
                          <label className="text-xs font-black text-sap-secondary uppercase mb-1 block">النقد الفعلي (الجرد في الدرج)</label>
                          <input type="number" value={actualCash} onChange={e => setActualCash(e.target.value)} className="w-full p-4 bg-sap-highlight/20 border border-sap-primary/20 rounded-2xl font-mono font-black text-2xl text-center focus:ring-2 focus:ring-sap-secondary transition-all text-sap-text" placeholder="0.00" autoFocus />
                      </div>

                      {actualCash && (
                          <div className={`p-4 rounded-2xl text-center border-2 ${variance === 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                              <div className="text-xs font-black uppercase mb-1">النتيجة النهائية</div>
                              <div className="text-3xl font-mono font-black">{variance > 0 ? '+' : ''}{fmt(variance)}</div>
                              <div className="text-xs font-bold mt-1">{variance === 0 ? 'مطابقة ممتازة ✅' : 'يوجد عجز/زيادة ⚠️'}</div>
                          </div>
                      )}

                      {dailyData.pendingTransfers > 0 && variance !== 0 && (
                          <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-800 font-bold flex items-start gap-2">
                              <AlertTriangle size={16} className="shrink-0 mt-0.5"/>
                              <div>
                                  تنبيه: يوجد تحويلات بقيمة {fmt(dailyData.pendingTransfers)} تحت المراجعة. تأكد أنها لم تحسب بالخطأ ضمن الكاش.
                              </div>
                          </div>
                      )}

                      <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 text-xs font-bold border border-gray-200 rounded-xl h-20" placeholder="ملاحظات الإغلاق (إجباري في حال وجود فرق)..."></textarea>

                      <button onClick={handleCloseDay} disabled={isSaving} className="w-full py-4 bg-sap-shell text-white rounded-2xl font-black text-sm shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2">
                          <Lock size={16}/> اعتماد وإغلاق الوردية
                      </button>
                  </div>
              </div>
          </div>
      </div>
  );
};
