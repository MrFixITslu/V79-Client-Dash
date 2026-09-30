import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  Headphones,
  Lightbulb,
  Megaphone,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { EcosystemApp, ViewState } from "../types";
import { appLaunchUrl, isManagedHubApp } from "../lib/appLaunch";

type ProductKey = "pos" | "ffpro" | "tiquet" | "marketing" | "academy";
type ProductStatus = "ok" | "needs_setup" | "unavailable" | "misconfigured" | "restricted";

interface ProductSummary {
  status: ProductStatus;
  httpStatus?: number;
  metrics?: Record<string, any>;
  generatedAt?: string | null;
  error?: string | null;
}

interface DashboardSummary {
  generatedAt: string;
  apps: Record<ProductKey, ProductSummary>;
}

interface HubOverviewProps {
  ecosystemApps: EcosystemApp[];
  onNavigate: (view: ViewState) => void;
}

const money = new Intl.NumberFormat("en-LC", {
  style: "currency",
  currency: "XCD",
  maximumFractionDigits: 2,
});
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const n = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

const appCards: Array<{
  key: ProductKey;
  id: string;
  shortName: string;
  title: string;
  category: string;
  fallback: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  description: string;
  metrics: (m: Record<string, any>) => Array<{ label: string; value: string }>;
}> = [
  {
    key: "tiquet",
    id: "app-tiquet",
    shortName: "Tiquet",
    title: "V79 Tiquet",
    category: "Operations",
    fallback: "https://tiquet.v79sl.com",
    icon: Headphones,
    accent: "text-cyan-600",
    description: "Customers, jobs, service delivery and team activity.",
    metrics: (m) => [
      { label: "Jobs", value: whole.format(n(m.jobs)) },
      { label: "Clients", value: whole.format(n(m.clients)) },
      { label: "Team", value: whole.format(n(m.teamMembers)) },
    ],
  },
  {
    key: "ffpro",
    id: "app-ffpro",
    shortName: "FFPRO",
    title: "FFPRO",
    category: "Financial intelligence",
    fallback: "https://ffpro.v79sl.com",
    icon: Wallet,
    accent: "text-emerald-600",
    description: "Cash flow, budgets, financial goals and business visibility.",
    metrics: (m) => [
      { label: "MTD net", value: money.format(n(m.currentMonthNet)) },
      { label: "MTD income", value: money.format(n(m.currentMonthIncome)) },
      { label: "Transactions", value: whole.format(n(m.transactionCount)) },
    ],
  },
  {
    key: "marketing",
    id: "app-marketing",
    shortName: "Marketing",
    title: "V79 Marketing",
    category: "Growth engine",
    fallback: "https://marketing.v79sl.com",
    icon: Megaphone,
    accent: "text-pink-600",
    description: "Campaigns, customer pipeline, content and marketing analytics.",
    metrics: (m) => [
      { label: "Active campaigns", value: whole.format(n(m.activeCampaigns)) },
      { label: "Customers", value: whole.format(n(m.customers)) },
      { label: "AI credits", value: whole.format(n(m.aiCreditsRemaining)) },
    ],
  },
  {
    key: "academy",
    id: "app-academy",
    shortName: "Academy",
    title: "V79 Academy",
    category: "Learning & capability",
    fallback: "https://v79academy.v79sl.com/academy",
    icon: GraduationCap,
    accent: "text-indigo-600",
    description: "Learning progress, course access and certifications.",
    metrics: (m) => [
      { label: "Enrolled", value: whole.format(n(m.enrolledCourses)) },
      { label: "Progress", value: `${whole.format(n(m.overallProgressPercent))}%` },
      { label: "Certificates", value: whole.format(n(m.certificates)) },
    ],
  },
  {
    key: "pos",
    id: "app-v79pos",
    shortName: "V79 POS",
    title: "V79 POS",
    category: "Commerce",
    fallback: "https://pos.v79sl.com",
    icon: CreditCard,
    accent: "text-purple-600",
    description: "Sales, stock, purchasing and register operations.",
    metrics: (m) => [
      { label: "Sales", value: whole.format(n(m.sales)) },
      { label: "Products", value: whole.format(n(m.products)) },
      { label: "Open POs", value: whole.format(n(m.openPurchaseOrders)) },
    ],
  },
];

