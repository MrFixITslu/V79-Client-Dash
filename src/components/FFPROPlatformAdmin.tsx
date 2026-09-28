import React, { useEffect, useMemo, useState } from "react";
import { Activity, Building2, Database, RefreshCw, ShieldCheck, UserRound, Users } from "lucide-react";

interface FFPROStats {
  totalAccounts: number;
  hubManagedAccounts: number;
  hubOrganizations: number;
  accountsWithSavedData: number;
  activeAccounts30d: number;
  generatedAt: string;
}

interface FFPROAccount {
  id: string;
  email: string;
  displayName: string;
  createdAt?: string | null;
  lastLoginAt?: string | null;
  hubOrganizationId?: string | null;
  hubManaged: boolean;
  hubFinanceOwner: boolean;
  hasSavedData: boolean;
  dataVersion?: number | null;
  dataUpdatedAt?: string | null;
}

async function ffproAdminApi<T>(path: string): Promise<T> {
  const response = await fetch(`/api/admin/platform/ffpro${path}`, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `FFPRO admin request failed (${response.status})`);
  return payload as T;
}

export function FFPROPlatformAdmin() {
  const [stats, setStats] = useState<FFPROStats | null>(null);
  const [accounts, setAccounts] = useState<FFPROAccount[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    setBusy(true);
    setError("");
    try {
      const [nextStats, nextAccounts] = await Promise.all([
        ffproAdminApi<FFPROStats>("/stats"),
        ffproAdminApi<FFPROAccount[]>("/accounts"),
      ]);
      setStats(nextStats);
      setAccounts(nextAccounts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "FFPRO platform administration could not be loaded.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return accounts.filter((account) =>
      !term || [account.displayName, account.email, account.hubOrganizationId]
        .some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [accounts, search]);

  return (
    <div className="space-y-5">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-4 py-3 text-sm">{error}</div>}

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">FFPRO platform administration</h2>
          <p className="text-xs text-slate-500 mt-1">Account and service metadata only. Balances, transactions, budgets, forecasts and financial records remain private inside each FFPRO account.</p>
        </div>
        <button onClick={() => void refresh()} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold inline-flex items-center gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Metric icon={Users} label="Accounts" value={stats?.totalAccounts ?? 0} />
        <Metric icon={ShieldCheck} label="Hub managed" value={stats?.hubManagedAccounts ?? 0} />
        <Metric icon={Building2} label="Hub organisations" value={stats?.hubOrganizations ?? 0} />
        <Metric icon={Database} label="Saved data profiles" value={stats?.accountsWithSavedData ?? 0} />
        <Metric icon={Activity} label="Active · 30d" value={stats?.activeAccounts30d ?? 0} />
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="admin-input max-w-md" placeholder="Search FFPRO accounts" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-3">Account</th><th className="p-3">Hub Status</th><th className="p-3">Finance Owner</th>
                <th className="p-3">Saved Data</th><th className="p-3">Last Login</th><th className="p-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((account) => (
                <tr key={account.id} className="text-xs">
                  <td className="p-3">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5"><UserRound className="w-3.5 h-3.5 text-emerald-600" />{account.displayName}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{account.email}</div>
                  </td>
                  <td className="p-3"><span className={`px-2 py-1 rounded-full text-[9px] font-bold ${account.hubManaged ? "bg-cyan-50 text-cyan-700" : "bg-slate-100 text-slate-600"}`}>{account.hubManaged ? "Hub managed" : "Local/legacy"}</span>{account.hubOrganizationId && <div className="text-[9px] text-slate-400 mt-1 max-w-[180px] truncate">{account.hubOrganizationId}</div>}</td>
                  <td className="p-3"><span className={`text-[10px] font-semibold ${account.hubFinanceOwner ? "text-emerald-700" : "text-slate-400"}`}>{account.hubFinanceOwner ? "Yes" : "No"}</span></td>
                  <td className="p-3">
                    <div className={account.hasSavedData ? "text-emerald-700 font-semibold" : "text-slate-400"}>{account.hasSavedData ? "Present" : "None"}</div>
                    {account.dataVersion != null && <div className="text-[9px] text-slate-400 mt-0.5">Version {account.dataVersion}</div>}
                  </td>
                  <td className="p-3 text-slate-500">{account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : "Never"}</td>
                  <td className="p-3 text-slate-500">{account.createdAt ? new Date(account.createdAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="p-10 text-center text-sm text-slate-400">No FFPRO accounts found.</div>}
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ComponentType<{className?:string}>; label:string; value:number }) {
  return <div className="bg-white border border-slate-200 rounded-xl p-4"><Icon className="w-4 h-4 text-emerald-600" /><div className="text-xl font-extrabold text-slate-900 mt-2">{value}</div><div className="text-[10px] text-slate-500 mt-0.5">{label}</div></div>;
}
