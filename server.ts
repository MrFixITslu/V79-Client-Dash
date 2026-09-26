import express, { Request, Response } from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json({ limit: "50mb" }));

// --- Persistent File Store ---
const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "v79_store.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  price: number;
  costPrice: number;
  lastUpdated: string;
  reorderThreshold: number;
  tags: string[];
  barcode?: string;
  manufacturer?: string;
  imageUrl?: string;
  location?: string;
}

interface StoredUser {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: "admin" | "manager" | "staff" | "viewer";
  permissions: string[];
  lastLogin?: string;
  createdAt: string;
}

interface Transaction {
  id: string;
  receiptNumber: string;
  date: string;
  customerName: string;
  customerContact?: string;
  paymentMethod: string;
  items: {
    item: {
      id: string;
      name: string;
      sku: string;
      category: string;
      price: number;
    };
    quantity: number;
    unitPrice: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  cashier: string;
  notes?: string;
  status: "completed" | "refunded";
}

interface StoreSettings {
  companyName: string;
  tradingName: string;
  country: string;
  city: string;
  email: string;
  phone: string;
  currency: string;
  taxRate: number; // e.g. 12.5%
  enableTax: boolean;
  posApiKey?: string;
  webhookUrl?: string;
}

interface EcosystemApp {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  category: "finance" | "support" | "marketing" | "operations" | "analytics" | "team";
  status: "active" | "syncing" | "maintenance" | "beta";
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

interface TiquetTicket {
  id: string;
  ticketNumber: string;
  title: string;
  clientName: string;
  clientContact: string;
  priority: "urgent" | "high" | "normal" | "low";
  status: "open" | "in_progress" | "waiting_parts" | "resolved";
  linkedSku?: string;
  linkedItemName?: string;
  technician: string;
  createdAt: string;
  slaDeadline: string;
  notes: string;
}

interface FFPROSyncRecord {
  id: string;
  date: string;
  type: "pos_revenue" | "inventory_asset_valuation" | "cogs_expense";
  title: string;
  amount: number;
  status: "synced" | "pending";
  source: string;
}

interface MarketingCampaign {
  id: string;
  name: string;
  channel: "WhatsApp Business" | "Instagram" | "LinkedIn" | "Email" | "Store Display";
  discountCode?: string;
  discountPercent?: number;
  targetProduct?: string;
  reach: number;
  conversions: number;
  status: "active" | "scheduled" | "ended";
  budgetXCD: number;
}

interface AppStore {
  inventory: InventoryItem[];
  users: StoredUser[];
  transactions: Transaction[];
  settings: StoreSettings;
  ecosystemApps: EcosystemApp[];
  tickets: TiquetTicket[];
  ffproRecords: FFPROSyncRecord[];
  marketingCampaigns: MarketingCampaign[];
}

// Initial Seed Data
const defaultInventory: InventoryItem[] = [
  {
    id: "v79-1",
    name: "UniFi Dream Machine Pro (UDM-Pro)",
    sku: "NET-UDM-001",
    category: "Networking",
    quantity: 14,
    price: 499.00,
    costPrice: 380.00,
    lastUpdated: new Date().toISOString(),
    reorderThreshold: 5,
    tags: ["ubiquiti", "routing", "firewall", "rackmount"],
    barcode: "810354918231",
    manufacturer: "Ubiquiti Networks",
    location: "Rack A-01",
    imageUrl: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "v79-2",
    name: "Cisco Catalyst 24-Port Gigabit PoE+ Switch",
    sku: "NET-CS-24P",
    category: "Networking",
    quantity: 6,
    price: 649.99,
    costPrice: 480.00,
    lastUpdated: new Date().toISOString(),
    reorderThreshold: 8,
    tags: ["cisco", "switch", "poe", "managed"],
    barcode: "882658129034",
    manufacturer: "Cisco Systems",
    location: "Rack A-02",
    imageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "v79-3",
    name: "Star Micronics TSP143III Thermal POS Printer",
    sku: "POS-PRN-010",
    category: "POS Hardware",
    quantity: 18,
    price: 245.00,
    costPrice: 175.00,
    lastUpdated: new Date().toISOString(),
    reorderThreshold: 10,
    tags: ["thermal", "receipt", "usb", "pos"],
    barcode: "088047011922",
    manufacturer: "Star Micronics",
    location: "Shelf B-04",
    imageUrl: "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "v79-4",
    name: "Zebra DS2208 Handheld 2D Barcode Scanner",
    sku: "POS-SCN-220",
    category: "POS Hardware",
    quantity: 25,
    price: 119.50,
    costPrice: 78.00,
    lastUpdated: new Date().toISOString(),
    reorderThreshold: 12,
    tags: ["scanner", "2d", "qr", "usb"],
    barcode: "753584820193",
    manufacturer: "Zebra Technologies",
    location: "Shelf B-02",
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "v79-5",
    name: "APC Smart-UPS 1500VA LCD 120V Battery Backup",
    sku: "PWR-UPS-1500",
    category: "Power & Infrastructure",
    quantity: 4,
    price: 589.00,
    costPrice: 440.00,
    lastUpdated: new Date().toISOString(),
    reorderThreshold: 5,
    tags: ["apc", "ups", "surge", "battery"],
    barcode: "731304268712",
    manufacturer: "Schneider Electric",
    location: "Bay C-Floor",
    imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "v79-6",
    name: "Cat6A Pure Copper Bulk Cable Spool 1000ft (Blue)",
    sku: "CAB-C6A-1000",
    category: "Cabling & Infrastructure",
    quantity: 32,
    price: 185.00,
    costPrice: 120.00,
    lastUpdated: new Date().toISOString(),
    reorderThreshold: 15,
    tags: ["cable", "cat6a", "bulk", "networking"],
    barcode: "639725890123",
    manufacturer: "TrueCable",
    location: "Warehouse D-10",
    imageUrl: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "v79-7",
    name: "Logitech MX Master 3S Wireless Performance Mouse",
    sku: "ACC-LOG-MX3S",
    category: "Peripherals & Workstations",
    quantity: 42,
    price: 99.99,
    costPrice: 72.00,
    lastUpdated: new Date().toISOString(),
    reorderThreshold: 10,
    tags: ["logitech", "bluetooth", "ergonomic", "mouse"],
    barcode: "097855174543",
    manufacturer: "Logitech",
    location: "Shelf E-01",
    imageUrl: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "v79-8",
    name: "Keychron K2 Pro QMK/VIA Wireless Keyboard",
    sku: "ACC-KEY-K2P",
    category: "Peripherals & Workstations",
    quantity: 19,
    price: 139.00,
    costPrice: 95.00,
    lastUpdated: new Date().toISOString(),
    reorderThreshold: 8,
    tags: ["keyboard", "mechanical", "wireless", "rgb"],
    barcode: "697241285012",
    manufacturer: "Keychron",
    location: "Shelf E-03",
    imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "v79-9",
    name: "Dell UltraSharp 27 4K USB-C Hub Monitor (U2723QE)",
    sku: "MON-DEL-27U",
    category: "Peripherals & Workstations",
    quantity: 7,
    price: 620.00,
    costPrice: 470.00,
    lastUpdated: new Date().toISOString(),
    reorderThreshold: 5,
    tags: ["monitor", "4k", "ips", "usbc", "dell"],
    barcode: "884116398210",
    manufacturer: "Dell Technologies",
    location: "Storage F-02",
    imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop&q=80"
  },
  {
    id: "v79-10",
    name: "Heavy-Duty 16-Inch POS Steel Cash Drawer",
    sku: "POS-CSH-16B",
    category: "POS Hardware",
    quantity: 11,
    price: 89.00,
    costPrice: 55.00,
    lastUpdated: new Date().toISOString(),
    reorderThreshold: 6,
    tags: ["cash drawer", "steel", "security", "rj12"],
    barcode: "712398450192",
    manufacturer: "APG Cash Drawer",
    location: "Shelf B-06",
    imageUrl: "https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=500&auto=format&fit=crop&q=80"
  }
];

const defaultUsers: StoredUser[] = [
  {
    id: "u-1",
    username: "admin",
    password: "password123",
    fullName: "System Administrator",
    role: "admin",
    permissions: ["dashboard", "inventory", "pos", "invoices", "reports", "settings", "users"],
    lastLogin: new Date().toISOString(),
    createdAt: new Date().toISOString()
  },
  {
    id: "u-2",
    username: "manager",
    password: "manager123",
    fullName: "Operations Manager",
    role: "manager",
    permissions: ["dashboard", "inventory", "pos", "invoices", "reports", "settings"],
    lastLogin: new Date().toISOString(),
    createdAt: new Date().toISOString()
  },
  {
    id: "u-3",
    username: "staff",
    password: "viewer123",
    fullName: "Front Desk Cashier",
    role: "staff",
    permissions: ["dashboard", "inventory", "pos", "invoices", "reports"],
    lastLogin: new Date().toISOString(),
    createdAt: new Date().toISOString()
  },
  {
    id: "u-4",
    username: "viewer",
    password: "viewer123",
    fullName: "Guest Auditor",
    role: "viewer",
    permissions: ["dashboard", "inventory", "reports"],
    lastLogin: new Date().toISOString(),
    createdAt: new Date().toISOString()
  }
];

const defaultTransactions: Transaction[] = [
  {
    id: "txn_1740001",
    receiptNumber: "V79-2026-1082",
    date: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    customerName: "St. Lucia Ministry of Infrastructure",
    customerContact: "ict@govt.lc",
    paymentMethod: "Bank Transfer",
    items: [
      {
        item: {
          id: "v79-1",
          name: "UniFi Dream Machine Pro (UDM-Pro)",
          sku: "NET-UDM-001",
          category: "Networking",
          price: 499.00
        },
        quantity: 2,
        unitPrice: 499.00
      },
      {
        item: {
          id: "v79-6",
          name: "Cat6A Pure Copper Bulk Cable Spool 1000ft (Blue)",
          sku: "CAB-C6A-1000",
          category: "Cabling & Infrastructure",
          price: 185.00
        },
        quantity: 3,
        unitPrice: 185.00
      }
    ],
    subtotal: 1553.00,
    tax: 194.13,
    total: 1747.13,
    cashier: "admin",
    notes: "Site office networking project deployment",
    status: "completed"
  },
  {
    id: "txn_1740002",
    receiptNumber: "V79-2026-1083",
    date: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
    customerName: "Baywalk Retail Point",
    customerContact: "accounts@baywalkslu.com",
    paymentMethod: "Credit Card",
    items: [
      {
        item: {
          id: "v79-3",
          name: "Star Micronics TSP143III Thermal POS Printer",
          sku: "POS-PRN-010",
          category: "POS Hardware",
          price: 245.00
        },
        quantity: 1,
        unitPrice: 245.00
      },
      {
        item: {
          id: "v79-4",
          name: "Zebra DS2208 Handheld 2D Barcode Scanner",
          sku: "POS-SCN-220",
          category: "POS Hardware",
          price: 119.50
        },
        quantity: 1,
        unitPrice: 119.50
      }
    ],
    subtotal: 364.50,
    tax: 45.56,
    total: 410.06,
    cashier: "staff",
    notes: "Register #2 upgrade kit",
    status: "completed"
  }
];

const defaultSettings: StoreSettings = {
  companyName: "Vision 79 Ltd",
  tradingName: "V79 Digital Hub",
  country: "Saint Lucia",
  city: "Castries",
  email: "Vision79SLU@gmail.com",
  phone: "+1 (758) 450-7979",
  currency: "XCD",
  taxRate: 12.5,
  enableTax: true,
  posApiKey: "v79_live_pos_key_sec99",
  webhookUrl: "https://api.vision79.lc/webhooks/pos"
};

const defaultEcosystemApps: EcosystemApp[] = [
  {
    id: "app-ffpro",
    name: "Fire Finance Pro (FFPRO)",
    shortName: "FFPRO",
    tagline: "Strategic Personal & Enterprise Wealth Hub",
    description: "Cloud-synchronized personal & business finance engine. Manages cash flow forecasting, net worth, automated budgeting, and seamless register sync with V79 POS.",
    category: "finance",
    status: "active",
    appUrl: "https://ffpro.v79sl.com",
    githubRepo: "https://github.com/MrFixITslu/FFPRO",
    iconName: "Wallet",
    colorScheme: {
      primary: "from-amber-500 to-orange-600",
      bgGradient: "bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent",
      badgeBg: "bg-amber-500/15 border-amber-500/30",
      badgeText: "text-amber-400",
      border: "border-amber-500/30 hover:border-amber-500/60"
    },
    metrics: [
      { label: "Cash Inflow (MTD)", value: "$28,450 XCD", sublabel: "+12.4% vs last mo" },
      { label: "Budget Health", value: "94.2%", sublabel: "Optimal allocation" },
      { label: "Wealth Forecast", value: "+18.4% YoY", sublabel: "Next 12 months" }
    ],
    features: [
      "Real-time POS Cash Register Sync",
      "Cash Flow & Burn Forecasting",
      "Capital Expenditure & Depreciation",
      "Interactive Goal Planner",
      "V79 Unified SSO Authentication"
    ],
    ssoSupported: true,
    isFlagship: true,
    version: "v2.4.0",
    lastSync: new Date(Date.now() - 15 * 60 * 1000).toISOString()
  },
  {
    id: "app-tiquet",
    name: "V79 Tiquet (Service Desk & RMA)",
    shortName: "Tiquet",
    tagline: "Omnichannel Support, Service Desk & RMA Dispatch",
    description: "Enterprise ticketing system and field technician dispatch. Directly links work orders to inventory replacement parts, warranty SLAs, and POS client invoices.",
    category: "support",
    status: "active",
    appUrl: "https://tiquet.v79sl.com",
    githubRepo: "https://github.com/MrFixITslu/V79Tiquet",
    iconName: "Headphones",
    colorScheme: {
      primary: "from-blue-600 to-cyan-600",
      bgGradient: "bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent",
      badgeBg: "bg-blue-500/15 border-blue-500/30",
      badgeText: "text-blue-400",
      border: "border-blue-500/30 hover:border-blue-500/60"
    },
    metrics: [
      { label: "Open Service Tickets", value: "4 Active", sublabel: "1 urgent RMA" },
      { label: "Avg SLA Resolution", value: "1.4 hrs", sublabel: "Target < 4 hrs" },
      { label: "SLA Adherence Rate", value: "98.5%", sublabel: "Last 30 days" }
    ],
    features: [
      "Direct Inventory Hardware/SKU Linking",
      "Field Dispatch & Technician Tracker",
      "Automated WhatsApp & Email SLA Alerts",
      "Hardware RMA & Warranty Tracking",
      "One-Click Ticket from POS Receipts"
    ],
    ssoSupported: true,
    isFlagship: true,
    version: "v3.1.2",
    lastSync: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  },
  {
    id: "app-marketing",
    name: "V79 Marketing Suite",
    shortName: "Marketing",
    tagline: "Campaign Orchestration & Brand Asset Management",
    description: "Unified digital marketing and promotional campaign platform. Automates promo codes, social media broadcasting, customer WhatsApp campaigns, and ad attribution.",
    category: "marketing",
    status: "active",
    appUrl: "https://marketing.v79sl.com",
    githubRepo: "https://github.com/MrFixITslu/V79Marketing",
    iconName: "Megaphone",
    colorScheme: {
      primary: "from-pink-500 to-rose-600",
      bgGradient: "bg-gradient-to-br from-pink-500/10 via-rose-500/5 to-transparent",
      badgeBg: "bg-pink-500/15 border-pink-500/30",
      badgeText: "text-pink-400",
      border: "border-pink-500/30 hover:border-pink-500/60"
    },
    metrics: [
      { label: "Active Campaigns", value: "3 Live", sublabel: "Instagram + WhatsApp" },
      { label: "Audience Reach", value: "14.2k", sublabel: "St. Lucia & Caribbean" },
      { label: "Campaign ROI", value: "4.8x", sublabel: "$12.8k converted sales" }
    ],
    features: [
      "POS Coupon & Discount Generator",
      "Social Media Campaign Scheduler",
      "Product Launch Asset Library",
      "Conversion Attribution & Lead CRM",
      "Direct Inventory Item Promotion"
    ],
    ssoSupported: true,
    isFlagship: true,
    version: "v1.9.0",
    lastSync: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  },
  {
    id: "app-academy",
    name: "V79 Academy (Learning & Capability)",
    shortName: "Academy",
    tagline: "Public Training & Capability Development",
    description: "Public training stays independent; businesses can link learner progress to their Hub.",
    category: "team",
    status: "active",
    appUrl: "https://academy.v79sl.com",
    githubRepo: "https://github.com/MrFixITslu/V79Academy",
    iconName: "GraduationCap",
    colorScheme: {
      primary: "from-blue-600 to-indigo-700",
      bgGradient: "bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent",
      badgeBg: "bg-teal-500/15 border-teal-500/30",
      badgeText: "text-teal-400",
      border: "border-teal-500/30 hover:border-teal-500/60"
    },
    metrics: [
      { label: "Enrolled", value: "1", sublabel: "Active learner" },
      { label: "Progress", value: "0%", sublabel: "Initial onboarding" },
      { label: "Certificates", value: "0", sublabel: "In progress" }
    ],
    features: [
      "Public & Independent Training Modules",
      "Employee Hub Learner Sync",
      "Hardware Repair & POS Safety Certifications",
      "Customer Care Masterclasses",
      "Verifiable Digital Completion Badges"
    ],
    ssoSupported: true,
    isFlagship: true,
    version: "v1.0.8",
    lastSync: new Date().toISOString()
  },
  {
    id: "app-v79pos",
    name: "V79 POS (Point of Sale & Register)",
    shortName: "V79 POS",
    tagline: "High-Performance Omnichannel Point of Sale & Register Terminal",
    description: "Cloud-synchronized retail register checkout, hardware peripherals (receipt printers, barcode scanners, cash drawers), offline resiliency, and real-time inventory deduction.",
    category: "operations",
    status: "active",
    appUrl: "https://pos.v79sl.com",
    githubRepo: "https://github.com/MrFixITslu/v79pos",
    iconName: "CreditCard",
    colorScheme: {
      primary: "from-emerald-500 to-teal-600",
      bgGradient: "bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent",
      badgeBg: "bg-emerald-500/15 border-emerald-500/30",
      badgeText: "text-emerald-400",
      border: "border-emerald-500/30 hover:border-emerald-500/60"
    },
    metrics: [
      { label: "Terminal URL", value: "pos.v79sl.com", sublabel: "Live production sync" },
      { label: "Hardware Link", value: "Ready", sublabel: "Thermal & Drawer kick" },
      { label: "Checkout Velocity", value: "< 1.2s", sublabel: "Sub-second scanning" }
    ],
    features: [
      "Barcode Scanner & Thermal Printer Ready",
      "Offline-Resilient Cart Queue",
      "Split Payments & Multi-Currency (XCD/USD)",
      "Customer Loyalty & Promo Vouchers",
      "Live Multi-Terminal Inventory Sync"
    ],
    ssoSupported: true,
    isFlagship: true,
    version: "v2.5.0",
    lastSync: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  },
  {
    id: "app-analytics",
    name: "V79 Analytics & BI",
    shortName: "Analytics",
    tagline: "Cross-Ecosystem Telemetry & Executive Insights",
    description: "Deep business intelligence combining POS cash receipts, FFPRO finance books, support ticket costs from Tiquet, and advertising metrics into one executive cockpit.",
    category: "analytics",
    status: "active",
    appUrl: "https://analytics.vision79.lc",
    githubRepo: "https://github.com/MrFixITslu/V79Analytics",
    iconName: "LineChart",
    colorScheme: {
      primary: "from-violet-600 to-indigo-600",
      bgGradient: "bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent",
      badgeBg: "bg-violet-500/15 border-violet-500/30",
      badgeText: "text-violet-400",
      border: "border-violet-500/30 hover:border-violet-500/60"
    },
    metrics: [
      { label: "Catalog Sales Velocity", value: "34.5 items/d", sublabel: "+8.2% week-on-week" },
      { label: "Blended Gross Margin", value: "33.8%", sublabel: "Target 30%" },
      { label: "Client Retention Rate", value: "88.4%", sublabel: "30-day recurring" }
    ],
    features: [
      "Cross-App Executive Telemetry",
      "Customer Lifetime Value (LTV) Cohorts",
      "Stockout Revenue Impact Calculator",
      "Daily Sales vs Expense Waterfall",
      "Executive PDF Reporting Export"
    ],
    ssoSupported: true,
    isFlagship: false,
    version: "v1.5.0",
    lastSync: new Date(Date.now() - 45 * 60 * 1000).toISOString()
  },
  {
    id: "app-lifehealth",
    name: "LifeHealth SLU (Team & Safety)",
    shortName: "LifeHealth",
    tagline: "Staff Rostering, Field Certifications & OSHA Safety",
    description: "Workforce health, scheduling, technician OSHA compliance, tool safety checks, and employee wellness portal for Vision 79 field staff.",
    category: "team",
    status: "active",
    appUrl: "https://lifehealth.vision79.lc",
    githubRepo: "https://github.com/MrFixITslu/LifeHealthSLU",
    iconName: "HeartPulse",
    colorScheme: {
      primary: "from-teal-500 to-emerald-600",
      bgGradient: "bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-transparent",
      badgeBg: "bg-teal-500/15 border-teal-500/30",
      badgeText: "text-teal-400",
      border: "border-teal-500/30 hover:border-teal-500/60"
    },
    metrics: [
      { label: "Active Field Roster", value: "8 Staff", sublabel: "All shifts staffed" },
      { label: "Safety Compliance", value: "100%", sublabel: "OSHA certifications current" },
      { label: "Wellness Index", value: "9.2/10", sublabel: "Team survey score" }
    ],
    features: [
      "Field Technician Shift Scheduler",
      "OSHA & Equipment Safety Log",
      "Driver & High-Voltage Certifications",
      "Team Wellness Check-ins",
      "Incident Reporting & Emergency Contacts"
    ],
    ssoSupported: true,
    isFlagship: false,
    version: "v1.2.0",
    lastSync: new Date(Date.now() - 60 * 60 * 1000).toISOString()
  }
];

const defaultTickets: TiquetTicket[] = [
  {
    id: "tiq-1",
    ticketNumber: "TIQ-4091",
    title: "UniFi UDM-Pro SFP+ 10G WAN Link Flapping",
    clientName: "Castries Port Authority",
    clientContact: "+1 (758) 457-6100",
    priority: "urgent",
    status: "open",
    linkedSku: "NET-UDM-001",
    linkedItemName: "UniFi Dream Machine Pro (UDM-Pro)",
    technician: "Marcus Theodore (Lead Network Eng)",
    createdAt: new Date(Date.now() - 1000 * 3600 * 3).toISOString(),
    slaDeadline: new Date(Date.now() + 1000 * 3600 * 1).toISOString(),
    notes: "Main optical transceiver dropping packets on high tide telemetry. Dispatched technician with replacement Cat6A & 10G SFP+ module."
  },
  {
    id: "tiq-2",
    ticketNumber: "TIQ-4092",
    title: "Thermal Printer Auto-Cutter Failure on POS Register #3",
    clientName: "Rodney Bay Marina Duty Free",
    clientContact: "it@rbmarina.lc",
    priority: "high",
    status: "in_progress",
    linkedSku: "POS-PRN-010",
    linkedItemName: "Star Micronics TSP143III Thermal Printer",
    technician: "Darren St. Rose (Hardware Tech)",
    createdAt: new Date(Date.now() - 1000 * 3600 * 5).toISOString(),
    slaDeadline: new Date(Date.now() + 1000 * 3600 * 3).toISOString(),
    notes: "Cutter blade jammed on thick receipt stock. Cleaned sensor and running diagnostic self-test."
  },
  {
    id: "tiq-3",
    ticketNumber: "TIQ-4093",
    title: "Cash Drawer 24V Solenoid RJ12 Kick Trigger Malfunction",
    clientName: "Vieux Fort Hardware & Supplies",
    clientContact: "+1 (758) 454-9988",
    priority: "normal",
    status: "waiting_parts",
    linkedSku: "POS-CAS-001",
    linkedItemName: "APG Vasario Heavy Duty Cash Drawer 1616",
    technician: "Darren St. Rose (Hardware Tech)",
    createdAt: new Date(Date.now() - 1000 * 3600 * 24).toISOString(),
    slaDeadline: new Date(Date.now() + 1000 * 3600 * 12).toISOString(),
    notes: "Awaiting replacement interface cable RJ12-to-Star printer from inventory Bay B-05."
  },
  {
    id: "tiq-4",
    ticketNumber: "TIQ-4094",
    title: "Structured Cabling Run (Cat6A) Termination Certification",
    clientName: "Ministry of Commerce & Innovation",
    clientContact: "tech@commerce.govt.lc",
    priority: "normal",
    status: "resolved",
    linkedSku: "CAB-C6A-1000",
    linkedItemName: "Cat6A Pure Copper Bulk Cable Spool 1000ft (Blue)",
    technician: "Marcus Theodore (Lead Network Eng)",
    createdAt: new Date(Date.now() - 1000 * 3600 * 48).toISOString(),
    slaDeadline: new Date(Date.now() - 1000 * 3600 * 24).toISOString(),
    notes: "Fluke tester certified 10 Gbps on all 24 keystones. Client signed off on completion certificate."
  }
];

const defaultFFPRORecords: FFPROSyncRecord[] = [
  {
    id: "ffp-1",
    date: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    type: "pos_revenue",
    title: "POS Register Batch Sync - Receipt #V79-2026-1082",
    amount: 410.06,
    status: "synced",
    source: "V79 POS Register #1"
  },
  {
    id: "ffp-2",
    date: new Date(Date.now() - 3600 * 1000 * 26).toISOString(),
    type: "inventory_asset_valuation",
    title: "Hardware Asset Capitalization (Networking & Peripherals)",
    amount: 14680.00,
    status: "synced",
    source: "V79 Inventory Valuation Engine"
  },
  {
    id: "ffp-3",
    date: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    type: "cogs_expense",
    title: "Supplier Stock Restock Wire Transfer - Ubiquiti Dist.",
    amount: -8450.00,
    status: "synced",
    source: "Ordely Supplier Settlement"
  }
];

const defaultMarketingCampaigns: MarketingCampaign[] = [
  {
    id: "mkt-1",
    name: "Spring POS Hardware & Modernization Upgrade",
    channel: "WhatsApp Business",
    discountCode: "V79POS10",
    discountPercent: 10,
    targetProduct: "POS Hardware & Terminals",
    reach: 8420,
    conversions: 42,
    status: "active",
    budgetXCD: 1200
  },
  {
    id: "mkt-2",
    name: "Enterprise UniFi Fiber High-Speed Networking",
    channel: "LinkedIn",
    discountCode: "UNIFI79",
    discountPercent: 15,
    targetProduct: "UniFi Dream Machine Pro",
    reach: 3110,
    conversions: 18,
    status: "active",
    budgetXCD: 850
  },
  {
    id: "mkt-3",
    name: "Castries Tech Hub Loyalty Member Flash Deal",
    channel: "Instagram",
    discountCode: "V79PERK",
    discountPercent: 8,
    targetProduct: "Peripherals & Workstations",
    reach: 2670,
    conversions: 34,
    status: "active",
    budgetXCD: 500
  }
];

// Store loader and writer
function loadStore(): AppStore {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      let loadedApps: EcosystemApp[] = Array.isArray(parsed.ecosystemApps) && parsed.ecosystemApps.length > 0 ? parsed.ecosystemApps : defaultEcosystemApps;
      // Auto-migrate to canonical v79sl.com domains and swap Ordely with V79 POS
      const v79posApp = defaultEcosystemApps.find((da) => da.id === "app-v79pos")!;
      loadedApps = loadedApps.map((a: EcosystemApp) => {
        if (a.id === "app-ffpro" || a.shortName === "FFPRO") {
          return { ...a, appUrl: "https://ffpro.v79sl.com" };
        }
        if (a.id === "app-tiquet" || a.shortName === "Tiquet") {
          return { ...a, appUrl: "https://tiquet.v79sl.com" };
        }
        if (a.id === "app-marketing" || a.shortName === "Marketing") {
          return { ...a, appUrl: "https://marketing.v79sl.com" };
        }
        if (a.id === "app-ordely" || a.shortName === "Ordely" || a.name?.toLowerCase().includes("ordely")) {
          return { ...v79posApp };
        }
        if (a.id === "app-v79pos" || a.shortName === "V79 POS") {
          return { ...a, appUrl: "https://pos.v79sl.com" };
        }
        return a;
      });

      // Ensure v79pos is present if it wasn't
      if (!loadedApps.some((a) => a.id === "app-v79pos" || a.shortName === "V79 POS")) {
        loadedApps.splice(3, 0, v79posApp);
      }

      // Ensure app-academy is present
      const academyApp = defaultEcosystemApps.find((da) => da.id === "app-academy");
      if (academyApp && !loadedApps.some((a) => a.id === "app-academy" || a.shortName === "Academy")) {
        const insertIdx = loadedApps.findIndex((a) => a.id === "app-v79pos");
        if (insertIdx !== -1) {
          loadedApps.splice(insertIdx, 0, academyApp);
        } else {
          loadedApps.push(academyApp);
        }
      }

      const loadedStore: AppStore = {
        inventory: Array.isArray(parsed.inventory) ? parsed.inventory : defaultInventory,
        users: Array.isArray(parsed.users) ? parsed.users : defaultUsers,
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : defaultTransactions,
        settings: parsed.settings ? { ...defaultSettings, ...parsed.settings } : defaultSettings,
        ecosystemApps: loadedApps,
        tickets: Array.isArray(parsed.tickets) && parsed.tickets.length > 0 ? parsed.tickets : defaultTickets,
        ffproRecords: Array.isArray(parsed.ffproRecords) && parsed.ffproRecords.length > 0 ? parsed.ffproRecords : defaultFFPRORecords,
        marketingCampaigns: Array.isArray(parsed.marketingCampaigns) && parsed.marketingCampaigns.length > 0 ? parsed.marketingCampaigns : defaultMarketingCampaigns
      };
      saveStore(loadedStore);
      return loadedStore;
    }
  } catch (err) {
    console.error("Error reading store file, initializing fresh store:", err);
  }

