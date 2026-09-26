import { useState, useMemo } from "react";
import {
  Receipt,
  Search,
  Download,
  Printer,
  Calendar,
  DollarSign,
  User,
  CreditCard,
  X,
  FileText,
  Filter,
} from "lucide-react";
import { Transaction } from "../types";

interface InvoicesProps {
  transactions: Transaction[];
}

export function Invoices({ transactions }: InvoicesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  // Filtered transactions
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return transactions.filter((t) => {
      if (paymentFilter !== "all" && t.paymentMethod.toLowerCase() !== paymentFilter.toLowerCase()) {
        return false;
      }
      if (!term) return true;
      return (
        t.receiptNumber.toLowerCase().includes(term) ||
        t.customerName.toLowerCase().includes(term) ||
        (t.customerContact && t.customerContact.toLowerCase().includes(term)) ||
        t.cashier.toLowerCase().includes(term) ||
        t.items.some((i) => i.item.name.toLowerCase().includes(term) || i.item.sku.toLowerCase().includes(term))
      );
    });
  }, [transactions, searchTerm, paymentFilter]);

  const totalGrossRevenue = useMemo(
    () => transactions.reduce((acc, t) => acc + t.total, 0),
    [transactions]
  );

  const exportSalesCSV = () => {
    const headers = ["Receipt #", "Date", "Customer", "Contact", "Payment Method", "Items Count", "Subtotal", "Tax", "Total", "Cashier"];
    const rows = filtered.map((t) => [
      `"${t.receiptNumber}"`,
      `"${t.date}"`,
      `"${t.customerName}"`,
      `"${t.customerContact || ""}"`,
      `"${t.paymentMethod}"`,
      t.items.reduce((sum, i) => sum + i.quantity, 0),
      t.subtotal.toFixed(2),
      t.tax.toFixed(2),
      t.total.toFixed(2),
      `"${t.cashier}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `V79_Sales_Log_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Sales & Receipts Hub
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Audit completed transactions, review payment tenders, and reprint client receipts.
          </p>
        </div>

        <button
          onClick={exportSalesCSV}
          className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Sales Log (CSV)</span>
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Total Completed Sales
          </span>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            ${totalGrossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-500 mt-1">Across all registered transactions</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Orders Processed
          </span>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {transactions.length} receipts
          </div>
          <p className="text-xs text-slate-500 mt-1">Real-time ledger entries</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Avg. Ticket Value
          </span>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            $
            {transactions.length > 0
              ? (totalGrossRevenue / transactions.length).toFixed(2)
              : "0.00"}
          </div>
          <p className="text-xs text-slate-500 mt-1">Per transaction average</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by receipt #, customer name, cashier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="all">All Payment Tenders</option>
              <option value="cash">Cash</option>
              <option value="card">Credit / Debit Card</option>
              <option value="transfer">Bank Transfer</option>
              <option value="credit">V79 Credit</option>
            </select>
            <span className="text-xs text-slate-400 font-medium">
              {filtered.length} found
            </span>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                <th className="p-3.5 pl-6">Receipt #</th>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Payment</th>
                <th className="p-3.5 text-center">Items</th>
                <th className="p-3.5 text-right">Amount</th>
                <th className="p-3.5 text-right pr-6">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.map((txn) => {
                const totalItemsCount = txn.items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <tr key={txn.id} className="hover:bg-indigo-50/20 transition-colors">
                    <td className="p-3.5 pl-6 font-mono font-bold text-indigo-600">
                      {txn.receiptNumber}
                    </td>
                    <td className="p-3.5 text-slate-500">
                      {new Date(txn.date).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900">{txn.customerName}</div>
                      {txn.customerContact && (
                        <div className="text-[10px] text-slate-400">{txn.customerContact}</div>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-medium text-[11px]">
                        {txn.paymentMethod}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-slate-700">
                      {totalItemsCount}
                    </td>
                    <td className="p-3.5 text-right font-mono font-black text-slate-900">
                      ${txn.total.toFixed(2)} XCD
                    </td>
                    <td className="p-3.5 text-right pr-6">
                      <button
                        onClick={() => setSelectedTxn(txn)}
                        className="px-3 py-1 bg-white border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-indigo-600 rounded-lg text-xs font-semibold shadow-sm transition-all"
                      >
                        View Receipt
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-semibold text-slate-600">No matching transactions</p>
                    <p className="text-xs text-slate-400">Checkout a sale from the POS to generate receipts.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View / Print Receipt Modal */}
      {selectedTxn && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-6 text-center relative">
              <button
                onClick={() => setSelectedTxn(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 mb-3">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="font-black text-lg tracking-tight">VISION 79 DIGITAL</h3>
              <p className="text-slate-400 text-xs">Official Client POS Receipt</p>
              <div className="mt-2 inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-mono font-bold">
                {selectedTxn.receiptNumber}
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-2 text-slate-500 text-[11px] pb-3 border-b border-slate-100">
                <div>
                  <span className="block text-slate-400">Date:</span>
                  <span className="font-semibold text-slate-700">
                    {new Date(selectedTxn.date).toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-slate-400">Payment:</span>
                  <span className="font-semibold text-slate-700">{selectedTxn.paymentMethod}</span>
                </div>
                <div>
                  <span className="block text-slate-400">Client:</span>
                  <span className="font-semibold text-slate-700">{selectedTxn.customerName}</span>
                </div>
                <div className="text-right">
                  <span className="block text-slate-400">Cashier:</span>
                  <span className="font-semibold text-slate-700">{selectedTxn.cashier}</span>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedTxn.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between text-xs py-1 border-b border-slate-50">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="font-semibold text-slate-800 truncate">{i.item.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {i.quantity} &times; ${i.unitPrice.toFixed(2)}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-slate-800 shrink-0">
                      ${(i.quantity * i.unitPrice).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-mono text-slate-700">${selectedTxn.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>VAT (12.5%)</span>
                  <span className="font-mono text-slate-700">${selectedTxn.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Paid</span>
                  <span className="font-mono text-emerald-600">${selectedTxn.total.toFixed(2)} XCD</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Copy</span>
              </button>
              <button
                onClick={() => setSelectedTxn(null)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
