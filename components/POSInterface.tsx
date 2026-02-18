import React, { useState, useEffect } from 'react';
import { Product, DailySales, Customer, POSPoint, Network, HeldOrder } from '../types';
import { db } from '../services/supabase';
import { useNotification } from './Notifications';
import { 
  DollarSign, Users, Save, Loader2, Monitor, Search, 
  PauseCircle, PlayCircle, Trash2, LayoutGrid, CheckCircle2, ChevronRight, X
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
  
  // Amounts
  const [cashAmount, setCashAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
      const load = async () => {
          const pp = await db.posPoints.getAll();
          setPosPoints(pp);
          if (pp.length > 0) setSelectedPosId(pp[0].id);
      };
      load();
  }, []);

  const handleSave = async () => {
      if (!cashAmount || parseFloat(cashAmount) <= 0) return notify('أدخل المبلغ', 'error');
      if (!selectedPosId) return notify('اختر نقطة البيع', 'warning');
      
      setIsProcessing(true);
      try {
          const amount = parseFloat(cashAmount);
          const activePos = posPoints.find(p => p.id === selectedPosId);
          
          await db.dailySales.upsert({
              id: crypto.randomUUID(),
              date: new Date().toISOString().split('T')[0],
              totalAmount: amount, paidAmount: amount, remainingAmount: 0,
              paymentMethod: 'cash', transactionType: 'sale', isPending: false, isClosed: false,
              customerName: 'مبيعات نقدية سريعة',
              notes: notes || 'POS Entry',
              amount: amount,
              posPointId: selectedPosId,
              branchId: activePos?.branchId
          });
          
          setCashAmount(''); setNotes('');
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
            <select value={selectedPosId} onChange={e => setSelectedPosId(e.target.value)} className="bg-sap-shell border border-sap-secondary text-white text-sm rounded px-3 py-1 font-bold outline-none">
                {posPoints.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
        </div>

        <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Left: Input Pad */}
            <div className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm p-8 flex flex-col justify-center max-w-2xl mx-auto">
                <div className="text-center mb-8">
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

                <div className="grid grid-cols-4 gap-3 mb-8">
                    {[1, 5, 10, 50, 100, 500].map(v => (
                        <button key={v} onClick={() => setCashAmount((parseFloat(cashAmount || '0') + v).toString())} className="bg-sap-shell/10 hover:bg-sap-secondary hover:text-white text-sap-shell font-black py-4 rounded-lg transition-colors text-lg">
                            +{v}
                        </button>
                    ))}
                    <button onClick={() => setCashAmount('')} className="col-span-2 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100">مسح</button>
                </div>

                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold mb-4" placeholder="ملاحظة سريعة (اختياري)..." />

                <button onClick={handleSave} disabled={isProcessing} className="w-full bg-sap-primary text-white py-5 rounded-xl text-xl font-black shadow-xl hover:bg-sap-primary-hover active:scale-95 transition-all flex items-center justify-center gap-3">
                    {isProcessing ? <Loader2 className="animate-spin"/> : <CheckCircle2 size={24}/>}
                    تأكيد العملية
                </button>
            </div>
        </div>
    </div>
  );
};