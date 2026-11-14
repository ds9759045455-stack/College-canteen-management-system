#include "canteen_core.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include <math.h>

void test_linked_list(void) {
    printf("[TEST 1/4] Testing Menu Linked List Operations...\n");
    MenuList* list = menu_init();
    assert(list != NULL);
    assert(list->head == NULL);
    assert(list->count == 0);

    /* Test Insertion */
    MenuItemNode* item1 = menu_create_item(1, "Crispy Chole Poori", "Breakfast", 89.0, "Tasty Poori", "", 8, 30, 1, "Atta, Chole, Oil");
    MenuItemNode* item2 = menu_create_item(2, "Khasta Moong Dal Kachori", "Breakfast", 69.0, "Crispy Kachori", "", 6, 25, 1, "Maida, Moong Dal, Ghee");
    MenuItemNode* item3 = menu_create_item(3, "Royal Veg Dum Biryani", "Main Course", 189.0, "Dum Biryani", "", 12, 28, 1, "Rice, Paneer, Veggies");

    menu_insert(list, item1);
    menu_insert(list, item2);
    menu_insert(list, item3);

    assert(list->count == 3);
    assert(list->head->id == 1);
    assert(list->head->next->id == 2);
    assert(list->head->next->next->id == 3);
    assert(list->head->next->next->next == NULL);

    /* Test Search */
    MenuItemNode* found = menu_find_by_id(list, 2);
    assert(found != NULL);
    assert(strcmp(found->name, "Khasta Moong Dal Kachori") == 0);
    assert(strcmp(found->raw_materials, "Maida, Moong Dal, Ghee") == 0);

    MenuItemNode* not_found = menu_find_by_id(list, 999);
    assert(not_found == NULL);

    /* Test Stock Update */
    menu_update_stock(list, 1, -5);
    assert(item1->stock_qty == 25);
    menu_update_stock(list, 1, 10);
    assert(item1->stock_qty == 35);

    /* Test Deletion (middle item) */
    int del_res = menu_delete(list, 2);
    assert(del_res == 1);
    assert(list->count == 2);
    assert(menu_find_by_id(list, 2) == NULL);
    assert(list->head->next->id == 3);

    menu_free(list);
    printf("  --> Linked List tests PASSED!\n\n");
}

void test_fifo_queue(void) {
    printf("[TEST 2/4] Testing Kitchen FIFO Queue Operations...\n");
    OrderQueue* q = queue_init();
    assert(q != NULL);
    assert(q->front == NULL);
    assert(q->rear == NULL);
    assert(q->count == 0);

    /* Test Enqueue */
    OrderNode* o1 = queue_create_order(101, "STU-1", "Aarav", "Dine-In", "No onion", "UPI", 150.0);
    OrderNode* o2 = queue_create_order(102, "STU-2", "Priya", "Takeaway", "Extra chutney", "Cash", 220.0);
    OrderNode* o3 = queue_create_order(103, "STU-3", "Rohan", "Dine-In", "Spicy", "Card", 80.0);

    queue_enqueue(q, o1);
    queue_enqueue(q, o2);
    queue_enqueue(q, o3);

    assert(q->count == 3);
    assert(queue_peek(q)->order_id == 101);
    assert(q->rear->order_id == 103);

    /* Test Queue Position */
    assert(queue_get_position(q, 101) == 1);
    assert(queue_get_position(q, 102) == 2);
    assert(queue_get_position(q, 103) == 3);

    /* Test FIFO Dequeue */
    OrderNode* popped1 = queue_dequeue(q);
    assert(popped1 != NULL);
    assert(popped1->order_id == 101);
    assert(q->count == 2);
    assert(queue_peek(q)->order_id == 102);

    OrderNode* popped2 = queue_dequeue(q);
    assert(popped2 != NULL);
    assert(popped2->order_id == 102);

    OrderNode* popped3 = queue_dequeue(q);
    assert(popped3 != NULL);
    assert(popped3->order_id == 103);
    assert(q->count == 0);

    free(popped1);
    free(popped2);
    free(popped3);
    queue_free(q);
    printf("  --> FIFO Queue tests PASSED!\n\n");
}

void test_lifo_stack(void) {
    printf("[TEST 3/4] Testing Action LIFO Stack Operations...\n");
    ActionStack* s = stack_init();
    assert(s != NULL);
    assert(s->top == NULL);
    assert(s->count == 0);

    stack_push(s, ACTION_STATUS_CHANGE, 101, STATUS_PENDING, STATUS_PREPARING, "Cooking #101");
    stack_push(s, ACTION_UPDATE_STOCK, 1, 30, 25, "Stock update item 1");
    stack_push(s, ACTION_STATUS_CHANGE, 102, STATUS_PREPARING, STATUS_READY, "Ready #102");

    assert(s->count == 3);
    assert(stack_peek(s)->target_id == 102);

    ActionNode* act1 = stack_pop(s);
    assert(act1 != NULL);
    assert(act1->target_id == 102);
    assert(s->count == 2);

    ActionNode* act2 = stack_pop(s);
    assert(act2 != NULL);
    assert(act2->target_id == 1);

    ActionNode* act3 = stack_pop(s);
    assert(act3 != NULL);
    assert(act3->target_id == 101);
    assert(s->count == 0);

    free(act1);
    free(act2);
    free(act3);
    stack_free(s);
    printf("  --> LIFO Stack tests PASSED!\n\n");
}

