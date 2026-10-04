#ifndef CANTEEN_CORE_H
#define CANTEEN_CORE_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define MAX_NAME_LEN 64
#define MAX_CATEGORY_LEN 32
#define MAX_DESC_LEN 256
#define MAX_URL_LEN 512
#define MAX_INSTRUCTION_LEN 256
#define MAX_ITEMS_PER_ORDER 30

/* ============================================================
   1. LINKED LIST: Dynamic Menu Inventory
   ============================================================ */
typedef struct MenuItemNode {
    int id;
    char name[MAX_NAME_LEN];
    char category[MAX_CATEGORY_LEN];
    double price;
    char description[MAX_DESC_LEN];
    char image_url[MAX_URL_LEN];
    int prep_time_min;
    int stock_qty;
    int is_veg;        /* 1 = Veg, 0 = Non-Veg */
    int is_available;  /* 1 = Active, 0 = Disabled */
    struct MenuItemNode* next;
} MenuItemNode;

typedef struct {
    MenuItemNode* head;
    int count;
} MenuList;

/* Menu Linked List Operations */
MenuList* menu_init(void);
MenuItemNode* menu_create_item(int id, const char* name, const char* category, double price,
                               const char* description, const char* image_url,
                               int prep_time_min, int stock_qty, int is_veg);
int menu_insert(MenuList* list, MenuItemNode* item);
int menu_delete(MenuList* list, int id);
MenuItemNode* menu_find_by_id(MenuList* list, int id);
int menu_update_stock(MenuList* list, int id, int delta);
int menu_update_item(MenuList* list, int id, const char* name, double price, int stock, int is_veg);
void menu_free(MenuList* list);

/* ============================================================
   2. FIFO QUEUE: Kitchen Order Processing
   ============================================================ */
typedef enum {
    STATUS_PENDING = 0,    /* Placed, waiting in line */
    STATUS_PREPARING = 1,  /* Cooking in kitchen */
    STATUS_READY = 2,      /* Ready for pickup at counter */
    STATUS_COLLECTED = 3,  /* Picked up by student */
    STATUS_CANCELLED = 4   /* Order cancelled */
} OrderStatus;

typedef struct {
    int item_id;
    char item_name[MAX_NAME_LEN];
    double unit_price;
    int quantity;
} OrderItemDetail;

typedef struct OrderNode {
    int order_id;
    char student_id[32];
    char student_name[MAX_NAME_LEN];
    char pickup_type[32];      /* "Dine-In" or "Takeaway" */
    char special_notes[MAX_INSTRUCTION_LEN];
    char payment_method[32];   /* "Campus Card", "UPI / QR", "Cash" */
    double total_amount;
    char created_at[32];
    OrderStatus status;
    OrderItemDetail items[MAX_ITEMS_PER_ORDER];
    int item_count;
    struct OrderNode* next;
} OrderNode;

typedef struct {
    OrderNode* front;
    OrderNode* rear;
    int count;
} OrderQueue;

/* Queue Operations */
OrderQueue* queue_init(void);
OrderNode* queue_create_order(int order_id, const char* student_id, const char* student_name,
                              const char* pickup_type, const char* special_notes,
                              const char* payment_method, double total_amount);
int queue_enqueue(OrderQueue* q, OrderNode* order);
OrderNode* queue_dequeue(OrderQueue* q);
OrderNode* queue_peek(OrderQueue* q);
OrderNode* queue_find(OrderQueue* q, int order_id);
int queue_update_status(OrderQueue* q, int order_id, OrderStatus new_status);
int queue_get_position(OrderQueue* q, int order_id);
void queue_free(OrderQueue* q);

/* ============================================================
   3. LIFO STACK: Action History & Kitchen/Order Undo System
   ============================================================ */
typedef enum {
    ACTION_STATUS_CHANGE = 1,
    ACTION_ADD_ITEM = 2,
    ACTION_DELETE_ITEM = 3,
    ACTION_UPDATE_STOCK = 4,
    ACTION_PLACE_ORDER = 5
} ActionType;

typedef struct ActionNode {
    int action_id;
    ActionType type;
    int target_id;       /* order_id or item_id */
    int prev_state_val;  /* previous status or stock */
    int new_state_val;   /* new status or stock */
    char details[MAX_DESC_LEN];
    char timestamp[32];
    struct ActionNode* next;
} ActionNode;

typedef struct {
    ActionNode* top;
    int count;
} ActionStack;

/* Stack Operations */
ActionStack* stack_init(void);
int stack_push(ActionStack* s, ActionType type, int target_id,
               int prev_state_val, int new_state_val, const char* details);
ActionNode* stack_pop(ActionStack* s);
ActionNode* stack_peek(ActionStack* s);
void stack_free(ActionStack* s);

/* ============================================================
   4. SYSTEM CONTEXT, PERSISTENCE & JSON EXPORT
   ============================================================ */
typedef struct {
    MenuList* menu;
    OrderQueue* orders;
    ActionStack* actions;
    int next_order_id;
    int next_item_id;
} CanteenSystem;

CanteenSystem* canteen_system_init(void);
void canteen_system_free(CanteenSystem* sys);

/* JSON Exporters for UI Bridge */
void export_menu_json(MenuList* list, FILE* out);
void export_queue_json(OrderQueue* q, FILE* out);
void export_stack_json(ActionStack* s, FILE* out);
void export_system_state_json(CanteenSystem* sys, FILE* out);

/* High-level DSA Operations with Stack Recording */
int system_place_order(CanteenSystem* sys, OrderNode* order);
int system_advance_order_status(CanteenSystem* sys, int order_id);
int system_undo_last_action(CanteenSystem* sys, char* result_msg, size_t msg_size);

/* Data Persistence */
int save_canteen_state(CanteenSystem* sys, const char* filepath);
int load_canteen_state(CanteenSystem* sys, const char* filepath);

#endif /* CANTEEN_CORE_H */
