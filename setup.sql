-- SHISHIR SHOP: one-time setup. Safe to run more than once. Paste all of it in Supabase > SQL Editor > Run.

-- 1. Tables
create table if not exists site(id int primary key, data jsonb not null default '{}', updated_at timestamptz default now());
create table if not exists products(
  id bigint generated always as identity primary key,
  name text not null, price numeric not null default 0, old_price numeric,
  category text default '', img text default '', preview text default '',
  descr text default '', file text default '', stock int,
  active boolean default true, pos int default 0, created_at timestamptz default now());
create table if not exists orders(
  id bigint generated always as identity primary key,
  code text unique, pid bigint, pname text, amount numeric, name text, phone text,
  email text, method text, trx text, coupon text default '',
  status text default 'pending', created_at timestamptz default now());
create table if not exists coupons(code text primary key, pct int not null, active boolean default true);
create table if not exists reviews(
  id bigint generated always as identity primary key,
  pid bigint, oid bigint unique, name text, rating int, body text,
  approved boolean default false, created_at timestamptz default now());

alter table products add column if not exists featured boolean default false;
alter table products add column if not exists badge text default '';
alter table products add column if not exists gallery text default '';
alter table products add column if not exists ba_before text default '';
alter table products add column if not exists ba_after text default '';
alter table products add column if not exists soon boolean default false;
alter table orders add column if not exists delivery text default '';
alter table orders add column if not exists license text default '';
alter table orders add column if not exists redeemed int default 0;
alter table orders add column if not exists note text default '';
alter table coupons add column if not exists max_uses int;
alter table coupons add column if not exists expires date;

-- 2. Security (Row Level Security)
alter table site enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table coupons enable row level security;
alter table reviews enable row level security;

drop policy if exists "read" on site;      create policy "read" on site for select using (true);
drop policy if exists "ins" on site;       create policy "ins" on site for insert to authenticated with check (true);
drop policy if exists "upd" on site;       create policy "upd" on site for update to authenticated using (true) with check (true);
drop policy if exists "p read" on products;  create policy "p read" on products for select using (active);
drop policy if exists "p admin" on products; create policy "p admin" on products for all to authenticated using (true) with check (true);
drop policy if exists "o admin" on orders;   create policy "o admin" on orders for all to authenticated using (true) with check (true);
drop policy if exists "c admin" on coupons;  create policy "c admin" on coupons for all to authenticated using (true) with check (true);
drop policy if exists "r read" on reviews;   create policy "r read" on reviews for select using (approved);
drop policy if exists "r admin" on reviews;  create policy "r admin" on reviews for all to authenticated using (true) with check (true);

-- 3. Private storage for product files
insert into storage.buckets(id,name,public) values('shopfiles','shopfiles',false) on conflict do nothing;
drop policy if exists "shopfiles admin" on storage.objects;
create policy "shopfiles admin" on storage.objects for all to authenticated
  using (bucket_id='shopfiles') with check (bucket_id='shopfiles');

-- 4. Functions
create or replace function check_coupon(c text) returns int language sql security definer set search_path=public as $$
  select coalesce(max(pct),0) from coupons cp where cp.code=upper(trim(c)) and cp.active
    and (cp.expires is null or cp.expires>=current_date)
    and (cp.max_uses is null or (select count(*) from orders o where upper(o.coupon)=cp.code and o.status<>'cancelled')<cp.max_uses) $$;

