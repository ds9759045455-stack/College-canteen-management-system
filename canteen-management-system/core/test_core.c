#include "canteen_core.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>

void test_linked_list(void) {
    printf("[TEST 1/3] Testing Menu Linked List Operations...\n");
    MenuList* list = menu_init();
    assert(list != NULL);
    assert(list->head == NULL);
    assert(list->count == 0);

    /* Test Insertion */
    MenuItemNode* item1 = menu_create_item(1, "Burger", "Fast Food", 99.0, "Tasty burger", "", 5, 10, 1);
    MenuItemNode* item2 = menu_create_item(2, "Pizza", "Fast Food", 199.0, "Cheesy pizza", "", 10, 5, 1);
    MenuItemNode* item3 = menu_create_item(3, "Biryani", "Main Course", 150.0, "Dum biryani", "", 8, 20, 0);

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
    assert(strcmp(found->name, "Pizza") == 0);

    MenuItemNode* not_found = menu_find_by_id(list, 999);
    assert(not_found == NULL);

    /* Test Stock Update */
    menu_update_stock(list, 1, -3);
    assert(item1->stock_qty == 7);
    menu_update_stock(list, 1, 5);
    assert(item1->stock_qty == 12);

    /* Test Deletion (middle item) */
    int del_res = menu_delete(list, 2);
    assert(del_res == 1);
    assert(list->count == 2);
    assert(menu_find_by_id(list, 2) == NULL);
    assert(list->head->next->id == 3);

    /* Test Deletion (head item) */
    del_res = menu_delete(list, 1);
    assert(del_res == 1);
    assert(list->count == 1);
    assert(list->head->id == 3);

    menu_free(list);
    printf("  --> Linked List tests PASSED!\n\n");
}

void test_fifo_queue(void) {
    printf("[TEST 2/3] Testing Kitchen FIFO Queue Operations...\n");
    OrderQueue* q = queue_init();
    assert(q != NULL);
    assert(q->front == NULL);
    assert(q->rear == NULL);
    assert(q->count == 0);

    /* Test Enqueue */
    OrderNode* o1 = queue_create_order(101, "STU-1", "Alice", "Dine-In", "No salt", "UPI", 150.0);
    OrderNode* o2 = queue_create_order(102, "STU-2", "Bob", "Takeaway", "Extra dip", "Cash", 220.0);
    OrderNode* o3 = queue_create_order(103, "STU-3", "Charlie", "Dine-In", "Spicy", "Card", 80.0);

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

    /* Test Status Transition */
    queue_update_status(q, 101, STATUS_PREPARING);
    assert(queue_find(q, 101)->status == STATUS_PREPARING);

    /* Test FIFO Dequeue: First in MUST be first out */
    OrderNode* popped1 = queue_dequeue(q);
    assert(popped1 != NULL);
    assert(popped1->order_id == 101);
    assert(q->count == 2);
    assert(queue_peek(q)->order_id == 102);

    OrderNode* popped2 = queue_dequeue(q);
    assert(popped2 != NULL);
    assert(popped2->order_id == 102);
    assert(q->count == 1);

    OrderNode* popped3 = queue_dequeue(q);
    assert(popped3 != NULL);
    assert(popped3->order_id == 103);
    assert(q->count == 0);
    assert(q->front == NULL);
    assert(q->rear == NULL);

    free(popped1);
    free(popped2);
    free(popped3);
    queue_free(q);
    printf("  --> FIFO Queue tests PASSED!\n\n");
}

