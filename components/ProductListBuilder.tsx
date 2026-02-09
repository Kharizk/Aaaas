
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
  Tag, CheckSquare, Square, ArrowRight, Download, UploadCloud
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
    if (validRows.length === 0) { alert("NO VALID DATA TO SAVE"); return; }
    setIsSaving(true);
    try {
      const listId = activeListId || crypto.randomUUID();
      await db.lists.upsert({ 
        id: listId, 
        name: listName || (listType === 'inventory' ? 'INVENTORY LIST' : 'RECEIPT VOUCHER'), 
        date: listDate, 
        type: listType,
        rows: validRows 
      });
      setActiveListId(listId);
      alert("DOCUMENT SAVED SUCCESSFULLY");
    } catch (e) { alert("SAVE ERROR"); }
    finally { setIsSaving(false); }
  };

  // --- Excel Import ---
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsScanning(true);
      setScanStep('READING EXCEL FILE...');

      try {
          const rawData = await parseExcelFile(file);
          if (rawData.length === 0) {
              alert("FILE EMPTY OR INVALID FORMAT");
              return;
          }

          setScanStep('PROCESSING ROWS...');
          
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
                  name: finalName ? String(finalName) : 'UNKNOWN ITEM',
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
          alert(`IMPORTED ${newRows.length} ITEMS SUCCESSFULLY.`);

      } catch (error) {
          console.error("Excel Import Error", error);
          alert("ERROR PARSING EXCEL FILE.");
      } finally {
          setIsScanning(false);
          if (excelInputRef.current) excelInputRef.current.value = '';
      }
  };

  // ... (Keep handleSmartScan and other functions as is) ...
  // --- AI Image/PDF Processing (Strict Schema) ---
  const handleSmartScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
        alert("PLEASE UPLOAD IMAGE OR PDF ONLY");
        return;
    }

    setIsScanning(true);
    setScanStep('READING FILE STREAM...');
    
    try {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            
            setScanStep('ANALYZING DOCUMENT...');
            
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

            setScanStep('PROCESSING DATA...');
            
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
                alert(`EXTRACTED ${processedRows.length} ITEMS.`);
                
            } else {
                alert("NO TABLE DATA FOUND IN IMAGE.");
            }
            setIsScanning(false);
        };
        reader.readAsDataURL(file);
    } catch (error) {
        alert("AI ERROR");
        setIsScanning(false);
    } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ... (Keep handleProcessNewItems, selectProductForRow, etc.) ...
  const handleProcessNewItems = async (action: 'add_only' | 'add_and_label') => {
      const selectedItems = pendingProducts.filter(p => selectedPendingIds.has(p.id));
      if (selectedItems.length > 0) {
          try {
              await Promise.all(selectedItems.map(p => db.products.upsert(p)));
              if (onNewProductsAdded) await onNewProductsAdded();
          } catch (e) { alert("DB ERROR"); return; }

          if (action === 'add_and_label') {
              try {
                  const tagList: SavedTagList = {
                      id: crypto.randomUUID(),
                      name: `AUTO IMPORT - ${new Date().toLocaleDateString('en-US')}`,
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
                  alert("PRODUCTS ADDED & LABELS CREATED");
              } catch (e) { alert("LABEL CREATION FAILED"); }
          } else {
              alert(`ADDED ${selectedItems.length} NEW PRODUCTS`);
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
      <ReportLayout title={listType === 'inventory' ? "INVENTORY COUNT SHEET" : "GOODS RECEIPT NOTE"} subtitle={listName || "WAREHOUSE DOCUMENT"}>
          <div className="grid grid-cols-2 gap-4 mb-4 text-[10px] font-bold bg-gray-50 p-2 border border-sap-border font-mono">
              <div className="space-y-1">
                  <div className="flex justify-between"><span>DATE:</span> <span>{listDate}</span></div>
                  <div className="flex justify-between"><span>TYPE:</span> <span className="text-sap-primary">{listType === 'inventory' ? 'STOCKTAKE' : 'INBOUND'}</span></div>
              </div>
              <div className="space-y-1">
                  <div className="flex justify-between"><span>TOTAL ITEMS:</span> <span>{validRowsCount}</span></div>
                  <div className="flex justify-between"><span>TOTAL QTY:</span> <span className="text-sap-primary">{totalQty}</span></div>
              </div>
          </div>
          <table className="w-full text-right border-collapse">
              <thead>
                  <tr className="bg-sap-shell text-white text-[9px] font-black uppercase">
                      <th className="p-1 border border-sap-border w-8 text-center" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>#</th>
                      <th className="p-1 border border-sap-border w-24" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>SKU CODE</th>
                      <th className="p-1 border border-sap-border" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>DESCRIPTION</th>
                      <th className="p-1 border border-sap-border w-16 text-center" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>QTY</th>
                      <th className="p-1 border border-sap-border w-16" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>UNIT</th>
                      <th className="p-1 border border-sap-border w-24" style={{ backgroundColor: '#1F2937', color: 'white', WebkitPrintColorAdjust: 'exact' }}>EXPIRY</th>
                  </tr>
              </thead>
              <tbody className="text-[9px] font-bold font-mono">
                  {rows.filter(r => r.name.trim()).map((row, idx) => {
                      const { status } = getExpiryStatus(row.expiryDate);
                      let rowStyle: React.CSSProperties = { borderBottom: '1px solid #E2E8F0' };
                      let statusText = "";
                      if (status === 'expired') { rowStyle = { ...rowStyle, backgroundColor: '#FECACA', color: '#991B1B', WebkitPrintColorAdjust: 'exact' }; statusText = "EXP"; } 
                      else if (status === 'critical') { rowStyle = { ...rowStyle, backgroundColor: '#FED7AA', color: '#9A3412', WebkitPrintColorAdjust: 'exact' }; statusText = "CRIT"; } 
                      else if (status === 'warning') { rowStyle = { ...rowStyle, backgroundColor: '#FEF08A', color: '#854D0E', WebkitPrintColorAdjust: 'exact' }; statusText = "WARN"; } 
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
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      <PrintView />
      
      {/* Import / Export Controls */}
      <div className="bg-sap-surface border border-sap-border p-4 rounded-sm shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
              <div className={`p-2 rounded-sm ${listType === 'inventory' ? 'bg-blue-900/20 text-blue-400' : 'bg-sap-secondary/20 text-sap-secondary'}`}>
                  {listType === 'inventory' ? <ClipboardList size={24}/> : <Truck size={24}/>}
              </div>
              <div className="flex-1">
                  <label className="text-[9px] font-black text-sap-text-variant block mb-1 font-mono">DOCUMENT REFERENCE</label>
                  <input type="text" value={listName} onChange={e => setListName(e.target.value)} placeholder="ENTER REFERENCE..." className="w-full text-sm font-black bg-sap-background border-b border-sap-border focus:border-sap-primary text-sap-text font-mono" />
              </div>
          </div>
          
          <div className="flex gap-2">
                <button onClick={generateInventoryTemplate} className="px-4 py-2 bg-sap-background border border-sap-border text-sap-text-variant hover:text-sap-text text-[10px] font-black flex items-center gap-2 transition-all">
                    <Download size={14}/> TEMPLATE
                </button>
                <div className="relative">
                    <input type="file" ref={excelInputRef} onChange={handleExcelImport} accept=".xlsx, .xls" className="hidden" />
                    <button onClick={() => excelInputRef.current?.click()} className="px-4 py-2 bg-sap-background border border-sap-border text-sap-text hover:border-sap-primary text-[10px] font-black flex items-center gap-2 transition-all">
                        <UploadCloud size={14}/> UPLOAD EXCEL
                    </button>
                </div>
                <div className="relative">
                    <input type="file" ref={fileInputRef} onChange={handleSmartScan} accept="image/*, application/pdf" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isScanning} className="px-4 py-2 bg-sap-primary text-sap-background text-[10px] font-black hover:bg-sap-primary-hover flex items-center gap-2 shadow-glow">
                        {isScanning ? <Loader2 size={14} className="animate-spin"/> : <ScanLine size={14}/>} AI SCAN
                    </button>
                </div>
          </div>
      </div>

      {/* Main Table Actions */}
      <div className="flex justify-between items-center bg-sap-shell p-2 border border-sap-border border-b-0 rounded-t-sm">
          <div className="flex gap-2">
             <button onClick={() => { setActiveListId(null); setRows([createEmptyRow()]); setListName(''); }} className="px-3 py-1 bg-sap-background border border-sap-border text-sap-text text-[10px] font-bold">RESET</button>
             <button onClick={() => { fetchSavedLists(); setShowSavedLists(true); }} className="px-3 py-1 bg-sap-background border border-sap-border text-sap-secondary text-[10px] font-bold flex items-center gap-2"><FolderOpen size={12}/> HISTORY</button>
          </div>
          <div className="flex gap-2">
             <button onClick={() => window.print()} className="px-4 py-1 bg-sap-surface text-sap-text border border-sap-border text-[10px] font-bold flex items-center gap-2"><FileCheck2 size={12}/> PRINT</button>
             <button onClick={handleSave} disabled={isSaving} className="px-4 py-1 bg-sap-secondary text-white text-[10px] font-bold flex items-center gap-2 hover:bg-yellow-600">
                 {isSaving ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>} SAVE
             </button>
          </div>
      </div>

      {/* Editable Table */}
      <div className="bg-sap-surface border border-sap-border overflow-hidden shadow-inner">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs font-mono">
            <thead>
              <tr className="bg-sap-background text-sap-text-variant font-black uppercase text-[10px] border-b border-sap-border">
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3 w-32">SKU</th>
                <th className="p-3">DESCRIPTION</th>
                <th className="p-3 w-24 text-center">QTY</th>
                <th className="p-3 w-32">UOM</th>
                <th className="p-3 w-32">EXPIRY</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sap-border text-sap-text">
              {rows.map((row, idx) => (
                <tr key={row.id} className="hover:bg-sap-background group transition-colors">
                  <td className="p-3 text-center text-sap-text-variant">{idx + 1}</td>
                  
                  {/* Code */}
                  <td className="p-3 relative">
                    <input 
                      id={`code-${row.id}`} type="text" value={row.code} 
                      onKeyDown={(e) => handleSearchKeyDown(e, row.id, 'code')}
                      onChange={e => {
                        const val = e.target.value;
                        setRows(prev => prev.map(r => r.id === row.id ? { ...r, code: val } : r));
                        setActiveSearch({ rowId: row.id, field: 'code' });
                        setSearchTerm(val);
                      }}
                      className="w-full bg-transparent border-none p-1 focus:ring-0 font-bold text-sap-primary placeholder-sap-text-variant/30"
                      placeholder="SCAN..." autoComplete="off"
                    />
                    {activeSearch?.rowId === row.id && activeSearch.field === 'code' && filteredProducts.length > 0 && (
                      <div className="absolute top-full right-0 z-50 bg-sap-shell border border-sap-primary w-64 shadow-xl">
                          {filteredProducts.map((p, i) => (
                              <div key={p.id} onClick={() => selectProductForRow(row.id, p)} className={`p-2 cursor-pointer border-b border-sap-border/20 flex justify-between ${i === selectedIndex ? 'bg-sap-primary text-white' : 'hover:bg-sap-highlight/10 text-gray-300'}`}>
                                  <span className="font-bold">{p.code}</span><span className="text-[10px] opacity-70">{p.name}</span>
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
                      className="w-full bg-transparent border-none p-1 focus:ring-0 font-bold text-sap-text placeholder-sap-text-variant/30"
                      placeholder="SEARCH ITEM..." autoComplete="off"
                    />
                    {activeSearch?.rowId === row.id && activeSearch.field === 'name' && filteredProducts.length > 0 && (
                      <div className="absolute top-full right-0 z-50 bg-sap-shell border border-sap-primary w-full shadow-xl">
                          {filteredProducts.map((p, i) => (
                              <div key={p.id} onClick={() => selectProductForRow(row.id, p)} className={`p-2 cursor-pointer border-b border-sap-border/20 flex justify-between ${i === selectedIndex ? 'bg-sap-primary text-white' : 'hover:bg-sap-highlight/10 text-gray-300'}`}>
                                  <span className="font-bold">{p.name}</span><span className="text-[10px] opacity-70">{p.code}</span>
                              </div>
                          ))}
                      </div>
                    )}
                  </td>

                  {/* Qty */}
                  <td className="p-3">
                    <input id={`qty-${row.id}`} type="number" value={row.qty} onKeyDown={(e) => { if(e.key === 'Enter') focusNextField(e, row.id, 'qty') }} onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, qty: e.target.value === '' ? '' : Number(e.target.value) } : r))} className="w-full bg-transparent border-none p-1 focus:ring-0 text-center font-black text-sap-secondary placeholder-sap-text-variant/30" placeholder="0" />
                  </td>

                  {/* Unit */}
                  <td className="p-3">
                    <select id={`unit-${row.id}`} value={row.unitId} onKeyDown={(e) => { if(e.key === 'Enter') focusNextField(e, row.id, 'unit') }} onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, unitId: e.target.value } : r))} className="w-full bg-transparent border-none p-1 focus:ring-0 text-xs font-bold text-sap-text appearance-none cursor-pointer">
                      <option value="">-</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </td>

                  {/* Expiry */}
                  <td className="p-3 relative">
                    <input id={`expiry-${row.id}`} type="date" value={row.expiryDate} onKeyDown={(e) => { if(e.key === 'Enter') focusNextField(e, row.id, 'expiryDate') }} onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, expiryDate: e.target.value } : r))} className="w-full bg-transparent border-none p-1 focus:ring-0 text-xs font-mono text-sap-text" />
                    {getExpiryStatus(row.expiryDate).status !== 'normal' && <div className="absolute left-1 top-1/2 -translate-y-1/2 text-red-500"><AlertTriangle size={12} /></div>}
                  </td>

                  <td className="p-3 text-center">
                    <button onClick={() => setRows(prev => prev.filter(r => r.id !== row.id))} className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={7} className="p-0">
                  <button onClick={() => setRows(prev => [...prev, createEmptyRow()])} className="w-full py-3 bg-sap-background text-sap-primary font-bold text-[10px] hover:bg-sap-highlight/10 flex items-center justify-center gap-2 transition-all">
                    <Plus size={14} /> ADD ROW
                  </button>
                </td>
              </tr>
            </tbody>
            <tfoot className="bg-sap-shell text-sap-text-variant font-black border-t border-sap-border">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-left uppercase tracking-widest text-[10px]">TOTAL QUANTITY</td>
                <td className="px-4 py-3 text-center text-lg text-sap-secondary font-mono">{totalQty}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Loading Overlay */}
      {isScanning && (
          <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 animate-in fade-in">
              <div className="w-64 bg-sap-surface rounded-sm h-1 mb-6 overflow-hidden relative border border-sap-border">
                 <div className="h-full bg-sap-primary w-1/2 animate-[shimmer_1s_infinite_linear] absolute"></div> 
              </div>
              <h2 className="text-xl font-mono font-black text-sap-primary mb-2 blink">SYSTEM PROCESSING</h2>
              <p className="text-sap-text font-mono text-xs">{scanStep}</p>
          </div>
      )}

      {/* New Items Modal */}
      {showNewItemsModal && (
          <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-sap-surface w-full max-w-3xl border border-sap-primary shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-4 bg-sap-shell text-sap-text border-b border-sap-border flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-sap-highlight/10 text-sap-secondary border border-sap-secondary rounded-sm"><Sparkles size={16}/></div>
                          <div>
                              <h3 className="font-black text-sm font-mono text-sap-primary">NEW_ITEMS_DETECTED</h3>
                              <p className="text-[10px] text-sap-text-variant">FOUND {pendingProducts.length} UNREGISTERED SKUs</p>
                          </div>
                      </div>
                      <button onClick={() => setShowNewItemsModal(false)} className="text-sap-text-variant hover:text-white"><X size={18}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto bg-sap-background p-4 custom-scrollbar">
                      <div className="flex justify-between items-center mb-4">
                          <button onClick={() => { if (selectedPendingIds.size === pendingProducts.length) setSelectedPendingIds(new Set()); else setSelectedPendingIds(new Set(pendingProducts.map(p => p.id))); }} className="text-[10px] font-bold text-sap-primary hover:underline flex items-center gap-2">
                              {selectedPendingIds.size === pendingProducts.length ? <CheckSquare size={14}/> : <Square size={14}/>} 
                              TOGGLE ALL
                          </button>
                          <span className="text-[10px] font-bold text-sap-text-variant">SELECTED: {selectedPendingIds.size}</span>
                      </div>

                      <div className="space-y-2">
                          {pendingProducts.map(product => {
                              const isSelected = selectedPendingIds.has(product.id);
                              return (
                                  <div key={product.id} className={`p-3 border transition-all cursor-pointer flex items-center gap-4 ${isSelected ? 'bg-sap-highlight/10 border-sap-primary' : 'bg-sap-surface border-sap-border opacity-60'}`} onClick={() => { const newSet = new Set(selectedPendingIds); if (isSelected) newSet.delete(product.id); else newSet.add(product.id); setSelectedPendingIds(newSet); }}>
                                      <div className={`w-4 h-4 border flex items-center justify-center ${isSelected ? 'bg-sap-primary border-sap-primary text-sap-background' : 'bg-transparent border-sap-text-variant'}`}>
                                          {isSelected && <CheckCircle2 size={12}/>}
                                      </div>
                                      <div className="flex-1">
                                          <div className="font-black text-xs text-sap-text">{product.name}</div>
                                          <div className="text-[9px] font-mono text-sap-text-variant mt-0.5">SKU: {product.code}</div>
                                      </div>
                                      <div className="text-right">
                                          <div className="text-[9px] font-bold bg-sap-background px-2 py-1 border border-sap-border text-sap-text-variant">
                                              {units.find(u => u.id === product.unitId)?.name || 'DEFAULT'}
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>

                  <div className="p-4 bg-sap-shell border-t border-sap-border flex gap-2">
                      <button onClick={() => handleProcessNewItems('add_only')} className="flex-1 py-3 bg-sap-background border border-sap-border text-sap-text font-bold text-[10px] hover:text-white hover:border-sap-text-variant">
                          ADD TO DB ONLY
                      </button>
                      <button onClick={() => handleProcessNewItems('add_and_label')} className="flex-[2] py-3 bg-sap-primary text-sap-background font-black text-[10px] hover:bg-sap-primary-hover flex items-center justify-center gap-2">
                          <Tag size={14}/> ADD & GENERATE LABELS
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Saved Lists Modal */}
      {showSavedLists && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-sap-surface w-full max-w-xl border border-sap-primary shadow-2xl flex flex-col max-h-[80vh]">
                  <div className="p-4 bg-sap-shell text-white flex justify-between items-center border-b border-sap-border">
                      <h3 className="font-black text-xs font-mono flex items-center gap-2 text-sap-primary"><FolderOpen size={16}/> SAVED_DOCUMENTS</h3>
                      <button onClick={() => setShowSavedLists(false)} className="text-sap-text-variant hover:text-white"><X size={16}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto bg-sap-background custom-scrollbar p-2">
                      {isLoadingLists ? <div className="p-10 text-center animate-pulse font-mono text-xs text-sap-primary">LOADING DATA...</div> : (
                          <div className="space-y-1">
                              {savedLists.map((list) => (
                                  <div key={list.id} onClick={() => loadList(list)} className="p-3 border border-sap-border hover:border-sap-primary bg-sap-surface cursor-pointer flex justify-between items-center group">
                                      <div>
                                          <h4 className="font-black text-xs text-sap-text group-hover:text-sap-primary">{list.name}</h4>
                                          <div className="flex gap-3 text-[9px] font-mono text-sap-text-variant mt-1">
                                              <span>{list.date}</span>
                                              <span>{list.rows?.length || 0} ITEMS</span>
                                              <span className="text-sap-secondary">{list.type === 'inventory' ? 'STOCK' : 'RCPT'}</span>
                                          </div>
                                      </div>
                                      <Trash2 size={14} className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100" onClick={async (e) => { e.stopPropagation(); if(confirm('DELETE?')) { await db.lists.delete(list.id); fetchSavedLists(); } }} />
                                  </div>
                              ))}
                              {savedLists.length === 0 && <div className="p-10 text-center text-sap-text-variant italic font-mono text-xs">NO RECORDS FOUND</div>}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
