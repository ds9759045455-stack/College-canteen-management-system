/**
 * HITAHARA CANTEEN - KITCHEN & STAFF PORTAL LOGIC
 * Real-time order kitchen line, instant action rollback, and dynamic stock controller.
 */

// Render Staff Dashboard & KPI Metrics
function renderStaffDashboard() {
  const orders = window.AppState.orders || [];
  const menu = window.AppState.menu || [];

  const activeOrders = orders.filter(o => o.status !== 'COLLECTED' && o.status !== 'CANCELLED');
  const preparingOrders = orders.filter(o => o.status === 'PREPARING');
  const readyOrders = orders.filter(o => o.status === 'READY');

  // Update KPI counters
  const kpiQueue = document.getElementById('kpiQueueCount');
  const kpiPrep = document.getElementById('kpiPreparingCount');
  const kpiReady = document.getElementById('kpiReadyCount');
  const kpiMenu = document.getElementById('kpiMenuItemsCount');

  if (kpiQueue) kpiQueue.textContent = activeOrders.length;
  if (kpiPrep) kpiPrep.textContent = preparingOrders.length;
  if (kpiReady) kpiReady.textContent = readyOrders.length;
  if (kpiMenu) kpiMenu.textContent = menu.length;

  // Render active tab content
  if (window.AppState.staffSubTab === 'queue') {
    renderKitchenQueueBoard();
  } else {
    renderInventoryTable();
  }
}

