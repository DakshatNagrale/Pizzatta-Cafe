// =============================================
// DATA STORE — PizzaCafe Staff Portal
// =============================================

// MENU ITEMS
let menuItems = [
  // 🍕 Special Pizzas — Regular
  { id:  1, name: 'Margherita (Regular)',         category: 'special', price: 109, desc: 'Special pizza — Regular size', available: true },
  { id:  2, name: 'Double Cheese (Regular)',       category: 'special', price: 149, desc: 'Special pizza — Regular size', available: true },
  { id:  3, name: 'Corn Cheese (Regular)',         category: 'special', price: 149, desc: 'Special pizza — Regular size', available: true },
  { id:  4, name: 'Corn Paneer (Regular)',         category: 'special', price: 179, desc: 'Special pizza — Regular size', available: true },
  { id:  5, name: 'Peppy Paneer (Regular)',        category: 'special', price: 199, desc: 'Special pizza — Regular size', available: true },
  { id:  6, name: 'Farmhouse Pizza (Regular)',     category: 'special', price: 199, desc: 'Special pizza — Regular size', available: true },
  { id:  7, name: 'Tandoori Paneer (Regular)',     category: 'special', price: 229, desc: 'Special pizza — Regular size', available: true },
  { id:  8, name: 'Extraveg Pizza (Regular)',      category: 'special', price: 229, desc: 'Special pizza — Regular size', available: true },
  // 🍕 Special Pizzas — Medium
  { id:  9, name: 'Margherita (Medium)',           category: 'special', price: 209, desc: 'Special pizza — Medium size', available: true },
  { id: 10, name: 'Double Cheese (Medium)',        category: 'special', price: 249, desc: 'Special pizza — Medium size', available: true },
  { id: 11, name: 'Corn Cheese (Medium)',          category: 'special', price: 249, desc: 'Special pizza — Medium size', available: true },
  { id: 12, name: 'Corn Paneer (Medium)',          category: 'special', price: 259, desc: 'Special pizza — Medium size', available: true },
  { id: 13, name: 'Peppy Paneer (Medium)',         category: 'special', price: 299, desc: 'Special pizza — Medium size', available: true },
  { id: 14, name: 'Farmhouse Pizza (Medium)',      category: 'special', price: 299, desc: 'Special pizza — Medium size', available: true },
  { id: 15, name: 'Tandoori Paneer (Medium)',      category: 'special', price: 339, desc: 'Special pizza — Medium size', available: true },
  { id: 16, name: 'Extraveg Pizza (Medium)',       category: 'special', price: 339, desc: 'Special pizza — Medium size', available: true },
  { id: 17, name: 'Wheat Pizza Extra',             category: 'special', price:  20, desc: 'Extra charge for wheat base', available: true },

  // 🍕 Classic Pizzas (Regular)
  { id: 18, name: 'Classic Pizza',                 category: 'pizza',   price:  65, desc: 'Classic regular pizza', available: true },
  { id: 19, name: 'Onion Pizza',                   category: 'pizza',   price:  69, desc: 'Classic with onion topping', available: true },
  { id: 20, name: 'Tomato Pizza',                  category: 'pizza',   price:  69, desc: 'Classic with tomato topping', available: true },
  { id: 21, name: 'Capsicum Pizza',                category: 'pizza',   price:  79, desc: 'Classic with capsicum', available: true },
  { id: 22, name: 'Onion Tomato Pizza',            category: 'pizza',   price:  79, desc: 'Onion + tomato classic', available: true },
  { id: 23, name: 'Cheesy Pizza',                  category: 'pizza',   price:  89, desc: 'Extra cheesy classic pizza', available: true },
  { id: 24, name: 'Golden Corn Pizza',             category: 'pizza',   price:  89, desc: 'Classic with golden corn', available: true },
  { id: 25, name: 'Paneer Cheese Pizza',           category: 'pizza',   price: 119, desc: 'Paneer + cheese classic', available: true },
  { id: 26, name: 'Paneer Capsicum Pizza',         category: 'pizza',   price: 129, desc: 'Paneer + capsicum classic', available: true },
  { id: 27, name: 'Paneer Onion Pizza',            category: 'pizza',   price: 129, desc: 'Paneer + onion classic', available: true },
  { id: 28, name: 'Veg Loaded Pizza',              category: 'pizza',   price: 159, desc: 'Loaded with all veggies', available: true },

  // 🍱 Combos
  { id: 29, name: 'Paneer Cheese + Burger + Fries + Coke', category: 'combo', price: 239, desc: 'Paneer Cheese Pizza + Burger + Fries + Coke 250ml', available: true },
  { id: 30, name: 'Golden Corn + Burger + Fries + Coke',   category: 'combo', price: 209, desc: 'Golden Corn Pizza + Burger + Fries + Coke 250ml', available: true },
  { id: 31, name: 'Golden Corn + Fries + Coke',           category: 'combo', price: 159, desc: 'Golden Corn Pizza + Fries + Coke 250ml', available: true },
  { id: 32, name: 'Onion Pizza + Burger + Coke',          category: 'combo', price: 149, desc: 'Onion Pizza + Burger + Coke 250ml', available: true },

  // 🥟 Momos (8 Pieces)
  { id: 33, name: 'Veg Momos',                    category: 'momo',    price: 100, desc: 'Steamed veg momos — 8 pieces', available: true },
  { id: 34, name: 'Paneer Momos',                 category: 'momo',    price: 120, desc: 'Steamed paneer momos — 8 pieces', available: true },

  // 🥪 Sandwiches
  { id: 35, name: 'Veg Sandwich',                 category: 'sandwich', price:  69, desc: 'Fresh veg sandwich', available: true },
  { id: 36, name: 'Corn Cheese Sandwich',         category: 'sandwich', price:  89, desc: 'Corn + cheese grilled sandwich', available: true },
  { id: 37, name: 'Paneer Corn Sandwich',         category: 'sandwich', price:  99, desc: 'Paneer + corn sandwich', available: true },
  { id: 38, name: 'Tandoori Paneer Sandwich',     category: 'sandwich', price: 119, desc: 'Spicy tandoori paneer sandwich', available: true },

  // 🍟 Sides
  { id: 39, name: 'Veg Parcel',                   category: 'side',    price:  39, desc: 'Small veg parcel snack', available: true },
  { id: 40, name: 'Peri Peri Fries',              category: 'side',    price:  59, desc: 'Crispy fries with peri peri masala', available: true },
  { id: 41, name: 'Burger',                       category: 'side',    price:  69, desc: 'Classic veg burger', available: true },
  { id: 42, name: 'Garlic Breadstick',            category: 'side',    price:  69, desc: 'Crispy garlic breadstick', available: true },
  { id: 43, name: 'Stuffed Garlic Bread',         category: 'side',    price: 119, desc: 'Garlic bread stuffed with cheese & veggies', available: true },

  // 🍰 Dessert
  { id: 44, name: 'Choco Lava Cake',              category: 'dessert', price:  59, desc: 'Molten chocolate lava cake', available: true },

  // 🥤 Beverages
  { id: 45, name: 'Thumbs Up',                    category: 'drink',   price:  25, desc: 'Chilled Thumbs Up 250ml', available: true },
  { id: 46, name: 'Sprite',                       category: 'drink',   price:  25, desc: 'Chilled Sprite 250ml', available: true },
  { id: 47, name: 'Water Bottle',                 category: 'drink',   price:  20, desc: 'Mineral water bottle', available: true },

  // ☕ Cold Coffee
  { id: 48, name: 'Plain Cold Coffee',            category: 'drink',   price:  50, desc: 'Refreshing plain cold coffee', available: true },
  { id: 49, name: 'Chocolate Cold Coffee',        category: 'drink',   price:  60, desc: 'Rich chocolate cold coffee', available: true },

  // 🧀 Extra Cheese
  { id: 50, name: 'Extra Cheese (Regular)',       category: 'extra',   price:  30, desc: 'Add extra cheese — Regular size', available: true },
  { id: 51, name: 'Extra Cheese (Medium)',        category: 'extra',   price:  50, desc: 'Add extra cheese — Medium size', available: true },
];

