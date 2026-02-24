export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  price: number;
  lastUpdated: string;
  reorderThreshold: number;
  tags: string[];
  barcode?: string;
  manufacturer?: string;
  imageUrl?: string;
}

export interface User {
  id: string;
  username: string;
  password?: string; // Optional because we don't want to send it to the client session
  role: 'admin' | 'viewer';
  lastLogin?: string;
  permissions?: ViewState[];
}

export type ViewState = 'dashboard' | 'inventory' | 'pos' | 'reports' | 'settings' | 'users' | 'login';
