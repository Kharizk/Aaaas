import React, { useRef, useState } from 'react';
import { Product } from '../types';
import Barcode from 'react-barcode';
import { Printer, X, CheckSquare, Square } from 'lucide-react';

interface BarcodePrinterProps {
  products: Product[];
  onClose: () => void;
  isClearance?: boolean; // New prop for yellow clearance labels
}

export const BarcodePrinter: React.FC<BarcodePrinterProps> = ({ products, onClose, isClearance }) => {
  const printRef = useRef<HTMLDivElement>(null);
  
  // Track which items are selected by index
  const [selectedIndices, setSelectedIndices] = useState<Record<number, boolean>>(() => 
    Object.fromEntries(products.map((_, idx) => [idx, true]))
  );

  const selectedCount = Object.values(selectedIndices).filter(Boolean).length;

  const toggleSelect = (idx: number) => {
    setSelectedIndices(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    if (selectedCount === 0) {
      alert('يرجى تحديد ملصق واحد على الأقل للطباعة.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print barcodes.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcodes</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              display: flex;
              flex-wrap: wrap;
              gap: 20px;
              justify-content: center;
            }
            .barcode-label {
              border: 1px dashed #ccc;
              padding: 10px;
              text-align: center;
              width: 200px;
              page-break-inside: avoid;
              ${isClearance ? 'background-color: #fef08a; border: 2px solid #eab308;' : ''}
            }
            .clearance-badge {
              background-color: #ef4444;
              color: white;
              font-size: 10px;
              font-weight: bold;
              padding: 2px 6px;
              border-radius: 4px;
              display: inline-block;
              margin-bottom: 4px;
            }
            .product-name {
              font-size: 12px;
              font-weight: bold;
              margin-bottom: 5px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .product-price {
              font-size: 16px;
              font-weight: bold;
              margin-top: 5px;
              color: ${isClearance ? '#ef4444' : '#000'};
            }
            .original-price {
              font-size: 10px;
              text-decoration: line-through;
              color: #6b7280;
              margin-right: 4px;
            }
            @media print {
              body { padding: 0; }
              .barcode-label { border: none; ${isClearance ? '-webkit-print-color-adjust: exact; print-color-adjust: exact;' : ''} }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    // Wait for images/svgs to render
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className={`p-4 border-b border-gray-100 flex justify-between items-center rounded-t-2xl ${isClearance ? 'bg-amber-100 text-amber-900' : 'bg-gray-50'}`}>
          <h3 className="font-black text-lg flex items-center gap-2">
            <Printer size={20} /> {isClearance ? 'طباعة ملصقات التصفية (الصفراء)' : 'طباعة ملصقات الباركود'}
          </h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrint}
              disabled={selectedCount === 0}
              className={`px-4 py-2 text-white rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
                selectedCount === 0 
                  ? 'bg-gray-300 cursor-not-allowed opacity-50' 
                  : isClearance 
                    ? 'bg-amber-600 hover:bg-amber-700 active:scale-95' 
                    : 'bg-sap-primary hover:bg-sap-primary-hover active:scale-95'
              }`}
            >
              <Printer size={16} /> طباعة ({selectedCount})
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Selection Controller Toolbar */}
        <div className="bg-gray-50 border-b border-gray-100 px-6 py-3 flex flex-wrap gap-4 justify-between items-center text-sm font-semibold text-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium">حالة التحديد:</span>
            <span className="bg-sap-primary/10 text-sap-primary px-3 py-1 rounded-full text-xs font-bold">
              تم تحديد {selectedCount} من {products.length} ملصق
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const updated: Record<number, boolean> = {};
                products.forEach((_, idx) => {
                  updated[idx] = true;
                });
                setSelectedIndices(updated);
              }}
              className="px-3 py-1.5 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-bold transition-all text-gray-800"
            >
              تحديد الكل
            </button>
            <button
              onClick={() => {
                const updated: Record<number, boolean> = {};
                products.forEach((_, idx) => {
                  updated[idx] = false;
                });
                setSelectedIndices(updated);
              }}
              className="px-3 py-1.5 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-bold transition-all text-gray-500 hover:text-red-600"
            >
              إلغاء تحديد الكل
            </button>
          </div>
        </div>
        
        {/* Interactive Preview Panel */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
          <div 
            className="p-4 min-h-full flex flex-wrap gap-4 justify-center"
          >
            {products.map((product, idx) => {
              const isSelected = !!selectedIndices[idx];
              return (
                <div 
                  key={`${product.id}-${idx}`} 
                  onClick={() => toggleSelect(idx)}
                  className={`relative cursor-pointer transition-all duration-200 select-none bg-white border-2 hover:scale-102 flex flex-col items-center justify-between shadow-md ${
                    isSelected 
                      ? 'border-sap-primary ring-4 ring-sap-primary/10' 
                      : 'border-transparent opacity-45 scale-95 hover:opacity-75'
                  }`}
                  style={{
                    padding: '24px 16px 12px 16px',
                    width: '200px',
                    borderRadius: '12px',
                    minHeight: '170px'
                  }}
                >
                  {/* Custom Circular Dot Indicator */}
                  <div className="absolute top-2.5 right-2.5 transition-transform duration-200">
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white text-white flex items-center justify-center shadow-md animate-in zoom-in-50 duration-150 ring-2 ring-emerald-500/30">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-gray-300 bg-white hover:border-gray-400 flex items-center justify-center transition-all duration-150 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-gray-200" />
                      </div>
                    )}
                  </div>

                  {isClearance && (
                    <div className="bg-red-500 text-white font-black rounded text-[9px] py-0.5 px-2 mb-2 inline-block">
                      تصفية CLEARANCE
                    </div>
                  )}
                  
                  <div className="product-name font-bold text-xs text-center w-full truncate text-gray-900 px-1 mb-1" title={product.name}>
                    {product.name}
                  </div>
                  
                  <div className="flex justify-center items-center py-1 bg-white rounded p-1">
                    <Barcode 
                      value={product.code || '0000000000'} 
                      width={1.2} 
                      height={35} 
                      fontSize={11}
                      margin={0}
                      displayValue={true}
                      background="#ffffff"
                    />
                  </div>

                  <div className="product-price font-black text-sm text-gray-900 mt-2 text-center">
                    {isClearance && product.originalPrice && (
                      <span className="original-price line-through text-[10px] text-gray-400 mr-1.5">
                        {parseFloat(product.originalPrice).toLocaleString()} SAR
                      </span>
                    )}
                    {parseFloat(product.price || '0').toLocaleString()} SAR
                  </div>
                </div>
              );
            })}
            
            {products.length === 0 && (
              <div className="w-full text-center py-20 text-gray-400 font-bold">
                لا توجد منتجات لطباعة الباركود الخاص بها
              </div>
            )}
          </div>
        </div>

        {/* Hidden Container with ONLY Selected Items for Printing */}
        <div ref={printRef} style={{ display: 'none' }}>
          {products.map((product, idx) => {
            if (!selectedIndices[idx]) return null;
            return (
              <div key={`print-${product.id}-${idx}`} className={`barcode-label ${isClearance ? 'bg-yellow-200 border-2 border-yellow-500' : ''}`}>
                {isClearance && <div className="clearance-badge">تصفية CLEARANCE</div>}
                <div className="product-name">{product.name}</div>
                <Barcode 
                  value={product.code || '0000000000'} 
                  width={1.5} 
                  height={40} 
                  fontSize={12}
                  margin={0}
                  displayValue={true}
                  background={isClearance ? '#fef08a' : '#ffffff'}
                />
                <div className="product-price">
                  {isClearance && product.originalPrice && (
                    <span className="original-price">{parseFloat(product.originalPrice).toLocaleString()} SAR</span>
                  )}
                  {parseFloat(product.price || '0').toLocaleString()} SAR
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
