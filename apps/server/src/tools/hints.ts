import type { ToolName } from '@kept/mcp';

// A tool runs its route's operation, and the operation's refusal names the route's field ("Check
// body.dueOn: …"). The model reading it only knows the tool's input, so a tool's answer names the
// tool's field (#425): by this table where the two differ in more than their spelling, else the
// route's name in snake_case.

const PURCHASE: Readonly<Record<string, string>> = {
  purchasedOn: 'purchase.purchased_on',
  vendorId: 'purchase.shop',
  currency: 'purchase.currency',
  total: 'purchase.price',
  lines: 'purchase',
  'lines.description': 'purchase.on_receipt',
  'lines.unitPrice': 'purchase.price',
};

/** Route field (without `body.` and list indexes) → the tool's, per tool. */
export const TOOL_FIELDS: Partial<Record<ToolName, Readonly<Record<string, string>>>> = {
  add_thing: PURCHASE,
  update_thing: PURCHASE,
  create_place: { kindKey: 'kind', map: 'width_cm and length_cm' },
  update_place: { kindKey: 'kind' },
  lend_thing: { alsoParts: 'with_parts_elsewhere' },
  return_thing: { quantityBack: 'quantity', conditionIn: 'condition', notes: 'note' },
  complete_schedule: { servicedOn: 'done_on', anchorOn: 'done_on', reading: 'value' },
  log_fuel: { cost: 'cost.amount', currency: 'cost.currency' },
  log_service: {
    total: 'total.amount',
    currency: 'total.currency',
    'lines.unitCost': 'lines.amount',
  },
};

const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** A path as snake_case: a custom field's key is the person's own, so it stays as written. */
function snakePath(path: string): string {
  const [first, ...rest] = path.split('.');
  if (first === 'custom') return path;
  return [first, ...rest].map((part) => snake(part as string)).join('.');
}

/** `hint` with every `body.…` path it names as the tool's own field. */
export function toolHint(name: ToolName, hint: string): string {
  const fields = TOOL_FIELDS[name] ?? {};
  return hint.replace(
    /\bbody\.([A-Za-z_][\w]*(?:\[\d+\])?(?:\.[A-Za-z_][\w]*(?:\[\d+\])?)*)/g,
    (_, path: string) => fields[path.replace(/\[\d+\]/g, '')] ?? snakePath(path),
  );
}
