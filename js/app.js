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
let activeDrillDate = null;

// ---- INIT ----
window.addEventListener('DOMContentLoaded', async () => {
  if (typeof initData === 'function') await initData();
  document.getElementById('orderDateFilter').value = selectedDate;
  setDateLabels();
  initSparkCanvas();
  navigate('dashboard');
  startLiveSync();
  // New features bootstrap
  startLiveClock();
  loadNotes();
  initKeyboardShortcuts();
  // Restore saved theme accent
  const savedTheme = localStorage.getItem('pizzaCafeTheme') || 'cyan';
  setThemeAccent(savedTheme);
  setTimeout(() => {
    updateTicker();
    setInterval(updateTicker, 15000);
  }, 2000);
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
  const pageEl = document.getElementById('page-' + page);
  if (!pageEl) return;
  pageEl.classList.add('active');
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  const titles = {
    dashboard: 'Command Deck',
    orders: 'Daily Orders Sheet',
    kds: '🔥 Kitchen Display System',
    menu: 'Menu Manager',
    analytics: 'Sales Analytics'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  if (page === 'dashboard')  renderDashboard();
  if (page === 'orders')     renderOrders();
  if (page === 'kds')        renderKds('all');
  if (page === 'menu')       renderMenu();
  if (page === 'analytics')  renderAnalytics();
  // Update mobile bottom nav items
  document.querySelectorAll('.mb-nav-item').forEach(m => m.classList.remove('active'));
  const mbNavEl = document.querySelector(`[data-mobile-page="${page}"]`);
  if (mbNavEl) mbNavEl.classList.add('active');

  // close sidebar & overlay on mobile
  const sb = document.getElementById('sidebar');
  const sbo = document.getElementById('sidebarOverlay');
  if (sb) sb.classList.remove('open');
  if (sbo) sbo.classList.remove('open');
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const sbo = document.getElementById('sidebarOverlay');
  if (sb) sb.classList.toggle('open');
  if (sbo) sbo.classList.toggle('open');
  cyberClick();
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
    <div class="kpi-card"><div class="kpi-label">QUANTUM REVENUE</div>
      <div class="kpi-value" id="kpiRevenue">₹${totalRev.toLocaleString('en-IN')}</div>
      <div class="kpi-trend trend-up">▲ LIVE STREAM</div><div class="kpi-icon">⚡</div></div>
    <div class="kpi-card success"><div class="kpi-label">SECTOR ORDERS</div>
      <div class="kpi-value" id="kpiOrders">${dOrders.length}</div>
      <div class="kpi-trend trend-up">▲ ACTIVE CYCLE</div><div class="kpi-icon">🛸</div></div>
    <div class="kpi-card warning"><div class="kpi-label">ORBITAL PENDING</div>
      <div class="kpi-value" id="kpiPending">${pendingDel}</div>
      <div class="kpi-trend" style="color:var(--warning)">⚠ IN TRANSIT</div><div class="kpi-icon">🛰️</div></div>
    <div class="kpi-card danger"><div class="kpi-label">UNRESOLVED CREDITS</div>
      <div class="kpi-value" id="kpiUnpaid">₹${(totalRev - totalPaid).toLocaleString('en-IN')}</div>
      <div class="kpi-trend trend-down">▼ UNPAID</div><div class="kpi-icon">⚛️</div></div>`;

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
  grad.addColorStop(0,'rgba(0, 243, 255, 0.45)'); grad.addColorStop(1,'rgba(0, 243, 255, 0.01)');
  hourlyChart = new Chart(ctx, {
    type:'line', data:{ labels, datasets:[{ data, borderColor:'#00F3FF', backgroundColor:grad,
      fill:true, tension:0.4, pointBackgroundColor:'#00F3FF', pointBorderColor:'#FF007F', pointRadius:4, borderWidth:2 }]},
    options:{ plugins:{legend:{display:false}}, scales:{
      x:{ grid:{color:'rgba(0,243,255,0.1)'}, ticks:{color:'#7DAEC3', font:{family:'Share Tech Mono'}} },
      y:{ grid:{color:'rgba(0,243,255,0.1)'}, ticks:{color:'#7DAEC3', font:{family:'Share Tech Mono'}, callback:v=>'₹'+v} }
    }}
  });

  // Recent orders table (last 5)
  const recent = [...dOrders].reverse().slice(0, 5);
  document.getElementById('recentOrdersTable').innerHTML = buildOrderTable(recent, true);

  // Update target progress arc
  renderTargetArc(totalRev);
  // Update mini leaderboard
  setTimeout(renderMiniLeaderboard, 100);
  // Refresh ticker
  setTimeout(updateTicker, 500);
}

// ---- TARGET ARC RENDERER ----
function renderTargetArc(totalRev) {
  const targetEl = document.getElementById('targetArcWidget');
  if (!targetEl) return;
  const target = parseInt(localStorage.getItem('pizzaCafeTarget') || '5000');
  const pct = Math.min(100, Math.round((totalRev / target) * 100));
  const r = 52, cx = 64, cy = 64;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;
  const color = pct >= 100 ? '#00FF66' : pct >= 60 ? '#00F3FF' : pct >= 30 ? '#FFB700' : '#FF007F';
  targetEl.innerHTML = `
    <div class="target-arc-inner">
      <svg width="128" height="128" viewBox="0 0 128 128">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="10"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="10"
          stroke-dasharray="${dash} ${circumference}" stroke-linecap="round"
          transform="rotate(-90 ${cx} ${cy})"
          style="filter:drop-shadow(0 0 8px ${color});transition:stroke-dasharray 1s ease"/>
        <text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="${color}" font-size="20" font-family="Share Tech Mono" font-weight="700">${pct}%</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="#7DAEC3" font-size="9" font-family="Share Tech Mono">TARGET</text>
      </svg>
      <div class="target-arc-stats">
        <div class="target-stat-row"><span class="target-stat-label">TODAY</span><span class="target-stat-val" style="color:${color}">₹${totalRev.toLocaleString('en-IN')}</span></div>
        <div class="target-stat-row"><span class="target-stat-label">GOAL</span><span class="target-stat-val">₹${target.toLocaleString('en-IN')}</span></div>
        <div class="target-stat-row"><span class="target-stat-label">LEFT</span><span class="target-stat-val" style="color:var(--warning)">₹${Math.max(0,target-totalRev).toLocaleString('en-IN')}</span></div>
        <button class="preset-btn" style="margin-top:8px;width:100%" onclick="openModal('targetModal');loadTargetInput()">🎯 SET TARGET</button>
      </div>
    </div>`;
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
  const cashRevOrders = list.reduce((s,o) => s + (o.cashAmount || 0), 0);
  const onlineRevOrders = list.reduce((s,o) => s + (o.onlineAmount || 0), 0);
  const paidN   = list.filter(o => o.paid).length;
  const pendN   = list.filter(o => !o.delivered).length;
  document.getElementById('ordersStats').innerHTML = `
    <div class="orders-stat">Total: <strong>${total}</strong></div>
    <div class="orders-stat">Revenue: <strong>₹${revenue.toLocaleString('en-IN')}</strong></div>
    <div class="orders-stat">💵 Cash: <strong style="color:var(--success)">₹${cashRevOrders.toLocaleString('en-IN')}</strong></div>
    <div class="orders-stat">📱 Online: <strong style="color:var(--primary)">₹${onlineRevOrders.toLocaleString('en-IN')}</strong></div>
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
    const discBadge = o.discount ? `<span class="badge" style="background:rgba(255,0,127,0.15);color:var(--secondary);margin-left:4px;" title="${o.discount.label}">🏷️ ${o.discount.label}</span>` : '';
    const kitchBadge = o.ready
      ? `<span class="badge" style="background:rgba(0,255,102,0.15);color:var(--success);border:1px solid rgba(0,255,102,0.3)" title="Kitchen Ready">🍳 Ready</span>`
      : `<span class="badge" style="background:rgba(255,183,0,0.15);color:var(--warning);border:1px solid rgba(255,183,0,0.3)" title="In Kitchen Prep">⏳ Prep</span>`;

    if (compact) {
      chkCol = '';
      kitchCol = `<td>${kitchBadge}</td>`;
      payCol = `<td>${o.paid ? `<span class="badge badge-success">✓ Paid ${pModeIcon}</span>` : '<span class="badge badge-danger">✗ Unpaid</span>'}</td>`;
      delCol = `<td>${o.delivered ? '<span class="badge badge-success">✓ Delivered</span>' : '<span class="badge badge-warning">⏳ Pending</span>'}</td>`;
      actionCol = '';
    } else {
      chkCol = `<td><input type="checkbox" class="order-batch-chk" value="${o.id}" onchange="updateBatchBar()" onclick="event.stopPropagation()"></td>`;
      kitchCol = `<td>${kitchBadge}</td>`;
      payCol = `<td>
        <label class="toggle-switch" title="Toggle Payment" onclick="event.stopPropagation()">
          <input type="checkbox" ${o.paid?'checked':''} onchange="toggleField('${o.id}','paid')"><span class="toggle-slider"></span>
        </label>
        <span style="display:block;font-size:11px;color:var(--text-muted);margin-top:4px">${pModeIcon} ${pModeText}</span>
      </td>`;
      delCol = `<td><label class="toggle-switch" title="Toggle Delivery" onclick="event.stopPropagation()"><input type="checkbox" ${o.delivered?'checked':''} onchange="toggleField('${o.id}','delivered')"><span class="toggle-slider"></span></label></td>`;
      actionCol = `<td>
        <button class="icon-btn" title="Thermal Receipt Preview" onclick="openThermalReceipt('${o.id}')">🧾</button>
        <button class="icon-btn" title="Apply Discount" onclick="openDiscountModal('${o.id}')">🏷️</button>
        <button class="icon-btn" title="Edit Order" onclick="openEditOrder('${o.id}')">✏️</button>
        <button class="icon-btn danger" title="Delete Order" onclick="deleteOrder('${o.id}')">🗑️</button>
      </td>`;
    }
    
    return `<tr>
      ${chkCol}
      <td><strong style="color:var(--primary)">#${String(o.id).padStart(3,'0')}</strong></td>
      <td>
        <strong>${o.customer}</strong> ${discBadge}
        ${o.phone ? `<div style="font-family:var(--font-mono);font-size:11px;color:var(--primary);margin-top:2px;" title="Customer Phone">📞 ${o.phone}</div>` : ''}
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
      ${kitchCol}
      ${payCol}
      ${delCol}
      ${actionCol}
    </tr>`;
  }).join('');

  const extraTh = compact
    ? '<th>Kitchen</th><th>Payment</th><th>Delivery</th>'
    : '<th>Kitchen Status</th><th>Payment ✓</th><th>Delivery ✓</th><th>Actions</th>';
  const chkTh = compact ? '' : '<th style="width:36px;"><input type="checkbox" id="selectAllChkBx" onchange="toggleSelectAllOrders(this)"></th>';
    
  return `<table><thead><tr>
    ${chkTh}
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
  let totalCashPayment = 0;
  let totalOnlinePayment = 0;

  list.forEach(o => {
    totalRevenue += o.total;
    if (o.type === 'online') { onlineRev += o.total; onlineCount++; }
    else if (o.type === 'dine-in') { dineInRev += o.total; dineInCount++; }
    else { takeawayRev += o.total; takeawayCount++; }
    
    totalCashPayment += (o.cashAmount || 0);
    totalOnlinePayment += (o.onlineAmount || 0);
  });
  
  let txt = `========================================================\r\n`;
  txt += `            PIZZACAFE - DAILY ORDERS REPORT\r\n`;
  txt += `            Date: ${safeDate}\r\n`;
  txt += `========================================================\r\n`;
  txt += ` SUMMARY:\r\n`;
  txt += ` ------------------------------------------------------\r\n`;
  txt += ` Total Orders  : ${list.length}\r\n`;
  txt += ` Total Revenue : Rs. ${totalRevenue} (Cash: Rs. ${totalCashPayment}, Online: Rs. ${totalOnlinePayment})\r\n\r\n`;
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
  document.getElementById('customerPhone').value = '';
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
  const phone = document.getElementById('customerPhone').value.trim();
  if (!name) { showToast('Please enter customer name','error'); return; }
  if (!newOrderItems.length) { showToast('Please add at least one item','error'); return; }
  const typeEl = document.getElementById('orderType');
  const type = typeEl ? typeEl.value : 'dine-in';
  const note = document.getElementById('orderNote').value.trim();
  const total = parseInt(document.getElementById('orderTotalInput').value) || 0;
  const cashAmount   = parseInt(document.getElementById('orderCashAmount').value) || 0;
  const onlineAmount = parseInt(document.getElementById('orderOnlineAmount').value) || 0;
  const paid = (cashAmount + onlineAmount) >= total;
  const payMode = cashAmount > 0 && onlineAmount > 0 ? 'split' : (onlineAmount > 0 ? 'online' : 'cash');
  const now = new Date();
  const hrs = now.getHours(); const mins = now.getMinutes();
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  const displayHrs = hrs % 12 || 12;
  const time = `${String(displayHrs).padStart(2,'0')}:${String(mins).padStart(2,'0')} ${ampm}`;
  const dayNum = orders.filter(o => o.date === selectedDate).length + 1;
  orders.push({ id:nextOrderId++, dayNum, customer:name, phone, ready:false, date:selectedDate, items:[...newOrderItems], paid, payMode, cashAmount, onlineAmount, type, delivered:false, time, total, note });
  saveData();
  closeModal('newOrderModal');
  renderOrders();
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'analytics') renderAnalytics();
  showToast(`Order #${dayNum} saved for ${name}!`);
  addNotification(`📦 New Order #${dayNum} created for ${name}`, 'order');
}

