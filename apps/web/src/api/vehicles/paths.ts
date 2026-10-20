/**
 * Every step-5 server path the web app calls that doesn't exist yet, in one place. Each comes from
 * the server's route tables and lands in the matching
 * `apps/server/src/<area>/routes.ts` (T2's stubs: `fuel/`, `vehicles/`, `services/`; the proofs in
 * step 2's `meters/`; the report in `reports/`). A path the server names differently is fixed here
 * and nowhere else. `VEHICLE_METHODS` is what the contract check reads, as steps 2–4 do.
 *
 * Paths that already exist and gain fields or filters are not repeated: a thing and its meters
 * (`inventoryPaths.thing`, `.meter`, `.meterReadings`, `.reading`), Home (`inventoryPaths.home`), a
 * thing's service records (`householdPaths.thingServiceRecords`) and the documents
 * (`householdPaths.documents`, `.document`, `.documentRenew`). `serviceRecord` is step 4's path; step 5
 * adds its GET.
 */

const V1 = '/api/v1';
const seg = (value: string) => encodeURIComponent(value);

export const vehiclePaths = {
  // ----- meters and readings ----------
  meterProofs: (id: string) => `${V1}/meters/${seg(id)}/proofs`,

  // ----- service drafts ----------
  serviceDrafts: `${V1}/service-records/drafts`,
  serviceRecord: (id: string) => `${V1}/service-records/${seg(id)}`,
  serviceRecordConfirm: (id: string) => `${V1}/service-records/${seg(id)}/confirm`,

  // ----- fuel and charging -----------
  thingFuel: (id: string) => `${V1}/things/${seg(id)}/fuel`,
  thingFuelSummary: (id: string) => `${V1}/things/${seg(id)}/fuel/summary`,
  fuelEntry: (id: string) => `${V1}/fuel/${seg(id)}`,

  // ----- vehicles, costs, series and starter schedules -----------
  vehicles: `${V1}/vehicles`,
  thingCosts: (id: string) => `${V1}/things/${seg(id)}/costs`,
  meterSeries: (id: string) => `${V1}/meters/${seg(id)}/series`,
  thingStarterSchedules: (id: string) => `${V1}/things/${seg(id)}/starter-schedules`,

  // ----- the history report -----------
  reportsVehicleHistory: `${V1}/reports/vehicle-history`,

  // ----- 1.3 (D229): LubeLogger's CSV exports into a vehicle -----
  thingLubeLogger: (id: string) => `${V1}/things/${seg(id)}/import/lubelogger`,
} as const;

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** The methods the web calls on each path above (the contract check's list). */
export const VEHICLE_METHODS: Record<keyof typeof vehiclePaths, readonly Method[]> = {
  meterProofs: ['GET'],
  serviceDrafts: ['POST'],
  serviceRecord: ['GET'],
  serviceRecordConfirm: ['POST'],
  thingFuel: ['GET', 'POST'],
  thingFuelSummary: ['GET'],
  fuelEntry: ['PATCH', 'DELETE'],
  vehicles: ['GET'],
  thingCosts: ['GET'],
  meterSeries: ['GET'],
  thingStarterSchedules: ['POST'],
  reportsVehicleHistory: ['POST'],
  thingLubeLogger: ['POST'],
};
