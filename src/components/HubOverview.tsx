import React from "react";
import {
  Headphones,
  Wallet,
  Megaphone,
  GraduationCap,
  CreditCard,
  Lightbulb,
  Zap,
  Activity,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { EcosystemApp, ViewState, User } from "../types";

interface HubOverviewProps {
  ecosystemApps: EcosystemApp[];
  onOpenAppConsole: (app: EcosystemApp) => void;
  onNavigate: (view: ViewState) => void;
  authToken: string | null;
  user: User | null;
}

export function HubOverview({
  ecosystemApps,
  onNavigate,
  authToken,
}: HubOverviewProps) {
  // Find ecosystem apps
  const tiquetApp = ecosystemApps.find(
    (a) => a.id === "app-tiquet" || a.shortName === "Tiquet"
  );
  const ffproApp = ecosystemApps.find(
    (a) => a.id === "app-ffpro" || a.shortName === "FFPRO"
  );
  const marketingApp = ecosystemApps.find(
    (a) => a.id === "app-marketing" || a.shortName === "Marketing"
  );
  const academyApp = ecosystemApps.find(
    (a) => a.id === "app-academy" || a.shortName === "Academy"
  );
  const posApp = ecosystemApps.find(
    (a) => a.id === "app-v79pos" || a.shortName === "V79 POS"
  );

  const getLaunchUrl = (app: EcosystemApp | undefined, fallback: string) => {
    return app?.id === "app-v79pos" || fallback === "https://pos.v79sl.com" ? "/api/apps/pos/launch" : app?.appUrl || fallback;
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* 1. Hero Command Centre Card */}
      <div className="bg-[#0B1528] border border-slate-800 rounded-2xl p-6 sm:p-8 text-white shadow-xl shadow-slate-950/20 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <span className="text-cyan-400 font-semibold text-xs tracking-wide uppercase">
              Business command centre
            </span>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight mt-1.5">
              V79 Digital
            </h1>
            <p className="text-slate-300 text-sm mt-2 leading-relaxed">
              See the health of your V79 services in one place, then move into the
              specialist app when you need detail or action.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {/* Box 1: Live business apps */}
            <div className="bg-[#101D35]/90 border border-slate-700/60 rounded-xl px-5 py-3.5 min-w-[140px] text-center shadow-inner">
              <div className="text-2xl font-extrabold text-white tracking-tight">5/5</div>
              <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                Live business apps
              </div>
            </div>

            {/* Box 2: Free Beta */}
            <div className="bg-[#101D35]/90 border border-slate-700/60 rounded-xl px-5 py-3.5 min-w-[160px] text-center shadow-inner">
              <div className="text-2xl font-extrabold text-white tracking-tight">
                Free Beta
              </div>
              <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                Testing access · no charge
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Free Beta Notice Banner */}
      <div className="bg-[#E9F8FA] border border-[#BCEBF2] rounded-2xl p-4 sm:p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">
          Your free V79 beta workspace
        </h3>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
          Test the available apps and tell us where the workflow needs improvement. All core ecosystem services including V79 POS are live and accessible. Your account and data can carry forward to paid access later.
        </p>
      </div>

      {/* 3. YOUR ECOSYSTEM Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              YOUR ECOSYSTEM
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
              Run the business from one starting point
            </h2>
          </div>
          <button
            onClick={() => onNavigate("connections")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>Manage connections</span>
          </button>
        </div>

        {/* Row 1: 3 Cards (V79 Tiquet, FFPRO, V79 Marketing) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: V79 Tiquet */}
          <a
            href={getLaunchUrl(tiquetApp, "https://tiquet.v79sl.com")}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border border-slate-200/90 rounded-2xl p-5 hover:border-sky-300 hover:shadow-md transition-all flex flex-col justify-between group no-underline text-inherit cursor-pointer"
          >
            <div>
              {/* Category & Status Badges */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  OPERATIONS
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    BETA
                  </span>
                  <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                    Ready to activate
                  </span>
                </div>
              </div>

              {/* Icon & Title */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-[#0B1528] flex items-center justify-center text-teal-400 shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <Headphones className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-cyan-700 transition-colors">
                    V79 Tiquet
                  </h3>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-500 leading-relaxed">
                Customers, jobs, service delivery and team activity.
              </p>

              {/* Workspace Action Note */}
              <p className="text-[11px] text-amber-700/80 font-medium mt-4">
                Open V79 Tiquet to initialise this organisation's workspace.
              </p>
            </div>

            {/* Footer */}
            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-end">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 group-hover:text-cyan-700 transition-colors">
                <span>Open</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </a>

          {/* Card 2: FFPRO */}
          <a
            href={getLaunchUrl(ffproApp, "https://ffpro.v79sl.com")}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border border-slate-200/90 rounded-2xl p-5 hover:border-amber-300 hover:shadow-md transition-all flex flex-col justify-between group no-underline text-inherit cursor-pointer"
          >
            <div>
              {/* Category & Status Badges */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  FINANCIAL INTELLIGENCE
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    BETA
                  </span>
                  <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                    Ready to activate
                  </span>
                </div>
              </div>

              {/* Icon & Title */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-[#0B1528] flex items-center justify-center text-amber-400 shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                    FFPRO
                  </h3>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-500 leading-relaxed">
                Cash flow, budgets, financial goals and business visibility.
              </p>

              {/* Workspace Action Note */}
              <p className="text-[11px] text-amber-700/80 font-medium mt-4">
                Open FFPRO to initialise this organisation's workspace.
              </p>
            </div>

            {/* Footer */}
            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-end">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors">
                <span>Open</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </a>

          {/* Card 3: V79 Marketing */}
          <a
            href={getLaunchUrl(marketingApp, "https://marketing.v79sl.com")}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border border-slate-200/90 rounded-2xl p-5 hover:border-pink-300 hover:shadow-md transition-all flex flex-col justify-between group no-underline text-inherit cursor-pointer"
          >
            <div>
              {/* Category & Status Badges */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  GROWTH ENGINE
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    BETA
                  </span>
                  <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                    Ready to activate
                  </span>
                </div>
              </div>

              {/* Icon & Title */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-[#0B1528] flex items-center justify-center text-pink-400 shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <Megaphone className="w-4 h-4 text-pink-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-pink-700 transition-colors">
                    V79 Marketing
                  </h3>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-500 leading-relaxed">
                Campaigns, customer pipeline, content, brand intelligence and marketing analytics.
              </p>

              {/* Workspace Action Note */}
              <p className="text-[11px] text-amber-700/80 font-medium mt-4">
                Open V79 Marketing to initialise this organisation's workspace.
              </p>
            </div>

            {/* Footer */}
            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-end">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 group-hover:text-pink-700 transition-colors">
                <span>Open</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </a>
        </div>

        {/* Row 2: 2 Cards (V79 Academy, V79 POS) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 4: V79 Academy */}
          <a
            href={getLaunchUrl(academyApp, "https://academy.v79sl.com")}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border border-slate-200/90 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between group no-underline text-inherit cursor-pointer"
          >
            <div>
              {/* Category & Status Badges */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  LEARNING & CAPABILITY
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    BETA
                  </span>
                  <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                    Connected
                  </span>
                </div>
              </div>

              {/* Icon & Title */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-[#0B1528] flex items-center justify-center text-indigo-400 shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-4 h-4 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                    V79 Academy
                  </h3>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-500 leading-relaxed">
                Public training stays independent; businesses can link learner progress to
                their Hub.
              </p>

              {/* 3 Metrics: Enrolled, Progress, Certificates */}
              <div className="grid grid-cols-3 gap-3 pt-4 mt-3 border-t border-slate-100 text-center">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] font-medium text-slate-400">Enrolled</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">1</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] font-medium text-slate-400">Progress</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">0%</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] font-medium text-slate-400">Certificates</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">0</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400">
                Updated {new Date().toLocaleDateString()}, 9:03:49 PM
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">
                <span>Open</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </a>

          {/* Card 5: V79 POS (Live Card matching the rest!) */}
          <a
            href={getLaunchUrl(posApp, "https://pos.v79sl.com")}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border border-slate-200/90 rounded-2xl p-5 hover:border-purple-300 hover:shadow-md transition-all flex flex-col justify-between group no-underline text-inherit cursor-pointer"
          >
            <div>
              {/* Category & Status Badges */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  COMMERCE
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    BETA
                  </span>
                  <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                    Ready to activate
                  </span>
                </div>
              </div>

              {/* Icon & Title */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-[#0B1528] flex items-center justify-center text-purple-400 shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <CreditCard className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                    V79 POS
                  </h3>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-500 leading-relaxed">
                Sales, stock, purchasing, and high-performance register store operations.
              </p>

              {/* Workspace Action Note matching rest */}
              <p className="text-[11px] text-amber-700/80 font-medium mt-4">
                Open V79 POS to initialise this organisation's workspace.
              </p>
            </div>

            {/* Footer */}
            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-end">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 group-hover:text-purple-700 transition-colors">
                <span>Open</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </a>
        </div>
      </div>

      {/* 4. Action Centre Card matching screenshot */}
      <div className="bg-white border border-cyan-200/90 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600 shrink-0">
            <Lightbulb className="w-4 h-4 text-cyan-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Action centre</h3>
            <p className="text-xs text-slate-500">
              Cross-app signals translated into practical next actions.
            </p>
          </div>
        </div>

        {/* Action Item 1: Training is in progress */}
        <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-600 shrink-0 mt-0.5">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                Training is in progress
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Academy enrolment is active but no certificate is recorded yet. Continue the
                learning plan.
              </p>
            </div>
          </div>
          <a
            href={getLaunchUrl(academyApp, "https://academy.v79sl.com")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-800 shrink-0 self-start sm:self-auto cursor-pointer no-underline"
          >
            <span>Open V79 Academy</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* 5. Business Timeline Card matching screenshot */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#0B1528] flex items-center justify-center text-cyan-400 shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Business timeline</h3>
            <p className="text-xs text-slate-500">
              Important activity from across your connected V79 products.
            </p>
          </div>
        </div>

        <div className="py-8 text-center text-xs text-slate-400">
          Connected product events will appear here as Phase 2 publishers come online.
        </div>
      </div>

      {/* 6. Footer matching exact reference */}
      <footer className="pt-6 pb-4 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-slate-400">
        <div>V79 Digital · Aurora business technology platform</div>
        <div>Hub: managed identity, entitlements and signed product connections.</div>
      </footer>
    </div>
  );
}
