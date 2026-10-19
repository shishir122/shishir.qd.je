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

-- =====================================================================
-- PART 2: cart, bundle discount, offers with timer, customers, blog,
-- email list, refunds, social proof. Safe to run again.
-- =====================================================================
alter table products add column if not exists sale_price numeric;
alter table products add column if not exists sale_until timestamptz;
alter table products add column if not exists faq text default '';
alter table products add column if not exists audio text default '';
alter table orders add column if not exists items jsonb;

create table if not exists subscribers(id bigint generated always as identity primary key, email text unique, src text default '', created_at timestamptz default now());
create table if not exists posts(id bigint generated always as identity primary key, title text not null, cat text default '', img text default '', body text default '', published boolean default false, created_at timestamptz default now());
alter table subscribers enable row level security;
alter table posts enable row level security;
drop policy if exists "s admin" on subscribers;  create policy "s admin" on subscribers for all to authenticated using (true) with check (true);
drop policy if exists "po read" on posts;        create policy "po read" on posts for select using (published);
drop policy if exists "po admin" on posts;       create policy "po admin" on posts for all to authenticated using (true) with check (true);

create or replace function eff_price(p products) returns numeric language sql stable as $$
  select case when p.sale_price is not null and p.sale_until is not null and p.sale_until>now() then p.sale_price else p.price end $$;

create or replace function place_order(p_pid bigint,p_name text,p_phone text,p_email text,p_method text,p_trx text,p_coupon text default '')
returns json language plpgsql security definer set search_path=public as $$
declare p products%rowtype; pc int:=0; c text; amt numeric; st text:='pending'; lk text:=''; dl text:='';
begin
  select * into p from products where id=p_pid and active and not coalesce(soon,false) and (stock is null or stock>0);
  if not found then raise exception 'This product is not available.'; end if;
  select coalesce(max(pct),0) into pc from coupons cp where cp.code=upper(trim(coalesce(p_coupon,''))) and cp.active
    and (cp.expires is null or cp.expires>=current_date)
    and (cp.max_uses is null or (select count(*) from orders o2 where upper(o2.coupon)=cp.code and o2.status<>'cancelled')<cp.max_uses);
  amt:=round(eff_price(p)*(100-pc)/100.0);
  if length(trim(p_name))<2 then raise exception 'Please enter your name.'; end if;
  if amt>0 then
    if length(trim(p_phone))<6 or length(trim(p_trx))<4 then raise exception 'Please fill all required fields.'; end if;
    if exists(select 1 from orders where upper(trx)=upper(trim(p_trx)) and status not in ('cancelled','refunded')) then raise exception 'This TrxID was already used.'; end if;
    if (select count(*) from orders where right(regexp_replace(phone,'\D','','g'),10)=right(regexp_replace(p_phone,'\D','','g'),10) and created_at>now()-interval '1 hour')>=5 then raise exception 'Too many orders. Please try again later.'; end if;
  else
    if position('@' in coalesce(p_email,''))=0 then raise exception 'Email is required for free downloads.'; end if;
    st:='delivered'; dl:=p.file;
    lk:='SHL-'||upper(substr(md5(random()::text),1,4))||'-'||upper(substr(md5(random()::text),1,4))||'-'||upper(substr(md5(random()::text),1,4));
  end if;
  if (select count(*) from orders where created_at>now()-interval '10 minutes')>=40 then raise exception 'The shop is busy. Please try again in a few minutes.'; end if;
  c:='SH'||to_char(now(),'YYMMDD')||lpad((floor(random()*9000)+1000)::int::text,4,'0');
  insert into orders(code,pid,pname,amount,name,phone,email,method,trx,coupon,status,license,delivery,items)
  values(c,p.id,p.name,amt,trim(p_name),trim(coalesce(p_phone,'')),trim(coalesce(p_email,'')),p_method,upper(trim(p_trx)),upper(trim(coalesce(p_coupon,''))),st,lk,dl,
         jsonb_build_array(jsonb_build_object('id',p.id,'name',p.name,'price',eff_price(p))));
  return json_build_object('code',c,'amount',amt,'name',p.name,'license',lk);
