/**
 * CAMPUSBITE - APPLICATION BRIDGE SERVER
 * Serves the modern UI and connects REST API requests to the C Core Data Structures Engine.
 * Implements Linked List (Menu), FIFO Queue (Orders), LIFO Stack (Actions/Undo), and Raw Materials Inventory.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'canteen_state.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* ============================================================
   1. LINKED LIST NODE: MenuItemNode (100% Pure Veg)
   ============================================================ */
class MenuItemNode {
  constructor(id, name, category, price, description, imageUrl, prepTimeMin, stockQty, isVeg, rawMaterials) {
    this.id = id;
    this.name = name;
    this.category = category;
    this.price = Number(price);
    this.description = description;
    this.image_url = imageUrl;
    this.prep_time_min = Number(prepTimeMin);
    this.stock_qty = Number(stockQty);
    this.is_veg = true; // 100% Pure Vegetarian in Campusbite
    this.is_available = this.stock_qty > 0;
    this.raw_materials = rawMaterials || 'Standard fresh ingredients';
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
        is_veg: true,
        is_available: curr.is_available,
        raw_materials: curr.raw_materials
      });
      curr = curr.next;
    }
    return arr;
  }
}

/* ============================================================
   2. FIFO QUEUE: OrderQueue
   ============================================================ */
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
    this.penalty_deduction = 0.0;
    this.refund_amount = 0.0;
    this.cancel_reason = '';
    this.created_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
    this.status = 'PENDING'; // PENDING -> PREPARING -> READY -> COLLECTED / CANCELLED
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
        penalty_deduction: curr.penalty_deduction,
        refund_amount: curr.refund_amount,
        cancel_reason: curr.cancel_reason,
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

/* ============================================================
   3. LIFO STACK: ActionHistoryStack
   ============================================================ */