void test_order_cancellation_policy(void) {
    printf("[TEST 4/4] Testing Order Cancellation Policy (0%% before cook, 35%% after cook)...\n");
    CanteenSystem* sys = canteen_system_init();
    MenuItemNode* item = menu_create_item(1, "Crispy Chole Poori", "Breakfast", 100.0, "Desc", "", 5, 20, 1, "Atta, Chole");
    menu_insert(sys->menu, item);

    /* Case A: Order 101 cancelled BEFORE cooking starts (STATUS_PENDING) */
    OrderNode* o1 = queue_create_order(101, "STU-01", "Ananya", "Dine-In", "", "Cash", 200.0);
    o1->items[0].item_id = 1;
    strncpy(o1->items[0].item_name, "Crispy Chole Poori", MAX_NAME_LEN - 1);
    o1->items[0].unit_price = 100.0;
    o1->items[0].quantity = 2;
    o1->item_count = 1;

    system_place_order(sys, o1);
    assert(item->stock_qty == 18); /* Stock decremented */
    assert(o1->status == STATUS_PENDING);

    double penalty = 0.0, refund = 0.0;
    char msg[256];
    int res = system_cancel_order(sys, 101, &penalty, &refund, msg, sizeof(msg));
    assert(res == 1);
    assert(o1->status == STATUS_CANCELLED);
    assert(penalty == 0.0);     /* 0% penalty before cooking */
    assert(refund == 200.0);    /* 100% refund */
    assert(item->stock_qty == 20); /* Stock restored to Linked List */
    printf("  [Policy 1 Log]: %s\n", msg);

    /* Case B: Order 102 cancelled AFTER cooking starts (STATUS_PREPARING) */
    OrderNode* o2 = queue_create_order(102, "STU-02", "Kabir", "Dine-In", "", "UPI", 100.0);
    o2->items[0].item_id = 1;
    strncpy(o2->items[0].item_name, "Crispy Chole Poori", MAX_NAME_LEN - 1);
    o2->items[0].unit_price = 100.0;
    o2->items[0].quantity = 1;
    o2->item_count = 1;

    system_place_order(sys, o2);
    assert(o2->status == STATUS_PENDING);

    /* Kitchen starts cooking */
    system_advance_order_status(sys, 102);
    assert(o2->status == STATUS_PREPARING);

    /* User cancels while cooking is underway */
    res = system_cancel_order(sys, 102, &penalty, &refund, msg, sizeof(msg));
    assert(res == 1);
    assert(o2->status == STATUS_CANCELLED);
    assert(fabs(penalty - 35.0) < 0.001); /* 35% deduction charged by management */
    assert(fabs(refund - 65.0) < 0.001);  /* 65% refund to student */
    printf("  [Policy 2 Log]: %s\n", msg);

    /* Case C: Order already READY cannot be cancelled */
    OrderNode* o3 = queue_create_order(103, "STU-03", "Diya", "Dine-In", "", "Card", 100.0);
    system_place_order(sys, o3);
    system_advance_order_status(sys, 103); /* PREPARING */
    system_advance_order_status(sys, 103); /* READY */
    assert(o3->status == STATUS_READY);

    res = system_cancel_order(sys, 103, &penalty, &refund, msg, sizeof(msg));
    assert(res == 0); /* Rejected */
    printf("  [Policy 3 Log]: Blocked cancellation for ready order.\n");

    /* Case D: Undo last action (Cancel Order) restores previous status */
    res = system_undo_last_action(sys, msg, sizeof(msg));
    assert(res == 1);
    printf("  [Undo Log]: %s\n", msg);

    canteen_system_free(sys);
    printf("  --> Order Cancellation Policy tests PASSED!\n\n");
}

int main(void) {
    printf("============================================================\n");
    printf("CAMPUSBITE CANTEEN SYSTEM: C CORE DSA & CANCELLATION TESTS\n");
    printf("============================================================\n\n");

    test_linked_list();
    test_fifo_queue();
    test_lifo_stack();
    test_order_cancellation_policy();

    printf("============================================================\n");
    printf("ALL TESTS PASSED SUCCESSFULLY! (100%% Pure Veg, Cancellation)\n");
    printf("============================================================\n");
    return 0;
}
