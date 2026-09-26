/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  InventoryItem,
  ViewState,
  User,
  Transaction,
  StoreSettings,
  AIForecast,
  EcosystemApp,
  TiquetTicket,
  FFPROSyncRecord,
  MarketingCampaign,
} from "./types";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { InventoryList } from "./components/InventoryList";
import { ItemModal } from "./components/ItemModal";
import { Settings } from "./components/Settings";
import { Invoices } from "./components/Invoices";
import { Reports } from "./components/Reports";
import { Login } from "./components/Login";
import { UserManagement } from "./components/UserManagement";
import { Ecosystem } from "./components/Ecosystem";
import { AppSwitcher } from "./components/AppSwitcher";
import { EcosystemConsoleModal } from "./components/EcosystemConsoleModal";
import { HubOverview } from "./components/HubOverview";
import { WorkspaceConnections } from "./components/WorkspaceConnections";
import { WorkspaceTeam } from "./components/WorkspaceTeam";
import { WorkspaceSecurity } from "./components/WorkspaceSecurity";
import { WorkspaceBilling } from "./components/WorkspaceBilling";
import { getInventoryForecast } from "./services/aiService";
import { CheckCircle2, AlertCircle, RotateCw } from "lucide-react";

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);

  // App Data
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>("overview");

  // Ecosystem Data
  const [ecosystemApps, setEcosystemApps] = useState<EcosystemApp[]>([]);
  const [tickets, setTickets] = useState<TiquetTicket[]>([]);
  const [ffproRecords, setFFPRORecords] = useState<FFPROSyncRecord[]>([]);
  const [marketingCampaigns, setMarketingCampaigns] = useState<MarketingCampaign[]>([]);
  const [activeConsoleApp, setActiveConsoleApp] = useState<EcosystemApp | null>(null);

  // Item Modal & Forecast
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [forecast, setForecast] = useState<AIForecast | null>(null);
  const [isForecasting, setIsForecasting] = useState(false);

  // Toast Notifications
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // --- Verify Active Auth Session on Load ---
  useEffect(() => {
    const verifySession = async () => {
      try {
        const res = await fetch("/api/auth/me");

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          // Token expired or invalid
          setAuthToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error("Session verification failed:", err);
      } finally {
        setIsVerifyingSession(false);
      }
    };

    verifySession();
  }, [authToken]);

  // --- Fetch Initial Hub Data ---
  const fetchAllData = useCallback(async () => {
    try {
      const [invRes, txnRes, setRes, ecoRes, tiqRes, ffpRes, mktRes] = await Promise.all([
        fetch("/api/inventory"),
        fetch("/api/transactions"),
        fetch("/api/settings"),
        fetch("/api/ecosystem/apps"),
        fetch("/api/ecosystem/tiquet/tickets"),
        fetch("/api/ecosystem/ffpro/records"),
        fetch("/api/ecosystem/marketing/campaigns"),
      ]);

      if (invRes.ok) setItems(await invRes.json());
      if (txnRes.ok) setTransactions(await txnRes.json());
      if (setRes.ok) setSettings(await setRes.json());
      if (ecoRes.ok) setEcosystemApps(await ecoRes.json());
      if (tiqRes.ok) setTickets(await tiqRes.json());
      if (ffpRes.ok) setFFPRORecords(await ffpRes.json());
      if (mktRes.ok) setMarketingCampaigns(await mktRes.json());

      // Fetch user accounts for team roster
      const usersRes = await fetch("/api/users");
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (err) {
      console.error("Error fetching hub state:", err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user, fetchAllData]);

  // --- Real-Time WebSocket Connection ---
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!user) return;

    let socket: WebSocket;
    let reconnectTimeout: any;

    const connectWS = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}`);
      wsRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "INVENTORY_UPDATED") {
            setItems(msg.payload);
          } else if (msg.type === "TRANSACTION_CREATED") {
            setTransactions((prev) => [msg.payload, ...prev.filter((t) => t.id !== msg.payload.id)]);
          } else if (msg.type === "USERS_UPDATED") {
            setUsers(msg.payload);
          } else if (msg.type === "ECOSYSTEM_APPS_UPDATED") {
            setEcosystemApps(msg.apps);
          } else if (msg.type === "TIQUET_TICKETS_UPDATED") {
            setTickets(msg.tickets);
          } else if (msg.type === "FFPRO_RECORDS_UPDATED") {
            setFFPRORecords(msg.records);
          } else if (msg.type === "MARKETING_CAMPAIGNS_UPDATED") {
            setMarketingCampaigns(msg.campaigns);
          }
        } catch (e) {
          console.error("WS Parse error", e);
        }
      };

      socket.onclose = () => {
        reconnectTimeout = setTimeout(connectWS, 3000);
      };
    };

    connectWS();

    return () => {
      clearTimeout(reconnectTimeout);
      if (socket) socket.close();
    };
  }, [user]);

  // --- Authentication Handlers ---
  const handleLoginSuccess = (authenticatedUser: User, token: string) => {
    setAuthToken("cookie");
    setUser(authenticatedUser);
    setCurrentView("dashboard");
    showToast(`Welcome back, ${authenticatedUser.fullName || authenticatedUser.username}!`);
  };

  const handleLogout = async () => {
    if (user) {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch (e) {
        // Ignore logout network errors
      }
    }

    setAuthToken(null);
    setUser(null);
    setCurrentView("dashboard");
  };

  // --- AI Forecast Generation ---
  const generateForecast = async () => {
    setIsForecasting(true);
    try {
      const data = await getInventoryForecast(items.length);
      setForecast(data);
      showToast("Supply chain forecast updated with Gemini AI!");
    } catch (e) {
      showToast("Failed to refresh forecast analysis.", "error");
    } finally {
      setIsForecasting(false);
    }
  };

  // --- Inventory Actions ---
  const handleAddItem = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSaveItem = async (itemData: Omit<InventoryItem, "id" | "lastUpdated">) => {
    if (editingItem) {
      const res = await fetch(`/api/inventory/${editingItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemData),
      });
      if (res.ok) {
        showToast(`Updated product "${itemData.name}"`);
      }
    } else {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemData),
      });
      if (res.ok) {
        showToast(`Added "${itemData.name}" to inventory`);
      }
    }
  };

  const handleDeleteItem = async (id: string) => {
    const res = await fetch(`/api/inventory/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Product deleted from catalog");
    }
  };

  const handleQuickStockChange = async (id: string, delta: number) => {
    await fetch(`/api/inventory/${id}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta }),
    });
  };

  // Bulk Import
  const handleBulkImport = async (newItems: any[]): Promise<number> => {
    const res = await fetch("/api/inventory/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: newItems }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Bulk import failed");
    }

    const data = await res.json();
    showToast(`Bulk imported ${data.count} items successfully!`);
    return data.count;
  };

  // POS Checkout
  const handlePOSCheckout = async (checkoutData: {
    cart: { item: InventoryItem; quantity: number }[];
    customerName: string;
    customerContact: string;
    paymentMethod: string;
    notes: string;
  }): Promise<Transaction> => {
    const res = await fetch("/api/pos/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...checkoutData,
        cashier: user?.fullName || user?.username || "Cashier",
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Checkout failed");
    }

    const data = await res.json();
    showToast(`Order ${data.transaction.receiptNumber} processed!`);
    return data.transaction;
  };

  // Simulate POS sale from Settings
  const handleSimulateCheckout = async (sku: string, quantity: number) => {
    const item = items.find((i) => i.sku === sku);
    if (!item) return;
    await handlePOSCheckout({
      cart: [{ item, quantity }],
      customerName: "Remote Webhook POS",
      customerContact: "sim@pos.gateway",
      paymentMethod: "Webhook Sync",
      notes: "Simulated automated sync event",
    });
  };

  // User Management
  const handleAddUser = async (userData: any) => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create user");
    }
    showToast(`User @${userData.username} created`);
  };

  const handleUpdateUser = async (id: string, updateData: any) => {
    const res = await fetch(`/api/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update user");
    }
    showToast("User permissions updated");
  };

  const handleDeleteUser = async (id: string) => {
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to delete user");
    }
    showToast("User account removed");
  };

  // Settings
  const handleUpdateSettings = async (newSettings: Partial<StoreSettings>) => {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSettings),
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
      showToast("Hub settings saved");
    }
  };

  const handleResetDatabase = async () => {
    const res = await fetch("/api/settings/reset", { method: "POST" });
    if (res.ok) {
      fetchAllData();
      showToast("Catalog & sales reset to seed demo state");
    }
  };

  // --- Ecosystem Handlers ---
  const handleUpdateApp = async (id: string, updates: Partial<EcosystemApp>) => {
    try {
      const res = await fetch(`/api/ecosystem/apps/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setEcosystemApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
      }
    } catch (err) {
      console.error("Failed to update app", err);
    }
  };

  const handleRegisterApp = async (newApp: Partial<EcosystemApp>) => {
    try {
      const res = await fetch("/api/ecosystem/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newApp),
      });
      if (res.ok) {
        const created = await res.json();
        setEcosystemApps((prev) => [...prev, created]);
      }
    } catch (err) {
      console.error("Failed to register app", err);
    }
  };

  const handleSyncPOSToFFPRO = async () => {
    const res = await fetch("/api/ecosystem/ffpro/sync-pos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = await res.json();
      setFFPRORecords((prev) => [data.record, ...prev]);
    }
  };

  const handleCreateTicket = async (ticket: Partial<TiquetTicket>) => {
    const res = await fetch("/api/ecosystem/tiquet/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ticket),
    });
    if (res.ok) {
      const created = await res.json();
      setTickets((prev) => [created, ...prev]);
    }
  };

  const handleUpdateTicketStatus = async (id: string, status: TiquetTicket["status"]) => {
    const res = await fetch(`/api/ecosystem/tiquet/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
    }
  };

  const handleCreateCampaign = async (campaign: Partial<MarketingCampaign>) => {
    const res = await fetch("/api/ecosystem/marketing/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campaign),
    });
    if (res.ok) {
      const created = await res.json();
      setMarketingCampaigns((prev) => [created, ...prev]);
    }
  };

  // Initial Loading Screen
  if (isVerifyingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-xs text-slate-400 font-mono tracking-wider uppercase">
          Initializing V79 Secure Hub...
        </p>
      </div>
    );
  }

  // Login view if unauthenticated
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const isAdmin = user.role === "admin";
  const isManager = user.role === "manager" || isAdmin;

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 antialiased overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={handleLogout}
        user={user}
      />

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto relative flex flex-col bg-[#F8FAFC]">
        {/* Top Header matching reference screenshot */}
        <header className="h-16 px-6 border-b border-slate-200/80 bg-white flex items-center justify-between shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              V79 HUB
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-800 capitalize">
              {currentView === "overview"
                ? "Overview"
                : currentView === "connections"
                ? "Connections"
                : currentView === "team"
                ? "Team"
                : currentView === "security"
                ? "Security"
                : currentView === "billing"
                ? "Billing"
                : currentView === "invoices"
                ? "Sales & Receipts"
                : currentView === "inventory"
                ? "Catalog & Stock"
                : currentView === "reports"
                ? "Reports & Valuations"
                : currentView}
            </span>
          </div>

          {/* Center Brand Identity (matching screenshot) */}
          <div className="hidden md:flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-black text-white font-extrabold text-[11px] flex items-center justify-center tracking-tight">
              v79
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-slate-900 text-sm">V79 Hub</span>
              <span className="text-xs text-slate-400 font-normal">From Idea to Advantage.</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Reload / Sync Button */}
            <button
              onClick={() => {
                fetchAllData();
                showToast("Hub synced with ecosystem", "success");
              }}
              title="Refresh Ecosystem Data"
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Quick 9-Dot Ecosystem Launcher */}
            <AppSwitcher
              apps={ecosystemApps}
              onNavigateToEcosystem={() => setCurrentView("overview")}
              authToken={authToken}
            />
          </div>
        </header>

        {/* In-App Toast Notification */}
        {toast && (
          <div className="fixed top-20 right-5 z-[80] animate-in fade-in slide-in-from-top-3">
            <div
              className={`px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2.5 backdrop-blur-md ${
                toast.type === "success"
                  ? "bg-slate-900/95 text-white border-slate-700 shadow-indigo-950/20"
                  : "bg-rose-900/95 text-rose-100 border-rose-700"
              }`}
            >
              {toast.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
          </div>
        )}

        {/* View Routing */}
        {(currentView === "overview" || currentView === "dashboard") && (
          <HubOverview
            ecosystemApps={ecosystemApps}
            onOpenAppConsole={(app) => setActiveConsoleApp(app)}
            onNavigate={setCurrentView}
            authToken={authToken}
            user={user}
          />
        )}

        {currentView === "connections" && (
          <WorkspaceConnections
            apps={ecosystemApps}
            onNavigate={setCurrentView}
            authToken={authToken}
          />
        )}

        {currentView === "team" && (
          <WorkspaceTeam
            users={users}
            currentUser={user}
            onNavigate={setCurrentView}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
          />
        )}

        {currentView === "security" && (
          <WorkspaceSecurity onNavigate={setCurrentView} />
        )}

        {currentView === "billing" && (
          <WorkspaceBilling onNavigate={setCurrentView} />
        )}

        {currentView === "inventory" && (
          <InventoryList
            items={items}
            onAdd={handleAddItem}
            onEdit={handleEditItem}
            onDelete={handleDeleteItem}
            onQuickStockChange={handleQuickStockChange}
            onImportClick={() => setCurrentView("settings")}
            isAdmin={isManager}
          />
        )}

        {currentView === "invoices" && <Invoices transactions={transactions} />}

        {currentView === "reports" && <Reports items={items} transactions={transactions} />}

        {currentView === "ecosystem" && (
          <Ecosystem
            apps={ecosystemApps}
            onUpdateApp={handleUpdateApp}
            onRegisterApp={handleRegisterApp}
            inventory={items}
            transactions={transactions}
            tickets={tickets}
            ffproRecords={ffproRecords}
            marketingCampaigns={marketingCampaigns}
            onSyncPOSToFFPRO={handleSyncPOSToFFPRO}
            onCreateTicket={handleCreateTicket}
            onUpdateTicketStatus={handleUpdateTicketStatus}
            onCreateCampaign={handleCreateCampaign}
            showToast={showToast}
            currentUser={user}
            authToken={authToken}
          />
        )}

        {currentView === "users" && isAdmin && (
          <UserManagement
            users={users}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            currentUserId={user.id}
          />
        )}

        {currentView === "settings" && (
          <Settings
            items={items}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onBulkImport={handleBulkImport}
            onResetDatabase={handleResetDatabase}
            onSimulateCheckout={handleSimulateCheckout}
            isAdmin={isAdmin}
          />
        )}
      </main>

      {/* In-Hub Live Console Modal for Flagship Ecosystem Apps */}
      {activeConsoleApp && (
        <EcosystemConsoleModal
          app={activeConsoleApp}
          onClose={() => setActiveConsoleApp(null)}
          inventory={items}
          transactions={transactions}
          tickets={tickets}
          ffproRecords={ffproRecords}
          marketingCampaigns={marketingCampaigns}
          onSyncPOSToFFPRO={handleSyncPOSToFFPRO}
          onCreateTicket={handleCreateTicket}
          onUpdateTicketStatus={handleUpdateTicketStatus}
          onCreateCampaign={handleCreateCampaign}
          showToast={showToast}
          authToken={authToken}
        />
      )}

      {/* Item Modal */}
      <ItemModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveItem}
        initialData={editingItem}
      />
    </div>
  );
}
