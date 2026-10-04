/**
 * HITAHARA CANTEEN - CORE APPLICATION CONTROLLER
 * State management, view navigation, PIN security gate, and notifications.
 */

// Global Application State
window.AppState = {
  currentView: 'student',
  staffSubTab: 'queue',
  activeCategory: 'All',
  isVegOnly: false,
  searchQuery: '',
  menu: [],
  orders: [],
  actions: [],
  cart: [],
  myOrderIds: JSON.parse(localStorage.getItem('hitahara_my_orders') || '[]'),
  staffAuthenticated: sessionStorage.getItem('hitahara_staff_auth') === 'true',
  staffPin: '1234',
  pollingInterval: null
};

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) lucide.createIcons();

  // Load saved cart from localStorage
  try {
    const savedCart = localStorage.getItem('hitahara_cart');
    if (savedCart) {
      window.AppState.cart = JSON.parse(savedCart);
      updateCartBadge();
    }
  } catch (e) {
    console.error('Failed to load cart', e);
  }

  // Initial Fetch of System State
  fetchSystemState();

  // Poll system state every 2.5 seconds for real-time kitchen updates
  window.AppState.pollingInterval = setInterval(fetchSystemState, 2500);

  // Bind Enter key on PIN input
  const pinInput = document.getElementById('staffPinInput');
  if (pinInput) {
    pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitStaffPin();
    });
  }

  // Update staff lock icon state
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

    // Update Student View Menu Cards
    if (typeof renderMenuGrid === 'function') {
      renderMenuGrid();
    }

    // Update Staff Portal KPI metrics & Queue
    if (typeof renderStaffDashboard === 'function') {
      renderStaffDashboard();
    }

    // Update Live Tracker badge
    updateOrderTrackerBadge();

    // Re-render Lucide icons
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

  const buttons = {
    student: document.getElementById('navStudentBtn'),
    staff: document.getElementById('navStaffBtn')
  };

  // Toggle views
  Object.keys(views).forEach(key => {
    if (views[key]) {
      if (key === viewName) {
        views[key].classList.remove('hidden');
      } else {
        views[key].classList.add('hidden');
      }
    }
  });

  // Toggle button styles
  Object.keys(buttons).forEach(key => {
    if (buttons[key]) {
      if (key === viewName) {
        buttons[key].classList.add('active-tab', 'text-orange-500');
        buttons[key].classList.remove('text-zinc-400');
      } else {
        buttons[key].classList.remove('active-tab', 'text-orange-500');
        buttons[key].classList.add('text-zinc-400');
      }
    }
  });

  if (viewName === 'staff' && typeof renderStaffDashboard === 'function') {
    renderStaffDashboard();
  } else if (viewName === 'student' && typeof renderMenuGrid === 'function') {
    renderMenuGrid();
  }

  if (window.lucide) lucide.createIcons();
}

/**
 * Staff PIN Security Modal Handlers
 */
function requestStaffAccess() {
  if (window.AppState.staffAuthenticated) {
    switchView('staff');
    return;
  }

  const modal = document.getElementById('staffPinModal');
  const input = document.getElementById('staffPinInput');
  const errorMsg = document.getElementById('pinErrorMessage');

  if (errorMsg) errorMsg.classList.add('hidden');
  if (input) input.value = '';
  modal?.classList.remove('hidden');
  setTimeout(() => input?.focus(), 100);
}

function closeStaffPinModal() {
  const modal = document.getElementById('staffPinModal');
  modal?.classList.add('hidden');
}

function pressPinDigit(digit) {
  const input = document.getElementById('staffPinInput');
  if (!input) return;
  if (input.value.length < 4) {
    input.value += digit;
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
  const errorMsg = document.getElementById('pinErrorMessage');
  const card = document.getElementById('staffPinCard');
  const enteredPin = input?.value.trim();

  if (enteredPin === window.AppState.staffPin) {
    window.AppState.staffAuthenticated = true;
    sessionStorage.setItem('hitahara_staff_auth', 'true');
    closeStaffPinModal();
    updateStaffLockIcon();
    showToast('Access Granted', 'Welcome to Hitahara Staff Portal.', 'success');
    switchView('staff');
  } else {
    if (errorMsg) errorMsg.classList.remove('hidden');
    card?.classList.add('animate-shake');
    setTimeout(() => card?.classList.remove('animate-shake'), 400);
    if (input) input.value = '';
  }
}

function lockStaffPortal() {
  window.AppState.staffAuthenticated = false;
  sessionStorage.removeItem('hitahara_staff_auth');
  updateStaffLockIcon();
  showToast('Portal Locked', 'Staff portal has been securely locked.', 'info');
  switchView('student');
}

function updateStaffLockIcon() {
  const lockIcon = document.getElementById('staffTabLockIcon');
  if (lockIcon) {
    if (window.AppState.staffAuthenticated) {
      lockIcon.setAttribute('data-lucide', 'unlock');
      lockIcon.className = 'w-4 h-4 text-emerald-400';
    } else {
      lockIcon.setAttribute('data-lucide', 'lock');
      lockIcon.className = 'w-4 h-4 text-zinc-500';
    }
    if (window.lucide) lucide.createIcons();
  }
}

/**
 * Switch staff subtab: 'queue' (Live Orders) | 'inventory' (Menu & Stock)
 */
function switchStaffSubTab(tabName) {
  window.AppState.staffSubTab = tabName;

  const queueSection = document.getElementById('staffSectionQueue');
  const invSection = document.getElementById('staffSectionInventory');
  const queueBtn = document.getElementById('staffSubTabQueue');
  const invBtn = document.getElementById('staffSubTabInv');

  if (tabName === 'queue') {
    queueSection?.classList.remove('hidden');
    invSection?.classList.add('hidden');
    queueBtn?.classList.add('active');
    invBtn?.classList.remove('active');
  } else {
    queueSection?.classList.add('hidden');
    invSection?.classList.remove('hidden');
    queueBtn?.classList.remove('active');
    invBtn?.classList.add('active');
    if (typeof renderInventoryTable === 'function') renderInventoryTable();
  }

  if (window.lucide) lucide.createIcons();
}

/**
 * Toast Notification System
 */
function showToast(title, message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'pointer-events-auto p-4 rounded-2xl bg-zinc-900 border border-zinc-700/80 shadow-2xl flex items-start space-x-3 max-w-sm transform translate-y-4 opacity-0 transition-all duration-300';

  let iconName = 'info';
  let iconColor = 'text-blue-400';
  let borderColor = 'border-zinc-700';

  if (type === 'success') {
    iconName = 'check-circle-2';
    iconColor = 'text-emerald-400';
    borderColor = 'border-emerald-500/40';
  } else if (type === 'warning' || type === 'undo') {
    iconName = 'rotate-ccw';
    iconColor = 'text-amber-400';
    borderColor = 'border-amber-500/40';
  } else if (type === 'error') {
    iconName = 'alert-triangle';
    iconColor = 'text-rose-400';
    borderColor = 'border-rose-500/40';
  }

  toast.classList.add(borderColor);

  toast.innerHTML = `
    <div class="p-1 rounded-lg ${iconColor} bg-zinc-800">
      <i data-lucide="${iconName}" class="w-5 h-5"></i>
    </div>
    <div class="flex-1">
      <h4 class="text-sm font-semibold text-white">${title}</h4>
      <p class="text-xs text-zinc-300 mt-0.5 leading-snug">${message}</p>
    </div>
    <button onclick="this.parentElement.remove()" class="text-zinc-500 hover:text-white">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  // Animate in
  setTimeout(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  }, 10);

  // Auto dismiss
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
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
