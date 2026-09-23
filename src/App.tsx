import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, BookOpenCheck, Building2, CircleDollarSign,
  GraduationCap, Headphones, Link2, LogOut, RefreshCw, Settings2,
  ShieldCheck, Sparkles, TicketCheck, Unplug, Users
} from "lucide-react";

type Session = {
  user: { id: string; email: string; name: string };
  organization: { id: string; name: string; slug: string; role: string };
};

type Integration = {
  product: "ffpro" | "tiquet" | "academy";
  name: string;
  linked: boolean;
  externalSubjectId: string;
  openUrl: string;
  updatedAt: string | null;
};

type ProductResult = {
  name: string;
  openUrl: string;
  status: "connected" | "unlinked" | "offline" | "error" | "not_configured";
  summary?: any;
  error?: string;
};

type DashboardPayload = {
  organization: { id: string; name: string; slug: string };
  products: Record<Integration["product"], ProductResult>;
  events: Array<{ id: string; type: string; source: string; occurredAt: string }>;
};

const productMeta = {
  tiquet: {
    label: "V79 Tiquet",
    eyebrow: "Operations",
    description: "Customers, jobs, service delivery and team activity.",
    icon: TicketCheck,
    subjectHelp: "Tiquet account/workspace ID",
  },
  ffpro: {
    label: "FFPRO",
    eyebrow: "Financial intelligence",
    description: "Cash flow, budgets, financial goals and business visibility.",
    icon: CircleDollarSign,
    subjectHelp: "FFPRO user ID",
  },
  academy: {
    label: "V79 Academy",
    eyebrow: "Learning & capability",
    description: "Courses, progress, memberships and certificates.",
    icon: GraduationCap,
    subjectHelp: "Academy learner ID or email",
  },
} as const;

function formatNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(number)
    : "—";
}

function statusLabel(status?: string) {
  switch (status) {
    case "connected": return "Connected";
    case "unlinked": return "Not linked";
    case "offline": return "Offline";
    case "not_configured": return "Needs setup";
    case "error": return "Check connection";
    default: return "Loading";
  }
}

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Sign in failed.");
      onLogin(body);
    } catch (err: any) {
      setError(err.message || "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.15fr_.85fr] lg:px-10">
        <section className="max-w-2xl">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
            <Sparkles size={16} /> V79 Digital ecosystem
          </div>
          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
            One business.<br /><span className="text-cyan-300">One V79 experience.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            V79 Hub brings support, operations, finance and learning into one clear business view—without merging or exposing the underlying application data.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              [ShieldCheck, "Secure", "Signed service connections"],
              [Building2, "Unified", "One organisation identity"],
              [Activity, "Useful", "Business signals, not noise"],
            ].map(([Icon, title, text]: any) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <Icon className="mb-4 text-cyan-300" size={22} />
                <div className="font-medium">{title}</div>
                <div className="mt-1 text-sm text-slate-400">{text}</div>
              </div>
            ))}
          </div>
        </section>

        <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-9">
          <div className="mb-8">
            <div className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">V79 Hub</div>
            <h2 className="mt-2 text-3xl font-semibold">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-400">Sign in with your Hub owner account.</p>
          </div>
          <label className="block text-sm font-medium text-slate-200">
            Email
            <input
              autoComplete="email" type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
            />
          </label>
          <label className="mt-5 block text-sm font-medium text-slate-200">
            Password
            <input
              autoComplete="current-password" type="password" required value={password}
              onChange={e => setPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
            />
          </label>
          {error && <div role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
          <button disabled={busy} className="mt-7 w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in to V79 Hub"}
          </button>
          <p className="mt-6 text-center text-xs text-slate-500">From Idea to Advantage</p>
        </form>
      </div>
    </main>
  );
}