// Render Live Kitchen Orders Board
function renderKitchenQueueBoard() {
  const container = document.getElementById('kitchenQueueContainer');
  if (!container) return;

  const orders = window.AppState.orders || [];
  const activeOrders = orders.filter(o => o.status !== 'COLLECTED' && o.status !== 'CANCELLED');

  if (activeOrders.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center space-y-3 rounded-3xl bg-zinc-900 border border-zinc-800">
        <div class="w-16 h-16 rounded-3xl bg-zinc-800/80 flex items-center justify-center mx-auto text-emerald-400">
          <i data-lucide="check-circle" class="w-8 h-8"></i>
        </div>
        <h3 class="font-display text-lg font-bold text-white">All Kitchen Orders Cleared!</h3>
        <p class="text-xs text-zinc-400">There are no pending tickets right now. Waiting for new student orders.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = activeOrders.map((order, idx) => {
    const isNextUp = (idx === 0);

    let statusBadge = '';
    let actionBtnHtml = '';

    if (order.status === 'PENDING') {
      statusBadge = `<span class="px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-300 text-xs font-semibold border border-amber-500/30">1. Order Placed</span>`;
      actionBtnHtml = `
        <button onclick="advanceOrderStatus(${order.order_id})" class="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-md transition flex items-center justify-center space-x-1.5">
          <i data-lucide="flame" class="w-4 h-4"></i>
          <span>Start Cooking</span>
        </button>
      `;
    } else if (order.status === 'PREPARING') {
      statusBadge = `<span class="px-2.5 py-1 rounded-xl bg-orange-500/20 text-orange-300 text-xs font-semibold border border-orange-500/40 animate-pulse">2. Cooking in Kitchen</span>`;
      actionBtnHtml = `
        <button onclick="advanceOrderStatus(${order.order_id})" class="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition flex items-center justify-center space-x-1.5">
          <i data-lucide="bell-ring" class="w-4 h-4"></i>
          <span>Mark Ready for Pickup</span>
        </button>
      `;
    } else if (order.status === 'READY') {
      statusBadge = `<span class="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/40">3. Waiting at Counter</span>`;
      actionBtnHtml = `
        <button onclick="advanceOrderStatus(${order.order_id})" class="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition flex items-center justify-center space-x-1.5">
          <i data-lucide="check-check" class="w-4 h-4"></i>
          <span>Mark Handed to Student</span>
        </button>
      `;
    }

    return `
      <div class="order-card flex flex-col justify-between rounded-3xl bg-zinc-900 border ${isNextUp ? 'border-orange-500/70 shadow-orange-500/10 shadow-xl' : 'border-zinc-800'} p-5 space-y-4">
        
        <!-- Order Card Header -->
        <div class="space-y-2">
          
          ${isNextUp ? `
            <div class="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg bg-orange-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
              <i data-lucide="zap" class="w-3 h-3"></i>
              <span>Next Order to Cook</span>
            </div>
          ` : `
            <span class="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Ticket In Line #${idx + 1}</span>
          `}

          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="font-display font-bold text-xl text-white">#${order.order_id}</span>
              <span class="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">${order.pickup_type}</span>
            </div>
            ${statusBadge}
          </div>

          <div class="text-xs text-zinc-400">
            <span class="text-white font-semibold">${order.student_name}</span> 
            <span class="text-zinc-500 font-mono">(${order.student_id})</span>
            <span class="mx-1">•</span>
            <span>${order.created_at}</span>
          </div>

        </div>

        <!-- Special Notes Callout -->
        ${order.special_notes && order.special_notes !== 'None' && order.special_notes !== 'Standard order' ? `
          <div class="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/20 text-xs text-amber-200 flex items-start space-x-2">
            <i data-lucide="alert-circle" class="w-4 h-4 text-amber-400 shrink-0 mt-0.5"></i>
            <span><b>Notes:</b> ${order.special_notes}</span>
          </div>
        ` : ''}

        <!-- Dishes Items List -->
        <div class="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-1.5 text-xs">
          <p class="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Order Items</p>
          ${(order.items || []).map(it => `
            <div class="flex items-center justify-between text-zinc-200">
              <span class="font-medium">${it.quantity}× ${it.name || it.item_name}</span>
              <span class="font-mono text-zinc-400">₹${Number(it.unit_price * it.quantity).toFixed(2)}</span>
            </div>
          `).join('')}
          <div class="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs font-bold text-white">
            <span>Bill Total</span>
            <span class="text-orange-400 font-mono">₹${Number(order.total_amount).toFixed(2)}</span>
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
      <tr class="hover:bg-zinc-800/40 transition">
        <td class="py-3 px-4 font-mono text-xs text-orange-400">#${dish.id}</td>
        <td class="py-3 px-4 flex items-center space-x-3">
          <img src="${dish.image_url}" class="w-10 h-10 rounded-lg object-cover" />
          <div>
            <p class="font-semibold text-white text-xs">${dish.name}</p>
            <p class="text-[11px] text-zinc-400">${dish.is_veg ? '🌱 Pure Veg' : '🍗 Non-Veg'} • ${dish.prep_time_min} mins</p>
          </div>
        </td>
        <td class="py-3 px-4 text-xs text-zinc-300">${dish.category}</td>
        <td class="py-3 px-4 font-mono font-bold text-xs text-white">₹${Number(dish.price).toFixed(2)}</td>
        <td class="py-3 px-4">
          <span class="px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${dish.stock_qty <= 5 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}">
            ${dish.stock_qty} portions
          </span>
        </td>
        <td class="py-3 px-4">
          <div class="flex items-center space-x-1">
            <button onclick="adjustStock(${dish.id}, -5)" class="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 font-mono">-5</button>
            <button onclick="adjustStock(${dish.id}, -1)" class="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 font-mono">-1</button>
            <button onclick="adjustStock(${dish.id}, 1)" class="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 font-mono">+1</button>
            <button onclick="adjustStock(${dish.id}, 5)" class="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 font-mono">+5</button>
          </div>
        </td>
        <td class="py-3 px-4 text-right">
          <button onclick="deleteMenuItem(${dish.id})" title="Delete Dish" class="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Adjust Item Stock
async function adjustStock(dishId, delta) {
  try {
    const res = await fetch('/api/menu/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: dishId, delta: delta })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      showToast('Stock Updated', `Available portions updated for dish #${dishId}.`, 'info');
      await fetchSystemState();
    }
  } catch (err) {
    console.error('Stock adjustment error:', err);
  }
}

// Delete Dish
async function deleteMenuItem(dishId) {
  if (!confirm(`Are you sure you want to remove Dish #${dishId} from the menu?`)) return;

  try {
    const res = await fetch(`/api/menu/item/${dishId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.status === 'ok') {
      showToast('Dish Removed', `Dish #${dishId} has been removed from the menu.`, 'warning');
      await fetchSystemState();
    }
  } catch (err) {
    console.error('Delete item error:', err);
  }
}

// Open/Close Add Dish Modal
function openAddDishModal() {
  document.getElementById('addDishModal')?.classList.remove('hidden');
}

function closeAddDishModal() {
  document.getElementById('addDishModal')?.classList.add('hidden');
}

// Submit New Dish
async function handleAddDishSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('newDishName')?.value.trim();
  const category = document.getElementById('newDishCategory')?.value;
  const price = parseFloat(document.getElementById('newDishPrice')?.value || 0);
  const prepTime = parseInt(document.getElementById('newDishPrepTime')?.value || 8);
  const stock = parseInt(document.getElementById('newDishStock')?.value || 20);
  const isVeg = parseInt(document.getElementById('newDishIsVeg')?.value || 1);
  const imageUrl = document.getElementById('newDishImageUrl')?.value.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
  const desc = document.getElementById('newDishDesc')?.value.trim() || 'Freshly made canteen specialty.';

  const payload = {
    name,
    category,
    price,
    prep_time_min: prepTime,
    stock_qty: stock,
    is_veg: isVeg,
    image_url: imageUrl,
    description: desc
  };

  try {
    const res = await fetch('/api/menu/item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.status === 'ok') {
      showToast('Dish Added ✨', `"${name}" added to the menu!`, 'success');
      closeAddDishModal();
      document.getElementById('addDishForm')?.reset();
      await fetchSystemState();
    }
  } catch (err) {
    console.error('Add dish error:', err);
    showToast('Error', 'Failed to add dish.', 'error');
  }
}
