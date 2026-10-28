/**
 * The sample's photos (Facts.photo): small squares of the map's own Poly Haven models (CC0),
 * rendered on a plain backdrop, about 1 KB each (src/assets/try-map/). The card shows one where
 * the app would show the thing's photo.
 */
import acUnit from '../../assets/try-map/ac_unit.webp?url';
import armchair from '../../assets/try-map/armchair.webp?url';
import coffeeTable from '../../assets/try-map/coffee_table.webp?url';
import drill from '../../assets/try-map/drill.webp?url';
import sofa from '../../assets/try-map/sofa.webp?url';
import tallPlant from '../../assets/try-map/tall_plant.webp?url';
import type { PhotoKey } from './sample';

export const PHOTOS: Record<PhotoKey, string> = {
  sofa,
  armchair,
  coffee_table: coffeeTable,
  tall_plant: tallPlant,
  drill,
  ac_unit: acUnit,
};