  const initialStore: AppStore = {
    inventory: defaultInventory,
    users: defaultUsers,
    transactions: defaultTransactions,
    settings: defaultSettings,
    ecosystemApps: defaultEcosystemApps,
    tickets: defaultTickets,
    ffproRecords: defaultFFPRORecords,
    marketingCampaigns: defaultMarketingCampaigns
  };
  saveStore(initialStore);
  return initialStore;
}

function saveStore(store: AppStore): void {
  try {
    const tempFile = STORE_FILE + ".tmp";
    fs.writeFileSync(tempFile, JSON.stringify(store, null, 2), "utf-8");
    fs.renameSync(tempFile, STORE_FILE);
  } catch (err) {
    console.error("Error saving store file:", err);
  }
}

// In-Memory store synchronized with disk
let store = loadStore();

// In-Memory Active Auth Sessions: token -> userId
const sessions = new Map<string, { userId: string; username: string; role: string; expiresAt: number }>();

// Broadcast helper for real-time WebSocket clients
function broadcast(data: any, sender?: WebSocket) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== sender) {
      client.send(message);
    }
  });
}

// Auth Middleware
function requireAuth(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.split(" ")[1];
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) sessions.delete(token);
    return res.status(401).json({ error: "Session expired or invalid" });
  }

  // Extend session expiration on activity
  session.expiresAt = Date.now() + 7 * 24 * 3600 * 1000;
  (req as any).user = session;
  next();
}