void test_lifo_stack_and_undo(void) {
    printf("[TEST 3/3] Testing Action LIFO Stack & Undo System...\n");
    ActionStack* s = stack_init();
    assert(s != NULL);
    assert(s->top == NULL);
    assert(s->count == 0);

    /* Push actions: A, then B, then C */
    stack_push(s, ACTION_STATUS_CHANGE, 101, STATUS_PENDING, STATUS_PREPARING, "Cooking #101");
    stack_push(s, ACTION_UPDATE_STOCK, 1, 10, 8, "Stock update item 1");
    stack_push(s, ACTION_STATUS_CHANGE, 102, STATUS_PREPARING, STATUS_READY, "Ready #102");

    assert(s->count == 3);
    assert(stack_peek(s)->target_id == 102); /* Last pushed is at top */

    /* Pop action (LIFO): C must come out first */
    ActionNode* act1 = stack_pop(s);
    assert(act1 != NULL);
    assert(act1->target_id == 102);
    assert(act1->new_state_val == STATUS_READY);
    assert(s->count == 2);

    /* Pop action: B must come out next */
    ActionNode* act2 = stack_pop(s);
    assert(act2 != NULL);
    assert(act2->target_id == 1);
    assert(act2->type == ACTION_UPDATE_STOCK);
    assert(s->count == 1);

    /* Pop action: A must come out last */
    ActionNode* act3 = stack_pop(s);
    assert(act3 != NULL);
    assert(act3->target_id == 101);
    assert(s->count == 0);
    assert(s->top == NULL);

    free(act1);
    free(act2);
    free(act3);
    stack_free(s);

    /* Test System-level Undo integration */
    CanteenSystem* sys = canteen_system_init();
    MenuItemNode* item = menu_create_item(1, "Test Burger", "Fast Food", 100.0, "Desc", "", 5, 20, 1);
    menu_insert(sys->menu, item);

    OrderNode* order = queue_create_order(101, "STU-01", "Emma", "Dine-In", "", "Cash", 100.0);
    order->items[0].item_id = 1;
    strncpy(order->items[0].item_name, "Test Burger", MAX_NAME_LEN - 1);
    order->items[0].unit_price = 100.0;
    order->items[0].quantity = 2;
    order->item_count = 1;

    /* Place order -> stock decreases from 20 to 18 */
    system_place_order(sys, order);
    assert(item->stock_qty == 18);
    assert(sys->orders->count == 1);

    /* Advance status: PENDING -> PREPARING */
    system_advance_order_status(sys, 101);
    assert(order->status == STATUS_PREPARING);

    /* Advance status: PREPARING -> READY */
    system_advance_order_status(sys, 101);
    assert(order->status == STATUS_READY);

    /* Perform UNDO: Should roll back from READY back to PREPARING */
    char msg[256];
    int undo_res = system_undo_last_action(sys, msg, sizeof(msg));
    assert(undo_res == 1);
    assert(order->status == STATUS_PREPARING);
    printf("  [System Undo Log]: %s\n", msg);

    /* Perform 2nd UNDO: Should roll back from PREPARING back to PENDING */
    undo_res = system_undo_last_action(sys, msg, sizeof(msg));
    assert(undo_res == 1);
    assert(order->status == STATUS_PENDING);
    printf("  [System Undo Log]: %s\n", msg);

    /* Perform 3rd UNDO: Should cancel order and restore stock from 18 back to 20 */
    undo_res = system_undo_last_action(sys, msg, sizeof(msg));
    assert(undo_res == 1);
    assert(order->status == STATUS_CANCELLED);
    assert(item->stock_qty == 20);
    printf("  [System Undo Log]: %s\n", msg);

    canteen_system_free(sys);
    printf("  --> LIFO Stack & Undo integration tests PASSED!\n\n");
}

int main(void) {
    printf("============================================================\n");
    printf("CANTEEN MANAGEMENT SYSTEM: C CORE DATA STRUCTURES UNIT TESTS\n");
    printf("============================================================\n\n");

    test_linked_list();
    test_fifo_queue();
    test_lifo_stack_and_undo();

    printf("============================================================\n");
    printf("ALL TESTS PASSED SUCCESSFULLY! (Linked List, Queue, Stack)\n");
    printf("============================================================\n");
    return 0;
}
