import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowUpRight, BookOpenCheck, Building2, CheckCircle2, CircleDollarSign,
  GraduationCap, Headphones, Lightbulb, Link2, LogOut, Megaphone, RefreshCw, Settings2,
  ShieldCheck, Sparkles, TicketCheck, Unplug, Users
} from "lucide-react";

type Session = {
  user: { id: string; email: string; name: string };
  organization: { id: string; name: string; slug: string; role: string };
};

type Integration = {
  product: "ffpro" | "tiquet" | "academy" | "marketing";
  name: string;
  linked: boolean;
  externalSubjectId: string;
  openUrl: string;
  updatedAt: string | null;
  entitled?: boolean;
  accessible?: boolean;
  managedByHub?: boolean;
};

type ProductResult = {
  name: string;
  openUrl: string;
  status: "connected" | "ready" | "unlinked" | "offline" | "error" | "not_configured" | "restricted";
  summary?: any;
  error?: string;
  entitled?: boolean;
  accessible?: boolean;
};

type Subscription = {
  plan: "start" | "business" | "advantage";
  status: "trialing" | "active" | "past_due" | "cancelled" | "suspended";
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
};

type DashboardPayload = {
  organization: { id: string; name: string; slug: string };
  subscription?: Subscription | null;
  seats?: { members:number; pendingInvites:number; used:number; limit:number };
  products: Record<Integration["product"], ProductResult>;
  events: Array<{ id: string; type: string; source: string; occurredAt: string; details?: { subjectId?: string | null; correlationId?: string | null; payload?: Record<string, unknown> } }>;
};

type TeamMember = {
  id:string; email:string; name:string; role:"owner"|"admin"|"member"; joinedAt:string; products:string[];
};
type TeamInvitation = {
  id:string; email:string; role:"admin"|"member"; products:string[]; expiresAt:string; createdAt:string;
};
type TeamPayload = {
  seats:{members:number;pendingInvites:number;used:number;limit:number};
  assignableProducts:string[];
  financeAccess:"owner_only";
  emailDeliveryConfigured?:boolean;
  members:TeamMember[];
  invitations:TeamInvitation[];
};

