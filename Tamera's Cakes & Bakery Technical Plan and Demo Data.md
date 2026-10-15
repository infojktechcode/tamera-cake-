# Tamera's Cakes & Bakery: Technical Plan and Demo Data

JK Tech Code. Internal development document. Draft 1, October 2026.

## 1. Goals and scope

Build a mobile-first ordering website and admin dashboard for Tamera's Cakes & Bakery (Kitengela). Customers order cakes and pastries without an account. Orders are saved in the database, then handed to WhatsApp through a click-to-chat link. The owner and manager run orders, payments, the cake calendar and sales from the dashboard.

Version 1 excludes the WhatsApp Business API, automatic M-Pesa payments, customer accounts and ingredient costing (see the proposal).

## 2. Stack and architecture

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend and dashboard | Next.js (App Router), React, Tailwind CSS | Existing stack, one codebase for site and dashboard |
| Database and auth | Supabase Postgres and Supabase Auth | Roles, row-level security, simple login for staff |
| Photo storage | Supabase Storage | Reference photos and product images |
| Live updates | Supabase Realtime | New-order sound and badge without refreshing |
| Hosting | Vercel | Simple deploys, preview links for demos |
| Phone handling | Store numbers in international format (254...) | Click-to-chat links need this format |

Flow: the customer's browser submits to a server action or API route. The server validates the input, saves the customer, order and items, stores the photo, and returns the order number. The browser then opens the WhatsApp link. The dashboard listens to new orders through Realtime.

## 3. Roles and permissions

| Capability | Owner | Manager | Customer |
| --- | --- | --- | --- |
| Place orders | Yes (walk-in) | Yes (walk-in) | Yes |
| View and update orders | All | All, no deletes | Own confirmation page only |
| Record payments | Yes | Yes | No |
| Edit products, flavours, prices | Yes | Descriptions, photos, availability only | No |
| See cost price and profit | Yes | No | No |
| Sales figures and earnings projection | Yes | Yes | No |
| Expenses log | Yes | No | No |
| Customer list | Yes | Yes | No |
| Users and settings | Yes | No | No |
| Activity log, exports | Yes | No | No |

Enforce this with Supabase row-level security policies and server-side checks, not only by hiding buttons. Staff log in with email and password. Only the owner can create managers. Customers never log in, and public pages can only read the menu and insert orders.

## 4. Data model

| Table | Main fields |
| --- | --- |
| profiles | id, name, role (owner, manager), active |
| categories | id, name, type (cake, pastry), sort order |
| products | id, category\_id, name, description, image\_url, price, cost\_price (owner only), available, quantity (optional), featured |
| cake\_flavours | id, name, price\_per\_kg, available |
| design\_tiers | id, name, description, fee, needs\_quote |
| customers | id, name, phone (unique), source (online or walk-in), notes, created\_at |
| orders | id, order\_no, customer\_id, kind (cake or pastry), status, fulfilment (pickup or delivery), delivery\_area\_id, delivery\_fee, needed\_date, needed\_time, subtotal, total, deposit\_due, amount\_paid, notes, created\_by, created\_at, confirmed\_at |
| order\_items | id, order\_id, product\_id, flavour\_id, size\_kg, design\_tier\_id, design\_notes, reference\_image\_url, cake\_message, quantity, unit\_price, line\_total |
| payments | id, order\_id, method (mpesa, cash, bank), amount, reference, recorded\_by, created\_at |
| expenses | id, date, category, amount, note, recorded\_by |
| delivery\_areas | id, name, fee, active |
| capacity\_days | date, max\_cakes, closed |
| settings | key, value (shop WhatsApp number, hours, lead days, default daily cake limit, deposit percent) |
| activity\_log | id, user\_id, action, table, record\_id, old\_value, new\_value, created\_at |

Notes:

- Store prices on the order item at the time of ordering, so later price changes never alter past orders.
- Balance is calculated as total minus the sum of payments, not stored by hand.
- Order numbers are short and readable, for example TCB-0001.

## 5. Pricing and order rules

- **Cake estimate** = flavour price per kg x size in kg + design tier fee. Themed and premium designs are marked as estimates, and Tamera confirms the final price.
- **Pastry total** = sum of price x quantity, plus delivery fee if delivering.
- **Deposit** for cakes = deposit percent of the confirmed total (suggested 50%).
- **Lead time:** the date picker blocks dates earlier than the lead days setting.
- **Daily limit:** the date picker blocks dates where confirmed plus pending cakes reach the limit, or where the owner has closed the day.
- **Stock:** pastries with a quantity are reduced only when the shop confirms the order. Cancelling a confirmed order returns the quantity. Cakes do not use stock.

### Statuses

