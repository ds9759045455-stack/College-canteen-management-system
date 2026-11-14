#include "canteen_core.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

/* Utility: get current formatted ISO timestamp */
static void get_current_timestamp(char* buffer, size_t size) {
    time_t rawtime;
    struct tm* timeinfo;
    time(&rawtime);
    timeinfo = localtime(&rawtime);
    if (timeinfo) {
        strftime(buffer, size, "%Y-%m-%d %H:%M:%S", timeinfo);
    } else {
        snprintf(buffer, size, "2026-11-14 12:00:00");
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
                               int prep_time_min, int stock_qty, int is_veg,
                               const char* raw_materials) {
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
    node->is_veg = 1; /* 100% Pure Veg in Campusbite */
    node->is_available = (node->stock_qty > 0) ? 1 : 0;

    strncpy(node->raw_materials, raw_materials ? raw_materials : "Standard fresh ingredients", MAX_RAW_MATERIALS_LEN - 1);
    node->raw_materials[MAX_RAW_MATERIALS_LEN - 1] = '\0';

    node->next = NULL;
    return node;
}

int menu_insert(MenuList* list, MenuItemNode* item) {
    if (!list || !item) return 0;

    /* Append to the end of singly linked list */
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

int menu_update_item(MenuList* list, int id, const char* name, double price, int stock, int is_veg, const char* raw_materials) {
    (void)is_veg; /* Campusbite is strictly 100% Pure Veg */
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
    if (raw_materials && strlen(raw_materials) > 0) {
        strncpy(item->raw_materials, raw_materials, MAX_RAW_MATERIALS_LEN - 1);
        item->raw_materials[MAX_RAW_MATERIALS_LEN - 1] = '\0';
    }
    item->is_veg = 1;
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
    node->penalty_deduction = 0.0;
    node->refund_amount = 0.0;
    node->cancel_reason[0] = '\0';

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

    /* Push onto LIFO Stack */
    char desc[MAX_DESC_LEN];
    snprintf(desc, sizeof(desc), "Order #%d placed by %s (Rs. %.2f)",
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

/**
 * Cancellation Policy:
 * 1. If cancelled BEFORE cooking starts (STATUS_PENDING):
 *    - 100% refund, 0% penalty.
 *    - Stock is restored to Linked List.
 * 2. If cancelled AFTER cooking starts (STATUS_PREPARING):
 *    - 35% amount deducted/charged by management for preparation & food loss.
 *    - 65% refund returned.
 * 3. If STATUS_READY, STATUS_COLLECTED, or already CANCELLED:
 *    - Cannot cancel.
 */
int system_cancel_order(CanteenSystem* sys, int order_id, double* out_penalty, double* out_refund, char* out_msg, size_t msg_size) {
    if (!sys) return 0;
    OrderNode* order = queue_find(sys->orders, order_id);
    if (!order) {
        if (out_msg) snprintf(out_msg, msg_size, "Order #%d not found.", order_id);
        return 0;
    }

    if (order->status == STATUS_CANCELLED) {
        if (out_msg) snprintf(out_msg, msg_size, "Order #%d is already cancelled.", order_id);
        return 0;
    }
    if (order->status == STATUS_READY || order->status == STATUS_COLLECTED) {
        if (out_msg) snprintf(out_msg, msg_size, "Order #%d is already ready or collected and cannot be cancelled.", order_id);
        return 0;
    }

    int prev_status = (int)order->status;
    double penalty = 0.0;
    double refund = 0.0;

    if (order->status == STATUS_PENDING) {
        /* Cancellation before cooking starts: 100% refund, 0% deduction */
        penalty = 0.0;
        refund = order->total_amount;
        order->penalty_deduction = penalty;
        order->refund_amount = refund;
        order->status = STATUS_CANCELLED;
        strncpy(order->cancel_reason, "Cancelled before cooking started (100% refund)", MAX_DESC_LEN - 1);

        /* Restore stock in Linked List */
        for (int i = 0; i < order->item_count; i++) {
            menu_update_stock(sys->menu, order->items[i].item_id, order->items[i].quantity);
        }

        if (out_msg) {
            snprintf(out_msg, msg_size,
                     "Order #%d cancelled before cooking. 100%% refund of Rs. %.2f processed. (0%% penalty).",
                     order_id, refund);
        }
    } else if (order->status == STATUS_PREPARING) {
        /* Cancellation after cooking starts: 35% deduction charged by management */
        penalty = (order->total_amount * 0.35);
        refund = order->total_amount - penalty;
        order->penalty_deduction = penalty;
        order->refund_amount = refund;
        order->status = STATUS_CANCELLED;
        strncpy(order->cancel_reason, "Cancelled after cooking commenced (35% management charge applied)", MAX_DESC_LEN - 1);

        if (out_msg) {
            snprintf(out_msg, msg_size,
                     "Order #%d cancelled during preparation. 35%% management fee of Rs. %.2f deducted. Refund of Rs. %.2f processed.",
                     order_id, penalty, refund);
        }
    }

    if (out_penalty) *out_penalty = penalty;
    if (out_refund) *out_refund = refund;

    /* Push cancellation event to LIFO Stack */
    char desc[MAX_DESC_LEN];
    snprintf(desc, sizeof(desc), "Order #%d CANCELLED (Fee: Rs. %.2f, Refund: Rs. %.2f)",
             order_id, penalty, refund);
    stack_push(sys->actions, ACTION_CANCEL_ORDER, order_id, prev_status, STATUS_CANCELLED, desc);

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
                         "Undo Successful: Order #%d status reverted to '%s'.",
                         act->target_id, status_names[act->prev_state_val]);
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
                         "Undo Successful: Restored %s stock to %d.",
                         item->name, act->prev_state_val);
            }
            success = 1;
        }
    } else if (act->type == ACTION_CANCEL_ORDER) {
        OrderNode* order = queue_find(sys->orders, act->target_id);
        if (order) {
            order->status = (OrderStatus)act->prev_state_val;
            order->penalty_deduction = 0.0;
            order->refund_amount = 0.0;
            order->cancel_reason[0] = '\0';
            if (result_msg) {
                snprintf(result_msg, msg_size,
                         "Undo Successful: Restored Order #%d from Cancelled to '%s'.",
                         act->target_id, status_names[act->prev_state_val]);
            }
            success = 1;
        }
    } else if (act->type == ACTION_PLACE_ORDER) {
        OrderNode* order = queue_find(sys->orders, act->target_id);
        if (order) {
            order->status = STATUS_CANCELLED;
            for (int i = 0; i < order->item_count; i++) {
                menu_update_stock(sys->menu, order->items[i].item_id, order->items[i].quantity);
            }
            if (result_msg) {
                snprintf(result_msg, msg_size,
                         "Undo Successful: Order #%d cancelled and item stocks restored.",
                         act->target_id);
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
            fprintf(out, "    \"is_available\": %s,\n", curr->is_available ? "true" : "false");
            fputs("    \"raw_materials\": ", out); print_escaped_json_string(out, curr->raw_materials); fputs("\n", out);
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
            fprintf(out, "    \"penalty_deduction\": %.2f,\n", curr->penalty_deduction);
            fprintf(out, "    \"refund_amount\": %.2f,\n", curr->refund_amount);
            fputs("    \"cancel_reason\": ", out); print_escaped_json_string(out, curr->cancel_reason); fputs(",\n", out);
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

int save_canteen_state(CanteenSystem* sys, const char* filepath) {
    if (!sys || !filepath) return 0;
    FILE* fp = fopen(filepath, "w");
    if (!fp) return 0;

    export_system_state_json(sys, fp);
    fclose(fp);
    return 1;
}

/* ============================================================
   6. 100% PURE VEGETARIAN MENU (18 Signature Campus Dishes)
   ============================================================ */
static void populate_default_menu(CanteenSystem* sys) {
    if (!sys || !sys->menu) return;

    /* 1. Poori */
    menu_insert(sys->menu, menu_create_item(
        1, "Crispy Chole Poori", "Breakfast", 89.00,
        "Fluffy golden pooris served with spiced Amritsari chickpea curry, tangy pickled onions, and green chili.",
        "https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=800&q=80",
        8, 30, 1,
        "Whole Wheat Flour (150g), Chickpeas (100g), Cooking Oil (40ml), Spices & Herbs (20g)"
    ));

    /* 2. Kachori */
    menu_insert(sys->menu, menu_create_item(
        2, "Khasta Moong Dal Kachori", "Breakfast", 69.00,
        "Crusty flaky kachori stuffed with roasted spiced yellow lentils, served with sweet sonth and mint chutney.",
        "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
        6, 25, 1,
        "Refined Flour (120g), Yellow Moong Dal (60g), Desi Ghee (25g), Asafoetida & Spices (15g)"
    ));

    /* 3. Royal Veg Biryani */
    menu_insert(sys->menu, menu_create_item(
        3, "Royal Veg Dum Biryani", "Main Course", 189.00,
        "Aromatic basmati rice slow-cooked with cottage cheese, fresh seasonal vegetables, saffron, and crisp fried onions.",
        "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80",
        12, 28, 1,
        "Basmati Rice (180g), Fresh Paneer (80g), Mixed Veggies (100g), Desi Ghee (30g), Saffron (1g)"
    ));

    /* 4. Chocolate Truffle Cake */
    menu_insert(sys->menu, menu_create_item(
        4, "Dark Chocolate Truffle Cake", "Desserts", 119.00,
        "Eggless rich chocolate sponge layered with smooth Belgian dark chocolate ganache and chocolate curls.",
        "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80",
        4, 20, 1,
        "Cocoa Powder & Flour (140g), Dark Chocolate (80g), Dairy Cream (60ml), Raw Sugar (40g)"
    ));

    /* 5. Aloo Paratha */
    menu_insert(sys->menu, menu_create_item(
        5, "Amritsari Aloo Paratha", "Breakfast", 79.00,
        "Homestyle tawa paratha stuffed with mashed spiced potatoes, roasted cumin, fresh coriander, butter and curd.",
        "https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=800&q=80",
        7, 35, 1,
        "Whole Wheat Flour (140g), Potatoes (120g), Amul Butter (20g), Fresh Curd (80g), Spices (10g)"
    ));

    /* 6. Indori Masala Poha */
    menu_insert(sys->menu, menu_create_item(
        6, "Indori Masala Poha", "Breakfast", 49.00,
        "Steamed flattened rice tempered with mustard, turmeric, green chillies, crunchy roasted peanuts, and Ratlami sev.",
        "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80",
        5, 40, 1,
        "Flattened Rice / Poha (120g), Roasted Peanuts (30g), Mustard & Curry Leaves (10g), Sev (20g)"
    ));

    /* 7. Gujarati Nylon Dhokla */
    menu_insert(sys->menu, menu_create_item(
        7, "Gujarati Nylon Dhokla", "Snacks", 59.00,
        "Soft and spongy steamed gram flour cakes tempered with mustard seeds, sesame, and slit green chillies.",
        "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
        5, 30, 1,
        "Bengal Gram Besan (150g), Lemon Juice & Curd (40g), Mustard & Sesame (10g), Green Chillies (5g)"
    ));

    /* 8. Crispy Mix Veg Pakoda */
    menu_insert(sys->menu, menu_create_item(
        8, "Crispy Mix Veg Pakoda", "Snacks", 69.00,
        "Golden fritters of onion, potatoes, spinach, and cauliflower coated in seasoned chickpea batter.",
        "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
        6, 40, 1,
        "Chickpea Besan (120g), Farm Potatoes & Onions (140g), Cooking Oil (50ml), Carom Seeds (5g)"
    ));

    /* 9. Thick Kesar Mango Shake */
    menu_insert(sys->menu, menu_create_item(
        9, "Thick Kesar Mango Shake", "Beverages", 99.00,
        "Creamy luscious shake blended from real Alphonso mango pulp, full cream milk, and topped with dry fruit slivers.",
        "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=800&q=80",
        4, 35, 1,
        "Alphonso Mango Pulp (150ml), Chilled Dairy Milk (200ml), Vanilla Scoop (40g), Pistachios (5g)"
    ));

    /* 10. Classic Honey Pancakes */
    menu_insert(sys->menu, menu_create_item(
        10, "Golden Honey Pancakes", "Breakfast", 119.00,
        "Stack of three fluffy eggless buttermilk pancakes served warm with natural organic honey and melted butter.",
        "https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=800&q=80",
        7, 20, 1,
        "Refined Flour (130g), Fresh Milk (110ml), Organic Wild Honey (35ml), Salted Butter (15g)"
    ));

    /* 11. Dal Khichdi with Ghee */
    menu_insert(sys->menu, menu_create_item(
        11, "Comforting Desi Ghee Khichdi", "Main Course", 129.00,
        "Wholesome slow-cooked yellow lentils and fragrant rice tempered with cumin, garlic, and pure desi cow ghee.",
        "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80",
        8, 25, 1,
        "Rice (100g), Yellow Moong Dal (100g), Desi Cow Ghee (30g), Cumin & Hing (8g), Mixed Vegetables (60g)"
    ));

    /* 12. Classic Paneer Tikka Burger */
    menu_insert(sys->menu, menu_create_item(
        12, "Classic Paneer Tikka Burger", "Fast Food", 139.00,
        "Tandoori spiced grilled paneer slab with roasted bell pepper, tangy mint mayo, and crisp lettuce in brioche bun.",
        "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
        8, 22, 1,
        "Cottage Cheese Paneer (100g), Brioche Bun (1 pc), Mint Mayo (25g), Lettuce & Onions (30g)"
    ));

    /* 13. Stone-baked Margherita Pizza */
    menu_insert(sys->menu, menu_create_item(
        13, "Stone-baked Margherita Pizza", "Fast Food", 199.00,
        "Hand-stretched sourdough pizza with Italian plum tomato sauce, mozzarella bocconcini, and fresh basil.",
        "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=800&q=80",
        11, 18, 1,
        "Sourdough Pizza Base (180g), Fresh Mozzarella (100g), San Marzano Tomato (60g), Basil Leaves (5g)"
    ));

    /* 14. Punjabi Samosa with Chole */
    menu_insert(sys->menu, menu_create_item(
        14, "Crispy Samosa with Chole", "Snacks", 59.00,
        "Two crisp golden pyramid pastries stuffed with spiced potatoes and peas, drenched with spicy chole gravy.",
        "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
        5, 40, 1,
        "Maida Flour (120g), Potatoes & Green Peas (130g), Chickpeas Curry (100g), Spices (15g)"
    ));

    /* 15. Paneer Butter Masala with Naan */
    menu_insert(sys->menu, menu_create_item(
        15, "Shahi Paneer Butter Masala", "Main Course", 179.00,
        "Silky tomato, cashew, and butter gravy with fresh paneer cubes, served with two hot butter garlic naans.",
        "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80",
        10, 24, 1,
        "Fresh Paneer (140g), Cashew & Tomato Gravy (180g), Butter (25g), Tandoori Naan (2 pcs)"
    ));

    /* 16. South Indian Masala Dosa */
    menu_insert(sys->menu, menu_create_item(
        16, "Crispy Masala Dosa", "Breakfast", 99.00,
        "Golden paper-thin fermented rice crepe stuffed with fragrant mustard-potato masala, served with coconut chutney & sambar.",
        "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80",
        7, 30, 1,
        "Fermented Rice & Urad Batter (180g), Potato Masala (110g), Coconut Chutney (50g), Sambar (120ml)"
    ));

    /* 17. Chilli Garlic Hakka Noodles */
    menu_insert(sys->menu, menu_create_item(
        17, "Chilli Garlic Hakka Noodles", "Fast Food", 119.00,
        "Wok-tossed hand-pulled noodles with colorful bell peppers, shredded cabbage, scallions, and toasted garlic oil.",
        "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80",
        7, 32, 1,
        "Wheat Noodles (150g), Bell Peppers & Cabbage (100g), Garlic Chili Oil (25ml), Soy Sauce (15ml)"
    ));

    /* 18. Warm Gulab Jamun */
    menu_insert(sys->menu, menu_create_item(
        18, "Warm Desi Ghee Gulab Jamun", "Desserts", 69.00,
        "Two melt-in-mouth reduced milk khoya dumplings, deep-fried in desi ghee and steeped in cardamom rose syrup.",
        "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80",
        4, 30, 1,
        "Fresh Khoya / Mawa (100g), Refined Flour (20g), Sugar Syrup (80ml), Cardamom & Rose (5g)"
    ));

    sys->next_item_id = 19;

    /* Add sample pending orders */
    OrderNode* o1 = queue_create_order(101, "STU-2024-012", "Aarav Sharma", "Dine-In", "Extra chutney please", "Campus Card", 168.00);
    o1->items[0].item_id = 1;
    strncpy(o1->items[0].item_name, "Crispy Chole Poori", MAX_NAME_LEN - 1);
    o1->items[0].unit_price = 89.00;
    o1->items[0].quantity = 1;
    o1->items[1].item_id = 5;
    strncpy(o1->items[1].item_name, "Amritsari Aloo Paratha", MAX_NAME_LEN - 1);
    o1->items[1].unit_price = 79.00;
    o1->items[1].quantity = 1;
    o1->item_count = 2;
    o1->status = STATUS_PREPARING;
    queue_enqueue(sys->orders, o1);
    stack_push(sys->actions, ACTION_STATUS_CHANGE, 101, STATUS_PENDING, STATUS_PREPARING, "Order #101 cooking in kitchen");

    OrderNode* o2 = queue_create_order(102, "STU-2024-089", "Priya Verma", "Takeaway", "Less spicy please", "UPI / QR", 238.00);
    o2->items[0].item_id = 3;
    strncpy(o2->items[0].item_name, "Royal Veg Dum Biryani", MAX_NAME_LEN - 1);
    o2->items[0].unit_price = 189.00;
    o2->items[0].quantity = 1;
    o2->items[1].item_id = 6;
    strncpy(o2->items[1].item_name, "Indori Masala Poha", MAX_NAME_LEN - 1);
    o2->items[1].unit_price = 49.00;
    o2->items[1].quantity = 1;
    o2->item_count = 2;
    o2->status = STATUS_PENDING;
    queue_enqueue(sys->orders, o2);
    stack_push(sys->actions, ACTION_PLACE_ORDER, 102, STATUS_PENDING, STATUS_PENDING, "Order #102 placed by Priya Verma");

    sys->next_order_id = 103;
}

/* ============================================================
   7. CLI / IPC CONTROLLER
   ============================================================ */

static void print_usage(const char* prog) {
    printf("Campusbite Canteen Management System - C Core Data Structures Engine\n");
    printf("Usage:\n");
    printf("  %s --init <filepath>              : Initialize seed data and save to file\n", prog);
    printf("  %s --state <filepath>             : Export full system state (JSON)\n", prog);
    printf("  %s --menu <filepath>              : Export menu linked list (JSON)\n", prog);
    printf("  %s --orders <filepath>            : Export kitchen FIFO queue (JSON)\n", prog);
    printf("  %s --stack <filepath>             : Export action history LIFO stack (JSON)\n", prog);
    printf("  %s --advance <filepath> <order_id>: Advance order status in queue\n", prog);
    printf("  %s --cancel <filepath> <order_id> : Cancel order (0%% penalty if pending, 35%% if preparing)\n", prog);
    printf("  %s --undo <filepath>              : Pop last action from stack and revert state\n", prog);
    printf("  %s --update-stock <filepath> <item_id> <delta> : Update item stock\n", prog);
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

    const char* path = (argc >= 3) ? argv[2] : "canteen_state.json";
    CanteenSystem* sys = canteen_system_init();

    FILE* test_fp = fopen(path, "r");
    if (!test_fp) {
        populate_default_menu(sys);
        save_canteen_state(sys, path);
    } else {
        fclose(test_fp);
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
    } else if (strcmp(cmd, "--cancel") == 0 && argc >= 4) {
        int order_id = atoi(argv[3]);
        double penalty = 0.0, refund = 0.0;
        char msg[256];
        int res = system_cancel_order(sys, order_id, &penalty, &refund, msg, sizeof(msg));
        save_canteen_state(sys, path);
        printf("{\"status\": \"%s\", \"order_id\": %d, \"penalty\": %.2f, \"refund\": %.2f, \"message\": \"%s\"}\n",
               res ? "ok" : "error", order_id, penalty, refund, msg);
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
