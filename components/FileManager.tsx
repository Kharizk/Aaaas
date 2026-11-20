import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Folder, FolderOpen, FileText, FileSpreadsheet, FileImage, FileCode,
  HardDrive, Monitor, Trash2, Star, Clock, ChevronLeft, ChevronRight,
  ArrowUp, RefreshCw, Search, LayoutGrid, List as ListIcon, Plus,
  FolderPlus, FilePlus, Upload, Download, Eye, PanelRight,
  Edit3, RotateCcw, Pin, ExternalLink, X, Check, Save,
  Package, Users, Building2, ShoppingBag, Tag, BookOpen, BarChart4,
  ArrowUpDown, Copy
} from 'lucide-react';
import { Product, Unit, Branch, DailySales, User } from '../types';
import { db } from '../services/supabase';
import { useNotification, useConfirm } from './Notifications';

export interface DesktopAppDef {
  id: string;
  label: string;
  groupTitle: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  color: string;
}

export interface VfsNode {
  id: string;
  parentId: string; // 'my_docs' | 'desktop' | folderId
  name: string;
  kind: 'folder' | 'note' | 'file';
  mimeType?: string;
  content?: string; // text or dataURL
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  isPinnedToDesktop?: boolean;
  isStarred?: boolean;
  isDeleted?: boolean;
  deletedFrom?: string;
}

interface FileEntry {
  id: string;
  name: string;
  kind: 'drive' | 'folder' | 'app' | 'list' | 'catalog' | 'product' | 'sale' | 'price_group' | 'offer_list' | 'tag_list' | 'customer' | 'supplier' | 'note' | 'file';
  subtitle?: string;
  typeLabel: string;
  dateLabel?: string;
  sizeLabel?: string;
  rawDate?: string;
  rawSize?: number;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  iconColor?: string;
  targetFolderId?: string;
  appId?: string;
  payload?: any;
  vfsNode?: VfsNode;
  isStarred?: boolean;
  isDeleted?: boolean;
}

interface FileManagerProps {
  apps: DesktopAppDef[];
  products: Product[];
  units: Unit[];
  branches: Branch[];
  dailySales: DailySales[];
  currentUser: User;
  favorites: string[];
  hiddenApps: string[];
  initialFolder?: string;
  onOpenApp: (appId: string) => void;
  onNavigateToList: (listId: string) => void;
  onToggleFavorite: (appId: string) => void;
  onToggleDesktopPin?: (appId: string) => void;
  onVfsChanged?: () => void;
}

const VFS_STORAGE_KEY = 'sf_vfs_nodes_v1';

export const loadVfsNodes = (): VfsNode[] => {
  try {
    const raw = localStorage.getItem(VFS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore parse failure
  }
  const now = new Date().toISOString();
  const initial: VfsNode[] = [
    {
      id: 'vfs_folder_invoices',
      parentId: 'my_docs',
      name: 'مسودات وملاحظات العمل',
      kind: 'folder',
      sizeBytes: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'vfs_note_welcome',
      parentId: 'my_docs',
      name: 'تعليمات التشغيل اليومي.txt',
      kind: 'note',
      mimeType: 'text/plain',
      content: 'قائمة المهام اليومية للمتجر:\n1. مراجعة رصيد الافتتاح في الكاشير.\n2. فحص نواقص المخزون في قائمة الجرد.\n3. إغلاق اليومية وتصدير التقرير المسائي.',
      sizeBytes: 184,
      createdAt: now,
      updatedAt: now,
      isStarred: true,
    },
  ];
  localStorage.setItem(VFS_STORAGE_KEY, JSON.stringify(initial));
  return initial;
};

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatDateShort = (iso?: string): string => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return '—';
  }
};

