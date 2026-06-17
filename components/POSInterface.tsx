import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Product, DailySales, Customer, POSPoint, HeldOrder, CartItem, User, Shift } from '../types';
import { db } from '../services/supabase';
import { useNotification } from './Notifications';
import { useSystemSettings } from './SystemSettingsContext';
import { 
  DollarSign, Users, Save, Loader2, Monitor, Search, 
  PauseCircle, PlayCircle, Trash2, LayoutGrid, CheckCircle2, ChevronRight, X, User as UserIcon,
  ShoppingCart, Plus, Minus, Barcode, CreditCard, Banknote, RefreshCcw, Tag,
  History, FileText, AlertCircle, Lock, Calculator, Printer, Maximize, HelpCircle, Keyboard, Star, Send, MessageCircle
} from 'lucide-react';
import { playBeep, playError, playSuccess, playClick } from '../utils/sound';

interface POSInterfaceProps {
  products: Product[]; 
  setDailySales: React.Dispatch<React.SetStateAction<DailySales[]>>;
  currentUser: User | null;
}

export const POSInterface: React.FC<POSInterfaceProps> = ({ products, setDailySales, currentUser }) => {
  const { notify } = useNotification();
  const { settings } = useSystemSettings();
  
  // --- State ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [posPoints, setPosPoints] = useState<POSPoint[]>([]);
  const [selectedPosId, setSelectedPosId] = useState<string>('');
  const [isRefundMode, setIsRefundMode] = useState(false);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSale, setLastSale] = useState<DailySales | null>(null);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [showDiscountConfirmModal, setShowDiscountConfirmModal] = useState(false);
  const [showWhatsAppPrompt, setShowWhatsAppPrompt] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  
  // Shift State
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [loadingShift, setLoadingShift] = useState(true);

  // Checkout State
  const [paidCash, setPaidCash] = useState('');
  const [paidCard, setPaidCard] = useState('');
  const [isCreditSale, setIsCreditSale] = useState(false);
  const [checkoutNote, setCheckoutNote] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState('');
  
  // Quick Add State
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCode, setNewProdCode] = useState('');
  
  // Quick Edit State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editPrice, setEditPrice] = useState('');

  // Calculator & Print State
  const [showCalculator, setShowCalculator] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [calcInput, setCalcInput] = useState('');
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fullscreen Toggle
  const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((e) => {
              console.error(`Error attempting to enable fullscreen mode: ${e.message} (${e.name})`);
          });
      } else {
          if (document.exitFullscreen) {
              document.exitFullscreen();
          }
      }
  };

  // Calculator Logic
  const handleCalcInput = (val: string) => {
      if (val === 'C') setCalcInput('');
      else if (val === '=') {
          try {
              // Safe evaluation using Function constructor instead of eval
              // Only allow numbers and basic operators
              if (/^[0-9+\-*/.() ]+$/.test(calcInput)) {
                  // eslint-disable-next-line no-new-func
                  const result = new Function(`return ${calcInput}`)();
                  setCalcInput(String(result));
              } else {
                  setCalcInput('Error');
              }
          } catch (e) {
              setCalcInput('Error');
          }
      } else {
          setCalcInput(prev => prev + val);
      }
  };

  const handlePrintLastReceipt = () => {
      if (!lastReceiptId) return notify('لا توجد فاتورة سابقة', 'warning');
      notify('جاري طباعة آخر فاتورة...', 'info');
      playClick();
  };

  const handleRightClickProduct = (e: React.MouseEvent, product: Product) => {
      e.preventDefault();
      if (currentUser?.role !== 'admin') return;
      setEditingProduct(product);
      setEditPrice(product.price || '');
  };

  const handleSavePrice = async () => {
      if (!editingProduct) return;
      try {
          await db.products.upsert({ ...editingProduct, price: editPrice });
          // Update local state is not possible here as setProducts is not available
          // Ideally we should trigger a refresh or use context
          setEditingProduct(null);
          notify('تم تحديث السعر بنجاح (سيظهر التحديث بعد إعادة التحميل)', 'success');
      } catch (e) {
          notify('فشل تحديث السعر', 'error');
      }
  };

  // --- Effects ---
  useEffect(() => {
    const load = async () => {
      const [pp, cust] = await Promise.all([db.posPoints.getAll(), db.customers.getAll()]);
      setPosPoints(pp);
      setCustomers(cust);
      if (pp.length > 0) setSelectedPosId(pp[0].id);
      
      try {
          const orders = await db.heldOrders.getAll();
          setHeldOrders(orders);
      } catch (e) {
          console.error("Failed to fetch held orders", e);
      }
    };
    load();
  }, []);

  // Check Shift Status
  useEffect(() => {
    const checkShift = async () => {
        if (!currentUser) return;
        try {
            const shifts = await db.shifts.getAll();
            const openShift = shifts.find((s: any) => s.userId === currentUser.id && s.status === 'open');
            setCurrentShift(openShift || null);
        } catch (e) {
            console.error("Error checking shift", e);
        } finally {
            setLoadingShift(false);
        }
    };
    checkShift();

    const handleShiftChange = () => checkShift();
    window.addEventListener('shiftChanged', handleShiftChange);
    return () => window.removeEventListener('shiftChanged', handleShiftChange);
  }, [currentUser]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!currentShift) return;

        // F2: Focus Search
        if (e.key === 'F2') {
            e.preventDefault();
            searchInputRef.current?.focus();
        }
        // F4: Pay / Checkout
        if (e.key === 'F4') {
            e.preventDefault();
            handleOpenCheckout();
        }
        // F8: Hold Order
        if (e.key === 'F8') {
            e.preventDefault();
            handleHold();
        }
        // F9: Discount (Focus global discount or open modal - simplified to 10% for now)
        if (e.key === 'F9') {
            e.preventDefault();
            setShowDiscountConfirmModal(true);
        }
        // F10: Toggle Return Mode
        if (e.key === 'F10') {
            e.preventDefault();
            setIsRefundMode(prev => !prev);
            notify(isRefundMode ? 'تم إيقاف وضع المرتجع' : 'تم تفعيل وضع المرتجع', 'info');
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentShift, cart, isRefundMode]);

  // Barcode Scanner Listener (Global)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
        // Disable scanner if no shift
        if (!currentShift && !loadingShift) return;

        const now = Date.now();
        if (now - lastKeyTime > 100) buffer = ''; // Reset if slow (manual typing)
        lastKeyTime = now;

        if (e.key === 'Enter') {
            if (buffer.length > 2) { // Minimum barcode length
                handleScan(buffer);
                buffer = '';
            }
        } else if (e.key.length === 1) {
            buffer += e.key;
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, cart, isRefundMode, currentShift, loadingShift]);

  // --- Logic ---

  const categories = useMemo(() => {
      const cats = new Set(products.map(p => p.category).filter(Boolean));
      return ['all', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
      return products.filter(p => {
          const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                p.code.toLowerCase().includes(searchQuery.toLowerCase());
          
          let matchesCat = true;
          if (selectedCategory === 'favorites') {
              matchesCat = p.isFavorite === true;
          } else {
              matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
          }
          
          return matchesSearch && matchesCat;
      });
  }, [products, searchQuery, selectedCategory]);

  const cartTotal = useMemo(() => {
      return cart.reduce((sum, item) => {
          const itemTotal = (item.price * item.quantity) - (item.discount || 0);
          return sum + itemTotal;
      }, 0);
  }, [cart]);

  const handleScan = (code: string) => {
      // Scale Barcode Integration (e.g., 21XXXXXWWWWWC or 22XXXXXPPPPPC)
      // Usually starts with 21 (weight) or 22 (price), followed by 5 digits item code, 5 digits weight/price, 1 check digit
      if (code.length === 13 && (code.startsWith('21') || code.startsWith('22'))) {
          const itemCode = code.substring(2, 7);
          const valueStr = code.substring(7, 12);
          const value = parseInt(valueStr) / 1000; // Assuming 3 decimal places for weight (kg) or price

          const product = products.find(p => p.code === itemCode || p.code === code.substring(0, 7));
          
          if (product) {
              if (code.startsWith('21')) {
                  // Weight barcode: value is quantity (e.g., 1.500 kg)
                  addToCart({ ...product, price: product.price }, value);
                  notify(`تم إضافة ${value} ${product.unitId === 'unit_kg' ? 'كجم' : 'وحدة'} من ${product.name}`, 'success');
              } else if (code.startsWith('22')) {
                  // Price barcode: value is total price, calculate quantity based on unit price
                  const unitPrice = parseFloat(product.price || '1');
                  const calculatedQty = value / unitPrice;
                  addToCart({ ...product, price: product.price }, calculatedQty);
                  notify(`تم إضافة ${product.name} بقيمة ${value} SAR`, 'success');
              }
              playBeep();
              return;
          }
      }

      // Standard Barcode
      const product = products.find(p => p.code === code);
      if (product) {
          addToCart(product);
          playBeep();
      } else {
          playError();
          notify('المنتج غير موجود', 'error');
      }
  };

  const addToCart = (product: Product, specificQuantity?: number) => {
      // Check Low Stock
      if ((product.stock || 0) <= (product.lowStockThreshold || 0) && (product.lowStockThreshold || 0) > 0) {
          notify(`تنبيه: مخزون منخفض للمنتج ${product.name}`, 'warning');
      }

      setCart(prev => {
          const existing = prev.find(i => i.productId === product.id);
          const qtyMod = isRefundMode ? -(specificQuantity || 1) : (specificQuantity || 1);
          
          if (existing) {
              return prev.map(i => i.productId === product.id 
                  ? { ...i, quantity: i.quantity + qtyMod } 
                  : i
              ).filter(i => i.quantity !== 0); // Remove if 0
          }
          return [...prev, { 
              productId: product.id, 
              quantity: qtyMod, 
              price: parseFloat(product.price || '0'), 
              name: product.name,
              discount: 0,
              taxRate: product.taxRate
          }];
      });
      playClick();
  };

  const updateQty = (productId: string, delta: number) => {
      setCart(prev => prev.map(item => {
          if (item.productId === productId) {
              const newQty = item.quantity + delta;
              return { ...item, quantity: newQty };
          }
          return item;
      }).filter(i => i.quantity !== 0));
  };

  const updateItemDiscount = (productId: string, discount: number) => {
      setCart(prev => prev.map(item => {
          if (item.productId === productId) {
              return { ...item, discount: discount };
          }
          return item;
      }));
  };

  const removeFromCart = (productId: string) => {
      setCart(prev => prev.filter(i => i.productId !== productId));
  };

  const clearCart = () => {
      setCart([]);
      setPaidCash('');
      setPaidCard('');
      setCheckoutNote('');
      setSelectedCustomerId('');
      setIsRefundMode(false);
      setRedeemPoints(false);
      setPointsToRedeem('');
  };

  // --- Hold / Retrieve ---

  const handleHold = async () => {
      if (cart.length === 0) return notify('السلة فارغة', 'warning');
      
      const order: HeldOrder = {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          amount: cartTotal,
          note: 'Suspended Sale',
          customerName: customers.find(c => c.id === selectedCustomerId)?.name,
          cart: cart
      };

      try {
          await db.heldOrders.upsert(order);
          setHeldOrders(prev => [order, ...prev]);
          clearCart();
          notify('تم تعليق الطلب بنجاح', 'success');
      } catch (e) {
          notify('فشل تعليق الطلب', 'error');
      }
  };

  const handleRetrieve = async (order: HeldOrder) => {
      setCart(order.cart);
      if (order.customerName) {
          const c = customers.find(n => n.name === order.customerName);
          if (c) setSelectedCustomerId(c.id);
      }
      
      try {
          await db.heldOrders.delete(order.id);
          setHeldOrders(prev => prev.filter(o => o.id !== order.id));
          setShowHeldModal(false);
          notify('تم استرجاع الطلب', 'success');
      } catch (e) {
          notify('فشل استرجاع الطلب', 'error');
      }
  };

  // --- Checkout ---

  const handleOpenCheckout = () => {
      if (cart.length === 0) return notify('السلة فارغة', 'error');
      
      if (settings.defaultPaymentMethod === 'card') {
          setPaidCard(cartTotal.toString());
          setPaidCash('');
      } else {
          setPaidCash(cartTotal.toString());
          setPaidCard('');
      }
      
      setShowCheckoutModal(true);
  };

  const handleCheckout = async () => {
      if (cart.length === 0) return;
      
      const cash = parseFloat(paidCash || '0');
      const card = parseFloat(paidCard || '0');
      
      // Calculate Discount from Points
      let discountAmount = 0;
      let pointsUsed = 0;
      if (redeemPoints && pointsToRedeem) {
          pointsUsed = parseInt(pointsToRedeem);
          // 100 points = 10 SAR (Example Rate: 10 points = 1 SAR)
          discountAmount = pointsUsed / 10; 
      }

      const totalPaid = cash + card;
      
      if (isCreditSale && !selectedCustomerId) {
          return notify('يجب اختيار عميل لعملية الآجل', 'error');
      }

      // In refund mode, cartTotal is negative
      const isReturn = cartTotal < 0;
      const absTotal = Math.abs(cartTotal);
      const finalTotal = Math.max(0, absTotal - discountAmount); // Ensure not negative
      const absPaid = Math.abs(totalPaid);

      // Check Credit Limit
      if (isCreditSale && selectedCustomerId) {
          const customer = customers.find(c => c.id === selectedCustomerId);
          if (customer && customer.creditLimit && customer.creditLimit > 0) {
              const currentBalance = customer.balance || 0;
              const newDebt = finalTotal - absPaid;
              if (currentBalance + newDebt > customer.creditLimit) {
                  return notify(`لا يمكن إتمام العملية. سقف الائتمان للعميل هو ${customer.creditLimit} SAR والرصيد الحالي ${currentBalance} SAR`, 'error');
              }
          }
      }

      // Validation for normal sales (not credit, not return)
      if (!isCreditSale && !isReturn && absPaid < finalTotal) {
          return notify('المبلغ المدفوع غير كافي', 'error');
      }

      // Determine Payment Method
      let paymentMethod: any = 'cash';
      if (isCreditSale) {
          if (absPaid > 0) paymentMethod = 'split'; // Partial payment
          else paymentMethod = 'credit';
      }
      else if (cash > 0 && card > 0) paymentMethod = 'split';
      else if (card > 0) paymentMethod = 'card';

      try {
          const sale: DailySales = {
              id: crypto.randomUUID(),
              date: new Date().toISOString().split('T')[0],
              totalAmount: absTotal,
              paidAmount: absPaid,
              remainingAmount: isCreditSale ? Math.max(0, finalTotal - absPaid) : 0,
              paymentMethod: paymentMethod,
              cashAmount: cash,
              cardAmount: card,
              transactionType: isReturn ? 'return' : 'sale',
              isPending: false,
              isClosed: true,
              customerName: customers.find(c => c.id === selectedCustomerId)?.name || 'عميل عام',
              customerId: selectedCustomerId || undefined,
              notes: checkoutNote,
              returnReason: isReturn ? returnReason : undefined,
              amount: isReturn ? cartTotal : finalTotal, // Net amount
              discount: discountAmount,
              pointsRedeemed: pointsUsed,
              posPointId: selectedPosId,
              branchId: posPoints.find(p => p.id === selectedPosId)?.branchId,
              cart: cart
          };

          await db.dailySales.upsert(sale);
          setDailySales(prev => [sale, ...prev]);
          setLastReceiptId(sale.id); // Store for reprint

          // Update Customer Balance & Loyalty Points
          if (selectedCustomerId) {
              const customer = customers.find(c => c.id === selectedCustomerId);
              if (customer) {
                  let newBalance = customer.balance || 0;
                  const newDebt = isCreditSale ? Math.max(0, finalTotal - absPaid) : 0;
                  newBalance += newDebt;
                  
                  // Loyalty Points: 1 point per 10 SAR spent (only on positive sales)
                  let newPoints = customer.loyaltyPoints || 0;
                  
                  // Deduct redeemed points
                  if (redeemPoints && pointsUsed > 0) {
                      newPoints -= pointsUsed;
                  }

                  // Add new points from this purchase
                  if (!isReturn && !isCreditSale) {
                      newPoints += Math.floor(finalTotal / 10);
                  }

                  const updatedCustomer = { 
                      ...customer, 
                      balance: newBalance, 
                      lastVisit: new Date().toISOString(),
                      totalPurchases: (customer.totalPurchases || 0) + 1,
                      loyaltyPoints: Math.max(0, newPoints) // Ensure not negative
                  };
                  await db.customers.upsert(updatedCustomer);
                  setCustomers(prev => prev.map(c => c.id === selectedCustomerId ? updatedCustomer : c));
              }
          }
          
          // Log Activity
          await db.activityLogs.add({
              action: isReturn ? 'مرتجع' : (isCreditSale ? 'بيع آجل' : 'بيع'),
              details: `فاتورة: ${sale.id.substring(0, 8)} - المبلغ: ${sale.amount} (${paymentMethod}) ${discountAmount > 0 ? `- خصم نقاط: ${discountAmount}` : ''}`,
              user: currentUser?.username || 'الكاشير',
              type: 'success'
          });
          
          playSuccess();
          notify('تمت العملية بنجاح', 'success');
          setShowCheckoutModal(false);
          setLastSale(sale);
          setShowSuccessModal(true);
          clearCart();
      } catch (e) {
          playError();
          notify('حدث خطأ أثناء الحفظ', 'error');
      }
  };

  // --- Quick Add ---
  const handleQuickAdd = async () => {
      if (!newProdName || !newProdPrice) return notify('البيانات ناقصة', 'error');
      
      const newProduct: Product = {
          id: crypto.randomUUID(),
          name: newProdName,
          price: newProdPrice,
          code: newProdCode || Math.floor(Math.random() * 1000000).toString(),
          unitId: 'unit_piece', // Default
          category: 'Quick Add'
      };

      // Add to DB
      try {
          await db.products.upsert(newProduct);
          // We can't easily update parent state without callback, but we can try to rely on next fetch or just add to cart
          // Ideally we should have a callback prop onNewProductAdded
          
          addToCart(newProduct);
          
          // Log Activity
          await db.activityLogs.add({
              action: 'إضافة منتج سريع',
              details: `تم إضافة منتج: ${newProduct.name}`,
              user: 'الكاشير',
              type: 'info'
          });

          setShowQuickAddModal(false);
          setNewProdName(''); setNewProdPrice(''); setNewProdCode('');
          notify('تم إضافة المنتج للسلة وقاعدة البيانات', 'success');
      } catch (e) {
          notify('فشل حفظ المنتج في قاعدة البيانات', 'error');
      }
  };

    // Print Receipt Portal
    const printContainer = document.getElementById('print-container');
    const receiptContent = lastSale ? (
        <div className="bg-white p-4 w-[80mm] mx-auto text-black font-sans text-sm print:block" dir="rtl">
            {/* Header */}
            <div className="text-center mb-4 border-b border-black pb-4 border-dashed">
                {settings.showLogoOnReceipt && settings.receiptLogo && (
                    <img src={settings.receiptLogo} alt="Logo" className="max-h-16 mx-auto mb-2" />
                )}
                {settings.showHeaderOnReceipt && settings.receiptHeader && (
                    <div className="whitespace-pre-wrap font-bold text-lg mb-2">{settings.receiptHeader}</div>
                )}
                <div className="font-bold text-xl">{settings.orgName || 'متجرنا'}</div>
                {settings.taxNumber && <div className="text-xs mt-1">الرقم الضريبي: {settings.taxNumber}</div>}
            </div>

            {/* Meta */}
            <div className="mb-4 text-xs space-y-1 border-b border-black pb-4 border-dashed">
                <div className="flex justify-between">
                    <span>رقم الفاتورة:</span>
                    <span className="font-mono">{lastSale.id.substring(0, 8)}</span>
                </div>
                <div className="flex justify-between">
                    <span>التاريخ:</span>
                    <span className="font-mono">{new Date(lastSale.date).toLocaleString('ar-SA')}</span>
                </div>
                <div className="flex justify-between">
                    <span>الكاشير:</span>
                    <span>{lastSale.cashierId || currentUser?.username || 'غير محدد'}</span>
                </div>
                {lastSale.customerName && (
                    <div className="flex justify-between">
                        <span>العميل:</span>
                        <span>{lastSale.customerName}</span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span>طريقة الدفع:</span>
                    <span>{
                        lastSale.paymentMethod === 'cash' ? 'نقدي' :
                        lastSale.paymentMethod === 'card' ? 'شبكة' :
                        lastSale.paymentMethod === 'transfer' ? 'تحويل بنكي' : 'آجل'
                    }</span>
                </div>
            </div>

            {/* Items */}
            <table className="w-full text-xs mb-4">
                <thead>
                    <tr className="border-b border-black border-dashed">
                        <th className="text-right py-1">الصنف</th>
                        <th className="text-center py-1">الكمية</th>
                        <th className="text-left py-1">السعر</th>
                    </tr>
                </thead>
                <tbody>
                    {lastSale.cart?.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-200 border-dotted">
                            <td className="py-2 pr-1">{item.name || 'منتج غير معروف'}</td>
                            <td className="py-2 text-center">{item.quantity}</td>
                            <td className="py-2 text-left font-mono">{(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals */}
            <div className="border-t border-black border-dashed pt-4 space-y-1 text-sm">
                <div className="flex justify-between font-bold text-lg">
                    <span>الإجمالي:</span>
                    <span className="font-mono">{lastSale.amount.toFixed(2)} SAR</span>
                </div>
                {lastSale.paidAmount !== undefined && lastSale.paymentMethod === 'cash' && (
                    <>
                        <div className="flex justify-between text-xs">
                            <span>المدفوع:</span>
                            <span className="font-mono">{lastSale.paidAmount.toFixed(2)} SAR</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span>المتبقي:</span>
                            <span className="font-mono">{lastSale.changeAmount?.toFixed(2) || '0.00'} SAR</span>
                        </div>
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="mt-6 text-center text-xs border-t border-black pt-4 border-dashed">
                {settings.showFooterOnReceipt && settings.receiptFooter && (
                    <div className="whitespace-pre-wrap mb-2">{settings.receiptFooter}</div>
                )}
                <div>شكراً لتسوقكم معنا!</div>
            </div>
        </div>
    ) : null;

    return (
        <>
        {isPrintingReceipt && lastSale && printContainer && createPortal(receiptContent, printContainer)}
    <div className="h-full flex flex-col bg-gray-100 overflow-hidden animate-in fade-in relative">
        {/* Shift Warning Overlay */}
        {!loadingShift && !currentShift && (
            <div className="absolute inset-0 z-50 bg-gray-100/80 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-md border border-red-100 animate-in zoom-in-95">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-gray-800 mb-2">الوردية مغلقة</h2>
                    <p className="text-gray-500 font-bold mb-8">يجب فتح وردية جديدة من لوحة البيانات للبدء في عمليات البيع</p>
                </div>
            </div>
        )}

        {/* Top Bar */}
        <div className="bg-white/95 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex justify-between items-center shrink-0 relative z-20 shadow-sm">
            <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-sap-primary to-sap-primary-hover text-white p-2.5 rounded-xl shadow-md"><ShoppingCart size={22} strokeWidth={2.5}/></div>
                <h1 className="font-black text-xl text-gray-800 tracking-tight">نقطة البيع</h1>
                
                <div className="h-8 w-px bg-gray-200 mx-4"></div>
                
                <div className="relative w-80 group">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-sap-primary transition-colors" size={18}/>
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="بحث (اسم / كود)..." 
                        className="w-full bg-gray-50/80 border border-gray-200/60 rounded-xl py-2.5 pr-12 pl-4 text-sm font-bold focus:ring-2 focus:ring-sap-primary/20 focus:border-sap-primary focus:bg-white outline-none transition-all shadow-sm"
                    />
                </div>
            </div>

            <div className="flex items-center gap-2">
                 <button 
                    onClick={() => setShowHelpModal(true)}
                    className="p-2.5 text-gray-500 hover:text-sap-primary hover:bg-sap-highlight/20 rounded-xl transition-all font-bold"
                    title="اختصارات لوحة المفاتيح"
                >
                    <Keyboard size={20}/>
                </button>

                 <button 
                    onClick={toggleFullscreen}
                    className="p-2.5 text-gray-500 hover:text-sap-primary hover:bg-sap-highlight/20 rounded-xl transition-all hidden md:block"
                    title="ملء الشاشة"
                >
                    <Maximize size={20}/>
                </button>

                 <button 
                    onClick={() => setShowCalculator(!showCalculator)}
                    className={`p-2.5 rounded-xl transition-all ${showCalculator ? 'bg-sap-primary text-white shadow-md' : 'text-gray-500 hover:text-sap-primary hover:bg-sap-highlight/20'}`}
                    title="الآلة الحاسبة"
                >
                    <Calculator size={20}/>
                </button>

                <div className="w-px h-6 bg-gray-200 mx-1"></div>

                <button 
                    onClick={handlePrintLastReceipt}
                    disabled={!lastReceiptId}
                    className="p-2.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500 transition-all font-bold group"
                    title="طباعة آخر فاتورة"
                >
                    <Printer size={20} className="group-active:scale-95"/>
                </button>

                 <button 
                    onClick={() => setIsRefundMode(!isRefundMode)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm border ${isRefundMode ? 'bg-red-50 text-red-600 border-red-200 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-sap-primary/30'}`}
                >
                    <RefreshCcw size={18} className={isRefundMode ? 'animate-spin-slow' : ''}/> {isRefundMode ? 'وضع المرتجع مفعل' : 'وضع المرتجع'}
                </button>

                <button 
                    onClick={() => setShowHeldModal(true)}
                    className="relative p-2.5 bg-amber-50 border border-amber-200/50 text-amber-600 rounded-xl hover:bg-amber-100 hover:border-amber-300 transition-all shadow-sm"
                    title="الطلبات المعلقة"
                >
                    <PauseCircle size={20}/>
                    {heldOrders.length > 0 && <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full font-black shadow-sm ring-2 ring-white">{heldOrders.length}</span>}
                </button>

                <button 
                    onClick={() => setShowQuickAddModal(true)}
                    className="p-2.5 bg-sap-primary/10 border border-sap-primary/20 text-sap-primary rounded-xl hover:bg-sap-primary hover:text-white transition-all shadow-sm active:scale-95"
                    title="إضافة منتج سريع"
                >
                    <Plus size={20} strokeWidth={2.5}/>
                </button>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
            {/* Calculator Overlay */}
            {showCalculator && (
                <div className="absolute top-4 right-[400px] z-40 bg-white rounded-2xl shadow-2xl border border-gray-200 w-64 overflow-hidden animate-in slide-in-from-top-4">
                    <div className="bg-gray-800 p-4 text-right">
                        <div className="text-white text-2xl font-mono font-bold truncate">{calcInput || '0'}</div>
                    </div>
                    <div className="grid grid-cols-4 gap-px bg-gray-200">
                        {['7','8','9','/', '4','5','6','*', '1','2','3','-', 'C','0','=','+'].map(btn => (
                            <button 
                                key={btn} 
                                onClick={() => handleCalcInput(btn)}
                                className={`p-4 bg-white hover:bg-gray-50 font-bold text-lg active:bg-gray-100 ${btn === '=' ? 'bg-sap-primary text-white hover:bg-sap-primary-hover' : 'text-gray-700'} ${['/','*','-','+'].includes(btn) ? 'text-sap-primary' : ''}`}
                            >
                                {btn}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Left: Products Grid */}
            <div className="flex-1 flex flex-col border-l border-gray-200 bg-gray-50/50">
                {/* Categories */}
                <div className="p-3 overflow-x-auto flex gap-2 no-scrollbar shrink-0">
                    <button 
                        onClick={() => setSelectedCategory('favorites')}
                        className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${selectedCategory === 'favorites' ? 'bg-yellow-400 text-yellow-900 shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:border-yellow-400'}`}
                    >
                        <Star size={14} fill={selectedCategory === 'favorites' ? 'currentColor' : 'none'} /> المفضلة
                    </button>
                    {categories.map(cat => (
                        <button 
                            key={cat}
                            onClick={() => setSelectedCategory(cat as string)}
                            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-sap-primary text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:border-sap-primary'}`}
                        >
                            {cat === 'all' ? 'الكل' : cat}
                        </button>
                    ))}
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 content-start">
                    {filteredProducts.map(product => (
                        <button 
                            key={product.id}
                            onClick={() => addToCart(product)}
                            onContextMenu={(e) => handleRightClickProduct(e, product)}
                            className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col justify-between hover:border-sap-primary/40 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transition-all duration-300 group text-right h-32 relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-sap-primary/0 to-transparent group-hover:from-sap-primary/5 transition-colors duration-300"></div>

                            <div className="flex justify-between items-start w-full gap-2 relative z-10">
                                <div className="flex-1">
                                    <h3 className="font-bold text-sm text-gray-800 line-clamp-2 leading-tight group-hover:text-sap-primary transition-colors">{product.name}</h3>
                                    <p className="text-[11px] text-gray-400 font-mono mt-1 opacity-80">{product.code}</p>
                                </div>
                                <span className="font-black text-sm text-sap-secondary bg-sap-secondary/10 px-2.5 py-1 rounded-xl shrink-0 group-hover:scale-105 transition-transform">{parseFloat(product.price || '0').toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-end w-full mt-auto relative z-10">
                                {/* Stock Indicator inside a pill format */}
                                <div className="flex items-center gap-1.5 opacity-80">
                                    {(product.stock || 0) <= (product.lowStockThreshold || 5) && (
                                        <>
                                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
                                            <span className="text-[10px] font-bold text-red-500">منخفض</span>
                                        </>
                                    )}
                                </div>

                                <div className="w-7 h-7 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-sap-primary group-hover:text-white transition-all duration-300 shadow-sm group-hover:shadow-[0_0_12px_rgba(128,0,32,0.3)]">
                                    <Plus size={16} strokeWidth={2.5}/>
                                </div>
                            </div>
                        </button>
                    ))}
                    {filteredProducts.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center text-gray-400 py-20 opacity-50">
                            <Search size={48} className="mb-4"/>
                            <p>لا توجد منتجات مطابقة</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Cart */}
            <div className={`w-96 flex flex-col shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] z-10 transition-all duration-300 border-r border-gray-100 ${isRefundMode ? 'border-4 border-red-500 bg-red-50/80 backdrop-blur-xl' : 'bg-white/95 backdrop-blur-xl'}`}>
                {/* Return Mode Banner */}
                {isRefundMode && (
                    <div className="bg-red-600 text-white text-center py-2.5 font-bold text-sm shadow-md animate-pulse">
                        ⚠️ وضع المرتجع مفعل - جميع العناصر بالسالب
                    </div>
                )}

                {/* Customer Selector */}
                <div className="p-4 border-b border-gray-100/80 bg-white/50">
                    <div className="relative group">
                        <select 
                            value={selectedCustomerId}
                            onChange={e => setSelectedCustomerId(e.target.value)}
                            className="w-full bg-gray-50/80 border border-gray-200/60 rounded-xl py-2.5 pr-11 pl-4 text-sm font-bold appearance-none outline-none focus:border-sap-primary focus:bg-white focus:ring-2 focus:ring-sap-primary/10 transition-all shadow-sm group-hover:border-sap-primary/30"
                        >
                            <option value="">عميل نقدي عام</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sap-primary bg-sap-primary/10 p-1.5 rounded-lg flex items-center justify-center">
                            <UserIcon size={14} strokeWidth={2.5}/>
                        </div>
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <ChevronRight size={16} className="text-gray-400 rotate-90" />
                        </div>
                    </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {cart.map((item, idx) => (
                        <div key={`${item.productId}-${idx}`} className={`flex flex-col gap-2 p-3.5 rounded-2xl border transition-all ${item.quantity < 0 ? 'bg-red-50 border-red-200/60 shadow-sm' : 'bg-white border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:border-sap-primary/30 hover:shadow-md group'}`}>
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex-1">
                                    <h4 className="font-bold text-sm text-gray-800 leading-snug line-clamp-2">
                                        {item.name} 
                                        {item.quantity < 0 && <span className="text-[10px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded-md font-black mr-2 inline-block shadow-sm">مرتجع</span>}
                                    </h4>
                                    <div className="text-xs text-gray-400 font-mono flex items-center gap-2 mt-1">
                                        <span>السعر: {item.price.toLocaleString()}</span>
                                    </div>
                                </div>
                                <button onClick={() => removeFromCart(item.productId)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-colors p-1 bg-gray-50 hover:bg-red-50 rounded-lg shrink-0">
                                    <X size={16}/>
                                </button>
                            </div>
                            
                            <div className="flex justify-between items-end mt-1 gap-2">
                                <div className="flex flex-col gap-2 w-1/2">
                                    <div className="flex items-center gap-1 bg-gray-50/80 rounded-xl border border-gray-200/60 p-1 w-full justify-between focus-within:border-sap-primary/40 focus-within:bg-white transition-colors">
                                        <button onClick={() => updateQty(item.productId, item.quantity < 0 ? -1 : 1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-emerald-600 transition-all bg-emerald-50/50"><Plus size={14} strokeWidth={2.5}/></button>
                                        <span className={`w-6 text-center font-black text-sm font-mono ${item.quantity < 0 ? 'text-red-500' : 'text-gray-800'}`}>{Math.abs(item.quantity)}</span>
                                        <button onClick={() => updateQty(item.productId, item.quantity < 0 ? 1 : -1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-red-500 transition-all bg-red-50/50"><Minus size={14} strokeWidth={2.5}/></button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className="bg-gray-100 text-gray-400 p-1.5 rounded-lg shrink-0 flex items-center justify-center"><Tag size={12}/></div>
                                        <input 
                                            type="number" 
                                            className="w-full h-7 text-[11px] border border-gray-200/60 bg-gray-50/50 rounded-lg px-2 focus:border-sap-primary focus:bg-white outline-none font-bold placeholder-gray-400 text-gray-700 transition-colors"
                                            value={item.discount || ''}
                                            placeholder="خصم بالريال..."
                                            onChange={(e) => updateItemDiscount(item.productId, parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col items-end justify-center w-1/2">
                                    {item.discount && item.discount > 0 ? (
                                         <div className="flex flex-col items-end justify-center h-full">
                                            <span className="text-[10px] text-gray-400 line-through decoration-red-400/50 decoration-2 font-mono">
                                                {(item.price * Math.abs(item.quantity)).toLocaleString()}
                                            </span>
                                            <span className={`font-black text-lg font-mono ${item.quantity < 0 ? 'text-red-600' : 'text-sap-primary'} leading-tight`}>
                                                {((item.price * item.quantity) - (item.discount || 0)).toLocaleString()}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className={`font-black text-lg font-mono flex items-center h-[52px] ${item.quantity < 0 ? 'text-red-600' : 'text-sap-primary'}`}>
                                            {((item.price * item.quantity) - (item.discount || 0)).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <input 
                                type="text" 
                                className="w-full text-xs border border-transparent hover:border-gray-200/60 bg-transparent hover:bg-gray-50/50 focus:border-sap-primary/30 focus:bg-white rounded-lg px-2 py-1.5 outline-none placeholder-gray-300 text-gray-600 transition-all mt-1"
                                value={item.note || ''}
                                placeholder="إضافة ملاحظة للمنتج..."
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCart(prev => prev.map(i => i.productId === item.productId ? { ...i, note: val } : i));
                                }}
                            />
                        </div>
                    ))}
                    {cart.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-5 opacity-70">
                            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center border-2 border-dashed border-gray-200">
                                <ShoppingCart size={40} className="text-gray-300" />
                            </div>
                            <div className="text-center">
                                <p className="text-base font-black text-gray-400">سلة المشتريات فارغة</p>
                                <p className="text-xs text-gray-400 font-bold mt-1 max-w-[200px] leading-relaxed">قم بمسح الباركود أو اختيار المنتجات لإضافتها للسلة</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Totals & Actions */}
                <div className="p-5 bg-white border-t border-gray-100 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.05)] rounded-t-3xl relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-gray-200 rounded-full mt-2"></div>
                    
                    <div className="flex justify-between items-end mb-5 mt-2">
                        <span className="text-gray-500 font-bold text-sm">الإجمالي المستحق</span>
                        <div className="flex items-end gap-1.5">
                            <span className={`text-4xl font-black tracking-tight font-mono leading-none ${cartTotal < 0 ? 'text-red-600' : 'text-sap-shell'}`}>
                                {cartTotal.toLocaleString()}
                            </span>
                            <span className="text-sm font-bold text-gray-400 mb-1">SAR</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3 mt-1">
                        <button onClick={handleHold} className="py-2.5 bg-amber-50 text-amber-600 border border-amber-200/50 rounded-xl font-bold text-xs hover:bg-amber-100 hover:border-amber-300 transition-all shadow-sm flex items-center justify-center gap-1.5" title="F8">
                            <PauseCircle size={16}/> تعليق
                        </button>
                        <button onClick={() => {
                            if (cart.length === 0) return notify('السلة فارغة', 'warning');
                            if (!selectedCustomerId) return notify('يجب اختيار عميل لحفظ عرض السعر', 'error');
                            notify('تم حفظ عرض السعر بنجاح', 'success');
                            clearCart();
                        }} className="py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-200/50 rounded-xl font-bold text-xs hover:bg-indigo-100 hover:border-indigo-300 transition-all shadow-sm flex items-center justify-center gap-1.5">
                            <FileText size={16}/> عرض سعر
                        </button>
                        <button onClick={clearCart} className="py-2.5 bg-red-50 text-red-600 border border-red-200/50 rounded-xl font-bold text-xs hover:bg-red-100 hover:border-red-300 transition-all shadow-sm flex items-center justify-center gap-1.5">
                            <Trash2 size={16}/> إفراغ
                        </button>
                    </div>
                    
                    {/* Quick Discounts */}
                    <div className="flex gap-2 mb-4 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
                        <div className="flex items-center justify-center px-2 text-gray-400"><Tag size={12}/></div>
                        {[5, 10, 15].map(pct => (
                            <button 
                                key={pct}
                                onClick={() => {
                                    setCart(prev => prev.map(item => ({
                                        ...item,
                                        discount: (item.price * Math.abs(item.quantity)) * (pct / 100)
                                    })));
                                    notify(`تم تطبيق خصم ${pct}%`, 'success');
                                }}
                                className="flex-1 py-1.5 bg-white text-gray-600 shadow-sm text-xs font-bold rounded-lg hover:text-sap-primary hover:border-sap-primary/30 border border-gray-200/50 transition-all"
                            >
                                {pct}%
                            </button>
                        ))}
                         <button 
                            onClick={() => {
                                setCart(prev => prev.map(item => ({ ...item, discount: 0 })));
                                notify('تم إلغاء الخصم', 'info');
                            }}
                            className="px-3 py-1.5 bg-red-50 text-red-500 text-xs font-bold rounded-lg hover:bg-red-100 border border-red-100 transition-all flex items-center justify-center"
                            title="إلغاء الخصم"
                        >
                            <X size={14}/>
                        </button>
                    </div>

                    <button 
                        onClick={handleOpenCheckout} 
                        disabled={cart.length === 0}
                        className="w-full py-4 bg-gradient-to-r from-sap-primary to-sap-primary-hover text-white rounded-2xl font-black text-lg shadow-[0_8px_20px_rgba(20,93,160,0.25)] hover:shadow-[0_12px_25px_rgba(20,93,160,0.35)] hover:-translate-y-0.5 active:scale-95 active:translate-y-0 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none border border-sap-primary-hover border-b-4 active:border-b"
                        title="F4"
                    >
                        <CheckCircle2 size={24} strokeWidth={2.5}/> 
                        <span>دفع <span className="font-mono bg-white/20 px-2 py-0.5 rounded-lg ml-1 border border-white/10">{cartTotal.toLocaleString()}</span></span>
                    </button>
                </div>
            </div>

        </div>

        {/* --- Modals --- */}

        {/* Quick Edit Price Modal */}
        {editingProduct && (
            <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-black text-gray-800">تعديل السريع: {editingProduct.name}</h3>
                        <button onClick={() => setEditingProduct(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">السعر الجديد</label>
                            <input 
                                type="number" 
                                value={editPrice}
                                onChange={e => setEditPrice(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-black text-xl text-center focus:ring-2 focus:ring-sap-primary outline-none"
                                autoFocus
                            />
                        </div>
                        <button 
                            onClick={handleSavePrice}
                            className="w-full py-3 bg-sap-primary text-white rounded-xl font-black hover:bg-sap-primary-hover transition-colors"
                        >
                            حفظ التغييرات
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Checkout Modal */}
        {showCheckoutModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
                <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
                    <div className="p-6 bg-sap-shell text-white text-center">
                        <h2 className="text-2xl font-black mb-1">إتمام الدفع</h2>
                        <p className="text-white/60 text-sm font-bold">المبلغ المستحق: {cartTotal.toLocaleString()} SAR</p>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-500 mb-2"><Banknote size={16}/> نقداً</label>
                            <input type="number" value={paidCash} onChange={e => {
                                setPaidCash(e.target.value);
                                if (cartTotal > 0) {
                                    const cash = parseFloat(e.target.value || '0');
                                    if (cash < cartTotal) {
                                        setPaidCard((cartTotal - cash).toString());
                                    } else {
                                        setPaidCard('0');
                                    }
                                }
                            }} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-black text-lg outline-none focus:border-sap-primary disabled:opacity-50" placeholder="0.00" autoFocus/>
                            <div className="flex gap-2 mt-2">
                                {[10, 20, 50, 100, 500].map(amt => (
                                    <button 
                                        key={amt} 
                                        onClick={() => {
                                            setPaidCash(amt.toString());
                                            if (cartTotal > 0) {
                                                if (amt < cartTotal) {
                                                    setPaidCard((cartTotal - amt).toString());
                                                } else {
                                                    setPaidCard('0');
                                                }
                                            }
                                        }}
                                        className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-600 transition-colors border border-gray-200"
                                    >
                                        {amt}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-500 mb-2"><CreditCard size={16}/> شبكة / بطاقة</label>
                            <input type="number" value={paidCard} onChange={e => {
                                setPaidCard(e.target.value);
                                if (cartTotal > 0) {
                                    const card = parseFloat(e.target.value || '0');
                                    if (card < cartTotal) {
                                        setPaidCash((cartTotal - card).toString());
                                    } else {
                                        setPaidCash('0');
                                    }
                                }
                            }} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-black text-lg outline-none focus:border-sap-primary disabled:opacity-50" placeholder="0.00"/>
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-500 mb-2"><FileText size={16}/> ملاحظات</label>
                            <input type="text" value={checkoutNote} onChange={e => setCheckoutNote(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-sap-primary" placeholder="اختياري..."/>
                        </div>

                        {cartTotal < 0 && (
                            <div>
                                <label className="flex items-center gap-2 text-sm font-bold text-red-500 mb-2"><RefreshCcw size={16}/> سبب الإرجاع</label>
                                <select 
                                    value={returnReason} 
                                    onChange={e => setReturnReason(e.target.value)} 
                                    className="w-full p-3 bg-red-50 border border-red-200 rounded-xl font-bold text-sm outline-none focus:border-red-500 text-red-700"
                                >
                                    <option value="">-- اختر السبب --</option>
                                    <option value="defective">منتج معيب / تالف</option>
                                    <option value="expired">منتهي الصلاحية</option>
                                    <option value="wrong_item">منتج خاطئ</option>
                                    <option value="customer_change">تغيير رأي العميل</option>
                                    <option value="other">أخرى</option>
                                </select>
                            </div>
                        )}

                        {/* Loyalty Points Redemption */}
                        {selectedCustomerId && cartTotal > 0 && (
                            <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="flex items-center gap-2 text-sm font-bold text-purple-700">
                                        <Tag size={16}/> نقاط الولاء
                                    </label>
                                    <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                                        الرصيد: {customers.find(c => c.id === selectedCustomerId)?.loyaltyPoints || 0}
                                    </span>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="checkbox" 
                                        checked={redeemPoints} 
                                        onChange={e => {
                                            setRedeemPoints(e.target.checked);
                                            if (!e.target.checked) setPointsToRedeem('');
                                        }} 
                                        className="w-4 h-4 accent-purple-600"
                                    />
                                    <span className="text-sm text-gray-700">استبدال نقاط</span>
                                </div>

                                {redeemPoints && (
                                    <div className="mt-2 flex items-center gap-2 animate-in slide-in-from-top-2">
                                        <input 
                                            type="number" 
                                            value={pointsToRedeem} 
                                            onChange={e => {
                                                const val = parseInt(e.target.value) || 0;
                                                const maxPoints = customers.find(c => c.id === selectedCustomerId)?.loyaltyPoints || 0;
                                                // Max redeemable is limited by points balance AND cart total (10 pts = 1 SAR)
                                                const maxRedeemableByCart = Math.floor(cartTotal * 10);
                                                
                                                if (val <= maxPoints && val <= maxRedeemableByCart) {
                                                    setPointsToRedeem(e.target.value);
                                                }
                                            }}
                                            className="w-full p-2 border border-purple-200 rounded-lg text-sm font-bold outline-none focus:border-purple-500"
                                            placeholder="عدد النقاط"
                                        />
                                        <div className="text-xs font-bold text-purple-600 whitespace-nowrap">
                                            = {((parseInt(pointsToRedeem) || 0) / 10).toFixed(2)} SAR
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100 cursor-pointer hover:bg-blue-100 transition-all">
                            <input type="checkbox" checked={isCreditSale} onChange={e => setIsCreditSale(e.target.checked)} className="w-5 h-5 accent-sap-primary rounded-md"/>
                            <span className="text-sm font-bold text-blue-800">تسجيل كدين (آجل)</span>
                        </div>

                        <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-sm font-bold">
                            <span>المدفوع: <span className="text-sap-primary">{(parseFloat(paidCash||'0') + parseFloat(paidCard||'0')).toLocaleString()}</span></span>
                            <span>المتبقي: <span className="text-red-500">{(cartTotal - (parseFloat(paidCash||'0') + parseFloat(paidCard||'0'))).toLocaleString()}</span></span>
                        </div>

                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setShowCheckoutModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200">إلغاء</button>
                            <button onClick={handleCheckout} className="flex-[2] py-3 bg-sap-primary text-white rounded-xl font-black shadow-lg hover:bg-sap-primary-hover">تأكيد الدفع</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Success Modal */}
        {showSuccessModal && lastSale && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
                <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden text-center">
                    <div className="p-8 bg-green-500 text-white">
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <CheckCircle2 size={48} className="text-green-500" />
                        </div>
                        <h2 className="text-2xl font-black mb-1">تمت العملية بنجاح</h2>
                        <p className="text-white/80 text-sm font-bold">رقم الفاتورة: {lastSale.id.substring(0, 8)}</p>
                    </div>
                    <div className="p-6">
                        <div className="text-4xl font-black text-gray-800 mb-6">{lastSale.amount.toLocaleString()} SAR</div>
                        
                        <div className="space-y-3">
                            <button 
                                onClick={() => {
                                    setIsPrintingReceipt(true);
                                    setTimeout(() => {
                                        const afterPrint = () => {
                                            setIsPrintingReceipt(false);
                                            window.removeEventListener('afterprint', afterPrint);
                                        };
                                        window.addEventListener('afterprint', afterPrint);
                                        window.print();
                                    }, 100);
                                }}
                                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 flex items-center justify-center gap-2"
                            >
                                <Printer size={20} /> طباعة الفاتورة
                            </button>
                            
                            <button 
                                onClick={() => {
                                    const customer = customers.find(c => c.id === lastSale.customerId);
                                    if (customer?.phone) {
                                        let phone = customer.phone.replace(/\D/g, '');
                                        const message = `مرحباً بك في متجرنا!\n\nشكراً لتسوقك معنا.\nرقم الفاتورة: ${lastSale.id.substring(0, 8)}\nالقيمة الإجمالية: ${lastSale.amount} SAR\n\nنتمنى رؤيتك قريباً!`;
                                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
                                    } else {
                                        setWhatsappPhone('');
                                        setShowWhatsAppPrompt(true);
                                    }
                                }}
                                className="w-full py-3 bg-green-50 text-green-600 border border-green-200 rounded-xl font-bold hover:bg-green-100 flex items-center justify-center gap-2"
                            >
                                <MessageCircle size={20} /> إرسال عبر واتساب (بدون ورق)
                            </button>
                            
                            <button 
                                onClick={() => setShowSuccessModal(false)}
                                className="w-full py-3 bg-sap-primary text-white rounded-xl font-bold hover:bg-sap-primary-hover shadow-md mt-4"
                            >
                                عملية جديدة
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Held Orders Modal */}
        {showHeldModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-4 bg-amber-500 text-white flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2"><PauseCircle size={20}/> العمليات المعلقة</h3>
                        <button onClick={() => setShowHeldModal(false)}><X size={20}/></button>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
                        {heldOrders.map(order => (
                            <div key={order.id} className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex justify-between items-center hover:bg-white hover:shadow-md transition-all">
                                <div>
                                    <div className="font-black text-lg text-gray-800">{order.amount.toLocaleString()} SAR</div>
                                    <div className="text-xs text-gray-500 font-bold">{order.customerName || 'عميل عام'}</div>
                                    <div className="text-[10px] text-gray-400 mt-1">{new Date(order.date).toLocaleString('ar-SA')}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">{order.cart.length} منتجات</div>
                                </div>
                                <button onClick={() => handleRetrieve(order)} className="px-4 py-2 bg-blue-100 text-blue-600 rounded-lg font-bold text-xs hover:bg-blue-200">استرجاع</button>
                            </div>
                        ))}
                        {heldOrders.length === 0 && <div className="text-center py-10 text-gray-400">لا توجد عمليات معلقة</div>}
                    </div>
                </div>
            </div>
        )}

        {/* Quick Add Modal */}
        {showQuickAddModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold">إضافة منتج سريع</h3>
                        <button onClick={() => setShowQuickAddModal(false)}><X size={20}/></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <input type="text" value={newProdName} onChange={e => setNewProdName(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-sap-primary" placeholder="اسم المنتج" autoFocus/>
                        <input type="number" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-sap-primary" placeholder="السعر"/>
                        <input type="text" value={newProdCode} onChange={e => setNewProdCode(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-sap-primary" placeholder="كود (اختياري)"/>
                        <button onClick={handleQuickAdd} className="w-full py-3 bg-sap-primary text-white rounded-xl font-bold shadow-lg hover:bg-sap-primary-hover">إضافة للسلة</button>
                    </div>
                </div>
            </div>
        )}
        {/* Help Modal */}
        {showHelpModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2"><Keyboard size={20}/> اختصارات لوحة المفاتيح</h3>
                        <button onClick={() => setShowHelpModal(false)}><X size={20}/></button>
                    </div>
                    <div className="p-6 grid grid-cols-2 gap-4">
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-bold text-gray-700">بحث</span>
                            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono shadow-sm">F2</kbd>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-bold text-gray-700">دفع</span>
                            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono shadow-sm">F4</kbd>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-bold text-gray-700">تعليق الطلب</span>
                            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono shadow-sm">F8</kbd>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-bold text-gray-700">خصم سريع (10%)</span>
                            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono shadow-sm">F9</kbd>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-bold text-gray-700">وضع المرتجع</span>
                            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono shadow-sm">F10</kbd>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-bold text-gray-700">ملء الشاشة</span>
                            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono shadow-sm">F11</kbd>
                        </div>
                    </div>
                    <div className="p-4 bg-blue-50 text-blue-700 text-xs font-bold text-center">
                        يمكنك أيضاً استخدام قارئ الباركود في أي وقت لإضافة المنتجات مباشرة
                    </div>
                </div>
            </div>
        )}

        {/* Discount Confirm Modal */}
        {showDiscountConfirmModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                    <div className="p-4 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
                        <h3 className="font-bold text-amber-800 flex items-center gap-2">
                            <Tag size={20} /> تأكيد الخصم
                        </h3>
                        <button onClick={() => setShowDiscountConfirmModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-6 text-center">
                        <p className="text-gray-700 font-bold mb-6">هل تريد تطبيق خصم 10% على كامل السلة؟</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowDiscountConfirmModal(false)}
                                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                            >
                                إلغاء
                            </button>
                            <button 
                                onClick={() => {
                                    setCart(prev => prev.map(item => ({
                                        ...item,
                                        discount: (item.price * Math.abs(item.quantity)) * 0.10
                                    })));
                                    notify('تم تطبيق خصم 10%', 'success');
                                    setShowDiscountConfirmModal(false);
                                }}
                                className="flex-1 py-3 px-4 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors shadow-md"
                            >
                                تأكيد
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* WhatsApp Prompt Modal */}
        {showWhatsAppPrompt && lastSale && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                    <div className="p-4 bg-green-50 border-b border-green-100 flex justify-between items-center">
                        <h3 className="font-bold text-green-800 flex items-center gap-2">
                            <MessageCircle size={20} /> إرسال عبر واتساب
                        </h3>
                        <button onClick={() => setShowWhatsAppPrompt(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-6">
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            رقم هاتف العميل (مع رمز الدولة):
                        </label>
                        <input
                            type="text"
                            value={whatsappPhone}
                            onChange={(e) => setWhatsappPhone(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent mb-6 text-xl font-mono text-center"
                            placeholder="966500000000"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    if (whatsappPhone) {
                                        const phone = whatsappPhone.replace(/\D/g, '');
                                        const message = `مرحباً بك في متجرنا!\n\nشكراً لتسوقك معنا.\nرقم الفاتورة: ${lastSale.id.substring(0, 8)}\nالقيمة الإجمالية: ${lastSale.amount} SAR\n\nنتمنى رؤيتك قريباً!`;
                                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
                                        setShowWhatsAppPrompt(false);
                                    }
                                }
                            }}
                        />
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowWhatsAppPrompt(false)}
                                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                            >
                                إلغاء
                            </button>
                            <button 
                                onClick={() => {
                                    if (whatsappPhone) {
                                        const phone = whatsappPhone.replace(/\D/g, '');
                                        const message = `مرحباً بك في متجرنا!\n\nشكراً لتسوقك معنا.\nرقم الفاتورة: ${lastSale.id.substring(0, 8)}\nالقيمة الإجمالية: ${lastSale.amount} SAR\n\nنتمنى رؤيتك قريباً!`;
                                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
                                        setShowWhatsAppPrompt(false);
                                    }
                                }}
                                className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-md"
                            >
                                إرسال
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

    </div>
    </>
  );
};