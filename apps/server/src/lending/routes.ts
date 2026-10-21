import { CONDITIONS, HANDOVER_LIMITS, LOAN_DIRECTIONS, RETURN_LINE_OUTCOMES } from '@kept/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { KeptApp } from '../http/app.js';
import { PAGE_DEFAULT, PAGE_MAX, requireIfMatch } from '../http/conventions.js';
import type { InventoryDeps } from '../http/routes.js';
import { scopedRead, scopedWrite } from '../http/write.js';
import { ThingRowSchema } from '../things/view.js';
import {
  ExcludedSchema,
  HandoverSchema,
  handoverView,
  lend,
  loseLoan,
  registerHandoverUndo,
  returnHandover,
  thingHandovers,
  updateHandover,
} from './handovers.js';
import { returnLoan } from './return.js';
import {
  addConditionPhoto,
  borrow,
  type Ctx,
  deleteLoan,
  listLoans,
  personLoans,
  thingLoans,
  updateLoan,
} from './service.js';
import { registerLendingUndo } from './undo.js';
import { LoanRowSchema, LoanSchema } from './view.js';

// Lending and borrowing (D10, D45, D56, D57, D119, D172), in the shapes of the
// web contract (apps/web/src/api/household/{types,paths}.ts):
//
// POST   /api/v1/things/:id/lend {loanId?, handoverId?, person, startedAt?, dueOn?, quantity?,
//                                 notes?, conditionOut?, leadDays?, alsoParts?}
//                                         → 201 {loan, thing, splitFrom?, handover, excluded}
//                                           409 already_on_loan, thing_in_repair; handover.create
// GET    /api/v1/handovers/:id            → Handover (its lines)
// PATCH  /api/v1/handovers/:id (If-Match) {dueOn?, leadDays?, notes?} → Handover  handover.update
// POST   /api/v1/handovers/:id/return {returnedAt?, lines: [{loanId, outcome, conditionIn?, notes?,
//                                       quantityBack?, updateCondition?}]} → Handover
//                                         (loan.return / loan.lost per line, undoable)
// POST   /api/v1/loans/:id/lost (If-Match) {notes?} → {loan}               loan.lost, undoable
// GET    /api/v1/things/:id/handovers     → {items: Handover[]} (with this thing as the root)
// POST   /api/v1/locations/:id/borrow {thingId?, loanId?, name, typeId?, target, person, dueOn?,
//                                      notes?}  → 201 {loan, thing}
// POST   /api/v1/loans/:id/return (If-Match) {returnedAt?, to?, mergeBack?, notes?, conditionIn?,
//                                          updateCondition?, quantityBack?}
//                                         → {loan, thing, mergedInto?}      loan.return, undoable
// PATCH  /api/v1/loans/:id (If-Match) {dueOn?, notes?, person?} → Loan     loan.update, undoable
// DELETE /api/v1/loans/:id (If-Match)     → 204                            loan.delete, undoable
// GET    /api/v1/loans?direction&state&locationId&personId&q&cursor&limit
//                                         → {items: LoanRow[], counts: {out, in, overdue}, next_cursor}
// GET    /api/v1/things/:id/loans         → {items: Loan[]}
// GET    /api/v1/people/:id/loans?cursor  → {has, lentUs, history, next_cursor}
// POST   /api/v1/loans/:id/attachments {id?, fileId, role: condition_out | condition_in}
//                                         → 201 AttachmentView                attachment.create
//
// Loans are the `lending` module's: a read where it is off is 404 `module_off`, a write 409,
// checked in the service where the location is known. Writers are members and above
// (`things.edit`); a viewer reads.

const Id = z.uuid();
const Params = z.object({ id: Id });
const Day = z.iso.date();
const Iso = z.iso.datetime({ offset: true });
const Notes = z.string().trim().max(2000);
const Person = z.union([
  z.strictObject({ id: Id }),
  z.strictObject({ name: z.string().trim().min(1).max(120) }),
  z.strictObject({ memberUserId: Id }),
]);
const Target = z.union([z.strictObject({ placeId: Id }), z.strictObject({ containerId: Id })]);