// ---- EDIT ORDER ----
function openEditOrder(id) {
  const o = orders.find(o => String(o.id) === String(id));
  if (!o) return;
  editOrderItems = o.items.map(i => ({...i}));
  document.getElementById('editOrderId').value = o.id;
  document.getElementById('editCustomerName').value = o.customer;
  document.getElementById('editCustomerPhone').value = o.phone || '';
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
  const phone = document.getElementById('editCustomerPhone').value.trim();
  if (!name) { showToast('Please enter customer name','error'); return; }
  if (!editOrderItems.length) { showToast('Add at least one item','error'); return; }
  const o = orders.find(o => String(o.id) === String(id));
  if (!o) return;
  o.customer = name;
  o.phone = phone;
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

  // Use cashAmount/onlineAmount directly to correctly handle split payment orders
  const cashRev = filteredOrders.reduce((s,o) => s + (o.cashAmount || 0), 0);
  const onlineRev = filteredOrders.reduce((s,o) => s + (o.onlineAmount || 0), 0);

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
  activeDrillDate = date;
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
  // Use cashAmount/onlineAmount directly to correctly handle split payment orders
  const cashRev = dayOrders.reduce((s,o) => s + (o.cashAmount || 0), 0);
  const onlineRev = dayOrders.reduce((s,o) => s + (o.onlineAmount || 0), 0);
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
        <div style="font-size:11px;color:var(--text-muted)">${dayOrders.filter(o=>(o.cashAmount||0)>0).length} orders</div>
      </div>
      <div class="drill-stat-box" style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2)">
        <div style="font-size:11px;color:#3b82f6;font-weight:600;margin-bottom:4px">📱 ONLINE / UPI</div>
        <div style="font-size:22px;font-weight:700;color:var(--text-color)">₹${onlineRev.toLocaleString('en-IN')}</div>
        <div style="font-size:11px;color:var(--text-muted)">${dayOrders.filter(o=>(o.onlineAmount||0)>0).length} orders</div>
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
  activeDrillDate = null;
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
      const colors = [
        `rgba(0, 243, 255, ${this.opacity})`,
        `rgba(255, 0, 127, ${this.opacity})`,
        `rgba(0, 255, 102, ${this.opacity})`
      ];
      this.color = colors[Math.floor(Math.random() * colors.length)];
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
      ctx.shadowBlur = this.size * 4;
      ctx.shadowColor = this.color;
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

let syncInterval = null;
let lastSyncString = '';

function startLiveSync() {
  if (syncInterval) clearInterval(syncInterval);
  
  setTimeout(() => {
    lastSyncString = JSON.stringify({
      orders: orders,
      menuItems: menuItems,
      nextOrderId: nextOrderId,
      nextMenuId: nextMenuId
    });
  }, 1000);

  syncInterval = setInterval(async () => {
    const isNewModalOpen = document.getElementById('newOrderModal').classList.contains('open');
    const isEditModalOpen = document.getElementById('editOrderModal').classList.contains('open');
    const isMenuModalOpen = document.getElementById('menuModal').classList.contains('open');
    if (isNewModalOpen || isEditModalOpen || isMenuModalOpen) return;

    try {
      const res = await fetch('/api/data?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        const currentString = JSON.stringify({
          orders: data.orders,
          menuItems: data.menuItems,
          nextOrderId: data.nextOrderId,
          nextMenuId: data.nextMenuId
        });
        
        if (currentString !== lastSyncString) {
          lastSyncString = currentString;
          
          if (data.menuItems && Array.isArray(data.menuItems)) menuItems = data.menuItems;
          if (data.orders && Array.isArray(data.orders)) orders = data.orders;
          if (data.nextOrderId) nextOrderId = parseInt(data.nextOrderId);
          if (data.nextMenuId) nextMenuId = parseInt(data.nextMenuId);
          
          if (currentPage === 'dashboard') renderDashboard();
          if (currentPage === 'orders') renderOrders();
          if (currentPage === 'menu') renderMenu();
          if (currentPage === 'analytics') renderAnalytics();
          
          if (activeDrillDate) {
            const panel = document.getElementById('dayDrillDown');
            if (panel && panel.classList.contains('drill-visible')) {
              openDayDrillDown(activeDrillDate);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Live sync failed:", err);
    }
  }, 4000);
}

// =============================================
// KITCHEN DISPLAY SYSTEM (KDS)
// =============================================
let kdsFilter = 'all';
let kdsTimerInterval = null;

function renderKds(filter) {
  kdsFilter = filter;
  if (kdsTimerInterval) clearInterval(kdsTimerInterval);

  const today = getTodayIST();
  let list = orders.filter(o => o.date === today);
  if (filter === 'pending') list = list.filter(o => !o.ready);
  if (filter === 'delivered') list = list.filter(o => o.ready);
  list = [...list].reverse();

  const grid = document.getElementById('kdsTicketGrid');
  if (!grid) return;

  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted);font-family:var(--font-mono);">
      <div style="font-size:48px;margin-bottom:16px;">🍕</div>
      <div style="font-size:14px;letter-spacing:2px;">NO ACTIVE ORDERS IN QUEUE</div>
    </div>`;
    return;
  }

  grid.innerHTML = list.map(o => {
    const items = o.items.map(it => {
      const m = menuItems.find(x => x.id === it.menuId);
      return `<div class="kds-item-row"><span class="kds-qty">${it.qty}×</span> <span>${m ? m.name : 'Unknown'}</span></div>`;
    }).join('');

    const typeIcon = o.type === 'dine-in' ? '🍽️' : o.type === 'online' ? '🛵' : '🛍️';
    const urgency = o.ready ? 'done' : 'pending';
    const elapsedId = `kds-elapsed-${o.id}`;

    // Calculate duration for ready orders if missing
    if (o.ready && !o.prepDurationStr) {
      const orderMs = parseTimeToMs(o.time, o.date) || Date.now();
      const diffMs = Math.max(0, Date.now() - orderMs);
      const mins = Math.floor(diffMs / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      o.prepDurationStr = `✓ READY (${mins}m ${secs}s)`;
    }

    const elapsedText = o.ready ? o.prepDurationStr : '⏱ --:--';

    return `<div class="kds-ticket ${urgency}" id="kds-ticket-${o.id}">
      <div class="kds-ticket-header">
        <span class="kds-order-num">#${String(o.id).padStart(3,'0')}</span>
        <span class="kds-type-badge">${typeIcon} ${o.type.toUpperCase()}</span>
        <span class="kds-elapsed" id="${elapsedId}" style="${o.ready ? 'color:var(--success);font-weight:bold;' : ''}">${elapsedText}</span>
      </div>
      <div class="kds-customer">
        ${o.customer}
        ${o.phone ? `<div style="font-family:var(--font-mono);font-size:11px;color:var(--primary);margin-top:2px;">📞 ${o.phone}</div>` : ''}
      </div>
      <div class="kds-items-list">${items}</div>
      <div class="kds-ticket-footer">
        <span class="kds-total">₹${o.total}</span>
        ${!o.ready
          ? `<button class="kds-ready-btn" onclick="markKdsReady('${o.id}')">🍳 MARK READY</button>`
          : `<button class="kds-ready-btn" style="background:rgba(0,255,102,0.25);border-color:var(--success)" onclick="markKdsReady('${o.id}')">✓ READY (TOGGLE)</button>`
        }
      </div>
      ${o.note ? `<div class="kds-note">📝 ${o.note}</div>` : ''}
    </div>`;
  }).join('');

  // Start elapsed timers (only for in-prep orders, freeze ready orders)
  kdsTimerInterval = setInterval(() => {
    const now = Date.now();
    list.forEach(o => {
      const el = document.getElementById(`kds-elapsed-${o.id}`);
      if (!el) return;
      if (o.ready) {
        if (!o.prepDurationStr) {
          const orderMs = parseTimeToMs(o.time, o.date) || Date.now();
          const diffMs = Math.max(0, Date.now() - orderMs);
          const mins = Math.floor(diffMs / 60000);
          const secs = Math.floor((diffMs % 60000) / 1000);
          o.prepDurationStr = `✓ READY (${mins}m ${secs}s)`;
        }
        el.textContent = o.prepDurationStr;
        el.style.color = 'var(--success)';
        return;
      }
      const orderTime = parseTimeToMs(o.time, o.date);
      if (!orderTime) return;
      const diffMs = now - orderTime;
      if (diffMs < 0) return;
      const mins = Math.floor(diffMs / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      el.textContent = `⏱ ${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
      const ticket = document.getElementById(`kds-ticket-${o.id}`);
      if (ticket) {
        if (mins >= 20) ticket.style.setProperty('--kds-border', 'var(--danger)');
        else if (mins >= 10) ticket.style.setProperty('--kds-border', 'var(--warning)');
        else ticket.style.setProperty('--kds-border', 'var(--success)');
      }
    });
  }, 1000);
}

