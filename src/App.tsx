/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from "react";
import { ViewState, User, EcosystemApp } from "./types";
import { Sidebar } from "./components/Sidebar";
import { Login } from "./components/Login";
import { UserManagement } from "./components/UserManagement";
import { AppSwitcher } from "./components/AppSwitcher";
import { HubOverview } from "./components/HubOverview";
import { WorkspaceConnections } from "./components/WorkspaceConnections";
import { WorkspaceTeam } from "./components/WorkspaceTeam";
import { WorkspaceSecurity } from "./components/WorkspaceSecurity";
import { WorkspaceBilling } from "./components/WorkspaceBilling";
import { AdminConsole } from "./components/AdminConsole";
import { CheckCircle2, AlertCircle, RotateCw } from "lucide-react";

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [ecosystemApps, setEcosystemApps] = useState<EcosystemApp[]>([]);
  const [currentView, setCurrentView] = useState<ViewState>("overview");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") !== "launch_denied") return;
    const names: Record<string, string> = { ffpro: "FFPRO", tiquet: "Tiquet", marketing: "Marketing" };
    const name = names[params.get("return") || ""] || "The app";
    setToast({ message: `${name} could not complete sign-in. Check its launch configuration and account link.`, type: "error" });
    setTimeout(() => setToast(null), 8000);
    params.delete("error");
    params.delete("return");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, []);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
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

  const fetchHubData = useCallback(async () => {
    try {
      const ecoRes = await fetch("/api/ecosystem/apps", { cache: "no-store" });
      if (ecoRes.ok) setEcosystemApps(await ecoRes.json());
      if (user?.role === "admin") {
        const usersRes = await fetch("/api/users", { cache: "no-store" });
        if (usersRes.ok) setUsers(await usersRes.json());
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error("Error fetching Hub state:", err);
    }
  }, [user?.role]);

  useEffect(() => {
    if (user) fetchHubData();
  }, [user, fetchHubData]);

  useEffect(() => {
    if (!user) return;
    let socket: WebSocket | undefined;
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}`);
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "USERS_UPDATED" && user.role === "admin") setUsers(msg.payload);
          if (msg.type === "ECOSYSTEM_APPS_UPDATED") setEcosystemApps(msg.apps);
        } catch (err) {
          console.error("WS parse error", err);
        }
      };
      socket.onclose = () => {
        if (!closed) reconnectTimeout = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      socket?.close();
    };
  }, [user]);

  const handleLoginSuccess = (authenticatedUser: User, _token: string) => {
    setAuthToken("cookie");
    setUser(authenticatedUser);
    setCurrentView("overview");
    showToast(`Welcome back, ${authenticatedUser.fullName || authenticatedUser.username}!`);
  };

  const handleLogout = async () => {
    try {
      if (user) await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Clear local state even if the network request fails.
    }
    setAuthToken(null);
    setUser(null);
    setUsers([]);
    setCurrentView("overview");
  };

  const handleAddUser = async (userData: any) => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Failed to create user");
    showToast(`User @${userData.username} created`);
    await fetchHubData();
  };

  const handleUpdateUser = async (id: string, updateData: any) => {
    const res = await fetch(`/api/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Failed to update user");
    showToast("User permissions updated");
    await fetchHubData();
  };

  const handleDeleteUser = async (id: string) => {
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error((await res.json()).error || "Failed to delete user");
    showToast("User account removed");
    await fetchHubData();
  };

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

  if (!user) return <Login onLoginSuccess={handleLoginSuccess} />;

  const isAdmin = user.role === "admin";
  const viewLabel: Record<string, string> = {
    overview: "Business Pulse",
    dashboard: "Business Pulse",
    connections: "Connections",
    team: "Team",
    security: "Security",
    billing: "Billing",
    admin: "Admin Console",
    users: "User Management",
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 antialiased overflow-hidden">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={handleLogout}
        user={user}
      />
      <main className="flex-1 overflow-y-auto relative flex flex-col bg-[#F8FAFC]">
        <header className="h-16 px-6 border-b border-slate-200/80 bg-white flex items-center justify-between shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">V79 HUB</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-800">
              {viewLabel[currentView] || "Workspace"}
            </span>
          </div>

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
            <button
              onClick={() => {
                fetchHubData();
                showToast("Hub data refreshed");
              }}
              title="Refresh Hub Data"
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <AppSwitcher
              apps={ecosystemApps}
              onNavigateToEcosystem={() => setCurrentView("overview")}
              authToken={authToken}
            />
          </div>
        </header>

        {toast && (
          <div className="fixed top-20 right-5 z-[80] animate-in fade-in slide-in-from-top-3">
            <div
              className={`px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2.5 backdrop-blur-md ${
                toast.type === "success"
                  ? "bg-slate-900/95 text-white border-slate-700"
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

        {(currentView === "overview" || currentView === "dashboard") && (
          <HubOverview ecosystemApps={ecosystemApps} onNavigate={setCurrentView} />
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

        {currentView === "security" && <WorkspaceSecurity onNavigate={setCurrentView} />}
        {currentView === "billing" && <WorkspaceBilling onNavigate={setCurrentView} />}
        {currentView === "admin" && isAdmin && <AdminConsole ecosystemApps={ecosystemApps} />}

        {currentView === "users" && isAdmin && (
          <UserManagement
            users={users}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            currentUserId={user.id}
          />
        )}
      </main>
    </div>
  );
}