- Cake orders: New, Confirmed, Deposit paid, In production, Ready, Delivered or Collected, Cancelled.
- Pastry orders: New, Confirmed, Paid, Ready, Delivered or Collected, Cancelled.
- Only the owner can cancel after payment has been recorded, and the activity log records it.

## 6. WhatsApp integration

- **Customer to shop:** after saving the order, open a link in the form https://wa.me/254XXXXXXXXX?text=\<URL-encoded summary>. The summary includes order number, items, size, flavour, design notes, date, fulfilment, estimated total and a link to the reference photo.
- **Shop to customer:** a WhatsApp button next to each phone number opens a chat with a prefilled thank-you or confirmation message, using templates the owner can edit in settings.
- **Product updates:** the same button can prefill a message about a product that is back in stock or new.
- **Limits:** the sender must press send. Photos cannot be attached through a link, so a link to the stored photo is sent instead. Message length is limited, so keep the summary compact.
- **Broadcasts:** by hand with WhatsApp Business broadcast lists and Channels. The system provides an export of customer names and numbers and a button to copy the shop link.
- **Safety net:** the order is already saved before WhatsApp opens, and the dashboard shows orders that were never sent on WhatsApp, flagged for follow-up.

## 7. Notifications

- Supabase Realtime subscription on new orders in the dashboard.
- Sound plus a badge counter on the Orders menu, and a highlight on unseen orders.
- Browsers block autoplay audio until the user interacts with the page, so the dashboard shows a one-time Enable sound button at login.
- The WhatsApp notification comes from the customer's own send action (section 6).
- Reminders on the dashboard home for cakes due today and tomorrow, and unpaid balances.

## 8. Pages and routes

**Public**

- / : home with Order a cake and Order pastries, showcase cakes and shop info (location, hours)
- /cakes : cake order form
- /pastries : pastry menu and cart
- /checkout : pickup or delivery, name and phone
- /order/\[order\_no\] : confirmation page with the WhatsApp link

**Dashboard (login required)**

- /admin : today's summary, new orders, cakes due, balances
- /admin/orders and /admin/orders/\[id\]
- /admin/calendar : cakes by date
- /admin/products, /admin/flavours (owner)
- /admin/customers
- /admin/payments
- /admin/expenses (owner)
- /admin/reports (owner)
- /admin/users and /admin/settings (owner)
- /admin/new-order : walk-in order entry

## 9. Build plan

| Phase | Days | Tasks | Done when |
| --- | --- | --- | --- |
| 0. Setup | 1-2 | Repository, Supabase project, Vercel project, environment variables, Tailwind theme with Tamera's brand colours | A deployed blank site with login |
| 1. Data and auth | 3-5 | Tables, row-level security, staff login, seed demo data (section 12) | Owner and manager can log in and see the right data |
| 2. Customer ordering | 6-12 | Home, cake form, pastry cart, checkout, photo upload, date rules, confirmation page, WhatsApp link | A customer can place both order types on a phone |
| 3. Dashboard orders | 13-18 | Orders list and detail, status changes, stock reduction on confirm, WhatsApp buttons and templates, realtime sound and badge | An order placed on a phone appears with sound within seconds |
| 4. Money and planning | 19-25 | Payments and deposits, balances, cake calendar and capacity, walk-in orders, expenses, sales dashboard, earnings projection | The owner can run a full day from the dashboard |
| 5. Admin extras | 26-29 | Users, settings, activity log, CSV and PDF exports, daily backups | Owner can manage staff and export data |
| 6. Testing and launch | 30-35 | Testing on real phones, fixes, staff training, QR code and short link, go live | Signed-off launch |

Total about 5 weeks. The demo for Tamera should be ready at the end of phase 3 (about week 3).

## 10. Testing checklist

- Place a cake order and a pastry order on a low-end Android phone on mobile data.
- Upload a large photo (10 MB). Compress it in the browser before upload.
- Try a past date, a closed day and a full day in the date picker.
- Enter a phone number as 0712..., +254712... and 712.... All must be saved as 254712....
- Confirm that a manager cannot see cost price, expenses or settings, including by typing the URL.
- Confirm stock reduces only on confirmation, and returns on cancellation.
- Record a deposit and a balance payment and check the figures.
- Place an order with the dashboard open on a second device and check sound and badge.
- Open the customer WhatsApp link on Android, iPhone and desktop WhatsApp Web.

## 11. Security, backups and risks

- Row-level security on every table. Service keys only on the server, never in the browser.
- Validate and rate-limit the public order endpoint to stop spam orders. Add a simple bot check.
- Photo uploads limited to images with a size cap, stored in a public bucket under random names.
- Customer phone numbers are personal data. Collect only name and phone, state why on the checkout page, and let the shop delete a customer on request (Kenya Data Protection Act).
- Daily database backup. Check what the chosen Supabase plan includes, and add a scheduled export if it does not cover daily backups.

