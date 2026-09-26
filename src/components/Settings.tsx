import { useState, useEffect, FormEvent, useRef, ChangeEvent } from "react";
import {
  Save,
  Server,
  CheckCircle2,
  AlertCircle,
  ShoppingCart,
  Upload,
  FileText,
  ShieldCheck,
  Building,
  RotateCcw,
  Download,
  Percent,
} from "lucide-react";
import { InventoryItem, StoreSettings } from "../types";

interface SettingsProps {
  items: InventoryItem[];
  settings: StoreSettings | null;
  onUpdateSettings: (newSettings: Partial<StoreSettings>) => Promise<void>;
  onBulkImport: (items: any[]) => Promise<number>;
  onResetDatabase: () => Promise<void>;
  onSimulateCheckout: (sku: string, quantity: number) => void;
  isAdmin: boolean;
}

export function Settings({
  items,
  settings,
  onUpdateSettings,
  onBulkImport,
  onResetDatabase,
  onSimulateCheckout,
  isAdmin,
}: SettingsProps) {
  const [formData, setFormData] = useState<StoreSettings>({
    companyName: "Vision 79 Ltd",
    tradingName: "V79 Digital Hub",
    country: "Saint Lucia",
    city: "Castries",
    email: "Vision79SLU@gmail.com",
    phone: "+1 (758) 450-7979",
    currency: "XCD",
    taxRate: 12.5,
    enableTax: true,
    posApiKey: "",
    webhookUrl: "",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [simSku, setSimSku] = useState("");
  const [simQty, setSimQty] = useState(1);
  const [showResetModal, setShowResetModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdateSettings(formData);
      setSaveMessage("Settings updated successfully!");
      setTimeout(() => setSaveMessage(""), 3500);
    } catch (err: any) {
      alert(err.message || "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSimulate = (e: FormEvent) => {
    e.preventDefault();
    if (!simSku) return;
    onSimulateCheckout(simSku, simQty);
    setSaveMessage(`Simulated POS sale for ${simQty}x ${simSku}`);
    setTimeout(() => setSaveMessage(""), 3500);
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const csv = event.target?.result as string;
        const lines = csv.split("\n");
        if (lines.length < 2) {
          throw new Error("CSV file must have a header row and at least one data row.");
        }

        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
        const newItems: any[] = [];

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const values = lines[i].split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
          const item: any = {
            tags: [],
            reorderThreshold: 5,
          };

          headers.forEach((header, index) => {
            const val = values[index];
            if (!val) return;

            if (header === "name" || header === "product name" || header === "title") item.name = val;
            else if (header === "sku") item.sku = val;
            else if (header === "category") item.category = val;
            else if (header === "quantity" || header === "stock") item.quantity = parseInt(val) || 0;
            else if (header === "price" || header === "selling price" || header === "retail") item.price = parseFloat(val) || 0;
            else if (header === "cost" || header === "costprice" || header === "unit cost") item.costPrice = parseFloat(val) || 0;
            else if (header === "barcode" || header === "upc" || header === "ean") item.barcode = val;
            else if (header === "manufacturer" || header === "brand") item.manufacturer = val;
            else if (header === "threshold" || header === "reorderthreshold") item.reorderThreshold = parseInt(val) || 5;
            else if (header === "location") item.location = val;
          });

          if (item.name && item.sku) {
            newItems.push(item);
          }
        }

        if (newItems.length > 0) {
          const count = await onBulkImport(newItems);
          setSaveMessage(`Successfully imported ${count} items in a single atomic batch!`);
          setTimeout(() => setSaveMessage(""), 4000);
        } else {
          alert("No valid items found in CSV. Ensure header contains 'name' and 'sku' columns.");
        }
      } catch (err: any) {
        console.error(err);
        alert(err.message || "Failed to parse CSV file.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsText(file);
  };

  const handleDownloadBackup = () => {
    const data = {
      backupDate: new Date().toISOString(),
      inventory: items,
      settings: formData,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `V79_Backup_${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto h-full space-y-8 font-sans overflow-y-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
          Hub Configuration & Settings
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Manage business identity, fiscal tax parameters, data imports, and POS integrations.
        </p>
      </div>

      {saveMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span className="text-xs font-semibold">{saveMessage}</span>
        </div>
      )}

      {/* Company Profile & Tax Form */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Business Entity & Location</h3>
            <p className="text-xs text-slate-500">Official company details appearing on customer receipts.</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Company Legal Name</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Trading Hub Name</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={formData.tradingName}
                onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Operating Country</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">City / Parish</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Contact Email</label>
              <input
                type="email"
                disabled={!isAdmin}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
              />
            </div>
          </div>

          {/* Currency & Tax parameters */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Currency Code</label>
              <select
                disabled={!isAdmin}
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 font-bold"
              >
                <option value="XCD">XCD (Eastern Caribbean Dollar)</option>
                <option value="USD">USD (US Dollar)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Value Added Tax (VAT %)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  disabled={!isAdmin}
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 pr-8 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 font-mono"
                />
                <Percent className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="flex items-center gap-2 pb-2">
              <input
                type="checkbox"
                id="enableTaxCheck"
                disabled={!isAdmin}
                checked={formData.enableTax}
                onChange={(e) => setFormData({ ...formData, enableTax: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-0 w-4 h-4"
              />
              <label htmlFor="enableTaxCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                Apply VAT at POS Checkout
              </label>
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? "Saving..." : "Save Business Profile"}</span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* High-Performance Bulk CSV Data Import */}
      {isAdmin && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Bulk Inventory Import</h3>
              <p className="text-xs text-slate-500">
                Upload CSV file to import products in one atomic batch transaction.
              </p>
            </div>
          </div>

          <div className="p-6">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group"
            >
              <FileText className="w-10 h-10 text-slate-400 group-hover:text-indigo-600 mx-auto mb-3 transition-colors" />
              <h4 className="text-sm font-bold text-slate-900 mb-1">
                {isImporting ? "Processing CSV..." : "Click to select CSV file"}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Supported columns: name, sku, category, quantity, price, cost, barcode, manufacturer, threshold
              </p>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
            </div>
          </div>
        </div>
      )}

      {/* POS Webhook & Simulation */}
      {isAdmin && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">External POS Webhook Link</h3>
                <p className="text-xs text-slate-500">Synchronize inventory with remote registers.</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">POS API Key</label>
                <input
                  type="password"
                  value={formData.posApiKey || ""}
                  onChange={(e) => setFormData({ ...formData, posApiKey: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono"
                  placeholder="v79_live_sec_..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Webhook Endpoint URL</label>
                <input
                  type="url"
                  value={formData.webhookUrl || ""}
                  onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                  placeholder="https://your-pos.com/api/v79/sync"
                />
              </div>
            </div>

            {/* POS Simulation Form */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-indigo-600" />
                <span>Simulate Automated Remote Sale</span>
              </h4>
              <form onSubmit={handleSimulate} className="flex flex-col sm:flex-row items-end gap-3">
                <div className="flex-1 w-full">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Select Inventory Item
                  </label>
                  <select
                    required
                    value={simSku}
                    onChange={(e) => setSimSku(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                  >
                    <option value="">Select an item to simulate checkout...</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.sku} disabled={i.quantity <= 0}>
                        {i.name} ({i.sku}) - {i.quantity} in stock
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-24">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Qty</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={simQty}
                    onChange={(e) => setSimQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-center font-bold"
                  />
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  Fire Simulation
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Database Maintenance & Backup Section */}
      {isAdmin && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Database Maintenance & Backups</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Export entire database snapshot or reset to original sample catalog.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleDownloadBackup}
              className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON Backup</span>
            </button>

            <button
              onClick={() => setShowResetModal(true)}
              className="px-3.5 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Sample Data</span>
            </button>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Reset Database to Default?</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              This will overwrite current inventory items, sales records, and restore the initial Vision 79 seed dataset.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onResetDatabase();
                  setShowResetModal(false);
                  setSaveMessage("Database successfully reset to initial seed state.");
                  setTimeout(() => setSaveMessage(""), 3500);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm"
              >
                Reset Database
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
