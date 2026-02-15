
import React, { useState, useMemo } from 'react';
import { Branch, DailySales } from '../types';
import { db } from '../services/supabase';
import { Plus, Edit2, Trash2, Save, X, Loader2, MapPin, Search, BarChart3, Calendar } from 'lucide-react';

interface BranchManagerProps {
  branches: Branch[];
  setBranches: React.Dispatch<React.SetStateAction<Branch[]>>;
  sales: DailySales[];
}

export const BranchManager: React.FC<BranchManagerProps> = ({ branches, setBranches, sales }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [selectedBranchForReport, setSelectedBranchForReport] = useState<Branch | null>(null);
  
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenModal = (branch?: Branch) => {
    if (branch) {
      setEditingBranch(branch);
      setName(branch.name);
      setLocation(branch.location || '');
    } else {
      setEditingBranch(null);
      setName('');
      setLocation('');
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
        const branchData: Branch = {
            id: editingBranch ? editingBranch.id : crypto.randomUUID(),
            name: name.trim(),
            location: location.trim()
        };
        await db.branches.upsert(branchData);
        if (editingBranch) {
            setBranches(prev => prev.map(b => b.id === editingBranch.id ? branchData : b));
        } else {
            setBranches(prev => [...prev, branchData]);
        }
        setIsModalOpen(false);
    } catch (error: any) {
        alert("Error saving branch");
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('حذف الفرع سيحذف جميع المبيعات المرتبطة به. هل أنت متأكد؟')) {
      try {
          await db.dailySales.deleteByBranch(id);
          await db.branches.delete(id);
          setBranches(prev => prev.filter(b => b.id !== id));
      } catch (error) { alert("فشل الحذف"); }
    }
  };

  const filteredBranches = branches.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Branch Report Overlay (Modal)
  const BranchReportOverlay = ({ branch }: { branch: Branch }) => {
    const branchSales = useMemo(() => sales.filter(s => s.branchId === branch.id), [branch.id]);
    const totalSales = branchSales.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const recentSales = branchSales.slice(0, 5);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
            <div className="bg-white w-full max-w-2xl border border-sap-primary shadow-2xl flex flex-col max-h-[80vh]">
                <div className="bg-sap-primary text-white p-3 flex justify-between items-center">
                    <h3 className="font-bold text-sm flex items-center gap-2"><BarChart3 size={16}/> تقرير الفرع: {branch.name}</h3>
                    <button onClick={() => setSelectedBranchForReport(null)}><X size={16}/></button>
                </div>
                
                <div className="p-6 overflow-y-auto bg-[#F0F2F5]">
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-white p-4 border border-gray-300 text-center">
                            <div className="text-[10px] font-bold text-gray-500 uppercase">إجمالي المبيعات</div>
                            <div className="text-xl font-black text-sap-primary mt-1">{(totalSales || 0).toLocaleString()} ريال</div>
                        </div>
                        <div className="bg-white p-4 border border-gray-300 text-center">
                            <div className="text-[10px] font-bold text-gray-500 uppercase">عدد العمليات</div>
                            <div className="text-xl font-black mt-1">{branchSales.length}</div>
                        </div>
                        <div className="bg-white p-4 border border-gray-300 text-center">
                            <div className="text-[10px] font-bold text-gray-500 uppercase">الموقع</div>
                            <div className="text-sm font-bold mt-2 truncate">{branch.location || '-'}</div>
                        </div>
                    </div>

                    <div className="bg-white border border-gray-300">
                        <div className="p-2 bg-gray-100 border-b border-gray-300 font-bold text-xs">آخر العمليات</div>
                        <table className="w-full text-right">
                            <thead>
                                <tr>
                                    <th>التاريخ</th>
                                    <th>المبلغ</th>
                                    <th>ملاحظات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentSales.map(s => (
                                    <tr key={s.id}>
                                        <td className="font-mono font-bold">{s.date}</td>
                                        <td className="font-bold text-sap-primary">{(s.amount || 0).toLocaleString()}</td>
                                        <td>{s.notes || '-'}</td>
                                    </tr>
                                ))}
                                {recentSales.length === 0 && <tr><td colSpan={3} className="text-center py-4 italic text-gray-500">لا توجد مبيعات</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex justify-between items-center bg-white p-3 border border-gray-300 shadow-sm">
        <div className="flex items-center gap-2 flex-1">
          <Search size={16} className="text-gray-400" />
          <input 
            type="text" 
            placeholder="بحث عن فرع..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 border-none focus:ring-0 text-sm font-bold"
          />
        </div>
        <button onClick={() => handleOpenModal()} className="bg-sap-primary text-white px-4 py-1.5 text-xs font-bold flex items-center gap-2 hover:bg-sap-primary-hover border border-sap-primary">
          <Plus size={14} /> إضافة فرع
        </button>
      </div>

      <div className="bg-white border border-gray-300 flex-1 overflow-auto shadow-sm">
        <table>
            <thead>
                <tr>
                    <th className="w-12">#</th>
                    <th>اسم الفرع</th>
                    <th>الموقع الجغرافي</th>
                    <th className="w-40 text-center">التحكم</th>
                </tr>
            </thead>
            <tbody>
                {filteredBranches.length === 0 ? (
                    <tr><td colSpan={4} className="py-10 text-center text-gray-500 italic">لا توجد فروع مسجلة</td></tr>
                ) : (
                    filteredBranches.map((branch, idx) => (
                        <tr key={branch.id} className="group">
                            <td className="text-center text-gray-500">{idx + 1}</td>
                            <td className="font-bold text-sap-text">{branch.name}</td>
                            <td className="flex items-center gap-2 text-gray-600"><MapPin size={12}/> {branch.location || '-'}</td>
                            <td className="text-center">
                                <div className="flex justify-center gap-1">
                                    <button onClick={() => setSelectedBranchForReport(branch)} className="p-1 text-sap-primary border border-transparent hover:border-sap-primary hover:bg-[#E8F5E9]" title="تقرير"><BarChart3 size={14}/></button>
                                    <button onClick={() => handleOpenModal(branch)} className="p-1 text-gray-600 border border-transparent hover:border-gray-400 hover:bg-gray-100" title="تعديل"><Edit2 size={14}/></button>
                                    <button onClick={() => handleDelete(branch.id)} className="p-1 text-red-600 border border-transparent hover:border-red-600 hover:bg-red-50" title="حذف"><Trash2 size={14}/></button>
                                </div>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
      </div>

      {selectedBranchForReport && <BranchReportOverlay branch={selectedBranchForReport} />}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white border border-sap-primary shadow-xl w-full max-w-md">
            <div className="px-4 py-2 bg-sap-primary text-white flex justify-between items-center font-bold">
              <span className="text-xs">{editingBranch ? 'تحديث بيانات' : 'فرع جديد'}</span>
              <button onClick={() => setIsModalOpen(false)}><X size={14}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">اسم الفرع</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border border-gray-300 text-sm font-bold" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">الموقع</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full p-2 border border-gray-300 text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-1 border border-gray-300 text-xs font-bold hover:bg-gray-100">إلغاء</button>
                <button onClick={handleSave} disabled={isSaving} className="px-4 py-1 bg-sap-primary text-white border border-sap-primary text-xs font-bold hover:bg-sap-primary-hover flex items-center gap-2">
                  {isSaving && <Loader2 size={12} className="animate-spin" />} حفظ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
