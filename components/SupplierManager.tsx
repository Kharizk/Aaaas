import React, { useState, useEffect } from 'react';
import { Supplier, SupplierTransaction } from '../types';
import { db } from '../services/supabase';
import { Plus, Trash2, Edit2, Search, Truck, Package, Save, X, Phone, Mail, MapPin, FileText, DollarSign, ArrowUpRight, ArrowDownLeft, Clock, FileSpreadsheet } from 'lucide-react';
import { exportDataToExcel } from '../services/excelService';

export const SupplierManager: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Supplier Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<Partial<Supplier>>({});

  // Transaction Modal
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [txFormData, setTxFormData] = useState<Partial<SupplierTransaction>>({ type: 'bill', amount: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [suppliersData, txData] = await Promise.all([
          db.suppliers.getAll(),
          db.supplierTransactions.getAll()
      ]);
      setSuppliers(suppliersData as Supplier[]);
      setTransactions(txData as SupplierTransaction[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name) return alert('اسم المورد مطلوب');
    
    try {
      const supplier: Supplier = {
        id: editingSupplier ? editingSupplier.id : crypto.randomUUID(),
        name: formData.name,
        contactPerson: formData.contactPerson,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        notes: formData.notes,
        balance: editingSupplier?.balance || 0
      };

      await db.suppliers.upsert(supplier);
      setSuppliers(prev => editingSupplier ? prev.map(s => s.id === supplier.id ? supplier : s) : [...prev, supplier]);
      setIsModalOpen(false);
      setEditingSupplier(null);
      setFormData({});
    } catch (e) {
      alert('حدث خطأ أثناء الحفظ');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المورد؟')) return;
    try {
      await db.suppliers.delete(id);
      setSuppliers(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      alert('فشل الحذف');
    }
  };

  const openModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData(supplier);
    } else {
      setEditingSupplier(null);
      setFormData({});
    }
    setIsModalOpen(true);
  };

  const handleTxSave = async () => {
      if (!selectedSupplier || !txFormData.amount) return;

      const newTx: SupplierTransaction = {
          id: crypto.randomUUID(),
          supplierId: selectedSupplier.id,
          date: new Date().toISOString(),
          type: txFormData.type || 'bill',
          amount: Number(txFormData.amount),
          notes: txFormData.notes,
          reference: txFormData.reference
      };

      // Update Supplier Balance
      const currentBalance = selectedSupplier.balance || 0;
      const newBalance = newTx.type === 'bill' 
          ? currentBalance + newTx.amount 
          : currentBalance - newTx.amount;
      
      const updatedSupplier = { ...selectedSupplier, balance: newBalance };

      try {
          await db.supplierTransactions.upsert(newTx);
          await db.suppliers.upsert(updatedSupplier);
          
          setTransactions(prev => [newTx, ...prev]);
          setSuppliers(prev => prev.map(s => s.id === updatedSupplier.id ? updatedSupplier : s));
          
          setIsTxModalOpen(false);
          setTxFormData({ type: 'bill', amount: 0 });
      } catch (e) {
          alert('فشل حفظ العملية');
      }
  };

  const openTxModal = (supplier: Supplier) => {
      setSelectedSupplier(supplier);
      setTxFormData({ type: 'bill', amount: 0 });
      setIsTxModalOpen(true);
  };

  const handleExport = () => {
      const dataToExport = suppliers.map(s => ({
          'اسم المورد': s.name,
          'مسؤول التواصل': s.contactPerson,
          'رقم الهاتف': s.phone,
          'البريد الإلكتروني': s.email,
          'العنوان': s.address,
          'الرصيد': s.balance,
          'ملاحظات': s.notes
      }));
      exportDataToExcel(dataToExport, `suppliers_export_${new Date().toISOString().split('T')[0]}`);
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="bg-white border border-sap-border rounded-[2.5rem] p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-[2rem] flex items-center justify-center shadow-lg">
            <Truck size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-sap-text">إدارة الموردين</h2>
            <p className="text-xs text-sap-text-variant font-bold uppercase tracking-widest mt-1">قاعدة بيانات الشركاء والموردين</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input 
              type="text" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="بحث عن مورد..." 
              className="w-full pl-4 pr-10 py-3 bg-gray-50 border-none rounded-2xl text-xs font-black focus:ring-2 focus:ring-sap-primary/20"
            />
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <button onClick={handleExport} className="bg-green-600 text-white px-4 py-3 rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg hover:bg-green-700 transition-all active:scale-95" title="تصدير Excel">
            <FileSpreadsheet size={18}/> تصدير
          </button>
          <button onClick={() => openModal()} className="bg-sap-primary text-white px-6 py-3 rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg hover:bg-sap-primary-hover transition-all active:scale-95">
            <Plus size={18}/> إضافة مورد
          </button>
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-20 text-gray-400">جاري التحميل...</div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="col-span-full text-center py-20 bg-white rounded-[2rem] border border-dashed border-gray-200">
            <Truck size={48} className="mx-auto text-gray-200 mb-4"/>
            <p className="text-gray-400 font-bold">لا يوجد موردين مضافين</p>
          </div>
        ) : (
          filteredSuppliers.map(supplier => (
            <div key={supplier.id} className="bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex flex-col">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <Package size={24} />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openModal(supplier)} className="p-2 bg-gray-50 text-blue-600 rounded-xl hover:bg-blue-50"><Edit2 size={16}/></button>
                  <button onClick={() => handleDelete(supplier.id)} className="p-2 bg-gray-50 text-red-600 rounded-xl hover:bg-red-50"><Trash2 size={16}/></button>
                </div>
              </div>

              <h3 className="text-lg font-black text-gray-800 mb-1">{supplier.name}</h3>
              {supplier.contactPerson && <p className="text-xs text-gray-500 font-bold mb-4">مسؤول التواصل: {supplier.contactPerson}</p>}

              <div className="space-y-2 mb-6 flex-1">
                {supplier.phone && (
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-600 bg-gray-50 p-2 rounded-xl">
                    <Phone size={14} className="text-gray-400"/>
                    <span dir="ltr">{supplier.phone}</span>
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-600 bg-gray-50 p-2 rounded-xl">
                    <Mail size={14} className="text-gray-400"/>
                    <span>{supplier.email}</span>
                  </div>
                )}
              </div>

              <div className="mt-auto pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-gray-400">الرصيد المستحق</span>
                      <span className={`text-lg font-black font-mono ${supplier.balance && supplier.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {(supplier.balance || 0).toLocaleString()} SAR
                      </span>
                  </div>
                  <button onClick={() => openTxModal(supplier)} className="w-full py-3 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-colors">
                      <FileText size={16}/> كشف حساب / عمليات
                  </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-black text-gray-800">{editingSupplier ? 'تعديل بيانات مورد' : 'إضافة مورد جديد'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white rounded-full hover:bg-gray-200 transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">اسم الشركة / المورد <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.name || ''} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:border-blue-500 outline-none"
                  placeholder="مثال: شركة التوريدات العالمية"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">مسؤول التواصل</label>
                  <input 
                    type="text" 
                    value={formData.contactPerson || ''} 
                    onChange={e => setFormData({...formData, contactPerson: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">رقم الهاتف</label>
                  <input 
                    type="text" 
                    value={formData.phone || ''} 
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">البريد الإلكتروني</label>
                <input 
                  type="email" 
                  value={formData.email || ''} 
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">العنوان</label>
                <input 
                  type="text" 
                  value={formData.address || ''} 
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">ملاحظات إضافية</label>
                <textarea 
                  value={formData.notes || ''} 
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none min-h-[80px]"
                />
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100">إلغاء</button>
              <button onClick={handleSave} className="flex-[2] py-3 bg-sap-primary text-white rounded-xl font-bold hover:bg-sap-primary-hover shadow-lg flex justify-center items-center gap-2">
                <Save size={18}/> حفظ البيانات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {isTxModalOpen && selectedSupplier && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                  <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                      <div>
                          <h3 className="text-lg font-black text-gray-800">سجل عمليات: {selectedSupplier.name}</h3>
                          <p className="text-xs text-gray-500 font-bold mt-1">الرصيد الحالي: <span className="text-sap-primary">{(selectedSupplier.balance || 0).toLocaleString()} SAR</span></p>
                      </div>
                      <button onClick={() => setIsTxModalOpen(false)} className="p-2 bg-white rounded-full hover:bg-gray-200 transition-colors"><X size={20}/></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                      {/* Add Transaction Form */}
                      <div className="bg-gray-50 p-4 rounded-2xl mb-6 border border-gray-100">
                          <h4 className="text-sm font-black text-gray-700 mb-3 flex items-center gap-2"><Plus size={16}/> تسجيل عملية جديدة</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div>
                                  <label className="block text-[10px] font-bold text-gray-500 mb-1">نوع العملية</label>
                                  <div className="flex bg-white rounded-xl p-1 border border-gray-200">
                                      <button 
                                          onClick={() => setTxFormData({...txFormData, type: 'bill'})}
                                          className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${txFormData.type === 'bill' ? 'bg-red-100 text-red-600 shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
                                      >
                                          فاتورة شراء (دين)
                                      </button>
                                      <button 
                                          onClick={() => setTxFormData({...txFormData, type: 'payment'})}
                                          className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${txFormData.type === 'payment' ? 'bg-emerald-100 text-emerald-600 shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
                                      >
                                          سداد دفعة
                                      </button>
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-[10px] font-bold text-gray-500 mb-1">المبلغ</label>
                                  <input 
                                      type="number" 
                                      value={txFormData.amount || ''}
                                      onChange={e => setTxFormData({...txFormData, amount: Number(e.target.value)})}
                                      className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-black outline-none focus:border-sap-primary"
                                      placeholder="0.00"
                                  />
                              </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div>
                                  <label className="block text-[10px] font-bold text-gray-500 mb-1">رقم المرجع / الفاتورة</label>
                                  <input 
                                      type="text" 
                                      value={txFormData.reference || ''}
                                      onChange={e => setTxFormData({...txFormData, reference: e.target.value})}
                                      className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none"
                                      placeholder="مثال: INV-001"
                                  />
                              </div>
                              <div>
                                  <label className="block text-[10px] font-bold text-gray-500 mb-1">ملاحظات</label>
                                  <input 
                                      type="text" 
                                      value={txFormData.notes || ''}
                                      onChange={e => setTxFormData({...txFormData, notes: e.target.value})}
                                      className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none"
                                      placeholder="ملاحظات إضافية..."
                                  />
                              </div>
                          </div>
                          <button onClick={handleTxSave} className="w-full py-3 bg-sap-primary text-white rounded-xl font-black text-xs hover:bg-sap-primary-hover shadow-lg transition-all">
                              حفظ العملية
                          </button>
                      </div>

                      {/* Transaction History */}
                      <h4 className="text-sm font-black text-gray-700 mb-3 flex items-center gap-2"><Clock size={16}/> سجل العمليات السابق</h4>
                      <div className="space-y-3">
                          {transactions.filter(t => t.supplierId === selectedSupplier.id).length === 0 ? (
                              <p className="text-center text-gray-400 text-xs py-4">لا توجد عمليات مسجلة</p>
                          ) : (
                              transactions.filter(t => t.supplierId === selectedSupplier.id).map(tx => (
                                  <div key={tx.id} className="bg-white border border-gray-100 p-4 rounded-xl flex justify-between items-center hover:shadow-sm transition-shadow">
                                      <div className="flex items-center gap-3">
                                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'bill' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                              {tx.type === 'bill' ? <ArrowDownLeft size={20}/> : <ArrowUpRight size={20}/>}
                                          </div>
                                          <div>
                                              <div className="font-black text-gray-800 text-sm">{tx.type === 'bill' ? 'فاتورة شراء' : 'سداد دفعة'}</div>
                                              <div className="text-[10px] text-gray-400 font-mono">{new Date(tx.date).toLocaleDateString('ar-SA')} {tx.reference && `• ${tx.reference}`}</div>
                                          </div>
                                      </div>
                                      <div className={`font-black font-mono text-sm ${tx.type === 'bill' ? 'text-red-600' : 'text-emerald-600'}`}>
                                          {tx.type === 'bill' ? '+' : '-'}{tx.amount.toLocaleString()}
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
