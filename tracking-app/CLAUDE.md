# Tracking App - Goldstar

## Overview
Order management platform for Goldstar (shower enclosure manufacturer, Portugal).
Admin dashboard for managing quotes (orçamentos), orders, and deliveries.
Public-facing pages for clients to request quotes and track orders.

## Tech Stack
- **Next.js 15** (App Router, Turbopack), **React 19**, **TypeScript 5**
- **PostgreSQL** + **Prisma 6** (ORM, migrations in `/prisma/`)
- **NextAuth 4** — JWT sessions, credentials provider, middleware protects `/admin/*`
- **Tailwind CSS 4** + CVA (class-variance-authority) for component variants
- **React Hook Form 7** + **Zod 4** for all forms and validation
- **@react-pdf/renderer 4** — PDF generation (server-side, React components)
- **Vercel Blob** — file/PDF storage
- **Resend** + **@react-email** — transactional emails
- No global state manager — URL params (filters), RHF (forms), local `useState`

## Key Routes

### Public
- `/orcamentos/novo` — client quote request form (SEO-indexed)
- `/orcamentos/sucesso` — submission success + GA4 event
- `/pedido/[publicToken]` — order status tracking (no-index)

### Admin (protected by middleware)
- `/admin` — dashboard
- `/admin/orcamentos` — quote list; `/admin/orcamentos/[id]` — editor
- `/admin/orders` — order management
- `/admin/clients` — customer management
- `/admin/arquivos` — file management
- `/admin/trash` — soft-deleted items

### Key API Routes
- `POST /api/budgets` — create quote
- `PATCH /api/budgets/[id]` — update quote (prices, fields)
- `POST /api/budgets/[id]/convert` — generate PDF + send email to client
- `GET /api/budgets/[id]/invoice` — attach invoice PDF
- `GET/PATCH /api/orders/*` — order CRUD + bulk updates
- `GET /api/catalog/[group]` — catalog options by group
- `GET /api/pedido/[publicToken]/status` — public order status

## Key Models (Prisma)

### Budget
Core quote model. Key fields:
```
priceCents        Int?   — product/base price (cents)
installPriceCents Int?   — installation surcharge (cents)
deliveryType      String — 'entrega_instalacao' | 'instalacao' | 'entrega'
housingType, floorNumber, hasElevator — delivery logistics
quotedPdfUrl      String? — Vercel Blob URL of generated quote PDF
invoicePdfUrl     String? — optional attached invoice PDF
filesJson         Json?   — [{kind, label, url}] merged file list
publicToken       String  — unique token for client-facing link
sentAt            DateTime? — when quote email was sent
confirmedAt       DateTime? — when client confirmed
convertedOrderId  String?   — FK to Order after conversion
```

### Order
Created from a confirmed Budget. Statuses: `PREPARACAO → PRODUCAO → EXPEDICAO → ENTREGUE`.

### Customer
Upserted from Budget on send. Linked to Orders.

### CatalogOption
Product catalog (MODEL, HANDLE, FINISH, GLASS_TIPO, SERIGRAPHY, COMPLEMENTO, etc.).

## Quote (Orçamento) Flow

1. **Client submits** `/orcamentos/novo` → `POST /api/budgets` → Budget created (no price). Confirmation email sent.
2. **Admin edits** `/admin/orcamentos/[id]` (`AdminBudgetEditor.tsx`):
   - Edits product config (model, handle, finish, glass, measures, delivery info)
   - Sets prices: `priceEuro` + `installEuro` (local state, outside RHF)
   - Optionally attaches invoice PDF
   - Save → `PATCH /api/budgets/[id]` → stored as `priceCents` + `installPriceCents`
3. **Admin sends** → `POST /api/budgets/[id]/convert`:
   - Renders `OrcamentoPDF` component → PDF buffer via `@react-pdf/renderer`
   - Uploads to Vercel Blob, stores URL, merges into `filesJson`
   - Generates `publicToken`, sets `sentAt`
   - Sends email via Resend with PDF attached (`BudgetSent` template)
   - Async by default (202 + jobId); `?sync=1` forces synchronous
4. **Client confirms** via email link → `confirmedAt` set
5. **Admin converts** confirmed quote to Order

## Pricing Pattern
Prices are always stored as **integers in cents**. The `eur()` helper in `OrcamentoPDF.tsx` and `centsToEuro()` / `euroToCents()` in `AdminBudgetEditor.tsx` handle conversion.

The PDF (`OrcamentoPDF.tsx`) renders a "Valores" section with each price as a separate line item + grand total. When adding a new price component (e.g. delivery), mirror the `installPriceCents` pattern across:
1. `prisma/schema.prisma` — add field + migrate
2. `lib/zod-budget.ts` — add to `BudgetUpdateSchema`
3. `app/api/budgets/[id]/route.ts` — pass through in PATCH
4. `AdminBudgetEditor.tsx` — add state var + input + include in save
5. `OrcamentoPDF.tsx` — add line item + include in total

## Code Patterns
- `cn()` from `lib/utils.ts` — class merging (clsx + tailwind-merge)
- `api<T>()` from `lib/api.ts` — typed fetch wrapper
- `fmt.date()`, `fmt.currency()` from `lib/format.ts` — pt-PT formatting
- `requireAdminSession()` from `lib/auth-helpers.ts` — server-side auth guard
- Soft deletes via `deletedAt` field (Budget, Order, Customer)

## Deployment
- Vercel (Blob storage integrated)
- GitHub repo

## Rules
- All text/UI in **Portuguese (pt-PT)**
- Use existing code patterns and conventions
- Always plan before implementing changes
- Run build check after changes
