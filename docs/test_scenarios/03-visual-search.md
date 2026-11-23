# Visual search

## VIS-01 Search for an object described only by its photo

**Goal and category.** Find a recorded box via stored photo evidence and check
current containment after a move.

**Preconditions and inputs.** Disposable server and local visual encoder.
Use two boxes named `Playtest Upper shelf` and `Playtest Lower shelf`, an
item named `Playtest Seasonal spares`, and a stored photo of a rubber duck.
Keep the object name out of all inventory text and the uploaded filename.

1. Search for `rubber duck` with ordinary search in the test location. Select
   **Find in photos** and open **View stored photo** on a possible match.
2. Dismiss the photo and open the linked record. Move it into Lower shelf.
3. Run the same visual query again. Compare its recorded box with the record's
   own location. Try an exact inventory identifier separately.

**Expected and observe.** The photo supplies evidence when the words have no
ordinary match. The next search shows the new containment, and exact search
still works. Record indexing or inference messages if shown.

## VIS-02 Replace or abandon a photo query

**Goal and category.** Recover from invalid input and an interrupted search.

**Preconditions and inputs.** VIS-01 fixture, a separate exposure of the same
object, an unrelated photo, and an empty file named `Playtest query.jpg`. For
the interruption, delay a response in the disposable browser only.

1. Choose the empty file for photo search. Confirm the error or rejection is
   actionable. Choose the separate exposure and open the returned photo.
2. Try the unrelated photo and record whether it abstains or shows suggestions.
3. Start another photo query. Leave the search or change location scope while
   inference is running. Return to search, retry and inspect the results.

**Expected and observe.** A rejected input is recoverable. Old results do not
replace results for a different scope. A photo query does not create inventory.
Record whether failures are distinguishable from an incomplete index or an
uncertain match. This card exercises interaction and does not score household
retrieval quality.
