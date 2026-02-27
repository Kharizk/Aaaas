import React, { useState, useEffect } from 'react';
import { Product, DailySales, Customer, POSPoint, Network, HeldOrder } from '../types';
import { db } from '../services/supabase';
import { useNotification } from './Notifications';
import { 
  DollarSign, Users, Save, Loader2, Monitor, Search, 
  PauseCircle, PlayCircle, Trash2, LayoutGrid, CheckCircle2, ChevronRight, X, User
} from 'lucide-react';

interface POSInterfaceProps {
  products: Product[]; 
  setDailySales: React.Dispatch<React.SetStateAction<DailySales[]>>;
}

export const POSInterface: React.FC<POSInterfaceProps> = ({ products, setDailySales }) => {
  const { notify } = useNotification();
  const [activeTab, setActiveTab] = useState<'general' | 'customer'>('general');
  const [posPoints, setPosPoints] = useState<POSPoint[]>([]);
  const [selectedPosId, setSelectedPosId] = useState<string>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  
  // Amounts
  const [cashAmount, setCashAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Held Orders
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [showHeldOrders, setShowHeldOrders] = useState(false);

  useEffect(() => {
      const load = async () => {
          const [pp, cust] = await Promise.all([
              db.posPoints.getAll(),
              db.customers.getAll()
          ]);
          setPosPoints(pp);
          setCustomers(cust);
          if (pp.length > 0) setSelectedPosId(pp[0].id);

          // Load held orders from local storage
          const savedHeld = localStorage.getItem('pos_held_orders');
          if (savedHeld) {
              try { setHeldOrders(JSON.parse(savedHeld)); } catch (e) {}
          }
      };
      load();
  }, []);

  const saveHeldOrders = (orders: HeldOrder[]) => {
      setHeldOrders(orders);
      localStorage.setItem('pos_held_orders', JSON.stringify(orders));
  };

  const handleHoldSale = () => {
      if (!cashAmount || parseFloat(cashAmount) <= 0) return notify('أدخل المبلغ للتعليق', 'warning');
      
      const order: HeldOrder = {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          amount: parseFloat(cashAmount),
          note: notes,
          customerName: customers.find(c => c.id === selectedCustomerId)?.name || 'عميل عام',
          rawCartData: { selectedCustomerId, selectedPosId } // Store context
      };

      saveHeldOrders([...heldOrders, order]);
      setCashAmount('');
      setNotes('');
      setSelectedCustomerId('');
      notify('تم تعليق العملية', 'success');
  };

  const handleRetrieveOrder = (order: HeldOrder) => {
      setCashAmount(order.amount.toString());
      setNotes(order.note || '');
      if (order.rawCartData?.selectedCustomerId) setSelectedCustomerId(order.rawCartData.selectedCustomerId);
      if (order.rawCartData?.selectedPosId) setSelectedPosId(order.rawCartData.selectedPosId);
      
      // Remove from held
      saveHeldOrders(heldOrders.filter(o => o.id !== order.id));
      setShowHeldOrders(false);
      notify('تم استرجاع العملية', 'info');
  };

  const handleDeleteHeldOrder = (id: string) => {
      saveHeldOrders(heldOrders.filter(o => o.id !== id));
  };

  const handleSave = async () => {
      if (!cashAmount || parseFloat(cashAmount) <= 0) return notify('أدخل المبلغ', 'error');
      if (!selectedPosId) return notify('اختر نقطة البيع', 'warning');
      
      setIsProcessing(true);
      try {
          const amount = parseFloat(cashAmount);
          const activePos = posPoints.find(p => p.id === selectedPosId);
          const customer = customers.find(c => c.id === selectedCustomerId);
          
          await db.dailySales.upsert({
              id: crypto.randomUUID(),
              date: new Date().toISOString().split('T')[0],
              totalAmount: amount, paidAmount: amount, remainingAmount: 0,
              paymentMethod: 'cash', transactionType: 'sale', isPending: false, isClosed: false,
              customerName: customer ? customer.name : 'مبيعات نقدية سريعة',
              notes: notes || 'POS Entry',
              amount: amount,
              posPointId: selectedPosId,
              branchId: activePos?.branchId
          });
          
          setCashAmount(''); setNotes(''); setSelectedCustomerId('');
          notify('تم التسجيل بنجاح', 'success');
      } catch (e) { notify('خطأ', 'error'); }
      finally { setIsProcessing(false); }
  };

  return (
    <div className="h-full bg-sap-background flex flex-col p-4 animate-in fade-in">
        {/* Header */}
        <div className="bg-sap-shell text-white p-4 rounded-xl flex justify-between items-center shadow-lg mb-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-sap-secondary rounded-lg"><DollarSign size={24} color="white"/></div>
                <div>
                    <h1 className="text-xl font-bold">نقطة البيع السريعة</h1>
                    <div className="text-[10px] opacity-70">نظام تسجيل النقد المباشر</div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {heldOrders.length > 0 && (
                    <button onClick={() => setShowHeldOrders(true)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors animate-pulse">
                        <PauseCircle size={16} />
                        عمليات معلقة ({heldOrders.length})
                    </button>
                )}
                <select value={selectedPosId} onChange={e => setSelectedPosId(e.target.value)} className="bg-sap-shell border border-sap-secondary text-white text-sm rounded px-3 py-1 font-bold outline-none">
                    {posPoints.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
        </div>

        <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Left: Input Pad */}
            <div className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm p-8 flex flex-col justify-center max-w-2xl mx-auto relative">
                
                {/* Tabs */}
                <div className="absolute top-4 left-4 right-4 flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('general')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${activeTab === 'general' ? 'bg-white shadow-sm text-sap-primary' : 'text-gray-500'}`}>عام</button>
                    <button onClick={() => setActiveTab('customer')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${activeTab === 'customer' ? 'bg-white shadow-sm text-sap-primary' : 'text-gray-500'}`}>العميل</button>
                </div>

                <div className="mt-12 text-center mb-8">
                    <label className="text-gray-500 font-bold text-sm block mb-2">المبلغ النقدي</label>
                    <div className="relative max-w-xs mx-auto">
                        <input 
                            type="number" 
                            value={cashAmount} 
                            onChange={e => setCashAmount(e.target.value)} 
                            className="w-full text-5xl font-black text-center text-sap-shell border-b-4 border-sap-secondary focus:border-sap-primary outline-none pb-2 bg-transparent placeholder-gray-200"
                            placeholder="0.00"
                            autoFocus
                        />
                        <span className="absolute left-0 bottom-4 text-gray-400 font-bold text-sm">SAR</span>
                    </div>
                </div>

                {activeTab === 'customer' && (
                    <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                        <label className="text-xs font-bold text-gray-500 block mb-2">العميل</label>
                        <div className="relative">
                            <select 
                                value={selectedCustomerId} 
                                onChange={e => setSelectedCustomerId(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg font-bold text-sm outline-none focus:border-sap-primary appearance-none"
                            >
                                <option value="">-- عميل عام (بدون تحديد) --</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>)}
                            </select>
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-4 gap-3 mb-8">
                    {[1, 5, 10, 50, 100, 500].map(v => (
                        <button key={v} onClick={() => setCashAmount((parseFloat(cashAmount || '0') + v).toString())} className="bg-sap-shell/10 hover:bg-sap-secondary hover:text-white text-sap-shell font-black py-4 rounded-lg transition-colors text-lg">
                            +{v}
                        </button>
                    ))}
                    <button onClick={() => setCashAmount('')} className="col-span-2 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100">مسح</button>
                </div>

                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold mb-4" placeholder="ملاحظة سريعة (اختياري)..." />

                <div className="flex gap-3">
                    <button onClick={handleHoldSale} className="flex-1 bg-amber-100 text-amber-700 py-5 rounded-xl text-sm font-bold hover:bg-amber-200 transition-colors flex flex-col items-center justify-center gap-1">
                        <PauseCircle size={20}/>
                        تعليق
                    </button>
                    <button onClick={handleSave} disabled={isProcessing} className="flex-[3] bg-sap-primary text-white py-5 rounded-xl text-xl font-black shadow-xl hover:bg-sap-primary-hover active:scale-95 transition-all flex items-center justify-center gap-3">
                        {isProcessing ? <Loader2 className="animate-spin"/> : <CheckCircle2 size={24}/>}
                        تأكيد العملية
                    </button>
                </div>
            </div>
        </div>

        {/* Held Orders Modal */}
        {showHeldOrders && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-4 bg-sap-shell text-white flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2"><PauseCircle size={18}/> العمليات المعلقة</h3>
                        <button onClick={() => setShowHeldOrders(false)}><X size={20}/></button>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
                        {heldOrders.map(order => (
                            <div key={order.id} className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex justify-between items-center hover:bg-white hover:shadow-md transition-all">
                                <div>
                                    <div className="font-black text-lg text-sap-primary">{order.amount.toLocaleString()} SAR</div>
                                    <div className="text-xs text-gray-500 font-bold">{order.customerName}</div>
                                    <div className="text-[10px] text-gray-400 mt-1">{new Date(order.date).toLocaleString('ar-SA')}</div>
                                    {order.note && <div className="text-xs text-gray-600 mt-1 bg-gray-100 px-2 py-1 rounded inline-block">{order.note}</div>}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleRetrieveOrder(order)} className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200" title="استرجاع"><PlayCircle size={20}/></button>
                                    <button onClick={() => handleDeleteHeldOrder(order.id)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200" title="حذف"><Trash2 size={20}/></button>
                                </div>
                            </div>
                        ))}
                        {heldOrders.length === 0 && <div className="text-center py-10 text-gray-400">لا توجد عمليات معلقة</div>}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};