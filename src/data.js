// src/data.js
// Static demo data (RTL / Arabic). You can replace images with your own.
// Tip: in Vite/React, put images in /public/products/ and reference like "/products/watch.jpg"

export const TODAY = "2026-02-15";

export const productsSeed = [
  { id: "p1", name: "ساعة", image: "/products/watch.jpg" },
  { id: "p2", name: "سماعة", image: "/products/headphones.jpg" },
  { id: "p3", name: "شاحن", image: "/products/charger.jpg" },
];

export const ordersSeed = [
  // Today
  { id: "ORD-1", date: TODAY, city: "فاس", productId: "p1", status: "delivered", sell: 300, cost: 150, ship: 20 },
  { id: "ORD-2", date: TODAY, city: "البيضاء", productId: "p2", status: "pending", sell: 200, cost: 90, ship: 20 },
  { id: "ORD-3", date: TODAY, city: "الرباط", productId: "p1", status: "returned", sell: 300, cost: 150, ship: 20 },

  // Previous
  { id: "ORD-4", date: "2026-02-14", city: "طنجة", productId: "p3", status: "delivered", sell: 150, cost: 60, ship: 15 },
  { id: "ORD-5", date: "2026-02-13", city: "مراكش", productId: "p1", status: "delivered", sell: 320, cost: 160, ship: 20 },
  { id: "ORD-6", date: "2026-02-12", city: "فاس", productId: "p2", status: "delivered", sell: 220, cost: 110, ship: 20 },
];

export const expensesSeed = [
  { id: "EXP-1", date: TODAY, type: "ads", amount: 120, note: "فيسبوك" },
  { id: "EXP-2", date: TODAY, type: "packaging", amount: 35, note: "أكياس" },
  { id: "EXP-3", date: "2026-02-14", type: "ads", amount: 60, note: "إعلانات" },
];

export const expenseTypeLabel = {
  ads: "📱 إعلانات",
  packaging: "📦 تغليف",
  tools: "🔧 أدوات",
  other: "📌 أخرى",
};

export const statusLabel = {
  delivered: { text: "✅ تم التسليم", tone: "good" },
  pending: { text: "🕒 قيد التوصيل", tone: "warn" },
  returned: { text: "🔄 مرتجع", tone: "bad" },
};
