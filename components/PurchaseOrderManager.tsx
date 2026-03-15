import React, { useState, useEffect } from 'react';
import { PurchaseOrder, Supplier, Product } from '../types';
import { db } from '../services/supabase';
import { Plus, Trash2, Save, ShoppingBag, Calendar, User, Package, CheckCircle2, XCircle, FileText, Printer, Search, Filter, ArrowRight, Loader2 } from 'lucide-react';
import { ReportLayout } from './ReportLayout';
import { useNotification } from './Notifications';

export const PurchaseOrderManager: React.FC = () => {
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [showModal, setShowModal] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
    const [orderItems, setOrderItems] = useState<{productId: string, quantity: number, costPrice: number}[]>([]);
    const [currentProduct, setCurrentProduct] = useState('');
    const [currentQty, setCurrentQty] = useState(1);
    const [currentCost, setCurrentCost] = useState(0);
    const [notes, setNotes] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const [printOrder, setPrintOrder] = useState<PurchaseOrder | null>(null);
    const { notify } = useNotification();

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [fetchedOrders, fetchedSuppliers, fetchedProducts] = await Promise.all([
                db.purchaseOrders.getAll(),
                db.suppliers.getAll(),
                db.products.getAll()
            ]);
            setOrders(fetchedOrders);
            setSuppliers(fetchedSuppliers);
            setProducts(fetchedProducts as Product[]);
        } catch (error) {
            console.error("Error loading data:", error);
            notify('فشل تحميل البيانات', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleAddItem = () => {
        if (!currentProduct || currentQty <= 0) return;
        const prod = products.find(p => p.id === currentProduct);
        if (!prod) return;

        // Check if product already exists in items
        const existingItemIndex = orderItems.findIndex(item => item.productId === currentProduct);
        if (existingItemIndex >= 0) {
             const updatedItems = [...orderItems];
             updatedItems[existingItemIndex].quantity += currentQty;
             // Optionally update cost if needed, or keep existing
             setOrderItems(updatedItems);
        } else {
            setOrderItems(prev => [...prev, {
                productId: currentProduct,
                quantity: currentQty,
                costPrice: currentCost || Number(prod.costPrice || 0)
            }]);
        }
        
        setCurrentProduct('');
        setCurrentQty(1);
        setCurrentCost(0);
    };

    const handleRemoveItem = (index: number) => {
        setOrderItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveOrder = async () => {
        if (!selectedSupplier || orderItems.length === 0) {
            notify('الرجاء اختيار مورد وإضافة منتجات', 'error');
            return;
        }

        const totalAmount = orderItems.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);

        const newOrder: PurchaseOrder = {
            id: crypto.randomUUID(),
            supplierId: selectedSupplier,
            date: orderDate,
            status: 'pending',
            totalAmount,
            items: orderItems,
            notes
        };

        try {
            await db.purchaseOrders.upsert(newOrder);
            setOrders(prev => [newOrder, ...prev]);
            notify('تم حفظ أمر الشراء بنجاح', 'success');
            setShowModal(false);
            resetForm();
        } catch (error) {
            console.error("Error saving order:", error);
            notify('فشل حفظ أمر الشراء', 'error');
        }
    };

    const handleDeleteOrder = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا الأمر؟')) return;
        try {
            await db.purchaseOrders.delete(id);
            setOrders(prev => prev.filter(o => o.id !== id));
            notify('تم حذف الأمر بنجاح', 'success');
        } catch (error) {
            console.error("Error deleting order:", error);
            notify('فشل حذف الأمر', 'error');
        }
    };

    const handleUpdateStatus = async (order: PurchaseOrder, newStatus: 'pending' | 'received' | 'cancelled') => {
        try {
            // 1. Update Order Status
            const updatedOrder = { ...order, status: newStatus };
            await db.purchaseOrders.upsert(updatedOrder);
            setOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));
            
            // 2. Handle Stock & Supplier Balance
            // Case A: Marking as Received (Add Stock, Add Debt)
            if (newStatus === 'received' && order.status !== 'received') {
                for (const item of order.items) {
                    const product = products.find(p => p.id === item.productId);
                    if (product) {
                        const newStock = (product.stock || 0) + item.quantity;
                        const updatedProduct = { ...product, stock: newStock, costPrice: item.costPrice.toString() };
                        await db.products.upsert(updatedProduct);
                    }
                }

                // Create Supplier Transaction (Bill)
                const transaction: any = {
                    id: crypto.randomUUID(),
                    supplierId: order.supplierId,
                    date: new Date().toISOString(),
                    type: 'bill',
                    amount: order.totalAmount,
                    reference: `PO-${order.id.slice(0, 8)}`,
                    notes: 'Generated automatically from Purchase Order'
                };
                await db.supplierTransactions.upsert(transaction);

                // Update Supplier Balance (Increase Debt)
                const supplier = suppliers.find(s => s.id === order.supplierId);
                if (supplier) {
                    const newBalance = (supplier.balance || 0) + order.totalAmount;
                    await db.suppliers.upsert({ ...supplier, balance: newBalance });
                    setSuppliers(prev => prev.map(s => s.id === supplier.id ? { ...s, balance: newBalance } : s));
                }
                
                notify('تم استلام الطلب وتحديث المخزون وحساب المورد', 'success');
            } 
            // Case B: Reverting from Received (Remove Stock, Reduce Debt)
            else if (order.status === 'received' && newStatus !== 'received') {
                for (const item of order.items) {
                    const product = products.find(p => p.id === item.productId);
                    if (product) {
                        const newStock = Math.max(0, (product.stock || 0) - item.quantity);
                        await db.products.upsert({ ...product, stock: newStock });
                    }
                }

                // Revert Supplier Balance (Reduce Debt)
                const supplier = suppliers.find(s => s.id === order.supplierId);
                if (supplier) {
                    const newBalance = (supplier.balance || 0) - order.totalAmount;
                    await db.suppliers.upsert({ ...supplier, balance: newBalance });
                    setSuppliers(prev => prev.map(s => s.id === supplier.id ? { ...s, balance: newBalance } : s));
                }

                // Create Reversal Transaction
                const transaction: any = {
                    id: crypto.randomUUID(),
                    supplierId: order.supplierId,
                    date: new Date().toISOString(),
                    type: 'payment', // Reduces balance
                    amount: order.totalAmount,
                    reference: `REV-PO-${order.id.slice(0, 8)}`,
                    notes: `Reversal of PO due to status change to ${newStatus}`
                };
                await db.supplierTransactions.upsert(transaction);
                
                notify('تم إلغاء استلام الطلب وتصحيح المخزون وحساب المورد', 'warning');
            } else {
                notify('تم تحديث حالة الطلب', 'success');
            }

            // 3. Refresh Products to reflect stock changes
            const updatedProducts = await db.products.getAll();
            setProducts(updatedProducts as Product[]);

        } catch (error) {
            console.error("Error updating status:", error);
            notify('فشل تحديث الحالة', 'error');
        }
    };

    const resetForm = () => {
        setSelectedSupplier('');
        setOrderItems([]);
        setNotes('');
        setOrderDate(new Date().toISOString().split('T')[0]);
    };

    const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || 'مورد غير معروف';
    const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'منتج غير معروف';

    const handlePrint = (order: PurchaseOrder) => {
        setPrintOrder(order);
        setTimeout(() => {
            const afterPrint = () => {
                setPrintOrder(null);
                window.removeEventListener('afterprint', afterPrint);
            };
            window.addEventListener('afterprint', afterPrint);
            window.print();
        }, 100);
    };

    const filteredOrders = orders.filter(order => {
        const supplierName = getSupplierName(order.supplierId).toLowerCase();
        const idMatch = order.id.toLowerCase().includes(searchQuery.toLowerCase());
        return supplierName.includes(searchQuery.toLowerCase()) || idMatch;
    });

    const printContainer = document.getElementById('print-container');
    const printContent = printOrder ? (
        <div className="bg-white z-[9999] overflow-auto print:static print:h-auto print:overflow-visible">
            <ReportLayout printOnly={true} title={`أمر شراء #${printOrder.id.slice(0, 8)}`} subtitle={`المورد: ${getSupplierName(printOrder.supplierId)}`}>
                <div className="space-y-6">
                    <div className="flex justify-between text-sm font-bold border-b pb-4">
                        <div>
                            <div className="text-gray-500">تاريخ الطلب</div>
                            <div>{printOrder.date}</div>
                        </div>
                        <div>
                            <div className="text-gray-500">الحالة</div>
                            <div>{printOrder.status === 'pending' ? 'قيد الانتظار' : printOrder.status === 'received' ? 'تم الاستلام' : 'ملغي'}</div>
                        </div>
                    </div>

                    <table className="w-full text-right border-collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="p-2 border">المنتج</th>
                                <th className="p-2 border">الكمية</th>
                                <th className="p-2 border">سعر التكلفة</th>
                                <th className="p-2 border">الإجمالي</th>
                            </tr>
                        </thead>
                        <tbody>
                            {printOrder.items.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="p-2 border">{getProductName(item.productId)}</td>
                                    <td className="p-2 border">{item.quantity}</td>
                                    <td className="p-2 border">{item.costPrice}</td>
                                    <td className="p-2 border">{(item.quantity * item.costPrice).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-50 font-black">
                                <td colSpan={3} className="p-2 border text-left">الإجمالي الكلي</td>
                                <td className="p-2 border">{printOrder.totalAmount.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>

                    {printOrder.notes && (
                        <div className="border p-4 rounded bg-gray-50 text-sm">
                            <strong>ملاحظات:</strong> {printOrder.notes}
                        </div>
                    )}
                </div>
            </ReportLayout>
        </div>
    ) : null;

    return (
        <>
        {printOrder && printContainer && createPortal(printContent, printContainer)}
        <div className="h-full flex flex-col gap-6 animate-in fade-in p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 flex items-center gap-3">
                        <ShoppingBag className="text-sap-primary" size={32} />
                        أوامر الشراء
                    </h1>
                    <p className="text-gray-500 font-medium mt-1">إدارة طلبات التوريد والمشتريات</p>
                </div>
                <button 
                    onClick={() => setShowModal(true)}
                    className="bg-sap-primary text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 hover:bg-sap-secondary transition-colors shadow-lg active:scale-95"
                >
                    <Plus size={20} />
                    أمر شراء جديد
                </button>
            </div>

            {/* Search and Filter Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="بحث برقم الطلب أو اسم المورد..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pr-10 pl-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary transition-all"
                    />
                </div>
                {/* Add more filters here if needed */}
            </div>

            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center flex-col gap-4">
                        <Loader2 className="animate-spin text-sap-primary" size={48} />
                        <p className="text-gray-500 font-bold">جاري تحميل البيانات...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-right">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 text-gray-500 font-black text-xs uppercase tracking-wider">رقم الطلب</th>
                                    <th className="p-4 text-gray-500 font-black text-xs uppercase tracking-wider">المورد</th>
                                    <th className="p-4 text-gray-500 font-black text-xs uppercase tracking-wider">التاريخ</th>
                                    <th className="p-4 text-gray-500 font-black text-xs uppercase tracking-wider">الإجمالي</th>
                                    <th className="p-4 text-gray-500 font-black text-xs uppercase tracking-wider">الحالة</th>
                                    <th className="p-4 text-gray-500 font-black text-xs uppercase tracking-wider text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="p-4 font-mono font-bold text-gray-600">#{order.id.slice(0, 8)}</td>
                                        <td className="p-4 font-bold text-gray-800">{getSupplierName(order.supplierId)}</td>
                                        <td className="p-4 text-sm font-medium text-gray-500">{order.date}</td>
                                        <td className="p-4 font-black text-sap-primary">{order.totalAmount.toLocaleString()} ريال</td>
                                        <td className="p-4">
                                            <select 
                                                value={order.status}
                                                onChange={(e) => handleUpdateStatus(order, e.target.value as any)}
                                                className={`px-3 py-1 rounded-full text-xs font-black border-none outline-none cursor-pointer appearance-none ${
                                                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                    order.status === 'received' ? 'bg-green-100 text-green-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}
                                                disabled={order.status === 'received' || order.status === 'cancelled'}
                                            >
                                                <option value="pending">قيد الانتظار</option>
                                                <option value="received">تم الاستلام</option>
                                                <option value="cancelled">ملغي</option>
                                            </select>
                                        </td>
                                        <td className="p-4 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handlePrint(order)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="طباعة">
                                                <Printer size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteOrder(order.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="حذف">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredOrders.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-gray-400">
                                            <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
                                            <p className="font-bold">لا توجد أوامر شراء مطابقة للبحث</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* New Order Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
                    <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
                            <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                <Plus className="text-sap-primary" />
                                إنشاء أمر شراء جديد
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                                <XCircle size={24} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-500 uppercase">المورد <span className="text-red-500">*</span></label>
                                    <select 
                                        value={selectedSupplier} 
                                        onChange={e => setSelectedSupplier(e.target.value)}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary outline-none transition-all"
                                    >
                                        <option value="">اختر المورد...</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-500 uppercase">تاريخ الطلب</label>
                                    <input 
                                        type="date" 
                                        value={orderDate}
                                        onChange={e => setOrderDate(e.target.value)}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-4 shadow-inner">
                                <h3 className="font-black text-gray-700 text-sm flex items-center gap-2">
                                    <Package size={18} className="text-sap-primary" /> إضافة منتجات
                                </h3>
                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                    <div className="flex-1 space-y-1 w-full">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">المنتج</label>
                                        <select 
                                            value={currentProduct} 
                                            onChange={e => {
                                                setCurrentProduct(e.target.value);
                                                const p = products.find(x => x.id === e.target.value);
                                                if (p) setCurrentCost(Number(p.costPrice || 0));
                                            }}
                                            className="w-full p-3 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary outline-none"
                                        >
                                            <option value="">اختر المنتج...</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="w-full md:w-32 space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">الكمية</label>
                                        <input 
                                            type="number" 
                                            value={currentQty} 
                                            onChange={e => setCurrentQty(Number(e.target.value))}
                                            className="w-full p-3 border border-gray-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary outline-none"
                                            min="1"
                                        />
                                    </div>
                                    <div className="w-full md:w-40 space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">سعر التكلفة</label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                value={currentCost} 
                                                onChange={e => setCurrentCost(Number(e.target.value))}
                                                className="w-full p-3 border border-gray-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary outline-none"
                                                min="0" step="0.01"
                                            />
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">ريال</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleAddItem}
                                        className="w-full md:w-auto bg-gray-900 text-white p-3 rounded-xl hover:bg-black transition-colors shadow-lg flex items-center justify-center"
                                        title="إضافة للقائمة"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-right text-sm">
                                    <thead className="bg-gray-100 text-gray-600 font-bold">
                                        <tr>
                                            <th className="p-4">المنتج</th>
                                            <th className="p-4">الكمية</th>
                                            <th className="p-4">التكلفة</th>
                                            <th className="p-4">الإجمالي</th>
                                            <th className="p-4 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {orderItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-4 font-bold text-gray-800">{getProductName(item.productId)}</td>
                                                <td className="p-4 font-mono">{item.quantity}</td>
                                                <td className="p-4 font-mono">{item.costPrice}</td>
                                                <td className="p-4 font-black text-sap-primary font-mono">{(item.quantity * item.costPrice).toFixed(2)}</td>
                                                <td className="p-4 text-center">
                                                    <button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600 transition-colors p-1 hover:bg-red-50 rounded-lg">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {orderItems.length === 0 && (
                                            <tr><td colSpan={5} className="p-8 text-center text-gray-400 text-sm font-medium">لم يتم إضافة منتجات بعد</td></tr>
                                        )}
                                    </tbody>
                                    <tfoot className="bg-gray-50 font-black border-t border-gray-200">
                                        <tr>
                                            <td colSpan={3} className="p-4 text-left text-gray-600">الإجمالي الكلي</td>
                                            <td colSpan={2} className="p-4 text-xl text-sap-primary font-mono">
                                                {orderItems.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0).toFixed(2)} <span className="text-xs">ريال</span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-500 uppercase">ملاحظات</label>
                                <textarea 
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm h-24 resize-none focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary outline-none transition-all"
                                    placeholder="أي ملاحظات إضافية..."
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t bg-gray-50 flex justify-end gap-4">
                            <button 
                                onClick={() => setShowModal(false)}
                                className="px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                                إلغاء
                            </button>
                            <button 
                                onClick={handleSaveOrder}
                                className="px-8 py-3 bg-sap-primary text-white rounded-xl font-black hover:bg-sap-secondary transition-colors shadow-lg flex items-center gap-2 active:scale-95"
                            >
                                <Save size={18} />
                                حفظ الأمر
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </>
    );
};
