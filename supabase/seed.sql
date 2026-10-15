-- Categories
insert into categories (name, kind, sort_order, active) values
 ('Cakes','cake',1,true),('Pastries','pastry',2,true)
on conflict do nothing;

-- Cake flavours
insert into cake_flavours (name, price_per_kg, available, sort_order) values
 ('Vanilla',2500,true,1),('Marble',2600,true,2),('Lemon',2700,true,3),('Chocolate',2800,true,4),
 ('Strawberry',2800,true,5),('Black Forest',3000,true,6),('Rich Fruit',3000,true,7),
 ('Red Velvet',3200,true,8),('Oreo',3200,true,9),('Caramel',3300,true,10)
on conflict do nothing;

-- Cake sizes
insert into cake_sizes (kg, available, sort_order) values
 (1,true,1),(1.5,true,2),(2,true,3),(3,true,4),(4,true,5),(5,true,6);

-- Design tiers
insert into design_tiers (name, extra_fee, requires_quote, description, sort_order) values
 ('Simple',0,false,'Buttercream finish, simple piped message',1),
 ('Standard',500,false,'Piping, sprinkles, topper or fresh decorations',2),
 ('Themed',1500,false,'Theme or character, fondant details, drip',3),
 ('Custom',3000,true,'Multi-tier, sculpted or heavy fondant work (quoted)',4);

-- Delivery zones
insert into delivery_zones (name, fee, active) values
 ('Pickup at shop',0,true),('Kitengela',200,true),('Athi River',350,true),
 ('Syokimau',400,true),('Nairobi',600,true);

-- Pastries
insert into products (category_id,name,slug,description,price,track_stock,stock_qty,low_stock_level,available,sort_order)
select c.id, t.name, t.slug, t.description, t.price, true, 20, 5, true, t.so from categories c
cross join (values
 ('Glazed donut','glazed-donut','Classic glazed ring donut',80,1),
 ('Chocolate donut','chocolate-donut','Filled/chocolate donut with sprinkles',100,2),
 ('Donut box (6)','donut-box-6','Six assorted donuts in a box',450,3),
 ('Cinnamon roll','cinnamon-roll','Soft cinnamon roll with icing',150,4),
 ('Sweet bun','sweet-bun','Soft sweet tea bun',40,5),
 ('Cake pop','cake-pop','Cake pop on a stick',120,6),
 ('Cakesickle','cakesickle','Frozen cake on a stick',150,7),
 ('Chocolate chip cookie','choc-chip-cookie','Classic choc chip cookie',60,8),
 ('Cookie pack (6)','cookie-pack-6','Six cookies in a pack',330,9),
 ('Mandazi pack (6)','mandazi-pack-6','Six mandazis in a pack',100,10),
 ('Cake loaf','cake-loaf','Vanilla or marble cake loaf',400,11),
 ('Banana loaf','banana-loaf','Banana cake loaf',450,12),
 ('Fruit loaf','fruit-loaf','Rich fruit cake loaf',500,13)
) as t(name,slug,description,price,so)
where c.kind='pastry';

-- Showcase cakes (products)
insert into products (category_id,name,slug,description,price,track_stock,stock_qty,available,sort_order,image_url)
select c.id, t.name, t.slug, t.description, t.price, false, 0, true, t.so, t.img
from categories c
cross join (values
 ('Classic Black Forest','classic-black-forest','Rich Black Forest cake, fresh cream & cherries',3000,1,'/showcase/01-classic-black-forest.jpg'),
 ('Chocolate Drip Cake','chocolate-drip-cake','Moist chocolate cake with chocolate drip',3300,2,'/showcase/02-chocolate-drip-cake.jpg'),
 ('Strawberry Cream Delight','strawberry-cream-delight','Strawberry cream cake with fresh strawberries',3300,3,'/showcase/03-strawberry-cream-delight.jpg'),
 ('Red Velvet Elegance','red-velvet-elegance','Red velvet cake with cream cheese frosting',3700,4,'/showcase/04-red-velvet-elegance.jpg'),
 ('Oreo Crunch Cake','oreo-crunch-cake','Cookies & cream Oreo celebration cake',3700,5,'/showcase/05-oreo-crunch-cake.jpg'),
 ('Caramel Drip Cake','caramel-drip-cake','Caramel drip cake with buttercream',3800,6,'/showcase/06-caramel-drip-cake.jpg'),
 ('Rainbow Birthday Cake','rainbow-birthday-cake','Colourful vanilla rainbow birthday cake',4000,7,'/showcase/07-rainbow-birthday-cake.jpg'),
 ('Two-tier Celebration Cake','two-tier-celebration-cake','Vanilla two-tier celebration cake (5kg)',15500,8,'/showcase/08-two-tier-celebration-cake.jpg')
) as t(name,slug,description,price,so,img)
where c.kind='cake';

-- product costs (superadmin-only, ~60% of retail price)
insert into product_costs (product_id, cost_price)
select id, (price * 60 / 100) from products
on conflict (product_id) do nothing;