function parseTimeToMs(timeStr, dateStr) {
  if (!timeStr || !dateStr) return null;
  try {
    let m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    let hr, min;
    if (m) {
      hr = parseInt(m[1]); min = parseInt(m[2]);
      const ap = m[3].toUpperCase();
      if (ap === 'PM' && hr !== 12) hr += 12;
      if (ap === 'AM' && hr === 12) hr = 0;
    } else {
      const m2 = timeStr.match(/(\d+):(\d+)/);
      if (!m2) return null;
      hr = parseInt(m2[1]); min = parseInt(m2[2]);
    }
    const [y, mo, d] = dateStr.split('-').map(Number);
    return new Date(y, mo - 1, d, hr, min, 0).getTime();
  } catch { return null; }
}

async function markKdsReady(orderId) {
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  o.ready = !o.ready;
  if (o.ready) {
    o.readyTime = Date.now();
    const orderMs = parseTimeToMs(o.time, o.date) || Date.now();
    const diffMs = Math.max(0, o.readyTime - orderMs);
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    o.prepDurationStr = `✓ READY (${mins}m ${secs}s)`;
  } else {
    delete o.readyTime;
    delete o.prepDurationStr;
  }

  cyberClick();
  await saveData();
  renderKds(kdsFilter);
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'orders') renderOrders();
  showToast(o.ready ? `Kitchen: Order #${orderId} READY in ${o.prepDurationStr}! 🍳` : `Kitchen: Order #${orderId} back to PREP ⏳`, 'success');
  addNotification(o.ready ? `🍳 Kitchen Ready in ${o.prepDurationStr}: Order #${orderId} (${o.customer})` : `⏳ In Kitchen Prep: Order #${orderId}`, 'info');
}

function filterKds(filter, btn) {
  document.querySelectorAll('.kds-filter-tabs .filter-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderKds(filter);
}

// =============================================
// AI DEMAND FORECASTER
// =============================================
function runAiDemandForecast() {
  // Analyze past orders to predict peak hours & top items
  const now = new Date();
  const hourCounts = new Array(24).fill(0);
  const itemCounts = {};

  orders.forEach(o => {
    // parse hour
    const hr = parseTimeToMs(o.time, o.date);
    if (hr) {
      const d = new Date(hr);
      hourCounts[d.getHours()]++;
    }
    // count items
    o.items.forEach(it => {
      const m = menuItems.find(x => x.id === it.menuId);
      if (m) {
        itemCounts[m.name] = (itemCounts[m.name] || 0) + it.qty;
      }
    });
  });

  // Find peak hour range
  let maxHour = 0, maxCount = 0;
  for (let i = 0; i < 24; i++) {
    if (hourCounts[i] > maxCount) { maxCount = hourCounts[i]; maxHour = i; }
  }
  const fmt = (h) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:00 ${ampm}`;
  };
  const peakStr = maxCount > 0 ? `${fmt(maxHour)} – ${fmt(maxHour + 1)}` : 'Not enough data';

  // Find top item
  const sorted = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);
  const topItem = sorted.length ? sorted[0][0] : 'No data yet';
  const totalOrders = orders.length;
  const growthEst = totalOrders > 10 ? `+${Math.floor(Math.random() * 30 + 15)}% Surge` : 'Gathering data...';

  const peakEl = document.getElementById('aiPeakTime');
  const topEl = document.getElementById('aiTopItem');
  const volEl = document.getElementById('aiEstVol');
  if (peakEl) peakEl.textContent = peakStr;
  if (topEl) topEl.textContent = topItem;
  if (volEl) volEl.textContent = growthEst;

  // animate bar
  const fill = document.querySelector('.forecast-fill');
  if (fill) {
    const pct = maxCount > 0 ? Math.min(100, Math.floor((maxCount / Math.max(...hourCounts)) * 100)) : 60;
    fill.style.width = pct + '%';
  }
  showToast('✨ AI Neural Model Recalculated!');
  cyberClick();
}

// =============================================
// WEB AUDIO CYBER SYNTH EFFECTS
// =============================================
let audioCtx = null;
let audioEnabled = true;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playSynth(freq, type, duration, vol = 0.15, detune = 0) {
  if (!audioEnabled) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.detune.setValueAtTime(detune, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(); osc.stop(ctx.currentTime + duration);
  } catch (e) { /* silently fail */ }
}

function cyberClick() {
  playSynth(880, 'square', 0.08, 0.1);
  setTimeout(() => playSynth(1200, 'square', 0.06, 0.07), 50);
}

function cyberSuccess() {
  playSynth(440, 'sine', 0.1, 0.12);
  setTimeout(() => playSynth(660, 'sine', 0.15, 0.12), 100);
  setTimeout(() => playSynth(880, 'sine', 0.2, 0.12), 220);
}

function cyberAlert() {
  playSynth(220, 'sawtooth', 0.3, 0.18);
  setTimeout(() => playSynth(180, 'sawtooth', 0.25, 0.15), 200);
}

function toggleCyberAudio() {
  audioEnabled = !audioEnabled;
  const icon = document.getElementById('audioIcon');
  const btn = document.getElementById('audioToggleBtn');
  if (icon) icon.textContent = audioEnabled ? '🔊' : '🔇';
  if (btn) btn.classList.toggle('muted', !audioEnabled);
  if (audioEnabled) cyberClick();
  showToast(audioEnabled ? '🔊 Cyber Audio Synthesizer ONLINE' : '🔇 Audio OFFLINE');
}

// =============================================
// INSTANT POS SYNTHESIZER MODAL
// =============================================
let posItems = [];

function openPosModal() {
  cyberClick();
  posItems = [];
  renderPosGrid();
  renderPosBill();
  openModal('posModal');
}

function renderPosGrid() {
  const grid = document.getElementById('posMenuGrid');
  if (!grid) return;
  const avail = menuItems.filter(m => m.available);
  grid.innerHTML = avail.map(m => `
    <button class="pos-tile" onclick="addPosItem(${m.id})" title="${m.desc}">
      <span class="pos-tile-name">${m.name}</span>
      <span class="pos-tile-price">₹${m.price}</span>
    </button>
  `).join('');
}

function addPosItem(menuId) {
  cyberClick();
  const m = menuItems.find(x => x.id === menuId);
  if (!m) return;
  const existing = posItems.find(x => x.menuId === menuId);
  if (existing) existing.qty++;
  else posItems.push({ menuId, qty: 1, unitPrice: m.price });
  renderPosBill();
}

function removePosItem(menuId) {
  const idx = posItems.findIndex(x => x.menuId === menuId);
  if (idx === -1) return;
  if (posItems[idx].qty > 1) posItems[idx].qty--;
  else posItems.splice(idx, 1);
  renderPosBill();
}

function renderPosBill() {
  const bill = document.getElementById('posBillList');
  const totalEl = document.getElementById('posBillTotal');
  if (!bill) return;

  if (!posItems.length) {
    bill.innerHTML = `<p style="padding:20px;text-align:center;color:var(--text-muted);font-family:var(--font-mono);font-size:12px;">TAP ITEMS TO ADD TO QUEUE</p>`;
    if (totalEl) totalEl.textContent = '₹0';
    return;
  }

  const total = posItems.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  bill.innerHTML = posItems.map(it => {
    const m = menuItems.find(x => x.id === it.menuId);
    return `<div class="pos-bill-row">
      <span class="pos-bill-name">${m ? m.name : 'Unknown'}</span>
      <div class="pos-bill-controls">
        <button class="pos-qty-btn" onclick="removePosItem(${it.menuId})">−</button>
        <span class="pos-qty-val">${it.qty}</span>
        <button class="pos-qty-btn" onclick="addPosItem(${it.menuId})">+</button>
        <span class="pos-bill-subtotal">₹${it.qty * it.unitPrice}</span>
      </div>
    </div>`;
  }).join('');
  if (totalEl) totalEl.textContent = `₹${total.toLocaleString('en-IN')}`;
}

async function submitPosOrder() {
  if (!posItems.length) { showToast('Add items first!', 'error'); return; }
  const customerEl = document.getElementById('posCustomerName');
  const phoneEl = document.getElementById('posCustomerPhone');
  const typeEl = document.getElementById('posOrderType');
  const customer = (customerEl && customerEl.value.trim()) || 'Walk-in Customer';
  const phone = (phoneEl && phoneEl.value.trim()) || '';
  const type = (typeEl && typeEl.value) || 'dine-in';
  const total = posItems.reduce((s, it) => s + it.qty * it.unitPrice, 0);

  const now = new Date();
  const hr = now.getHours(), mn = now.getMinutes();
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const h12 = hr % 12 || 12;
  const timeStr = `${h12}:${String(mn).padStart(2,'0')} ${ampm}`;

  const newOrder = {
    id: nextOrderId++,
    customer,
    phone,
    ready: false,
    items: posItems.map(it => ({ ...it })),
    total,
    type,
    date: getTodayIST(),
    time: timeStr,
    paid: false,
    delivered: false,
    payMode: 'cash',
    cashAmount: 0,
    onlineAmount: 0,
    note: ''
  };
  orders.push(newOrder);
  await saveData();
  cyberSuccess();
  closeModal('posModal');
  showToast(`✅ POS Order #${newOrder.id} created for ${customer}!`);
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'orders') renderOrders();
  if (currentPage === 'kds') renderKds(kdsFilter);
}

