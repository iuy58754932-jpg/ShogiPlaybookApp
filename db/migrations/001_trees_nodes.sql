-- Phase 2: 定跡ツリー（trees / nodes）+ RLS
-- Supabase ダッシュボード → SQL Editor に全文を貼り付けて Run で実行する。
-- DDL は docs/01_claude_code_実装指示書.md §3.1、RLS は §3.3 に準拠。
-- ポリシー内の auth.uid() は Supabase 推奨の (select auth.uid()) 形式
--（行ごとの再評価を避ける initplan 最適化）で記述している。

-- 定跡ツリー
create table trees (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,              -- 例: "四間飛車"
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index trees_user_idx on trees (user_id);

-- 局面ノード（1手=1ノード）
create table nodes (
  id           uuid primary key default gen_random_uuid(),
  tree_id      uuid not null references trees(id) on delete cascade,
  parent_id    uuid references nodes(id) on delete cascade,  -- null = 根（初期局面）
  move_usi     text,          -- このノードに至る手（USI形式, 例 "7g7f"）。根は null
  sfen         text not null, -- このノードの局面（一意キーとして利用）
  branch_label text,          -- 戦法名/分岐名（例 "急戦", "45歩早仕掛け"）。任意
  comment      text,          -- この手/局面へのコメント。任意
  created_at   timestamptz not null default now()
);
create index nodes_tree_parent_idx on nodes (tree_id, parent_id);

-- RLS: 自分の行だけ見える
alter table trees enable row level security;
alter table nodes enable row level security;

create policy "trees_select_own" on trees
  for select using (user_id = (select auth.uid()));
create policy "trees_insert_own" on trees
  for insert with check (user_id = (select auth.uid()));
create policy "trees_update_own" on trees
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "trees_delete_own" on trees
  for delete using (user_id = (select auth.uid()));

-- nodes は user_id を持たないため、所属ツリーの所有者で判定する
create policy "nodes_select_own" on nodes
  for select using (
    exists (
      select 1 from trees t
      where t.id = nodes.tree_id and t.user_id = (select auth.uid())
    )
  );
create policy "nodes_insert_own" on nodes
  for insert with check (
    exists (
      select 1 from trees t
      where t.id = nodes.tree_id and t.user_id = (select auth.uid())
    )
  );
create policy "nodes_update_own" on nodes
  for update using (
    exists (
      select 1 from trees t
      where t.id = nodes.tree_id and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from trees t
      where t.id = nodes.tree_id and t.user_id = (select auth.uid())
    )
  );
create policy "nodes_delete_own" on nodes
  for delete using (
    exists (
      select 1 from trees t
      where t.id = nodes.tree_id and t.user_id = (select auth.uid())
    )
  );