end $$;

create or replace function place_order_cart(p_ids bigint[],p_name text,p_phone text,p_email text,p_method text,p_trx text,p_coupon text default '')
returns json language plpgsql security definer set search_path=public as $$
declare ids bigint[]; n int; sub numeric; pc int:=0; bp int:=0; amt numeric; c text; its jsonb; names text; cfg jsonb; bmin int:=0; bpct int:=0;
begin
  select array(select distinct x from unnest(p_ids) x) into ids; n:=coalesce(array_length(ids,1),0);
  if n<1 or n>10 then raise exception 'Your cart is empty or too big.'; end if;
  select jsonb_agg(jsonb_build_object('id',pr.id,'name',pr.name,'price',eff_price(pr)) order by pr.pos,pr.id), string_agg(pr.name,' + ' order by pr.pos,pr.id), sum(eff_price(pr))
    into its,names,sub from products pr where pr.id=any(ids) and pr.active and not coalesce(pr.soon,false) and (pr.stock is null or pr.stock>0);
  if its is null or jsonb_array_length(its)<>n then raise exception 'One of the products is not available.'; end if;
  select data into cfg from site where id=2;
  bmin:=coalesce(nullif(cfg->>'bundleMin','')::int,0); bpct:=coalesce(nullif(cfg->>'bundlePct','')::int,0);
  if bmin>0 and n>=bmin then bp:=bpct; end if;
  select coalesce(max(pct),0) into pc from coupons cp where cp.code=upper(trim(coalesce(p_coupon,''))) and cp.active
    and (cp.expires is null or cp.expires>=current_date)
    and (cp.max_uses is null or (select count(*) from orders o2 where upper(o2.coupon)=cp.code and o2.status<>'cancelled')<cp.max_uses);
  amt:=round(sub*(100-least(90,pc+bp))/100.0);
  if length(trim(p_name))<2 or length(trim(p_phone))<6 or length(trim(p_trx))<4 or amt<=0 then raise exception 'Please fill all required fields.'; end if;
  if exists(select 1 from orders where upper(trx)=upper(trim(p_trx)) and status not in ('cancelled','refunded')) then raise exception 'This TrxID was already used.'; end if;
  if (select count(*) from orders where right(regexp_replace(phone,'\D','','g'),10)=right(regexp_replace(p_phone,'\D','','g'),10) and created_at>now()-interval '1 hour')>=5 then raise exception 'Too many orders. Please try again later.'; end if;
  if (select count(*) from orders where created_at>now()-interval '10 minutes')>=40 then raise exception 'The shop is busy. Please try again in a few minutes.'; end if;
  c:='SH'||to_char(now(),'YYMMDD')||lpad((floor(random()*9000)+1000)::int::text,4,'0');
  insert into orders(code,pid,pname,amount,name,phone,email,method,trx,coupon,items)
  values(c,(its->0->>'id')::bigint,names,amt,trim(p_name),trim(p_phone),trim(coalesce(p_email,'')),p_method,upper(trim(p_trx)),upper(trim(coalesce(p_coupon,''))),its);
  return json_build_object('code',c,'amount',amt,'name',names);
end $$;

create or replace function get_order(p_code text, p_phone text) returns json
language plpgsql security definer set search_path=public as $$
declare o orders%rowtype;
begin
  select * into o from orders where code=upper(trim(p_code))
    and right(regexp_replace(phone,'\D','','g'),10)=right(regexp_replace(p_phone,'\D','','g'),10);
  if not found then return null; end if;
  return json_build_object('code',o.code,'status',o.status,'name',o.pname,'amount',o.amount,'items',o.items,
    'date',o.created_at,'buyer',o.name,'phone',o.phone,'email',o.email,'method',o.method,'trx',o.trx,'coupon',o.coupon,
    'license',case when o.status in ('paid','delivered') then o.license else '' end);