function sanitizeUser(u: StoredUser) {
  const { password, ...safeUser } = u;
  return safeUser;
}

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const foundUser = store.users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
  );

  if (!foundUser) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  // Generate secure token
  const token = "v79_tok_" + crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + 7 * 24 * 3600 * 1000; // 7 days

  sessions.set(token, {
    userId: foundUser.id,
    username: foundUser.username,
    role: foundUser.role,
    expiresAt
  });

  // Update last login
  foundUser.lastLogin = new Date().toISOString();
  saveStore(store);

  res.json({
    token,
    user: sanitizeUser(foundUser)
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const session = (req as any).user;
  const user = store.users.find((u) => u.id === session.userId);
  if (!user) {
    return res.status(404).json({ error: "User record not found" });
  }
  res.json({ user: sanitizeUser(user) });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    sessions.delete(token);
  }
  res.json({ success: true });
});

// ==========================================
// USER MANAGEMENT ROUTES
// ==========================================

app.get("/api/users", (req, res) => {
  res.json(store.users.map(sanitizeUser));
});

app.post("/api/users", (req, res) => {
  const { username, password, fullName, role, permissions } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const existing = store.users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
  if (existing) {
    return res.status(400).json({ error: "Username already exists" });
  }

  const newUser: StoredUser = {
    id: "u_" + Math.random().toString(36).substr(2, 9),
    username: username.trim(),
    password: password.trim(),
    fullName: fullName || username,
    role: role || "staff",
    permissions: Array.isArray(permissions) ? permissions : ["dashboard", "inventory", "pos", "reports"],
    createdAt: new Date().toISOString(),
    lastLogin: undefined
  };

  store.users.push(newUser);
  saveStore(store);
  broadcast({ type: "USERS_UPDATED", payload: store.users.map(sanitizeUser) });
  res.status(201).json(sanitizeUser(newUser));
});

