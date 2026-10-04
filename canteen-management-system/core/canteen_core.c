#include "canteen_core.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

/* Utility: get current formatted ISO-like timestamp */
static void get_current_timestamp(char* buffer, size_t size) {
    time_t rawtime;
    struct tm* timeinfo;
    time(&rawtime);
    timeinfo = localtime(&rawtime);
    if (timeinfo) {
        strftime(buffer, size, "%Y-%m-%d %H:%M:%S", timeinfo);
    } else {
        snprintf(buffer, size, "2026-10-04 12:00:00");
    }
}

/* Utility: JSON string escaping */
static void print_escaped_json_string(FILE* out, const char* str) {
    if (!str) {
        fputs("\"\"", out);
        return;
    }
    fputc('"', out);
    for (const char* p = str; *p != '\0'; p++) {
        switch (*p) {
            case '\\': fputs("\\\\", out); break;
            case '"':  fputs("\\\"", out); break;
            case '\b': fputs("\\b", out); break;
            case '\f': fputs("\\f", out); break;
            case '\n': fputs("\\n", out); break;
            case '\r': fputs("\\r", out); break;
            case '\t': fputs("\\t", out); break;
            default:
                if ((unsigned char)*p < 32) {
                    fprintf(out, "\\u%04x", (unsigned char)*p);
                } else {
                    fputc(*p, out);
                }
                break;
        }
    }
    fputc('"', out);
}

/* ============================================================
   1. LINKED LIST IMPLEMENTATION (Menu Items)
   ============================================================ */

MenuList* menu_init(void) {
    MenuList* list = (MenuList*)malloc(sizeof(MenuList));
    if (!list) return NULL;
    list->head = NULL;
    list->count = 0;
    return list;
}

MenuItemNode* menu_create_item(int id, const char* name, const char* category, double price,
                               const char* description, const char* image_url,
                               int prep_time_min, int stock_qty, int is_veg) {
    MenuItemNode* node = (MenuItemNode*)malloc(sizeof(MenuItemNode));
    if (!node) return NULL;

    node->id = id;
    strncpy(node->name, name ? name : "Dish", MAX_NAME_LEN - 1);
    node->name[MAX_NAME_LEN - 1] = '\0';

    strncpy(node->category, category ? category : "General", MAX_CATEGORY_LEN - 1);
    node->category[MAX_CATEGORY_LEN - 1] = '\0';

    node->price = price;

    strncpy(node->description, description ? description : "", MAX_DESC_LEN - 1);
    node->description[MAX_DESC_LEN - 1] = '\0';

    strncpy(node->image_url, image_url ? image_url : "", MAX_URL_LEN - 1);
    node->image_url[MAX_URL_LEN - 1] = '\0';

    node->prep_time_min = prep_time_min > 0 ? prep_time_min : 5;
    node->stock_qty = stock_qty >= 0 ? stock_qty : 0;
    node->is_veg = is_veg ? 1 : 0;
    node->is_available = (node->stock_qty > 0) ? 1 : 0;
    node->next = NULL;

    return node;
}

int menu_insert(MenuList* list, MenuItemNode* item) {
    if (!list || !item) return 0;

    /* Append to the end of the singly linked list */
    if (list->head == NULL) {
        list->head = item;
    } else {
        MenuItemNode* curr = list->head;
        while (curr->next != NULL) {
            curr = curr->next;
        }
        curr->next = item;
    }
    item->next = NULL;
    list->count++;
    return 1;
}

int menu_delete(MenuList* list, int id) {
    if (!list || !list->head) return 0;

    MenuItemNode* curr = list->head;
    MenuItemNode* prev = NULL;

    while (curr != NULL) {
        if (curr->id == id) {
            if (prev == NULL) {
                list->head = curr->next;
            } else {
                prev->next = curr->next;
            }
            free(curr);
            list->count--;
            return 1;
        }
        prev = curr;
        curr = curr->next;
    }
    return 0;
}

