# Device-generated labels (increment 1)

Printed aliases use AAA-XXXX-NNNN: three uppercase category letters, four uniformly random base36 characters per print batch, and a decimal sequence 0001–9999. TMP is reserved for write-in labels. Do not apply Crockford O/I/L folding. Existing six-character codes and HTTPS NFC URLs remain unchanged.

The shared generator returns a batch manifest with UUIDs, visible aliases and raw QR payloads. Persist the manifest atomically before printing, reserve prefix/batch locally, and reuse the manifest on reprint. Raw aliases are not yet registered server labels.

Remaining integration: wire generator to device UI, durable storage and sync; register aliases with scoped unique constraints and explicit collision review; resolve QR and typed aliases to stable inventory UUIDs; preserve prior aliases and audit supersession; keep UPC/GTIN nonunique product metadata and NFC URLs stable, support RFID reader integrations separately. Never recycle an assigned alias. Implement OL330 2×2 20-up stock using actual template geometry, default 0.8-inch QR including quiet zone, write-in and preprinted notes layouts, calibration offsets and print tests. Do not claim end-to-end offline or scan support until these are implemented and tested.
