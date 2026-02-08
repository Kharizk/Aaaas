
import React, { useState, useEffect } from 'react';
import { User, Branch, Permission, ActivityLog } from '../types';
import { db } from '../services/supabase';
import { 
  Users, Plus, Trash2, Edit2, Shield, Key, Save, X, Loader2, 
  Search, CheckCircle2, History, UserCog, Building, Lock
} from 'lucide-react';

interface UserManagerProps {
  currentUser: User;
  branches: Branch[];
}

const ALL_PERMISSIONS: { key: Permission, label: string }[] = [
  { key: 'view_dashboard', label: 'عرض لوحة التحكم' },
  { key: 'view_products', label: 'عرض المنتجات (قراءة فقط)' },
  { key: 'manage_products', label: 'إدارة المنتجات (إضافة/تعديل/حذف)' },
  { key: 'record_sales', label: 'تسجيل المبيعات اليومية' },
  { key: 'view_reports', label: 'الاطلاع على التقارير' },
  { key: 'manage_settlements', label: 'إدارة التسويات' },
  { key: 'print_labels', label: 'طباعة الملصقات' },
  { key: 'manage_branches', label: 'إدارة الفروع' },
  { key: 'manage_users', label: 'إدارة المستخدمين' },
  { key: 'manage_settings', label: 'الإعدادات العامة' },
  { key: 'manage_database', label: 'إدارة قاعدة البيانات' },
];

