/**
 * CAMPUSBITE - CORE APPLICATION CONTROLLER
 * State management, view navigation, PIN security gate, order cancellation, and scroll effects.
 */

// Global Application State
window.AppState = {
  currentView: 'student',
  staffSubTab: 'queue',
  activeCategory: 'All',
  searchQuery: '',
  menu: [],
  orders: [],
  actions: [],
  rawMaterials: [],
  cart: [],
  myOrderIds: JSON.parse(localStorage.getItem('campusbite_my_orders') || '[]'),
  staffAuthenticated: sessionStorage.getItem('campusbite_staff_auth') === 'true',
  staffPin: '1234',
  pendingCancelOrderId: null,
  pollingInterval: null
};

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  // Load saved cart from localStorage
  try {
    const savedCart = localStorage.getItem('campusbite_cart');
    if (savedCart) {
      window.AppState.cart = JSON.parse(savedCart);
      updateCartBadge();
    }
  } catch (e) {
    console.error('Failed to load cart', e);
  }

  // Initial Fetch of System State
  fetchSystemState();

  // Poll system state every 2.5 seconds
  window.AppState.pollingInterval = setInterval(fetchSystemState, 2500);

  // Bind Enter key on PIN input
  const pinInput = document.getElementById('staffPinInput');
  if (pinInput) {
    pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitStaffPin();
    });
  }

  // Header Scroll Shadow & Glow listener
  window.addEventListener('scroll', () => {
    const header = document.getElementById('mainHeader');
    if (window.scrollY > 20) {
      header?.classList.add('header-scrolled');
    } else {
      header?.classList.remove('header-scrolled');
    }
  });

  updateStaffLockIcon();
});

/**
 * Fetch full state from server
 */
async function fetchSystemState() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();

    window.AppState.menu = data.menu || [];
    window.AppState.orders = data.orders || [];
    window.AppState.actions = data.actions || [];
    window.AppState.rawMaterials = data.raw_materials || [];

    // Update Student View Menu Cards if not actively typing
    const searchInput = document.getElementById('menuSearchInput');
    const isTyping = (document.activeElement === searchInput);
    if (typeof renderMenuGrid === 'function' && !isTyping) {
      renderMenuGrid();
    }

    // Update Staff Portal KPI metrics & Queue
    if (typeof renderStaffDashboard === 'function') {
      renderStaffDashboard();
    }

    // Update Live Tracker badge
    updateOrderTrackerBadge();

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.warn('API sync warning:', err.message);
  }
}

/**
 * Switch top-level views: 'student' | 'staff'
 */
function switchView(viewName) {
  if (viewName === 'staff' && !window.AppState.staffAuthenticated) {
    requestStaffAccess();
    return;
  }

  window.AppState.currentView = viewName;

  const views = {
    student: document.getElementById('viewStudent'),
    staff: document.getElementById('viewStaff')
  };

  const navBtns = {
    student: document.getElementById('navStudentBtn'),
    staff: document.getElementById('navStaffBtn')
  };

  if (viewName === 'student') {
    views.student?.classList.remove('hidden');
    views.staff?.classList.add('hidden');

    navBtns.student?.classList.add('active-tab');
    navBtns.staff?.classList.remove('active-tab');

    if (typeof renderMenuGrid === 'function') renderMenuGrid();
  } else {
    views.student?.classList.add('hidden');
    views.staff?.classList.remove('hidden');

    navBtns.staff?.classList.add('active-tab');
    navBtns.student?.classList.remove('active-tab');

    if (typeof renderStaffDashboard === 'function') renderStaffDashboard();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (window.lucide) lucide.createIcons();
}

/**
 * Request Staff Portal Access (Opens PIN modal)
 */
function requestStaffAccess() {
  if (window.AppState.staffAuthenticated) {
    switchView('staff');
  } else {
    openStaffPinModal();
  }
}

/**
 * PIN Modal Interactions
 */
function openStaffPinModal() {
  const modal = document.getElementById('staffPinModal');
  const input = document.getElementById('staffPinInput');
  const err = document.getElementById('pinErrorMessage');

  if (modal) modal.classList.remove('hidden');
  if (err) err.classList.add('hidden');
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 50);
  }
  if (window.lucide) lucide.createIcons();
}

function closeStaffPinModal() {
  const modal = document.getElementById('staffPinModal');
  if (modal) modal.classList.add('hidden');
}

