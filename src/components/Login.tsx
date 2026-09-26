import { useState, FormEvent } from "react";
import { Lock, User as UserIcon, ShieldCheck, AlertCircle, Eye, EyeOff, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { User } from "../types";

interface LoginProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password: password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || "Failed to log in. Please check credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setError("");
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/15 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-cyan-600/15 rounded-full blur-[140px]" />
        <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] bg-violet-600/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-lg shadow-indigo-500/25 mb-4 text-white">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="text-2xl font-black tracking-tight text-white">VISION</span>
              <span className="text-2xl font-black tracking-tight text-indigo-400">79</span>
              <span className="ml-1 text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">HUB</span>
            </div>
            <p className="text-slate-400 text-xs tracking-wide">
              Client Portal & Operations Hub &bull; Saint Lucia
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-xl text-xs flex items-center gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </motion.div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                Account Username
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-800 text-white pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-600"
                  placeholder="e.g. admin or staff"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 ml-1">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Access Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-800 text-white pl-10 pr-11 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-600"
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed text-sm active:scale-[0.99]"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Authenticate & Launch Hub</span>
                </>
              )}
            </button>
          </form>

          {/* Quick-Fill Presets for Seamless Testing & Evaluation */}
          <div className="mt-6 pt-6 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 mb-2.5 text-slate-400 text-[11px] font-medium uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Quick Login Profiles:</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickFill("admin", "password123")}
                className="px-3 py-2 rounded-lg bg-slate-800/70 hover:bg-indigo-950/60 border border-slate-700/60 hover:border-indigo-500/40 text-left transition-colors text-slate-300 hover:text-white"
              >
                <div className="font-semibold text-indigo-400">Admin</div>
                <div className="text-[10px] text-slate-500 font-mono">admin / password123</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("manager", "manager123")}
                className="px-3 py-2 rounded-lg bg-slate-800/70 hover:bg-indigo-950/60 border border-slate-700/60 hover:border-indigo-500/40 text-left transition-colors text-slate-300 hover:text-white"
              >
                <div className="font-semibold text-sky-400">Manager</div>
                <div className="text-[10px] text-slate-500 font-mono">manager / manager123</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("staff", "viewer123")}
                className="px-3 py-2 rounded-lg bg-slate-800/70 hover:bg-indigo-950/60 border border-slate-700/60 hover:border-indigo-500/40 text-left transition-colors text-slate-300 hover:text-white"
              >
                <div className="font-semibold text-emerald-400">Cashier</div>
                <div className="text-[10px] text-slate-500 font-mono">staff / viewer123</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("viewer", "viewer123")}
                className="px-3 py-2 rounded-lg bg-slate-800/70 hover:bg-indigo-950/60 border border-slate-700/60 hover:border-indigo-500/40 text-left transition-colors text-slate-300 hover:text-white"
              >
                <div className="font-semibold text-amber-400">Auditor</div>
                <div className="text-[10px] text-slate-500 font-mono">viewer / viewer123</div>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
