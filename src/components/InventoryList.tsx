import { useState } from 'react';
import { InventoryItem } from '../types';
import { Search, Plus, Edit2, Trash2, ArrowUpDown, AlertTriangle } from 'lucide-react';

interface InventoryListProps {
  items: InventoryItem[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  isAdmin: boolean;
}

type SortField = 'name' | 'sku' | 'category' | 'quantity' | 'price';
type SortOrder = 'asc' | 'desc';

export function InventoryList({ items, onEdit, onDelete, onAdd, isAdmin }: InventoryListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredAndSortedItems = items
    .filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    )
    .sort((a, b) => {
      let comparison = 0;
      if (typeof a[sortField] === 'string') {
        comparison = (a[sortField] as string).localeCompare(b[sortField] as string);
      } else {
        comparison = (a[sortField] as number) - (b[sortField] as number);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const SortIcon = () => <ArrowUpDown className="w-3 h-3 inline-block ml-1 opacity-50" />;

  const lowStockItems = items.filter(item => item.quantity > 0 && item.quantity <= item.reorderThreshold);

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Inventory</h2>
          <p className="text-gray-500 mt-1">Manage your products, pricing, and stock levels.</p>
        </div>
        {isAdmin && (
          <button
            onClick={onAdd}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Add Item
          </button>
        )}
      </div>

      {lowStockItems.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-900">Low Stock Alert</h4>
            <p className="text-sm text-amber-700 mt-1">
              You have {lowStockItems.length} item{lowStockItems.length === 1 ? '' : 's'} running low on stock. Please check the dashboard or filter by stock to reorder.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-4 items-center bg-gray-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, SKU, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            />
          </div>
          <div className="text-sm text-gray-500 font-medium">
            {filteredAndSortedItems.length} items found
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('name')}>
                  Product Name <SortIcon />
                </th>
                <th className="p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('sku')}>
                  SKU <SortIcon />
                </th>
                <th className="p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('category')}>
                  Category & Tags <SortIcon />
                </th>
                <th className="p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors text-right" onClick={() => handleSort('quantity')}>
                  Stock <SortIcon />
                </th>
                <th className="p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors text-right" onClick={() => handleSort('price')}>
                  Price <SortIcon />
                </th>
                {isAdmin && (
                  <th className="p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider text-center">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAndSortedItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="p-4">
                    <div className="font-medium text-gray-900">{item.name}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-mono text-sm text-gray-500 bg-gray-100 inline-block px-2 py-1 rounded-md">{item.sku}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1 items-start">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {item.category}
                      </span>
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.tags.map(tag => (
                            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className={`font-mono font-medium ${
                      item.quantity === 0 ? 'text-red-600' : 
                      item.quantity <= item.reorderThreshold ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {item.quantity}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      Min: {item.reorderThreshold}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="font-mono text-gray-900">${item.price.toFixed(2)}</div>
                  </td>
                  {isAdmin && (
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => onEdit(item)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onDelete(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredAndSortedItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No items found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
