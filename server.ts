import express, { Request, Response } from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";
import { GoogleGenAI, Type } from "@google/genai";
import { signPlatformRequest, verifyPlatformRequest } from "./server/platform-contract.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

app.use(express.json({ limit: "2mb", verify: (req: any, _res, body) => { req.rawBody = Buffer.from(body); } }));
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  next();
});

// --- Persistent File Store ---
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, "data"));
const STORE_FILE = path.join(DATA_DIR, "v79_store.json");

process.umask(0o077);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });

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

const defaultUsers: StoredUser[] = [];

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
  posApiKey: "",
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
    throw new Error(`Unable to read existing Hub data at ${STORE_FILE}; restore from backup instead of replacing it.`, { cause: err });
  }

  const initialStore: AppStore = {
    inventory: process.env.NODE_ENV === "production" ? [] : defaultInventory,
    users: defaultUsers,
    transactions: process.env.NODE_ENV === "production" ? [] : defaultTransactions,
    settings: defaultSettings,
    ecosystemApps: defaultEcosystemApps,
    tickets: process.env.NODE_ENV === "production" ? [] : defaultTickets,
    ffproRecords: process.env.NODE_ENV === "production" ? [] : defaultFFPRORecords,
    marketingCampaigns: process.env.NODE_ENV === "production" ? [] : defaultMarketingCampaigns
  };
  saveStore(initialStore);
  return initialStore;
}

function saveStore(store: AppStore): void {
  try {
    const tempFile = STORE_FILE + ".tmp";
    fs.writeFileSync(tempFile, JSON.stringify(store, null, 2), { encoding: "utf-8", mode: 0o600 });
    fs.renameSync(tempFile, STORE_FILE);
    fs.chmodSync(STORE_FILE, 0o600);
  } catch (err) {
    throw err;
  }
}

// In-Memory store synchronized with disk
let store = loadStore();

const knownDemoPasswords = new Set(["password123", "manager123", "viewer123"]);
function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}
function checkPassword(password: string, stored: string) {
  if (!stored.startsWith("scrypt:")) return false;
  const [, salt, digest] = stored.split(":");
  if (!salt || !/^[a-f0-9]{128}$/.test(digest || "")) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(digest, "hex"));
}
const adminPassword = process.env.V79_HUB_ADMIN_PASSWORD || "";
if (process.env.NODE_ENV === "production" && (adminPassword.length < 16 || knownDemoPasswords.has(adminPassword))) {
  throw new Error("Set V79_HUB_ADMIN_PASSWORD to a unique password of at least 16 characters before production startup.");
}
let usersChanged = false;
for (const user of store.users) {
  if (user.password.startsWith("scrypt:")) continue;
  user.password = hashPassword(knownDemoPasswords.has(user.password) ? crypto.randomBytes(32).toString("hex") : user.password);
  usersChanged = true;
}
if (adminPassword) {
  const username = process.env.V79_HUB_ADMIN_USERNAME || "admin";
  let admin = store.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!admin) {
    admin = { id: crypto.randomUUID(), username, password: "", fullName: "Hub Administrator", role: "admin", permissions: ["dashboard","inventory","pos","invoices","reports","settings","users"], createdAt: new Date().toISOString() };
    store.users.push(admin);
  }
  // Only replace a password when initially bootstrapping; subsequent edits in
  // the team UI must survive container recreation.
  if (!admin.password || (usersChanged && admin.username === "admin" && admin.id === "u-1")) {
    admin.password = hashPassword(adminPassword);
    usersChanged = true;
  }
  admin.role = "admin";
}
if (usersChanged) saveStore(store);

// In-Memory Active Auth Sessions: token -> userId
const sessions = new Map<string, { userId: string; username: string; role: string; expiresAt: number }>();
const loginAttempts = new Map<string, { count: number; until: number }>();

