import { useState, useEffect, FormEvent, useRef, ChangeEvent } from 'react';
import { Save, Link as LinkIcon, Server, CheckCircle2, AlertCircle, ShoppingCart, Upload, FileText, ShieldCheck } from 'lucide-react';
import { InventoryItem } from '../types';

interface SettingsProps {
  items: InventoryItem[];
  onSimulateCheckout: (sku: string, quantity: number) => void;
  onImportData: (items: InventoryItem[]) => void;
  isAdmin: boolean;
}

export function Settings({ items, onSimulateCheckout, onImportData, isAdmin }: SettingsProps) {
  const [posConnected, setPosConnected] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const [simSku, setSimSku] = useState('');
  const [simQty, setSimQty] = useState(1);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved settings
  useEffect(() => {
    const savedApiKey = localStorage.getItem('pos_api_key');
    const savedWebhook = localStorage.getItem('pos_webhook_url');
    const savedConnected = localStorage.getItem('pos_connected') === 'true';
    
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedWebhook) setWebhookUrl(savedWebhook);
    setPosConnected(savedConnected);
  }, []);

  const handleSavePOS = (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Simulate API call
    setTimeout(() => {
      localStorage.setItem('pos_api_key', apiKey);
      localStorage.setItem('pos_webhook_url', webhookUrl);
      localStorage.setItem('pos_connected', 'true');
      setPosConnected(true);
      setIsSaving(false);
      setSaveMessage('POS connection saved successfully!');
      
      setTimeout(() => setSaveMessage(''), 3000);
    }, 1000);
  };

  const handleDisconnect = () => {
    localStorage.removeItem('pos_api_key');
    localStorage.removeItem('pos_webhook_url');
    localStorage.setItem('pos_connected', 'false');
    setApiKey('');
    setWebhookUrl('');
    setPosConnected(false);
  };

  const handleSimulate = (e: FormEvent) => {
    e.preventDefault();
    if (!simSku) return;
    onSimulateCheckout(simSku, simQty);
    setSaveMessage(`Simulated checkout for ${simQty}x ${simSku}`);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csv = event.target?.result as string;
        const lines = csv.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const newItems: InventoryItem[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          
          const values = lines[i].split(',').map(v => v.trim());
          const item: any = {
            id: Math.random().toString(36).substr(2, 9),
            lastUpdated: new Date().toISOString(),
            tags: [],
            reorderThreshold: 10
          };
          
          headers.forEach((header, index) => {
            if (header === 'name') item.name = values[index];
            if (header === 'sku') item.sku = values[index];
            if (header === 'category') item.category = values[index];
            if (header === 'quantity') item.quantity = parseInt(values[index]) || 0;
            if (header === 'price') item.price = parseFloat(values[index]) || 0;
            if (header === 'barcode') item.barcode = values[index];
            if (header === 'manufacturer') item.manufacturer = values[index];
            if (header === 'reorderthreshold') item.reorderThreshold = parseInt(values[index]) || 10;
          });
          
          if (item.name && item.sku) {
            newItems.push(item as InventoryItem);
          }
        }
        
        if (newItems.length > 0) {
          onImportData(newItems);
          setSaveMessage(`Successfully imported ${newItems.length} items from CSV.`);
          setTimeout(() => setSaveMessage(''), 4000);
        } else {
          alert('No valid items found in CSV. Ensure it has name and sku columns.');
        }
      } catch (error) {
        console.error('Error parsing CSV:', error);
        alert('Error parsing CSV file. Please check the format.');
      }
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    
    reader.readAsText(file);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Settings</h2>
        <p className="text-gray-500 mt-1">Manage integrations and application preferences.</p>
      </header>

      {saveMessage && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">{saveMessage}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Security & Access</h3>
            <p className="text-sm text-gray-500">Your current session and access level details.</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600">Access Level</span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
              {isAdmin ? 'Administrator' : 'Viewer'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600">Session Status</span>
            <span className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Active & Encrypted
            </span>
          </div>
          {!isAdmin && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">
                You are currently in <strong>Read-Only</strong> mode. Administrative actions like importing data, managing POS integrations, and editing inventory are restricted.
              </p>
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Data Import</h3>
            <p className="text-sm text-gray-500">Transfer data from your old POS system via CSV upload.</p>
          </div>
        </div>
        <div className="p-6">
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h4 className="text-sm font-medium text-gray-900 mb-1">Click to upload CSV</h4>
            <p className="text-xs text-gray-500">Must include headers: name, sku, category, quantity, price</p>
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">POS Integration</h3>
              <p className="text-sm text-gray-500">Connect to your Point of Sale system to sync inventory automatically.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              {posConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${posConnected ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
            </span>
            <span className={`text-sm font-medium ${posConnected ? 'text-emerald-600' : 'text-gray-500'}`}>
              {posConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="p-6">
          <form onSubmit={handleSavePOS} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">POS API Key</label>
                <input
                  type="password"
                  required
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                  placeholder="sk_live_..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
                <input
                  type="url"
                  required
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="https://your-pos.com/webhooks/inventory"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              {posConnected && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-4 py-2 border border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors"
                >
                  Disconnect
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Connection'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* POS Simulator for demonstration purposes */}
      {posConnected && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Simulate POS Checkout</h3>
              <p className="text-sm text-gray-500">Test the webhook integration by simulating a checkout.</p>
            </div>
          </div>
          <div className="p-6">
            <form onSubmit={handleSimulate} className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Item to Checkout</label>
                <select
                  required
                  value={simSku}
                  onChange={(e) => setSimSku(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                >
                  <option value="">Select an item...</option>
                  {items.map(item => (
                    <option key={item.id} value={item.sku} disabled={item.quantity === 0}>
                      {item.name} ({item.sku}) - {item.quantity} in stock
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-32">
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={simQty}
                  onChange={(e) => setSimQty(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-2 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors shadow-sm h-[42px]"
              >
                Checkout
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )}
</div>
  );
}