class ActionNode {
  constructor(actionId, type, targetId, prevStateVal, newStateVal, details) {
    this.action_id = actionId;
    this.type = type; // 1: STATUS_CHANGE, 2: ADD_ITEM, 3: DELETE_ITEM, 4: UPDATE_STOCK, 5: PLACE_ORDER, 6: CANCEL_ORDER
    this.target_id = targetId;
    this.prev_state_val = prevStateVal;
    this.new_state_val = newStateVal;
    this.details = details;
    this.timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    this.next = null;
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
   4. RAW MATERIALS INVENTORY ENGINE
   ============================================================ */
const DEFAULT_RAW_MATERIALS = [
  { id: 1, name: 'Whole Wheat Flour (Sharbati Atta)', category: 'Grains & Flour', current_stock: 45.0, unit: 'kg', min_threshold: 15.0, linked_dishes: 'Crispy Chole Poori, Amritsari Aloo Paratha' },
  { id: 2, name: 'Fresh Malai Paneer', category: 'Dairy', current_stock: 18.5, unit: 'kg', min_threshold: 8.0, linked_dishes: 'Royal Veg Dum Biryani, Shahi Paneer Butter Masala, Paneer Tikka Burger' },
  { id: 3, name: 'Saffron Basmati Rice', category: 'Grains & Flour', current_stock: 55.0, unit: 'kg', min_threshold: 20.0, linked_dishes: 'Royal Veg Dum Biryani, Desi Ghee Khichdi' },
  { id: 4, name: 'Farm Fresh Potatoes (Aloo)', category: 'Produce', current_stock: 60.0, unit: 'kg', min_threshold: 15.0, linked_dishes: 'Amritsari Aloo Paratha, Crispy Mix Veg Pakoda, Samosa, Masala Dosa' },
  { id: 5, name: 'Bengal Gram Besan', category: 'Grains & Flour', current_stock: 28.0, unit: 'kg', min_threshold: 10.0, linked_dishes: 'Gujarati Nylon Dhokla, Crispy Mix Veg Pakoda' },
  { id: 6, name: 'Pure Desi Cow Ghee', category: 'Oils & Ghee', current_stock: 22.0, unit: 'kg', min_threshold: 5.0, linked_dishes: 'Khasta Moong Dal Kachori, Royal Veg Dum Biryani, Desi Ghee Khichdi, Gulab Jamun' },
  { id: 7, name: 'Cold-Pressed Cooking Oil', category: 'Oils & Ghee', current_stock: 40.0, unit: 'L', min_threshold: 12.0, linked_dishes: 'Crispy Chole Poori, Crispy Pakoda, Hakka Noodles' },
  { id: 8, name: 'Full Cream Dairy Milk', category: 'Dairy', current_stock: 35.0, unit: 'L', min_threshold: 10.0, linked_dishes: 'Thick Kesar Mango Shake, Golden Honey Pancakes, Tea & Coffee' },
  { id: 9, name: 'Fresh Curd / Dahi', category: 'Dairy', current_stock: 16.0, unit: 'kg', min_threshold: 5.0, linked_dishes: 'Amritsari Aloo Paratha, Gujarati Nylon Dhokla' },
  { id: 10, name: 'Kabuli Chole & Moong Dal', category: 'Pulses', current_stock: 32.0, unit: 'kg', min_threshold: 10.0, linked_dishes: 'Crispy Chole Poori, Khasta Moong Dal Kachori, Desi Ghee Khichdi' },
  { id: 11, name: 'Sourdough Pizza Flour & Yeast', category: 'Bakery', current_stock: 20.0, unit: 'kg', min_threshold: 6.0, linked_dishes: 'Stone-baked Margherita Pizza' },
  { id: 12, name: 'Fresh Mozzarella Cheese', category: 'Dairy', current_stock: 12.0, unit: 'kg', min_threshold: 4.0, linked_dishes: 'Stone-baked Margherita Pizza' },
  { id: 13, name: 'Amul Salted Table Butter', category: 'Dairy', current_stock: 15.0, unit: 'kg', min_threshold: 5.0, linked_dishes: 'Aloo Paratha, Shahi Paneer Butter Masala, Pancakes' },
  { id: 14, name: 'Organic Honey & Raw Sugar', category: 'Pantry', current_stock: 25.0, unit: 'kg', min_threshold: 8.0, linked_dishes: 'Golden Honey Pancakes, Dark Chocolate Truffle Cake, Gulab Jamun' },
  { id: 15, name: 'Flattened Rice (Poha) & Peanuts', category: 'Grains & Flour', current_stock: 30.0, unit: 'kg', min_threshold: 8.0, linked_dishes: 'Indori Masala Poha' },
  { id: 16, name: 'Fresh Khoya / Mawa', category: 'Dairy', current_stock: 10.0, unit: 'kg', min_threshold: 3.0, linked_dishes: 'Warm Desi Ghee Gulab Jamun' },
  { id: 17, name: 'Aromatic Garam Masala & Saffron', category: 'Pantry', current_stock: 8.0, unit: 'kg', min_threshold: 2.0, linked_dishes: 'Biryani, Shahi Paneer, Chole, Kachori' }
];

/* ============================================================
   5. CANTEEN SYSTEM ORCHESTRATOR
   ============================================================ */
class CanteenSystem {
  constructor() {
    this.menu = new MenuLinkedList();
    this.orders = new OrderQueue();
    this.actions = new ActionStack();
    this.rawMaterials = [...DEFAULT_RAW_MATERIALS];
    this.nextOrderId = 101;
    this.nextItemId = 1;
  }

  initSeedData() {
    const dishes = [
      { id: 1, name: 'Crispy Chole Poori', cat: 'Breakfast', price: 89.00, desc: 'Fluffy golden pooris served with spiced Amritsari chickpea curry, tangy pickled onions, and green chili.', img: 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=800&q=80', prep: 8, stock: 30, raw: 'Whole Wheat Flour (150g), Chickpeas (100g), Cooking Oil (40ml), Spices & Herbs (20g)' },
      { id: 2, name: 'Khasta Moong Dal Kachori', cat: 'Breakfast', price: 69.00, desc: 'Crusty flaky kachori stuffed with roasted spiced yellow lentils, served with sweet sonth and mint chutney.', img: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80', prep: 6, stock: 25, raw: 'Refined Flour (120g), Yellow Moong Dal (60g), Desi Ghee (25g), Asafoetida & Spices (15g)' },
      { id: 3, name: 'Royal Veg Dum Biryani', cat: 'Main Course', price: 189.00, desc: 'Aromatic basmati rice slow-cooked with cottage cheese, fresh seasonal vegetables, saffron, and crisp fried onions.', img: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80', prep: 12, stock: 28, raw: 'Basmati Rice (180g), Fresh Paneer (80g), Mixed Veggies (100g), Desi Ghee (30g), Saffron (1g)' },
      { id: 4, name: 'Dark Chocolate Truffle Cake', cat: 'Desserts', price: 119.00, desc: 'Eggless rich chocolate sponge layered with smooth Belgian dark chocolate ganache and chocolate curls.', img: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80', prep: 4, stock: 20, raw: 'Cocoa Powder & Flour (140g), Dark Chocolate (80g), Dairy Cream (60ml), Raw Sugar (40g)' },
      { id: 5, name: 'Amritsari Aloo Paratha', cat: 'Breakfast', price: 79.00, desc: 'Homestyle tawa paratha stuffed with mashed spiced potatoes, roasted cumin, fresh coriander, butter and curd.', img: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=800&q=80', prep: 7, stock: 35, raw: 'Whole Wheat Flour (140g), Potatoes (120g), Amul Butter (20g), Fresh Curd (80g), Spices (10g)' },
      { id: 6, name: 'Indori Masala Poha', cat: 'Breakfast', price: 49.00, desc: 'Steamed flattened rice tempered with mustard, turmeric, green chillies, crunchy roasted peanuts, and Ratlami sev.', img: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80', prep: 5, stock: 40, raw: 'Flattened Rice / Poha (120g), Roasted Peanuts (30g), Mustard & Curry Leaves (10g), Sev (20g)' },
      { id: 7, name: 'Gujarati Nylon Dhokla', cat: 'Snacks', price: 59.00, desc: 'Soft and spongy steamed gram flour cakes tempered with mustard seeds, sesame, and slit green chillies.', img: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80', prep: 5, stock: 30, raw: 'Bengal Gram Besan (150g), Lemon Juice & Curd (40g), Mustard & Sesame (10g), Green Chillies (5g)' },
      { id: 8, name: 'Crispy Mix Veg Pakoda', cat: 'Snacks', price: 69.00, desc: 'Golden fritters of onion, potatoes, spinach, and cauliflower coated in seasoned chickpea batter.', img: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80', prep: 6, stock: 40, raw: 'Chickpea Besan (120g), Farm Potatoes & Onions (140g), Cooking Oil (50ml), Carom Seeds (5g)' },
      { id: 9, name: 'Thick Kesar Mango Shake', cat: 'Beverages', price: 99.00, desc: 'Creamy luscious shake blended from real Alphonso mango pulp, full cream milk, and topped with dry fruit slivers.', img: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=800&q=80', prep: 4, stock: 35, raw: 'Alphonso Mango Pulp (150ml), Chilled Dairy Milk (200ml), Vanilla Scoop (40g), Pistachios (5g)' },
      { id: 10, name: 'Golden Honey Pancakes', cat: 'Breakfast', price: 119.00, desc: 'Stack of three fluffy eggless buttermilk pancakes served warm with natural organic honey and melted butter.', img: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=800&q=80', prep: 7, stock: 20, raw: 'Refined Flour (130g), Fresh Milk (110ml), Organic Wild Honey (35ml), Salted Butter (15g)' },
      { id: 11, name: 'Comforting Desi Ghee Khichdi', cat: 'Main Course', price: 129.00, desc: 'Wholesome slow-cooked yellow lentils and fragrant rice tempered with cumin, garlic, and pure desi cow ghee.', img: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80', prep: 8, stock: 25, raw: 'Rice (100g), Yellow Moong Dal (100g), Desi Cow Ghee (30g), Cumin & Hing (8g), Mixed Vegetables (60g)' },
      { id: 12, name: 'Classic Paneer Tikka Burger', cat: 'Fast Food', price: 139.00, desc: 'Tandoori spiced grilled paneer slab with roasted bell pepper, tangy mint mayo, and crisp lettuce in brioche bun.', img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80', prep: 8, stock: 22, raw: 'Cottage Cheese Paneer (100g), Brioche Bun (1 pc), Mint Mayo (25g), Lettuce & Onions (30g)' },
      { id: 13, name: 'Stone-baked Margherita Pizza', cat: 'Fast Food', price: 199.00, desc: 'Hand-stretched sourdough pizza with Italian plum tomato sauce, mozzarella bocconcini, and fresh basil.', img: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=800&q=80', prep: 11, stock: 18, raw: 'Sourdough Pizza Base (180g), Fresh Mozzarella (100g), San Marzano Tomato (60g), Basil Leaves (5g)' },
      { id: 14, name: 'Crispy Samosa with Chole', cat: 'Snacks', price: 59.00, desc: 'Two crisp golden pyramid pastries stuffed with spiced potatoes and peas, drenched with spicy chole gravy.', img: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80', prep: 5, stock: 40, raw: 'Maida Flour (120g), Potatoes & Green Peas (130g), Chickpeas Curry (100g), Spices (15g)' },
      { id: 15, name: 'Shahi Paneer Butter Masala', cat: 'Main Course', price: 179.00, desc: 'Silky tomato, cashew, and butter gravy with fresh paneer cubes, served with two hot butter garlic naans.', img: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80', prep: 10, stock: 24, raw: 'Fresh Paneer (140g), Cashew & Tomato Gravy (180g), Butter (25g), Tandoori Naan (2 pcs)' },
      { id: 16, name: 'Crispy Masala Dosa', cat: 'Breakfast', price: 99.00, desc: 'Golden paper-thin fermented rice crepe stuffed with fragrant mustard-potato masala, served with coconut chutney & sambar.', img: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80', prep: 7, stock: 30, raw: 'Fermented Rice & Urad Batter (180g), Potato Masala (110g), Coconut Chutney (50g), Sambar (120ml)' },
      { id: 17, name: 'Chilli Garlic Hakka Noodles', cat: 'Fast Food', price: 119.00, desc: 'Wok-tossed hand-pulled noodles with colorful bell peppers, shredded cabbage, scallions, and toasted garlic oil.', img: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80', prep: 7, stock: 32, raw: 'Wheat Noodles (150g), Bell Peppers & Cabbage (100g), Garlic Chili Oil (25ml), Soy Sauce (15ml)' },
      { id: 18, name: 'Warm Desi Ghee Gulab Jamun', cat: 'Desserts', price: 69.00, desc: 'Two melt-in-mouth reduced milk khoya dumplings, deep-fried in desi ghee and steeped in cardamom rose syrup.', img: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80', prep: 4, stock: 30, raw: 'Fresh Khoya / Mawa (100g), Refined Flour (20g), Sugar Syrup (80ml), Cardamom & Rose (5g)' }
    ];

    dishes.forEach(d => {
      this.menu.insert(new MenuItemNode(d.id, d.name, d.cat, d.price, d.desc, d.img, d.prep, d.stock, true, d.raw));
    });

    this.nextItemId = 19;

    // Sample initial orders in queue
    const o1 = new OrderNode(101, 'STU-2024-012', 'Aarav Sharma', 'Dine-In', 'Extra chutney please', 'Campus Card', [
      { item_id: 1, name: 'Crispy Chole Poori', unit_price: 89.00, quantity: 1 },
      { item_id: 5, name: 'Amritsari Aloo Paratha', unit_price: 79.00, quantity: 1 }
    ], 168.00);
    o1.status = 'PREPARING';
    this.orders.enqueue(o1);
    this.actions.push(1, 101, 0, 1, 'Order #101 cooking in kitchen');

    const o2 = new OrderNode(102, 'STU-2024-089', 'Priya Verma', 'Takeaway', 'Less spicy please', 'UPI / QR', [
      { item_id: 3, name: 'Royal Veg Dum Biryani', unit_price: 189.00, quantity: 1 },
      { item_id: 6, name: 'Indori Masala Poha', unit_price: 49.00, quantity: 1 }
    ], 238.00);
    o2.status = 'PENDING';
    this.orders.enqueue(o2);
    this.actions.push(5, 102, 0, 0, 'Order #102 placed by Priya Verma');

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
      actions: this.actions.toArray(),
      raw_materials: this.rawMaterials
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
      // Ensure menu is 100% pure veg and contains >= 15 items
      if (data && data.menu && data.menu.length >= 15 && data.menu.every(d => d.is_veg === true)) {
        this.nextOrderId = data.next_order_id || 103;
        this.nextItemId = data.next_item_id || 19;
        data.menu.forEach(d => {
          this.menu.insert(new MenuItemNode(d.id, d.name, d.category, d.price, d.description, d.image_url, d.prep_time_min, d.stock_qty, true, d.raw_materials));
        });
        data.orders.forEach(o => {
          const order = new OrderNode(o.order_id, o.student_id, o.student_name, o.pickup_type, o.special_notes, o.payment_method, o.items, o.total_amount);
          order.status = o.status;
          order.created_at = o.created_at;
          order.penalty_deduction = o.penalty_deduction || 0.0;
          order.refund_amount = o.refund_amount || 0.0;
          order.cancel_reason = o.cancel_reason || '';
          this.orders.enqueue(order);
        });
        if (data.actions) {
          data.actions.forEach(a => {
            this.actions.push(a.type, a.target_id, a.prev_state_val, a.new_state_val, a.details);
          });
        }
        if (data.raw_materials && data.raw_materials.length > 0) {
          this.rawMaterials = data.raw_materials;
        }
      } else {
        // Upgrade legacy state to new 18-item 100% pure veg menu
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

    // Exact direct pricing without subsidy
    const finalTotal = Number(total.toFixed(2));

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

  cancelOrder(orderId) {
    const order = this.orders.find(orderId);
    if (!order) return { success: false, message: 'Order not found.' };

    if (order.status === 'CANCELLED') {
      return { success: false, message: 'Order is already cancelled.' };
    }
    if (order.status === 'READY' || order.status === 'COLLECTED') {
      return { success: false, message: 'Order is already prepared/ready for pickup and cannot be cancelled.' };
    }

    const prevStatus = order.status;
    let penalty = 0.0;
    let refund = 0.0;
    let message = '';

    if (order.status === 'PENDING') {
      // 0% penalty before kitchen cooking starts
      penalty = 0.0;
      refund = order.total_amount;
      order.penalty_deduction = penalty;
      order.refund_amount = refund;
      order.status = 'CANCELLED';
      order.cancel_reason = 'Cancelled by student before cooking started (100% refund)';

      // Restore stock to menu Linked List
      order.items.forEach(it => {
        this.menu.updateStock(it.item_id, it.quantity);
      });

      message = `Order #${orderId} cancelled before cooking. Full 100% refund of ₹${refund.toFixed(2)} processed with 0% penalty.`;
    } else if (order.status === 'PREPARING') {
      // 35% deduction charged by management after cooking commenced
      penalty = Number((order.total_amount * 0.35).toFixed(2));
      refund = Number((order.total_amount - penalty).toFixed(2));
      order.penalty_deduction = penalty;
      order.refund_amount = refund;
      order.status = 'CANCELLED';
      order.cancel_reason = 'Cancelled after cooking commenced (35% management fee applied)';

      message = `Order #${orderId} cancelled after cooking started. 35% management charge (₹${penalty.toFixed(2)}) deducted. Refund of ₹${refund.toFixed(2)} (65%) processed.`;
    }

    this.actions.push(
      6, // ACTION_CANCEL_ORDER
      orderId,
      prevStatus === 'PENDING' ? 0 : 1,
      4, // STATUS_CANCELLED
      message
    );

    this.saveState();
    return {
      success: true,
      order_id: orderId,
      penalty,
      refund,
      message,
      order
    };
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
    } else if (action.type === 6) { // CANCEL_ORDER
      const order = this.orders.find(action.target_id);
      if (order) {
        order.status = action.prev_state_val === 0 ? 'PENDING' : 'PREPARING';
        order.penalty_deduction = 0.0;
        order.refund_amount = 0.0;
        order.cancel_reason = '';
        detailMsg = `Popped Action #${action.action_id}: Restored Order #${action.target_id} from Cancelled back to '${order.status}'.`;
      }
    } else if (action.type === 5) { // PLACE_ORDER
      const order = this.orders.find(action.target_id);
      if (order) {
        order.status = 'CANCELLED';
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
      true,
      itemData.raw_materials || 'Standard ingredients'
    );

    this.menu.insert(node);

    this.actions.push(
      2, // ACTION_ADD_ITEM
      id,
      0,
      0,
      `Added dish "${node.name}" to menu`
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
        `Removed dish "${name}" (#${itemId}) from menu`
      );
      this.saveState();
    }
    return res;
  }

  restockRawMaterial(materialId, delta) {
    const mat = this.rawMaterials.find(m => m.id === materialId);
    if (!mat) return false;
    mat.current_stock = Math.max(0, Number((mat.current_stock + delta).toFixed(2)));
    this.saveState();
    return mat;
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
      actions: system.actions.toArray(),
      raw_materials: system.rawMaterials
    });
  }

  // --- API ROUTE: GET /api/menu ---
  if (method === 'GET' && pathname === '/api/menu') {
    return sendJson(res, 200, system.menu.toArray());
  }

  // --- API ROUTE: GET /api/raw-materials ---
  if (method === 'GET' && pathname === '/api/raw-materials') {
    return sendJson(res, 200, system.rawMaterials);
  }

  // --- API ROUTE: POST /api/raw-materials/restock ---
  if (method === 'POST' && pathname === '/api/raw-materials/restock') {
    try {
      const body = await parseJsonBody(req);
      const { id, delta } = body;
      const mat = system.restockRawMaterial(Number(id), Number(delta));
      if (mat) {
        return sendJson(res, 200, { status: 'ok', material: mat });
      }
      return sendJson(res, 404, { status: 'error', message: 'Material not found' });
    } catch (err) {
      return sendJson(res, 400, { status: 'error', message: err.message });
    }
  }

  // --- API ROUTE: POST /api/orders (Student Places Order) ---
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
        message: `Order #${order.order_id} sent to kitchen.`,
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

  // --- API ROUTE: POST /api/orders/:id/cancel (Cancellation Policy) ---
  const cancelMatch = pathname.match(/^\/api\/orders\/(\d+)\/cancel$/);
  if (method === 'POST' && cancelMatch) {
    const orderId = parseInt(cancelMatch[1]);
    const result = system.cancelOrder(orderId);
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

  // --- API ROUTE: POST /api/menu/item (Add New Dish) ---
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
  console.log(`  CAMPUSBITE - CANTEEN MANAGEMENT SYSTEM`);
  console.log(`  100% Pure Vegetarian | Charcoal & Forest Green Theme`);
  console.log(`  Web Server running at: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
