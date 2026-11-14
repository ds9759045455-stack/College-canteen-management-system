# Hitahara — Modern Canteen Management System

**Hitahara** is a modern, premium Canteen Management System powered by a **pure C core data structures engine** (featuring Linked List, FIFO Queue, and LIFO Stack) combined with an **ultra-clean, modern hospitality user interface**. It features dedicated portals for **Students** and **Staff**, protected by a **4-Digit Staff Security PIN**, and appetizing food photography.

---

## 🌟 Key Highlights

### 1. Clean, High-End Hospitality Design
- **Hitahara Branding**: Warm, appetizing, minimalist bistro theme with subtle glassmorphic touches.
- **Zero Technical Clutter**: Replaces raw geeky nomenclature with intuitive, consumer-grade food service terms (*"In Kitchen"*, *"Ready for Pickup"*, *"Order # in Line"*, *"Portions Available"*).
- **High-Definition Food Photography**: Mouthwatering visuals for all dishes with pure veg badges, prep times, and available stock.

### 2. Staff Security PIN Gate
- **Protected Access**: Switching to the **Staff Portal** triggers a luxury security PIN modal with a numeric keypad.
- **Default PIN**: `1234`
- **Instant Portal Lock**: Staff can lock the portal with one click to keep customer data and kitchen operations secure.

### 3. Under the Hood: Pure C Data Structures Engine
While the user interface remains clean, modern, and consumer-focused, the system's core algorithms strictly utilize standard Computer Science data structures:
- **Singly Linked List (`MenuList`)**: Powers the dynamic menu inventory. Dish nodes can be added, deleted, or restocked in real-time.
- **FIFO Queue (`OrderQueue`)**: Powers the kitchen order line. Orders enter at the rear and are cooked/dispatched in strict arrival sequence from the front.
- **LIFO Stack (`ActionHistoryStack`)**: Powers the **"Undo Last Action"** feature. Every order update is pushed to the stack; clicking Undo pops the last action and reverts the order status or stock.

---

## 📁 Directory Structure

```
canteen-management-system/
├── core/
│   ├── canteen_core.h          # C structs: MenuItemNode, OrderNode, OrderQueue, ActionStack
│   ├── canteen_core.c          # Pure C implementation of DSA algorithms + JSON exporter
│   ├── test_core.c             # Unit test suite for Linked List, Queue, and Stack
│   ├── canteen_core.exe        # Compiled native C executable
│   └── test_core.exe           # Compiled test suite executable
├── server/
│   ├── server.js               # Zero-dependency Node.js HTTP bridge server & REST API
│   └── data/
│       └── canteen_state.json  # Synchronized persistent state
├── public/
│   ├── index.html              # Luxury single-page application UI
│   ├── css/styles.css          # Clean animations, custom scrollbars, and PIN keypad
│   └── js/
│       ├── app.js              # State polling, PIN security gate, and view router
│       ├── student-view.js     # Student menu, tray cart, and live order tracking
│       └── staff-view.js       # Live kitchen dispatch board and instant action rollback
├── start.bat                   # One-click Windows launcher
└── README.md                   # Complete system documentation
```

---

## 🚀 How to Run

1. **One-Click Launch**:
   Double click `start.bat` in the project root.
2. **Open in Browser**:
   Navigate to **[http://localhost:3000](http://localhost:3000)**.
3. **Staff PIN**:
   Default PIN is `1234`.
