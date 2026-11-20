import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Product, Unit, ListRow, DailySales, Expense, Shift } from '../types';
import { db } from '../services/supabase';
import { ReportLayout } from './ReportLayout';
import { useNotification } from './Notifications';
import {
  Package, FileText, Clock,
  ShoppingBag, Plus, DollarSign, Crown,
  AlertTriangle, CheckCircle, Calendar, Zap, Printer, Wallet, TrendingUp, TrendingDown,
  LogOut, LogIn, Copy, Share2, X, Bell, BellRing, BellOff, Monitor, RefreshCw, ArrowUpLeft
} from 'lucide-react';

interface DashboardProps {
  products: Product[];
  units: Unit[];
  switchToTab: (tab: any) => void;
  onNavigateToList?: (listId: string, rowId?: string) => void;
  currentUser: any;
}

interface ExpiryAlert {
  listId: string;
  rowId: string;
  productName: string;
  productCode: string;
  expiryDate: string;
  daysLeft: number;
  qty: number;
  cartonQty?: number | '';
  unitId?: string;
  listType: string;
}

const sumCurrency = (values: number[]): number => {
  const cents = values.reduce((acc, v) => acc + Math.round((Number(v) || 0) * 100), 0);
  return cents / 100;
};

export const Dashboard: React.FC<DashboardProps> = ({
  products,
  units,
  switchToTab,
  onNavigateToList,
  currentUser,
}) => {
  const [stats, setStats] = useState({ lists: 0, sales: 0, expenses: 0 });
  const [recentLists, setRecentLists] = useState<any[]>([]);
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlert[]>([]);
  const [expiryFilter, setExpiryFilter] = useState<'7' | '30' | '60' | 'all'>('30');
  const [expiryMonthFilter, setExpiryMonthFilter] = useState<string>('all');
  const [lowStockAlerts, setLowStockAlerts] = useState<Product[]>([]);
  const [isUpdatingAlert, setIsUpdatingAlert] = useState<string | null>(null);
  const [selectedAlertKeys, setSelectedAlertKeys] = useState<string[]>([]);
  const [lastSelectedAlertIdx, setLastSelectedAlertIdx] = useState<number | null>(null);
  const [isBulkDismissing, setIsBulkDismissing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [salesData, setSalesData] = useState<DailySales[]>([]);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const { notify } = useNotification();
  const [showExpiryPrint, setShowExpiryPrint] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftAmount, setShiftAmount] = useState('');
  const [showCashDrawerModal, setShowCashDrawerModal] = useState(false);
  const [cashDrawerAction, setCashDrawerAction] = useState<'deposit' | 'withdraw'>('deposit');
  const [cashDrawerAmount, setCashDrawerAmount] = useState('');
  const [showExtraColumns, setShowExtraColumns] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<string>('default');
  const [hasNotifiedThisSession, setHasNotifiedThisSession] = useState<boolean>(false);
  const [rankingTab, setRankingTab] = useState<'products' | 'customers'>('products');
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (
      expiryAlerts.length > 0 &&
      'Notification' in window &&
      Notification.permission === 'granted' &&
      !hasNotifiedThisSession
    ) {
      const criticalAlerts = expiryAlerts.filter(a => a.daysLeft <= 15);
      if (criticalAlerts.length > 0) {
        const expiredCount = criticalAlerts.filter(a => a.daysLeft <= 0).length;
        const nearCount = criticalAlerts.filter(a => a.daysLeft > 0 && a.daysLeft <= 15).length;

        let bodyText = '';
        if (expiredCount > 0 && nearCount > 0) {
          bodyText = `تنبيه: يوجد عدد ${expiredCount} منتج منتهي الصلاحية و ${nearCount} منتج قريب من الانتهاء.`;
        } else if (expiredCount > 0) {
          bodyText = `تنبيه: يوجد عدد ${expiredCount} منتج منتهي الصلاحية يجب مراجعتها.`;
        } else if (nearCount > 0) {
          bodyText = `تنبيه: يوجد عدد ${nearCount} منتج قريب من الانتهاء (أقل من 15 يوم).`;
        }

        try {
          new Notification('تنبيه صلاحية المنتجات', { body: bodyText, dir: 'rtl' });
          setHasNotifiedThisSession(true);
        } catch (e) {
          console.error('Failed to trigger notification:', e);
        }
      }
    }
  }, [expiryAlerts, hasNotifiedThisSession]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      notify('متصفحك لا يدعم إشعارات سطح المكتب.', 'warning');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        notify('تم تفعيل إشعارات سطح المكتب بنجاح.', 'success');
        new Notification('نظام StoreFlow', {
          body: 'تم تفعيل إشعارات الصلاحية لسطح المكتب بنجاح.',
          dir: 'rtl',
        });
      } else if (permission === 'denied') {
        notify('تم رفض صلاحية الإشعارات. يمكنك تفعيلها من إعدادات المتصفح.', 'warning');
      }
    } catch {
      notify('تعذر طلب صلاحية الإشعارات داخل هذه النافذة.', 'error');
    }
  };

  const testDesktopNotification = () => {
    if (!('Notification' in window)) {
      notify('متصفحك لا يدعم إشعارات سطح المكتب.', 'warning');
      return;
    }
    if (Notification.permission !== 'granted') {
      requestNotificationPermission();
      return;
    }
    try {
      new Notification('إشعارات StoreFlow', {
        body: 'نظام تنبيهات صلاحية المنتجات يعمل بشكل طبيعي.',
        dir: 'rtl',
      });
      notify('تم إرسال إشعار تجريبي لسطح المكتب.', 'success');
    } catch {
      notify('حدث خطأ أثناء إرسال الإشعار التجريبي.', 'error');
    }
  };

  const getAlertYearMonth = (expiryDate: string): string | null => {
    if (!expiryDate) return null;
    const isoMatch = expiryDate.match(/^(\d{4})[-/](\d{1,2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}`;
    }
    const dmyMatch = expiryDate.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmyMatch) {
      return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}`;
    }
    const parsed = new Date(expiryDate);
    if (!isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
    }
    return null;
  };

  const availableExpiryMonths = useMemo(() => {
    const counts = new Map<string, number>();
    expiryAlerts.forEach(alert => {
      const ym = getAlertYearMonth(alert.expiryDate);
      if (ym) {
        counts.set(ym, (counts.get(ym) || 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, count]) => {
        const [yearStr, monthStr] = ym.split('-');
        const monthNum = parseInt(monthStr, 10);
        const dateObj = new Date(parseInt(yearStr, 10), monthNum - 1, 1);
        const monthName = dateObj.toLocaleDateString('ar-EG', { month: 'long' });
        return {
          ym,
          monthNum,
          label: `شهر ${monthNum} (${monthName}) ${yearStr} · ${count}`,
          shortLabel: `شهر ${monthNum}`,
          count,
        };
      });
  }, [expiryAlerts]);

  useEffect(() => {
    if (
      expiryMonthFilter !== 'all' &&
      !availableExpiryMonths.some(m => m.ym === expiryMonthFilter)
    ) {
      setExpiryMonthFilter('all');
    }
  }, [availableExpiryMonths, expiryMonthFilter]);

  const filteredExpiryAlerts = useMemo(() => {
    return expiryAlerts.filter(alert => {
      if (expiryMonthFilter !== 'all') {
        return getAlertYearMonth(alert.expiryDate) === expiryMonthFilter;
      }
      if (expiryFilter === 'all') return true;
      const days = parseInt(expiryFilter, 10);
      return alert.daysLeft <= days;
    });
  }, [expiryAlerts, expiryFilter, expiryMonthFilter]);

  const handlePrintExpiry = () => {
    setShowExpiryPrint(true);
    setTimeout(() => {
      const afterPrint = () => {
        setShowExpiryPrint(false);
        window.removeEventListener('afterprint', afterPrint);
      };
      window.addEventListener('afterprint', afterPrint);
      window.print();
    }, 100);
  };

  const handleCopyExpiry = () => {
    const header = 'المنتج\tالكود\tتاريخ الانتهاء\tالأيام المتبقية\tالكمية\n';
    const text = filteredExpiryAlerts
      .map(a => `${a.productName}\t${a.productCode}\t${a.expiryDate}\t${a.daysLeft}\t${a.qty}`)
      .join('\n');
    navigator.clipboard.writeText(header + text);
    notify('تم نسخ التقرير للحافظة', 'success');
  };

  const handleShareExpiry = async () => {
    const text = filteredExpiryAlerts
      .map(a => `- ${a.productName} (${a.expiryDate}) [باقي ${a.daysLeft} يوم]`)
      .join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'تنبيهات صلاحية المنتجات',
          text: `تقرير تنبيهات الصلاحية:\n\n${text}`,
        });
      } catch (err) {
        console.error(err);
      }
    } else {
      handleCopyExpiry();
    }
  };

  const checkOpenShift = async () => {
    if (!currentUser) return;
    try {
      const shifts = await db.shifts.getAll();
      const open = shifts.find((s: Shift) => s.userId === currentUser.id && s.status === 'open');
      setCurrentShift(open || null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShiftAction = () => {
    setShiftAmount('');
    setShowShiftModal(true);
  };

  const confirmShiftAction = async () => {
    if (!currentUser) return;
    const amount = shiftAmount === '' ? 0 : parseFloat(shiftAmount);
    if (isNaN(amount) || amount < 0) {
      notify('المبلغ غير صحيح', 'error');
      return;
    }

    if (currentShift) {
      const expectedCash = sumCurrency([currentShift.startCash || 0, stats.sales, -stats.expenses]);
      const difference = Math.round((amount - expectedCash) * 100) / 100;
      const updatedShift: Shift = {
        ...currentShift,
        endTime: new Date().toISOString(),
        status: 'closed',
        endCash: amount,
        expectedCash,
        difference,
      };
      await db.shifts.upsert(updatedShift);
      setCurrentShift(null);
      window.dispatchEvent(new Event('shiftChanged'));
      notify(`تم إغلاق الوردية. الفارق: ${difference.toFixed(2)} ر.س`, 'success');

      await db.activityLogs.add({
        action: 'إغلاق وردية',
        details: `تم إغلاق الوردية رقم ${updatedShift.id.substring(0, 8)} - الفارق: ${difference}`,
        user: currentUser.fullName,
        type: 'info',
      });
    } else {
      const newShift: Shift = {
        id: crypto.randomUUID(),
        userId: currentUser.id,
        userName: currentUser.fullName,
        startTime: new Date().toISOString(),
        startCash: amount,
        status: 'open',
      };
      await db.shifts.upsert(newShift);
      setCurrentShift(newShift);
      window.dispatchEvent(new Event('shiftChanged'));
      notify('تم فتح وردية جديدة', 'success');

      await db.activityLogs.add({
        action: 'فتح وردية',
        details: `تم فتح وردية جديدة - رصيد افتتاحي: ${amount}`,
        user: currentUser.fullName,
        type: 'info',
      });
    }
    setShowShiftModal(false);
  };

  const confirmCashDrawerAction = async () => {
    const val = parseFloat(cashDrawerAmount);
    if (isNaN(val) || val <= 0) {
      notify('المبلغ غير صحيح', 'error');
      return;
    }
    if (currentShift) {
      const nextStartCash =
        cashDrawerAction === 'deposit'
          ? sumCurrency([currentShift.startCash, val])
          : sumCurrency([currentShift.startCash, -val]);
      await db.shifts.upsert({ ...currentShift, startCash: nextStartCash });
      setCurrentShift({ ...currentShift, startCash: nextStartCash });
      window.dispatchEvent(new Event('shiftChanged'));
      notify(
        cashDrawerAction === 'deposit' ? `تم إيداع ${val} ر.س` : `تم سحب ${val} ر.س`,
        'success'
      );
    }
    setShowCashDrawerModal(false);
  };

  const fetchStats = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const [lists, sales, expenses, settings] = await Promise.all([
        db.lists.getAll(),
        db.dailySales.getAll(),
        db.expenses.getAll(),
        db.settings.get(),
      ]);

      const threshold = settings?.expiryAlertDays || 60;
      const typedSales = sales as DailySales[];
      const typedExpenses = expenses as Expense[];
      setSalesData(typedSales);

      const totalSales = sumCurrency(typedSales.map(s => s.totalAmount ?? s.amount ?? 0));
      const totalExpenses = sumCurrency(typedExpenses.map(e => e.amount ?? 0));

      setStats({
        lists: lists.length,
        sales: totalSales,
        expenses: totalExpenses,
      });
      setRecentLists(lists.slice(0, 5));

      const alerts: ExpiryAlert[] = [];
      const today = new Date();

      lists.forEach((list: any) => {
        if (list.rows && Array.isArray(list.rows)) {
          list.rows.forEach((row: ListRow) => {
            if (row.expiryDate && !row.isDismissed) {
              const exp = new Date(row.expiryDate);
              const timeDiff = exp.getTime() - today.getTime();
              const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
              const maxThreshold = Math.max(threshold, 180);
              if (daysDiff <= maxThreshold) {
                alerts.push({
                  listId: list.id,
                  rowId: row.id,
                  productName: row.name,
                  productCode: row.code,
                  expiryDate: row.expiryDate,
                  daysLeft: daysDiff,
                  qty: Number(row.qty) || 0,
                  cartonQty: row.cartonQty,
                  unitId: row.unitId,
                  listType: list.type || 'inventory',
                });
              }
            }
          });
        }
      });
      setExpiryAlerts(alerts.sort((a, b) => a.daysLeft - b.daysLeft));

      const lowStock = products.filter(p => {
        const minThreshold = p.lowStockThreshold ?? 5;
        return minThreshold > 0 && (p.stock || 0) <= minThreshold;
      });
      setLowStockAlerts(lowStock);
    } catch (e) {
      console.error(e);
    } finally {
      if (manual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    checkOpenShift();
  }, [products, currentUser]);

  const getAlertKey = (alertItem: ExpiryAlert) =>
    `${alertItem.listId}::${alertItem.rowId || `${alertItem.productCode}::${alertItem.expiryDate}`}`;

  const handleDismissAlert = async (e: React.MouseEvent, alertItem: ExpiryAlert) => {
    e.stopPropagation();
    if (!alertItem.listId) {
      notify('لا يمكن تحديث هذا العنصر لعدم وجود معرف القائمة.', 'error');
      return;
    }
    const itemKey = getAlertKey(alertItem);
    setIsUpdatingAlert(alertItem.rowId || alertItem.productCode);
    try {
      await db.lists.updateRowDismissed(
        alertItem.listId,
        alertItem.rowId,
        alertItem.productCode,
        alertItem.expiryDate
      );
      setExpiryAlerts(prev => prev.filter(a => getAlertKey(a) !== itemKey));
      setSelectedAlertKeys(prev => prev.filter(k => k !== itemKey));
      notify('تم تجاهل التنبيه', 'info');
    } catch (error) {
      console.error(error);
      notify('فشل تحديث الحالة', 'error');
    } finally {
      setIsUpdatingAlert(null);
    }
  };

  const toggleSelectAlert = (e: React.MouseEvent, idx: number, alertItem: ExpiryAlert) => {
    e.stopPropagation();
    const key = getAlertKey(alertItem);

    if (e.shiftKey && lastSelectedAlertIdx !== null && filteredExpiryAlerts[lastSelectedAlertIdx]) {
      const start = Math.min(lastSelectedAlertIdx, idx);
      const end = Math.max(lastSelectedAlertIdx, idx);
      const rangeKeys = filteredExpiryAlerts.slice(start, end + 1).map(getAlertKey);
      setSelectedAlertKeys(prev => Array.from(new Set([...prev, ...rangeKeys])));
    } else {
      setSelectedAlertKeys(prev =>
        prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      );
      setLastSelectedAlertIdx(idx);
    }
  };

  const toggleSelectAllVisibleAlerts = () => {
    const visibleKeys = filteredExpiryAlerts.map(getAlertKey);
    if (visibleKeys.length === 0) return;
    const allSelected = visibleKeys.every(k => selectedAlertKeys.includes(k));
    if (allSelected) {
      setSelectedAlertKeys(prev => prev.filter(k => !visibleKeys.includes(k)));
    } else {
      setSelectedAlertKeys(prev => Array.from(new Set([...prev, ...visibleKeys])));
    }
  };

  const handleBulkDismissAlerts = async () => {
    const targets = expiryAlerts.filter(a => selectedAlertKeys.includes(getAlertKey(a)));
    if (targets.length === 0) return;
    setIsBulkDismissing(true);
    try {
      await db.lists.updateRowsDismissedBatch(
        targets.map(a => ({
          listId: a.listId,
          rowId: a.rowId,
          productCode: a.productCode,
          expiryDate: a.expiryDate,
        }))
      );
      const dismissedSet = new Set(targets.map(getAlertKey));
      setExpiryAlerts(prev => prev.filter(a => !dismissedSet.has(getAlertKey(a))));
      setSelectedAlertKeys([]);
      setLastSelectedAlertIdx(null);
      notify(`تم تجاهل ${targets.length} تنبيه بنجاح`, 'success');
    } catch (error) {
      console.error(error);
      notify('حدث خطأ أثناء تجاهل التنبيهات المحددة', 'error');
    } finally {
      setIsBulkDismissing(false);
    }
  };

  const chartData = useMemo(() => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    return days.map(day => {
      const matching = salesData.filter(s => (s.date || '').startsWith(day));
      const total = sumCurrency(matching.map(s => s.totalAmount ?? s.amount ?? 0));
      return { day, total, count: matching.length };
    });
  }, [salesData]);

  const maxVal = Math.max(...chartData.map(d => d.total), 1);
  const weekSalesTotal = sumCurrency(chartData.map(d => d.total));
  const points = chartData
    .map((d, i) => `${(i / 6) * 100},${100 - (d.total / maxVal) * 85}`)
    .join(' ');

  const topCustomers = useMemo(() => {
    const map: Record<string, { id: string; name: string; total: number; count: number }> = {};
    salesData.forEach(sale => {
      if (!sale.customerId || !sale.customerName) return;
      if (!map[sale.customerId]) {
        map[sale.customerId] = { id: sale.customerId, name: sale.customerName, total: 0, count: 0 };
      }
      map[sale.customerId].total = sumCurrency([
        map[sale.customerId].total,
        sale.totalAmount ?? sale.amount ?? 0,
      ]);
      map[sale.customerId].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [salesData]);

  const topProducts = useMemo(() => {
    const map: Record<string, { id: string; name: string; total: number; count: number }> = {};
    salesData.forEach(sale => {
      if (!sale.cart) return;
      sale.cart.forEach(item => {
        if (!map[item.productId]) {
          map[item.productId] = {
            id: item.productId,
            name: item.name || 'منتج',
            total: 0,
            count: 0,
          };
        }
        map[item.productId].total = sumCurrency([
          map[item.productId].total,
          (item.price || 0) * (item.quantity || 0),
        ]);
        map[item.productId].count += item.quantity || 0;
      });
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [salesData]);

  const netProfit = sumCurrency([stats.sales, -stats.expenses]);
  const expectedDrawer = currentShift
    ? sumCurrency([currentShift.startCash || 0, stats.sales, -stats.expenses])
    : 0;
  const todayFormatted = new Date().toLocaleDateString('ar-SA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const printContainer = document.getElementById('print-container');
  const printContent = showExpiryPrint ? (
    <div className="bg-white z-[9999] overflow-auto print:static print:h-auto print:overflow-visible">
      <ReportLayout
        printOnly={true}
        title="تقرير تنبيهات صلاحية المنتجات"
        subtitle={`تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`}
      >
        <div className="p-4 print:p-0">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300 print:bg-gray-200">
                <th className="p-3 border border-gray-200">المنتج</th>
                <th className="p-3 border border-gray-200">الكود</th>
                <th className="p-3 border border-gray-200">تاريخ الانتهاء</th>
                <th className="p-3 border border-gray-200">الأيام المتبقية</th>
                <th className="p-3 border border-gray-200">الكمية</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpiryAlerts.map((alert, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3 border border-gray-200 font-bold">{alert.productName}</td>
                  <td className="p-3 border border-gray-200 font-mono">{alert.productCode}</td>
                  <td className="p-3 border border-gray-200 font-mono" dir="ltr">
                    {alert.expiryDate}
                  </td>
                  <td className="p-3 border border-gray-200 font-bold text-red-600 tabular-nums">
                    {alert.daysLeft} يوم
                  </td>
                  <td className="p-3 border border-gray-200 font-mono tabular-nums">{alert.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between text-sm text-gray-500">
            <span>عدد التنبيهات: {filteredExpiryAlerts.length}</span>
            <span>تقرير الصلاحية</span>
          </div>
        </div>
      </ReportLayout>
    </div>
  ) : null;

  return (
    <>
      {showExpiryPrint && printContainer && createPortal(printContent, printContainer)}

      <div className="space-y-6 pb-10 text-slate-900 dark:text-slate-100" dir="rtl">
        {/* TOP HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              لوحة القيادة
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
              <span>ملخص الأداء والعمليات اليومية</span>
              <span aria-hidden="true">·</span>
              <span>{todayFormatted}</span>
              {currentShift && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    وردية نشطة ({currentShift.userName})
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => fetchStats(true)}
              disabled={isRefreshing}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/12 bg-white dark:bg-[#242424] hover:bg-slate-50 dark:hover:bg-white/10 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              title="تحديث البيانات"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              <span>تحديث</span>
            </button>

            <button
              type="button"
              onClick={handleShiftAction}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 whitespace-nowrap shrink-0 border transition-colors ${
                currentShift
                  ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-950/70'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
              }`}
            >
              {currentShift ? <LogOut size={15} /> : <LogIn size={15} />}
              <span>{currentShift ? 'إغلاق الوردية' : 'بدء وردية جديدة'}</span>
            </button>
          </div>
        </div>

        {/* 4-COLUMN KPI STRIP */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => switchToTab('reports_center')}
            className="text-right bg-white dark:bg-[#242424] border border-slate-200 dark:border-white/10 hover:border-sap-primary/50 dark:hover:border-[#60CDFF]/50 rounded-2xl p-5 transition-colors group"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                إجمالي المبيعات
              </span>
              <span className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <DollarSign size={18} />
              </span>
            </div>
            <div className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
              {stats.sales.toLocaleString()} <span className="text-xs font-bold text-slate-400">ر.س</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5 flex items-center justify-between">
              <span className="tabular-nums">{salesData.length} فاتورة مسجلة</span>
              <ArrowUpLeft size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-sap-primary dark:text-[#60CDFF]" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => switchToTab('expenses')}
            className="text-right bg-white dark:bg-[#242424] border border-slate-200 dark:border-white/10 hover:border-sap-primary/50 dark:hover:border-[#60CDFF]/50 rounded-2xl p-5 transition-colors group"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                صافي الدخل التقريبي
              </span>
              <span
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  netProfit >= 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                }`}
              >
                <Wallet size={18} />
              </span>
            </div>
            <div className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
              {netProfit.toLocaleString()} <span className="text-xs font-bold text-slate-400">ر.س</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5 flex items-center justify-between">
              <span className="tabular-nums">المصروفات: {stats.expenses.toLocaleString()} ر.س</span>
              <ArrowUpLeft size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-sap-primary dark:text-[#60CDFF]" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => switchToTab('products')}
            className="text-right bg-white dark:bg-[#242424] border border-slate-200 dark:border-white/10 hover:border-sap-primary/50 dark:hover:border-[#60CDFF]/50 rounded-2xl p-5 transition-colors group"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                المنتجات المسجلة
              </span>
              <span className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Package size={18} />
              </span>
            </div>
            <div className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
              {products.length.toLocaleString()} <span className="text-xs font-bold text-slate-400">صنف</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5 flex items-center justify-between">
              <span className={`tabular-nums ${lowStockAlerts.length > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}`}>
                {lowStockAlerts.length > 0 ? `${lowStockAlerts.length} صنف مخزونه منخفض` : `${units.length} وحدة قياس نشطة`}
              </span>
              <ArrowUpLeft size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-sap-primary dark:text-[#60CDFF]" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => switchToTab('list')}
            className="text-right bg-white dark:bg-[#242424] border border-slate-200 dark:border-white/10 hover:border-sap-primary/50 dark:hover:border-[#60CDFF]/50 rounded-2xl p-5 transition-colors group"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                سجلات الجرد والصلاحية
              </span>
              <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                <FileText size={18} />
              </span>
            </div>
            <div className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
              {stats.lists.toLocaleString()} <span className="text-xs font-bold text-slate-400">مستند</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5 flex items-center justify-between">
              <span className={`tabular-nums ${expiryAlerts.length > 0 ? 'text-red-600 dark:text-red-400 font-bold' : ''}`}>
                {expiryAlerts.length > 0 ? `${expiryAlerts.length} تنبيه صلاحية نشط` : 'لا توجد تنبيهات صلاحية'}
              </span>
              <ArrowUpLeft size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-sap-primary dark:text-[#60CDFF]" />
            </div>
          </button>
        </div>

        {/* QUICK ACTIONS BAR */}
        <div className="bg-white dark:bg-[#242424] border border-slate-200 dark:border-white/10 rounded-2xl p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { label: 'نقطة البيع', icon: ShoppingBag, action: 'pos' },
              { label: 'جرد جديد', icon: Plus, action: 'list' },
              { label: 'استوديو الشاشات', icon: Monitor, action: 'price_groups' },
              { label: 'المصروفات', icon: TrendingDown, action: 'expenses' },
              { label: 'ملصقات الباركود', icon: Printer, action: 'price_tags' },
              { label: 'التقارير', icon: FileText, action: 'reports_center' },
            ].map(item => (
              <button
                key={item.action}
                type="button"
                onClick={() => switchToTab(item.action)}
                className="flex items-center justify-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:text-sap-primary dark:hover:text-[#60CDFF] text-xs font-bold transition-colors whitespace-nowrap shrink-0"
              >
                <item.icon size={16} className="shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* EXPIRY ALERTS TABLE */}
        {expiryAlerts.length > 0 && (
          <div className="bg-white dark:bg-[#242424] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-black text-sm text-slate-900 dark:text-white">
                      تنبيهات صلاحية المنتجات
                    </h2>
                    <span className="text-xs font-bold text-red-600 dark:text-red-400 tabular-nums">
                      · {filteredExpiryAlerts.length} تنبيه
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    اضغط على أي صف للانتقال مباشرة إلى سطر الصنف في قائمة الجرد
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="flex p-1 bg-slate-100 dark:bg-white/8 rounded-xl text-xs font-bold">
                  {[
                    { id: '7' as const, label: '7 أيام' },
                    { id: '30' as const, label: '30 يوم' },
                    { id: '60' as const, label: '60 يوم' },
                    { id: 'all' as const, label: 'الكل' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setExpiryFilter(tab.id);
                        setExpiryMonthFilter('all');
                      }}
                      className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                        expiryMonthFilter === 'all' && expiryFilter === tab.id
                          ? 'bg-white dark:bg-[#323232] text-red-600 dark:text-red-400 shadow-xs font-black'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {availableExpiryMonths.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={expiryMonthFilter}
                      onChange={e => setExpiryMonthFilter(e.target.value)}
                      aria-label="تصفية حسب الشهر"
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold outline-none transition-colors cursor-pointer ${
                        expiryMonthFilter !== 'all'
                          ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300'
                          : 'bg-white dark:bg-[#2C2C2C] border-slate-200 dark:border-white/12 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <option value="all">كل الشهور</option>
                      {availableExpiryMonths.map(m => (
                        <option key={m.ym} value={m.ym}>
                          {m.label}
                        </option>
                      ))}
                    </select>

                    {expiryMonthFilter !== 'all' && filteredExpiryAlerts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const monthKeys = filteredExpiryAlerts.map(getAlertKey);
                          setSelectedAlertKeys(prev => Array.from(new Set([...prev, ...monthKeys])));
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
                      >
                        تحديد {availableExpiryMonths.find(m => m.ym === expiryMonthFilter)?.shortLabel || 'الشهر'} ({filteredExpiryAlerts.length})
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowExtraColumns(!showExtraColumns)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap transition-colors ${
                    showExtraColumns
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                      : 'border-slate-200 dark:border-white/12 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/8'
                  }`}
                >
                  {showExtraColumns ? 'إخفاء الكميات' : 'عرض الكميات'}
                </button>

                <button
                  type="button"
                  onClick={
                    notificationPermission === 'granted'
                      ? testDesktopNotification
                      : requestNotificationPermission
                  }
                  className="p-2 rounded-xl border border-slate-200 dark:border-white/12 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/8 transition-colors"
                  title="إشعارات سطح المكتب"
                >
                  {notificationPermission === 'granted' ? (
                    <BellRing size={15} className="text-emerald-600 dark:text-emerald-400" />
                  ) : notificationPermission === 'denied' ? (
                    <BellOff size={15} className="text-red-500" />
                  ) : (
                    <Bell size={15} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handlePrintExpiry}
                  className="p-2 rounded-xl border border-slate-200 dark:border-white/12 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/8 transition-colors"
                  title="طباعة التقرير"
                >
                  <Printer size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleCopyExpiry}
                  className="p-2 rounded-xl border border-slate-200 dark:border-white/12 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/8 transition-colors"
                  title="نسخ"
                >
                  <Copy size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleShareExpiry}
                  className="p-2 rounded-xl border border-slate-200 dark:border-white/12 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/8 transition-colors"
                  title="مشاركة"
                >
                  <Share2 size={15} />
                </button>
              </div>
            </div>

            {selectedAlertKeys.length > 0 && (
              <div className="px-5 py-2.5 bg-red-50/85 dark:bg-red-950/30 border-b border-red-200/80 dark:border-red-900/40 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                  تم تحديد <span className="font-black text-red-600 dark:text-red-400">{selectedAlertKeys.length}</span> صف
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAlertKeys([]);
                      setLastSelectedAlertIdx(null);
                    }}
                    disabled={isBulkDismissing}
                    className="px-3 py-1 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/8 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/14 transition-colors"
                  >
                    إلغاء التحديد
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDismissAlerts}
                    disabled={isBulkDismissing}
                    className="px-3.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-black transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {isBulkDismissing ? 'جاري التجاهل...' : `تجاهل المحدد (${selectedAlertKeys.length})`}
                  </button>
                </div>
              </div>
            )}

            {filteredExpiryAlerts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-bold flex flex-col items-center justify-center gap-2">
                <CheckCircle className="text-emerald-500" size={28} />
                <span className="text-xs">لا توجد منتجات منتهية أو قريبة من الانتهاء ضمن هذه المدة.</span>
              </div>
            ) : (
              <div className="max-h-[260px] overflow-auto custom-scrollbar">
                <table className="w-full text-right text-xs min-w-[640px]">
                  <thead className="text-slate-500 dark:text-slate-400 font-bold sticky top-0 bg-slate-50 dark:bg-[#1E1E1E] border-b border-slate-200 dark:border-white/10 z-10">
                    <tr>
                      <th className="px-3 py-2.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filteredExpiryAlerts.length > 0 &&
                            filteredExpiryAlerts.every(a => selectedAlertKeys.includes(getAlertKey(a)))
                          }
                          onChange={toggleSelectAllVisibleAlerts}
                          aria-label="تحديد الكل"
                          title="تحديد أو إلغاء تحديد جميع الصفوف الظاهرة"
                          className="w-4 h-4 rounded border-slate-300 dark:border-white/25 accent-red-600 cursor-pointer align-middle"
                        />
                      </th>
                      <th className="px-4 py-2.5">الكود</th>
                      <th className="px-4 py-2.5">اسم المنتج</th>
                      {showExtraColumns && <th className="px-4 py-2.5">الكراتين</th>}
                      {showExtraColumns && <th className="px-4 py-2.5">الكمية</th>}
                      {showExtraColumns && <th className="px-4 py-2.5">الوحدة</th>}
                      <th className="px-4 py-2.5">تاريخ الانتهاء</th>
                      <th className="px-4 py-2.5">الحالة</th>
                      <th className="px-4 py-2.5 text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/6">
                    {filteredExpiryAlerts.map((alert, idx) => {
                      const rowKey = getAlertKey(alert);
                      const isRowSelected = selectedAlertKeys.includes(rowKey);
                      return (
                        <tr
                          key={`${rowKey}-${idx}`}
                          onClick={() => onNavigateToList?.(alert.listId, alert.rowId)}
                          className={`transition-colors cursor-pointer ${
                            isRowSelected
                              ? 'bg-red-50/70 dark:bg-red-950/25 hover:bg-red-100/70 dark:hover:bg-red-950/35'
                              : 'hover:bg-slate-50 dark:hover:bg-white/5'
                          }`}
                        >
                          <td
                            className="px-3 py-2.5 text-center"
                            onClick={e => toggleSelectAlert(e, idx, alert)}
                          >
                            <input
                              type="checkbox"
                              checked={isRowSelected}
                              onChange={() => {}}
                              aria-label={`تحديد ${alert.productName}`}
                              className="w-4 h-4 rounded border-slate-300 dark:border-white/25 accent-red-600 cursor-pointer align-middle"
                            />
                          </td>
                          <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                            {alert.productCode || '-'}
                          </td>
                          <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-100">
                            {alert.productName}
                          </td>
                          {showExtraColumns && (
                            <td className="px-4 py-2.5 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                              {alert.cartonQty || '-'}
                            </td>
                          )}
                          {showExtraColumns && (
                            <td className="px-4 py-2.5 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                              {alert.qty || '-'}
                            </td>
                          )}
                          {showExtraColumns && (
                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                              {units.find(u => u.id === alert.unitId)?.name || '-'}
                            </td>
                          )}
                          <td className="px-4 py-2.5 font-mono font-bold text-red-600 dark:text-red-400 tabular-nums">
                            {alert.expiryDate}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`text-[11px] font-bold tabular-nums ${
                                alert.daysLeft <= 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : alert.daysLeft <= 7
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {alert.daysLeft <= 0 ? 'منتهي الصلاحية' : `باقي ${alert.daysLeft} يوم`}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={e => handleDismissAlert(e, alert)}
                              disabled={isUpdatingAlert === (alert.rowId || alert.productCode) || isBulkDismissing}
                              className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            >
                              تجاهل
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* BALANCED 2-COLUMN WORKSPACE SPLIT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Primary Analytics & Inventory Operations (8 cols) */}
          <div className="lg:col-span-8 space-y-5">
            {/* 7-Day Sales Curve */}
            <div className="bg-white dark:bg-[#242424] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp size={18} className="text-sap-primary dark:text-[#60CDFF]" />
                    <span>منحنى المبيعات (آخر 7 أيام)</span>
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    إجمالي الأسبوع: {weekSalesTotal.toLocaleString()} ر.س
                  </p>
                </div>

                {hoveredDayIdx !== null && chartData[hoveredDayIdx] && (
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                    {new Date(chartData[hoveredDayIdx].day).toLocaleDateString('ar-SA', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'short',
                    })}{' '}
                    — {chartData[hoveredDayIdx].total.toLocaleString()} ر.س (
                    {chartData[hoveredDayIdx].count} فاتورة)
                  </div>
                )}
              </div>

              <div className="h-48 relative px-2">
                {/* Horizontal subtle guide lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  <div className="border-b border-dashed border-slate-200/70 dark:border-white/8" />
                  <div className="border-b border-dashed border-slate-200/70 dark:border-white/8" />
                  <div className="border-b border-dashed border-slate-200/70 dark:border-white/8" />
                </div>

                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible relative z-10">
                  <defs>
                    <linearGradient id="dashSalesGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#0078D4" stopOpacity="0.24" />
                      <stop offset="100%" stopColor="#0078D4" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`M0,100 ${points.split(' ').map(p => 'L' + p).join(' ')} L100,100 Z`}
                    fill="url(#dashSalesGrad)"
                  />
                  <polyline
                    points={points}
                    fill="none"
                    stroke="#0078D4"
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {chartData.map((d, i) => (
                    <circle
                      key={d.day}
                      cx={`${(i / 6) * 100}`}
                      cy={`${100 - (d.total / maxVal) * 85}`}
                      r={hoveredDayIdx === i ? '5.5' : '3.5'}
                      fill="#ffffff"
                      stroke="#0078D4"
                      strokeWidth="2.5"
                      vectorEffect="non-scaling-stroke"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredDayIdx(i)}
                      onMouseLeave={() => setHoveredDayIdx(null)}
                    />
                  ))}
                </svg>
              </div>

              <div className="grid grid-cols-7 gap-1 mt-4 pt-3 border-t border-slate-100 dark:border-white/8 text-[11px]">
                {chartData.map((d, idx) => (
                  <button
                    key={d.day}
                    type="button"
                    onMouseEnter={() => setHoveredDayIdx(idx)}
                    onMouseLeave={() => setHoveredDayIdx(null)}
                    className={`text-center py-1 rounded-lg transition-colors ${
                      hoveredDayIdx === idx ? 'bg-slate-100 dark:bg-white/8' : ''
                    }`}
                  >
                    <div className="font-bold text-slate-500 dark:text-slate-400">
                      {new Date(d.day).toLocaleDateString('ar-SA', { weekday: 'short' })}
                    </div>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums mt-0.5">
                      {d.total > 0 ? d.total.toLocaleString() : '-'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Operational Lists Pair: Low Stock + Recent Inventory Lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Low Stock List */}
              <div className="bg-white dark:bg-[#242424] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500" />
                    <span>نواقص المخزون</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => switchToTab('products')}
                    className="text-[11px] font-bold text-sap-primary dark:text-[#60CDFF] hover:underline"
                  >
                    إدارة المنتجات
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar flex-1">
                  {lowStockAlerts.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-xs flex flex-col items-center gap-2">
                      <CheckCircle size={24} className="text-emerald-500" />
                      <span className="font-bold">جميع المنتجات متوفرة بكميات جيدة</span>
                    </div>
                  ) : (
                    lowStockAlerts.slice(0, 8).map(p => (
                      <div
                        key={p.id}
                        onClick={() => switchToTab('products')}
                        className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/6 border border-slate-100 dark:border-white/6 cursor-pointer transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                            {p.code} · الحد الأدنى {p.lowStockThreshold ?? 5}
                          </div>
                        </div>
                        <span className="text-xs font-black font-mono tabular-nums text-red-600 dark:text-red-400 shrink-0">
                          المتوفر {p.stock || 0}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Inventory & Receipt Lists */}
              <div className="bg-white dark:bg-[#242424] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText size={16} className="text-sap-primary dark:text-[#60CDFF]" />
                    <span>أحدث قوائم الجرد</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => switchToTab('list')}
                    className="text-[11px] font-bold text-sap-primary dark:text-[#60CDFF] hover:underline"
                  >
                    جرد جديد
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar flex-1">
                  {recentLists.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-xs flex flex-col items-center gap-3">
                      <FileText size={24} className="text-slate-300 dark:text-slate-600" />
                      <span className="font-bold">لا توجد قوائم جرد محفوظة بعد</span>
                      <button
                        type="button"
                        onClick={() => switchToTab('list')}
                        className="px-3.5 py-1.5 rounded-lg bg-sap-primary text-white text-xs font-bold"
                      >
                        إنشاء أول قائمة جرد
                      </button>
                    </div>
                  ) : (
                    recentLists.map(list => (
                      <div
                        key={list.id}
                        onClick={() => onNavigateToList?.(list.id)}
                        className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/6 border border-slate-100 dark:border-white/6 cursor-pointer transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                            {list.name || 'قائمة جرد'}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 tabular-nums">
                            <Calendar size={11} />
                            <span>{list.date}</span>
                            <span>·</span>
                            <span>{list.type === 'receipt' ? 'استلام' : 'جرد'}</span>
                          </div>
                        </div>
                        <span className="text-xs font-bold font-mono tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                          {list.rows?.length || 0} صنف
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Side Column: POS Launch, Shift Cash & Rankings (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            {/* POS Launch & Active Shift Card */}
            <div className="bg-slate-900 dark:bg-[#181818] text-white p-6 rounded-2xl border border-slate-800 dark:border-white/12 flex flex-col justify-between gap-5">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Zap size={20} className="text-[#60CDFF]" />
                  </div>
                  {currentShift && (
                    <span className="text-[11px] font-bold text-emerald-400 tabular-nums">
                      الوردية مفتوحة · {new Date(currentShift.startTime).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-black mb-1.5">نقطة البيع والكاشير</h3>
                <p className="text-slate-400 text-xs font-semibold leading-relaxed">
                  ابدأ إصدار الفواتير ومراجعة الدرج النقدي بسرعة وسلاسة.
                </p>
              </div>

              {currentShift && (
                <div className="pt-3 border-t border-white/10 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">الرصيد المتوقع في الدرج</span>
                    <span className="font-mono font-black text-emerald-400 tabular-nums">
                      {expectedDrawer.toLocaleString()} ر.س
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCashDrawerAction('deposit');
                        setCashDrawerAmount('');
                        setShowCashDrawerModal(true);
                      }}
                      className="py-1.5 px-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-emerald-300 font-bold text-xs transition-colors"
                    >
                      + إيداع نقدي
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCashDrawerAction('withdraw');
                        setCashDrawerAmount('');
                        setShowCashDrawerModal(true);
                      }}
                      className="py-1.5 px-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-red-300 font-bold text-xs transition-colors"
                    >
                      - سحب نقدي
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => switchToTab('pos')}
                className="w-full py-3 bg-[#0078D4] hover:bg-[#106EBE] text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <ShoppingBag size={16} />
                <span>فتح الكاشير</span>
              </button>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white dark:bg-[#242424] border border-slate-200 dark:border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Clock size={15} className="text-slate-500" />
                  <span>آخر العمليات</span>
                </h4>
                <button
                  type="button"
                  onClick={() => switchToTab('reports_center')}
                  className="text-[11px] font-bold text-sap-primary dark:text-[#60CDFF] hover:underline"
                >
                  السجل الكامل
                </button>
              </div>

              <div className="space-y-2">
                {salesData.slice(0, 5).map(sale => {
                  const val = sale.totalAmount ?? sale.amount ?? 0;
                  return (
                    <div
                      key={sale.id}
                      className="flex justify-between items-center py-2 px-3 bg-slate-50 dark:bg-white/5 rounded-xl"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate">
                          {sale.customerName || 'مبيعات عامة'}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {sale.date?.split('T')[0]}
                        </div>
                      </div>
                      <div
                        className={`font-black font-mono text-xs tabular-nums shrink-0 ${
                          val >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {val >= 0 ? `+${val.toLocaleString()}` : val.toLocaleString()} ر.س
                      </div>
                    </div>
                  );
                })}
                {salesData.length === 0 && (
                  <div className="text-center text-slate-400 text-xs py-6 font-bold">
                    لا توجد عمليات مسجلة بعد
                  </div>
                )}
              </div>
            </div>

            {/* Unified Rankings Card: Top Products / Top Customers */}
            <div className="bg-white dark:bg-[#242424] border border-slate-200 dark:border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Crown size={15} className="text-amber-500" />
                  <span>الأعلى أداءً</span>
                </h3>
                <div className="flex p-0.5 bg-slate-100 dark:bg-white/8 rounded-lg text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setRankingTab('products')}
                    className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                      rankingTab === 'products'
                        ? 'bg-white dark:bg-[#323232] text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    المنتجات
                  </button>
                  <button
                    type="button"
                    onClick={() => setRankingTab('customers')}
                    className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                      rankingTab === 'customers'
                        ? 'bg-white dark:bg-[#323232] text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    العملاء
                  </button>
                </div>
              </div>

              {rankingTab === 'products' ? (
                <div className="space-y-2">
                  {topProducts.length === 0 ? (
                    <div className="text-center text-slate-400 text-xs py-6 font-bold">
                      لا توجد بيانات مبيعات منتجات كافية
                    </div>
                  ) : (
                    topProducts.map((p, idx) => (
                      <div
                        key={p.id}
                        className="flex justify-between items-center py-2 px-3 rounded-xl bg-slate-50 dark:bg-white/5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-[11px] font-black flex items-center justify-center shrink-0 tabular-nums">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                              {p.name}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                              {p.count} قطعة مباعة
                            </div>
                          </div>
                        </div>
                        <span className="font-black text-xs font-mono tabular-nums text-slate-900 dark:text-white shrink-0">
                          {p.total.toLocaleString()} ر.س
                        </span>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {topCustomers.length === 0 ? (
                    <div className="text-center text-slate-400 text-xs py-6 font-bold">
                      لا توجد مبيعات مرتبطة بعملاء بعد
                    </div>
                  ) : (
                    topCustomers.map((c, idx) => (
                      <div
                        key={c.id}
                        className="flex justify-between items-center py-2 px-3 rounded-xl bg-slate-50 dark:bg-white/5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-[11px] font-black flex items-center justify-center shrink-0 tabular-nums">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                              {c.name}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                              {c.count} عملية شراء
                            </div>
                          </div>
                        </div>
                        <span className="font-black text-xs font-mono tabular-nums text-slate-900 dark:text-white shrink-0">
                          {c.total.toLocaleString()} ر.س
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Shift Modal */}
      {showShiftModal && (
        <div
          className="fixed inset-0 bg-black/55 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setShowShiftModal(false)}
        >
          <div
            className="bg-white dark:bg-[#242424] w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-white/12 overflow-hidden flex flex-col text-slate-900 dark:text-slate-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-50 dark:bg-[#1E1E1E] border-b border-slate-200 dark:border-white/10 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                {currentShift ? (
                  <LogOut size={18} className="text-red-500" />
                ) : (
                  <LogIn size={18} className="text-emerald-500" />
                )}
                {currentShift ? 'إغلاق الوردية الحالية' : 'بدء وردية جديدة'}
              </h3>
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                {currentShift ? 'المبلغ النقدي في الدرج عند الإغلاق:' : 'المبلغ النقدي الافتتاحي:'}
              </label>
              <input
                type="number"
                value={shiftAmount}
                onChange={e => setShiftAmount(e.target.value)}
                className="w-full p-3 bg-white dark:bg-[#1A1A1A] border border-slate-300 dark:border-white/15 rounded-xl focus:outline-none focus:border-[#0078D4] mb-6 text-xl font-mono text-center tabular-nums"
                placeholder="0.00"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') confirmShiftAction();
                }}
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowShiftModal(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs hover:bg-slate-200 dark:hover:bg-white/15 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmShiftAction}
                  className={`flex-1 py-2.5 px-4 text-white rounded-xl font-bold text-xs transition-colors ${
                    currentShift ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  تأكيد
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Drawer Modal */}
      {showCashDrawerModal && (
        <div
          className="fixed inset-0 bg-black/55 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setShowCashDrawerModal(false)}
        >
          <div
            className="bg-white dark:bg-[#242424] w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-white/12 overflow-hidden flex flex-col text-slate-900 dark:text-slate-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-50 dark:bg-[#1E1E1E] border-b border-slate-200 dark:border-white/10 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Wallet
                  size={18}
                  className={cashDrawerAction === 'deposit' ? 'text-emerald-500' : 'text-red-500'}
                />
                {cashDrawerAction === 'deposit' ? 'إيداع نقدي (نثريات واردة)' : 'سحب نقدي (نثريات صادرة)'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCashDrawerModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                المبلغ:
              </label>
              <input
                type="number"
                value={cashDrawerAmount}
                onChange={e => setCashDrawerAmount(e.target.value)}
                className="w-full p-3 bg-white dark:bg-[#1A1A1A] border border-slate-300 dark:border-white/15 rounded-xl focus:outline-none focus:border-[#0078D4] mb-6 text-xl font-mono text-center tabular-nums"
                placeholder="0.00"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') confirmCashDrawerAction();
                }}
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCashDrawerModal(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs hover:bg-slate-200 dark:hover:bg-white/15 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmCashDrawerAction}
                  className={`flex-1 py-2.5 px-4 text-white rounded-xl font-bold text-xs transition-colors ${
                    cashDrawerAction === 'deposit'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  تأكيد
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
