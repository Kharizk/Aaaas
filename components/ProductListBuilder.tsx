
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Product, Unit, ListType, ListRow, SavedTagList, SelectedTag } from '../types';
import { db } from '../services/supabase';
import { ReportLayout } from './ReportLayout';
import { GoogleGenAI, Type } from "@google/genai";
import { parseExcelFile } from '../services/excelService';
import { 
  Printer, Plus, Trash2, Save, FolderOpen, Loader2, 
  Calendar, X, FileText, CheckCircle2, FileCheck2, ClipboardList, Truck, AlertTriangle, ScanLine, Image as ImageIcon, Sparkles, FileSpreadsheet, FileIcon,
  Tag, CheckSquare, Square, ArrowRight
} from 'lucide-react';

interface ProductListBuilderProps {
  products: Product[];
  units: Unit[];
  onNewProductsAdded?: () => void;
}

export const ProductListBuilder: React.FC<ProductListBuilderProps> = ({ products, units, onNewProductsAdded }) => {
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
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  
  // Import State
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>(''); // For loading status text
  
  // New Items Handling
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [showNewItemsModal, setShowNewItemsModal] = useState(false);
  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(new Set());
  const [tempExtractedRows, setTempExtractedRows] = useState<ListRow[]>([]); // To hold rows until new items are decided

  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  
  // Search & Navigation State
  const [activeSearch, setActiveSearch] = useState<{ rowId: string, field: 'name' | 'code' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0); 

  const totalQty = rows.reduce((acc, row) => acc + (Number(row.qty) || 0), 0);
  const validRowsCount = rows.filter(r => r.name.trim()).length;

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

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

  const handleSave = async () => {
    const validRows = rows.filter(r => r.name.trim());
    if (validRows.length === 0) { alert("لا توجد بيانات صالحة للحفظ"); return; }
    setIsSaving(true);
    try {
      const listId = activeListId || crypto.randomUUID();
      await db.lists.upsert({ 
        id: listId, 
        name: listName || (listType === 'inventory' ? 'قائمة جرد' : 'استلام طلبية'), 
        date: listDate, 
        type: listType,
        rows: validRows 
      });
      setActiveListId(listId);
      alert("تم حفظ المستند بنجاح");
    } catch (e) { alert("حدث خطأ أثناء الحفظ"); }
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
              alert("الملف فارغ أو لا يحتوي على بيانات مقروءة");
              return;
          }

          setScanStep('جاري معالجة الصفوف...');
          
          // Small delay to allow UI to render the loading state
          await new Promise(resolve => setTimeout(resolve, 500));

          const newRows: ListRow[] = rawData.map(item => {
              const findVal = (keys: string[]) => {
                  const key = Object.keys(item).find(k => keys.some(search => k.toLowerCase().includes(search.toLowerCase())));
                  return key ? item[key] : '';
              };

              const rawCode = findVal(['code', 'كود', 'رقم الصنف', 'SKU']) || '';
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
                  name: finalName ? String(finalName) : 'منتج غير معروف',
                  unitId: finalUnit,
                  qty: Number(qty) || '',
                  expiryDate: expiryDate ? new Date(expiryDate).toISOString().split('T')[0] : '', 
                  note: '',
                  isDismissed: false
              };
          });

          setRows(prev => {
              const cleanPrev = prev.filter(r => r.name.trim() !== '');
              return [...cleanPrev, ...newRows, createEmptyRow()];
          });
          alert(`تم استيراد ${newRows.length} صنف من ملف الإكسيل.`);

      } catch (error) {
          console.error("Excel Import Error", error);
          alert("حدث خطأ أثناء قراءة ملف الإكسيل.");
      } finally {
          setIsScanning(false);
          if (excelInputRef.current) excelInputRef.current.value = '';
      }
  };

  // --- AI Image/PDF Processing (Strict Schema) ---
  const handleSmartScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
        alert("يرجى رفع ملف صورة أو PDF فقط.");
        return;
    }

    setIsScanning(true);
    setScanStep('جاري قراءة الملف...');
    
    try {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            
            setScanStep('جاري التحليل واستخراج البيانات...');
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // STRICT SCHEMA DEFINITION
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
                                text: `Extract all inventory items from this document. 
                                IMPORTANT:
                                1. Extract EVERY single row. Do not skip items. Do not summarize.
                                2. Return strict JSON following the schema.
                                3. If quantity is missing, use 0.
                                4. If code is missing, return empty string.
                                ` 
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

            setScanStep('جاري معالجة البيانات...');
            
            // With schema, response.text() should be valid JSON
            let extractedData: any[] = [];
            try {
                const text = response.text || '[]';
                extractedData = JSON.parse(text);
            } catch (e) {
                console.error("JSON Parse Error", e);
                // Fallback attempt if something weird happens
                const cleanText = (response.text || '').replace(/```json|```/g, '').trim();
                try { extractedData = JSON.parse(cleanText); } catch (e2) {}
            }
            
            if (Array.isArray(extractedData) && extractedData.length > 0) {
                const foundNewProducts: Product[] = [];
                const processedRows: ListRow[] = extractedData.map((item: any) => {
                    const extractedCode = item.code ? String(item.code).trim() : '';
                    const extractedName = item.name ? String(item.name).trim() : 'غير معروف';
                    
                    // Check DB
                    const existingProduct = products.find(p => 
                        (extractedCode && p.code === extractedCode) || 
                        p.name.toLowerCase() === extractedName.toLowerCase()
                    );
                    
                    const finalName = existingProduct ? existingProduct.name : extractedName;
                    let finalUnitId = existingProduct ? existingProduct.unitId : '';
                    
                    if (!finalUnitId && item.unit) {
                            finalUnitId = units.find(u => u.name.includes(item.unit) || item.unit?.includes(u.name))?.id || '';
                    }

                    // Collect New Product if it has a code and name but not in DB
                    if (!existingProduct && extractedName && extractedName !== 'غير معروف') {
                        // Check if already in pending list to avoid dupes in same import
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

                // Store rows temporarily
                setTempExtractedRows(processedRows);

                if (foundNewProducts.length > 0) {
                    setPendingProducts(foundNewProducts);
                    // Select all by default
                    setSelectedPendingIds(new Set(foundNewProducts.map(p => p.id)));
                    setShowNewItemsModal(true);
                    setIsScanning(false); 
                    return;
                }

                // If no new products, just add rows
                setRows(prev => {
                    const cleanPrev = prev.filter(r => r.name.trim() !== '');
                    return [...cleanPrev, ...processedRows, createEmptyRow()];
                });
                alert(`تم استخراج ${processedRows.length} صنف بنجاح.`);
                
            } else {
                alert("لم يتم العثور على بيانات جدولية في الملف. تأكد من وضوح الصورة.");
            }
            setIsScanning(false);
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error("AI Scan Error", error);
        alert("حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.");
        setIsScanning(false);
    } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleProcessNewItems = async (action: 'add_only' | 'add_and_label') => {
      // 1. Filter selected items
      const selectedItems = pendingProducts.filter(p => selectedPendingIds.has(p.id));
      
      if (selectedItems.length === 0) {
          // Just proceed with rows if user selected nothing
      } else {
          // 2. Save to DB
          try {
              await Promise.all(selectedItems.map(p => db.products.upsert(p)));
              if (onNewProductsAdded) await onNewProductsAdded(); // Refresh context
          } catch (e) {
              alert("حدث خطأ أثناء حفظ المنتجات");
              return;
          }

          // 3. If Labels requested
          if (action === 'add_and_label') {
              try {
                  const tagList: SavedTagList = {
                      id: crypto.randomUUID(),
                      name: `استيراد تلقائي - ${new Date().toLocaleDateString('ar-SA')}`,
                      date: new Date().toISOString(),
                      tags: selectedItems.map(p => ({
                          id: crypto.randomUUID(),
                          productId: p.id,
                          name: p.name,
                          price: p.price || '0',
                          unitName: units.find(u => u.id === p.unitId)?.name || '',
                          originalPrice: ''
                      })),
                      styles: {
                          // Default styles
                          nameFontSize: 14, priceFontSize: 28, nameColor: '#000000',
                          priceColor: '#DC2626', unitColor: '#6B7280', currencyColor: '#000000',
                          originalPriceColor: '#EF4444', showLogo: true, logoUrl: null, logoSize: 30,
                          topMargin: 0, bottomMargin: 0, leftMargin: 0, rightMargin: 0, tagHeight: 37,
                          showBorder: true, showUnit: true, showOriginalPrice: false, template: 'classic_vertical',
                          backgroundColor: '#ffffff'
                      }
                  };
                  await db.tagLists.upsert(tagList);
                  alert("تم حفظ المنتجات وإنشاء مشروع ملصقات جديد في 'مصمم الأسعار'.");
              } catch (e) {
                  alert("تم حفظ المنتجات لكن فشل إنشاء مشروع الملصقات.");
              }
          } else {
              alert(`تم إضافة ${selectedItems.length} منتج جديد لقاعدة البيانات.`);
          }
      }

      // 4. Merge Rows to Main Table
      setRows(prev => {
          const cleanPrev = prev.filter(r => r.name.trim() !== '');
          return [...cleanPrev, ...tempExtractedRows, createEmptyRow()];
      });

      // 5. Cleanup
      setShowNewItemsModal(false);
      setPendingProducts([]);
      setTempExtractedRows([]);
  };

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return [];
    return products.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)).slice(0, 10);
  }, [searchTerm, products]);

  const selectProductForRow = (rowId: string, product: Product) => {
    setRows(prev => {
      const updated = prev.map(row => {
        if (row.id === rowId) {
          return { ...row, code: product.code, name: product.name, unitId: product.unitId };
        }
        return row;
      });
      return updated;
    });
    setActiveSearch(null);
    setSearchTerm('');
    
    setTimeout(() => {
        const qtyInput = document.getElementById(`qty-${rowId}`);
        if (qtyInput) qtyInput.focus();
    }, 50);
  };

  const getUnitName = (id: string) => units.find(u => u.id === id)?.name || '-';

  const focusNextField = (e: React.KeyboardEvent, currentRowId: string, currentField: string) => {
      e.preventDefault();
      
      if (currentField === 'expiryDate') {
          const isLastRow = rows[rows.length - 1].id === currentRowId;
          if (isLastRow) {
              const newRow = createEmptyRow();
              setRows(prev => [...prev, newRow]);
              setTimeout(() => {
                  const nextInput = document.getElementById(`code-${newRow.id}`);
                  if (nextInput) nextInput.focus();
              }, 50);
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
          if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelectedIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
              return;
          }
          if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
              return;
          }
          if (e.key === 'Enter') {
              e.preventDefault();
              const selected = filteredProducts[selectedIndex];
              if (selected) {
                  selectProductForRow(rowId, selected);
              }
              return;
          }
          if (e.key === 'Escape') {
              setActiveSearch(null);
              return;
          }
      }
      
      if (e.key === 'Enter') {
          focusNextField(e, rowId, field);
      }
  };

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
      <ReportLayout 
        title={listType === 'inventory' ? "محضر جرد مخزون رسمي" : "إشعار استلام طلبية مخزنية"} 
        subtitle={listName || "مستند مستودع معتمد"}
      >
          <div className="grid grid-cols-2 gap-4 mb-4 text-[10px] font-bold bg-gray-50 p-2 border border-sap-border print:text-[9px]">
              <div className="space-y-1">
                  <div className="flex justify-between"><span>تاريخ المستند:</span> <span>{listDate}</span></div>
                  <div className="flex justify-between"><span>نوع العملية:</span> <span className="text-sap-primary">{listType === 'inventory' ? 'جرد دوري' : 'توريد من المخزن الرئيسي'}</span></div>
              </div>
              <div className="space-y-1">
                  <div className="flex justify-between"><span>إجمالي الأصناف:</span> <span>{validRowsCount}</span></div>
                  <div className="flex justify-between"><span>إجمالي الكميات:</span> <span className="text-sap-primary">{totalQty}</span></div>
              </div>
          </div>

          <table className="w-full text-right border-collapse">
              <thead>
                  <tr className="bg-sap-shell text-white text-[9px] font-black uppercase">
                      <th className="p-1 border border-sap-border w-8 text-center" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>#</th>
                      <th className="p-1 border border-sap-border w-24" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>كود المنتج</th>
                      <th className="p-1 border border-sap-border" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>اسم المنتج</th>
                      <th className="p-1 border border-sap-border w-16 text-center" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>الكمية</th>
                      <th className="p-1 border border-sap-border w-16" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>الوحدة</th>
                      <th className="p-1 border border-sap-border w-24" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>تاريخ الصلاحية</th>
                  </tr>
              </thead>
              <tbody className="text-[9px] font-bold">
                  {rows.filter(r => r.name.trim()).map((row, idx) => {
                      const { status } = getExpiryStatus(row.expiryDate);
                      
                      let rowStyle: React.CSSProperties = { borderBottom: '1px solid #E2E8F0' };
                      let statusText = "";
                      
                      if (status === 'expired') {
                          rowStyle = { ...rowStyle, backgroundColor: '#FECACA', color: '#991B1B', WebkitPrintColorAdjust: 'exact' }; 
                          statusText = "منتهي";
                      } else if (status === 'critical') {
                          rowStyle = { ...rowStyle, backgroundColor: '#FED7AA', color: '#9A3412', WebkitPrintColorAdjust: 'exact' }; 
                          statusText = "حرج جداً";
                      } else if (status === 'warning') {
                          rowStyle = { ...rowStyle, backgroundColor: '#FEF08A', color: '#854D0E', WebkitPrintColorAdjust: 'exact' }; 
                          statusText = "قريب";
                      } else {
                          if (idx % 2 === 0) rowStyle = { ...rowStyle, backgroundColor: '#FFFFFF' };
                          else rowStyle = { ...rowStyle, backgroundColor: '#F9FAFB' }; 
                      }

                      return (
                          <tr key={row.id} style={rowStyle}>
                              <td className="p-1 text-center border-l border-sap-border/50" style={{borderLeft: '1px solid #ccc'}}>{idx + 1}</td>
                              <td className="p-1 font-mono border-l border-sap-border/50" style={{borderLeft: '1px solid #ccc'}}>{row.code}</td>
                              <td className="p-1 border-l border-sap-border/50" style={{borderLeft: '1px solid #ccc'}}>{row.name}</td>
                              <td className="p-1 text-center border-l border-sap-border/50" style={{borderLeft: '1px solid #ccc'}}>{row.qty}</td>
                              <td className="p-1 border-l border-sap-border/50" style={{borderLeft: '1px solid #ccc'}}>{getUnitName(row.unitId)}</td>
                              <td className="p-1 font-mono border-l border-sap-border/50" style={{borderLeft: '1px solid #ccc'}}>
                                  <div className="flex items-center justify-between">
                                      <span>{row.expiryDate || '-'}</span>
                                      {statusText && <span className="text-[8px] font-black border border-black/20 rounded px-1 ml-1" style={{borderColor: 'currentColor'}}>{statusText}</span>}
                                  </div>
                              </td>
                          </tr>
                      );
                  })}
              </tbody>
          </table>

          <div className="mt-4 flex gap-4 text-[8px] font-bold justify-end print:flex">
                <div className="flex items-center gap-1"><div className="w-3 h-3 border border-black/20" style={{backgroundColor: '#FECACA', WebkitPrintColorAdjust: 'exact'}}></div> <span>منتهي الصلاحية (أحمر)</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 border border-black/20" style={{backgroundColor: '#FED7AA', WebkitPrintColorAdjust: 'exact'}}></div> <span>حرج أقل من شهر (برتقالي)</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 border border-black/20" style={{backgroundColor: '#FEF08A', WebkitPrintColorAdjust: 'exact'}}></div> <span>قريب أقل من 3 شهور (أصفر)</span></div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-8 text-center text-[9px] font-black">
              <div className="border-t border-black pt-1">توقيع مأمور المستودع</div>
              <div className="border-t border-black pt-1">توقيع المستلم</div>
              <div className="border-t border-black pt-1">يعتمد / مدير الفرع</div>
          </div>
      </ReportLayout>,
      portalNode
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      
      {/* 1. Portal for Printing */}
      <PrintView />

      {/* Loading Overlay */}
      {isScanning && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 animate-in fade-in">
              <div className="w-64 bg-gray-700 rounded-full h-2 mb-6 overflow-hidden relative shadow-lg border border-white/10">
                 <div className="h-full bg-gradient-to-r from-sap-secondary via-white to-sap-secondary w-1/2 animate-[shimmer_1.5s_infinite_linear] absolute"></div> 
              </div>
              <h2 className="text-2xl font-black text-white mb-2">جاري المعالجة</h2>
              <p className="text-white/70 font-bold animate-pulse">{scanStep || 'يرجى الانتظار...'}</p>
          </div>
      )}

      {/* New Items Modal */}
      {showNewItemsModal && (
          <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in zoom-in-95">
              <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-6 bg-sap-shell text-white flex justify-between items-center">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-white/10 rounded-full"><Sparkles size={24} className="text-yellow-400"/></div>
                          <div>
                              <h3 className="font-black text-xl">تم اكتشاف أصناف جديدة!</h3>
                              <p className="text-xs text-gray-300">عثر الذكاء الاصطناعي على ({pendingProducts.length}) صنف غير مسجل</p>
                          </div>
                      </div>
                      <button onClick={() => setShowNewItemsModal(false)}><X size={24}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto bg-gray-50 p-6 custom-scrollbar">
                      <div className="flex justify-between items-center mb-4">
                          <button 
                            onClick={() => {
                                if (selectedPendingIds.size === pendingProducts.length) setSelectedPendingIds(new Set());
                                else setSelectedPendingIds(new Set(pendingProducts.map(p => p.id)));
                            }} 
                            className="text-xs font-bold text-sap-primary hover:underline flex items-center gap-2"
                          >
                              {selectedPendingIds.size === pendingProducts.length ? <CheckSquare size={16}/> : <Square size={16}/>} 
                              تحديد الكل / إلغاء
                          </button>
                          <span className="text-xs font-bold text-gray-500">تم تحديد: {selectedPendingIds.size}</span>
                      </div>

                      <div className="space-y-3">
                          {pendingProducts.map(product => {
                              const isSelected = selectedPendingIds.has(product.id);
                              return (
                                  <div 
                                    key={product.id} 
                                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 ${isSelected ? 'bg-white border-sap-primary shadow-sm' : 'bg-gray-100 border-transparent opacity-60'}`}
                                    onClick={() => {
                                        const newSet = new Set(selectedPendingIds);
                                        if (isSelected) newSet.delete(product.id);
                                        else newSet.add(product.id);
                                        setSelectedPendingIds(newSet);
                                    }}
                                  >
                                      <div className={`w-6 h-6 rounded border flex items-center justify-center ${isSelected ? 'bg-sap-primary border-sap-primary text-white' : 'bg-white border-gray-300'}`}>
                                          {isSelected && <CheckCircle2 size={16}/>}
                                      </div>
                                      <div className="flex-1">
                                          <div className="font-black text-sm text-gray-800">{product.name}</div>
                                          <div className="text-[10px] font-mono text-gray-500 mt-1">CODE: {product.code}</div>
                                      </div>
                                      <div className="text-right">
                                          <div className="text-xs font-bold bg-gray-50 px-2 py-1 rounded border">
                                              {units.find(u => u.id === product.unitId)?.name || 'وحدة افتراضية'}
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>

                  <div className="p-6 bg-white border-t border-gray-100 flex flex-col sm:flex-row gap-3">
                      <button onClick={() => handleProcessNewItems('add_only')} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all">
                          إضافة لقاعدة البيانات فقط
                      </button>
                      <button onClick={() => handleProcessNewItems('add_and_label')} className="flex-[2] py-3 bg-sap-primary text-white rounded-xl font-black text-xs hover:bg-sap-primary-hover shadow-lg flex items-center justify-center gap-2">
                          <Tag size={16}/> إضافة وإنشاء ملصقات أسعار
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Main UI Header */}
      <div className="bg-white p-4 border border-sap-border rounded-sap-m shadow-sm print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex-1 space-y-4 w-full">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded ${listType === 'inventory' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        {listType === 'inventory' ? <ClipboardList size={24}/> : <Truck size={24}/>}
                    </div>
                    <div className="flex-1">
                        <label className="text-[9px] font-bold text-gray-400 block mb-1">اسم القائمة (يظهر في الطباعة)</label>
                        <input 
                          type="text" value={listName} onChange={e => setListName(e.target.value)}
                          placeholder={listType === 'inventory' ? "مثال: جرد شهر اكتوبر..." : "رقم أو اسم الطلبية..."}
                          className="w-full !text-lg !font-black !bg-gray-50 !border-b-2 !border-gray-200 focus:!border-sap-primary focus:bg-white transition-all p-2 rounded-t-lg"
                        />
                    </div>
                </div>
                <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 border border-sap-border rounded">
                        <span className="text-[10px] font-black text-gray-400">نوع المستند:</span>
                        <select value={listType} onChange={e => setListType(e.target.value as ListType)} className="!border-none !bg-transparent !p-0 !text-xs !font-black focus:!ring-0 cursor-pointer">
                            <option value="inventory">جرد مخزون</option>
                            <option value="receipt">استلام طلبية</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 border border-sap-border rounded">
                        <Calendar size={14} className="text-sap-primary" />
                        <input type="date" value={listDate} onChange={e => setListDate(e.target.value)} className="!bg-transparent !border-none !p-0 !text-xs !font-black focus:!ring-0" />
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-2 w-full md:w-auto">
                <div className="flex gap-2">
                    <input type="file" ref={excelInputRef} onChange={handleExcelImport} accept=".xlsx, .xls" className="hidden" />
                    <button 
                        onClick={() => excelInputRef.current?.click()} 
                        className="flex-1 px-4 py-2 bg-green-600 text-white text-xs font-black hover:bg-green-700 flex items-center justify-center gap-2 shadow-sm rounded transition-all"
                    >
                        <FileSpreadsheet size={16} /> استيراد Excel
                    </button>

                    <input type="file" ref={fileInputRef} onChange={handleSmartScan} accept="image/*, application/pdf" className="hidden" />
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={isScanning}
                        className="flex-1 px-4 py-2 bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-sm rounded transition-all"
                    >
                        {isScanning ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />} 
                        {isScanning ? 'جاري...' : 'مسح ذكي (صورة/PDF)'}
                    </button>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setActiveListId(null); setRows([createEmptyRow()]); setListName(''); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-50 rounded">جديد</button>
                    <button onClick={() => { fetchSavedLists(); setShowSavedLists(true); }} className="flex-1 px-4 py-2 border border-sap-secondary text-sap-secondary text-xs font-bold hover:bg-sap-secondary/5 flex items-center justify-center gap-2 rounded"><FolderOpen size={14}/> المحفوظات</button>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => window.print()} className="flex-1 px-6 py-2 bg-sap-shell text-white text-xs font-black flex items-center justify-center gap-2 hover:bg-black rounded"><FileCheck2 size={16}/> طباعة رسمية</button>
                    <button onClick={handleSave} disabled={isSaving} className="flex-1 px-8 py-2 bg-sap-primary text-white text-xs font-black flex items-center justify-center gap-2 hover:bg-sap-primary-hover shadow-md rounded">
                        {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} حفظ
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* Editable Table */}
      <div className="bg-white border border-sap-border rounded-sap-m overflow-hidden shadow-sm print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-sap-shell text-white font-black uppercase text-[10px]">
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3 w-40">كود المنتج</th>
                <th className="p-3">اسم المنتج والوصف</th>
                <th className="p-3 w-28 text-center">الكمية</th>
                <th className="p-3 w-32">الوحدة</th>
                <th className="p-3 w-40">تاريخ الانتهاء</th>
                <th className="p-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sap-border">
              {rows.map((row, idx) => (
                <tr key={row.id} className="hover:bg-sap-highlight/20 group transition-all">
                  <td className="p-3 text-center text-gray-400 font-mono">{idx + 1}</td>
                  
                  {/* Code Column */}
                  <td className="p-3 relative">
                    <input 
                      id={`code-${row.id}`}
                      type="text" 
                      value={row.code} 
                      onKeyDown={(e) => handleSearchKeyDown(e, row.id, 'code')}
                      onChange={e => {
                        const val = e.target.value;
                        setRows(prev => prev.map(r => r.id === row.id ? { ...r, code: val } : r));
                        setActiveSearch({ rowId: row.id, field: 'code' });
                        setSearchTerm(val);
                      }}
                      className="w-full !p-1 !border-none !bg-transparent font-mono font-bold focus:!ring-0"
                      placeholder="P-000"
                      autoComplete="off"
                    />
                    {activeSearch?.rowId === row.id && activeSearch.field === 'code' && filteredProducts.length > 0 && (
                      <div className="absolute top-full right-0 z-50 bg-white border border-sap-border shadow-xl w-64 rounded-sap-s mt-1 overflow-hidden">
                          {filteredProducts.map((p, i) => (
                              <div 
                                key={p.id} 
                                onClick={() => selectProductForRow(row.id, p)} 
                                className={`p-2 cursor-pointer border-b last:border-0 flex justify-between ${i === selectedIndex ? 'bg-sap-primary text-white' : 'hover:bg-sap-highlight text-gray-800'}`}
                              >
                                  <span className="font-bold">{p.code}</span>
                                  <span className={`text-[10px] ${i === selectedIndex ? 'text-white/80' : 'text-gray-500'}`}>{p.name}</span>
                              </div>
                          ))}
                      </div>
                    )}
                  </td>

                  {/* Name Column */}
                  <td className="p-3 relative">
                    <input 
                      id={`name-${row.id}`}
                      type="text" 
                      value={row.name} 
                      onKeyDown={(e) => handleSearchKeyDown(e, row.id, 'name')}
                      onChange={e => {
                        const val = e.target.value;
                        setRows(prev => prev.map(r => r.id === row.id ? { ...r, name: val } : r));
                        setActiveSearch({ rowId: row.id, field: 'name' });
                        setSearchTerm(val);
                      }}
                      className="w-full !p-1 !border-none !bg-transparent font-black focus:!ring-0"
                      placeholder="ابحث عن المنتج..."
                      autoComplete="off"
                    />
                    {activeSearch?.rowId === row.id && activeSearch.field === 'name' && filteredProducts.length > 0 && (
                      <div className="absolute top-full right-0 z-50 bg-white border border-sap-border shadow-xl w-full rounded-sap-s mt-1 overflow-hidden">
                          {filteredProducts.map((p, i) => (
                              <div 
                                key={p.id} 
                                onClick={() => selectProductForRow(row.id, p)} 
                                className={`p-3 cursor-pointer border-b last:border-0 flex justify-between items-center ${i === selectedIndex ? 'bg-sap-primary text-white' : 'hover:bg-sap-highlight text-gray-800'}`}
                              >
                                  <span className="font-black">{p.name}</span>
                                  <span className={`text-[10px] font-mono ${i === selectedIndex ? 'text-white/80' : 'text-gray-400'}`}>{p.code}</span>
                              </div>
                          ))}
                      </div>
                    )}
                  </td>

                  {/* Quantity Column */}
                  <td className="p-3">
                    <input 
                      id={`qty-${row.id}`}
                      type="number" 
                      value={row.qty} 
                      onKeyDown={(e) => { if(e.key === 'Enter') focusNextField(e, row.id, 'qty') }}
                      onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, qty: e.target.value === '' ? '' : Number(e.target.value) } : r))}
                      className="w-full !p-1 !border-none !bg-transparent text-center font-black text-sap-primary focus:!ring-0"
                      placeholder="0"
                    />
                  </td>

                  {/* Unit Column */}
                  <td className="p-3">
                    <select 
                        id={`unit-${row.id}`}
                        value={row.unitId} 
                        onKeyDown={(e) => { if(e.key === 'Enter') focusNextField(e, row.id, 'unit') }}
                        onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, unitId: e.target.value } : r))} 
                        className="w-full !p-1 !border-none !bg-transparent font-bold focus:!ring-0 cursor-pointer appearance-none"
                    >
                      <option value="">-</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </td>

                  {/* Expiry Column */}
                  <td className="p-3 relative">
                    <input 
                        id={`expiry-${row.id}`}
                        type="date" 
                        value={row.expiryDate} 
                        onKeyDown={(e) => { if(e.key === 'Enter') focusNextField(e, row.id, 'expiryDate') }}
                        onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, expiryDate: e.target.value } : r))} 
                        className="w-full !p-1 !border-none !bg-transparent font-bold focus:!ring-0" 
                    />
                    {getExpiryStatus(row.expiryDate).status !== 'normal' && (
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-red-500" title="تاريخ قريب الانتهاء">
                            <AlertTriangle size={14} />
                        </div>
                    )}
                  </td>

                  {/* Delete Action */}
                  <td className="p-3 text-center">
                    <button onClick={() => setRows(prev => prev.filter(r => r.id !== row.id))} className="text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={7} className="p-0">
                  <button onClick={() => setRows(prev => [...prev, createEmptyRow()])} className="w-full py-4 bg-gray-50 text-sap-primary font-black flex items-center justify-center gap-2 hover:bg-sap-highlight transition-all border-t border-sap-border">
                    <Plus size={16} /> إضافة سطر جديد للمستند
                  </button>
                </td>
              </tr>
            </tbody>
            <tfoot className="bg-sap-background font-black border-t-2 border-sap-shell">
              <tr>
                <td colSpan={3} className="px-8 py-4 text-left text-sap-text-variant uppercase tracking-widest">إجمالي الكميات في المستند</td>
                <td className="px-4 py-4 text-center text-lg text-sap-primary font-mono">{totalQty}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Saved Lists Browser Modal */}
      {showSavedLists && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-2xl rounded-sap-m shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                  <div className="p-4 bg-sap-shell text-white flex justify-between items-center">
                      <h3 className="font-black text-sm flex items-center gap-2"><FolderOpen size={18}/> فتح مستند محفوظ</h3>
                      <button onClick={() => setShowSavedLists(false)}><X size={20}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto bg-gray-50 custom-scrollbar">
                      {isLoadingLists ? <div className="p-20 text-center animate-pulse font-black text-sap-primary">جاري جلب المستندات...</div> : (
                          <div className="divide-y divide-sap-border">
                              {savedLists.map((list) => (
                                  <div key={list.id} onClick={() => loadList(list)} className="p-4 hover:bg-sap-highlight cursor-pointer transition-all flex justify-between items-center group">
                                      <div className="flex items-center gap-4">
                                          <div className={`p-2 rounded ${list.type === 'inventory' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                              {list.type === 'inventory' ? <ClipboardList size={20}/> : <Truck size={20}/>}
                                          </div>
                                          <div>
                                              <h4 className="font-black text-sap-text">{list.name}</h4>
                                              <div className="flex gap-4 text-[10px] font-bold text-gray-500 mt-1">
                                                  <span>{list.date}</span>
                                                  <span>{list.rows?.length || 0} صنف</span>
                                                  <span className="uppercase text-sap-primary">{list.type === 'inventory' ? 'جرد' : 'طلبية'}</span>
                                              </div>
                                          </div>
                                      </div>
                                      <Trash2 size={16} className="text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100" onClick={async (e) => { e.stopPropagation(); if(confirm('حذف؟')) { await db.lists.delete(list.id); fetchSavedLists(); } }} />
                                  </div>
                              ))}
                              {savedLists.length === 0 && <div className="p-20 text-center text-gray-400 italic font-bold">لا توجد سجلات محفوظة حالياً</div>}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