end $$;

create or replace function redeem_license(p_key text) returns json
language plpgsql security definer set search_path=public as $$
declare o orders%rowtype; files jsonb:='[]'::jsonb; it jsonb; pr products%rowtype; u text; i int:=0; lines text[];
begin
  select * into o from orders where license=upper(trim(p_key)) and status in ('paid','delivered');
  if not found then return null; end if;
  if coalesce(o.redeemed,0)>=10 then return json_build_object('error','limit'); end if;
  update orders set redeemed=coalesce(redeemed,0)+1 where id=o.id;
  lines:=string_to_array(coalesce(o.delivery,''),E'\n');
  for it in select * from jsonb_array_elements(coalesce(o.items,jsonb_build_array(jsonb_build_object('id',o.pid,'name',o.pname)))) loop
    i:=i+1; u:=null;
    select * into pr from products where id=(it->>'id')::bigint;
    if found and coalesce(pr.file,'') ~* '^https?://' then u:=pr.file; end if;
    if u is null then u:=coalesce(lines[i],''); end if;
    files:=files||jsonb_build_array(jsonb_build_object('name',it->>'name','url',u));
  end loop;
  return json_build_object('product',o.pname,'buyer',left(o.name,2)||'***','files',files,'left',10-coalesce(o.redeemed,0)-1);
end $$;

create or replace function orders_stock() returns trigger language plpgsql security definer set search_path=public as $$
declare it jsonb;
begin
  if old.status is distinct from new.status then
    for it in select * from jsonb_array_elements(coalesce(new.items,jsonb_build_array(jsonb_build_object('id',new.pid)))) loop
      if old.status='pending' and new.status in ('paid','delivered') then
        update products set stock=greatest(stock-1,0) where id=(it->>'id')::bigint and stock is not null;
      elsif old.status in ('paid','delivered') and new.status in ('refunded','cancelled') then
        update products set stock=stock+1 where id=(it->>'id')::bigint and stock is not null;
      end if;
    end loop;
  end if;
  return new;
end $$;

create or replace function recent_sales() returns json language sql security definer set search_path=public as $$
  select coalesce(json_agg(x),'[]'::json) from (
    select split_part(name,' ',1) as who, pname as what, created_at as at from orders
    where status in ('paid','delivered') and amount>0 and created_at>now()-interval '30 days'
    order by created_at desc limit 6) x $$;

create or replace function subscribe(p_email text,p_src text default '') returns json
language plpgsql security definer set search_path=public as $$
begin
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid email.'; end if;
  if (select count(*) from subscribers where created_at>now()-interval '1 hour')>=30 then raise exception 'Please try again later.'; end if;
  insert into subscribers(email,src) values(lower(trim(p_email)),left(coalesce(p_src,''),40)) on conflict do nothing;
  return json_build_object('ok',true);
end $$;

grant execute on function place_order(bigint,text,text,text,text,text,text) to anon, authenticated;
grant execute on function place_order_cart(bigint[],text,text,text,text,text,text) to anon, authenticated;
grant execute on function get_order(text,text) to anon, authenticated;
grant execute on function redeem_license(text) to anon, authenticated;
grant execute on function recent_sales() to anon, authenticated;
grant execute on function subscribe(text,text) to anon, authenticated;
notify pgrst, 'reload schema';

-- =====================================================================
-- PART 3: site error log (free, stored in your database, no emails)
-- =====================================================================
create table if not exists errors(
  id bigint generated always as identity primary key, k text unique,
  msg text, page text, src text, n int default 1,
  first_at timestamptz default now(), last_at timestamptz default now());
alter table errors enable row level security;
drop policy if exists "e admin" on errors;
create policy "e admin" on errors for all to authenticated using (true) with check (true);

