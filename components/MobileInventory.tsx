import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { db } from '../services/supabase';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Search, Camera, X, Check, Package, AlertTriangle, ArrowRight } from 'lucide-react';

interface MobileInventoryProps {
    products: Product[];
    onClose: () => void;
}

export const MobileInventory: React.FC<MobileInventoryProps> = ({ products, onClose }) => {
    const [scannedCode, setScannedCode] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [newStock, setNewStock] = useState<string>('');
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    // Filter products based on search
    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (p.code && p.code.includes(searchQuery))
    ).slice(0, 20); // Limit to 20 for performance on mobile

    useEffect(() => {
        if (scannedCode) {
            const product = products.find(p => p.code === scannedCode);
            if (product) {
                setSelectedProduct(product);
                setNewStock(product.stock?.toString() || '0');
                setIsScanning(false);
                if (scannerRef.current) {
                    scannerRef.current.clear().catch(console.error);
                }
            } else {
                alert('لم يتم العثور على منتج بهذا الباركود');
            }
        }
    }, [scannedCode, products]);

    const startScanner = () => {
        setIsScanning(true);
        setSelectedProduct(null);
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
                    (errorMessage) => {
                        // ignore errors as they happen constantly while scanning
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
            alert('الرجاء إدخال كمية صحيحة');
            return;
        }

        try {
            const updatedProduct = { ...selectedProduct, stock: stockValue };
            await db.products.upsert(updatedProduct);
            
            // Log activity
            await db.activityLogs.add({
                action: 'جرد مخزون (موبايل)',
                details: `تحديث مخزون ${selectedProduct.name} من ${selectedProduct.stock || 0} إلى ${stockValue}`,
                user: 'Admin', // Should pass current user
                type: 'info'
            });

            alert('تم تحديث المخزون بنجاح');
            setSelectedProduct(null);
            setScannedCode('');
        } catch (error) {
            console.error(error);
            alert('حدث خطأ أثناء تحديث المخزون');
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-50 z-[100] flex flex-col animate-in slide-in-from-bottom-full duration-300">
            {/* Header */}
            <div className="bg-sap-primary text-white p-4 flex items-center justify-between shadow-md shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <ArrowRight size={24} />
                    </button>
                    <h2 className="font-bold text-lg">الجرد السريع</h2>
                </div>
                {!isScanning && !selectedProduct && (
                    <button onClick={startScanner} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors flex items-center gap-2">
                        <Camera size={20} />
                        <span className="text-sm font-bold">مسح</span>
                    </button>
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
                        <div className="relative mb-6">
                            <input 
                                type="text"
                                placeholder="ابحث بالاسم أو الباركود..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-4 pr-12 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm text-lg focus:outline-none focus:ring-2 focus:ring-sap-primary focus:border-transparent"
                            />
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pb-20">
                            {searchQuery ? (
                                filteredProducts.length > 0 ? (
                                    filteredProducts.map(product => (
                                        <div 
                                            key={product.id}
                                            onClick={() => handleSelectProduct(product)}
                                            className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-[0.98] transition-transform"
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
                                    <div className="text-center py-10 text-gray-500">
                                        <AlertTriangle size={48} className="mx-auto mb-4 text-gray-300" />
                                        <p className="font-bold">لا توجد نتائج مطابقة</p>
                                    </div>
                                )
                            ) : (
                                <div className="text-center py-20 text-gray-400">
                                    <Package size={64} className="mx-auto mb-4 opacity-20" />
                                    <p className="font-bold text-lg mb-2">ابحث عن منتج للجرد</p>
                                    <p className="text-sm">أو استخدم الكاميرا لمسح الباركود</p>
                                    
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
