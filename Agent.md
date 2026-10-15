opencode Build Prompt: Tamera's Cakes & Bakery Order System
Paste everything below the line into opencode as the first message. For best results, also save it in the project root as AGENTS.md so the agent keeps the rules in view across sessions.
ROLE
You are a senior full stack engineer and product designer. Build a production-quality, mobile-first WhatsApp order system for Tamera's Cakes & Bakery, a cake and pastry shop in Kitengela, Kenya. Work phase by phase. Finish and verify each phase before starting the next. After each phase, run the type check, lint and build, fix every error, and give me a short summary of what exists and how to run it.
If something is ambiguous, make the simplest sensible choice, write it in docs/DECISIONS.md, and keep going. Do not stop to ask unless a decision would be expensive to undo.
1. PRODUCT SUMMARY
Customers open a link on their phone, build an order, and send it. The order opens in WhatsApp already written out, and it also appears in an admin dashboard where the shop confirms, tracks and delivers it. WhatsApp stays at the centre of the business. The system removes the repetitive questions and the mistakes.
Shop details
• Name: Tamera's Cakes & Bakery 🎂
• Location: Kitengela, Ola/Acacia Stage, Acacia West Arcade, Shop 13, opposite Selelo Mall and behind Leadway Petrol Station
• Cake orders need: size in kg, flavour, design or theme (with a reference photo), date needed
• Other items need item and quantity: donuts, cinnamon rolls, buns, cake pops, cakesickles, cookies, mandazi, cake loaf
• Currency: KES. Phone numbers: Kenyan format (07XX, 01XX, +254). Time zone: Africa/Nairobi.
Roles
• superadmin (owner): everything, including cost price, profit and loss, expenses, users, settings, activity log.
• manager: catalogue edits (descriptions, photos, availability, stock), orders, payments, walk-in customers, customer list, sales summary and earnings projection. A manager must never see cost price, profit, expenses or user management, and cannot edit past sales or delete products.
• client: no account. Name and phone number only at checkout.
Confirmed business rules
• Stock reduces only when the shop confirms an order, never at placement.
• All payment methods are accepted: M-Pesa, cash, bank. Deposits are supported.
• New order alert is both a dashboard sound and badge, and a WhatsApp message.
• Broadcasts are done by hand in WhatsApp Business. Do not build the WhatsApp Business API.
• Cakes are made to order: they are controlled by daily capacity and blocked dates, not stock counts.
• Cake price is base price per kg by flavour times weight, plus a design fee. The Custom 3D tier is quoted by the shop.
2. TECH STACK (use exactly this)
• Next.js (latest stable, App Router), TypeScript in strict mode
• Tailwind CSS and shadcn/ui, Lucide icons
• Motion for React (the motion package, formerly Framer Motion) for animation
• Supabase: Postgres, Auth (staff only), Storage, Realtime
• Zod for validation, React Hook Form for forms
• date-fns and date-fns-tz for dates
• sonner for toasts, canvas-confetti for the order success moment
• qrcode for QR generation, recharts for charts, jspdf with jspdf-autotable for PDF export
• ESLint, Prettier, Vitest for unit tests of pricing and rules, Playwright for one end-to-end order test
• Deploy target: Vercel
Use pnpm. No other UI libraries. Keep dependencies minimal.
3. ARCHITECTURE
Customer phone ──► Next.js public site ──► Server routes (validate, price, rate limit)
                                                     │
                                                     ▼
                                    Supabase Postgres + Storage (RLS on)
                                                     │ Realtime
                                                     ▼
                         Admin dashboard (sound + badge on new order)

Confirmation page ──► wa.me link with order summary ──► Shop WhatsApp
Dashboard ──► wa.me link with template ──► Customer WhatsApp
Rules:
1. Customers never access the database directly. All customer writes go through server route handlers or server actions that validate with Zod, recompute prices on the server from the database, and insert with the service role key. Never trust prices sent by the browser.
2. Staff use Supabase Auth. Every table has Row Level Security. Role checks happen both in RLS and in server code.
3. The service role key exists only in server code and environment variables. Never expose it to the browser.
4. Cost price is not in any table the manager can read. Use a separate product_costs table readable only by superadmin.
5. Order totals and item prices are copied onto the order at creation so later price changes do not change past sales.
6. All money is stored as integer KES.
7. Every change to price, stock, status or payment writes a row to activity_log.
3.1 Folder structure
src/
  app/
    (public)/            home, cakes, pastries, cart, order/[number], p/[slug]
    admin/               layout with auth guard + role guard
      orders/ calendar/ products/ customers/ walk-in/ sales/ finance/
      share/ reports/ users/ settings/ activity/
    api/                 route handlers (orders, uploads, exports)
    login/
  components/
    ui/                  shadcn components
    public/              CakeBuilder, PastryCard, CartDrawer, Hero, etc.
    admin/               OrderTable, StatusPill, CalendarView, KpiCard, etc.
    motion/              reusable animation wrappers
  lib/
    supabase/            browser, server, service clients
    pricing.ts           pure cake and cart price functions (unit tested)
    rules.ts             lead time, capacity, blocked date checks (unit tested)
    whatsapp.ts          wa.me link builders and message templates
    phone.ts             Kenyan phone normalisation
    format.ts            KES, dates, order number
    permissions.ts       role capability map
  types/
