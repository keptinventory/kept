/**
 * Where the other step-5 tasks' parts plug into the vehicle page. Each is
 * a component with no required props that reads the thing from `useThingCtx()` (and moves between
 * tabs with `useVehicleNav()` from ./nav.ts), so the page mounts it without knowing its insides:
 *
 * - Services tab: `VehicleServices` (./services-tab.tsx);
 * - Fuel tab: `VehicleFuel`, and on the Overview `FuelSummaryCard` (components/fuel/);
 * - Documents tab: `VehicleDocuments` (./documents-tab.tsx), its registration card row
 *   opening Capture in LABEL mode on this vehicle (components/capture/links.ts);
 * - the history report: `HistoryReportButton` (./history-report-sheet.tsx) on the
 *   Overview, and `VehicleReportSheet({open, onClose})` from the action menu;
 * - Log a reading: `LogReadingSheet` (components/readings/log-reading-sheet.tsx), opened from
 *   the Overview's odometer card and the Readings tab.
 *
 * To plug a part in, change its line here; nothing else on the page needs to move.
 */
import { useNavigate } from '@tanstack/react-router';
import { captureLabelSearch } from '@/components/capture/links';
import { useThingCtx } from '@/components/things/context';
import { VehicleDocuments as Documents } from './documents-tab';

export { FuelSummaryCard, VehicleFuel } from '@/components/fuel/fuel-tab';
export { LogReadingSheet } from '@/components/readings/log-reading-sheet';
export { HistoryReportButton, VehicleReportSheet } from './history-report-sheet';
export { VehicleServices } from './services-tab';

/** The Documents tab, its registration card row reading the card in LABEL mode on this vehicle. */
export function VehicleDocuments() {
  const { thing } = useThingCtx();
  const navigate = useNavigate();
  return (
    <Documents
      readLabel={() => void navigate({ to: '/capture', search: captureLabelSearch(thing.id) })}
    />
  );
}
