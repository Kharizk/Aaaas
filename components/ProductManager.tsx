import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product, Unit, User, Supplier } from '../types';
import { db } from '../services/supabase';
import { parseExcelFile, exportDataToExcel } from '../services/excelService';
import { EmptyState } from './UIStates';
import { BarcodePrinter } from './BarcodePrinter';
import { 
  Plus, Edit2, Trash2, Save, X, Loader2, Package, Search, 
  Barcode, LayoutGrid, DollarSign, FileSpreadsheet, Ruler, 
  CheckSquare, Square, Download, List, Filter, ChevronRight, MoreHorizontal, ArrowLeft, Copy, AlertTriangle, Upload, Star, Truck, Printer
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showBarcodePrinter, setShowBarcodePrinter] = useState(false);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  
  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unitId, setUnitId] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState(''); 
  const [color, setColor] = useState('#ffffff');
  const [lowStockThreshold, setLowStockThreshold] = useState<string>('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  
  // Stock Adjustment State
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockAdjustmentQty, setStockAdjustmentQty] = useState('');
  const [stockAdjustmentReason, setStockAdjustmentReason] = useState('');
  const [stockAdjustmentType, setStockAdjustmentType] = useState<'add' | 'remove'>('add');
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('');
  const [selectedProductForDiscount, setSelectedProductForDiscount] = useState<Product | null>(null);

  const canEdit = currentUser?.role === 'admin' || currentUser?.permissions.includes('manage_products');
  const excelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      const fetchSuppliers = async () => {
          const data = await db.suppliers.getAll();
          setSuppliers(data);
      };
      fetchSuppliers();
  }, []);

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
      setLowStockThreshold(product.lowStockThreshold?.toString() || '');
      setIsFavorite(product.isFavorite || false);
      setSupplierId(product.supplierId || '');
      setTaxRate(product.taxRate?.toString() || '');
      setExpiryDate(product.expiryDate || '');
      setOriginalPrice(product.originalPrice || '');
    } else {
      setEditingProduct(null);
      setCode(''); setName(''); setUnitId(''); setPrice(''); setCostPrice(''); setColor('#ffffff');
      setLowStockThreshold('');
      setIsFavorite(false);
      setSupplierId('');
      setTaxRate('');
      setExpiryDate('');
      setOriginalPrice('');
    }
    setIsModalOpen(true);
  };

  const confirmDiscount = async () => {
      if (!selectedProductForDiscount) return;
      
      const discountNum = parseFloat(discountAmount);
      if (isNaN(discountNum) || discountNum <= 0 || discountNum >= 100) {
          alert('نسبة غير صحيحة');
          return;
      }
      
      const p = selectedProductForDiscount;
      const currentPrice = parseFloat(p.price || '0');
      const newPrice = (currentPrice * (1 - discountNum / 100)).toFixed(2);
      
      const updatedProduct = {
          ...p,
          originalPrice: p.originalPrice || p.price, // Keep original if exists
          price: newPrice
      };
      
      await db.products.upsert(updatedProduct);
      setProducts(prev => prev.map(prod => prod.id === p.id ? updatedProduct : prod));
      alert(`تم تطبيق الخصم بنجاح. السعر الجديد: ${newPrice} SAR`);
      setShowDiscountModal(false);
      setDiscountAmount('');
      setSelectedProductForDiscount(null);
  };

  const handleStockAdjustment = async () => {
      if (!editingProduct || !stockAdjustmentQty) return;
      const qty = parseInt(stockAdjustmentQty);
      if (isNaN(qty) || qty <= 0) return alert('الكمية غير صحيحة');

      const currentStock = editingProduct.stock || 0;
      const newStock = stockAdjustmentType === 'add' ? currentStock + qty : currentStock - qty;

      try {
          const updatedProduct = { ...editingProduct, stock: newStock };
          await db.products.upsert(updatedProduct);
          setProducts(prev => prev.map(p => p.id === editingProduct.id ? updatedProduct : p));
          
          // Log Activity
          await db.activityLogs.add({
              action: 'تعديل مخزون',
              details: `منتج: ${editingProduct.name} - ${stockAdjustmentType === 'add' ? 'إضافة' : 'خصم'} ${qty} - السبب: ${stockAdjustmentReason}`,
              user: currentUser?.username || 'Admin',
              type: 'warning'
          });

          setShowStockModal(false);
          setStockAdjustmentQty('');
          setStockAdjustmentReason('');
          alert('تم تعديل المخزون بنجاح');
      } catch (e) {
          alert('حدث خطأ');
      }
  };

  const handleDuplicate = (product: Product, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canEdit) return;
      
      setEditingProduct(null); // New product mode
      setCode(`${product.code}-copy`); 
      setName(`${product.name} (نسخة)`); 
      setUnitId(product.unitId);
      setPrice(product.price || ''); 
      setCostPrice(product.costPrice || ''); 
      setColor(product.color || '#ffffff');
      setLowStockThreshold(product.lowStockThreshold?.toString() || '');
      setIsFavorite(product.isFavorite || false);
      setSupplierId(product.supplierId || '');
      setTaxRate(product.taxRate?.toString() || '');
      setExpiryDate(product.expiryDate || '');
      setOriginalPrice(product.originalPrice || '');
      
      setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!code || !name || !unitId) { alert("البيانات الأساسية مطلوبة"); return; }
    setIsSaving(true);
    try {
        const productData: Product = {
          id: editingProduct ? editingProduct.id : crypto.randomUUID(),
          code: code.trim(), name: name.trim(), unitId,
          price: price.trim(), costPrice: costPrice.trim(), color,
          lowStockThreshold: lowStockThreshold ? Number(lowStockThreshold) : undefined,
          isFavorite,
          supplierId: supplierId || undefined,
          taxRate: taxRate ? Number(taxRate) : undefined,
          expiryDate: expiryDate || undefined,
          originalPrice: originalPrice.trim() || undefined
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

  const handleExport = () => {
      exportDataToExcel(products, `products_export_${new Date().toISOString().split('T')[0]}`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
          const data = await parseExcelFile(file);
          // Basic validation and mapping
          const newProducts: Product[] = data.map((row: any) => ({
              id: crypto.randomUUID(),
              name: row['Name'] || row['name'] || row['الاسم'],
              code: (row['Code'] || row['code'] || row['الكود'] || Math.floor(Math.random() * 1000000)).toString(),
              price: (row['Price'] || row['price'] || row['السعر'] || '0').toString(),
              costPrice: (row['Cost'] || row['cost'] || row['التكلفة'] || '0').toString(),
              unitId: 'unit_piece', // Default unit
              stock: Number(row['Stock'] || row['stock'] || row['المخزون'] || 0),
              category: row['Category'] || row['category'] || row['التصنيف'] || 'General',
              supplierId: undefined // Could map if supplier name matches ID, but safer to skip for now
          })).filter((p: Product) => p.name); // Filter out empty rows

          if (newProducts.length === 0) throw new Error('No valid data found');

          if (confirm(`تم العثور على ${newProducts.length} منتج. هل تريد استيرادها؟`)) {
              // Batch insert
              await Promise.all(newProducts.map(p => db.products.upsert(p)));
              setProducts(prev => [...prev, ...newProducts]);
              alert('تم الاستيراد بنجاح');
              
               // Log Activity
              await db.activityLogs.add({
                  action: 'استيراد منتجات',
                  details: `تم استيراد ${newProducts.length} منتج من ملف Excel`,
                  user: currentUser?.username || 'Admin',
                  type: 'info'
              });
          }
      } catch (err) {
          alert('فشل قراءة الملف. تأكد من الصيغة.');
          console.error(err);
      }
      if (excelInputRef.current) excelInputRef.current.value = '';
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
            {/* Import/Export Buttons */}
            <div className="flex items-center gap-2 border-l border-gray-200 pl-3 ml-1">
                <button onClick={() => setShowExpiryModal(true)} className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors" title="إدارة الصلاحية والخصومات">
                    <AlertTriangle size={18}/>
                </button>
                <button onClick={() => setShowBarcodePrinter(true)} className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors" title="طباعة باركود">
                    <Printer size={18}/>
                </button>
                <button onClick={handleExport} className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors" title="تصدير Excel">
                    <FileSpreadsheet size={18}/>
                </button>
                <label className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer" title="استيراد Excel">
                    <Upload size={18}/>
                    <input type="file" ref={excelInputRef} onChange={handleImport} accept=".xlsx, .xls, .csv" className="hidden"/>
                </label>
            </div>

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
                                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-sap-primary focus:ring-sap-primary" 
                                    onChange={(e) => setSelectedIds(e.target.checked ? new Set(filteredProducts.map(p => p.id)) : new Set())}
                                    checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                                  />
                              </th>
                              <th className="p-3">الكود</th>
                              <th className="p-3 w-1/3">الاسم</th>
                              <th className="p-3">الوحدة</th>
                              <th className="p-3">سعر البيع</th>
                              <th className="p-3">التكلفة</th>
                              <th className="p-3">هامش الربح</th>
                              <th className="p-3 w-20"></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {filteredProducts.map(p => (
                              <tr key={p.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 group transition-colors cursor-pointer ${(p.stock || 0) <= (p.lowStockThreshold || 0) && (p.lowStockThreshold || 0) > 0 ? 'bg-amber-50 dark:bg-amber-500/10' : ''} ${selectedIds.has(p.id) ? 'bg-sap-primary/5 dark:bg-sap-primary/10' : ''}`} onClick={() => handleOpenModal(p)}>
                                  <td className="p-3 text-center" onClick={(e) => { e.stopPropagation(); const n = new Set(selectedIds); n.has(p.id) ? n.delete(p.id) : n.add(p.id); setSelectedIds(n); }}>
                                      <input type="checkbox" checked={selectedIds.has(p.id)} className="w-4 h-4 rounded border-slate-300 text-sap-primary focus:ring-sap-primary" readOnly />
                                  </td>
                                  <td className="p-3 font-mono text-sap-secondary font-bold">{p.code}</td>
                                  <td className="p-3 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || '#94a3b8' }}></div>
                                      {p.name}
                                      {p.isFavorite && <Star size={12} className="text-yellow-400 fill-yellow-400" />}
                                  </td>
                                  <td className="p-3 text-slate-500 dark:text-slate-400">
                                      <span className="bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded text-xs border border-slate-200 dark:border-slate-700/50">{units.find(u => u.id === p.unitId)?.name}</span>
                                  </td>
                                  <td className="p-3 font-bold text-sap-secondary">{p.price}</td>
                                  <td className="p-3 text-slate-400 dark:text-slate-500">{p.costPrice || '-'}</td>
                                  <td className="p-3">
                                      {p.price && p.costPrice && parseFloat(p.price) > 0 ? (
                                          <span className={((parseFloat(p.price) - parseFloat(p.costPrice)) / parseFloat(p.price)) * 100 >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-600 dark:text-red-400 font-bold'}>
                                              {(((parseFloat(p.price) - parseFloat(p.costPrice)) / parseFloat(p.price)) * 100).toFixed(1)}%
                                          </span>
                                      ) : '-'}
                                  </td>
                                  <td className="p-3 text-center flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={(e) => handleDuplicate(p, e)}
                                        className="p-1.5 text-slate-400 hover:text-sap-primary hover:bg-sap-primary/10 rounded-lg transition-colors"
                                        title="تكرار المنتج"
                                      >
                                          <Copy size={16} />
                                      </button>
                                      <button 
                                          onClick={(e) => { e.stopPropagation(); handleOpenModal(p); }}
                                          className="p-1.5 text-slate-400 hover:text-sap-primary hover:bg-sap-primary/10 rounded-lg transition-colors"
                                      >
                                          <MoreHorizontal size={16} />
                                      </button>
                                  </td>
                              </tr>
                          ))}
                          {filteredProducts.length === 0 && (
                              <tr>
                                  <td colSpan={8} className="p-16 text-center">
                                      <div className="flex flex-col items-center justify-center text-slate-400">
                                          <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-800">
                                              <Package size={32} className="text-slate-300 dark:text-slate-600" />
                                          </div>
                                          <p className="text-lg font-bold text-slate-500 dark:text-slate-400 mb-1">لا يوجد منتجات</p>
                                          <p className="text-sm">لم يتم العثور على أي منتجات تطابق بحثك.</p>
                                      </div>
                                  </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {filteredProducts.map(p => (
                      <div key={p.id} onClick={() => handleOpenModal(p)} className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-36 relative overflow-hidden group ${(p.stock || 0) <= (p.lowStockThreshold || 0) && (p.lowStockThreshold || 0) > 0 ? 'ring-2 ring-amber-400 dark:ring-amber-500/50' : ''}`}>
                          <div className="absolute top-0 right-0 w-1.5 h-full transition-colors duration-300" style={{ backgroundColor: p.color || '#94a3b8' }}></div>
                          <div className="flex justify-between items-start mb-3 pl-2 pr-4">
                              <h3 className="font-bold text-slate-800 dark:text-slate-200 line-clamp-2 text-sm leading-tight group-hover:text-sap-primary transition-colors">{p.name}</h3>
                              <div className="flex items-center gap-2">
                                <button 
                                    onClick={(e) => handleDuplicate(p, e)}
                                    className="p-1.5 text-slate-400 hover:text-sap-primary hover:bg-sap-primary/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                    title="تكرار المنتج"
                                >
                                    <Copy size={14} />
                                </button>
                                <input type="checkbox" checked={selectedIds.has(p.id)} onClick={(e) => { e.stopPropagation(); const n = new Set(selectedIds); n.has(p.id) ? n.delete(p.id) : n.add(p.id); setSelectedIds(n); }} className="w-4 h-4 rounded border-slate-300 text-sap-primary focus:ring-sap-primary" />
                              </div>
                          </div>
                          <div className="mt-auto pr-4 pl-2">
                              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-1.5">{p.code}</div>
                              <div className="flex justify-between items-center">
                                  <span className="font-black text-sap-secondary text-lg">{p.price} <span className="text-[10px] text-slate-400 font-medium">ر.س</span></span>
                                  <span className="text-[10px] bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-md text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50">{units.find(u => u.id === p.unitId)?.name}</span>
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
                                      <div className="flex-1 flex items-center gap-2">
                                          <input type="text" value={code} onChange={e => setCode(e.target.value)} className="flex-1 border-b border-gray-300 focus:border-sap-primary outline-none py-1 font-mono text-sap-secondary font-bold" />
                                          <button 
                                              onClick={() => setCode(Math.floor(Math.random() * 1000000000000).toString())}
                                              className="p-1 text-gray-400 hover:text-sap-primary hover:bg-gray-100 rounded"
                                              title="توليد كود عشوائي"
                                          >
                                              <Barcode size={16}/>
                                          </button>
                                      </div>
                                  </div>
                                  <div className="flex items-center">
                                      <label className="w-24 text-sm font-bold text-gray-600">وحدة القياس</label>
                                      <select value={unitId} onChange={e => setUnitId(e.target.value)} className="flex-1 border-b border-gray-300 focus:border-sap-primary outline-none py-1 bg-white">
                                          <option value="">-- اختر --</option>
                                          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                      </select>
                                  </div>
                                  <div className="flex items-center">
                                      <label className="w-24 text-sm font-bold text-gray-600">المورد</label>
                                      <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="flex-1 border-b border-gray-300 focus:border-sap-primary outline-none py-1 bg-white">
                                          <option value="">-- اختر --</option>
                                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                                  <div className="flex items-center">
                                      <label className="w-24 text-sm font-bold text-gray-600">الضريبة المخصصة</label>
                                      <div className="flex-1 flex items-center border-b border-gray-300 focus-within:border-sap-primary">
                                          <input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} className="w-full outline-none py-1 text-gray-500" placeholder="اتركه فارغاً للضريبة الافتراضية" />
                                          <span className="text-xs text-gray-400 font-bold ml-1">%</span>
                                      </div>
                                  </div>
                                  <div className="flex items-center">
                                      <label className="w-24 text-sm font-bold text-gray-600">السعر الأصلي</label>
                                      <div className="flex-1 flex items-center border-b border-gray-300 focus-within:border-sap-primary">
                                          <input type="number" value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} className="w-full outline-none py-1 text-gray-500" placeholder="قبل الخصم (اختياري)" />
                                          <span className="text-xs text-gray-400 font-bold ml-1">SAR</span>
                                      </div>
                                  </div>
                                  <div className="flex items-center">
                                      <label className="w-24 text-sm font-bold text-gray-600">تاريخ الانتهاء</label>
                                      <div className="flex-1 flex items-center border-b border-gray-300 focus-within:border-sap-primary">
                                          <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full outline-none py-1 text-gray-500" />
                                      </div>
                                  </div>
                                  {/* Profit Margin Display */}
                                  {price && costPrice && (
                                      <div className="flex items-center justify-end text-xs font-bold mt-2">
                                          <span className="text-gray-500 ml-2">هامش الربح:</span>
                                          <span className={`${((parseFloat(price) - parseFloat(costPrice)) / parseFloat(price)) * 100 > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                              {(((parseFloat(price) - parseFloat(costPrice)) / parseFloat(price)) * 100).toFixed(1)}%
                                          </span>
                                          <span className="mx-2 text-gray-300">|</span>
                                          <span className="text-gray-700">
                                              {(parseFloat(price) - parseFloat(costPrice)).toFixed(2)} SAR
                                          </span>
                                      </div>
                                  )}
                              </div>
                          </div>

                          <div className="mt-8 pt-6 border-t border-gray-100">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                                  <div>
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
                                  
                                  <div>
                                      <label className="block text-sm font-bold text-gray-600 mb-2 flex items-center gap-2">
                                          <AlertTriangle size={14} className="text-amber-500" />
                                          حد التنبيه للمخزون المنخفض
                                      </label>
                                      <div className="flex items-center border-b border-gray-300 focus-within:border-sap-primary">
                                          <input 
                                            type="number" 
                                            value={lowStockThreshold} 
                                            onChange={e => setLowStockThreshold(e.target.value)} 
                                            className="w-full outline-none py-1 text-gray-700" 
                                            placeholder="مثال: 10" 
                                          />
                                      </div>
                                      <p className="text-[10px] text-gray-400 mt-1">سيظهر تنبيه عندما يقل المخزون عن هذا العدد</p>
                                  </div>

                                  <div>
                                      <label className="block text-sm font-bold text-gray-600 mb-2 flex items-center gap-2">
                                          <Star size={14} className="text-yellow-500" />
                                          المفضلة (POS)
                                      </label>
                                      <label className="flex items-center gap-3 cursor-pointer">
                                          <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isFavorite ? 'bg-sap-primary' : 'bg-gray-200'}`}>
                                              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isFavorite ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                          </div>
                                          <input type="checkbox" checked={isFavorite} onChange={e => setIsFavorite(e.target.checked)} className="hidden" />
                                          <span className="text-sm text-gray-500 font-medium">{isFavorite ? 'يظهر في المفضلة' : 'غير مفضل'}</span>
                                      </label>
                                  </div>
                                  
                                  {/* Barcode Generator */}
                                  <div className="col-span-full mt-4 flex justify-between items-center">
                                      <button 
                                          onClick={() => setCode(Math.floor(Math.random() * 1000000000000).toString())}
                                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                      >
                                          <Barcode size={14} /> توليد باركود عشوائي
                                      </button>

                                      <button 
                                          onClick={() => setShowStockModal(true)}
                                          className="text-xs text-amber-600 hover:underline flex items-center gap-1 font-bold"
                                      >
                                          <Package size={14} /> تعديل المخزون (تالف / تسوية)
                                      </button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Stock Adjustment Modal */}
      {showStockModal && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="font-bold text-gray-800">تعديل المخزون</h3>
                      <button onClick={() => setShowStockModal(false)}><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                          <button 
                              onClick={() => setStockAdjustmentType('add')}
                              className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${stockAdjustmentType === 'add' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                          >
                              إضافة (+)
                          </button>
                          <button 
                              onClick={() => setStockAdjustmentType('remove')}
                              className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${stockAdjustmentType === 'remove' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                          >
                              خصم (-)
                          </button>
                      </div>
                      
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">الكمية</label>
                          <input 
                              type="number" 
                              value={stockAdjustmentQty} 
                              onChange={e => setStockAdjustmentQty(e.target.value)} 
                              className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-sap-primary font-bold"
                              autoFocus
                          />
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">السبب (اختياري)</label>
                          <input 
                              type="text" 
                              value={stockAdjustmentReason} 
                              onChange={e => setStockAdjustmentReason(e.target.value)} 
                              className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-sap-primary"
                              placeholder="مثال: تالف، جرد، هدية..."
                          />
                      </div>

                      <div className="pt-2">
                          <button 
                              onClick={handleStockAdjustment}
                              className="w-full py-3 bg-sap-primary text-white rounded-xl font-bold hover:bg-sap-primary-hover shadow-lg"
                          >
                              تأكيد العملية
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Barcode Printer Modal */}
      {showBarcodePrinter && (
          <BarcodePrinter 
              products={selectedIds.size > 0 ? products.filter(p => selectedIds.has(p.id)) : filteredProducts} 
              onClose={() => setShowBarcodePrinter(false)} 
              isClearance={showExpiryModal} // If opened from expiry modal, it's a clearance label
          />
      )}

      {/* Expiry Management Modal */}
      {showExpiryModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-4 bg-amber-500 text-white flex justify-between items-center">
                      <h3 className="font-bold flex items-center gap-2"><AlertTriangle size={20}/> إدارة الصلاحية والخصومات الذكية</h3>
                      <button onClick={() => setShowExpiryModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
                      <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-lg text-amber-800 text-sm">
                          هذه الشاشة تعرض المنتجات التي ستنتهي صلاحيتها قريباً (خلال 30 يوماً). يمكنك تطبيق خصم تلقائي عليها لتسريع بيعها.
                      </div>
                      <div className="space-y-4">
                          {products.filter(p => {
                              if (!p.expiryDate) return false;
                              const days = Math.ceil((new Date(p.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                              return days >= 0 && days <= 30;
                          }).length === 0 ? (
                              <div className="text-center text-gray-500 py-10">لا توجد منتجات تقترب من انتهاء الصلاحية.</div>
                          ) : (
                              products.filter(p => {
                                  if (!p.expiryDate) return false;
                                  const days = Math.ceil((new Date(p.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                                  return days >= 0 && days <= 30;
                              }).map(p => {
                                  const days = Math.ceil((new Date(p.expiryDate!).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                                  return (
                                      <div key={p.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
                                          <div>
                                              <div className="font-bold text-gray-800">{p.name}</div>
                                              <div className="text-sm text-gray-500">ينتهي في: {p.expiryDate} <span className="text-amber-600 font-bold">({days} يوم)</span></div>
                                              <div className="text-sm font-bold mt-1">
                                                  السعر الحالي: {p.price} SAR 
                                                  {p.originalPrice && <span className="line-through text-gray-400 ml-2 text-xs">{p.originalPrice} SAR</span>}
                                              </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                              <button 
                                                  onClick={() => {
                                                      setSelectedIds(new Set([p.id]));
                                                      setShowBarcodePrinter(true);
                                                  }}
                                                  className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-1"
                                              >
                                                  <Printer size={16} /> ملصق تصفية
                                              </button>
                                              <button 
                                                  onClick={() => {
                                                      setSelectedProductForDiscount(p);
                                                      setDiscountAmount('');
                                                      setShowDiscountModal(true);
                                                  }}
                                                  className="bg-amber-100 text-amber-700 hover:bg-amber-200 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                                              >
                                                  تطبيق خصم %
                                              </button>
                                          </div>
                                      </div>
                                  );
                              })
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Discount Modal */}
      {showDiscountModal && selectedProductForDiscount && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                  <div className="p-4 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
                      <h3 className="font-bold text-amber-800 flex items-center gap-2">
                          تطبيق خصم
                      </h3>
                      <button onClick={() => setShowDiscountModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
                          <X size={20} />
                      </button>
                  </div>
                  <div className="p-6">
                      <p className="text-gray-700 mb-4 text-center">
                          أدخل نسبة الخصم للمنتج: <br/>
                          <strong>{selectedProductForDiscount.name}</strong>
                      </p>
                      <input
                          type="number"
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent mb-6 text-xl font-mono text-center"
                          placeholder="مثال: 30"
                          autoFocus
                          onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                  confirmDiscount();
                              }
                          }}
                      />
                      <div className="flex gap-3">
                          <button 
                              onClick={() => setShowDiscountModal(false)}
                              className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                          >
                              إلغاء
                          </button>
                          <button 
                              onClick={confirmDiscount}
                              className="flex-1 py-3 px-4 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors shadow-md"
                          >
                              تأكيد
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};