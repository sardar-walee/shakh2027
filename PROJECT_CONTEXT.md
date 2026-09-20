# SHAKH SUPER — Project Context & Architecture

> **Purpose:** This document is the source of truth for future agents/developers working on this repository. Read it before changing application code or Supabase SQL.
>
> **Repository state audited:** 2026-09-17. This archive is a Vite + React application, not a Next.js application.

## 1. Project Overview & Tech Stack

### Product

**SHAKH SUPER / شاخ** is a multilingual marketplace and delivery platform for Iraq. The current repository provides a single-page customer/merchant interface for:

- Restaurant / food
- Supermarket / groceries
- Fashion
- Beauty
- Cars
- Delivery/captain role surfaces
- Customer shopping cart and cash-on-delivery order creation
- Role-aware dashboard starter
- Supabase Auth, Postgres, RLS and Realtime integration
- PWA installation/update behavior
- Kurdish Sorani, Arabic and English UI

The intended production model is **Supabase as the live backend**. Do not introduce Firebase, a local database, mock persistence, or browser-local order/post storage.

### Runtime

| Layer | Current implementation |
|---|---|
| UI | React 18.3 + TypeScript 5.7 |
| Build | Vite 6 |
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| Realtime | Supabase Realtime |
| Storage | Supabase Storage configuration |
| Icons | lucide-react |
| PWA | `public/manifest.webmanifest` + `public/sw.js` |
| Hosting | Vercel static deployment |
| Document direction | RTL |
| Languages | Kurdish Sorani, Arabic, English |
| Payments | Cash on delivery only in this version |
| Maps | Client-side provider configured through `VITE_MAP_*` |

### Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

There is currently no test runner, linter, formatter, or automated E2E suite. `npm run build` is the compile/release gate.

---

## 2. Directory & File Structure

```text
.
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
├── README.md
├── DEPLOYMENT-CHECKLIST.md
├── PROJECT_CONTEXT.md
├── public/
│   ├── icon.svg
│   ├── manifest.webmanifest
│   └── sw.js
├── src/
│   ├── main.tsx
│   ├── styles.css
│   ├── vite-env.d.ts
│   └── lib/
│       ├── platform.ts
│       └── supabase.ts
└── supabase/
    ├── schema.sql
    ├── v2_migration.sql
    ├── v3_enum_fix.sql
    ├── v3_migration.sql
    ├── legacy_compatibility.sql
    ├── platform_services.sql
    ├── promote_super_admin.sql
    └── production_repair.sql   # production repair added in this update
```

### Runtime flow

1. `index.html` loads the RTL HTML shell and mounts `#root`.
2. `src/main.tsx` owns the current application UI, auth flow, feed, cart, posting and dashboard surfaces.
3. `src/lib/supabase.ts` creates a browser Supabase client from public Vite environment variables.
4. On startup, the application obtains the Supabase session.
5. If authenticated, it reads the user's `profiles.role`, then loads active `posts`.
6. Supabase Realtime listens for `public.posts` changes and refreshes the feed.
7. Creating a post inserts into `public.posts`.
8. Checkout inserts `public.orders` and then `public.order_items`.
9. Supabase Auth handles email signup, email/password login, confirmation, password reset and password update.
10. The auth database trigger creates a `profiles` row for new users.
11. `styles.css` provides the RTL responsive visual system and premium UI overrides.

### Important current architectural limitation

`main.tsx` is still a large single file. It is functional but should be split gradually into feature modules rather than rewritten wholesale:

```text
src/
├── components/
│   ├── auth/
│   ├── marketplace/
│   ├── dashboard/
│   └── layout/
├── hooks/
├── services/
│   ├── auth.ts
│   ├── posts.ts
│   └── orders.ts
├── types/
└── i18n/
```

Do this incrementally and keep behavior stable.

---

## 3. Configurations & Environment Variables

