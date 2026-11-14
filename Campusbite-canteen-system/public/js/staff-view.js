/**
 * CAMPUSBITE - KITCHEN & STAFF PORTAL LOGIC
 * Real-time order line, raw material inventory & portion controller.
 * Styled in Charcoal Black & Zomato Red Theme.
 */

// Render Staff Dashboard & KPI Metrics
function renderStaffDashboard() {
  const orders = window.AppState.orders || [];
  const menu = window.AppState.menu || [];
  const rawMaterials = window.AppState.rawMaterials || [];

  const activeOrders = orders.filter(o => o.status !== 'COLLECTED' && o.status !== 'CANCELLED');
  const preparingOrders = orders.filter(o => o.status === 'PREPARING');
  const readyOrders = orders.filter(o => o.status === 'READY');

  // Update KPI counters
  const kpiQueue = document.getElementById('kpiQueueCount');
  const kpiPrep = document.getElementById('kpiPreparingCount');
  const kpiReady = document.getElementById('kpiReadyCount');
  const kpiRaw = document.getElementById('kpiRawMaterialsCount');

  if (kpiQueue) kpiQueue.textContent = activeOrders.length;
  if (kpiPrep) kpiPrep.textContent = preparingOrders.length;
  if (kpiReady) kpiReady.textContent = readyOrders.length;
  if (kpiRaw) kpiRaw.textContent = rawMaterials.length;

  // Render active tab content
  if (window.AppState.staffSubTab === 'queue') {
    renderKitchenQueueBoard();
  } else if (window.AppState.staffSubTab === 'rawmaterials') {
    renderRawMaterialsTable();
  } else {
    renderInventoryTable();
  }
}