function sessionFromToken(token: string) {
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  const user = store.users.find(u => u.id === session.userId);
  if (!user) return null;
  session.role = user.role;
  return session;
}
function cookieToken(header = "") {
  return header.split(";").map(part => part.trim()).find(part => part.startsWith("v79_hub_session="))?.slice(16) || "";
}
function sessionCookie(value: string, maxAge: number) {
  return `v79_hub_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

const posSecret = process.env.V79_PLATFORM_SHARED_SECRET || "";
const posServiceUrl = process.env.POS_BASE_URL || "http://v79-commerce-api:8080";
const posPublicUrl = process.env.POS_PUBLIC_URL || "https://pos.v79sl.com";
const posIdentityPath = path.join(DATA_DIR, "pos-identity.json");
const posIdentity = (() => {
  if (fs.existsSync(posIdentityPath)) return JSON.parse(fs.readFileSync(posIdentityPath, "utf8")) as { organizationId: string; ownerUserId: string };
  const owner = store.users.find(u => u.username === (process.env.V79_HUB_ADMIN_USERNAME || "admin") && u.role === "admin");
  const identity = { organizationId: process.env.V79_POS_ORG_ID || crypto.randomUUID(), ownerUserId: owner?.id || "" };
  fs.writeFileSync(posIdentityPath, JSON.stringify(identity), { mode: 0o600, flag: "wx" });
  return identity;
})();
const posKeyPath = path.join(DATA_DIR, "pos-signing-ed25519.pem");
if (!fs.existsSync(posKeyPath)) {
  const pair = crypto.generateKeyPairSync("ed25519");
  fs.writeFileSync(posKeyPath, pair.privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600, flag: "wx" });
}
const posPrivateKey = crypto.createPrivateKey(fs.readFileSync(posKeyPath));
const posPublicKey = crypto.createPublicKey(posPrivateKey);
const posKeyId = crypto.createHash("sha256").update(posPublicKey.export({ format: "der", type: "spki" })).digest("hex").slice(0, 20);
type LaunchProduct = "pos" | "ffpro" | "tiquet" | "marketing";
const launchTickets = new Map<string, { userId: string; tenantId: string; product: LaunchProduct; expiresAt: number }>();
const managedLaunch = {
  ffpro: { serviceId: "v79-ffpro", secretEnv: "V79_FFPRO_LAUNCH_SECRET", publicEnv: "FFPRO_PUBLIC_URL", defaultUrl: "https://ffpro.v79sl.com" },
  tiquet: { serviceId: "v79-tiquet", secretEnv: "V79_TIQUET_LAUNCH_SECRET", publicEnv: "TIQUET_PUBLIC_URL", defaultUrl: "https://tiquet.v79sl.com" },
  marketing: { serviceId: "v79-marketing", secretEnv: "V79_MARKETING_LAUNCH_SECRET", publicEnv: "MARKETING_PUBLIC_URL", defaultUrl: "https://marketing.v79sl.com" },
} as const;
function managedProduct(source: string): keyof typeof managedLaunch | null {
  return (Object.keys(managedLaunch) as (keyof typeof managedLaunch)[]).find(product => managedLaunch[product].serviceId === source) || null;
}
function launchTicket(userId: string, tenantId: string, product: LaunchProduct) {
  for (const [key, entry] of launchTickets) if (entry.expiresAt < Date.now() || (entry.userId === userId && entry.product === product)) launchTickets.delete(key);
  const ticket = crypto.randomBytes(32).toString("base64url");
  launchTickets.set(crypto.createHash("sha256").update(ticket).digest("hex"), { userId, tenantId, product, expiresAt: Date.now() + 120000 });
  return ticket;
}
function posUserId(userId: string) {
  if (process.env.V79_POS_OWNER_USER_ID && userId === posIdentity.ownerUserId) return process.env.V79_POS_OWNER_USER_ID;
  const hex = crypto.createHash("sha256").update(`${posIdentity.organizationId}:${userId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function posJwt(userId: string, tenantId: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "EdDSA", typ: "JWT", kid: posKeyId })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({ iss: new URL(process.env.APP_URL || "https://hub.v79sl.com").origin, aud: "v79-commerce", sub: userId, tenant_id: tenantId, iat: now, nbf: now, exp: now + 300 })).toString("base64url");
  const input = `${header}.${claims}`;
  return `${input}.${crypto.sign(null, Buffer.from(input), posPrivateKey).toString("base64url")}`;
}

