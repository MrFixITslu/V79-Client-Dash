import React from "react";
import {
  Sparkles,
  Link2,
  Users,
  Shield,
  CreditCard,
  Settings2,
  Bot,
  LogOut,
} from "lucide-react";
import { ViewState, User } from "../types";

interface SidebarProps {
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
  onLogout: () => void;
  user: User;
}

export function Sidebar({ currentView, onViewChange, onLogout, user }: SidebarProps) {
  return (
    <aside className="w-64 bg-[#070e17] border-r border-slate-800/80 text-slate-300 h-screen flex flex-col shrink-0 select-none">
      {/* Brand Header matching screenshot */}
      <div className="p-5 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          {/* Logo badge with 'v79' */}
          <div className="w-9 h-9 rounded-xl bg-[#0e2238] border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-extrabold text-sm shadow-sm tracking-tight">
            v79
          </div>
          <div>
            <h2 className="font-extrabold text-white text-base leading-tight">
              V79 Hub
            </h2>
            <p className="text-[11px] text-slate-400 font-normal">
              From Idea to Advantage.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Links - Matching Screenshot */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {/* WORKSPACE SECTION */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            WORKSPACE
          </div>
          <div className="space-y-1">
            {/* Overview */}
            <button
              onClick={() => onViewChange("overview")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-all ${
                currentView === "overview" || currentView === "dashboard"
                  ? "bg-teal-900/40 text-teal-300 border border-teal-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Overview</span>
            </button>

            {/* Connections */}
            <button
              onClick={() => onViewChange("connections")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-all ${
                currentView === "connections"
                  ? "bg-teal-900/40 text-teal-300 border border-teal-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              <Link2 className="w-4 h-4" />
              <span>Connections</span>
            </button>

            {/* Team */}
            <button
              onClick={() => onViewChange("team")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-all ${
                currentView === "team"
                  ? "bg-teal-900/40 text-teal-300 border border-teal-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Team</span>
            </button>

            {/* Security */}
            <button
              onClick={() => onViewChange("security")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-all ${
                currentView === "security"
                  ? "bg-teal-900/40 text-teal-300 border border-teal-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Security</span>
            </button>

            {/* Billing */}
            <button
              onClick={() => onViewChange("billing")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-all ${
                currentView === "billing"
                  ? "bg-teal-900/40 text-teal-300 border border-teal-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Billing</span>
            </button>
          </div>
        </div>

        {user.ownerAgent && (
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              OWNER AI
            </div>
            <button
              onClick={() => onViewChange("assistant")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-all ${
                currentView === "assistant"
                  ? "bg-cyan-900/40 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              <Bot className="w-4 h-4 text-cyan-400" />
              <span>Owner Assistant</span>
            </button>
          </div>
        )}

        {user.platformOperator && (
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              ADMINISTRATION
            </div>
            <button
              onClick={() => onViewChange("admin")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-all ${
                currentView === "admin"
                  ? "bg-teal-900/40 text-teal-300 border border-teal-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              <Settings2 className="w-4 h-4" />
              <span>Admin Console</span>
            </button>
          </div>
        )}
      </nav>

      {/* ACTIVE ORGANISATION Footer matching screenshot */}
      <div className="p-4 border-t border-slate-800/80 bg-[#060c14]">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
          ACTIVE ORGANISATION
        </div>
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 font-bold text-xs shrink-0">
              V
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">V79 Digital</div>
              <div className="text-[10px] text-teal-400 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                Free Beta Active
              </div>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Log out"
            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}