create or replace function place_order(p_pid bigint,p_name text,p_phone text,p_email text,p_method text,p_trx text,p_coupon text default '')
returns json language plpgsql security definer set search_path=public as $$
declare p products%rowtype; pc int:=0; c text; amt numeric; st text:='pending'; lk text:=''; dl text:='';
begin
  select * into p from products where id=p_pid and active and not coalesce(soon,false) and (stock is null or stock>0);
  if not found then raise exception 'This product is not available.'; end if;
  select coalesce(max(pct),0) into pc from coupons cp where cp.code=upper(trim(coalesce(p_coupon,''))) and cp.active
    and (cp.expires is null or cp.expires>=current_date)
    and (cp.max_uses is null or (select count(*) from orders o2 where upper(o2.coupon)=cp.code and o2.status<>'cancelled')<cp.max_uses);
  amt:=round(p.price*(100-pc)/100.0);
  if length(trim(p_name))<2 then raise exception 'Please enter your name.'; end if;
  if amt>0 then
    if length(trim(p_phone))<6 or length(trim(p_trx))<4 then raise exception 'Please fill all required fields.'; end if;
    if exists(select 1 from orders where upper(trx)=upper(trim(p_trx)) and status<>'cancelled') then raise exception 'This TrxID was already used.'; end if;
    if (select count(*) from orders where right(regexp_replace(phone,'\D','','g'),10)=right(regexp_replace(p_phone,'\D','','g'),10) and created_at>now()-interval '1 hour')>=5 then raise exception 'Too many orders. Please try again later.'; end if;
  else
    if position('@' in coalesce(p_email,''))=0 then raise exception 'Email is required for free downloads.'; end if;
    st:='delivered'; dl:=p.file;
    lk:='SHL-'||upper(substr(md5(random()::text),1,4))||'-'||upper(substr(md5(random()::text),1,4))||'-'||upper(substr(md5(random()::text),1,4));
  end if;
  if (select count(*) from orders where created_at>now()-interval '10 minutes')>=40 then raise exception 'The shop is busy. Please try again in a few minutes.'; end if;
  c:='SH'||to_char(now(),'YYMMDD')||lpad((floor(random()*9000)+1000)::int::text,4,'0');
  insert into orders(code,pid,pname,amount,name,phone,email,method,trx,coupon,status,license,delivery)
  values(c,p.id,p.name,amt,trim(p_name),trim(coalesce(p_phone,'')),trim(coalesce(p_email,'')),p_method,upper(trim(p_trx)),upper(trim(coalesce(p_coupon,''))),st,lk,dl);
  return json_build_object('code',c,'amount',amt,'name',p.name,'license',lk);
end $$;

create or replace function get_order(p_code text, p_phone text) returns json
language plpgsql security definer set search_path=public as $$
declare o orders%rowtype;
begin
  select * into o from orders where code=upper(trim(p_code))
    and right(regexp_replace(phone,'\D','','g'),10)=right(regexp_replace(p_phone,'\D','','g'),10);
  if not found then return null; end if;
  return json_build_object('code',o.code,'status',o.status,'name',o.pname,'amount',o.amount,
    'date',o.created_at,'buyer',o.name,'phone',o.phone,'email',o.email,'method',o.method,
    'trx',o.trx,'coupon',o.coupon,
    'license',case when o.status in ('paid','delivered') then o.license else '' end);
end $$;

create or replace function redeem_license(p_key text) returns json
language plpgsql security definer set search_path=public as $$
declare o orders%rowtype;
begin
  select * into o from orders where license=upper(trim(p_key)) and status in ('paid','delivered');
  if not found then return null; end if;
  if coalesce(o.redeemed,0)>=10 then return json_build_object('error','limit'); end if;
  update orders set redeemed=coalesce(redeemed,0)+1 where id=o.id;
  return json_build_object('product',o.pname,'buyer',left(o.name,2)||'***','delivery',o.delivery,'left',10-coalesce(o.redeemed,0)-1);
end $$;

create or replace function verify_license(p_key text) returns json
language plpgsql security definer set search_path=public as $$
declare o orders%rowtype;
begin
  select * into o from orders where license=upper(trim(p_key)) and status in ('paid','delivered');
  if not found then return null; end if;
  return json_build_object('product',o.pname,'buyer',left(o.name,2)||'***','date',o.created_at,'code',o.code);
end $$;

create or replace function add_review(p_key text,p_rating int,p_body text) returns json
language plpgsql security definer set search_path=public as $$
declare o orders%rowtype;
begin
  select * into o from orders where license=upper(trim(p_key)) and status in ('paid','delivered');
  if not found then raise exception 'This license key is not valid.'; end if;
  if length(trim(p_body))<3 then raise exception 'Please write a few words.'; end if;
  if exists(select 1 from reviews where oid=o.id) then raise exception 'You already reviewed this order.'; end if;
  insert into reviews(pid,oid,name,rating,body) values(o.pid,o.id,split_part(o.name,' ',1),greatest(1,least(5,p_rating)),trim(p_body));
  return json_build_object('ok',true);
end $$;

create or replace function orders_stock() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.status='pending' and new.status in ('paid','delivered') then
    update products set stock=greatest(stock-1,0) where id=new.pid and stock is not null;
  end if;
  return new;
end $$;
drop trigger if exists orders_stock_t on orders;
create trigger orders_stock_t after update on orders for each row execute function orders_stock();

grant execute on function check_coupon(text) to anon, authenticated;
grant execute on function place_order(bigint,text,text,text,text,text,text) to anon, authenticated;
grant execute on function get_order(text,text) to anon, authenticated;
grant execute on function redeem_license(text) to anon, authenticated;
grant execute on function verify_license(text) to anon, authenticated;
grant execute on function add_review(text,int,text) to anon, authenticated;
notify pgrst, 'reload schema';
