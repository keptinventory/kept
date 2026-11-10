import { displayConsumption, type FuelUnit, formatMoney, printedCode } from '@kept/shared';
import { type ReportLocale, wordsFor } from '../labels.js';
import { colonOf, dirOf, intlLocaleOf, numberingOf, sepOf } from '../locale.js';
import { PDF_WORDS, type VehicleWords } from '../words/index.js';
import type { GatheredVehicle, VehicleReportOptions } from './gather.js';

// The vehicle history report's data as template/vehicle.typ reads it (`/data.json`; step-5 T15).
// As for the inventory report (reports/view.ts), every string is final here: numbers, money and
// dates are formatted with Intl in the report's language and digits (D143), so the template only
// lays them out. The VIN and the short ID stay Western and left to right (D143); the plate is
// printed as written, in its own direction (right to left when it holds Arabic letters). The
// words live in words/<locale>.ts, one table per report language (#465).

export type VehicleView = {
  lang: ReportLocale;
  dir: 'ltr' | 'rtl';
  digits: 'latn' | 'arab';
  /** Between a line's parts: a comma, the Arabic comma in Arabic; never the middle dot (#459). */
  sep: string;
  /** After a label ("Consumption: …"), as the language writes it. */
  colon: string;
  labels: Omit<
    VehicleWords,
    | 'cover'
    | 'sources'
    | 'docKinds'
    | 'docStates'
    | 'units'
    | 'distance'
    | 'generated'
    | 'asOf'
    | 'range'
    | 'more'
    | 'moreInvoices'
    | 'perDistance'
    | 'per100'
    | 'mpg'
    | 'miPerKwh'
    | 'perHour'
  > & { cover: VehicleWords['cover'] };
  vehicle: {
    name: string;
    type: string;
    shortId: string;
    vin: string;
    plate: string;
    plateDir: 'ltr' | 'rtl';
    location: string;
    odometer: string;
    status: string;
  };
  photo: string | null;
  qr: string | null;
  generatedLine: string;
  asOfLine: string;
  rangeLine: string;
  footer: string;
  counts: [string, string][];
  readings: { date: string; value: string; source: string; by: string; proof: boolean }[];
  proofs: { photo: string; value: string; date: string }[];
  proofsMore: string;
  services: {
    date: string;
    odometer: string;
    vendor: string;
    total: string;
    lines: { name: string; qty: string; amount: string }[];
    photos: string[];
    more: string;
  }[];
  fuel: {
    summary: [string, string][];
    years: { year: string; fills: string; amount: string }[];
  } | null;
  documents:
    | { name: string; issued: string; expires: string; state: string; cost: string }[]
    | null;
  showMoney: boolean;
  moneyNote: string;
};

export type VehicleViewContext = {
  /** KEPT_PUBLIC_URL's host, for the footer. */
  instance: string;
  now: Date;
  /** Which ids (the vehicle, readings' and invoices' attachments) have a thumbnail. */
  withPhoto: ReadonlySet<string>;
  withQr: ReadonlySet<string>;
};

const ARABIC = /[؀-ۿ]/;

function safeTimeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

