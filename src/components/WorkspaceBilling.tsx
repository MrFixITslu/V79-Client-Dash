import React from "react";
import { CreditCard, Check, Sparkles } from "lucide-react";
import { ViewState } from "../types";

interface WorkspaceBillingProps {
  onNavigate: (view: ViewState) => void;
}

export function WorkspaceBilling({ onNavigate }: WorkspaceBillingProps) {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            WORKSPACE SETTINGS
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Subscription & Entitlements
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View current tier limits and ecosystem workspace entitlements.
          </p>
        </div>
        <button
          onClick={() => onNavigate("overview")}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all self-start sm:self-auto"
        >
          <span>← Back to Hub Overview</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Active Tier
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
              Free Beta Workspace
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Testing access · no charge. All core modules enabled for evaluation.
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-extrabold text-slate-900">$0.00</div>
            <div className="text-xs text-slate-400 font-medium">Free during beta</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Full Hub Command Centre</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>5 Ecosystem Services Linked</span>
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
            <span>Multi-Register Point of Sale</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Real-time Websocket Sync</span>
          </div>
        </div>
      </div>
    </div>
  );
}