supabase/
  migrations/            SQL files in order
  seed.sql               demo catalogue
docs/
  DECISIONS.md  README.md
4. DATABASE
Create migrations in supabase/migrations/. Every table: id uuid primary key default gen_random_uuid(), created_at, updated_at.
Enums: user_role (superadmin, manager), order_status (new, confirmed, deposit_paid, in_production, ready, out_for_delivery, completed, cancelled), fulfilment (pickup, delivery), pay_method (mpesa, cash, bank), order_type (cake, pastry, mixed), order_source (online, walk_in).
Tables
• profiles (id references auth.users, full_name, phone, role, active)
• categories (name, kind: cake or pastry, sort_order, active)
• products (category_id, name, slug, description, image_url, price, track_stock, stock_qty, low_stock_level, available, sort_order)
• product_costs (product_id, cost_price): superadmin only
• cake_flavours (name, price_per_kg, image_url, available, sort_order)
• cake_sizes (kg numeric, available)
• design_tiers (name, extra_fee, requires_quote, description)
• customers (name, phone unique, notes)
• orders (order_number unique like TCB-0001 via sequence, customer_id, type, status, fulfilment, delivery_zone_id, delivery_address, delivery_fee, date_needed, time_needed, subtotal, total, deposit_required, amount_paid, notes, source, price_needs_quote boolean)
• order_items (order_id, product_id nullable, name, quantity, unit_price, line_total)
• cake_details (order_item_id, size_kg, flavour_id, flavour_name, design_tier_id, design_tier_name, design_description, cake_message, allergies, reference_photos text[])
• payments (order_id, method, amount, reference_code, recorded_by, paid_at; refunds are negative amounts with a reason)
• delivery_zones (name, fee, active)
• blocked_dates (date unique, reason)
• expenses (spent_on, category, description, amount, recorded_by)
• settings (single row: shop_name, whatsapp_number, address, opening_hours jsonb, min_lead_days, daily_cake_limit, deposit_percent, deposit_threshold_kg, message_templates jsonb, payment_details text)
• activity_log (user_id, action, table_name, record_id, old_value jsonb, new_value jsonb)
Views and functions
• orders_balance view: total - amount_paid as balance_due.
• next_order_number() function using a sequence.
• cake_load_for_date(date) returns confirmed cake count for capacity checks.
• sales_daily view for the dashboard, excluding cancelled orders. A separate superadmin-only view adds cost and profit.
• A trigger that reduces products.stock_qty when an order moves from new to confirmed and restores it when a confirmed order is cancelled.
• A trigger that keeps orders.amount_paid equal to the sum of its payments.
Storage
• Bucket cake-references: public insert only through a signed upload from the server route, 5 MB limit, JPG, PNG and WebP only, max 3 files per cake.
• Bucket product-images: staff write, public read.
RLS: enable on every table. Public: read-only access to active categories, products (without costs), flavours, sizes, design tiers, delivery zones, blocked dates and public settings fields, through views or policies. Staff: policies by profiles.role. Never allow anonymous inserts directly into orders; use the server route.
5. KEY LOGIC (write as pure, tested functions)
Cake price = flavour.price_per_kg * size_kg + tier.extra_fee. If the tier requires_quote, set price_needs_quote = true, show "Final price confirmed by the shop", and store the base price as the starting total.
Delivery fee comes from the chosen zone. Pickup is free.
Deposit required for an order = deposit_percent of the total if any cake is at or above deposit_threshold_kg or uses a tier other than Simple. Otherwise zero.
Date rules (all in Africa/Nairobi): the date needed must be at least min_lead_days from now, must not be a blocked date, and the count of confirmed cakes on that date must be below daily_cake_limit. Check at order creation and again when the shop confirms.
Order status machine: allow only these moves. new → confirmed → deposit_paid → in_production → ready → out_for_delivery → completed (pickup orders skip out_for_delivery). cancelled is allowed from any state before completed. Managers can request a cancellation; only the superadmin can cancel after confirmed.
Phone: normalise to 2547XXXXXXXX format; accept 07XX, 01XX, +254 and 254 inputs; reject anything else.
WhatsApp links: https://wa.me/<number>?text=<encodeURIComponent(message)>. Templates live in settings.message_templates with placeholders such as {name}, {order}, {total}, {date}, {balance}. Provide templates for: order to shop, thank-you, deposit request, ready for pickup, out for delivery, product update.
The WhatsApp link only opens a chat with the message typed. A person still presses send. Say this clearly in the README. Do not pretend messages are sent automatically.
6. SCREENS
6.1 Public site
• Home: animated hero, two large choices (Order a cake, Order pastries), featured cakes, how it works in 3 steps, shop location with a map link, WhatsApp button.
• Cakes gallery: cards with photo, flavour, starting price. Tapping a flavour starts the cake builder with it preselected.
• Cake builder (multi-step on mobile, single scrolling form on desktop, with a sticky live price bar):
    1. Size in kg (chip selector with price shown)
    2. Flavour (visual cards)
    3. Design tier and design description
    4. Reference photo upload (drag and drop and camera, up to 3, previews, progress, remove)
    5. Message on the cake and allergies (optional)
    6. Date and time (calendar that disables blocked dates, dates inside the lead time and full days, with a friendly reason on hover or tap)
    7. Pickup or delivery (zone and fee appear for delivery)
    8. Name and phone, then review and place order