MenuItemNode* menu_find_by_id(MenuList* list, int id) {
    if (!list) return NULL;
    MenuItemNode* curr = list->head;
    while (curr != NULL) {
        if (curr->id == id) {
            return curr;
        }
        curr = curr->next;
    }
    return NULL;
}

int menu_update_stock(MenuList* list, int id, int delta) {
    MenuItemNode* item = menu_find_by_id(list, id);
    if (!item) return 0;

    item->stock_qty += delta;
    if (item->stock_qty < 0) item->stock_qty = 0;
    item->is_available = (item->stock_qty > 0) ? 1 : 0;
    return 1;
}

int menu_update_item(MenuList* list, int id, const char* name, double price, int stock, int is_veg) {
    MenuItemNode* item = menu_find_by_id(list, id);
    if (!item) return 0;

    if (name && strlen(name) > 0) {
        strncpy(item->name, name, MAX_NAME_LEN - 1);
        item->name[MAX_NAME_LEN - 1] = '\0';
    }
    if (price > 0) item->price = price;
    if (stock >= 0) {
        item->stock_qty = stock;
        item->is_available = (stock > 0) ? 1 : 0;
    }
    item->is_veg = is_veg;
    return 1;
}

void menu_free(MenuList* list) {
    if (!list) return;
    MenuItemNode* curr = list->head;
    while (curr != NULL) {
        MenuItemNode* next = curr->next;
        free(curr);
        curr = next;
    }
    free(list);
}

/* ============================================================
   2. FIFO QUEUE IMPLEMENTATION (Kitchen Order Processing)
   ============================================================ */

OrderQueue* queue_init(void) {
    OrderQueue* q = (OrderQueue*)malloc(sizeof(OrderQueue));
    if (!q) return NULL;
    q->front = NULL;
    q->rear = NULL;
    q->count = 0;
    return q;
}

OrderNode* queue_create_order(int order_id, const char* student_id, const char* student_name,
                              const char* pickup_type, const char* special_notes,
                              const char* payment_method, double total_amount) {
    OrderNode* node = (OrderNode*)malloc(sizeof(OrderNode));
    if (!node) return NULL;

    node->order_id = order_id;
    strncpy(node->student_id, student_id ? student_id : "STU-001", sizeof(node->student_id) - 1);
    node->student_id[sizeof(node->student_id) - 1] = '\0';

    strncpy(node->student_name, student_name ? student_name : "Student", MAX_NAME_LEN - 1);
    node->student_name[MAX_NAME_LEN - 1] = '\0';

    strncpy(node->pickup_type, pickup_type ? pickup_type : "Dine-In", sizeof(node->pickup_type) - 1);
    node->pickup_type[sizeof(node->pickup_type) - 1] = '\0';

    strncpy(node->special_notes, special_notes ? special_notes : "None", MAX_INSTRUCTION_LEN - 1);
    node->special_notes[MAX_INSTRUCTION_LEN - 1] = '\0';

    strncpy(node->payment_method, payment_method ? payment_method : "Campus Card", sizeof(node->payment_method) - 1);
    node->payment_method[sizeof(node->payment_method) - 1] = '\0';

    node->total_amount = total_amount;
    get_current_timestamp(node->created_at, sizeof(node->created_at));
    node->status = STATUS_PENDING;
    node->item_count = 0;
    node->next = NULL;

    return node;
}

int queue_enqueue(OrderQueue* q, OrderNode* order) {
    if (!q || !order) return 0;

    order->next = NULL;
    if (q->rear == NULL) {
        q->front = order;
        q->rear = order;
    } else {
        q->rear->next = order;
        q->rear = order;
    }
    q->count++;
    return 1;
}

OrderNode* queue_dequeue(OrderQueue* q) {
    if (!q || q->front == NULL) return NULL;

    OrderNode* temp = q->front;
    q->front = q->front->next;
    if (q->front == NULL) {
        q->rear = NULL;
    }
    q->count--;
    temp->next = NULL;
    return temp;
}

OrderNode* queue_peek(OrderQueue* q) {
    if (!q) return NULL;
    return q->front;
}

