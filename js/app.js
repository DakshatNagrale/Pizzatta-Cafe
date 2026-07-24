// =============================================
// APP.JS — PizzaCafe Staff Portal
// =============================================

let currentPage = 'dashboard';
let orderFilter = 'all';
let menuFilter  = 'all';
function getTodayIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST = UTC+5:30
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().slice(0, 10); // YYYY-MM-DD
}
let selectedDate = getTodayIST();
let newOrderItems = [];
let editOrderItems = [];
let hourlyChart, revenueChart, categoryChart;

// ---- INIT ----
window.addEventListener('DOMContentLoaded', async () => {
  if (typeof initData === 'function') await initData();
  document.getElementById('orderDateFilter').value = selectedDate;
  setDateLabels();
  initSparkCanvas();
  navigate('dashboard');
});

function setDateLabels() {
  const now = new Date();
  const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
  const dateStr = now.toLocaleDateString('en-IN', opts);
  document.getElementById('pageDate').textContent = dateStr;
  document.getElementById('todayBadge').textContent = now.toLocaleDateString('en-IN',{day:'2-digit',month:'short'});
}

// ---- NAVIGATION ----
function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  const titles = { dashboard:'Dashboard', orders:'Daily Orders Sheet', menu:'Menu Manager', analytics:'Sales Analytics' };
  document.getElementById('pageTitle').textContent = titles[page];
  if (page === 'dashboard')  renderDashboard();
  if (page === 'orders')     renderOrders();
  if (page === 'menu')       renderMenu();
  if (page === 'analytics')  renderAnalytics();
  // close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ---- TOAST ----
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ---- MODAL ----
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// =============================================
// DASHBOARD
// =============================================
function renderDashboard() {
  const dOrders = orders.filter(o => o.date === getTodayIST());
  const totalRev = dOrders.reduce((s,o) => s+o.total, 0);
  const totalPaid = dOrders.filter(o=>o.paid).reduce((s,o) => s+o.total, 0);
  const pendingDel = dOrders.filter(o=>!o.delivered).length;

  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Today's Revenue</div>
      <div class="kpi-value" id="kpiRevenue">₹${totalRev.toLocaleString('en-IN')}</div>
      <div class="kpi-trend trend-up">▲ Live</div><div class="kpi-icon">💰</div></div>
    <div class="kpi-card success"><div class="kpi-label">Total Orders</div>
      <div class="kpi-value" id="kpiOrders">${dOrders.length}</div>
      <div class="kpi-trend trend-up">▲ Today</div><div class="kpi-icon">🧾</div></div>
    <div class="kpi-card warning"><div class="kpi-label">Pending Delivery</div>
      <div class="kpi-value" id="kpiPending">${pendingDel}</div>
      <div class="kpi-trend" style="color:var(--warning)">⚠ Pending</div><div class="kpi-icon">🛵</div></div>
    <div class="kpi-card danger"><div class="kpi-label">Unpaid Amount</div>
      <div class="kpi-value" id="kpiUnpaid">₹${(totalRev - totalPaid).toLocaleString('en-IN')}</div>
      <div class="kpi-trend trend-down">▼ Unpaid</div><div class="kpi-icon">💳</div></div>`;

  // Hourly chart
  if (hourlyChart) hourlyChart.destroy();
  const labels = Array.from({length:13},(_,i)=>`${9+i}:00`);
  const data = new Array(13).fill(0);
  dOrders.forEach(o => {
    let m = o.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if(m) {
      let hr = parseInt(m[1]);
      const ampm = m[3].toUpperCase();
      if(ampm === 'PM' && hr !== 12) hr += 12;
      if(ampm === 'AM' && hr === 12) hr = 0;
      if(hr >= 9 && hr <= 21) data[hr - 9] += o.total;
    } else {
      let m2 = o.time.match(/(\d+):(\d+)/);
      if(m2) {
        let hr = parseInt(m2[1]);
        if(hr >= 9 && hr <= 21) data[hr - 9] += o.total;
      }
    }
  });
  const ctx = document.getElementById('hourlyChart').getContext('2d');
  const grad = ctx.createLinearGradient(0,0,0,200);
  grad.addColorStop(0,'rgba(255,107,43,0.4)'); grad.addColorStop(1,'rgba(255,107,43,0)');
  hourlyChart = new Chart(ctx, {
    type:'line', data:{ labels, datasets:[{ data, borderColor:'#ff6b2b', backgroundColor:grad,
      fill:true, tension:0.4, pointBackgroundColor:'#ff6b2b', pointRadius:3, borderWidth:2 }]},
    options:{ plugins:{legend:{display:false}}, scales:{
      x:{ grid:{color:'#1e1e1e'}, ticks:{color:'#666'} },
      y:{ grid:{color:'#1e1e1e'}, ticks:{color:'#666', callback:v=>'₹'+v} }
    }}
  });

  // Recent orders table (last 5)
  const recent = [...dOrders].reverse().slice(0, 5);
  document.getElementById('recentOrdersTable').innerHTML = buildOrderTable(recent, true);
}

// =============================================
// ORDERS LOGIC
// =============================================
function renderOrders() {
  let list = orders.filter(o => o.date === selectedDate);
  if (orderFilter === 'paid') list = list.filter(o => o.paid);
  else if (orderFilter === 'unpaid') list = list.filter(o => !o.paid);
  else if (orderFilter === 'delivered') list = list.filter(o => o.delivered);
  else if (orderFilter === 'pending') list = list.filter(o => !o.delivered);

  const total   = list.length;
  const revenue = list.reduce((s,o) => s + o.total, 0);
  const onlineRev = list.filter(o => o.type === 'online').reduce((s,o) => s + o.total, 0);
  const paidN   = list.filter(o => o.paid).length;
  const pendN   = list.filter(o => !o.delivered).length;
  document.getElementById('ordersStats').innerHTML = `
    <div class="orders-stat">Total: <strong>${total}</strong></div>
    <div class="orders-stat">Revenue: <strong>₹${revenue.toLocaleString('en-IN')}</strong></div>
    <div class="orders-stat">Online Rev: <strong style="color:var(--primary)">₹${onlineRev.toLocaleString('en-IN')}</strong></div>
    <div class="orders-stat">Paid: <strong style="color:var(--success)">${paidN}</strong></div>
    <div class="orders-stat">Pending: <strong style="color:var(--warning)">${pendN}</strong></div>`;
  document.getElementById('ordersTable').innerHTML = buildOrderTable(list, false);
}

function filterOrders(filter, btn) {
  document.querySelectorAll('#orderFilterTabs .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  orderFilter = filter;
  renderOrders();
}

function changeOrderDate(newDate) {
  if (!newDate) return;
  selectedDate = newDate;
  renderOrders();
  showToast(`Showing orders for ${newDate.split('-').reverse().join('/')}`);
}

function buildOrderTable(list, compact) {
  if (!list.length) return '<p style="padding:20px;color:var(--text-muted)">No orders found.</p>';
  
  const rows = list.map(o => {
    const pModeIcon = o.payMode === 'online' ? '📱' : '💵';
    const pModeText = o.payMode === 'online' ? 'Online' : 'Cash';
    
    if (compact) {
      payCol = `<td>${o.paid ? `<span class="badge badge-success">✓ Paid ${pModeIcon}</span>` : '<span class="badge badge-danger">✗ Unpaid</span>'}</td>`;
      delCol = `<td>${o.delivered ? '<span class="badge badge-success">✓ Delivered</span>' : '<span class="badge badge-warning">⏳ Pending</span>'}</td>`;
      actionCol = '';
    } else {
      payCol = `<td>
        <label class="toggle-switch" title="Toggle Payment" onclick="event.stopPropagation()">
          <input type="checkbox" ${o.paid?'checked':''} onchange="toggleField('${o.id}','paid')"><span class="toggle-slider"></span>
        </label>
        <span style="display:block;font-size:11px;color:var(--text-muted);margin-top:4px">${pModeIcon} ${pModeText}</span>
      </td>`;
      delCol = `<td><label class="toggle-switch" title="Toggle Delivery" onclick="event.stopPropagation()"><input type="checkbox" ${o.delivered?'checked':''} onchange="toggleField('${o.id}','delivered')"><span class="toggle-slider"></span></label></td>`;
      actionCol = `<td><button class="icon-btn" title="Download Bill" onclick="downloadBill('${o.id}')">🧾</button><button class="icon-btn" title="Edit" onclick="openEditOrder('${o.id}')">✏️</button><button class="icon-btn danger" title="Delete" onclick="deleteOrder('${o.id}')">🗑️</button></td>`;
    }
    
    return `<tr>
      <td><strong style="color:var(--primary)">#${String(o.id).padStart(3,'0')}</strong></td>
      <td>
        ${o.customer}
        ${o.note ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${o.note.replace(/"/g, '&quot;')}">📝 ${o.note}</div>` : ''}
      </td>
      <td>
        <span class="badge" style="background:var(--surface-light);color:var(--text-color)">
          ${o.type === 'dine-in' ? '🍽️ Dine-in' : o.type === 'online' ? '🛵 Online' : '🛍️ Takeaway'}
        </span>
      </td>
      <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${getItemLabel(o.items)}</td>
      <td><strong>₹${o.total.toLocaleString('en-IN')}</strong></td>
      <td>${o.time}</td>
      ${payCol}
      ${delCol}
      ${actionCol}
    </tr>`;
  }).join('');

  const extraTh = compact
    ? '<th>Payment</th><th>Delivery</th>'
    : '<th>Payment ✓</th><th>Delivery ✓</th><th>Actions</th>';
    
  return `<table><thead><tr>
    <th>Order #</th><th>Customer</th><th>Type</th><th>Items</th><th>Total</th><th>Time</th>
    ${extraTh}
  </tr></thead><tbody>${rows}</tbody></table>`;
}

async function downloadOrdersText() {
  const list = orders.filter(o => o.date === selectedDate);
  if (!list.length) {
    showToast('No orders for this date to download', 'error');
    return;
  }
  
  const d = new Date();
  const safeDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  let totalRevenue = 0;
  let onlineRev = 0, onlineCount = 0;
  let dineInRev = 0, dineInCount = 0;
  let takeawayRev = 0, takeawayCount = 0;

  list.forEach(o => {
    totalRevenue += o.total;
    if (o.type === 'online') { onlineRev += o.total; onlineCount++; }
    else if (o.type === 'dine-in') { dineInRev += o.total; dineInCount++; }
    else { takeawayRev += o.total; takeawayCount++; }
  });
  
  let txt = `========================================================\r\n`;
  txt += `            PIZZACAFE - DAILY ORDERS REPORT\r\n`;
  txt += `            Date: ${safeDate}\r\n`;
  txt += `========================================================\r\n`;
  txt += ` SUMMARY:\r\n`;
  txt += ` ------------------------------------------------------\r\n`;
  txt += ` Total Orders  : ${list.length}\r\n`;
  txt += ` Total Revenue : Rs. ${totalRevenue}\r\n\r\n`;
  txt += ` Breakdown by Type:\r\n`;
  txt += ` - Dine-in     : ${dineInCount} orders (Rs. ${dineInRev})\r\n`;
  txt += ` - Online      : ${onlineCount} orders (Rs. ${onlineRev})\r\n`;
  txt += ` - Takeaway    : ${takeawayCount} orders (Rs. ${takeawayRev})\r\n`;
  txt += `========================================================\r\n\r\n`;
  
  const groups = [
    { title: 'ONLINE / DELIVERY ORDERS', filter: 'online' },
    { title: 'DINE-IN ORDERS', filter: 'dine-in' },
    { title: 'TAKEAWAY ORDERS', filter: 'takeaway' }
  ];

  groups.forEach(g => {
    const groupOrders = list.filter(o => o.type === g.filter);
    if (groupOrders.length === 0) return;
    
    txt += `--- ${g.title} ---\r\n\r\n`;
    groupOrders.forEach(o => {
      const items = getItemLabel(o.items);
      txt += `ORDER #${String(o.id).padStart(3, '0')}\r\n`;
      txt += `Customer : ${o.customer}\r\n`;
      txt += `Time     : ${o.time}\r\n`;
      txt += `Items    : ${items}\r\n`;
      txt += `Total    : Rs. ${o.total}\r\n`;
      txt += `Payment  : ${o.paid ? 'Paid' : 'Unpaid'} (${o.payMode === 'online' ? 'Online' : 'Cash'})\r\n`;
      txt += `Delivery : ${o.delivered ? 'Delivered' : 'Pending'}\r\n`;
      if (o.note) txt += `Note     : ${o.note}\r\n`;
      txt += `--------------------------------------------------------\r\n\r\n`;
    });
  });
  
  try {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: `PizzaCafe_Orders_${safeDate}.txt`,
        types: [{
          description: 'Text Document',
          accept: {'text/plain': ['.txt']},
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(txt);
      await writable.close();
      showToast('Text Report saved successfully!');
      return;
    }
  } catch (err) {
    if (err.name === 'AbortError') return; // User cancelled the save dialog
    console.error('File System API failed, falling back:', err);
  }
  
  // Fallback for browsers that don't support showSaveFilePicker (or if it fails)
  const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt);
  const a = document.createElement('a');
  a.href = dataUri;
  a.download = `PizzaCafe_Orders_${safeDate}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Text Report downloaded successfully!');
}

function downloadBill(orderId) {
  const o = orders.find(ord => String(ord.id) === String(orderId));
  if (!o) {
    showToast('Order not found', 'error');
    return;
  }

  const billDate = o.date;
  const billTime = o.time;
  
  let itemsText = '';
  o.items.forEach(it => {
    const m = menuItems.find(item => item.id === it.menuId);
    const itemName = m ? m.name : 'Unknown Item';
    const price = it.unitPrice !== undefined ? it.unitPrice : (m ? m.price : 0);
    const subtotal = price * it.qty;
    itemsText += `${itemName.padEnd(28)} ${String(it.qty).padStart(3)} x ${String(price).padStart(4)} ${String(subtotal).padStart(6)}\n`;
  });

  const divider = "------------------------------------------------\n";
  const doubleDivider = "================================================\n";

  let billText = '';
  billText += doubleDivider;
  billText += "                  PIZZACAFE                     \n";
  billText += "             Taste of Happiness                 \n";
  billText += " near dr B R ambedkar Half Statue, Bankar road, \n";
  billText += "              babupeth, chandrapur              \n";
  billText += "             Phone: +91 8411059504              \n";
  billText += doubleDivider;
  billText += `Bill No: #${String(o.id).padStart(4, '0')}          Type: ${o.type.toUpperCase()}\n`;
  billText += `Date: ${billDate}                Time: ${billTime}\n`;
  billText += `Customer: ${o.customer}\n`;
  billText += doubleDivider;
  billText += `Item Description             Qty   Rate   Amount\n`;
  billText += divider;
  billText += itemsText;
  billText += divider;
  billText += `Total Items: ${o.items.reduce((s, it) => s + it.qty, 0).toString().padEnd(10)} Total Amount: Rs. ${o.total}\n`;
  billText += divider;
  billText += `Payment Mode: ${o.payMode.toUpperCase()} (${o.paid ? 'PAID' : 'UNPAID'})\n`;
  if (o.cashAmount > 0) billText += ` - Paid in Cash: Rs. ${o.cashAmount}\n`;
  if (o.onlineAmount > 0) billText += ` - Paid Online: Rs. ${o.onlineAmount}\n`;
  if (o.note) billText += `Note: ${o.note}\n`;
  billText += doubleDivider;
  billText += "           Thank You! Visit Again!              \n";
  billText += doubleDivider;

  const blob = new Blob([billText], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `PizzaCafe_Bill_${o.id}_${o.customer.replace(/\s+/g, '_')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast(`Bill for Order #${o.id} downloaded!`);
}

async function importOrdersFromText(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
    
    try {
      const dateMatch = text.match(/Date:\s*(\d{4}-\d{2}-\d{2})/);
      const orderDate = dateMatch ? dateMatch[1] : new Date().toLocaleDateString('en-CA');
      
      let importedCount = 0;
      let currentType = 'dine-in';
      let currentOrder = null;
      
      const lines = text.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        if (line.includes('--- ONLINE / DELIVERY ORDERS ---')) currentType = 'online';
        if (line.includes('--- DINE-IN ORDERS ---')) currentType = 'dine-in';
        if (line.includes('--- TAKEAWAY ORDERS ---')) currentType = 'takeaway';
        
        if (line.startsWith('ORDER #')) {
           if (currentOrder && currentOrder.customer && currentOrder.customer !== 'Unknown') {
              orders.push(currentOrder);
              importedCount++;
           }
           currentOrder = {
             id: nextOrderId++,
             customer: 'Unknown',
             time: '12:00 PM',
             items: [],
             total: 0,
             paid: false,
             payMode: 'cash',
             delivered: false,
             note: '',
             type: currentType,
             date: orderDate
           };
        }
        
        if (currentOrder) {
           if (line.startsWith('Type     :')) {
              const t = line.split(':')[1].trim().toLowerCase();
              if (t.includes('online')) currentOrder.type = 'online';
              else if (t.includes('takeaway')) currentOrder.type = 'takeaway';
              else currentOrder.type = 'dine-in';
           }
           if (line.startsWith('Customer :')) currentOrder.customer = line.substring(10).trim();
           if (line.startsWith('Time     :')) currentOrder.time = line.substring(10).trim();
           if (line.startsWith('Items    :')) {
               const itemsRaw = line.substring(10).trim();
               if (itemsRaw && itemsRaw !== '?') {
                  const splitItems = itemsRaw.split(',');
                  splitItems.forEach(itemStr => {
                    const match = itemStr.match(/(.*)\s+x(\d+)/);
                    if (match) {
                      const itemName = match[1].trim();
                      const qty = parseInt(match[2]);
                      const menuItem = menuItems.find(m => m.name.toLowerCase() === itemName.toLowerCase());
                      if (menuItem) currentOrder.items.push({ menuId: menuItem.id, qty });
                    }
                  });
               }
           }
           if (line.startsWith('Total    :')) {
               const t = line.substring(10).replace('Rs.', '').trim();
               currentOrder.total = parseInt(t) || 0;
           }
           if (line.startsWith('Payment  :')) {
               const p = line.substring(10).trim();
               currentOrder.paid = p.includes('Paid');
               currentOrder.payMode = p.includes('Online') ? 'online' : 'cash';
           }
           if (line.startsWith('Delivery :')) {
               currentOrder.delivered = line.includes('Delivered');
           }
           if (line.startsWith('Note     :')) {
               currentOrder.note = line.substring(10).trim();
           }
        }
      }
      
      if (currentOrder && currentOrder.customer && currentOrder.customer !== 'Unknown') {
         orders.push(currentOrder);
         importedCount++;
      }
      
      if (importedCount > 0) {
        if (typeof saveData === 'function') await saveData();
        selectedDate = orderDate;
        document.getElementById('orderDateFilter').value = selectedDate;
        renderOrders();
        showToast(`Imported ${importedCount} orders successfully!`, 'success');
      } else {
        showToast('No valid orders found in file.', 'error');
      }
      
    } catch (err) {
      console.error(err);
      showToast('Error parsing TXT file.', 'error');
    }
    
    event.target.value = '';
  };
  reader.readAsText(file);
}

