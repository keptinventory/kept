# Files and portability

## FILE-01 Recover from a bad document selection

**Goal and category.** Attach a PDF, keep its identity, and reopen its original.

**Preconditions and inputs.** Seeded owner, an item marked for the run, a small
valid PDF named `Playtest invoice.pdf`, and an empty file with that extension.
The committed `apps/server/test/fixtures/files/doc.pdf` provides synthetic bytes.

1. Open the item's Paperwork or document action. Open and dismiss the file
   picker once. Try the empty PDF. Follow the visible feedback and retry with
   the valid PDF.
2. Save it, reopen the item after a reload, and find the PDF. Open or download
   the original and compare its length and SHA-256 to the source.
3. In Settings → This device, enable the app lock and keep the item's location
   available offline. Go offline and reload the item's existing short link.
   Unlock the app and find the named PDF under **Kept on this device**. Return
   online and check that the original still opens.

**Expected and observe.** Cancellation adds no attachment, rejection lets the
user retry, and a successful attachment is a document. The downloaded copy has
the same bytes. Offline availability reflects the controls and state shown.

## FILE-02 Recover a location from an archive

**Goal and category.** Export and import inventory through the browser.

**Preconditions and inputs.** Disposable seeded HTTPS server. Use a new location
named `Playtest imported home`, the seeded Home and the committed Homebox
archive if also exercising the legacy variation.

1. Open Settings → Export. Export Home without secrets and download the
   archive. Cancel the first import attempt before confirming it.
2. Import the Kept archive into a new location. Preview and check it before
   confirming, then open the imported location.
3. Find a known item and box and confirm original Home still opens. As a
   variation, import the Homebox fixture into another location and follow the
   old `/a/000-005` label.

**Expected and observe.** Cancellation leaves no imported location. The final
import produces one new location and keeps the existing one. Check warnings
for collisions and whether the completion link goes to the imported result.
