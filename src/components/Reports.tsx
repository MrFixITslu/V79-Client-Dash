import { useMemo } from 'react';
import { InventoryItem } from '../types';
import { BarChart3, TrendingUp, DollarSign, Package, AlertTriangle, PieChart, Download } from 'lucide-react';

interface ReportsProps {
  items: InventoryItem[];
}

export function Reports({ items }: ReportsProps) {
  const totalItems = items.length;
  const totalStock = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const lowStockItems = items.filter(item => item.quantity > 0 && item.quantity <= item.reorderThreshold);
  const outOfStockItems = items.filter(item => item.quantity === 0);

  // Calculate value by category
  const categoryStats = useMemo(() => {
    const stats = items.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = { value: 0, count: 0, stock: 0 };
      }
      acc[item.category].value += item.price * item.quantity;
      acc[item.category].count += 1;
      acc[item.category].stock += item.quantity;
      return acc;
    }, {} as Record<string, { value: number; count: number; stock: number }>);

    return Object.entries(stats)
      .sort(([, a], [, b]) => b.value - a.value);
  }, [items]);

  const handleExportCSV = () => {
    const headers = ['Name', 'SKU', 'Category', 'Quantity', 'Price', 'Barcode', 'Manufacturer', 'Reorder Threshold'];
    const csvContent = [
      headers.join(','),
      ...items.map(item => [
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.sku}"`,
        `"${item.category}"`,
        item.quantity,
        item.price,
        `"${item.barcode || ''}"`,
        `"${item.manufacturer || ''}"`,
        item.reorderThreshold
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Reports & Analytics</h2>
          <p className="text-gray-500 mt-1">Detailed insights into your inventory performance.</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <Package className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-gray-500 text-sm font-medium mb-1">Total Stock Units</h3>
          <p className="text-3xl font-bold text-gray-900 mb-2">{totalStock}</p>
          <p className="text-xs text-gray-400">Across {totalItems} unique products</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-gray-500 text-sm font-medium mb-1">Total Inventory Value</h3>
          <p className="text-3xl font-bold text-gray-900 mb-2">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-gray-400">Current market value</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-gray-500 text-sm font-medium mb-1">Low Stock Items</h3>
          <p className="text-3xl font-bold text-gray-900 mb-2">{lowStockItems.length}</p>
          <p className="text-xs text-gray-400">Needs reordering soon</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-red-50 text-red-600">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-gray-500 text-sm font-medium mb-1">Out of Stock</h3>
          <p className="text-3xl font-bold text-gray-900 mb-2">{outOfStockItems.length}</p>
          <p className="text-xs text-gray-400">Currently unavailable</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-gray-900">Value by Category</h3>
          </div>
          <div className="space-y-6">
            {categoryStats.map(([category, stats]) => (
              <div key={category}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-gray-700">{category}</span>
                  <span className="font-mono text-gray-900">${stats.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 mb-1">
                  <div 
                    className="bg-indigo-500 h-3 rounded-full" 
                    style={{ width: `${totalValue > 0 ? (stats.value / totalValue) * 100 : 0}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 text-right">
                  {((stats.value / totalValue) * 100).toFixed(1)}% of total value
                </div>
              </div>
            ))}
            {categoryStats.length === 0 && (
              <div className="text-center py-8 text-gray-500">No category data available</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-gray-900">Stock Distribution</h3>
          </div>
          <div className="space-y-6">
            {categoryStats.map(([category, stats]) => (
              <div key={category}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-gray-700">{category}</span>
                  <span className="font-mono text-gray-900">{stats.stock} units</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 mb-1">
                  <div 
                    className="bg-emerald-500 h-3 rounded-full" 
                    style={{ width: `${totalStock > 0 ? (stats.stock / totalStock) * 100 : 0}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 text-right">
                  {stats.count} unique products
                </div>
              </div>
            ))}
            {categoryStats.length === 0 && (
              <div className="text-center py-8 text-gray-500">No category data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