export const UserManager: React.FC<UserManagerProps> = ({ currentUser, branches }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [branchId, setBranchId] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);

  useEffect(() => {
    fetchUsers();
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
        const data = await db.users.getAll();
        setUsers(data as User[]);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
        const data = await db.logs.getAll(50); // Get last 50 logs
        setLogs(data as ActivityLog[]);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const handleOpenModal = (user?: User) => {
    if (user) {
        setEditingUser(user);
        setUsername(user.username);
        setPassword(user.password || ''); // Warning: In real app, don't fill password
        setFullName(user.fullName);
        setRole(user.role);
        setBranchId(user.branchId || '');
        setSelectedPermissions(user.permissions || []);
    } else {
        setEditingUser(null);
        setUsername('');
        setPassword('');
        setFullName('');
        setRole('user');
        setBranchId('');
        setSelectedPermissions(['view_dashboard', 'record_sales']); // Default perms
    }
    setIsModalOpen(true);
  };

  const togglePermission = (perm: Permission) => {
      setSelectedPermissions(prev => 
          prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
      );
  };

  const handleSave = async () => {
      if (!username || !fullName) { alert("يرجى ملء الحقول الأساسية"); return; }
      if (!editingUser && !password) { alert("كلمة المرور مطلوبة للمستخدم الجديد"); return; }
      
      const userId = editingUser ? editingUser.id : crypto.randomUUID();
      const userData: User = {
          id: userId,
          username,
          password: password, // Note: Should be hashed
          fullName,
          role,
          branchId: role === 'admin' ? undefined : (branchId || undefined),
          permissions: role === 'admin' ? ALL_PERMISSIONS.map(p => p.key) : selectedPermissions,
          isActive: true
      };

      try {
          await db.users.upsert(userData);
          
          // Log Action
          await db.logs.add({
              userId: currentUser.id,
              username: currentUser.username,
              action: editingUser ? 'UPDATE_USER' : 'CREATE_USER',
              details: `تم ${editingUser ? 'تحديث' : 'إنشاء'} المستخدم: ${username}`
          });

          fetchUsers();
          setIsModalOpen(false);
      } catch (e) {
          alert("حدث خطأ أثناء الحفظ");
      }
  };

  const handleDelete = async (user: User) => {
      if (user.id === currentUser.id) { alert("لا يمكنك حذف حسابك الحالي"); return; }
      if (!confirm(`هل أنت متأكد من حذف المستخدم ${user.fullName}؟`)) return;

      try {
          await db.users.delete(user.id);
          // Log Action
          await db.logs.add({
              userId: currentUser.id,
              username: currentUser.username,
              action: 'DELETE_USER',
              details: `تم حذف المستخدم: ${user.username}`
          });
          fetchUsers();
      } catch (e) { alert("فشل الحذف"); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 border border-sap-border rounded-sap-m shadow-sm">
            <div>
                <h2 className="text-2xl font-black text-sap-text flex items-center gap-2">
                    <UserCog size={28} className="text-sap-primary" /> إدارة المستخدمين والصلاحيات
                </h2>
                <p className="text-xs text-sap-text-variant font-bold mt-1">التحكم في الوصول، توزيع الفروع، ومراقبة النشاط</p>
            </div>
            <div className="flex gap-2">
                <button 
                  onClick={() => setActiveTab('users')} 
                  className={`px-6 py-2 rounded-sap-s text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'users' ? 'bg-sap-primary text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    <Users size={16}/> المستخدمين
                </button>
                <button 
                  onClick={() => setActiveTab('logs')} 
                  className={`px-6 py-2 rounded-sap-s text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'logs' ? 'bg-sap-primary text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    <History size={16}/> سجل العمليات
                </button>
            </div>
        </div>

        {activeTab === 'users' && (
            <div className="space-y-4">
                <div className="flex justify-end">
                    <button onClick={() => handleOpenModal()} className="bg-sap-primary text-white px-6 py-2 rounded-sap-s font-black text-xs flex items-center gap-2 shadow-sm hover:bg-sap-primary-hover">
                        <Plus size={16}/> إضافة مستخدم جديد
                    </button>
                </div>

                <div className="bg-white border border-sap-border rounded-sap-m overflow-hidden shadow-sm">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-sap-shell text-white font-black text-[11px] uppercase">
                            <tr>
                                <th className="p-4">اسم المستخدم</th>
                                <th className="p-4">الاسم الكامل</th>
                                <th className="p-4">الدور</th>
                                <th className="p-4">الفرع المرتبط</th>
                                <th className="p-4">آخر دخول</th>
                                <th className="p-4 text-center">التحكم</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-sap-border font-bold">
                            {users.map(user => (
                                <tr key={user.id} className="hover:bg-sap-highlight/20 transition-colors">
                                    <td className="p-4 font-mono text-sap-primary">{user.username}</td>
                                    <td className="p-4">{user.fullName}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-[10px] ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                            {user.role === 'admin' ? 'مدير عام' : 'مستخدم'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {user.role === 'admin' ? 
                                            <span className="text-gray-400 text-xs">كل الفروع</span> : 
                                            (branches.find(b => b.id === user.branchId)?.name || <span className="text-red-500">غير محدد</span>)
                                        }
                                    </td>
                                    <td className="p-4 text-xs font-mono text-gray-500">
                                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString('ar-SA') : '-'}
                                    </td>
                                    <td className="p-4 flex justify-center gap-2">
                                        <button onClick={() => handleOpenModal(user)} className="p-2 text-sap-text-variant hover:text-sap-primary hover:bg-sap-highlight rounded"><Edit2 size={16}/></button>
                                        <button onClick={() => handleDelete(user)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'logs' && (
            <div className="bg-white border border-sap-border rounded-sap-m overflow-hidden shadow-sm">
                 <table className="w-full text-right text-sm">
                    <thead className="bg-gray-100 text-gray-600 font-black text-[11px] uppercase border-b border-sap-border">
                        <tr>
                            <th className="p-4">التوقيت</th>
                            <th className="p-4">المستخدم</th>
                            <th className="p-4">الحدث</th>
                            <th className="p-4">التفاصيل</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-sap-border font-medium">
                        {logs.map(log => (
                            <tr key={log.id} className="hover:bg-gray-50">
                                <td className="p-4 font-mono text-xs text-gray-500">{new Date(log.timestamp).toLocaleString('ar-SA')}</td>
                                <td className="p-4 font-bold text-sap-primary">{log.username}</td>
                                <td className="p-4 font-bold text-xs uppercase">{log.action}</td>
                                <td className="p-4 text-xs text-gray-600">{log.details}</td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
            </div>
        )}

        {/* Create/Edit Modal */}
        {isModalOpen && (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white w-full max-w-2xl rounded-sap-m shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-4 bg-sap-primary text-white flex justify-between items-center font-black">
                        <h3>{editingUser ? 'تعديل بيانات المستخدم' : 'إنشاء حساب جديد'}</h3>
                        <button onClick={() => setIsModalOpen(false)}><X size={20}/></button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-black text-gray-500">اسم المستخدم (للدخول)</label>
                                <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full font-bold" disabled={!!editingUser} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-black text-gray-500">الاسم الكامل (للموظف)</label>
                                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full font-bold" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-black text-gray-500">كلمة المرور</label>
                                <div className="relative">
                                    <input type="text" value={password} onChange={e => setPassword(e.target.value)} className="w-full font-bold pl-8" placeholder={editingUser ? 'اتركه فارغاً للإبقاء على الحالية' : ''} />
                                    <Lock size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-black text-gray-500">نوع الحساب</label>
                                <select value={role} onChange={e => setRole(e.target.value as any)} className="w-full font-bold bg-gray-50">
                                    <option value="user">مستخدم (موظف/كاشير)</option>
                                    <option value="admin">مدير (Admin)</option>
                                </select>
                            </div>
                        </div>

                        {role === 'user' && (
                            <div className="space-y-1 bg-sap-highlight/20 p-4 rounded border border-sap-primary/20">
                                <label className="text-xs font-black text-sap-primary flex items-center gap-2"><Building size={14}/> الفرع المرتبط (إلزامي للمستخدمين)</label>
                                <select value={branchId} onChange={e => setBranchId(e.target.value)} className="w-full font-bold">
                                    <option value="">-- اختر الفرع --</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                                <p className="text-[10px] text-gray-500 mt-1">سيرى المستخدم فقط البيانات (مبيعات/تسويات) الخاصة بهذا الفرع.</p>
                            </div>
                        )}

                        {role === 'user' && (
                            <div className="space-y-3">
                                <label className="text-xs font-black text-gray-500 flex items-center gap-2"><Shield size={14}/> صلاحيات الوصول</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {ALL_PERMISSIONS.map(perm => (
                                        <label key={perm.key} className={`flex items-center gap-2 p-2 rounded cursor-pointer border ${selectedPermissions.includes(perm.key) ? 'bg-sap-primary/10 border-sap-primary' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedPermissions.includes(perm.key)}
                                                onChange={() => togglePermission(perm.key)}
                                                className="accent-sap-primary w-4 h-4"
                                            />
                                            <span className="text-xs font-bold">{perm.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-sap-border flex justify-end gap-2 bg-gray-50">
                        <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded">إلغاء</button>
                        <button onClick={handleSave} className="px-6 py-2 bg-sap-primary text-white rounded font-black text-xs hover:bg-sap-primary-hover shadow-sm">حفظ التغييرات</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
