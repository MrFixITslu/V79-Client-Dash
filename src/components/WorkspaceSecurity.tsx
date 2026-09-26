import React from "react";
import { Shield, Lock, Key, CheckCircle2, AlertCircle } from "lucide-react";
import { ViewState } from "../types";

interface WorkspaceSecurityProps {
  onNavigate: (view: ViewState) => void;
}

export function WorkspaceSecurity({ onNavigate }: WorkspaceSecurityProps) {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            WORKSPACE SETTINGS
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Security & Identity
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Single Sign-On (SSO) cryptography, token rotation, and identity guardrails.
          </p>
        </div>
        <button
          onClick={() => onNavigate("overview")}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all self-start sm:self-auto"
        >
          <span>← Back to Hub Overview</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2.5">
            <Key className="w-5 h-5 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">Signed SSO Tokens</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Ecosystem products (FFPRO, Tiquet, Marketing, V79 POS, and Academy) verify session tokens using SHA-256 HMAC signatures issued by the Hub authority.
          </p>
          <div className="pt-2">
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Cryptographic Token Engine Online
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">TLS & Transport Security</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            All cross-app API calls and websocket streams communicate strictly over end-to-end HTTPS/WSS with strict origin headers.
          </p>
          <div className="pt-2">
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Enforced HTTPS & WSS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
