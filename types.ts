
export interface PriceGroupStyles {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  priceColor: string; 
  secondaryColor: string;
  borderColor?: string;
  titleFontSize: number;
  itemFontSize: number;
  priceFontSize: number;
  currencyFontSize: number;
  titleWeight: string;
  itemWeight: string;
  priceWeight: string;
  columns: number;
  borderWidth: number;
  padding: number;
  boardsPerPage: 1 | 2;
  showGeometricPattern: boolean;
  currencySymbolType?: CurrencySymbolType;
  currencySymbolImage?: string | null;
}

export interface Unit {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  unitId: string;
  price?: string;
  costPrice?: string; 
  color?: string;
  category?: string;
  description?: string;
  lowStockThreshold?: number; // New field for alerts
  stock?: number; // New field for inventory tracking
}

export interface KeyboardShortcut {
  keys: string[];
  description: string;
  action?: () => void;
}

export type ListType = 'inventory' | 'receipt';

export interface ListRow {
  id: string;
  code: string;
  name: string;
  unitId: string;
  qty: number | '';
  expiryDate: string;
  note: string;
  isDismissed?: boolean;
}

export interface SavedList {
  id: string;
  name: string;
  date: string;
  type: ListType;
  rows: ListRow[];
}

export interface Branch {
  id: string;
  name: string;
  location?: string;
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'credit';
export type TransactionType = 'sale' | 'return' | 'collection'; 

export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
  name?: string;
  discount?: number;
}

export interface DailySales {
  id: string;
  branchId?: string;
  date: string;
  
  totalAmount: number;      
  paidAmount: number;       
  remainingAmount: number;  
  
  paymentMethod: PaymentMethod | 'split';
  cashAmount?: number;
  cardAmount?: number;

  transactionType: TransactionType;
  
  isPending: boolean;       
  isClosed: boolean;        
  
  linkedSaleId?: string;    
  customerName?: string;
  customerId?: string;
  
  posPointId?: string;      
  networkId?: string;       
  
  amount: number; 
  notes?: string;
  returnReason?: string;
  discount?: number;
  pointsRedeemed?: number;
  
  cart?: CartItem[];
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: string;
  notes?: string;
  posPointId?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  lastVisit?: string;
  balance?: number; // Positive = Customer owes us
  totalPurchases?: number;
  loyaltyPoints?: number;
}

export interface Network {
  id: string;
  name: string;
  branchId?: string;
}

export type Permission = 
  | 'manage_users' 
  | 'view_dashboard' 
  | 'view_products' 
  | 'manage_products' 
  | 'manage_branches' 
  | 'record_sales' 
  | 'view_reports' 
  | 'manage_settlements' 
  | 'print_labels' 
  | 'manage_settings' 
  | 'manage_database';

export interface User {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  role: 'admin' | 'user';
  branchId?: string;
  permissions: Permission[];
  isActive: boolean;
  lastLogin?: string;
}

export type OfferTemplate = 'modern_clean' | 'industrial' | 'vibrant_red' | 'discount' | '1plus1' | 'luxury' | 'mega_sale_50';

export interface OfferTag {
  id: string;
  productId: string;
  name: string;
  originalPrice: string;
  offerPrice: string;
  template: OfferTemplate;
  discountText: string;
  showLogo: boolean;
  hideOriginalPrice: boolean;
  unitName?: string;
  customColors?: {
    primary?: string;
    background?: string;
    text?: string;
    accent?: string;
    price?: string;
    bgImage?: string | null;
    nameFontSize?: number;
    priceFontSize?: number;
    decimalFontSize?: number;
    discountFontSize?: number;
    originalPriceFontSize?: number;
  };
}

export interface SavedOfferList {
  id: string;
  name: string;
  date: string;
  tags: OfferTag[];
  styles: {
    labelsPerPage: number;
    logoUrl: string | null;
    logoSize: number;
    orientation: 'portrait' | 'landscape';
    showUnit: boolean;
    currencySymbolType?: CurrencySymbolType;
    currencySymbolImage?: string | null;
  };
}

export type PriceGroupTheme = 
  | 'geometric_luxe' 
  | 'modern_grid' 
  | 'royal_minimal' 
  | 'digital_punch' 
  | 'abstract_gradient';

export interface PriceGroupItem {
  id: string;
  label: string;
  price: string;
  isOffer?: boolean;
}

export interface PriceGroupBoard {
  id: string;
  title: string;
  items: PriceGroupItem[];
  isActive: boolean;
}

export interface PriceGroup {
  id: string;
  name: string;
  date: string;
  boards: PriceGroupBoard[];
  showLogo: boolean;
  logoUrl?: string | null;
  themeId: PriceGroupTheme;
  styles: PriceGroupStyles;
}

export interface POSPoint {
  id: string;
  name: string;
  branchId?: string;
}

export interface Cashier {
  id: string;
  name: string;
  user_id?: string;
}

export interface SettlementEntry {
  id: string;
  name: string;
  amount: number;
}

export interface Settlement {
  id: string;
  date: string;
  posId: string;
  branchId: string;
  cashierId: string;
  
  openingBalance: number;
  totalCashSales: number;
  totalCollections: number; 
  totalExpenses: number;
  bankDeposit: number; 
  
