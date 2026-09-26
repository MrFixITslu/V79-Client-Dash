import { useState, useEffect, FormEvent, KeyboardEvent, useRef, ChangeEvent } from "react";
import { InventoryItem } from "../types";
import { X, Tag, Upload, ImageIcon, Package } from "lucide-react";

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Omit<InventoryItem, "id" | "lastUpdated">) => Promise<void>;
  initialData?: InventoryItem | null;
}

const COMMON_CATEGORIES = [
  "Networking",
  "POS Hardware",
  "Peripherals & Workstations",
  "Power & Infrastructure",
  "Cabling & Infrastructure",
  "Storage & Servers",
  "Software & Licenses",
  "Audio & Visual",
];

export function ItemModal({ isOpen, onClose, onSave, initialData }: ItemModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "Networking",
    quantity: 10,
    price: 99.0,
    costPrice: 65.0,
    reorderThreshold: 5,
    tags: [] as string[],
    barcode: "",
    manufacturer: "",
    imageUrl: "",
    location: "Main Bay",
  });

  const [tagInput, setTagInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        sku: initialData.sku,
        category: initialData.category || "Networking",
        quantity: initialData.quantity,
        price: initialData.price,
        costPrice: initialData.costPrice || Number((initialData.price * 0.7).toFixed(2)),
        reorderThreshold: initialData.reorderThreshold || 5,
        tags: initialData.tags || [],
        barcode: initialData.barcode || "",
        manufacturer: initialData.manufacturer || "",
        imageUrl: initialData.imageUrl || "",
        location: initialData.location || "Main Bay",
      });
    } else {
      setFormData({
        name: "",
        sku: "",
        category: "Networking",
        quantity: 10,
        price: 99.0,
        costPrice: 65.0,
        reorderThreshold: 5,
        tags: [],
        barcode: "",
        manufacturer: "",
        imageUrl: "",
        location: "Main Bay",
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.sku.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        ...formData,
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        quantity: Number(formData.quantity) || 0,
        price: Number(formData.price) || 0,
        costPrice: Number(formData.costPrice) || 0,
        reorderThreshold: Number(formData.reorderThreshold) || 5,
      });
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to save item");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = tagInput.trim().toLowerCase();
      if (val && !formData.tags.includes(val)) {
        setFormData({ ...formData, tags: [...formData.tags, val] });
      }
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tagToRemove),
    });
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {initialData ? "Edit Product Details" : "Register New Product Line"}
              </h3>
              <p className="text-xs text-slate-500">
                Configure item pricing, stock levels, and hardware identifiers.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-sans">
          {/* Product Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Product Title *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              placeholder="e.g. UniFi Dream Machine Pro"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* SKU */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Stock Keeping Unit (SKU) *
              </label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono uppercase focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                placeholder="e.g. NET-UDM-001"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:outline-none font-medium"
              >
                {COMMON_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing & Stock counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Current Stock</label>
              <input
                type="number"
                min="0"
                required
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-center font-bold font-mono focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Min Threshold</label>
              <input
                type="number"
                min="0"
                required
                value={formData.reorderThreshold}
                onChange={(e) =>
                  setFormData({ ...formData, reorderThreshold: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-center font-mono focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Retail Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cost Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.costPrice}
                onChange={(e) =>
                  setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Barcode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Barcode / UPC / EAN
              </label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                placeholder="e.g. 088047011922"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Manufacturer / Brand</label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                placeholder="e.g. Ubiquiti, Cisco, Zebra"
              />
            </div>
          </div>

          {/* Location & Image URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Warehouse Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                placeholder="e.g. Shelf B-04, Rack A-01"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Product Image</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:outline-none truncate"
                  placeholder="https://... or upload"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                </button>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Search Tags (Press Enter to add)
            </label>
            <div className="p-2 border border-slate-200 rounded-xl flex flex-wrap gap-1.5 items-center bg-slate-50/50">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 text-[11px] font-semibold"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-indigo-950 font-bold"
                  >
                    &times;
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder={formData.tags.length === 0 ? "Type tag & press enter..." : ""}
                className="bg-transparent text-xs focus:outline-none flex-1 min-w-[120px]"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <span>{initialData ? "Save Product" : "Create Product"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
