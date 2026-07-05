-- Phase 5: 問題（problems）と成績履歴（problem_reviews）+ RLS
-- Supabase ダッシュボード → SQL Editor に貼り付けて Run で実行する。
-- DDL は docs/01_claude_code_実装指示書.md §3.1、RLS は §3.3 に準拠。

-- 問題（1手当て）
create table problems (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  notebook_id             uuid not null references notebooks(id) on delete cascade,
  node_id                 uuid not null references nodes(id) on delete cascade, -- 出題局面
  answer_move_usi         text,          -- 正解の手（単一指定の場合）
  accept_any_child        boolean not null default false, -- true: 木にある子の手ならどれでも正解
  explanation_text        text,          -- 解説文
  explanation_from_node_id uuid references nodes(id) on delete set null, -- 局面再生の起点
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index problems_notebook_idx on problems (notebook_id);
create index problems_user_idx on problems (user_id);
create index problems_node_idx on problems (node_id);

-- 成績履歴 / 復習状態（1問1行, SRS は後付け用に列だけ用意）
create table problem_reviews (
  problem_id       uuid primary key references problems(id) on delete cascade,
  attempts         int not null default 0,
  correct_count    int not null default 0,
  wrong_count      int not null default 0,
  last_result      text,          -- 'correct' | 'wrong'
  last_reviewed_at timestamptz,
  -- 以下 SRS 用（MVPでは未使用, null許容）
  srs_ease         real,
  srs_interval_days int,
  srs_due_at       timestamptz
);

alter table problems enable row level security;
alter table problem_reviews enable row level security;

create policy "problems_select_own" on problems
  for select using (user_id = (select auth.uid()));
create policy "problems_insert_own" on problems
  for insert with check (user_id = (select auth.uid()));
create policy "problems_update_own" on problems
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "problems_delete_own" on problems
  for delete using (user_id = (select auth.uid()));

-- problem_reviews は所属する problem の所有者で判定する
create policy "problem_reviews_select_own" on problem_reviews
  for select using (
    exists (
      select 1 from problems p
      where p.id = problem_reviews.problem_id and p.user_id = (select auth.uid())
    )
  );
create policy "problem_reviews_insert_own" on problem_reviews
  for insert with check (
    exists (
      select 1 from problems p
      where p.id = problem_reviews.problem_id and p.user_id = (select auth.uid())
    )
  );
create policy "problem_reviews_update_own" on problem_reviews
  for update using (
    exists (
      select 1 from problems p
      where p.id = problem_reviews.problem_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from problems p
      where p.id = problem_reviews.problem_id and p.user_id = (select auth.uid())
    )
  );
create policy "problem_reviews_delete_own" on problem_reviews
  for delete using (
    exists (
      select 1 from problems p
      where p.id = problem_reviews.problem_id and p.user_id = (select auth.uid())
    )
  );