function toggleField(id, field) {
  const o = orders.find(o => String(o.id) === String(id));
  if (!o) return;
  o[field] = !o[field];
  
  if (field === 'paid') {
    if (o.paid) {
      if (o.payMode === 'online') {
        o.onlineAmount = o.total;
        o.cashAmount = 0;
      } else {
        o.cashAmount = o.total;
        o.onlineAmount = 0;
        o.payMode = 'cash';
      }
    } else {
      o.cashAmount = 0;
      o.onlineAmount = 0;
    }
  }
  
  saveData();
  renderOrders();
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'analytics') renderAnalytics();
  showToast(`Order #${String(id).padStart(3,'0')} ${field} updated!`);
}

function deleteOrder(id) {
  const idx = orders.findIndex(o => String(o.id) === String(id));
  if (idx !== -1) orders.splice(idx, 1);
  saveData();
  renderOrders();
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'analytics') renderAnalytics();
  showToast('Order deleted', 'error');
}

// ---- NEW ORDER ----
function openNewOrderModal() {
  newOrderItems = [];
  document.getElementById('customerName').value = '';
  document.getElementById('menuSearch').value = '';
  document.getElementById('orderNote').value = '';
  document.getElementById('orderTotalInput').value = '0';
  document.getElementById('orderCashAmount').value = '0';
  document.getElementById('orderOnlineAmount').value = '0';
  document.getElementById('payBalanceNew').textContent = '';
  renderNewOrderItems();
  openModal('newOrderModal');
}