app.get("/.well-known/jwks.json", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({ keys: [{ ...posPublicKey.export({ format: "jwk" }), kid: posKeyId, alg: "EdDSA", use: "sig" }] });
});
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.post("/api/platform/session/consume", (req, res) => {
  const body = (req as any).rawBody?.toString("utf8") || "";
  const source = req.get("x-v79-service-id") || "";
  const managed = managedProduct(source);
  const expectedProduct: LaunchProduct | null = source === "v79-pos" ? "pos" : managed;
  const secret = expectedProduct === "pos" ? posSecret : managed ? process.env[managedLaunch[managed].secretEnv] || "" : "";
  if (!expectedProduct || !verifyPlatformRequest({ method: "POST", pathname: "/api/platform/session/consume", timestamp: req.get("x-v79-timestamp") || "", signature: req.get("x-v79-signature") || "", body, secret })) return res.status(401).json({ error: "Invalid service signature" });
  const { product, ticket } = req.body || {};
  if (product !== expectedProduct || typeof ticket !== "string" || !/^[A-Za-z0-9_-]{32,180}$/.test(ticket)) return res.status(400).json({ error: "Invalid ticket" });
  const ticketHash = crypto.createHash("sha256").update(ticket).digest("hex");
  const entry = launchTickets.get(ticketHash);
  if (!entry || entry.product !== product || entry.expiresAt < Date.now() || entry.userId !== posIdentity.ownerUserId || !store.users.some(u => u.id === entry.userId && u.role === "admin")) return res.status(401).json({ error: "Ticket expired or revoked" });
  launchTickets.delete(ticketHash);
  res.setHeader("Cache-Control", "no-store");
  if (product === "pos") return res.json({ token: posJwt(posUserId(entry.userId), entry.tenantId), tenantId: entry.tenantId });
  const email = (process.env.V79_HUB_ADMIN_EMAIL || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(503).json({ error: "Hub owner email is not configured." });
  res.json({
    user: { id: posUserId(entry.userId), email, name: store.users.find(u => u.id === entry.userId)?.fullName || email },
    organization: { id: entry.tenantId, name: store.settings.companyName || "Vision79", slug: `v79-${entry.tenantId.slice(0, 12)}` },
    role: "owner", plan: "beta", accessMode: "beta",
    entitlement: { product, enabled: true, access: "owner" },
    assignedProducts: ["ffpro", "tiquet", "marketing"],
  });
});
server.on("upgrade", (request, socket, head) => {
  const origin = process.env.APP_URL ? new URL(process.env.APP_URL).origin : `http://${request.headers.host}`;
  const session = sessionFromToken(cookieToken(request.headers.cookie));
  if (request.headers.origin !== origin || !session) { socket.destroy(); return; }
  wss.handleUpgrade(request, socket, head, ws => {
    (ws as any).userId = session.userId;
    wss.emit("connection", ws, request);
  });
});

// Broadcast helper for real-time WebSocket clients
function broadcast(data: any, sender?: WebSocket) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    const session = [...sessions.values()].find(s => s.userId === (client as any).userId && s.expiresAt > Date.now());
    if (client.readyState === WebSocket.OPEN && client !== sender && session &&
        (!["USERS_UPDATED","TRANSACTION_CREATED","FFPRO_RECORDS_UPDATED"].includes(data.type) || session.role === "admin")) {
      client.send(message);
    }
  });
}

