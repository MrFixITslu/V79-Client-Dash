import { InventoryItem } from '../types';
import { Package, AlertTriangle, DollarSign, TrendingUp, PieChart, BrainCircuit, Sparkles, RefreshCw } from 'lucide-react';

interface DashboardProps {
  items: InventoryItem[];
  forecast?: any;
  onGenerateForecast?: () => void;
  isForecasting?: boolean;
}

export function Dashboard({ items, forecast, onGenerateForecast, isForecasting }: DashboardProps) {
  const totalItems = items.length;
  const totalValue = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const lowStockItems = items.filter(item => item.quantity > 0 && item.quantity <= item.reorderThreshold);
  const outOfStockItems = items.filter(item => item.quantity === 0);

  // Calculate value by category
  const categoryValues = items.reduce((acc, item) => {
    const value = item.price * item.quantity;
    if (value > 0) {
      acc[item.category] = (acc[item.category] || 0) + value;
    }
    return acc;
  }, {} as Record<string, number>);

  const sortedCategories = Object.entries(categoryValues)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const stats = [
    {
      title: 'Total Products',
      value: totalItems.toString(),
      icon: Package,
      color: 'bg-blue-500',
      trend: '+12% from last month'
    },
    {
      title: 'Total Stock Value',
      value: `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'bg-emerald-500',
      trend: '+5.4% from last month'
    },
    {
      title: 'Low Stock Alerts',
      value: lowStockItems.length.toString(),
      icon: AlertTriangle,
      color: 'bg-amber-500',
      trend: `${outOfStockItems.length} out of stock`
    },
    {
      title: 'Inventory Turnover',
      value: '4.2x',
      icon: TrendingUp,
      color: 'bg-purple-500',
      trend: 'Healthy rate'
    }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard Overview</h2>
        <p className="text-gray-500 mt-1">Welcome back. Here's what's happening with your inventory today.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${stat.color} bg-opacity-10`}>
                  <Icon className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`} />
                </div>
              </div>
              <h3 className="text-gray-500 text-sm font-medium mb-1">{stat.title}</h3>
              <p className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</p>
              <p className="text-xs text-gray-400 mt-auto">{stat.trend}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <BrainCircuit className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">AI Inventory Forecast</h3>
                  <p className="text-indigo-100 text-sm">Powered by Gemini AI Analysis</p>
                </div>
              </div>
              <button 
                onClick={onGenerateForecast}
                disabled={isForecasting}
                className="px-4 py-2 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isForecasting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {forecast ? 'Refresh Analysis' : 'Generate Forecast'}
              </button>
            </div>

            {forecast ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-4">
                  <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-200 mb-2">Summary</h4>
                    <p className="text-sm leading-relaxed">{forecast.summary}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      forecast.riskLevel === 'High' ? 'bg-red-500/30 text-red-200' : 
                      forecast.riskLevel === 'Medium' ? 'bg-amber-500/30 text-amber-200' : 
                      'bg-emerald-500/30 text-emerald-200'
                    }`}>
                      Risk Level: {forecast.riskLevel}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-200">Recommendations</h4>
                  {forecast.recommendations?.map((rec: any, i: number) => (
                    <div key={i} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10 flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-indigo-300 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-white mb-0.5">{rec.itemName}</p>
                        <p className="text-[11px] text-indigo-100 leading-tight">{rec.action}: {rec.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-indigo-100 opacity-60">No forecast generated yet. Click the button above to analyze your inventory trends.</p>
              </div>
            )}
          </div>
          
          {/* Decorative background elements */}
          <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-[-20%] left-[-10%] w-64 h-64 bg-indigo-900/40 rounded-full blur-3xl pointer-events-none" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-gray-900">Value by Category</h3>
          </div>
          <div className="space-y-4">
            {sortedCategories.map(([category, value]) => (
              <div key={category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{category}</span>
                  <span className="font-mono text-gray-900">${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div 
                    className="bg-indigo-500 h-2 rounded-full" 
                    style={{ width: `${(value / totalValue) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
            {sortedCategories.length === 0 && (
              <div className="text-center py-8 text-gray-500">No value data available</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {items.slice(0, 5).map(item => (
              <div key={item.id} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Package className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">Updated {new Date(item.lastUpdated).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-gray-900">{item.quantity} in stock</p>
                  <p className="text-xs text-gray-500 font-mono">${item.price.toFixed(2)}</p>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-center py-8 text-gray-500">No recent activity</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Low Stock Items</h3>
          <div className="space-y-4">
            {lowStockItems.slice(0, 5).map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 border border-amber-100 bg-amber-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-amber-900">{item.name}</p>
                  <p className="text-xs text-amber-700 font-mono">SKU: {item.sku}</p>
                </div>
                <div className="text-right">
                  <div className="px-2 py-1 bg-amber-200 text-amber-800 text-xs font-bold rounded-md inline-block mb-1">
                    {item.quantity} left
                  </div>
                  <p className="text-[10px] text-amber-700 font-medium">Threshold: {item.reorderThreshold}</p>
                </div>
              </div>
            ))}
            {lowStockItems.length === 0 && (
              <div className="text-center py-8 text-gray-500">All items are well stocked</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