function searchMenu(q) {
  const dd = document.getElementById('menuDropdown');
  if (!q.trim()) { dd.classList.remove('open'); return; }
  const found = menuItems.filter(m => m.available && m.name.toLowerCase().includes(q.toLowerCase()));
  if (!found.length) { dd.innerHTML='<div class="dropdown-item"><span class="dropdown-item-name" style="color:var(--text-muted)">No items found</span></div>'; dd.classList.add('open'); return; }
  dd.innerHTML = found.map(m =>
    `<div class="dropdown-item" onclick="addToNewOrder(${m.id})">
      <span class="dropdown-item-name">${m.name}</span>
      <span class="dropdown-item-price">₹${m.price}</span>
    </div>`).join('');
  dd.classList.add('open');
}

function addToNewOrder(menuId) {
  const existing = newOrderItems.find(i => i.menuId === menuId);
  if (existing) existing.qty++;
  else {
    const m = menuItems.find(m => m.id === menuId);
    newOrderItems.push({ menuId, qty: 1, unitPrice: m.price });
  }
  document.getElementById('menuSearch').value = '';
  document.getElementById('menuDropdown').classList.remove('open');
  renderNewOrderItems();
}

function updateItemPrice(type, idx, val) {
  const arr = type === 'new' ? newOrderItems : editOrderItems;
  arr[idx].unitPrice = parseInt(val) || 0;
  type === 'new' ? renderNewOrderItems() : renderEditOrderItems();
}