create or replace function log_error(p_msg text,p_page text,p_src text default '') returns json
language plpgsql security definer set search_path=public as $$
declare hk text;
begin
  if length(coalesce(p_msg,''))<3 then return null; end if;
  hk:=md5(left(p_msg,200)||'|'||left(coalesce(p_page,''),120));
  if (select count(*) from errors where last_at>now()-interval '1 hour')>=100
     and not exists(select 1 from errors where errors.k=hk) then return null; end if;
  insert into errors(k,msg,page,src) values(hk,left(p_msg,300),left(coalesce(p_page,''),200),left(coalesce(p_src,''),200))
  on conflict (k) do update set n=errors.n+1, last_at=now();
  return json_build_object('ok',true);
end $$;
grant execute on function log_error(text,text,text) to anon, authenticated;
notify pgrst, 'reload schema';

-- =====================================================================
-- PART 4: license system (trial minutes, paid approval, expiry).
-- Used by the License Center page, the admin Licenses tab, and a plugin/panel.
-- =====================================================================
create table if not exists licenses(
  id bigint generated always as identity primary key,
  lkey text unique not null, product text not null default 'text-pack',
  name text default '', contact text default '',
  plan text default 'custom', expires_at timestamptz,
  status text default 'active', machines jsonb default '[]'::jsonb, max_machines int default 1,
  last_seen timestamptz, note text default '', created_at timestamptz default now());
create table if not exists lic_trials(
  id bigint generated always as identity primary key, machine text not null, product text not null,
  seconds_used int default 0, first_at timestamptz default now(), last_at timestamptz default now(), unique(machine,product));
create table if not exists lic_requests(
  id bigint generated always as identity primary key, machine text, product text, name text, contact text,
  trx text, msg text, status text default 'pending', lkey text, created_at timestamptz default now());
alter table licenses enable row level security;
alter table lic_trials enable row level security;
alter table lic_requests enable row level security;
drop policy if exists "li admin" on licenses;     create policy "li admin" on licenses for all to authenticated using (true) with check (true);
drop policy if exists "lt admin" on lic_trials;   create policy "lt admin" on lic_trials for all to authenticated using (true) with check (true);
drop policy if exists "lr admin" on lic_requests; create policy "lr admin" on lic_requests for all to authenticated using (true) with check (true);

create or replace function lic_trial_tick(p_machine text,p_product text,p_seconds int default 0) returns json
language plpgsql security definer set search_path=public as $$
declare t lic_trials%rowtype; add int; lim int:=900; pr text:=left(coalesce(p_product,'text-pack'),40);
begin
  if length(coalesce(p_machine,''))<8 or length(p_machine)>100 then raise exception 'Bad machine id.'; end if;
  add:=least(greatest(coalesce(p_seconds,0),0),120);
  insert into lic_trials(machine,product,seconds_used) values(p_machine,pr,least(add,lim))
  on conflict (machine,product) do update set seconds_used=least(lim,lic_trials.seconds_used+add), last_at=now()
  returning * into t;
  return json_build_object('used',t.seconds_used,'remaining',greatest(0,lim-t.seconds_used),'expired',t.seconds_used>=lim);
end $$;

create or replace function lic_status(p_machine text,p_product text) returns json
language plpgsql security definer set search_path=public as $$
declare l licenses%rowtype; t lic_trials%rowtype; pr text:=left(coalesce(p_product,'text-pack'),40); lexp boolean:=false;
begin
  select * into l from licenses where product=pr and status='active' and machines ? p_machine order by expires_at desc nulls first limit 1;
  if found then
    if l.expires_at is null or l.expires_at>now() then
      update licenses set last_seen=now() where id=l.id;
      return json_build_object('licensed',true,'plan',l.plan,'expires_at',l.expires_at,
        'days_left',case when l.expires_at is null then null else ceil(extract(epoch from (l.expires_at-now()))/86400) end);
    end if;
    lexp:=true;
  end if;
  select * into t from lic_trials where machine=p_machine and product=pr;
  return json_build_object('licensed',false,'license_expired',lexp,
    'trial_remaining',greatest(0,900-coalesce(t.seconds_used,0)),'trial_expired',coalesce(t.seconds_used,0)>=900,
    'pending',exists(select 1 from lic_requests where machine=p_machine and product=pr and status='pending'));
