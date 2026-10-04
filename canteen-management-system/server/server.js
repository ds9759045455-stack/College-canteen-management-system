/**
 * BISTRO NOURISH - APPLICATION BRIDGE SERVER
 * Serves the modern UI and connects REST API requests to the C Core Data Structures Engine.
 * Implements Linked List (Menu), FIFO Queue (Orders), and LIFO Stack (Actions/Undo).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { execFile, execSync } = require('child_process');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'canteen_state.json');
const C_BINARY = path.join(__dirname, '..', 'core', 'canteen_core.exe');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* ============================================================
   C DATA STRUCTURES IN-MEMORY ENGINE (Direct C-Equivalent)
   ============================================================ */

// 1. LINKED LIST NODE: MenuItemNode
class MenuItemNode {
  constructor(id, name, category, price, description, imageUrl, prepTimeMin, stockQty, isVeg) {
    this.id = id;
    this.name = name;
    this.category = category;
    this.price = Number(price);
    this.description = description;
    this.image_url = imageUrl;
    this.prep_time_min = Number(prepTimeMin);
    this.stock_qty = Number(stockQty);
    this.is_veg = Boolean(isVeg === 1 || isVeg === true || isVeg === '1');
    this.is_available = this.stock_qty > 0;
    this.next = null; // Pointer to next node
  }
}

class MenuLinkedList {
  constructor() {
    this.head = null;
    this.count = 0;
  }

  insert(node) {
    if (!this.head) {
      this.head = node;
    } else {
      let curr = this.head;
      while (curr.next) {
        curr = curr.next;
      }
      curr.next = node;
    }
    node.next = null;
    this.count++;
    return node;
  }

  delete(id) {
    if (!this.head) return false;
    if (this.head.id === id) {
      this.head = this.head.next;
      this.count--;
      return true;
    }
    let curr = this.head;
    while (curr.next) {
      if (curr.next.id === id) {
        curr.next = curr.next.next;
        this.count--;
        return true;
      }
      curr = curr.next;
    }
    return false;
  }

  findById(id) {
    let curr = this.head;
    while (curr) {
      if (curr.id === id) return curr;
      curr = curr.next;
    }
    return null;
  }

  updateStock(id, delta) {
    const item = this.findById(id);
    if (!item) return false;
    item.stock_qty = Math.max(0, item.stock_qty + delta);
    item.is_available = item.stock_qty > 0;
    return true;
  }

  toArray() {
    const arr = [];
    let curr = this.head;
    while (curr) {
      arr.push({
        id: curr.id,
        name: curr.name,
        category: curr.category,
        price: curr.price,
        description: curr.description,
        image_url: curr.image_url,
        prep_time_min: curr.prep_time_min,
        stock_qty: curr.stock_qty,
        is_veg: curr.is_veg,
        is_available: curr.is_available
      });
      curr = curr.next;
    }
    return arr;
  }
}

// 2. FIFO QUEUE: OrderQueue
class OrderNode {
  constructor(orderId, studentId, studentName, pickupType, specialNotes, paymentMethod, items, totalAmount) {
    this.order_id = orderId;
    this.student_id = studentId;
    this.student_name = studentName;
    this.pickup_type = pickupType;
    this.special_notes = specialNotes;
    this.payment_method = paymentMethod;
    this.items = items; // Array of { item_id, name, unit_price, quantity }
    this.total_amount = Number(totalAmount);
    this.created_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
    this.status = 'PENDING'; // PENDING -> PREPARING -> READY -> COLLECTED
    this.next = null; // Pointer to next order
  }
}

class OrderQueue {
  constructor() {
    this.front = null;
    this.rear = null;
    this.count = 0;
  }

  enqueue(order) {
    order.next = null;
    if (!this.rear) {
      this.front = order;
      this.rear = order;
    } else {
      this.rear.next = order;
      this.rear = order;
    }
    this.count++;
    return order;
  }

  dequeue() {
    if (!this.front) return null;
    const temp = this.front;
    this.front = this.front.next;
    if (!this.front) {
      this.rear = null;
    }
    this.count--;
    temp.next = null;
    return temp;
  }

  find(orderId) {
    let curr = this.front;
    while (curr) {
      if (curr.order_id === orderId) return curr;
      curr = curr.next;
    }
    return null;
  }