### Required frontend variables

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
VITE_SUPABASE_STORAGE_BUCKET=product-images
VITE_MAP_API_KEY=YOUR_PUBLIC_MAP_API_KEY
VITE_MAP_STYLE_URL=https://demotiles.maplibre.org/style.json
```

### Security

- Only public Supabase URL + anon/publishable key belong in Vite client variables.
- **Never** place a Supabase `service_role` key in `.env` exposed to Vite, source code, GitHub, or browser JavaScript.
- Database security must come from RLS and server-side/database authorization.
- Do not solve authorization by hiding buttons in React.
- Role changes must happen through authorized database operations.

### Supabase project

The configured production project is the SHAKH Supabase project. The exact URL belongs in deployment environment variables rather than hard-coded in source.

### Auth redirect requirements

In Supabase Auth settings, configure:

- Production site URL
- Production domain in redirect URLs
- Vercel preview URL if preview auth is required
- Email confirmation redirect
- Password recovery redirect

The application uses `window.location.origin` for auth redirects, so the domain must be registered in Supabase.

---

## 4. Architecture & Coding Standards

### Non-negotiable rules

1. **Supabase is the source of truth.**
2. No demo posts, fake users, fake sessions, mock orders, local database, or `localStorage` persistence for business data.
3. Public feed data must come from `public.posts`.
4. Orders must be stored in `public.orders` + `public.order_items`.
5. Authentication must come from Supabase Auth.
6. Authorization must be enforced by Supabase RLS.
7. Realtime must use Supabase Realtime; do not invent polling/local event buses when Realtime is available.
8. Cash on delivery is the only payment method in the current release.
9. Never let a browser choose or elevate its own privileged role.
10. New users default to `customer`.
11. `super_admin` is granted explicitly in the database.
12. A role is an **identity/permission**; a post category is a **marketplace section**. They must not be represented by the same database enum.
13. UI language changes must not alter database meaning.
14. RTL must remain supported.
15. All new UI must work on desktop, tablet and mobile.
16. Avoid breaking changes to existing database columns. Add migrations that are idempotent where possible.
17. Before deployment, run `npm run build`.
18. After a schema change, test Auth, feed read, post insert, order insert, order item insert and Realtime.

### Role model

Current roles:

```text
super_admin
admin
captain
restaurant
supermarket
fashion
beauty
car_dealer
customer
```

Posting rule:

| Role | Allowed section |
|---|---|
| super_admin | All marketplace sections |
| restaurant | restaurant |
| supermarket | supermarket |
| fashion | fashion |
| beauty | beauty |
| car_dealer | car_dealer |
| captain | No marketplace post |
| customer | No marketplace post |
| admin | Controlled by explicit management permissions |

The database is authoritative. A user changing a React dropdown must never gain permissions.

### State management

Current state is React local state in `main.tsx`.

Use local React state for:

- modal/panel visibility
- form fields
- search/filter state
- cart UI
- transient notices

Use Supabase for:

- users
- roles
- posts
- orders
- order items
- wallet/financial records
- notifications
- realtime state
- persistent media

Do not introduce a global state library merely to compensate for the current file size. First separate services/hooks/components.

### Error handling

- Never display raw internal stack traces.
- Auth errors should be mapped to clear Kurdish/Arabic/English messages.
- Database errors should be logged during development and shown as concise user-facing messages.
- Empty data is not an error.
- Authentication failures must not silently create a fake session.

---

## 5. Database & Schema Rules

### Core tables

#### `profiles`

Links `auth.users` to application identity.

Important columns:

```text
id uuid PK -> auth.users(id)
full_name text
phone text
role public.app_role
created_at timestamptz
```

Default role: `customer`.

#### `posts`

Marketplace content.

Important columns:

```text
id uuid PK
owner_id uuid -> profiles(id)
category text
title text
description text
image_url text
price numeric
currency text
status text
created_at timestamptz
```

**Critical rule:** `category` is text, not `app_role`. This allows marketplace sections to evolve independently from authentication roles.

Allowed current sections:

```text
restaurant
supermarket
fashion
beauty
car_dealer
```

#### `orders`

Cash-on-delivery order header.

Important columns:

```text
id
customer_id
captain_id
status
payment_method
products_total
delivery_fee
platform_fee
merchant_amount
captain_amount
total
delivery_address
created_at
```

#### `order_items`

Order line items:

```text
id
order_id
post_id
quantity
unit_price
```

#### `wallet_transactions`

Financial ledger foundation:

```text
id
user_id
order_id
kind
amount
note
created_at
```

#### `role_permissions`

Role-to-permission mapping.

`super_admin` receives `*`.

#### `platform_settings`

Platform configuration such as commission, delivery fee, currency and language.

#### `audit_logs`

Security/administration audit trail.

### Database relationships

```text
auth.users
   │
   └── profiles
        │
        ├── posts.owner_id
        ├── orders.customer_id
        ├── orders.captain_id
        └── wallet_transactions.user_id

orders
   │
   └── order_items
          │
          └── posts