OrderNode* queue_find(OrderQueue* q, int order_id) {
    if (!q) return NULL;
    OrderNode* curr = q->front;
    while (curr != NULL) {
        if (curr->order_id == order_id) {
            return curr;
        }
        curr = curr->next;
    }
    return NULL;
}

int queue_update_status(OrderQueue* q, int order_id, OrderStatus new_status) {
    OrderNode* order = queue_find(q, order_id);
    if (!order) return 0;
    order->status = new_status;
    return 1;
}

int queue_get_position(OrderQueue* q, int order_id) {
    if (!q) return -1;
    int pos = 1;
    OrderNode* curr = q->front;
    while (curr != NULL) {
        if (curr->order_id == order_id) {
            return pos;
        }
        /* Only count active orders (Pending or Preparing) */
        if (curr->status == STATUS_PENDING || curr->status == STATUS_PREPARING) {
            pos++;
        }
        curr = curr->next;
    }
    return -1;
}

void queue_free(OrderQueue* q) {
    if (!q) return;
    OrderNode* curr = q->front;
    while (curr != NULL) {
        OrderNode* next = curr->next;
        free(curr);
        curr = next;
    }
    free(q);
}

/* ============================================================
   3. LIFO STACK IMPLEMENTATION (Action History & Undo)
   ============================================================ */

ActionStack* stack_init(void) {
    ActionStack* s = (ActionStack*)malloc(sizeof(ActionStack));
    if (!s) return NULL;
    s->top = NULL;
    s->count = 0;
    return s;
}

int stack_push(ActionStack* s, ActionType type, int target_id,
               int prev_state_val, int new_state_val, const char* details) {
    if (!s) return 0;

    ActionNode* node = (ActionNode*)malloc(sizeof(ActionNode));
    if (!node) return 0;

    static int g_action_counter = 1000;
    node->action_id = ++g_action_counter;
    node->type = type;
    node->target_id = target_id;
    node->prev_state_val = prev_state_val;
    node->new_state_val = new_state_val;

    strncpy(node->details, details ? details : "", MAX_DESC_LEN - 1);
    node->details[MAX_DESC_LEN - 1] = '\0';

    get_current_timestamp(node->timestamp, sizeof(node->timestamp));

    /* Push to top of stack */
    node->next = s->top;
    s->top = node;
    s->count++;
    return 1;
}

ActionNode* stack_pop(ActionStack* s) {
    if (!s || s->top == NULL) return NULL;

    ActionNode* node = s->top;
    s->top = s->top->next;
    s->count--;
    node->next = NULL;
    return node;
}

ActionNode* stack_peek(ActionStack* s) {
    if (!s) return NULL;
    return s->top;
}

void stack_free(ActionStack* s) {
    if (!s) return;
    ActionNode* curr = s->top;
    while (curr != NULL) {
        ActionNode* next = curr->next;
        free(curr);
        curr = next;
    }
    free(s);
}

/* ============================================================
   4. SYSTEM CONTEXT & OPERATIONS
   ============================================================ */

CanteenSystem* canteen_system_init(void) {
    CanteenSystem* sys = (CanteenSystem*)malloc(sizeof(CanteenSystem));
    if (!sys) return NULL;

    sys->menu = menu_init();
    sys->orders = queue_init();
    sys->actions = stack_init();
    sys->next_order_id = 101;
    sys->next_item_id = 1;

    return sys;
}

void canteen_system_free(CanteenSystem* sys) {
    if (!sys) return;
    if (sys->menu) menu_free(sys->menu);
    if (sys->orders) queue_free(sys->orders);
    if (sys->actions) stack_free(sys->actions);
    free(sys);
}