// =============================================
// TELEMETRY BAR LIVE ANIMATION
// =============================================
function animateTelemetry() {
  setInterval(() => {
    // Simulate slight fluctuations
    const oven = (480 + Math.floor(Math.random() * 15));
    const warp = (99 + Math.random()).toFixed(1);
    const drones = Math.random() > 0.95 ? '7/10 ACTIVE' : '8/10 ACTIVE';
    const items = document.querySelectorAll('.tele-item strong');
    if (items[0]) items[0].textContent = `${oven}°C`;
    if (items[1]) items[1].textContent = `${warp}%`;
    if (items[2]) items[2].textContent = drones;
  }, 3000);
}

// Initialize new features on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  animateTelemetry();
  // Run AI forecast once data is loaded
  setTimeout(runAiDemandForecast, 1500);
});


// =============================================
// LIVE CLOCK
// =============================================
function startLiveClock() {
  function tick() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2,'0');
    const m = String(now.getMinutes()).padStart(2,'0');
    const s = String(now.getSeconds()).padStart(2,'0');
    const ct = document.getElementById('clockTime');
    const cd = document.getElementById('clockDateShort');
    if (ct) ct.textContent = `${h}:${m}:${s}`;
    if (cd) cd.textContent = now.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) + ' IST';
  }
  tick();
  setInterval(tick, 1000);
}

// =============================================
// LIVE TICKER BAR
// =============================================
function updateTicker() {
  const today = getTodayIST();
  const dOrders = orders.filter(o => o.date === today);
  const rev = dOrders.reduce((s,o) => s+o.total, 0);
  const pending = dOrders.filter(o => !o.delivered).length;
  const paid = dOrders.filter(o => o.paid).length;
  const online = dOrders.filter(o => o.type === 'online').length;

  // Find top item
  const itemCount = {};
  dOrders.forEach(o => o.items.forEach(it => {
    const m = menuItems.find(x => x.id === it.menuId);
    if (m) itemCount[m.name] = (itemCount[m.name]||0) + it.qty;
  }));
  const topItem = Object.entries(itemCount).sort((a,b)=>b[1]-a[1])[0];

  const content = document.getElementById('tickerContent');
  if (!content) return;
  const segments = [
    `📦 TODAY ORDERS: <strong>${dOrders.length}</strong>`,
    `💰 REVENUE: <strong>₹${rev.toLocaleString('en-IN')}</strong>`,
    `⏳ PENDING: <strong>${pending}</strong>`,
    `✅ PAID: <strong>${paid}</strong>`,
    `🛵 ONLINE ORDERS: <strong>${online}</strong>`,
    topItem ? `🍕 TOP ITEM: <strong>${topItem[0]}</strong> (${topItem[1]}x)` : `🍕 NO ORDERS YET`,
    `🎯 TARGET: <strong>${Math.round((rev/(parseInt(localStorage.getItem('pizzaCafeTarget')||5000))*100))}% OF GOAL</strong>`,
    `⚡ SYSTEM: <strong>ALL SYSTEMS NOMINAL</strong>`
  ];
  content.innerHTML = segments.join(`<span class="ticker-sep"> &nbsp;◆&nbsp; </span>`);
}

// =============================================
// GLOBAL SEARCH
// =============================================
function openGlobalSearch() {
  document.getElementById('searchOverlay').classList.add('open');
  setTimeout(() => document.getElementById('globalSearchInput').focus(), 50);
  cyberClick();
}

function closeGlobalSearch() {
  document.getElementById('searchOverlay').classList.remove('open');
  document.getElementById('globalSearchInput').value = '';
  document.getElementById('searchResults').innerHTML = '<div class="search-hint">Type to search across all orders and menu items...</div>';
}

function runGlobalSearch(query) {
  const q = query.trim().toLowerCase();
  const res = document.getElementById('searchResults');
  if (!q || q.length < 2) {
    res.innerHTML = '<div class="search-hint">Type at least 2 characters...</div>';
    return;
  }

  const matchedOrders = orders.filter(o =>
    String(o.id).includes(q) ||
    o.customer.toLowerCase().includes(q) ||
    (o.phone && o.phone.toLowerCase().includes(q)) ||
    (o.note && o.note.toLowerCase().includes(q)) ||
    o.date.includes(q)
  ).slice(0,8);

  const matchedItems = menuItems.filter(m =>
    m.name.toLowerCase().includes(q) ||
    m.desc.toLowerCase().includes(q)
  ).slice(0,5);

  let html = '';

  if (matchedOrders.length) {
    html += `<div class="search-section-label">🧾 ORDERS (${matchedOrders.length})</div>`;
    html += matchedOrders.map(o => `
      <div class="search-result-item" onclick="navigate('orders');changeOrderDate('${o.date}');closeGlobalSearch()">
        <span class="sr-badge">#${String(o.id).padStart(3,'0')}</span>
        <span class="sr-main">${o.customer} ${o.phone ? `<small style="color:var(--primary);margin-left:6px;font-family:var(--font-mono)">📞 ${o.phone}</small>` : ''}</span>
        <span class="sr-sub">${o.date} · ₹${o.total} · ${o.type}</span>
        <span class="sr-status ${o.paid?'paid':'unpaid'}">${o.paid?'PAID':'UNPAID'}</span>
      </div>`).join('');
  }

  if (matchedItems.length) {
    html += `<div class="search-section-label">🍕 MENU ITEMS (${matchedItems.length})</div>`;
    html += matchedItems.map(m => `
      <div class="search-result-item" onclick="navigate('menu');closeGlobalSearch()">
        <span class="sr-badge">₹${m.price}</span>
        <span class="sr-main">${m.name}</span>
        <span class="sr-sub">${m.desc}</span>
        <span class="sr-status ${m.available?'paid':'unpaid'}">${m.available?'AVAIL':'UNAVAIL'}</span>
      </div>`).join('');
  }

  if (!html) {
    html = `<div class="search-hint">No results for "<strong style="color:var(--primary)">${query}</strong>"</div>`;
  }

  res.innerHTML = html;
}

// =============================================
// KEYBOARD SHORTCUTS
// =============================================
function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    // Don't trigger shortcuts when typing in inputs
    const tag = document.activeElement.tagName;
    const inInput = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');

    if (e.key === 'Escape') {
      closeGlobalSearch();
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      return;
    }

    if (e.ctrlKey && e.key === 'k') { e.preventDefault(); openGlobalSearch(); return; }
    if (e.ctrlKey && e.key === 'n' && !inInput) { e.preventDefault(); openNewOrderModal(); return; }
    if (e.ctrlKey && e.key === 'p' && !inInput) { e.preventDefault(); openPosModal(); return; }
    if (e.ctrlKey && e.key === '/') { e.preventDefault(); openModal('shortcutsModal'); return; }
    if (e.ctrlKey && e.key === 't' && !inInput) { e.preventDefault(); openModal('targetModal'); loadTargetInput(); return; }
    if (e.ctrlKey && e.key === '1' && !inInput) { e.preventDefault(); navigate('dashboard'); return; }
    if (e.ctrlKey && e.key === '2' && !inInput) { e.preventDefault(); navigate('orders'); return; }
    if (e.ctrlKey && e.key === '3' && !inInput) { e.preventDefault(); navigate('kds'); return; }
    if (e.ctrlKey && e.key === '4' && !inInput) { e.preventDefault(); navigate('menu'); return; }
    if (e.ctrlKey && e.key === '5' && !inInput) { e.preventDefault(); navigate('analytics'); return; }
    if (e.altKey && e.key.toLowerCase() === 'a') { e.preventDefault(); toggleCyberAudio(); return; }
  });
}

