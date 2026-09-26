export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  price: number;
  costPrice?: number;
  lastUpdated: string;
  reorderThreshold: number;
  tags: string[];
  barcode?: string;
  manufacturer?: string;
  imageUrl?: string;
  location?: string;
}

export type UserRole = 'admin' | 'manager' | 'staff' | 'viewer';

export interface User {
  id: string;
  username: string;
  fullName?: string;
  role: UserRole;
  permissions?: ViewState[];
  lastLogin?: string;
  createdAt?: string;
}

export interface TransactionItem {
  item: {
    id: string;
    name: string;
    sku: string;
    category: string;
    price: number;
  };
  quantity: number;
  unitPrice: number;
}

export interface Transaction {
  id: string;
  receiptNumber: string;
  date: string;
  customerName: string;
  customerContact?: string;
  paymentMethod: string;
  items: TransactionItem[];
  subtotal: number;
  tax: number;
  total: number;
  cashier: string;
  notes?: string;
  status: 'completed' | 'refunded';
}

export interface StoreSettings {
  companyName: string;
  tradingName: string;
  country: string;
  city: string;
  email: string;
  phone: string;
  currency: string;
  taxRate: number;
  enableTax: boolean;
  posApiKey?: string;
  webhookUrl?: string;
}

export interface AIForecastRecommendation {
  itemName: string;
  action: string;
  urgency: 'Critical' | 'Moderate' | 'Good' | string;
  reason: string;
  suggestedOrder?: number;
}

export interface AIForecastRisk {
  name: string;
  daysRemaining: number;
  priority: string;
}

export interface AIForecast {
  summary: string;
  healthScore: number;
  riskLevel: 'Low' | 'Medium' | 'High' | string;
  recommendations: AIForecastRecommendation[];
  categoryInsights?: string[];
  topStockoutRisks?: AIForecastRisk[];
}

export type ViewState =
  | 'overview'
  | 'connections'
  | 'team'
  | 'security'
  | 'billing'
  | 'dashboard'
  | 'inventory'
  | 'invoices'
  | 'reports'
  | 'ecosystem'
  | 'users'
  | 'settings';

export type EcosystemCategory =
  | 'finance'
  | 'support'
  | 'marketing'
  | 'operations'
  | 'analytics'
  | 'team';

export interface EcosystemApp {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  category: EcosystemCategory;
  status: 'active' | 'syncing' | 'maintenance' | 'beta';
  appUrl: string;
  githubRepo?: string;
  iconName: string;
  colorScheme: {
    primary: string;
    bgGradient: string;
    badgeBg: string;
    badgeText: string;
    border: string;
  };
  metrics?: {
    label: string;
    value: string;
    sublabel?: string;
  }[];
  features: string[];
  ssoSupported: boolean;
  isFlagship?: boolean;
  version?: string;
  lastSync?: string;
}

export interface TiquetTicket {
  id: string;
  ticketNumber: string;
  title: string;
  clientName: string;
  clientContact: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: 'open' | 'in_progress' | 'waiting_parts' | 'resolved';
  linkedSku?: string;
  linkedItemName?: string;
  technician: string;
  createdAt: string;
  slaDeadline: string;
  notes: string;
}

export interface FFPROSyncRecord {
  id: string;
  date: string;
  type: 'pos_revenue' | 'inventory_asset_valuation' | 'cogs_expense';
  title: string;
  amount: number;
  status: 'synced' | 'pending';
  source: string;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  channel: 'WhatsApp Business' | 'Instagram' | 'LinkedIn' | 'Email' | 'Store Display';
  discountCode?: string;
  discountPercent?: number;
  targetProduct?: string;
  reach: number;
  conversions: number;
  status: 'active' | 'scheduled' | 'ended';
  budgetXCD: number;
}
