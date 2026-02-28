import React, { useState, useEffect } from 'react';
import { ActivityLog } from '../types';
import { db } from '../services/supabase';
import { History, Info, AlertTriangle, CheckCircle, XCircle, Search, RefreshCcw, Trash2 } from 'lucide-react';

export const ActivityLogViewer: React.FC = () => {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('');

    const loadLogs = async () => {
        setIsLoading(true);
        try {
            const data = await db.activityLogs.getAll(200);
            setLogs(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearLogs = async () => {
        if (confirm('هل أنت متأكد من مسح جميع السجلات؟ لا يمكن التراجع عن هذا الإجراء.')) {
            setIsLoading(true);
            try {
                await db.activityLogs.clear();
                await loadLogs();
            } catch (e) {
                alert('فشل مسح السجلات');
            } finally {
                setIsLoading(false);
            }
        }
    };

    useEffect(() => {
        loadLogs();
    }, []);

    const filteredLogs = logs.filter(log => 
        log.action.toLowerCase().includes(filter.toLowerCase()) || 
        log.details?.toLowerCase().includes(filter.toLowerCase()) ||
        log.user?.toLowerCase().includes(filter.toLowerCase())
    );

    const getIcon = (type: string) => {
        switch (type) {
            case 'error': return <XCircle className="text-red-500" size={18} />;
            case 'warning': return <AlertTriangle className="text-amber-500" size={18} />;
            case 'success': return <CheckCircle className="text-green-500" size={18} />;
            default: return <Info className="text-blue-500" size={18} />;
        }
    };

    return (
        <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <History size={20} className="text-gray-600"/>
                    </div>
                    <div>
                        <h2 className="font-black text-gray-800">سجل النشاطات</h2>
                        <p className="text-xs text-gray-500">تتبع حركات النظام والمستخدمين</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
                        <input 
                            type="text" 
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            placeholder="بحث في السجل..." 
                            className="pl-3 pr-9 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold focus:border-sap-primary outline-none w-64"
                        />
                    </div>
                    <button onClick={loadLogs} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600" title="تحديث">
                        <RefreshCcw size={18}/>
                    </button>
                    <button onClick={handleClearLogs} className="p-2 bg-white border border-red-200 rounded-lg hover:bg-red-50 text-red-600" title="مسح السجل">
                        <Trash2 size={18}/>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-0">
                <table className="w-full text-right text-sm">
                    <thead className="bg-gray-50 text-gray-500 font-bold sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-4 w-16 text-center">النوع</th>
                            <th className="p-4">النشاط</th>
                            <th className="p-4">التفاصيل</th>
                            <th className="p-4">المستخدم</th>
                            <th className="p-4 w-40">التوقيت</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredLogs.map(log => (
                            <tr key={log.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="p-4 text-center">
                                    <div className="flex justify-center">{getIcon(log.type)}</div>
                                </td>
                                <td className="p-4 font-bold text-gray-800">{log.action}</td>
                                <td className="p-4 text-gray-600 max-w-md truncate" title={log.details}>{log.details || '-'}</td>
                                <td className="p-4 text-gray-500 font-mono text-xs">{log.user || 'System'}</td>
                                <td className="p-4 text-gray-400 text-xs font-mono" dir="ltr">
                                    {new Date(log.timestamp).toLocaleString('en-GB')}
                                </td>
                            </tr>
                        ))}
                        {filteredLogs.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-10 text-center text-gray-400">
                                    {isLoading ? 'جاري التحميل...' : 'لا توجد سجلات'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
