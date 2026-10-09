# Airbnb Clone

An Airbnb-inspired full-stack stay marketplace built with Next.js, TypeScript, Tailwind CSS, FastAPI and SQLite.

![Airbnb Clone home page](docs/screenshots/home-desktop.png)

> **Independent educational project.** This is a learning/assignment project. It is **not affiliated with,
> endorsed by or connected to Airbnb, Inc.** "Airbnb" is a trademark of its owner; the name and pink pin
> mark are used here only to mimic the product for an educational exercise. The code was written for this
> assignment; a public Airbnb clone was consulted only for visual/UX ideas and no code, components or file
> structure were copied from it.

## Contents

[Features](#features) · [Screenshots](#screenshots) · [Tech stack](#tech-stack) · [Architecture](#architecture) ·
[Database](#database) · [Booking lifecycle](#booking-lifecycle-and-availability) · [Pricing & coupons](#pricing-and-coupons) ·
[API](#api) · [Demo accounts](#demo-accounts) · [Mock payment](#mock-payment) · [Local setup](#local-setup) ·
[Testing](#testing) · [Environment variables](#environment-variables) · [Deployment](#deployment) ·
[Demo guide](#end-to-end-demo-guide) · [Assumptions & limitations](#assumptions-and-known-limitations) · [Credits](#credits-and-licensing)

## Features

**Guest**
- **Curated Airbnb-style home page.** Horizontal carousels built from the real listings (*Guest favourite homes in India*, *Popular homes in …*, *Stays with amazing views*, *Homes with amazing pools*, *Cabins and cosy retreats*, *Design-led stays*, *Highly rated*, *More stays*). Every row ends with a **See all** card (photo collage + count) that opens the matching real, paginated search. Each listing appears in at most one row, rows with fewer than three stays are skipped, and the selection is deterministic. Arrows disable at the ends; phones swipe.
- **Adaptive header.** A fixed bar of constant height with the `airbnb` wordmark, **quick-filter tabs** (*All · Homes · Top rated · Under $150*), *Become a host* and the account menu. On the home page a large *Where / When / Who* pill sits under it and collapses smoothly as you scroll (driven by `scrollY`: no layout jump and no blank band) into a compact capsule. On **every** route the capsule opens the same full search in a drop-down panel; phones use a search sheet.
- **Working quick filters.** *Homes* (whole-home property types), *Top rated* (4.8+) and *Under $150* all change the real results, are stored in the URL (`?quick=`), show their selected state, and combine with the destination, dates, category rail and advanced filters.
- **Real search results** driven by the URL: destination, dates, guests, category rail (with scroll fades), a Filters modal (price range with validation, property type, rooms/guests, rating, amenities) with a **live result count from the server**, active-filter count, sorting, **server-side pagination**, skeletons and empty states with reset actions.
- **Listing page:** asymmetric gallery and full-screen viewer (arrow keys / Esc), guest-favourite callout, map section with a link to the full map, reviews, sticky booking card (bottom sheet on phones) with unavailable nights struck through and a **server-calculated price quote**.
- Coupons, mocked checkout (decline + retry), confirmation, *Trips* (upcoming / past / cancelled, cancel with refund), wishlist, reviews for completed stays.
- **Messages:** a lightweight guest ↔ host inbox (see [Messaging](#messaging)).
- **Dark mode:** a switch in the account menu; every colour is a design token, the choice is saved and applied before first paint (no flash).

**Host**
- Dashboard with statistics, listings and reservations received; create / edit / pause / delete listings (ownership enforced; deletion is refused while upcoming reservations exist).

**Backend**
- Half-open date-range overlap logic, transactional booking creation (`BEGIN IMMEDIATE`), server-side pricing, coupon validation, host ownership checks, consistent JSON errors, signed demo identities. A 48-listing seed catalogue (India, Europe, Asia, US/UK/UAE).

## Screenshots

Captured from the running production build with the seeded demo data (see [Testing](#testing)).

| | |
| --- | --- |
| ![Search results](docs/screenshots/search-results.png) <br> Search results: destination, dates, guests, category rail | ![Filters](docs/screenshots/filters.png) <br> Filters with live server result count |
| ![Listing detail](docs/screenshots/listing-detail.png) <br> Listing detail with server-priced booking card | ![Checkout](docs/screenshots/booking-flow.png) <br> Checkout: server-validated coupon + mock payment |
| ![My trips](docs/screenshots/my-trips.png) <br> My Trips | ![Host dashboard](docs/screenshots/host-dashboard.png) <br> Host dashboard |
| ![Messages](docs/screenshots/messages.png) <br> Messages | ![Dark mode](docs/screenshots/home-dark.png) <br> Dark mode |

<img src="docs/screenshots/home-mobile.png" alt="Airbnb Clone on a phone" width="280">

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, lucide icons |
| Backend | Python 3.11+ (developed on 3.13), FastAPI, SQLAlchemy 2, Pydantic v2 |
| Database | SQLite (WAL mode, foreign keys on) |
| Tests / checks | pytest + FastAPI `TestClient`; `tsc`, ESLint and `next build` |

## Architecture

```
airbnb-clone/
├── frontend/                Next.js app
│   └── src/
│       ├── app/             routes: /, /listings/[id], /checkout/[id], /trips, /trips/[id],
│       │                    /wishlist, /messages, /host, /host/listings/new, /host/listings/[id]/edit
│       ├── components/      layout/ (header, quick-filter tabs, account menu), search/, filters/, listing/ (cards,
│       │                    carousels, See-all card, gallery, booking panel), booking/, host/, messages/, calendar/, ui/
│       ├── context/         AppProvider: current demo user, wishlist ids, unread-message count
│       ├── hooks/           useFetch (abort + stale-while-revalidate), useDebounced, ...
│       └── lib/             typed API client (lib/api), URL <-> filters mapping, quick-filters, discovery sections
│                            (home-page rows), theme, dates
├── backend/
│   ├── app/
│   │   ├── main.py          app factory, CORS, error handlers, optional auto-seed
│   │   ├── core/            settings (env), errors, signed demo-session tokens
│   │   ├── db/              engine, SQLite pragmas, BEGIN IMMEDIATE write sessions
│   │   ├── models/          SQLAlchemy models        ├── schemas/   Pydantic models
│   │   ├── services/        business rules: pricing, coupons, availability, bookings, listings, messaging
│   │   ├── routers/         thin HTTP layer          └── seed.py, seed_data.py, seed_extra.py
│   ├── tests/               66 tests
│   ├── seed.py              CLI seeding (python seed.py [--reset])
│   └── requirements.txt
├── docs/screenshots/        images used in this README
├── render.yaml              Render blueprint for the API
└── README.md
```

**Data flow.** The URL is the source of truth for a search (`/?location=Goa&check_in=…&guests=2&property_type=Villa&quick=top-rated&page=2`).
With no search criteria the home page shows the curated rows (one `GET /api/listings?page_size=48`; `lib/discovery.ts` derives the rows
client-side, and each row's **See all** link is the same rule expressed as a normal search query, so it always lands on real, paginated
backend results). Any criteria, or `?view=all`, switch to the results page that calls `GET /api/listings`. `?quick=` is translated into
ordinary backend filters (`min_rating`, `max_price`, `property_type`) by `lib/quick-filters.ts` and never replaces the user's own filters.
The listing page fetches the listing, its availability and a debounced **server quote** whenever dates, guests or coupon change; the
browser never does price arithmetic.

**Design system.** Colours, radii and shadows are CSS tokens in `globals.css` (`@theme`); the dark theme redefines the same tokens under
`html[data-theme="dark"]`, so components never hard-code light-only colours. The browser tab title is the fixed string `Airbnb Clone` on every route.

## Database

Tables: `users`, `listings`, `listing_images`, `amenities`, `listing_amenities`, `bookings`, `payments`, `coupons`,
`coupon_usages`, `reviews`, `favorites`, `conversations`, `messages` — foreign keys on, unique constraints, cascades.

```
users 1──* listings 1──* listing_images          listings *──* amenities (listing_amenities)
users 1──* bookings *──1 listings                bookings 1──1 payments      bookings 1──1 reviews
bookings *──0..1 coupons (coupon_usages)         users *──* listings (favorites)
conversations: (listing, guest) unique, host = listing host   conversations 1──* messages (sender -> users)
```

* `bookings.listing_id` is `RESTRICT`: a listing with booking history is **soft-deleted** (`status = DELETED`) so guests keep their trips; its favourites are removed.
* `payments.booking_id`, `reviews.booking_id` are unique (one payment / review per booking); `favorites` has a composite key.
* Indexes on listing city/location/type/price, booking `(listing_id, check_in, check_out)` and `(guest_id, status)`, review and message lookups.
* Tables are created automatically on startup (`create_all`); there are no migrations.

## Booking lifecycle and availability

* **Half-open ranges.** A booking occupies nights `[check_in, check_out)`. 10→15 and 13→17 overlap (rejected); 10→15 and 15→18 do not (accepted — same-day turnover). One predicate (`existing.check_in < new.check_out AND existing.check_out > new.check_in`) is shared by search, availability, quotes and booking creation.
* **Atomic check-then-insert.** Booking creation runs in a `BEGIN IMMEDIATE` transaction, so the availability check and the insert can't interleave with another writer. A threaded test fires 6 simultaneous requests for the same dates: exactly one `201`, five `409`.
* **State machine.** Booking `PENDING → CONFIRMED → COMPLETED`, or `→ CANCELLED`; payment `PENDING → SUCCESS | FAILED`, `SUCCESS → REFUNDED`. A `PENDING` booking holds its dates for 15 minutes (`hold_expires_at`); expired holds are released lazily on the next read/write. `CONFIRMED` stays whose check-out has passed become `COMPLETED` (unlocking reviews).
* **Cancellation** is free until the check-in day: it releases the dates, refunds the payment and returns the coupon use.

## Pricing and coupons

`subtotal = nightly × nights`, `total = subtotal + cleaning fee + service fee − discount`. Money is stored as whole US dollars
(integers, no float drift); percentage discounts round half-up and can never exceed the stay subtotal. `POST /api/bookings`
ignores any total/subtotal/nights/discount sent by the client (tested).

| Code | Rule |
| --- | --- |
| `WELCOME10` | 10 % off, max $150 |
| `SUMMER20` | 20 % off stays over $600, max $300 |
| `FLAT50` | $50 off stays over $300 |
| `FLAT500` | $500 off stays over $2,500 |
| `EXPIRED2020` · `PAUSED15` · `FIRSTSTAY` | demonstrate the *expired*, *inactive* and *usage limit reached* errors |

Coupons are validated server-side (unknown, inactive, expired, below minimum, usage limit, capped discount); each applied coupon creates a `CouponUsage` row.

## API

Interactive docs: `http://localhost:8000/docs`. Errors are `{"detail": "<message>", "code": "<machine_code>"}` (422 adds `errors: [{field, message}]`).

| Method & path | Purpose |
| --- | --- |
| `GET /api/listings` | Search: `location, check_in, check_out, guests, min_price, max_price, property_type (csv), category, amenities (csv, all), min_rating, bedrooms, bathrooms, sort, page, page_size (≤48)` — paginated; unavailable and over-capacity listings are excluded |
| `GET /api/listings/{id}` | Listing detail |
| `POST /api/listings` · `PUT /api/listings/{id}` · `DELETE /api/listings/{id}` | Host CRUD (ownership enforced; delete refused while upcoming reservations exist) |
| `GET /api/listings/{id}/availability` · `GET /api/listings/{id}/quote` | Blocked nights · authoritative price + bookability |
| `GET /api/meta` · `GET /api/destinations` | Filter vocabulary · destination autocomplete |
| `POST /api/bookings` | Create a `PENDING` booking (holds dates 15 min) |
| `GET /api/bookings` · `GET /api/bookings/{id}` | My trips · one booking |
| `PUT /api/bookings/{id}/coupon` | Apply/remove a coupon while pending |
| `POST /api/bookings/{id}/pay` | Mock payment |
| `POST /api/bookings/{id}/cancel` | Cancel + refund + release dates |
| `POST /api/coupons/validate` | Check a code against a listing + dates (or a subtotal) |
| `GET /api/favorites` · `GET /api/favorites/ids` · `POST`/`DELETE /api/favorites/{listing_id}` | Wishlist (idempotent) |
| `GET /api/listings/{id}/reviews` · `POST /api/listings/{id}/reviews` | Reviews (posting needs a completed stay) |
| `GET /api/host/listings` · `/host/bookings` · `/host/summary` | Host dashboard data |
| `GET /api/conversations` · `GET /api/conversations/unread-count` | My conversations · unread total |
| `POST /api/conversations` | Message a listing's host (re-uses the thread for that listing) |
| `GET /api/conversations/{id}` · `POST /api/conversations/{id}/messages` | Open a thread (marks incoming read) · send a message |
| `GET /api/users/current` · `GET /api/users/demo` · `POST /api/users/switch-demo-role` | Demo identity |
| `GET /api/health` | Liveness (used by Render) |

## Demo accounts

There is no sign-in. You start as the **demo guest** (Alex Morgan). Open the **menu button (top-right, or *Alex* on the phone
tab bar)** and pick another account under *Demo accounts*; the switch is instant.

| Account | Role | Notes |
| --- | --- | --- |
| `guest@example.com` — Alex Morgan | Guest | Upcoming trips, a cancelled trip, wishlist, a reviewed stay, one stay waiting for a review, one unread message |
| `host@example.com` — Maya Kapoor | Host | Owns 7 listings (Goa, Jaipur, Srinagar/Gulmarg, Varkala), bookings and reviews |
| `arjun.host@…`, `sofia.host@…`, `kenji.host@…`, `oliver.host@…`, `nia.host@…` (`@example.com`) | Host | Other hosts (Arjun owns the Kerala / Kashmir / Himachal listings) — use them to verify ownership checks |
| `priya@`, `liam@`, `emma@`, `noah@`, `ava@`, `lucas@`, `zoe@` (`example.com`) | Guest | Own the seeded bookings and reviews |

**How identity works.** `POST /api/users/switch-demo-role` returns an HMAC-signed bearer token naming a user. Every request
verifies the signature and **loads the role from the database**, so a client cannot forge an identity, role or owner. No token →
the default demo guest. Host endpoints require a host; edit/delete verify `listing.host_id == current user` (403 otherwise);
bookings can be paid/cancelled only by their guest; conversations only by their two participants.

## Mock payment

No gateway and no card data. At checkout choose **card ending 4242** → payment succeeds and the booking is `CONFIRMED`;
choose **card ending 0002** → `402 Payment declined`, the booking stays `PENDING` and the dates stay held so you can retry
with 4242 (internally `card_4242` / `card_declined`).

## Messaging

A lightweight guest ↔ host inbox, persisted in SQLite — no WebSockets or push (the list refreshes on navigation and after you send).

* **Inbox:** *Messages* in the account menu (with an unread count and a dot on the menu button) → conversation list + thread; one pane at a time on phones.
* **Start a chat:** *Message host* on any listing page (not shown on your own listings).
* **Seeded demo thread:** Alex ↔ Maya about the Goa beach house; Alex has one unread reply, so the unread indicator is visible immediately.
* **Security:** the sender is always the signed-in user (any `sender_id` in the request body is ignored); only the two participants can read or post (403 otherwise); bodies are trimmed and limited to 1–2000 characters.
* Opening a thread marks the other person's messages as read; the writes use `BEGIN IMMEDIATE` like bookings (a threaded test opens one thread from 6 clients at once).

## Local setup

Prerequisites: Python 3.11+, Node 20.9+ and npm.

**Backend** (http://localhost:8000)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # optional; defaults work locally (Windows: copy .env.example .env)
python seed.py                    # optional: creates + seeds airbnb_clone.db (no-op if already seeded)
uvicorn app.main:app --reload --port 8000
```

The server also creates the tables and seeds an *empty* database on startup (`AUTO_SEED=true`), so `uvicorn` alone is enough.
`python seed.py` never deletes data unless you pass `--reset` (drops and rebuilds every table). Seeded bookings use dates
relative to the day of seeding.

**Frontend** (http://localhost:3000)

```bash
cd frontend
npm install
cp .env.example .env.local        # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Production build: `npm run build && npm start`.

## Testing

```bash
cd backend && pytest && ruff check .                         # backend
cd frontend && npm run typecheck && npm run lint && npm run build   # frontend
```

Results of the final run for this submission:

| Check | Result |
| --- | --- |
| `pytest` | **66 passed** (bookings, overlap/boundaries, concurrency, coupons, ownership, listings, host, favourites, messaging, catalogue/seed integrity, quick-filter contract) |
| `ruff check .` | all checks passed |
| `npm run typecheck` | passed |
| `npm run lint` | passed |
| `npm run build` | passed (Next.js 16, Turbopack) |

The guest, host, chat, search and theme journeys were also exercised in a real headless Chromium (Playwright) against the production build
(`npm run build && npm start`); see [Browser verification](#browser-verification).

### Browser verification

Scripted Playwright sessions (Python, headless Chromium) were run against the production build; they are **not** part of the repository's test
suite. Checked and passing: the page title is exactly `Airbnb Clone`; the header height stays constant while scrolling, the category rail sits flush
under the collapsed header, the tabs/capsule cross-fade, and Escape or scrolling closes the drop-down search; the same drop-down search opens on
`/listings/…`, `/trips`, `/wishlist`, `/messages`, `/host` and `/checkout/…`, and a search made on a listing page carries destination, dates and guests
through to the results and the next listing page; each quick-filter tab returns exactly the server's result count and survives a new search;
category rail and filters modal (live count equals the server's, apply, clear, min > max price blocked); carousel arrows (disabled at the ends) and
**all nine See all cards** (the result count equals the row's query); gallery viewer (arrow keys, Esc); map section; phone search sheet and
booking sheet; no horizontal overflow on 12 routes at 390 / 820 / 1280 / 1700 px; the guest booking flow (declined then successful card, coupon,
confirmation, Trips, cancel, dates released, wishlist, reviews); the host flow (create, edit, persistence, ownership refusal, delete refused with
upcoming reservations, delete); chat (read, send, start from a listing, host side, phone layout); the dark-mode switch (persists across reload and
routes, follows the OS preference when nothing is saved).

## Environment variables

| Variable | Where | Default | Meaning |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | frontend (**build time**) | `http://localhost:8000` | Backend base URL, no trailing slash |
| `DATABASE_URL` | backend | `sqlite:///./airbnb_clone.db` | SQLite file (`sqlite:////abs/path.db` for an absolute path) |
| `CORS_ORIGINS` | backend | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated allowed browser origins — add your deployed frontend URL |
| `CORS_ORIGIN_REGEX` | backend | *(empty)* | Optional, e.g. `https://.*\.vercel\.app` for preview deployments |
| `SECRET_KEY` | backend | dev value | Signs demo-session tokens — **set a random value in production** |
| `AUTO_SEED` | backend | `true` | Seed demo data when the database is empty |
| `PORT` | backend (Render sets it) | – | Used in the start command |

Templates: `backend/.env.example`, `frontend/.env.example`. Real `.env*` files are git-ignored.

## Deployment

The recommended split is **frontend on Vercel, backend on Render**, from this single monorepo.

1. **Backend → Render** (Web Service). Either *New → Blueprint* (uses [`render.yaml`](render.yaml)) or create it by hand:
   *Root directory* `backend`, *Build* `pip install -r requirements.txt`, *Start* `uvicorn app.main:app --host 0.0.0.0 --port $PORT`,
   *Health check path* `/api/health`, plan **Free**. Environment variables:
   `PYTHON_VERSION=3.12.7` (every pinned dependency resolves to a CPython 3.12 Linux wheel, checked with `pip download --python-version 3.12`; the tests themselves were run on Python 3.13), `SECRET_KEY=<random>` (Blueprint generates it), `CORS_ORIGINS=https://<your-app>.vercel.app`,
   optionally `CORS_ORIGIN_REGEX=https://.*\.vercel\.app`, `DATABASE_URL=sqlite:///./airbnb_clone.db`, `AUTO_SEED=true`.
   Note the service URL, e.g. `https://airbnb-clone-api.onrender.com`; check `…/api/health`.
2. **Frontend → Vercel.** *Import* the repo, set **Root Directory = `frontend`** (framework: Next.js; defaults for build/output).
   Environment variable: `NEXT_PUBLIC_API_URL=https://airbnb-clone-api.onrender.com` (no trailing slash). It is read at **build
   time**, so redeploy after changing it.
3. Put the final Vercel URL into the backend's `CORS_ORIGINS` (Render → Environment) and redeploy/restart the API.

### SQLite persistence on Render

SQLite is a local file. **Render's free web services have an ephemeral filesystem and no persistent disks**, so the database
file is lost whenever the service restarts, spins down after inactivity or is redeployed. With `AUTO_SEED=true` it is simply
re-created and re-seeded with the demo data, which is ideal for a reviewer demo — but **bookings, listings and messages created
through the app will not survive**, and the first request after sleep is slow (cold start + seed).

For data that survives restarts you need a paid web service plus a persistent disk: set the plan to `starter`, attach a disk
(e.g. mount path `/var/data`) and set `DATABASE_URL=sqlite:////var/data/airbnb_clone.db` (a commented example is in
`render.yaml`). A disk pins the service to a single instance, which suits SQLite. Switching to a managed Postgres would also
solve persistence but was deliberately not done here, as the assignment specifies SQLite.

> Status: the application has **not** been deployed as part of this work — only the configuration and instructions are prepared.

## End-to-end demo guide

**Guest (≈ 3 min)**
1. Home: scroll the carousels and click a row's **See all** card; try the **Top rated / Under $150 / Homes** tabs; scroll to watch the search collapse into a capsule and click it to reopen the search. Then *Where* `Goa` → *When* pick a range → *Who* add guests → search. Open **Filters** (price, type, rooms, rating, amenities — the button shows the live result count), change **Sort**, use pagination (*Show all 48 stays*). Flip **Dark mode** in the account menu.
2. Open a listing → **Show all photos** → pick dates (booked nights are struck through; spanning them is rejected) → note the server price breakdown.
3. *Have a coupon?* → `WELCOME10` → **Reserve** → checkout. Pay with **card ending 0002** (declined; dates stay held) then **4242** → confirmation.
4. **Trips** shows the booking; **Cancel** releases the dates and refunds. Switch to another guest and try the same dates while it is booked → `409`.
5. Heart a few stays (**Wishlist**), open **Messages**, reply to Maya, or use *Message host* on a listing.

**Host (≈ 2 min)**
1. Menu → **Maya Kapoor** → **Host dashboard** (statistics, listings, reservations received).
2. **Create listing** (*Use sample photos*) → edit it → the change persists.
3. Switch to **Arjun** and open that edit URL → *You don't own this listing* (API `403`).
4. Back as Maya, delete a listing that has upcoming reservations → refused with a clear message; delete the new one → it disappears from the dashboard.

## Assumptions and known limitations

* **Mocked auth and payment** — demo users with signed tokens, no passwords; no gateway or card data.
* **Top navigation** — the tabs are quick filters over the same stay catalogue; there are no Experiences or Services products.
* **Curated sections** are derived client-side from the first 48 listings (the seeded catalogue has exactly 48; with more, rows would draw only from the first 48 while *See all* still searches everything). Row titles name a country because most cities have only 1–3 listings.
* **Photos** are hot-linked Unsplash images for seed data (the image host is outside this project's control, so a photo may disappear; the UI then shows a fallback); hosts add photos by URL (no upload storage). The map is an OpenStreetMap embed.
* **Currency/fees** — USD; cleaning and service fees are flat per stay and set by the host. **Cancellation** — free, full refund until the check-in day.
* **Dates** are compared against the server's UTC date, with one day of grace for guests behind UTC.
* SQLite serialises writers (fine for a demo); a multi-instance deployment should move to Postgres (the `BEGIN IMMEDIATE` guard would become `SELECT … FOR UPDATE` or an exclusion constraint). There are no schema migrations.
* Expired payment holds and `COMPLETED` transitions are applied lazily on reads, not by a background job.
* Chat has no real-time delivery, typing indicators, attachments or notifications; hosts can't start a thread with a guest.
* No image upload, host-side calendar blocking or search-results map. In dark mode the embedded OpenStreetMap is inverted with a CSS filter. Reviews need a `COMPLETED` stay; no host replies or moderation.
* The browser checks above were run by script, not as automated tests in the repository.

## Credits and licensing

* **Photos:** [Unsplash](https://unsplash.com) images hot-linked under the [Unsplash License](https://unsplash.com/license). **Avatars:** [pravatar.cc](https://pravatar.cc). **Map tiles/embed:** © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
* **Font:** Figtree (SIL Open Font License) via `next/font/google`. **Icons:** [lucide](https://lucide.dev) (ISC). The brand mark is an inline SVG drawn for this project in the style of Airbnb's; it is not an official asset.
* **Libraries:** Next.js, React, Tailwind CSS, FastAPI, SQLAlchemy, Pydantic, Uvicorn (all under their respective open-source licenses; see `package.json` and `requirements.txt`).
* No license file is included for the project's own code; add one if you intend to publish it for reuse.
