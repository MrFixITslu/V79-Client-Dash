import { useState, useEffect } from 'react';
import { InventoryItem, ViewState } from './types';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { InventoryList } from './components/InventoryList';
import { ItemModal } from './components/ItemModal';
import { Settings } from './components/Settings';
import { POS } from './components/POS';
import { Reports } from './components/Reports';

// Mock initial data
const INITIAL_DATA: InventoryItem[] = [
  { id: '1', name: 'Ergonomic Office Chair', sku: 'FURN-001', category: 'Furniture', quantity: 45, price: 299.99, lastUpdated: new Date().toISOString(), reorderThreshold: 10, tags: ['office', 'ergonomic'], manufacturer: 'Herman Miller' },
  { id: '2', name: 'Mechanical Keyboard', sku: 'TECH-042', category: 'Electronics', quantity: 8, price: 149.50, lastUpdated: new Date().toISOString(), reorderThreshold: 15, tags: ['gaming', 'accessories'], manufacturer: 'Keychron' },
  { id: '3', name: 'Wireless Mouse', sku: 'TECH-043', category: 'Electronics', quantity: 120, price: 59.99, lastUpdated: new Date().toISOString(), reorderThreshold: 20, tags: ['accessories', 'wireless'], manufacturer: 'Logitech' },
  { id: '4', name: 'Standing Desk', sku: 'FURN-002', category: 'Furniture', quantity: 0, price: 499.00, lastUpdated: new Date().toISOString(), reorderThreshold: 5, tags: ['office', 'heavy'], manufacturer: 'Uplift' },
  { id: '5', name: 'Noise Cancelling Headphones', sku: 'TECH-088', category: 'Electronics', quantity: 15, price: 349.99, lastUpdated: new Date().toISOString(), reorderThreshold: 10, tags: ['audio', 'wireless'], manufacturer: 'Sony' },
];

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [items, setItems] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('inventory_items');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_DATA;
      }
    }
    return INITIAL_DATA;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  useEffect(() => {
    localStorage.setItem('inventory_items', JSON.stringify(items));
  }, [items]);

  const handleAddItem = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDeleteItem = (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleSaveItem = (itemData: Omit<InventoryItem, 'id' | 'lastUpdated'>) => {
    if (editingItem) {
      setItems(items.map(item => 
        item.id === editingItem.id 
          ? { ...itemData, id: item.id, lastUpdated: new Date().toISOString() } 
          : item
      ));
    } else {
      const newItem: InventoryItem = {
        ...itemData,
        id: Math.random().toString(36).substr(2, 9),
        lastUpdated: new Date().toISOString(),
      };
      setItems([...items, newItem]);
    }
  };

  const handleSimulateCheckout = (sku: string, quantity: number) => {
    setItems(items.map(item => {
      if (item.sku === sku) {
        return {
          ...item,
          quantity: Math.max(0, item.quantity - quantity),
          lastUpdated: new Date().toISOString()
        };
      }
      return item;
    }));
  };

  const handlePOSCheckout = (cart: { item: InventoryItem; quantity: number }[]) => {
    setItems(prevItems => prevItems.map(item => {
      const cartItem = cart.find(c => c.item.id === item.id);
      if (cartItem) {
        return {
          ...item,
          quantity: Math.max(0, item.quantity - cartItem.quantity),
          lastUpdated: new Date().toISOString()
        };
      }
      return item;
    }));
  };

  const handleImportData = (newItems: InventoryItem[]) => {
    setItems(prevItems => {
      const existingSkus = new Set(prevItems.map(i => i.sku));
      const itemsToAdd = newItems.filter(i => !existingSkus.has(i.sku));
      return [...prevItems, ...itemsToAdd];
    });
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      
      <main className="flex-1 overflow-y-auto">
        {currentView === 'dashboard' && <Dashboard items={items} />}
        {currentView === 'inventory' && (
          <InventoryList 
            items={items} 
            onAdd={handleAddItem}
            onEdit={handleEditItem}
            onDelete={handleDeleteItem}
          />
        )}
        {currentView === 'pos' && (
          <POS items={items} onCheckout={handlePOSCheckout} />
        )}
        {currentView === 'reports' && (
          <Reports items={items} />
        )}
        {currentView === 'settings' && (
          <Settings items={items} onSimulateCheckout={handleSimulateCheckout} onImportData={handleImportData} />
        )}
      </main>

      <ItemModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveItem}
        initialData={editingItem}
      />
    </div>
  );
}