-- Settings (single row)
insert into settings (id, shop_name, whatsapp_number, address, opening_hours, min_lead_days, daily_cake_limit, deposit_percent, deposit_threshold_kg, message_templates, payment_details)
values (
 1,
 'Tamera''s Cakes & Bakery',
 '254700000000',
 'Kitengela, Ola/Acacia Stage, Acacia West Arcade, Shop 13, opposite Selelo Mall, behind Leadway Petrol Station',
 '{"mon":{"open":"08:00","close":"19:00"},"tue":{"open":"08:00","close":"19:00"},"wed":{"open":"08:00","close":"19:00"},"thu":{"open":"08:00","close":"19:00"},"fri":{"open":"08:00","close":"19:00"},"sat":{"open":"08:00","close":"19:00"},"sun":{"open":"10:00","close":"16:00"}}'::jsonb,
 2, 6, 50, 3,
 '{"order_to_shop":"Hi Tamera! Here is my order {order}\\nName: {name}\\nTotal: {total}\\nDate needed: {date}","thank_you":"Hi {name}! Thank you for your order {order}. Total {total}, balance due {balance}. We will get in touch about your cake design. - Tamera''s","deposit_request":"Hi {name}, to confirm order {order} please send a deposit of {balance}. M-Pesa: {payment}.","ready_pickup":"Hi {name}! Your order {order} is ready for pickup. See you soon! - Tamera''s","out_for_delivery":"Hi {name}! Your order {order} is out for delivery to you today. - Tamera''s","product_update":"Hi {name}! New at Tamera''s: {product}. Order here: {link}"}'::jsonb,
 'M-Pesa paybill/Till instructions to be added in settings.'
)
on conflict do nothing;

-- Customers (real people; phones referenced by the demo orders below)
insert into customers (name, phone, source, consent) values
 ('Jared', '254732209073','online',true),
 ('Jay', '254714965716','online',true),
 ('Damaris', '254742891423','walk_in',true),
 ('Edwin', '254791572611','online',true),
 ('Akinyi', '254751369320','online',true)
on conflict do nothing;

-- Demo orders: created_by stays NULL (it references profiles(id) = staff, and no
-- staff profile exists until a user signs up). Set it when staff record an order.
-- TCB-0001: Jared, 2kg Red Velvet themed, pickup, deposit_paid
-- NOTE: all rows (order -> item -> cake_details) are created in ONE statement so
-- the ids chain through `returning id`. Matching by order_number afterwards fails
-- because next_order_number() depends on the sequence state, not on TCB-0001.
with
  cust as (select id from customers where phone='254732209073'),
  flavour as (select id,name,price_per_kg from cake_flavours where name='Red Velvet'),
  tier as (select id,name,extra_fee,requires_quote from design_tiers where name='Themed'),
  newo as (insert into orders (order_number,customer_id,type,status,fulfilment,date_needed,subtotal,total,deposit_required,amount_paid,source,created_by)
            select next_order_number(), c.id, 'cake','deposit_paid','pickup', current_date + 4,
              0, (f.price_per_kg*2 + t.extra_fee), (f.price_per_kg*2 + t.extra_fee)*50/100, 0, 'online', null::uuid
            from cust c, flavour f, tier t
            returning id),
  item as (insert into order_items (order_id, name, quantity, unit_price, line_total)
            select o.id, 'Red Velvet cake 2kg', 1, (f.price_per_kg*2 + t.extra_fee), (f.price_per_kg*2 + t.extra_fee)
            from newo o, flavour f, tier t
            returning id)
insert into cake_details (order_item_id, size_kg, flavour_id, flavour_name, design_tier_id, design_tier_name, design_description, cake_message)
select i.id, 2, f.id, f.name, t.id, t.name, 'Birthday theme with red roses', 'Happy Birthday Zawadi'
from item i, flavour f, tier t;

-- TCB-0002: Jay, pastries delivery Kitengela
with
  cust as (select id from customers where phone='254714965716'),
  zone as (select id from delivery_zones where name='Kitengela'),
  newo as (insert into orders (order_number,customer_id,type,status,fulfilment,delivery_zone_id,delivery_fee,subtotal,total,source,created_by)
            select next_order_number(), c.id, 'pastry','new','delivery', z.id, 200, 1800, 1800, 'online', null::uuid
            from cust c cross join zone z
            returning id)
insert into order_items (order_id, name, quantity, unit_price, line_total)
select o.id, v.name, v.qty, v.unit, v.total
from newo o
cross join (values ('Donut box (6)',2,450,900),('Cinnamon roll',6,150,900)) as v(name,qty,unit,total);

-- TCB-0003: Damaris walk-in paid in full (payment chained in the same statement)
with
  cust as (select id from customers where phone='254742891423'),
  newo as (insert into orders (order_number,customer_id,type,status,fulfilment,subtotal,total,amount_paid,source,created_by)
            select next_order_number(), c.id, 'pastry','completed','pickup', 450+200, 450+200, 450+200, 'walk_in', null::uuid
            from cust c
            returning id),
  item as (insert into order_items (order_id, name, quantity, unit_price, line_total)
            select o.id, v.name, v.qty, v.unit, v.total
            from newo o
            cross join (values ('Banana loaf',1,450,450),('Mandazi pack (6)',2,100,200)) as v(name,qty,unit,total)
            returning id)
insert into payments (order_id, method, amount, reference_code)
select o.id, 'cash', 650, null from newo o;
-- `item` exists only to keep the item rows and the payment in the same chain
-- as their order; Postgres executes all data-modifying CTEs regardless of which
-- one is the top-level statement.

-- TCB-0004: cancelled 1kg vanilla (stock restore demo)
with
  cust as (select id from customers where phone='254791572611'),
  newo as (insert into orders (order_number,customer_id,type,status,fulfilment,subtotal,total,source,created_by)
            select next_order_number(), c.id, 'cake','cancelled', 'pickup', 2500, 2500, 'online', null::uuid
            from cust c
            returning id)
insert into order_items (order_id, product_id, name, quantity, unit_price, line_total)
select o.id, null, 'Vanilla cake 1kg', 1, 2500, 2500
from newo o;
-- no cake_details for cancelled demo; stock will be restored on cancel trigger

-- Sales summary for sales_daily view inserts