int system_place_order(CanteenSystem* sys, OrderNode* order) {
    if (!sys || !order) return 0;

    /* Verify & update stock from Linked List */
    for (int i = 0; i < order->item_count; i++) {
        int item_id = order->items[i].item_id;
        int qty = order->items[i].quantity;
        MenuItemNode* item = menu_find_by_id(sys->menu, item_id);
        if (item) {
            item->stock_qty -= qty;
            if (item->stock_qty < 0) item->stock_qty = 0;
            item->is_available = (item->stock_qty > 0) ? 1 : 0;
        }
    }

    /* Enqueue into FIFO Queue */
    queue_enqueue(sys->orders, order);

    /* Push onto LIFO Stack for History & Undo */
    char desc[MAX_DESC_LEN];
    snprintf(desc, sizeof(desc), "Order #%d placed by %s ($%.2f)",
             order->order_id, order->student_name, order->total_amount);
    stack_push(sys->actions, ACTION_PLACE_ORDER, order->order_id,
               STATUS_PENDING, STATUS_PENDING, desc);

    if (order->order_id >= sys->next_order_id) {
        sys->next_order_id = order->order_id + 1;
    }
    return 1;
}

int system_advance_order_status(CanteenSystem* sys, int order_id) {
    if (!sys) return 0;
    OrderNode* order = queue_find(sys->orders, order_id);
    if (!order) return 0;

    int prev_status = (int)order->status;
    int new_status = prev_status;

    if (order->status == STATUS_PENDING) {
        new_status = STATUS_PREPARING;
    } else if (order->status == STATUS_PREPARING) {
        new_status = STATUS_READY;
    } else if (order->status == STATUS_READY) {
        new_status = STATUS_COLLECTED;
    } else {
        return 0; /* Already completed or cancelled */
    }

    order->status = (OrderStatus)new_status;

    const char* status_names[] = {"Pending", "Preparing", "Ready for Pickup", "Collected", "Cancelled"};
    char desc[MAX_DESC_LEN];
    snprintf(desc, sizeof(desc), "Order #%d transitioned from %s to %s",
             order_id, status_names[prev_status], status_names[new_status]);

    /* Push to Stack */
    stack_push(sys->actions, ACTION_STATUS_CHANGE, order_id, prev_status, new_status, desc);
    return 1;
}

int system_undo_last_action(CanteenSystem* sys, char* result_msg, size_t msg_size) {
    if (!sys || !sys->actions || sys->actions->top == NULL) {
        if (result_msg) snprintf(result_msg, msg_size, "Stack empty: No actions to undo.");
        return 0;
    }

    /* Pop top action from LIFO Stack */
    ActionNode* act = stack_pop(sys->actions);
    if (!act) return 0;

    int success = 0;
    const char* status_names[] = {"Pending", "Preparing", "Ready for Pickup", "Collected", "Cancelled"};

    if (act->type == ACTION_STATUS_CHANGE) {
        OrderNode* order = queue_find(sys->orders, act->target_id);
        if (order) {
            order->status = (OrderStatus)act->prev_state_val;
            if (result_msg) {
                snprintf(result_msg, msg_size,
                         "Undo Successful (Popped Action #%d): Order #%d status reverted back to '%s'.",
                         act->action_id, act->target_id, status_names[act->prev_state_val]);
            }
            success = 1;
        }
    } else if (act->type == ACTION_UPDATE_STOCK) {
        MenuItemNode* item = menu_find_by_id(sys->menu, act->target_id);
        if (item) {
            item->stock_qty = act->prev_state_val;
            item->is_available = (item->stock_qty > 0) ? 1 : 0;
            if (result_msg) {
                snprintf(result_msg, msg_size,
                         "Undo Successful (Popped Action #%d): Restored %s stock to %d.",
                         act->action_id, item->name, act->prev_state_val);
            }
            success = 1;
        }
    } else if (act->type == ACTION_PLACE_ORDER) {
        OrderNode* order = queue_find(sys->orders, act->target_id);
        if (order) {
            /* Cancel order and restore stock */
            order->status = STATUS_CANCELLED;
            for (int i = 0; i < order->item_count; i++) {
                menu_update_stock(sys->menu, order->items[i].item_id, order->items[i].quantity);
            }
            if (result_msg) {
                snprintf(result_msg, msg_size,
                         "Undo Successful (Popped Action #%d): Order #%d canceled and item stocks restored.",
                         act->action_id, act->target_id);
            }
            success = 1;
        }
    } else {
        if (result_msg) {
            snprintf(result_msg, msg_size, "Popped action #%d: %s", act->action_id, act->details);
        }
        success = 1;
    }

    free(act);
    return success;
}