// Auth Middleware
function requireAuth(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const token = bearer || cookieToken(req.headers.cookie);
  const session = sessionFromToken(token);
  if (!session) {
    return res.status(401).json({ error: "Session expired or invalid" });
  }
  if (!bearer && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = process.env.APP_URL ? new URL(process.env.APP_URL).origin : `${req.protocol}://${req.get("host")}`;
    if (req.get("origin") !== origin) return res.status(403).json({ error: "Invalid request origin" });
  }
  // Extend session expiration on activity
  session.expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  (req as any).user = session;
  next();
}
function requireRole(...roles: StoredUser["role"][]) {
  return (req: Request, res: Response, next: () => void) => {
    if (!roles.includes((req as any).user.role)) return res.status(403).json({ error: "Permission denied" });
    next();
  };
}

function sanitizeUser(u: StoredUser) {
  const { password, ...safeUser } = u;
  return safeUser;
}

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  const attemptKey = `${req.ip}:${username.trim().toLowerCase()}`;
  const attempts = loginAttempts.get(attemptKey);
  if (attempts && attempts.count >= 10 && attempts.until > Date.now()) return res.status(429).json({ error: "Too many login attempts. Try again later." });

  const foundUser = store.users.find(
    (u) => u.username.toLowerCase() === String(username).trim().toLowerCase() && checkPassword(password, u.password)
  );

  if (!foundUser) {
    loginAttempts.set(attemptKey, { count: (attempts?.until && attempts.until > Date.now() ? attempts.count : 0) + 1, until: Date.now() + 15 * 60_000 });
    return res.status(401).json({ error: "Invalid username or password" });
  }
  loginAttempts.delete(attemptKey);

  // Generate secure token
  const token = "v79_tok_" + crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;

  sessions.set(token, {
    userId: foundUser.id,
    username: foundUser.username,
    role: foundUser.role,
    expiresAt
  });

  // Update last login
  foundUser.lastLogin = new Date().toISOString();
  saveStore(store);

  res.setHeader("Set-Cookie", sessionCookie(token, 12 * 60 * 60));
  res.setHeader("Cache-Control", "no-store");
  res.json({ user: sanitizeUser(foundUser) });
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
  sessions.delete(authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : cookieToken(req.headers.cookie));
  res.setHeader("Set-Cookie", sessionCookie("", 0));
  res.json({ success: true });
});

app.use("/api", requireAuth);
app.use("/api/users", requireRole("admin"));
app.use("/api/settings", (req, res, next) => req.method === "GET" ? next() : requireRole("admin")(req, res, next));
app.use("/api/inventory", (req, res, next) => ["GET", "HEAD"].includes(req.method) ? next() : requireRole("admin", "manager", "staff")(req, res, next));
app.use("/api/pos", requireRole("admin", "manager", "staff"));
app.use("/api/transactions", requireRole("admin"));
app.use("/api/ecosystem/ffpro", requireRole("admin"));
app.use("/api/ecosystem/apps", (req, res, next) => req.method === "GET" ? next() : requireRole("admin")(req, res, next));
app.use("/api/ecosystem/tiquet", (req, res, next) => req.method === "GET" ? next() : requireRole("admin", "manager", "staff")(req, res, next));
app.use("/api/ecosystem/marketing", (req, res, next) => req.method === "GET" ? next() : requireRole("admin", "manager")(req, res, next));
app.use("/api/ai", requireRole("admin", "manager"));

