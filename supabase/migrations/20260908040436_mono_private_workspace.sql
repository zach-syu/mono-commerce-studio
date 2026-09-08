-- Independent objects for MONO. Existing application tables and Auth stay untouched.
create table public.mono_products (
  id uuid not null,
  owner_hash text not null check (owner_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_hash, id)
);
create table public.mono_jobs (
  id uuid not null,
  owner_hash text not null check (owner_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_hash, id)
);
create index mono_products_owner_updated_idx on public.mono_products(owner_hash, updated_at desc);
create index mono_jobs_owner_updated_idx on public.mono_jobs(owner_hash, updated_at desc);
alter table public.mono_products enable row level security;
alter table public.mono_jobs enable row level security;
revoke all on public.mono_products, public.mono_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.mono_products, public.mono_jobs to service_role;
-- No public policies. Only mono-api's service client accesses these rows after deriving
-- the owner from a 256-bit capability; an owner field submitted by a client is rejected.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mono-assets', 'mono-assets', false, 52428800, array['image/png','image/jpeg','image/webp','video/mp4']);
-- This bucket has no anon/authenticated object policy. Existing bucket policies are unchanged.
-- Restrictive protection also blocks any existing bucket-agnostic permissive policy.
create policy mono_assets_private_guard on storage.objects
  as restrictive for all to anon, authenticated
  using (bucket_id <> 'mono-assets')
  with check (bucket_id <> 'mono-assets');
comment on table public.mono_products is 'MONO private capability workspaces. Server access only.';
comment on table public.mono_jobs is 'MONO generation provenance and asynchronous job state. Server access only.';