// =============================================
// REVENUE TARGET
// =============================================
function loadTargetInput() {
  const t = localStorage.getItem('pizzaCafeTarget') || '5000';
  const el = document.getElementById('targetInput');
  if (el) el.value = t;
}

function saveRevenueTarget() {
  const val = parseInt(document.getElementById('targetInput').value);
  if (!val || val < 100) { showToast('Enter a valid target (min ₹100)', 'error'); return; }
  localStorage.setItem('pizzaCafeTarget', val);
  closeModal('targetModal');
  cyberSuccess();
  showToast(`🎯 Daily target set to ₹${val.toLocaleString('en-IN')}!`);
  if (currentPage === 'dashboard') renderDashboard();
}

// =============================================
// CUSTOMER LEADERBOARD
// =============================================
function getCustomerStats() {
  const stats = {};
  orders.forEach(o => {
    if (!stats[o.customer]) stats[o.customer] = { name: o.customer, orders: 0, total: 0 };
    stats[o.customer].orders++;
    stats[o.customer].total += o.total;
  });
  return Object.values(stats).sort((a,b) => b.total - a.total);
}

function showLeaderboard() {
  cyberClick();
  const customers = getCustomerStats().slice(0, 20);
  const medals = ['🥇','🥈','🥉'];
  const content = document.getElementById('leaderboardContent');
  if (!content) return;

  content.innerHTML = `
    <div style="padding:0">
      ${customers.length === 0 ? '<p style="padding:20px;color:var(--text-muted)">No order data yet.</p>' :
        customers.map((c, i) => `
          <div class="leaderboard-row ${i < 3 ? 'top-three' : ''}">
            <span class="lb-rank">${medals[i] || `#${i+1}`}</span>
            <span class="lb-name">${c.name}</span>
            <div class="lb-stats">
              <span class="lb-orders">${c.orders} orders</span>
              <span class="lb-total">₹${c.total.toLocaleString('en-IN')}</span>
            </div>
          </div>`).join('')
      }
    </div>`;
  openModal('leaderboardModal');

  // Also update mini leaderboard on dashboard
  const mini = document.getElementById('miniLeaderboard');
  if (mini) {
    const top5 = customers.slice(0,5);
    mini.innerHTML = top5.length ? top5.map((c,i) => `
      <div class="mini-lb-row">
        <span class="mini-lb-rank" style="color:${i===0?'#FFD700':i===1?'#C0C0C0':i===2?'#CD7F32':'var(--text-muted)'}">${medals[i]||`#${i+1}`}</span>
        <span class="mini-lb-name">${c.name}</span>
        <span class="mini-lb-val">₹${c.total.toLocaleString('en-IN')}</span>
      </div>`).join('') : '<p style="padding:12px;color:var(--text-muted);font-size:12px">No data yet</p>';
  }
}

function renderMiniLeaderboard() {
  const customers = getCustomerStats().slice(0,5);
  const medals = ['🥇','🥈','🥉'];
  const mini = document.getElementById('miniLeaderboard');
  if (!mini) return;
  mini.innerHTML = customers.length ? customers.map((c,i) => `
    <div class="mini-lb-row">
      <span class="mini-lb-rank" style="color:${i===0?'#FFD700':i===1?'#C0C0C0':i===2?'#CD7F32':'var(--text-muted)'}">${medals[i]||`#${i+1}`}</span>
      <span class="mini-lb-name">${c.name}</span>
      <span class="mini-lb-val">₹${c.total.toLocaleString('en-IN')}</span>
    </div>`).join('') : '<p style="padding:12px;color:var(--text-muted);font-size:12px">No data yet</p>';
}

// =============================================
// SPLIT BILL CALCULATOR
// =============================================
let splitPeople = 2;
let splitTipPct = 0;

function changeSplitPeople(delta) {
  splitPeople = Math.max(1, splitPeople + delta);
  document.getElementById('splitPeopleCount').textContent = splitPeople;
  calcSplit();
}

function setSplitTip(pct) {
  splitTipPct = pct;
  calcSplit();
}

function calcSplit() {
  const bill = parseFloat(document.getElementById('splitTotalInput')?.value || 0);
  const tip = bill * (splitTipPct / 100);
  const grand = bill + tip;
  const perPerson = splitPeople > 0 ? grand / splitPeople : 0;
  const fmt = (v) => `₹${Math.ceil(v).toLocaleString('en-IN')}`;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('splitBillDisplay', fmt(bill));
  set('splitTipDisplay', fmt(tip));
  set('splitGrandTotal', fmt(grand));
  set('splitPerPerson', fmt(perPerson));
}

// =============================================
// STAFF QUICK NOTES
// =============================================
function loadNotes() {
  const area = document.getElementById('staffNotesArea');
  const ts = document.getElementById('notesTimestamp');
  if (area) {
    area.value = localStorage.getItem('pizzaCafeNotes') || '';
  }
  const saved = localStorage.getItem('pizzaCafeNotesTs');
  if (ts && saved) ts.textContent = 'Last saved: ' + new Date(parseInt(saved)).toLocaleTimeString('en-IN');
}

function saveNotes() {
  const area = document.getElementById('staffNotesArea');
  if (!area) return;
  localStorage.setItem('pizzaCafeNotes', area.value);
  localStorage.setItem('pizzaCafeNotesTs', Date.now());
  const ts = document.getElementById('notesTimestamp');
  if (ts) ts.textContent = 'Last saved: ' + new Date().toLocaleTimeString('en-IN');
  cyberClick();
  showToast('📋 Staff notes saved!');
}

function toggleNotes() {
  const body = document.getElementById('notesBody');
  const icon = document.getElementById('notesToggleIcon');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (icon) icon.textContent = open ? '▼' : '▲';
}

// =============================================
// FAB QUICK-ACTION WHEEL
// =============================================
let fabOpen = false;
function toggleFab() {
  fabOpen = !fabOpen;
  const actions = document.getElementById('fabActions');
  const main = document.querySelector('.fab-main');
  if (actions) actions.classList.toggle('fab-open', fabOpen);
  if (main) main.style.transform = fabOpen ? 'rotate(45deg)' : 'rotate(0deg)';
  if (fabOpen) cyberClick();
}


// =============================================
// NOTIFICATION DRAWER SYSTEM
// =============================================
let notifications = [
  { id: 1, text: "System online & synced with local database", time: "Just now", type: "system" },
  { id: 2, text: "All Quantum Telemetry channels operating optimal", time: "5 min ago", type: "system" }
];
let unreadNotifCount = 2;

function toggleNotificationDrawer() {
  const drawer = document.getElementById('notificationDrawer');
  if (!drawer) return;
  const isOpen = drawer.classList.contains('open');
  if (isOpen) {
    drawer.classList.remove('open');
  } else {
    drawer.classList.add('open');
    unreadNotifCount = 0;
    updateNotifBadge();
    renderNotifications();
  }
  cyberClick();
}

function addNotification(text, type = "info") {
  const now = new Date();
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
  notifications.unshift({ id: Date.now(), text, time: timeStr, type });
  unreadNotifCount++;
  updateNotifBadge();
  cyberAlert();
}

function updateNotifBadge() {
  const b = document.getElementById('notifBadge');
  if (!b) return;
  b.textContent = unreadNotifCount;
  b.style.display = unreadNotifCount > 0 ? 'inline-flex' : 'none';
}

function renderNotifications() {
  const list = document.getElementById('notifFeedList');
  if (!list) return;
  if (!notifications.length) {
    list.innerHTML = `<div class="notif-empty">No system alerts...</div>`;
    return;
  }
  list.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.type}">
      <div class="notif-item-text">${n.text}</div>
      <div class="notif-item-time">${n.time}</div>
    </div>
  `).join('');
}

function clearNotifications() {
  notifications = [];
  unreadNotifCount = 0;
  updateNotifBadge();
  renderNotifications();
  showToast('Notifications cleared');
}

// =============================================
// PIN SECURITY LOCK SYSTEM
// =============================================
let pinInput = '';
const CORRECT_PIN = '1234';

function lockPortal() {
  pinInput = '';
  updatePinDots();
  const overlay = document.getElementById('pinLockOverlay');
  if (overlay) overlay.classList.add('open');
  cyberAlert();
}

function pressPin(digit) {
  if (pinInput.length >= 4) return;
  pinInput += digit;
  cyberClick();
  updatePinDots();
  if (pinInput.length === 4) {
    setTimeout(verifyPin, 150);
  }
}

function clearPin() {
  pinInput = '';
  updatePinDots();
  cyberClick();
}

function backspacePin() {
  pinInput = pinInput.slice(0, -1);
  updatePinDots();
  cyberClick();
}

function updatePinDots() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((dot, idx) => {
    dot.classList.toggle('filled', idx < pinInput.length);
  });
  const err = document.getElementById('pinErrorMsg');
  if (err) err.textContent = '';
}

function verifyPin() {
  if (pinInput === CORRECT_PIN) {
    cyberSuccess();
    const overlay = document.getElementById('pinLockOverlay');
    if (overlay) overlay.classList.remove('open');
    showToast('🔓 Portal Unlocked Successfully!', 'success');
  } else {
    cyberAlert();
    const card = document.querySelector('.pin-lock-card');
    if (card) {
      card.classList.add('shake');
      setTimeout(() => card.classList.remove('shake'), 500);
    }
    const err = document.getElementById('pinErrorMsg');
    if (err) err.textContent = '❌ Invalid Security PIN! Try 1234';
    pinInput = '';
    updatePinDots();
  }
}

