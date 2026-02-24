import { useState, useMemo } from 'react';
import { InventoryItem } from '../types';
import { Search, ScanLine, ShoppingCart, Plus, Minus, Trash2, CreditCard } from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';

interface POSProps {
  items: InventoryItem[];
  onCheckout: (cart: { item: InventoryItem; quantity: number }[]) => void;
}

export function POS({ items, onCheckout }: POSProps) {
  const [cart, setCart] = useState<{ item: InventoryItem; quantity: number }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items.filter(item => item.quantity > 0);
    return items.filter(item => 
      item.quantity > 0 && (
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.barcode && item.barcode.includes(searchTerm))
      )
    );
  }, [items, searchTerm]);

  const addToCart = (item: InventoryItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        if (existing.quantity >= item.quantity) return prev; // Cannot add more than stock
        return prev.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item, quantity: 1 }];
    });
    setSearchTerm('');
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.item.id === id) {
        const newQuantity = Math.max(1, Math.min(i.item.quantity, i.quantity + delta));
        return { ...i, quantity: newQuantity };
      }
      return i;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.item.id !== id));
  };

  const handleScan = (decodedText: string) => {
    setIsScanning(false);
    const item = items.find(i => i.barcode === decodedText || i.sku === decodedText);
    if (item && item.quantity > 0) {
      addToCart(item);
    } else {
      alert('Item not found or out of stock.');
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    onCheckout(cart);
    setCart([]);
    setCheckoutSuccess(true);
    setTimeout(() => setCheckoutSuccess(false), 3000);
  };

  const total = cart.reduce((sum, { item, quantity }) => sum + item.price * quantity, 0);

  return (
    <div className="flex h-full bg-gray-50">
      {/* Product Selection */}
      <div className="flex-1 p-8 flex flex-col h-full border-r border-gray-200">
        <header className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Point of Sale</h2>
          <p className="text-gray-500 mt-1">Scan or search items to add to cart.</p>
        </header>

        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, SKU, or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-lg shadow-sm"
            />
          </div>
          <button
            onClick={() => setIsScanning(true)}
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-5 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <ScanLine className="w-5 h-5" />
            Scan
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all text-left flex flex-col"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-900 line-clamp-2">{item.name}</h3>
                    <span className="font-mono font-medium text-indigo-600">${item.price.toFixed(2)}</span>
                  </div>
                  <div className="mt-auto flex justify-between items-center text-sm text-gray-500">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{item.sku}</span>
                    <span>{item.quantity} in stock</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              {searchTerm ? `No items found matching "${searchTerm}"` : 'No items available in stock'}
            </div>
          )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-96 bg-white flex flex-col h-full shadow-xl z-10">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-indigo-600" />
            Current Order
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.map(({ item, quantity }) => (
            <div key={item.id} className="flex gap-4 items-start pb-4 border-b border-gray-100 last:border-0">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 line-clamp-2">{item.name}</h4>
                <div className="text-sm text-gray-500 font-mono mt-1">${item.price.toFixed(2)} each</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="font-mono font-bold text-gray-900">${(item.price * quantity).toFixed(2)}</div>
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-200 p-1">
                  <button 
                    onClick={() => updateQuantity(item.id, -1)}
                    disabled={quantity <= 1}
                    className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded disabled:opacity-50"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-mono text-sm w-6 text-center">{quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, 1)}
                    disabled={quantity >= item.quantity}
                    className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded disabled:opacity-50"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <button 
                onClick={() => removeFromCart(item.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Cart is empty
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <div className="flex justify-between items-center mb-4 text-lg">
            <span className="font-medium text-gray-700">Total</span>
            <span className="font-mono font-bold text-2xl text-gray-900">${total.toFixed(2)}</span>
          </div>
          
          {checkoutSuccess ? (
            <div className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2">
              Checkout Successful!
            </div>
          ) : (
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-900/20"
            >
              <CreditCard className="w-6 h-6" />
              Checkout
            </button>
          )}
        </div>
      </div>

      {isScanning && (
        <BarcodeScanner 
          onScan={handleScan} 
          onClose={() => setIsScanning(false)} 
        />
      )}
    </div>
  );
}