function renderNewOrderItems() {
  const el = document.getElementById('selectedItems');
  const totalEl = document.getElementById('orderTotalInput');
  if (!newOrderItems.length) { el.innerHTML='<p class="empty-label">No items added yet</p>'; totalEl.value='0'; return; }
  let total = 0;
  el.innerHTML = newOrderItems.map((it,idx) => {
    const m = menuItems.find(m => m.id === it.menuId);
    if (!m) return '';
    const price = it.unitPrice !== undefined ? it.unitPrice : m.price;
    const sub = price * it.qty; total += sub;
    return `<div class="selected-item">
      <span class="selected-item-name">${m.name}</span>
      <div style="display:flex;align-items:center;gap:4px">
        <span style="font-size:11px;color:var(--text-muted)">₹</span>
        <input type="number" class="form-input" style="width:55px;height:24px;padding:2px 4px;font-size:12px;text-align:center" value="${price}" onchange="updateItemPrice('new',${idx},this.value)">
      </div>
      <div class="qty-controls">
        <button class="qty-btn" onclick="changeQty('new',${idx},-1)">−</button>
        <span class="qty-display">${it.qty}</span>
        <button class="qty-btn" onclick="changeQty('new',${idx},1)">+</button>
      </div>
      <span class="selected-item-price" style="min-width:45px;text-align:right">₹${sub}</span>
      <button class="remove-item" onclick="removeItem('new',${idx})">✕</button>
    </div>`;
  }).join('');
  totalEl.value = total;
}

function changeQty(type, idx, delta) {
  const arr = type === 'new' ? newOrderItems : editOrderItems;
  arr[idx].qty = Math.max(1, arr[idx].qty + delta);
  type === 'new' ? renderNewOrderItems() : renderEditOrderItems();
}

function removeItem(type, idx) {
  if (type === 'new') { newOrderItems.splice(idx,1); renderNewOrderItems(); }
  else { editOrderItems.splice(idx,1); renderEditOrderItems(); }
}

function updatePayBalance(type) {
  const totalId = type === 'new' ? 'orderTotalInput' : 'editOrderTotalInput';
  const cashId  = type === 'new' ? 'orderCashAmount' : 'editCashAmount';
  const onlineId= type === 'new' ? 'orderOnlineAmount' : 'editOnlineAmount';
  const balId   = type === 'new' ? 'payBalanceNew' : 'payBalanceEdit';
  const total   = parseInt(document.getElementById(totalId).value) || 0;
  const cash    = parseInt(document.getElementById(cashId).value) || 0;
  const online  = parseInt(document.getElementById(onlineId).value) || 0;
  const collected = cash + online;
  const balance = total - collected;
  const el = document.getElementById(balId);
  if (!el) return;
  if (collected === 0) { el.textContent = ''; el.className = 'pay-balance'; return; }
  if (balance === 0) {
    el.textContent = '✅ Fully Paid';
    el.className = 'pay-balance pay-ok';
  } else if (balance > 0) {
    el.textContent = `⚠️ Remaining: ₹${balance} unpaid`;
    el.className = 'pay-balance pay-warn';
  } else {
    el.textContent = `ℹ️ Extra ₹${Math.abs(balance)} entered`;
    el.className = 'pay-balance pay-info';
  }
}

function saveNewOrder() {
  const name = document.getElementById('customerName').value.trim();
  if (!name) { showToast('Please enter customer name','error'); return; }
  if (!newOrderItems.length) { showToast('Please add at least one item','error'); return; }
  const type = document.getElementById('orderType').value;
  const note = document.getElementById('orderNote').value.trim();
  const total = parseInt(document.getElementById('orderTotalInput').value) || 0;
  const cashAmount   = parseInt(document.getElementById('orderCashAmount').value) || 0;
  const onlineAmount = parseInt(document.getElementById('orderOnlineAmount').value) || 0;
  const paid = (cashAmount + onlineAmount) >= total;
  // derive payMode for backwards compat display
  const payMode = cashAmount > 0 && onlineAmount > 0 ? 'split' : (onlineAmount > 0 ? 'online' : 'cash');
  const now = new Date();
  const hrs = now.getHours(); const mins = now.getMinutes();
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  const displayHrs = hrs % 12 || 12;
  const time = `${String(displayHrs).padStart(2,'0')}:${String(mins).padStart(2,'0')} ${ampm}`;
  // Daily order number — count today's orders + 1
  const dayNum = orders.filter(o => o.date === selectedDate).length + 1;
  orders.push({ id:nextOrderId++, dayNum, customer:name, date:selectedDate, items:[...newOrderItems], paid, payMode, cashAmount, onlineAmount, type, delivered:false, time, total, note });
  saveData();
  closeModal('newOrderModal');
  renderOrders();
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'analytics') renderAnalytics();
  showToast(`Order #${dayNum} saved!`);
}

// ---- EDIT ORDER ----
function openEditOrder(id) {
  const o = orders.find(o => String(o.id) === String(id));
  if (!o) return;
  editOrderItems = o.items.map(i => ({...i}));
  document.getElementById('editOrderId').value = o.id;
  document.getElementById('editCustomerName').value = o.customer;
  document.getElementById('editOrderType').value = o.type || 'dine-in';
  document.getElementById('editOrderNote').value = o.note || '';
  document.getElementById('editCashAmount').value = o.cashAmount || 0;
  document.getElementById('editOnlineAmount').value = o.onlineAmount || 0;
  renderEditOrderItems();
  document.getElementById('editOrderTotalInput').value = o.total;
  updatePayBalance('edit');
  openModal('editOrderModal');
}

function searchEditMenu(q) {
  const dd = document.getElementById('editMenuDropdown');
  if (!q.trim()) { dd.classList.remove('open'); return; }
  const found = menuItems.filter(m => m.available && m.name.toLowerCase().includes(q.toLowerCase()));
  dd.innerHTML = found.map(m =>
    `<div class="dropdown-item" onclick="addToEditOrder(${m.id})">
      <span class="dropdown-item-name">${m.name}</span>
      <span class="dropdown-item-price">₹${m.price}</span>
    </div>`).join('') || '<div class="dropdown-item"><span class="dropdown-item-name" style="color:var(--text-muted)">No items</span></div>';
  dd.classList.add('open');
}