function getTodayISTData() {
  const now = new Date();
  const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return istDate.toISOString().slice(0, 10);
}
const td = getTodayISTData();
const yd = new Date(Date.now() - 86400000 + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

// DAILY ORDERS
let orders = [];

// Next order ID
let nextOrderId = 1;
let nextMenuId  = 52;

function calcOrderTotal(items) {
  return items.reduce((sum, it) => {
    const p = it.unitPrice !== undefined ? it.unitPrice : menuItems.find(m => m.id === it.menuId)?.price || 0;
    return sum + (p * it.qty);
  }, 0);
}

function getItemLabel(items) {
  return items.map(it => {
    const m = menuItems.find(m => m.id === it.menuId);
    return m ? `${m.name} x${it.qty}` : '?';
  }).join(', ');
}

async function saveData() {
  const payload = {
    orders: orders,
    menuItems: menuItems,
    nextOrderId: nextOrderId,
    nextMenuId: nextMenuId
  };

  // Try saving to server (up to 3 attempts)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        // ✅ Save successful — show indicator & hide error banner
        hideSaveError();
        showSaveIndicator();
        return;
      }
    } catch (err) {
      console.warn(`Save attempt ${attempt} failed:`, err);
    }
    // Wait 500ms before retry
    await new Promise(r => setTimeout(r, 500));
  }

  // ❌ All 3 attempts failed — show loud warning
  showSaveError();
  console.error("CRITICAL: Could not save data to server after 3 attempts!");
}

