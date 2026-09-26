import { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  ArrowUpDown,
  AlertTriangle,
  Download,
  Upload,
  Barcode,
  Package,
  CheckCircle,
  XCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { InventoryItem } from "../types";

interface InventoryListProps {
  items: InventoryItem[];
  onAdd: () => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onQuickStockChange?: (id: string, delta: number) => void;
  onImportClick?: () => void;
  isAdmin: boolean;
}

type SortField = "name" | "sku" | "category" | "quantity" | "price" | "lastUpdated";
type SortOrder = "asc" | "desc";

export function InventoryList({
  items,
  onAdd,
  onEdit,
  onDelete,
  onQuickStockChange,
  onImportClick,
  isAdmin,
}: InventoryListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set).sort();
  }, [items]);

  // Handle Sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return items
      .filter((item) => {
        // Category filter
        if (selectedCategory !== "all" && item.category !== selectedCategory) {
          return false;
        }

        // Stock status filter
        if (stockFilter === "in_stock" && item.quantity <= 0) return false;
        if (stockFilter === "low_stock" && (item.quantity === 0 || item.quantity > item.reorderThreshold)) return false;
        if (stockFilter === "out_of_stock" && item.quantity > 0) return false;

        // Search term
        if (!term) return true;
        return (
          item.name.toLowerCase().includes(term) ||
          item.sku.toLowerCase().includes(term) ||
          (item.barcode && item.barcode.toLowerCase().includes(term)) ||
          item.category.toLowerCase().includes(term) ||
          (item.manufacturer && item.manufacturer.toLowerCase().includes(term)) ||
          (item.tags && item.tags.some((tag) => tag.toLowerCase().includes(term)))
        );
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortField === "lastUpdated") {
          comparison = new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime();
        } else if (typeof a[sortField] === "string") {
          comparison = (a[sortField] as string).localeCompare(b[sortField] as string);
        } else {
          comparison = ((a[sortField] as number) || 0) - ((b[sortField] as number) || 0);
        }
        return sortOrder === "asc" ? comparison : -comparison;
      });
  }, [items, searchTerm, selectedCategory, stockFilter, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Name",
      "SKU",
      "Category",
      "Quantity",
      "Selling Price",
      "Cost Price",
      "Reorder Threshold",
      "Barcode",
      "Manufacturer",
      "Location",
      "Last Updated",
    ];

    const rows = filteredItems.map((item) => [
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.sku}"`,
      `"${item.category}"`,
      item.quantity,
      item.price.toFixed(2),
      (item.costPrice || 0).toFixed(2),
      item.reorderThreshold,
      `"${item.barcode || ""}"`,
      `"${item.manufacturer || ""}"`,
      `"${item.location || ""}"`,
      `"${item.lastUpdated}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `V79_Inventory_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const lowStockCount = useMemo(
    () => items.filter((i) => i.quantity > 0 && i.quantity <= i.reorderThreshold).length,
    [items]
  );
  const outOfStockCount = useMemo(
    () => items.filter((i) => i.quantity === 0).length,
    [items]
  );

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Inventory Catalog
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage product catalog, real-time stock levels, pricing, and reorder thresholds.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {isAdmin && onImportClick && (
            <button
              onClick={onImportClick}
              className="px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import CSV</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={onAdd}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Stock Health Banners if alerts present */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {outOfStockCount > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wide">
                    {outOfStockCount} Out of Stock Line{outOfStockCount === 1 ? "" : "s"}
                  </h4>
                  <p className="text-xs text-rose-700 mt-0.5">
                    Critical stockout alert. Replenishment required immediately.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStockFilter("out_of_stock")}
                className="text-xs font-bold text-rose-800 bg-rose-200/70 hover:bg-rose-200 px-3 py-1.5 rounded-lg transition-colors shrink-0"
              >
                Filter Stockouts
              </button>
            </div>
          )}

          {lowStockCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                    {lowStockCount} Low Stock Item{lowStockCount === 1 ? "" : "s"}
                  </h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Stock below reorder threshold. Check supplier availability.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStockFilter("low_stock")}
                className="text-xs font-bold text-amber-800 bg-amber-200/70 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors shrink-0"
              >
                Filter Low Stock
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex-1 flex flex-col overflow-hidden">
        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by product name, SKU, barcode, tags..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Categories ({items.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Stock status filter chips */}
            <div className="flex items-center bg-slate-200/60 p-1 rounded-xl text-[11px] font-semibold">
              <button
                onClick={() => setStockFilter("all")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  stockFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStockFilter("in_stock")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  stockFilter === "in_stock" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                In Stock
              </button>
              <button
                onClick={() => setStockFilter("low_stock")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  stockFilter === "low_stock" ? "bg-white text-amber-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Low
              </button>
              <button
                onClick={() => setStockFilter("out_of_stock")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  stockFilter === "out_of_stock" ? "bg-white text-rose-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Out
              </button>
            </div>
          </div>
        </div>

        {/* Inventory Items Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                <th
                  onClick={() => handleSort("name")}
                  className="p-3.5 pl-6 cursor-pointer hover:text-slate-800 transition-colors"
                >
                  Product Details <ArrowUpDown className="w-3 h-3 inline-block ml-1 opacity-60" />
                </th>
                <th
                  onClick={() => handleSort("category")}
                  className="p-3.5 cursor-pointer hover:text-slate-800 transition-colors"
                >
                  Category <ArrowUpDown className="w-3 h-3 inline-block ml-1 opacity-60" />
                </th>
                <th
                  onClick={() => handleSort("quantity")}
                  className="p-3.5 text-center cursor-pointer hover:text-slate-800 transition-colors"
                >
                  Stock Level <ArrowUpDown className="w-3 h-3 inline-block ml-1 opacity-60" />
                </th>
                <th
                  onClick={() => handleSort("price")}
                  className="p-3.5 text-right cursor-pointer hover:text-slate-800 transition-colors"
                >
                  Price (XCD) <ArrowUpDown className="w-3 h-3 inline-block ml-1 opacity-60" />
                </th>
                <th className="p-3.5 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedItems.map((item) => {
                const isOutOfStock = item.quantity === 0;
                const isLowStock = item.quantity > 0 && item.quantity <= item.reorderThreshold;

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-indigo-50/30 transition-colors group"
                  >
                    {/* Product Name & SKU */}
                    <td className="p-3.5 pl-6">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 bg-slate-100 shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate max-w-md text-xs group-hover:text-indigo-600 transition-colors">
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-mono">
                            <span>SKU: {item.sku}</span>
                            {item.barcode && (
                              <span className="flex items-center gap-1 text-slate-400">
                                <Barcode className="w-3 h-3" />
                                {item.barcode}
                              </span>
                            )}
                            {item.location && (
                              <span className="text-slate-400 font-sans">
                                &bull; {item.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium text-[11px]">
                        {item.category}
                      </span>
                    </td>

                    {/* Stock level with inline +/- adjuster */}
                    <td className="p-3.5 text-center">
                      <div className="inline-flex items-center gap-2">
                        {isAdmin && onQuickStockChange && (
                          <button
                            onClick={() => onQuickStockChange(item.id, -1)}
                            disabled={item.quantity <= 0}
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold text-xs"
                            title="Decrement stock by 1"
                          >
                            -
                          </button>
                        )}

                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                            isOutOfStock
                              ? "bg-rose-100 text-rose-700"
                              : isLowStock
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {item.quantity} in stock
                        </span>

                        {isAdmin && onQuickStockChange && (
                          <button
                            onClick={() => onQuickStockChange(item.id, 1)}
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs"
                            title="Increment stock by 1"
                          >
                            +
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Min threshold: {item.reorderThreshold}
                      </div>
                    </td>

                    {/* Price */}
                    <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                      ${item.price.toFixed(2)}
                      {item.costPrice ? (
                        <div className="text-[10px] text-slate-400 font-normal">
                          Cost: ${item.costPrice.toFixed(2)}
                        </div>
                      ) : null}
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right pr-6">
                      <div className="flex items-center justify-end gap-1">
                        {isAdmin ? (
                          <>
                            <button
                              onClick={() => onEdit(item)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Edit Item"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(item.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Read-only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-semibold text-slate-600">No inventory products found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Try adjusting your search criteria or add new items.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Showing{" "}
            <span className="font-semibold text-slate-800">
              {filteredItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-slate-800">
              {Math.min(currentPage * pageSize, filteredItems.length)}
            </span>{" "}
            of <span className="font-semibold text-slate-800">{filteredItems.length}</span> lines
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
            >
              <option value={10}>10 per page</option>
              <option value={15}>15 per page</option>
              <option value={30}>30 per page</option>
              <option value={50}>50 per page</option>
            </select>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-semibold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Confirmation Modal for Deletion (No window.confirm) */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Confirm Product Removal</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Are you sure you want to permanently delete this product from the inventory database? This action cannot be reversed.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
