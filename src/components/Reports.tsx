import { useMemo } from "react";
import {
  Package,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Download,
  Printer,
  PieChart,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import { InventoryItem, Transaction } from "../types";

interface ReportsProps {
  items: InventoryItem[];
  transactions: Transaction[];
}

export function Reports({ items, transactions }: ReportsProps) {
  const {
    totalUnits,
    totalRetailValue,
    totalCostValue,
    grossMarginVal,
    marginPercent,
    lowStockItems,
    outOfStockItems,
    categoryBreakdown,
  } = useMemo(() => {
    let units = 0;
    let retail = 0;
    let cost = 0;
    const lowStock: InventoryItem[] = [];
    const outStock: InventoryItem[] = [];
    const catMap: Record<
      string,
      { count: number; units: number; retail: number; cost: number }
    > = {};

    for (const item of items) {
      const itemCost = item.costPrice || item.price * 0.7;
      units += item.quantity;
      retail += item.price * item.quantity;
      cost += itemCost * item.quantity;

      if (item.quantity === 0) outStock.push(item);
      else if (item.quantity <= item.reorderThreshold) lowStock.push(item);

      if (!catMap[item.category]) {
        catMap[item.category] = { count: 0, units: 0, retail: 0, cost: 0 };
      }
      catMap[item.category].count += 1;
      catMap[item.category].units += item.quantity;
      catMap[item.category].retail += item.price * item.quantity;
      catMap[item.category].cost += itemCost * item.quantity;
    }

    const margin = retail - cost;
    const pct = retail > 0 ? ((margin / retail) * 100).toFixed(1) : "0.0";

    const breakdown = Object.entries(catMap).map(([category, stats]) => ({
      category,
      count: stats.count,
      units: stats.units,
      retail: stats.retail,
      cost: stats.cost,
      margin: stats.retail - stats.cost,
      marginPct:
        stats.retail > 0
          ? (((stats.retail - stats.cost) / stats.retail) * 100).toFixed(1)
          : "0.0",
    }));

    breakdown.sort((a, b) => b.retail - a.retail);

    return {
      totalUnits: units,
      totalRetailValue: retail,
      totalCostValue: cost,
      grossMarginVal: margin,
      marginPercent: pct,
      lowStockItems: lowStock,
      outOfStockItems: outStock,
      categoryBreakdown: breakdown,
    };
  }, [items]);

  const handleExportFullReport = () => {
    const headers = [
      "Product Name",
      "SKU",
      "Category",
      "Quantity",
      "Unit Cost",
      "Unit Retail",
      "Total Cost Value",
      "Total Retail Value",
      "Estimated Margin",
      "Threshold",
      "Status",
    ];

    const rows = items.map((i) => {
      const c = i.costPrice || i.price * 0.7;
      const status =
        i.quantity === 0 ? "Out of Stock" : i.quantity <= i.reorderThreshold ? "Low Stock" : "In Stock";
      return [
        `"${i.name.replace(/"/g, '""')}"`,
        `"${i.sku}"`,
        `"${i.category}"`,
        i.quantity,
        c.toFixed(2),
        i.price.toFixed(2),
        (c * i.quantity).toFixed(2),
        (i.price * i.quantity).toFixed(2),
        ((i.price - c) * i.quantity).toFixed(2),
        i.reorderThreshold,
        status,
      ];
    });

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `V79_Comprehensive_Valuation_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full space-y-8 font-sans overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Valuation & Inventory Analytics
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Audit capital locked in stock, asset distributions, and supplier margin ratios.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
          <button
            onClick={handleExportFullReport}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Valuation CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Market Retail Value</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            ${totalRetailValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-500 mt-1">Total projected inventory retail</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Wholesale Cost Basis</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            ${totalCostValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-500 mt-1">Capital invested in physical stock</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Gross Unrealized Profit</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight text-emerald-600">
            ${grossMarginVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-500 mt-1">{marginPercent}% gross margin ratio</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Stock Health Status</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {totalUnits.toLocaleString()} units
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {outOfStockItems.length > 0 ? (
              <span className="text-rose-600 font-semibold">{outOfStockItems.length} out of stock</span>
            ) : lowStockItems.length > 0 ? (
              <span className="text-amber-600 font-semibold">{lowStockItems.length} low stock</span>
            ) : (
              <span className="text-emerald-600 font-semibold">Healthy inventory levels</span>
            )}
          </p>
        </div>
      </div>

      {/* Category Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PieChart className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-base">Category Portfolio Breakdown</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {categoryBreakdown.length} active product families
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                <th className="p-3.5 pl-6">Category Family</th>
                <th className="p-3.5 text-center">SKU Lines</th>
                <th className="p-3.5 text-center">Stock Units</th>
                <th className="p-3.5 text-right">Cost Capital</th>
                <th className="p-3.5 text-right">Retail Value</th>
                <th className="p-3.5 text-right">Profit Potential</th>
                <th className="p-3.5 text-right pr-6">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {categoryBreakdown.map((row) => (
                <tr key={row.category} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3.5 pl-6 font-sans font-bold text-slate-900">{row.category}</td>
                  <td className="p-3.5 text-center text-slate-600">{row.count}</td>
                  <td className="p-3.5 text-center font-bold text-slate-800">{row.units}</td>
                  <td className="p-3.5 text-right text-slate-600">${row.cost.toFixed(2)}</td>
                  <td className="p-3.5 text-right font-bold text-slate-900">${row.retail.toFixed(2)}</td>
                  <td className="p-3.5 text-right text-emerald-600 font-bold">${row.margin.toFixed(2)}</td>
                  <td className="p-3.5 text-right pr-6 font-bold text-indigo-600">{row.marginPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