```

### RLS rules

- Active posts are publicly readable.
- Owners can manage their own posts subject to role/category authorization.
- `super_admin` can manage all posts.
- Customers can create their own cash orders.
- Captains can update orders assigned to them.
- Managers can access orders according to `manage_orders`.
- Users can read their own profile.
- Role promotion is not available to normal users.
- RLS is the security boundary.

### Migration order

For an existing SHAKH database:

1. `schema.sql` — baseline only when establishing the schema.
2. `v3_enum_fix.sql` — enum additions if needed.
3. `v2_migration.sql`
4. `v3_migration.sql`
5. `legacy_compatibility.sql` — only when legacy tables are intentionally retained.
6. `platform_services.sql`
7. **`production_repair.sql` — run this latest.**

Do not blindly rerun destructive legacy migrations on a production database.

### Realtime

The production repair migration ensures `posts` and `orders` are members of `supabase_realtime` where the publication exists.

When adding Realtime features, explicitly verify:

- table is in publication
- RLS permits the intended subscriber
- client subscribes to the exact schema/table
- updates trigger a fresh query

---

## 6. Authentication Rules & Known Fixes

### Required behavior

- Login: `signInWithPassword`
- Signup: `signUp`
- Confirmation: Supabase email confirmation
- Forgot password: `resetPasswordForEmail`
- Recovery: detect `PASSWORD_RECOVERY`
- Password update: `updateUser({ password })`
- Logout: `signOut`
- Profile creation: database trigger

### Current fixes

The updated client:

- starts with an empty live feed rather than demo seed data
- requires Supabase authentication for posting
- reads the authenticated user's role from `profiles`
- no longer provides a fake "demo role" selector as an authorization mechanism
- reloads live data after auth events
- treats missing session as signed-out state
- does not create local/mock orders when Supabase is unavailable

### If login still fails

Check in this order:

1. Supabase project is reachable.
2. `VITE_SUPABASE_URL` is correct.
3. `VITE_SUPABASE_ANON_KEY` is correct.
4. Email/password provider is enabled.
5. User exists in `auth.users`.
6. Email confirmation requirement matches the expected production flow.
7. Auth Site URL/Redirect URLs include the current domain.
8. `profiles` row exists.
9. `production_repair.sql` has been applied.
10. Browser console/network response shows the actual Supabase error.

Do not fix an Auth error by adding fake frontend authentication.

---

## 7. Design System & UX Rules

The UI is RTL-first and should feel premium rather than like a generic starter dashboard.

Design direction:

- deep premium surfaces + luminous accent gradients
- orange/blue brand accents
- glassmorphism used selectively
- strong visual hierarchy
- large touch targets
- responsive cards
- clear empty/loading/error states
- accessible contrast
- restrained animation
- mobile bottom navigation where appropriate
- no cluttered admin-style tables on customer-facing pages

Brand:

```text
SHAKH SUPER
شاخ
```

Primary product message:

```text
هەموو شتێک لە یەک شوێن
```

Do not replace the brand with a generic template identity.

---

## 8. Current Roadmap & Safe Update Rules

### Immediate production priorities

1. Apply `supabase/production_repair.sql`.
2. Confirm Auth provider and redirect URLs.
3. Verify profile trigger and roles.
4. Verify public active posts after refresh.
5. Verify post insertion under each permitted role.
6. Verify unauthorized category insertion is rejected by RLS.
7. Verify cash order + order items.
8. Verify Realtime posts/orders.
9. Configure Storage bucket and media policies.
10. Replace placeholder map provider settings with production credentials.
11. Build real captain dispatch/status workflow.
12. Replace wallet placeholders with a real ledger/reporting model.
13. Add notifications.
14. Add automated browser/E2E tests.

### Future modules

The intended platform can grow to:

- restaurant menus and cashier workflows
- supermarket inventory
- clothing/fashion listings
- beauty services
- car marketplace with multiple images
- captain management
- delivery zones and distance
- customer addresses/maps
- notifications
- reviews/ratings
- stories
- finance/commission reports
- additional languages
- admin audit controls

### Safe refactoring sequence

For every feature:

1. Define the database contract.
2. Add/alter SQL through a new migration.
3. Add RLS before exposing the UI.
4. Add TypeScript types.
5. Add a service function.
6. Add UI.
7. Add loading/error/empty states.
8. Test authenticated and unauthenticated paths.
9. Test each relevant role.
10. Run `npm run build`.
11. Deploy to Vercel preview.
12. Verify the preview against Supabase.
13. Only then promote to production.

### Never do these

- Do not restore demo seed products.
- Do not use `localStorage` as a database.
- Do not add Firebase.
- Do not expose `service_role`.
- Do not let a user select `super_admin` from the UI.
- Do not couple `posts.category` to `app_role`.
- Do not delete production tables just to make a migration pass.
- Do not replace the whole app with a new framework without a migration plan.
- Do not silently change payment behavior.
- Do not bypass RLS because a frontend operation is inconvenient.

---

## 9. Release Checklist

```text
[ ] Supabase URL/key configured
[ ] Auth email/password provider verified
[ ] Production domain added to Supabase redirects
[ ] production_repair.sql applied
[ ] profiles trigger verified
[ ] super_admin explicitly promoted in DB
[ ] active posts visible after hard refresh
[ ] role/category RLS tested
[ ] post creation tested
[ ] post deletion/blocking tested by super_admin
[ ] cash order tested
[ ] order_items tested
[ ] Realtime posts tested in two browsers
[ ] Realtime orders tested
[ ] Storage bucket + policies tested
[ ] map configuration tested
[ ] PWA tested
[ ] mobile/tablet/desktop tested
[ ] npm run build passes
[ ] Vercel preview tested
[ ] production deployment tested
```

---

## 10. Source-of-Truth Files

When there is a conflict:

1. Supabase schema/RLS is authoritative for data/security.
2. `src/main.tsx` is authoritative for the current UI behavior.
3. `src/styles.css` is authoritative for current visual styling.
4. `.env.example` is authoritative for frontend environment variable names.
5. This document describes the intended architecture and safety rules.
6. `README.md` and `DEPLOYMENT-CHECKLIST.md` are operational guides and should be updated whenever setup changes.

**Last audited:** 2026-09-17.