app.put("/api/users/:id", (req, res) => {
  const { id } = req.params;
  const { username, password, fullName, role, permissions } = req.body;

  const userIndex = store.users.findIndex((u) => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  const current = store.users[userIndex];
  store.users[userIndex] = {
    ...current,
    username: username !== undefined ? username.trim() : current.username,
    password: password ? password.trim() : current.password,
    fullName: fullName !== undefined ? fullName : current.fullName,
    role: role !== undefined ? role : current.role,
    permissions: Array.isArray(permissions) ? permissions : current.permissions
  };

  saveStore(store);
  broadcast({ type: "USERS_UPDATED", payload: store.users.map(sanitizeUser) });
  res.json(sanitizeUser(store.users[userIndex]));
});

app.delete("/api/users/:id", (req, res) => {
  const { id } = req.params;
  // Ensure we don't delete the last admin
  const adminCount = store.users.filter((u) => u.role === "admin").length;
  const userToDelete = store.users.find((u) => u.id === id);

  if (userToDelete?.role === "admin" && adminCount <= 1) {
    return res.status(400).json({ error: "Cannot delete the sole administrator account" });
  }

  store.users = store.users.filter((u) => u.id !== id);
  saveStore(store);
  broadcast({ type: "USERS_UPDATED", payload: store.users.map(sanitizeUser) });
  res.json({ success: true });
});

// ==========================================
// INVENTORY ROUTES
// ==========================================

app.get("/api/inventory", (req, res) => {
  res.json(store.inventory);
});

app.post("/api/inventory", (req, res) => {
  const newItem: InventoryItem = {
    ...req.body,
    id: "v79_" + Math.random().toString(36).substr(2, 9),
    quantity: Number(req.body.quantity) || 0,
    price: Number(req.body.price) || 0,
    costPrice: Number(req.body.costPrice) || (Number(req.body.price) * 0.7) || 0,
    reorderThreshold: Number(req.body.reorderThreshold) || 5,
    tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    lastUpdated: new Date().toISOString()
  };

  store.inventory.push(newItem);
  saveStore(store);
  broadcast({ type: "INVENTORY_UPDATED", payload: store.inventory });
  res.status(201).json(newItem);
});

// Bulk import to prevent quadratic HTTP storms
app.post("/api/inventory/bulk", (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Array of items required" });
  }

  const addedItems: InventoryItem[] = [];

  for (const raw of items) {
    if (!raw.name || !raw.sku) continue;
    const item: InventoryItem = {
      id: "v79_" + Math.random().toString(36).substr(2, 9),
      name: String(raw.name),
      sku: String(raw.sku),
      category: raw.category || "General",
      quantity: Number(raw.quantity) || 0,
      price: Number(raw.price) || 0,
      costPrice: Number(raw.costPrice) || (Number(raw.price) * 0.7) || 0,
      reorderThreshold: Number(raw.reorderThreshold) || 10,
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      barcode: raw.barcode || "",
      manufacturer: raw.manufacturer || "",
      imageUrl: raw.imageUrl || "",
      location: raw.location || "Main Warehouse",
      lastUpdated: new Date().toISOString()
    };
    store.inventory.push(item);
    addedItems.push(item);
  }

  saveStore(store);
  broadcast({ type: "INVENTORY_UPDATED", payload: store.inventory });
  res.json({ success: true, count: addedItems.length, items: addedItems });
});

