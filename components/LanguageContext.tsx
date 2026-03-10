import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'ar' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const translations: Record<Language, Record<string, string>> = {
  ar: {
    'app.title': 'نظام إدارة المتجر',
    'nav.dashboard': 'لوحة البيانات',
    'nav.pos': 'نقطة البيع',
    'nav.products': 'المنتجات',
    'nav.returns': 'المرتجعات',
    'nav.settings': 'الإعدادات',
    'nav.sales': 'المبيعات',
    'nav.customers': 'العملاء',
    'nav.offers': 'العروض',
    'nav.inventory': 'الجرد',
    'nav.mobile_inventory': 'جرد الموبايل',
    'nav.units': 'الوحدات',
    'nav.suppliers': 'الموردين',
    'nav.purchase_orders': 'أوامر الشراء',
    'nav.reports': 'التقارير',
    'nav.settlement': 'إغلاق اليومية',
    'nav.expenses': 'المصروفات',
    'nav.promotions': 'العروض الترويجية',
    'nav.price_tags': 'ملصقات الباركود',
    'nav.catalog': 'المجلة الرقمية',
    'nav.price_groups': 'الشاشات',
    'nav.users': 'المستخدمين',
    'nav.branches': 'الفروع',
    'nav.pos_setup': 'تهيئة الكاشير',
    'nav.database': 'قاعدة البيانات',
    'nav.activity_log': 'سجل النشاط',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.search': 'بحث...',
    'common.loading': 'جاري التحميل...',
    'returns.title': 'إدارة المرتجعات',
    'returns.new': 'مرتجع جديد',
    'returns.receipt_no': 'رقم الفاتورة',
    'returns.search_receipt': 'ابحث برقم الفاتورة',
    'returns.reason': 'سبب الإرجاع',
    'returns.amount': 'المبلغ',
    'returns.date': 'التاريخ',
    'returns.status': 'الحالة',
    'returns.items': 'العناصر',
    'returns.confirm': 'تأكيد الإرجاع',
    'returns.success': 'تم تسجيل المرتجع بنجاح',
    'returns.error': 'حدث خطأ أثناء تسجيل المرتجع',
    'returns.no_receipt': 'لم يتم العثور على الفاتورة',
    'returns.select_items': 'اختر العناصر للإرجاع',
    'returns.quantity_to_return': 'الكمية المرتجعة',
    'returns.max_quantity': 'الحد الأقصى: {max}',
    'returns.total_refund': 'إجمالي المبلغ المسترد',
    'returns.history': 'سجل المرتجعات',
  },
  en: {
    'app.title': 'Store Management System',
    'nav.dashboard': 'Dashboard',
    'nav.pos': 'Point of Sale',
    'nav.products': 'Products',
    'nav.returns': 'Returns',
    'nav.settings': 'Settings',
    'nav.sales': 'Sales',
    'nav.customers': 'Customers',
    'nav.offers': 'Offers',
    'nav.inventory': 'Inventory',
    'nav.mobile_inventory': 'Mobile Inventory',
    'nav.units': 'Units',
    'nav.suppliers': 'Suppliers',
    'nav.purchase_orders': 'Purchase Orders',
    'nav.reports': 'Reports',
    'nav.settlement': 'End of Day',
    'nav.expenses': 'Expenses',
    'nav.promotions': 'Promotions',
    'nav.price_tags': 'Price Tags',
    'nav.catalog': 'Digital Catalog',
    'nav.price_groups': 'Screens',
    'nav.users': 'Users',
    'nav.branches': 'Branches',
    'nav.pos_setup': 'POS Setup',
    'nav.database': 'Database',
    'nav.activity_log': 'Activity Log',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.search': 'Search...',
    'common.loading': 'Loading...',
    'returns.title': 'Returns Management',
    'returns.new': 'New Return',
    'returns.receipt_no': 'Receipt No',
    'returns.search_receipt': 'Search by receipt number',
    'returns.reason': 'Return Reason',
    'returns.amount': 'Amount',
    'returns.date': 'Date',
    'returns.status': 'Status',
    'returns.items': 'Items',
    'returns.confirm': 'Confirm Return',
    'returns.success': 'Return recorded successfully',
    'returns.error': 'Error recording return',
    'returns.no_receipt': 'Receipt not found',
    'returns.select_items': 'Select items to return',
    'returns.quantity_to_return': 'Return Qty',
    'returns.max_quantity': 'Max: {max}',
    'returns.total_refund': 'Total Refund',
    'returns.history': 'Returns History',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('ar');

  useEffect(() => {
    const savedLang = localStorage.getItem('sf_language') as Language;
    if (savedLang && (savedLang === 'ar' || savedLang === 'en')) {
      setLanguageState(savedLang);
      document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = savedLang;
    } else {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('sf_language', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  };

  const t = (key: string, params?: Record<string, string | number>) => {
    let text = translations[language][key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