| Risk | Mitigation |
| --- | --- |
| Customers do not press send in WhatsApp | Order is saved first, and unsent orders are flagged in the dashboard |
| Final cake price differs from estimate | Label as an estimate, and the shop confirms on WhatsApp before the deposit |
| Free plan limits reached | Monitor usage, and move to a paid plan when needed |
| Scope creep (STK push, Business API) | Quote as phase 2 |
| Poor photos make the menu look weak | Ask Tamera for photos in week 1 |
| Staff do not enable the sound | One-time enable button, and training |

## 12. Demo plan and sample data

Prices below are sample prices in KES for the demo only. Tamera's real prices replace them before launch. Photos can be placeholders from a free stock library, and Tamera's real photos replace them later.

### Cake flavours (price per kg)

| Flavour | Price per kg (KES) |
| --- | --- |
| Vanilla | 2,500 |
| Marble | 2,600 |
| Lemon | 2,700 |
| Chocolate | 2,800 |
| Strawberry | 2,800 |
| Black Forest | 3,000 |
| Rich Fruit | 3,000 |
| Red Velvet | 3,200 |
| Oreo | 3,200 |
| Caramel | 3,300 |

Sizes offered in the form: 1 kg, 1.5 kg, 2 kg, 3 kg, 4 kg and 5 kg. A 0.5 kg option can be added if she makes it.

### Design levels

| Level | What it means | Fee (KES) |
| --- | --- | --- |
| Simple | Buttercream finish, simple piped message | 0 |
| Standard | Piping, sprinkles, topper or fresh decorations | 500 |
| Themed | Theme or character, fondant details, drip | 1,500 |
| Custom or premium | Multi-tier, sculpted or heavy fondant work | From 3,000, quoted |

Example: a 2 kg Red Velvet cake with a Themed design = 3,200 x 2 + 1,500 = KES 7,900.

### Showcase cakes (starting prices for 1 kg)

| Showcase cake | Flavour and design | From (KES) |
| --- | --- | --- |
| Classic Black Forest | Black Forest, Simple | 3,000 |
| Chocolate Drip Cake | Chocolate, Standard | 3,300 |
| Strawberry Cream Delight | Strawberry, Standard | 3,300 |
| Red Velvet Elegance | Red Velvet, Standard | 3,700 |
| Oreo Crunch Cake | Oreo, Standard | 3,700 |
| Caramel Drip Cake | Caramel, Standard | 3,800 |
| Rainbow Birthday Cake | Vanilla, Themed | 4,000 |
| Two-tier Celebration Cake (5 kg) | Vanilla, Custom | From 15,500 |

### Pastries and other items

| Item | Unit | Price (KES) |
| --- | --- | --- |
| Glazed donut | each | 80 |
| Filled or chocolate donut | each | 100 |
| Donut box | 6 | 450 |
| Cinnamon roll | each | 150 |
| Sweet bun | each | 40 |
| Cake pop | each | 120 |
| Cakesickle | each | 150 |
| Chocolate chip cookie | each | 60 |
| Cookie pack | 6 | 330 |
| Mandazi | pack of 6 | 100 |
| Cake loaf (Vanilla or Marble) | each | 400 |
| Banana loaf | each | 450 |
| Fruit loaf | each | 500 |

### Delivery areas (sample fees)

| Area | Fee (KES) |
| --- | --- |
| Pickup at shop | 0 |
| Kitengela | 200 |
| Athi River | 350 |
| Syokimau | 400 |
| Nairobi | 600 |

### Sample orders for the demo

| Order | Customer | Details | Total (KES) |
| --- | --- | --- | --- |
| TCB-0001 | Wanjiru (online) | Cake, 2 kg Red Velvet, Themed design, message Happy Birthday Zawadi, needed in 4 days, pickup | 7,900. Deposit 3,950 |
| TCB-0002 | Brian (online) | 2 donut boxes, 6 cinnamon rolls, delivery to Kitengela | 2,000 |
| TCB-0003 | Faith (walk-in, added by the manager) | 1 banana loaf, 2 mandazi packs, paid cash | 650 |
| TCB-0004 | Otieno (online) | Cake, 1 kg Black Forest, Simple design, needed tomorrow | Blocked by lead time. Shows how the date rules work |

### Demo script (about 10 minutes)

1. Open the shop link on a phone and show the home page and showcase cakes.
2. Place TCB-0001 with a reference photo and show the WhatsApp message that opens.
3. On a laptop with the dashboard open, show the sound, badge and new order. Open it and tap the WhatsApp button.
4. Confirm the order, record the deposit by M-Pesa, and move it to In production.
5. Show the cake calendar and try to book a full or too-early date.
6. Add TCB-0003 as a walk-in from the manager login, and show that the manager cannot see profit or settings.
7. Show the sales dashboard and the earnings projection.
8. Show the shop QR code and the customer list export.