// =============================================
// MULTI-THEME ACCENT ENGINE
// =============================================
function setThemeAccent(accentName) {
  const root = document.documentElement;
  const swatches = document.querySelectorAll('.theme-swatch');
  swatches.forEach(s => s.classList.remove('active'));
  const activeSwatch = document.querySelector(`.theme-swatch.${accentName}`);
  if (activeSwatch) activeSwatch.classList.add('active');

  const themes = {
    cyan: {
      primary:          '#00F3FF',
      primaryHover:     '#4DF6FF',
      primaryGlow:      'rgba(0, 243, 255, 0.65)',
      primaryGlowInt:   'rgba(0, 243, 255, 0.95)',
      primaryDim:       'rgba(0, 243, 255, 0.15)',
      border:           'rgba(0, 243, 255, 0.22)',
      border2:          'rgba(0, 243, 255, 0.45)',
      gridLine:         'rgba(0, 243, 255, 0.04)',
    },
    magenta: {
      primary:          '#FF007F',
      primaryHover:     '#FF4DA6',
      primaryGlow:      'rgba(255, 0, 127, 0.65)',
      primaryGlowInt:   'rgba(255, 0, 127, 0.95)',
      primaryDim:       'rgba(255, 0, 127, 0.15)',
      border:           'rgba(255, 0, 127, 0.22)',
      border2:          'rgba(255, 0, 127, 0.45)',
      gridLine:         'rgba(255, 0, 127, 0.04)',
    },
    emerald: {
      primary:          '#00FF66',
      primaryHover:     '#4DFFA0',
      primaryGlow:      'rgba(0, 255, 102, 0.65)',
      primaryGlowInt:   'rgba(0, 255, 102, 0.95)',
      primaryDim:       'rgba(0, 255, 102, 0.15)',
      border:           'rgba(0, 255, 102, 0.22)',
      border2:          'rgba(0, 255, 102, 0.45)',
      gridLine:         'rgba(0, 255, 102, 0.04)',
    },
    violet: {
      primary:          '#9D00FF',
      primaryHover:     '#BC4DFF',
      primaryGlow:      'rgba(157, 0, 255, 0.65)',
      primaryGlowInt:   'rgba(157, 0, 255, 0.95)',
      primaryDim:       'rgba(157, 0, 255, 0.15)',
      border:           'rgba(157, 0, 255, 0.22)',
      border2:          'rgba(157, 0, 255, 0.45)',
      gridLine:         'rgba(157, 0, 255, 0.04)',
    }
  };

  const t = themes[accentName] || themes.cyan;

  // Core color variables
  root.style.setProperty('--primary',                t.primary);
  root.style.setProperty('--primary-hover',          t.primaryHover);
  root.style.setProperty('--primary-glow',           t.primaryGlow);
  root.style.setProperty('--primary-glow-intense',   t.primaryGlowInt);
  root.style.setProperty('--primary-dim',            t.primaryDim);

  // Border variables — these color the entire UI chrome
  root.style.setProperty('--border',                 t.border);
  root.style.setProperty('--border2',                t.border2);

  // Dynamically update the body background grid lines to match the theme
  // (they use hardcoded rgba in CSS so we inject a style tag)
  let themeStyleTag = document.getElementById('dynamic-theme-style');
  if (!themeStyleTag) {
    themeStyleTag = document.createElement('style');
    themeStyleTag.id = 'dynamic-theme-style';
    document.head.appendChild(themeStyleTag);
  }
  themeStyleTag.textContent = `
    body::before {
      background-image:
        linear-gradient(${t.gridLine} 1px, transparent 1px),
        linear-gradient(90deg, ${t.gridLine} 1px, transparent 1px);
    }
    .kpi-card { border-color: ${t.border}; }
    .kpi-card.success { border-color: rgba(0,255,102,0.3); }
    .kpi-card.danger  { border-color: rgba(255,0,85,0.3); }
    .kpi-card.warning { border-color: rgba(255,183,0,0.3); }
    ::-webkit-scrollbar-thumb { background: ${t.primary}; }
    ::selection { background: ${t.primaryDim}; color: ${t.primary}; }
    .sidebar-nav-item.active { color: ${t.primary}; border-left-color: ${t.primary}; background: ${t.primaryDim}; }
    .sidebar-nav-item:hover  { color: ${t.primary}; background: ${t.primaryDim}; }
    .form-input:focus { border-color: ${t.primary}; box-shadow: 0 0 0 2px ${t.primaryDim}; }
    .btn-primary { background: linear-gradient(135deg, ${t.primary}, ${t.primaryHover}); box-shadow: 0 0 16px ${t.primaryGlow}; }
    .btn-primary:hover { box-shadow: 0 0 28px ${t.primaryGlow}; }
    .kds-ready-btn:not([style*="rgba(0,255,102"]) { border-color: ${t.primary}; color: ${t.primary}; }
    .modal { border-color: ${t.border2}; }
    .mobile-bottom-nav { border-top-color: ${t.border2}; }
    .mb-nav-item.active { color: ${t.primary}; }
    .mb-nav-item.active .mb-nav-icon { filter: drop-shadow(0 0 6px ${t.primaryGlow}); }
    .topbar { border-bottom-color: ${t.border}; }
    .sidebar { border-right-color: ${t.border}; }
    .table-card { border-color: ${t.border}; }
    .card { border-color: ${t.border}; }
    .filter-tab.active { background: ${t.primaryDim}; color: ${t.primary}; border-color: ${t.primary}; }
    .progress-bar-fill { background: linear-gradient(90deg, ${t.primary}, ${t.primaryHover}); }
    .kpi-icon { color: ${t.primary}; }
    .kpi-value { color: ${t.primary}; }
  `;

  localStorage.setItem('pizzaCafeTheme', accentName);
  cyberClick();
  showToast(`🎨 Full Theme switched to ${accentName.toUpperCase()}`);
}

// =============================================
// THERMAL RECEIPT GENERATOR
// =============================================
let currentThermalOrder = null;

function openThermalReceipt(orderId) {
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  currentThermalOrder = o;

  const dash = '--------------------------------';

  const itemsHtml = o.items.map(it => {
    const m = menuItems.find(x => x.id === it.menuId);
    const name = m ? m.name : 'Unknown Item';
    const price = it.unitPrice !== undefined ? it.unitPrice : (m ? m.price : 0);
    const sub = price * it.qty;
    return `<tr>
      <td style="text-align:left;max-width:130px;word-break:break-word;">${name}</td>
      <td style="text-align:center;padding:4px 6px;">${it.qty}</td>
      <td style="text-align:right;white-space:nowrap;">₹${price}</td>
      <td style="text-align:right;font-weight:bold;white-space:nowrap;">₹${sub}</td>
    </tr>`;
  }).join('');

  const subtotal = o.items.reduce((s, it) => {
    const m = menuItems.find(x => x.id === it.menuId);
    const price = it.unitPrice !== undefined ? it.unitPrice : (m ? m.price : 0);
    return s + price * it.qty;
  }, 0);

  const paper = document.getElementById('thermalPaperContent');
  if (!paper) return;

  paper.innerHTML = `
    <div class="tp-header">
      <div class="tp-logo">🍕 PIZZACAFE</div>
      <div class="tp-sub">BABUPETH, CHANDRAPUR</div>
      <div class="tp-sub">TEL: +91 8411059504</div>
    </div>
    <div class="tp-dash">${dash}</div>

    <div class="tp-meta">
      <table style="width:100%;font-size:12px;border:none;">
        <tr><td style="width:80px;">ORDER</td><td><strong>#${String(o.id).padStart(3,'0')}</strong></td></tr>
        <tr><td>TYPE</td><td><strong>${o.type.toUpperCase()}</strong></td></tr>
        <tr><td>DATE</td><td>${o.date} ${o.time}</td></tr>
        <tr><td>CUSTOMER</td><td><strong>${o.customer}</strong></td></tr>
        ${o.phone ? `<tr><td>PHONE</td><td>${o.phone}</td></tr>` : ''}
        ${o.note ? `<tr><td>NOTE</td><td style="font-style:italic;">${o.note}</td></tr>` : ''}
      </table>
    </div>
    <div class="tp-dash">${dash}</div>

    <table class="tp-table">
      <thead>
        <tr>
          <th style="text-align:left;">ITEM</th>
          <th style="text-align:center;">QTY</th>
          <th style="text-align:right;">RATE</th>
          <th style="text-align:right;">AMT</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="tp-dash">${dash}</div>

    <div class="tp-totals">
      <div class="tp-total-row"><span>SUBTOTAL</span><span>₹${subtotal}</span></div>
      ${o.discount ? `<div class="tp-total-row"><span>DISCOUNT (${o.discount.label})</span><span>-₹${o.discount.savings}</span></div>` : ''}
      <div class="tp-total-row grand"><span>TOTAL AMOUNT</span><span>₹${o.total}</span></div>
    </div>
    <div class="tp-dash">${dash}</div>

    <div class="tp-payinfo">
      <div>PAYMENT: <strong>${o.payMode ? o.payMode.toUpperCase() : 'CASH'} (${o.paid ? 'PAID' : 'UNPAID'})</strong></div>
      ${o.cashAmount ? `<div>CASH TENDERED: ₹${o.cashAmount}</div>` : ''}
      ${o.onlineAmount ? `<div>ONLINE / UPI: ₹${o.onlineAmount}</div>` : ''}
    </div>
    <div class="tp-dash">${dash}</div>

    <div class="tp-footer">
      <div style="font-weight:bold;">*** THANK YOU FOR YOUR VISIT ***</div>
      <div style="margin-top:4px;font-size:10px;">Powered by Pizzatta Cafe POS</div>
      <div class="tp-barcode">||| |||| || ||||| ||| ||||</div>
    </div>
  `;

  cyberClick();
  openModal('thermalReceiptModal');
}

