import React, { useEffect, useMemo, useState } from "react";
import { Activity, Building2, CreditCard, Megaphone, RefreshCw, Sparkles, Users } from "lucide-react";

interface MarketingStats {
  totalBusinesses: number;
  totalUsers: number;
  totalPosts: number;
  scheduledPosts: number;
  publishedPosts: number;
  totalCampaigns: number;
  activeCampaigns: number;
  activeSubscriptions: number;
  connectedSocialAccounts: number;
  platformRevenueXcd: number;
  platformRevenueUsd: number;
  aiCreditsAllocated: number;
  aiCreditsUsed: number;
  generatedAt: string;
}
interface MarketingBusiness {
  id: string;
  name: string;
  industry: string;
  location: string;
  plan: string;
  hubOrganizationId?: string | null;
  createdAt: string;
  userCount: number;
  postCount: number;
  campaignCount: number;
  connectedSocialAccounts: number;
  aiCreditsUsed: number;
  aiCreditsRemaining: number;
}

async function marketingAdminApi<T>(path: string): Promise<T> {
  const response = await fetch(`/api/admin/marketing${path}`, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `Marketing admin request failed (${response.status})`);
  return payload as T;
}

export function MarketingPlatformAdmin() {
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [businesses, setBusinesses] = useState<MarketingBusiness[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    setBusy(true);
    setError("");
    try {
      const [nextStats, nextBusinesses] = await Promise.all([
        marketingAdminApi<MarketingStats>("/stats"),
        marketingAdminApi<MarketingBusiness[]>("/businesses"),
      ]);
      setStats(nextStats);
      setBusinesses(nextBusinesses);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Marketing platform administration could not be loaded.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return businesses.filter((business) =>
      !term || [business.name, business.industry, business.location, business.plan]
        .some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [businesses, search]);

  const usedPercent = stats?.aiCreditsAllocated
    ? Math.min(100, Math.round((stats.aiCreditsUsed / stats.aiCreditsAllocated) * 100))
    : 0;

  return (
    <div className="space-y-5">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-4 py-3 text-sm">{error}</div>}

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">Marketing platform administration</h2>
          <p className="text-xs text-slate-500 mt-1">
            Platform usage and workspace metadata only. Campaign content, customers, social tokens and business memory stay private inside each workspace.
          </p>
        </div>
        <button onClick={() => void refresh()} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold inline-flex items-center gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Metric icon={Building2} label="Businesses" value={stats?.totalBusinesses ?? 0} />
        <Metric icon={Users} label="Users" value={stats?.totalUsers ?? 0} />
        <Metric icon={Megaphone} label="Campaigns" value={stats?.totalCampaigns ?? 0} />
        <Metric icon={Activity} label="Published posts" value={stats?.publishedPosts ?? 0} />
        <Metric icon={CreditCard} label="Active subscriptions" value={stats?.activeSubscriptions ?? 0} />
      </div>

      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1.2fr] gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="text-[10px] text-slate-500">Platform revenue</div>
            <div className="text-lg font-extrabold text-slate-900 mt-1">EC$ {stats.platformRevenueXcd.toFixed(2)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">US$ {stats.platformRevenueUsd.toFixed(2)}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="text-[10px] text-slate-500">Connected social accounts</div>
            <div className="text-lg font-extrabold text-slate-900 mt-1">{stats.connectedSocialAccounts}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{stats.scheduledPosts} posts scheduled</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] text-slate-500 inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI credit use</div>
              <div className="text-[10px] font-semibold text-slate-700">{usedPercent}%</div>
            </div>
            <div className="h-2 bg-slate-200 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-slate-900 rounded-full" style={{ width: `${usedPercent}%` }} />
            </div>
            <div className="text-[10px] text-slate-400 mt-2">{stats.aiCreditsUsed.toLocaleString()} used of {stats.aiCreditsAllocated.toLocaleString()} allocated</div>
          </div>
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="admin-input max-w-md" placeholder="Search Marketing workspaces" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-3">Workspace</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Users</th>
                <th className="p-3">Posts</th>
                <th className="p-3">Campaigns</th>
                <th className="p-3">Social</th>
                <th className="p-3">AI Credits</th>
                <th className="p-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((business) => (
                <tr key={business.id} className="text-xs">
                  <td className="p-3">
                    <div className="font-semibold text-slate-900">{business.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{business.industry || "—"}{business.location ? ` · ${business.location}` : ""}</div>
                  </td>
                  <td className="p-3"><span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[9px] font-bold">{business.plan}</span></td>
                  <td className="p-3 text-slate-600">{business.userCount}</td>
                  <td className="p-3 text-slate-600">{business.postCount}</td>
                  <td className="p-3 text-slate-600">{business.campaignCount}</td>
                  <td className="p-3 text-slate-600">{business.connectedSocialAccounts}</td>
                  <td className="p-3">
                    <div className="text-slate-700">{business.aiCreditsUsed.toLocaleString()} used</div>
                    <div className="text-[10px] text-slate-400">{business.aiCreditsRemaining.toLocaleString()} remaining</div>
                  </td>
                  <td className="p-3 text-slate-500">{business.createdAt ? new Date(business.createdAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="p-10 text-center text-sm text-slate-400">No Marketing workspaces found.</div>}
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ComponentType<{className?:string}>; label:string; value:number }) {
  return <div className="bg-white border border-slate-200 rounded-xl p-4"><Icon className="w-4 h-4 text-indigo-600" /><div className="text-xl font-extrabold text-slate-900 mt-2">{value}</div><div className="text-[10px] text-slate-500 mt-0.5">{label}</div></div>;
}
