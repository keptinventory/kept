import { HB_FIELD_KIND, type HomeboxFieldKind, looksLikeBox } from '@kept/shared';
import type { HomeboxInspect, HomeboxMappingHints } from '../archive-types.js';
import { hbDate, hbFieldValue } from './format.js';
import { childrenOf, type HomeboxData, isLocation, seededUnused } from './read.js';

// What POST /imports/:id/inspect answers for a Homebox export: the collection's id
// (the manifest's groupId), when it was exported, its counts, and the mapping hints the choices
// step needs: the entity types things use (with how many), the custom fields by name (with their
// kind, how many items carry them and how many of those hold a value), how many items are insured, and the seeded places and
// tags that are empty and unused; how many amounts it holds (the currency is asked only then),
// the locations that read as boxes, and Homebox's catch-all type. Names and counts only, never a
// value. The ZIP holds no
// collection name, currency, members or Homebox version (H1): those come from the optional
// connection, or stay unknown.

export function inspectHomebox(data: HomeboxData, sourceVersion: string | null): HomeboxInspect {
  const entities = [...data.entities.values()];
  const items = entities.filter((e) => !isLocation(data, e));

  const typeItems = new Map<string, number>();
  for (const e of items) {
    typeItems.set(e.entity_type_entities, (typeItems.get(e.entity_type_entities) ?? 0) + 1);
  }
  const types = [...data.types.values()]
    .filter((t) => !t.is_location)
    .map((t) => ({ id: t.id, name: t.name, items: typeItems.get(t.id) ?? 0 }));

  // A field name with more than one kind is offered once, as its most common kind.
  // `filled`: the items holding a value as the import reads it (hbFieldValue); none, and the
  // field isn't added to any type (#320).
  const byName = new Map<
    string,
    { kinds: Map<HomeboxFieldKind, number>; entities: Set<string>; filled: Set<string> }
  >();
  for (const f of data.fields) {
    if (!data.entities.has(f.entity_fields)) continue;
    const name = f.name.trim();
    if (!name) continue;
    const seen = byName.get(name) ?? {
      kinds: new Map(),
      entities: new Set<string>(),
      filled: new Set<string>(),
    };
    seen.kinds.set(f.type, (seen.kinds.get(f.type) ?? 0) + 1);
    seen.entities.add(f.entity_fields);
    if (hbFieldValue(f).value !== undefined) seen.filled.add(f.entity_fields);
    byName.set(name, seen);
  }
  const fields = [...byName].map(([name, seen]) => {
    const kind = [...seen.kinds].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'text';
    return { name, kind, items: seen.entities.size, filled: seen.filled.size };
  });

  const seeded = seededUnused(data);
  const prices =
    items.filter((e) => e.purchase_price > 0 || e.sold_price > 0).length +
    data.maintenance.filter((m) => m.cost > 0).length;

  // Locations that read as boxes: inside a location, holding no location, named like one.
  const children = childrenOf(data);
  const boxes: NonNullable<HomeboxMappingHints['boxes']> = [];
  for (const e of entities) {
    if (!isLocation(data, e) || seeded.places.has(e.id) || !looksLikeBox(e.name)) continue;
    const parent = e.entity_children ? data.entities.get(e.entity_children) : undefined;
    if (!parent || !isLocation(data, parent)) continue;
    const kids = (children.get(e.id) ?? []).map((id) => data.entities.get(id));
    if (kids.some((k) => k && isLocation(data, k))) continue;
    const path: string[] = [];
    const seen = new Set<string>([e.id]);
    for (let p: typeof parent | undefined = parent; p && !seen.has(p.id); ) {
      seen.add(p.id);
      path.unshift(p.name);
      p = p.entity_children ? data.entities.get(p.entity_children) : undefined;
    }
    boxes.push({ id: e.id, name: e.name, path, items: kids.length });
  }
  const catchAll =
    [...data.types.values()].find((t) => !t.is_location && t.name.trim() === 'global.item')?.id ??
    null;

  const mapping: HomeboxMappingHints = {
    types,
    fields: fields.filter((f) => f.kind in HB_FIELD_KIND),
    insuredItems: items.filter((e) => e.insured).length,
    seededUnused: {
      places: [...seeded.places].map((id) => data.entities.get(id)?.name ?? '').filter(Boolean),
      tags: [...seeded.tags].map((id) => data.tags.get(id)?.name ?? '').filter(Boolean),
    },
    prices,
    zeroItems: items.filter((e) => Math.round(e.quantity * 1000) / 1000 <= 0).length,
    pricedItems: items.filter((e) => e.purchase_price > 0 || e.sold_price > 0).length,
    warrantyItems: items.filter((e) => e.lifetime_warranty || hbDate(e.warranty_expires) !== null)
      .length,
    maintenance: data.maintenance.length,
    boxes,
    catchAll,
  };

  return {
    source: 'homebox_zip',
    sourceVersion,
    collections: [
      {
        id: data.manifest.groupId,
        counts: {
          entities: entities.length,
          locations: entities.length - items.length,
          attachments: data.attachments.filter((a) => a.type !== 'thumbnail').length,
          maintenance: data.maintenance.length,
          tags: data.tags.size,
          types: data.types.size,
        },
        exportedAt: new Date(data.manifest.exportedAt).toISOString(),
        mapping,
      },
    ],
  };
}