app.put("/api/inventory/:id", (req, res) => {
  const { id } = req.params;
  const index = store.inventory.findIndex((item) => item.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Item not found" });
  }

  store.inventory[index] = {
    ...store.inventory[index],
    ...req.body,
    id,
    quantity: Number(req.body.quantity) ?? store.inventory[index].quantity,
    price: Number(req.body.price) ?? store.inventory[index].price,
    costPrice: Number(req.body.costPrice) ?? store.inventory[index].costPrice,
    reorderThreshold: Number(req.body.reorderThreshold) ?? store.inventory[index].reorderThreshold,
    lastUpdated: new Date().toISOString()
  };

  saveStore(store);
  broadcast({ type: "INVENTORY_UPDATED", payload: store.inventory });
  res.json(store.inventory[index]);
});

// Quick stock adjustment (+ or -)
app.patch("/api/inventory/:id/stock", (req, res) => {
  const { id } = req.params;
  const { delta, absolute } = req.body;

  const item = store.inventory.find((i) => i.id === id);
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  if (typeof absolute === "number") {
    item.quantity = Math.max(0, absolute);
  } else if (typeof delta === "number") {
    item.quantity = Math.max(0, item.quantity + delta);
  }

  item.lastUpdated = new Date().toISOString();
  saveStore(store);
  broadcast({ type: "INVENTORY_UPDATED", payload: store.inventory });
  res.json(item);
});