  theoreticalCash: number;
  actualCash: number;
  variance: number;
  
  totalSales: number; 
  
  networks: SettlementEntry[];
  transfers: SettlementEntry[];
  
  notes?: string;
  createdAt: string;
  status: 'open' | 'closed';
}

export type CatalogLayoutType = 'app_modern' | 'geometric_grid' | 'restaurant_menu' | 'luxury_cards' | 'ramadan_special';
export type CatalogBadgeType = 'none' | 'sale' | 'new' | 'best_seller' | 'limited' | '1plus1' | 'organic';

export interface CatalogStyleConfig {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  borderRadius: number;
  layoutType: CatalogLayoutType;
  showHeader: boolean;
  currencySymbolType?: CurrencySymbolType;
  currencySymbolImage?: string | null;
}

export interface CatalogItem {
  id: string;
  productId: string;
  name: string;
  price: string;
  originalPrice?: string;
  sectionName: string;
  unitName: string;
  badge: CatalogBadgeType;
  description?: string;
  image?: string;
  discountPercent?: number;
}

export interface CatalogProject {
  id: string;
  name: string;
  date: string;
  title: string;
  subtitle?: string;
  items: CatalogItem[];
  whatsappNumber?: string;
  styleConfig: CatalogStyleConfig;
}

export type TagTemplate = 'classic_vertical' | 'side_horizontal' | 'industrial_grid' | 'big_impact' | 'discount_red' | 'yellow_shelf_label';

export type CurrencySymbolType = 'text' | 'icon' | 'custom_image';

export interface TagStyleOverrides {
  nameFontSize?: number;
  priceFontSize?: number;
  nameColor?: string;
  priceColor?: string;
  unitColor?: string;
  currencyColor?: string;
  originalPriceColor?: string;
  nameWeight?: string;
  priceWeight?: string;
  textAlign?: 'center' | 'right' | 'left';
  showLogo?: boolean;
  showBorder?: boolean;
  showUnit?: boolean;
  showOriginalPrice?: boolean;
  template?: TagTemplate;
  backgroundColor?: string;
  currencySymbolType?: CurrencySymbolType;
  currencySymbolImage?: string | null;
  currencySymbolSize?: number;
  currencySymbolPosition?: 'before' | 'after' | 'superscript_before' | 'superscript_after';
  currencySymbolMargin?: number;
  nameBackgroundColor?: string;
}

export interface SelectedTag {
  id: string;
  productId: string;
  name: string;
  price: string;
  originalPrice?: string;
  unitName?: string;
  styles?: TagStyleOverrides;
}

export interface TagStyles {
  nameFontSize: number;
  priceFontSize: number;
  nameColor: string;
  priceColor: string;
  unitColor: string;
  currencyColor: string;
  originalPriceColor: string;
  previewZoom: number;
  showLogo: boolean;
  logoUrl: string | null;
  logoSize: number;
  topMargin: number;
  bottomMargin: number;
  leftMargin: number;
  rightMargin: number;
  tagHeight: number;
  showBorder: boolean;
  showUnit: boolean;
  showOriginalPrice: boolean;
  template: TagTemplate;
  backgroundColor: string;
  nameBackgroundColor?: string;
  currencySymbolType: CurrencySymbolType;
  currencySymbolImage: string | null;
  currencySymbolSize: number;
  currencySymbolPosition: 'before' | 'after' | 'superscript_before' | 'superscript_after';
  currencySymbolMargin: number;
}

export interface SavedTagList {
  id: string;
  name: string;
  date: string;
  tags: SelectedTag[];
  styles: Omit<TagStyles, 'previewZoom'>;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  balance?: number; // Positive = We owe supplier
}

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  date: string;
  type: 'bill' | 'payment'; // bill = we owe more, payment = we paid
  amount: number;
  notes?: string;
  reference?: string;
}

export interface Shift {
  id: string;
  userId: string;
  userName: string;
  startTime: string;
  endTime?: string;
  startCash: number;
  endCash?: number;
  expectedCash?: number;
  difference?: number;
  status: 'open' | 'closed';
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  date: string;
  status: 'pending' | 'received' | 'cancelled';
  totalAmount: number;
  items: {
    productId: string;
    quantity: number;
    costPrice: number;
  }[];
  notes?: string;
}

export interface Settings {
  orgName: string;
  taxNumber?: string;
  invoiceTerms?: string;
  taxRate?: number; // VAT %
  receiptHeader?: string;
  receiptFooter?: string;
  currency?: string;
  enableLowStockAlerts?: boolean;
  showLogoOnReceipt?: boolean;
  showHeaderOnReceipt?: boolean;
  showFooterOnReceipt?: boolean;
  enableSoundEffects?: boolean;
  themeColor?: string;
  expiryAlertDays: number;
  currencySymbolType: CurrencySymbolType;
  currencySymbolImage: string | null;
  defaultPaymentMethod?: 'cash' | 'card';
}

// --- NEW TYPES FOR UPGRADES ---

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface HeldOrder {
  id: string;
  date: string;
  customerName?: string;
  amount: number;
  note?: string;
  cart: CartItem[]; 
}

export interface ActivityLog {
  id: string;
  action: string;
  details?: string;
  timestamp: string;
  user?: string;
  type: 'info' | 'warning' | 'error' | 'success';
}
