import { useState, useEffect, useCallback } from 'react';
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
import { getInventoryForecast } from './services/aiService';

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('v79_auth_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [users, setUsers] = useState<User[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [isForecasting, setIsForecasting] = useState(false);

  // --- API Calls ---
  const fetchInventory = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      setItems(data);
    } catch (e) {
      console.error("Failed to fetch inventory", e);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      console.error("Failed to fetch users", e);
    }
  }, []);

  // --- WebSocket Setup ---
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'INVENTORY_UPDATED') {
        setItems(message.payload);
      } else if (message.type === 'USERS_UPDATED') {
        setUsers(message.payload);
      }
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    fetchInventory();
    fetchUsers();
  }, [fetchInventory, fetchUsers]);

  // --- AI Forecast ---
  const generateForecast = async () => {
    if (items.length === 0) return;
    setIsForecasting(true);
    const data = await getInventoryForecast(items);
    setForecast(data);
    setIsForecasting(false);
  };

  const handleLogin = (username: string, role: 'admin' | 'viewer') => {
    const foundUserInList = users.find(u => u.username === username);
    const newUser: User = { 
      id: foundUserInList?.id || Math.random().toString(36).substr(2, 9), 
      username, 
      role, 
      lastLogin: new Date().toISOString(),
      permissions: foundUserInList?.permissions || ['dashboard', 'inventory', 'pos', 'reports', 'settings']
    };
    setUser(newUser);
    localStorage.setItem('v79_auth_user', JSON.stringify(newUser));
    
    // Update last login on server
    if (foundUserInList) {
      fetch(`/api/users/${foundUserInList.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...foundUserInList, lastLogin: new Date().toISOString() })
      });
    }
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

  const handleDeleteItem = async (id: string) => {
    if (user?.role !== 'admin') return;
    if (window.confirm('Are you sure you want to delete this item?')) {
      await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
      fetchInventory();
    }
  };

  const handleSaveItem = async (itemData: Omit<InventoryItem, 'id' | 'lastUpdated'>) => {
    if (user?.role !== 'admin') return;
    if (editingItem) {
      await fetch(`/api/inventory/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData)
      });
    } else {
      await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData)
      });
    }
    fetchInventory();
  };

  const handleSimulateCheckout = async (sku: string, quantity: number) => {
    const item = items.find(i => i.sku === sku);
    if (item) {
      await handlePOSCheckout([{ item, quantity }]);
    }
  };

  const handlePOSCheckout = async (cart: { item: InventoryItem; quantity: number }[]) => {
    await fetch('/api/pos/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart })
    });
    fetchInventory();
  };

  const handleImportData = async (newItems: InventoryItem[]) => {
    if (user?.role !== 'admin') return;
    for (const item of newItems) {
      await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
    }
    fetchInventory();
  };

  const handleAddUser = async (userData: Omit<User, 'id'>) => {
    if (user?.role !== 'admin') return;
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    fetchUsers();
  };

  const handleUpdateUser = async (updatedUser: User) => {
    if (user?.role !== 'admin') return;
    await fetch(`/api/users/${updatedUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUser)
    });
    fetchUsers();
  };

  const handleDeleteUser = async (id: string) => {
    if (user?.role !== 'admin') return;
    if (window.confirm('Are you sure you want to delete this user?')) {
      await fetch(`/api/users/${id}`, { method: 'DELETE' });
      fetchUsers();
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
        {currentView === 'dashboard' && (
          <Dashboard 
            items={items} 
            forecast={forecast} 
            onGenerateForecast={generateForecast} 
            isForecasting={isForecasting}
          />
        )}
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
