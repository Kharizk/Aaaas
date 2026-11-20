
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Product, Unit, ListType, ListRow, SavedTagList, SelectedTag } from '../types';
import { db } from '../services/supabase';
import { ReportLayout } from './ReportLayout';
import { useNotification } from './Notifications';
import { parseExcelFile, generateInventoryTemplate } from '../services/excelService';
import { 
  Printer, Plus, Trash2, Save, FolderOpen, Loader2, SlidersHorizontal,
  Calendar, X, FileText, CheckCircle2, FileCheck2, ClipboardList, Truck, AlertTriangle, ScanLine, Image as ImageIcon, Sparkles, FileSpreadsheet, FileIcon,
  Tag, CheckSquare, Square, ArrowRight, Download, UploadCloud, Search, Barcode, ChevronDown, Eraser, FileInput, MoreHorizontal, Target, Keyboard
} from 'lucide-react';

interface ProductListBuilderProps {
  products: Product[];
  setProducts?: React.Dispatch<React.SetStateAction<Product[]>>;
  units: Unit[];
  onNewProductsAdded?: () => void;
  initialListParams?: { listId: string, rowId?: string } | null;
  clearInitialParams?: () => void;
}

export const ProductListBuilder: React.FC<ProductListBuilderProps> = ({ products, setProducts, units, onNewProductsAdded, initialListParams, clearInitialParams }) => {
  const { notify } = useNotification();
  const generateId = () => crypto.randomUUID();
  const createEmptyRow = (): ListRow => ({
    id: generateId(), code: '', name: '', unitId: '', qty: '', cartonQty: '', expiryDate: '', note: '', isDismissed: false
  });

  const [rows, setRows] = useState<ListRow[]>([createEmptyRow()]);
  const [listName, setListName] = useState('');
  const [listDate, setListDate] = useState(new Date().toISOString().split('T')[0]);
  const [listType, setListType] = useState<ListType>('inventory');
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [printWithHeader, setPrintWithHeader] = useState(true);
  const [printWithFooter, setPrintWithFooter] = useState(true);
  const [printFontSize, setPrintFontSize] = useState(12);
  const [visibleColumns, setVisibleColumns] = useState({
    code: true, name: true, cartonQty: true, qty: true, unit: true, expiry: true, note: true
  });
  const [customColumns, setCustomColumns] = useState<{id: string, name: string}[]>([]);
  const [showCartonQty, setShowCartonQty] = useState(false); // Kept for backward compatibility but visibleColumns.cartonQty is better
  const [showSavedLists, setShowSavedLists] = useState(false);
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [savedLists, setSavedLists] = useState<any[]>([]);
  const [savedListSearch, setSavedListSearch] = useState(''); 
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  
  // Local Scan State
  const [localScanQuery, setLocalScanQuery] = useState('');

  // Import State
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>(''); 
  const [showQuotaFallback, setShowQuotaFallback] = useState(false);
  const [quotaErrorMsg, setQuotaErrorMsg] = useState('');
  
  // New Items Handling
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [showNewItemsModal, setShowNewItemsModal] = useState(false);
  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(new Set());
  const [tempExtractedRows, setTempExtractedRows] = useState<ListRow[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  
  // Search & Navigation State
  const [activeSearch, setActiveSearch] = useState<{ rowId: string, field: 'name' | 'code' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0); 
  
  // Highlighting State
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, message: string, onConfirm: () => void} | null>(null);
  const [customColumnInput, setCustomColumnInput] = useState('');
  const [quickAddProductModal, setQuickAddProductModal] = useState<{
    open: boolean;
    targetRowId?: string;
    code: string;
    name: string;
    unitId: string;
    price: string;
    costPrice: string;
    qty: string;
    cartonQty: string;
    expiryDate: string;
  }>({
    open: false,
    code: '',
    name: '',
    unitId: '',
    price: '0',
    costPrice: '',
    qty: '',
    cartonQty: '',
    expiryDate: ''
  });
  const [isSavingNewProduct, setIsSavingNewProduct] = useState(false);

  const totalQty = rows.reduce((acc, row) => acc + (Number(row.qty) || 0), 0);
  const totalCartonQty = rows.reduce((acc, row) => acc + (Number(row.cartonQty) || 0), 0);
  const validRowsCount = rows.filter(r => r.name.trim()).length;

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  // Global Shortcut for Quick Scan (F9)
  useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'F9') {
              e.preventDefault();
              scanInputRef.current?.focus();
              scanInputRef.current?.select();
          }
      };
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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
                          highlightAndScrollToRow(initialListParams.rowId);
                      }
                  } else {
                      notify("القائمة المطلوبة غير موجودة", "warning");
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

  const highlightAndScrollToRow = (rowId: string) => {
      setHighlightedRowId(rowId);
      setTimeout(() => {
          const el = document.getElementById(`row-${rowId}`);
          const qtyInput = document.getElementById(`qty-${rowId}`);
          if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              if (qtyInput) {
                  qtyInput.focus();
                  (qtyInput as HTMLInputElement).select();
              }
              setTimeout(() => setHighlightedRowId(null), 3000);
          }
      }, 100);
  };

  const handleLocalScan = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          const query = localScanQuery.trim().toLowerCase();
          if (!query) return;

          // أولوية قصوى: مطابقة الكود على نفس الرقم تماماً
          const exactCodeRow = rows.find(r =>
              r.code && r.code.trim().toLowerCase() === query
          );
          const isNumericCode = /^\d+$/.test(query);
          const foundRow = exactCodeRow || (!isNumericCode
              ? rows.find(r => r.name && r.name.toLowerCase().includes(query))
              : undefined);

          if (foundRow) {
              highlightAndScrollToRow(foundRow.id);
              setLocalScanQuery(''); // Clear input for next scan
          } else {
              notify('الصنف غير موجود في القائمة الحالية. يمكنك إضافته يدوياً أو كمنتج جديد.', 'warning');
          }
      }
  };

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

  // --- Deep Search Logic ---
  const filteredSavedLists = useMemo(() => {
      const term = savedListSearch.trim().toLowerCase();
      if (!term) return savedLists;

      return savedLists.map(list => {
          // Check if list name or date matches
          const metaMatch = list.name.toLowerCase().includes(term) || list.date.includes(term);
          
          // Check if any product inside matches (exact code match or partial name match)
          const matchingItems = (list.rows || []).filter((r: any) => 
              (r.name && r.name.toLowerCase().includes(term)) || 
              (r.code && r.code.trim().toLowerCase() === term)
          );

          // Return list only if meta matches or items match
          if (metaMatch || matchingItems.length > 0) {
              return { ...list, matchingItems };
          }
          return null;
      }).filter(Boolean); // Remove nulls
  }, [savedLists, savedListSearch]);

  const handleSave = async () => {
    const validRows = rows.filter(r => r.name.trim());
    if (validRows.length === 0) { notify("لا توجد بيانات صالحة للحفظ", "warning"); return; }
    setIsSaving(true);
    try {
      // اكتشاف وإضافة أي منتجات جديدة مسجلة في الجرد تلقائياً إلى قاعدة البيانات
      const knownProducts = [...products];
      const newProductsToInsert: Product[] = [];
      const preparedRows = validRows.map((row, idx) => {
        const cleanCode = (row.code || '').trim();
        const cleanName = row.name.trim();
        const existing = knownProducts.find(p =>
          (cleanCode && p.code && p.code.trim().toLowerCase() === cleanCode.toLowerCase()) ||
          p.name.trim().toLowerCase() === cleanName.toLowerCase()
        );
        if (!existing) {
          const finalCode = cleanCode || `INV-${Date.now().toString().slice(-6)}-${idx + 1}`;
          const newProd: Product = {
            id: crypto.randomUUID(),
            code: finalCode,
            name: cleanName,
            unitId: row.unitId || units[0]?.id || '',
            price: '0',
            stock: row.qty !== '' && !isNaN(Number(row.qty)) ? Number(row.qty) : 0,
            expiryDate: row.expiryDate || undefined,
            color: '#ffffff',
          };
          knownProducts.push(newProd);
          newProductsToInsert.push(newProd);
          return { ...row, code: finalCode, unitId: row.unitId || newProd.unitId };
        }
        return row;
      });

      if (newProductsToInsert.length > 0) {
        await Promise.all(newProductsToInsert.map(p => db.products.upsert(p)));
        setProducts?.(prev => [...prev, ...newProductsToInsert]);
        setRows(prev => {
          const updatedMap = new Map(preparedRows.map(r => [r.id, r]));
          return prev.map(r => updatedMap.get(r.id) || r);
        });
        if (onNewProductsAdded) onNewProductsAdded();
      }

      const listId = activeListId || crypto.randomUUID();
      await db.lists.upsert({ 
        id: listId, 
        name: listName || (listType === 'inventory' ? 'قائمة جرد' : 'سند استلام'), 
        date: listDate, 
        type: listType,
        rows: preparedRows 
      });
      setActiveListId(listId);
      if (newProductsToInsert.length > 0) {
        notify(`تم حفظ السند بنجاح وإضافة ${newProductsToInsert.length} منتج جديد تلقائياً إلى قاعدة البيانات`, 'success');
      } else {
        notify("تم حفظ المستند بنجاح", "success");
      }
    } catch (e) { notify("فشل الحفظ", "error"); }
    finally { setIsSaving(false); }
  };

  // ... (Keep existing Excel and AI functions as is) ...
  // --- Excel Import ---
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsScanning(true);
      setScanStep('جاري قراءة ملف Excel...');

      try {
          const rawData = await parseExcelFile(file);
          if (rawData.length === 0) {
              notify("الملف فارغ أو التنسيق غير صحيح", "warning");
              return;
          }

          setScanStep('معالجة الصفوف...');
          
          await new Promise(resolve => setTimeout(resolve, 500));

          const newRows: ListRow[] = rawData.map(item => {
              const findVal = (keys: string[], excludeKeys: string[] = []) => {
                  const key = Object.keys(item).find(k => {
                      const lowerK = k.toLowerCase();
                      const matches = keys.some(search => lowerK.includes(search.toLowerCase()));
                      const excluded = excludeKeys.some(ex => lowerK.includes(ex.toLowerCase()));
                      return matches && !excluded;
                  });
                  return key ? item[key] : '';
              };

              const rawCode = findVal(['code', 'كود', 'رقم', 'sku']) || '';
              const code = rawCode ? String(rawCode).trim() : '';
              
              const name = findVal(['name', 'اسم', 'صنف', 'item', 'product']) || '';
              const cartonQty = findVal(['carton qty', 'carton quantity', 'كمية الكرتون', 'كرتون']) || '';
              const qty = findVal(['qty', 'quantity', 'كمية', 'عدد', 'رصيد'], ['كرتون', 'carton']) || '';
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
                  cartonQty: Number(cartonQty) || '',
                  expiryDate: expiryDate ? String(expiryDate).split('T')[0] : '', 
                  note: '',
                  isDismissed: false
              };
          });

          setRows(prev => {
              const cleanPrev = prev.filter(r => r.name.trim() !== '');
              return [...cleanPrev, ...newRows, createEmptyRow()];
          });
          notify(`تم استيراد ${newRows.length} صنف بنجاح.`, "success");

      } catch (error) {
          console.error("Excel Import Error", error);
          notify("خطأ في قراءة ملف Excel", "error");
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
            try {
                const result = reader.result as string;
                const base64Data = result.split(',')[1];
                
                setScanStep('تحليل المستند بالذكاء الاصطناعي...');
                
                const response = await fetch('/api/upload-inventory-scan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64Data, mimeType: file.type })
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || 'Failed to process image');
                }

                const data = await response.json();
                const text = data.text;

                setScanStep('معالجة البيانات...');
                
                let extractedData: any[] = [];
                let parseError = null;
                try {
                    const textOutput = text || '[]';
                    // Try JSON.parse on the cleaned format
                    const parsed = JSON.parse(textOutput.replace(/```json|```/g, '').trim());
                    if (Array.isArray(parsed)) {
                        extractedData = parsed;
                    } else if (parsed && Array.isArray(parsed.items)) {
                        extractedData = parsed.items;
                    } else if (parsed && typeof parsed === 'object') {
                        // Fallback if wrapped under another key
                        const possibleArray = Object.values(parsed).find(val => Array.isArray(val));
                        if (possibleArray) {
                            extractedData = possibleArray as any[];
                        }
                    }
                } catch (e: any) {
                    console.warn("Failed to parse JSON response directly, attempting repair:", e);
                    try {
                        const repairedStr = tryRepairTruncatedJSON(text || '[]');
                        const parsed = JSON.parse(repairedStr);
                        if (Array.isArray(parsed)) {
                            extractedData = parsed;
                        } else if (parsed && Array.isArray(parsed.items)) {
                            extractedData = parsed.items;
                        } else if (parsed && typeof parsed === 'object') {
                            const possibleArray = Object.values(parsed).find(val => Array.isArray(val));
                            if (possibleArray) {
                                extractedData = possibleArray as any[];
                            }
                        }
                        if (extractedData.length > 0) {
                            parseError = "تم استرجاع البيانات بنجاح بعد إصلاح الجزء المقطوع تلقائياً من استجابة الذكاء الاصطناعي.";
                        }
                    } catch (repairErr: any) {
                        console.error("Repair also failed:", repairErr);
                        parseError = "مخرجات الذكاء الاصطناعي كانت طويلة جداً وتم قطعها ولم يتمكن النظام من إصلاحها تلقائياً. يرجى استخدام صورة أو ملف يحتوي على قائمة أصغر.";
                    }
                }
                
                if (Array.isArray(extractedData) && extractedData.length > 0) {
                    if (parseError) {
                        notify(parseError, "warning");
                    }
                    const foundNewProducts: Product[] = [];
                    const processedRows: ListRow[] = extractedData.map((item: any) => {
                        const extractedCode = item.code ? String(item.code).trim() : '';
                        const rawNameText = item.name || item.category || '';
                        const extractedName = rawNameText ? String(rawNameText).trim() : 'UNKNOWN';
                        
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
                                    category: item.category ? String(item.category).trim() : undefined,
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
                            category: existingProduct ? existingProduct.category : (item.category ? String(item.category).trim() : undefined),
                            unitId: finalUnitId,
                            qty: (item.qty !== undefined && item.qty !== null && item.qty !== '' && !isNaN(Number(item.qty))) ? Number(item.qty) : '',
                            cartonQty: (item.cartonQty !== undefined && item.cartonQty !== null && item.cartonQty !== '' && !isNaN(Number(item.cartonQty))) ? Number(item.cartonQty) : '',
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
                    notify(`تم استخراج ${processedRows.length} صنف.`, "success");
                    
                } else {
                    notify(parseError || "لم يتم العثور على بيانات في الصورة.", "warning");
                }
            } catch (err: any) {
                console.error("Smart Scan Error in onloadend:", err);
                setQuotaErrorMsg(err.message || "خطأ في خدمة الذكاء الاصطناعي");
                setShowQuotaFallback(true);
            } finally {
                setIsScanning(false);
            }
        };
        reader.readAsDataURL(file);
    } catch (error: any) {
        setQuotaErrorMsg(error.message || "خطأ في خدمة الذكاء الاصطناعي");
        setShowQuotaFallback(true);
        setIsScanning(false);
    } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleMockScanProcess = () => {
    const mockData = [
      {
        code: "6281015000452",
        category: "المعلبات",
        name: "تونا حدائق كاليفورنيا قطعة واحدة 185 جرام",
        cartonQty: 2,
        qty: 24,
        unit: "حبة",
        price: 6.5
      },
      {
        code: "6281001002316",
        category: "زيوت وسمن",
        name: "زيت نباتي العربي 1.5 لتر",
        cartonQty: 4,
        qty: 0,
        unit: "حبة",
        price: 14.95
      },
      {
        code: "6281030000123",
        category: "مشروبات",
        name: "مياه صفا كرتون 40 حبة * 330 مل",
        cartonQty: 10,
        qty: 5,
        unit: "كرتون",
        price: 12.0
      },
      {
        code: "6281055001221",
        category: "الأرز والسكر",
        name: "أرز بسمتي الشعلان 10 كجم",
        cartonQty: 0,
        qty: 15,
        unit: "كيس",
        price: 74.5
      },
      {
        code: "6281022003310",
        category: "منتجات ألبان",
        name: "حليب المراعي طويل الأجل 1 لتر",
        cartonQty: 5,
        qty: 12,
        unit: "حبة",
        price: 5.0
      }
    ];

    const foundNewProducts: Product[] = [];
    const processedRows: ListRow[] = mockData.map((item: any) => {
        const extractedCode = item.code ? String(item.code).trim() : '';
        const rawNameText = item.name || item.category || '';
        const extractedName = rawNameText ? String(rawNameText).trim() : 'UNKNOWN';
        
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
                    category: item.category ? String(item.category).trim() : undefined,
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
            category: existingProduct ? existingProduct.category : (item.category ? String(item.category).trim() : undefined),
            unitId: finalUnitId,
            qty: item.qty,
            cartonQty: item.cartonQty,
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
        return;
    }

    setRows(prev => {
        const cleanPrev = prev.filter(r => r.name.trim() !== '');
        return [...cleanPrev, ...processedRows, createEmptyRow()];
    });
    notify(`تمت محاكاة استخراج ${processedRows.length} أصناف تجريبية بنجاح!`, "info");
  };

  const handleProcessNewItems = async (action: 'add_only' | 'add_and_label') => {
      const selectedItems = pendingProducts.filter(p => selectedPendingIds.has(p.id));
      if (selectedItems.length > 0) {
          try {
              await Promise.all(selectedItems.map(p => db.products.upsert(p)));
              if (onNewProductsAdded) await onNewProductsAdded();
          } catch (e) { notify("خطأ في قاعدة البيانات", "error"); return; }

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
                          nameFontSize: 14, priceFontSize: 28, nameColor: '#000000', priceColor: '#DC2626', unitColor: '#6B7280', currencyColor: '#000000', originalPriceColor: '#EF4444', showLogo: true, logoUrl: null, logoSize: 30, topMargin: 0, bottomMargin: 0, leftMargin: 0, rightMargin: 0, tagHeight: 37, showBorder: true, showUnit: true, showOriginalPrice: false, template: 'classic_vertical', backgroundColor: '#ffffff',
                          currencySymbolType: 'icon', currencySymbolImage: null, currencySymbolSize: 14, currencySymbolPosition: 'after', currencySymbolMargin: 4, unitFontSize: 10
                      }
                  };
                  await db.tagLists.upsert(tagList);
                  notify("تمت إضافة المنتجات وإنشاء قائمة ملصقات", "success");
              } catch (e) { notify("فشل إنشاء الملصقات", "error"); }
          } else {
              notify(`تمت إضافة ${selectedItems.length} منتج جديد`, "success");
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
          else if (currentField === 'name') nextId = visibleColumns.cartonQty ? `cartonQty-${currentRowId}` : (visibleColumns.qty ? `qty-${currentRowId}` : `unit-${currentRowId}`);
          else if (currentField === 'cartonQty') nextId = visibleColumns.qty ? `qty-${currentRowId}` : `unit-${currentRowId}`;
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
      if (e.key === 'Escape') { setActiveSearch(null); return; }
      if (e.key === 'Enter') focusNextField(e, rowId, field);
  };

  const openQuickAddModal = (rowId?: string, prefillCode = '', prefillName = '') => {
    const row = rowId ? rows.find(r => r.id === rowId) : undefined;
    setActiveSearch(null);
    setQuickAddProductModal({
      open: true,
      targetRowId: rowId,
      code: (prefillCode || row?.code || '').trim(),
      name: (prefillName || row?.name || '').trim(),
      unitId: row?.unitId || units[0]?.id || '',
      price: '0',
      costPrice: '',
      qty: row?.qty !== undefined && row?.qty !== '' ? String(row.qty) : '',
      cartonQty: row?.cartonQty !== undefined && row?.cartonQty !== '' ? String(row.cartonQty) : '',
      expiryDate: row?.expiryDate || '',
    });
  };

  const handleSaveQuickProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = quickAddProductModal.code.trim();
    const cleanName = quickAddProductModal.name.trim();
    if (!cleanCode || !cleanName) {
      notify('يرجى إدخال كود المنتج واسم المنتج', 'warning');
      return;
    }

    const duplicate = products.find(p =>
      (p.code && p.code.trim().toLowerCase() === cleanCode.toLowerCase()) ||
      p.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      notify(`المنتج "${duplicate.name}" (${duplicate.code}) مسجل بالفعل في قاعدة البيانات`, 'warning');
      if (quickAddProductModal.targetRowId) {
        selectProductForRow(quickAddProductModal.targetRowId, duplicate);
      }
      setQuickAddProductModal(prev => ({ ...prev, open: false }));
      return;
    }

    setIsSavingNewProduct(true);
    try {
      const newProd: Product = {
        id: crypto.randomUUID(),
        code: cleanCode,
        name: cleanName,
        unitId: quickAddProductModal.unitId || units[0]?.id || '',
        price: quickAddProductModal.price.trim() || '0',
        costPrice: quickAddProductModal.costPrice.trim() || undefined,
        stock: quickAddProductModal.qty !== '' ? Number(quickAddProductModal.qty) || 0 : 0,
        expiryDate: quickAddProductModal.expiryDate || undefined,
        color: '#ffffff',
      };
      await db.products.upsert(newProd);
      setProducts?.(prev => [...prev, newProd]);
      if (onNewProductsAdded) onNewProductsAdded();

      const qtyVal = quickAddProductModal.qty !== '' ? Number(quickAddProductModal.qty) : '';
      const cartonVal = quickAddProductModal.cartonQty !== '' ? Number(quickAddProductModal.cartonQty) : '';

      if (quickAddProductModal.targetRowId) {
        setRows(prev =>
          prev.map(r =>
            r.id === quickAddProductModal.targetRowId
              ? {
                  ...r,
                  code: newProd.code,
                  name: newProd.name,
                  unitId: newProd.unitId,
                  qty: qtyVal !== '' ? qtyVal : r.qty,
                  cartonQty: cartonVal !== '' ? cartonVal : r.cartonQty,
                  expiryDate: quickAddProductModal.expiryDate || r.expiryDate,
                }
              : r
          )
        );
      } else {
        const newRow: ListRow = {
          id: generateId(),
          code: newProd.code,
          name: newProd.name,
          unitId: newProd.unitId,
          qty: qtyVal,
          cartonQty: cartonVal,
          expiryDate: quickAddProductModal.expiryDate || '',
          note: '',
          isDismissed: false,
        };
        setRows(prev => {
          const hasEmptyLast = prev.length > 0 && !prev[prev.length - 1].name.trim() && !prev[prev.length - 1].code.trim();
          if (hasEmptyLast) {
            return [...prev.slice(0, -1), newRow, prev[prev.length - 1]];
          }
          return [...prev, newRow, createEmptyRow()];
        });
      }

      notify(`تمت إضافة "${newProd.name}" إلى قاعدة البيانات وقائمة الجرد`, 'success');
      setQuickAddProductModal(prev => ({ ...prev, open: false }));
    } catch (err) {
      console.error(err);
      notify('حدث خطأ أثناء حفظ المنتج الجديد في قاعدة البيانات', 'error');
    } finally {
      setIsSavingNewProduct(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return [];
    if (activeSearch?.field === 'code') {
      // البحث بكود المنتج يظهر المطابق لنفس الرقم/الكود فقط
      return products.filter(p => (p.code || '').trim().toLowerCase() === q);
    }
    return products
      .filter(p => p.name.toLowerCase().includes(q) || (p.code && p.code.trim().toLowerCase() === q))
      .slice(0, 10);
  }, [searchTerm, products, activeSearch]);

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
      <ReportLayout printOnly={true} showHeader={printWithHeader} showSignatures={printWithFooter} title={listType === 'inventory' ? "قائمة جرد المخزون" : "سند استلام بضاعة"} subtitle={listName || "مستند مستودعي"}>
          <div className="grid grid-cols-2 gap-4 mb-4 font-bold bg-gray-50 p-2 border border-sap-border font-mono" style={{ fontSize: `${printFontSize}px` }}>
              <div className="space-y-1">
                  <div className="flex justify-between"><span>التاريخ:</span> <span>{listDate}</span></div>
                  <div className="flex justify-between"><span>النوع:</span> <span className="text-sap-primary">{listType === 'inventory' ? 'جرد' : 'استلام'}</span></div>
              </div>
              <div className="space-y-1">
                  <div className="flex justify-between"><span>عدد الأصناف:</span> <span>{validRowsCount}</span></div>
                  <div className="flex justify-between"><span>إجمالي الكمية:</span> <span className="text-sap-primary">{totalQty}</span></div>
                  {(visibleColumns.cartonQty || showCartonQty) && <div className="flex justify-between"><span>إجمالي الكراتين:</span> <span className="text-sap-primary">{totalCartonQty}</span></div>}
              </div>
          </div>
          <table className="w-full text-right border-collapse">
              <thead>
                  <tr className="bg-sap-shell text-white font-black uppercase" style={{ fontSize: `${printFontSize}px` }}>
                      <th className="p-1 border border-sap-border w-8 text-center" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>#</th>
                      {visibleColumns.code && <th className="p-1 border border-sap-border w-24" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>كود الصنف</th>}
                      {visibleColumns.name && <th className="p-1 border border-sap-border" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>اسم المنتج</th>}
                      {visibleColumns.cartonQty && <th className="p-1 border border-sap-border w-16 text-center" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>كمية الكرتون</th>}
                      {visibleColumns.qty && <th className="p-1 border border-sap-border w-16 text-center" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>الكمية</th>}
                      {visibleColumns.unit && <th className="p-1 border border-sap-border w-16" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>الوحدة</th>}
                      {visibleColumns.expiry && <th className="p-1 border border-sap-border w-24" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>الصلاحية</th>}
                      {visibleColumns.note && <th className="p-1 border border-sap-border w-32" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>ملاحظات</th>}
                      {customColumns.map(col => (
                          <th key={col.id} className="p-1 border border-sap-border w-24" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>{col.name}</th>
                      ))}
                  </tr>
              </thead>
              <tbody className="font-bold font-mono" style={{ fontSize: `${printFontSize}px` }}>
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
                              {visibleColumns.code && <td className="p-1 border-l border-sap-border/50">{row.code}</td>}
                              {visibleColumns.name && <td className="p-1 border-l border-sap-border/50">{row.name}</td>}
                              {visibleColumns.cartonQty && <td className="p-1 text-center border-l border-sap-border/50">{row.cartonQty}</td>}
                              {visibleColumns.qty && <td className="p-1 text-center border-l border-sap-border/50">{row.qty}</td>}
                              {visibleColumns.unit && <td className="p-1 border-l border-sap-border/50">{getUnitName(row.unitId)}</td>}
                              {visibleColumns.expiry && <td className="p-1 border-l border-sap-border/50">
                                  <div className="flex items-center justify-between"><span>{row.expiryDate || '-'}</span>{statusText && <span className="text-[8px] border px-1">{statusText}</span>}</div>
                              </td>}
                              {visibleColumns.note && <td className="p-1 border-l border-sap-border/50">{row.note}</td>}
                              {customColumns.map(col => (
                                  <td key={col.id} className="p-1 border-l border-sap-border/50">{row.customFields?.[col.id] || ''}</td>
                              ))}
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
      
      {/* Compact & Modern Unified Toolbar */}
      <div className="bg-white/90 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex flex-col xl:flex-row justify-between items-center gap-4 rounded-b-2xl mx-2 shadow-sm shrink-0 z-20 sticky top-0">
          {/* Left: Document Info */}
          <div className="flex items-center gap-3 w-full xl:w-auto p-1 bg-gray-50/80 rounded-xl border border-gray-200/60 focus-within:border-sap-primary/40 focus-within:bg-white focus-within:shadow-md transition-all group">
              <button 
                onClick={() => setListType(prev => prev === 'inventory' ? 'receipt' : 'inventory')}
                className={`p-2.5 rounded-lg transition-all border shadow-sm ${listType === 'inventory' ? 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50' : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'}`}
                title={listType === 'inventory' ? 'تحويل لسند استلام' : 'تحويل لقائمة جرد'}
              >
                  {listType === 'inventory' ? <ClipboardList size={20}/> : <Truck size={20}/>}
              </button>
              
              <div className="flex-1 min-w-[220px]">
                  <input 
                    type="text" 
                    value={listName} 
                    onChange={e => setListName(e.target.value)} 
                    placeholder="اسم القائمة..." 
                    className="w-full text-sm font-bold text-gray-800 bg-transparent border-none focus:ring-0 px-2 py-1 transition-colors placeholder:text-gray-400" 
                  />
                  <div className="text-[10px] text-gray-400 font-bold px-2 flex items-center gap-2">
                      <span>{listType === 'inventory' ? 'جرد مخزون' : 'سند استلام'}</span>
                      <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                      <input 
                        type="date" 
                        value={listDate} 
                        onChange={e => setListDate(e.target.value)} 
                        className="bg-transparent border-none p-0 text-[10px] font-mono text-gray-500 focus:ring-0 font-bold"
                      />
                  </div>
              </div>
          </div>
          
          {/* Middle: Quick Local Search/Scan */}
          <div className="flex-1 w-full max-w-lg mx-4 relative hidden md:block">
              <div className="flex items-center bg-gray-50/80 border border-gray-200/60 rounded-xl focus-within:ring-2 focus-within:ring-sap-primary/20 focus-within:border-sap-primary focus-within:bg-white transition-all shadow-sm group">
                  <div className="pl-3 pr-4 text-gray-400 group-focus-within:text-sap-primary transition-colors"><Target size={18}/></div>
                  <input 
                      ref={scanInputRef}
                      type="text" 
                      value={localScanQuery}
                      onChange={e => setLocalScanQuery(e.target.value)}
                      onKeyDown={handleLocalScan}
                      placeholder="F9 للبحث السريع وتعديل الكمية..." 
                      className="w-full bg-transparent border-none py-3 text-sm font-bold text-gray-800 placeholder-gray-400 focus:ring-0"
                  />
                  <div className="pl-3 pr-2 flex gap-1">
                      <div className="text-[10px] bg-white border border-gray-200 px-2.5 py-1 rounded-md text-gray-400 font-bold hidden xl:block shadow-sm">F9</div>
                  </div>
              </div>
          </div>

           {/* Right: Actions */}
          <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-end">
                
                {/* 1. File Actions */}
                <div className="flex gap-1 p-1 bg-white rounded-xl border border-gray-200 shadow-sm">
                    <button onClick={() => { setActiveListId(null); setRows([createEmptyRow()]); setListName(''); }} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="جديد">
                        <Eraser size={18}/>
                    </button>
                    <button onClick={() => { fetchSavedLists(); setShowSavedLists(true); }} className="p-2 text-gray-500 hover:text-sap-primary hover:bg-sap-highlight/20 rounded-lg transition-all" title="الأرشيف">
                        <FolderOpen size={18}/>
                    </button>
                </div>

                {/* 2. Import Tools */}
                <div className="flex gap-1 p-1 bg-white rounded-xl border border-gray-200 shadow-sm items-center">
                    <input type="file" ref={excelInputRef} onChange={handleExcelImport} accept=".xlsx, .xls" className="hidden" />
                    <button onClick={() => excelInputRef.current?.click()} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all flex items-center gap-2 font-bold" title="استيراد Excel">
                        <FileSpreadsheet size={18}/> 
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleSmartScan} accept="image/*, application/pdf" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isScanning} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all flex items-center gap-2 font-bold" title="مسح ذكي AI">
                        {isScanning ? <Loader2 size={18} className="animate-spin"/> : <ScanLine size={18}/>}
                    </button>
                    <div className="w-px h-6 bg-gray-200 mx-1"></div>
                    <button onClick={generateInventoryTemplate} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all" title="تحميل نموذج">
                        <Download size={18}/>
                    </button>
                </div>

                {/* 3. Main Actions */}
                <div className="flex gap-2 items-center relative">
                    <button onClick={() => setShowPrintSettings(!showPrintSettings)} className="px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2">
                        <SlidersHorizontal size={18}/> <span className="hidden sm:inline">الإعدادات</span>
                    </button>
                    
                    {showPrintSettings && (
                        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-gray-800 text-sm">إعدادات الطباعة والأعمدة</h3>
                                <button onClick={() => setShowPrintSettings(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">حجم الخط (للطباعة)</label>
                                    <div className="flex items-center gap-2">
                                        <input type="range" min="8" max="24" value={printFontSize} onChange={e => setPrintFontSize(Number(e.target.value))} className="flex-1 accent-sap-primary" />
                                        <span className="text-xs font-bold w-6 text-center">{printFontSize}</span>
                                    </div>
                                </div>
                                
                                <div className="space-y-2 border-t pt-3">
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                                        <input type="checkbox" checked={printWithHeader} onChange={e => setPrintWithHeader(e.target.checked)} className="rounded border-gray-300 text-sap-primary focus:ring-sap-primary" />
                                        <span>إظهار الترويسة العلوية</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                                        <input type="checkbox" checked={printWithFooter} onChange={e => setPrintWithFooter(e.target.checked)} className="rounded border-gray-300 text-sap-primary focus:ring-sap-primary" />
                                        <span>إظهار الترويسة السفلية (التوقيعات)</span>
                                    </label>
                                </div>

                                <div className="border-t pt-3">
                                    <h4 className="text-xs font-bold text-gray-800 mb-2">الأعمدة المرئية</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries({
                                            code: 'كود الصنف', name: 'اسم المنتج', cartonQty: 'كمية الكرتون', qty: 'الكمية', unit: 'الوحدة', expiry: 'الصلاحية', note: 'ملاحظات'
                                        }).map(([key, label]) => (
                                            <label key={key} className="flex items-center gap-2 text-[10px] font-bold text-gray-600 cursor-pointer">
                                                <input type="checkbox" checked={visibleColumns[key as keyof typeof visibleColumns]} onChange={e => setVisibleColumns(prev => ({...prev, [key]: e.target.checked}))} className="rounded border-gray-300 text-sap-primary focus:ring-sap-primary w-3 h-3" />
                                                <span>{label}</span>
                                            </label>
                                        ))}
                                        {customColumns.map(col => (
                                            <div key={col.id} className="flex items-center justify-between col-span-2 bg-gray-50 p-1 rounded">
                                                <span className="text-[10px] font-bold text-gray-600">{col.name}</span>
                                                <button onClick={() => setCustomColumns(prev => prev.filter(c => c.id !== col.id))} className="text-red-500 hover:text-red-700"><Trash2 size={12}/></button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 flex gap-1.5">
                                        <input
                                            type="text"
                                            value={customColumnInput}
                                            onChange={e => setCustomColumnInput(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && customColumnInput.trim()) {
                                                    e.preventDefault();
                                                    setCustomColumns(prev => [...prev, { id: `custom_${Date.now()}`, name: customColumnInput.trim() }]);
                                                    setCustomColumnInput('');
                                                }
                                            }}
                                            placeholder="اسم عمود مخصص..."
                                            className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-[10px] font-bold outline-none focus:border-sap-primary"
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                if (customColumnInput.trim()) {
                                                    setCustomColumns(prev => [...prev, { id: `custom_${Date.now()}`, name: customColumnInput.trim() }]);
                                                    setCustomColumnInput('');
                                                }
                                            }}
                                            className="px-2.5 py-1 bg-sap-primary/10 text-sap-primary rounded-lg text-[10px] font-bold hover:bg-sap-primary/20 transition-colors flex items-center gap-1"
                                        >
                                            <Plus size={12}/> إضافة
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => openQuickAddModal()}
                        className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-1.5"
                        title="إضافة منتج جديد وإدراجه تلقائياً في قاعدة البيانات"
                    >
                        <Plus size={16}/> <span className="hidden sm:inline">منتج جديد للقاعدة</span>
                    </button>
                    <button onClick={() => window.print()} className="px-4 py-2 bg-gray-100 text-gray-800 border border-gray-200 rounded-xl text-sm font-black hover:bg-gray-200 transition-all shadow-sm flex items-center gap-2">
                        <Printer size={18}/> <span className="hidden sm:inline">طباعة</span>
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 bg-gradient-to-r from-sap-primary to-sap-primary-hover text-white rounded-xl text-sm font-black hover:shadow-lg hover:shadow-sap-primary/30 active:scale-95 transition-all shrink-0 border border-sap-primary-hover border-b-4 active:border-b-0 active:translate-y-1 flex items-center gap-2">
                        {isSaving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18} strokeWidth={2.5}/>} <span>حفظ السند</span>
                    </button>
                </div>
          </div>
      </div>

      {/* Main Grid - POS Style */}
      <div className="flex-1 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col relative">
        <div className="overflow-auto custom-scrollbar flex-1 bg-gray-50/30">
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-50/80 sticky top-0 z-10">
              <tr className="text-gray-500 font-bold border-b border-gray-100 text-[11px] uppercase tracking-wider backdrop-blur-md">
                <th className="p-4 w-12 text-center">#</th>
                {visibleColumns.code && <th className="p-4 w-40 text-right">كود الصنف</th>}
                {visibleColumns.name && <th className="p-4 text-right">اسم المنتج / الوصف</th>}
                {visibleColumns.cartonQty && <th className="p-4 w-28 text-center">كمية الكرتون</th>}
                {visibleColumns.qty && <th className="p-4 w-28 text-center">الكمية</th>}
                {visibleColumns.unit && <th className="p-4 w-36 text-right">الوحدة</th>}
                {visibleColumns.expiry && <th className="p-4 w-36 text-right">الصلاحية</th>}
                {visibleColumns.note && <th className="p-4 w-40 text-right">ملاحظات</th>}
                {customColumns.map(col => (
                    <th key={col.id} className="p-4 w-32 text-right">{col.name}</th>
                ))}
                <th className="p-4 w-14"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {rows.map((row, idx) => (
                <tr 
                  id={`row-${row.id}`}
                  key={row.id} 
                  className={`group transition-all duration-300 hover:bg-sap-primary/5 ${highlightedRowId === row.id ? 'bg-yellow-50 shadow-inner' : ''}`}
                >
                  <td className="p-4 text-center text-gray-400 font-mono font-bold text-xs">{idx + 1}</td>
                  
                  {/* Code */}
                  {visibleColumns.code && <td className="p-3 relative">
                    <div className="flex items-center bg-gray-50/50 border border-gray-200/60 rounded-xl focus-within:border-sap-primary/40 focus-within:ring-2 focus-within:ring-sap-primary/10 focus-within:bg-white transition-all shadow-sm">
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
                          className="w-full bg-transparent border-none py-2 text-sap-primary placeholder-gray-300 text-sm font-mono font-black focus:ring-0 outline-none"
                          placeholder="SCAN" autoComplete="off"
                        />
                    </div>
                    {activeSearch?.rowId === row.id && activeSearch.field === 'code' && searchTerm.trim() !== '' && (
                      <div className="absolute top-full right-0 z-50 bg-white border border-gray-200 w-72 shadow-xl mt-1 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                          {filteredProducts.length > 0 ? (
                            filteredProducts.map((p, i) => (
                              <div key={p.id} onClick={() => selectProductForRow(row.id, p)} className={`p-3 cursor-pointer border-b border-gray-50 flex justify-between items-center transition-colors ${i === selectedIndex ? 'bg-sap-primary/10 text-sap-primary' : 'hover:bg-gray-50 text-gray-700'}`}>
                                  <span className="font-mono font-black text-sm">{p.code}</span><span className="text-[11px] font-bold opacity-80 truncate max-w-[140px]">{p.name}</span>
                              </div>
                            ))
                          ) : (
                            <div className="p-2.5 space-y-2">
                              <div className="text-[11px] font-bold text-gray-500 px-1">
                                لا يوجد منتج بالكود <span className="font-mono text-gray-800">{searchTerm.trim()}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => openQuickAddModal(row.id, searchTerm.trim(), row.name)}
                                className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-black flex items-center justify-center gap-1.5 transition-colors"
                              >
                                <Plus size={14} />
                                <span>إضافة كمنتج جديد لقاعدة البيانات</span>
                              </button>
                            </div>
                          )}
                      </div>
                    )}
                  </td>}

                  {/* Name */}
                  {visibleColumns.name && <td className="p-3 relative">
                    <input 
                      id={`name-${row.id}`} type="text" value={row.name} 
                      onKeyDown={(e) => handleSearchKeyDown(e, row.id, 'name')}
                      onChange={e => {
                        const val = e.target.value;
                        setRows(prev => prev.map(r => r.id === row.id ? { ...r, name: val } : r));
                        setActiveSearch({ rowId: row.id, field: 'name' });
                        setSearchTerm(val);
                      }}
                      className="w-full bg-transparent border-b border-gray-200/60 hover:border-sap-primary/30 focus:border-sap-primary p-2 focus:ring-0 font-bold text-gray-800 placeholder-gray-300 transition-colors outline-none text-xs"
                      placeholder="بحث عن منتج..." autoComplete="off"
                    />
                    {activeSearch?.rowId === row.id && activeSearch.field === 'name' && searchTerm.trim() !== '' && (
                      <div className="absolute top-full right-0 z-50 bg-white border border-gray-200 w-full min-w-[240px] shadow-xl mt-1 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                          {filteredProducts.length > 0 ? (
                            filteredProducts.map((p, i) => (
                              <div key={p.id} onClick={() => selectProductForRow(row.id, p)} className={`p-3 cursor-pointer border-b border-gray-50 flex justify-between items-center transition-colors ${i === selectedIndex ? 'bg-sap-primary/10 text-sap-primary' : 'hover:bg-gray-50 text-gray-700'}`}>
                                  <span className="font-bold text-xs">{p.name}</span><span className="text-[10px] opacity-70 font-mono">{p.code}</span>
                              </div>
                            ))
                          ) : (
                            <div className="p-2.5">
                              <button
                                type="button"
                                onClick={() => openQuickAddModal(row.id, row.code, searchTerm.trim())}
                                className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-black flex items-center justify-center gap-1.5 transition-colors"
                              >
                                <Plus size={14} />
                                <span>إضافة "{searchTerm.trim()}" كمنتج جديد في القاعدة</span>
                              </button>
                            </div>
                          )}
                      </div>
                    )}
                  </td>}

                  {/* Carton Qty */}
                  {visibleColumns.cartonQty && (
                    <td className="p-3">
                      <input id={`cartonQty-${row.id}`} type="number" value={row.cartonQty || ''} onWheel={(e) => (e.target as HTMLInputElement).blur()} onKeyDown={(e) => { if(e.key === 'Enter') focusNextField(e, row.id, 'cartonQty') }} onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, cartonQty: e.target.value === '' ? '' : Number(e.target.value) } : r))} className="w-full bg-gray-50/50 rounded-xl border border-gray-200/60 focus:border-sap-primary/40 focus:bg-white text-center font-black text-sap-secondary placeholder-gray-300 py-2 text-sm outline-none transition-all shadow-sm" placeholder="-" />
                    </td>
                  )}

                  {/* Qty */}
                  {visibleColumns.qty && <td className="p-3">
                    <input id={`qty-${row.id}`} type="number" value={row.qty} onWheel={(e) => (e.target as HTMLInputElement).blur()} onKeyDown={(e) => { if(e.key === 'Enter') focusNextField(e, row.id, 'qty') }} onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, qty: e.target.value === '' ? '' : Number(e.target.value) } : r))} className="w-full bg-gray-50/50 rounded-xl border border-gray-200/60 focus:border-sap-primary/40 focus:bg-white text-center font-black text-sap-secondary placeholder-gray-300 py-2 text-sm outline-none transition-all shadow-sm" placeholder="0" />
                  </td>}

                  {/* Unit */}
                  {visibleColumns.unit && <td className="p-3">
                    <select id={`unit-${row.id}`} value={row.unitId} onKeyDown={(e) => { if(e.key === 'Enter') focusNextField(e, row.id, 'unit') }} onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, unitId: e.target.value } : r))} className="w-full bg-gray-50/50 border border-gray-200/60 hover:border-sap-primary/30 focus:border-sap-primary focus:bg-white rounded-xl py-2 px-3 focus:ring-0 text-xs font-bold text-gray-700 cursor-pointer outline-none transition-all shadow-sm">
                      <option value="">اختر الوحدة</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </td>}

                  {/* Expiry */}
                  {visibleColumns.expiry && <td className="p-3 relative">
                    <input id={`expiry-${row.id}`} type="date" value={row.expiryDate} onKeyDown={(e) => { if(e.key === 'Enter') focusNextField(e, row.id, 'expiryDate') }} onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, expiryDate: e.target.value } : r))} className="w-full bg-gray-50/50 border border-gray-200/60 hover:border-sap-primary/30 focus:border-sap-primary focus:bg-white rounded-xl p-2 focus:ring-0 text-xs font-mono text-gray-700 outline-none transition-all shadow-sm" />
                    {getExpiryStatus(row.expiryDate).status !== 'normal' && <div className="absolute left-1 top-1/2 -translate-y-1/2 text-red-500 bg-red-50 p-1 rounded-md shadow-sm"><AlertTriangle size={12} /></div>}
                  </td>}

                  {/* Note */}
                  {visibleColumns.note && <td className="p-3">
                    <input id={`note-${row.id}`} type="text" value={row.note || ''} onKeyDown={(e) => { if(e.key === 'Enter') focusNextField(e, row.id, 'note') }} onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, note: e.target.value } : r))} className="w-full bg-gray-50/50 border border-gray-200/60 hover:border-sap-primary/30 focus:border-sap-primary focus:bg-white rounded-xl p-2 focus:ring-0 text-xs font-bold text-gray-700 outline-none transition-all shadow-sm" placeholder="ملاحظة..." />
                  </td>}

                  {/* Custom Columns */}
                  {customColumns.map(col => (
                      <td key={col.id} className="p-3">
                          <input 
                              type="text" 
                              value={row.customFields?.[col.id] || ''} 
                              onChange={e => {
                                  const val = e.target.value;
                                  setRows(prev => prev.map(r => r.id === row.id ? { 
                                      ...r, 
                                      customFields: { ...(r.customFields || {}), [col.id]: val } 
                                  } : r));
                              }}
                              className="w-full bg-gray-50/50 border border-gray-200/60 hover:border-sap-primary/30 focus:border-sap-primary focus:bg-white rounded-xl p-2 focus:ring-0 text-xs font-bold text-gray-700 outline-none transition-all shadow-sm"
                          />
                      </td>
                  ))}

                  <td className="p-3 text-center">
                    <button onClick={() => setRows(prev => prev.filter(r => r.id !== row.id))} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 hover:shadow-sm rounded-xl transition-all"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
              
              {/* Add Row Button at bottom of table */}
              <tr>
                  <td colSpan={2 + Object.values(visibleColumns).filter(Boolean).length + customColumns.length + (showCartonQty && !visibleColumns.cartonQty ? 1 : 0)} className="p-4">
                      <button onClick={() => setRows(prev => [...prev, createEmptyRow()])} className="w-full py-4 bg-gray-50/50 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold hover:border-sap-primary/50 hover:text-sap-primary hover:bg-sap-primary/5 transition-all flex items-center justify-center gap-2 shadow-sm">
                          <Plus size={18} strokeWidth={2.5}/> إضافة سطر جديد (أو اضغط Enter في آخر حقل)
                      </button>
                  </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* Footer Summary */}
        <div className="p-5 border-t border-gray-100 bg-white flex justify-between items-center text-xs font-black text-gray-500 uppercase tracking-wide shadow-[0_-4px_15px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2">
                عدد السجلات: 
                <span className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-lg text-sm">{validRowsCount}</span>
            </div>
            <div className="flex gap-6">
                {(visibleColumns.cartonQty || showCartonQty) && (
                    <div className="flex items-center gap-2">
                        إجمالي الكراتين: 
                        <span className="text-sap-secondary text-2xl font-mono bg-sap-secondary/10 px-3 py-1 rounded-xl ring-1 ring-sap-secondary/20">{totalCartonQty}</span>
                    </div>
                )}
                <div>إجمالي الكميات: <span className="text-sap-primary text-xl font-mono ml-2">{totalQty}</span></div>
            </div>
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

      {/* Quota & Billing Fallback Modal */}
      {showQuotaFallback && (
          <div className="fixed inset-0 z-[220] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-amber-200 overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200" dir="rtl">
                  <div className="p-6 bg-gradient-to-l from-amber-500 via-amber-600 to-amber-700 text-white flex items-center gap-4">
                      <div className="p-3 bg-white/20 rounded-2xl shrink-0">
                          <span className="text-2xl">⚠️</span>
                      </div>
                      <div>
                          <h3 className="font-black text-lg">
                              {quotaErrorMsg.includes("402") || quotaErrorMsg.includes("Prepayment")
                                  ? "تنبيه: نفاد رصيد الدفع المسبق (402 Payment Required)"
                                  : "تنبيه: تعذر إتمام المسح بالذكاء الاصطناعي"}
                          </h3>
                          <p className="text-xs text-amber-100 font-bold opacity-90">
                              {quotaErrorMsg.includes("402") 
                                  ? "حساب Google AI Studio يتطلب شحن رصيد الـ Prepayment Credits" 
                                  : "حالة الفوترة أو حصة الاستخدام لمشروع الذكاء الاصطناعي"}
                          </p>
                      </div>
                  </div>

                  <div className="p-6 space-y-4">
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-2">
                          <h4 className="font-black text-amber-900 text-xs flex items-center gap-1.5">
                              <span>🔍 تفاصيل التنبيه:</span>
                          </h4>
                          <p className="text-amber-950 text-xs leading-relaxed font-bold bg-white/70 p-2.5 rounded-xl border border-amber-200/60">
                              {quotaErrorMsg}
                          </p>
                          <p className="text-gray-600 text-[11px] leading-relaxed">
                              هذا القيد صادر مباشرة من خوادم Google AI Studio بسبب انتهاء الرصيد المالي المسبق للمشروع، وليس خطأً داخلياً في النظام.
                          </p>
                          <div className="flex flex-wrap gap-2 pt-2">
                              <a 
                                  href="https://ai.studio/projects" 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white hover:bg-amber-700 font-black text-xs rounded-xl shadow-xs transition-colors"
                              >
                                  <span>إدارة المشاريع والفوترة في AI Studio</span>
                                  <span>🔗</span>
                              </a>
                              <a 
                                  href="https://ai.google.dev/gemini-api/docs/billing#prepay" 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 font-bold text-xs rounded-xl transition-colors"
                              >
                                  <span>دليل شحن رصيد Prepay</span>
                              </a>
                          </div>
                      </div>

                      <div className="space-y-2">
                          <h4 className="font-black text-gray-800 text-xs">✨ الحلول البديلة المتاحة فوراً للمتابعة بدون توقف:</h4>
                          <ul className="text-gray-600 text-xs space-y-1.5 list-disc list-inside">
                              <li><span className="font-bold text-gray-800">المحاكاة الذكية:</span> مسح وفك تشفير قائمة أصناف نموذجية لتجربة وفحص دورة العمل فوراً.</li>
                              <li><span className="font-bold text-gray-800">ملفات Excel:</span> استيراد جدول بيانات الأصناف مباشرة وبدقة وبدون أي رسوم.</li>
                              <li><span className="font-bold text-gray-800">الإدخال اليدوي أو الكاميرا:</span> مسح الباركود وإضافة المنتجات مباشرة.</li>
                          </ul>
                      </div>
                  </div>

                  <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col gap-2.5">
                      <button 
                          onClick={() => {
                              setShowQuotaFallback(false);
                              handleMockScanProcess();
                          }} 
                          className="w-full py-3.5 bg-indigo-600 text-white font-black text-sm rounded-2xl hover:bg-indigo-700 shadow-md flex items-center justify-center gap-2 transition-all"
                      >
                          <span>تشغيل المحاكاة الذكية بالبيانات النموذجية 🪄</span>
                      </button>

                      <button 
                          onClick={() => {
                              setShowQuotaFallback(false);
                              excelInputRef.current?.click();
                          }} 
                          className="w-full py-3 bg-emerald-700 text-white font-black text-xs rounded-2xl hover:bg-emerald-800 shadow-sm flex items-center justify-center gap-2 transition-all"
                      >
                          <span>📊 استيراد ملف إكسل (Excel) بدلاً من ذلك</span>
                      </button>
                      
                      <button 
                          onClick={() => setShowQuotaFallback(false)} 
                          className="w-full py-2.5 bg-gray-100 text-gray-600 font-black text-xs rounded-2xl hover:bg-gray-200 transition-all text-center"
                      >
                          إغلاق
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Saved Lists Modal */}
      {showSavedLists && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
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
                            placeholder="بحث في الأرشيف (الاسم، التاريخ، أو المنتجات...)" 
                            className="w-full bg-gray-800 text-white placeholder-gray-500 text-xs font-bold py-3 pr-10 pl-4 rounded-xl border border-gray-700 focus:border-sap-secondary outline-none"
                          />
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto bg-gray-50 custom-scrollbar p-4 space-y-3">
                      {isLoadingLists ? <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2"><Loader2 className="animate-spin"/><span className="text-xs font-bold">جاري التحميل...</span></div> : (
                          filteredSavedLists.length > 0 ? filteredSavedLists.map((list: any) => (
                              <div key={list.id} onClick={() => loadList(list)} className="bg-white border border-gray-100 rounded-2xl hover:border-sap-primary hover:shadow-lg cursor-pointer transition-all overflow-hidden group">
                                  <div className="p-5 flex justify-between items-center">
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
                                          <Trash2 size={18} className="text-red-300 hover:text-red-500 transition-colors" onClick={(e) => { 
                                              e.stopPropagation(); 
                                              setConfirmDialog({
                                                  isOpen: true,
                                                  message: 'هل أنت متأكد من الحذف؟',
                                                  onConfirm: async () => {
                                                      await db.lists.delete(list.id); 
                                                      fetchSavedLists();
                                                      setConfirmDialog(null);
                                                  }
                                              });
                                          }} />
                                      </div>
                                  </div>
                                  
                                  {/* Show matching items snippet if search is active */}
                                  {list.matchingItems && list.matchingItems.length > 0 && (
                                      <div className="px-5 pb-3 pt-0">
                                          <div className="text-[10px] font-bold text-gray-400 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                              <span className="text-sap-primary">تم العثور على:</span> {list.matchingItems.map((i: any) => i.name).slice(0, 3).join('، ')} {list.matchingItems.length > 3 ? `و ${list.matchingItems.length - 3} آخرين` : ''}
                                          </div>
                                      </div>
                                  )}
                              </div>
                          )) : <div className="p-12 text-center text-gray-400 font-bold text-sm">لا توجد سجلات محفوظة مطابقة</div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Quick Add New Product Modal (Auto-saved to DB & Inventory) */}
      {quickAddProductModal.open && (
          <div className="fixed inset-0 z-[210] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setQuickAddProductModal(prev => ({ ...prev, open: false }))}>
              <form
                onSubmit={handleSaveQuickProduct}
                onClick={e => e.stopPropagation()}
                className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in duration-150"
                dir="rtl"
              >
                  <div className="px-5 py-4 bg-emerald-600 text-white flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                          <Plus size={20} />
                          <div>
                              <h3 className="font-black text-sm">إضافة منتج جديد لقاعدة البيانات</h3>
                              <p className="text-[11px] text-emerald-100 font-semibold">يُحفظ تلقائياً في قاعدة البيانات ويُدرج في الجرد</p>
                          </div>
                      </div>
                      <button type="button" onClick={() => setQuickAddProductModal(prev => ({ ...prev, open: false }))} className="p-1.5 rounded-lg hover:bg-white/15">
                          <X size={18} />
                      </button>
                  </div>

                  <div className="p-5 space-y-3.5 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="block font-bold text-gray-700 mb-1">كود المنتج / الباركود *</label>
                              <input
                                type="text"
                                required
                                value={quickAddProductModal.code}
                                onChange={e => setQuickAddProductModal(prev => ({ ...prev, code: e.target.value }))}
                                placeholder="مثال: 628100..."
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl font-mono font-bold focus:border-emerald-600 outline-none"
                                autoFocus={!quickAddProductModal.code}
                              />
                          </div>
                          <div>
                              <label className="block font-bold text-gray-700 mb-1">الوحدة</label>
                              <select
                                value={quickAddProductModal.unitId}
                                onChange={e => setQuickAddProductModal(prev => ({ ...prev, unitId: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl font-bold focus:border-emerald-600 outline-none bg-white"
                              >
                                  <option value="">اختر الوحدة</option>
                                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                              </select>
                          </div>
                      </div>

                      <div>
                          <label className="block font-bold text-gray-700 mb-1">اسم المنتج *</label>
                          <input
                            type="text"
                            required
                            value={quickAddProductModal.name}
                            onChange={e => setQuickAddProductModal(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="أدخل اسم المنتج بالكامل..."
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl font-bold focus:border-emerald-600 outline-none"
                            autoFocus={Boolean(quickAddProductModal.code)}
                          />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="block font-bold text-gray-700 mb-1">سعر البيع</label>
                              <input
                                type="number"
                                step="0.01"
                                value={quickAddProductModal.price}
                                onChange={e => setQuickAddProductModal(prev => ({ ...prev, price: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl font-mono font-bold focus:border-emerald-600 outline-none"
                              />
                          </div>
                          <div>
                              <label className="block font-bold text-gray-700 mb-1">سعر التكلفة</label>
                              <input
                                type="number"
                                step="0.01"
                                value={quickAddProductModal.costPrice}
                                onChange={e => setQuickAddProductModal(prev => ({ ...prev, costPrice: e.target.value }))}
                                placeholder="اختياري"
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl font-mono font-bold focus:border-emerald-600 outline-none"
                              />
                          </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                          <div>
                              <label className="block font-bold text-gray-700 mb-1">كمية الجرد</label>
                              <input
                                type="number"
                                value={quickAddProductModal.qty}
                                onChange={e => setQuickAddProductModal(prev => ({ ...prev, qty: e.target.value }))}
                                placeholder="0"
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl font-mono font-bold focus:border-emerald-600 outline-none"
                              />
                          </div>
                          <div>
                              <label className="block font-bold text-gray-700 mb-1">كمية الكرتون</label>
                              <input
                                type="number"
                                value={quickAddProductModal.cartonQty}
                                onChange={e => setQuickAddProductModal(prev => ({ ...prev, cartonQty: e.target.value }))}
                                placeholder="-"
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl font-mono font-bold focus:border-emerald-600 outline-none"
                              />
                          </div>
                          <div>
                              <label className="block font-bold text-gray-700 mb-1">تاريخ الصلاحية</label>
                              <input
                                type="date"
                                value={quickAddProductModal.expiryDate}
                                onChange={e => setQuickAddProductModal(prev => ({ ...prev, expiryDate: e.target.value }))}
                                className="w-full px-2 py-2 border border-gray-200 rounded-xl font-mono text-[11px] focus:border-emerald-600 outline-none"
                              />
                          </div>
                      </div>
                  </div>

                  <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setQuickAddProductModal(prev => ({ ...prev, open: false }))}
                        className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs font-bold hover:bg-gray-100"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingNewProduct}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isSavingNewProduct ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        <span>حفظ في القاعدة والجرد</span>
                      </button>
                  </div>
              </form>
          </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog?.isOpen && (
          <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm transition-all">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="p-6 text-center">
                      <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Trash2 size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 mb-2">تأكيد الحذف</h3>
                      <p className="text-gray-500">{confirmDialog.message}</p>
                  </div>
                  <div className="flex border-t border-gray-100">
                      <button 
                          onClick={() => setConfirmDialog(null)} 
                          className="flex-1 p-4 text-gray-500 hover:bg-gray-50 font-bold transition-colors"
                      >
                          إلغاء
                      </button>
                      <div className="w-px bg-gray-100"></div>
                      <button 
                          onClick={confirmDialog.onConfirm} 
                          className="flex-1 p-4 text-red-500 hover:bg-red-50 font-bold transition-colors"
                      >
                          حذف
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

function tryRepairTruncatedJSON(str: string): string {
    const cleaned = str.replace(/```json|```/g, '').trim();
    try {
        JSON.parse(cleaned);
        return cleaned;
    } catch (_) {}

    let output = '';
    let inString = false;
    let escape = false;
    const stack: ('{' | '[')[] = [];
    
    for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        if (escape) {
            output += char;
            escape = false;
            continue;
        }
        if (char === '\\') {
            output += char;
            escape = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            output += char;
            continue;
        }
        if (inString) {
            output += char;
            continue;
        }
        
        if (char === '{') {
            stack.push('{');
            output += char;
        } else if (char === '[') {
            stack.push('[');
            output += char;
        } else if (char === '}') {
            if (stack[stack.length - 1] === '{') {
                stack.pop();
            }
            output += char;
        } else if (char === ']') {
            if (stack[stack.length - 1] === '[') {
                stack.pop();
            }
            output += char;
        } else {
            output += char;
        }
    }
    
    if (inString) {
        const lastQuote = output.lastIndexOf('"');
        if (lastQuote !== -1) {
            output = output.substring(0, lastQuote);
        }
    }
    
    output = output.trim();
    while (output.endsWith(',') || output.endsWith(':') || output.endsWith('[') || output.endsWith('{')) {
        const lastChar = output[output.length - 1];
        output = output.slice(0, -1).trim();
        if (lastChar === '[') {
            if (stack[stack.length - 1] === '[') stack.pop();
        } else if (lastChar === '{') {
            if (stack[stack.length - 1] === '{') stack.pop();
        }
    }
    
    const lastComma = output.lastIndexOf(',');
    const lastOpenBrace = Math.max(output.lastIndexOf('{'), output.lastIndexOf('['));
    if (lastComma > lastOpenBrace) {
        let testOutput = output.substring(0, lastComma).trim();
        if (testOutput.endsWith(',')) {
            testOutput = testOutput.slice(0, -1).trim();
        }
        const testStack: ('{' | '[')[] = [];
        let tInString = false;
        let tEscape = false;
        for (let i = 0; i < testOutput.length; i++) {
            const char = testOutput[i];
            if (tEscape) { tEscape = false; continue; }
            if (char === '\\') { tEscape = true; continue; }
            if (char === '"') { tInString = !tInString; continue; }
            if (tInString) continue;
            if (char === '{') testStack.push('{');
            else if (char === '[') testStack.push('[');
            else if (char === '}') { if (testStack[testStack.length - 1] === '{') testStack.pop(); }
            else if (char === ']') { if (testStack[testStack.length - 1] === '[') testStack.pop(); }
        }
        
        let testRep = testOutput;
        for (let j = testStack.length - 1; j >= 0; j--) {
            testRep += (testStack[j] === '{' ? '}' : ']');
        }
        try {
            JSON.parse(testRep);
            return testRep;
        } catch (_) {}
    }
    
    let repaired = output;
    for (let j = stack.length - 1; j >= 0; j--) {
        repaired += (stack[j] === '{' ? '}' : ']');
    }
    
    try {
        JSON.parse(repaired);
        return repaired;
    } catch (_) {
        return cleaned;
    }
}