• Pastries: category chips, product cards with quantity steppers, sticky cart bar that animates when items are added, cart drawer.
• Cart and checkout: handles cakes and pastries together in one order.
• Confirmation /order/[number]: confetti, order number, summary, big Send order on WhatsApp button, Add to calendar link, and a short note on what happens next.
• Product share page /p/[slug] with proper Open Graph tags so links look good in WhatsApp.
6.2 Admin dashboard
• Overview: KPI cards (new orders, cakes due today, sales today, balance owed), a list of the newest orders, and a small week chart. Superadmin sees profit on a separate card. Manager does not.
• Orders: table on desktop, card list on mobile. Filters by status, date, type and search by name, phone or order number. Status pill with a quick-advance button. WhatsApp button on every row opens the thank-you template. Realtime inserts slide in at the top with a highlight, a badge on the sidebar, and a soft sound. Browsers block autoplay audio, so provide an Enable alerts button on first load and remember the choice.
• Order detail: items, cake details with reference photo lightbox, price edit for quotes (superadmin and manager, logged), payments panel (add M-Pesa, cash or bank payment, reference code, running balance), notes, timeline of activity, and WhatsApp templates menu.
• Production calendar: month, week and day views. Each day shows cakes due with size, flavour, status and a photo thumbnail, plus capacity used out of limit. Click a day to block or unblock it.
• Products: tabs for pastries, flavours, sizes, design tiers. Inline edit of price and availability. Image upload. Superadmin sees cost price and margin. Manager cannot delete products.
• Customers: list with orders count, total spent, last order, repeat-customer badge, click-to-WhatsApp.
• Walk-in: fast entry form for a shop customer with consent checkbox, then straight into an order.
• Sales: today, week, month, average order value, best sellers and slow movers, earnings projection (sales so far divided by days elapsed, times days in month, with a plain-language sentence).
• Finance (superadmin only): expenses log and profit and loss by day, week and month.
• Share: QR code (download PNG and print-ready PDF), short link copy, share buttons for WhatsApp status, groups and chats with a product picker.
• Reports: export sales, orders, customers and expenses as CSV or PDF.
• Users, Settings, Activity: superadmin only.
7. UI/UX DESIGN SYSTEM
The feel should be warm, friendly, appetising and polished, like a modern boutique bakery brand. Never generic or template-looking.
7.1 Colour tokens (CSS variables, light theme first)
Token
Value
Use
--cream
#FFF8F1
Page background
--vanilla
#FFEFD9
Soft sections, cards hover
--strawberry
#E8587A
Primary buttons, highlights
--strawberry-deep
#C93C61
Primary hover, active
--cocoa
#3A2620
Text, headings, dark surfaces
--caramel
#D9923B
Accents, badges, price tags
--pistachio
#8FBF9F
Success, available
--blush
#FBD8E0
Soft pink backgrounds, chips
--ink-muted
#7A645C
Secondary text
Admin dashboard: same palette with a calmer layout and a dark mode (cocoa surface, cream text). Contrast must meet WCAG AA. Status colours: new (strawberry), confirmed (caramel), deposit paid (blue-grey), in production (purple-grey), ready (pistachio), out for delivery (teal), completed (green-grey), cancelled (grey).
7.2 Typography
Load with next/font: Fraunces (soft serif) for headings and prices, DM Sans for body and UI. Large friendly headings, generous line height, tabular numbers for money. Fluid type scale with clamp().
7.3 Shape, space and depth
Rounded corners (16 to 24 px on cards, full pill on buttons and chips). Soft layered shadows tinted with cocoa at low opacity. 8 px spacing grid. Subtle decorative shapes (sprinkles, blobs, wavy dividers) as inline SVG, never heavy images. Touch targets at least 44 px.
7.4 Motion (with Motion for React)
Use a small set of reusable wrappers in components/motion/: FadeUp, Stagger, ScaleIn, PageTransition, Floating.
• Page and route transitions: gentle fade and 12 px rise, 250 to 350 ms.
• Scroll reveals on public sections using whileInView, once only, staggered children.
• Hero: floating sprinkles and a slowly drifting cake illustration, parallax on scroll, kept light.
• Buttons: slight scale on press (0.97), lift on hover, loading spinner state.
• Cards: hover lift with shadow growth, image zoom inside a clipped frame.
• Cake builder: step transitions slide left or right, the selected size and flavour pop with a spring, the live price counts up and down smoothly.
• Cart bar: springs up from the bottom when the first item is added, item count badge bounces on change. Drawer slides in with a backdrop.
• Order success: confetti burst once, checkmark draws itself with an SVG path animation.
• Dashboard: new order row slides in with a highlight that fades, KPI numbers count up on load, status pills crossfade, skeleton loaders for every data view.
• Use layout animations for list filters and reordering.
• Respect prefers-reduced-motion: disable parallax, floating and confetti, and keep only simple fades.
• Keep animations on transform and opacity. No animation may hurt scroll performance on a low-end Android phone.
7.5 UX principles
• Mobile first. Design at 360 px wide, then scale up. The dashboard must also work well on a phone because the owner will use it there.
• Thumb-friendly: primary actions in the lower half of the screen on mobile.
• One clear next action on each screen. Progress indicator in the cake builder.
• Forgiving forms: inline validation, helpful messages in plain friendly English, remember entered values if the user goes back, autofocus and the right keyboard type (tel for phone).
• Friendly copy with a warm tone and a light touch of emoji in the public site only (🎂 💕 🧁). Professional and concise copy in the dashboard.
• Empty states with an illustration and a call to action. Error states that say what to do next.
• Images: next/image, blur placeholders, explicit sizes, lazy loading. Compress uploads on the client before sending where possible.
• Accessibility: semantic HTML, labels on every input, visible focus rings, keyboard navigable, ARIA for dialogs and live regions (announce new orders), colour never the only signal.
• Performance targets on mobile: Lighthouse performance 90 or above, LCP under 2.5 s, no layout shift on images.
• Works as a PWA: web manifest, theme colour, icons, so staff can add the dashboard to the home screen. Do not add offline caching of orders.
8. SEED DATA (supabase/seed.sql)
Seed this demo catalogue. Prices are placeholders for the demo.
Flavours (KES per kg): Vanilla 1800, Marble 1900, Chocolate 2200, Black Forest 2400, Strawberry 2300, Lemon Drizzle 2200, Banana 2000, Carrot 2400, Red Velvet 2600, Coffee Mocha 2500, Oreo 2800, Chocolate Ganache 3000, Rich Fruit Cake 2600.
Sizes (kg): 0.5, 1, 1.5, 2, 3, 4, 5.
Design tiers: Simple (0), Themed (800), Custom 3D (0, requires quote).
Pastries (KES): Glazed donut 80, Chocolate or sprinkles donut 100, Cinnamon roll 150, Cinnamon rolls box of 6 800, Plain bun 30, Iced bun 50, Cake pop 120, Cake pops box of 12 1300, Cakesickle 250, Cakesickles box of 6 1400, Choc chip cookie 60, Cookies pack of 12 650, Mandazi 15, Mandazi pack of 10 130, Cake loaf vanilla or marble 450, Cake loaf banana or lemon 500.
Delivery zones: Kitengela Acacia and nearby 200, Other Kitengela 300, Athi River 450, Syokimau and Mlolongo 500, Nairobi 800.
Settings: min_lead_days 2, daily_cake_limit 6, deposit_percent 50, deposit_threshold_kg 3, hours Mon to Sat 08:00 to 19:00 and Sun 10:00 to 16:00, shop WhatsApp from NEXT_PUBLIC_SHOP_WHATSAPP.
Use placeholder food images from local SVG illustrations or a neutral gradient with an emoji until real photos are supplied. Make swapping in real photos a one-step action in the Products screen.
Also seed: one superadmin and one manager (created through a script that uses the service role key and reads emails and passwords from environment variables, never hardcoded), and five sample orders: a 2 kg Red Velvet themed pickup with deposit paid, a 1 kg Chocolate simple delivery to Athi River as new, 12 cake pops and 6 cinnamon rolls paid in full by M-Pesa, one cancelled order, and one walk-in order.
9. ENVIRONMENT VARIABLES
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SHOP_WHATSAPP=2547XXXXXXXX
SEED_SUPERADMIN_EMAIL=
SEED_SUPERADMIN_PASSWORD=
SEED_MANAGER_EMAIL=
SEED_MANAGER_PASSWORD=
Create .env.example. Never commit real values.
10. SECURITY CHECKLIST
• Zod validation on every server input. Reject unknown fields.
• Server recomputes all prices and fees. Ignore any price in the request.
• Rate limit the order and upload routes by IP.
• Validate upload type and size on the server, not just the client.
• Escape and length-limit all free text.
• RLS tested: write tests or scripts that confirm anonymous users cannot read orders, customers or costs, and managers cannot read product_costs, expenses or user data.
• No secrets in client bundles. Check the build output.
• Security headers in next.config (CSP that allows Supabase and image hosts, frame-ancestors none, referrer policy).
• Privacy note on checkout: phone numbers are used only to handle and contact about the order. Walk-in customers are added only with consent.
11. BUILD PHASES (do them in order)
Phase 1: Foundation. Project setup, Tailwind tokens, fonts, shadcn, motion wrappers, Supabase clients, migrations, RLS, seed, auth, login, admin layout with role guard and role-based navigation. Done when each role logs in and sees only its own menu items.
Phase 2: Public browsing. Home, cakes gallery, pastries, product share page, shared layout, animations. Done when a customer can browse smoothly on a phone.
Phase 3: Ordering. Pricing and rules libraries with unit tests, cake builder, cart, checkout, photo upload, server order route, confirmation page, WhatsApp link. Done when a full cake order and a mixed order can be placed and appear in the database with correct server-side prices.
Phase 4: Orders dashboard. Realtime orders list, alerts, order detail, status machine, WhatsApp templates, stock trigger on confirmation. Done when the shop can take an order from new to completed.
Phase 5: Operations. Payments and deposits, production calendar with capacity and blocked dates, customers, walk-in, products management.
Phase 6: Insight. Sales summary, earnings projection, expenses, profit and loss, reports export, activity log, QR and share tools.
Phase 7: Polish and release. Accessibility pass, performance pass, reduced-motion check, empty and error states, PWA manifest, README with setup and deploy steps for Supabase and Vercel, Playwright test of the full order journey, final cleanup.
After Phase 3, pause and tell me how to run it so I can try the ordering flow on my phone.
12. DEFINITION OF DONE
• pnpm lint, pnpm typecheck, pnpm test and pnpm build all pass.
• Role permissions match section 1 and are proven by tests.
• A manager can never see cost, profit, expenses or users, in the UI or through the API.
• Prices are always computed on the server.
• Stock changes only at confirmation, and cancellation restores it.
• Cake dates respect lead time, blocked dates and daily capacity.
• The whole customer journey works on a 360 px wide screen with slow 3G throttling.
• Animations are smooth and respect reduced motion.
• README explains setup, environment variables, seeding, deployment, and the WhatsApp click-to-chat limitation.
13. WORKING RULES
• TypeScript strict, no any unless justified in a comment.
• Small focused components and pure functions for business logic.
• Server components by default. Client components only where interaction or animation needs them.
• Do not invent features outside this document. Put ideas in docs/BACKLOG.md.
• Commit after each phase with a clear message.
• Keep the code readable. Short comments for non-obvious decisions only.
• Start now with Phase 1.