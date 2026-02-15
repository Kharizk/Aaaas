
import React, { useState, useEffect, useMemo } from 'react';
import { Product, DailySales, Customer, POSPoint, Network, HeldOrder } from '../types';
import { db } from '../services/supabase';
import { useNotification } from './Notifications';
import { 
  DollarSign, CreditCard, Users, Save, Loader2, 
  ArrowLeftRight, Wallet, History, Search, UserPlus, CheckCircle2, Monitor, Wifi, Landmark, AlertCircle, Clock, PauseCircle, PlayCircle, Trash2, LayoutGrid
} from 'lucide-react';

interface POSInterfaceProps {
  products: Product[]; 
  setDailySales: React.Dispatch<React.SetStateAction<DailySales[]>>;
}

export const POSInterface: React.FC<POSInterfaceProps> = ({ products, setDailySales }) => {
  const { notify } = useNotification();
  const [activeTab, setActiveTab] = useState<'general' | 'customer'>('general');
  const [isProcessing, setIsProcessing] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [posPoints, setPosPoints] = useState<POSPoint[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  
  // Selection State
  const [selectedPosId, setSelectedPosId] = useState<string>('');

  // --- General Sales State ---
  const [cashAmount, setCashAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState(''); 
  const [networkAmounts, setNetworkAmounts] = useState<{[key: string]: string}>({});
  const [generalNotes, setGeneralNotes] = useState('');

  // --- Customer Transaction State ---
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [custAmount, setCustAmount] = useState('');
  const [custOpType, setCustOpType] = useState<'sale' | 'payment'>('sale');
  const [custPaymentMethod, setCustPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'credit'>('cash');
  const [selectedNetworkId, setSelectedNetworkId] = useState<string>('');
  const [isTransferReceived, setIsTransferReceived] = useState<boolean>(true); 
  const [custNotes, setCustNotes] = useState('');
  const [custSearch, setCustSearch] = useState('');

  // --- HELD ORDERS STATE ---
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [showHeldModal, setShowHeldModal] = useState(false);

  useEffect(() => {
      const loadData = async () => {
          const [cData, pData, nData] = await Promise.all([
              db.customers.getAll(),
              db.posPoints.getAll(),
              db.networks.getAll()
          ]);
          setCustomers(cData as Customer[]);
          setPosPoints(pData as POSPoint[]);
          setNetworks(nData as Network[]);
          if (pData.length > 0) setSelectedPosId(pData[0].id);
          const savedHeld = localStorage.getItem('sf_held_orders');
          if (savedHeld) setHeldOrders(JSON.parse(savedHeld));
      };
      loadData();
  }, []);

  useEffect(() => {
      localStorage.setItem('sf_held_orders', JSON.stringify(heldOrders));
  }, [heldOrders]);

  const handleNetworkAmountChange = (netId: string, val: string) => {
      setNetworkAmounts(prev => ({ ...prev, [netId]: val }));
  };

  const handleHoldOrder = () => {
      if (!custAmount) return notify('لا يوجد مبلغ للتعليق', 'error');
      const newHeld: HeldOrder = {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          customerName: customers.find(c => c.id === selectedCustomerId)?.name || 'غير محدد',
          amount: parseFloat(custAmount),
          note: custNotes || 'بدون ملاحظات',
          rawCartData: { selectedCustomerId, custOpType, custPaymentMethod, selectedNetworkId }
      };
      setHeldOrders(prev => [newHeld, ...prev]);
      setCustAmount('');
      setCustNotes('');
      setSelectedCustomerId('');
      notify('تم تعليق الفاتورة بنجاح', 'info');
  };

  const handleResumeOrder = (order: HeldOrder) => {
      setCustAmount(order.amount.toString());
      setCustNotes(order.note || '');
      if (order.rawCartData) {
          setSelectedCustomerId(order.rawCartData.selectedCustomerId || '');
          setCustOpType(order.rawCartData.custOpType || 'sale');
          setCustPaymentMethod(order.rawCartData.custPaymentMethod || 'cash');
          setSelectedNetworkId(order.rawCartData.selectedNetworkId || '');
      }
      setHeldOrders(prev => prev.filter(h => h.id !== order.id));
      setShowHeldModal(false);
      setActiveTab('customer');
      notify('تم استعادة الفاتورة', 'success');
  };

  const handleDeleteHeld = (id: string) => {
      setHeldOrders(prev => prev.filter(h => h.id !== id));
  };

  const handleQuickAdd = (product: Product) => {
      if (!product.price) return;
      if (activeTab === 'general') {
          // If in general mode, assume cash sale add
          const current = parseFloat(cashAmount) || 0;
          setCashAmount((current + parseFloat(product.price)).toString());
          // Optional: Add to notes
          const noteToAdd = `${product.name}`;
          setGeneralNotes(prev => prev ? `${prev}, ${noteToAdd}` : noteToAdd);
          notify(`تم إضافة ${product.price} ريال (${product.name})`, 'success');
      } else {
          // If in customer mode
          const current = parseFloat(custAmount) || 0;
          setCustAmount((current + parseFloat(product.price)).toString());
          const noteToAdd = `${product.name}`;
          setCustNotes(prev => prev ? `${prev}, ${noteToAdd}` : noteToAdd);
          notify(`تم إضافة ${product.price} ريال (${product.name})`, 'success');
      }
  };

  const handleSaveGeneral = async () => {
      const cash = parseFloat(cashAmount) || 0;
      const transfer = parseFloat(transferAmount) || 0;
      let hasNetworkSales = false;
      Object.keys(networkAmounts).forEach(key => {
          if (parseFloat(networkAmounts[key]) > 0) hasNetworkSales = true;
      });

      if (cash === 0 && transfer === 0 && !hasNetworkSales) {
          notify("الرجاء إدخال مبلغ للمبيعات", 'warning');
          return;
      }
      if (!selectedPosId) {
          notify("الرجاء اختيار نقطة البيع", 'error');
          return;
      }

      setIsProcessing(true);
      try {
          const batch: Promise<any>[] = [];
          const date = new Date().toISOString().split('T')[0];
          const activePos = posPoints.find(p => p.id === selectedPosId);

          if (cash > 0) {
              batch.push(db.dailySales.upsert({
                  id: crypto.randomUUID(), date, totalAmount: cash, paidAmount: cash, remainingAmount: 0, paymentMethod: 'cash', transactionType: 'sale', isPending: false, isClosed: false, customerName: 'مبيعات عامة (نقدية)', notes: generalNotes ? `${generalNotes} (Cash)` : 'إيراد يومي نقدي', amount: cash, posPointId: selectedPosId, branchId: activePos?.branchId
              }));
          }
          if (transfer > 0) {
              batch.push(db.dailySales.upsert({
                  id: crypto.randomUUID(), date, totalAmount: transfer, paidAmount: transfer, remainingAmount: 0, paymentMethod: 'transfer', transactionType: 'sale', isPending: false, isClosed: false, customerName: 'مبيعات عامة (تحويل)', notes: generalNotes ? `${generalNotes} (Bank Transfer)` : 'إيراد يومي تحويل بنكي', amount: transfer, posPointId: selectedPosId, branchId: activePos?.branchId
              }));
          }
          for (const netId of Object.keys(networkAmounts)) {
              const amount = parseFloat(networkAmounts[netId]);
              if (amount > 0) {
                  const networkName = networks.find(n => n.id === netId)?.name || 'Unknown Network';
                  batch.push(db.dailySales.upsert({
                      id: crypto.randomUUID(), date, totalAmount: amount, paidAmount: amount, remainingAmount: 0, paymentMethod: 'card', transactionType: 'sale', isPending: false, isClosed: false, customerName: `مبيعات شبكة (${networkName})`, notes: generalNotes ? `${generalNotes} (${networkName})` : `إيراد ${networkName}`, amount: amount, posPointId: selectedPosId, networkId: netId, branchId: activePos?.branchId
                  }));
              }
          }

          await Promise.all(batch);
          const newRecords = await db.dailySales.getAll();
          setDailySales(newRecords as DailySales[]);
          notify("تم تسجيل الإيراد اليومي بنجاح", 'success');
          setCashAmount(''); setTransferAmount(''); setNetworkAmounts({}); setGeneralNotes('');
      } catch (e) { notify("حدث خطأ أثناء الحفظ", 'error'); } finally { setIsProcessing(false); }
  };

  const handleSaveCustomerTxn = async () => {
      // (Similar to previous implementation, keeping concise for update)
      if (!selectedCustomerId || !custAmount) { notify("الرجاء اختيار العميل وتحديد المبلغ", 'warning'); return; }
      if (!selectedPosId) return notify("اختر نقطة البيع", 'error');
      
      const amount = parseFloat(custAmount);
      if (amount <= 0) return notify("المبلغ يجب أن يكون أكبر من صفر", 'warning');
      if (custOpType === 'sale' && custPaymentMethod === 'card' && !selectedNetworkId) return notify("يرجى تحديد الشبكة المستخدمة للدفع", 'warning');

      setIsProcessing(true);
      try {
          const customer = customers.find(c => c.id === selectedCustomerId);
          const activePos = posPoints.find(p => p.id === selectedPosId);
          const date = new Date().toISOString().split('T')[0];
          
          let saleRecord: DailySales = {
              id: crypto.randomUUID(),
              date,
              totalAmount: custOpType === 'payment' ? 0 : amount,
              paidAmount: custOpType === 'payment' ? amount : (custPaymentMethod === 'credit' ? 0 : amount),
              remainingAmount: custOpType === 'sale' && custPaymentMethod === 'credit' ? amount : 0,
              paymentMethod: custOpType === 'payment' ? 'cash' : custPaymentMethod,
              transactionType: custOpType === 'payment' ? 'collection' : 'sale',
              isPending: custPaymentMethod === 'transfer' && !isTransferReceived,
              isClosed: false,
              customerName: customer?.name || 'عميل',
              linkedSaleId: customer?.id,
              notes: custNotes || (custOpType === 'payment' ? 'سداد دفعة' : `عملية بيع (${custPaymentMethod})`),
              amount: amount,
              posPointId: selectedPosId,
              branchId: activePos?.branchId,
              networkId: custPaymentMethod === 'card' ? selectedNetworkId : undefined
          };

          await db.dailySales.upsert(saleRecord);
          const newRecords = await db.dailySales.getAll();
          setDailySales(newRecords as DailySales[]);
          notify("تم تسجيل العملية بنجاح", 'success');
          setCustAmount(''); setCustNotes('');
      } catch (e) { notify("خطأ في العملية", 'error'); } finally { setIsProcessing(false); }
  };

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone.includes(custSearch));
  // Get top products (simulated by taking first 12 with valid prices)
  const quickProducts = products.filter(p => p.price && parseFloat(p.price) > 0).slice(0, 12);

  return (
    <div className="flex flex-col h-full bg-gray-50 animate-in fade-in space-y-4 p-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-3xl border border-gray-200 shadow-sm shrink-0">
             <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
                <button onClick={() => setActiveTab('general')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all ${activeTab === 'general' ? 'bg-sap-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <DollarSign size={16}/> الإيراد العام
                </button>
                <button onClick={() => setActiveTab('customer')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all ${activeTab === 'customer' ? 'bg-sap-secondary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <Users size={16}/> حساب عميل
                </button>
                {heldOrders.length > 0 && (
                    <button onClick={() => setShowHeldModal(true)} className="px-4 py-2.5 rounded-lg text-xs font-black bg-orange-100 text-orange-600 flex items-center gap-2 animate-pulse">
                        <PauseCircle size={16}/> ({heldOrders.length}) معلق
                    </button>
                )}
            </div>
            <div className="flex items-center gap-3 bg-blue-50 p-2 pl-4 rounded-2xl border border-blue-100 w-full md:w-auto">
                <Monitor size={20} className="text-blue-600"/>
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-blue-400 uppercase">نقطة البيع الحالية</span>
                    <select value={selectedPosId} onChange={(e) => setSelectedPosId(e.target.value)} className="bg-transparent border-none p-0 text-sm font-black text-blue-900 focus:ring-0 cursor-pointer">
                        {posPoints.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        {posPoints.length === 0 && <option value="">لا توجد نقاط بيع</option>}
                    </select>
                </div>
            </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
            
            {/* Quick Access Grid (Left Panel) */}
            <div className="hidden lg:flex flex-col w-1/3 bg-white border border-gray-200 rounded-[2rem] p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-4 px-2">
                    <LayoutGrid size={18} className="text-sap-primary"/>
                    <span className="font-black text-sm text-gray-700">الوصول السريع</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto custom-scrollbar flex-1 pr-1">
                    {quickProducts.map(p => (
                        <button 
                            key={p.id} 
                            onClick={() => handleQuickAdd(p)}
                            className="bg-gray-50 hover:bg-sap-highlight hover:border-sap-primary border border-gray-200 rounded-xl p-3 flex flex-col items-center justify-center text-center gap-1 transition-all active:scale-95 group"
                        >
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-black shadow-sm group-hover:bg-sap-primary group-hover:text-white transition-colors">
                                {p.name.charAt(0)}
                            </div>
                            <span className="text-[10px] font-bold line-clamp-2 leading-tight h-8 flex items-center">{p.name}</span>
                            <span className="text-xs font-black text-sap-primary">{p.price}</span>
                        </button>
                    ))}
                    {quickProducts.length === 0 && <div className="col-span-3 text-center text-gray-400 py-10 text-xs">أضف منتجات بأسعار لعرضها هنا</div>}
                </div>
            </div>

            {/* Main Form Panel (Right Panel) */}
            <div className="flex-1 overflow-y-auto flex justify-center">
                {activeTab === 'general' && (
                    <div className="w-full max-w-lg bg-white border border-gray-200 rounded-[2rem] p-8 shadow-sm space-y-4 h-fit">
                        <div className="text-center mb-4">
                            <h2 className="text-2xl font-black text-gray-800">الإيراد اليومي</h2>
                            <p className="text-sm text-gray-400 font-bold mt-1">تسجيل مبيعات سريعة (بدون عميل)</p>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center justify-between">
                            <label className="flex items-center gap-2 text-emerald-700 font-black text-sm"><Wallet size={20}/> نقدية (الكاش)</label>
                            <input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} className="w-40 p-3 text-xl font-mono font-black text-emerald-700 bg-white border-2 border-emerald-200 rounded-xl focus:ring-0 text-center" placeholder="0.00" />
                        </div>
                        <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 flex items-center justify-between">
                            <label className="flex items-center gap-2 text-purple-700 font-black text-sm"><Landmark size={20}/> تحويل بنكي</label>
                            <input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} className="w-40 p-3 text-xl font-mono font-black text-purple-700 bg-white border-2 border-purple-200 rounded-xl focus:ring-0 text-center" placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                            {networks.map(net => (
                                <div key={net.id} className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center justify-between">
                                    <label className="flex items-center gap-2 text-blue-700 font-black text-sm"><Wifi size={20}/> {net.name}</label>
                                    <input type="number" value={networkAmounts[net.id] || ''} onChange={e => handleNetworkAmountChange(net.id, e.target.value)} className="w-40 p-3 text-xl font-mono font-black text-blue-700 bg-white border-2 border-blue-200 rounded-xl focus:ring-0 text-center" placeholder="0.00" />
                                </div>
                            ))}
                        </div>
                        <div className="pt-4 border-t border-gray-100">
                            <textarea value={generalNotes} onChange={e => setGeneralNotes(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl text-sm" placeholder="ملاحظات..." rows={2}/>
                        </div>
                        <button onClick={handleSaveGeneral} disabled={isProcessing} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 active:scale-95">
                            {isProcessing ? <Loader2 className="animate-spin"/> : <Save size={20}/>} حفظ الإيراد
                        </button>
                    </div>
                )}

                {activeTab === 'customer' && (
                    <div className="w-full max-w-lg bg-white border border-gray-200 rounded-[2rem] p-6 shadow-sm flex flex-col gap-5 h-fit">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500">1. اختيار العميل</label>
                            <div className="relative">
                                <input type="text" value={custSearch} onChange={e => setCustSearch(e.target.value)} placeholder="بحث عن عميل..." className="w-full p-3 pl-10 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm focus:bg-white focus:border-sap-secondary transition-all"/>
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                            </div>
                            <div className="max-h-24 overflow-y-auto border border-gray-100 rounded-xl custom-scrollbar">
                                {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                                    <div key={c.id} onClick={() => setSelectedCustomerId(c.id)} className={`p-3 flex justify-between items-center cursor-pointer transition-colors border-b border-gray-50 last:border-0 ${selectedCustomerId === c.id ? 'bg-sap-secondary text-white' : 'hover:bg-gray-50'}`}>
                                        <span className="font-bold text-sm">{c.name}</span>
                                        <span className={`text-[10px] ${selectedCustomerId === c.id ? 'text-white/80' : 'text-gray-400'}`}>{c.phone}</span>
                                    </div>
                                )) : <div className="p-4 text-center text-gray-400 text-xs">لا يوجد نتائج.</div>}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-black text-gray-500 mb-2 block">2. مبلغ العملية</label>
                            <input type="number" value={custAmount} onChange={e => setCustAmount(e.target.value)} className="w-full p-4 bg-gray-50 border-transparent rounded-2xl text-3xl font-black text-center focus:ring-2 focus:ring-sap-primary focus:bg-white transition-all" placeholder="0.00" />
                        </div>
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                            <label className="text-xs font-black text-gray-500 block">3. نوع العملية</label>
                            <div className="flex gap-2">
                                <button onClick={() => setCustOpType('sale')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${custOpType === 'sale' ? 'bg-sap-primary text-white shadow-md' : 'bg-white border border-gray-200 text-gray-500'}`}>فاتورة بيع</button>
                                <button onClick={() => setCustOpType('payment')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${custOpType === 'payment' ? 'bg-green-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-500'}`}>سند قبض</button>
                            </div>
                            {custOpType === 'sale' && (
                                <div className="animate-in slide-in-from-top-2 pt-2 border-t border-gray-200">
                                    <label className="text-[10px] font-bold text-gray-400 block mb-2">طريقة الدفع:</label>
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <button onClick={() => setCustPaymentMethod('cash')} className={`py-2 rounded-lg text-[10px] font-bold border ${custPaymentMethod === 'cash' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-gray-200'}`}>كاش</button>
                                        <button onClick={() => setCustPaymentMethod('card')} className={`py-2 rounded-lg text-[10px] font-bold border ${custPaymentMethod === 'card' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200'}`}>شبكة</button>
                                        <button onClick={() => setCustPaymentMethod('transfer')} className={`py-2 rounded-lg text-[10px] font-bold border ${custPaymentMethod === 'transfer' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-white border-gray-200'}`}>تحويل</button>
                                        <button onClick={() => setCustPaymentMethod('credit')} className={`py-2 rounded-lg text-[10px] font-bold border ${custPaymentMethod === 'credit' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-gray-200'}`}>آجل</button>
                                    </div>
                                    {custPaymentMethod === 'card' && (
                                        <select value={selectedNetworkId} onChange={e => setSelectedNetworkId(e.target.value)} className="w-full p-2 text-xs font-bold border border-blue-200 rounded-lg bg-blue-50 focus:border-blue-500 mb-2">
                                            <option value="">-- اختر الشبكة --</option>
                                            {networks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                                        </select>
                                    )}
                                </div>
                            )}
                        </div>
                        <input type="text" value={custNotes} onChange={e => setCustNotes(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl text-sm font-bold" placeholder="بيان العملية..."/>
                        <div className="flex gap-2">
                            <button onClick={handleHoldOrder} disabled={!custAmount} className="px-6 py-4 bg-orange-100 text-orange-600 rounded-2xl font-black text-xs hover:bg-orange-200 transition-all flex items-center justify-center" title="تعليق"><PauseCircle size={18} /></button>
                            <button onClick={handleSaveCustomerTxn} disabled={isProcessing || !selectedCustomerId} className={`flex-1 py-4 text-white rounded-2xl font-black text-sm shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ${custOpType === 'payment' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-900 hover:bg-black'}`}>
                                {isProcessing ? <Loader2 className="animate-spin"/> : <Save size={18}/>} {custOpType === 'sale' ? 'حفظ الفاتورة' : 'حفظ السند'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* HELD ORDERS MODAL - Keeping existing modal logic */}
        {showHeldModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                    <div className="p-6 bg-orange-500 text-white flex justify-between items-center">
                        <h3 className="font-black text-lg flex items-center gap-2"><PauseCircle/> الفواتير المعلقة</h3>
                        <button onClick={() => setShowHeldModal(false)}><CheckCircle2/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                        {heldOrders.length === 0 && <div className="text-center py-10 text-gray-400">لا توجد فواتير معلقة</div>}
                        {heldOrders.map(order => (
                            <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
                                <div>
                                    <div className="font-black text-gray-800">{order.customerName}</div>
                                    <div className="text-xs text-gray-500 mt-1">{new Date(order.date).toLocaleString('ar-SA')}</div>
                                    <div className="text-xs text-orange-600 font-bold mt-1">{order.note}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-lg font-black text-sap-primary font-mono">{order.amount}</div>
                                    <button onClick={() => handleResumeOrder(order)} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100" title="استعادة"><PlayCircle size={18}/></button>
                                    <button onClick={() => handleDeleteHeld(order.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100" title="حذف"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