function addToEditOrder(menuId) {
  const existing = editOrderItems.find(i => i.menuId === menuId);
  if (existing) existing.qty++;
  else {
    const m = menuItems.find(m => m.id === menuId);
    editOrderItems.push({ menuId, qty:1, unitPrice: m.price });
  }
  document.getElementById('editMenuSearch').value = '';
  document.getElementById('editMenuDropdown').classList.remove('open');
  renderEditOrderItems();
}

function renderEditOrderItems() {
  const el = document.getElementById('editSelectedItems');
  const totalEl = document.getElementById('editOrderTotalInput');
  if (!editOrderItems.length) { el.innerHTML='<p class="empty-label">No items</p>'; totalEl.value='0'; return; }
  let total = 0;
  el.innerHTML = editOrderItems.map((it,idx) => {
    const m = menuItems.find(m => m.id === it.menuId);
    if (!m) return '';
    const price = it.unitPrice !== undefined ? it.unitPrice : m.price;
    const sub = price * it.qty; total += sub;
    return `<div class="selected-item">
      <span class="selected-item-name">${m.name}</span>
      <div style="display:flex;align-items:center;gap:4px">
        <span style="font-size:11px;color:var(--text-muted)">₹</span>
        <input type="number" class="form-input" style="width:55px;height:24px;padding:2px 4px;font-size:12px;text-align:center" value="${price}" onchange="updateItemPrice('edit',${idx},this.value)">
      </div>
      <div class="qty-controls">
        <button class="qty-btn" onclick="changeQty('edit',${idx},-1)">−</button>
        <span class="qty-display">${it.qty}</span>
        <button class="qty-btn" onclick="changeQty('edit',${idx},1)">+</button>
      </div>
      <span class="selected-item-price" style="min-width:45px;text-align:right">₹${sub}</span>
      <button class="remove-item" onclick="removeItem('edit',${idx})">✕</button>
    </div>`;
  }).join('');
  totalEl.value = total;
}

function updateOrder() {
  const id = parseInt(document.getElementById('editOrderId').value);
  const name = document.getElementById('editCustomerName').value.trim();
  if (!name) { showToast('Please enter customer name','error'); return; }
  if (!editOrderItems.length) { showToast('Add at least one item','error'); return; }
  const o = orders.find(o => String(o.id) === String(id));
  if (!o) return;
  o.customer = name;
  o.items = [...editOrderItems];
  o.type = document.getElementById('editOrderType').value;
  o.note = document.getElementById('editOrderNote').value.trim();
  o.total = parseInt(document.getElementById('editOrderTotalInput').value) || 0;
  o.cashAmount = parseInt(document.getElementById('editCashAmount').value) || 0;
  o.onlineAmount = parseInt(document.getElementById('editOnlineAmount').value) || 0;
  o.paid = (o.cashAmount + o.onlineAmount) >= o.total;
  o.payMode = o.cashAmount > 0 && o.onlineAmount > 0 ? 'split' : (o.onlineAmount > 0 ? 'online' : 'cash');
  saveData();
  closeModal('editOrderModal');
  renderOrders();
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'analytics') renderAnalytics();
  showToast(`Order #${o.dayNum || id} updated!`);
}