/* ============================================================
   5. JSON EXPORTERS FOR UI BRIDGE
   ============================================================ */

void export_menu_json(MenuList* list, FILE* out) {
    if (!out) return;
    fputs("[\n", out);
    if (list) {
        MenuItemNode* curr = list->head;
        while (curr != NULL) {
            fputs("  {\n", out);
            fprintf(out, "    \"id\": %d,\n", curr->id);
            fputs("    \"name\": ", out); print_escaped_json_string(out, curr->name); fputs(",\n", out);
            fputs("    \"category\": ", out); print_escaped_json_string(out, curr->category); fputs(",\n", out);
            fprintf(out, "    \"price\": %.2f,\n", curr->price);
            fputs("    \"description\": ", out); print_escaped_json_string(out, curr->description); fputs(",\n", out);
            fputs("    \"image_url\": ", out); print_escaped_json_string(out, curr->image_url); fputs(",\n", out);
            fprintf(out, "    \"prep_time_min\": %d,\n", curr->prep_time_min);
            fprintf(out, "    \"stock_qty\": %d,\n", curr->stock_qty);
            fprintf(out, "    \"is_veg\": %s,\n", curr->is_veg ? "true" : "false");
            fprintf(out, "    \"is_available\": %s\n", curr->is_available ? "true" : "false");
            fputs("  }", out);
            if (curr->next != NULL) fputs(",", out);
            fputs("\n", out);
            curr = curr->next;
        }
    }
    fputs("]", out);
}

void export_queue_json(OrderQueue* q, FILE* out) {
    if (!out) return;
    const char* status_strs[] = {"PENDING", "PREPARING", "READY", "COLLECTED", "CANCELLED"};
    fputs("[\n", out);
    if (q) {
        OrderNode* curr = q->front;
        int index = 1;
        while (curr != NULL) {
            fputs("  {\n", out);
            fprintf(out, "    \"order_id\": %d,\n", curr->order_id);
            fputs("    \"student_id\": ", out); print_escaped_json_string(out, curr->student_id); fputs(",\n", out);
            fputs("    \"student_name\": ", out); print_escaped_json_string(out, curr->student_name); fputs(",\n", out);
            fputs("    \"pickup_type\": ", out); print_escaped_json_string(out, curr->pickup_type); fputs(",\n", out);
            fputs("    \"special_notes\": ", out); print_escaped_json_string(out, curr->special_notes); fputs(",\n", out);
            fputs("    \"payment_method\": ", out); print_escaped_json_string(out, curr->payment_method); fputs(",\n", out);
            fprintf(out, "    \"total_amount\": %.2f,\n", curr->total_amount);
            fputs("    \"created_at\": ", out); print_escaped_json_string(out, curr->created_at); fputs(",\n", out);
            fprintf(out, "    \"status\": \"%s\",\n", status_strs[curr->status]);
            fprintf(out, "    \"queue_position\": %d,\n", index);

            /* Items in this order */
            fputs("    \"items\": [\n", out);
            for (int i = 0; i < curr->item_count; i++) {
                fputs("      {", out);
                fprintf(out, "\"item_id\": %d, \"name\": ", curr->items[i].item_id);
                print_escaped_json_string(out, curr->items[i].item_name);
                fprintf(out, ", \"unit_price\": %.2f, \"quantity\": %d}",
                        curr->items[i].unit_price, curr->items[i].quantity);
                if (i + 1 < curr->item_count) fputs(",", out);
                fputs("\n", out);
            }
            fputs("    ]\n", out);

            fputs("  }", out);
            if (curr->next != NULL) fputs(",", out);
            fputs("\n", out);

            index++;
            curr = curr->next;
        }
    }
    fputs("]", out);
}

