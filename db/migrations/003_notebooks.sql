-- Phase 4: ノートブック（notebooks）+ RLS
-- Supabase ダッシュボード → SQL Editor に貼り付けて Run で実行する。
-- DDL は docs/01_claude_code_実装指示書.md §3.1、RLS は §3.3 に準拠。

create table notebooks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index notebooks_user_idx on notebooks (user_id);

alter table notebooks enable row level security;

create policy "notebooks_select_own" on notebooks
  for select using (user_id = (select auth.uid()));
create policy "notebooks_insert_own" on notebooks
  for insert with check (user_id = (select auth.uid()));
create policy "notebooks_update_own" on notebooks
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "notebooks_delete_own" on notebooks
  for delete using (user_id = (select auth.uid()));
