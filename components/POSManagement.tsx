
import React, { useState, useEffect, useMemo } from 'react';
import { POSPoint, Cashier, Branch, User, Settlement } from '../types';
import { db } from '../services/supabase';
import { 
  Plus, Edit2, Trash2, Save, X, Loader2, Monitor, 
  Users, Building2, Search, CheckCircle2, ShieldCheck,
  ChevronLeft, LayoutGrid, Smartphone, UserPlus, Eye,
  TrendingUp, Wallet, CreditCard, AlertTriangle, ArrowRight,
  BarChart3, Activity, Receipt, Coins, History
} from 'lucide-react';

interface POSManagementProps {
  branches: Branch[];
}

export const POSManagement: React.FC<POSManagementProps> = ({ branches }) => {
  const [activeTab, setActiveTab] = useState<'points' | 'cashiers'>('points');
  const [posPoints, setPosPoints] = useState<POSPoint[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  // Detail Modal State
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
  const [detailType, setDetailType] = useState<'pos' | 'cashier' | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [pos, cash, sett] = await Promise.all([
        db.posPoints.getAll(),
        db.cashiers.getAll(),
        db.settlements.getAll()
      ]);
      setPosPoints(pos);
      setCashiers(cash);
      setSettlements(sett);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const handleOpenModal = (item?: any) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setBranchId(item.branchId || '');
    } else {
      setEditingItem(null);
      setName('');
      setBranchId('');
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return alert("يرجى إدخال الاسم");
    if (activeTab === 'points' && !branchId) return alert("يرجى ربط نقطة البيع بفرع");

    setIsSaving(true);
    try {
      const id = editingItem?.id || crypto.randomUUID();
      if (activeTab === 'points') {
        const data: POSPoint = { id, name: name.trim(), branchId };
        await db.posPoints.upsert(data);
      } else {
        const data: Cashier = { id, name: name.trim() };
        await db.cashiers.upsert(data);
      }
      await fetchData();
      setIsModalOpen(false);
    } catch (e) {
      alert("حدث خطأ أثناء الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟ سيؤثر هذا على سجلات التسوية المرتبطة.')) return;
    try {
      if (activeTab === 'points') await db.posPoints.delete(id);
      else await db.cashiers.delete(id);
      await fetchData();
    } catch (e) { alert("فشل الحذف"); }
  };

  const fmt = (val: number) => val.toLocaleString('ar-SA', { minimumFractionDigits: 2 });

  // --- Analytical Calculations ---
  const filteredPoints = posPoints.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredCashiers = cashiers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const getPosStats = (id: string) => {
      const relevant = settlements.filter(s => s.posId === id);
      const totalSales = relevant.reduce((a, b) => a + (b.totalSales || 0), 0);
      const totalCash = relevant.reduce((a, b) => a + (b.actualCash || 0), 0);
      const networkTotal = relevant.reduce((a, b) => {
          const nets = (b.networks || []).reduce((sum, n) => sum + (n.amount || 0), 0);
          const trans = (b.transfers || []).reduce((sum, t) => sum + (t.amount || 0), 0);
          return a + nets + trans;
      }, 0);
      return { totalSales, totalCash, networkTotal, count: relevant.length, records: relevant };
  };

  const getCashierStats = (id: string) => {
      const relevant = settlements.filter(s => s.cashierId === id);
      const totalSales = relevant.reduce((a, b) => a + (b.totalSales || 0), 0);
      const totalActual = relevant.reduce((a, b) => a + (b.actualCash || 0), 0);
      
      let totalDiff = 0;
      relevant.forEach(s => {
          const netTotal = (s.networks || []).reduce((a, n) => a + (n.amount || 0), 0) + (s.transfers || []).reduce((a, t) => a + (t.amount || 0), 0);
          const expected = s.totalSales - netTotal;
          totalDiff += (s.actualCash - expected);
      });

      return { totalSales, totalActual, totalDiff, count: relevant.length, records: relevant };
  };

  // --- Detail Report Modal ---
  const ReportModal = () => {
    if (!selectedDetailId || !detailType) return null;
    
    const isPOS = detailType === 'pos';
    const stats = isPOS ? getPosStats(selectedDetailId) : getCashierStats(selectedDetailId);
    const title = isPOS ? posPoints.find(p => p.id === selectedDetailId)?.name : cashiers.find(c => c.id === selectedDetailId)?.name;
    const subTitle = isPOS ? 'تقرير أداء نقطة البيع' : 'تقرير أداء الموظف والالتزام المالي';

    return (
        <div className="fixed inset-0 z-[160] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in zoom-in-95 duration-300">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-white/20">
                {/* Header */}
                <div className="p-8 bg-sap-shell text-white flex justify-between items-center relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                {isPOS ? <Monitor className="text-sap-secondary" size={24}/> : <Users className="text-sap-secondary" size={24}/>}
                            </div>
                            <div>
                                <h3 className="text-2xl font-black">{title}</h3>
                                <p className="text-xs font-bold text-sap-secondary uppercase tracking-widest">{subTitle}</p>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setSelectedDetailId(null)} className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all relative z-10">
                        <X size={24}/>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-gray-50/50">
                    {/* Key Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-4 text-emerald-600">
                                <TrendingUp size={20}/>
                                <span className="text-[10px] font-black uppercase">إجمالي المبيعات</span>
                            </div>
                            <div className="text-2xl font-black text-sap-text font-mono">{fmt(stats.totalSales)}</div>
                            <div className="text-[9px] text-gray-400 mt-1">حجم العمليات المسجل</div>
                        </div>

                        {isPOS ? (
                            <>
                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                    <div className="flex items-center gap-3 mb-4 text-sap-primary">
                                        <Wallet size={20}/>
                                        <span className="text-[10px] font-black uppercase">إيراد نقدي</span>
                                    </div>
                                    <div className="text-2xl font-black text-sap-text font-mono">{fmt((stats as any).totalCash)}</div>
                                    <div className="text-[9px] text-gray-400 mt-1">المبالغ الموردة باليد</div>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                    <div className="flex items-center gap-3 mb-4 text-blue-600">
                                        <CreditCard size={20}/>
                                        <span className="text-[10px] font-black uppercase">إيراد شبكة</span>
                                    </div>
                                    <div className="text-2xl font-black text-sap-text font-mono">{fmt((stats as any).networkTotal)}</div>
                                    <div className="text-[9px] text-gray-400 mt-1">التحويلات والبطاقات</div>
                                </div>
                            </>
                        ) : (
                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3 mb-4 text-amber-600">
                                    <Activity size={20}/>
                                    <span className="text-[10px] font-black uppercase">مؤشر الدقة</span>
                                </div>
                                <div className={`text-2xl font-black font-mono ${(stats as any).totalDiff < 0 ? 'text-red-500' : (stats as any).totalDiff > 0 ? 'text-blue-500' : 'text-emerald-500'}`}>
                                    {(stats as any).totalDiff > 0 ? '+' : ''}{fmt((stats as any).totalDiff)}
                                </div>
                                <div className="text-[9px] text-gray-400 mt-1">إجمالي الفارق المالي</div>
                            </div>
                        )}

                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-4 text-indigo-600">
                                <Receipt size={20}/>
                                <span className="text-[10px] font-black uppercase">عدد التسويات</span>
                            </div>
                            <div className="text-2xl font-black text-sap-text font-mono">{stats.count}</div>
                            <div className="text-[9px] text-gray-400 mt-1">إغلاقات الوردية</div>
                        </div>
                    </div>

                    {/* Records Table */}
                    <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h4 className="font-black text-sm text-slate-700 flex items-center gap-2"><History size={16}/> سجل العمليات التاريخي</h4>
                            <span className="text-[10px] font-black text-gray-400 uppercase">Financial Audit Log</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-xs">
                                <thead>
                                    <tr className="bg-gray-100/50 text-gray-400 font-black uppercase tracking-widest border-b">
                                        <th className="px-6 py-4">التاريخ</th>
                                        <th className="px-6 py-4 text-center">المبيعات</th>
                                        <th className="px-6 py-4 text-center">المورد</th>
                                        <th className="px-6 py-4 text-center">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 font-bold">
                                    {stats.records.map(s => {
                                        const netTotal = (s.networks || []).reduce((a, n) => a + (n.amount || 0), 0) + (s.transfers || []).reduce((a, t) => a + (t.amount || 0), 0);
                                        const expected = s.totalSales - netTotal;
                                        const diff = s.actualCash - expected;
                                        return (
                                            <tr key={s.id} className="hover:bg-sap-highlight/20 transition-all">
                                                <td className="px-6 py-4 font-mono text-sap-primary">{s.date}</td>
                                                <td className="px-6 py-4 text-center font-mono">{fmt(s.totalSales)}</td>
                                                <td className="px-6 py-4 text-center font-mono text-slate-800">{fmt(s.actualCash)}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black ${diff === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                        {diff === 0 ? 'مطابق' : `${diff > 0 ? '+' : ''}${fmt(diff)}`}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {stats.records.length === 0 && <tr><td colSpan={4} className="py-16 text-center text-gray-300 italic">لا يوجد سجلات لهذه النقطة حالياً</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-white border-t border-gray-100 flex justify-end">
                    <button onClick={() => setSelectedDetailId(null)} className="px-8 py-3 bg-sap-shell text-white rounded-2xl font-black text-xs hover:bg-black transition-all">إغلاق التقرير</button>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Detail Report Rendering */}
      <ReportModal />

      {/* Header Panel */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-sap-border shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-sap-highlight text-sap-primary rounded-[2rem] flex items-center justify-center shadow-inner">
            <Monitor size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-sap-text">إدارة نقاط البيع والكادر</h2>
            <p className="text-xs text-sap-text-variant font-bold uppercase tracking-widest mt-1">تجهيز هيكل الكاشير وربطه بالفروع والتقارير</p>
          </div>
        </div>

        <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200 w-full md:w-auto">
          <button onClick={() => setActiveTab('points')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'points' ? 'bg-white text-sap-primary shadow-sm' : 'text-gray-400 hover:text-sap-primary'}`}>
            <LayoutGrid size={16}/> نقاط البيع
          </button>
          <button onClick={() => setActiveTab('cashiers')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'cashiers' ? 'bg-white text-sap-primary shadow-sm' : 'text-gray-400 hover:text-sap-primary'}`}>
            <Users size={16}/> الكاشيرية
          </button>
        </div>
      </div>

      {/* Toolbar & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center px-2">
         <div className="relative flex-1 w-full">
            <input 
              type="text" 
              placeholder={activeTab === 'points' ? "البحث عن نقطة بيع..." : "البحث عن موظف كاشير..."} 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full !pr-12 !py-4 !bg-white !border-gray-200 !rounded-2xl !text-sm !font-bold shadow-sm focus:!border-sap-primary"
            />
            <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300" />
         </div>
         <button onClick={() => handleOpenModal()} className="w-full md:w-auto bg-sap-primary text-white px-10 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-lg shadow-sap-primary/20 hover:bg-sap-primary-hover active:scale-95 transition-all">
            <Plus size={20}/> {activeTab === 'points' ? 'إضافة نقطة بيع' : 'إضافة كاشير'}
         </button>
      </div>

      {/* Data Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeTab === 'points' ? (
          filteredPoints.map(point => {
            const stats = getPosStats(point.id);
            return (
              <div key={point.id} className="bg-white p-6 rounded-[2.5rem] border border-sap-border shadow-sm hover:shadow-xl transition-all duration-500 group relative overflow-hidden">
                  <div className="flex justify-between items-start mb-6">
                      <div className="w-14 h-14 bg-sap-highlight text-sap-primary rounded-2xl flex items-center justify-center shadow-inner">
                          <Smartphone size={28} />
                      </div>
                      <div className="flex gap-1">
                          <button onClick={() => { setDetailType('pos'); setSelectedDetailId(point.id); }} className="p-2.5 text-sap-primary hover:bg-sap-highlight rounded-xl border border-transparent hover:border-sap-primary/20 transition-all" title="تقرير الأداء"><Eye size={18}/></button>
                          <button onClick={() => handleOpenModal(point)} className="p-2.5 text-blue-500 hover:bg-blue-50 rounded-xl" title="تعديل"><Edit2 size={18}/></button>
                          <button onClick={() => handleDelete(point.id)} className="p-2.5 text-red-400 hover:bg-red-50 rounded-xl" title="حذف"><Trash2 size={18}/></button>
                      </div>
                  </div>
                  <h3 className="font-black text-xl text-sap-text mb-2 group-hover:text-sap-primary transition-colors">{point.name}</h3>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-tighter mb-6">
                      <Building2 size={14} className="text-sap-secondary" />
                      الفرع: <span className="text-sap-primary font-black">{branches.find(b => b.id === point.branchId)?.name || 'غير مرتبط'}</span>
                  </div>
                  
                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-50">
                      <div className="bg-gray-50 p-3 rounded-2xl">
                          <div className="text-[8px] font-black text-gray-400 uppercase mb-1">إجمالي المبيعات</div>
                          <div className="text-sm font-black text-sap-text font-mono truncate">{fmt(stats.totalSales)}</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-2xl">
                          <div className="text-[8px] font-black text-gray-400 uppercase mb-1">معدل الدقة</div>
                          <div className="text-sm font-black text-emerald-600">100%</div>
                      </div>
                  </div>
              </div>
            );
          })
        ) : (
          filteredCashiers.map(cashier => {
            const stats = getCashierStats(cashier.id);
            return (
              <div key={cashier.id} className="bg-white p-6 rounded-[2.5rem] border border-sap-border shadow-sm hover:shadow-xl transition-all duration-500 group relative overflow-hidden">
                  <div className="flex justify-between items-start mb-6">
                      <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
                          <Users size={28} />
                      </div>
                      <div className="flex gap-1">
                          <button onClick={() => { setDetailType('cashier'); setSelectedDetailId(cashier.id); }} className="p-2.5 text-amber-600 hover:bg-amber-50 rounded-xl border border-transparent hover:border-amber-200 transition-all" title="تقرير أداء الموظف"><Eye size={18}/></button>
                          <button onClick={() => handleOpenModal(cashier)} className="p-2.5 text-blue-500 hover:bg-blue-50 rounded-xl" title="تعديل"><Edit2 size={18}/></button>
                          <button onClick={() => handleDelete(cashier.id)} className="p-2.5 text-red-400 hover:bg-red-50 rounded-xl" title="حذف"><Trash2 size={18}/></button>
                      </div>
                  </div>
                  <h3 className="font-black text-xl text-sap-text mb-1 group-hover:text-amber-600 transition-colors">{cashier.name}</h3>
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-[3px] mb-6">Certified Store Officer</p>
                  
                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-50">
                      <div className="bg-gray-50 p-3 rounded-2xl">
                          <div className="text-[8px] font-black text-gray-400 uppercase mb-1">العهدة الموردة</div>
                          <div className="text-sm font-black text-sap-text font-mono truncate">{fmt(stats.totalActual)}</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-2xl">
                          <div className="text-[8px] font-black text-gray-400 uppercase mb-1">صافي الفارق</div>
                          <div className={`text-sm font-black font-mono ${stats.totalDiff < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                              {stats.totalDiff === 0 ? '٠' : `${stats.totalDiff > 0 ? '+' : ''}${fmt(stats.totalDiff)}`}
                          </div>
                      </div>
                  </div>
              </div>
            );
          })
        )}

        {(activeTab === 'points' ? filteredPoints : filteredCashiers).length === 0 && !isLoading && (
            <div className="col-span-full py-32 text-center flex flex-col items-center justify-center opacity-20">
                <Search size={64} className="mb-4" />
                <p className="text-xl font-black italic">لا يوجد نتائج لعرضها حالياً</p>
            </div>
        )}
      </div>

      {/* Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="p-6 bg-sap-shell text-white flex justify-between items-center">
              <h3 className="font-black text-lg flex items-center gap-3">
                {activeTab === 'points' ? <Monitor size={20}/> : <UserPlus size={20}/>}
                {editingItem ? 'تعديل البيانات' : (activeTab === 'points' ? 'تعريف نقطة بيع' : 'إضافة كاشير')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={20}/></button>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">الاسم التعريفي</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder={activeTab === 'points' ? "مثال: كاشير الاستقبال" : "مثال: أحمد محمد"}
                  className="w-full !p-4 !text-sm !font-black !bg-gray-50 border-gray-100 rounded-2xl focus:!border-sap-primary transition-all"
                  autoFocus
                />
              </div>

              {activeTab === 'points' && (
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">الفرع المرتبط</label>
                    <select 
                      value={branchId} 
                      onChange={e => setBranchId(e.target.value)}
                      className="w-full !p-4 !text-sm !font-black !bg-gray-50 border-gray-100 rounded-2xl focus:!border-sap-primary"
                    >
                      <option value="">-- اختر الفرع --</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-xs font-black text-gray-500 hover:bg-gray-50 rounded-2xl">إلغاء</button>
                <button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="flex-[2] py-4 bg-sap-primary text-white rounded-2xl font-black text-xs shadow-lg shadow-sap-primary/20 hover:bg-sap-primary-hover flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16}/>}
                  {editingItem ? 'تحديث البيانات' : 'حفظ وإضافة'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