end $$;

create or replace function lic_activate(p_key text,p_machine text,p_product text default 'text-pack') returns json
language plpgsql security definer set search_path=public as $$
declare l licenses%rowtype;
begin
  select * into l from licenses where lkey=upper(trim(p_key));
  if not found or l.status<>'active' or l.product<>left(coalesce(p_product,'text-pack'),40) then return json_build_object('ok',false,'reason','invalid'); end if;
  if l.expires_at is not null and l.expires_at<=now() then return json_build_object('ok',false,'reason','expired'); end if;
  if length(coalesce(p_machine,''))<8 then return json_build_object('ok',false,'reason','machine'); end if;
  if not (l.machines ? p_machine) then
    if jsonb_array_length(l.machines)>=l.max_machines then return json_build_object('ok',false,'reason','machine_limit'); end if;
    update licenses set machines=machines||to_jsonb(p_machine) where id=l.id;
  end if;
  update licenses set last_seen=now() where id=l.id;
  return json_build_object('ok',true,'plan',l.plan,'expires_at',l.expires_at);
end $$;

create or replace function lic_request(p_machine text,p_product text,p_name text,p_contact text,p_trx text,p_msg text default '') returns json
language plpgsql security definer set search_path=public as $$
begin
  if length(trim(coalesce(p_name,'')))<2 or length(trim(coalesce(p_contact,'')))<5 then raise exception 'Please enter your name and WhatsApp or email.'; end if;
  if (select count(*) from lic_requests where created_at>now()-interval '1 day' and (machine=p_machine or contact=trim(p_contact)))>=5 then raise exception 'Too many requests. Please wait.'; end if;
  if (select count(*) from lic_requests where created_at>now()-interval '1 hour')>=60 then raise exception 'Busy. Try again later.'; end if;
  insert into lic_requests(machine,product,name,contact,trx,msg) values(left(coalesce(p_machine,''),100),left(coalesce(p_product,'text-pack'),40),left(trim(p_name),80),left(trim(p_contact),100),left(coalesce(p_trx,''),60),left(coalesce(p_msg,''),400));
  return json_build_object('ok',true);
end $$;

create or replace function lic_lookup(p_key text) returns json
language plpgsql security definer set search_path=public as $$
declare l licenses%rowtype;
begin
  select * into l from licenses where lkey=upper(trim(p_key));
  if not found then return null; end if;
  return json_build_object('product',l.product,'plan',l.plan,'status',l.status,'expires_at',l.expires_at,
    'expired',(l.expires_at is not null and l.expires_at<=now()),
    'days_left',case when l.expires_at is null then null else ceil(extract(epoch from (l.expires_at-now()))/86400) end,
    'machines',jsonb_array_length(l.machines),'max',l.max_machines,'holder',left(coalesce(l.name,''),2)||'***');
end $$;

grant execute on function lic_trial_tick(text,text,int) to anon, authenticated;
grant execute on function lic_status(text,text) to anon, authenticated;
grant execute on function lic_activate(text,text,text) to anon, authenticated;
grant execute on function lic_request(text,text,text,text,text,text) to anon, authenticated;
grant execute on function lic_lookup(text) to anon, authenticated;
notify pgrst, 'reload schema';

-- =====================================================================
-- PART 5: plugin license (days-based free trial, protected preset keys)
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;
create table if not exists lic_secrets(product text primary key, secret text not null);
alter table lic_secrets enable row level security;   -- no policy: only the functions below can read it
create table if not exists lic_dl(id bigint generated always as identity primary key, machine text, file text, at timestamptz default now());
alter table lic_dl enable row level security;
create index if not exists lic_dl_m on lic_dl(machine, at);

