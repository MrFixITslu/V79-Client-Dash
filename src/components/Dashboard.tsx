import { useMemo } from "react";
import {
  Package,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  BrainCircuit,
  Sparkles,
  RefreshCw,
  PieChart,
  ArrowRight,
  Receipt,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Wallet,
  Headphones,
  Megaphone,
  Boxes,
  Layers,
  ExternalLink,
  CreditCard,
} from "lucide-react";
import { InventoryItem, Transaction, AIForecast, ViewState, EcosystemApp } from "../types";

interface DashboardProps {
  items: InventoryItem[];
  transactions: Transaction[];
  forecast: AIForecast | null;
  onGenerateForecast: () => void;
  isForecasting: boolean;
  onNavigate: (view: ViewState) => void;
  onQuickRestock?: (item: InventoryItem) => void;
  ecosystemApps?: EcosystemApp[];
  onOpenEcosystemApp?: (app: EcosystemApp) => void;
}

export function Dashboard({
  items,
  transactions,
  forecast,
  onGenerateForecast,
  isForecasting,
  onNavigate,
  onQuickRestock,
  ecosystemApps = [],
  onOpenEcosystemApp,
}: DashboardProps) {
  // Memoized Performance Metrics
  const {
    totalUnits,
    totalValue,
    totalCost,
    lowStockItems,
    outOfStockItems,
    categoryValues,
    todaySales,
    todayRevenue,
  } = useMemo(() => {
    let units = 0;
    let val = 0;
    let cost = 0;
    const lowStock: InventoryItem[] = [];
    const outOfStock: InventoryItem[] = [];
    const catMap: Record<string, number> = {};

    for (const item of items) {
      units += item.quantity;
      val += item.price * item.quantity;
      cost += (item.costPrice || item.price * 0.7) * item.quantity;

      if (item.quantity === 0) {
        outOfStock.push(item);
      } else if (item.quantity <= item.reorderThreshold) {
        lowStock.push(item);
      }

      catMap[item.category] = (catMap[item.category] || 0) + item.price * item.quantity;
    }

    // Today's transactions
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayTxns = transactions.filter(
      (t) => new Date(t.date).getTime() >= startOfToday.getTime()
    );
    const rev = todayTxns.reduce((sum, t) => sum + t.total, 0);

    return {
      totalUnits: units,
      totalValue: val,
      totalCost: cost,
      lowStockItems: lowStock,
      outOfStockItems: outOfStock,
      categoryValues: Object.entries(catMap).sort((a, b) => b[1] - a[1]),
      todaySales: todayTxns.length,
      todayRevenue: rev,
    };
  }, [items, transactions]);

  const potentialGrossMargin =
    totalValue > 0 ? (((totalValue - totalCost) / totalValue) * 100).toFixed(1) : "0";

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Operational Hub
            </h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Live Real-Time
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Enterprise overview across inventory stock, checkout velocity, and supply chain telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate("overview")}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Hub Command Centre</span>
          </button>
          <button
            onClick={() => onNavigate("inventory")}
            className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
          >
            <Package className="w-4 h-4" />
            <span>Manage Catalog</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Inventory Value</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
            <span className="text-emerald-600 font-semibold">{potentialGrossMargin}%</span>
            <span>est. gross margin</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total Units In Stock</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {totalUnits.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Across {items.length} managed catalog lines
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Stock Alerts</span>
            <div className={`p-2 rounded-xl ${lowStockItems.length > 0 || outOfStockItems.length > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight flex items-baseline gap-2">
            <span>{lowStockItems.length + outOfStockItems.length}</span>
            {outOfStockItems.length > 0 && (
              <span className="text-xs font-bold text-rose-600">
                ({outOfStockItems.length} out of stock)
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {lowStockItems.length === 0 && outOfStockItems.length === 0
              ? "All lines adequately stocked"
              : "Require reorder threshold check"}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Today's POS Sales</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            ${todayRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {todaySales} transaction{todaySales === 1 ? "" : "s"} processed today
          </div>
        </div>
      </div>

      {/* Vision 79 Connected Ecosystem Hub Banner & Quick Apps */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Vision 79 Ecosystem Suite
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Synced & Active
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Direct access to FFPRO Wealth Hub, Tiquet Support Desk, Marketing, and V79 POS.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate("ecosystem")}
            className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <span>Launch All Apps</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* FFPRO */}
          <div
            onClick={() => {
              const ffpro = ecosystemApps.find((a) => a.shortName === "FFPRO");
              if (ffpro && onOpenEcosystemApp) onOpenEcosystemApp(ffpro);
              else onNavigate("ecosystem");
            }}
            className="p-4 rounded-2xl bg-amber-50/50 hover:bg-amber-50 border border-amber-200/60 hover:border-amber-400 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                  <Wallet className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 border border-amber-300">
                  Finance
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                Fire Finance Pro (FFPRO)
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Personal & business wealth forecasts, automated POS cashflow register sync.
              </p>
            </div>
            <div className="pt-3 mt-2 border-t border-amber-200/50 flex items-center justify-between text-[11px] font-semibold text-amber-700">
              <span>Open Console</span>
              <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Tiquet */}
          <div
            onClick={() => {
              const tiquet = ecosystemApps.find((a) => a.shortName === "Tiquet");
              if (tiquet && onOpenEcosystemApp) onOpenEcosystemApp(tiquet);
              else onNavigate("ecosystem");
            }}
            className="p-4 rounded-2xl bg-blue-50/50 hover:bg-blue-50 border border-blue-200/60 hover:border-blue-400 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-600 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                  <Headphones className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-800 border border-blue-300">
                  Support
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-800 transition-colors">
                V79 Tiquet Desk
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Client work orders, warranty RMA tracking, and technician dispatch with SLA timers.
              </p>
            </div>
            <div className="pt-3 mt-2 border-t border-blue-200/50 flex items-center justify-between text-[11px] font-semibold text-blue-700">
              <span>Open Console</span>
              <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Marketing */}
          <div
            onClick={() => {
              const marketing = ecosystemApps.find((a) => a.shortName === "Marketing");
              if (marketing && onOpenEcosystemApp) onOpenEcosystemApp(marketing);
              else onNavigate("ecosystem");
            }}
            className="p-4 rounded-2xl bg-pink-50/50 hover:bg-pink-50 border border-pink-200/60 hover:border-pink-400 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                  <Megaphone className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-800 border border-pink-300">
                  Growth
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-pink-800 transition-colors">
                V79 Marketing Suite
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                WhatsApp & Instagram promo campaigns, POS discount coupon code orchestration.
              </p>
            </div>
            <div className="pt-3 mt-2 border-t border-pink-200/50 flex items-center justify-between text-[11px] font-semibold text-pink-700">
              <span>Open Console</span>
              <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* V79 POS */}
          <div
            onClick={() => {
              const pos = ecosystemApps.find((a) => a.shortName === "V79 POS" || a.id === "app-v79pos");
              if (pos && onOpenEcosystemApp) onOpenEcosystemApp(pos);
              else onNavigate("ecosystem");
            }}
            className="p-4 rounded-2xl bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-200/60 hover:border-emerald-400 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                  <CreditCard className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-800 border border-emerald-300">
                  POS & Retail
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                V79 POS (pos.v79sl.com)
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                High-speed register terminal, barcode scanner, thermal printing, and drawer trigger.
              </p>
            </div>
            <div className="pt-3 mt-2 border-t border-emerald-200/50 flex items-center justify-between text-[11px] font-semibold text-emerald-700">
              <span>Open Console</span>
              <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* AI Supply Chain Intelligence Forecast Section */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl border border-indigo-800/40">
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 text-indigo-300">
                <BrainCircuit className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black tracking-tight">V79 Gemini Supply Forecast</h3>
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    AI Analysis
                  </span>
                </div>
                <p className="text-indigo-200/80 text-xs mt-0.5">
                  Real-time algorithmic risk detection, stockout timing, and procurement orders.
                </p>
              </div>
            </div>

            <button
              onClick={onGenerateForecast}
              disabled={isForecasting}
              className="px-4 py-2.5 bg-white hover:bg-indigo-50 text-indigo-900 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
            >
              {isForecasting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Synthesizing Telemetry...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>{forecast ? "Refresh AI Telemetry" : "Run Intelligent Analysis"}</span>
                </>
              )}
            </button>
          </div>

          {forecast ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
              {/* Summary and Score */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                    Inventory Health Index
                  </span>
                  <div
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      forecast.riskLevel === "High"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : forecast.riskLevel === "Medium"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    Risk: {forecast.riskLevel}
                  </div>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-white">{forecast.healthScore}</span>
                  <span className="text-indigo-300 text-sm font-semibold">/ 100</span>
                </div>

                <p className="text-xs text-indigo-100/90 leading-relaxed">{forecast.summary}</p>

                {forecast.categoryInsights && forecast.categoryInsights.length > 0 && (
                  <div className="pt-3 border-t border-white/10 space-y-1.5">
                    <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider block">
                      Category Insights
                    </span>
                    {forecast.categoryInsights.map((insight, idx) => (
                      <p key={idx} className="text-[11px] text-indigo-200/80 flex items-start gap-1.5">
                        <span className="text-indigo-400 font-bold">&bull;</span>
                        <span>{insight}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Actionable Recommendations */}
              <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                    Recommended Actions & Procurement
                  </h4>
                  <span className="text-[10px] text-indigo-300">
                    {forecast.recommendations?.length || 0} advisory notices
                  </span>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {forecast.recommendations?.map((rec, i) => (
                    <div
                      key={i}
                      className="bg-white/10 border border-white/10 rounded-xl p-3.5 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm truncate">{rec.itemName}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
                              rec.urgency === "Critical"
                                ? "bg-rose-500/30 text-rose-200 border border-rose-500/40"
                                : rec.urgency === "Moderate"
                                ? "bg-amber-500/30 text-amber-200 border border-amber-500/40"
                                : "bg-emerald-500/30 text-emerald-200 border border-emerald-500/40"
                            }`}
                          >
                            {rec.action}
                          </span>
                        </div>
                        <p className="text-indigo-100/80 text-[11px] leading-relaxed">{rec.reason}</p>
                      </div>

                      {rec.suggestedOrder ? (
                        <div className="shrink-0 text-right bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
                          <span className="text-[10px] block text-indigo-300 uppercase font-semibold">
                            Order
                          </span>
                          <span className="font-bold text-white font-mono">
                            +{rec.suggestedOrder}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center bg-white/5 border border-white/10 rounded-2xl">
              <Sparkles className="w-8 h-8 text-indigo-400 mx-auto mb-2 opacity-60" />
              <p className="text-indigo-200 text-sm font-medium">
                No active forecast generated for this session.
              </p>
              <p className="text-indigo-300/60 text-xs mt-1">
                Click "Run Intelligent Analysis" to evaluate stock levels, sales turnover, and supply risks.
              </p>
            </div>
          )}
        </div>

        {/* Ambient Decorative Elements */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Category Breakdown & Recent Real POS Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Value Progress */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-base">Valuation by Category</h3>
            </div>
            <button
              onClick={() => onNavigate("reports")}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>Full Report</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {categoryValues.map(([cat, val]) => {
              const pct = totalValue > 0 ? (val / totalValue) * 100 : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-700 font-semibold">{cat}</span>
                    <span className="text-slate-900 font-mono font-bold">
                      ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-slate-400 font-normal ml-1">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {categoryValues.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs">No inventory category data.</div>
            )}
          </div>
        </div>

        {/* Live POS Sales & Order Stream */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-base">Live Activity & Completed Sales</h3>
            </div>
            <button
              onClick={() => onNavigate("invoices")}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>View All Transactions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-96 pr-1">
            {transactions.slice(0, 6).map((txn) => (
              <div
                key={txn.id}
                className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 font-mono">
                        {txn.receiptNumber}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(txn.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 truncate font-medium">
                      {txn.customerName} &bull;{" "}
                      <span className="text-slate-500">
                        {txn.items.reduce((s, i) => s + i.quantity, 0)} items ({txn.paymentMethod})
                      </span>
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-black text-slate-900 font-mono">
                    ${txn.total.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                    Paid
                  </span>
                </div>
              </div>
            ))}

            {transactions.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-xs">
                No transactions recorded yet. Completed POS sales will appear in real time.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