/** Builds the template's data from what gatherVehicle() read. */
export function buildVehicleView(
  g: GatheredVehicle,
  options: VehicleReportOptions,
  ctx: VehicleViewContext,
): VehicleView {
  const w = PDF_WORDS[options.locale].vehicle;
  const sep = sepOf(options.locale);
  const intl = intlLocaleOf(options.locale);
  const numberingSystem = numberingOf(options.locale, options.digits);
  const nf = new Intl.NumberFormat(intl, { numberingSystem, maximumFractionDigits: 3 });
  const n1 = new Intl.NumberFormat(intl, { numberingSystem, maximumFractionDigits: 1 });
  const plain = new Intl.NumberFormat(intl, { numberingSystem, useGrouping: false });
  const dateF = new Intl.DateTimeFormat(intl, {
    dateStyle: 'medium',
    timeZone: 'UTC',
    numberingSystem,
  });
  const day = (d: string) => dateF.format(new Date(`${d}T00:00:00Z`));
  const zone = safeTimeZone(g.requesterTimezone);
  const when = new Intl.DateTimeFormat(intl, {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: zone,
    numberingSystem,
  }).format(ctx.now);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone(g.locationTimezone),
  }).format(ctx.now);
  const money = (amount: string, currency: string) =>
    formatMoney(amount, currency, { locale: options.locale, digits: options.digits });
  const unit = g.meter ? (w.distance[g.meter.unit] ?? g.meter.unit) : '';
  const value = (v: string | null) =>
    v === null ? '' : `${nf.format(Number(v))}${unit ? ` ${unit}` : ''}`;
  const fuelUnit = (u: string) => w.units[u] ?? u;
  const distance = (u: string) => w.distance[u] ?? u;
  /** Fuel use in the requester's units (#385), as the app shows it: L or kWh per 100 km, or
   * miles per gallon or per kWh; per hour on an hours meter. */
  const consumption = (perHundred: string, fuel: FuelUnit, meterUnit: string) => {
    const d = displayConsumption(perHundred, fuel, meterUnit, g.requesterUnits);
    const v = n1.format(Number(d.value));
    switch (d.unit) {
      case 'L/100 km':
      case 'kWh/100 km':
        return w.per100(`${v} ${fuelUnit(fuel === 'kWh' ? 'kWh' : 'L')}`, distance('km'));
      case 'mpg':
        return w.mpg(v);
      case 'mi/kWh':
        return w.miPerKwh(v);
      default:
        return d.unit === `${fuel}/h`
          ? w.perHour(v, fuelUnit(fuel))
          : w.per100(`${v} ${fuelUnit(fuel)}`, distance(meterUnit));
    }
  };

  const counts: [string, string][] = [
    [nf.format(g.readingCount), w.readingsCount],
    [nf.format(g.services.length), w.servicesCount],
  ];
  if (options.include.proofPhotos)
    counts.push([nf.format(g.proofs.length + g.moreProofs), w.proofsCount]);
  if (g.documents) counts.push([nf.format(g.documents.length), w.documentsCount]);

  let fuel: VehicleView['fuel'] = null;
  if (g.fuel) {
    const s = g.fuel.summary;
    const summary: [string, string][] = [];
    for (const u of s.byUnit) {
      summary.push([
        w.consumption,
        u.consumption && g.meter
          ? consumption(u.consumption.perHundred, u.unit as FuelUnit, g.meter.unit)
          : w.noConsumption,
      ]);
    }
    for (const p of s.perDistance ?? [])
      summary.push([w.perDistance(unit), money(p.amount, p.currency)]);
    for (const m of s.monthlyAverage ?? []) summary.push([w.monthly, money(m.amount, m.currency)]);
    fuel = {
      summary,
      years: g.fuel.years.map((y) => ({
        year: plain.format(Number(y.year)),
        fills: nf.format(y.fills),
        amount: y.amounts
          .map((a) => `${nf.format(Number(a.amount))} ${fuelUnit(a.unit)}`)
          .join(sep),
      })),
    };
  }

  const ended = wordsFor(options.locale).lifecycle;
  const lifecycle =
    g.thing.lifecycle === 'in_use' ? '' : (ended[g.thing.lifecycle as keyof typeof ended] ?? '');
  return {
    lang: options.locale,
    dir: dirOf(options.locale),
    digits: numberingSystem,
    sep,
    colon: colonOf(options.locale),
    labels: {
      title: w.title,
      cover: w.cover,
      readings: w.readings,
      proofs: w.proofs,
      services: w.services,
      fuel: w.fuel,
      documents: w.documents,
      date: w.date,
      reading: w.reading,
      source: w.source,
      by: w.by,
      proof: w.proof,
      item: w.item,
      qty: w.qty,
      amount: w.amount,
      total: w.total,
      year: w.year,
      fills: w.fills,
      fuelAmount: w.fuelAmount,
      name: w.name,
      issued: w.issued,
      expires: w.expires,
      state: w.state,
      cost: w.cost,
      page: w.page,
      of: w.of,
      contents: w.contents,
      confidential: w.confidential,
      none: w.none,
      readingsCount: w.readingsCount,
      servicesCount: w.servicesCount,
      proofsCount: w.proofsCount,
      documentsCount: w.documentsCount,
      consumption: w.consumption,
      monthly: w.monthly,
      noConsumption: w.noConsumption,
      readingsNote: w.readingsNote,
      moneyHidden: w.moneyHidden,
    },
    vehicle: {
      name: g.thing.name,
      type: g.thing.typeName ?? '',
      shortId: g.thing.shortCode ? printedCode(g.thing.shortCode) : '',
      vin: g.thing.vin ?? '',
      plate: g.thing.plate ?? '',
      plateDir: g.thing.plate && ARABIC.test(g.thing.plate) ? 'rtl' : 'ltr',
      location: g.locationName,
      odometer: g.latest ? `${value(g.latest.value)}${sep}${day(g.latest.day)}` : '',
      status: lifecycle,
    },
    photo: ctx.withPhoto.has(g.thing.id) ? `/thumbs/${g.thing.id}.jpg` : null,
    qr: ctx.withQr.has(g.thing.id) ? `/qr/${g.thing.id}.svg` : null,
    generatedLine: w.generated(g.requesterName, when),
    asOfLine: w.asOf(day(today)),
    rangeLine:
      options.from || options.to
        ? w.range(options.from ? day(options.from) : '…', options.to ? day(options.to) : day(today))
        : '',
    footer: ['Kept', ctx.instance, when].filter((x) => x !== '').join(sep),
    counts,
    readings: g.readings.map((r) => ({
      date: day(r.day),
      value: value(r.value),
      source: w.sources[r.source] ?? r.source,
      by: r.by ?? '',
      proof: r.proofKey !== null,
    })),
    proofs: g.proofs
      .filter((p) => ctx.withPhoto.has(p.id))
      .map((p) => ({ photo: `/thumbs/${p.id}.jpg`, value: value(p.value), date: day(p.day) })),
    proofsMore: g.moreProofs > 0 ? w.more(nf.format(g.moreProofs)) : '',
    services: g.services.map((s) => ({
      date: day(s.servicedOn),
      odometer: value(s.reading),
      vendor: [s.vendor, s.by].filter((x) => !!x).join(sep),
      total: s.money?.total && s.money.currency ? money(s.money.total, s.money.currency) : '',
      lines: s.lines.map((l) => ({
        name: l.description,
        qty: l.quantity ? nf.format(Number(l.quantity)) : '',
        amount:
          l.unitCost && s.money?.currency
            ? money(lineAmount(l.unitCost, l.quantity), s.money.currency)
            : '',
      })),
      photos: s.invoices.filter((i) => ctx.withPhoto.has(i.id)).map((i) => `/thumbs/${i.id}.jpg`),
      more: s.moreInvoices > 0 ? w.moreInvoices(nf.format(s.moreInvoices)) : '',
    })),
    fuel,
    documents:
      g.documents?.map((d) => ({
        name: d.title ?? w.docKinds[d.kind] ?? d.kind,
        issued: d.issuedOn ? day(d.issuedOn) : '',
        expires: day(d.expiresOn),
        state: d.renewed
          ? w.docStates.renewed
          : d.expiresOn < today
            ? w.docStates.expired
            : w.docStates.current,
        cost: d.money?.cost && d.money.currency ? money(d.money.cost, d.money.currency) : '',
      })) ?? null,
    showMoney: g.showMoney,
    moneyNote: g.moneyHidden ? w.moneyHidden : '',
  };
}

/** A line's amount: its unit cost times its quantity (1 when none), exact to 4 places. */
function lineAmount(unitCost: string, quantity: string | null): string {
  const scale = (v: string, places: number) => {
    const [whole = '0', frac = ''] = v.split('.');
    return (
      BigInt(whole) * 10n ** BigInt(places) +
      BigInt(frac.padEnd(places, '0').slice(0, places) || '0')
    );
  };
  const product = scale(unitCost, 4) * scale(quantity ?? '1', 3); // 10^-7
  const rounded = (product + 500n) / 1000n; // 10^-4
  const whole = rounded / 10_000n;
  const frac = (rounded % 10_000n).toString().padStart(4, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}