function ProductCard({ product, result }: { product: Integration["product"]; result?: ProductResult }) {
  const meta = productMeta[product];
  const Icon = meta.icon;
  const summary = result?.summary;
  const metrics = summary?.metrics || {};

  const highlights = useMemo(() => {
    if (product === "tiquet") return [
      ["Clients", formatNumber(metrics.clients)],
      ["Jobs", formatNumber(metrics.jobs)],
      ["Team", formatNumber(metrics.teamMembers)],
    ];
    if (product === "ffpro") return [
      ["Month income", formatNumber(metrics.currentMonthIncome)],
      ["Month expenses", formatNumber(metrics.currentMonthExpenses)],
      ["Month net", formatNumber(metrics.currentMonthNet)],
    ];
    return [
      ["Enrolled", formatNumber(metrics.enrolledCourses)],
      ["Progress", metrics.overallProgressPercent == null ? "—" : `${metrics.overallProgressPercent}%`],
      ["Certificates", formatNumber(metrics.certificates)],
    ];
  }, [metrics, product]);

  return (
    <article className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4">
          <div className="rounded-2xl bg-slate-950 p-3 text-cyan-300"><Icon size={24} /></div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{meta.eyebrow}</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-950">{meta.label}</h3>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
          result?.status === "connected" ? "bg-emerald-50 text-emerald-700" :
          result?.status === "unlinked" ? "bg-slate-100 text-slate-600" :
          "bg-amber-50 text-amber-700"
        }`}>{statusLabel(result?.status)}</span>
      </div>
      <p className="mt-5 min-h-12 text-sm leading-6 text-slate-500">{meta.description}</p>
      <div className="mt-6 grid grid-cols-3 gap-2">
        {highlights.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-slate-50 p-3">
            <div className="truncate text-xs text-slate-400">{label}</div>
            <div className="mt-1 truncate text-lg font-semibold text-slate-900">{value}</div>
          </div>
        ))}
      </div>
      {result?.error && <p className="mt-4 text-xs text-amber-700">{result.error}</p>}
      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
        <span className="text-xs text-slate-400">{summary?.generatedAt ? `Updated ${new Date(summary.generatedAt).toLocaleString()}` : "Connect to show live indicators"}</span>
        {result?.openUrl ? (
          <a href={result.openUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800 hover:text-cyan-700">
            Open <ArrowUpRight size={15} />
          </a>
        ) : null}
      </div>
    </article>
  );
}

function SecurityPanel() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (newPassword !== confirmPassword) return setMessage("The new passwords do not match.");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not change the password.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setMessage("Password updated. Other Hub sessions were signed out.");
    } catch (err: any) {
      setMessage(err.message || "Could not change the password.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-slate-950 p-2.5 text-cyan-300"><ShieldCheck size={20}/></div>
        <div><h3 className="font-semibold text-slate-950">Hub security</h3><p className="text-xs text-slate-400">Change the organisation owner password without touching the database.</p></div>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none ring-cyan-300 focus:ring-2"/></label>
        <label className="text-sm font-medium text-slate-700">New password<input type="password" autoComplete="new-password" minLength={16} value={newPassword} onChange={e=>setNewPassword(e.target.value)} required className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none ring-cyan-300 focus:ring-2"/></label>
        <label className="text-sm font-medium text-slate-700">Confirm new password<input type="password" autoComplete="new-password" minLength={16} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none ring-cyan-300 focus:ring-2"/></label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button disabled={busy} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{busy ? "Updating…" : "Update password"}</button>
        {message && <span role="status" className="text-sm text-slate-500">{message}</span>}
      </div>
    </form>
  );
}

function Connections({ integrations, onChanged }: { integrations: Integration[]; onChanged: () => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    setValues(Object.fromEntries(integrations.map(item => [item.product, item.externalSubjectId || ""])));
  }, [integrations]);

  async function save(product: Integration["product"]) {
    setBusy(product); setMessage("");
    try {
      const response = await fetch(`/api/integrations/${product}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalSubjectId: values[product] || "" }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not save the connection.");
      setMessage(`${productMeta[product].label} connected.`);
      await onChanged();
    } catch (err: any) {
      setMessage(err.message || "Could not save the connection.");
    } finally { setBusy(""); }
  }

  async function disconnect(product: Integration["product"]) {
    setBusy(product); setMessage("");
    try {
      const response = await fetch(`/api/integrations/${product}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not disconnect the product.");
      setMessage(`${productMeta[product].label} disconnected.`);
      await onChanged();
    } catch (err: any) {
      setMessage(err.message || "Could not disconnect the product.");
    } finally { setBusy(""); }
  }

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Product connections</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Link this organisation to the matching account in each V79 product. Phase 1 is read-only: the Hub can request aggregate indicators, but it cannot edit finance, jobs or Academy records.
        </p>
      </div>
      {message && <div role="status" className="mb-5 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">{message}</div>}
      <div className="space-y-4">
        {integrations.map(item => {
          const meta = productMeta[item.product];
          const Icon = meta.icon;
          return (
            <div key={item.product} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr_auto] lg:items-end">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-slate-950 p-2.5 text-cyan-300"><Icon size={20} /></div>
                  <div><div className="font-semibold text-slate-950">{meta.label}</div><div className="text-xs text-slate-400">{item.linked ? "Linked to this organisation" : "Not linked"}</div></div>
                </div>
                <label className="text-sm font-medium text-slate-700">
                  {meta.subjectHelp}
                  <input
                    value={values[item.product] || ""}
                    onChange={e => setValues(old => ({ ...old, [item.product]: e.target.value }))}
                    placeholder={meta.subjectHelp}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none ring-cyan-300 focus:ring-2"
                  />
                </label>
                <div className="flex gap-2">
                  <button disabled={busy === item.product} onClick={() => save(item.product)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                    {busy === item.product ? "Saving…" : "Save"}
                  </button>
                  {item.linked && (
                    <button disabled={busy === item.product} aria-label={`Disconnect ${meta.label}`} onClick={() => disconnect(item.product)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-slate-500 hover:bg-slate-50">
                      <Unplug size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <SecurityPanel />
    </section>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [view, setView] = useState<"overview" | "connections">("overview");
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [dashRes, integrationRes] = await Promise.all([
        fetch("/api/platform/dashboard"),
        fetch("/api/integrations"),
      ]);
      if (dashRes.status === 401 || integrationRes.status === 401) {
        setSession(null); return;
      }
      if (dashRes.ok) setDashboard(await dashRes.json());
      if (integrationRes.ok) setIntegrations(await integrationRes.json());
    } finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me").then(async response => {
      if (!response.ok) return setSession(null);
      const body = await response.json();
      setSession(body);
    }).catch(() => setSession(null));
  }, []);

  useEffect(() => { if (session) loadAll(); }, [session, loadAll]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setSession(null); setDashboard(null); setIntegrations([]);
  }

  if (session === undefined) {
    return <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-300"><RefreshCw className="animate-spin" /></div>;
  }
  if (!session) return <Login onLogin={setSession} />;

  const connected = Object.values(dashboard?.products || {}).filter((item: any) => item.status === "connected").length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 font-black text-cyan-300">V79</div>
            <div><div className="font-semibold">V79 Hub</div><div className="text-xs text-slate-400">From Idea to Advantage</div></div>
          </div>
          <nav className="hidden rounded-xl bg-slate-100 p-1 sm:flex" aria-label="Hub sections">
            <button onClick={() => setView("overview")} className={`rounded-lg px-4 py-2 text-sm font-medium ${view === "overview" ? "bg-white shadow-sm" : "text-slate-500"}`}>Overview</button>
            <button onClick={() => setView("connections")} className={`rounded-lg px-4 py-2 text-sm font-medium ${view === "connections" ? "bg-white shadow-sm" : "text-slate-500"}`}>Connections</button>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={loadAll} disabled={refreshing} aria-label="Refresh dashboard" className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50"><RefreshCw size={18} className={refreshing ? "animate-spin" : ""} /></button>
            <button onClick={logout} aria-label="Sign out" className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
        <div className="mb-6 flex gap-2 sm:hidden">
          <button onClick={() => setView("overview")} className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium ${view === "overview" ? "bg-slate-950 text-white" : "bg-white"}`}>Overview</button>
          <button onClick={() => setView("connections")} className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium ${view === "connections" ? "bg-slate-950 text-white" : "bg-white"}`}>Connections</button>
        </div>

        {view === "overview" ? (
          <>
            <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white sm:px-8 lg:px-10 lg:py-10">
              <div className="absolute -right-16 -top-28 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />
              <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <p className="text-sm font-medium text-cyan-300">Business command centre</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{session.organization.name}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                    See the health of your V79 services in one place, then move into the specialist app when you need detail or action.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4"><div className="text-2xl font-semibold">{connected}/3</div><div className="text-xs text-slate-400">Apps connected</div></div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4"><div className="text-2xl font-semibold capitalize">{session.organization.role}</div><div className="text-xs text-slate-400">Your access</div></div>
                </div>
              </div>
            </section>

            <section className="mt-8">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Your ecosystem</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Run the business from one starting point</h2></div>
                <button onClick={() => setView("connections")} className="hidden items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950 sm:flex"><Settings2 size={16} /> Manage connections</button>
              </div>
              <div className="grid gap-5 lg:grid-cols-3">
                {(["tiquet","ffpro","academy"] as const).map(product => <div key={product}><ProductCard product={product} result={dashboard?.products?.[product]} /></div>)}
              </div>
            </section>

            <section className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6">
                <div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-50 p-2.5 text-cyan-700"><Link2 size={20}/></div><div><h2 className="font-semibold">Connected by design</h2><p className="text-sm text-slate-500">Each app stays independent while the Hub provides the shared business context.</p></div></div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[["Website","Lead & acquisition"],["V79 Hub","Identity & visibility"],["V79 Apps","Specialist workflows"]].map(([title,text]) => <div key={title} className="rounded-2xl bg-slate-50 p-4"><div className="font-medium">{title}</div><div className="mt-1 text-xs text-slate-400">{text}</div></div>)}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6">
                <div className="flex items-center gap-3"><BookOpenCheck className="text-cyan-700" size={21}/><h2 className="font-semibold">What comes next</h2></div>
                <p className="mt-4 text-sm leading-6 text-slate-500">After these read-only contracts are proven, Phase 2 adds single sign-on, universal organisation IDs and event-driven handoffs such as lead → customer → service → learning.</p>
              </div>
            </section>
          </>
        ) : (
          <Connections integrations={integrations} onChanged={async () => { await loadAll(); }} />
        )}
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-5 pb-8 pt-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <span>V79 Digital · secure business technology platform</span>
        <span className="inline-flex items-center gap-1"><ShieldCheck size={13}/> Phase 1 connections are read-only</span>
      </footer>
    </div>
  );
}