type BillingOrder = {
  id:string;
  plan:"start"|"business"|"advantage";
  billingCycle:"monthly"|"annual";
  amountXcd:number;
  currency:string;
  provider:string;
  status:"pending"|"checkout_ready"|"paid"|"failed"|"cancelled";
  providerTransactionId?:string|null;
  createdAt:string;
  paidAt?:string|null;
};
type BillingPayload = {
  subscription:Subscription|null;
  seats:{members:number;pendingInvites:number;used:number;limit:number};
  provider:{id:string;name:string;configured:boolean;environment?:string|null;currency?:string|null;countryCode?:string|null;hostedCheckout:boolean;cardDataStoredByV79:boolean};
  plans:Array<{id:"start"|"business"|"advantage";name:string;monthlyXcd:number;annualXcd:number;includedUsers:number;products:string[]}>;
  orders:BillingOrder[];
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
    description: "Public training stays independent; businesses can link learner progress to their Hub.",
    icon: GraduationCap,
    subjectHelp: "Academy learner ID or email",
  },
  marketing: {
    label: "V79 Marketing",
    eyebrow: "Growth engine",
    description: "Campaigns, customer pipeline, content, brand intelligence and marketing analytics.",
    icon: Megaphone,
    subjectHelp: "Managed automatically by V79 Hub",
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
    case "ready": return "Ready to activate";
    case "unlinked": return "Not linked";
    case "offline": return "Offline";
    case "not_configured": return "Needs setup";
    case "error": return "Check connection";
    case "restricted": return "Not assigned";
    default: return "Loading";
  }
}

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [mode, setMode] = useState<"login"|"register"|"forgot"|"verify">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [plan, setPlan] = useState<"start"|"business"|"advantage">("business");
  const [planData, setPlanData] = useState<any>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/plans").then(r=>r.json()).then(setPlanData).catch(()=>{});
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const endpoint =
        mode==="login" ? "/api/auth/login" :
        mode==="register" ? "/api/auth/register" :
        mode==="forgot" ? "/api/auth/forgot-password" :
        "/api/auth/resend-verification";
      const payload =
        mode==="login" ? {email,password} :
        mode==="register" ? {email,password,name,organizationName,plan} :
        {email};
      const response=await fetch(endpoint,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload),
      });
      const body=await response.json().catch(()=>({}));

      if(mode==="login" && response.status===403 && body.code==="EMAIL_VERIFICATION_REQUIRED") {
        setMode("verify");
        setMessage("Verify your email before signing in. You can resend the verification message below.");
        return;
      }
      if(!response.ok) throw new Error(body.error || "Request failed.");

      if(mode==="login") {
        onLogin(body);
      } else if(mode==="register") {
        setMode("verify");
        setPassword("");
        setMessage(body.message || "Check your email to verify the address and activate your V79 workspace.");
      } else {
        setMessage(body.message || (mode==="forgot"
          ? "If the account exists, reset instructions have been sent."
          : "If the account is waiting for verification, a new verification email has been sent."));
      }
    } catch(err:any) {
      setError(err.message || "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  const plans=planData?.plans || [
    {id:"start",name:"V79 Start",monthlyXcd:149,includedUsers:2,products:["ffpro","tiquet"]},
    {id:"business",name:"V79 Business",monthlyXcd:299,includedUsers:5,products:["ffpro","tiquet","marketing"]},
    {id:"advantage",name:"V79 Advantage",monthlyXcd:499,includedUsers:10,products:["ffpro","tiquet","marketing"]},
  ];
  const title =
    mode==="login" ? "Welcome back" :
    mode==="register" ? "Start your V79 workspace" :
    mode==="forgot" ? "Reset your password" :
    "Verify your email";
  const help =
    mode==="login" ? "Sign in with your verified V79 Hub credentials." :
    mode==="register" ? `Verify your email first; then your ${planData?.trialDays ?? 14}-day trial begins.` :
    mode==="forgot" ? "Enter your email. If it belongs to a verified Hub account, we will send a 30-minute reset link." :
    "Enter the account email to send a fresh 24-hour verification link.";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.05fr_.95fr] lg:px-10">
        <section className="max-w-2xl">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
            <Sparkles size={16} /> V79 Digital ecosystem
          </div>
          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
            One business.<br /><span className="text-cyan-300">One V79 experience.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            V79 Hub connects finance, service operations, marketing and business learning into one control centre while each specialist app protects its own data.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              [ShieldCheck,"Secure","Verified identity and Hub-managed access"],
              [Building2,"Unified","One organisation identity"],
              [Activity,"Actionable","Cross-app signals and next actions"],
            ].map(([Icon,itemTitle,detail]:any)=>(
              <div key={itemTitle} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <Icon className="mb-4 text-cyan-300" size={22}/>
                <div className="font-medium">{itemTitle}</div>
                <div className="mt-1 text-sm leading-5 text-slate-400">{detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-9">
          <div className="flex rounded-xl bg-slate-900/70 p-1">
            <button type="button" onClick={()=>{setMode("login");setError("");setMessage("");}} className={"flex-1 rounded-lg px-3 py-2 text-sm font-semibold " + (mode==="login"||mode==="forgot"||mode==="verify" ? "bg-white text-slate-950" : "text-slate-400")}>Sign in</button>
            <button type="button" disabled={planData?.selfServiceSignup===false} onClick={()=>{setMode("register");setError("");setMessage("");}} className={"flex-1 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40 " + (mode==="register" ? "bg-white text-slate-950" : "text-slate-400")}>Create account</button>
          </div>

          {planData?.signupConfigured===true && planData?.emailDeliveryConfigured===false && (
            <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-xs leading-5 text-amber-100">
              Public signup is waiting for verified transactional email delivery. Existing users can still sign in.
            </div>
          )}

          <div className="mt-7">
            <div className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">V79 Hub</div>
            <h2 className="mt-2 text-3xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{help}</p>
          </div>

          <form onSubmit={submit} className="mt-7">
            {mode==="register" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-200">Your name
                    <input autoComplete="name" required minLength={2} value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 outline-none ring-cyan-300 focus:ring-2"/>
                  </label>
                  <label className="block text-sm font-medium text-slate-200">Business name
                    <input autoComplete="organization" required minLength={2} value={organizationName} onChange={e=>setOrganizationName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 outline-none ring-cyan-300 focus:ring-2"/>
                  </label>
                </div>
                <div className="mt-5 grid gap-2">
                  {plans.map((item:any)=>(
                    <button key={item.id} type="button" onClick={()=>setPlan(item.id)} className={"rounded-2xl border p-4 text-left transition " + (plan===item.id ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-slate-900/40 hover:border-white/20")}>
                      <div className="flex items-center justify-between gap-4">
                        <div><div className="font-semibold">{item.name}</div><div className="mt-1 text-xs text-slate-400">{item.includedUsers} included users · {item.products.includes("marketing") ? "Marketing included" : "Finance + operations"}</div></div>
                        <div className="text-right"><div className="text-xl font-semibold">EC${item.monthlyXcd}</div><div className="text-[10px] text-slate-500">per month after trial</div></div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            <label className={(mode==="register" ? "mt-5 " : "") + "block text-sm font-medium text-slate-200"}>
              Email
              <input autoComplete="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"/>
            </label>

            {(mode==="login"||mode==="register") && (
              <label className="mt-5 block text-sm font-medium text-slate-200">
                Password
                <input autoComplete={mode==="login"?"current-password":"new-password"} type="password" required minLength={mode==="register"?16:1} value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"/>
                {mode==="register" && <span className="mt-1 block text-[11px] text-slate-500">Use at least 16 characters.</span>}
              </label>
            )}

            {error && <div role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
            {message && <div role="status" className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">{message}</div>}

            <button disabled={busy} className="mt-7 w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60">
              {busy ? "Working…" :
                mode==="login" ? "Sign in to V79 Hub" :
                mode==="register" ? "Create workspace & verify email" :
                mode==="forgot" ? "Send password reset" :
                "Resend verification email"}
            </button>

            {mode==="login" && (
              <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
                <button type="button" onClick={()=>{setMode("forgot");setError("");setMessage("");}} className="text-cyan-200 hover:text-cyan-100">Forgot password?</button>
                <button type="button" onClick={()=>{setMode("verify");setError("");setMessage("");}} className="text-slate-400 hover:text-slate-300">Resend verification</button>
              </div>
            )}
            {(mode==="forgot"||mode==="verify") && (
              <button type="button" onClick={()=>{setMode("login");setError("");setMessage("");}} className="mt-4 w-full text-center text-xs text-slate-400 hover:text-slate-300">Back to sign in</button>
            )}
            {mode==="register" && <p className="mt-4 text-center text-[11px] leading-5 text-slate-500">Your trial starts only after email verification. No payment is taken by this form.</p>}
          </form>
          <p className="mt-6 text-center text-xs text-slate-500">From Idea to Advantage</p>
        </section>
      </div>
    </main>
  );
}

function VerifyEmail({ token, onVerified }: { token:string; onVerified:(session:Session)=>void }) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function verify() {
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/auth/verify-email",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({token}),
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(body.error||"Email verification failed.");
      const url=new URL(window.location.href);
      url.searchParams.delete("verify");
      window.history.replaceState(null,"",url.pathname+url.search+url.hash);
      onVerified(body);
    } catch(err:any) {
      setError(err.message||"Email verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-slate-950 text-white">
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-12">
      <section className="w-full rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl">
        <div className="text-sm font-semibold uppercase tracking-[.18em] text-cyan-300">V79 Hub security</div>
        <h1 className="mt-2 text-3xl font-semibold">Confirm your email</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">Press the button below to verify this address and start the V79 trial. Opening this page alone does not activate the workspace.</p>
        {error && <div role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
        <button onClick={verify} disabled={busy} className="mt-6 w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy?"Verifying…":"Confirm email & activate workspace"}</button>
        <button onClick={()=>window.location.assign("/")} className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-300">Back to sign in</button>
      </section>
    </div>
  </main>;
}

function ResetPassword({ token }: { token:string }) {
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [done,setDone]=useState(false);

  async function submit(event:FormEvent) {
    event.preventDefault();
    setError("");
    if(password!==confirm) return setError("The passwords do not match.");
    setBusy(true);
    try {
      const response=await fetch("/api/auth/reset-password",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({token,newPassword:password}),
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(body.error||"Password reset failed.");
      setDone(true);
      const url=new URL(window.location.href);
      url.searchParams.delete("reset");
      window.history.replaceState(null,"",url.pathname+url.search+url.hash);
    } catch(err:any) {
      setError(err.message||"Password reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-slate-950 text-white">
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-12">
      <section className="w-full rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl">
        <div className="text-sm font-semibold uppercase tracking-[.18em] text-cyan-300">V79 Hub security</div>
        <h1 className="mt-2 text-3xl font-semibold">Choose a new password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Use at least 16 characters. Completing the reset signs out all existing Hub sessions for this account.</p>
        {error && <div role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
        {done ? <div className="mt-6"><div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">Password updated. You can now sign in with the new password.</div><button onClick={()=>window.location.assign("/")} className="mt-5 w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950">Return to sign in</button></div> :
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm text-slate-200">New password<input required type="password" minLength={16} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 outline-none ring-cyan-300 focus:ring-2"/></label>
          <label className="block text-sm text-slate-200">Confirm new password<input required type="password" minLength={16} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 outline-none ring-cyan-300 focus:ring-2"/></label>
          <button disabled={busy} className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy?"Updating…":"Update password"}</button>
        </form>}
      </section>
    </div>
  </main>;
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
    if (product === "marketing") return [
      ["Customers", formatNumber(metrics.customers)],
      ["Campaigns", formatNumber(metrics.activeCampaigns)],
      ["Scheduled", formatNumber(metrics.scheduledPosts)],
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
          result?.status === "ready" ? "bg-cyan-50 text-cyan-700" :
          result?.status === "unlinked" ? "bg-slate-100 text-slate-600" :
          result?.status === "restricted" ? "bg-slate-100 text-slate-500" :
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
        {result?.openUrl && result?.entitled !== false && result?.accessible !== false ? (
          <a href={result.openUrl} target={["ffpro","tiquet","marketing"].includes(product) ? "_self" : "_blank"} rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800 hover:text-cyan-700">
            Open <ArrowUpRight size={15} />
          </a>
        ) : result?.entitled === false ? <span className="text-xs font-semibold text-amber-700">Plan upgrade required</span>
          : result?.accessible === false ? <span className="text-xs font-semibold text-slate-500">Ask your Hub admin for access</span> : null}
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
        <div><h3 className="font-semibold text-slate-950">Hub security</h3><p className="text-xs text-slate-400">Change your Hub password and sign out your other Hub sessions.</p></div>
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
                    disabled={item.managedByHub}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none ring-cyan-300 focus:ring-2 disabled:cursor-not-allowed disabled:text-slate-400"
                  />
                </label>
                <div className="flex gap-2">
                  {!item.managedByHub && <button disabled={busy === item.product} onClick={() => save(item.product)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                    {busy === item.product ? "Saving…" : "Save"}
                  </button>}
                  {item.linked && !item.managedByHub && (
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

function InviteAccept({ token, onAccepted }: { token:string; onAccepted:(session:Session)=>void }) {
  const [invite,setInvite]=useState<any>(null);
  const [name,setName]=useState("");
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    fetch(`/api/team/invitations/${encodeURIComponent(token)}`)
      .then(async r=>{const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||"Invite unavailable.");return b;})
      .then(setInvite).catch((e:any)=>setMessage(e.message||"Invite unavailable."));
  },[token]);

  async function submit(e:FormEvent){
    e.preventDefault(); setMessage("");
    if(password!==confirm) return setMessage("The passwords do not match.");
    setBusy(true);
    try{
      const r=await fetch(`/api/team/invitations/${encodeURIComponent(token)}/accept`,{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,password}),
      });
      const b=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(b.error||"Could not accept the invitation.");
      window.history.replaceState(null,"","/");
      onAccepted(b);
    }catch(e:any){setMessage(e.message||"Could not accept the invitation.");}
    finally{setBusy(false);}
  }

  return <main className="min-h-screen bg-slate-950 text-white">
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-12">
      <section className="w-full rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl">
        <div className="text-sm font-semibold uppercase tracking-[.18em] text-cyan-300">V79 Hub invitation</div>
        <h1 className="mt-2 text-3xl font-semibold">Join {invite?.organizationName || "your V79 workspace"}</h1>
        {invite && <div className="mt-4 rounded-2xl bg-slate-900/70 p-4 text-sm text-slate-300">
          <div><span className="text-slate-500">Email:</span> {invite.email}</div>
          <div className="mt-1"><span className="text-slate-500">Role:</span> {invite.role}</div>
          <div className="mt-1"><span className="text-slate-500">Apps:</span> {(invite.products||[]).map((p:string)=>productMeta[p as "tiquet"|"marketing"]?.label||p).join(", ") || "Hub only"}</div>
        </div>}
        {message && <div role="alert" className="mt-4 rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{message}</div>}
        {invite && <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm text-slate-200">Your name<input required minLength={2} value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 outline-none ring-cyan-300 focus:ring-2"/></label>
          <label className="block text-sm text-slate-200">Create Hub password<input required type="password" minLength={16} value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 outline-none ring-cyan-300 focus:ring-2"/></label>
          <label className="block text-sm text-slate-200">Confirm password<input required type="password" minLength={16} value={confirm} onChange={e=>setConfirm(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 outline-none ring-cyan-300 focus:ring-2"/></label>
          <button disabled={busy} className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy?"Joining…":"Join V79 workspace"}</button>
        </form>}
      </section>
    </div>
  </main>;
}

function TeamAccess({ session }: { session:Session }) {
  const [team,setTeam]=useState<TeamPayload|null>(null);
  const [email,setEmail]=useState("");
  const [role,setRole]=useState<"admin"|"member">("member");
  const [products,setProducts]=useState<string[]>(["tiquet"]);
  const [message,setMessage]=useState("");
  const [inviteUrl,setInviteUrl]=useState("");
  const [busy,setBusy]=useState("");

  const load=useCallback(async()=>{
    const r=await fetch("/api/team");
    const b=await r.json().catch(()=>({}));
    if(!r.ok){setMessage(b.error||"Could not load team access.");return;}
    setTeam(b);
  },[]);
  useEffect(()=>{load();},[load]);

  function toggleProduct(product:string){
    setProducts(old=>old.includes(product)?old.filter(v=>v!==product):[...old,product]);
  }
  async function invite(e:FormEvent){
    e.preventDefault();setBusy("invite");setMessage("");setInviteUrl("");
    try{
      const r=await fetch("/api/team/invitations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,role,products})});
      const b=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(b.error||"Could not create invitation.");
      setInviteUrl(b.inviteUrl);setEmail("");
      setMessage(b.emailDelivery?.sent
        ? "Invitation created and emailed. The secure link is also available below."
        : team?.emailDeliveryConfigured
          ? "Invitation created, but email delivery failed. Share the secure link below."
          : "Invitation created. Transactional email is not configured, so share the secure link below.");
      await load();
    }catch(e:any){setMessage(e.message||"Could not create invitation.");}
    finally{setBusy("");}
  }
  async function revoke(id:string){
    setBusy(id);setMessage("");
    try{const r=await fetch(`/api/team/invitations/${id}`,{method:"DELETE"});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||"Could not revoke invite.");await load();}
    catch(e:any){setMessage(e.message||"Could not revoke invite.");}finally{setBusy("");}
  }
  async function saveMember(member:TeamMember,nextRole:string,nextProducts:string[]){
    setBusy(member.id);setMessage("");
    try{const r=await fetch(`/api/team/members/${member.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({role:nextRole,products:nextProducts})});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||"Could not update team member.");await load();}
    catch(e:any){setMessage(e.message||"Could not update team member.");}finally{setBusy("");}
  }
  async function removeMember(member:TeamMember){
    setBusy(member.id);setMessage("");
    try{const r=await fetch(`/api/team/members/${member.id}`,{method:"DELETE"});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||"Could not remove team member.");await load();}
    catch(e:any){setMessage(e.message||"Could not remove team member.");}finally{setBusy("");}
  }

  if(!team) return <div className="grid min-h-56 place-items-center"><RefreshCw className="animate-spin text-slate-400"/></div>;
  const seats=team.seats;
  return <section>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="text-2xl font-semibold tracking-tight">Team & app access</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Your plan includes {seats.limit} Hub users. Pending invitations reserve a seat. FFPRO finance stays restricted to the organisation owner.</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-right"><div className="text-2xl font-semibold">{seats.used}/{seats.limit}</div><div className="text-xs text-slate-400">Seats used or reserved</div></div>
    </div>
    {message && <div role="status" className="mb-5 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">{message}</div>}
    {inviteUrl && <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="text-sm font-semibold text-emerald-900">Secure invitation link</div><div className="mt-2 break-all text-xs text-emerald-800">{inviteUrl}</div><button type="button" onClick={()=>navigator.clipboard?.writeText(inviteUrl)} className="mt-3 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white">Copy invite link</button></div>}

    <form onSubmit={invite} className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-slate-950 p-2.5 text-cyan-300"><Users size={20}/></div><div><h3 className="font-semibold">Invite a team member</h3><p className="text-xs text-slate-400">The invitation is locked to the email address and expires in seven days.</p></div></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_.7fr_1fr_auto] lg:items-end">
        <label className="text-sm font-medium text-slate-700">Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none ring-cyan-300 focus:ring-2"/></label>
        <label className="text-sm font-medium text-slate-700">Role<select value={role} onChange={e=>setRole(e.target.value as any)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">{session.organization.role==="owner"&&<option value="admin">Admin</option>}<option value="member">Member</option></select></label>
        <div><div className="text-sm font-medium text-slate-700">App access</div><div className="mt-2 flex flex-wrap gap-2">{team.assignableProducts.map(product=><label key={product} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" checked={products.includes(product)} onChange={()=>toggleProduct(product)}/>{productMeta[product as "tiquet"|"marketing"].label}</label>)}</div></div>
        <button disabled={busy==="invite"||seats.used>=seats.limit} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy==="invite"?"Creating…":"Create invite"}</button>
      </div>
    </form>

    <div className="mt-6 space-y-3">
      {team.members.map(member=><div key={member.id}><MemberAccessRow member={member} team={team} currentUserId={session.user.id} owner={session.organization.role==="owner"} busy={busy===member.id} onSave={saveMember} onRemove={removeMember}/></div>)}
    </div>
    {team.invitations.length>0&&<div className="mt-8"><h3 className="font-semibold">Pending invitations</h3><div className="mt-3 space-y-2">{team.invitations.map(inv=><div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4"><div><div className="font-medium">{inv.email}</div><div className="text-xs text-slate-400">{inv.role} · {inv.products.join(", ")||"Hub only"} · expires {new Date(inv.expiresAt).toLocaleDateString()}</div></div><button disabled={busy===inv.id} onClick={()=>revoke(inv.id)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Revoke</button></div>)}</div></div>}
  </section>;
}

function MemberAccessRow({member,team,currentUserId,owner,busy,onSave,onRemove}:{member:TeamMember;team:TeamPayload;currentUserId:string;owner:boolean;busy:boolean;onSave:(m:TeamMember,r:string,p:string[])=>Promise<void>;onRemove:(m:TeamMember)=>Promise<void>}) {
  const [role,setRole]=useState(member.role);
  const [products,setProducts]=useState<string[]>(member.products);
  useEffect(()=>{setRole(member.role);setProducts(member.products);},[member.role,member.products.join("|")]);
  if(member.role==="owner") return <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><div><div className="font-semibold">{member.name} <span className="ml-2 rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-semibold uppercase text-cyan-700">Owner</span></div><div className="mt-1 text-sm text-slate-500">{member.email}</div></div><div className="text-xs text-slate-400">All subscribed apps · FFPRO finance owner</div></div></div>;
  const toggle=(p:string)=>setProducts(old=>old.includes(p)?old.filter(v=>v!==p):[...old,p]);
  return <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <div className="grid gap-4 lg:grid-cols-[1.2fr_.55fr_1.2fr_auto] lg:items-center">
      <div><div className="font-semibold">{member.name}</div><div className="mt-1 text-sm text-slate-500">{member.email}</div></div>
      <select value={role} disabled={!owner&&member.role==="admin"} onChange={e=>setRole(e.target.value as any)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{owner&&<option value="admin">Admin</option>}<option value="member">Member</option></select>
      <div className="flex flex-wrap gap-2">{team.assignableProducts.map(p=><label key={p} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs"><input type="checkbox" checked={products.includes(p)} onChange={()=>toggle(p)}/>{productMeta[p as "tiquet"|"marketing"].label}</label>)}</div>
      <div className="flex gap-2"><button disabled={busy} onClick={()=>onSave(member,role,products)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Save</button>{member.id!==currentUserId&&<button disabled={busy} onClick={()=>onRemove(member)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-40">Remove</button>}</div>
    </div>
  </div>;
}

function Billing() {
  const [data,setData]=useState<BillingPayload|null>(null);
  const [cycle,setCycle]=useState<"monthly"|"annual">("monthly");
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");

  const load=useCallback(async()=>{
    const response=await fetch("/api/billing");
    const body=await response.json().catch(()=>({}));
    if(!response.ok){setMessage(body.error||"Could not load billing.");return;}
    setData(body);
  },[]);
  useEffect(()=>{load();},[load]);

  async function checkout(plan:string){
    setBusy(plan);setMessage("");
    try{
      const response=await fetch("/api/billing/checkout",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({plan,billingCycle:cycle}),
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(body.error||"Could not create a secure checkout.");
      if(!body.checkoutUrl) throw new Error("The payment gateway did not return a checkout page.");
      window.location.assign(body.checkoutUrl);
    }catch(error:any){
      setMessage(error.message||"Could not create a secure checkout.");
      setBusy("");
      await load();
    }
  }

  if(!data) return <div className="grid min-h-56 place-items-center"><RefreshCw className="animate-spin text-slate-400"/></div>;
  const current=data.subscription;
  const paidPeriodActive=current?.status==="active" && current.currentPeriodEnd && new Date(current.currentPeriodEnd).getTime()>Date.now();

  return <section>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Subscription & payments</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">V79 Billing</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Choose the V79 plan that fits the business. Checkout is hosted by the configured payment provider; V79 Hub does not collect or store card numbers.</p>
      </div>
      <div className="flex rounded-xl bg-slate-100 p-1">
        <button onClick={()=>setCycle("monthly")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${cycle==="monthly"?"bg-white shadow-sm":"text-slate-500"}`}>Monthly</button>
        <button onClick={()=>setCycle("annual")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${cycle==="annual"?"bg-white shadow-sm":"text-slate-500"}`}>Annual</button>
      </div>
    </div>

    {message && <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>}

    <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-50 p-2.5 text-cyan-700"><CircleDollarSign size={20}/></div><div><h3 className="font-semibold">Current access</h3><p className="text-xs text-slate-400">Subscription and team-seat status</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs uppercase tracking-wide text-slate-400">Plan</div><div className="mt-1 text-lg font-semibold capitalize">{current?.plan||"—"}</div></div>
          <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs uppercase tracking-wide text-slate-400">Status</div><div className="mt-1 text-lg font-semibold capitalize">{current?.status?.replace("_"," ")||"—"}</div></div>
          <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs uppercase tracking-wide text-slate-400">Seats</div><div className="mt-1 text-lg font-semibold">{data.seats.used}/{data.seats.limit}</div></div>
        </div>
        <div className="mt-4 text-sm text-slate-500">
          {current?.status==="trialing" && current.trialEndsAt ? <>Trial ends {new Date(current.trialEndsAt).toLocaleDateString()}.</> :
           current?.currentPeriodEnd ? <>Paid access through {new Date(current.currentPeriodEnd).toLocaleDateString()}.</> :
           <>No fixed paid renewal date is recorded.</>}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3"><ShieldCheck className="text-cyan-700" size={21}/><div><h3 className="font-semibold">Payment gateway</h3><p className="text-xs text-slate-400">Hosted checkout; no card storage in V79</p></div></div>
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 p-4">
          <div><div className="font-semibold">{data.provider.name}</div><div className="mt-1 text-xs text-slate-400">{data.provider.configured ? `${data.provider.environment} · ${data.provider.currency} · ${data.provider.countryCode}` : "Merchant gateway configuration required"}</div></div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${data.provider.configured?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-700"}`}>{data.provider.configured?"Ready":"Disabled"}</span>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">{data.provider.configured ? "When you continue, you leave V79 for the provider's secure hosted payment page. V79 verifies the provider transaction before activating access." : "Online payment is intentionally disabled until a verified merchant account, API key, Saint Lucia endpoint, country code and XCD configuration are supplied."}</p>
      </div>
    </div>

    <div className="mt-6 grid gap-5 lg:grid-cols-3">
      {data.plans.map(plan=>{
        const amount=cycle==="annual"?plan.annualXcd:plan.monthlyXcd;
        const seatConflict=data.seats.used>plan.includedUsers;
        const midPeriodChange=Boolean(paidPeriodActive && current?.plan!==plan.id);
        const disabled=!data.provider.configured || seatConflict || midPeriodChange || Boolean(busy);
        const currentPlan=current?.plan===plan.id;
        return <article key={plan.id} className={`rounded-3xl border bg-white p-6 ${currentPlan?"border-cyan-300 ring-2 ring-cyan-100":"border-slate-200"}`}>
          <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-[.16em] text-cyan-700">{plan.name}</div><div className="mt-3 text-3xl font-semibold">EC${amount.toLocaleString()}</div><div className="text-xs text-slate-400">{cycle==="annual"?"per year":"per month"}</div></div>{currentPlan&&<span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold uppercase text-cyan-700">Current</span>}</div>
          <div className="mt-5 space-y-2 text-sm text-slate-600"><div className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 text-emerald-600"/><span>{plan.includedUsers} Hub users</span></div>{plan.products.map(product=><div key={product} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 text-emerald-600"/><span>{productMeta[product as "ffpro"|"tiquet"|"marketing"].label}</span></div>)}</div>
          {cycle==="annual"&&<div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Annual price saves EC${(plan.monthlyXcd*12-plan.annualXcd).toLocaleString()} versus 12 monthly payments.</div>}
          {seatConflict&&<div className="mt-4 text-xs font-medium text-rose-700">Reduce used/reserved seats to {plan.includedUsers} before selecting this plan.</div>}
          {midPeriodChange&&<div className="mt-4 text-xs font-medium text-amber-700">Mid-period plan changes are handled by V79 support in this release.</div>}
          <button disabled={disabled} onClick={()=>checkout(plan.id)} className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">{busy===plan.id?"Opening secure checkout…":!data.provider.configured?"Payment setup pending":currentPlan&&current?.status==="active"?"Renew plan":"Pay & activate"}</button>
        </article>;
      })}
    </div>

    <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6">
      <h3 className="font-semibold">Payment history</h3>
      <p className="mt-1 text-xs text-slate-400">V79 stores order status and provider transaction references, never full card details.</p>
      {data.orders.length===0 ? <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">No billing orders yet.</div> :
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400"><th className="py-3 pr-4">Date</th><th className="py-3 pr-4">Plan</th><th className="py-3 pr-4">Cycle</th><th className="py-3 pr-4">Amount</th><th className="py-3 pr-4">Status</th><th className="py-3">Provider ref</th></tr></thead><tbody>{data.orders.map(order=><tr key={order.id} className="border-b border-slate-100"><td className="py-3 pr-4">{new Date(order.createdAt).toLocaleDateString()}</td><td className="py-3 pr-4 capitalize">{order.plan}</td><td className="py-3 pr-4 capitalize">{order.billingCycle}</td><td className="py-3 pr-4">EC${order.amountXcd.toLocaleString()}</td><td className="py-3 pr-4 capitalize">{order.status.replace("_"," ")}</td><td className="py-3 font-mono text-xs text-slate-500">{order.providerTransactionId||"—"}</td></tr>)}</tbody></table></div>}
    </div>
  </section>;
}

function eventTitle(type: string) {
  const labels: Record<string,string> = {
    "lead.created": "New website lead",
    "customer.created": "Customer added",
    "job.created": "New job created",
    "job.status_changed": "Job status changed",
    "job.paid": "Job marked paid",
    "course.enrolled": "Course enrolment",
    "certificate.issued": "Certificate issued",
    "finance.snapshot.updated": "Financial snapshot updated",
    "marketing.post_scheduled": "Marketing post scheduled",
    "marketing.lead_created": "Marketing lead captured",
    "marketing.customer_status_changed": "Marketing customer stage changed",
  };
  return labels[type] || type.split(/[._-]/).map(word => word ? word[0].toUpperCase()+word.slice(1) : "").join(" ");
}

function eventDescription(event: DashboardPayload["events"][number]) {
  const p:any = event.details?.payload || {};
  switch(event.type) {
    case "lead.created": return p.interest ? `Interest: ${p.interest}` : "A new prospect entered the V79 pipeline.";
    case "customer.created": return p.company ? `${p.company} became a customer.` : "A customer record was created.";
    case "job.created": return p.title ? `Job: ${p.title}` : "A service job was created.";
    case "job.status_changed": return p.status ? `Moved to ${p.status}.` : "The job moved to a new stage.";
    case "job.paid": return p.amount != null ? `Payment recorded for ${formatNumber(p.amount)} ${p.currency || ""}`.trim() : "A job was marked paid.";
    case "course.enrolled": return p.courseTitle ? `Enrolled in ${p.courseTitle}.` : "A learner enrolled in a course.";
    case "certificate.issued": return p.courseTitle ? `Completed ${p.courseTitle}.` : "A learner earned a certificate.";
    case "finance.snapshot.updated": return "FFPRO financial indicators were refreshed.";
    case "marketing.post_scheduled": return p.scheduledFor ? `Content scheduled for ${new Date(p.scheduledFor).toLocaleString()}.` : "Marketing content was scheduled.";
    case "marketing.lead_created": return p.channel ? `New enquiry captured through ${p.channel}.` : "A new marketing enquiry was captured.";
    case "marketing.customer_status_changed": return p.to ? `Customer moved to ${p.to}.` : "A marketing customer stage changed.";
    default: return "Activity recorded across the V79 ecosystem.";
  }
}

function ActionCentre({ dashboard }: { dashboard: DashboardPayload | null }) {
  const actions = useMemo(() => {
    if (!dashboard) return [] as Array<{ title:string; detail:string; product:Integration["product"]; priority:"attention"|"good"|"info" }>;
    const result: Array<{ title:string; detail:string; product:Integration["product"]; priority:"attention"|"good"|"info" }> = [];
    const ff:any = dashboard.products?.ffpro?.summary?.metrics || {};
    const tq:any = dashboard.products?.tiquet?.summary?.metrics || {};
    const mk:any = dashboard.products?.marketing?.summary?.metrics || {};
    const ac:any = dashboard.products?.academy?.summary?.metrics || {};

    if (dashboard.products?.ffpro?.status === "connected" && Number.isFinite(Number(ff.currentMonthNet))) {
      if (Number(ff.currentMonthNet) < 0) result.push({title:"Review this month's cash position",detail:"FFPRO shows expenses above income for the current month. Review the drivers before committing new spend.",product:"ffpro",priority:"attention"});
      else result.push({title:"Cash position is positive",detail:"Current-month FFPRO net is positive. Check the forecast before deciding how much is available to reinvest.",product:"ffpro",priority:"good"});
    }
    if (dashboard.products?.tiquet?.status === "connected") {
      const openJobs = Object.entries(tq.jobsByStatus || {}).filter(([status]) => !["paid","completed","closed"].includes(String(status).toLowerCase())).reduce((sum,[,value])=>sum+Number(value||0),0);
      if (openJobs > 0) result.push({title:`${openJobs} service job${openJobs===1?"":"s"} need progression`,detail:"Use Tiquet to check stalled work, customer follow-ups and the next operational action.",product:"tiquet",priority:"info"});
    }
    if (dashboard.products?.marketing?.status === "connected") {
      if (Number(mk.activeCampaigns || 0) === 0) result.push({title:"No active marketing campaign",detail:"Create a focused campaign in V79 Marketing so growth activity is deliberate rather than occasional.",product:"marketing",priority:"attention"});
      else if (Number(mk.scheduledPosts || 0) === 0) result.push({title:"Campaign active, but nothing is scheduled",detail:"Your campaign exists but there is no scheduled content. Build the next publishing queue.",product:"marketing",priority:"attention"});
      else result.push({title:"Marketing activity is planned",detail:`${formatNumber(mk.activeCampaigns)} active campaign(s) and ${formatNumber(mk.scheduledPosts)} scheduled post(s) are visible.`,product:"marketing",priority:"good"});
    }
    if (dashboard.products?.academy?.status === "connected" && Number(ac.enrolledCourses || 0) > 0 && Number(ac.certificates || 0) === 0) {
      result.push({title:"Training is in progress",detail:"Academy enrolment is active but no certificate is recorded yet. Continue the learning plan.",product:"academy",priority:"info"});
    }
    return result.slice(0,6);
  }, [dashboard]);

  if (!actions.length) return null;
  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-cyan-50 p-2.5 text-cyan-700"><Lightbulb size={20}/></div>
          <div><h2 className="font-semibold text-slate-950">Action centre</h2><p className="text-sm text-slate-500">Cross-app signals translated into practical next actions.</p></div>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {actions.map((action,index) => {
          const Icon = action.priority === "attention" ? AlertTriangle : action.priority === "good" ? CheckCircle2 : Activity;
          const openUrl = dashboard?.products?.[action.product]?.openUrl;
          return (
            <div key={index} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <Icon size={18} className={action.priority === "attention" ? "mt-0.5 text-amber-600" : action.priority === "good" ? "mt-0.5 text-emerald-600" : "mt-0.5 text-cyan-700"}/>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900">{action.title}</div>
                  <p className="mt-1 text-sm leading-5 text-slate-500">{action.detail}</p>
                  {openUrl && dashboard?.products?.[action.product]?.entitled !== false && <a href={openUrl} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-800">Open {productMeta[action.product].label}<ArrowUpRight size={13}/></a>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BusinessTimeline({ events }: { events: DashboardPayload["events"] }) {
  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-slate-950 p-2.5 text-cyan-300"><Activity size={20}/></div>
        <div>
          <h2 className="font-semibold text-slate-950">Business timeline</h2>
          <p className="text-sm text-slate-500">Important activity from across your connected V79 products.</p>
        </div>
      </div>
      <div className="mt-6">
        {events.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
            Connected product events will appear here as Phase 2 publishers come online.
          </div>
        ) : (
          <ol className="space-y-1">
            {events.map(event => (
              <li key={event.id} className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl px-2 py-4 hover:bg-slate-50">
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-500 ring-4 ring-cyan-50" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium text-slate-900">{eventTitle(event.type)}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{event.source}</span>
                    <time className="text-xs text-slate-400">{new Date(event.occurredAt).toLocaleString()}</time>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{eventDescription(event)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [view, setView] = useState<"overview" | "connections" | "team" | "billing">("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const returnTarget = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("return") : null;
  const inviteToken = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("invite") : null;
  const resetToken = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("reset") : null;
  const verifyToken = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("verify") : null;
  const billingResult = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("billing") : null;
  const managedReturnTarget = returnTarget && ["ffpro","tiquet","marketing"].includes(returnTarget) ? returnTarget as Integration["product"] : null;

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

  useEffect(() => {
    if (!session || !managedReturnTarget || !dashboard) return;
    window.history.replaceState(null, "", "/");
    const product = dashboard.products?.[managedReturnTarget];
    if (product?.entitled === false) {
      setNotice(`${productMeta[managedReturnTarget].label} is not included in your current V79 subscription.`);
      return;
    }
    if (product?.accessible === false) {
      setNotice(`${productMeta[managedReturnTarget].label} has not been assigned to your Hub account.`);
      return;
    }
    window.location.assign(`/api/apps/${managedReturnTarget}/launch`);
  }, [session, managedReturnTarget, dashboard]);

  useEffect(() => {
    if(!billingResult) return;
    const messages:Record<string,string>={
      success:"Payment verified. Your V79 subscription has been activated or renewed.",
      failed:"Payment was not completed. Your V79 access was not changed.",
      verification_failed:"The payment return could not be verified. No subscription change was made; contact V79 Digital if you were charged.",
    };
    setNotice(messages[billingResult] || "Billing status updated.");
    const url=new URL(window.location.href);
    url.searchParams.delete("billing");
    window.history.replaceState(null,"",url.pathname+url.search+url.hash);
    if(session) loadAll();
  },[billingResult,session,loadAll]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setSession(null); setDashboard(null); setIntegrations([]);
  }

  if (verifyToken) return <VerifyEmail token={verifyToken} onVerified={setSession} />;
  if (resetToken) return <ResetPassword token={resetToken} />;
  if (inviteToken) return <InviteAccept token={inviteToken} onAccepted={setSession} />;

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
            {["owner","admin"].includes(session.organization.role) && <button onClick={() => setView("connections")} className={`rounded-lg px-4 py-2 text-sm font-medium ${view === "connections" ? "bg-white shadow-sm" : "text-slate-500"}`}>Connections</button>}
            {["owner","admin"].includes(session.organization.role) && <button onClick={() => setView("team")} className={`rounded-lg px-4 py-2 text-sm font-medium ${view === "team" ? "bg-white shadow-sm" : "text-slate-500"}`}>Team</button>}
            {session.organization.role==="owner" && <button onClick={() => setView("billing")} className={`rounded-lg px-4 py-2 text-sm font-medium ${view === "billing" ? "bg-white shadow-sm" : "text-slate-500"}`}>Billing</button>}
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={loadAll} disabled={refreshing} aria-label="Refresh dashboard" className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50"><RefreshCw size={18} className={refreshing ? "animate-spin" : ""} /></button>
            <button onClick={logout} aria-label="Sign out" className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
        {notice && (
          <div role="status" className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <span>{notice}</span>
            <button onClick={() => setNotice("")} className="font-semibold text-amber-800">Dismiss</button>
          </div>
        )}
        <div className="mb-6 grid grid-cols-2 gap-2 sm:hidden">
          <button onClick={() => setView("overview")} className={`rounded-xl px-4 py-2 text-sm font-medium ${view === "overview" ? "bg-slate-950 text-white" : "bg-white"}`}>Overview</button>
          {["owner","admin"].includes(session.organization.role) && <button onClick={() => setView("connections")} className={`rounded-xl px-4 py-2 text-sm font-medium ${view === "connections" ? "bg-slate-950 text-white" : "bg-white"}`}>Connections</button>}
          {["owner","admin"].includes(session.organization.role) && <button onClick={() => setView("team")} className={`rounded-xl px-4 py-2 text-sm font-medium ${view === "team" ? "bg-slate-950 text-white" : "bg-white"}`}>Team</button>}
          {session.organization.role==="owner" && <button onClick={() => setView("billing")} className={`rounded-xl px-4 py-2 text-sm font-medium ${view === "billing" ? "bg-slate-950 text-white" : "bg-white"}`}>Billing</button>}
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
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4"><div className="text-2xl font-semibold">{connected}/4</div><div className="text-xs text-slate-400">Apps connected</div></div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4"><div className="text-2xl font-semibold capitalize">{dashboard?.subscription?.plan || "—"}</div><div className="text-xs text-slate-400">{dashboard?.subscription?.status === "trialing" && dashboard.subscription.trialEndsAt ? `Trial to ${new Date(dashboard.subscription.trialEndsAt).toLocaleDateString()}` : dashboard?.subscription?.status ? `${dashboard.subscription.status} plan` : "Subscription"}</div></div>
                </div>
              </div>
            </section>

            <section className="mt-8">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Your ecosystem</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Run the business from one starting point</h2></div>
                {["owner","admin"].includes(session.organization.role) && <button onClick={() => setView("connections")} className="hidden items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950 sm:flex"><Settings2 size={16} /> Manage connections</button>}
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {(["tiquet","ffpro","marketing","academy"] as const).map(product => <div key={product}><ProductCard product={product} result={dashboard?.products?.[product]} /></div>)}
              </div>
            </section>

            <ActionCentre dashboard={dashboard} />
            <BusinessTimeline events={dashboard?.events || []} />

            <section className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6">
                <div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-50 p-2.5 text-cyan-700"><Link2 size={20}/></div><div><h2 className="font-semibold">Connected by design</h2><p className="text-sm text-slate-500">Each app stays independent while the Hub provides the shared business context.</p></div></div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[["Website","Lead & acquisition"],["V79 Hub","Identity & visibility"],["V79 Apps","Specialist workflows"]].map(([title,text]) => <div key={title} className="rounded-2xl bg-slate-50 p-4"><div className="font-medium">{title}</div><div className="mt-1 text-xs text-slate-400">{text}</div></div>)}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6">
                <div className="flex items-center gap-3"><BookOpenCheck className="text-cyan-700" size={21}/><h2 className="font-semibold">What comes next</h2></div>
                <p className="mt-4 text-sm leading-6 text-slate-500">Hub now manages access to Tiquet, FFPRO and Marketing. Use Team to assign operational and marketing access while finance remains owner-only.</p>
              </div>
            </section>
          </>
        ) : view === "connections" ? (
          <Connections integrations={integrations} onChanged={async () => { await loadAll(); }} />
        ) : view === "team" ? (
          <TeamAccess session={session} />
        ) : (
          <Billing />
        )}
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-5 pb-8 pt-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <span>V79 Digital · secure business technology platform</span>
        <span className="inline-flex items-center gap-1"><ShieldCheck size={13}/> Hub-managed identity, entitlements and signed product connections</span>
      </footer>
    </div>
  );
}
