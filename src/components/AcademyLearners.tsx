import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, KeyRound, Search, ShieldCheck, UserRoundCheck, Users } from "lucide-react";
import { academyAdminApi } from "../lib/academyAdmin";

interface Learner {
  id: string;
  email: string;
  name: string;
  membershipStatus: "active" | "inactive";
  membershipExpiresAt?: string | null;
  enrolledCourseIds: string[];
}

export function AcademyLearners() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [query, setQuery] = useState("");
  const [expiry, setExpiry] = useState<Record<string, string>>({});
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const flash = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage(null), 5000);
  };

  const refresh = async () => {
    try {
      setLearners(await academyAdminApi<Learner[]>("/learners"));
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not load learners.", "error");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const membership = async (learner: Learner, status: "active" | "inactive") => {
    setBusy(learner.id);
    try {
      const selected = expiry[learner.id];
      const body = status === "active"
        ? { status, expiresAt: selected ? new Date(`${selected}T23:59:59`).toISOString() : undefined }
        : { status };
      const updated = await academyAdminApi<Learner>(`/learners/${learner.id}/membership`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setLearners((current) => current.map((row) => row.id === updated.id ? updated : row));
      flash(status === "active" ? "Membership granted or extended." : "Membership revoked.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Membership could not be updated.", "error");
    } finally {
      setBusy("");
    }
  };

  const reset = async (learner: Learner) => {
    if (resetPassword.length < 12) return flash("Use at least 12 characters for the temporary password.", "error");
    setBusy(learner.id);
    try {
      await academyAdminApi(`/learners/${learner.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: resetPassword }),
      });
      setResetFor(null);
      setResetPassword("");
      flash("Learner password reset and existing Academy sessions ended.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Password reset failed.", "error");
    } finally {
      setBusy("");
    }
  };

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return learners.filter((learner) => !term || `${learner.name} ${learner.email}`.toLowerCase().includes(term));
  }, [learners, query]);

  const active = learners.filter((learner) => learner.membershipStatus === "active").length;
  const enrolments = learners.reduce((sum, learner) => sum + learner.enrolledCourseIds.length, 0);

  return (
    <div className="space-y-5">
      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${message.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat icon={Users} label="Registered learners" value={learners.length} />
        <Stat icon={UserRoundCheck} label="Active memberships" value={active} />
        <Stat icon={ShieldCheck} label="Course enrolments" value={enrolments} />
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold text-indigo-950">Membership control</h3>
          <p className="text-xs text-indigo-800 mt-1">
            Online subscription checkout is not enabled yet. Hub Admin can grant or revoke time-limited Academy membership without seeing learner passwords or course progress details.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <label className="relative block max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="admin-input pl-9" placeholder="Search learners by name or email" />
          </label>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.map((learner) => (
            <div key={learner.id} className="p-4 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-slate-900">{learner.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{learner.email}</div>
                  <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-slate-500">
                    <span>{learner.enrolledCourseIds.length} enrolment(s)</span>
                    <span className={learner.membershipStatus === "active" ? "text-emerald-700" : "text-slate-500"}>
                      {learner.membershipStatus === "active"
                        ? `Active until ${learner.membershipExpiresAt ? new Date(learner.membershipExpiresAt).toLocaleDateString() : "—"}`
                        : "No active membership"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <label className="space-y-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Expiry</span>
                    <div className="relative">
                      <CalendarDays className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input type="date" value={expiry[learner.id] || ""} onChange={(e) => setExpiry({ ...expiry, [learner.id]: e.target.value })} className="admin-input pl-8 w-[155px]" />
                    </div>
                  </label>
                  <button disabled={busy === learner.id || !expiry[learner.id]} onClick={() => void membership(learner, "active")} className="px-3 py-2 rounded-lg bg-slate-950 text-white text-xs font-semibold disabled:opacity-40">Grant / extend</button>
                  <button disabled={busy === learner.id} onClick={() => void membership(learner, "inactive")} className="px-3 py-2 rounded-lg border border-rose-200 text-rose-700 text-xs font-semibold disabled:opacity-40">Revoke</button>
                  <button onClick={() => { setResetFor(resetFor === learner.id ? null : learner.id); setResetPassword(""); }} className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" /> Reset password
                  </button>
                </div>
              </div>

              {resetFor === learner.id && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row gap-2 sm:items-end">
                  <label className="flex-1 space-y-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Temporary password</span>
                    <input type="password" autoComplete="new-password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className="admin-input" placeholder="12–256 characters" />
                  </label>
                  <button disabled={busy === learner.id || resetPassword.length < 12} onClick={() => void reset(learner)} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold disabled:opacity-40">Apply reset</button>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div className="p-10 text-center text-sm text-slate-400">No learners found.</div>}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-slate-950 flex items-center justify-center"><Icon className="w-4 h-4 text-cyan-400" /></div>
      <div><div className="text-lg font-extrabold text-slate-900">{value}</div><div className="text-[10px] text-slate-500">{label}</div></div>
    </div>
  );
}
