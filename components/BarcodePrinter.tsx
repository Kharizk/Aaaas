import React, { useRef } from 'react';
import { Product } from '../types';
import Barcode from 'react-barcode';
import { Printer, X } from 'lucide-react';

interface BarcodePrinterProps {
  products: Product[];
  onClose: () => void;
}

export const BarcodePrinter: React.FC<BarcodePrinterProps> = ({ products, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

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
              font-size: 14px;
              font-weight: bold;
              margin-top: 5px;
            }
            @media print {
              body { padding: 0; }
              .barcode-label { border: none; }
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
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
          <h3 className="font-black text-lg flex items-center gap-2">
            <Printer size={20} /> طباعة ملصقات الباركود
          </h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrint}
              className="px-4 py-2 bg-sap-primary text-white rounded-lg font-bold text-sm hover:bg-sap-primary-hover flex items-center gap-2"
            >
              <Printer size={16} /> طباعة
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
          <div 
            ref={printRef} 
            className="bg-white p-8 rounded-xl shadow-sm min-h-full flex flex-wrap gap-4 justify-center"
          >
            {products.map((product, idx) => (
              <div key={`${product.id}-${idx}`} className="barcode-label">
                <div className="product-name">{product.name}</div>
                <Barcode 
                  value={product.code || '0000000000'} 
                  width={1.5} 
                  height={40} 
                  fontSize={12}
                  margin={0}
                  displayValue={true}
                />
                <div className="product-price">{parseFloat(product.price || '0').toLocaleString()} SAR</div>
              </div>
            ))}
            {products.length === 0 && (
              <div className="w-full text-center py-20 text-gray-400 font-bold">
                لا توجد منتجات لطباعة الباركود الخاص بها
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
