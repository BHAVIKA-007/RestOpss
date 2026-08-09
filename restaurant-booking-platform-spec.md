# Restaurant Table Booking Platform — Full Spec

## Core idea
A BookMyShow-style seat-selection experience for restaurants. Customers see a real floor plan and pick a table for a time slot; restaurant staff (manager, host, waiter, chef) run operations through role-based dashboards. Differentiator: real-time table status + a grid-based custom floor plan builder + smart table-combination logic for large parties.

**Scope lock:** whole-table booking only. No per-seat/communal booking (that's a future phase, not MVP).

---

## Roles & Features

### Manager (restaurant admin)
- Sign up restaurant, manage profile (name, cuisine, hours, contact)
- **Floor plan builder**: grid-snap canvas — place tables (shape, capacity, position), walls, windows, doors, dividers
- Mark tables `combinable: true/false` and which tables are adjacent to each other
- Menu CRUD: categories, items, price, veg/non-veg, availability toggle
- Staff management: add/remove chef, waiter, host accounts; assign waiters to specific tables/sections
- View live floor status (read access to everything host sees)
- Analytics: table turnover, average wait time, revenue/day, most-combined table sets (helps redesign layout later)
- Approve/reject large-party combination requests (see booking rules below)

### Host / Receptionist
- Live floor plan view (grid-based, color-coded: free / locked-pending / reserved / occupied / dirty)
- Seat walk-ins directly (manual table assignment, bypasses customer app flow)
- Manage waitlist queue: see who's waiting, notify, seat, or skip
- Mark table `dirty` → `cleaning` → `free` after checkout
- Mark `no-show` after grace period, which releases the table and re-triggers waitlist
- Approve/deny large-party table-combination requests before they lock

### Waiter
- Assigned tables/sections only
- Take/edit orders per table
- Update order status (sent to kitchen / served)
- Request bill / mark table ready-to-clear

### Chef
- Kitchen display queue: incoming → preparing → ready
- No access to tables, reservations, or floor plan — just the order queue, keeps their view simple

### Customer
- Browse/search restaurants, filter by cuisine/location/rating
- Pick date, time, party size
- View real floor plan (grid-based, drawn by manager) with live-colored table markers
- **Single table fits party size** → instant lock → confirm → reservation (auto-confirmed)
- **Party size requires combining tables** → system suggests best combination → goes to **host-approval queue** instead of instant confirm
- If nothing available → offered waitlist join
- Track reservation status, get notified when host approves/table is ready
- Optional: pre-order from menu while booking

---

## Floor Plan Builder (Manager tool)
- Fixed grid canvas (e.g. 20×14 cells) — no freehand drawing, everything snaps to grid
- Drag-and-drop elements: table (choose shape + capacity), wall segment, window marker, door, plant/divider
- Windows/doors placed on the grid double as implicit "ambience" markers — a table next to a window marker visually reads as a window seat, no manual tagging needed
- Save layout as JSON: `[{type, gridX, gridY, shape, capacity, combinable, adjacentTo: []}]`
- This JSON is the single source of truth rendered (read-only + live status) for host and customer views
- Can't delete/resize a table that has active future reservations — must reassign first

---

## Booking Concurrency (no double-booking)
1. Customer selects table → `POST /lock-table {tableId, timeSlot}`
2. Server checks table is free for that exact slot → creates a `TableLock` row with a short TTL (~2 min) → broadcasts `table:locked` via Socket.io so other viewers see it turn yellow instantly
3. Customer confirms within the window → lock converts to a permanent `Reservation`, broadcast `table:reserved` (red)
4. If customer abandons → lock auto-expires (TTL/cron) → table flips back to free, broadcast update
5. **Backstop:** DB-level unique constraint on `(tableId, timeSlot)` on the reservations table — catches any race the app-level lock misses
6. Before converting lock → reservation, **re-check table status** (not just trust the earlier lock) — handles the edge case where host manually marked it dirty mid-lock

---

## Table Combination Logic (large parties)
**Rules:**
- Only tables marked `combinable` and connected via `adjacentTo` can merge
- Combination search is a bounded connected-subset search over the adjacency graph (restaurants have small table counts, no need for full subset-sum optimization)
- Rank valid combinations by: (1) smallest capacity overshoot, (2) fewest tables used
- **Anti-waste rule:** penalize combinations that consume multiple small tables when a tighter option exists (don't burn three 2-tops on a party of 6 if a 4+2 or single 6-top is free)
- Any booking that requires combining tables **routes to host-approval**, not instant customer confirm — only a human knows if using 3 tables tonight is fine (slow night) or costly (fully booked). Single-table bookings that already fit stay instant-confirm.

---

## Waitlist
- Entry: `{customerId, partySize, requestedTime, status: waiting/notified/seated/expired/left, joinedAt}`
- When a matching table/combination frees up (checkout, cancellation, no-show), system checks it against waiting entries — **not strict FIFO**, matches by compatible party size/table shape so a party of 8 waiting for a rare large table doesn't block a party of 2 from being seated at a table that just freed up
- Notified customer gets a short response window (~10 min); no response → moves to next compatible entry, original marked `expired`
- Host dashboard shows live queue with wait time and manual override to seat anyone directly

---

## Edge Cases Reference

| Edge case | Rule |
|---|---|
| Two users select the same table simultaneously | Lock + TTL + DB unique constraint (see Concurrency) |
| No-show | Host marks after grace period → table releases → waitlist re-triggered |
| Party size changes after booking | Treated as new combination request; offer re-seat or waitlist upgrade, never auto-cancel |
| Manager edits layout with active reservations | Blocked until reservations reassigned |
| Table combination wastes small tables | Anti-waste ranking + mandatory host approval for combined bookings |
| Reservation time overlap | Reservations carry duration, not just start time — check overlap, not exact slot match |
| Table marked dirty mid-lock | Re-validate status at confirm time, not just at lock time |
| Combined group partially leaves early | Group releases as one unit at full checkout — no auto-split (MVP simplicity) |

---

## Build Order (MVP)
1. Auth + role-based access (JWT, httpOnly cookies)
2. Manager: staff CRUD, menu CRUD
3. Floor plan builder: grid canvas, place/save tables as JSON
4. Customer: browse → pick time/party size → view floor plan → single-table instant booking
5. Real-time table status via Socket.io (lock → reserved → occupied → free)
6. Table combination logic + host-approval queue for large parties
7. Waitlist
8. Waiter/chef order flow (can run in parallel with 3–7, mostly independent)

## Phase 2 (post-MVP)
- Per-seat/communal table booking
- Payment integration
- Notifications (SMS/email/push)
- Analytics dashboards
- Multi-branch support for one manager account