app.delete("/api/inventory/:id", (req, res) => {
  const { id } = req.params;
  store.inventory = store.inventory.filter((item) => item.id !== id);
  saveStore(store);
  broadcast({ type: "INVENTORY_UPDATED", payload: store.inventory });
  res.json({ success: true });
});

// ==========================================
// POS CHECKOUT & TRANSACTIONS
// ==========================================

app.post("/api/pos/checkout", (req, res) => {
  const { cart, customerName, customerContact, paymentMethod, notes, cashier } = req.body;

  if (!Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: "Cart cannot be empty" });
  }

  // Deduct inventory stock
  for (const cartItem of cart) {
    const invItem = store.inventory.find((i) => i.id === cartItem.item.id);
    if (invItem) {
      invItem.quantity = Math.max(0, invItem.quantity - cartItem.quantity);
      invItem.lastUpdated = new Date().toISOString();
    }
  }

  // Calculate pricing
  const subtotal = cart.reduce((sum: number, c: any) => sum + (c.item.price * c.quantity), 0);
  const taxRate = store.settings.enableTax ? (store.settings.taxRate / 100) : 0;
  const tax = Number((subtotal * taxRate).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));

  const newTransaction: Transaction = {
    id: "txn_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
    receiptNumber: `V79-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    date: new Date().toISOString(),
    customerName: customerName ? customerName.trim() : "Walk-in Customer",
    customerContact: customerContact ? customerContact.trim() : "",
    paymentMethod: paymentMethod || "Cash",
    items: cart.map((c: any) => ({
      item: {
        id: c.item.id,
        name: c.item.name,
        sku: c.item.sku,
        category: c.item.category,
        price: c.item.price
      },
      quantity: c.quantity,
      unitPrice: c.item.price
    })),
    subtotal,
    tax,
    total,
    cashier: cashier || "Authorized Cashier",
    notes: notes || "",
    status: "completed"
  };

  store.transactions.unshift(newTransaction);
  // Keep last 500 transactions
  if (store.transactions.length > 500) {
    store.transactions = store.transactions.slice(0, 500);
  }

  saveStore(store);

  broadcast({ type: "INVENTORY_UPDATED", payload: store.inventory });
  broadcast({ type: "TRANSACTION_CREATED", payload: newTransaction });

  res.status(201).json({ success: true, transaction: newTransaction });
});

app.get("/api/transactions", (req, res) => {
  res.json(store.transactions);
});

// ==========================================
// SETTINGS
// ==========================================

app.get("/api/settings", (req, res) => {
  res.json(store.settings);
});

app.put("/api/settings", (req, res) => {
  store.settings = { ...store.settings, ...req.body };
  saveStore(store);
  res.json({ success: true, settings: store.settings });
});

app.post("/api/settings/reset", (req, res) => {
  store = {
    inventory: defaultInventory,
    users: defaultUsers,
    transactions: defaultTransactions,
    settings: defaultSettings,
    ecosystemApps: defaultEcosystemApps,
    tickets: defaultTickets,
    ffproRecords: defaultFFPRORecords,
    marketingCampaigns: defaultMarketingCampaigns
  };
  saveStore(store);
  broadcast({ type: "INVENTORY_UPDATED", payload: store.inventory });
  broadcast({ type: "USERS_UPDATED", payload: store.users.map(sanitizeUser) });
  broadcast({ type: "ECOSYSTEM_APPS_UPDATED", apps: store.ecosystemApps });
  broadcast({ type: "TIQUET_TICKETS_UPDATED", tickets: store.tickets });
  broadcast({ type: "FFPRO_RECORDS_UPDATED", records: store.ffproRecords });
  broadcast({ type: "MARKETING_CAMPAIGNS_UPDATED", campaigns: store.marketingCampaigns });
  res.json({ success: true, message: "Reset to default database state" });
});

// ==========================================
// SERVER-SIDE GEMINI AI FORECASTING
// ==========================================

app.post("/api/ai/forecast", async (req, res) => {
  const inventoryData = store.inventory;
  const recentTxns = store.transactions.slice(0, 20);

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are the lead supply chain intelligence analyst for Vision 79 (V79), a premier ICT, hardware, and POS equipment technology company in Saint Lucia.
Analyze the following inventory snapshot and recent customer transaction orders.
Provide a high-impact, professional inventory forecast for the next 30-60 days.

Inventory Snapshot:
${JSON.stringify(
  inventoryData.map((item) => ({
    name: item.name,
    sku: item.sku,
    category: item.category,
    currentStock: item.quantity,
    reorderThreshold: item.reorderThreshold,
    unitPrice: item.price,
    costPrice: item.costPrice
  }))
)}

Recent Sales Volume:
${JSON.stringify(
  recentTxns.map((t) => ({
    receipt: t.receiptNumber,
    items: t.items.map((i) => `${i.quantity}x ${i.item.name}`)
  }))
)}

Return ONLY valid JSON matching this schema:
{
  "summary": "Concise executive overview of current stock health and inventory velocity",
  "healthScore": 88, // integer 0-100
  "riskLevel": "Low" | "Medium" | "High",
  "recommendations": [
    {
      "itemName": "Product Name",
      "action": "Urgent Reorder" | "Monitor Demand" | "Promote Surplus" | "Optimal",
      "urgency": "Critical" | "Moderate" | "Good",
      "reason": "Clear explanation",
      "suggestedOrder": 15
    }
  ],
  "categoryInsights": [
    "Insight on specific category demand or stockout risk"
  ],
  "topStockoutRisks": [
    {
      "name": "Item Name",
      "daysRemaining": 7,
      "priority": "High"
    }
  ]
}`;

      const aiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              healthScore: { type: Type.INTEGER },
              riskLevel: { type: Type.STRING },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    itemName: { type: Type.STRING },
                    action: { type: Type.STRING },
                    urgency: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    suggestedOrder: { type: Type.INTEGER }
                  },
                  required: ["itemName", "action", "urgency", "reason"]
                }
              },
              categoryInsights: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              topStockoutRisks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    daysRemaining: { type: Type.INTEGER },
                    priority: { type: Type.STRING }
                  }
                }
              }
            },
            required: ["summary", "healthScore", "riskLevel", "recommendations"]
          }
        }
      });

      const parsed = JSON.parse(aiResponse.text || "{}");
      return res.json(parsed);
    } catch (err) {
      console.warn("Gemini API call failed or encountered error, falling back to heuristic engine:", err);
    }
  }

  // Smart Heuristic Fallback Analysis Engine
  const lowStock = inventoryData.filter((i) => i.quantity <= i.reorderThreshold);
  const outOfStock = inventoryData.filter((i) => i.quantity === 0);
  const totalValue = inventoryData.reduce((acc, i) => acc + i.quantity * i.price, 0);

  const healthScore = Math.max(
    30,
    Math.min(98, 100 - outOfStock.length * 15 - lowStock.length * 6)
  );

  const riskLevel = outOfStock.length > 0 ? "High" : lowStock.length > 2 ? "Medium" : "Low";

  const recommendations = lowStock.map((item) => ({
    itemName: item.name,
    action: item.quantity === 0 ? "Emergency Restock" : "Reorder Soon",
    urgency: item.quantity === 0 ? "Critical" : "Moderate",
    reason:
      item.quantity === 0
        ? `Out of stock! Threshold is ${item.reorderThreshold}. High risk of revenue loss.`
        : `Current stock (${item.quantity}) is at or below minimum threshold (${item.reorderThreshold}).`,
    suggestedOrder: Math.max(10, item.reorderThreshold * 3)
  }));

  // Add healthy recommendations if few low stock
  if (recommendations.length < 3) {
    const popularItems = inventoryData.filter((i) => i.quantity > i.reorderThreshold).slice(0, 3);
    for (const p of popularItems) {
      recommendations.push({
        itemName: p.name,
        action: "Optimal Stock",
        urgency: "Good",
        reason: `Holding ${p.quantity} units, well above reorder threshold (${p.reorderThreshold}). Fulfills enterprise deployment readiness.`,
        suggestedOrder: 0
      });
    }
  }

  res.json({
    summary: `Analyzed ${inventoryData.length} active inventory items and ${store.transactions.length} recorded orders. Overall catalog value is $${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} XCD with ${lowStock.length} items flagged for replenishment.`,
    healthScore,
    riskLevel,
    recommendations,
    categoryInsights: [
      "High turnaround detected across Networking and POS Hardware lines.",
      "Cabling and infrastructure products demonstrate stable turnover with zero stockouts.",
      "Peripherals and workstation accessories maintain healthy buffer levels."
    ],
    topStockoutRisks: lowStock.slice(0, 4).map((i) => ({
      name: i.name,
      daysRemaining: i.quantity === 0 ? 0 : Math.max(2, Math.floor(i.quantity * 1.5)),
      priority: i.quantity === 0 ? "High" : "Medium"
    }))
  });
});

