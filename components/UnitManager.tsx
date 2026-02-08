
import React, { useState } from 'react';
import { Unit } from '../types';
import { db } from '../services/supabase';
import { Plus, Edit2, Trash2, Save, X, Loader2, Ruler, Search } from 'lucide-react';

interface UnitManagerProps {
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
}

export const UnitManager: React.FC<UnitManagerProps> = ({ units, setUnits }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitName, setUnitName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenModal = (unit?: Unit) => {
    if (unit) {
      setEditingUnit(unit);
      setUnitName(unit.name);
    } else {
      setEditingUnit(null);
      setUnitName('');
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!unitName.trim()) return;
    setIsSaving(true);
    try {
        const unitData: Unit = { id: editingUnit ? editingUnit.id : crypto.randomUUID(), name: unitName.trim() };
        await db.units.upsert(unitData);
        if (editingUnit) setUnits(prev => prev.map(u => u.id === editingUnit.id ? unitData : u));
        else setUnits(prev => [...prev, unitData]);
        setIsModalOpen(false);
    } catch (error) {
        alert("حدث خطأ أثناء الحفظ");
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل تريد حذف هذه الوحدة؟')) {
      try {
          await db.units.delete(id);
          setUnits(prev => prev.filter(u => u.id !== id));
      } catch (error) { alert("فشل الحذف"); }
    }
  };

  const filteredUnits = units.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="bg-sap-surface border border-sap-border rounded-sap-s p-4 shadow-sap-1 flex justify-between items-center gap-4">
        <div className="relative flex-1">
          <input 
            type="text" 
            placeholder="بحث في الوحدات..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full !pr-10 !text-sm !font-bold"
          />
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-sap-text-variant" />
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-sap-primary text-white px-6 py-2 rounded-sap-s text-xs font-bold hover:bg-sap-primary-hover shadow-sm flex items-center gap-2 transition-all"
        >
          <Plus size={16} /> إضافة وحدة جديدة
        </button>
      </div>

      <div className="bg-sap-surface border border-sap-border rounded-sap-s shadow-sap-1 overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="bg-sap-background text-sap-text-variant text-[11px] font-bold uppercase border-b border-sap-border">
              <th className="px-6 py-3">اسم الوحدة</th>
              <th className="px-6 py-3 w-32 text-left">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sap-border">
            {filteredUnits.length === 0 ? (
              <tr><td colSpan={2} className="p-12 text-center text-sap-text-variant italic">لا توجد وحدات قياس معرفة</td></tr>
            ) : (
              filteredUnits.map(unit => (
                <tr key={unit.id} className="sap-table-row group">
                  <td className="px-6 py-4 font-bold text-sap-text flex items-center gap-3">
                    <Ruler size={14} className="text-sap-primary opacity-50" />
                    {unit.name}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenModal(unit)} className="p-1.5 text-sap-text-variant hover:text-sap-primary hover:bg-sap-highlight rounded transition-all"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(unit.id)} className="p-1.5 text-sap-error hover:bg-red-50 rounded transition-all"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center z-[100] p-4">
          <div className="bg-sap-surface rounded-sap-s shadow-sap-2 w-full max-w-md border border-sap-border overflow-hidden animate-in zoom-in duration-200">
            <div className="px-6 py-3 bg-sap-shell flex justify-between items-center text-white">
              <h3 className="text-sm font-bold">{editingUnit ? 'تعديل وحدة' : 'تعريف وحدة قياس'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white/10 rounded transition-all"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-sap-text-variant">اسم الوحدة</label>
                <input type="text" value={unitName} onChange={(e) => setUnitName(e.target.value)} className="w-full font-bold" placeholder="مثال: قطعة، كرتون، لتر..." autoFocus />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-sap-border">
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-sap-text-variant font-bold text-xs">إلغاء</button>
                <button onClick={handleSave} disabled={isSaving} className="bg-sap-primary text-white px-8 py-2 rounded-sap-s text-xs font-bold flex items-center gap-2">
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} حفظ الوحدة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