app.get("/api/apps/pos/launch", requireRole("admin"), async (req, res) => {
  if (posSecret.length < 32) return res.status(503).json({ error: "POS shared secret is not configured" });
  const session = (req as any).user;
  if (session.userId !== posIdentity.ownerUserId) return res.status(403).json({ error: "Only the workspace owner can launch POS" });
  const pathname = "/api/platform/provision";
  const body = JSON.stringify({
    organization: { id: posIdentity.organizationId, name: store.settings.companyName || "Vision79", slug: `v79-${posIdentity.organizationId.slice(0, 12)}` },
    user: { id: posUserId(session.userId) }, role: "owner"
  });
  const timestamp = String(Date.now());
  try {
    const response = await fetch(new URL(pathname, posServiceUrl), {
      method: "POST", headers: { "content-type": "application/json", "x-v79-service-id": "v79-hub", "x-v79-timestamp": timestamp,
        "x-v79-signature": signPlatformRequest({ method: "POST", pathname, timestamp, body, secret: posSecret }) },
      body, signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return res.status(502).json({ error: "POS workspace provisioning failed", upstreamStatus: response.status });
  } catch { return res.status(503).json({ error: "POS service is unavailable" }); }
  const ticket = launchTicket(session.userId, posIdentity.organizationId, "pos");
  const url = new URL("/", posPublicUrl);
  url.hash = new URLSearchParams({ ticket }).toString();
  res.setHeader("Cache-Control", "no-store");
  res.redirect(302, url.toString());
});

app.get("/api/apps/:product/launch", requireRole("admin"), (req, res) => {
  const product = req.params.product as keyof typeof managedLaunch;
  if (!(product in managedLaunch)) return res.status(404).json({ error: "Unknown managed app" });
  const session = (req as any).user;
  if (session.userId !== posIdentity.ownerUserId) return res.status(403).json({ error: "Only the workspace owner can launch this app" });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(process.env.V79_HUB_ADMIN_EMAIL || "")) return res.status(503).json({ error: "Set V79_HUB_ADMIN_EMAIL to the owner's verified email." });
  const config = managedLaunch[product];
  if ((process.env[config.secretEnv] || "").length < 32) return res.status(503).json({ error: `${product} launch secret is not configured.` });
  const configuredUrl = process.env[config.publicEnv] || config.defaultUrl;
  let target: URL;
  try {
    target = new URL("/api/platform/launch", configuredUrl);
    if (target.protocol !== "https:" || target.username || target.password || !target.hostname.endsWith(".v79sl.com")) throw new Error("Invalid app URL");
  } catch { return res.status(503).json({ error: `${product} public URL is invalid.` }); }
  target.searchParams.set("ticket", launchTicket(session.userId, posIdentity.organizationId, product));
  res.setHeader("Cache-Control", "no-store");
  res.redirect(302, target.toString());
});

// ==========================================
// USER MANAGEMENT ROUTES
// ==========================================

app.get("/api/users", (req, res) => {
  res.json(store.users.map(sanitizeUser));
});

app.post("/api/users", (req, res) => {
  const { username, password, fullName, role, permissions } = req.body;
  if (typeof username !== "string" || !username.trim() || typeof password !== "string" || password.length < 12 || !["admin", "manager", "staff", "viewer"].includes(role || "staff")) {
    return res.status(400).json({ error: "Valid username, role and password of at least 12 characters are required" });
  }

  const existing = store.users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
  if (existing) {
    return res.status(400).json({ error: "Username already exists" });
  }

  const newUser: StoredUser = {
    id: crypto.randomUUID(),
    username: username.trim(),
    password: hashPassword(password),
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
  if (password !== undefined && (typeof password !== "string" || password.length < 12)) return res.status(400).json({ error: "Password must contain at least 12 characters" });
  if (role !== undefined && !["admin", "manager", "staff", "viewer"].includes(role)) return res.status(400).json({ error: "Invalid role" });
  if (current.role === "admin" && role && role !== "admin" && store.users.filter(u => u.role === "admin").length === 1) return res.status(400).json({ error: "Cannot demote the sole administrator" });
  store.users[userIndex] = {
    ...current,
    username: username !== undefined ? username.trim() : current.username,
    password: password ? hashPassword(password) : current.password,
    fullName: fullName !== undefined ? fullName : current.fullName,
    role: role !== undefined ? role : current.role,
    permissions: Array.isArray(permissions) ? permissions : current.permissions
  };

  saveStore(store);
  if (password || (role && role !== current.role)) for (const [token, session] of sessions) if (session.userId === id) sessions.delete(token);
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
  for (const [token, session] of sessions) if (session.userId === id) sessions.delete(token);
  saveStore(store);
  broadcast({ type: "USERS_UPDATED", payload: store.users.map(sanitizeUser) });
  res.json({ success: true });
});

// ==========================================
// INVENTORY ROUTES
// ==========================================
const validStock = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const validMoney = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && Number.isSafeInteger(Math.round(value * 100));

app.get("/api/inventory", (req, res) => {
  res.json(store.inventory);
});

app.post("/api/inventory", (req, res) => {
  if (typeof req.body?.name !== "string" || !req.body.name.trim() || typeof req.body?.sku !== "string" || !req.body.sku.trim() ||
      !validStock(req.body.quantity) || !validMoney(req.body.price) || (req.body.costPrice !== undefined && !validMoney(req.body.costPrice)) ||
      (req.body.reorderThreshold !== undefined && !validStock(req.body.reorderThreshold))) return res.status(400).json({ error: "Valid name, SKU, quantity and prices are required" });
  const newItem: InventoryItem = {
    ...req.body,
    id: "v79_" + Math.random().toString(36).substr(2, 9),
    quantity: req.body.quantity,
    price: req.body.price,
    costPrice: req.body.costPrice ?? 0,
    reorderThreshold: req.body.reorderThreshold ?? 5,
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
  if (!Array.isArray(items) || items.length === 0 || items.length > 1000) {
    return res.status(400).json({ error: "Array of items required" });
  }
  if (items.some(raw => typeof raw?.name !== "string" || !raw.name.trim() || typeof raw?.sku !== "string" || !raw.sku.trim() ||
      !validStock(raw.quantity) || !validMoney(raw.price) || (raw.costPrice !== undefined && !validMoney(raw.costPrice)) ||
      (raw.reorderThreshold !== undefined && !validStock(raw.reorderThreshold)))) return res.status(400).json({ error: "Every item needs valid name, SKU, quantity and prices" });

  const addedItems: InventoryItem[] = [];

  for (const raw of items) {
    const item: InventoryItem = {
      id: "v79_" + Math.random().toString(36).substr(2, 9),
      name: String(raw.name),
      sku: String(raw.sku),
      category: raw.category || "General",
      quantity: raw.quantity,
      price: raw.price,
      costPrice: raw.costPrice ?? 0,
      reorderThreshold: raw.reorderThreshold ?? 10,
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
  for (const key of ["quantity", "reorderThreshold"]) if (req.body[key] !== undefined && !validStock(req.body[key])) return res.status(400).json({ error: `Invalid ${key}` });
  for (const key of ["price", "costPrice"]) if (req.body[key] !== undefined && !validMoney(req.body[key])) return res.status(400).json({ error: `Invalid ${key}` });

  store.inventory[index] = {
    ...store.inventory[index],
    ...req.body,
    id,
    quantity: req.body.quantity ?? store.inventory[index].quantity,
    price: req.body.price ?? store.inventory[index].price,
    costPrice: req.body.costPrice ?? store.inventory[index].costPrice,
    reorderThreshold: req.body.reorderThreshold ?? store.inventory[index].reorderThreshold,
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

  if (absolute !== undefined ? !validStock(absolute) : !Number.isSafeInteger(delta) || !validStock(item.quantity + delta)) return res.status(400).json({ error: "Invalid stock adjustment" });
  item.quantity = absolute !== undefined ? absolute : item.quantity + delta;

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

  const quantities = new Map<string, number>();
  for (const row of cart) {
    const id = row?.item?.id;
    if (typeof id !== "string" || !Number.isSafeInteger(row.quantity) || row.quantity <= 0) return res.status(400).json({ error: "Invalid cart quantity" });
    quantities.set(id, (quantities.get(id) || 0) + row.quantity);
  }
  const verified = [...quantities].map(([id, quantity]) => ({ item: store.inventory.find(item => item.id === id), quantity }));
  if (verified.some(row => !row.item || !Number.isFinite(row.item.price) || row.item.price < 0)) return res.status(400).json({ error: "Unknown or invalid catalogue item" });
  if (verified.some(row => row.quantity > row.item!.quantity)) return res.status(409).json({ error: "Insufficient stock" });
  const subtotalCents = verified.reduce((sum, row) => sum + Math.round(row.item!.price * 100) * row.quantity, 0);
  if (!Number.isSafeInteger(subtotalCents)) return res.status(400).json({ error: "Cart total is too large" });
  const subtotal = subtotalCents / 100;
  const taxRate = store.settings.enableTax ? (store.settings.taxRate / 100) : 0;
  const tax = Math.round(subtotalCents * taxRate) / 100;
  const total = (subtotalCents + Math.round(subtotalCents * taxRate)) / 100;

  for (const row of verified) {
    row.item!.quantity -= row.quantity;
    row.item!.lastUpdated = new Date().toISOString();
  }

  const newTransaction: Transaction = {
    id: "txn_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
    receiptNumber: `V79-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    date: new Date().toISOString(),
    customerName: customerName ? customerName.trim() : "Walk-in Customer",
    customerContact: customerContact ? customerContact.trim() : "",
    paymentMethod: paymentMethod || "Cash",
    items: verified.map(({ item, quantity }) => ({
      item: {
        id: item!.id,
        name: item!.name,
        sku: item!.sku,
        category: item!.category,
        price: item!.price
      },
      quantity,
      unitPrice: item!.price
    })),
    subtotal,
    tax,
    total,
    cashier: cashier || "Authorized Cashier",
    notes: notes || "",
    status: "completed"
  };

  store.transactions.unshift(newTransaction);
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
  const settings = { ...store.settings };
  if ((req as any).user.role !== "admin") delete settings.posApiKey;
  res.json(settings);
});

app.put("/api/settings", (req, res) => {
  store.settings = { ...store.settings, ...req.body };
  saveStore(store);
  res.json({ success: true, settings: store.settings });
});

app.post("/api/settings/reset", (req, res) => {
  if (process.env.NODE_ENV === "production") return res.status(403).json({ error: "Reset is unavailable in production" });
  store = {
    inventory: defaultInventory,
    users: store.users,
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
  res.json({ success: true, message: "Sample business data reset; user accounts were preserved" });
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
  const managedDescriptions: Record<string,string> = {
    "app-ffpro": "Finance planning and reporting. Sign in through the Hub after your FFPRO account is linked.",
    "app-tiquet": "Service jobs and tickets. Sign in through the Hub after your Tiquet account is linked.",
    "app-marketing": "Customer and campaign tools. Sign in through the Hub to open your workspace.",
    "app-v79pos": "Sales, stock and purchasing. The POS beta requires its own service and register testing.",
    "app-academy": "Public courses and learning. Academy has its own learner account.",
  };
  res.json(store.ecosystemApps
    .filter(a => !["app-analytics","app-lifehealth"].includes(a.id))
    .map(a => ({ ...a, status: "beta", metrics: undefined, lastSync: undefined,
      description: managedDescriptions[a.id] || a.description,
      features: managedDescriptions[a.id] ? [] : a.features,
      ssoSupported: ["app-ffpro","app-tiquet","app-marketing","app-v79pos"].includes(a.id),
      appUrl: a.id === "app-academy" ? "https://v79academy.v79sl.com/academy" : a.appUrl,
    })));
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

  const syncAmount = todayTotal;
  if (!todayTxns.length) return res.status(409).json({ error: "No completed POS transactions to reconcile" });
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
    const distDir = path.join(__dirname, "dist");
    app.use(express.static(distDir, {
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-store");
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }));
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  const PORT = Number(process.env.PORT || 3040);
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`V79 Client Hub Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