// ==========================================
// ECOSYSTEM APPS & INTEGRATION ROUTES
// ==========================================

// Get all ecosystem applications
app.get("/api/ecosystem/apps", (req, res) => {
  if (!store.ecosystemApps || store.ecosystemApps.length === 0) {
    store.ecosystemApps = defaultEcosystemApps;
    saveStore(store);
  }
  res.json(store.ecosystemApps);
});

// Update an ecosystem application configuration (e.g. custom URL, status)
app.put("/api/ecosystem/apps/:id", (req, res) => {
  const { id } = req.params;
  const index = store.ecosystemApps.findIndex((a) => a.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Ecosystem app not found" });
  }

  store.ecosystemApps[index] = {
    ...store.ecosystemApps[index],
    ...req.body,
    lastSync: new Date().toISOString()
  };

  saveStore(store);
  broadcast({ type: "ECOSYSTEM_APPS_UPDATED", apps: store.ecosystemApps });
  res.json(store.ecosystemApps[index]);
});

// Register a custom ecosystem app
app.post("/api/ecosystem/apps", (req, res) => {
  const { name, shortName, tagline, description, category, appUrl, githubRepo } = req.body;
  if (!name || !appUrl) {
    return res.status(400).json({ error: "App name and launch URL are required" });
  }

  const newApp: EcosystemApp = {
    id: "app-custom-" + Date.now(),
    name,
    shortName: shortName || name.slice(0, 8),
    tagline: tagline || "Custom Ecosystem Module",
    description: description || "Integrated external tool within Vision 79 workspace.",
    category: category || "operations",
    status: "active",
    appUrl,
    githubRepo: githubRepo || undefined,
    iconName: "Boxes",
    colorScheme: {
      primary: "from-indigo-600 to-cyan-600",
      bgGradient: "bg-gradient-to-br from-indigo-500/10 via-cyan-500/5 to-transparent",
      badgeBg: "bg-indigo-500/15 border-indigo-500/30",
      badgeText: "text-indigo-400",
      border: "border-indigo-500/30 hover:border-indigo-500/60"
    },
    metrics: [{ label: "Status", value: "Connected", sublabel: "Custom integration" }],
    features: ["Custom Web App Launch", "SSO Token Bridge", "Direct Workspace Access"],
    ssoSupported: true,
    isFlagship: false,
    version: "v1.0.0",
    lastSync: new Date().toISOString()
  };

  store.ecosystemApps.push(newApp);
  saveStore(store);
  broadcast({ type: "ECOSYSTEM_APPS_UPDATED", apps: store.ecosystemApps });
  res.status(201).json(newApp);
});

