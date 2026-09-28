import { useState, FormEvent } from "react";
import { User, ViewState, UserRole } from "../types";
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Edit2,
  Search,
  Key,
  CheckCircle2,
  Lock,
  X,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";

interface UserManagementProps {
  users: User[];
  onAddUser: (user: {
    username: string;
    password: string;
    fullName: string;
    role: UserRole;
    permissions: ViewState[];
  }) => Promise<void>;
  onUpdateUser: (
    id: string,
    user: {
      username?: string;
      password?: string;
      fullName?: string;
      role?: UserRole;
      permissions?: ViewState[];
    }
  ) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
  currentUserId: string;
}

const ALL_VIEWS: { id: ViewState; label: string; desc: string }[] = [
  { id: "overview", label: "Overview", desc: "View ecosystem health and business KPIs" },
  { id: "connections", label: "Connections", desc: "Open and review connected V79 applications" },
  { id: "team", label: "Team", desc: "View organisation members and roles" },
  { id: "security", label: "Security", desc: "Review workspace security controls" },
  { id: "billing", label: "Billing", desc: "View plan and subscription information" },
  { id: "admin", label: "Admin Console", desc: "Manage V79 platform applications and administration" },
  { id: "users", label: "User Management", desc: "Create and manage Hub users" },
];

export function UserManagement({
  users,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  currentUserId,
}: UserManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "staff" as UserRole,
    permissions: ["overview"] as ViewState[],
  });

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      username: "",
      password: "",
      fullName: "",
      role: "staff",
      permissions: ["overview"],
    });
    setErrorMessage("");
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: "", // Leave blank unless changing
      fullName: user.fullName || user.username,
      role: user.role,
      permissions: (user.permissions || ["overview"]).filter((permission) => ALL_VIEWS.some((view) => view.id === permission)),
    });
    setErrorMessage("");
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleRoleChange = (role: UserRole) => {
    let perms: ViewState[] = [];
    if (role === "admin") {
      perms = ["overview", "connections", "team", "security", "billing", "admin", "users"];
    } else if (role === "manager") {
      perms = ["overview", "connections", "team", "security", "billing"];
    } else if (role === "staff") {
      perms = ["overview", "connections"];
    } else {
      perms = ["overview"];
    }

    setFormData((prev) => ({
      ...prev,
      role,
      permissions: perms,
    }));
  };

  const togglePermission = (view: ViewState) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(view)
        ? prev.permissions.filter((p) => p !== view)
        : [...prev.permissions, view],
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      if (editingUser) {
        await onUpdateUser(editingUser.id, {
          username: formData.username.trim(),
          fullName: formData.fullName.trim(),
          role: formData.role,
          permissions: formData.permissions,
          ...(formData.password ? { password: formData.password } : {}),
        });
      } else {
        if (!formData.password) {
          throw new Error("Password is required for new accounts");
        }
        await onAddUser({
          username: formData.username.trim(),
          password: formData.password,
          fullName: formData.fullName.trim() || formData.username.trim(),
          role: formData.role,
          permissions: formData.permissions,
        });
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
      await onDeleteUser(deleteConfirmUser.id);
      setDeleteConfirmUser(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.fullName && u.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const roleBadges: Record<string, string> = {
    admin: "bg-indigo-100 text-indigo-700 border-indigo-200",
    manager: "bg-sky-100 text-sky-700 border-sky-200",
    staff: "bg-emerald-100 text-emerald-700 border-emerald-200",
    viewer: "bg-amber-100 text-amber-700 border-amber-200",
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            User Access & Permissions
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Configure system accounts, role-based capabilities, and cashier privileges.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create New User</span>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search team members by username or full name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {filteredUsers.length} active account{filteredUsers.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                <th className="p-3.5 pl-6">User Account</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Authorized Sections</th>
                <th className="p-3.5">Last Login Session</th>
                <th className="p-3.5 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const isCurrentUser = u.id === currentUserId;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600 uppercase text-xs">
                          {u.username.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span>{u.fullName || u.username}</span>
                            {isCurrentUser && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                                You
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">@{u.username}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                          roleBadges[u.role] || "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(u.permissions || []).map((perm) => (
                          <span
                            key={perm}
                            className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium"
                          >
                            {perm}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "Never logged in"}
                    </td>

                    <td className="p-3.5 text-right pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Edit User"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmUser(u)}
                          disabled={isCurrentUser}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={isCurrentUser ? "Cannot delete own active session" : "Delete User"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingUser ? "Modify User Account" : "Create New Access Account"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Assign role authorization and sectional permissions.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                    placeholder="e.g. jsmith"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                    placeholder="e.g. John Smith"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {editingUser ? "Reset Password (Leave blank to keep unchanged)" : "Password *"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                    placeholder={editingUser ? "•••••••• (optional)" : "Enter secure password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Role selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">User Role</label>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {(["admin", "manager", "staff", "viewer"] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleRoleChange(r)}
                      className={`py-2 px-2 rounded-xl font-bold uppercase tracking-wider text-[11px] border transition-all ${
                        formData.role === r
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permissions Checkboxes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Sectional Authorizations
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                  {ALL_VIEWS.map(({ id, label, desc }) => (
                    <label
                      key={id}
                      className={`p-2.5 rounded-xl border flex items-start gap-2 cursor-pointer transition-all ${
                        formData.permissions.includes(id)
                          ? "bg-indigo-50/50 border-indigo-300"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(id)}
                        onChange={() => togglePermission(id)}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-0"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800">{label}</div>
                        <div className="text-[10px] text-slate-400 leading-tight">{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>{editingUser ? "Save Changes" : "Create Account"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Delete Account</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Are you sure you want to revoke and delete{" "}
              <strong>@{deleteConfirmUser.username}</strong>? They will no longer be able to log in.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
