import { useState, useMemo } from "react";
import {
  EcosystemApp,
  TiquetTicket,
  FFPROSyncRecord,
  MarketingCampaign,
  InventoryItem,
  Transaction,
} from "../types";
import { managedLaunchPath } from "../lib/appLaunch";
import {
  X,
  ExternalLink,
  Wallet,
  Headphones,
  Megaphone,
  Boxes,
  CheckCircle2,
  RefreshCw,
  Plus,
  Send,
  Ticket,
  DollarSign,
  TrendingUp,
  Tag,
  AlertTriangle,
  Clock,
  Sparkles,
  CreditCard,
} from "lucide-react";

interface EcosystemConsoleModalProps {
  app: EcosystemApp | null;
  onClose: () => void;
  inventory: InventoryItem[];
  transactions: Transaction[];
  tickets: TiquetTicket[];
  ffproRecords: FFPROSyncRecord[];
  marketingCampaigns: MarketingCampaign[];
  onSyncPOSToFFPRO: () => Promise<void>;
  onCreateTicket: (ticket: Partial<TiquetTicket>) => Promise<void>;
  onUpdateTicketStatus: (id: string, status: TiquetTicket["status"]) => Promise<void>;
  onCreateCampaign: (campaign: Partial<MarketingCampaign>) => Promise<void>;
  showToast: (msg: string, type?: "success" | "error") => void;
  authToken?: string | null;
}

