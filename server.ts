import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json({ limit: '50mb' }));

// --- Mock Database State ---
// In a production app, this would be in SQLite or PostgreSQL
let inventory = [
  { id: '1', name: 'Ergonomic Office Chair', sku: 'FURN-001', category: 'Furniture', quantity: 45, price: 299.99, lastUpdated: new Date().toISOString(), reorderThreshold: 10, tags: ['office', 'ergonomic'], manufacturer: 'Herman Miller' },
  { id: '2', name: 'Mechanical Keyboard', sku: 'TECH-042', category: 'Electronics', quantity: 8, price: 149.50, lastUpdated: new Date().toISOString(), reorderThreshold: 15, tags: ['gaming', 'accessories'], manufacturer: 'Keychron' },
  { id: '3', name: 'Wireless Mouse', sku: 'TECH-043', category: 'Electronics', quantity: 120, price: 59.99, lastUpdated: new Date().toISOString(), reorderThreshold: 20, tags: ['accessories', 'wireless'], manufacturer: 'Logitech' },
  { id: '4', name: 'Standing Desk', sku: 'FURN-002', category: 'Furniture', quantity: 0, price: 499.00, lastUpdated: new Date().toISOString(), reorderThreshold: 5, tags: ['office', 'heavy'], manufacturer: 'Uplift' },
  { id: '5', name: 'Noise Cancelling Headphones', sku: 'TECH-088', category: 'Electronics', quantity: 15, price: 349.99, lastUpdated: new Date().toISOString(), reorderThreshold: 10, tags: ['audio', 'wireless'], manufacturer: 'Sony' },
];

let users = [
  { id: '1', username: 'admin', password: 'password123', role: 'admin', permissions: ['dashboard', 'inventory', 'pos', 'reports', 'settings', 'users'] },
  { id: '2', username: 'viewer', password: 'viewer123', role: 'viewer', permissions: ['dashboard', 'inventory', 'pos', 'reports'] },
];

// --- WebSocket Broadcast ---
function broadcast(data: any, sender?: WebSocket) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== sender) {
      client.send(message);
    }
  });
}

// --- API Routes ---
app.get("/api/inventory", (req, res) => {
  res.json(inventory);
});

app.post("/api/inventory", (req, res) => {
  const newItem = { ...req.body, id: Math.random().toString(36).substr(2, 9), lastUpdated: new Date().toISOString() };
  inventory.push(newItem);
  broadcast({ type: 'INVENTORY_UPDATED', payload: inventory });
  res.status(201).json(newItem);
});

app.put("/api/inventory/:id", (req, res) => {
  const { id } = req.params;
  inventory = inventory.map(item => item.id === id ? { ...req.body, id, lastUpdated: new Date().toISOString() } : item);
  broadcast({ type: 'INVENTORY_UPDATED', payload: inventory });
  res.json({ success: true });
});

app.delete("/api/inventory/:id", (req, res) => {
  const { id } = req.params;
  inventory = inventory.filter(item => item.id !== id);
  broadcast({ type: 'INVENTORY_UPDATED', payload: inventory });
  res.json({ success: true });
});

app.get("/api/users", (req, res) => {
  res.json(users);
});

app.post("/api/users", (req, res) => {
  const newUser = { ...req.body, id: Math.random().toString(36).substr(2, 9) };
  users.push(newUser);
  broadcast({ type: 'USERS_UPDATED', payload: users });
  res.status(201).json(newUser);
});

app.put("/api/users/:id", (req, res) => {
  const { id } = req.params;
  users = users.map(u => u.id === id ? { ...req.body, id } : u);
  broadcast({ type: 'USERS_UPDATED', payload: users });
  res.json({ success: true });
});

app.delete("/api/users/:id", (req, res) => {
  const { id } = req.params;
  users = users.filter(u => u.id !== id);
  broadcast({ type: 'USERS_UPDATED', payload: users });
  res.json({ success: true });
});

app.post("/api/pos/checkout", (req, res) => {
  const { cart } = req.body;
  inventory = inventory.map(item => {
    const cartItem = cart.find((c: any) => c.item.id === item.id);
    if (cartItem) {
      return {
        ...item,
        quantity: Math.max(0, item.quantity - cartItem.quantity),
        lastUpdated: new Date().toISOString()
      };
    }
    return item;
  });
  broadcast({ type: 'INVENTORY_UPDATED', payload: inventory });
  res.json({ success: true });
});

// --- Vite Integration ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
