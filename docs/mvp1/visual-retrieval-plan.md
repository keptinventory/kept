# Next milestone · production visual retrieval

**R10** Words retrieve objects visible in stored image pixels even when omitted from all text.
**R11** A new photograph retrieves likely recorded locations with stored visual evidence.
Both remain open. Keep ordinary search, exact identifiers and text-semantic search available while this milestone ships.

## Qualify on household fixtures

Collect opt-in originals across households, rooms and bins. Include crowded and partly occluded objects, small objects, similar items in different locations, varied light and angles, and older photographs. Use genuinely new photographs for the photo queries. Include absent items, inaccessible locations and ambiguous duplicates. Check that the names in the R10 cohort are absent from captions, aliases, notes, filenames and document text. Label acceptable record and box IDs plus the visible region. Split tuning and held-out data by household or object instance so closely related photos do not cross the split.

Run ordinary search, text-semantic search, full-image vectors, and full-image plus bounded regions on identical cohorts. Report Recall@1/5, no-match precision and false positives on absent items, ambiguity, coverage, latency, indexing throughput, memory and cost. Agree on the pass thresholds from the design before opening the held-out set. The four-image OpenCLIP study provides feasibility evidence for the encoder. Its shared scene/crop queries and small gallery leave household accuracy and abstention unqualified. [Experiment and measurements](../../scripts/visual-retrieval/README.md).

## Index and enforce source eligibility

1. Add a distinct pgvector index keyed by attachment, original content hash, region, and model generation. Pin weights, encoder dimensions, and preprocessing per generation. Use Kept's durable jobs for bounded, idempotent indexing. Backfill into a new generation and switch once measured coverage is acceptable.
2. Scope candidate generation and evidence to the caller's authorized locations and currently visible, eligible attachments. Use Kept's RLS and narrowly scoped search functions, honoring role, attachment visibility, trash and review state. Check eligibility before reading bytes or handing them to a provider, before committing an index row, and before returning results or issuing signed media URLs. Any external inference requires the existing explicit opt-in.
3. Use deletion, replacement and moves to invalidate the old source generation. Jobs recheck hash, attachment and location on commit, so an in-flight index cannot resurrect old results. Cross-location moves re-evaluate authorization at the destination. Revocation filters results, coverage, counts and new media URLs immediately on the server. Use the current canonical containment path in results. Rebuild derived vectors from surviving originals after restore.
4. Bound image bytes, decoded pixels, regions and per-account processing. Use a private, principal-scoped temporary object for query photos, with a proposed 15-minute maximum lifetime and deletion after encoding or cancellation. Keep a short-lived query vector for retry within that lifetime. Exclude query photos and vectors from inventory, backups, export, analytics, logs and model training. Expire them on schedule and invalidate them on access revocation.

## Proposed interfaces

| Interface | Proposed behavior |
| --- | --- |
| `POST /api/v1/visual-search/input` | Bounded private image upload. Returns `{inputId, expiresAt}`. Owner credentials and the permitted search scope bind the input. |
| `POST /api/v1/visual-search` | Accepts exactly one of `text` or `inputId`, with optional normalized crop, authorized location IDs and bounded limit. Returns `{outcome, coverage, matches}`. |
| `GET /api/v1/visual-search/status` | Returns the active generation, and ready, pending, failed and paused counts visible in the requested scope. |
| `POST /api/v1/admin/visual-search/reindex` | Scoped, audited and idempotent job request tied to an approved model generation. |

A match includes its record and location IDs, current containment path, source attachment, capture date and optional normalized region. Use Kept's authorized media route to open evidence. Group several photos of the same item or box. Show multiple plausible locations with distinct evidence when matches are ambiguous. Distinguish `no_close_match`, `partial_coverage` and `unavailable`; offer narrower phrasing, a new viewpoint or ordinary search as appropriate. Label locations as recorded. Searching has no inventory side effects.

Implement indexing and permission/lifecycle tests first, then ship the words-to-pixels and photo-query slices against the same generation. Qualify both before closing G3 or G6. Keep this milestone ahead of custom fields, public sharing, new MCP features and provider migration. [Design](../plans/kept_nfc_software_design.md) · [Implementation plan](../plans/kept_nfc_implementation_plan.md).
