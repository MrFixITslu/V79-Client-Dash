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
}

export type ViewState = 'dashboard' | 'inventory' | 'pos' | 'reports' | 'settings';
