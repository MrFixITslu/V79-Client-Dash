import { CreditCard } from "lucide-react";
import { ViewState } from "../types";

export function WorkspaceBilling({ onNavigate }: { onNavigate: (view: ViewState) => void }) {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <button onClick={() => onNavigate("overview")} className="text-sm font-semibold text-cyan-700">← Back to Hub</button>
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        <CreditCard className="mb-4 text-cyan-700" />
        <h1 className="text-2xl font-bold text-slate-900">Billing is not configured</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">This Hub version does not track subscriptions, invoices or payments. The connected app links are available for beta testing according to each app's own access rules. No charge or paid entitlement is represented here.</p>
      </div>
    </div>
  );
}
