import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  ShoppingBag,
  FolderOpen,
  FileText,
  Package,
  AlertTriangle,
  Percent,
  Tag,
  BookOpen,
  Monitor,
  ChevronLeft,
  Plus,
  X,
  GripVertical,
  SlidersHorizontal,
  StickyNote,
  BarChart4,
  Star,
  Check,
  Trash2,
  Clock,
  Calendar,
  RefreshCw,
  Snowflake,
} from 'lucide-react';
import { Product, DailySales, ListRow } from '../types';
import { db } from '../services/supabase';
import { DesktopAppDef } from './FileManager';

export type DesktopWidgetId =
  | 'clock_summary'
  | 'sales_pulse'
  | 'expiry_alerts'
  | 'inventory_alert'
  | 'quick_apps'
  | 'price_offers'
  | 'quick_notes';

export interface DesktopWidgetCatalogItem {
  id: DesktopWidgetId;
  title: string;
  description: string;
  requiredAppIds?: string[];
}

export const DESKTOP_WIDGET_CATALOG: DesktopWidgetCatalogItem[] = [
  {
    id: 'clock_summary',
    title: 'الساعة والبحث السريع',
    description: 'الوقت والتاريخ وتحية المستخدم مع زر البحث السريع Ctrl+K',
  },
  {
    id: 'sales_pulse',
    title: 'ويدجت المبيعات',
    description: 'ملخص مبيعات اليوم وعدد الفواتير وفتح نقطة البيع',
    requiredAppIds: ['dashboard', 'pos'],
  },
  {
    id: 'expiry_alerts',
    title: 'ويدجت تنبيهات الصلاحية',
    description: 'متابعة الأصناف المنتهية والقريبة من الانتهاء والانتقال السريع للجرد',
    requiredAppIds: ['dashboard', 'list', 'products'],
  },
  {
    id: 'inventory_alert',
    title: 'ويدجت المخزون والنواقص',
    description: 'عدد الأصناف وتنبيهات انخفاض الكمية والوصول للجرد',
    requiredAppIds: ['products', 'list'],
  },
  {
    id: 'quick_apps',
    title: 'ويدجت التطبيقات المفضلة',
    description: 'وصول سريع لأكثر البرامج استخداماً في المفضلة',
  },
  {
    id: 'price_offers',
    title: 'ويدجت الأسعار والعروض',
    description: 'اختصارات شاشات الأسعار والملصقات والعروض والكتالوج',
    requiredAppIds: ['price_groups', 'chicken_prices', 'offers', 'price_tags', 'catalog'],
  },
  {
    id: 'quick_notes',
    title: 'ويدجت الملاحظات السريعة',
    description: 'مفكرة سريعة لتدوين مهام اليوم وتُحفظ تلقائياً',
  },
];

export const DEFAULT_ACTIVE_WIDGETS: DesktopWidgetId[] = [
  'clock_summary',
  'sales_pulse',
  'expiry_alerts',
  'inventory_alert',
  'quick_apps',
];

interface DesktopWidgetsProps {
  variant: 'desktop' | 'board';
  isLightSurface: boolean;
  activeWidgets: DesktopWidgetId[];
  onReorderWidgets: (nextOrder: DesktopWidgetId[]) => void;
  onToggleWidget: (id: DesktopWidgetId) => void;
  onOpenPickerModal: () => void;
  onHideDesktopWidgets?: () => void;
  onCloseBoard?: () => void;
  timeFormatted: string;
  dateFormatted: string;
  userFullName: string;
  products: Product[];
  dailySales: DailySales[];
  permittedApps: DesktopAppDef[];
  favorites: string[];
  onOpenApp: (appId: string) => void;
  onNavigateToList?: (listId: string, rowId?: string) => void;
  onOpenSearch: () => void;
}

interface WidgetExpiryAlert {
  listId: string;
  rowId: string;
  productName: string;
  expiryDate: string;
  daysLeft: number;
  qty: number;
}

