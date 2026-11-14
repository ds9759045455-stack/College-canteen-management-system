/**
 * CAMPUSBITE - STUDENT PORTAL LOGIC
 * Dynamic menu filtering, food cards, cart drawer, direct pricing, and live cancellation.
 * Features Zomato Red & Charcoal Black theme, Dish Tap feedback, and Flying-to-Tray animation!
 */

// Category Filtering with Smooth Horizontal Scroll Center
function filterCategory(cat, event) {
  window.AppState.activeCategory = cat;

  const buttons = document.querySelectorAll('.cat-pill');
  buttons.forEach(btn => {
    if (btn.textContent.trim().includes(cat)) {
      btn.classList.add('active');
      btn.classList.remove('text-slate-400');
      // Smooth scroll category into view
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    } else {
      btn.classList.remove('active');
      btn.classList.add('text-slate-400');
    }
  });

  renderMenuGrid();
}

// Search Input Handler
function handleMenuSearch() {
  const input = document.getElementById('menuSearchInput');
  window.AppState.searchQuery = (input?.value || '').toLowerCase().trim();
  renderMenuGrid();
}

// Render Menu Cards in Grid with Staggered Entrance & Zomato Red + Charcoal Theme
function renderMenuGrid() {
  const container = document.getElementById('foodGrid');
  if (!container) return;

  let items = window.AppState.menu || [];

  // Filter Category
  if (window.AppState.activeCategory !== 'All') {
    items = items.filter(item => item.category === window.AppState.activeCategory);
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
        <div class="w-16 h-16 rounded-3xl bg-[#14181f] border border-[#e23744]/25 flex items-center justify-center mx-auto text-slate-500">
          <i data-lucide="search-x" class="w-8 h-8 text-[#e23744]/70"></i>
        </div>
        <h3 class="font-display text-lg font-bold text-slate-200">No pure veg dishes match your search</h3>
        <p class="text-xs text-slate-400">Try choosing another category or clearing your search term.</p>
        <button onclick="filterCategory('All')" class="px-4 py-2 text-xs font-semibold rounded-xl bg-[#e23744]/20 text-[#ff5263] border border-[#e23744]/40 hover:bg-[#e23744]/30 transition">
          Show All Dishes
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = items.map((dish, idx) => {
    const inCart = window.AppState.cart.find(c => c.id === dish.id);
    const cartQty = inCart ? inCart.qty : 0;
    const isOutOfStock = dish.stock_qty <= 0;
    const animDelay = Math.min(idx * 0.03, 0.45);

    return `
      <div id="dish-card-${dish.id}" 
           class="food-card flex flex-col justify-between overflow-hidden shadow-xl"
           style="animation: dishEntrance 0.35s cubic-bezier(0.16, 1, 0.3, 1) ${animDelay}s both;">
        
        <!-- Food Photography Wrapper -->
        <div class="relative h-48 w-full overflow-hidden bg-[#0a0d10] food-img-wrapper cursor-pointer" onclick="handleCardTap(${dish.id}, event)">
          <img id="dish-img-${dish.id}"
               src="${dish.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'}" 
               alt="${dish.name}" 
               loading="lazy"
               class="w-full h-full object-cover transition-transform duration-500" 
               onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'" />
          
          <div class="absolute inset-0 bg-gradient-to-t from-[#14181f] via-transparent to-black/35"></div>

          <!-- Pure Veg Badge (Iconic Green Dot inside Square) -->
          <div class="absolute top-3 left-3 flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-black/75 backdrop-blur-md border border-emerald-500/40 shadow-md">
            <span class="pure-veg-indicator">
              <span class="pure-veg-indicator-dot"></span>
            </span>
            <span class="text-[11px] font-bold text-emerald-300 tracking-wide">
              Pure Veg
            </span>
          </div>

          <!-- Prep Time Badge -->
          <div class="absolute top-3 right-3 flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-black/70 backdrop-blur-md text-[11px] font-medium text-slate-300 border border-white/10">
            <i data-lucide="clock" class="w-3 h-3 text-amber-400"></i>
            <span>${dish.prep_time_min} mins</span>
          </div>

          <!-- Stock Pill -->
          <div class="absolute bottom-3 left-3">
            ${isOutOfStock 
              ? `<span class="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wider">Sold Out</span>`
              : (dish.stock_qty <= 5 
                  ? `<span class="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">Only ${dish.stock_qty} left</span>`
                  : `<span class="px-2 py-0.5 rounded-lg bg-[#0b0e11]/80 backdrop-blur-md text-slate-300 text-[10px] font-medium border border-white/10">Available: ${dish.stock_qty}</span>`
                )
            }
          </div>
        </div>

        <!-- Card Body Content -->
        <div class="p-5 flex-1 flex flex-col justify-between space-y-3">
          <div>
            <div class="text-[11px] font-semibold text-[#ff5263] uppercase tracking-wider mb-1">
              <span>${dish.category}</span>
            </div>
            <h3 class="font-display font-bold text-base text-white hover:text-[#ff5263] transition-colors line-clamp-1 cursor-pointer" onclick="handleCardTap(${dish.id}, event)">
              ${dish.name}
            </h3>
            <p class="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
              ${dish.description || 'Freshly prepared pure vegetarian campus specialty.'}
            </p>
          </div>

          <!-- Price & Add Action -->
          <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between">
            <div>
              <span class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Price</span>
              <p class="font-display font-extrabold text-xl text-white">
                ₹${Number(dish.price).toFixed(2)}
              </p>
            </div>

            <!-- Add or Stepper Button with Micro-Interaction -->
            <div>
              ${isOutOfStock ? `
                <button disabled class="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-500 text-xs font-semibold cursor-not-allowed">
                  Sold Out
                </button>
              ` : (cartQty > 0 ? `
                <div class="flex items-center space-x-1.5 bg-[#101418] border border-[#e23744]/40 rounded-xl p-1 shadow-inner">
                  <button onclick="decrementCartItem(${dish.id}, event)" class="stepper-btn w-7 h-7 rounded-lg text-white flex items-center justify-center font-bold text-xs">
                    -
                  </button>
                  <span class="font-mono font-bold text-sm text-[#ff5263] px-2">${cartQty}</span>
                  <button onclick="addToCart(${dish.id}, event)" class="stepper-btn w-7 h-7 rounded-lg text-white flex items-center justify-center font-bold text-xs" ${cartQty >= dish.stock_qty ? 'disabled class="opacity-40"' : ''}>
                    +
                  </button>
                </div>
              ` : `
                <button onclick="addToCart(${dish.id}, event)" class="add-btn-action flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-md cursor-pointer">
                  <i data-lucide="plus" class="w-3.5 h-3.5 text-[#ff5263]"></i>
                  <span>ADD</span>
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

// Card Tap Feedback Handler
function handleCardTap(dishId, event) {
  const card = document.getElementById(`dish-card-${dishId}`);
  if (card) {
    card.classList.remove('dish-tap-flash');
    void card.offsetWidth; // trigger reflow
    card.classList.add('dish-tap-flash');
  }
}

// ================= FLY TO TRAY ANIMATION =================
function triggerFlyToTrayAnimation(sourceEl, dish) {
  try {
    const targetEl = document.getElementById('cartCountBadge') || document.getElementById('headerCartBtn');
    if (!targetEl) return;

    // Determine start rect: sourceEl, card image, or card
    let startRect = null;
    if (sourceEl && sourceEl.getBoundingClientRect) {
      startRect = sourceEl.getBoundingClientRect();
    } else {
      const img = document.getElementById(`dish-img-${dish.id}`);
      if (img) startRect = img.getBoundingClientRect();
    }

    if (!startRect) return;

    const targetRect = targetEl.getBoundingClientRect();

    // Start coordinates (center of source)
    const startX = startRect.left + startRect.width / 2 - 28;
    const startY = startRect.top + startRect.height / 2 - 28;

    // End coordinates (center of Tray)
    const endX = targetRect.left + targetRect.width / 2 - 28;
    const endY = targetRect.top + targetRect.height / 2 - 28;

    // Create flying clone ball
    const flyer = document.createElement('div');
    flyer.className = 'flying-dish-ball';
    flyer.style.left = `${startX}px`;
    flyer.style.top = `${startY}px`;
    flyer.style.transform = 'scale(0.8) translateZ(0)';
    flyer.style.opacity = '1';

    flyer.innerHTML = `
      <img src="${dish.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80'}" alt="${dish.name}" />
      <span class="flying-plus-tag">+1</span>
    `;

    document.body.appendChild(flyer);

    // Midpoint control for curved parabola arc
    const midX = (startX + endX) / 2;
    const arcHeight = Math.min(Math.abs(startX - endX) * 0.35, 140);
    const midY = Math.min(startY, endY) - arcHeight;

    // Launch flight in next animation frame
    requestAnimationFrame(() => {
      // Step 1: Arc via CSS transform
      flyer.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(0.28) rotate(360deg)`;
      flyer.style.opacity = '0.75';
    });

    // Cleanup and trigger Tray button bounce upon impact
    setTimeout(() => {
      if (flyer && flyer.parentNode) {
        flyer.parentNode.removeChild(flyer);
      }

      // Bounce Tray Button & Badge
      const cartBtn = document.getElementById('headerCartBtn');
      const cartBadge = document.getElementById('cartCountBadge');

      if (cartBtn) {
        cartBtn.classList.remove('tray-bounce-anim');
        void cartBtn.offsetWidth;
        cartBtn.classList.add('tray-bounce-anim');
      }

      if (cartBadge) {
        cartBadge.classList.remove('badge-bounce-anim');
        void cartBadge.offsetWidth;
        cartBadge.classList.add('badge-bounce-anim');
      }

      // Clean bounce classes after animation finishes
      setTimeout(() => {
        cartBtn?.classList.remove('tray-bounce-anim');
        cartBadge?.classList.remove('badge-bounce-anim');
      }, 550);

    }, 700);

  } catch (err) {
    console.warn('Fly-to-tray animation error:', err);
  }
}

// Add Item to Cart with Animation
function addToCart(dishId, event) {
  if (event) {
    event.stopPropagation();
  }

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
      is_veg: true,
      isNew: true
    });
  }

  // Trigger Flying Dish into Tray Animation
  const clickedTarget = event ? (event.currentTarget || event.target) : document.getElementById(`dish-card-${dishId}`);
  triggerFlyToTrayAnimation(clickedTarget, dish);
  handleCardTap(dishId, event);

  saveCart();
  updateCartBadge();
  renderMenuGrid();
  renderCartDrawer();
  showToast('Placed in Tray 🍛', `${dish.name} added to your tray!`, 'success');
}

// Decrement Item in Cart
function decrementCartItem(dishId, event) {
  if (event) event.stopPropagation();

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
  localStorage.setItem('campusbite_cart', JSON.stringify(window.AppState.cart));
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

// Render Cart Drawer (Direct pricing - No subsidy) with Zomato Red + Charcoal Theme
function renderCartDrawer() {
  const container = document.getElementById('cartItemsList');
  const totalEl = document.getElementById('cartTotal');

  if (!container) return;

  if (window.AppState.cart.length === 0) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
        <div class="w-16 h-16 rounded-3xl bg-[#161a20] border border-[#e23744]/25 flex items-center justify-center text-slate-500">
          <i data-lucide="shopping-bag" class="w-8 h-8 text-[#e23744]/60"></i>
        </div>
        <h4 class="font-display font-bold text-white text-base">Your Food Tray is Empty</h4>
        <p class="text-xs text-slate-400 max-w-xs">Select from our 18 delicious pure veg specialties to place dishes in your tray.</p>
      </div>
    `;
    if (totalEl) totalEl.textContent = '₹0.00';
    if (window.lucide) lucide.createIcons();
    return;
  }

  let total = 0;

  container.innerHTML = window.AppState.cart.map(item => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;

    return `
      <div class="tray-item-enter p-3.5 rounded-2xl bg-[#14181f] border border-slate-800 hover:border-[#e23744]/40 flex items-center justify-between space-x-3 transition">
        <img src="${item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80'}" class="w-14 h-14 rounded-xl object-cover border border-white/5" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center space-x-1.5">
            <span class="pure-veg-indicator">
              <span class="pure-veg-indicator-dot"></span>
            </span>
            <h4 class="text-xs font-semibold text-white truncate">${item.name}</h4>
          </div>
          <p class="text-[11px] font-mono text-[#ff5263] mt-0.5">₹${Number(item.price).toFixed(2)} × ${item.qty}</p>
        </div>
        <div class="flex items-center space-x-1.5">
          <button onclick="decrementCartItem(${item.id}, event)" class="w-6 h-6 rounded-md bg-[#1f2630] hover:bg-[#e23744] text-white flex items-center justify-center text-xs font-bold transition">-</button>
          <span class="w-5 text-center font-mono text-xs font-bold text-white">${item.qty}</span>
          <button onclick="addToCart(${item.id}, event)" class="w-6 h-6 rounded-md bg-[#1f2630] hover:bg-[#e23744] text-white flex items-center justify-center text-xs font-bold transition">+</button>
          <button onclick="removeCartItem(${item.id})" class="p-1 text-slate-500 hover:text-rose-400 ml-1 transition">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (totalEl) totalEl.textContent = `₹${total.toFixed(2)}`;
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
      localStorage.setItem('campusbite_my_orders', JSON.stringify(window.AppState.myOrderIds));

      window.AppState.cart = [];
      saveCart();
      updateCartBadge();
      toggleCartDrawer();

      showToast(
        'Order Received! 🍽️',
        `Ticket #${orderId} sent to kitchen. Track live below!`,
        'success'
      );

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

// Live Order Status Modal with Cancellation Integration
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
        <div class="w-14 h-14 rounded-2xl bg-[#14181f] border border-[#e23744]/25 flex items-center justify-center mx-auto text-slate-500">
          <i data-lucide="receipt" class="w-7 h-7 text-[#e23744]/60"></i>
        </div>
        <h4 class="font-display font-bold text-white">No Active Orders Yet</h4>
        <p class="text-xs text-slate-400">Place an order from the menu to track its real-time preparation status.</p>
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
    const isCancelled = (order.status === 'CANCELLED');

    return `
      <div class="p-5 rounded-2xl bg-[#0b0e11] border ${isCancelled ? 'border-rose-500/40' : 'border-slate-800 hover:border-[#e23744]/40'} space-y-4">
        
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2.5">
            <span class="px-2.5 py-1 rounded-xl bg-[#e23744]/15 text-[#ff5263] font-mono font-bold text-sm border border-[#e23744]/30">
              #${order.order_id}
            </span>
            <div>
              <p class="text-xs font-semibold text-white">${order.pickup_type} • ${order.payment_method}</p>
              <p class="text-[10px] text-slate-400">${order.created_at}</p>
            </div>
          </div>

          <!-- Position in Line or Cancelled Badge -->
          <div class="text-right">
            ${isCancelled ? `
              <span class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold">
                <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
                <span>Order Cancelled</span>
              </span>
            ` : (order.status === 'PENDING' || order.status === 'PREPARING' ? `
              <span class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                <span>${queuePos === 1 ? 'Next to be cooked' : `Position in line: #${queuePos}`}</span>
              </span>
            ` : (order.status === 'READY' ? `
              <span class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold animate-bounce">
                <span>🔔 READY AT COUNTER!</span>
              </span>
            ` : `
              <span class="px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-400 text-xs font-medium">Collected</span>
            `))}
          </div>
        </div>

        <!-- 4-Step Visual Progress Stepper (if not cancelled) -->
        ${!isCancelled ? `
          <div class="grid grid-cols-4 gap-2 pt-2">
            ${stages.map((st, i) => {
              const isDone = i <= currentStageIndex;
              const isCurrent = i === currentStageIndex;

              return `
                <div class="flex flex-col items-center text-center space-y-1.5">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
                    ${isCurrent ? 'bg-[#e23744] text-white ring-4 ring-[#e23744]/25 shadow-lg shadow-red-950/50 scale-110' : 
                      (isDone ? 'bg-[#cb202d] text-white' : 'bg-[#181d22] text-slate-500')}">
                    <i data-lucide="${st.icon}" class="w-3.5 h-3.5"></i>
                  </div>
                  <span class="text-[10px] font-medium leading-tight ${isCurrent ? 'text-[#ff5263] font-bold' : (isDone ? 'text-slate-300' : 'text-slate-500')}">
                    ${st.label}
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <!-- Cancellation Breakdown Alert -->
          <div class="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs space-y-2">
            <p class="font-bold text-rose-300 flex items-center space-x-1.5">
              <i data-lucide="info" class="w-4 h-4"></i>
              <span>${order.cancel_reason || 'Order was cancelled'}</span>
            </p>
            <div class="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px] border-t border-rose-900/40">
              <div>
                <span class="text-slate-400 block text-[10px]">Total Paid</span>
                <span class="text-white font-bold">₹${Number(order.total_amount).toFixed(2)}</span>
              </div>
              <div>
                <span class="text-rose-400 block text-[10px]">Management Fee</span>
                <span class="text-rose-300 font-bold">-₹${Number(order.penalty_deduction || 0).toFixed(2)}</span>
              </div>
              <div>
                <span class="text-emerald-400 block text-[10px]">Refund Processed</span>
                <span class="text-emerald-300 font-bold">₹${Number(order.refund_amount || order.total_amount).toFixed(2)}</span>
              </div>
            </div>
          </div>
        `}

        <!-- Order Items Detail -->
        <div class="p-3 rounded-xl bg-[#14181f] border border-slate-800 text-xs space-y-1">
          <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Dishes in Ticket</p>
          ${(order.items || []).map(it => `
            <div class="flex justify-between text-slate-300">
              <span>${it.quantity}× ${it.name || it.item_name}</span>
              <span class="font-mono text-slate-400">₹${Number(it.unit_price * it.quantity).toFixed(2)}</span>
            </div>
          `).join('')}
          <div class="pt-2 mt-1 border-t border-slate-800 flex justify-between font-bold text-white">
            <span>Total</span>
            <span class="text-[#ff5263] font-mono">₹${Number(order.total_amount).toFixed(2)}</span>
          </div>
        </div>

        <!-- Cancellation Action Button (Active while pending or preparing) -->
        ${(order.status === 'PENDING' || order.status === 'PREPARING') ? `
          <div class="pt-1 flex items-center justify-between">
            <span class="text-[11px] text-slate-400">
              ${order.status === 'PENDING' ? '💡 Full 100% refund available' : '⚠️ 35% fee applies (cooking in progress)'}
            </span>
            <button onclick="promptCancelOrder(${order.order_id})" class="px-3.5 py-1.5 rounded-xl ${order.status === 'PENDING' ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40'} text-xs font-semibold transition flex items-center space-x-1.5 shadow-sm">
              <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
              <span>Cancel Order</span>
            </button>
          </div>
        ` : ''}

      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function closeOrderTrackerModal() {
  document.getElementById('orderTrackerModal')?.classList.add('hidden');
}