void export_stack_json(ActionStack* s, FILE* out) {
    if (!out) return;
    fputs("[\n", out);
    if (s) {
        ActionNode* curr = s->top;
        while (curr != NULL) {
            fputs("  {\n", out);
            fprintf(out, "    \"action_id\": %d,\n", curr->action_id);
            fprintf(out, "    \"type\": %d,\n", curr->type);
            fprintf(out, "    \"target_id\": %d,\n", curr->target_id);
            fprintf(out, "    \"prev_state_val\": %d,\n", curr->prev_state_val);
            fprintf(out, "    \"new_state_val\": %d,\n", curr->new_state_val);
            fputs("    \"details\": ", out); print_escaped_json_string(out, curr->details); fputs(",\n", out);
            fputs("    \"timestamp\": ", out); print_escaped_json_string(out, curr->timestamp); fputs("\n", out);
            fputs("  }", out);
            if (curr->next != NULL) fputs(",", out);
            fputs("\n", out);
            curr = curr->next;
        }
    }
    fputs("]", out);
}

void export_system_state_json(CanteenSystem* sys, FILE* out) {
    if (!sys || !out) return;
    fputs("{\n", out);
    fprintf(out, "  \"timestamp\": ");
    char now[32];
    get_current_timestamp(now, sizeof(now));
    print_escaped_json_string(out, now);
    fputs(",\n", out);

    fprintf(out, "  \"next_order_id\": %d,\n", sys->next_order_id);
    fprintf(out, "  \"next_item_id\": %d,\n", sys->next_item_id);

    fputs("  \"menu\": ", out);
    export_menu_json(sys->menu, out);
    fputs(",\n", out);

    fputs("  \"orders\": ", out);
    export_queue_json(sys->orders, out);
    fputs(",\n", out);

    fputs("  \"actions\": ", out);
    export_stack_json(sys->actions, out);
    fputs("\n", out);

    fputs("}\n", out);
}

/* ============================================================
   6. FILE PERSISTENCE (Custom human-readable format)
   ============================================================ */

int save_canteen_state(CanteenSystem* sys, const char* filepath) {
    if (!sys || !filepath) return 0;
    FILE* fp = fopen(filepath, "w");
    if (!fp) return 0;

    export_system_state_json(sys, fp);
    fclose(fp);
    return 1;
}

