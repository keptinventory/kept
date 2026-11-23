# iPhone app in Simulator

## IOS-01 Cancel, reconnect and reopen

**Goal and category.** Connect from the bundled app and keep the session on
relaunch.

**Preconditions and inputs.** Debug Simulator bundle, isolated sandbox, and a
seeded loopback instance using only fixture credentials.

1. Open the app, enter the disposable server's address and start sign-in.
   Cancel the system browser, then repeat and approve the connection.
2. Check that inventory opens and choose a known box. Terminate the app from
   Simulator, then launch again and reopen the box.

**Expected and observe.** Cancellation allows retry. Approval returns to the
app and the saved session allows reopening without signing in again.

## IOS-02 Keep a capture through an interruption

**Goal and category.** Preserve original files offline and sync once after
relaunch.

**Preconditions and inputs.** IOS-01 connection, cached writable box, AI
disabled, one synthetic photo and one small PDF in Simulator. Name the item
`Playtest Holiday decorations` and use the run marker as notes.

1. Open **Add to this box**. Try whitespace for the description and zero for
   quantity. Supply valid values, then select a photo and a PDF.
2. Disconnect the fixture. Save in the cached box, verify **Saved on device**,
   terminate, and relaunch while still disconnected. Preview both originals.
3. Reconnect the same fixture and use **Retry sync** if needed. Inspect the
   outbox status, then open the box in web inventory and verify one item and
   the correct original lengths and hashes.

**Expected and observe.** Invalid input does not create a pending entry, local
save survives relaunch, and completion reflects server confirmation. Original
bytes retain their photo and document roles. AI availability does not affect
manual save.

## IOS-03 Identify an unavailable and a known label

**Goal and category.** Recover from a bad label without losing the selected box.

**Preconditions and inputs.** IOS-01 connection, one box with an existing label,
and an unassigned syntactically valid label code.

1. Open **Identify a label** and enter the unassigned code. Return to input
   and enter the existing code. Check the resulting box.
2. Open **Find this box**. If Simulator cannot scan NFC, observe its feedback,
   return, and reopen the selected box. Check that the same label URL still
   opens the box in the ordinary browser.
3. Disconnect the fixture and retry the resolved code and the unknown code.
   Observe the difference between cached and unresolved offline labels.

**Expected and observe.** A correct code opens its existing box. An unknown
code never opens a different record. An unavailable scanner or offline miss
leaves a usable return path and does not change an assigned label. NDEF
read and write, QR camera feedback and physical Find remain hardware work.
