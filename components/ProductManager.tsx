
import React, { useState, useMemo, useRef } from 'react';
import { Product, Unit, User } from '../types';
import { db } from '../services/supabase';
import { parseExcelFile } from '../services/excelService';
import { 
  Plus, Edit2, Trash2, Save, X, Loader2, Package, Search, 
  Barcode, LayoutGrid, Boxes, DollarSign, Tag, Palette, FileSpreadsheet, Ruler
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
  
  // Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importStep, setImportStep] = useState('');
  const excelInputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unitId, setUnitId] = useState('');
  const [price, setPrice] = useState('');
  const [color, setColor] = useState('#ffffff');

  const canEdit = currentUser?.role === 'admin' || currentUser?.permissions.includes('manage_products');

  const toAr = (n: string | number) => {
    if (n === undefined || n === null) return '';
    return n.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  const handleOpenModal = (product?: Product) => {
    if (!canEdit && !product) return;
    
    if (product) {
      setEditingProduct(product);
      setCode(product.code);
      setName(product.name);
      setUnitId(product.unitId);
      setPrice(product.price || '');
      setColor(product.color || '#ffffff');
    } else {
      setEditingProduct(null);
      setCode('');
      setName('');
      setUnitId('');
      setPrice('');
      setColor('#ffffff');
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!code || !name || !unitId) {
        alert("الرجاء إكمال البيانات الإلزامية");
        return;
    }
    setIsSaving(true);
    try {
        const productData: Product = {
          id: editingProduct ? editingProduct.id : crypto.randomUUID(),
          code: code.trim(), 
          name: name.trim(), 
          unitId,
          price: price.trim(),
          color: color
        };
        await db.products.upsert(productData);
        if (editingProduct) {
          setProducts(prev => prev.map(p => p.id === editingProduct.id ? productData : p));
        } else {
          setProducts(prev => [...prev, productData]);
        }
        setIsModalOpen(false);
    } catch (e) { 
        alert("فشل الحفظ في قاعدة البيانات"); 
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    if (!confirm('سيتم حذف السجل نهائياً، هل أنت متأكد؟')) return;
    try {
      await db.products.delete(id);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (e) { alert("فشل الحذف"); }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsImporting(true);
      setImportStep('جاري قراءة ملف البيانات...');

      try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const rawData = await parseExcelFile(file);
          if (rawData.length === 0) {
              alert("الملف فارغ أو التنسيق غير مدعوم");
              setIsImporting(false);
              return;
          }

          setImportStep(`تم العثور على ${rawData.length} منتج. جاري المعالجة...`);
          
          let addedCount = 0;
          let updatedCount = 0;
          const chunkSize = 50;
          
          for (let i = 0; i < rawData.length; i += chunkSize) {
              const chunk = rawData.slice(i, i + chunkSize);
              await Promise.all(chunk.map(async (row: any) => {
                  const findVal = (keys: string[]) => {
                      const key = Object.keys(row).find(k => keys.some(search => k.toLowerCase().includes(search.toLowerCase())));
                      return key ? row[key] : '';
                  };

                  const pCode = String(findVal(['code', 'كود', 'sku', 'رقم']) || '').trim();
                  const pName = String(findVal(['name', 'اسم', 'صنف', 'product']) || '').trim();
                  const pPrice = String(findVal(['price', 'سعر', 'بيع']) || '');
                  const pUnit = String(findVal(['unit', 'وحدة']) || '');

                  if (pName) {
                      let targetUnitId = units.find(u => u.name === pUnit || (pUnit && u.name.includes(pUnit)))?.id;
                      if (!targetUnitId && pUnit) {
                          const newUnit = { id: crypto.randomUUID(), name: pUnit };
                          await db.units.upsert(newUnit);
                          setUnits(prev => [...prev, newUnit]);
                          targetUnitId = newUnit.id;
                      }

                      const existingProduct = products.find(p => p.code === pCode || p.name === pName);
                      const productId = existingProduct ? existingProduct.id : crypto.randomUUID();
                      
                      const productData: Product = {
                          id: productId,
                          code: pCode || `AUTO-${Math.floor(Math.random()*100000)}`,
                          name: pName,
                          unitId: targetUnitId || units[0]?.id || '',
                          price: pPrice || '0',
                          color: '#ffffff'
                      };

                      await db.products.upsert(productData);
                      if (existingProduct) updatedCount++; else addedCount++;
                  }
              }));
              setImportStep(`تم معالجة ${Math.min(i + chunkSize, rawData.length)} من ${rawData.length}...`);
          }

          const allProducts = await db.products.getAll();
          setProducts(allProducts);
          alert(`تمت العملية بنجاح!\nتم إضافة: ${addedCount}\nتم تحديث: ${updatedCount}`);

      } catch (error) {
          console.error(error);
          alert("حدث خطأ غير متوقع أثناء الاستيراد");
      } finally {
          setIsImporting(false);
          if (excelInputRef.current) excelInputRef.current.value = '';
      }
  };

  const getUnitName = (id: string) => units.find(u => u.id === id)?.name || '-';

  const PriceDisplay = ({ val, pColor }: { val: string, pColor?: string }) => {
    if (!val || val === '0') return <span className="text-gray-300">-</span>;
    const [main, dec] = val.includes('.') ? val.split('.') : [val, '٠٠'];
    return (
      <div className="flex items-center justify-center gap-1 font-black" dir="ltr">
        <span className="text-sap-primary text-base">{toAr(main)}</span>
        <span className="text-gray-300">.</span>
        <span 
          className="text-[10px] px-1 rounded border border-black/5" 
          style={{ backgroundColor: pColor && pColor !== '#ffffff' ? pColor : '#FEE2E2', color: pColor && pColor !== '#ffffff' ? '#000' : '#EF4444' }}
        >
          {toAr(dec || '00')}
        </span>
        <span className="text-[8px] text-gray-400 ml-1 uppercase">ريال</span>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500 text-right relative">
      
      {/* Loading Overlay */}
      {isImporting && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 animate-in fade-in">
              <div className="w-64 bg-gray-700 rounded-full h-2 mb-6 overflow-hidden relative shadow-lg border border-white/10">
                 <div className="h-full bg-gradient-to-r from-sap-secondary via-white to-sap-secondary w-1/2 animate-[shimmer_1.5s_infinite_linear] absolute"></div> 
              </div>
              <h2 className="text-2xl font-black text-white mb-2">جاري الاستيراد</h2>
              <p className="text-white/70 font-bold animate-pulse">{importStep || 'يرجى الانتظار...'}</p>
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 border border-sap-border rounded-sap-m shadow-sm">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-sap-highlight text-sap-primary rounded-xl">
                <Boxes size={28} />
            </div>
            <div>
                <h2 className="text-2xl font-black text-sap-text">المنتجات</h2>
                <p className="text-xs text-sap-text-variant font-bold mt-1">عرض وتعديل كود المنتج، الاسم، والوحدة</p>
            </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
                <input 
                  type="text" 
                  placeholder="بحث بالكود أو الاسم..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-lg text-sm font-bold focus:border-sap-primary"
                />
                <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            
            {canEdit && (
                <>
                    <input type="file" ref={excelInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" className="hidden" />
                    <button onClick={() => excelInputRef.current?.click()} className="bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-black hover:bg-green-700 shadow-md flex items-center gap-2 transition-all active:scale-95">
                        <FileSpreadsheet size={18}/> استيراد
                    </button>
                    <button onClick={() => handleOpenModal()} className="bg-sap-primary text-white px-6 py-2.5 rounded-lg text-sm font-black hover:bg-sap-primary-hover shadow-md flex items-center gap-2 transition-all active:scale-95">
                        <Plus size={20}/> إضافة منتج
                    </button>
                </>
            )}
        </div>
      </div>

      <div className="flex-1 bg-white border border-sap-border rounded-sap-m overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-auto custom-scrollbar flex-1">
            <table className="w-full text-right text-sm">
            <thead className="sticky top-0 z-10">
                <tr className="bg-sap-shell text-white text-[12px] font-black uppercase tracking-wider">
                    <th className="px-6 py-4 border-l border-white/10 w-48 flex items-center gap-2"><Barcode size={16}/> كود المنتج</th>
                    <th className="px-6 py-4 border-l border-white/10"><Package size={16} className="inline mr-2"/> اسم الصنف</th>
                    <th className="px-6 py-4 w-40 text-center border-l border-white/10"><Ruler size={16} className="inline mr-2"/> الوحدة</th>
                    <th className="px-6 py-4 w-40 text-center border-l border-white/10"><DollarSign size={16} className="inline mr-2"/> السعر</th>
                    {canEdit && <th className="px-6 py-4 w-32 text-center">التحكم</th>}
                </tr>
            </thead>
            <tbody className="divide-y divide-sap-border font-bold">
                {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-sap-highlight/20 transition-colors group relative">
                    {/* CODE COLUMN */}
                    <td className="px-6 py-4 relative">
                        {p.color && p.color !== '#ffffff' && <div className="absolute top-0 right-0 w-1 h-full" style={{ backgroundColor: p.color }}></div>}
                        <span className="font-mono text-base font-black text-sap-primary tracking-wider">{toAr(p.code)}</span>
                    </td>
                    {/* NAME COLUMN */}
                    <td className="px-6 py-4">
                        <span className="text-sap-text text-sm">{p.name}</span>
                    </td>
                    {/* UNIT COLUMN */}
                    <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-gray-100 rounded-full text-[11px] font-black border border-gray-200 text-gray-600">
                            {getUnitName(p.unitId)}
                        </span>
                    </td>
                    {/* PRICE COLUMN */}
                    <td className="px-6 py-4 text-center">
                        <PriceDisplay val={p.price || ''} pColor={p.color} />
                    </td>
                    {canEdit && (
                        <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => handleOpenModal(p)} className="p-2 text-sap-text-variant hover:text-sap-primary hover:bg-sap-highlight rounded-lg transition-all"><Edit2 size={16}/></button>
                                <button onClick={() => handleDelete(p.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                            </div>
                        </td>
                    )}
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white border-2 border-sap-primary shadow-2xl w-full max-w-lg rounded-sap-m overflow-hidden animate-in zoom-in duration-200">
            <div className="px-6 py-4 bg-sap-primary text-white flex justify-between items-center">
              <h3 className="text-base font-black flex items-center gap-2">
                  {editingProduct ? 'تعديل بيانات المنتج' : 'إضافة صنف جديد'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                      <label className="block text-xs font-black text-gray-500 mb-2 uppercase tracking-widest">كود الصنف</label>
                      <input type="text" value={code} onChange={e => setCode(e.target.value)} className="w-full pr-4 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-sap-primary font-mono font-black text-lg text-right" placeholder="P-0000" />
                  </div>
                  <div className="space-y-1">
                      <label className="block text-xs font-black text-gray-500 mb-2 uppercase tracking-widest">سعر البيع (15.50)</label>
                      <div className="relative">
                        <input type="text" value={price} onChange={e => setPrice(e.target.value)} className="w-full pr-4 pl-10 py-3 border-2 border-gray-200 rounded-lg focus:border-sap-primary font-black text-lg text-sap-primary text-left" placeholder="0.00" />
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                      </div>
                  </div>
              </div>
              
              <div className="space-y-1">
                  <label className="block text-xs font-black text-gray-500 mb-2 uppercase tracking-widest">اسم المنتج</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full pr-4 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-sap-primary font-bold text-sm" placeholder="أدخل اسم المنتج..." />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                      <label className="block text-xs font-black text-gray-500 mb-2 uppercase tracking-widest">وحدة القياس</label>
                      <select value={unitId} onChange={e => setUnitId(e.target.value)} className="w-full pr-4 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-sap-primary font-bold text-sm bg-white">
                            <option value="">-- اختر الوحدة --</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                  </div>
                  <div className="space-y-1">
                      <label className="block text-xs font-black text-gray-500 mb-2 uppercase tracking-widest">لون التمييز (الخلفية)</label>
                      <div className="flex items-center gap-3 border-2 border-gray-200 rounded-lg p-2 bg-gray-50">
                          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 border-none cursor-pointer rounded bg-transparent" />
                          <span className="text-[10px] font-mono font-black text-gray-400 uppercase">{color}</span>
                          <Palette size={16} className="text-gray-300 ml-auto" />
                      </div>
                  </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border-2 border-gray-200 text-gray-500 rounded-lg font-black text-xs hover:bg-gray-50">إلغاء</button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-sap-primary text-white rounded-lg font-black text-xs hover:bg-sap-primary-hover shadow-lg flex justify-center items-center gap-2 transition-all"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} حفظ المنتج
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
