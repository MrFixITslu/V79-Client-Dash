import { Lock, KeyRound, ShieldCheck } from "lucide-react";
import { ViewState } from "../types";

export function WorkspaceSecurity({ onNavigate }: { onNavigate: (view: ViewState) => void }) {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <button onClick={() => onNavigate("overview")} className="text-sm font-semibold text-cyan-700">← Back to Hub</button>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Security and access</h1>
        <p className="mt-2 text-sm text-slate-600">Hub access is controlled by your account and role. Contact an administrator to change access.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5"><Lock className="mb-3 text-cyan-700" /><h2 className="font-semibold">Hub session</h2><p className="mt-2 text-sm text-slate-600">Your browser uses an HttpOnly session cookie. Sign out on shared devices.</p></div>
        <div className="rounded-2xl border bg-white p-5"><ShieldCheck className="mb-3 text-cyan-700" /><h2 className="font-semibold">Team permissions</h2><p className="mt-2 text-sm text-slate-600">Administrators manage accounts. Finance records are restricted to administrators.</p></div>
        <div className="rounded-2xl border bg-white p-5"><KeyRound className="mb-3 text-cyan-700" /><h2 className="font-semibold">POS launch</h2><p className="mt-2 text-sm text-slate-600">The owner launches POS with a short-lived, single-use ticket. The token stays on the server.</p></div>
      </div>
      <p className="text-sm text-slate-500">An audit event viewer and key rotation controls are not available in this Hub version. Server operators should review deployment logs and back up the signing key in the data volume.</p>
    </div>
  );
}