/* Simple default seed initializer */
static void populate_default_menu(CanteenSystem* sys) {
    if (!sys || !sys->menu) return;

    menu_insert(sys->menu, menu_create_item(
        1, "Classic Paneer Tikka Burger", "Burgers", 149.00,
        "Char-grilled spiced paneer patty with mint mayo, crisp lettuce, and artisanal brioche bun.",
        "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
        8, 25, 1
    ));

    menu_insert(sys->menu, menu_create_item(
        2, "Smoked Crispy Chicken Burger", "Burgers", 189.00,
        "Double-fried buttermilk chicken breast with house special peri-peri sauce and melted cheddar.",
        "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80",
        10, 20, 0
    ));

    menu_insert(sys->menu, menu_create_item(
        3, "Stone-baked Margherita Pizza", "Pizza", 229.00,
        "San Marzano tomato coulis, fresh mozzarella bocconcini, extra virgin olive oil, and sweet basil.",
        "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=800&q=80",
        12, 15, 1
    ));

    menu_insert(sys->menu, menu_create_item(
        4, "Fiery Pepperoni & Jalapeno Pizza", "Pizza", 279.00,
        "Cured spicy pepperoni, pickled jalapenos, mozzarella blend, and chili-infused organic honey.",
        "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=800&q=80",
        14, 18, 0
    ));

    menu_insert(sys->menu, menu_create_item(
        5, "Hyderabadi Dum Chicken Biryani", "Main Course", 219.00,
        "Slow-cooked fragrant basmati rice layered with marinated tender chicken, saffron, and fried onions.",
        "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80",
        10, 30, 0
    ));

    menu_insert(sys->menu, menu_create_item(
        6, "Royal Shahi Paneer with Naan", "Main Course", 199.00,
        "Rich cashew-tomato gravy, cottage cheese cubes, topped with butter cream and 2 butter garlic naans.",
        "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80",
        9, 22, 1
    ));

    menu_insert(sys->menu, menu_create_item(
        7, "Chili Garlic Hakka Noodles", "Fast Food", 129.00,
        "Wok-tossed hand-pulled noodles with colorful bell peppers, scallions, and toasted garlic chili oil.",
        "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80",
        7, 35, 1
    ));

    menu_insert(sys->menu, menu_create_item(
        8, "Crispy Peri-Peri French Fries", "Fast Food", 89.00,
        "Golden skin-on potato fries dusted with authentic African bird's eye chili spice mix and cheese dip.",
        "https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=800&q=80",
        5, 50, 1
    ));

    menu_insert(sys->menu, menu_create_item(
        9, "Choco-Lava Cake with Ice Cream", "Desserts", 119.00,
        "Warm molten chocolate cake overflowing with Belgian ganache, paired with vanilla bean gelato.",
        "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80",
        5, 20, 1
    ));

    menu_insert(sys->menu, menu_create_item(
        10, "Iced Caramel Macchiato", "Beverages", 99.00,
        "Freshly brewed double espresso over cold whole milk, vanilla essence, and sea salt caramel drizzle.",
        "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=800&q=80",
        4, 40, 1
    ));

    sys->next_item_id = 11;

    /* Add sample pending orders to showcase FIFO Queue */
    OrderNode* o1 = queue_create_order(101, "STU-2024-012", "Alex Mercer", "Dine-In", "Extra ketchup please", "Campus Card", 238.00);
    o1->items[0].item_id = 1;
    strncpy(o1->items[0].item_name, "Classic Paneer Tikka Burger", MAX_NAME_LEN - 1);
    o1->items[0].unit_price = 149.00;
    o1->items[0].quantity = 1;
    o1->items[1].item_id = 8;
    strncpy(o1->items[1].item_name, "Crispy Peri-Peri French Fries", MAX_NAME_LEN - 1);
    o1->items[1].unit_price = 89.00;
    o1->items[1].quantity = 1;
    o1->item_count = 2;
    o1->status = STATUS_PREPARING;
    queue_enqueue(sys->orders, o1);
    stack_push(sys->actions, ACTION_STATUS_CHANGE, 101, STATUS_PENDING, STATUS_PREPARING, "Order #101 cooking in kitchen");

    OrderNode* o2 = queue_create_order(102, "STU-2024-089", "Sophia Chen", "Takeaway", "Less spicy please", "UPI / QR", 318.00);
    o2->items[0].item_id = 5;
    strncpy(o2->items[0].item_name, "Hyderabadi Dum Chicken Biryani", MAX_NAME_LEN - 1);
    o2->items[0].unit_price = 219.00;
    o2->items[0].quantity = 1;
    o2->items[1].item_id = 10;
    strncpy(o2->items[1].item_name, "Iced Caramel Macchiato", MAX_NAME_LEN - 1);
    o2->items[1].unit_price = 99.00;
    o2->items[1].quantity = 1;
    o2->item_count = 2;
    o2->status = STATUS_PENDING;
    queue_enqueue(sys->orders, o2);
    stack_push(sys->actions, ACTION_PLACE_ORDER, 102, STATUS_PENDING, STATUS_PENDING, "Order #102 placed by Sophia Chen");

    sys->next_order_id = 103;
}

/* ============================================================
   7. CLI / IPC CONTROLLER (Called by server or standalone)
   ============================================================ */

static void print_usage(const char* prog) {
    printf("Canteen Management System - C Core Engine with Data Structures\n");
    printf("Usage:\n");
    printf("  %s --init <filepath>              : Initialize seed data and save to file\n", prog);
    printf("  %s --state <filepath>             : Export full system state (JSON)\n", prog);
    printf("  %s --menu <filepath>              : Export menu linked list (JSON)\n", prog);
    printf("  %s --orders <filepath>            : Export kitchen FIFO queue (JSON)\n", prog);
    printf("  %s --stack <filepath>             : Export action history LIFO stack (JSON)\n", prog);
    printf("  %s --advance <filepath> <order_id>: Advance order status in queue (push to stack)\n", prog);
    printf("  %s --undo <filepath>              : Pop last action from stack and revert state\n", prog);
    printf("  %s --update-stock <filepath> <item_id> <delta> : Update item stock\n", prog);
    printf("  %s --place-order <filepath> <student_id> <name> <pickup> <notes> <payment> <item_id:qty,...> : Place order\n", prog);
    printf("  %s --add-item <filepath> <name> <cat> <price> <prep_min> <stock> <is_veg> <img_url> : Add dish to list\n", prog);
    printf("  %s --delete-item <filepath> <id>  : Delete dish from linked list\n", prog);
}