function pressPinDigit(digit) {
  const input = document.getElementById('staffPinInput');
  if (!input) return;
  if (input.value.length < 4) {
    input.value += digit;
  }
  if (input.value.length === 4) {
    setTimeout(submitStaffPin, 120);
  }
}

function deletePinDigit() {
  const input = document.getElementById('staffPinInput');
  if (!input) return;
  input.value = input.value.slice(0, -1);
}

function clearPinInput() {
  const input = document.getElementById('staffPinInput');
  if (input) input.value = '';
}

function submitStaffPin() {
  const input = document.getElementById('staffPinInput');
  const err = document.getElementById('pinErrorMessage');
  const card = document.getElementById('staffPinCard');

  if (!input) return;

  if (input.value === window.AppState.staffPin) {
    window.AppState.staffAuthenticated = true;
    sessionStorage.setItem('campusbite_staff_auth', 'true');
    updateStaffLockIcon();
    closeStaffPinModal();
    switchView('staff');
    showToast('Access Granted', 'Welcome to Campusbite Kitchen Management.', 'success');
  } else {
    if (err) err.classList.remove('hidden');
    if (card) {
      card.classList.remove('animate-shake');
      void card.offsetWidth;
      card.classList.add('animate-shake');
    }
    input.value = '';
  }
}

function lockStaffPortal() {
  window.AppState.staffAuthenticated = false;
  sessionStorage.removeItem('campusbite_staff_auth');
  updateStaffLockIcon();
  switchView('student');
  showToast('Portal Locked', 'Staff session has been safely locked.', 'info');
}

function updateStaffLockIcon() {
  const lockIcon = document.getElementById('staffTabLockIcon');
  if (!lockIcon) return;
  if (window.AppState.staffAuthenticated) {
    lockIcon.setAttribute('data-lucide', 'unlock');
    lockIcon.classList.remove('text-[#e23744]/80');
    lockIcon.classList.add('text-emerald-400');
  } else {
    lockIcon.setAttribute('data-lucide', 'lock');
    lockIcon.classList.remove('text-emerald-400');
    lockIcon.classList.add('text-[#e23744]/80');
  }
  if (window.lucide) lucide.createIcons();
}

/**
 * Order Cancellation Flow
 */