  toArray() {
    const arr = [];
    let curr = this.front;
    let pos = 1;
    while (curr) {
      arr.push({
        order_id: curr.order_id,
        student_id: curr.student_id,
        student_name: curr.student_name,
        pickup_type: curr.pickup_type,
        special_notes: curr.special_notes,
        payment_method: curr.payment_method,
        total_amount: curr.total_amount,
        created_at: curr.created_at,
        status: curr.status,
        queue_position: pos,
        items: curr.items
      });
      if (curr.status === 'PENDING' || curr.status === 'PREPARING') {
        pos++;
      }
      curr = curr.next;
    }
    return arr;
  }
}

// 3. LIFO STACK: ActionHistoryStack
class ActionNode {
  constructor(actionId, type, targetId, prevStateVal, newStateVal, details) {
    this.action_id = actionId;
    this.type = type; // 1: STATUS_CHANGE, 2: ADD_ITEM, 3: DELETE_ITEM, 4: UPDATE_STOCK, 5: PLACE_ORDER
    this.target_id = targetId;
    this.prev_state_val = prevStateVal;
    this.new_state_val = newStateVal;
    this.details = details;
    this.timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    this.next = null; // Pointer to node below
  }
}

class ActionStack {
  constructor() {
    this.top = null;
    this.count = 0;
    this.counter = 1000;
  }

  push(type, targetId, prevStateVal, newStateVal, details) {
    const node = new ActionNode(++this.counter, type, targetId, prevStateVal, newStateVal, details);
    node.next = this.top;
    this.top = node;
    this.count++;
    return node;
  }

  pop() {
    if (!this.top) return null;
    const node = this.top;
    this.top = this.top.next;
    this.count--;
    node.next = null;
    return node;
  }

  toArray() {
    const arr = [];
    let curr = this.top;
    while (curr) {
      arr.push({
        action_id: curr.action_id,
        type: curr.type,
        target_id: curr.target_id,
        prev_state_val: curr.prev_state_val,
        new_state_val: curr.new_state_val,
        details: curr.details,
        timestamp: curr.timestamp
      });
      curr = curr.next;
    }
    return arr;
  }
}

/* ============================================================
   CANTEEN SYSTEM ORCHESTRATOR
   ============================================================ */

class CanteenSystem {
  constructor() {
    this.menu = new MenuLinkedList();
    this.orders = new OrderQueue();
    this.actions = new ActionStack();
    this.nextOrderId = 101;
    this.nextItemId = 11;
  }