// =============================================
// MENU MANAGER
// =============================================
function renderMenu() {
  const list = menuFilter === 'all' ? menuItems : menuItems.filter(m => m.category === menuFilter);
  const catMeta = {
    special:  { label: '🍕 Special',    cls: 'badge-pizza' },
    pizza:    { label: '🍕 Classic',    cls: 'badge-pizza' },
    combo:    { label: '🍱 Combo',      cls: 'badge-warning' },
    momo:     { label: '🥟 Momos',      cls: 'badge-side' },
    sandwich: { label: '🥪 Sandwich',   cls: 'badge-side' },
    side:     { label: '🍟 Side',       cls: 'badge-side' },
    drink:    { label: '🥤 Drink',      cls: 'badge-drink' },
    dessert:  { label: '🍰 Dessert',    cls: 'badge-dessert' },
    extra:    { label: '🧀 Extra',      cls: 'badge-extra' },
  };
  document.getElementById('menuGrid').innerHTML = list.map(m => {
    const meta = catMeta[m.category] || { label: m.category, cls: '' };
    return `<div class="menu-card">
      <div class="menu-card-header">
        <span class="badge ${meta.cls}">${meta.label}</span>
        <label class="toggle-switch" title="Toggle availability">
          <input type="checkbox" ${m.available?'checked':''} onchange="toggleMenuAvail(${m.id})">
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="menu-card-name">${m.name}</div>
      <div class="menu-card-desc">${m.desc}</div>
      <div class="menu-card-price">₹${m.price}</div>
      <div class="menu-card-footer">
        <span class="avail-label" style="color:${m.available?'var(--success)':'var(--danger)'}">
          ${m.available ? '✓ Available' : '✗ Unavailable'}
        </span>
        <div class="menu-card-actions">
          <button class="icon-btn" onclick="openMenuModal(${m.id})" title="Edit">✏️</button>
          <button class="icon-btn danger" onclick="deleteMenuItem(${m.id})" title="Delete">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('') || '<p style="color:var(--text-muted);padding:20px">No items in this category.</p>';
}

function filterMenu(f, btn) {
  menuFilter = f;
  document.querySelectorAll('#menuFilterTabs .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderMenu();
}

function toggleMenuAvail(id) {
  const m = menuItems.find(m => m.id === id);
  if (m) { m.available = !m.available; renderMenu(); showToast(`${m.name} ${m.available?'enabled':'disabled'}`); }
}

function openMenuModal(id) {
  const modal = document.getElementById('menuModal');
  document.getElementById('editMenuId').value = id || '';
  if (id) {
    const m = menuItems.find(m => m.id === id);
    document.getElementById('menuModalTitle').textContent = 'Edit Menu Item';
    document.getElementById('menuItemName').value = m.name;
    document.getElementById('menuItemCategory').value = m.category;
    document.getElementById('menuItemPrice').value = m.price;
    document.getElementById('menuItemDesc').value = m.desc;
    document.getElementById('menuItemAvail').checked = m.available;
  } else {
    document.getElementById('menuModalTitle').textContent = 'Add New Item';
    document.getElementById('menuItemName').value = '';
    document.getElementById('menuItemPrice').value = '';
    document.getElementById('menuItemDesc').value = '';
    document.getElementById('menuItemAvail').checked = true;
  }
  openModal('menuModal');
}

function saveMenuItem() {
  const name  = document.getElementById('menuItemName').value.trim();
  const cat   = document.getElementById('menuItemCategory').value;
  const price = parseInt(document.getElementById('menuItemPrice').value);
  const desc  = document.getElementById('menuItemDesc').value.trim();
  const avail = document.getElementById('menuItemAvail').checked;
  const id    = document.getElementById('editMenuId').value;
  if (!name || !price) { showToast('Name and price are required','error'); return; }
  if (id) {
    const m = menuItems.find(m => m.id === parseInt(id));
    Object.assign(m, { name, category:cat, price, desc, available:avail });
    showToast('Menu item updated!');
  } else {
    menuItems.push({ id:nextMenuId++, name, category:cat, price, desc, available:avail });
    showToast('New item added!');
  }
  saveData();
  closeModal('menuModal');
  renderMenu();
}

function deleteMenuItem(id) {
  const idx = menuItems.findIndex(m => String(m.id) === String(id));
  if (idx !== -1) menuItems.splice(idx, 1);
  saveData();
  renderMenu();
  showToast('Item deleted','error');
}

// =============================================
// SALES ANALYTICS
// =============================================
let analyticsPeriod = 'week';
let drillHourlyChart, drillTypeChart;

function setAnalyticsPeriod(p, btn) {
  analyticsPeriod = p;
  document.querySelectorAll('.analytics-period-tabs .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  closeDrillDown();
  renderAnalytics();
}

function getAnalyticsDates() {
  const today = getTodayIST();
  if (analyticsPeriod === 'week') {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(new Date(today).getTime() - i * 86400000);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  } else if (analyticsPeriod === 'month') {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(new Date(today).getTime() - i * 86400000);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  } else {
    // All time — unique dates from orders
    const dates = [...new Set(orders.map(o => o.date))].sort();
    return dates;
  }
}

function renderAnalytics() {
  const dates = getAnalyticsDates();
  const filteredOrders = orders.filter(o => dates.includes(o.date));

  const totalRev = filteredOrders.reduce((s,o) => s+o.total, 0);
  const totalOrd = filteredOrders.length;
  const avgVal = totalOrd ? Math.round(totalRev / totalOrd) : 0;

  const itemMap = {};
  filteredOrders.forEach(o => {
    o.items.forEach(it => {
      const p = it.unitPrice !== undefined ? it.unitPrice : (menuItems.find(m=>m.id===it.menuId)?.price||0);
      if(!itemMap[it.menuId]) itemMap[it.menuId] = { id: it.menuId, qty: 0, rev: 0 };
      itemMap[it.menuId].qty += it.qty;
      itemMap[it.menuId].rev += (p * it.qty);
    });
  });
  const sortedItems = Object.values(itemMap).sort((a,b) => b.rev - a.rev);
  const topM = sortedItems.length ? menuItems.find(m=>m.id===sortedItems[0].id) : null;
  const topName = topM ? topM.name : 'N/A';
  const topOrders = sortedItems.length ? sortedItems[0].qty : 0;

  const cashRev = filteredOrders.filter(o=>o.paid&&o.payMode==='cash').reduce((s,o)=>s+o.total,0);
  const onlineRev = filteredOrders.filter(o=>o.paid&&o.payMode==='online').reduce((s,o)=>s+o.total,0);

  document.getElementById('analyticsKpiGrid').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Total Revenue</div>
      <div class="kpi-value">₹${totalRev.toLocaleString('en-IN')}</div>
      <div class="kpi-trend trend-up">▲ ${analyticsPeriod === 'week' ? 'This week' : analyticsPeriod === 'month' ? 'This month' : 'All time'}</div><div class="kpi-icon">💰</div></div>
    <div class="kpi-card success"><div class="kpi-label">Total Orders</div>
      <div class="kpi-value">${totalOrd}</div>
      <div class="kpi-trend trend-up">▲ ${dates.length} days</div><div class="kpi-icon">🧾</div></div>
    <div class="kpi-card warning"><div class="kpi-label">Avg Order Value</div>
      <div class="kpi-value">₹${avgVal.toLocaleString('en-IN')}</div>
      <div class="kpi-trend trend-up">per order</div><div class="kpi-icon">📊</div></div>
    <div class="kpi-card"><div class="kpi-label">Top Seller</div>
      <div class="kpi-value" style="font-size:15px;margin-top:4px">${topName}</div>
      <div class="kpi-trend" style="color:var(--primary)">${topOrders} units sold</div><div class="kpi-icon">🍕</div></div>`;

  // Daily Revenue Bar Chart
  const dayLabels = dates.map(d => {
    const dt = new Date(d + 'T00:00:00');
    return analyticsPeriod === 'month'
      ? dt.toLocaleDateString('en-IN', {day:'2-digit', month:'short'})
      : dt.toLocaleDateString('en-US', {weekday:'short'});
  });
  const dayRevs = dates.map(d => orders.filter(o => o.date === d).reduce((s,o)=>s+o.total,0));

  if (revenueChart) revenueChart.destroy();
  const rCtx = document.getElementById('revenueBarChart').getContext('2d');
  const rGrad = rCtx.createLinearGradient(0,0,0,220);
  rGrad.addColorStop(0,'rgba(255,107,43,0.95)'); rGrad.addColorStop(1,'rgba(255,107,43,0.35)');
  revenueChart = new Chart(rCtx, {
    type:'bar',
    data:{ labels: dayLabels, datasets:[{ data: dayRevs, backgroundColor: rGrad, borderRadius:6, borderSkipped:false, hoverBackgroundColor:'rgba(255,150,80,1)' }]},
    options:{
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label: ctx => `₹${ctx.raw.toLocaleString('en-IN')}` } }},
      scales:{
        x:{grid:{color:'#1e1e1e'}, ticks:{color:'#666'}},
        y:{grid:{color:'#1e1e1e'}, ticks:{color:'#666', callback:v=>'₹'+v.toLocaleString('en-IN')}}
      },
      onClick: (evt, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const clickedDate = dates[idx];
          openDayDrillDown(clickedDate);
        }
      },
      onHover: (evt, elements) => {
        evt.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      }
    }
  });

  // Category Donut
  const catRev = { pizza:0, side:0, drink:0, dessert:0 };
  filteredOrders.forEach(o => {
    o.items.forEach(it => {
      const m = menuItems.find(m=>m.id===it.menuId);
      if(m) {
        const p = it.unitPrice !== undefined ? it.unitPrice : m.price;
        const c = m.category;
        if(c==='special'||c==='pizza'||c==='combo') catRev.pizza += p*it.qty;
        else if(c==='momo'||c==='sandwich'||c==='side'||c==='extra') catRev.side += p*it.qty;
        else if(c==='drink') catRev.drink += p*it.qty;
        else if(c==='dessert') catRev.dessert += p*it.qty;
      }
    });
  });

  if (categoryChart) categoryChart.destroy();
  const dCtx = document.getElementById('categoryDonut').getContext('2d');
  categoryChart = new Chart(dCtx, {
    type:'doughnut',
    data:{ labels:['Pizzas','Sides','Drinks','Desserts'],
      datasets:[{ data:[catRev.pizza, catRev.side, catRev.drink, catRev.dessert], backgroundColor:['#ff6b2b','#14b8a6','#3b82f6','#a855f7'], borderWidth:0, hoverOffset:8 }]},
    options:{ plugins:{ legend:{ position:'bottom', labels:{ color:'#888', padding:12, font:{size:12} }}}, cutout:'65%' }
  });

  // Top 5 items
  const top5 = sortedItems.slice(0,5);
  const rankClass = [,'rank-1','rank-2','rank-3','rank-n','rank-n'];
  document.getElementById('topItemsTable').innerHTML = top5.map((t, idx) => {
    const m = menuItems.find(m=>m.id===t.id);
    const r = idx + 1;
    return `<div class="top-items-row">
      <div class="rank-badge ${rankClass[r]}">${r}</div>
      <span class="top-item-name" style="max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m?m.name:'Item'}</span>
      <span class="top-item-orders">${t.qty} qty</span>
      <span class="top-item-rev">₹${t.rev.toLocaleString('en-IN')}</span>
    </div>`;
  }).join('') || '<p style="padding:10px;color:var(--text-muted)">No items sold yet.</p>';

  // Payment Summary
  const paidOrd = filteredOrders.filter(o=>o.paid).length;
  const paidRev = filteredOrders.filter(o=>o.paid).reduce((s,o)=>s+o.total,0);
  const pct = totalOrd ? Math.round(paidOrd/totalOrd*100) : 0;
  document.getElementById('paymentSummary').innerHTML = `
    <div class="payment-summary-row"><span>Paid Orders</span><span class="payment-big" style="color:var(--success)">${paidOrd}</span></div>
    <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
    <div class="payment-summary-row" style="margin-bottom:12px"><span style="color:var(--text-muted)">${pct}% paid</span><span style="color:var(--success)">₹${paidRev.toLocaleString('en-IN')}</span></div>
    <div class="payment-summary-row"><span>Unpaid Orders</span><span class="payment-big" style="color:var(--danger)">${totalOrd-paidOrd}</span></div>
    <div class="payment-summary-row" style="margin-bottom:16px"><span style="color:var(--text-muted)">${100-pct}% unpaid</span><span style="color:var(--danger)">₹${(totalRev-paidRev).toLocaleString('en-IN')}</span></div>
    <div style="border-top:1px solid var(--border);padding-top:14px">
      <div class="payment-summary-row"><span>💵 Cash</span><strong>₹${cashRev.toLocaleString('en-IN')}</strong></div>
      <div class="payment-summary-row"><span>📱 Online</span><strong>₹${onlineRev.toLocaleString('en-IN')}</strong></div>
    </div>`;
}

