import React, { useState, FormEvent } from "react";
import {
  Users,
  UserPlus,
  Shield,
  CheckCircle2,
  Search,
  MoreVertical,
  X,
  Edit2,
  Trash2,
  Key,
  Eye,
  EyeOff,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import { User, UserRole, ViewState } from "../types";

interface WorkspaceTeamProps {
  users: User[];
  currentUser: User | null;
  onNavigate: (view: ViewState) => void;
  onAddUser?: (userData: any) => Promise<void>;
  onUpdateUser?: (id: string, userData: any) => Promise<void>;
  onDeleteUser?: (id: string) => Promise<void>;
}

export function WorkspaceTeam({
  users,
  currentUser,
  onNavigate,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
}: WorkspaceTeamProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "staff" as UserRole,
  });

  const teamList = users;

  const filteredTeam = teamList.filter(
    (m) =>
      m.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.fullName && m.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      username: "",
      password: "",
      fullName: "",
      role: "staff",
    });
    setErrorMessage("");
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (userToEdit: User) => {
    setEditingUser(userToEdit);
    setFormData({
      username: userToEdit.username,
      password: "",
      fullName: userToEdit.fullName || userToEdit.username,
      role: userToEdit.role,
    });
    setErrorMessage("");
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      if (editingUser) {
        if (onUpdateUser) {
          await onUpdateUser(editingUser.id, {
            username: formData.username.trim(),
            fullName: formData.fullName.trim(),
            role: formData.role,
            ...(formData.password ? { password: formData.password } : {}),
          });
        }
      } else {
        if (!formData.password) {
          throw new Error("Password is required for new accounts");
        }
        if (onAddUser) {
          await onAddUser({
            username: formData.username.trim(),
            password: formData.password,
            fullName: formData.fullName.trim() || formData.username.trim(),
            role: formData.role,
          });
        }
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save user account");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmUser) return;
    try {
      if (onDeleteUser) {
        await onDeleteUser(deleteConfirmUser.id);
      }
      setDeleteConfirmUser(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
    }
  };

  const roleStyles: Record<UserRole, { badge: string; desc: string }> = {
    admin: {
      badge: "bg-purple-100 text-purple-800 border-purple-200",
      desc: "Full organization authority, user invites & system settings",
    },
    manager: {
      badge: "bg-blue-100 text-blue-800 border-blue-200",
      desc: "Ecosystem management, reports, inventory & team review",
    },
    staff: {
      badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
      desc: "Operational access, catalog updates & day-to-day workflow",
    },
    viewer: {
      badge: "bg-slate-100 text-slate-700 border-slate-200",
      desc: "Read-only visibility for auditing & observation",
    },
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            WORKSPACE SETTINGS
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Workspace Team & Members
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage who has access to the V79 Digital organisation, roles, and connected apps.
          </p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => onNavigate("overview")}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <span>← Back to Hub</span>
          </button>
          {currentUser?.role === "admin" && <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-cyan-400" />
            <span>Add Team Member</span>
          </button>}
        </div>
      </div>

      {/* Role Guide Notice */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(["admin", "manager", "staff", "viewer"] as UserRole[]).map((r) => (
          <div key={r} className="p-3.5 bg-white border border-slate-200/90 rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${roleStyles[r].badge}`}>
                {r}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              {roleStyles[r].desc}
            </p>
          </div>
        ))}
      </div>

      {/* Main Team Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Search Bar & Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-cyan-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Active Organisation Members ({teamList.length})
            </h3>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search members..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>
        </div>

        {/* Member Rows */}
        <div className="divide-y divide-slate-100">
          {filteredTeam.map((member) => {
            const isSelf = currentUser && (currentUser.id === member.id || currentUser.username === member.username);
            return (
              <div
                key={member.id}
                className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#0B1528] text-cyan-400 font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                    {member.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {member.fullName || member.username}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-1.5 py-0.2 rounded">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">@{member.username}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                      roleStyles[member.role]?.badge || "bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {member.role}
                  </span>

                  <span className="hidden sm:flex text-xs text-emerald-600 font-medium items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Active
                  </span>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(member)}
                      title="Edit member details & role"
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {!isSelf && (
                      <button
                        onClick={() => setDeleteConfirmUser(member)}
                        title="Remove member"
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingUser ? "Edit Team Member" : "Add Team Member"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {errorMessage}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Sarah St. Omer"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().trim() })}
                  placeholder="e.g. sarah_ops"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {editingUser ? "Reset Password (leave blank to keep current)" : "Password *"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? "••••••••" : "Choose secure password"}
                    className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Workspace Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-cyan-500/20 focus:outline-none bg-white"
                >
                  <option value="staff">Staff (Operational workflow)</option>
                  <option value="manager">Manager (Hub configuration & reports)</option>
                  <option value="admin">Administrator (Full authority)</option>
                  <option value="viewer">Viewer (Read-only)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : editingUser ? "Update Member" : "Create Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Member Confirmation */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Remove Team Member?</h4>
                <p className="text-xs text-slate-500">
                  Remove @{deleteConfirmUser.username} from V79 Digital.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              This will revoke all signed SSO access and terminate active sessions for this account.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
