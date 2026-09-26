import { useState, useMemo } from "react";
import {
  EcosystemApp,
  EcosystemCategory,
  TiquetTicket,
  FFPROSyncRecord,
  MarketingCampaign,
  InventoryItem,
  Transaction,
  User,
} from "../types";
import { EcosystemConsoleModal } from "./EcosystemConsoleModal";
import {
  Wallet,
  Headphones,
  Megaphone,
  Boxes,
  TrendingUp,
  HeartPulse,
  ExternalLink,
  Search,
  Plus,
  KeyRound,
  CheckCircle2,
  Copy,
  Settings2,
  ShieldCheck,
  Sparkles,
  GitBranch,
  X,
  Layers,
  ArrowUpRight,
  Server,
  CreditCard,
} from "lucide-react";

interface EcosystemProps {
  apps: EcosystemApp[];
  onUpdateApp: (id: string, updates: Partial<EcosystemApp>) => Promise<void>;
  onRegisterApp: (app: Partial<EcosystemApp>) => Promise<void>;
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
  currentUser: User;
  authToken: string | null;
}

export function Ecosystem({
  apps,
  onUpdateApp,
  onRegisterApp,
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
  currentUser,
  authToken,
}: EcosystemProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Modals
  const [activeConsoleApp, setActiveConsoleApp] = useState<EcosystemApp | null>(null);
  const [showSSOModal, setShowSSOModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState<EcosystemApp | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // App edit configuration form state
  const [editAppUrl, setEditAppUrl] = useState("");
  const [editAppStatus, setEditAppStatus] = useState<EcosystemApp["status"]>("active");

  // Custom app registration form state
  const [newAppForm, setNewAppForm] = useState({
    name: "",
    shortName: "",
    tagline: "",
    description: "",
    category: "operations" as EcosystemCategory,
    appUrl: "",
    githubRepo: "",
  });

  const categories = [
    { id: "all", label: "All Ecosystem Apps" },
    { id: "finance", label: "Finance & Wealth (FFPRO)" },
    { id: "support", label: "Service & Support (Tiquet)" },
    { id: "marketing", label: "Marketing & Growth" },
    { id: "operations", label: "POS & Retail (V79 POS)" },
    { id: "analytics", label: "BI & Analytics" },
    { id: "team", label: "Team & Field Ops" },
  ];

  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      const matchesCategory =
        selectedCategory === "all" || app.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === "" ||
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.features.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [apps, selectedCategory, searchQuery]);

  const handleOpenConfig = (app: EcosystemApp) => {
    setShowConfigModal(app);
    setEditAppUrl(app.appUrl);
    setEditAppStatus(app.status);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showConfigModal) return;

    try {
      await onUpdateApp(showConfigModal.id, {
        appUrl: editAppUrl,
        status: editAppStatus,
      });
      setShowConfigModal(null);
      showToast(`${showConfigModal.name} configuration updated successfully!`);
    } catch {
      showToast("Failed to save app configuration", "error");
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppForm.name.trim() || !newAppForm.appUrl.trim()) {
      showToast("App name and URL are required", "error");
      return;
    }

    try {
      await onRegisterApp(newAppForm);
      setShowRegisterModal(false);
      setNewAppForm({
        name: "",
        shortName: "",
        tagline: "",
        description: "",
        category: "operations",
        appUrl: "",
        githubRepo: "",
      });
      showToast("New ecosystem application registered successfully!");
    } catch {
      showToast("Failed to register application", "error");
    }
  };

  const handleCopySSOToken = () => {
    if (authToken) {
      navigator.clipboard.writeText(authToken);
      showToast("V79 SSO Token copied to clipboard!");
    } else {
      showToast("No active session token available", "error");
    }
  };

  const renderAppIcon = (iconName: string) => {
    switch (iconName) {
      case "Wallet":
        return <Wallet className="w-6 h-6" />;
      case "Headphones":
        return <Headphones className="w-6 h-6" />;
      case "Megaphone":
        return <Megaphone className="w-6 h-6" />;
      case "Boxes":
        return <Boxes className="w-6 h-6" />;
      case "CreditCard":
        return <CreditCard className="w-6 h-6" />;
      case "LineChart":
        return <TrendingUp className="w-6 h-6" />;
      case "HeartPulse":
        return <HeartPulse className="w-6 h-6" />;
      default:
        return <Layers className="w-6 h-6" />;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in">
      {/* Top Banner & Header */}
      <div className="relative rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-8 shadow-xl overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Vision 79 Ecosystem Hub
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Cloud Sync
              </span>
            </div>

            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Ecosystem Applications & Services
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Unified operating environment for Vision 79. Seamlessly switch between{" "}
              <strong className="text-amber-400">FFPRO (Wealth & Finance)</strong>,{" "}
              <strong className="text-sky-400">Tiquet (Service Desk & RMA)</strong>,{" "}
              <strong className="text-pink-400">Marketing Hub</strong>, and{" "}
              <strong className="text-emerald-400">V79 POS</strong> with real-time cross-app
              reconciliation and shared SSO credentials.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setShowSSOModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 shadow-md transition-all"
            >
              <KeyRound className="w-4 h-4 text-indigo-400" />
              <span>V79 SSO Token</span>
            </button>

            {currentUser.role === "admin" && (
              <button
                onClick={() => setShowRegisterModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Register Custom App</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === c.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ecosystem..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-sm"
          />
        </div>
      </div>

      {/* Ecosystem Apps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredApps.map((app) => (
          <div
            key={app.id}
            className={`rounded-3xl bg-white border ${app.colorScheme.border} p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden`}
          >
            {/* Background subtle gradient */}
            <div
              className={`absolute top-0 right-0 w-48 h-48 ${app.colorScheme.bgGradient} rounded-full blur-2xl pointer-events-none`}
            />

            <div>
              {/* Header: Icon, Name & Badges */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${app.colorScheme.primary} flex items-center justify-center text-white shadow-md shadow-indigo-900/10 shrink-0 group-hover:scale-105 transition-transform`}
                >
                  {renderAppIcon(app.iconName)}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${app.colorScheme.badgeBg} ${app.colorScheme.badgeText}`}
                  >
                    {app.category}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Online
                  </span>
                </div>
              </div>

              {/* Title & Tagline */}
              <h3 className="text-lg font-bold text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                {app.name}
              </h3>
              <p className="text-xs font-medium text-slate-500 mt-0.5 mb-2.5">{app.tagline}</p>

              {/* Description */}
              <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-4">
                {app.description}
              </p>

              {/* Live Metric Pills */}
              {app.metrics && app.metrics.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-4 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  {app.metrics.slice(0, 2).map((m, idx) => (
                    <div key={idx}>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block truncate">
                        {m.label}
                      </span>
                      <span className="text-xs font-black text-slate-800 block truncate">
                        {m.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Features List */}
              <div className="space-y-1.5 mb-5">
                {app.features.slice(0, 3).map((feat, fIdx) => (
                  <div key={fIdx} className="flex items-center gap-2 text-[11px] text-slate-600">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="truncate">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {/* Launch External */}
                <a
                  href={
                    authToken ? `${app.appUrl}?sso_token=${authToken}` : app.appUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Launch App</span>
                </a>

                {/* In-Hub Live Console */}
                <button
                  onClick={() => setActiveConsoleApp(app)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all"
                >
                  <Server className="w-3.5 h-3.5 text-indigo-400" />
                  <span>In-Hub Console</span>
                </button>
              </div>

              {/* Secondary links: GitHub & Config */}
              <div className="flex items-center justify-between pt-1 text-[11px]">
                {app.githubRepo ? (
                  <a
                    href={app.githubRepo}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-700 font-medium transition-colors"
                  >
                    <GitBranch className="w-3 h-3" />
                    <span>GitHub Repo</span>
                  </a>
                ) : (
                  <span />
                )}

                {currentUser.role === "admin" && (
                  <button
                    onClick={() => handleOpenConfig(app)}
                    className="flex items-center gap-1 text-slate-400 hover:text-indigo-600 font-medium transition-colors"
                  >
                    <Settings2 className="w-3 h-3" />
                    <span>Configure URL</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ========================================================= */}
      {/* SSO TOKEN MODAL */}
      {/* ========================================================= */}
      {showSSOModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-xl shadow-2xl text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">V79 Unified SSO Credentials</h3>
                  <p className="text-xs text-slate-400">Single Sign-On bridge across all apps</p>
                </div>
              </div>
              <button
                onClick={() => setShowSSOModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                All apps in the Vision 79 ecosystem (<strong>FFPRO</strong>, <strong>Tiquet</strong>,{" "}
                <strong>Marketing</strong>, etc.) authenticate seamlessly with your current user session.
                You can copy your active Bearer token below or use the automated launch buttons which
                pass <code className="text-indigo-300">?sso_token=...</code> to external clients.
              </p>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Active Bearer Session Token
                </label>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                  <code className="text-xs font-mono text-indigo-300 truncate">
                    {authToken || "No active session"}
                  </code>
                  <button
                    onClick={handleCopySSOToken}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Token</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/60 space-y-1.5">
                <h4 className="text-xs font-bold text-indigo-300">API Session Verification Endpoint</h4>
                <p className="text-xs text-slate-300 font-mono">
                  GET /api/auth/me <br />
                  Authorization: Bearer {authToken ? authToken.slice(0, 16) + "..." : "..."}
                </p>
                <p className="text-[11px] text-slate-400 pt-1">
                  Returns user ID, name, role ({currentUser.role}), and authorized permissions.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowSSOModal(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* CONFIGURE APP URL MODAL */}
      {/* ========================================================= */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-400" />
                <span>Configure {showConfigModal.shortName}</span>
              </h3>
              <button
                onClick={() => setShowConfigModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Launch / Web App URL
                </label>
                <input
                  type="url"
                  required
                  value={editAppUrl}
                  onChange={(e) => setEditAppUrl(e.target.value)}
                  placeholder="https://app.vision79.lc"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Point this to your deployed Cloud Run, Firebase, or custom domain address.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Operating Status
                </label>
                <select
                  value={editAppStatus}
                  onChange={(e) =>
                    setEditAppStatus(e.target.value as EcosystemApp["status"])
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="active">Active (Online & Synced)</option>
                  <option value="syncing">Syncing (Background jobs)</option>
                  <option value="beta">Beta (Preview release)</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* REGISTER CUSTOM ECOSYSTEM APP MODAL */}
      {/* ========================================================= */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                <span>Register Custom Ecosystem App</span>
              </h3>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Application Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newAppForm.name}
                    onChange={(e) => setNewAppForm({ ...newAppForm, name: e.target.value })}
                    placeholder="e.g. Vision79 Pay"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Short Name / Badge
                  </label>
                  <input
                    type="text"
                    value={newAppForm.shortName}
                    onChange={(e) =>
                      setNewAppForm({ ...newAppForm, shortName: e.target.value })
                    }
                    placeholder="e.g. V79Pay"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tagline / Subtitle
                </label>
                <input
                  type="text"
                  value={newAppForm.tagline}
                  onChange={(e) => setNewAppForm({ ...newAppForm, tagline: e.target.value })}
                  placeholder="e.g. Merchant payment gateway & contactless checkout"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newAppForm.category}
                    onChange={(e) =>
                      setNewAppForm({
                        ...newAppForm,
                        category: e.target.value as EcosystemCategory,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="finance">Finance & Wealth</option>
                    <option value="support">Service & Support</option>
                    <option value="marketing">Marketing & Growth</option>
                    <option value="operations">Logistics & Operations</option>
                    <option value="analytics">BI & Analytics</option>
                    <option value="team">Team & Workforce</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    App Launch URL *
                  </label>
                  <input
                    type="url"
                    required
                    value={newAppForm.appUrl}
                    onChange={(e) => setNewAppForm({ ...newAppForm, appUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  GitHub Repository (Optional)
                </label>
                <input
                  type="url"
                  value={newAppForm.githubRepo}
                  onChange={(e) =>
                    setNewAppForm({ ...newAppForm, githubRepo: e.target.value })
                  }
                  placeholder="https://github.com/MrFixITslu/..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newAppForm.description}
                  onChange={(e) =>
                    setNewAppForm({ ...newAppForm, description: e.target.value })
                  }
                  placeholder="Summary of services and capabilities..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30"
                >
                  Register Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* IN-HUB LIVE CONSOLE MODAL */}
      {/* ========================================================= */}
      {activeConsoleApp && (
        <EcosystemConsoleModal
          app={activeConsoleApp}
          onClose={() => setActiveConsoleApp(null)}
          inventory={inventory}
          transactions={transactions}
          tickets={tickets}
          ffproRecords={ffproRecords}
          marketingCampaigns={marketingCampaigns}
          onSyncPOSToFFPRO={onSyncPOSToFFPRO}
          onCreateTicket={onCreateTicket}
          onUpdateTicketStatus={onUpdateTicketStatus}
          onCreateCampaign={onCreateCampaign}
          showToast={showToast}
          authToken={authToken}
        />
      )}
    </div>
  );
}