let _saveIndicatorTimer = null;
function showSaveIndicator() {
  const el = document.getElementById('saveIndicator');
  if (!el) return;
  el.classList.add('show');
  clearTimeout(_saveIndicatorTimer);
  _saveIndicatorTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

function showSaveError() {
  let banner = document.getElementById('saveBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'saveBanner';
    banner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
      background: #ff2d2d; color: white; text-align: center;
      padding: 14px 20px; font-size: 16px; font-weight: bold;
      box-shadow: 0 4px 20px rgba(255,0,0,0.5);
      animation: pulse 1s infinite alternate;
    `;
    banner.innerHTML = `⚠️ SERVER SE SAVE NAHI HUA! Node server band ho gaya hai. Terminal mein <b>node server.js</b> dobara chalao. <button onclick="retrySave()" style="margin-left:16px;padding:6px 14px;background:white;color:red;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">Retry</button>`;
    document.body.prepend(banner);
  }
  banner.style.display = 'block';
}

function hideSaveError() {
  const banner = document.getElementById('saveBanner');
  if (banner) banner.style.display = 'none';
}

async function retrySave() {
  const banner = document.getElementById('saveBanner');
  if (banner) banner.innerHTML = '🔄 Dobara save ho raha hai...';
  await saveData();
}

async function initData() {
  let data = null;
  try {
    const res = await fetch('/api/data');
    if (res.ok) {
      data = await res.json();
    }
  } catch (err) {
    console.warn("Local server offline. Loading from browser LocalStorage instead.");
  }

  if (data && Object.keys(data).length > 0) {
    // Loaded from Server
    if (data.menuItems && Array.isArray(data.menuItems) && data.menuItems.length > 0) menuItems = data.menuItems;
    if (data.nextOrderId) nextOrderId = parseInt(data.nextOrderId);
    if (data.nextMenuId) nextMenuId = parseInt(data.nextMenuId);
    if (data.orders && Array.isArray(data.orders)) orders = data.orders;
  } else {
    // Load from LocalStorage
    const DB_VERSION = 'v3_clean';
    const savedVersion = localStorage.getItem('pizzata_db_version');
    if (savedVersion !== DB_VERSION) {
      localStorage.removeItem('pizzata_orders');
      localStorage.removeItem('pizzata_nextOrderId');
      localStorage.setItem('pizzata_db_version', DB_VERSION);
    }
    
    const savedOrders = localStorage.getItem('pizzata_orders');
    const savedMenu = localStorage.getItem('pizzata_menu');
    const savedNextOrderId = localStorage.getItem('pizzata_nextOrderId');
    const savedNextMenuId = localStorage.getItem('pizzata_nextMenuId');
    
    if (savedMenu) {
      try {
        const parsedMenu = JSON.parse(savedMenu);
        if (Array.isArray(parsedMenu) && parsedMenu.length > 0) menuItems = parsedMenu;
      } catch(e) { console.error(e); }
    }
    if (savedNextOrderId) nextOrderId = parseInt(savedNextOrderId);
    if (savedNextMenuId) nextMenuId = parseInt(savedNextMenuId);
    if (savedOrders) {
      try {
        const parsedOrders = JSON.parse(savedOrders);
        if (Array.isArray(parsedOrders)) orders = parsedOrders;
      } catch(e) { console.error(e); }
    }
  }

  // Sanitize Orders
  orders.forEach(o => {
    if (!o.id) o.id = nextOrderId++;
    if (!o.customer) o.customer = 'Unknown';
    if (!o.date) o.date = td;
    if (!Array.isArray(o.items)) o.items = [];
    if (typeof o.total !== 'number' || isNaN(o.total)) o.total = calcOrderTotal(o.items);
    if (typeof o.paid !== 'boolean') o.paid = false;
    if (typeof o.delivered !== 'boolean') o.delivered = false;
    if (!o.time) o.time = '12:00 PM';
    if (o.note === undefined) o.note = '';
    if (!o.type) o.type = 'dine-in';

    // Migrate old payMode to split payment amounts
    if (o.cashAmount === undefined || o.onlineAmount === undefined) {
      if (o.paid) {
        if (o.payMode === 'cash') {
          o.cashAmount = o.total;
          o.onlineAmount = 0;
        } else if (o.payMode === 'online') {
          o.cashAmount = 0;
          o.onlineAmount = o.total;
        } else {
          o.cashAmount = 0;
          o.onlineAmount = 0;
        }
      } else {
        o.cashAmount = 0;
        o.onlineAmount = 0;
      }
    }
    // paid = true if total collected >= total
    o.paid = (o.cashAmount + o.onlineAmount) >= o.total;
  });

  // Assign dayNum — per-day sequential order number starting from 1
  const dayGroups = {};
  orders.forEach(o => {
    if (!dayGroups[o.date]) dayGroups[o.date] = [];
    dayGroups[o.date].push(o);
  });
  Object.values(dayGroups).forEach(group => {
    group.sort((a, b) => a.id - b.id);
    group.forEach((o, i) => { o.dayNum = i + 1; });
  });
}

