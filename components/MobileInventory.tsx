import React, { useState, useEffect, useRef } from 'react';
import { Product, Unit } from '../types';
import { db } from '../services/supabase';
import { useNotification } from './Notifications';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Search, Camera, Check, Package, AlertTriangle, ArrowRight, Plus, Barcode, Save, Loader2, X } from 'lucide-react';

interface MobileInventoryProps {
    products: Product[];
    setProducts?: React.Dispatch<React.SetStateAction<Product[]>>;
    units?: Unit[];
    onClose: () => void;
}

export const MobileInventory: React.FC<MobileInventoryProps> = ({ products, setProducts, units = [], onClose }) => {
    const { notify } = useNotification();
    const [scannedCode, setScannedCode] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMode, setSearchMode] = useState<'auto' | 'code'>('auto');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [newStock, setNewStock] = useState<string>('');
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    // Quick Add New Product to DB
    const [showNewProductForm, setShowNewProductForm] = useState(false);
    const [newProdCode, setNewProdCode] = useState('');
    const [newProdName, setNewProdName] = useState('');
    const [newProdPrice, setNewProdPrice] = useState('0');
    const [newProdUnitId, setNewProdUnitId] = useState(units[0]?.id || '');
    const [newProdStock, setNewProdStock] = useState('0');
    const [isSavingNew, setIsSavingNew] = useState(false);

    // Filter products: exact code matching only for codes
    const trimmedQuery = searchQuery.trim().toLowerCase();
    const filteredProducts = !trimmedQuery
        ? []
        : products.filter(p => {
            const pCode = (p.code || '').trim().toLowerCase();
            if (searchMode === 'code' || /^\d+$/.test(trimmedQuery)) {
                return pCode === trimmedQuery;
            }
            return pCode === trimmedQuery || p.name.toLowerCase().includes(trimmedQuery);
        }).slice(0, 20);

    const openNewProductCreator = (prefillCode = '', prefillName = '') => {
        setNewProdCode(prefillCode.trim());
        setNewProdName(prefillName.trim());
        setNewProdPrice('0');
        setNewProdUnitId(units[0]?.id || '');
        setNewProdStock('0');
        setShowNewProductForm(true);
    };

    useEffect(() => {
        if (scannedCode) {
            const cleanScanned = scannedCode.trim().toLowerCase();
            const product = products.find(p => (p.code || '').trim().toLowerCase() === cleanScanned);
            setIsScanning(false);
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error);
                scannerRef.current = null;
            }
            if (product) {
                setSelectedProduct(product);
                setNewStock(product.stock?.toString() || '0');
            } else {
                notify(`الباركود ${scannedCode} غير مسجل — يمكنك إضافته الآن كمنتج جديد`, 'info');
                openNewProductCreator(scannedCode, '');
            }
            setScannedCode('');
        }
    }, [scannedCode, products]);

    const startScanner = () => {
        setIsScanning(true);
        setSelectedProduct(null);
        setShowNewProductForm(false);
        setTimeout(() => {
            if (!scannerRef.current) {
                scannerRef.current = new Html5QrcodeScanner(
                    "reader",
                    { 
                        fps: 10, 
                        qrbox: { width: 250, height: 150 },
                        formatsToSupport: [
                            Html5QrcodeSupportedFormats.EAN_13,
                            Html5QrcodeSupportedFormats.EAN_8,
                            Html5QrcodeSupportedFormats.CODE_128,
                            Html5QrcodeSupportedFormats.CODE_39,
                            Html5QrcodeSupportedFormats.UPC_A,
                            Html5QrcodeSupportedFormats.UPC_E,
                            Html5QrcodeSupportedFormats.QR_CODE
                        ]
                    },
                    false
                );
                scannerRef.current.render(
                    (decodedText) => {
                        setScannedCode(decodedText);
                    },
                    () => {
                        // ignore frame errors while scanning
                    }
                );
            }
        }, 100);
    };

    const stopScanner = () => {
        if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
            scannerRef.current = null;
        }
        setIsScanning(false);
    };

    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error);
            }
        };
    }, []);

    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product);
        setNewStock(product.stock?.toString() || '0');
        setSearchQuery('');
    };

    const handleUpdateStock = async () => {
        if (!selectedProduct) return;
        
        const stockValue = parseFloat(newStock);
        if (isNaN(stockValue)) {
            notify('الرجاء إدخال كمية صحيحة', 'warning');
            return;
        }

        try {
            const updatedProduct = { ...selectedProduct, stock: stockValue };
            await db.products.upsert(updatedProduct);
            setProducts?.(prev => prev.map(p => (p.id === updatedProduct.id ? updatedProduct : p)));
            
            await db.activityLogs.add({
                action: 'جرد مخزون (موبايل)',
                details: `تحديث مخزون ${selectedProduct.name} من ${selectedProduct.stock || 0} إلى ${stockValue}`,
                user: 'Admin',
                type: 'info'
            });

            notify('تم تحديث المخزون بنجاح', 'success');
            setSelectedProduct(null);
            setScannedCode('');
        } catch (error) {
            console.error(error);
            notify('حدث خطأ أثناء تحديث المخزون', 'error');
        }
    };

    const handleCreateNewProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanCode = newProdCode.trim();
        const cleanName = newProdName.trim();
        if (!cleanCode || !cleanName) {
            notify('يرجى إدخال كود المنتج واسم المنتج', 'warning');
            return;
        }

        const existing = products.find(p => (p.code || '').trim().toLowerCase() === cleanCode.toLowerCase());
        if (existing) {
            notify(`الكود ${cleanCode} مسجل بالفعل باسم "${existing.name}"`, 'warning');
            setShowNewProductForm(false);
            handleSelectProduct(existing);
            return;
        }

        setIsSavingNew(true);
        try {
            const stockVal = parseFloat(newProdStock) || 0;
            const newProduct: Product = {
                id: crypto.randomUUID(),
                code: cleanCode,
                name: cleanName,
                unitId: newProdUnitId || units[0]?.id || '',
                price: newProdPrice.trim() || '0',
                stock: stockVal,
                color: '#ffffff',
            };
            await db.products.upsert(newProduct);
            setProducts?.(prev => [...prev, newProduct]);

            await db.activityLogs.add({
                action: 'إضافة منتج من الجرد',
                details: `تمت إضافة المنتج الجديد "${cleanName}" (${cleanCode}) برصيد ${stockVal}`,
                user: 'Admin',
                type: 'info'
            });

            notify(`تمت إضافة "${cleanName}" تلقائياً في قاعدة البيانات برصيد ${stockVal}`, 'success');
            setShowNewProductForm(false);
            setSearchQuery('');
        } catch (error) {
            console.error(error);
            notify('تعذر حفظ المنتج الجديد في قاعدة البيانات', 'error');
        } finally {
            setIsSavingNew(false);
        }
    };

    return (
        <div className="absolute inset-0 bg-gray-50 z-[100] flex flex-col animate-in slide-in-from-bottom-full duration-300" dir="rtl">
            {/* Header */}
            <div className="bg-sap-primary text-white p-4 flex items-center justify-between shadow-md shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <ArrowRight size={24} />
                    </button>
                    <h2 className="font-bold text-lg">الجرد السريع</h2>
                </div>
                {!isScanning && !selectedProduct && !showNewProductForm && (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => openNewProductCreator(/^\d+$/.test(trimmedQuery) ? searchQuery.trim() : '', !/^\d+$/.test(trimmedQuery) ? searchQuery.trim() : '')}
                            className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-full transition-colors flex items-center gap-1.5 text-xs font-bold"
                        >
                            <Plus size={16} />
                            <span>منتج جديد</span>
                        </button>
                        <button onClick={startScanner} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors flex items-center gap-2">
                            <Camera size={20} />
                            <span className="text-sm font-bold">مسح</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto flex flex-col">
                {isScanning ? (
                    <div className="flex-1 flex flex-col bg-black">
                        <div id="reader" className="w-full flex-1"></div>
                        <div className="p-6 pb-10 bg-black text-center shrink-0">
                            <p className="text-white mb-4 font-bold">وجه الكاميرا نحو الباركود</p>
                            <button 
                                onClick={stopScanner}
                                className="px-8 py-3 bg-red-500 text-white rounded-full font-bold shadow-lg"
                            >
                                إلغاء المسح
                            </button>
                        </div>
                    </div>
                ) : showNewProductForm ? (
                    <form onSubmit={handleCreateNewProduct} className="p-6 flex-1 flex flex-col max-w-lg w-full mx-auto">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
                            <div className="flex items-center justify-between border-b pb-3">
                                <div>
                                    <h3 className="font-black text-base text-gray-800">إضافة منتج جديد في الجرد</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">سيُحفظ تلقائياً كمنتج جديد في قاعدة البيانات</p>
                                </div>
                                <button type="button" onClick={() => setShowNewProductForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600">
                                    <X size={20} />
                                </button>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">كود المنتج / الباركود *</label>
                                <input
                                    type="text"
                                    required
                                    value={newProdCode}
                                    onChange={(e) => setNewProdCode(e.target.value)}
                                    placeholder="أدخل الكود أو الباركود..."
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-mono font-bold focus:border-sap-primary outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">اسم المنتج *</label>
                                <input
                                    type="text"
                                    required
                                    value={newProdName}
                                    onChange={(e) => setNewProdName(e.target.value)}
                                    placeholder="أدخل اسم المنتج..."
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-bold focus:border-sap-primary outline-none"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">الكمية الفعلية (الجرد)</label>
                                    <input
                                        type="number"
                                        value={newProdStock}
                                        onChange={(e) => setNewProdStock(e.target.value)}
                                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-mono font-black text-center focus:border-sap-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">سعر البيع</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newProdPrice}
                                        onChange={(e) => setNewProdPrice(e.target.value)}
                                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-mono font-bold text-center focus:border-sap-primary outline-none"
                                    />
                                </div>
                            </div>

                            {units.length > 0 && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">الوحدة</label>
                                    <select
                                        value={newProdUnitId}
                                        onChange={(e) => setNewProdUnitId(e.target.value)}
                                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-bold bg-white focus:border-sap-primary outline-none"
                                    >
                                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowNewProductForm(false)}
                                className="flex-1 py-3.5 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300"
                            >
                                إلغاء
                            </button>
                            <button
                                type="submit"
                                disabled={isSavingNew}
                                className="flex-[2] py-3.5 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSavingNew ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                <span>حفظ كمنتج جديد في القاعدة</span>
                            </button>
                        </div>
                    </form>
                ) : selectedProduct ? (
                    <div className="p-6 flex-1 flex flex-col">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="font-black text-xl text-gray-800 mb-1">{selectedProduct.name}</h3>
                                    <p className="text-gray-500 font-mono text-sm">{selectedProduct.code}</p>
                                </div>
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                    <Package size={24} />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <p className="text-xs text-gray-500 font-bold mb-1">السعر</p>
                                    <p className="font-black text-lg">{selectedProduct.price} SAR</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <p className="text-xs text-gray-500 font-bold mb-1">المخزون الحالي</p>
                                    <p className="font-black text-lg text-blue-600">{selectedProduct.stock || 0}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700">الكمية الفعلية (الجرد)</label>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setNewStock(String(Math.max(0, parseFloat(newStock || '0') - 1)))}
                                        className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-xl text-xl font-bold hover:bg-gray-200"
                                    >-</button>
                                    <input 
                                        type="number" 
                                        value={newStock}
                                        onChange={(e) => setNewStock(e.target.value)}
                                        className="flex-1 h-12 text-center text-2xl font-black border-2 border-sap-primary rounded-xl focus:outline-none"
                                    />
                                    <button 
                                        onClick={() => setNewStock(String(parseFloat(newStock || '0') + 1))}
                                        className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-xl text-xl font-bold hover:bg-gray-200"
                                    >+</button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto flex gap-3 pb-6">
                            <button 
                                onClick={() => setSelectedProduct(null)}
                                className="flex-1 py-4 bg-gray-200 text-gray-700 rounded-xl font-bold text-lg hover:bg-gray-300 transition-colors"
                            >
                                إلغاء
                            </button>
                            <button 
                                onClick={handleUpdateStock}
                                className="flex-[2] py-4 bg-sap-primary text-white rounded-xl font-bold text-lg hover:bg-sap-primary-hover transition-colors shadow-lg flex items-center justify-center gap-2"
                            >
                                <Check size={24} /> حفظ الجرد
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 flex-1 flex flex-col">
                        <div className="relative mb-3">
                            <input 
                                type="text"
                                placeholder={searchMode === 'code' ? 'اكتب كود المنتج المطابق تماماً...' : 'ابحث بالاسم أو بكود المنتج المطابق...'}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-4 pr-12 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm text-lg focus:outline-none focus:ring-2 focus:ring-sap-primary focus:border-transparent"
                            />
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
                        </div>

                        <div className="flex items-center gap-2 mb-5">
                            <button
                                type="button"
                                onClick={() => setSearchMode('auto')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${searchMode === 'auto' ? 'bg-sap-primary text-white border-sap-primary' : 'bg-white text-gray-600 border-gray-200'}`}
                            >
                                ذكي (الاسم + الكود المطابق)
                            </button>
                            <button
                                type="button"
                                onClick={() => setSearchMode('code')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors ${searchMode === 'code' ? 'bg-sap-primary text-white border-sap-primary' : 'bg-white text-gray-600 border-gray-200'}`}
                            >
                                <Barcode size={14} />
                                <span>بكود المنتج فقط (نفس الرقم)</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pb-20">
                            {trimmedQuery ? (
                                filteredProducts.length > 0 ? (
                                    filteredProducts.map(product => (
                                        <div 
                                            key={product.id}
                                            onClick={() => handleSelectProduct(product)}
                                            className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer"
                                        >
                                            <div>
                                                <h4 className="font-bold text-gray-800">{product.name}</h4>
                                                <p className="text-sm text-gray-500 font-mono mt-1">{product.code}</p>
                                            </div>
                                            <div className="text-left">
                                                <span className="block text-xs text-gray-400 mb-1">المخزون</span>
                                                <span className={`font-black text-lg ${product.stock && product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {product.stock || 0}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-gray-500 space-y-4">
                                        <AlertTriangle size={48} className="mx-auto text-gray-300" />
                                        <p className="font-bold">لا توجد نتائج مطابقة لـ "{searchQuery.trim()}"</p>
                                        <button
                                            type="button"
                                            onClick={() => openNewProductCreator(
                                                searchMode === 'code' || /^\d+$/.test(trimmedQuery) ? searchQuery.trim() : '',
                                                searchMode !== 'code' && !/^\d+$/.test(trimmedQuery) ? searchQuery.trim() : ''
                                            )}
                                            className="mx-auto inline-flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors"
                                        >
                                            <Plus size={18} />
                                            <span>إضافة "{searchQuery.trim()}" كمنتج جديد في قاعدة البيانات</span>
                                        </button>
                                    </div>
                                )
                            ) : (
                                <div className="text-center py-20 text-gray-400">
                                    <Package size={64} className="mx-auto mb-4 opacity-20" />
                                    <p className="font-bold text-lg mb-2">ابحث عن منتج للجرد</p>
                                    <p className="text-sm">عند البحث بكود المنتج يظهر الصنف المطابق لنفس الرقم فقط</p>
                                    
                                    <button 
                                        onClick={startScanner}
                                        className="mt-8 mx-auto flex items-center gap-3 px-8 py-4 bg-sap-primary text-white rounded-full font-bold shadow-lg hover:bg-sap-primary-hover transition-colors"
                                    >
                                        <Camera size={24} />
                                        مسح باركود
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