const Quantity = z.string().regex(/^\d{1,9}(\.\d{1,3})?$/, 'a quantity, e.g. 3');
const Grade = z.enum(CONDITIONS);
const LendBody = z.strictObject({
  loanId: Id.optional(),
  handoverId: Id.optional(),
  person: Person,
  startedAt: Iso.optional(),
  dueOn: Day.optional(),
  quantity: Quantity.optional(),
  notes: Notes.optional(),
  conditionOut: Grade.optional(),
  leadDays: z.number().int().min(0).max(HANDOVER_LIMITS.maxLeadDays).optional(),
  alsoParts: z.array(Id).max(HANDOVER_LIMITS.lines).optional(),
});
const HandoverReturnBody = z.strictObject({
  returnedAt: Iso.optional(),
  lines: z
    .array(
      z.strictObject({
        loanId: Id,
        outcome: z.enum(RETURN_LINE_OUTCOMES),
        conditionIn: Grade.optional(),
        notes: Notes.optional(),
        quantityBack: Quantity.optional(),
        updateCondition: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(HANDOVER_LIMITS.lines),
});
const HandoverUpdateBody = z.strictObject({
  dueOn: Day.nullable().optional(),
  leadDays: z.number().int().min(0).max(HANDOVER_LIMITS.maxLeadDays).optional(),
  notes: Notes.nullable().optional(),
});
const LostBody = z.strictObject({ notes: Notes.optional() });
const BorrowBody = z.strictObject({
  thingId: Id.optional(),
  loanId: Id.optional(),
  name: z.string().trim().min(1).max(200),
  typeId: Id.optional(),
  target: Target,
  person: Person,
  dueOn: Day.optional(),
  notes: Notes.optional(),
});
const ReturnBody = z.strictObject({
  returnedAt: Iso.optional(),
  to: z.union([z.literal('previous'), Target]).optional(),
  mergeBack: z.boolean().optional(),
  notes: Notes.optional(),
  conditionIn: Grade.optional(),
  updateCondition: z.boolean().optional(),
  quantityBack: Quantity.optional(),
});
const UpdateBody = z.strictObject({
  dueOn: Day.nullable().optional(),
  notes: Notes.nullable().optional(),
  person: Person.optional(),
});
const PhotoBody = z.strictObject({
  id: Id.optional(),
  fileId: Id,
  role: z.enum(['condition_out', 'condition_in']),
});

const ListQuery = z.object({
  direction: z.enum(LOAN_DIRECTIONS).optional(),
  state: z.enum(['open', 'overdue', 'returned']).optional(),
  locationId: Id.optional(),
  personId: Id.optional(),
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_MAX).default(PAGE_DEFAULT),
  cursor: z.string().max(2048).optional(),
});
const PageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(PAGE_MAX).default(PAGE_DEFAULT),
  cursor: z.string().max(2048).optional(),
});

const LendResult = z.object({
  loan: LoanSchema,
  thing: ThingRowSchema,
  splitFrom: ThingRowSchema.optional(),
  handover: HandoverSchema,
  excluded: z.array(ExcludedSchema),
});
const BorrowResult = z.object({ loan: LoanSchema, thing: ThingRowSchema });
const ReturnResult = z.object({
  loan: LoanSchema,
  thing: ThingRowSchema,
  mergedInto: ThingRowSchema.optional(),
});
const LoansPage = z.object({
  items: z.array(LoanRowSchema),
  counts: z.object({ out: z.number(), in: z.number(), overdue: z.number() }),
  next_cursor: z.string().nullable(),
});
const PersonLoans = z.object({
  has: z.array(LoanRowSchema),
  lentUs: z.array(LoanRowSchema),
  history: z.array(LoanRowSchema),
  next_cursor: z.string().nullable(),
});
// The attachment view (files/routes.ts checks its shape); passed through here.
const AttachmentView = z.looseObject({ id: z.uuid(), subject: z.looseObject({}) });

