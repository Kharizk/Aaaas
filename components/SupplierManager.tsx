import React, { useState, useEffect } from 'react';
import { Supplier, PurchaseOrder } from '../types';
import { db } from '../services/supabase';
import { Plus, Trash2, Edit2, Search, Truck, Package, Save, X, Phone, Mail, MapPin } from 'lucide-react';

export const SupplierManager: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Supplier>>({});

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const data = await db.suppliers.getAll();
      setSuppliers(data as Supplier[]);
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
        notes: formData.notes
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
            <div key={supplier.id} className="bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
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

              <div className="space-y-2">
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
                {supplier.address && (
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-600 bg-gray-50 p-2 rounded-xl">
                    <MapPin size={14} className="text-gray-400"/>
                    <span>{supplier.address}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
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
    </div>
  );
};