function promptCancelOrder(orderId) {
  const order = window.AppState.orders.find(o => o.order_id === orderId);
  if (!order) return;

  if (order.status === 'READY' || order.status === 'COLLECTED') {
    showToast('Cannot Cancel', 'Order is already ready or collected.', 'error');
    return;
  }

  window.AppState.pendingCancelOrderId = orderId;

  const modal = document.getElementById('cancelOrderModal');
  const idSpan = document.getElementById('cancelModalOrderId');
  const policyContent = document.getElementById('cancelModalPolicyContent');

  if (idSpan) idSpan.textContent = orderId;

  const total = Number(order.total_amount);

  if (policyContent) {
    if (order.status === 'PREPARING') {
      const penalty = total * 0.35;
      const refund = total - penalty;
      policyContent.innerHTML = `
        <div class="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200">
          <p class="font-bold flex items-center space-x-1.5 text-amber-300">
            <i data-lucide="flame" class="w-4 h-4"></i>
            <span>Kitchen has already started cooking!</span>
          </p>
          <p class="mt-1 leading-relaxed text-[11px] text-amber-200/90">
            Since ingredients have already been prepped and heated, a <b>35% management charge</b> is deducted for food wastage.
          </p>
        </div>
        <div class="space-y-1.5 pt-1 text-slate-300">
          <div class="flex justify-between">
            <span>Order Total:</span>
            <span class="font-mono font-bold text-white">₹${total.toFixed(2)}</span>
          </div>
          <div class="flex justify-between text-rose-400 font-semibold">
            <span>Management Prep Deduction (35%):</span>
            <span class="font-mono">-₹${penalty.toFixed(2)}</span>
          </div>
          <div class="flex justify-between text-emerald-400 font-bold pt-2 border-t border-slate-800 text-sm">
            <span>Net Refund to You (65%):</span>
            <span class="font-mono">₹${refund.toFixed(2)}</span>
          </div>
        </div>
      `;
    } else {
      policyContent.innerHTML = `
        <div class="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200">
          <p class="font-bold flex items-center space-x-1.5 text-emerald-300">
            <i data-lucide="check-circle" class="w-4 h-4"></i>
            <span>Kitchen has NOT started cooking yet!</span>
          </p>
          <p class="mt-1 leading-relaxed text-[11px] text-emerald-200/90">
            Your ticket is still pending in line. You will receive a <b>100% full refund with 0% deduction</b>.
          </p>
        </div>
        <div class="space-y-1.5 pt-1 text-slate-300">
          <div class="flex justify-between">
            <span>Order Total:</span>
            <span class="font-mono font-bold text-white">₹${total.toFixed(2)}</span>
          </div>
          <div class="flex justify-between text-emerald-400">
            <span>Management Penalty (0%):</span>
            <span class="font-mono">₹0.00</span>
          </div>
          <div class="flex justify-between text-emerald-400 font-bold pt-2 border-t border-slate-800 text-sm">
            <span>Total Refund to You (100%):</span>
            <span class="font-mono">₹${refund.toFixed(2)}</span>
          </div>
        </div>
      `;
    }
  }

  modal?.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeCancelOrderModal() {
  document.getElementById('cancelOrderModal')?.classList.add('hidden');
  window.AppState.pendingCancelOrderId = null;
}

async function confirmOrderCancellation() {
  const orderId = window.AppState.pendingCancelOrderId;
  if (!orderId) return;

  try {
    const res = await fetch(`/api/orders/${orderId}/cancel`, { method: 'POST' });
    const data = await res.json();

    closeCancelOrderModal();

    if (data.status === 'ok') {
      showToast('Order Cancelled 🚫', data.message, data.penalty > 0 ? 'warning' : 'success');
      await fetchSystemState();
      // re-render tracker
      if (typeof openOrderTrackerModal === 'function') {
        openOrderTrackerModal();
      }
    } else {
      showToast('Cancellation Failed', data.message || 'Unable to cancel order.', 'error');
    }
  } catch (err) {
    console.error('Cancellation error:', err);
    showToast('Network Error', 'Failed to communicate with canteen server.', 'error');
  }
}

/**
 * Toast Notification System (Charcoal Black & Red/Emerald Accents)
 */
function showToast(title, message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'pointer-events-auto p-4 rounded-2xl bg-[#14181f] border shadow-2xl flex items-start space-x-3 max-w-sm transform translate-y-4 opacity-0 transition-all duration-300';

  let iconName = 'info';
  let iconColor = 'text-[#ff5263]';
  let borderColor = 'border-[#e23744]/40';

  if (type === 'success') {
    iconName = 'check-circle-2';
    iconColor = 'text-emerald-400';
    borderColor = 'border-emerald-500/50';
  } else if (type === 'warning' || type === 'undo') {
    iconName = 'rotate-ccw';
    iconColor = 'text-amber-400';
    borderColor = 'border-amber-500/50';
  } else if (type === 'error') {
    iconName = 'alert-triangle';
    iconColor = 'text-rose-400';
    borderColor = 'border-rose-500/50';
  }

  toast.classList.add(borderColor);

  toast.innerHTML = `
    <div class="p-1 rounded-lg ${iconColor} bg-[#1f2630]">
      <i data-lucide="${iconName}" class="w-5 h-5"></i>
    </div>
    <div class="flex-1">
      <h4 class="text-sm font-semibold text-white">${title}</h4>
      <p class="text-xs text-slate-300 mt-0.5 leading-snug">${message}</p>
    </div>
    <button onclick="this.parentElement.remove()" class="text-slate-500 hover:text-white">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

/**
 * Update Cart Badge counter
 */
function updateCartBadge() {
  const badge = document.getElementById('cartCountBadge');
  const count = window.AppState.cart.reduce((sum, item) => sum + item.qty, 0);
  if (badge) badge.textContent = count;
}

/**
 * Update tracker dot on top nav
 */
function updateOrderTrackerBadge() {
  const dot = document.getElementById('trackerDot');
  const staffBadge = document.getElementById('staffQueueBadge');
  const activeOrders = window.AppState.orders.filter(o => o.status !== 'COLLECTED' && o.status !== 'CANCELLED');

  if (staffBadge) {
    staffBadge.textContent = activeOrders.length;
    if (activeOrders.length > 0) {
      staffBadge.classList.remove('hidden');
    } else {
      staffBadge.classList.add('hidden');
    }
  }

  const myActiveOrders = activeOrders.filter(o => window.AppState.myOrderIds.includes(o.order_id));
  if (dot) {
    if (myActiveOrders.length > 0) {
      dot.classList.remove('hidden');
    } else {
      dot.classList.add('hidden');
    }
  }
}