  initSeedData() {
    const defaultDishes = [
      { id: 1, name: 'Classic Paneer Tikka Burger', cat: 'Burgers', price: 149.00, desc: 'Char-grilled spiced paneer patty with mint mayo, crisp lettuce, and artisanal brioche bun.', img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80', prep: 8, stock: 25, veg: 1 },
      { id: 2, name: 'Smoked Crispy Chicken Burger', cat: 'Burgers', price: 189.00, desc: 'Double-fried buttermilk chicken breast with house special peri-peri sauce and melted cheddar.', img: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80', prep: 10, stock: 20, veg: 0 },
      { id: 3, name: 'Stone-baked Margherita Pizza', cat: 'Pizza', price: 229.00, desc: 'San Marzano tomato coulis, fresh mozzarella bocconcini, extra virgin olive oil, and sweet basil.', img: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=800&q=80', prep: 12, stock: 15, veg: 1 },
      { id: 4, name: 'Fiery Pepperoni & Jalapeno Pizza', cat: 'Pizza', price: 279.00, desc: 'Cured spicy pepperoni, pickled jalapenos, mozzarella blend, and chili-infused organic honey.', img: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=800&q=80', prep: 14, stock: 18, veg: 0 },
      { id: 5, name: 'Hyderabadi Dum Chicken Biryani', cat: 'Main Course', price: 219.00, desc: 'Slow-cooked fragrant basmati rice layered with marinated tender chicken, saffron, and fried onions.', img: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80', prep: 10, stock: 30, veg: 0 },
      { id: 6, name: 'Royal Shahi Paneer with Naan', cat: 'Main Course', price: 199.00, desc: 'Rich cashew-tomato gravy, cottage cheese cubes, topped with butter cream and 2 butter garlic naans.', img: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80', prep: 9, stock: 22, veg: 1 },
      { id: 7, name: 'Chili Garlic Hakka Noodles', cat: 'Fast Food', price: 129.00, desc: 'Wok-tossed hand-pulled noodles with colorful bell peppers, scallions, and toasted garlic chili oil.', img: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80', prep: 7, stock: 35, veg: 1 },
      { id: 8, name: 'Crispy Peri-Peri French Fries', cat: 'Fast Food', price: 89.00, desc: 'Golden skin-on potato fries dusted with authentic African bird\'s eye chili spice mix and cheese dip.', img: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=800&q=80', prep: 5, stock: 50, veg: 1 },
      { id: 9, name: 'Choco-Lava Cake with Ice Cream', cat: 'Desserts', price: 119.00, desc: 'Warm molten chocolate cake overflowing with Belgian ganache, paired with vanilla bean gelato.', img: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80', prep: 5, stock: 20, veg: 1 },
      { id: 10, name: 'Iced Caramel Macchiato', cat: 'Beverages', price: 99.00, desc: 'Freshly brewed double espresso over cold whole milk, vanilla essence, and sea salt caramel drizzle.', img: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=800&q=80', prep: 4, stock: 40, veg: 1 }
    ];

    defaultDishes.forEach(d => {
      this.menu.insert(new MenuItemNode(d.id, d.name, d.cat, d.price, d.desc, d.img, d.prep, d.stock, d.veg));
    });

    // Sample initial orders in FIFO Queue
    const o1 = new OrderNode(101, 'STU-2024-012', 'Alex Mercer', 'Dine-In', 'Extra ketchup please', 'Campus Card', [
      { item_id: 1, name: 'Classic Paneer Tikka Burger', unit_price: 149.00, quantity: 1 },
      { item_id: 8, name: 'Crispy Peri-Peri French Fries', unit_price: 89.00, quantity: 1 }
    ], 238.00);
    o1.status = 'PREPARING';
    this.orders.enqueue(o1);
    this.actions.push(1, 101, 0, 1, 'Order #101 cooking in kitchen');

    const o2 = new OrderNode(102, 'STU-2024-089', 'Sophia Chen', 'Takeaway', 'Less spicy please', 'UPI / QR', [
      { item_id: 5, name: 'Hyderabadi Dum Chicken Biryani', unit_price: 219.00, quantity: 1 },
      { item_id: 10, name: 'Iced Caramel Macchiato', unit_price: 99.00, quantity: 1 }
    ], 318.00);
    o2.status = 'PENDING';
    this.orders.enqueue(o2);
    this.actions.push(5, 102, 0, 0, 'Order #102 placed by Sophia Chen');

    this.nextOrderId = 103;
    this.saveState();
  }

  saveState() {
    const data = {
      timestamp: new Date().toISOString(),
      next_order_id: this.nextOrderId,
      next_item_id: this.nextItemId,
      menu: this.menu.toArray(),
      orders: this.orders.toArray(),
      actions: this.actions.toArray()
    };
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('Error writing state file:', e);
    }
  }

  loadState() {
    if (!fs.existsSync(STATE_FILE)) {
      this.initSeedData();
      return;
    }
    try {
      const content = fs.readFileSync(STATE_FILE, 'utf8');
      const data = JSON.parse(content);
      if (data && data.menu && data.orders) {
        this.nextOrderId = data.next_order_id || 103;
        this.nextItemId = data.next_item_id || 11;
        data.menu.forEach(d => {
          this.menu.insert(new MenuItemNode(d.id, d.name, d.category, d.price, d.description, d.image_url, d.prep_time_min, d.stock_qty, d.is_veg));
        });
        data.orders.forEach(o => {
          const order = new OrderNode(o.order_id, o.student_id, o.student_name, o.pickup_type, o.special_notes, o.payment_method, o.items, o.total_amount);
          order.status = o.status;
          order.created_at = o.created_at;
          this.orders.enqueue(order);
        });
        if (data.actions) {
          data.actions.forEach(a => {
            this.actions.push(a.type, a.target_id, a.prev_state_val, a.new_state_val, a.details);
          });
        }
      } else {
        this.initSeedData();
      }
    } catch (err) {
      console.warn('Failed to parse state file, re-initializing defaults.', err.message);
      this.initSeedData();
    }
  }

  placeOrder(payload) {
    const orderId = this.nextOrderId++;
    let total = 0;

    // Decrement stock in Linked List
    payload.items.forEach(it => {
      this.menu.updateStock(it.item_id, -it.quantity);
      total += (it.unit_price * it.quantity);
    });

    // 10% student subsidy
    const finalTotal = total * 0.90;

    const order = new OrderNode(
      orderId,
      payload.student_id || 'STU-2024-001',
      payload.student_name || 'Student',
      payload.pickup_type || 'Dine-In',
      payload.special_notes || 'None',
      payload.payment_method || 'Campus Card',
      payload.items,
      finalTotal
    );

    // Enqueue to FIFO Queue
    this.orders.enqueue(order);

    // Push to LIFO Stack
    this.actions.push(
      5, // ACTION_PLACE_ORDER
      orderId,
      0,
      0,
      `Order #${orderId} placed by ${order.student_name} (₹${finalTotal.toFixed(2)})`
    );

    this.saveState();
    return order;
  }

  advanceOrderStatus(orderId) {
    const order = this.orders.find(orderId);
    if (!order) return { success: false, message: 'Order not found' };

    const prevStatus = order.status;
    let nextStatus = prevStatus;

    if (prevStatus === 'PENDING') {
      nextStatus = 'PREPARING';
    } else if (prevStatus === 'PREPARING') {
      nextStatus = 'READY';
    } else if (prevStatus === 'READY') {
      nextStatus = 'COLLECTED';
    } else {
      return { success: false, message: 'Order already completed or cancelled' };
    }

    order.status = nextStatus;

    // Push state transition to Stack for Undo capability
    this.actions.push(
      1, // ACTION_STATUS_CHANGE
      orderId,
      prevStatus,
      nextStatus,
      `Order #${orderId} advanced from ${prevStatus} to ${nextStatus}`
    );

    this.saveState();
    return { success: true, orderId, prevStatus, nextStatus };
  }

  undoLastAction() {
    const action = this.actions.pop();
    if (!action) {
      return { success: false, message: 'Stack is empty: No actions to undo.' };
    }

    let detailMsg = '';

    if (action.type === 1) { // STATUS_CHANGE
      const order = this.orders.find(action.target_id);
      if (order) {
        order.status = action.prev_state_val;
        detailMsg = `Popped Action #${action.action_id}: Order #${action.target_id} reverted back to '${action.prev_state_val}'.`;
      }
    } else if (action.type === 4) { // UPDATE_STOCK
      const item = this.menu.findById(action.target_id);
      if (item) {
        item.stock_qty = action.prev_state_val;
        item.is_available = item.stock_qty > 0;
        detailMsg = `Popped Action #${action.action_id}: Restored ${item.name} stock to ${action.prev_state_val}.`;
      }
    } else if (action.type === 5) { // PLACE_ORDER
      const order = this.orders.find(action.target_id);
      if (order) {
        order.status = 'CANCELLED';
        // restore stock
        order.items.forEach(it => {
          this.menu.updateStock(it.item_id, it.quantity);
        });
        detailMsg = `Popped Action #${action.action_id}: Order #${action.target_id} cancelled and item stocks restored.`;
      }
    } else {
      detailMsg = `Popped Action #${action.action_id}: ${action.details}`;
    }

    this.saveState();
    return { success: true, message: detailMsg };
  }

  addMenuItem(itemData) {
    const id = this.nextItemId++;
    const node = new MenuItemNode(
      id,
      itemData.name,
      itemData.category,
      itemData.price,
      itemData.description,
      itemData.image_url,
      itemData.prep_time_min,
      itemData.stock_qty,
      itemData.is_veg
    );

    this.menu.insert(node);

    this.actions.push(
      2, // ACTION_ADD_ITEM
      id,
      0,
      0,
      `Added new dish "${node.name}" (#Node ${id}) to menu linked list`
    );

    this.saveState();
    return node;
  }

  deleteMenuItem(itemId) {
    const item = this.menu.findById(itemId);
    if (!item) return false;
    const name = item.name;
    const res = this.menu.delete(itemId);
    if (res) {
      this.actions.push(
        3, // ACTION_DELETE_ITEM
        itemId,
        0,
        0,
        `Unlinked dish "${name}" (#Node ${itemId}) from linked list`
      );
      this.saveState();
    }
    return res;
  }
}

// Instantiate and load
const system = new CanteenSystem();
system.loadState();

/* ============================================================
   HTTP SERVER & REST API DISPATCHER
   ============================================================ */

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // --- API ROUTE: GET /api/state ---
  if (method === 'GET' && pathname === '/api/state') {
    return sendJson(res, 200, {
      timestamp: new Date().toISOString(),
      menu: system.menu.toArray(),
      orders: system.orders.toArray(),
      actions: system.actions.toArray()
    });
  }

  // --- API ROUTE: GET /api/menu ---
  if (method === 'GET' && pathname === '/api/menu') {
    return sendJson(res, 200, system.menu.toArray());
  }

  // --- API ROUTE: POST /api/orders (Student Places Order -> Enqueue) ---
  if (method === 'POST' && pathname === '/api/orders') {
    try {
      const body = await parseJsonBody(req);
      if (!body.items || body.items.length === 0) {
        return sendJson(res, 400, { status: 'error', message: 'Cart items cannot be empty.' });
      }
      const order = system.placeOrder(body);
      return sendJson(res, 201, {
        status: 'ok',
        order_id: order.order_id,
        message: `Order #${order.order_id} enqueued to kitchen FIFO queue.`,
        order
      });
    } catch (err) {
      return sendJson(res, 400, { status: 'error', message: err.message });
    }
  }

  // --- API ROUTE: POST /api/orders/:id/advance (Staff Advances Order) ---
  const advanceMatch = pathname.match(/^\/api\/orders\/(\d+)\/advance$/);
  if (method === 'POST' && advanceMatch) {
    const orderId = parseInt(advanceMatch[1]);
    const result = system.advanceOrderStatus(orderId);
    if (result.success) {
      return sendJson(res, 200, { status: 'ok', ...result });
    } else {
      return sendJson(res, 400, { status: 'error', message: result.message });
    }
  }

  // --- API ROUTE: POST /api/undo (Pops LIFO Stack) ---
  if (method === 'POST' && pathname === '/api/undo') {
    const result = system.undoLastAction();
    return sendJson(res, result.success ? 200 : 400, {
      status: result.success ? 'ok' : 'empty',
      message: result.message
    });
  }

  // --- API ROUTE: POST /api/menu/stock ---
  if (method === 'POST' && pathname === '/api/menu/stock') {
    try {
      const body = await parseJsonBody(req);
      const { item_id, delta } = body;
      const prev = system.menu.findById(item_id);
      const prevStock = prev ? prev.stock_qty : 0;
      const ok = system.menu.updateStock(item_id, delta);
      if (ok) {
        system.actions.push(
          4, // UPDATE_STOCK
          item_id,
          prevStock,
          prev ? prev.stock_qty : 0,
          `Adjusted stock for ${prev ? prev.name : 'item'} by ${delta > 0 ? '+' : ''}${delta}`
        );
        system.saveState();
        return sendJson(res, 200, { status: 'ok' });
      }
      return sendJson(res, 404, { status: 'error', message: 'Item not found' });
    } catch (err) {
      return sendJson(res, 400, { status: 'error', message: err.message });
    }
  }

  // --- API ROUTE: POST /api/menu/item (Add New Dish to Linked List) ---
  if (method === 'POST' && pathname === '/api/menu/item') {
    try {
      const body = await parseJsonBody(req);
      const node = system.addMenuItem(body);
      return sendJson(res, 201, { status: 'ok', item: node });
    } catch (err) {
      return sendJson(res, 400, { status: 'error', message: err.message });
    }
  }

  // --- API ROUTE: DELETE /api/menu/item/:id (Delete Dish Node) ---
  const deleteMatch = pathname.match(/^\/api\/menu\/item\/(\d+)$/);
  if (method === 'DELETE' && deleteMatch) {
    const itemId = parseInt(deleteMatch[1]);
    const ok = system.deleteMenuItem(itemId);
    return sendJson(res, ok ? 200 : 404, { status: ok ? 'ok' : 'error' });
  }

  // --- STATIC FILE SERVING ---
  let filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback to index.html for SPA
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (fallbackErr, fallbackContent) => {
          if (fallbackErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(fallbackContent);
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  HITAHARA - CANTEEN MANAGEMENT SYSTEM`);
  console.log(`  C Core Data Structures: Linked List | FIFO Queue | LIFO Stack`);
  console.log(`  Web Server running at: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
