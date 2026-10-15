-- enums
create type user_role as enum ('superadmin', 'manager');
create type order_status as enum ('new','confirmed','deposit_paid','in_production','ready','out_for_delivery','completed','cancelled');
create type fulfilment as enum ('pickup','delivery');
create type pay_method as enum ('mpesa','cash','bank');
create type order_type as enum ('cake','pastry','mixed');
create type order_source as enum ('online','walk_in');