// =============================================
// DAY DRILL-DOWN
// =============================================
function openDayDrillDown(date) {
  const dayOrders = orders.filter(o => o.date === date);
  const panel = document.getElementById('dayDrillDown');
  const dt = new Date(date + 'T00:00:00');
  const dayLabel = dt.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  document.getElementById('drillTitle').textContent = `📅 ${dayLabel}`;
  document.getElementById('drillSubtitle').textContent = `${dayOrders.length} orders recorded`;
  document.getElementById('drillOrderCount').textContent = `${dayOrders.length} orders`;

  // KPIs
  const rev = dayOrders.reduce((s,o) => s+o.total, 0);
  const paidRev = dayOrders.filter(o=>o.paid).reduce((s,o)=>s+o.total,0);
  const cashRev = dayOrders.filter(o=>o.paid&&o.payMode==='cash').reduce((s,o)=>s+o.total,0);
  const onlineRev = dayOrders.filter(o=>o.paid&&o.payMode==='online').reduce((s,o)=>s+o.total,0);
  const unpaid = rev - paidRev;
  const avg = dayOrders.length ? Math.round(rev/dayOrders.length) : 0;
  const dineIn = dayOrders.filter(o=>o.type==='dine-in').length;
  const online = dayOrders.filter(o=>o.type==='online').length;
  const takeaway = dayOrders.filter(o=>o.type==='takeaway').length;

  document.getElementById('drillKpiGrid').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Total Revenue</div>
      <div class="kpi-value">₹${rev.toLocaleString('en-IN')}</div>
      <div class="kpi-trend trend-up">▲ This day</div><div class="kpi-icon">💰</div></div>
    <div class="kpi-card success"><div class="kpi-label">Total Orders</div>
      <div class="kpi-value">${dayOrders.length}</div>
      <div class="kpi-trend trend-up">▲ Completed</div><div class="kpi-icon">🧾</div></div>
    <div class="kpi-card warning"><div class="kpi-label">Avg Order Value</div>
      <div class="kpi-value">₹${avg.toLocaleString('en-IN')}</div>
      <div class="kpi-trend">per order</div><div class="kpi-icon">📊</div></div>
    <div class="kpi-card danger"><div class="kpi-label">Unpaid Amount</div>
      <div class="kpi-value">₹${unpaid.toLocaleString('en-IN')}</div>
      <div class="kpi-trend trend-down">▼ Pending</div><div class="kpi-icon">💳</div></div>`;

  // Hourly Chart
  const hrLabels = [];
  const hrData = [];
  const hrCounts = [];
  for (let h = 9; h <= 22; h++) {
    hrLabels.push(`${h > 12 ? h-12 : h}${h >= 12 ? 'pm' : 'am'}`);
    const hourOrders = dayOrders.filter(o => {
      const m = o.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!m) return false;
      let hr = parseInt(m[1]);
      const ap = m[3].toUpperCase();
      if (ap === 'PM' && hr !== 12) hr += 12;
      if (ap === 'AM' && hr === 12) hr = 0;
      return hr === h;
    });
    hrData.push(hourOrders.reduce((s,o)=>s+o.total,0));
    hrCounts.push(hourOrders.length);
  }

  if (drillHourlyChart) drillHourlyChart.destroy();
  const hCtx = document.getElementById('drillHourlyChart').getContext('2d');
  const hGrad = hCtx.createLinearGradient(0,0,0,200);
  hGrad.addColorStop(0,'rgba(255,107,43,0.5)'); hGrad.addColorStop(1,'rgba(255,107,43,0)');
  drillHourlyChart = new Chart(hCtx, {
    type:'line',
    data:{ labels:hrLabels, datasets:[{
      label:'Revenue', data:hrData, borderColor:'#ff6b2b', backgroundColor:hGrad,
      fill:true, tension:0.4, pointBackgroundColor:'#ff6b2b', pointRadius:4, borderWidth:2
    }]},
    options:{ plugins:{ legend:{display:false}, tooltip:{ callbacks:{
      label: ctx => `₹${ctx.raw.toLocaleString('en-IN')}`,
      afterLabel: (ctx) => `${hrCounts[ctx.dataIndex]} orders`
    }}},
    scales:{
      x:{grid:{color:'#1e1e1e'}, ticks:{color:'#666'}},
      y:{grid:{color:'#1e1e1e'}, ticks:{color:'#666', callback:v=>'₹'+v.toLocaleString('en-IN')}}
    }}
  });

  // Order Type Donut
  if (drillTypeChart) drillTypeChart.destroy();
  const tCtx = document.getElementById('drillTypeChart').getContext('2d');
  drillTypeChart = new Chart(tCtx, {
    type:'doughnut',
    data:{ labels:['Dine-in','Online Delivery','Takeaway'],
      datasets:[{ data:[dineIn, online, takeaway], backgroundColor:['#ff6b2b','#14b8a6','#a855f7'], borderWidth:0, hoverOffset:8 }]},
    options:{ plugins:{ legend:{ position:'bottom', labels:{ color:'#888', padding:12, font:{size:12} }}}, cutout:'60%' }
  });

  // Payment Breakdown
  const paidCount = dayOrders.filter(o=>o.paid).length;
  const unpaidCount = dayOrders.length - paidCount;
  const pct = dayOrders.length ? Math.round(paidCount/dayOrders.length*100) : 0;
  document.getElementById('drillPaymentDetail').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div class="drill-stat-box" style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2)">
        <div style="font-size:11px;color:#22c55e;font-weight:600;margin-bottom:4px">💵 CASH</div>
        <div style="font-size:22px;font-weight:700;color:var(--text-color)">₹${cashRev.toLocaleString('en-IN')}</div>
        <div style="font-size:11px;color:var(--text-muted)">${dayOrders.filter(o=>o.payMode==='cash').length} orders</div>
      </div>
      <div class="drill-stat-box" style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2)">
        <div style="font-size:11px;color:#3b82f6;font-weight:600;margin-bottom:4px">📱 ONLINE / UPI</div>
        <div style="font-size:22px;font-weight:700;color:var(--text-color)">₹${onlineRev.toLocaleString('en-IN')}</div>
        <div style="font-size:11px;color:var(--text-muted)">${dayOrders.filter(o=>o.payMode==='online').length} orders</div>
      </div>
    </div>
    <div class="payment-summary-row"><span>✅ Paid</span><span class="payment-big" style="color:var(--success)">${paidCount} orders</span></div>
    <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,#22c55e,#16a34a)"></div></div>
    <div class="payment-summary-row" style="margin-top:4px"><span style="color:var(--text-muted)">₹${paidRev.toLocaleString('en-IN')} collected</span><span style="color:var(--success)">${pct}%</span></div>
    <div class="payment-summary-row" style="margin-top:12px"><span>❌ Unpaid</span><span class="payment-big" style="color:var(--danger)">${unpaidCount} orders</span></div>
    <div class="payment-summary-row"><span style="color:var(--text-muted)">₹${unpaid.toLocaleString('en-IN')} pending</span><span style="color:var(--danger)">${100-pct}%</span></div>`;

  // Top items this day
  const dayItemMap = {};
  dayOrders.forEach(o => {
    o.items.forEach(it => {
      const p = it.unitPrice !== undefined ? it.unitPrice : (menuItems.find(m=>m.id===it.menuId)?.price||0);
      if(!dayItemMap[it.menuId]) dayItemMap[it.menuId] = { id:it.menuId, qty:0, rev:0 };
      dayItemMap[it.menuId].qty += it.qty;
      dayItemMap[it.menuId].rev += p*it.qty;
    });
  });
  const dayTop = Object.values(dayItemMap).sort((a,b)=>b.qty-a.qty).slice(0,5);
  const maxQty = dayTop.length ? dayTop[0].qty : 1;
  document.getElementById('drillTopItems').innerHTML = dayTop.map((t,i) => {
    const m = menuItems.find(m=>m.id===t.id);
    const pct = Math.round(t.qty/maxQty*100);
    const rankColors = ['#ff6b2b','#f59e0b','#a855f7','#14b8a6','#3b82f6'];
    return `<div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:13px;font-weight:600;color:var(--text-color)">${m?m.name:'?'}</span>
        <span style="font-size:12px;color:var(--text-muted)">${t.qty} pcs · ₹${t.rev.toLocaleString('en-IN')}</span>
      </div>
      <div style="background:var(--surface-light);border-radius:4px;height:6px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${rankColors[i]};border-radius:4px;transition:width 0.6s ease"></div>
      </div>
    </div>`;
  }).join('') || '<p style="color:var(--text-muted);padding:10px">No orders this day.</p>';

  // Full orders table (compact)
  document.getElementById('drillOrdersTable').innerHTML = buildCompactDrillTable(dayOrders);

  // Show panel
  panel.style.display = 'block';
  setTimeout(() => panel.classList.add('drill-visible'), 10);
  panel.scrollIntoView({ behavior:'smooth', block:'start' });
}

