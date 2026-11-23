# Browser inventory

## WEB-01 First use

**Goal and category.** Set up a fresh instance and reach useful empty inventory.

**Preconditions and inputs.** Fresh browser and unseeded server. Use the setup
code emitted by the fixture, a synthetic account, and a home named
`Playtest Beach House`.

1. Open the home page. Leave the setup code blank, then enter a different
   well-formed value once. Enter the actual fixture code to continue.
2. Create the first account and finish setup. Create the first Home through the
   location wizard. Go back one step before finishing and inspect the name.
3. Open the new Home, reload, and confirm the Home and Personal locations still
   appear in the appropriate navigation.

**Expected and observe.** The wrong code is recoverable, setup creates one
account, the wizard retains the name on Back, and zero-item inventory gives a
clear route to add something. Try the wizard once at 375 px wide.

## WEB-02 Save a thing in a box

**Goal and category.** Navigate, reject invalid input and save a multilingual
item.

**Preconditions and inputs.** Seeded household owner's browser. Use Home →
Office → Desk drawer → Cable box. Use `Playtest Holiday décor زينة`, a run
marker in Notes and an optional quantity. Try whitespace-only and a negative
quantity before using a valid name and quantity.

1. Open the box and start adding a thing. Try to save the invalid values and
   inspect the validation feedback. Enter the valid values and press Save once.
2. Open the result, confirm the box and quantity, then reload. Find the item
   again using the accented words and then the Arabic words.
3. Return to the box and check that the thing appears once. Try navigating
   back to the record with the browser Back button.

**Expected and observe.** Invalid values never create a record. The saved name,
quantity, notes and containment survive reload and appear in search. Watch for
duplicate actions, clipped labels and lost focus on validation.

## WEB-03 Remove and recover an inventory record

**Goal and category.** Cancel, trash, undo and restore the WEB-02 item.

**Preconditions and inputs.** The owner and uniquely marked WEB-02 item.

1. Open the item's action menu, start moving it, then dismiss the move without
   confirming. Reopen the box and confirm containment.
2. Move the item to Trash. Use Undo and confirm it returns once. Trash it
   again, then look for it in normal search and in Trash.
3. Restore it from Trash. Reload the box and search again.

**Expected and observe.** Dismissal preserves containment, search omits a
trashed item, and both recovery paths restore one record to the original
box. Observe which action has focus and whether the item remains reachable
after the transient Undo message disappears.

## WEB-04 Keep a preference across relaunch

**Goal and category.** Change a setting, navigate with the keyboard, and check
it after closing the browser tab.

**Preconditions and inputs.** Seeded owner, English interface, 375 px viewport.

1. From Home open Settings and change language to Arabic. Observe the direction
   and the time it takes to apply. Inspect navigation at phone width.
2. Close the tab and open the same origin in the same browser profile. Check the
   language again. Use Tab and Escape on a menu or sheet and inspect focus.
3. Change back to English, return home, and verify that ordinary search and
   browser history still open usable screens.

**Expected and observe.** Language and direction agree and survive reload.
Keyboard focus stays visible and returns to the control that opened a menu.
Settings changes preserve inventory.
