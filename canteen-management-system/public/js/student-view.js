/**
 * HITAHARA CANTEEN - STUDENT PORTAL LOGIC
 * Dynamic menu filtering, food photography cards, tray cart drawer, and live order status.
 */

// Category Filtering
function filterCategory(cat) {
  window.AppState.activeCategory = cat;

  const buttons = document.querySelectorAll('.cat-pill');
  buttons.forEach(btn => {
    if (btn.textContent.trim().includes(cat)) {
      btn.classList.add('active');
      btn.classList.remove('text-zinc-400');
    } else {
      btn.classList.remove('active');
      btn.classList.add('text-zinc-400');
    }
  });

  renderMenuGrid();
}

// Toggle Pure Vegetarian Filter
function toggleVegOnly() {
  window.AppState.isVegOnly = !window.AppState.isVegOnly;
  const toggleBtn = document.getElementById('vegOnlyToggle');
  const dot = document.getElementById('vegDot');

  if (window.AppState.isVegOnly) {
    toggleBtn?.classList.add('border-emerald-500', 'bg-emerald-500/10', 'text-emerald-300');
    dot?.classList.remove('bg-transparent');
    dot?.classList.add('bg-emerald-500');
  } else {
    toggleBtn?.classList.remove('border-emerald-500', 'bg-emerald-500/10', 'text-emerald-300');
    dot?.classList.add('bg-transparent');
    dot?.classList.remove('bg-emerald-500');
  }

  renderMenuGrid();
}

// Search Input Handler
function handleMenuSearch() {
  const input = document.getElementById('menuSearchInput');
  window.AppState.searchQuery = (input?.value || '').toLowerCase().trim();
  renderMenuGrid();
}