export const DesktopWidgets: React.FC<DesktopWidgetsProps> = ({
  variant,
  isLightSurface,
  activeWidgets,
  onReorderWidgets,
  onToggleWidget,
  onOpenPickerModal,
  onHideDesktopWidgets,
  onCloseBoard,
  timeFormatted,
  dateFormatted,
  userFullName,
  products,
  dailySales,
  permittedApps,
  favorites,
  onOpenApp,
  onNavigateToList,
  onOpenSearch,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState<DesktopWidgetId | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<DesktopWidgetId | null>(null);
  const [expiryAlerts, setExpiryAlerts] = useState<WidgetExpiryAlert[]>([]);
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expired' | '30'>('all');
  const [loadingExpiry, setLoadingExpiry] = useState(false);
  const [quickNote, setQuickNote] = useState<string>(() => {
    try {
      return localStorage.getItem('sf_desktop_quick_note_v1') || '';
    } catch {
      return '';
    }
  });

  const loadExpiryAlerts = useCallback(async () => {
    setLoadingExpiry(true);
    try {
      const [lists, settings] = await Promise.all([db.lists.getAll(), db.settings.get()]);
      const threshold = settings?.expiryAlertDays || 60;
      const maxThreshold = Math.max(threshold, 180);
      const today = new Date();
      const collected: WidgetExpiryAlert[] = [];

      lists.forEach((list: any) => {
        if (list.rows && Array.isArray(list.rows)) {
          list.rows.forEach((row: ListRow) => {
            if (row.expiryDate && !row.isDismissed) {
              const exp = new Date(row.expiryDate);
              if (isNaN(exp.getTime())) return;
              const daysDiff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 3600 * 24));
              if (daysDiff <= maxThreshold) {
                collected.push({
                  listId: list.id,
                  rowId: row.id,
                  productName: row.name || 'صنف غير مسمى',
                  expiryDate: row.expiryDate,
                  daysLeft: daysDiff,
                  qty: Number(row.qty) || 0,
                });
              }
            }
          });
        }
      });
      collected.sort((a, b) => a.daysLeft - b.daysLeft);
      setExpiryAlerts(collected);
    } catch {
      // ignore offline or fetch errors cleanly
    } finally {
      setLoadingExpiry(false);
    }
  }, []);

  useEffect(() => {
    if (activeWidgets.includes('expiry_alerts')) {
      loadExpiryAlerts();
    }
  }, [activeWidgets, loadExpiryAlerts]);

  const handleNoteChange = (val: string) => {
    setQuickNote(val);
    try {
      localStorage.setItem('sf_desktop_quick_note_v1', val);
    } catch {
      // Ignore storage quota errors
    }
  };

  const hasApp = (id: string) => permittedApps.some(a => a.id === id);

  const visibleWidgets = activeWidgets.filter(id => {
    const def = DESKTOP_WIDGET_CATALOG.find(c => c.id === id);
    if (!def) return false;
    if (!def.requiredAppIds || def.requiredAppIds.length === 0) return true;
    return def.requiredAppIds.some(req => hasApp(req));
  });

  // Metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = dailySales.filter(s => (s.date || '').startsWith(todayStr));
  const todayAmount =
    todaySales.reduce((sum, s) => sum + Math.round((Number(s.totalAmount ?? s.amount) || 0) * 100), 0) / 100;
  const avgInvoice = todaySales.length > 0 ? Math.round((todayAmount / todaySales.length) * 100) / 100 : 0;

  const lowStockItems = products.filter(p => (p.stock ?? 0) <= (p.lowStockThreshold ?? 5));
  const favoriteApps = permittedApps.filter(a => favorites.includes(a.id)).slice(0, 6);
  const fallbackQuickApps =
    favoriteApps.length > 0
      ? favoriteApps
      : permittedApps.filter(a => ['file_manager', 'pos', 'products', 'list', 'dashboard', 'price_groups'].includes(a.id)).slice(0, 6);

  const cardSurface =
    variant === 'board'
      ? 'bg-white/85 dark:bg-white/6 border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-slate-100'
      : isLightSurface
      ? 'bg-white/85 border-slate-300/80 text-slate-900'
      : 'bg-[#202020]/82 border-white/12 text-white';

  const mutedText =
    variant === 'board'
      ? 'text-slate-500 dark:text-slate-400'
      : isLightSurface
      ? 'text-slate-500'
      : 'text-slate-300/80';

  const subtleBox =
    variant === 'board'
      ? 'bg-slate-100/80 dark:bg-white/5 border-slate-200/70 dark:border-white/8 hover:bg-slate-200/70 dark:hover:bg-white/10'
      : isLightSurface
      ? 'bg-slate-100/85 border-slate-200/80 hover:bg-slate-200/70'
      : 'bg-white/8 border-white/10 hover:bg-white/14';

  const handleWidgetDrop = (targetId: DesktopWidgetId) => {
    if (!draggedWidgetId || draggedWidgetId === targetId) {
      setDraggedWidgetId(null);
      setDragOverWidgetId(null);
      return;
    }
    const next = [...activeWidgets];
    const fromIdx = next.indexOf(draggedWidgetId);
    const toIdx = next.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedWidgetId(null);
      setDragOverWidgetId(null);
      return;
    }
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onReorderWidgets(next);
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  };

  const renderWidgetBody = (id: DesktopWidgetId) => {
    switch (id) {
      case 'clock_summary':
        return (
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-black tabular-nums tracking-tight">{timeFormatted}</span>
              <span className={`text-[11px] font-semibold ${mutedText}`}>{dateFormatted}</span>
            </div>
            <div className={`text-xs border-t pt-2 flex items-center justify-between gap-2 ${variant === 'board' ? 'border-slate-200/70 dark:border-white/10' : isLightSurface ? 'border-slate-200' : 'border-white/10'}`}>
              <span className="truncate">
                مرحباً، <span className="font-bold">{userFullName}</span>
              </span>
              {hasApp('dashboard') && (
                <button
                  type="button"
                  onClick={() => onOpenApp('dashboard')}
                  className={`text-[11px] font-bold whitespace-nowrap shrink-0 flex items-center gap-0.5 transition-colors ${
                    variant === 'board'
                      ? 'text-[#0078D4] dark:text-[#60CDFF] hover:underline'
                      : isLightSurface
                      ? 'text-[#0078D4] hover:text-[#106EBE]'
                      : 'text-[#60CDFF] hover:text-white'
                  }`}
                >
                  <span>لوحة القيادة</span>
                  <ChevronLeft size={13} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onOpenSearch}
              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between gap-2 transition-colors ${subtleBox}`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <Search size={13} className="shrink-0 opacity-80" />
                <span className="truncate">بحث سريع عن برنامج...</span>
              </span>
              <kbd
                dir="ltr"
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                  variant === 'board'
                    ? 'bg-white dark:bg-black/30 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-white/10'
                    : isLightSurface
                    ? 'bg-white text-slate-500 border border-slate-200'
                    : 'bg-black/30 text-slate-300'
                }`}
              >
                Ctrl+K
              </kbd>
            </button>
          </div>
        );

      case 'sales_pulse':
        return (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                <BarChart4 size={14} className="text-[#0078D4] dark:text-[#60CDFF]" />
                <span>نبض المبيعات اليوم</span>
              </div>
              {hasApp('dashboard') && (
                <button
                  type="button"
                  onClick={() => onOpenApp('dashboard')}
                  className={`text-[11px] font-bold ${mutedText} hover:underline`}
                >
                  التفاصيل
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-right">
              <div className={`p-2 rounded-xl border ${subtleBox}`}>
                <div className={`text-[10px] ${mutedText}`}>الإجمالي</div>
                <div className="text-xs font-black tabular-nums mt-0.5 truncate">
                  {todayAmount.toLocaleString()} ر.س
                </div>
              </div>
              <div className={`p-2 rounded-xl border ${subtleBox}`}>
                <div className={`text-[10px] ${mutedText}`}>الفواتير</div>
                <div className="text-xs font-black tabular-nums mt-0.5">{todaySales.length}</div>
              </div>
              <div className={`p-2 rounded-xl border ${subtleBox}`}>
                <div className={`text-[10px] ${mutedText}`}>المتوسط</div>
                <div className="text-xs font-black tabular-nums mt-0.5 truncate">
                  {avgInvoice.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {hasApp('pos') && (
                <button
                  type="button"
                  onClick={() => onOpenApp('pos')}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#0078D4] hover:bg-[#106EBE] text-white text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <ShoppingBag size={13} />
                  <span>نقطة البيع</span>
                </button>
              )}
              {hasApp('sales_entry') && (
                <button
                  type="button"
                  onClick={() => onOpenApp('sales_entry')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${subtleBox}`}
                >
                  <span>تسجيل مبيعات</span>
                </button>
              )}
            </div>
          </div>
        );

      case 'inventory_alert':
        return (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                <Package size={14} className="text-amber-500" />
                <span>المخزون والنواقص</span>
              </div>
              <span className={`text-[11px] font-bold tabular-nums ${lowStockItems.length > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {lowStockItems.length > 0 ? `${lowStockItems.length} منخفض` : 'المخزون متوازن'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-right">
              <div className={`p-2 rounded-xl border ${subtleBox}`}>
                <div className={`text-[10px] ${mutedText}`}>إجمالي الأصناف</div>
                <div className="text-xs font-black tabular-nums mt-0.5">{products.length}</div>
              </div>
              <div className={`p-2 rounded-xl border ${subtleBox}`}>
                <div className={`text-[10px] ${mutedText}`}>تحت الحد الأدنى</div>
                <div className={`text-xs font-black tabular-nums mt-0.5 ${lowStockItems.length > 0 ? 'text-amber-500' : ''}`}>
                  {lowStockItems.length}
                </div>
              </div>
            </div>

            {lowStockItems.length > 0 && (
              <div className="space-y-1">
                {lowStockItems.slice(0, 3).map(item => (
                  <div
                    key={item.id}
                    className={`px-2 py-1 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${subtleBox}`}
                  >
                    <span className="flex items-center gap-1.5 truncate font-semibold">
                      <AlertTriangle size={11} className="text-amber-500 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="tabular-nums font-black text-amber-500 shrink-0">{item.stock ?? 0}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1.5">
              {hasApp('list') && (
                <button
                  type="button"
                  onClick={() => onOpenApp('list')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${subtleBox}`}
                >
                  <FileText size={13} />
                  <span>جرد جديد</span>
                </button>
              )}
              {hasApp('products') && (
                <button
                  type="button"
                  onClick={() => onOpenApp('products')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${subtleBox}`}
                >
                  <Package size={13} />
                  <span>الأصناف</span>
                </button>
              )}
            </div>
          </div>
        );

      case 'quick_apps':
        return (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                <Star size={14} className="text-amber-400" />
                <span>التطبيقات المفضلة</span>
              </div>
              <button
                type="button"
                onClick={() => onOpenApp('file_manager')}
                className={`text-[11px] font-bold flex items-center gap-1 ${mutedText} hover:underline`}
              >
                <FolderOpen size={12} />
                <span>الملفات</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {fallbackQuickApps.map(app => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => onOpenApp(app.id)}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-colors ${subtleBox}`}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-xs shrink-0"
                    style={{ backgroundColor: app.color }}
                  >
                    <app.icon size={14} />
                  </div>
                  <span className="text-[10px] font-bold line-clamp-1 w-full">{app.label}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 'price_offers': {
        const promoActions = [
          { id: 'price_groups', label: 'شاشات الأسعار', icon: Monitor, color: '#475569' },
          { id: 'chicken_prices', label: 'أسعار الدجاج المجمد', icon: Snowflake, color: '#0284C7' },
          { id: 'offers', label: 'العروض', icon: Percent, color: '#C5A059' },
          { id: 'price_tags', label: 'ملصقات السعر', icon: Tag, color: '#334155' },
          { id: 'catalog', label: 'الكتالوج', icon: BookOpen, color: '#800020' },
        ].filter(item => hasApp(item.id));
        return (
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-extrabold">
              <Percent size={14} className="text-emerald-500" />
              <span>العروض وقوائم الأسعار</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {promoActions.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenApp(item.id)}
                  className={`p-2 rounded-xl border flex items-center gap-2 text-right transition-colors ${subtleBox}`}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: item.color }}
                  >
                    <item.icon size={12} />
                  </div>
                  <span className="text-[11px] font-bold truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      }

      case 'expiry_alerts': {
        const expiredCount = expiryAlerts.filter(a => a.daysLeft <= 0).length;
        const urgent30Count = expiryAlerts.filter(a => a.daysLeft > 0 && a.daysLeft <= 30).length;
        const displayed = expiryAlerts
          .filter(a => {
            if (expiryFilter === 'expired') return a.daysLeft <= 0;
            if (expiryFilter === '30') return a.daysLeft <= 30;
            return true;
          })
          .slice(0, 4);

        return (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                <Clock size={14} className={expiredCount > 0 ? 'text-red-500' : 'text-amber-500'} />
                <span>تنبيهات الصلاحية</span>
              </div>
              <button
                type="button"
                onClick={loadExpiryAlerts}
                className={`p-1 rounded-md transition-colors ${mutedText} hover:bg-black/5 dark:hover:bg-white/10`}
                title="تحديث تنبيهات الصلاحية"
              >
                <RefreshCw size={12} className={loadingExpiry ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-right">
              <button
                type="button"
                onClick={() => setExpiryFilter('expired')}
                className={`p-2 rounded-xl border transition-colors ${
                  expiryFilter === 'expired' ? 'border-red-500/60 bg-red-500/12' : subtleBox
                }`}
              >
                <div className={`text-[10px] ${mutedText}`}>منتهي</div>
                <div className={`text-xs font-black tabular-nums mt-0.5 ${expiredCount > 0 ? 'text-red-500' : ''}`}>
                  {expiredCount}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setExpiryFilter('30')}
                className={`p-2 rounded-xl border transition-colors ${
                  expiryFilter === '30' ? 'border-amber-500/60 bg-amber-500/12' : subtleBox
                }`}
              >
                <div className={`text-[10px] ${mutedText}`}>خلال 30 يوم</div>
                <div className={`text-xs font-black tabular-nums mt-0.5 ${urgent30Count > 0 ? 'text-amber-500' : ''}`}>
                  {urgent30Count}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setExpiryFilter('all')}
                className={`p-2 rounded-xl border transition-colors ${
                  expiryFilter === 'all' ? 'border-[#0078D4]/60 bg-[#0078D4]/12' : subtleBox
                }`}
              >
                <div className={`text-[10px] ${mutedText}`}>الإجمالي</div>
                <div className="text-xs font-black tabular-nums mt-0.5">{expiryAlerts.length}</div>
              </button>
            </div>

            {displayed.length === 0 ? (
              <div className={`px-2.5 py-2 rounded-xl border text-[11px] font-semibold text-center ${subtleBox} ${mutedText}`}>
                {loadingExpiry ? 'جاري فحص تواريخ الصلاحية...' : 'لا توجد تنبيهات صلاحية مطابقة'}
              </div>
            ) : (
              <div className="space-y-1">
                {displayed.map(alert => (
                  <button
                    key={`${alert.listId}-${alert.rowId}`}
                    type="button"
                    onClick={() => {
                      if (onNavigateToList) {
                        onNavigateToList(alert.listId, alert.rowId);
                      } else if (hasApp('dashboard')) {
                        onOpenApp('dashboard');
                      }
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center justify-between gap-2 text-right transition-colors ${subtleBox}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold truncate">{alert.productName}</div>
                      <div className={`text-[10px] flex items-center gap-1 tabular-nums ${mutedText}`}>
                        <Calendar size={10} />
                        <span>{alert.expiryDate}</span>
                      </div>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums shrink-0 ${
                        alert.daysLeft <= 0
                          ? 'bg-red-500/15 text-red-500'
                          : alert.daysLeft <= 30
                          ? 'bg-amber-500/15 text-amber-500'
                          : 'bg-slate-500/15 text-slate-500 dark:text-slate-300'
                      }`}
                    >
                      {alert.daysLeft <= 0 ? 'منتهي' : `${alert.daysLeft} يوم`}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1.5">
              {hasApp('dashboard') && (
                <button
                  type="button"
                  onClick={() => onOpenApp('dashboard')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${subtleBox}`}
                >
                  <Clock size={13} />
                  <span>كل التنبيهات</span>
                </button>
              )}
              {hasApp('list') && (
                <button
                  type="button"
                  onClick={() => onOpenApp('list')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${subtleBox}`}
                >
                  <FileText size={13} />
                  <span>فحص الجرد</span>
                </button>
              )}
            </div>
          </div>
        );
      }

      case 'quick_notes':
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                <StickyNote size={14} className="text-amber-400" />
                <span>ملاحظات سريعة</span>
              </div>
              {quickNote.trim() && (
                <button
                  type="button"
                  onClick={() => handleNoteChange('')}
                  className={`p-1 rounded hover:bg-red-500/15 hover:text-red-500 ${mutedText}`}
                  title="مسح الملاحظة"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
            <textarea
              value={quickNote}
              onChange={(e) => handleNoteChange(e.target.value)}
              rows={3}
              placeholder="دوّن مهام اليوم أو تنبيهات الصندوق هنا..."
              className={`w-full rounded-xl border p-2.5 text-xs leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[#0078D4] ${
                variant === 'board'
                  ? 'bg-slate-50 dark:bg-black/25 border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-400'
                  : isLightSurface
                  ? 'bg-white/90 border-slate-200 text-slate-900 placeholder:text-slate-400'
                  : 'bg-black/25 border-white/10 text-white placeholder:text-slate-400'
              }`}
            />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Header Bar */}
      <div
        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border backdrop-blur-2xl ${cardSurface}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-black truncate">ويدجت التطبيقات</span>
          <span className={`text-[10px] font-bold tabular-nums ${mutedText}`}>({visibleWidgets.length})</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onOpenPickerModal}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${subtleBox} border`}
            title="إضافة أو إزالة ويدجت"
          >
            <Plus size={12} />
            <span>إضافة</span>
          </button>
          <button
            type="button"
            onClick={() => setIsEditMode(prev => !prev)}
            className={`p-1.5 rounded-lg border transition-colors ${
              isEditMode
                ? 'bg-[#0078D4] text-white border-[#0078D4]'
                : subtleBox
            }`}
            title={isEditMode ? 'إنهاء الترتيب' : 'إعادة ترتيب وإدارة الويدجت'}
          >
            {isEditMode ? <Check size={12} /> : <SlidersHorizontal size={12} />}
          </button>
          {variant === 'desktop' && onHideDesktopWidgets && (
            <button
              type="button"
              onClick={onHideDesktopWidgets}
              className={`p-1.5 rounded-lg border transition-colors ${subtleBox}`}
              title="إخفاء شريط الويدجت من سطح المكتب"
            >
              <X size={12} />
            </button>
          )}
          {variant === 'board' && onCloseBoard && (
            <button
              type="button"
              onClick={onCloseBoard}
              className={`p-1.5 rounded-lg border transition-colors ${subtleBox}`}
              title="إغلاق لوحة الويدجت"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Widget Cards */}
      {visibleWidgets.length === 0 ? (
        <div className={`p-5 rounded-2xl border backdrop-blur-2xl text-center space-y-2.5 ${cardSurface}`}>
          <p className={`text-xs font-semibold ${mutedText}`}>لا توجد ويدجت مفعّلة حالياً</p>
          <button
            type="button"
            onClick={onOpenPickerModal}
            className="px-3.5 py-1.5 rounded-lg bg-[#0078D4] hover:bg-[#106EBE] text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Plus size={13} />
            <span>إضافة ويدجت للتطبيقات</span>
          </button>
        </div>
      ) : (
        visibleWidgets.map(widgetId => {
          const def = DESKTOP_WIDGET_CATALOG.find(c => c.id === widgetId);
          const isDragging = draggedWidgetId === widgetId;
          const isDragOver = dragOverWidgetId === widgetId && draggedWidgetId !== widgetId;

          return (
            <div
              key={widgetId}
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                setDraggedWidgetId(widgetId);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/widget-id', widgetId);
              }}
              onDragOver={(e) => {
                if (!draggedWidgetId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverWidgetId !== widgetId) setDragOverWidgetId(widgetId);
              }}
              onDragLeave={() => {
                if (dragOverWidgetId === widgetId) setDragOverWidgetId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleWidgetDrop(widgetId);
              }}
              onDragEnd={() => {
                setDraggedWidgetId(null);
                setDragOverWidgetId(null);
              }}
              className={`p-3.5 rounded-2xl border backdrop-blur-2xl shadow-lg transition-all ${cardSurface} ${
                isDragging ? 'opacity-50 scale-[0.98]' : ''
              } ${isDragOver ? 'ring-2 ring-[#0078D4] scale-[1.01]' : ''}`}
            >
              {isEditMode && (
                <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-black/8 dark:border-white/10">
                  <span className={`flex items-center gap-1 text-[11px] font-bold cursor-grab active:cursor-grabbing ${mutedText}`}>
                    <GripVertical size={13} />
                    <span>{def?.title}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleWidget(widgetId)}
                    className="p-1 rounded-md text-red-500 hover:bg-red-500/15 transition-colors"
                    title="إزالة الويدجت"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
              {renderWidgetBody(widgetId)}
            </div>
          );
        })
      )}
    </div>
  );
};
