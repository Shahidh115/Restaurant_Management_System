# EL CASA - Restaurant Management System

A production-resource-driven Point of Sale and stock system for a single restaurant.
Instead of tracking menu-item inventory, ROMS tracks **production resources** (e.g. Rice
Portion, Dough Ball, BBQ Chicken). Every menu item has a recipe that consumes resources.
Sales deduct resources automatically; if stock is insufficient the sale is blocked with a
max-quantity hint.

Built for a single admin user — no authentication in this version, but the backend is
structured for it.

## Tech stack

| Layer    | Technology |
| -------- | ---------- |
| Backend  | Laravel (Framework 13), REST API, SQLite (dev) / MySQL (portable) |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui-style components, TanStack Query, Zustand, Recharts, PWA |

## Features

- **POS Billing** — category tabs, search, barcode entry, cart with quick quantity steps,
  discount, tax (configurable rate), payment types (cash/card/other), hold/resume orders.
- **Production resources** — daily opening quantities, quick-add (+10/+20/+30/+50/custom)
  during the day, warning levels, manual adjustments, archive/restore.
- **Menu & recipes** — categories, menu items with images and favourites, versioned recipes
  with activate/delete and historical-safety checks.
- **Sales** — bill history with filters (date/status/invoice), detail view, cancel with full
  resource restore.
- **Waste** — record spoiled/discarded stock (burnt, spoiled, staff meal, damaged, manual).
- **Reports** — revenue summary, daily trends, food sales, resource usage, waste breakdown,
  and a live dashboard (hourly sales, low stock, production capacity, recent bills).
- **Settings** — restaurant identity, logo, currency, tax rate, invoice prefix, receipt text.
- **PWA** — installable, offline-ready shell.

## Project layout

```
backend/    Laravel REST API (resources, recipes, sales, production, reports)
frontend/   React SPA (PWA)
```

## Getting started

### Backend

```bash
cd backend
composer install
copy .env.example .env        # set DB_CONNECTION (sqlite default) and APP_URL
php artisan key:generate
php artisan migrate --seed    # base data: resources, categories, menu, recipes
php artisan db:seed --class=Database\Seeders\DemoSalesSeeder   # optional 6-day demo sales
php artisan storage:link
php artisan serve
```

The API serves under `http://127.0.0.1:8000/api/v1`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` and `/storage` to the
backend, so no CORS setup is needed locally.

### Production build

```bash
cd frontend
npm run build    # tsc -b && vite build → dist/ (PWA-ready)
```

Serve `dist/` from any static host and point it at the Laravel API (or keep the proxy).

## Domain model

- `categories` → `menu_items` (1:N)
- `menu_items` → `recipes` (1:N, versioned; one `is_current`)
- `recipes` → `recipe_items` → `production_resources` (N:N, quantity per unit)
- `production_resources` — live `current_balance`, `warning_level`
- `daily_production` / `production_adjustments` — per-day opening stock and top-ups
- `bills` → `bill_items` (line items snapshot item name/price)
- `resource_transactions` — every movement (opening, production, sale, sale restore, waste, manual)
- `wastes`, `settings`

## Key flows

- **Sale** — `POST /api/v1/pos/sale` validates the cart against resource availability
  (`max_quantity` returned on failure), persists the bill, and deducts resources with
  `balance_after` transaction records.
- **Cancel bill** — `POST /api/v1/bills/{id}/cancel` restores all consumed resources.
- **Hold** — `POST /api/v1/pos/hold` creates a bill with a hold code (no deduction);
  completing it (`POST /pos/holds/{code}/complete`) re-validates and deducts.

## Notes

- SQLite is the default dev database. The query code is DB-portable (uses `whereDate`,
  no MySQL-only functions), so switching to MySQL requires only a `.env` change.
- Demo data: 8 menu items, 5 resources, recipes, and 6 days of seeded sales for dashboards
  and reports.
