import { useState, useEffect } from 'react';
import { InventoryItem, ViewState, User } from './types';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { InventoryList } from './components/InventoryList';
import { ItemModal } from './components/ItemModal';
import { Settings } from './components/Settings';
import { POS } from './components/POS';
import { Reports } from './components/Reports';
import { Login } from './components/Login';
import { UserManagement } from './components/UserManagement';

// Mock initial data
const INITIAL_DATA: InventoryItem[] = [
  { id: '1', name: 'Ergonomic Office Chair', sku: 'FURN-001', category: 'Furniture', quantity: 45, price: 299.99, lastUpdated: new Date().toISOString(), reorderThreshold: 10, tags: ['office', 'ergonomic'], manufacturer: 'Herman Miller' },
  { id: '2', name: 'Mechanical Keyboard', sku: 'TECH-042', category: 'Electronics', quantity: 8, price: 149.50, lastUpdated: new Date().toISOString(), reorderThreshold: 15, tags: ['gaming', 'accessories'], manufacturer: 'Keychron' },
  { id: '3', name: 'Wireless Mouse', sku: 'TECH-043', category: 'Electronics', quantity: 120, price: 59.99, lastUpdated: new Date().toISOString(), reorderThreshold: 20, tags: ['accessories', 'wireless'], manufacturer: 'Logitech' },
  { id: '4', name: 'Standing Desk', sku: 'FURN-002', category: 'Furniture', quantity: 0, price: 499.00, lastUpdated: new Date().toISOString(), reorderThreshold: 5, tags: ['office', 'heavy'], manufacturer: 'Uplift' },
  { id: '5', name: 'Noise Cancelling Headphones', sku: 'TECH-088', category: 'Electronics', quantity: 15, price: 349.99, lastUpdated: new Date().toISOString(), reorderThreshold: 10, tags: ['audio', 'wireless'], manufacturer: 'Sony' },
];

const INITIAL_USERS: User[] = [
  { id: '1', username: 'admin', password: 'password123', role: 'admin', permissions: ['dashboard', 'inventory', 'pos', 'reports', 'settings', 'users'] },
  { id: '2', username: 'viewer', password: 'viewer123', role: 'viewer', permissions: ['dashboard', 'inventory', 'pos', 'reports'] },
];

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('v79_auth_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('v79_system_users');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_USERS;
      }
    }
    return INITIAL_USERS;
  });
  
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

  useEffect(() => {
    localStorage.setItem('v79_system_users', JSON.stringify(users));
  }, [users]);

  const handleLogin = (username: string, role: 'admin' | 'viewer') => {
    const foundUserInList = users.find(u => u.username === username);
    const newUser: User = { 
      id: Math.random().toString(36).substr(2, 9), 
      username, 
      role, 
      lastLogin: new Date().toISOString(),
      permissions: foundUserInList?.permissions || ['dashboard', 'inventory', 'pos', 'reports', 'settings']
    };
    setUser(newUser);
    localStorage.setItem('v79_auth_user', JSON.stringify(newUser));
    
    // Update last login for the user in the list
    setUsers(prev => prev.map(u => u.username === username ? { ...u, lastLogin: new Date().toISOString() } : u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('v79_auth_user');
    setCurrentView('dashboard');
  };

  const handleAddItem = () => {
    if (user?.role !== 'admin') return;
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleEditItem = (item: InventoryItem) => {
    if (user?.role !== 'admin') return;
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDeleteItem = (id: string) => {
    if (user?.role !== 'admin') return;
    if (window.confirm('Are you sure you want to delete this item?')) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleSaveItem = (itemData: Omit<InventoryItem, 'id' | 'lastUpdated'>) => {
    if (user?.role !== 'admin') return;
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
    if (user?.role !== 'admin') return;
    setItems(prevItems => {
      const existingSkus = new Set(prevItems.map(i => i.sku));
      const itemsToAdd = newItems.filter(i => !existingSkus.has(i.sku));
      return [...prevItems, ...itemsToAdd];
    });
  };

  const handleAddUser = (userData: Omit<User, 'id'>) => {
    if (user?.role !== 'admin') return;
    const newUser: User = {
      ...userData,
      id: Math.random().toString(36).substr(2, 9),
    };
    setUsers([...users, newUser]);
  };

  const handleUpdateUser = (updatedUser: User) => {
    if (user?.role !== 'admin') return;
    setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const handleDeleteUser = (id: string) => {
    if (user?.role !== 'admin') return;
    if (window.confirm('Are you sure you want to delete this user?')) {
      setUsers(users.filter(u => u.id !== id));
    }
  };

  if (!user) {
    return <Login onLogin={handleLogin} users={users} />;
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        onLogout={handleLogout} 
        isAdmin={user.role === 'admin'} 
        permissions={user.permissions || ['dashboard', 'inventory', 'pos', 'reports', 'settings']}
      />
      
      <main className="flex-1 overflow-y-auto">
        {currentView === 'dashboard' && <Dashboard items={items} />}
        {currentView === 'inventory' && (
          <InventoryList 
            items={items} 
            onAdd={handleAddItem}
            onEdit={handleEditItem}
            onDelete={handleDeleteItem}
            isAdmin={user.role === 'admin'}
          />
        )}
        {currentView === 'pos' && (
          <POS items={items} onCheckout={handlePOSCheckout} />
        )}
        {currentView === 'reports' && (
          <Reports items={items} />
        )}
        {currentView === 'users' && user.role === 'admin' && (
          <UserManagement 
            users={users} 
            onAddUser={handleAddUser} 
            onUpdateUser={handleUpdateUser} 
            onDeleteUser={handleDeleteUser} 
          />
        )}
        {currentView === 'settings' && (
          <Settings 
            items={items} 
            onSimulateCheckout={handleSimulateCheckout} 
            onImportData={handleImportData} 
            isAdmin={user.role === 'admin'}
          />
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