export async function lendingRoutes(app: KeptApp, deps: InventoryDeps): Promise<void> {
  const { pools } = deps;
  registerLendingUndo();
  registerHandoverUndo();

  const ctxOf = (
    req: FastifyRequest,
    tx: Ctx['tx'],
    client: Ctx['client'],
    scope: Ctx['scope'],
  ): Ctx => ({ tx, client, scope, requestId: req.id, files: deps.files, jobs: deps.jobs });
  const write = <B>(
    req: FastifyRequest,
    reply: FastifyReply,
    status: number,
    fn: (ctx: Ctx) => Promise<B>,
  ) =>
    scopedWrite(pools, req, reply, async (tx, client, scope) => ({
      status,
      body: await fn(ctxOf(req, tx, client, scope)),
    }));
  const read = <B>(req: FastifyRequest, fn: (ctx: Ctx) => Promise<B>) =>
    scopedRead(pools, req, (tx, client, scope) => fn(ctxOf(req, tx, client, scope)));
  const lower = (id: string) => id.toLowerCase();

  app.post(
    '/api/v1/things/:id/lend',
    { schema: { params: Params, body: LendBody, response: { 201: LendResult } } },
    (req, reply) => write(req, reply, 201, (ctx) => lend(ctx, lower(req.params.id), req.body)),
  );

  app.post(
    '/api/v1/locations/:id/borrow',
    { schema: { params: Params, body: BorrowBody, response: { 201: BorrowResult } } },
    (req, reply) => write(req, reply, 201, (ctx) => borrow(ctx, lower(req.params.id), req.body)),
  );

  app.post(
    '/api/v1/loans/:id/return',
    { schema: { params: Params, body: ReturnBody, response: { 200: ReturnResult } } },
    (req, reply) => {
      const expected = requireIfMatch(req);
      return write(req, reply, 200, (ctx) =>
        returnLoan(ctx, lower(req.params.id), expected, req.body),
      );
    },
  );

  app.patch(
    '/api/v1/loans/:id',
    { schema: { params: Params, body: UpdateBody, response: { 200: LoanSchema } } },
    (req, reply) => {
      const expected = requireIfMatch(req);
      return write(req, reply, 200, (ctx) =>
        updateLoan(ctx, lower(req.params.id), expected, req.body),
      );
    },
  );

  app.delete('/api/v1/loans/:id', { schema: { params: Params } }, (req, reply) => {
    const expected = requireIfMatch(req);
    return write(req, reply, 204, async (ctx) => {
      await deleteLoan(ctx, lower(req.params.id), expected);
      return undefined;
    });
  });

  app.get(
    '/api/v1/loans',
    { schema: { querystring: ListQuery, response: { 200: LoansPage } } },
    (req) => read(req, (ctx) => listLoans(ctx.client, ctx.files, req.query)),
  );

  app.get(
    '/api/v1/things/:id/loans',
    { schema: { params: Params, response: { 200: z.object({ items: z.array(LoanSchema) }) } } },
    (req) => read(req, (ctx) => thingLoans(ctx, lower(req.params.id))),
  );

  app.get(
    '/api/v1/people/:id/loans',
    { schema: { params: Params, querystring: PageQuery, response: { 200: PersonLoans } } },
    (req) => read(req, (ctx) => personLoans(ctx, lower(req.params.id), req.query)),
  );

  app.get(
    '/api/v1/handovers/:id',
    { schema: { params: Params, response: { 200: HandoverSchema } } },
    (req) => read(req, (ctx) => handoverView(ctx, lower(req.params.id))),
  );

  app.patch(
    '/api/v1/handovers/:id',
    { schema: { params: Params, body: HandoverUpdateBody, response: { 200: HandoverSchema } } },
    (req, reply) => {
      const expected = requireIfMatch(req);
      return write(req, reply, 200, (ctx) =>
        updateHandover(ctx, lower(req.params.id), expected, req.body),
      );
    },
  );

  app.post(
    '/api/v1/handovers/:id/return',
    { schema: { params: Params, body: HandoverReturnBody, response: { 200: HandoverSchema } } },
    (req, reply) =>
      write(req, reply, 200, (ctx) => returnHandover(ctx, lower(req.params.id), req.body)),
  );

  app.post(
    '/api/v1/loans/:id/lost',
    {
      schema: { params: Params, body: LostBody, response: { 200: z.object({ loan: LoanSchema }) } },
    },
    (req, reply) => {
      const expected = requireIfMatch(req);
      return write(req, reply, 200, (ctx) =>
        loseLoan(ctx, lower(req.params.id), expected, req.body),
      );
    },
  );

  app.get(
    '/api/v1/things/:id/handovers',
    { schema: { params: Params, response: { 200: z.object({ items: z.array(HandoverSchema) }) } } },
    (req) => read(req, (ctx) => thingHandovers(ctx, lower(req.params.id))),
  );

  app.post(
    '/api/v1/loans/:id/attachments',
    { schema: { params: Params, body: PhotoBody, response: { 201: AttachmentView } } },
    (req, reply) =>
      write(req, reply, 201, (ctx) => addConditionPhoto(ctx, lower(req.params.id), req.body)),
  );
}