// --- TIQUET SUPPORT DESK ENDPOINTS ---
app.get("/api/ecosystem/tiquet/tickets", (req, res) => {
  if (!store.tickets) {
    store.tickets = defaultTickets;
    saveStore(store);
  }
  res.json(store.tickets);
});

app.post("/api/ecosystem/tiquet/tickets", (req, res) => {
  const { title, clientName, clientContact, priority, linkedSku, linkedItemName, technician, notes } = req.body;
  if (!title || !clientName) {
    return res.status(400).json({ error: "Title and client name are required" });
  }

  const nextNumber = 4095 + store.tickets.length;
  const newTicket: TiquetTicket = {
    id: "tiq-" + Date.now(),
    ticketNumber: `TIQ-${nextNumber}`,
    title,
    clientName,
    clientContact: clientContact || "In-person Castries Hub",
    priority: priority || "normal",
    status: "open",
    linkedSku,
    linkedItemName,
    technician: technician || "Darren St. Rose (Hardware Tech)",
    createdAt: new Date().toISOString(),
    slaDeadline: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    notes: notes || "Dispatched via V79 Central Operations Hub"
  };

  store.tickets.unshift(newTicket);
  saveStore(store);
  broadcast({ type: "TIQUET_TICKETS_UPDATED", tickets: store.tickets });
  res.status(201).json(newTicket);
});

app.patch("/api/ecosystem/tiquet/tickets/:id", (req, res) => {
  const { id } = req.params;
  const { status, notes, technician } = req.body;
  const ticket = store.tickets.find((t) => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  if (status) ticket.status = status;
  if (notes) ticket.notes = notes;
  if (technician) ticket.technician = technician;

  saveStore(store);
  broadcast({ type: "TIQUET_TICKETS_UPDATED", tickets: store.tickets });
  res.json(ticket);
});

// --- FIRE FINANCE PRO (FFPRO) ENDPOINTS ---
app.get("/api/ecosystem/ffpro/records", (req, res) => {
  if (!store.ffproRecords) {
    store.ffproRecords = defaultFFPRORecords;
    saveStore(store);
  }
  res.json(store.ffproRecords);
});

app.post("/api/ecosystem/ffpro/sync-pos", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const todayTxns = store.transactions.filter((t) => t.date.startsWith(today));
  const todayTotal = todayTxns.reduce((sum, t) => sum + (t.status === "completed" ? t.total : 0), 0);

  const syncAmount = req.body.amount || todayTotal || 450.00;
  const newRecord: FFPROSyncRecord = {
    id: "ffp-" + Date.now(),
    date: new Date().toISOString(),
    type: "pos_revenue",
    title: `POS Register Closing Batch Sync (${todayTxns.length || 1} transactions)`,
    amount: syncAmount,
    status: "synced",
    source: "V79 POS Register #1"
  };

  if (!store.ffproRecords) store.ffproRecords = [];
  store.ffproRecords.unshift(newRecord);
  saveStore(store);
  broadcast({ type: "FFPRO_RECORDS_UPDATED", records: store.ffproRecords });
  res.json({ message: "Successfully synced register revenue to Fire Finance Pro ledger", record: newRecord });
});

// --- V79 MARKETING SUITE ENDPOINTS ---
app.get("/api/ecosystem/marketing/campaigns", (req, res) => {
  if (!store.marketingCampaigns) {
    store.marketingCampaigns = defaultMarketingCampaigns;
    saveStore(store);
  }
  res.json(store.marketingCampaigns);
});

app.post("/api/ecosystem/marketing/campaigns", (req, res) => {
  const { name, channel, discountCode, discountPercent, targetProduct, budgetXCD } = req.body;
  if (!name || !discountCode) {
    return res.status(400).json({ error: "Campaign name and promo code are required" });
  }

  const newCampaign: MarketingCampaign = {
    id: "mkt-" + Date.now(),
    name,
    channel: channel || "WhatsApp Business",
    discountCode: discountCode.toUpperCase(),
    discountPercent: Number(discountPercent) || 10,
    targetProduct: targetProduct || "All Hardware Items",
    reach: Math.floor(Math.random() * 2000) + 1000,
    conversions: 0,
    status: "active",
    budgetXCD: Number(budgetXCD) || 500
  };

  if (!store.marketingCampaigns) store.marketingCampaigns = [];
  store.marketingCampaigns.unshift(newCampaign);
  saveStore(store);
  broadcast({ type: "MARKETING_CAMPAIGNS_UPDATED", campaigns: store.marketingCampaigns });
  res.status(201).json(newCampaign);
});

// ==========================================
// VITE INTEGRATION & SERVER BOOT
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`V79 Client Hub Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
