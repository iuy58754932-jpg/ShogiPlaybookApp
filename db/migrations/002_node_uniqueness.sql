-- Phase 2 追補: ノードの一意性制約
-- コードレビューで確定した2つのデータ破損経路を DB レベルで遮断する。
-- 001 と同様、Supabase ダッシュボード → SQL Editor に貼り付けて Run で実行する。

-- 1) 根ノード（parent_id が null）はツリーにつき1つだけ
--    （読込時の自己修復が競合しても2つ目の根は作れない）
create unique index nodes_one_root_per_tree
  on nodes (tree_id)
  where parent_id is null;

-- 2) 同じ親に同じ手（move_usi）の子は1つだけ
--    （保存失敗後のリトライ等で重複分岐ができない）
create unique index nodes_unique_move_per_parent
  on nodes (parent_id, move_usi)
  where parent_id is not null;