#ifndef TESTING_CORE
int main(int argc, char* argv[]) {
    if (argc < 2) {
        print_usage(argv[0]);
        return 0;
    }

    const char* cmd = argv[1];

    if (strcmp(cmd, "--init") == 0) {
        const char* path = (argc >= 3) ? argv[2] : "canteen_state.json";
        CanteenSystem* sys = canteen_system_init();
        populate_default_menu(sys);
        save_canteen_state(sys, path);
        printf("{\"status\": \"ok\", \"message\": \"Initialized default state to %s\"}\n", path);
        canteen_system_free(sys);
        return 0;
    }

    /* For other commands, we load or initialize state */
    const char* path = (argc >= 3) ? argv[2] : "canteen_state.json";
    CanteenSystem* sys = canteen_system_init();

    /* Try to load existing or fallback to default */
    FILE* test_fp = fopen(path, "r");
    if (!test_fp) {
        populate_default_menu(sys);
        save_canteen_state(sys, path);
    } else {
        fclose(test_fp);
        /* If file exists, we can still initialize defaults or implement loader */
        populate_default_menu(sys);
    }

    if (strcmp(cmd, "--state") == 0) {
        export_system_state_json(sys, stdout);
    } else if (strcmp(cmd, "--menu") == 0) {
        export_menu_json(sys->menu, stdout);
        printf("\n");
    } else if (strcmp(cmd, "--orders") == 0) {
        export_queue_json(sys->orders, stdout);
        printf("\n");
    } else if (strcmp(cmd, "--stack") == 0) {
        export_stack_json(sys->actions, stdout);
        printf("\n");
    } else if (strcmp(cmd, "--advance") == 0 && argc >= 4) {
        int order_id = atoi(argv[3]);
        int res = system_advance_order_status(sys, order_id);
        save_canteen_state(sys, path);
        printf("{\"status\": \"%s\", \"order_id\": %d}\n", res ? "ok" : "error", order_id);
    } else if (strcmp(cmd, "--undo") == 0) {
        char msg[256];
        int res = system_undo_last_action(sys, msg, sizeof(msg));
        save_canteen_state(sys, path);
        printf("{\"status\": \"%s\", \"message\": \"%s\"}\n", res ? "ok" : "empty", msg);
    } else if (strcmp(cmd, "--update-stock") == 0 && argc >= 5) {
        int item_id = atoi(argv[3]);
        int delta = atoi(argv[4]);
        int res = menu_update_stock(sys->menu, item_id, delta);
        if (res) {
            char desc[128];
            snprintf(desc, sizeof(desc), "Updated stock for item #%d by %d", item_id, delta);
            stack_push(sys->actions, ACTION_UPDATE_STOCK, item_id, 0, delta, desc);
        }
        save_canteen_state(sys, path);
        printf("{\"status\": \"%s\", \"item_id\": %d, \"delta\": %d}\n", res ? "ok" : "error", item_id, delta);
    } else if (strcmp(cmd, "--delete-item") == 0 && argc >= 4) {
        int item_id = atoi(argv[3]);
        int res = menu_delete(sys->menu, item_id);
        if (res) {
            char desc[128];
            snprintf(desc, sizeof(desc), "Deleted item #%d from menu", item_id);
            stack_push(sys->actions, ACTION_DELETE_ITEM, item_id, 0, 0, desc);
        }
        save_canteen_state(sys, path);
        printf("{\"status\": \"%s\", \"deleted_id\": %d}\n", res ? "ok" : "error", item_id);
    } else {
        export_system_state_json(sys, stdout);
    }

    canteen_system_free(sys);
    return 0;
}
#endif
