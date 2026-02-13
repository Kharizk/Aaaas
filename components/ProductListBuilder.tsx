
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Product, Unit, ListType, ListRow, SavedTagList, SelectedTag } from '../types';
import { db } from '../services/supabase';
import { ReportLayout } from './ReportLayout';
import { GoogleGenAI, Type } from "@google/genai";
import { parseExcelFile, generateInventoryTemplate } from '../services/excelService';
import { 
  Printer, Plus, Trash2, Save, FolderOpen, Loader2, 
  Calendar, X, FileText, CheckCircle2, FileCheck2, ClipboardList, Truck, AlertTriangle, ScanLine, Image as ImageIcon, Sparkles, FileSpreadsheet, FileIcon,
  Tag, CheckSquare, Square, ArrowRight, Download, UploadCloud, Search, Barcode, ChevronDown, Eraser
} from 'lucide-react';

interface ProductListBuilderProps {
  products: Product[];
  units: Unit[];
  onNewProductsAdded?: () => void;
  initialListParams?: { listId: string, rowId?: string } | null;
  clearInitialParams?: () => void;
}

export const ProductListBuilder: React.FC<ProductListBuilderProps> = ({ products, units, onNewProductsAdded, initialListParams, clearInitialParams }) => {
  const generateId = () => crypto.randomUUID();
  const createEmptyRow = (): ListRow => ({
    id: generateId(), code: '', name: '', unitId: '', qty: '', expiryDate: '', note: '', isDismissed: false
  });

  const [rows, setRows] = useState<ListRow[]>([createEmptyRow()]);
  const [listName, setListName] = useState('');
  const [listDate, setListDate] = useState(new Date().toISOString().split('T')[0]);
  const [listType, setListType] = useState<ListType>('inventory');
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedLists, setShowSavedLists] = useState(false);
  const [savedLists, setSavedLists] = useState<any[]>([]);
  const [savedListSearch, setSavedListSearch] = useState(''); // New search state for archive
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  
  // Import State
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>(''); 
  
  // New Items Handling
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [showNewItemsModal, setShowNewItemsModal] = useState(false);
  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(new Set());
  const [tempExtractedRows, setTempExtractedRows] = useState<ListRow[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  
  // Search & Navigation State
  const [activeSearch, setActiveSearch] = useState<{ rowId: string, field: 'name' | 'code' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0); 
  
  // Highlighting State
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);

  const totalQty = rows.reduce((acc, row) => acc + (Number(row.qty) || 0), 0);
  const validRowsCount = rows.filter(r => r.name.trim()).length;

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  // Load Initial List (from Deep Link / Dashboard)
  useEffect(() => {
      if (initialListParams) {
          const loadInitial = async () => {
              try {
                  const allLists = await db.lists.getAll();
                  const targetList = allLists.find((l: any) => l.id === initialListParams.listId);
                  
                  if (targetList) {
                      loadList(targetList);
                      if (initialListParams.rowId) {
                          setHighlightedRowId(initialListParams.rowId);
                          setTimeout(() => {
                              const el = document.getElementById(`row-${initialListParams.rowId}`);
                              if (el) {
                                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  setTimeout(() => setHighlightedRowId(null), 3000);
                              }
                          }, 500);
                      }
                  } else {
                      alert("القائمة المطلوبة غير موجودة");
                  }
              } catch (e) {
                  console.error(e);
              } finally {
                  if (clearInitialParams) clearInitialParams();
              }
          };
          loadInitial();
      }
  }, [initialListParams]);

  const fetchSavedLists = async () => {
    setIsLoadingLists(true);
    try {
      const data = await db.lists.getAll();
      setSavedLists(data);
    } catch (e) { console.error(e); }
    finally { setIsLoadingLists(false); }
  };

  const loadList = (list: any) => {
    setActiveListId(list.id);
    setListName(list.name);
    setListDate(list.date);
    setListType(list.type || 'inventory');
    setRows(list.rows && list.rows.length > 0 ? list.rows : [createEmptyRow()]);
    setShowSavedLists(false);
  };

  const filteredSavedLists = useMemo(() => {
      if (!savedListSearch.trim()) return savedLists;
      return savedLists.filter(l => 
          l.name.toLowerCase().includes(savedListSearch.toLowerCase()) ||
          l.date.includes(savedListSearch)
      );
  }, [savedLists, savedListSearch]);

  const handleSave = async () => {
    const validRows = rows.filter(r => r.name.trim());
    if (validRows.length === 0) { alert("لا توجد بيانات صالحة للحفظ"); return; }
    setIsSaving(true);
    try {
      const listId = activeListId || crypto.randomUUID();
      await db.lists.upsert({ 
        id: listId, 
        name: listName || (listType === 'inventory' ? 'قائمة جرد' : 'سند استلام'), 
        date: listDate, 
        type: listType,
        rows: validRows 
      });
      setActiveListId(listId);
      alert("تم حفظ المستند بنجاح");
    } catch (e) { alert("فشل الحفظ"); }
    finally { setIsSaving(false); }
  };

  // --- Excel Import ---
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsScanning(true);
      setScanStep('جاري قراءة ملف Excel...');

      try {
          const rawData = await parseExcelFile(file);
          if (rawData.length === 0) {
              alert("الملف فارغ أو التنسيق غير صحيح");
              return;
          }

          setScanStep('معالجة الصفوف...');
          
          await new Promise(resolve => setTimeout(resolve, 500));

          const newRows: ListRow[] = rawData.map(item => {
              const findVal = (keys: string[]) => {
                  const key = Object.keys(item).find(k => keys.some(search => k.toLowerCase().includes(search.toLowerCase())));
                  return key ? item[key] : '';
              };

              const rawCode = findVal(['code', 'كود', 'رقم', 'sku']) || '';
              const code = rawCode ? String(rawCode).trim() : '';
              
              const name = findVal(['name', 'اسم', 'صنف', 'item', 'product']) || '';
              const qty = findVal(['qty', 'quantity', 'كمية', 'عدد', 'رصيد']) || '';
              const unitRaw = findVal(['unit', 'وحدة', 'عبوة']) || '';
              const expiryDate = findVal(['date', 'expiry', 'تاريخ', 'صلاحية']) || '';

              const matchedUnit = units.find(u => u.name === unitRaw || (unitRaw && u.name.includes(unitRaw)))?.id || '';

              let finalName = name;
              let finalUnit = matchedUnit;
              
              if (code) {
                  const existingProduct = products.find(p => p.code === code);
                  if (existingProduct) {
                      finalName = existingProduct.name;
                      finalUnit = existingProduct.unitId;
                  }
              }

              return {
                  id: generateId(),
                  code: code,
                  name: finalName ? String(finalName) : 'صنف غير معروف',
                  unitId: finalUnit,
                  qty: Number(qty) || '',
                  expiryDate: expiryDate ? String(expiryDate).split('T')[0] : '', 
                  note: '',
                  isDismissed: false
              };
          });

          setRows(prev => {
              const cleanPrev = prev.filter(r => r.name.trim() !== '');
              return [...cleanPrev, ...newRows, createEmptyRow()];
          });
          alert(`تم استيراد ${newRows.length} صنف بنجاح.`);

      } catch (error) {
          console.error("Excel Import Error", error);
          alert("خطأ في قراءة ملف Excel");
      } finally {
          setIsScanning(false);
          if (excelInputRef.current) excelInputRef.current.value = '';
      }
  };

  // --- AI Image/PDF Processing (Strict Schema) ---
  const handleSmartScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanStep('جاري رفع الملف...');
    
    try {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            
            setScanStep('تحليل المستند بالذكاء الاصطناعي...');
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const inventorySchema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        code: { type: Type.STRING, description: "The product code, SKU, or barcode if visible." },
                        name: { type: Type.STRING, description: "The full name or description of the product." },
                        qty: { type: Type.NUMBER, description: "The quantity or count. Must be a number." },
                        unit: { type: Type.STRING, description: "The unit of measure (e.g., PCS, KG, BOX) if available." },
                        expiryDate: { type: Type.STRING, description: "Expiry date in YYYY-MM-DD format if available." },
                        price: { type: Type.NUMBER, description: "Unit price if available." }
                    },
                    required: ["name"]
                }
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    {
                        parts: [
                            { 
                                text: `Extract inventory items. Return strict JSON. If qty missing use 0. If code missing use empty string.` 
                            },
                            { inlineData: { mimeType: file.type, data: base64Data } }
                        ]
                    }
                ],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: inventorySchema
                }
            });

            setScanStep('معالجة البيانات...');
            
            let extractedData: any[] = [];
            try {
                const text = response.text || '[]';
                extractedData = JSON.parse(text);
            } catch (e) {
                const cleanText = (response.text || '').replace(/```json|```/g, '').trim();
                try { extractedData = JSON.parse(cleanText); } catch (e2) {}
            }
            
            if (Array.isArray(extractedData) && extractedData.length > 0) {
                const foundNewProducts: Product[] = [];
                const processedRows: ListRow[] = extractedData.map((item: any) => {
                    const extractedCode = item.code ? String(item.code).trim() : '';
                    const extractedName = item.name ? String(item.name).trim() : 'UNKNOWN';
                    
                    const existingProduct = products.find(p => 
                        (extractedCode && p.code === extractedCode) || 
                        p.name.toLowerCase() === extractedName.toLowerCase()
                    );
                    
                    const finalName = existingProduct ? existingProduct.name : extractedName;
                    let finalUnitId = existingProduct ? existingProduct.unitId : '';
                    
                    if (!finalUnitId && item.unit) {
                            finalUnitId = units.find(u => u.name.includes(item.unit) || item.unit?.includes(u.name))?.id || '';
                    }

                    if (!existingProduct && extractedName && extractedName !== 'UNKNOWN') {
                        if (!foundNewProducts.some(np => np.name === extractedName)) {
                            foundNewProducts.push({
                                id: crypto.randomUUID(),
                                code: extractedCode || `AUTO-${Math.floor(Math.random() * 10000)}`,
                                name: extractedName,
                                unitId: finalUnitId || '',
                                price: item.price ? String(item.price) : '0',
                                color: '#ffffff'
                            });
                        }
                    }

                    return {
                        id: generateId(),
                        code: extractedCode,
                        name: finalName,
                        unitId: finalUnitId,
                        qty: Number(item.qty) || '',
                        expiryDate: item.expiryDate || '',
                        note: '',
                        isDismissed: false
                    };
                });

                setTempExtractedRows(processedRows);

                if (foundNewProducts.length > 0) {
                    setPendingProducts(foundNewProducts);
                    setSelectedPendingIds(new Set(foundNewProducts.map(p => p.id)));
                    setShowNewItemsModal(true);
                    setIsScanning(false); 
                    return;
                }

                setRows(prev => {
                    const cleanPrev = prev.filter(r => r.name.trim() !== '');
                    return [...cleanPrev, ...processedRows, createEmptyRow()];
                });
                alert(`تم استخراج ${processedRows.length} صنف.`);
                
            } else {
                alert("لم يتم العثور على بيانات في الصورة.");
            }
            setIsScanning(false);
        };
        reader.readAsDataURL(file);
    } catch (error) {
        alert("خطأ في خدمة الذكاء الاصطناعي");
        setIsScanning(false);
    } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleProcessNewItems = async (action: 'add_only' | 'add_and_label') => {
      const selectedItems = pendingProducts.filter(p => selectedPendingIds.has(p.id));
      if (selectedItems.length > 0) {
          try {
              await Promise.all(selectedItems.map(p => db.products.upsert(p)));
              if (onNewProductsAdded) await onNewProductsAdded();
          } catch (e) { alert("خطأ في قاعدة البيانات"); return; }

          if (action === 'add_and_label') {
              try {
                  const tagList: SavedTagList = {
                      id: crypto.randomUUID(),
                      name: `استيراد تلقائي - ${new Date().toLocaleDateString('en-US')}`,
                      date: new Date().toISOString(),
                      tags: selectedItems.map(p => ({
                          id: crypto.randomUUID(), productId: p.id, name: p.name, price: p.price || '0',
                          unitName: units.find(u => u.id === p.unitId)?.name || '', originalPrice: ''
                      })),
                      styles: {
                          nameFontSize: 14, priceFontSize: 28, nameColor: '#000000', priceColor: '#DC2626', unitColor: '#6B7280', currencyColor: '#000000', originalPriceColor: '#EF4444', showLogo: true, logoUrl: null, logoSize: 30, topMargin: 0, bottomMargin: 0, leftMargin: 0, rightMargin: 0, tagHeight: 37, showBorder: true, showUnit: true, showOriginalPrice: false, template: 'classic_vertical', backgroundColor: '#ffffff'
                      }
                  };
                  await db.tagLists.upsert(tagList);
                  alert("تمت إضافة المنتجات وإنشاء قائمة ملصقات");
              } catch (e) { alert("فشل إنشاء الملصقات"); }
          } else {
              alert(`تمت إضافة ${selectedItems.length} منتج جديد`);
          }
      }
      setRows(prev => {
          const cleanPrev = prev.filter(r => r.name.trim() !== '');
          return [...cleanPrev, ...tempExtractedRows, createEmptyRow()];
      });
      setShowNewItemsModal(false);
      setPendingProducts([]);
      setTempExtractedRows([]);
  };

  const selectProductForRow = (rowId: string, product: Product) => {
    setRows(prev => prev.map(row => row.id === rowId ? { ...row, code: product.code, name: product.name, unitId: product.unitId } : row));
    setActiveSearch(null);
    setSearchTerm('');
    setTimeout(() => { const qtyInput = document.getElementById(`qty-${rowId}`); if (qtyInput) qtyInput.focus(); }, 50);
  };

  const getUnitName = (id: string) => units.find(u => u.id === id)?.name || '-';

  const focusNextField = (e: React.KeyboardEvent, currentRowId: string, currentField: string) => {
      e.preventDefault();
      if (currentField === 'expiryDate') {
          const isLastRow = rows[rows.length - 1].id === currentRowId;
          if (isLastRow) {
              const newRow = createEmptyRow();
              setRows(prev => [...prev, newRow]);
              setTimeout(() => { const nextInput = document.getElementById(`code-${newRow.id}`); if (nextInput) nextInput.focus(); }, 50);
          } else {
              const currIdx = rows.findIndex(r => r.id === currentRowId);
              if (currIdx !== -1 && rows[currIdx + 1]) {
                  const nextInput = document.getElementById(`code-${rows[currIdx + 1].id}`);
                  if (nextInput) nextInput.focus();
              }
          }
      } else {
          let nextId = '';
          if (currentField === 'code') nextId = `name-${currentRowId}`;
          else if (currentField === 'name') nextId = `qty-${currentRowId}`;
          else if (currentField === 'qty') nextId = `unit-${currentRowId}`;
          else if (currentField === 'unit') nextId = `expiry-${currentRowId}`;
          const nextEl = document.getElementById(nextId);
          if (nextEl) nextEl.focus();
      }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent, rowId: string, field: 'name' | 'code') => {
      if (filteredProducts.length > 0 && activeSearch?.rowId === rowId) {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : prev)); return; }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0)); return; }
          if (e.key === 'Enter') { e.preventDefault(); const selected = filteredProducts[selectedIndex]; if (selected) selectProductForRow(rowId, selected); return; }
          if (e.key === 'Escape') { setActiveSearch(null); return; }
      }
      if (e.key === 'Enter') focusNextField(e, rowId, field);
  };

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return [];
    return products.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)).slice(0, 10);
  }, [searchTerm, products]);

  const getExpiryStatus = (dateStr: string) => {
      if (!dateStr) return { days: null, status: 'normal' };
      const today = new Date();
      today.setHours(0,0,0,0);
      const exp = new Date(dateStr);
      const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 3600 * 24));
      if (diff <= 0) return { days: diff, status: 'expired' }; 
      if (diff <= 30) return { days: diff, status: 'critical' }; 
      if (diff <= 90) return { days: diff, status: 'warning' }; 
      return { days: diff, status: 'normal' };
  };

  const PrintView = () => {
    const portalNode = document.getElementById('print-container');
    if (!portalNode) return null;
    return createPortal(
      <ReportLayout title={listType === 'inventory' ? "قائمة جرد المخزون" : "سند استلام بضاعة"} subtitle={listName || "مستند مستودعي"}>
          <div className="grid grid-cols-2 gap-4 mb-4 text-[10px] font-bold bg-gray-50 p-2 border border-sap-border font-mono">
              <div className="space-y-1">
                  <div className="flex justify-between"><span>التاريخ:</span> <span>{listDate}</span></div>
                  <div className="flex justify-between"><span>النوع:</span> <span className="text-sap-primary">{listType === 'inventory' ? 'جرد' : 'استلام'}</span></div>
              </div>
              <div className="space-y-1">
                  <div className="flex justify-between"><span>عدد الأصناف:</span> <span>{validRowsCount}</span></div>
                  <div className="flex justify-between"><span>إجمالي الكمية:</span> <span className="text-sap-primary">{totalQty}</span></div>
              </div>
          </div>
          <table className="w-full text-right border-collapse">
              <thead>
                  <tr className="bg-sap-shell text-white text-[9px] font-black uppercase">
                      <th className="p-1 border border-sap-border w-8 text-center" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>#</th>
                      <th className="p-1 border border-sap-border w-24" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>كود الصنف</th>
                      <th className="p-1 border border-sap-border" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>اسم المنتج</th>
                      <th className="p-1 border border-sap-border w-16 text-center" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>الكمية</th>
                      <th className="p-1 border border-sap-border w-16" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>الوحدة</th>
                      <th className="p-1 border border-sap-border w-24" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>الصلاحية</th>
                  </tr>
              </thead>
              <tbody className="text-[9px] font-bold font-mono">
                  {rows.filter(r => r.name.trim()).map((row, idx) => {
                      const { status } = getExpiryStatus(row.expiryDate);
                      let rowStyle: React.CSSProperties = { borderBottom: '1px solid #E2E8F0' };
                      let statusText = "";
                      if (status === 'expired') { rowStyle = { ...rowStyle, backgroundColor: '#FECACA', color: '#991B1B', WebkitPrintColorAdjust: 'exact' }; statusText = "منتهي"; } 
                      else if (status === 'critical') { rowStyle = { ...rowStyle, backgroundColor: '#FED7AA', color: '#9A3412', WebkitPrintColorAdjust: 'exact' }; statusText = "حرج"; } 
                      else if (status === 'warning') { rowStyle = { ...rowStyle, backgroundColor: '#FEF08A', color: '#854D0E', WebkitPrintColorAdjust: 'exact' }; statusText = "تنبيه"; } 
                      else { if (idx % 2 === 0) rowStyle = { ...rowStyle, backgroundColor: '#FFFFFF' }; else rowStyle = { ...rowStyle, backgroundColor: '#F9FAFB' }; }
                      return (
                          <tr key={row.id} style={rowStyle}>
                              <td className="p-1 text-center border-l border-sap-border/50">{idx + 1}</td>
                              <td className="p-1 border-l border-sap-border/50">{row.code}</td>
                              <td className="p-1 border-l border-sap-border/50">{row.name}</td>
                              <td className="p-1 text-center border-l border-sap-border/50">{row.qty}</td>
                              <td className="p-1 border-l border-sap-border/50">{getUnitName(row.unitId)}</td>
                              <td className="p-1 border-l border-sap-border/50">
                                  <div className="flex items-center justify-between"><span>{row.expiryDate || '-'}</span>{statusText && <span className="text-[8px] border px-1">{statusText}</span>}</div>
                              </td>
                          </tr>
                      );
                  })}
              </tbody>
          </table>
      </ReportLayout>, portalNode
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500 relative">
      <PrintView />
      
      {/* Unified Toolbar */}
      <div className="bg-white border border-gray-200 p-2 rounded-2xl shadow-sm flex flex-col xl:flex-row justify-between items-center gap-4">
          {/* Left: Input Info */}
          <div className="flex items-center gap-3 w-full xl:w-auto p-1">
              <button 
                onClick={() => setListType(prev => prev === 'inventory' ? 'receipt' : 'inventory')}
                className={`p-2.5 rounded-xl transition-all border ${listType === 'inventory' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}
                title={listType === 'inventory' ? 'تحويل لسند استلام' : 'تحويل لقائمة جرد'}
              >
                  {listType === 'inventory' ? <ClipboardList size={20}/> : <Truck size={20}/>}
              </button>
              <div className="flex-1 min-w-[200px]">
                  <input 
                    type="text" 
                    value={listName} 
                    onChange={e => setListName(e.target.value)} 
                    placeholder="اسم القائمة / مرجع المستند..." 
                    className="w-full text-sm font-black bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-sap-primary outline-none px-2 py-1.5 transition-colors" 
                  />
                  <div className="text-[10px] text-gray-400 font-bold px-2 mt-0.5">{listType === 'inventory' ? 'جرد مخزون' : 'سند استلام بضاعة'} - {listDate}</div>
              </div>
          </div>
          
          {/* Right: Actions Group */}
          <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-end px-2">
                {/* File Group */}
                <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                    <button onClick={() => { setActiveListId(null); setRows([createEmptyRow()]); setListName(''); }} className="px-3 py-2 hover:bg-white hover:text-red-500 text-gray-500 text-xs font-bold rounded-lg transition-all flex items-center gap-2" title="مسح القائمة">
                        <Eraser size={16}/> <span className="hidden sm:inline">جديد</span>
                    </button>
                    <button onClick={() => { fetchSavedLists(); setShowSavedLists(true); }} className="px-3 py-2 hover:bg-white hover:text-sap-primary text-gray-500 text-xs font-bold rounded-lg transition-all flex items-center gap-2" title="فتح الأرشيف">
                        <FolderOpen size={16}/> <span className="hidden sm:inline">الأرشيف</span>
                    </button>
                </div>

                {/* Import Group */}
                <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                    <button onClick={generateInventoryTemplate} className="px-3 py-2 hover:bg-white text-gray-500 text-xs font-bold rounded-lg transition-all" title="تحميل نموذج Excel">
                        <Download size={16}/>
                    </button>
                    <div className="w-px h-6 bg-gray-200 self-center mx-1"></div>
                    <input type="file" ref={excelInputRef} onChange={handleExcelImport} accept=".xlsx, .xls" className="hidden" />
                    <button onClick={() => excelInputRef.current?.click()} className="px-3 py-2 hover:bg-white text-gray-500 text-xs font-bold rounded-lg transition-all flex items-center gap-2">
                        <UploadCloud size={16}/> <span className="hidden sm:inline">Excel</span>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleSmartScan} accept="image/*, application/pdf" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isScanning} className="px-3 py-2 hover:bg-white text-indigo-600 text-xs font-bold rounded-lg transition-all flex items-center gap-2">
                        {isScanning ? <Loader2 size={16} className="animate-spin"/> : <ScanLine size={16}/>} <span className="hidden sm:inline">AI Scan</span>
                    </button>
                </div>

                {/* Output Group */}
                <div className="flex gap-2">
                    <button onClick={() => window.print()} className="px-4 py-2 bg-gray-800 text-white text-xs font-black rounded-xl flex items-center gap-2 hover:bg-black transition-all shadow-sm">
                        <Printer size={16}/> طباعة
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 bg-sap-primary text-white text-xs font-black rounded-xl flex items-center gap-2 hover:bg-sap-primary-hover shadow-lg shadow-sap-primary/20 transition-all active:scale-95">
                        {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} حفظ
                    </button>
                </div>
          </div>
      </div>

      {/* Main Grid - POS Style */}
      <div className="flex-1 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col relative">
        <div className="overflow-auto custom-scrollbar flex-1 bg-gray-50/30">
          <table className="w-full text-right text-xs">
            <thead className="bg-white sticky top-0 z-10 shadow-sm">
              <tr className="text-gray-500 font-black border-b border-gray-200 text-[11px] uppercase">
                <th className="p-4 w-12 text-center">#</th>
                <th className="p-4 w-40">كود الصنف</th>
                <th className="p-4">اسم المنتج / الوصف</th>
                <th className="p-4 w-28 text-center">الكمية</th>
                <th className="p-4 w-32">الوحدة</th>
                <th className="p-4 w-32">الصلاحية</th>
                <th className="p-4 w-14"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {rows.map((row, idx) => (
                <tr 
                  id={`row-${row.id}`}
                  key={row.id} 
                  className={`group transition-colors duration-500 ${highlightedRowId === row.id ? 'bg-yellow-100' : 'hover:bg-blue-50/30'}`}
                >
                  <td className="p-4 text-center text-gray-400 font-mono font-bold">{idx + 1}</td>
                  
                  {/* Code */}
                  <td className="p-3 relative">
                    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg focus-within:border-sap-primary focus-within:ring-2 focus-within:ring-sap-primary/10 transition-all">
                        <div className="pl-2 pr-3 text-gray-400"><Barcode size={14}/></div>
                        <input 
                          id={`code-${row.id}`} type="text" value={row.code} 
                          onKeyDown={(e) => handleSearchKeyDown(e, row.id, 'code')}
                          onChange={e => {
                            const val = e.target.value;
                            setRows(prev => prev.map(r => r.id === row.id ? { ...r, code: val } : r));
                            setActiveSearch({ rowId: row.id, field: 'code' });
                            setSearchTerm(val);
                          }}
                          className="w-full bg-transparent border-none p-2.5 font-mono font-black text-sap-primary placeholder-gray-300 text-sm focus:ring-0"
                          placeholder="SCAN" autoComplete="off"
                        />
                    </div>
                    {activeSearch?.rowId === row.id && activeSearch.field === 'code' && filteredProducts.length > 0 && (
                      <div className="absolute top-full right-0 z-50 bg-white border border-sap-primary w-64 shadow-xl mt-1 rounded-xl overflow-hidden">
                          {filteredProducts.map((p, i) => (
                              <div key={p.id} onClick={() => selectProductForRow(row.id, p)} className={`p-3 cursor-pointer border-b border-gray-50 flex justify-between items-center ${i === selectedIndex ? 'bg-sap-primary text-white' : 'hover:bg-gray-50 text-gray-700'}`}>
                                  <span className="font-mono font-black">{p.code}</span><span className="text-[10px] opacity-70 truncate max-w-[100px]">{p.name}</span>
                              </div>
                          ))}
                      </div>
                    )}
                  </td>

                  {/* Name */}
                  <td className="p-3 relative">
                    <input 
                      id={`name-${row.id}`} type="text" value={row.name} 
                      onKeyDown={(e) => handleSearchKeyDown(e, row.id, 'name')}
                      onChange={e => {
                        const val = e.target.value;
                        setRows(prev => prev.map(r => r.id === row.id ? { ...r, name: val } : r));
                        setActiveSearch({ rowId: row.id, field: 'name' });
                        setSearchTerm(val);
                      }}
                      className="w-full bg-transparent border-b border-gray-200 focus:border-sap-primary p-2 focus:ring-0 font-bold text-gray-800 placeholder-gray-300 transition-colors"
                      placeholder="بحث عن منتج..." autoComplete="off"
                    />
                    {activeSearch?.rowId === row.id && activeSearch.field === 'name' && filteredProducts.length > 0 && (
                      <div className="absolute top-full right-0 z-50 bg-white border border-sap-primary w-full shadow-xl mt-1 rounded-xl overflow-hidden">
                          {filteredProducts.map((p, i) => (
                              <div key={p.id} onClick={() => selectProductForRow(row.id, p)} className={`p-3 cursor-pointer border-b border-gray-50 flex justify-between items-center ${i === selectedIndex ? 'bg-sap-primary text-white' : 'hover:bg-gray-50 text-gray-700'}`}>
                                  <span className="font-bold">{p.name}</span><span className="text-[10px] opacity-70 font-mono">{p.code}</span>
                              </div>
                          ))}
                      </div>
                    )}
                  </td>

                  {/* Qty */}
                  <td className="p-3">
                    <input id={`qty-${row.id}`} type="number" value={row.qty} onKeyDown={(e) => { if(e.key === 'Enter') focusNextField(e, row.id, 'qty') }} onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, qty: e.target.value === '' ? '' : Number(e.target.value) } : r))} className="w-full bg-gray-50 rounded-xl border-transparent focus:border-sap-primary focus:bg-white text-center font-black text-sap-secondary placeholder-gray-300 py-2.5 text-sm" placeholder="0" />
                  </td>

                  {/* Unit */}
                  <td className="p-3">
                    <select id={`unit-${row.id}`} value={row.unitId} onKeyDown={(e) => { if(e.key === 'Enter') focusNextField(e, row.id, 'unit') }} onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, unitId: e.target.value } : r))} className="w-full bg-transparent border-b border-gray-200 focus:border-sap-primary p-2 focus:ring-0 text-xs font-bold text-gray-600 cursor-pointer">
                      <option value="">- اختر -</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </td>

                  {/* Expiry */}
                  <td className="p-3 relative">
                    <input id={`expiry-${row.id}`} type="date" value={row.expiryDate} onKeyDown={(e) => { if(e.key === 'Enter') focusNextField(e, row.id, 'expiryDate') }} onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, expiryDate: e.target.value } : r))} className="w-full bg-transparent border-b border-gray-200 focus:border-sap-primary p-2 focus:ring-0 text-xs font-mono text-gray-600" />
                    {getExpiryStatus(row.expiryDate).status !== 'normal' && <div className="absolute left-0 top-1/2 -translate-y-1/2 text-red-500"><AlertTriangle size={14} /></div>}
                  </td>

                  <td className="p-3 text-center">
                    <button onClick={() => setRows(prev => prev.filter(r => r.id !== row.id))} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
              
              {/* Add Row Button at bottom of table */}
              <tr>
                  <td colSpan={7} className="p-3">
                      <button onClick={() => setRows(prev => [...prev, createEmptyRow()])} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-bold hover:border-sap-primary hover:text-sap-primary hover:bg-sap-highlight/10 transition-all flex items-center justify-center gap-2">
                          <Plus size={18}/> إضافة سطر جديد (أو اضغط Enter)
                      </button>
                  </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* Footer Summary */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-xs font-black text-gray-500 uppercase tracking-wide">
            <div>عدد السجلات: <span className="text-gray-900 text-sm ml-1">{validRowsCount}</span></div>
            <div>إجمالي الكميات: <span className="text-sap-primary text-xl font-mono ml-2">{totalQty}</span></div>
        </div>
      </div>

      {/* Loading Overlay */}
      {isScanning && (
          <div className="fixed inset-0 z-[200] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-in fade-in">
              <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200 mb-6 animate-pulse">
                 <ScanLine size={40} className="text-white"/>
              </div>
              <h2 className="text-2xl font-black text-gray-800 mb-2">جاري المعالجة الذكية</h2>
              <p className="text-gray-500 font-bold">{scanStep}</p>
          </div>
      )}

      {/* New Items Modal */}
      {showNewItemsModal && (
          <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-white/20">
                  <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-white/20 rounded-xl"><Sparkles size={24}/></div>
                          <div>
                              <h3 className="font-black text-lg">تم اكتشاف أصناف جديدة</h3>
                              <p className="text-xs text-indigo-200 font-bold opacity-80">عثر الذكاء الاصطناعي على {pendingProducts.length} منتج غير مسجل</p>
                          </div>
                      </div>
                      <button onClick={() => setShowNewItemsModal(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors"><X size={24}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto bg-gray-50 p-6 custom-scrollbar">
                      <div className="flex justify-between items-center mb-6">
                          <button onClick={() => { if (selectedPendingIds.size === pendingProducts.length) setSelectedPendingIds(new Set()); else setSelectedPendingIds(new Set(pendingProducts.map(p => p.id))); }} className="text-xs font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-2">
                              {selectedPendingIds.size === pendingProducts.length ? <CheckSquare size={18}/> : <Square size={18}/>} 
                              تحديد الكل
                          </button>
                          <span className="text-xs font-bold text-gray-500">تم تحديد: {selectedPendingIds.size}</span>
                      </div>

                      <div className="space-y-3">
                          {pendingProducts.map(product => {
                              const isSelected = selectedPendingIds.has(product.id);
                              return (
                                  <div key={product.id} className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 ${isSelected ? 'bg-white border-indigo-500 shadow-md' : 'bg-gray-100 border-transparent opacity-60'}`} onClick={() => { const newSet = new Set(selectedPendingIds); if (isSelected) newSet.delete(product.id); else newSet.add(product.id); setSelectedPendingIds(newSet); }}>
                                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300 bg-white'}`}>
                                          {isSelected && <CheckCircle2 size={14}/>}
                                      </div>
                                      <div className="flex-1">
                                          <div className="font-black text-sm text-gray-800">{product.name}</div>
                                          <div className="text-[10px] font-mono text-gray-400 font-bold mt-1">CODE: {product.code}</div>
                                      </div>
                                      <div className="text-right">
                                          <div className="text-[10px] font-black bg-gray-100 px-3 py-1 rounded-full text-gray-500 border border-gray-200">
                                              {units.find(u => u.id === product.unitId)?.name || 'افتراضي'}
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>

                  <div className="p-6 bg-white border-t border-gray-100 flex gap-4">
                      <button onClick={() => handleProcessNewItems('add_only')} className="flex-1 py-4 bg-gray-100 text-gray-600 font-black text-sm rounded-2xl hover:bg-gray-200 transition-all">
                          إضافة للقاعدة فقط
                      </button>
                      <button onClick={() => handleProcessNewItems('add_and_label')} className="flex-[1.5] py-4 bg-indigo-600 text-white font-black text-sm rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center justify-center gap-3 transition-all">
                          <Tag size={18}/> إضافة وطباعة ملصقات
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Saved Lists Modal */}
      {showSavedLists && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
                  <div className="p-6 bg-gray-900 text-white flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                          <h3 className="font-black text-lg flex items-center gap-3"><FolderOpen size={20} className="text-sap-secondary"/> أرشيف السجلات</h3>
                          <button onClick={() => setShowSavedLists(false)} className="hover:bg-white/20 p-2 rounded-full"><X size={20}/></button>
                      </div>
                      {/* Archive Search Input */}
                      <div className="relative">
                          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                          <input 
                            type="text" 
                            value={savedListSearch} 
                            onChange={e => setSavedListSearch(e.target.value)} 
                            placeholder="بحث في الأرشيف (الاسم أو التاريخ)..." 
                            className="w-full bg-gray-800 text-white placeholder-gray-500 text-xs font-bold py-2.5 pr-10 pl-4 rounded-xl border border-gray-700 focus:border-sap-secondary outline-none"
                          />
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto bg-gray-50 custom-scrollbar p-4 space-y-3">
                      {isLoadingLists ? <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2"><Loader2 className="animate-spin"/><span className="text-xs font-bold">جاري التحميل...</span></div> : (
                          filteredSavedLists.length > 0 ? filteredSavedLists.map((list: any) => (
                              <div key={list.id} onClick={() => loadList(list)} className="p-5 bg-white border border-gray-100 rounded-2xl hover:border-sap-primary hover:shadow-lg cursor-pointer flex justify-between items-center group transition-all">
                                  <div>
                                      <h4 className="font-black text-sm text-gray-800 group-hover:text-sap-primary mb-1">{list.name}</h4>
                                      <div className="flex gap-4 text-[10px] font-bold text-gray-400">
                                          <span className="flex items-center gap-1"><Calendar size={12}/> {list.date}</span>
                                          <span className="flex items-center gap-1"><FileText size={12}/> {list.rows?.length || 0} صنف</span>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                      <span className={`px-3 py-1 rounded-full text-[10px] font-black ${list.type === 'inventory' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                          {list.type === 'inventory' ? 'جرد' : 'استلام'}
                                      </span>
                                      <Trash2 size={18} className="text-red-300 hover:text-red-500 transition-colors" onClick={async (e) => { e.stopPropagation(); if(confirm('هل أنت متأكد من الحذف؟')) { await db.lists.delete(list.id); fetchSavedLists(); } }} />
                                  </div>
                              </div>
                          )) : <div className="p-12 text-center text-gray-400 font-bold text-sm">لا توجد سجلات محفوظة مطابقة</div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
