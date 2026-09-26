import React from "react";
import { CreditCard, Check, Sparkles, Building, Calendar, Receipt, Download } from "lucide-react";
import { ViewState } from "../types";

interface WorkspaceBillingProps {
  onNavigate: (view: ViewState) => void;
}

export function WorkspaceBilling({ onNavigate }: WorkspaceBillingProps) {
  const billingHistory = [
    {
      id: "inv-beta-01",
      date: "2026-09-01",
      description: "V79 Hub All-Access Free Beta Subscription",
      amount: "$0.00 XCD",
      status: "Active Beta Grant",
    },
    {
      id: "inv-beta-02",
      date: "2026-08-01",
      description: "V79 Digital Platform Entitlement Renewal",
      amount: "$0.00 XCD",
      status: "Completed",
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            WORKSPACE SETTINGS
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Subscription & Entitlements
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View current tier limits, workspace entitlements, and billing profile.
          </p>
        </div>
        <button
          onClick={() => onNavigate("overview")}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all self-start sm:self-auto cursor-pointer"
        >
          <span>← Back to Hub Overview</span>
        </button>
      </div>

      {/* Active Tier Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Active Tier
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
              Free Beta Workspace
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Testing access · no charge. All core modules and ecosystem apps enabled for evaluation.
            </p>
          </div>
          <div className="sm:text-right">
            <div className="text-3xl font-extrabold text-slate-900">$0.00</div>
            <div className="text-xs text-slate-400 font-medium">Free during active beta</div>
          </div>
        </div>

        {/* Feature Checkmarks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Full Hub Command Centre</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>5 Live Ecosystem Apps (FFPRO, Tiquet, Marketing, Academy, POS)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Unlimited Catalog & Inventory SKUs</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Single Sign-On (SSO) Pass-Through</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>High-Performance POS Register Access</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Real-time WebSocket Data Sync</span>
          </div>
        </div>
      </div>

      {/* Organization Details & Beta Entitlements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <Building className="w-5 h-5 text-cyan-600" />
            <h3 className="text-sm font-bold text-slate-900">Organisation Billing Profile</h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Legal Entity</span>
              <span className="font-semibold text-slate-900">V79 Digital Ltd</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Jurisdiction</span>
              <span className="font-semibold text-slate-900">Saint Lucia (SLU)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Default Currency</span>
              <span className="font-semibold text-slate-900">XCD ($ Eastern Caribbean Dollar)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Primary Contact</span>
              <span className="font-mono text-slate-900">Vision79SLU@gmail.com</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Beta Program Terms</h3>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Your organization is enrolled in the V79 Platform Founder Beta. All services, including POS registers and database sync, are provided with zero licensing fees.
          </p>

          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-1.5">
            <div className="font-semibold text-slate-900">Seamless Data Portability</div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              When transitioning to production tiers in the future, all products, users, transactions, and connected applications persist without data loss.
            </p>
          </div>
        </div>
      </div>

      {/* Invoices & Grants Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Receipt className="w-4 h-4 text-cyan-600" />
            <h3 className="text-sm font-bold text-slate-900">Billing & Entitlement History</h3>
          </div>
          <span className="text-xs text-slate-400">Zero charges during beta</span>
        </div>

        <div className="divide-y divide-slate-100">
          {billingHistory.map((inv) => (
            <div key={inv.id} className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50/50 text-xs">
              <div>
                <div className="font-semibold text-slate-900">{inv.description}</div>
                <div className="text-slate-400 text-[11px] font-mono mt-0.5">{inv.id} · {inv.date}</div>
              </div>

              <div className="flex items-center gap-4">
                <span className="font-bold text-slate-900">{inv.amount}</span>
                <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  {inv.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
