import React, { useState, useMemo } from 'react';
import { DailySales, Product, Unit, Branch } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  Calendar, TrendingUp, Package, DollarSign, Filter, Download, 
  ArrowUpRight, ArrowDownRight, Activity, ShoppingBag
} from 'lucide-react';
import { useLanguage } from './LanguageContext';

interface AdvancedReportsProps {
  sales: DailySales[];
  products: Product[];
  units: Unit[];
  branches: Branch[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export const AdvancedReports: React.FC<AdvancedReportsProps> = ({ sales, products, units, branches }) => {
  const { t } = useLanguage();
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  // Filter sales based on selected criteria
  const filteredSales = useMemo(() => {
    let filtered = sales; // Removed status check since it doesn't exist on DailySales

    if (selectedBranch !== 'all') {
      filtered = filtered.filter(s => s.branchId === selectedBranch);
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (dateRange !== 'all') {
      filtered = filtered.filter(s => {
        const saleDate = new Date(s.date);
        switch (dateRange) {
          case 'today':
            return saleDate >= today;
          case 'week':
            const lastWeek = new Date(today);
            lastWeek.setDate(lastWeek.getDate() - 7);
            return saleDate >= lastWeek;
          case 'month':
            const lastMonth = new Date(today);
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            return saleDate >= lastMonth;
          case 'year':
            const lastYear = new Date(today);
            lastYear.setFullYear(lastYear.getFullYear() - 1);
            return saleDate >= lastYear;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [sales, dateRange, selectedBranch]);

  // Calculate Key Metrics
  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalOrders = filteredSales.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  // Calculate previous period for comparison (simplified)
  const previousRevenue = totalRevenue * 0.85; // Mock comparison for demo
  const revenueGrowth = ((totalRevenue - previousRevenue) / previousRevenue) * 100;

  // Prepare Chart Data: Sales over time
  const salesOverTimeData = useMemo(() => {
    const grouped = filteredSales.reduce((acc, sale) => {
      const date = new Date(sale.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
      if (!acc[date]) acc[date] = { date, revenue: 0, orders: 0 };
      acc[date].revenue += sale.totalAmount;
      acc[date].orders += 1;
      return acc;
    }, {} as Record<string, { date: string, revenue: number, orders: number }>);

    return Object.values(grouped).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredSales]);

  // Prepare Chart Data: Top Products
  const topProductsData = useMemo(() => {
    const productSales: Record<string, { name: string, quantity: number, revenue: number }> = {};
    
    filteredSales.forEach(sale => {
      if (sale.cart) {
        sale.cart.forEach(item => {
          if (!productSales[item.productId]) {
            const product = products.find(p => p.id === item.productId);
            productSales[item.productId] = { 
              name: product?.name || 'منتج غير معروف', 
              quantity: 0, 
              revenue: 0 
            };
          }
          productSales[item.productId].quantity += item.quantity;
          productSales[item.productId].revenue += (item.price * item.quantity);
        });
      }
    });

    return Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5); // Top 5
  }, [filteredSales, products]);

  // Prepare Chart Data: Payment Methods
  const paymentMethodsData = useMemo(() => {
    const methods = filteredSales.reduce((acc, sale) => {
      const method = sale.paymentMethod === 'cash' ? 'نقدي' : 
                     sale.paymentMethod === 'card' ? 'بطاقة' : 
                     sale.paymentMethod === 'transfer' ? 'تحويل' : 'آجل';
      acc[method] = (acc[method] || 0) + sale.totalAmount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(methods).map(([name, value]) => ({ name, value }));
  }, [filteredSales]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <Activity className="text-sap-primary" />
            التقارير المتقدمة والتحليلات
          </h2>
          <p className="text-slate-500 mt-1 text-sm">تحليل شامل لأداء المبيعات والمؤشرات الرئيسية</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200">
            <Filter size={16} className="text-slate-400 mx-2" />
            <select 
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer py-1.5 pr-2 pl-6"
            >
              <option value="all">جميع الفروع</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex bg-slate-50 rounded-lg p-1 border border-slate-200">
            {[
              { id: 'today', label: 'اليوم' },
              { id: 'week', label: 'أسبوع' },
              { id: 'month', label: 'شهر' },
              { id: 'year', label: 'سنة' },
              { id: 'all', label: 'الكل' }
            ].map(range => (
              <button
                key={range.id}
                onClick={() => setDateRange(range.id as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  dateRange === range.id 
                    ? 'bg-white text-sap-primary shadow-sm border border-slate-200' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-700 transition-colors">
            <Download size={16} />
            <span className="hidden sm:inline">تصدير PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-bold text-slate-500 mb-1">إجمالي الإيرادات</p>
              <h3 className="text-3xl font-black text-slate-800">{totalRevenue.toLocaleString()} <span className="text-sm font-medium text-slate-400">ر.س</span></h3>
            </div>
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
              <DollarSign size={24} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className={`flex items-center gap-1 ${revenueGrowth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {revenueGrowth >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              {Math.abs(revenueGrowth).toFixed(1)}%
            </span>
            <span className="text-slate-400 font-medium text-xs">مقارنة بالفترة السابقة</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-bold text-slate-500 mb-1">عدد الطلبات</p>
              <h3 className="text-3xl font-black text-slate-800">{totalOrders}</h3>
            </div>
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
              <ShoppingBag size={24} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="flex items-center gap-1 text-emerald-500">
              <ArrowUpRight size={16} />
              12.5%
            </span>
            <span className="text-slate-400 font-medium text-xs">مقارنة بالفترة السابقة</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-bold text-slate-500 mb-1">متوسط قيمة الطلب</p>
              <h3 className="text-3xl font-black text-slate-800">{averageOrderValue.toFixed(2)} <span className="text-sm font-medium text-slate-400">ر.س</span></h3>
            </div>
            <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
              <TrendingUp size={24} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="flex items-center gap-1 text-red-500">
              <ArrowDownRight size={16} />
              2.4%
            </span>
            <span className="text-slate-400 font-medium text-xs">مقارنة بالفترة السابقة</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-bold text-slate-500 mb-1">المنتجات المباعة</p>
              <h3 className="text-3xl font-black text-slate-800">
                {filteredSales.reduce((sum, s) => sum + (s.cart?.reduce((acc, item) => acc + item.quantity, 0) || 0), 0)}
              </h3>
            </div>
            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
              <Package size={24} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="flex items-center gap-1 text-emerald-500">
              <ArrowUpRight size={16} />
              8.1%
            </span>
            <span className="text-slate-400 font-medium text-xs">مقارنة بالفترة السابقة</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Revenue Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp className="text-sap-primary" size={20} />
            اتجاه الإيرادات
          </h3>
          <div className="h-[300px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesOverTimeData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00A09D" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00A09D" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} tickFormatter={(val) => `${val / 1000}k`} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`${value} ر.س`, 'الإيرادات']}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#00A09D" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Pie Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <DollarSign className="text-emerald-500" size={20} />
            طرق الدفع
          </h3>
          <div className="h-[300px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethodsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {paymentMethodsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value: any) => [`${value.toLocaleString()} ر.س`, 'المبلغ']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products Bar Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-3">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Package className="text-amber-500" size={20} />
            أفضل المنتجات مبيعاً
          </h3>
          <div className="h-[300px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductsData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#1e293b', fontWeight: 600 }} width={150} />
                <RechartsTooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any, name: any) => [
                    name === 'revenue' ? `${value.toLocaleString()} ر.س` : value, 
                    name === 'revenue' ? 'الإيرادات' : 'الكمية المباعة'
                  ]}
                />
                <Legend />
                <Bar dataKey="revenue" name="الإيرادات" fill="#00A09D" radius={[0, 4, 4, 0]} barSize={20} />
                <Bar dataKey="quantity" name="الكمية" fill="#FFBB28" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
