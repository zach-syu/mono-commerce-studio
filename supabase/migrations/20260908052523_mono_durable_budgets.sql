-- Shared budgets bind public demo persistence across tokens and Edge isolates.
create table public.mono_usage_budgets (
  bucket text primary key check (length(bucket) between 1 and 128),
  used bigint not null default 0 check (used >= 0),
  updated_at timestamptz not null default now()
);
alter table public.mono_usage_budgets enable row level security;
revoke all on public.mono_usage_budgets from public, anon, authenticated;
grant select, insert, update, delete on public.mono_usage_budgets to service_role;

create function public.mono_consume_budget(p_bucket text, p_amount bigint, p_limit bigint)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare consumed bigint;
begin
  if p_amount <= 0 or p_limit <= 0 or p_amount > p_limit or length(p_bucket) not between 1 and 128 then
    return false;
  end if;
  insert into public.mono_usage_budgets as budget (bucket, used)
  values (p_bucket, p_amount)
  on conflict (bucket) do update
    set used = budget.used + p_amount, updated_at = now()
    where budget.used + p_amount <= p_limit
  returning used into consumed;
  return consumed is not null;
end;
$$;
revoke all on function public.mono_consume_budget(text,bigint,bigint) from public, anon, authenticated;
grant execute on function public.mono_consume_budget(text,bigint,bigint) to service_role;