create or replace function lic_trial_days() returns int language sql stable security definer set search_path=public as $$
  select coalesce(nullif((select data->>'trialDays' from site where id=2),'')::int,3) $$;

create or replace function lic_status(p_machine text,p_product text) returns json
language plpgsql security definer set search_path=public as $$
declare l licenses%rowtype; t lic_trials%rowtype; pr text:=left(coalesce(p_product,'text-pack'),40); lexp boolean:=false; d int:=lic_trial_days(); ends timestamptz;
begin
  select * into l from licenses where product=pr and status='active' and machines ? p_machine order by expires_at desc nulls first limit 1;
  if found then
    if l.expires_at is null or l.expires_at>now() then
      update licenses set last_seen=now() where id=l.id;
      return json_build_object('licensed',true,'plan',l.plan,'expires_at',l.expires_at,
        'days_left',case when l.expires_at is null then null else ceil(extract(epoch from (l.expires_at-now()))/86400) end);
    end if;
    lexp:=true;
  end if;
  select * into t from lic_trials where machine=p_machine and product=pr;
  if found then ends:=t.first_at+make_interval(days=>d); end if;
  return json_build_object('licensed',false,'license_expired',lexp,'trial_days',d,
    'trial_started',found,'trial_active',(found and ends>now()),'trial_ends_at',ends,
    'trial_days_left',case when found and ends>now() then ceil(extract(epoch from (ends-now()))/86400) else 0 end,
    'pending',exists(select 1 from lic_requests where machine=p_machine and product=pr and status='pending'));
end $$;

create or replace function lic_trial_start(p_machine text,p_product text) returns json
language plpgsql security definer set search_path=public as $$
declare pr text:=left(coalesce(p_product,'text-pack'),40);
begin
  if length(coalesce(p_machine,''))<8 or length(p_machine)>100 then raise exception 'Bad computer id.'; end if;
  if (select count(*) from lic_trials where first_at>now()-interval '1 hour')>=200 then raise exception 'Busy. Try again later.'; end if;
  insert into lic_trials(machine,product,seconds_used) values(p_machine,pr,0) on conflict (machine,product) do nothing;
  return lic_status(p_machine,pr);
end $$;

create or replace function lic_access(p_machine text,p_product text) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare pr text:=left(coalesce(p_product,'text-pack'),40);
begin
  if exists(select 1 from licenses where product=pr and status='active' and machines ? p_machine and (expires_at is null or expires_at>now())) then return true; end if;
  return exists(select 1 from lic_trials where machine=p_machine and product=pr and first_at+make_interval(days=>lic_trial_days())>now());
end $$;

create or replace function lic_file_key(p_machine text,p_product text,p_file text) returns text
language plpgsql security definer set search_path=public as $$
declare s text; pr text:=left(coalesce(p_product,'text-pack'),40);
begin
  if not lic_access(p_machine,pr) then raise exception 'Access ended. Start the trial or unlock first.'; end if;
  if p_file !~ '^p[0-9]{2,3}$' then raise exception 'Bad file.'; end if;
  insert into lic_dl(machine,file) values(p_machine,p_file);
  if (select count(*) from lic_dl where machine=p_machine and at>now()-interval '1 hour')>60 then raise exception 'Too many downloads. Try again later.'; end if;
  select secret into s from lic_secrets where product=pr;
  if s is null then raise exception 'Not set up yet.'; end if;
  return encode(extensions.hmac(p_file,s,'sha256'),'hex');
end $$;

grant execute on function lic_trial_days() to anon, authenticated;
grant execute on function lic_status(text,text) to anon, authenticated;
grant execute on function lic_trial_start(text,text) to anon, authenticated;
grant execute on function lic_file_key(text,text,text) to anon, authenticated;
notify pgrst, 'reload schema';