// Render Live Kitchen Orders Board
function renderKitchenQueueBoard() {
  const container = document.getElementById('kitchenQueueContainer');
  if (!container) return;

  const orders = window.AppState.orders || [];
  const activeOrders = orders.filter(o => o.status !== 'COLLECTED');

  if (activeOrders.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center space-y-3 rounded-3xl bg-[#14181f] border border-white/10">
        <div class="w-16 h-16 rounded-3xl bg-[#e23744]/15 border border-[#e23744]/30 flex items-center justify-center mx-auto text-[#ff5263]">
          <i data-lucide="check-circle" class="w-8 h-8"></i>
        </div>
        <h3 class="font-display text-lg font-bold text-white">All Kitchen Orders Cleared!</h3>
        <p class="text-xs text-slate-400">There are no pending tickets right now. Waiting for new student orders.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = activeOrders.map((order, idx) => {
    const isNextUp = (idx === 0 && order.status !== 'CANCELLED');
    const isCancelled = (order.status === 'CANCELLED');

    let statusBadge = '';
    let actionBtnHtml = '';

    if (order.status === 'PENDING') {
      statusBadge = `<span class="px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-300 text-xs font-semibold border border-amber-500/30">1. Order Placed</span>`;
      actionBtnHtml = `
        <div class="grid grid-cols-2 gap-2">
          <button onclick="advanceOrderStatus(${order.order_id})" class="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold text-xs shadow-md transition flex items-center justify-center space-x-1">
            <i data-lucide="flame" class="w-3.5 h-3.5"></i>
            <span>Start Cooking</span>
          </button>
          <button onclick="promptCancelOrder(${order.order_id})" class="py-2.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-semibold text-xs transition flex items-center justify-center space-x-1">
            <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
            <span>Cancel</span>
          </button>
        </div>
      `;
    } else if (order.status === 'PREPARING') {
      statusBadge = `<span class="px-2.5 py-1 rounded-xl bg-[#e23744]/20 text-[#ff6b7b] text-xs font-semibold border border-[#e23744]/40 animate-pulse">2. Cooking in Kitchen</span>`;
      actionBtnHtml = `
        <div class="grid grid-cols-2 gap-2">
          <button onclick="advanceOrderStatus(${order.order_id})" class="py-2.5 px-3 rounded-xl bg-[#e23744] hover:bg-[#cb202d] text-white font-semibold text-xs shadow-md transition flex items-center justify-center space-x-1">
            <i data-lucide="bell-ring" class="w-3.5 h-3.5"></i>
            <span>Mark Ready</span>
          </button>
          <button onclick="promptCancelOrder(${order.order_id})" class="py-2.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-semibold text-xs transition flex items-center justify-center space-x-1">
            <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
            <span>Cancel (35%)</span>
          </button>
        </div>
      `;
    } else if (order.status === 'READY') {
      statusBadge = `<span class="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/40">3. Waiting at Counter</span>`;
      actionBtnHtml = `
        <button onclick="advanceOrderStatus(${order.order_id})" class="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition flex items-center justify-center space-x-1.5">
          <i data-lucide="check-check" class="w-4 h-4"></i>
          <span>Mark Handed to Student</span>
        </button>
      `;
    } else if (isCancelled) {
      statusBadge = `<span class="px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/40">Cancelled</span>`;
      actionBtnHtml = `
        <div class="p-2 rounded-xl bg-rose-950/30 border border-rose-500/20 text-[11px] text-rose-300 text-center">
          Fee: ₹${Number(order.penalty_deduction || 0).toFixed(2)} | Refund: ₹${Number(order.refund_amount || 0).toFixed(2)}
        </div>
      `;
    }

    return `
      <div class="order-card flex flex-col justify-between p-5 space-y-4 ${isNextUp ? 'border-[#e23744]/70 shadow-red-950/50 shadow-xl' : (isCancelled ? 'border-rose-500/30 opacity-75' : '')}">
        
        <!-- Order Card Header -->
        <div class="space-y-2">
          
          ${isNextUp ? `
            <div class="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-[#e23744] to-[#cb202d] text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
              <i data-lucide="zap" class="w-3 h-3"></i>
              <span>Next Order to Cook</span>
            </div>
          ` : `
            <span class="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Ticket #${idx + 1}</span>
          `}

          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="font-display font-bold text-xl text-white">#${order.order_id}</span>
              <span class="text-xs px-2 py-0.5 rounded bg-[#1c2229] text-slate-300">${order.pickup_type}</span>
            </div>
            ${statusBadge}
          </div>

          <div class="text-xs text-slate-400">
            <span class="text-white font-semibold">${order.student_name}</span> 
            <span class="text-slate-400 font-mono">(${order.student_id})</span>
            <span class="mx-1">•</span>
            <span>${order.created_at}</span>
          </div>

        </div>

        <!-- Special Notes Callout -->
        ${order.special_notes && order.special_notes !== 'None' ? `
          <div class="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/20 text-xs text-amber-200 flex items-start space-x-2">
            <i data-lucide="alert-circle" class="w-4 h-4 text-amber-400 shrink-0 mt-0.5"></i>
            <span><b>Notes:</b> ${order.special_notes}</span>
          </div>
        ` : ''}

        <!-- Dishes Items List -->
        <div class="p-3 rounded-2xl bg-[#0b0e11] border border-white/5 space-y-1.5 text-xs">
          <p class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Order Items</p>
          ${(order.items || []).map(it => `
            <div class="flex items-center justify-between text-slate-200">
              <span class="font-medium">${it.quantity}× ${it.name || it.item_name}</span>
              <span class="font-mono text-[#ff5263]">₹${Number(it.unit_price * it.quantity).toFixed(2)}</span>
            </div>
          `).join('')}
          <div class="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-bold text-white">
            <span>Bill Total</span>
            <span class="text-[#ff5263] font-mono">₹${Number(order.total_amount).toFixed(2)}</span>
          </div>
        </div>

        <!-- Action Button -->
        <div class="pt-1">
          ${actionBtnHtml}
        </div>

      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Render Raw Materials Inventory Table
function renderRawMaterialsTable() {
  const tbody = document.getElementById('rawMaterialsTableBody');
  if (!tbody) return;

  const materials = window.AppState.rawMaterials || [];

  tbody.innerHTML = materials.map(mat => {
    const isLowStock = mat.current_stock <= mat.min_threshold;

    return `
      <tr class="hover:bg-[#1a2028]/60 transition">
        <td class="py-3 px-4">
          <p class="font-semibold text-white text-xs">${mat.name}</p>
          <span class="text-[10px] text-slate-400 font-mono">ID #${mat.id}</span>
        </td>
        <td class="py-3 px-4 text-xs text-slate-300">
          <span class="px-2 py-0.5 rounded-md bg-[#161a20] border border-white/10 text-slate-300">
            ${mat.category}
          </span>
        </td>
        <td class="py-3 px-4">
          <div class="flex items-center space-x-2">
            <span class="font-mono font-bold text-sm ${isLowStock ? 'text-amber-400' : 'text-[#ff5263]'}">
              ${mat.current_stock.toFixed(1)} ${mat.unit}
            </span>
            ${isLowStock ? `
              <span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                Low Stock
              </span>
            ` : `
              <span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 text-[10px] font-medium border border-emerald-500/20">
                Adequate
              </span>
            `}
          </div>
        </td>
        <td class="py-3 px-4 font-mono text-xs text-slate-400">
          Min ${mat.min_threshold} ${mat.unit}
        </td>
        <td class="py-3 px-4 text-xs text-slate-300 max-w-xs truncate" title="${mat.linked_dishes}">
          ${mat.linked_dishes}
        </td>
        <td class="py-3 px-4 text-right">
          <div class="flex items-center justify-end space-x-1 font-mono text-xs">
            <button onclick="restockRawMaterial(${mat.id}, 5)" class="px-2.5 py-1 rounded-lg bg-[#1a2028] hover:bg-[#e23744] text-slate-200 hover:text-white transition" title="Add 5 ${mat.unit}">+5</button>
            <button onclick="restockRawMaterial(${mat.id}, 10)" class="px-2.5 py-1 rounded-lg bg-[#1a2028] hover:bg-[#e23744] text-slate-200 hover:text-white transition" title="Add 10 ${mat.unit}">+10</button>
            <button onclick="restockRawMaterial(${mat.id}, 25)" class="px-2.5 py-1 rounded-lg bg-[#1a2028] hover:bg-[#e23744] text-slate-200 hover:text-white transition" title="Add 25 ${mat.unit}">+25</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Restock Raw Material Handler
async function restockRawMaterial(id, delta) {
  try {
    const res = await fetch('/api/raw-materials/restock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, delta })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      showToast('Raw Material Restocked', `Added +${delta} to ${data.material.name}.`, 'success');
      await fetchSystemState();
    }
  } catch (err) {
    console.error('Restock error:', err);
  }
}

// Advance Order Status
async function advanceOrderStatus(orderId) {
  try {
    const res = await fetch(`/api/orders/${orderId}/advance`, { method: 'POST' });
    const data = await res.json();
    if (data.status === 'ok') {
      showToast('Status Updated', `Order #${orderId} moved to next stage.`, 'success');
      await fetchSystemState();
    } else {
      showToast('Error', data.message || 'Could not update order.', 'error');
    }
  } catch (err) {
    console.error('Error advancing order:', err);
    showToast('Network Error', 'Failed to communicate with kitchen server.', 'error');
  }
}

// Trigger Undo Last Action
async function triggerStackUndo() {
  try {
    const res = await fetch('/api/undo', { method: 'POST' });
    const data = await res.json();
    if (data.status === 'ok') {
      showToast('Action Reverted ↺', data.message, 'warning');
      await fetchSystemState();
    } else {
      showToast('Nothing to Undo', data.message || 'No recent actions recorded.', 'info');
    }
  } catch (err) {
    console.error('Undo error:', err);
    showToast('Network Error', 'Failed to trigger undo operation.', 'error');
  }
}

// Render Menu & Stock Inventory Table
function renderInventoryTable() {
  const tbody = document.getElementById('inventoryTableBody');
  if (!tbody) return;

  const menu = window.AppState.menu || [];

  tbody.innerHTML = menu.map(dish => {
    return `
      <tr class="hover:bg-[#1a2028]/60 transition">
        <td class="py-3 px-4 font-mono text-xs text-[#ff5263]">#${dish.id}</td>
        <td class="py-3 px-4 flex items-center space-x-3">
          <img src="${dish.image_url}" class="w-10 h-10 rounded-lg object-cover border border-white/5" />
          <div>
            <div class="flex items-center space-x-1.5">
              <span class="pure-veg-indicator">
                <span class="pure-veg-indicator-dot"></span>
              </span>
              <p class="font-semibold text-white text-xs">${dish.name}</p>
            </div>
            <p class="text-[11px] text-slate-400">${dish.prep_time_min} mins prep • Pure Veg</p>
          </div>
        </td>
        <td class="py-3 px-4 text-xs text-slate-300">
          <span class="px-2 py-0.5 rounded-md bg-[#161a20] border border-white/10 text-slate-300 text-[11px]">
            ${dish.category}
          </span>
        </td>
        <td class="py-3 px-4 font-mono font-bold text-xs text-white">₹${Number(dish.price).toFixed(2)}</td>
        <td class="py-3 px-4">
          <span class="px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${dish.stock_qty <= 5 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}">
            ${dish.stock_qty} portions
          </span>
        </td>
        <td class="py-3 px-4 text-xs text-slate-300 max-w-xs truncate" title="${dish.raw_materials || 'Standard ingredients'}">
          ${dish.raw_materials || 'Standard fresh ingredients'}
        </td>
        <td class="py-3 px-4 text-right">
          <div class="flex items-center justify-end space-x-1">
            <button onclick="adjustDishStock(${dish.id}, -5)" class="px-2 py-1 rounded bg-[#1a2028] hover:bg-[#e23744] text-slate-300 hover:text-white text-xs font-mono transition">-5</button>
            <button onclick="adjustDishStock(${dish.id}, 5)" class="px-2 py-1 rounded bg-[#1a2028] hover:bg-[#e23744] text-slate-300 hover:text-white text-xs font-mono transition">+5</button>
            <button onclick="adjustDishStock(${dish.id}, 20)" class="px-2 py-1 rounded bg-[#1a2028] hover:bg-[#e23744] text-slate-300 hover:text-white text-xs font-mono transition">+20</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Adjust Dish Stock Level
async function adjustDishStock(dishId, delta) {
  try {
    const res = await fetch('/api/menu/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: dishId, delta })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      showToast('Stock Adjusted', `${data.item.name} stock is now ${data.item.stock_qty}.`, 'success');
      await fetchSystemState();
    }
  } catch (err) {
    console.error('Adjust stock error:', err);
  }
}

// Switch Staff Subtabs: 'queue' | 'rawmaterials' | 'inventory'
function switchStaffSubTab(tab) {
  window.AppState.staffSubTab = tab;

  const btnQueue = document.getElementById('staffSubTabQueue');
  const btnRaw = document.getElementById('staffSubTabRaw');
  const btnInv = document.getElementById('staffSubTabInv');

  const secQueue = document.getElementById('staffSectionQueue');
  const secRaw = document.getElementById('staffSectionRawMaterials');
  const secInv = document.getElementById('staffSectionInventory');

  [btnQueue, btnRaw, btnInv].forEach(b => b?.classList.remove('active', 'text-white'));
  [btnQueue, btnRaw, btnInv].forEach(b => b?.classList.add('text-slate-400'));

  secQueue?.classList.add('hidden');
  secRaw?.classList.add('hidden');
  secInv?.classList.add('hidden');

  if (tab === 'queue') {
    btnQueue?.classList.add('active', 'text-white');
    btnQueue?.classList.remove('text-slate-400');
    secQueue?.classList.remove('hidden');
    renderKitchenQueueBoard();
  } else if (tab === 'rawmaterials') {
    btnRaw?.classList.add('active', 'text-white');
    btnRaw?.classList.remove('text-slate-400');
    secRaw?.classList.remove('hidden');
    renderRawMaterialsTable();
  } else {
    btnInv?.classList.add('active', 'text-white');
    btnInv?.classList.remove('text-slate-400');
    secInv?.classList.remove('hidden');
    renderInventoryTable();
  }

  if (window.lucide) lucide.createIcons();
}

// Add New Dish Modal Open/Close
function openAddDishModal() {
  document.getElementById('addDishModal')?.classList.remove('hidden');
}

function closeAddDishModal() {
  document.getElementById('addDishModal')?.classList.add('hidden');
}

// Handle Add Dish Submit
async function handleAddDishSubmit(event) {
  event.preventDefault();

  const name = document.getElementById('newDishName')?.value.trim();
  const category = document.getElementById('newDishCategory')?.value;
  const price = parseFloat(document.getElementById('newDishPrice')?.value || '0');
  const prepTime = parseInt(document.getElementById('newDishPrepTime')?.value || '8');
  const stockQty = parseInt(document.getElementById('newDishStock')?.value || '20');
  const rawMaterials = document.getElementById('newDishRaw')?.value.trim() || 'Fresh ingredients';
  const imageUrl = document.getElementById('newDishImageUrl')?.value.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
  const desc = document.getElementById('newDishDesc')?.value.trim() || '';

  if (!name || price <= 0) {
    showToast('Validation Error', 'Please specify a dish name and valid price.', 'error');
    return;
  }

  const payload = {
    name,
    category,
    price,
    prep_time_min: prepTime,
    stock_qty: stockQty,
    raw_materials: rawMaterials,
    image_url: imageUrl,
    description: desc,
    is_veg: true
  };

  try {
    const res = await fetch('/api/menu/item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'ok') {
      showToast('Dish Added', `${name} is now on the pure veg campus menu!`, 'success');
      closeAddDishModal();
      document.getElementById('addDishForm')?.reset();
      await fetchSystemState();
    } else {
      showToast('Error', data.message || 'Could not save dish.', 'error');
    }
  } catch (err) {
    console.error('Error adding dish:', err);
    showToast('Network Error', 'Failed to save new dish.', 'error');
  }
}
