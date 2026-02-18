import React, { useState, useMemo, useRef } from 'react';
import { Product, Unit, User } from '../types';
import { db } from '../services/supabase';
import { parseExcelFile, exportDataToExcel } from '../services/excelService';
import { EmptyState } from './UIStates';
import { 
  Plus, Edit2, Trash2, Save, X, Loader2, Package, Search, 
  Barcode, LayoutGrid, DollarSign, FileSpreadsheet, Ruler, 
  CheckSquare, Square, Download, List, Filter, ChevronRight, MoreHorizontal, ArrowLeft
} from 'lucide-react';

interface ProductManagerProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
  currentUser?: User | null;
}

export const ProductManager: React.FC<ProductManagerProps> = ({ products, setProducts, units, setUnits, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unitId, setUnitId] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState(''); 
  const [color, setColor] = useState('#ffffff');

  const canEdit = currentUser?.role === 'admin' || currentUser?.permissions.includes('manage_products');
  const excelInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  // --- Actions ---
  const handleOpenModal = (product?: Product) => {
    if (!canEdit && !product) return;
    if (product) {
      setEditingProduct(product);
      setCode(product.code); setName(product.name); setUnitId(product.unitId);
      setPrice(product.price || ''); setCostPrice(product.costPrice || ''); setColor(product.color || '#ffffff');
    } else {
      setEditingProduct(null);
      setCode(''); setName(''); setUnitId(''); setPrice(''); setCostPrice(''); setColor('#ffffff');
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!code || !name || !unitId) { alert("البيانات الأساسية مطلوبة"); return; }
    setIsSaving(true);
    try {
        const productData: Product = {
          id: editingProduct ? editingProduct.id : crypto.randomUUID(),
          code: code.trim(), name: name.trim(), unitId,
          price: price.trim(), costPrice: costPrice.trim(), color
        };
        await db.products.upsert(productData);
        if (editingProduct) setProducts(prev => prev.map(p => p.id === editingProduct.id ? productData : p));
        else setProducts(prev => [...prev, productData]);
        setIsModalOpen(false);
    } catch (e) { alert("فشل الحفظ"); }
    setIsSaving(false);
  };

  const handleBulkDelete = async () => {
      if (!confirm(`حذف ${selectedIds.size} عنصر؟`)) return;
      try {
          const ids = Array.from(selectedIds);
          await Promise.all(ids.map((id: string) => db.products.delete(id)));
          setProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
          setSelectedIds(new Set());
      } catch (e) { alert("خطأ في الحذف"); }
  };

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-300">
      
      {/* 1. Odoo Style Control Panel */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm z-10">
        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
            <span className="text-sap-primary font-bold cursor-pointer hover:underline">المنتجات</span>
            <ChevronRight size={14} />
            <span>الكل</span>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Search Bar */}
            <div className="relative flex-1 md:w-80">
                <input 
                  type="text" 
                  placeholder="بحث..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-4 pr-10 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-sap-primary focus:border-sap-primary transition-all"
                />
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>

            {/* View Switcher */}
            <div className="flex border border-gray-300 rounded-md overflow-hidden">
                <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-gray-100 text-sap-primary' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><List size={16}/></button>
                <button onClick={() => setViewMode('kanban')} className={`p-2 ${viewMode === 'kanban' ? 'bg-gray-100 text-sap-primary' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><LayoutGrid size={16}/></button>
            </div>

            {/* Action Buttons */}
            {canEdit && (
                <button onClick={() => handleOpenModal()} className="bg-sap-primary text-white px-4 py-1.5 rounded-md text-sm font-bold shadow-sm hover:bg-sap-primary-hover transition-colors">
                    جديد
                </button>
            )}
        </div>
      </div>

      {/* 2. Content Area */}
      <div className="flex-1 overflow-auto bg-[#F3F4F6] p-4 md:p-6">
          
          {/* Bulk Action Bar */}
          {selectedIds.size > 0 && (
              <div className="mb-4 bg-white p-2 px-4 rounded-md border border-gray-300 shadow-sm flex items-center justify-between animate-in slide-in-from-top-2">
                  <span className="text-sm font-bold text-gray-700">{selectedIds.size} عنصر محدد</span>
                  <div className="flex gap-2">
                      <button onClick={handleBulkDelete} className="text-red-600 hover:bg-red-50 px-3 py-1 rounded text-xs font-bold border border-transparent hover:border-red-200">حذف المحدد</button>
                      <button onClick={() => setSelectedIds(new Set())} className="text-gray-500 hover:bg-gray-100 px-3 py-1 rounded text-xs font-bold">إلغاء</button>
                  </div>
              </div>
          )}

          {viewMode === 'list' ? (
              <div className="bg-white border border-gray-300 rounded-sm shadow-sm overflow-hidden">
                  <table className="w-full text-right text-sm">
                      <thead className="bg-[#F9FAFB] border-b border-gray-200 text-gray-600 font-bold">
                          <tr>
                              <th className="p-3 w-10 text-center">
                                  <input type="checkbox" className="accent-sap-primary" 
                                    onChange={(e) => setSelectedIds(e.target.checked ? new Set(filteredProducts.map(p => p.id)) : new Set())}
                                    checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                                  />
                              </th>
                              <th className="p-3">الكود</th>
                              <th className="p-3 w-1/3">الاسم</th>
                              <th className="p-3">الوحدة</th>
                              <th className="p-3">سعر البيع</th>
                              <th className="p-3">التكلفة</th>
                              <th className="p-3 w-20"></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {filteredProducts.map(p => (
                              <tr key={p.id} className="hover:bg-gray-50 group transition-colors cursor-pointer" onClick={() => handleOpenModal(p)}>
                                  <td className="p-3 text-center" onClick={(e) => { e.stopPropagation(); const n = new Set(selectedIds); n.has(p.id) ? n.delete(p.id) : n.add(p.id); setSelectedIds(n); }}>
                                      <input type="checkbox" checked={selectedIds.has(p.id)} className="accent-sap-primary" readOnly />
                                  </td>
                                  <td className="p-3 font-mono text-sap-secondary font-bold">{p.code}</td>
                                  <td className="p-3 font-bold text-gray-800">{p.name}</td>
                                  <td className="p-3 text-gray-500">
                                      <span className="bg-gray-100 px-2 py-0.5 rounded text-xs border border-gray-200">{units.find(u => u.id === p.unitId)?.name}</span>
                                  </td>
                                  <td className="p-3 font-bold">{p.price}</td>
                                  <td className="p-3 text-gray-400">{p.costPrice || '-'}</td>
                                  <td className="p-3 text-center">
                                      <MoreHorizontal size={16} className="text-gray-400 mx-auto opacity-0 group-hover:opacity-100" />
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredProducts.map(p => (
                      <div key={p.id} onClick={() => handleOpenModal(p)} className="bg-white border border-gray-200 rounded-md p-4 hover:shadow-md transition-shadow cursor-pointer flex flex-col h-32 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-1 h-full" style={{ backgroundColor: p.color || '#ccc' }}></div>
                          <div className="flex justify-between items-start mb-2 pl-2 pr-3">
                              <h3 className="font-bold text-gray-800 line-clamp-2 text-sm">{p.name}</h3>
                              <input type="checkbox" checked={selectedIds.has(p.id)} onClick={(e) => { e.stopPropagation(); const n = new Set(selectedIds); n.has(p.id) ? n.delete(p.id) : n.add(p.id); setSelectedIds(n); }} className="accent-sap-primary" />
                          </div>
                          <div className="mt-auto pr-3">
                              <div className="text-xs text-gray-500 font-mono mb-1">{p.code}</div>
                              <div className="flex justify-between items-center">
                                  <span className="font-black text-sap-primary text-lg">{p.price} <span className="text-[10px] text-gray-400">SAR</span></span>
                                  <span className="text-[10px] bg-gray-100 px-2 rounded text-gray-500">{units.find(u => u.id === p.unitId)?.name}</span>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>

      {/* 3. Form Modal (Odoo "Sheet" Style) */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-[#F9FAFB] w-full max-w-4xl h-[90vh] rounded-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                  {/* Modal Header */}
                  <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-4">
                          <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-800">
                              <ArrowLeft size={20}/>
                          </button>
                          <h2 className="text-lg font-bold text-sap-primary">
                              {editingProduct ? editingProduct.name : 'منتج جديد'}
                          </h2>
                      </div>
                      <div className="flex gap-2">
                          <button onClick={handleSave} disabled={isSaving} className="bg-sap-primary text-white px-6 py-2 rounded-md text-sm font-bold hover:bg-sap-primary-hover shadow-sm flex items-center gap-2">
                              {isSaving && <Loader2 size={14} className="animate-spin"/>} حفظ
                          </button>
                          <button onClick={() => setIsModalOpen(false)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-bold hover:bg-gray-50">
                              إلغاء
                          </button>
                      </div>
                  </div>

                  {/* Sheet Content */}
                  <div className="flex-1 overflow-y-auto p-6 md:p-8">
                      <div className="bg-white border border-gray-200 shadow-sm rounded-sm p-8 max-w-3xl mx-auto min-h-[500px]">
                          {/* Top Area: Status Bar & Title */}
                          <div className="flex justify-between items-start mb-8">
                              <div className="flex-1">
                                  <label className="block text-sm font-bold text-gray-500 mb-1">اسم المنتج</label>
                                  <input 
                                    type="text" 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    className="w-full text-2xl font-bold border-b border-gray-300 focus:border-sap-primary outline-none py-1 placeholder-gray-300"
                                    placeholder="مثال: مياه معدنية"
                                  />
                              </div>
                              <div className="w-20 h-20 bg-gray-50 border border-gray-200 flex items-center justify-center rounded-md ml-4 text-gray-300">
                                  <Package size={32}/>
                              </div>
                          </div>

                          {/* Grid Form */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                              <div className="space-y-4">
                                  <div className="flex items-center">
                                      <label className="w-24 text-sm font-bold text-gray-600">كود الصنف</label>
                                      <input type="text" value={code} onChange={e => setCode(e.target.value)} className="flex-1 border-b border-gray-300 focus:border-sap-primary outline-none py-1 font-mono text-sap-secondary font-bold" />
                                  </div>
                                  <div className="flex items-center">
                                      <label className="w-24 text-sm font-bold text-gray-600">وحدة القياس</label>
                                      <select value={unitId} onChange={e => setUnitId(e.target.value)} className="flex-1 border-b border-gray-300 focus:border-sap-primary outline-none py-1 bg-white">
                                          <option value="">-- اختر --</option>
                                          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                      </select>
                                  </div>
                              </div>

                              <div className="space-y-4">
                                  <div className="flex items-center">
                                      <label className="w-24 text-sm font-bold text-gray-600">سعر البيع</label>
                                      <div className="flex-1 flex items-center border-b border-gray-300 focus-within:border-sap-primary">
                                          <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full outline-none py-1 font-bold text-lg" placeholder="0.00" />
                                          <span className="text-xs text-gray-400 font-bold ml-1">SAR</span>
                                      </div>
                                  </div>
                                  <div className="flex items-center">
                                      <label className="w-24 text-sm font-bold text-gray-600">التكلفة</label>
                                      <div className="flex-1 flex items-center border-b border-gray-300 focus-within:border-sap-primary">
                                          <input type="number" value={costPrice} onChange={e => setCostPrice(e.target.value)} className="w-full outline-none py-1 text-gray-500" placeholder="0.00" />
                                          <span className="text-xs text-gray-400 font-bold ml-1">SAR</span>
                                      </div>
                                  </div>
                              </div>
                          </div>

                          <div className="mt-8 pt-6 border-t border-gray-100">
                              <label className="block text-sm font-bold text-gray-600 mb-2">لون التمييز (في الشبكة)</label>
                              <div className="flex gap-3">
                                  {['#ffffff', '#fecaca', '#bbf7d0', '#bfdbfe', '#fde68a', '#e9d5ff'].map(c => (
                                      <button 
                                        key={c} 
                                        onClick={() => setColor(c)}
                                        className={`w-8 h-8 rounded-full border border-gray-300 ${color === c ? 'ring-2 ring-offset-2 ring-sap-primary' : ''}`}
                                        style={{ backgroundColor: c }}
                                      />
                                  ))}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};