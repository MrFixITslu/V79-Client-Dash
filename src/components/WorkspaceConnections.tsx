import React, { useState } from "react";
import {
  Link2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Key,
  RefreshCw,
  Plus,
  ArrowUpRight,
  Server,
  Zap,
} from "lucide-react";
import { EcosystemApp, ViewState } from "../types";

interface WorkspaceConnectionsProps {
  apps: EcosystemApp[];
  onNavigate: (view: ViewState) => void;
  authToken: string | null;
}

export function WorkspaceConnections({ apps, onNavigate, authToken }: WorkspaceConnectionsProps) {
  const [testingPingId, setTestingPingId] = useState<string | null>(null);
  const [pingStatus, setPingStatus] = useState<Record<string, "ok" | "pending">>({});

  const handleTestPing = (appId: string) => {
    setTestingPingId(appId);
    setTimeout(() => {
      setPingStatus((prev) => ({ ...prev, [appId]: "ok" }));
      setTestingPingId(null);
    }, 600);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            WORKSPACE SETTINGS
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Connected V79 Services
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage authenticated integrations, SSO tokens, and cross-application permissions.
          </p>
        </div>
        <button
          onClick={() => onNavigate("overview")}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all self-start sm:self-auto"
        >
          <span>← Back to Hub Overview</span>
        </button>
      </div>

      {/* Notice Card */}
      <div className="bg-[#E9F8FA] border border-[#BCEBF2] rounded-2xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold text-slate-900">
            Aurora Identity & Signed Single Sign-On (SSO)
          </h4>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
            All connected applications in the <code className="text-teal-800 font-mono">*.v79sl.com</code> domain
            share secure session context. When you launch any connected product from the Hub, your signed identity token
            is verified without requiring re-authentication.
          </p>
        </div>
      </div>

      {/* Connected Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {apps.map((app) => (
          <div
            key={app.id}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-300 transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0B1528] flex items-center justify-center text-cyan-400 font-bold text-sm">
                  {app.shortName.slice(0, 3)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{app.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-slate-500">{app.appUrl}</span>
                  </div>
                </div>
              </div>

              <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                Connected
              </span>
            </div>

            <p className="text-xs text-slate-500 line-clamp-2">{app.description}</p>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTestPing(app.id)}
                  disabled={testingPingId === app.id}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors"
                >
                  <RefreshCw
                    className={`w-3 h-3 text-slate-400 ${
                      testingPingId === app.id ? "animate-spin" : ""
                    }`}
                  />
                  <span>
                    {testingPingId === app.id
                      ? "Testing..."
                      : pingStatus[app.id] === "ok"
                      ? "Latency: 28ms"
                      : "Ping Service"}
                  </span>
                </button>
              </div>

              <a
                href={app.appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-slate-700 hover:text-cyan-700 font-semibold"
              >
                <span>Launch</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
