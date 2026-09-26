import React from "react";
import { Users, UserPlus, Shield, Mail, CheckCircle2 } from "lucide-react";
import { User, ViewState } from "../types";

interface WorkspaceTeamProps {
  users: User[];
  currentUser: User | null;
  onNavigate: (view: ViewState) => void;
}

export function WorkspaceTeam({ users, currentUser, onNavigate }: WorkspaceTeamProps) {
  const teamList = users.length > 0 ? users : [
    {
      id: "u-1",
      username: currentUser?.username || "Vision79SLU",
      fullName: currentUser?.fullName || "Vision 79 Administrator",
      role: "admin" as const,
      createdAt: "2026-01-15T00:00:00.000Z",
    },
    {
      id: "u-2",
      username: "tech_lead",
      fullName: "Field Technician Manager",
      role: "manager" as const,
      createdAt: "2026-02-10T00:00:00.000Z",
    },
    {
      id: "u-3",
      username: "pos_cashier",
      fullName: "Retail Checkout Operator",
      role: "staff" as const,
      createdAt: "2026-03-01T00:00:00.000Z",
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            WORKSPACE SETTINGS
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Workspace Team & Members
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage who has access to the V79 Digital organisation and connected apps.
          </p>
        </div>
        <button
          onClick={() => onNavigate("overview")}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all self-start sm:self-auto"
        >
          <span>← Back to Hub Overview</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-cyan-600" />
            <h3 className="text-sm font-bold text-slate-900">Active Organisation Members</h3>
          </div>
          <span className="text-xs text-slate-500">{teamList.length} members</span>
        </div>

        <div className="divide-y divide-slate-100">
          {teamList.map((member) => (
            <div key={member.id} className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0B1528] text-cyan-400 font-bold flex items-center justify-center text-xs">
                  {member.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{member.fullName || member.username}</div>
                  <div className="text-xs text-slate-400 font-mono">@{member.username}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {member.role}
                </span>
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Active
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