export const FileManager: React.FC<FileManagerProps> = ({
  apps,
  products,
  units,
  branches,
  dailySales,
  favorites,
  hiddenApps,
  initialFolder = 'this_pc',
  onOpenApp,
  onNavigateToList,
  onToggleFavorite,
  onToggleDesktopPin,
  onVfsChanged,
}) => {
  const { notify } = useNotification();
  const { confirm } = useConfirm();
  const [currentFolder, setCurrentFolder] = useState<string>(initialFolder);
  const [history, setHistory] = useState<string[]>([initialFolder]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const [viewMode, setViewMode] = useState<'grid' | 'details'>('details');
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'date' | 'size'>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showInspector, setShowInspector] = useState<boolean>(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Remote DB collections loaded inside File Manager
  const [dbLists, setDbLists] = useState<any[]>([]);
  const [dbCatalogs, setDbCatalogs] = useState<any[]>([]);
  const [dbPriceGroups, setDbPriceGroups] = useState<any[]>([]);
  const [dbTagLists, setDbTagLists] = useState<any[]>([]);
  const [dbOfferLists, setDbOfferLists] = useState<any[]>([]);
  const [dbCustomers, setDbCustomers] = useState<any[]>([]);
  const [dbSuppliers, setDbSuppliers] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState<boolean>(false);

  // Local Virtual File System (notes, folders, uploaded files)
  const [vfsNodes, setVfsNodes] = useState<VfsNode[]>(() => loadVfsNodes());

  // Modals & inline editing
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [editingNote, setEditingNote] = useState<VfsNode | null>(null);
  const [noteTitleDraft, setNoteTitleDraft] = useState<string>('');
  const [noteContentDraft, setNoteContentDraft] = useState<string>('');
  const [previewMedia, setPreviewMedia] = useState<{ title: string; content: string; mimeType?: string } | null>(null);
  const [newFolderModalOpen, setNewFolderModalOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null);

  const fileUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialFolder) {
      navigateTo(initialFolder);
    }
  }, [initialFolder]);

  const persistVfs = (next: VfsNode[]) => {
    setVfsNodes(next);
    localStorage.setItem(VFS_STORAGE_KEY, JSON.stringify(next));
    onVfsChanged?.();
  };

  const fetchStoreFiles = async () => {
    setIsFetching(true);
    try {
      const [lists, catalogs, priceGroups, tagLists, offerLists, customers, suppliers] = await Promise.all([
        db.lists.getAll().catch(() => []),
        db.catalogs.getAll().catch(() => []),
        db.priceGroups.getAll().catch(() => []),
        db.tagLists.getAll().catch(() => []),
        db.offerLists.getAll().catch(() => []),
        db.customers.getAll().catch(() => []),
        db.suppliers.getAll().catch(() => []),
      ]);
      setDbLists(lists || []);
      setDbCatalogs(catalogs || []);
      setDbPriceGroups(priceGroups || []);
      setDbTagLists(tagLists || []);
      setDbOfferLists(offerLists || []);
      setDbCustomers(customers || []);
      setDbSuppliers(suppliers || []);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchStoreFiles();
  }, []);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const navigateTo = (folderId: string) => {
    if (folderId === currentFolder) return;
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(folderId);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    setCurrentFolder(folderId);
    setSelectedId(null);
    setSearchQuery('');
  };

  const goBack = () => {
    if (historyIndex > 0) {
      const idx = historyIndex - 1;
      setHistoryIndex(idx);
      setCurrentFolder(history[idx]);
      setSelectedId(null);
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      const idx = historyIndex + 1;
      setHistoryIndex(idx);
      setCurrentFolder(history[idx]);
      setSelectedId(null);
    }
  };

  const getParentFolder = (folderId: string): string | null => {
    if (folderId === 'this_pc') return null;
    if (['drive_c', 'drive_d', 'my_docs', 'desktop', 'recycle_bin', 'favorites'].includes(folderId)) {
      return 'this_pc';
    }
    if (folderId.startsWith('dept_')) return 'drive_c';
    if (['lists', 'catalogs', 'price_groups', 'offers_tags', 'products_root', 'branches_root', 'contacts_root'].includes(folderId)) {
      return 'drive_d';
    }
    if (folderId.startsWith('prod_cat_')) return 'products_root';
    if (folderId.startsWith('branch_')) return 'branches_root';
    if (['customers_dir', 'suppliers_dir'].includes(folderId)) return 'contacts_root';
    const vfsMatch = vfsNodes.find(n => n.id === folderId);
    if (vfsMatch) return vfsMatch.parentId;
    return 'this_pc';
  };

  const goUp = () => {
    const parent = getParentFolder(currentFolder);
    if (parent) navigateTo(parent);
  };

  // Breadcrumb builder
  const breadcrumbs = useMemo(() => {
    const labelMap: Record<string, string> = {
      this_pc: 'جهاز الكمبيوتر',
      drive_c: 'القرص (C:) تطبيقات النظام',
      drive_d: 'قرص البيانات (D:) ملفات المتجر',
      my_docs: 'مستنداتي المحلية',
      desktop: 'سطح المكتب',
      recycle_bin: 'سلة المحذوفات',
      favorites: 'المفضلة',
      lists: 'قوائم الجرد والفواتير',
      catalogs: 'الكتالوجات الرقمية',
      price_groups: 'مجموعات الأسعار والشاشات',
      offers_tags: 'العروض والملصقات',
      products_root: 'قاعدة بيانات المنتجات',
      branches_root: 'الفروع والمبيعات اليومية',
      contacts_root: 'العملاء والموردون',
      customers_dir: 'العملاء',
      suppliers_dir: 'الموردون',
    };

    const getFolderName = (id: string): string => {
      if (labelMap[id]) return labelMap[id];
      if (id.startsWith('dept_')) return id.replace('dept_', '');
      if (id.startsWith('prod_cat_')) return id.replace('prod_cat_', '');
      if (id.startsWith('branch_')) {
        const bId = id.replace('branch_', '');
        return branches.find(b => b.id === bId)?.name || 'فرع';
      }
      const vfsNode = vfsNodes.find(n => n.id === id);
      return vfsNode ? vfsNode.name : id;
    };

    const trail: { id: string; label: string }[] = [];
    let cursor: string | null = currentFolder;
    let guard = 0;
    while (cursor && guard < 10) {
      trail.unshift({ id: cursor, label: getFolderName(cursor) });
      cursor = getParentFolder(cursor);
      guard++;
    }
    return trail;
  }, [currentFolder, branches, vfsNodes]);

  // Unique departments from apps
  const departments = useMemo(() => {
    const map = new Map<string, DesktopAppDef[]>();
    apps.forEach(a => {
      const list = map.get(a.groupTitle) || [];
      list.push(a);
      map.set(a.groupTitle, list);
    });
    return Array.from(map.entries());
  }, [apps]);

  // Product categories
  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => cats.add(p.category?.trim() || 'غير مصنف'));
    return Array.from(cats);
  }, [products]);

  // Build entries for current folder
  const rawEntries: FileEntry[] = useMemo(() => {
    const unitMap = new Map(units.map(u => [u.id, u.name]));

    const mapVfsToEntry = (node: VfsNode): FileEntry => {
      const isImage = node.mimeType?.startsWith('image/');
      const isCsv = node.name.endsWith('.csv') || node.name.endsWith('.xlsx');
      const Icon =
        node.kind === 'folder'
          ? Folder
          : isImage
          ? FileImage
          : isCsv
          ? FileSpreadsheet
          : FileText;
      return {
        id: node.id,
        name: node.name,
        kind: node.kind,
        typeLabel:
          node.kind === 'folder'
            ? 'مجلد محلي'
            : isImage
            ? 'صورة'
            : node.kind === 'note'
            ? 'مستند نصي'
            : 'ملف مرفق',
        dateLabel: formatDateShort(node.updatedAt),
        rawDate: node.updatedAt,
        sizeLabel:
          node.kind === 'folder'
            ? `${vfsNodes.filter(c => !c.isDeleted && c.parentId === node.id).length} عنصر`
            : formatBytes(node.sizeBytes),
        rawSize: node.sizeBytes,
        icon: Icon,
        iconColor: node.kind === 'folder' ? '#D97706' : isImage ? '#0284C7' : '#475569',
        targetFolderId: node.kind === 'folder' ? node.id : undefined,
        vfsNode: node,
        isStarred: node.isStarred,
        isDeleted: node.isDeleted,
      };
    };

    if (currentFolder === 'this_pc') {
      const activeLocalCount = vfsNodes.filter(n => !n.isDeleted).length;
      const deletedLocalCount = vfsNodes.filter(n => n.isDeleted).length;
      const storeDocsTotal =
        dbLists.length + dbCatalogs.length + dbPriceGroups.length + products.length + dailySales.length;

      return [
        {
          id: 'entry_drive_c',
          name: 'القرص (C:) — تطبيقات النظام',
          kind: 'drive',
          typeLabel: 'قرص نظام',
          sizeLabel: `${apps.length} برنامج`,
          rawSize: apps.length,
          icon: HardDrive,
          iconColor: '#0284C7',
          targetFolderId: 'drive_c',
        },
        {
          id: 'entry_drive_d',
          name: 'قرص البيانات (D:) — مستندات المتجر',
          kind: 'drive',
          typeLabel: 'قرص سحابي',
          sizeLabel: `${storeDocsTotal} سجل`,
          rawSize: storeDocsTotal,
          icon: HardDrive,
          iconColor: '#059669',
          targetFolderId: 'drive_d',
        },
        {
          id: 'entry_my_docs',
          name: 'مستنداتي المحلية',
          kind: 'folder',
          typeLabel: 'مجلد شخصي',
          sizeLabel: `${activeLocalCount} ملف`,
          rawSize: activeLocalCount,
          icon: Folder,
          iconColor: '#D97706',
          targetFolderId: 'my_docs',
        },
        {
          id: 'entry_desktop',
          name: 'سطح المكتب',
          kind: 'folder',
          typeLabel: 'مجلد النظام',
          sizeLabel: `${apps.filter(a => !hiddenApps.includes(a.id)).length} اختصار`,
          rawSize: apps.filter(a => !hiddenApps.includes(a.id)).length,
          icon: Monitor,
          iconColor: '#4F46E5',
          targetFolderId: 'desktop',
        },
        {
          id: 'entry_recycle',
          name: 'سلة المحذوفات',
          kind: 'folder',
          typeLabel: 'سلة النظام',
          sizeLabel: `${deletedLocalCount} عنصر`,
          rawSize: deletedLocalCount,
          icon: Trash2,
          iconColor: '#64748B',
          targetFolderId: 'recycle_bin',
        },
      ];
    }

    if (currentFolder === 'drive_c') {
      return departments.map(([dept, deptApps]) => ({
        id: `dept_folder_${dept}`,
        name: dept,
        kind: 'folder' as const,
        typeLabel: 'مجلد تطبيقات',
        sizeLabel: `${deptApps.length} تطبيق`,
        rawSize: deptApps.length,
        icon: Folder,
        iconColor: '#0284C7',
        targetFolderId: `dept_${dept}`,
      }));
    }

    if (currentFolder.startsWith('dept_')) {
      const deptName = currentFolder.replace('dept_', '');
      const deptApps = apps.filter(a => a.groupTitle === deptName);
      return deptApps.map(app => ({
        id: `app_${app.id}`,
        name: `${app.label}.app`,
        kind: 'app' as const,
        typeLabel: 'تطبيق تنفيذي',
        sizeLabel: 'تشغيل مباشر',
        icon: app.icon,
        iconColor: app.color,
        appId: app.id,
        isStarred: favorites.includes(app.id),
      }));
    }

    if (currentFolder === 'drive_d') {
      return [
        {
          id: 'dir_lists',
          name: 'قوائم الجرد والفواتير',
          kind: 'folder',
          typeLabel: 'مجلد سجلات',
          sizeLabel: `${dbLists.length} مستند`,
          rawSize: dbLists.length,
          icon: FileText,
          iconColor: '#800020',
          targetFolderId: 'lists',
        },
        {
          id: 'dir_products',
          name: 'قاعدة بيانات المنتجات',
          kind: 'folder',
          typeLabel: 'مجلد أصناف',
          sizeLabel: `${products.length} صنف`,
          rawSize: products.length,
          icon: Package,
          iconColor: '#059669',
          targetFolderId: 'products_root',
        },
        {
          id: 'dir_branches',
          name: 'الفروع والمبيعات اليومية',
          kind: 'folder',
          typeLabel: 'مجلد مبيعات',
          sizeLabel: `${branches.length} فرع · ${dailySales.length} عملية`,
          rawSize: dailySales.length,
          icon: Building2,
          iconColor: '#0284C7',
          targetFolderId: 'branches_root',
        },
        {
          id: 'dir_catalogs',
          name: 'الكتالوجات والمجلات الرقمية',
          kind: 'folder',
          typeLabel: 'مجلد نشر',
          sizeLabel: `${dbCatalogs.length} مجلة`,
          rawSize: dbCatalogs.length,
          icon: BookOpen,
          iconColor: '#C5A059',
          targetFolderId: 'catalogs',
        },
        {
          id: 'dir_price_groups',
          name: 'شاشات ومجموعات الأسعار',
          kind: 'folder',
          typeLabel: 'مجلد عروض',
          sizeLabel: `${dbPriceGroups.length} لوحة`,
          rawSize: dbPriceGroups.length,
          icon: Monitor,
          iconColor: '#4F46E5',
          targetFolderId: 'price_groups',
        },
        {
          id: 'dir_offers_tags',
          name: 'قوائم الملصقات والعروض المحفوظة',
          kind: 'folder',
          typeLabel: 'مجلد طباعة',
          sizeLabel: `${dbTagLists.length + dbOfferLists.length} قالب`,
          rawSize: dbTagLists.length + dbOfferLists.length,
          icon: Tag,
          iconColor: '#D97706',
          targetFolderId: 'offers_tags',
        },
        {
          id: 'dir_contacts',
          name: 'ملفات العملاء والموردين',
          kind: 'folder',
          typeLabel: 'مجلد جهات اتصال',
          sizeLabel: `${dbCustomers.length + dbSuppliers.length} سجل`,
          rawSize: dbCustomers.length + dbSuppliers.length,
          icon: Users,
          iconColor: '#475569',
          targetFolderId: 'contacts_root',
        },
      ];
    }

    if (currentFolder === 'lists') {
      return dbLists.map(l => ({
        id: `list_${l.id}`,
        name: `${l.name || 'قائمة بدون اسم'}.${l.type === 'receipt' ? 'rec' : 'inv'}`,
        kind: 'list' as const,
        typeLabel: l.type === 'receipt' ? 'فاتورة استلام' : 'قائمة جرد',
        dateLabel: formatDateShort(l.date),
        rawDate: l.date,
        sizeLabel: `${l.rows?.length || 0} صنف`,
        rawSize: l.rows?.length || 0,
        icon: FileSpreadsheet,
        iconColor: l.type === 'receipt' ? '#0284C7' : '#800020',
        payload: l,
      }));
    }

    if (currentFolder === 'catalogs') {
      return dbCatalogs.map(c => ({
        id: `cat_${c.id}`,
        name: `${c.title || c.name || 'مجلة عروض'}.cat`,
        kind: 'catalog' as const,
        typeLabel: 'مجلة رقمية',
        dateLabel: formatDateShort(c.date),
        rawDate: c.date,
        sizeLabel: `${c.items?.length || 0} منتج`,
        rawSize: c.items?.length || 0,
        icon: BookOpen,
        iconColor: '#C5A059',
        payload: c,
      }));
    }

    if (currentFolder === 'price_groups') {
      return dbPriceGroups.map(pg => ({
        id: `pg_${pg.id}`,
        name: `${pg.title || pg.name || 'لوحة أسعار'}.scr`,
        kind: 'price_group' as const,
        typeLabel: 'شاشة عرض أسعار',
        dateLabel: formatDateShort(pg.date),
        rawDate: pg.date,
        sizeLabel: `${pg.items?.length || 0} صنف`,
        rawSize: pg.items?.length || 0,
        icon: Monitor,
        iconColor: '#4F46E5',
        payload: pg,
      }));
    }

    if (currentFolder === 'offers_tags') {
      const tags = dbTagLists.map(tl => ({
        id: `tl_${tl.id}`,
        name: `${tl.name || 'ملصقات باركود'}.tag`,
        kind: 'tag_list' as const,
        typeLabel: 'قائمة ملصقات',
        dateLabel: formatDateShort(tl.date),
        rawDate: tl.date,
        sizeLabel: `${tl.tags?.length || tl.rows?.length || 0} ملصق`,
        rawSize: tl.tags?.length || tl.rows?.length || 0,
        icon: Tag,
        iconColor: '#475569',
        payload: tl,
      }));
      const offers = dbOfferLists.map(ol => ({
        id: `ol_${ol.id}`,
        name: `${ol.name || 'ملصقات عروض'}.off`,
        kind: 'offer_list' as const,
        typeLabel: 'قائمة عروض',
        dateLabel: formatDateShort(ol.date),
        rawDate: ol.date,
        sizeLabel: `${ol.tags?.length || 0} عرض`,
        rawSize: ol.tags?.length || 0,
        icon: Tag,
        iconColor: '#D97706',
        payload: ol,
      }));
      return [...offers, ...tags];
    }

    if (currentFolder === 'products_root') {
      return productCategories.map(cat => {
        const count = products.filter(p => (p.category?.trim() || 'غير مصنف') === cat).length;
        return {
          id: `cat_dir_${cat}`,
          name: cat,
          kind: 'folder' as const,
          typeLabel: 'تصنيف منتجات',
          sizeLabel: `${count} صنف`,
          rawSize: count,
          icon: Folder,
          iconColor: '#059669',
          targetFolderId: `prod_cat_${cat}`,
        };
      });
    }

    if (currentFolder.startsWith('prod_cat_')) {
      const cat = currentFolder.replace('prod_cat_', '');
      return products
        .filter(p => (p.category?.trim() || 'غير مصنف') === cat)
        .map(p => ({
          id: `prd_${p.id}`,
          name: `${p.name}.prd`,
          kind: 'product' as const,
          typeLabel: unitMap.get(p.unitId) || 'صنف',
          sizeLabel: `${p.price || 0} ر.س`,
          rawSize: Number(p.price || 0),
          dateLabel: p.code || '—',
          icon: Package,
          iconColor: '#059669',
          payload: p,
        }));
    }

    if (currentFolder === 'branches_root') {
      return branches.map(b => {
        const bSales = dailySales.filter(s => s.branchId === b.id);
        return {
          id: `branch_dir_${b.id}`,
          name: b.name,
          kind: 'folder' as const,
          typeLabel: b.location || 'فرع',
          sizeLabel: `${bSales.length} سجل`,
          rawSize: bSales.length,
          icon: Building2,
          iconColor: '#0284C7',
          targetFolderId: `branch_${b.id}`,
        };
      });
    }

    if (currentFolder.startsWith('branch_')) {
      const bId = currentFolder.replace('branch_', '');
      return dailySales
        .filter(s => s.branchId === bId)
        .slice(0, 150)
        .map(s => ({
          id: `sale_${s.id}`,
          name: `${s.customerName || 'مبيعات يومية'} - ${s.date.slice(0, 10)}.inv`,
          kind: 'sale' as const,
          typeLabel: s.transactionType === 'return' ? 'مرتجع' : s.paymentMethod,
          dateLabel: formatDateShort(s.date),
          rawDate: s.date,
          sizeLabel: `${Number(s.totalAmount || s.amount || 0).toLocaleString()} ر.س`,
          rawSize: Number(s.totalAmount || s.amount || 0),
          icon: FileText,
          iconColor: '#800020',
          payload: s,
        }));
    }

    if (currentFolder === 'contacts_root') {
      return [
        {
          id: 'dir_customers',
          name: 'ملف العملاء',
          kind: 'folder',
          typeLabel: 'مجلد عملاء',
          sizeLabel: `${dbCustomers.length} عميل`,
          rawSize: dbCustomers.length,
          icon: Users,
          iconColor: '#0284C7',
          targetFolderId: 'customers_dir',
        },
        {
          id: 'dir_suppliers',
          name: 'ملف الموردين',
          kind: 'folder',
          typeLabel: 'مجلد موردين',
          sizeLabel: `${dbSuppliers.length} مورد`,
          rawSize: dbSuppliers.length,
          icon: ShoppingBag,
          iconColor: '#D97706',
          targetFolderId: 'suppliers_dir',
        },
      ];
    }

    if (currentFolder === 'customers_dir') {
      return dbCustomers.map(c => ({
        id: `cust_${c.id}`,
        name: `${c.name}.cus`,
        kind: 'customer' as const,
        typeLabel: 'ملف عميل',
        dateLabel: c.phone || '—',
        sizeLabel: `${Number(c.balance || 0).toLocaleString()} ر.س`,
        rawSize: Number(c.balance || 0),
        icon: Users,
        iconColor: '#0284C7',
        payload: c,
      }));
    }

    if (currentFolder === 'suppliers_dir') {
      return dbSuppliers.map(s => ({
        id: `supp_${s.id}`,
        name: `${s.name}.sup`,
        kind: 'supplier' as const,
        typeLabel: 'ملف مورد',
        dateLabel: s.phone || '—',
        sizeLabel: s.companyName || 'مورد معتمد',
        icon: ShoppingBag,
        iconColor: '#D97706',
        payload: s,
      }));
    }

    if (currentFolder === 'desktop') {
      const desktopApps: FileEntry[] = apps
        .filter(a => !hiddenApps.includes(a.id))
        .map(app => ({
          id: `desk_app_${app.id}`,
          name: app.label,
          kind: 'app' as const,
          typeLabel: 'اختصار سطح المكتب',
          sizeLabel: 'تطبيق',
          icon: app.icon,
          iconColor: app.color,
          appId: app.id,
          isStarred: favorites.includes(app.id),
        }));

      const desktopVfs = vfsNodes
        .filter(n => !n.isDeleted && (n.parentId === 'desktop' || n.isPinnedToDesktop))
        .map(mapVfsToEntry);

      return [...desktopVfs, ...desktopApps];
    }

    if (currentFolder === 'favorites') {
      const favApps: FileEntry[] = apps
        .filter(a => favorites.includes(a.id))
        .map(app => ({
          id: `fav_app_${app.id}`,
          name: app.label,
          kind: 'app' as const,
          typeLabel: 'تطبيق مفضل',
          sizeLabel: 'تطبيق',
          icon: app.icon,
          iconColor: app.color,
          appId: app.id,
          isStarred: true,
        }));
      const favVfs = vfsNodes.filter(n => !n.isDeleted && n.isStarred).map(mapVfsToEntry);
      return [...favVfs, ...favApps];
    }

    if (currentFolder === 'recycle_bin') {
      return vfsNodes.filter(n => n.isDeleted).map(mapVfsToEntry);
    }

    // my_docs or any local VFS subfolder
    return vfsNodes
      .filter(n => !n.isDeleted && n.parentId === currentFolder)
      .map(mapVfsToEntry);
  }, [
    currentFolder,
    vfsNodes,
    apps,
    hiddenApps,
    favorites,
    departments,
    dbLists,
    dbCatalogs,
    dbPriceGroups,
    dbTagLists,
    dbOfferLists,
    dbCustomers,
    dbSuppliers,
    products,
    units,
    branches,
    dailySales,
    productCategories,
  ]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? rawEntries.filter(
          e =>
            e.name.toLowerCase().includes(q) ||
            e.typeLabel.toLowerCase().includes(q)
        )
      : rawEntries;

    const sorted = [...filtered].sort((a, b) => {
      // Keep folders/drives above files
      const aDir = a.kind === 'drive' || a.kind === 'folder' ? 0 : 1;
      const bDir = b.kind === 'drive' || b.kind === 'folder' ? 0 : 1;
      if (aDir !== bDir) return aDir - bDir;

      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name, 'ar');
      else if (sortBy === 'type') cmp = a.typeLabel.localeCompare(b.typeLabel, 'ar');
      else if (sortBy === 'date') cmp = (a.rawDate || '').localeCompare(b.rawDate || '');
      else if (sortBy === 'size') cmp = (a.rawSize || 0) - (b.rawSize || 0);
      return sortAsc ? cmp : -cmp;
    });

    return sorted;
  }, [rawEntries, searchQuery, sortBy, sortAsc]);

  const selectedEntry = useMemo(
    () => filteredAndSorted.find(e => e.id === selectedId) || null,
    [filteredAndSorted, selectedId]
  );

  const canCreateInCurrentFolder =
    currentFolder === 'my_docs' ||
    currentFolder === 'desktop' ||
    vfsNodes.some(n => !n.isDeleted && n.kind === 'folder' && n.id === currentFolder);

  // Actions
  const handleCreateFolder = () => {
    const clean = newFolderName.trim();
    if (!clean) return;
    const targetParent = canCreateInCurrentFolder ? currentFolder : 'my_docs';
    const now = new Date().toISOString();
    const newNode: VfsNode = {
      id: `vfs_${crypto.randomUUID()}`,
      parentId: targetParent,
      name: clean,
      kind: 'folder',
      sizeBytes: 0,
      createdAt: now,
      updatedAt: now,
      isPinnedToDesktop: targetParent === 'desktop',
    };
    persistVfs([newNode, ...vfsNodes]);
    setNewFolderName('');
    setNewFolderModalOpen(false);
    if (!canCreateInCurrentFolder) navigateTo('my_docs');
  };

  const handleCreateNote = () => {
    const targetParent = canCreateInCurrentFolder ? currentFolder : 'my_docs';
    const now = new Date().toISOString();
    const newNode: VfsNode = {
      id: `vfs_${crypto.randomUUID()}`,
      parentId: targetParent,
      name: `ملاحظة جديدة ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }).replace(':', '-')}.txt`,
      kind: 'note',
      mimeType: 'text/plain',
      content: '',
      sizeBytes: 0,
      createdAt: now,
      updatedAt: now,
      isPinnedToDesktop: targetParent === 'desktop',
    };
    persistVfs([newNode, ...vfsNodes]);
    setEditingNote(newNode);
    setNoteTitleDraft(newNode.name);
    setNoteContentDraft('');
    if (!canCreateInCurrentFolder) navigateTo('my_docs');
  };

  const handleSaveNote = () => {
    if (!editingNote) return;
    const cleanTitle = noteTitleDraft.trim() || 'مستند بدون عنوان.txt';
    const content = noteContentDraft;
    const sizeBytes = new Blob([content]).size;
    const updated = vfsNodes.map(n =>
      n.id === editingNote.id
        ? { ...n, name: cleanTitle, content, sizeBytes, updatedAt: new Date().toISOString() }
        : n
    );
    persistVfs(updated);
    setEditingNote(null);
  };

  const handleUploadLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notify('حجم الملف يتجاوز 2 ميجابايت للتخزين المحلي السريع.', 'warning');
      e.target.value = '';
      return;
    }
    const targetParent = canCreateInCurrentFolder ? currentFolder : 'my_docs';
    const reader = new FileReader();
    reader.onload = () => {
      const now = new Date().toISOString();
      const newNode: VfsNode = {
        id: `vfs_${crypto.randomUUID()}`,
        parentId: targetParent,
        name: file.name,
        kind: file.type.startsWith('text/') || file.name.endsWith('.json') || file.name.endsWith('.csv') ? 'note' : 'file',
        mimeType: file.type || 'application/octet-stream',
        content: String(reader.result || ''),
        sizeBytes: file.size,
        createdAt: now,
        updatedAt: now,
        isPinnedToDesktop: targetParent === 'desktop',
      };
      persistVfs([newNode, ...vfsNodes]);
      if (!canCreateInCurrentFolder) navigateTo('my_docs');
    };
    if (file.type.startsWith('text/') || file.name.endsWith('.json') || file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleOpenEntry = (entry: FileEntry) => {
    if (entry.targetFolderId) {
      navigateTo(entry.targetFolderId);
      return;
    }
    if (entry.appId) {
      onOpenApp(entry.appId);
      return;
    }
    if (entry.kind === 'list' && entry.payload?.id) {
      onNavigateToList(entry.payload.id);
      return;
    }
    if (entry.kind === 'catalog') {
      onOpenApp('catalog');
      return;
    }
    if (entry.kind === 'price_group') {
      onOpenApp('price_groups');
      return;
    }
    if (entry.kind === 'offer_list') {
      onOpenApp('offers');
      return;
    }
    if (entry.kind === 'tag_list') {
      onOpenApp('price_tags');
      return;
    }
    if (entry.kind === 'product') {
      onOpenApp('products');
      return;
    }
    if (entry.kind === 'sale') {
      onOpenApp('sales_entry');
      return;
    }
    if (entry.kind === 'customer') {
      onOpenApp('customers');
      return;
    }
    if (entry.kind === 'supplier') {
      onOpenApp('suppliers');
      return;
    }
    if (entry.vfsNode) {
      if (entry.vfsNode.isDeleted) {
        notify('استعد الملف من سلة المحذوفات أولاً لفتحه.', 'warning');
        return;
      }
      if (entry.vfsNode.kind === 'note') {
        setEditingNote(entry.vfsNode);
        setNoteTitleDraft(entry.vfsNode.name);
        setNoteContentDraft(entry.vfsNode.content || '');
      } else if (entry.vfsNode.content) {
        setPreviewMedia({
          title: entry.vfsNode.name,
          content: entry.vfsNode.content,
          mimeType: entry.vfsNode.mimeType,
        });
      }
    }
  };

  const handleDeleteVfs = async (node: VfsNode, permanent = false) => {
    if (permanent) {
      const ok = await confirm({
        title: 'حذف نهائي',
        message: `حذف "${node.name}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`,
        confirmLabel: 'حذف نهائي',
        variant: 'danger'
      });
      if (!ok) return;
      persistVfs(vfsNodes.filter(n => n.id !== node.id && n.parentId !== node.id));
    } else {
      persistVfs(
        vfsNodes.map(n =>
          n.id === node.id
            ? { ...n, isDeleted: true, deletedFrom: n.parentId }
            : n
        )
      );
    }
    if (selectedId === node.id) setSelectedId(null);
  };

  const handleRestoreVfs = (node: VfsNode) => {
    persistVfs(
      vfsNodes.map(n =>
        n.id === node.id
          ? { ...n, isDeleted: false, parentId: n.deletedFrom || 'my_docs' }
          : n
      )
    );
  };

  const handleEmptyRecycleBin = async () => {
    const deletedCount = vfsNodes.filter(n => n.isDeleted).length;
    if (deletedCount === 0) return;
    const ok = await confirm({
      title: 'إفراغ سلة المحذوفات',
      message: `إفراغ سلة المحذوفات وحذف ${deletedCount} عنصر نهائياً؟`,
      confirmLabel: 'إفراغ السلة',
      variant: 'danger'
    });
    if (!ok) return;
    persistVfs(vfsNodes.filter(n => !n.isDeleted));
  };

  const handleCommitRename = (nodeId: string) => {
    const clean = renameValue.trim();
    if (clean) {
      persistVfs(
        vfsNodes.map(n =>
          n.id === nodeId ? { ...n, name: clean, updatedAt: new Date().toISOString() } : n
        )
      );
    }
    setRenamingId(null);
  };

  const handleToggleStarVfs = (nodeId: string) => {
    persistVfs(vfsNodes.map(n => (n.id === nodeId ? { ...n, isStarred: !n.isStarred } : n)));
  };

  const handleToggleDesktopPinVfs = (nodeId: string) => {
    persistVfs(
      vfsNodes.map(n =>
        n.id === nodeId ? { ...n, isPinnedToDesktop: !n.isPinnedToDesktop } : n
      )
    );
  };

  const handleDownloadEntry = (entry: FileEntry) => {
    let content = '';
    let filename = entry.name;
    let mime = 'application/json;charset=utf-8';

    if (entry.vfsNode) {
      if (entry.vfsNode.kind === 'file' && entry.vfsNode.content?.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = entry.vfsNode.content;
        a.download = entry.vfsNode.name;
        a.click();
        return;
      }
      content = entry.vfsNode.content || '';
      mime = 'text/plain;charset=utf-8';
    } else if (entry.payload) {
      content = JSON.stringify(entry.payload, null, 2);
      filename = `${entry.name}.json`;
    } else {
      return;
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSortClick = (col: 'name' | 'type' | 'date' | 'size') => {
    if (sortBy === col) setSortAsc(!sortAsc);
    else {
      setSortBy(col);
      setSortAsc(true);
    }
  };

  const sidebarLocations = [
    { id: 'this_pc', label: 'جهاز الكمبيوتر', icon: HardDrive },
    { id: 'desktop', label: 'سطح المكتب', icon: Monitor },
    { id: 'my_docs', label: 'مستنداتي المحلية', icon: Folder },
    { id: 'favorites', label: 'المفضلة', icon: Star },
    { id: 'drive_c', label: 'القرص (C:) البرامج', icon: HardDrive },
    { id: 'drive_d', label: 'القرص (D:) المتجر', icon: HardDrive },
    { id: 'lists', label: 'قوائم الجرد', icon: FileSpreadsheet },
    { id: 'products_root', label: 'المنتجات', icon: Package },
    { id: 'branches_root', label: 'الفروع والمبيعات', icon: Building2 },
    { id: 'recycle_bin', label: 'سلة المحذوفات', icon: Trash2 },
  ];

  const activeCrumb = breadcrumbs[breadcrumbs.length - 1];

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-[#191919] text-slate-800 dark:text-slate-100 select-none" dir="rtl">
      {/* Windows 11 Explorer Tab Strip */}
      <div className="px-3 pt-2 bg-[#EFEFEF] dark:bg-[#202020] flex items-end gap-1.5 border-b border-slate-200/80 dark:border-white/8 shrink-0">
        <div className="px-3.5 py-1.5 rounded-t-lg bg-[#F7F7F7] dark:bg-[#2B2B2B] border border-b-0 border-slate-200/80 dark:border-white/10 flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white min-w-[160px] max-w-[240px]">
          <FolderOpen size={14} className="text-amber-500 shrink-0" />
          <span className="truncate">{activeCrumb?.label || 'جهاز الكمبيوتر'}</span>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('this_pc')}
          className="mb-1 p-1.5 rounded-md text-slate-500 hover:bg-black/6 dark:hover:bg-white/10 transition-colors"
          title="فتح الرئيسية (جهاز الكمبيوتر)"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Top Explorer Navigation & Address Bar */}
      <div className="px-3 py-2 border-b border-slate-200/80 dark:border-white/8 bg-[#F7F7F7] dark:bg-[#2B2B2B] flex flex-wrap items-center gap-2 shrink-0">
        {/* History Navigation */}
        <div className="flex items-center gap-0.5 shrink-0" dir="ltr">
          <button
            type="button"
            onClick={goBack}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded-lg hover:bg-black/6 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
            title="للخلف"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={goForward}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded-lg hover:bg-black/6 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
            title="للأمام"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={goUp}
            disabled={currentFolder === 'this_pc'}
            className="p-1.5 rounded-lg hover:bg-black/6 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
            title="للمستوى الأعلى"
          >
            <ArrowUp size={16} />
          </button>
          <button
            type="button"
            onClick={fetchStoreFiles}
            className="p-1.5 rounded-lg hover:bg-black/6 dark:hover:bg-white/10 transition-colors"
            title="تحديث الملفات"
          >
            <RefreshCw size={15} className={isFetching ? 'animate-spin text-[#0078D4]' : ''} />
          </button>
        </div>

        {/* Breadcrumb Address Bar */}
        <div className="flex-1 min-w-[200px] bg-white dark:bg-[#1F1F1F] border border-slate-200 dark:border-white/12 rounded-lg px-2.5 py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar text-xs">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              {idx > 0 && <ChevronLeft size={13} className="text-slate-400 shrink-0" />}
              <button
                type="button"
                onClick={() => navigateTo(crumb.id)}
                className={`whitespace-nowrap shrink-0 px-1.5 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 transition-colors ${
                  idx === breadcrumbs.length - 1
                    ? 'font-bold text-slate-900 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {crumb.label}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-44 sm:w-56 shrink-0">
          <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في المجلد..."
            className="w-full bg-white dark:bg-[#1F1F1F] border border-slate-200 dark:border-white/12 rounded-lg pr-8 pl-2.5 py-1.5 text-xs focus:outline-none focus:border-[#0078D4]"
          />
        </div>
      </div>

      {/* Action Ribbon */}
      <div className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setNewFolderModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold whitespace-nowrap shrink-0 transition-colors"
          >
            <FolderPlus size={14} className="text-amber-600" />
            <span>مجلد جديد</span>
          </button>

          <button
            type="button"
            onClick={handleCreateNote}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold whitespace-nowrap shrink-0 transition-colors"
          >
            <FilePlus size={14} className="text-blue-600" />
            <span>مستند نصي</span>
          </button>

          <button
            type="button"
            onClick={() => fileUploadRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold whitespace-nowrap shrink-0 transition-colors"
          >
            <Upload size={14} className="text-emerald-600" />
            <span>استيراد ملف</span>
          </button>
          <input
            ref={fileUploadRef}
            type="file"
            className="hidden"
            onChange={handleUploadLocalFile}
          />

          {currentFolder === 'recycle_bin' && rawEntries.length > 0 && (
            <button
              type="button"
              onClick={handleEmptyRecycleBin}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              <Trash2 size={14} />
              <span>إفراغ السلة</span>
            </button>
          )}
        </div>

        {/* View & Inspector Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-md p-0.5 bg-slate-50 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('details')}
              className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
                viewMode === 'details'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="عرض قائمة تفصيلية"
            >
              <ListIcon size={14} />
              <span className="hidden sm:inline">تفاصيل</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="عرض أيقونات"
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">أيقونات</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowInspector(!showInspector)}
            className={`px-2.5 py-1.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              showInspector
                ? 'border-sap-primary/40 bg-sap-primary/5 text-sap-primary dark:text-amber-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
            title="لوحة المعاينة"
          >
            <PanelRight size={14} />
            <span className="hidden md:inline">المعاينة</span>
          </button>
        </div>
      </div>

      {/* Main 3-Pane Explorer Workspace */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Navigation Tree Sidebar */}
        <aside className="w-48 lg:w-56 border-l border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 overflow-y-auto p-2 shrink-0 hidden sm:flex flex-col gap-0.5 custom-scrollbar">
          <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-400">الوصول السريع</div>
          {sidebarLocations.map(loc => {
            const active = currentFolder === loc.id;
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => navigateTo(loc.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs transition-colors text-right ${
                  active
                    ? 'bg-sap-primary/10 text-sap-primary dark:text-amber-400 font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/70 font-medium'
                }`}
              >
                <loc.icon size={15} className="shrink-0" />
                <span className="truncate">{loc.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Directory Content View */}
        <div
          className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar"
          onClick={() => setSelectedId(null)}
        >
          {filteredAndSorted.length === 0 ? (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6">
              <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <FolderOpen size={28} />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                {searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'هذا المجلد فارغ حالياً'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-xs">
                {canCreateInCurrentFolder
                  ? 'يمكنك إنشاء مجلد جديد أو مستند نصي أو استيراد ملف من جهازك.'
                  : 'جرّب العودة للمستوى الأعلى أو اختيار قسم آخر من القائمة الجانبية.'}
              </p>
              {canCreateInCurrentFolder && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewFolderModalOpen(true)}
                    className="px-3.5 py-2 rounded-md bg-sap-primary text-white text-xs font-bold hover:bg-sap-primary-hover transition-colors"
                  >
                    إنشاء مجلد
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateNote}
                    className="px-3.5 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    مستند نصي
                  </button>
                </div>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredAndSorted.map(entry => {
                const isSelected = selectedId === entry.id;
                const isRenaming = renamingId === entry.id;
                return (
                  <div
                    key={entry.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(entry.id);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleOpenEntry(entry);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedId(entry.id);
                      setContextMenu({ x: e.clientX, y: e.clientY, entry });
                    }}
                    className={`group p-3 rounded-lg border transition-colors cursor-pointer flex flex-col items-center text-center gap-2 ${
                      isSelected
                        ? 'bg-sap-primary/8 border-sap-primary/50 dark:bg-sap-primary/20'
                        : 'border-transparent hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:border-slate-200 dark:hover:border-slate-700'
                    }`}
                  >
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: entry.iconColor ? `${entry.iconColor}15` : '#f1f5f9',
                        color: entry.iconColor || '#475569',
                      }}
                    >
                      <entry.icon size={26} />
                    </div>

                    {isRenaming ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleCommitRename(entry.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCommitRename(entry.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-xs text-center bg-white dark:bg-slate-950 border border-sap-primary rounded px-1 py-0.5 focus:outline-none"
                      />
                    ) : (
                      <div className="w-full">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {entry.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 tabular-nums">
                          {entry.sizeLabel || entry.typeLabel}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-right border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-2 px-3">
                      <button type="button" onClick={() => handleSortClick('name')} className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
                        <span>الاسم</span>
                        <ArrowUpDown size={11} />
                      </button>
                    </th>
                    <th className="py-2 px-3 hidden md:table-cell">
                      <button type="button" onClick={() => handleSortClick('type')} className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
                        <span>النوع</span>
                        <ArrowUpDown size={11} />
                      </button>
                    </th>
                    <th className="py-2 px-3 hidden sm:table-cell">
                      <button type="button" onClick={() => handleSortClick('date')} className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
                        <span>التاريخ / المرجع</span>
                        <ArrowUpDown size={11} />
                      </button>
                    </th>
                    <th className="py-2 px-3 text-left">
                      <button type="button" onClick={() => handleSortClick('size')} className="flex items-center gap-1 mr-auto hover:text-slate-900 dark:hover:text-white">
                        <span>الحجم / القيمة</span>
                        <ArrowUpDown size={11} />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {filteredAndSorted.map(entry => {
                    const isSelected = selectedId === entry.id;
                    const isRenaming = renamingId === entry.id;
                    return (
                      <tr
                        key={entry.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(entry.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleOpenEntry(entry);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedId(entry.id);
                          setContextMenu({ x: e.clientX, y: e.clientY, entry });
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-sap-primary/10 dark:bg-sap-primary/20'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="py-2 px-3 max-w-[260px]">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                              style={{
                                backgroundColor: entry.iconColor ? `${entry.iconColor}18` : '#f1f5f9',
                                color: entry.iconColor || '#475569',
                              }}
                            >
                              <entry.icon size={15} />
                            </span>
                            {isRenaming ? (
                              <input
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={() => handleCommitRename(entry.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCommitRename(entry.id);
                                  if (e.key === 'Escape') setRenamingId(null);
                                }}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 bg-white dark:bg-slate-950 border border-sap-primary rounded px-1.5 py-0.5 text-xs focus:outline-none"
                              />
                            ) : (
                              <span className="font-semibold truncate text-slate-800 dark:text-slate-100">
                                {entry.name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400 hidden md:table-cell whitespace-nowrap">
                          {entry.typeLabel}
                        </td>
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400 hidden sm:table-cell whitespace-nowrap tabular-nums">
                          {entry.dateLabel || '—'}
                        </td>
                        <td className="py-2 px-3 text-left font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap tabular-nums">
                          {entry.sizeLabel || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Inspector / Preview Pane */}
        {showInspector && (
          <aside className="w-64 lg:w-72 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-4 overflow-y-auto shrink-0 hidden lg:flex flex-col gap-4 custom-scrollbar">
            {!selectedEntry ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 py-8">
                <Eye size={28} className="mb-2 opacity-60" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">معاينة وتفاصيل العنصر</p>
                <p className="text-[11px] mt-1">حدد أي ملف أو مجلد لعرض خصائصه ومحتواه أو تشغيله.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center text-center pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
                    style={{
                      backgroundColor: selectedEntry.iconColor ? `${selectedEntry.iconColor}18` : '#f1f5f9',
                      color: selectedEntry.iconColor || '#475569',
                    }}
                  >
                    <selectedEntry.icon size={30} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white break-words w-full">
                    {selectedEntry.name}
                  </h4>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span>{selectedEntry.typeLabel}</span>
                    {selectedEntry.sizeLabel && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{selectedEntry.sizeLabel}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="space-y-2 text-xs">
                  {selectedEntry.dateLabel && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">التاريخ / المرجع</span>
                      <span className="font-semibold tabular-nums">{selectedEntry.dateLabel}</span>
                    </div>
                  )}

                  {/* Rich Payload Previews */}
                  {selectedEntry.kind === 'list' && selectedEntry.payload?.rows && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-500">معاينة الأصناف ({selectedEntry.payload.rows.length})</div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {selectedEntry.payload.rows.slice(0, 8).map((r: any, idx: number) => (
                          <div key={idx} className="flex justify-between gap-2 text-[11px] py-1 border-b border-slate-100 dark:border-slate-800/60">
                            <span className="truncate">{r.name || 'صنف'}</span>
                            <span className="tabular-nums text-slate-500 shrink-0">{r.qty || r.cartonQty || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedEntry.kind === 'product' && selectedEntry.payload && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-500">الكود</span>
                        <span className="font-mono">{selectedEntry.payload.code}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">السعر</span>
                        <span className="font-bold tabular-nums">{selectedEntry.payload.price || 0} ر.س</span>
                      </div>
                      {selectedEntry.payload.stock !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">الرصيد</span>
                          <span className="tabular-nums">{selectedEntry.payload.stock}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedEntry.kind === 'sale' && selectedEntry.payload && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-500">الإجمالي</span>
                        <span className="font-bold tabular-nums">{Number(selectedEntry.payload.totalAmount || 0).toLocaleString()} ر.س</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">المدفوع</span>
                        <span className="tabular-nums">{Number(selectedEntry.payload.paidAmount || 0).toLocaleString()} ر.س</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">المتبقي</span>
                        <span className="tabular-nums">{Number(selectedEntry.payload.remainingAmount || 0).toLocaleString()} ر.س</span>
                      </div>
                    </div>
                  )}

                  {selectedEntry.vfsNode && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                      {selectedEntry.vfsNode.mimeType?.startsWith('image/') && selectedEntry.vfsNode.content && (
                        <img
                          src={selectedEntry.vfsNode.content}
                          alt={selectedEntry.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-32 object-cover rounded-md border border-slate-200 dark:border-slate-700"
                        />
                      )}
                      {selectedEntry.vfsNode.kind === 'note' && (
                        <pre className="text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-sans bg-white dark:bg-slate-900 p-2.5 rounded-md border border-slate-200 dark:border-slate-800 max-h-40 overflow-y-auto">
                          {selectedEntry.vfsNode.content || 'مستند فارغ'}
                        </pre>
                      )}
                    </div>
                  )}
                </div>

                {/* Primary Actions */}
                <div className="mt-auto pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEntry(selectedEntry)}
                    className="w-full py-2 px-3 rounded-md bg-sap-primary text-white text-xs font-bold hover:bg-sap-primary-hover transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink size={14} />
                    <span>{selectedEntry.targetFolderId ? 'فتح المجلد' : 'فتح'}</span>
                  </button>

                  {selectedEntry.appId && (
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(selectedEntry.appId!)}
                      className="w-full py-1.5 px-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Star size={14} className={favorites.includes(selectedEntry.appId) ? 'text-amber-500 fill-amber-500' : ''} />
                      <span>{favorites.includes(selectedEntry.appId) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}</span>
                    </button>
                  )}

                  {selectedEntry.appId && onToggleDesktopPin && (
                    <button
                      type="button"
                      onClick={() => onToggleDesktopPin(selectedEntry.appId!)}
                      className="w-full py-1.5 px-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Pin size={14} />
                      <span>{hiddenApps.includes(selectedEntry.appId) ? 'تثبيت على سطح المكتب' : 'إزالة من سطح المكتب'}</span>
                    </button>
                  )}

                  {(selectedEntry.vfsNode || selectedEntry.payload) && (
                    <button
                      type="button"
                      onClick={() => handleDownloadEntry(selectedEntry)}
                      className="w-full py-1.5 px-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Download size={14} />
                      <span>تصدير / تنزيل</span>
                    </button>
                  )}

                  {selectedEntry.vfsNode && !selectedEntry.vfsNode.isDeleted && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(selectedEntry.id);
                          setRenameValue(selectedEntry.name);
                        }}
                        className="py-1.5 px-2 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-1"
                      >
                        <Edit3 size={13} />
                        <span>إعادة تسمية</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVfs(selectedEntry.vfsNode!)}
                        className="py-1.5 px-2 rounded-md border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-semibold flex items-center justify-center gap-1"
                      >
                        <Trash2 size={13} />
                        <span>حذف</span>
                      </button>
                    </div>
                  )}

                  {selectedEntry.vfsNode?.isDeleted && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleRestoreVfs(selectedEntry.vfsNode!)}
                        className="py-1.5 px-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold flex items-center justify-center gap-1"
                      >
                        <RotateCcw size={13} />
                        <span>استعادة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVfs(selectedEntry.vfsNode!, true)}
                        className="py-1.5 px-2 rounded-md bg-red-600 text-white hover:bg-red-700 text-xs font-semibold flex items-center justify-center gap-1"
                      >
                        <Trash2 size={13} />
                        <span>حذف نهائي</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        )}
      </div>

      {/* Status Bar */}
      <footer className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-4 shrink-0 tabular-nums">
        <div className="flex items-center gap-2">
          <span>{filteredAndSorted.length} عنصر</span>
          {selectedEntry && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate max-w-[200px] text-slate-700 dark:text-slate-200 font-medium">
                محدد: {selectedEntry.name}
              </span>
            </>
          )}
        </div>
        <div className="hidden sm:block truncate">
          {breadcrumbs[breadcrumbs.length - 1]?.label}
        </div>
      </footer>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 220), left: Math.min(contextMenu.x, window.innerWidth - 200) }}
          className="fixed z-[1200] w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              handleOpenEntry(contextMenu.entry);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 font-semibold"
          >
            <ExternalLink size={14} />
            <span>فتح</span>
          </button>

          {contextMenu.entry.vfsNode && !contextMenu.entry.vfsNode.isDeleted && (
            <>
              <button
                type="button"
                onClick={() => {
                  handleToggleStarVfs(contextMenu.entry.id);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <Star size={14} />
                <span>{contextMenu.entry.vfsNode.isStarred ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleToggleDesktopPinVfs(contextMenu.entry.id);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <Pin size={14} />
                <span>{contextMenu.entry.vfsNode.isPinnedToDesktop ? 'إلغاء التثبيت من سطح المكتب' : 'تثبيت على سطح المكتب'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenamingId(contextMenu.entry.id);
                  setRenameValue(contextMenu.entry.name);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <Edit3 size={14} />
                <span>إعادة تسمية</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDeleteVfs(contextMenu.entry.vfsNode!);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-right text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
              >
                <Trash2 size={14} />
                <span>نقل إلى سلة المحذوفات</span>
              </button>
            </>
          )}

          {contextMenu.entry.vfsNode?.isDeleted && (
            <>
              <button
                type="button"
                onClick={() => {
                  handleRestoreVfs(contextMenu.entry.vfsNode!);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-right text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2"
              >
                <RotateCcw size={14} />
                <span>استعادة</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDeleteVfs(contextMenu.entry.vfsNode!, true);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-right text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
              >
                <Trash2 size={14} />
                <span>حذف نهائي</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* New Folder Modal */}
      {newFolderModalOpen && (
        <div className="fixed inset-0 z-[1100] bg-black/40 flex items-center justify-center p-4" onClick={() => setNewFolderModalOpen(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-3">إنشاء مجلد جديد</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              placeholder="اسم المجلد..."
              autoFocus
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-md px-3 py-2 text-xs mb-4 focus:outline-none focus:border-sap-primary"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewFolderModalOpen(false)}
                className="px-3.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateFolder}
                className="px-4 py-1.5 rounded-md bg-sap-primary text-white text-xs font-bold hover:bg-sap-primary-hover"
              >
                إنشاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Built-in Text / Note Editor Modal */}
      {editingNote && (
        <div className="fixed inset-0 z-[1100] bg-black/50 flex items-center justify-center p-4" onClick={() => setEditingNote(null)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60">
              <input
                type="text"
                value={noteTitleDraft}
                onChange={(e) => setNoteTitleDraft(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-sap-primary"
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSaveNote}
                  className="px-3.5 py-1.5 rounded-md bg-sap-primary text-white text-xs font-bold hover:bg-sap-primary-hover flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span>حفظ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
                  className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <textarea
              value={noteContentDraft}
              onChange={(e) => setNoteContentDraft(e.target.value)}
              placeholder="اكتب محتوى المستند هنا..."
              className="flex-1 min-h-[300px] p-4 bg-white dark:bg-slate-900 text-sm leading-relaxed focus:outline-none resize-none"
            />
          </div>
        </div>
      )}

      {/* Media / File Viewer Modal */}
      {previewMedia && (
        <div className="fixed inset-0 z-[1100] bg-black/60 flex items-center justify-center p-4" onClick={() => setPreviewMedia(null)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold truncate">{previewMedia.title}</span>
              <button type="button" onClick={() => setPreviewMedia(null)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-auto flex items-center justify-center bg-slate-50 dark:bg-slate-950">
              {previewMedia.mimeType?.startsWith('image/') ? (
                <img src={previewMedia.content} alt={previewMedia.title} referrerPolicy="no-referrer" className="max-w-full max-h-[65vh] object-contain rounded" />
              ) : (
                <iframe src={previewMedia.content} title={previewMedia.title} className="w-full h-[65vh] bg-white rounded border border-slate-200" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