function buildCompactDrillTable(list) {
  if (!list.length) return '<p style="padding:20px;color:var(--text-muted)">No orders this day.</p>';
  const rows = list.map(o => {
    const pIcon = o.payMode === 'online' ? '📱' : '💵';
    return `<tr>
      <td><strong style="color:var(--primary)">#${String(o.id).padStart(3,'0')}</strong></td>
      <td>${o.customer}${o.note?`<div style="font-size:10px;color:var(--text-muted)">📝 ${o.note}</div>`:''}</td>
      <td><span class="badge" style="background:var(--surface-light);color:var(--text-color)">${o.type==='dine-in'?'🍽️ Dine-in':o.type==='online'?'🛵 Online':'🛍️ Takeaway'}</span></td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${getItemLabel(o.items)}</td>
      <td><strong>₹${o.total.toLocaleString('en-IN')}</strong></td>
      <td style="color:var(--text-muted)">${o.time}</td>
      <td>${o.paid ? `<span class="badge badge-success">✓ Paid ${pIcon}</span>` : '<span class="badge badge-danger">✗ Unpaid</span>'}</td>
      <td>${o.delivered ? '<span class="badge badge-success">✓ Done</span>' : '<span class="badge badge-warning">⏳ Pending</span>'}</td>
    </tr>`;
  }).join('');
  return `<table><thead><tr>
    <th>Order #</th><th>Customer</th><th>Type</th><th>Items</th><th>Total</th><th>Time</th><th>Payment</th><th>Delivery</th>
  </tr></thead><tbody>${rows}</tbody></table>`;
}

function closeDrillDown() {
  const panel = document.getElementById('dayDrillDown');
  panel.classList.remove('drill-visible');
  setTimeout(() => { panel.style.display = 'none'; }, 350);
}


// ---- SPARK ANIMATION BACKGROUND ----
function initSparkCanvas() {
  const canvas = document.getElementById('spark-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles = [];
  const maxParticles = 60;

  class Particle {
    constructor() {
      this.reset();
      this.y = Math.random() * height;
    }
    reset() {
      this.x = Math.random() * width;
      this.y = height + Math.random() * 20;
      this.size = Math.random() * 2.5 + 0.5;
      this.speedY = -(Math.random() * 0.8 + 0.3);
      this.speedX = Math.random() * 0.4 - 0.2;
      this.opacity = Math.random() * 0.5 + 0.3;
      this.color = `rgba(255, ${Math.floor(Math.random() * 60 + 90)}, 43, ${this.opacity})`;
    }
    update() {
      this.y += this.speedY;
      this.x += this.speedX;
      if (this.y < -10) {
        this.reset();
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowBlur = this.size * 3;
      ctx.shadowColor = 'rgba(255, 107, 43, 0.8)';
      ctx.fill();
    }
  }

  for (let i = 0; i < maxParticles; i++) {
    particles.push(new Particle());
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);
    ctx.shadowBlur = 0;
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    requestAnimationFrame(animate);
  }
  animate();
}
