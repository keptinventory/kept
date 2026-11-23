import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { Select, SelectItem } from '@/components/ui/select';
import { type InventoryCache, inventoryPath } from './inventory';

export type Destination = {
  id: string;
  locationId: string;
  name: string;
  kind?: 'box' | 'place' | 'photos' | 'documents';
};

export function writableLocations(cache: InventoryCache) {
  return cache.locations.filter((location) => location.role !== 'viewer');
}

export function LocationPicker({
  cache,
  value,
  onChange,
  disabled,
}: {
  cache: InventoryCache;
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const { t } = useLingui();
  return (
    <Select
      label={t`Location`}
      items={writableLocations(cache)}
      selectedKey={value}
      onSelectionChange={(key) => {
        if (key !== null) onChange(String(key));
      }}
      isDisabled={disabled}
    >
      {(item) => (
        <SelectItem id={item.id} textValue={item.name}>
          <bdi>{item.name}</bdi>
        </SelectItem>
      )}
    </Select>
  );
}

export function DestinationPicker({
  cache,
  value,
  onChange,
  disabled,
  placesOnly,
  onlyLocation,
  exclude,
}: {
  cache: InventoryCache;
  value: Destination | undefined;
  onChange: (destination: Destination | undefined) => void;
  disabled?: boolean;
  placesOnly?: boolean;
  onlyLocation?: string;
  exclude?: string;
}) {
  const { t } = useLingui();
  const locations = writableLocations(cache);
  const [locationId, setLocationId] = useState(value?.locationId);
  const location =
    locations.find((entry) => entry.id === (onlyLocation ?? locationId)) ??
    (onlyLocation ? undefined : locations[0]);
  const boxes = placesOnly ? [] : cache.things.filter((thing) => thing.isContainer);
  const byId = new Map(boxes.map((box) => [box.id, box]));
  const excluded = new Set(exclude ? [exclude] : []);
  for (const box of boxes) {
    if (!exclude || box.locationId !== location?.id) continue;
    let parent = box.containerId;
    const seen = new Set<string>();
    while (parent && !seen.has(parent)) {
      if (excluded.has(parent)) {
        excluded.add(box.id);
        break;
      }
      seen.add(parent);
      parent = byId.get(parent)?.containerId ?? null;
    }
  }
  const options = [...cache.places, ...boxes]
    .filter((row) => row.locationId === location?.id && !excluded.has(row.id))
    .map((row) => ({
      id: row.id,
      locationId: row.locationId,
      name: row.name ?? t`Untitled`,
      kind: 'containerId' in row ? ('box' as const) : ('place' as const),
      label: [...inventoryPath(cache, row).slice(1), row.name ?? t`Untitled`].join(' › '),
    }));
  return (
    <div className="grid gap-3">
      {!onlyLocation && (
        <LocationPicker
          cache={cache}
          value={location?.id ?? null}
          disabled={disabled}
          onChange={(id) => {
            setLocationId(id);
            const next = locations.find((entry) => entry.id === id);
            const room = cache.places.find((entry) => entry.id === next?.unplacedPlaceId);
            onChange(room ? { ...room, kind: 'place' } : undefined);
          }}
        />
      )}
      <Select
        label={placesOnly ? t`Room or place` : t`Room or box`}
        items={options}
        selectedKey={value?.id ?? null}
        isDisabled={disabled}
        onSelectionChange={(key) => onChange(options.find((option) => option.id === key))}
      >
        {(item) => (
          <SelectItem id={item.id} textValue={item.label}>
            <bdi>{item.label}</bdi>
          </SelectItem>
        )}
      </Select>
    </div>
  );
}

export function defaultDestination(cache: InventoryCache): Destination | undefined {
  const location = writableLocations(cache)[0];
  const place = cache.places.find((entry) => entry.id === location?.unplacedPlaceId);
  return place ? { ...place, kind: 'place' } : undefined;
}