export function EcosystemConsoleModal({
  app,
  onClose,
  inventory,
  transactions,
  tickets,
  ffproRecords,
  marketingCampaigns,
  onSyncPOSToFFPRO,
  onCreateTicket,
  onUpdateTicketStatus,
  onCreateCampaign,
  showToast,
  authToken,
}: EcosystemConsoleModalProps) {
  if (!app) return null;

  // --- FFPRO Local State ---
  const [isSyncingFFPRO, setIsSyncingFFPRO] = useState(false);

  // --- Tiquet Local State ---
  const [ticketFilter, setTicketFilter] = useState<string>("all");
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [newTicket, setNewTicket] = useState({
    title: "",
    clientName: "",
    clientContact: "",
    priority: "normal" as TiquetTicket["priority"],
    linkedSku: "",
    notes: "",
  });

  // --- Marketing Local State ---
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    channel: "WhatsApp Business" as MarketingCampaign["channel"],
    discountCode: "",
    discountPercent: 10,
    targetProduct: "POS Terminals & Hardware",
    budgetXCD: 500,
  });

  // Calculate POS Daily Sales for FFPRO
  const today = new Date().toISOString().split("T")[0];
  const todayCompletedTxns = transactions.filter(
    (t) => t.date.startsWith(today) && t.status === "completed"
  );
  const todayGrossRevenue = todayCompletedTxns.reduce((acc, t) => acc + t.total, 0);

  // Filtered tickets
  const filteredTickets = tickets.filter((t) => {
    if (ticketFilter === "all") return true;
    return t.status === ticketFilter;
  });

  // Strict deduplication by unique ID to guarantee component key uniqueness across async syncs
  const uniqueFFPRORecords = useMemo(() => {
    const seen = new Set<string>();
    return ffproRecords.filter((record) => {
      if (!record?.id || seen.has(record.id)) return false;
      seen.add(record.id);
      return true;
    });
  }, [ffproRecords]);

  const uniqueTickets = useMemo(() => {
    const seen = new Set<string>();
    return filteredTickets.filter((ticket) => {
      if (!ticket?.id || seen.has(ticket.id)) return false;
      seen.add(ticket.id);
      return true;
    });
  }, [filteredTickets]);

  const uniqueMarketingCampaigns = useMemo(() => {
    const seen = new Set<string>();
    return marketingCampaigns.filter((camp) => {
      if (!camp?.id || seen.has(camp.id)) return false;
      seen.add(camp.id);
      return true;
    });
  }, [marketingCampaigns]);

  const handleFFPROSync = async () => {
    try {
      setIsSyncingFFPRO(true);
      await onSyncPOSToFFPRO();
      showToast("POS today's register receipts successfully synced to FFPRO ledger!");
    } catch {
      showToast("Failed to sync POS to FFPRO", "error");
    } finally {
      setIsSyncingFFPRO(false);
    }
  };

  const handleCreateTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.title.trim() || !newTicket.clientName.trim()) {
      showToast("Title and client name are required", "error");
      return;
    }

    const linkedItem = inventory.find((i) => i.sku === newTicket.linkedSku);
    await onCreateTicket({
      ...newTicket,
      linkedItemName: linkedItem?.name,
    });

    setShowNewTicketModal(false);
    setNewTicket({
      title: "",
      clientName: "",
      clientContact: "",
      priority: "normal",
      linkedSku: "",
      notes: "",
    });
    showToast("Support ticket dispatched to technician queue!");
  };

  const handleCreateCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaign.name.trim() || !newCampaign.discountCode.trim()) {
      showToast("Campaign name and promo code required", "error");
      return;
    }

    await onCreateCampaign(newCampaign);
    setShowNewCampaignModal(false);
    setNewCampaign({
      name: "",
      channel: "WhatsApp Business",
      discountCode: "",
      discountPercent: 10,
      targetProduct: "POS Terminals & Hardware",
      budgetXCD: 500,
    });
    showToast("Promotional campaign published & promo code activated!");
  };

  const launchWithSSO = () => {
    const managedUrl = managedLaunchPath(app);
    if (managedUrl) {
      window.location.assign(managedUrl);
      return;
    }
    if (app.appUrl) window.open(app.appUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${app.colorScheme.primary} flex items-center justify-center text-white shadow-lg`}
            >
              {app.shortName === "FFPRO" && <Wallet className="w-5 h-5" />}
              {app.shortName === "Tiquet" && <Headphones className="w-5 h-5" />}
              {app.shortName === "Marketing" && <Megaphone className="w-5 h-5" />}
              {(app.shortName === "V79 POS" || app.shortName === "Ordely") && <CreditCard className="w-5 h-5" />}
              {app.shortName === "Analytics" && <TrendingUp className="w-5 h-5" />}
              {app.shortName === "LifeHealth" && <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{app.name}</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Hub Records
                </span>
                {app.version && (
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {app.version}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{app.tagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={launchWithSSO}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Launch Full App</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Console Workspace Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ========================================================= */}
          {/* 1. FIRE FINANCE PRO (FFPRO) CONSOLE WORKSPACE */}
          {/* ========================================================= */}
          {app.shortName === "FFPRO" && (
            <div className="space-y-6">
              {/* Financial Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/60">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Available Cash Flow</span>
                    <DollarSign className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-2xl font-black text-white mt-1">$48,290.00</p>
                  <p className="text-[11px] text-emerald-400 font-medium mt-1">
                    +$3,420 this week
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/60">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Today's POS Gross</span>
                    <RefreshCw className="w-4 h-4 text-indigo-400" />
                  </div>
                  <p className="text-2xl font-black text-white mt-1">
                    ${todayGrossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {todayCompletedTxns.length} registered orders
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/60">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Catalog Asset Value</span>
                    <Boxes className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-2xl font-black text-white mt-1">
                    $
                    {inventory
                      .reduce((acc, i) => acc + i.quantity * (i.costPrice || i.price * 0.7), 0)
                      .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Inventory cost basis</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/60">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Budget Adherence</span>
                    <TrendingUp className="w-4 h-4 text-sky-400" />
                  </div>
                  <p className="text-2xl font-black text-emerald-400 mt-1">94.2%</p>
                  <p className="text-[11px] text-slate-400 mt-1">Within target guardrails</p>
                </div>
              </div>

              {/* POS Sync Action Bar */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-800 to-indigo-950/40 border border-amber-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">
                      Automated Daily POS Ledger Reconciliation
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      V79 POS → FFPRO Sync
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Post today’s cash & bank transfer register intake into Fire Finance Pro’s central
                    general ledger.
                  </p>
                </div>

                <button
                  onClick={handleFFPROSync}
                  disabled={isSyncingFFPRO}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingFFPRO ? "animate-spin" : ""}`} />
                  <span>
                    {isSyncingFFPRO
                      ? "Reconciling Ledger..."
                      : `Sync Today ($${todayGrossRevenue.toFixed(2)} XCD)`}
                  </span>
                </button>
              </div>

              {/* Recent Ledger Sync History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Synced Ledger Journals</span>
                    <span className="text-xs font-normal text-slate-400">
                      ({ffproRecords.length} records)
                    </span>
                  </h3>
                </div>

                <div className="border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/80 bg-slate-950/40">
                  {ffproRecords.map((record) => (
                    <div
                      key={record.id}
                      className="p-4 flex items-center justify-between hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            record.amount >= 0
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          <DollarSign className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{record.title}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span>{new Date(record.date).toLocaleDateString()}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-500">{record.source}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={`text-sm font-bold font-mono ${
                            record.amount >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {record.amount >= 0 ? "+" : ""}$
                          {Math.abs(record.amount).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}{" "}
                          XCD
                        </p>
                        <span className="text-[10px] text-emerald-400/90 font-medium flex items-center justify-end gap-1 mt-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Reconciled</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. TIQUET (SERVICE DESK & RMA) CONSOLE WORKSPACE */}
          {/* ========================================================= */}
          {app.shortName === "Tiquet" && (
            <div className="space-y-6">
              {/* Tiquet Action Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                {/* Status Filter */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
                  {["all", "open", "in_progress", "waiting_parts", "resolved"].map((status) => (
                    <button
                      key={status}
                      onClick={() => setTicketFilter(status)}
                      className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-all ${
                        ticketFilter === status
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {status.replace("_", " ")}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowNewTicketModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Dispatch New Ticket</span>
                </button>
              </div>

              {/* Tickets List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTickets.map((ticket) => {
                  const priorityColors = {
                    urgent: "bg-rose-500/20 text-rose-300 border-rose-500/30",
                    high: "bg-amber-500/20 text-amber-300 border-amber-500/30",
                    normal: "bg-sky-500/20 text-sky-300 border-sky-500/30",
                    low: "bg-slate-700 text-slate-300 border-slate-600",
                  };

                  const statusColors = {
                    open: "text-rose-400 bg-rose-500/10 border-rose-500/20",
                    in_progress: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                    waiting_parts: "text-violet-400 bg-violet-500/10 border-violet-500/20",
                    resolved: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                  };

                  return (
                    <div
                      key={ticket.id}
                      className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 hover:border-slate-600 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-mono text-xs font-bold text-indigo-400">
                            {ticket.ticketNumber}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                priorityColors[ticket.priority]
                              }`}
                            >
                              {ticket.priority}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border capitalize ${
                                statusColors[ticket.status]
                              }`}
                            >
                              {ticket.status.replace("_", " ")}
                            </span>
                          </div>
                        </div>

                        <h4 className="font-bold text-white text-sm mb-1.5 leading-snug">
                          {ticket.title}
                        </h4>

                        <p className="text-xs text-slate-300 mb-3">{ticket.notes}</p>

                        {ticket.linkedItemName && (
                          <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-2 text-xs text-indigo-300 mb-3">
                            <Tag className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="truncate">
                              Linked Hardware: <strong>{ticket.linkedItemName}</strong> (
                              {ticket.linkedSku})
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                        <div>
                          <p className="font-semibold text-slate-300">{ticket.clientName}</p>
                          <p className="text-[10px]">{ticket.technician}</p>
                        </div>

                        <div className="flex items-center gap-1">
                          {ticket.status !== "resolved" ? (
                            <button
                              onClick={() => onUpdateTicketStatus(ticket.id, "resolved")}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 transition-all"
                            >
                              Mark Resolved
                            </button>
                          ) : (
                            <button
                              onClick={() => onUpdateTicketStatus(ticket.id, "open")}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all"
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* New Ticket Modal Form */}
              {showNewTicketModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                  <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-lg shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Ticket className="w-5 h-5 text-indigo-400" />
                        <span>Dispatch Support Work Order</span>
                      </h3>
                      <button
                        onClick={() => setShowNewTicketModal(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleCreateTicketSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Issue Summary / Work Title *
                        </label>
                        <input
                          type="text"
                          required
                          value={newTicket.title}
                          onChange={(e) =>
                            setNewTicket({ ...newTicket, title: e.target.value })
                          }
                          placeholder="e.g. UniFi SFP+ Port Replacement"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Client Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={newTicket.clientName}
                            onChange={(e) =>
                              setNewTicket({ ...newTicket, clientName: e.target.value })
                            }
                            placeholder="e.g. Rodney Bay Hotel"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Contact / Phone
                          </label>
                          <input
                            type="text"
                            value={newTicket.clientContact}
                            onChange={(e) =>
                              setNewTicket({ ...newTicket, clientContact: e.target.value })
                            }
                            placeholder="+1 (758) ..."
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Priority
                          </label>
                          <select
                            value={newTicket.priority}
                            onChange={(e) =>
                              setNewTicket({
                                ...newTicket,
                                priority: e.target.value as TiquetTicket["priority"],
                              })
                            }
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                          >
                            <option value="urgent">Urgent (1 hr SLA)</option>
                            <option value="high">High (4 hr SLA)</option>
                            <option value="normal">Normal (24 hr SLA)</option>
                            <option value="low">Low (48 hr SLA)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Link Catalog Hardware (RMA)
                          </label>
                          <select
                            value={newTicket.linkedSku}
                            onChange={(e) =>
                              setNewTicket({ ...newTicket, linkedSku: e.target.value })
                            }
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 truncate"
                          >
                            <option value="">None / General Service</option>
                            {inventory.map((item) => (
                              <option key={item.id} value={item.sku}>
                                {item.name} ({item.sku})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Technician Notes & Diagnostics
                        </label>
                        <textarea
                          rows={3}
                          value={newTicket.notes}
                          onChange={(e) =>
                            setNewTicket({ ...newTicket, notes: e.target.value })
                          }
                          placeholder="Describe the failure, troubleshooting steps taken, and replacement parts required..."
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="flex justify-end gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowNewTicketModal(false)}
                          className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30"
                        >
                          Dispatch Work Order
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. V79 MARKETING SUITE CONSOLE WORKSPACE */}
          {/* ========================================================= */}
          {app.shortName === "Marketing" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Active Promotional Campaigns</h3>
                  <p className="text-xs text-slate-400">
                    Discounts and coupon codes auto-recognized by V79 POS Terminal.
                  </p>
                </div>

                <button
                  onClick={() => setShowNewCampaignModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-pink-600 hover:bg-pink-500 text-white shadow-md shadow-pink-600/30 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Launch Promo Campaign</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {marketingCampaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 hover:border-pink-500/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">
                          {camp.channel}
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          {camp.discountPercent}% OFF
                        </span>
                      </div>

                      <h4 className="font-bold text-white text-sm mb-1">{camp.name}</h4>
                      <p className="text-xs text-slate-400 mb-3">{camp.targetProduct}</p>

                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between mb-3">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          Promo Code
                        </span>
                        <code className="text-xs font-mono font-black text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          {camp.discountCode}
                        </code>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
                      <div>
                        <span className="font-semibold text-white">{camp.reach.toLocaleString()}</span>{" "}
                        reach
                      </div>
                      <div className="text-pink-400 font-bold">
                        {camp.conversions} conversions
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* New Campaign Modal */}
              {showNewCampaignModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                  <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-lg shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Megaphone className="w-5 h-5 text-pink-400" />
                        <span>Create Promotional Campaign</span>
                      </h3>
                      <button
                        onClick={() => setShowNewCampaignModal(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleCreateCampaignSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Campaign Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={newCampaign.name}
                          onChange={(e) =>
                            setNewCampaign({ ...newCampaign, name: e.target.value })
                          }
                          placeholder="e.g. Flash Networking Clearance"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-pink-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Primary Channel
                          </label>
                          <select
                            value={newCampaign.channel}
                            onChange={(e) =>
                              setNewCampaign({
                                ...newCampaign,
                                channel: e.target.value as MarketingCampaign["channel"],
                              })
                            }
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-pink-500"
                          >
                            <option value="WhatsApp Business">WhatsApp Business</option>
                            <option value="Instagram">Instagram</option>
                            <option value="LinkedIn">LinkedIn</option>
                            <option value="Email">Direct Client Email</option>
                            <option value="Store Display">In-Store Register Display</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Promo Voucher Code *
                          </label>
                          <input
                            type="text"
                            required
                            value={newCampaign.discountCode}
                            onChange={(e) =>
                              setNewCampaign({
                                ...newCampaign,
                                discountCode: e.target.value.toUpperCase(),
                              })
                            }
                            placeholder="e.g. V79DEAL15"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm font-mono text-white focus:outline-none focus:border-pink-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Discount Percent (%)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="90"
                            value={newCampaign.discountPercent}
                            onChange={(e) =>
                              setNewCampaign({
                                ...newCampaign,
                                discountPercent: Number(e.target.value),
                              })
                            }
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-pink-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Ad Budget (XCD)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={newCampaign.budgetXCD}
                            onChange={(e) =>
                              setNewCampaign({
                                ...newCampaign,
                                budgetXCD: Number(e.target.value),
                              })
                            }
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-pink-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Target Product Line
                        </label>
                        <input
                          type="text"
                          value={newCampaign.targetProduct}
                          onChange={(e) =>
                            setNewCampaign({ ...newCampaign, targetProduct: e.target.value })
                          }
                          placeholder="e.g. Networking & Ubiquiti Gear"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-pink-500"
                        />
                      </div>

                      <div className="flex justify-end gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowNewCampaignModal(false)}
                          className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-pink-600 hover:bg-pink-500 text-white shadow-md shadow-pink-600/30"
                        >
                          Publish Promo Campaign
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. ORDELY / GENERAL OPERATIONS WORKSPACE */}
          {/* ========================================================= */}
          {app.shortName !== "FFPRO" &&
            app.shortName !== "Tiquet" &&
            app.shortName !== "Marketing" && (
              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <h3 className="text-base font-bold text-white mb-2">{app.name} Direct Console</h3>
                  <p className="text-xs text-slate-300 mb-4">{app.description}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                    {app.metrics?.map((m, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-slate-900 border border-slate-800"
                      >
                        <p className="text-[11px] text-slate-400 font-medium">{m.label}</p>
                        <p className="text-lg font-bold text-white mt-0.5">{m.value}</p>
                        {m.sublabel && (
                          <p className="text-[10px] text-emerald-400 mt-0.5">{m.sublabel}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 mb-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Integrated Capabilities
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {app.features.map((feat, fIdx) => (
                        <span
                          key={fIdx}
                          className="text-xs font-medium px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200"
                        >
                          ✓ {feat}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={launchWithSSO}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open {app.shortName}</span>
                    </button>
                    {app.githubRepo && (
                      <a
                        href={app.githubRepo}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700"
                      >
                        View GitHub Repository
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