function statusStyle(summary?: ProductSummary) {
  if (!summary) return { label: "Loading", className: "bg-slate-100 text-slate-600 border-slate-200" };
  if (summary.status === "ok") return { label: "Connected", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (summary.status === "restricted") return { label: "Restricted", className: "bg-slate-100 text-slate-600 border-slate-200" };
  if (summary.status === "needs_setup") return { label: "Ready to activate", className: "bg-amber-50 text-amber-700 border-amber-200" };
  if (summary.status === "misconfigured") return { label: "Configuration needed", className: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "Unavailable", className: "bg-rose-50 text-rose-700 border-rose-200" };
}

export function HubOverview({ ecosystemApps, onNavigate }: HubOverviewProps) {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/summary", { cache: "no-store" });
      if (!response.ok) throw new Error(`Dashboard request failed (${response.status})`);
      setDashboard(await response.json());
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Dashboard unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const timer = window.setInterval(loadDashboard, 60000);
    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  const appFor = (id: string, shortName: string) =>
    ecosystemApps.find((app) => app.id === id || app.shortName === shortName);

  const summaries = dashboard?.apps;
  const onlineCount = appCards.filter((card) => summaries?.[card.key]?.status === "ok").length;
  const ffpro = summaries?.ffpro?.metrics || {};
  const tiquet = summaries?.tiquet?.metrics || {};
  const marketing = summaries?.marketing?.metrics || {};
  const academy = summaries?.academy?.metrics || {};
  const pos = summaries?.pos?.metrics || {};

  const openJobs = useMemo(() => {
    const byStatus = tiquet.jobsByStatus && typeof tiquet.jobsByStatus === "object" ? tiquet.jobsByStatus : {};
    return Object.entries(byStatus).reduce((sum, [status, count]) => {
      return /resolved|closed|complete/i.test(status) ? sum : sum + n(count);
    }, 0);
  }, [tiquet.jobsByStatus]);

  const actions = useMemo(() => {
    const result: Array<{ title: string; detail: string; key: ProductKey }> = [];
    if (summaries?.ffpro?.status === "ok" && n(ffpro.currentMonthNet) < 0) {
      result.push({
        title: "Monthly cash flow needs attention",
        detail: `Expenses exceed income by ${money.format(Math.abs(n(ffpro.currentMonthNet)))} this month.`,
        key: "ffpro",
      });
    }
    if (summaries?.tiquet?.status === "ok" && openJobs > 0) {
      result.push({
        title: `${whole.format(openJobs)} service job${openJobs === 1 ? "" : "s"} still open`,
        detail: "Review workload, ownership and service deadlines in V79 Tiquet.",
        key: "tiquet",
      });
    }
    if (summaries?.marketing?.status === "ok" && n(marketing.activeCampaigns) === 0) {
      result.push({
        title: "No active marketing campaign",
        detail: "The Marketing workspace is connected but currently has no active campaign.",
        key: "marketing",
      });
    }
    if (summaries?.academy?.status === "ok" && n(academy.enrolledCourses) > 0 && n(academy.overallProgressPercent) < 100) {
      result.push({
        title: "Training is in progress",
        detail: `Academy progress is ${whole.format(n(academy.overallProgressPercent))}% with ${whole.format(n(academy.certificates))} certificate(s) recorded.`,
        key: "academy",
      });
    }
    if (summaries?.pos?.status === "ok" && n(pos.openPurchaseOrders) > 0) {
      result.push({
        title: "Purchase orders are still open",
        detail: `${whole.format(n(pos.openPurchaseOrders))} POS purchase order(s) require follow-up.`,
        key: "pos",
      });
    }
    return result.slice(0, 4);
  }, [summaries, ffpro.currentMonthNet, openJobs, marketing.activeCampaigns, academy.enrolledCourses, academy.overallProgressPercent, academy.certificates, pos.openPurchaseOrders]);

  const topMetrics = [
    { label: "MTD net", value: summaries?.ffpro?.status === "ok" ? money.format(n(ffpro.currentMonthNet)) : "—" },
    { label: "Open service jobs", value: summaries?.tiquet?.status === "ok" ? whole.format(openJobs) : "—" },
    { label: "POS sales", value: summaries?.pos?.status === "ok" ? whole.format(n(pos.sales)) : "—" },
    { label: "Active campaigns", value: summaries?.marketing?.status === "ok" ? whole.format(n(marketing.activeCampaigns)) : "—" },
    { label: "Learning progress", value: summaries?.academy?.status === "ok" ? `${whole.format(n(academy.overallProgressPercent))}%` : "—" },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <section className="bg-[#0B1528] border border-slate-800 rounded-2xl p-6 sm:p-8 text-white shadow-xl shadow-slate-950/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <span className="text-cyan-400 font-semibold text-xs tracking-wide uppercase">Business command centre</span>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mt-1.5">V79 Digital</h1>
            <p className="text-slate-300 text-sm mt-2 leading-relaxed">
              One privacy-safe view of the key signals from your connected V79 applications.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-[#101D35]/90 border border-slate-700/60 rounded-xl px-5 py-3.5 min-w-[140px] text-center">
              <div className="text-2xl font-extrabold">{loading ? "…" : `${onlineCount}/5`}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Connected KPI feeds</div>
            </div>
            <button
              onClick={loadDashboard}
              className="h-12 w-12 rounded-xl border border-slate-700 bg-[#101D35] hover:bg-slate-800 flex items-center justify-center transition-colors"
              title="Refresh dashboard"
            >
              <RefreshCw className={`w-4 h-4 text-cyan-300 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </section>

      {loadError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {loadError}
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {topMetrics.map((metric) => (
          <div key={metric.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{metric.label}</div>
            <div className="text-lg font-extrabold text-slate-900 mt-1 truncate" title={metric.value}>{metric.value}</div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Your ecosystem</div>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5">Live business signals</h2>
          </div>
          <button
            onClick={() => onNavigate("connections")}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Manage connections
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {appCards.map((card) => {
            const app = appFor(card.id, card.shortName);
            const summary = summaries?.[card.key];
            const status = statusStyle(summary);
            const metrics = card.metrics(summary?.metrics || {}).map(metric => ({
              ...metric,
              value: summary?.status === "ok" ? metric.value : "—",
            }));
            const managed = isManagedHubApp(app, card.fallback);
            const launchUrl = appLaunchUrl(app, card.fallback);
            const Icon = card.icon;
            return (
              <a
                key={card.key}
                href={launchUrl || undefined}
                aria-disabled={!launchUrl}
                target={launchUrl && !managed ? "_blank" : undefined}
                rel={launchUrl && !managed ? "noopener noreferrer" : undefined}
                className={`bg-white border border-slate-200 rounded-2xl p-5 transition-all no-underline text-inherit group ${launchUrl ? "hover:border-cyan-300 hover:shadow-md" : "cursor-not-allowed opacity-75"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center">
                      <Icon className={`w-5 h-5 ${card.accent}`} />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{card.category}</div>
                      <h3 className="text-base font-bold text-slate-900">{card.title}</h3>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mt-3">{card.description}</p>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {metrics.map((metric) => (
                    <div key={metric.label} className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 min-w-0">
                      <div className="text-[9px] text-slate-400 truncate">{metric.label}</div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5 truncate" title={metric.value}>{metric.value}</div>
                    </div>
                  ))}
                </div>
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    {summary?.generatedAt ? `Updated ${new Date(summary.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Awaiting live data"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 group-hover:text-cyan-700">
                    {launchUrl ? <>Open <ArrowUpRight className="w-3.5 h-3.5" /></> : (app?.accessMessage || "Setup pending")}
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      <section className="bg-white border border-cyan-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-cyan-100 flex items-center justify-center">
            <Lightbulb className="w-4 h-4 text-cyan-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Action centre</h3>
            <p className="text-xs text-slate-500">Cross-app signals translated into practical next actions.</p>
          </div>
        </div>
        {actions.length ? actions.map((action) => {
          const card = appCards.find((item) => item.key === action.key)!;
          const app = appFor(card.id, card.shortName);
          const managed = isManagedHubApp(app, card.fallback);
          const launchUrl = appLaunchUrl(app, card.fallback);
          return (
            <div key={action.title} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-slate-900">{action.title}</h4>
                <p className="text-xs text-slate-600 mt-1">{action.detail}</p>
              </div>
              {launchUrl ? (
                <a
                  href={launchUrl}
                  target={managed ? undefined : "_blank"}
                  rel={managed ? undefined : "noopener noreferrer"}
                  className="text-xs font-semibold text-cyan-700 whitespace-nowrap"
                >
                  Open <ArrowUpRight className="inline w-3.5 h-3.5" />
                </a>
              ) : (
                <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">
                  {app?.accessMessage || "Setup pending"}
                </span>
              )}
            </div>
          );
        }) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-sm text-emerald-800">
            <CheckCircle2 className="w-4 h-4" />
            No urgent cross-app actions are being surfaced right now.
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-950 flex items-center justify-center">
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Business timeline</h3>
            <p className="text-xs text-slate-500">
              Product events will appear here as the event publishers are enabled. KPI data last refreshed{" "}
              {dashboard?.generatedAt ? new Date(dashboard.generatedAt).toLocaleTimeString() : "—"}.
            </p>
          </div>
        </div>
      </section>

      <footer className="pt-6 pb-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-slate-400">
        <div>V79 Digital · From Idea to Advantage</div>
        <div>Hub shows aggregate operational signals only; private app data stays inside each product.</div>
      </footer>
    </div>
  );
}