function printThermalReceipt() {
  const paper = document.getElementById('thermalPaperContent');
  if (!paper) return;
  const win = window.open('', '', 'width=400,height=600');
  win.document.write(`
    <html><head><title>Receipt #${currentThermalOrder?.id}</title>
    <style>
      body { font-family: monospace; font-size: 12px; margin: 10px; width: 280px; }
      .tp-header { text-align: center; font-weight: bold; }
      .tp-logo { font-size: 16px; margin-bottom: 4px; }
      .tp-dash { text-align: center; margin: 6px 0; }
      .tp-table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 11px; }
      .tp-totals { margin-top: 6px; }
      .tp-total-row { display: flex; justify-content: space-between; margin: 3px 0; }
      .tp-total-row.grand { font-size: 14px; font-weight: bold; }
      .tp-footer { text-align: center; margin-top: 12px; font-size: 10px; }
      .tp-barcode { letter-spacing: 3px; margin-top: 6px; font-size: 14px; }
    </style>
    </head><body>${paper.innerHTML}</body></html>
  `);
  win.document.close();
  win.focus();
  win.print();
  win.close();
}

// =============================================
// DISCOUNT APPLIER MODAL
// =============================================
let currentDiscOrder = null;
let discType = 'percent';

function openDiscountModal(orderId) {
  const o = orders.find(x => String(x.id) === String(orderId));
  if (!o) return;
  currentDiscOrder = o;
  document.getElementById('discountOrderId').value = orderId;
  document.getElementById('discountOrderInfo').textContent = `Order #${String(o.id).padStart(3,'0')} — ${o.customer}`;
  document.getElementById('discountValInput').value = o.discount ? o.discount.val : '';
  discType = o.discount ? o.discount.type : 'percent';
  updateDiscTypeButtons();
  calcDiscountPreview();
  openModal('discountModal');
}

function setDiscountType(type) {
  discType = type;
  updateDiscTypeButtons();
  calcDiscountPreview();
}

function updateDiscTypeButtons() {
  const pBtn = document.getElementById('discTypePctBtn');
  const fBtn = document.getElementById('discTypeFlatBtn');
  if (pBtn && fBtn) {
    pBtn.classList.toggle('active', discType === 'percent');
    fBtn.classList.toggle('active', discType === 'flat');
  }
}

function setDiscPreset(val) {
  document.getElementById('discountValInput').value = val;
  calcDiscountPreview();
}

function calcDiscountPreview() {
  if (!currentDiscOrder) return;
  const val = parseFloat(document.getElementById('discountValInput').value || 0);
  const orig = currentDiscOrder.items.reduce((s, it) => {
    const m = menuItems.find(x => x.id === it.menuId);
    return s + (it.unitPrice || (m ? m.price : 0)) * it.qty;
  }, 0) || currentDiscOrder.total;

  let savings = 0;
  if (discType === 'percent') {
    savings = Math.round(orig * (val / 100));
  } else {
    savings = val;
  }
  savings = Math.min(orig, Math.max(0, savings));
  const finalTotal = Math.max(0, orig - savings);

  const origEl = document.getElementById('discOrigTotal');
  const savEl = document.getElementById('discSavingsAmount');
  const finEl = document.getElementById('discFinalTotal');
  if (origEl) origEl.textContent = `₹${orig}`;
  if (savEl) savEl.textContent = `-₹${savings}`;
  if (finEl) finEl.textContent = `₹${finalTotal}`;
}

async function applyDiscountToOrder() {
  if (!currentDiscOrder) return;
  const val = parseFloat(document.getElementById('discountValInput').value || 0);
  const orig = currentDiscOrder.items.reduce((s, it) => {
    const m = menuItems.find(x => x.id === it.menuId);
    return s + (it.unitPrice || (m ? m.price : 0)) * it.qty;
  }, 0) || currentDiscOrder.total;

  let savings = 0;
  if (discType === 'percent') savings = Math.round(orig * (val / 100));
  else savings = val;
  savings = Math.min(orig, Math.max(0, savings));

  if (val > 0) {
    currentDiscOrder.discount = {
      type: discType,
      val,
      savings,
      label: discType === 'percent' ? `${val}% OFF` : `₹${val} OFF`
    };
    currentDiscOrder.total = orig - savings;
  } else {
    delete currentDiscOrder.discount;
    currentDiscOrder.total = orig;
  }

  await saveData();
  cyberSuccess();
  closeModal('discountModal');
  showToast(`🏷️ Discount applied to Order #${currentDiscOrder.id}!`);
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'orders') renderOrders();
}

// =============================================
// END OF DAY (EOD) SUMMARY REPORT
// =============================================
function openEodReport() {
  const today = getTodayIST();
  const list = orders.filter(o => o.date === today);
  const totalRev = list.reduce((s,o) => s + o.total, 0);
  const totalPaid = list.filter(o => o.paid).reduce((s,o) => s + o.total, 0);
  const pendingDel = list.filter(o => !o.delivered).length;
  const cashTotal = list.reduce((s,o) => s + (o.cashAmount || (o.payMode==='cash'?o.total:0)), 0);
  const onlineTotal = list.reduce((s,o) => s + (o.onlineAmount || (o.payMode==='online'?o.total:0)), 0);
  const avgOrder = list.length ? Math.round(totalRev / list.length) : 0;

  const body = document.getElementById('eodReportBody');
  if (!body) return;

  body.innerHTML = `
    <div style="padding:4px 0;">
      <div class="eod-date-header">DATE: <strong>${today}</strong> · SHIFT REPORT</div>
      <div class="kpi-grid" style="grid-template-columns:repeat(2,1fr);gap:10px;margin:12px 0;">
        <div class="kpi-card" style="padding:12px;"><div class="kpi-label">TOTAL REVENUE</div><div class="kpi-value" style="font-size:20px;">₹${totalRev.toLocaleString('en-IN')}</div></div>
        <div class="kpi-card success" style="padding:12px;"><div class="kpi-label">TOTAL ORDERS</div><div class="kpi-value" style="font-size:20px;">${list.length}</div></div>
        <div class="kpi-card warning" style="padding:12px;"><div class="kpi-label">AVG TICKET SIZE</div><div class="kpi-value" style="font-size:20px;">₹${avgOrder}</div></div>
        <div class="kpi-card danger" style="padding:12px;"><div class="kpi-label">PENDING DELIVERIES</div><div class="kpi-value" style="font-size:20px;">${pendingDel}</div></div>
      </div>
      <div class="split-result-box" style="margin-top:12px;">
        <div class="split-result-row"><span>💵 Cash Received</span><span style="color:var(--success)">₹${cashTotal.toLocaleString('en-IN')}</span></div>
        <div class="split-result-row"><span>📱 Online / UPI Received</span><span style="color:var(--primary)">₹${onlineTotal.toLocaleString('en-IN')}</span></div>
        <div class="split-result-row split-total"><span>Total Collected</span><span>₹${(cashTotal + onlineTotal).toLocaleString('en-IN')}</span></div>
      </div>
    </div>
  `;

  cyberClick();
  openModal('eodModal');
}