// Render Menu Cards in Grid
function renderMenuGrid() {
  const container = document.getElementById('foodGrid');
  if (!container) return;

  let items = window.AppState.menu || [];

  // Filter Category
  if (window.AppState.activeCategory !== 'All') {
    items = items.filter(item => item.category === window.AppState.activeCategory);
  }

  // Filter Veg Only
  if (window.AppState.isVegOnly) {
    items = items.filter(item => item.is_veg === true || item.is_veg === 1);
  }

  // Filter Search
  if (window.AppState.searchQuery) {
    items = items.filter(item =>
      item.name.toLowerCase().includes(window.AppState.searchQuery) ||
      item.description.toLowerCase().includes(window.AppState.searchQuery) ||
      item.category.toLowerCase().includes(window.AppState.searchQuery)
    );
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center space-y-3">
        <div class="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
          <i data-lucide="search-x" class="w-8 h-8"></i>
        </div>
        <h3 class="font-display text-lg font-bold text-zinc-300">No dishes match your selection</h3>
        <p class="text-xs text-zinc-500">Try choosing another category or clear your search.</p>
        <button onclick="filterCategory('All')" class="px-4 py-2 text-xs font-semibold rounded-xl bg-orange-600/20 text-orange-400 border border-orange-500/30 hover:bg-orange-600/30">
          Show All Dishes
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = items.map(dish => {
    const inCart = window.AppState.cart.find(c => c.id === dish.id);
    const cartQty = inCart ? inCart.qty : 0;
    const isOutOfStock = dish.stock_qty <= 0;

    return `
      <div class="food-card flex flex-col justify-between rounded-3xl bg-zinc-900/90 border border-zinc-800/80 overflow-hidden shadow-lg hover:shadow-2xl">
        
        <!-- Food Photography Wrapper -->
        <div class="relative h-48 w-full overflow-hidden bg-zinc-950 food-img-wrapper">
          <img src="${dish.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'}" 
               alt="${dish.name}" 
               loading="lazy"
               class="w-full h-full object-cover transition-transform duration-500" 
               onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'" />
          
          <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-black/30"></div>

          <!-- Veg / Non-Veg Indicator Badge -->
          <div class="absolute top-3 left-3 flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-zinc-900/90 backdrop-blur-md border border-white/10 shadow-md">
            <span class="w-2.5 h-2.5 rounded-full ${dish.is_veg ? 'bg-emerald-500 ring-2 ring-emerald-500/30' : 'bg-rose-500 ring-2 ring-rose-500/30'}"></span>
            <span class="text-[11px] font-semibold ${dish.is_veg ? 'text-emerald-400' : 'text-rose-400'}">
              ${dish.is_veg ? 'Pure Veg' : 'Non-Veg'}
            </span>
          </div>

          <!-- Prep Time Badge -->
          <div class="absolute top-3 right-3 flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md text-[11px] font-medium text-zinc-300">
            <i data-lucide="clock" class="w-3 h-3 text-amber-400"></i>
            <span>${dish.prep_time_min} mins</span>
          </div>

          <!-- Stock Pill -->
          <div class="absolute bottom-3 left-3">
            ${isOutOfStock 
              ? `<span class="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wider">Sold Out</span>`
              : (dish.stock_qty <= 5 
                  ? `<span class="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">Only ${dish.stock_qty} left</span>`
                  : `<span class="px-2 py-0.5 rounded-lg bg-zinc-900/80 backdrop-blur-md text-zinc-400 text-[10px] font-medium">Available: ${dish.stock_qty}</span>`
                )
            }
          </div>
        </div>

        <!-- Card Body Content -->
        <div class="p-5 flex-1 flex flex-col justify-between space-y-3">
          <div>
            <div class="text-xs text-orange-400 font-medium mb-1">
              <span>${dish.category}</span>
            </div>
            <h3 class="font-display font-bold text-base text-white group-hover:text-orange-400 transition-colors line-clamp-1">
              ${dish.name}
            </h3>
            <p class="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
              ${dish.description || 'Freshly prepared canteen specialty with premium ingredients.'}
            </p>
          </div>

          <!-- Price & Add Action -->
          <div class="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
            <div>
              <span class="text-xs text-zinc-500">Price</span>
              <p class="font-display font-extrabold text-xl text-white">
                ₹${Number(dish.price).toFixed(2)}
              </p>
            </div>

            <!-- Add or Stepper Button -->
            <div>
              ${isOutOfStock ? `
                <button disabled class="px-3.5 py-2 rounded-xl bg-zinc-800 text-zinc-500 text-xs font-semibold cursor-not-allowed">
                  Sold Out
                </button>
              ` : (cartQty > 0 ? `
                <div class="flex items-center space-x-2 bg-orange-600/20 border border-orange-500/40 rounded-xl p-1">
                  <button onclick="decrementCartItem(${dish.id})" class="w-7 h-7 rounded-lg bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center font-bold text-xs transition">
                    -
                  </button>
                  <span class="font-mono font-bold text-sm text-orange-300 px-1">${cartQty}</span>
                  <button onclick="addToCart(${dish.id})" class="w-7 h-7 rounded-lg bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center font-bold text-xs transition" ${cartQty >= dish.stock_qty ? 'disabled class="opacity-50"' : ''}>
                    +
                  </button>
                </div>
              ` : `
                <button onclick="addToCart(${dish.id})" class="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-orange-600 text-zinc-200 hover:text-white text-xs font-semibold transition-all duration-200 shadow-md">
                  <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                  <span>Add</span>
                </button>
              `)}
            </div>

          </div>

        </div>

      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Add Item to Cart
function addToCart(dishId) {
  const dish = window.AppState.menu.find(d => d.id === dishId);
  if (!dish) return;

  const existing = window.AppState.cart.find(c => c.id === dishId);
  if (existing) {
    if (existing.qty < dish.stock_qty) {
      existing.qty++;
    } else {
      showToast('Maximum Available', `Only ${dish.stock_qty} portions available right now.`, 'warning');
      return;
    }
  } else {
    window.AppState.cart.push({
      id: dish.id,
      name: dish.name,
      price: dish.price,
      qty: 1,
      image_url: dish.image_url,
      prep_time_min: dish.prep_time_min,
      is_veg: dish.is_veg
    });
  }

  saveCart();
  updateCartBadge();
  renderMenuGrid();
  renderCartDrawer();
  showToast('Added to Tray', `${dish.name} added to your tray!`, 'success');
}

// Decrement Item in Cart
function decrementCartItem(dishId) {
  const index = window.AppState.cart.findIndex(c => c.id === dishId);
  if (index === -1) return;

  if (window.AppState.cart[index].qty > 1) {
    window.AppState.cart[index].qty--;
  } else {
    window.AppState.cart.splice(index, 1);
  }

  saveCart();
  updateCartBadge();
  renderMenuGrid();
  renderCartDrawer();
}

// Remove Item from Cart
function removeCartItem(dishId) {
  window.AppState.cart = window.AppState.cart.filter(c => c.id !== dishId);
  saveCart();
  updateCartBadge();
  renderMenuGrid();
  renderCartDrawer();
}

function saveCart() {
  localStorage.setItem('hitahara_cart', JSON.stringify(window.AppState.cart));
}

// Toggle Cart Drawer
function toggleCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('cartDrawerBackdrop');

  if (drawer?.classList.contains('translate-x-full')) {
    drawer.classList.remove('translate-x-full');
    backdrop?.classList.remove('hidden');
    renderCartDrawer();
  } else {
    drawer?.classList.add('translate-x-full');
    backdrop?.classList.add('hidden');
  }

  if (window.lucide) lucide.createIcons();
}

// Render Cart Drawer
function renderCartDrawer() {
  const container = document.getElementById('cartItemsList');
  const subtotalEl = document.getElementById('cartSubtotal');
  const discountEl = document.getElementById('cartDiscount');
  const totalEl = document.getElementById('cartTotal');

  if (!container) return;

  if (window.AppState.cart.length === 0) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
        <div class="w-16 h-16 rounded-3xl bg-zinc-800/80 flex items-center justify-center text-zinc-500">
          <i data-lucide="shopping-cart" class="w-8 h-8"></i>
        </div>
        <h4 class="font-display font-bold text-white text-base">Your Tray is Empty</h4>
        <p class="text-xs text-zinc-400 max-w-xs">Explore delicious burgers, pizzas, and meal bowls from the menu to fill your tray.</p>
      </div>
    `;
    if (subtotalEl) subtotalEl.textContent = '₹0.00';
    if (discountEl) discountEl.textContent = '-₹0.00';
    if (totalEl) totalEl.textContent = '₹0.00';
    if (window.lucide) lucide.createIcons();
    return;
  }

  let subtotal = 0;

  container.innerHTML = window.AppState.cart.map(item => {
    const itemTotal = item.price * item.qty;
    subtotal += itemTotal;

    return `
      <div class="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between space-x-3">
        <img src="${item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80'}" class="w-14 h-14 rounded-xl object-cover" />
        <div class="flex-1 min-w-0">
          <h4 class="text-xs font-semibold text-white truncate">${item.name}</h4>
          <p class="text-[11px] font-mono text-zinc-400">₹${Number(item.price).toFixed(2)} × ${item.qty}</p>
        </div>
        <div class="flex items-center space-x-1.5">
          <button onclick="decrementCartItem(${item.id})" class="w-6 h-6 rounded-md bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center text-xs font-bold">-</button>
          <span class="w-5 text-center font-mono text-xs font-bold text-white">${item.qty}</span>
          <button onclick="addToCart(${item.id})" class="w-6 h-6 rounded-md bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center text-xs font-bold">+</button>
          <button onclick="removeCartItem(${item.id})" class="p-1 text-zinc-500 hover:text-rose-400 ml-1">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  const discount = subtotal * 0.10; // 10% student subsidy
  const finalTotal = subtotal - discount;

  if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
  if (discountEl) discountEl.textContent = `-₹${discount.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `₹${finalTotal.toFixed(2)}`;

  if (window.lucide) lucide.createIcons();
}

// Checkout & Place Order
async function handleCheckoutOrder() {
  if (window.AppState.cart.length === 0) {
    showToast('Tray Empty', 'Please add at least one item before placing your order.', 'error');
    return;
  }

  const studentId = document.getElementById('cartStudentId')?.value.trim() || 'STU-2024-001';
  const studentName = document.getElementById('cartStudentName')?.value.trim() || 'Student';
  const pickupType = document.getElementById('cartPickupType')?.value || 'Dine-In';
  const paymentMethod = document.getElementById('cartPaymentMethod')?.value || 'Campus Card';
  const specialNotes = document.getElementById('cartSpecialNotes')?.value.trim() || 'None';

  const orderPayload = {
    student_id: studentId,
    student_name: studentName,
    pickup_type: pickupType,
    payment_method: paymentMethod,
    special_notes: specialNotes,
    items: window.AppState.cart.map(c => ({
      item_id: c.id,
      name: c.name,
      unit_price: c.price,
      quantity: c.qty
    }))
  };

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });

    const data = await res.json();
    if (data.status === 'ok' || data.order_id) {
      const orderId = data.order_id;
      window.AppState.myOrderIds.push(orderId);
      localStorage.setItem('hitahara_my_orders', JSON.stringify(window.AppState.myOrderIds));

      // Clear cart
      window.AppState.cart = [];
      saveCart();
      updateCartBadge();
      toggleCartDrawer();

      showToast(
        'Order Received! 🍽️',
        `Ticket #${orderId} has been sent to the kitchen.`,
        'success'
      );

      // Refresh system state immediately and open live tracker
      await fetchSystemState();
      openOrderTrackerModal();
    } else {
      showToast('Order Failed', data.message || 'Unable to place order.', 'error');
    }
  } catch (err) {
    console.error('Checkout error:', err);
    showToast('Network Error', 'Could not dispatch order to server.', 'error');
  }
}

// Live Order Status Modal
function openOrderTrackerModal() {
  const modal = document.getElementById('orderTrackerModal');
  const content = document.getElementById('orderTrackerModalContent');
  if (!modal || !content) return;

  modal.classList.remove('hidden');

  const myOrders = window.AppState.orders.filter(o => 
    window.AppState.myOrderIds.includes(o.order_id)
  );

  if (myOrders.length === 0) {
    content.innerHTML = `
      <div class="py-12 text-center space-y-3">
        <div class="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
          <i data-lucide="receipt" class="w-7 h-7"></i>
        </div>
        <h4 class="font-display font-bold text-white">No Active Orders Yet</h4>
        <p class="text-xs text-zinc-400">Place an order from the menu to track its real-time preparation status.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  content.innerHTML = myOrders.map(order => {
    const queuePos = order.queue_position || 1;
    const stages = [
      { key: 'PENDING', label: 'Order Placed', icon: 'clock' },
      { key: 'PREPARING', label: 'Cooking in Kitchen', icon: 'flame' },
      { key: 'READY', label: 'Ready for Pickup', icon: 'bell-ring' },
      { key: 'COLLECTED', label: 'Collected', icon: 'check-circle-2' }
    ];

    const currentStageIndex = stages.findIndex(s => s.key === order.status);

    return `
      <div class="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
        
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2.5">
            <span class="px-2.5 py-1 rounded-xl bg-orange-500/10 text-orange-400 font-mono font-bold text-sm border border-orange-500/20">
              #${order.order_id}
            </span>
            <div>
              <p class="text-xs font-semibold text-white">${order.pickup_type} • ${order.payment_method}</p>
              <p class="text-[10px] text-zinc-400">${order.created_at}</p>
            </div>
          </div>

          <!-- Position in Line Badge -->
          <div class="text-right">
            ${order.status === 'PENDING' || order.status === 'PREPARING' ? `
              <span class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                <span>${queuePos === 1 ? 'Next to be cooked' : `Position in line: #${queuePos}`}</span>
              </span>
            ` : (order.status === 'READY' ? `
              <span class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold animate-bounce">
                <span>🔔 READY AT COUNTER!</span>
              </span>
            ` : `
              <span class="px-2.5 py-0.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs font-medium">Collected</span>
            `)}
          </div>
        </div>

        <!-- 4-Step Visual Progress Stepper -->
        <div class="grid grid-cols-4 gap-2 pt-2">
          ${stages.map((st, i) => {
            const isDone = i <= currentStageIndex;
            const isCurrent = i === currentStageIndex;

            return `
              <div class="flex flex-col items-center text-center space-y-1.5">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
                  ${isCurrent ? 'bg-orange-500 text-white ring-4 ring-orange-500/20 shadow-lg shadow-orange-500/40 scale-110' : 
                    (isDone ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-500')}">
                  <i data-lucide="${st.icon}" class="w-3.5 h-3.5"></i>
                </div>
                <span class="text-[10px] font-medium leading-tight ${isCurrent ? 'text-orange-400 font-bold' : (isDone ? 'text-zinc-300' : 'text-zinc-600')}">
                  ${st.label}
                </span>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Order Items Detail -->
        <div class="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/60 text-xs space-y-1">
          <p class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Dishes in Ticket</p>
          ${(order.items || []).map(it => `
            <div class="flex justify-between text-zinc-300">
              <span>${it.quantity}× ${it.name || it.item_name}</span>
              <span class="font-mono text-zinc-400">₹${Number(it.unit_price * it.quantity).toFixed(2)}</span>
            </div>
          `).join('')}
          <div class="pt-2 mt-1 border-t border-zinc-800 flex justify-between font-bold text-white">
            <span>Total Paid</span>
            <span class="text-orange-400 font-mono">₹${Number(order.total_amount).toFixed(2)}</span>
          </div>
        </div>

      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function closeOrderTrackerModal() {
  document.getElementById('orderTrackerModal')?.classList.add('hidden');
}
