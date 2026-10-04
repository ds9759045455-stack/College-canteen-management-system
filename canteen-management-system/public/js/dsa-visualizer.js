/**
 * BISTRO NOURISH - LIVE DATA STRUCTURES VISUALIZER
 * Real-time graphical inspector of C In-Memory structures:
 * 1. Kitchen FIFO Queue (Front -> Rear)
 * 2. Action History & Undo LIFO Stack (Top -> Bottom)
 * 3. Dynamic Menu Singly Linked List (Head -> Next -> NULL)
 */

function renderDsaVisualizer() {
  renderQueuePipeline();
  renderStackChamber();
  renderLinkedListChain();
}

/**
 * 1. Render FIFO Queue Pipeline (Horizontal Conveyor)
 */
function renderQueuePipeline() {
  const container = document.getElementById('dsaQueuePipeline');
  const badge = document.getElementById('dsaQueueCountBadge');
  if (!container) return;

  const orders = window.AppState.orders || [];
  // Active queue orders (FIFO)
  const queueOrders = orders.filter(o => o.status !== 'COLLECTED' && o.status !== 'CANCELLED');

  if (badge) badge.textContent = `${queueOrders.length} in queue`;

  if (queueOrders.length === 0) {
    container.innerHTML = `
      <div class="flex items-center space-x-3 text-zinc-500 font-mono text-xs py-4 px-2">
        <span class="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold">FRONT == NULL</span>
        <span>&harr;</span>
        <span>Queue is Empty (count = 0)</span>
        <span>&harr;</span>
        <span class="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold">REAR == NULL</span>
      </div>
    `;
    return;
  }

  let html = `
    <!-- FRONT POINTER -->
    <div class="flex flex-col items-center shrink-0">
      <span class="px-2.5 py-1 rounded-lg bg-amber-500 text-black font-mono font-extrabold text-[11px] shadow-md shadow-amber-500/20">
        FRONT (HEAD)
      </span>
      <div class="h-4 w-0.5 bg-amber-500 my-0.5"></div>
      <i data-lucide="chevron-down" class="w-4 h-4 text-amber-500"></i>
    </div>
  `;

  queueOrders.forEach((order, idx) => {
    const isFront = (idx === 0);
    const isRear = (idx === queueOrders.length - 1);

    html += `
      <!-- Queue Node Box -->
      <div class="shrink-0 p-3.5 rounded-2xl ${isFront ? 'bg-amber-950/40 border-amber-500/60 ring-2 ring-amber-500/30' : 'bg-zinc-900 border-zinc-700/60'} border min-w-[210px] space-y-2 shadow-lg">
        <div class="flex items-center justify-between text-[11px] font-mono">
          <span class="font-bold ${isFront ? 'text-amber-400' : 'text-zinc-300'}">Node #${order.order_id}</span>
          <span class="px-1.5 py-0.5 rounded ${order.status === 'PREPARING' ? 'bg-orange-500/20 text-orange-400' : (order.status === 'READY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400')} text-[10px]">
            ${order.status}
          </span>
        </div>
        <div>
          <p class="text-xs font-semibold text-white truncate">${order.student_name}</p>
          <p class="text-[10px] text-zinc-400 font-mono">${order.items?.length || 0} item(s) • ₹${Number(order.total_amount).toFixed(2)}</p>
        </div>
        <div class="text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-800 flex justify-between">
          <span>Pos #${idx + 1}</span>
          <span>next &rarr; ${isRear ? 'NULL' : `#${queueOrders[idx + 1].order_id}`}</span>
        </div>
      </div>
    `;

    // Arrow to next node
    if (!isRear) {
      html += `
        <div class="shrink-0 flex items-center text-zinc-500">
          <div class="w-5 h-0.5 bg-zinc-700"></div>
          <i data-lucide="chevron-right" class="w-4 h-4 -ml-1 text-zinc-500"></i>
        </div>
      `;
    }
  });

  html += `
    <!-- REAR POINTER -->
    <div class="flex flex-col items-center shrink-0 ml-2">
      <span class="px-2.5 py-1 rounded-lg bg-orange-600 text-white font-mono font-extrabold text-[11px] shadow-md shadow-orange-600/20">
        REAR (TAIL)
      </span>
      <div class="h-4 w-0.5 bg-orange-600 my-0.5"></div>
      <i data-lucide="chevron-down" class="w-4 h-4 text-orange-600"></i>
    </div>
  `;

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

/**
 * 2. Render LIFO Stack Chamber (Vertical Blocks)
 */
function renderStackChamber() {
  const container = document.getElementById('dsaStackChamber');
  const badge = document.getElementById('dsaStackCountBadge');
  if (!container) return;

  const actions = window.AppState.actions || [];
  if (badge) badge.textContent = `${actions.length} frames`;

  if (actions.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-zinc-500 font-mono text-xs">
        Stack is Empty (top == NULL)
      </div>
    `;
    return;
  }

  let html = `
    <!-- TOP OF STACK POINTER -->
    <div class="flex items-center space-x-2 text-purple-400 font-mono text-xs font-bold pb-1">
      <i data-lucide="corner-left-down" class="w-4 h-4 animate-bounce"></i>
      <span>TOP OF STACK (Next to POP)</span>
    </div>
  `;

  actions.forEach((act, idx) => {
    const isTop = (idx === 0);

    const typeLabels = {
      1: 'STATUS_CHANGE',
      2: 'ADD_ITEM',
      3: 'DELETE_ITEM',
      4: 'UPDATE_STOCK',
      5: 'PLACE_ORDER'
    };

    const typeName = typeLabels[act.type] || 'ACTION';

    html += `
      <div class="stack-block p-3 rounded-xl ${isTop ? 'bg-purple-950/40 border-purple-500/50 ring-1 ring-purple-500/40' : 'bg-zinc-900/80 border-zinc-800'} border flex items-center justify-between text-xs transition">
        <div class="space-y-0.5">
          <div class="flex items-center space-x-2">
            <span class="font-mono font-bold ${isTop ? 'text-purple-300' : 'text-zinc-300'}">#${act.action_id} [${typeName}]</span>
            <span class="text-[10px] font-mono text-zinc-500">Target #${act.target_id}</span>
          </div>
          <p class="text-zinc-300 text-[11px]">${act.details || 'System mutation record'}</p>
        </div>
        <div class="text-right font-mono text-[10px] text-zinc-500">
          <span>${act.timestamp ? act.timestamp.split(' ')[1] : ''}</span>
          <p class="text-zinc-600">${isTop ? 'top &rarr;' : 'next'}</p>
        </div>
      </div>
    `;
  });

  html += `
    <div class="pt-2 text-center text-[10px] font-mono text-zinc-600 border-t border-zinc-800/80">
      &mdash; BOTTOM OF STACK (NULL) &mdash;
    </div>
  `;

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

/**
 * 3. Render Singly Linked List Chain
 */
function renderLinkedListChain() {
  const container = document.getElementById('dsaLinkedListChain');
  const badge = document.getElementById('dsaMenuCountBadge');
  if (!container) return;

  const menu = window.AppState.menu || [];
  if (badge) badge.textContent = `${menu.length} nodes`;

  if (menu.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-zinc-500 font-mono text-xs">
        head == NULL (Empty List)
      </div>
    `;
    return;
  }

  let html = `
    <div class="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-bold pb-1">
      <i data-lucide="arrow-right" class="w-4 h-4"></i>
      <span>HEAD POINTER (First Node)</span>
    </div>
  `;

  menu.forEach((dish, idx) => {
    const isHead = (idx === 0);
    const isTail = (idx === menu.length - 1);

    html += `
      <div class="p-3 rounded-xl bg-zinc-900 border ${isHead ? 'border-emerald-500/40' : 'border-zinc-800'} flex items-center justify-between text-xs">
        <div class="flex items-center space-x-3">
          <span class="w-7 h-7 rounded-lg bg-zinc-800 font-mono font-bold text-emerald-400 flex items-center justify-center text-xs">
            #${dish.id}
          </span>
          <div>
            <h5 class="font-semibold text-white">${dish.name}</h5>
            <p class="text-[10px] text-zinc-400 font-mono">${dish.category} • ₹${dish.price} • Stock: ${dish.stock_qty}</p>
          </div>
        </div>
        <div class="font-mono text-[10px] text-zinc-500 flex items-center space-x-1">
          <span>next &rarr;</span>
          <span class="${isTail ? 'text-rose-400 font-bold' : 'text-emerald-400'}">${isTail ? 'NULL' : `#${menu[idx + 1].id}`}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}