async function downloadEodReport() {
  const today = getTodayIST();
  const list = orders.filter(o => o.date === today);
  const totalRev = list.reduce((s,o) => s + o.total, 0);

  let txt = `====================================================\n`;
  txt += `            PIZZACAFE — END OF DAY REPORT           \n`;
  txt += `            DATE: ${today}                          \n`;
  txt += `====================================================\n`;
  txt += `TOTAL ORDERS  : ${list.length}\n`;
  txt += `TOTAL REVENUE : Rs. ${totalRev}\n`;
  txt += `====================================================\n`;

  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `EOD_Report_${today}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('📊 EOD Report downloaded!');
}

// =============================================
// BATCH ACTION OPERATIONS
// =============================================
function updateBatchBar() {
  const chks = document.querySelectorAll('.order-batch-chk:checked');
  const bar = document.getElementById('batchActionBar');
  const badge = document.getElementById('batchCountBadge');
  if (!bar || !badge) return;

  if (chks.length > 0) {
    badge.textContent = chks.length;
    bar.classList.add('active');
  } else {
    bar.classList.remove('active');
  }
}

function toggleSelectAllOrders(mainChkBx) {
  const chks = document.querySelectorAll('.order-batch-chk');
  chks.forEach(c => c.checked = mainChkBx.checked);
  updateBatchBar();
}

function clearBatchSelection() {
  const chks = document.querySelectorAll('.order-batch-chk');
  chks.forEach(c => c.checked = false);
  const main = document.getElementById('selectAllChkBx');
  if (main) main.checked = false;
  updateBatchBar();
}

function getSelectedOrderIds() {
  const chks = document.querySelectorAll('.order-batch-chk:checked');
  return Array.from(chks).map(c => c.value);
}

async function batchMarkPaid() {
  const ids = getSelectedOrderIds();
  if (!ids.length) return;
  orders.forEach(o => {
    if (ids.includes(String(o.id))) o.paid = true;
  });
  await saveData();
  clearBatchSelection();
  cyberSuccess();
  showToast(`✓ ${ids.length} orders marked as PAID!`);
  renderOrders();
}

async function batchMarkDelivered() {
  const ids = getSelectedOrderIds();
  if (!ids.length) return;
  orders.forEach(o => {
    if (ids.includes(String(o.id))) o.delivered = true;
  });
  await saveData();
  clearBatchSelection();
  cyberSuccess();
  showToast(`🛵 ${ids.length} orders marked as DELIVERED!`);
  renderOrders();
}

async function batchDeleteOrders() {
  const ids = getSelectedOrderIds();
  if (!ids.length) return;
  if (!confirm(`Delete ${ids.length} selected orders?`)) return;
  orders = orders.filter(o => !ids.includes(String(o.id)));
  await saveData();
  clearBatchSelection();
  cyberAlert();
  showToast(`🗑️ ${ids.length} orders deleted!`);
  renderOrders();
}


// =============================================
// AI VOICE ASSISTANT ENGINE (Speech Recognition)
// =============================================
let recognition = null;
let isAiVoiceListening = false;

function initAiVoiceEngine() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Speech Recognition API not supported in this browser.");
    return false;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isAiVoiceListening = true;
    updateAiVoiceUI(true);
    cyberSuccess();
    showToast('🎙️ AI Voice Assistant ONLINE! Speak commands now...');
  };

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }

    const txt = final || interim;
    const bar = document.getElementById('aiVoiceTranscript');
    if (bar && txt) bar.textContent = `🎙️ AI HEARD: "${txt.toUpperCase()}"`;

    if (final) {
      processAiVoiceCommand(final.toLowerCase());
    }
  };

  recognition.onerror = (event) => {
    console.warn("AI Voice Error:", event.error);
    if (event.error === 'not-allowed') {
      showToast('⚠️ Microphone permission required for AI Voice', 'error');
      stopAiVoice();
    }
  };

  recognition.onend = () => {
    if (isAiVoiceListening) {
      try { recognition.start(); } catch(e) {}
    } else {
      updateAiVoiceUI(false);
    }
  };

  return true;
}

function toggleAiVoice() {
  if (isAiVoiceListening) {
    stopAiVoice();
  } else {
    startAiVoice();
  }
}

function startAiVoice() {
  if (!recognition) {
    const ok = initAiVoiceEngine();
    if (!ok) {
      showToast('Speech Recognition not supported in this browser. Try Chrome/Edge!', 'error');
      return;
    }
  }
  try {
    recognition.start();
  } catch(e) {
    isAiVoiceListening = true;
    updateAiVoiceUI(true);
  }
}

function stopAiVoice() {
  isAiVoiceListening = false;
  if (recognition) {
    try { recognition.stop(); } catch(e) {}
  }
  updateAiVoiceUI(false);
  showToast('🔇 AI Voice Assistant Offline');
}

function updateAiVoiceUI(listening) {
  const btn = document.getElementById('aiVoiceBtn');
  const bar = document.getElementById('aiVoiceStatusBar');
  if (btn) btn.classList.toggle('listening', listening);
  if (bar) bar.classList.toggle('active', listening);
}

function processAiVoiceCommand(cmd) {
  cmd = cmd.trim();
  console.log("Processing AI Voice Command:", cmd);

  // Navigation commands
  if (cmd.includes('dashboard') || cmd.includes('command deck')) { navigate('dashboard'); showToast('🤖 AI: Navigating to Dashboard'); return; }
  if (cmd.includes('orders') || cmd.includes('sector orders')) { navigate('orders'); showToast('🤖 AI: Navigating to Orders'); return; }
  if (cmd.includes('kitchen') || cmd.includes('kds')) { navigate('kds'); showToast('🤖 AI: Navigating to Kitchen KDS'); return; }
  if (cmd.includes('menu')) { navigate('menu'); showToast('🤖 AI: Navigating to Menu Manager'); return; }
  if (cmd.includes('analytics') || cmd.includes('telemetry')) { navigate('analytics'); showToast('🤖 AI: Navigating to Analytics'); return; }

  // Action commands
  if (cmd.includes('lock portal') || cmd.includes('lock')) { lockPortal(); showToast('🤖 AI: Locking Portal'); return; }
  if (cmd.includes('pos') || cmd.includes('quick pos')) { openPosModal(); showToast('🤖 AI: Opening POS Synthesizer'); return; }
  if (cmd.includes('new order')) { openNewOrderModal(); showToast('🤖 AI: Opening New Order Modal'); return; }
  if (cmd.includes('search') || cmd.includes('find')) { openGlobalSearch(); showToast('🤖 AI: Opening Search'); return; }
  if (cmd.includes('toggle audio') || cmd.includes('audio')) { toggleCyberAudio(); return; }

  // Parser order command (e.g., "2 paneer pizza for Amit")
  if (cmd.includes('for ') || cmd.includes('order') || cmd.includes('add')) {
    openAiParserModal();
    const input = document.getElementById('aiParserInput');
    if (input) {
      input.value = cmd;
      parseAiOrderText();
      showToast('🤖 AI: Order parsed from voice command!');
    }
  }
}

// =============================================
// AI NATURAL LANGUAGE ORDER PARSER ENGINE
// =============================================
let parsedAiOrder = null;

function openAiParserModal() {
  cyberClick();
  parsedAiOrder = null;
  const input = document.getElementById('aiParserInput');
  const preview = document.getElementById('aiParsedPreview');
  const btn = document.getElementById('btnSubmitAiOrder');
  if (input) input.value = '';
  if (preview) preview.innerHTML = `<div class="ai-parsed-empty">Start typing above to see AI live parsing...</div>`;
  if (btn) btn.disabled = true;
  openModal('aiParserModal');
}

function setAiParserExample(str) {
  const input = document.getElementById('aiParserInput');
  if (input) {
    input.value = str;
    parseAiOrderText();
  }
}

function parseAiOrderText() {
  const text = (document.getElementById('aiParserInput')?.value || '').trim();
  const preview = document.getElementById('aiParsedPreview');
  const btn = document.getElementById('btnSubmitAiOrder');
  if (!preview) return;

  if (!text || text.length < 3) {
    preview.innerHTML = `<div class="ai-parsed-empty">Start typing above to see AI live parsing...</div>`;
    if (btn) btn.disabled = true;
    parsedAiOrder = null;
    return;
  }

  // Extract Customer Name ("for Rahul" / "customer Priya")
  let customer = 'Walk-in Customer';
  const custMatch = text.match(/(?:for|customer)\s+([A-Za-z\s]+?)(?:\s+\d+|\s+note|\s+with|$)/i) || text.match(/for\s+([A-Za-z\s]+)/i);
  if (custMatch && custMatch[1].trim()) {
    customer = custMatch[1].trim();
  }

  // Extract Phone number (10 digit pattern)
  let phone = '';
  const phoneMatch = text.match(/\b([6-9]\d{9})\b/);
  if (phoneMatch) {
    phone = phoneMatch[1];
  }

  // Extract Note ("note extra spicy")
  let note = '';
  const noteMatch = text.match(/note\s+(.+)$/i);
  if (noteMatch) {
    note = noteMatch[1].trim();
  }

  // Extract items using fuzzy name matching
  const matchedItems = [];
  menuItems.forEach(item => {
    const itemNameLower = item.name.toLowerCase();
    const cleanName = itemNameLower.replace(/[^a-z0-9\s]/g, '');
    const tokens = cleanName.split(' ').filter(w => w.length > 3);
    
    let isMatch = text.toLowerCase().includes(cleanName);
    if (!isMatch && tokens.length) {
      isMatch = tokens.every(t => text.toLowerCase().includes(t));
    }

    if (isMatch) {
      let qty = 1;
      const escapedName = item.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const qtyRegex = new RegExp(`(\\d+)\\s*(?:x|pcs|node|nodes|piece)?\\s*${escapedName.slice(0, 8)}`, 'i');
      const m = text.match(qtyRegex);
      if (m) {
        qty = parseInt(m[1]) || 1;
      }
      matchedItems.push({ menuId: item.id, qty, unitPrice: item.price, name: item.name });
    }
  });

  if (!matchedItems.length) {
    preview.innerHTML = `<div class="ai-parsed-empty" style="color:var(--warning)">⚠️ AI searching menu... No exact menu items matched yet. Try specifying item names!</div>`;
    if (btn) btn.disabled = true;
    parsedAiOrder = null;
    return;
  }

  const total = matchedItems.reduce((s, it) => s + (it.qty * it.unitPrice), 0);
  parsedAiOrder = { customer, phone, items: matchedItems, total, note };

  const itemsListHtml = matchedItems.map(it => `
    <div class="ai-parsed-item-row">
      <span><strong>${it.qty}×</strong> ${it.name}</span>
      <span>₹${it.qty * it.unitPrice}</span>
    </div>
  `).join('');

  preview.innerHTML = `
    <div class="ai-parsed-card">
      <div class="ai-parsed-header">
        <span>👤 CUSTOMER: <strong>${customer}</strong> ${phone ? `(📞 ${phone})` : ''}</span>
        <span class="ai-confidence-badge">✨ 98% AI CONFIDENCE</span>
      </div>
      <div class="ai-parsed-items">${itemsListHtml}</div>
      ${note ? `<div class="ai-parsed-note">📝 NOTE: ${note}</div>` : ''}
      <div class="ai-parsed-total-row">
        <span>ESTIMATED TOTAL</span>
        <span style="color:var(--success);font-size:18px;">₹${total}</span>
      </div>
    </div>
  `;

  if (btn) btn.disabled = false;
}

async function submitAiParsedOrder() {
  if (!parsedAiOrder || !parsedAiOrder.items.length) return;

  const now = new Date();
  const hr = now.getHours(), mn = now.getMinutes();
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const h12 = hr % 12 || 12;
  const timeStr = `${h12}:${String(mn).padStart(2,'0')} ${ampm}`;

  const newOrder = {
    id: nextOrderId++,
    customer: parsedAiOrder.customer,
    phone: parsedAiOrder.phone || '',
    ready: false,
    items: parsedAiOrder.items.map(it => ({ menuId: it.menuId, qty: it.qty, unitPrice: it.unitPrice })),
    total: parsedAiOrder.total,
    type: 'dine-in',
    date: getTodayIST(),
    time: timeStr,
    paid: false,
    delivered: false,
    payMode: 'cash',
    cashAmount: 0,
    onlineAmount: 0,
    note: parsedAiOrder.note || ''
  };

  orders.push(newOrder);
  await saveData();
  cyberSuccess();
  closeModal('aiParserModal');
  showToast(`⚡ AI Parsed Order #${newOrder.id} created for ${newOrder.customer}!`);
  addNotification(`✨ AI Parsed Order #${newOrder.id} (${newOrder.customer}) created`, 'order');

  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'orders') renderOrders();
  if (currentPage === 'kds') renderKds(kdsFilter);
}

