-- Chorus, phase 1: choruses + clips, row-level security, private storage bucket.
-- Paste into the Supabase SQL editor and run once.

create extension if not exists pgcrypto;

create table if not exists public.choruses (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  recipient_name text not null,
  occasion       text not null,
  opens_at       timestamptz not null,
  created_at     timestamptz not null default now()
);

create table if not exists public.clips (
  id               uuid primary key default gen_random_uuid(),
  chorus_id        uuid not null references public.choruses(id) on delete cascade,
  contributor_name text not null
                   check (char_length(btrim(contributor_name)) between 1 and 40),
  storage_path     text not null unique,
  duration_seconds numeric(6,2) not null
                   check (duration_seconds > 0 and duration_seconds <= 600),
  mime_type        text not null,
  created_at       timestamptz not null default now()
);

create index if not exists clips_chorus_id_idx on public.clips (chorus_id);

alter table public.choruses enable row level security;
alter table public.clips    enable row level security;

-- Anyone holding the link can read a chorus. Nothing in this table is secret.
drop policy if exists "anon can read choruses" on public.choruses;
create policy "anon can read choruses"
  on public.choruses for select
  to anon, authenticated
  using (true);

-- Anyone can leave a clip for a chorus that exists. No anonymous SELECT policy,
-- so nobody without the service role can read clips back.
drop policy if exists "anon can insert clips" on public.clips;
create policy "anon can insert clips"
  on public.clips for insert
  to anon, authenticated
  with check (
    exists (select 1 from public.choruses c where c.id = chorus_id)
    and storage_path like chorus_id::text || '/%'
  );

-- Storage: private bucket. Anonymous users may upload under <chorus_id>/...
-- and may never read, list, overwrite, or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clips', 'clips', false, 26214400,
  array[
    'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/mpeg',
    'audio/aac', 'audio/wav', 'audio/x-m4a', 'audio/3gpp'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anon can upload clips" on storage.objects;
create policy "anon can upload clips"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'clips'
    and exists (
      select 1 from public.choruses c
      where c.id::text = (storage.foldername(name))[1]
    )
  );
