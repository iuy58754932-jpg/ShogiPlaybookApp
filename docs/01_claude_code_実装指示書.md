# 定跡ツリー — 実装指示書（Claude Code 向け）

> この文書は、Claude Code（Fable 5）に実装を依頼するための指示書です。
> そのまま渡して着手できるよう、技術構成・データモデル・機能・受け入れ条件・推奨ビルド順をまとめています。
> アプリ名「定跡ツリー」は仮称です。

---

## 0. ゴール（1行）

将棋の「定跡を作る」「仕掛けが成立する局面を記録する」「記憶用の問題集を作る」の3つを、**局面ノードを手でつないだ1つの木**に集約するPWAを作る。スマホ・PC両対応、ログイン＋クラウド同期。

---

## 1. 技術スタック

| 領域 | 採用 | 備考 |
|---|---|---|
| フロント | React + TypeScript + Vite | SPA |
| PWA化 | `vite-plugin-pwa` | manifest + service worker |
| 将棋ルール | `shogiops` | 合法手・打ち駒の生成、妥当性チェック、SFEN/USI 入出力。ライセンス GPL-3.0 |
| 盤UI | React 自作（9×9グリッド＋駒コンポーネント） | ライブラリには依存しない |
| バックエンド | Supabase | Postgres ＋ Auth ＋ Row Level Security（RLS） |
| ホスティング | Vercel / Netlify / Cloudflare Pages のいずれか | 無料枠 |
| パッケージ管理 | pnpm（または npm） | |

補足:
- `shogiops` は「純粋なルールエンジン」としてのみ使う（局面計算・合法手列挙・SFEN）。木・問題・ノートブックのデータ構造はアプリ側で持ち、Supabase に保存する。
- 盤の描画・タップ操作・ハイライトは自作する。将来 UI を省力化したくなったら `shogiground` を検討する余地はあるが、MVP では自作でよい。

---

## 2. アーキテクチャ

- クライアントは PWA（SPA）。Supabase JS SDK で認証と DB アクセスを行う。
- 認証は Supabase Auth（メール＋パスワード、またはマジックリンク）。
- データはすべてユーザー単位。**RLS で「自分の行だけ見える」**を強制する。
- **同期モデルはクラウドを正とする。** 単一ユーザーが複数端末（スマホ・PC）で使う前提なので、競合解決は last-write-wins で十分。
- オフラインは service worker によるアプリシェルのキャッシュまで。データ操作はオンライン前提とし、本格的なオフライン同期・競合解決は MVP の対象外。

---

## 3. データモデル（Supabase / Postgres）

「1手＝1ノード」の木構造。各ノードは自分に至る手・その局面（SFEN）・親を持つ。分岐は「同じ `parent_id` を持つ複数ノード」で表現する。

### 3.1 テーブル

```sql
-- 定跡ツリー
create table trees (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,              -- 例: "四間飛車"
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

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

-- ノートブック
create table notebooks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

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

-- 成績履歴 / 復習状態（1問1行, SRSは後付け用に列だけ用意）
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
```

### 3.2 正解判定のルール
- `accept_any_child = false` の場合: プレイヤーの手が `answer_move_usi` と一致すれば正解。
- `accept_any_child = true` の場合: 出題ノードの子ノードいずれかの `move_usi` と一致すれば正解（分岐がある局面で「木にある手ならOK」とする用途）。

### 3.3 RLS（Row Level Security）
- すべてのテーブルで RLS を有効化。
- `trees` / `notebooks` / `problems` / `problem_reviews`: `user_id = auth.uid()` の行のみ select/insert/update/delete 可。`problem_reviews` は所属する problem の user_id で判定。
- `nodes`: 直接 `user_id` を持たないため、所属する `tree` の所有者で判定する（`tree_id` の trees.user_id = auth.uid()）。ポリシーは `exists (select 1 from trees t where t.id = nodes.tree_id and t.user_id = auth.uid())` の形で書く。

---

## 4. 機能（MVP）

- **盤面と駒**: 9×9盤・持ち駒台の描画。駒のタップ選択→移動。成る／不成の選択。持ち駒を打つ。
- **合法手ハイライト**: `shogiops` で現局面の合法手を列挙し、選択駒の移動可能マス（打てるマス）を塗る。二歩・行き所のない駒（歩・香の最上段、桂の上2段）・打ち歩詰め・王手放置などの反則手は、合法手生成の時点で除外される。
- **木の編集**: 現在ノードで手を指すと、既存の子ノードに一致すればそのノードへ移動、なければ**新規子ノードを作成（＝分岐）**。
- **分岐ラベル・コメント**: 任意のノードに戦法名/分岐名・コメントを付与。
- **樹形図ビュー**: `nodes` を `parent_id` でツリー化して描画。ノードをタップすると盤面をその局面へ。**樹形図⇔盤面の表示切替**。
- **ノートブック（CRUD）**: 作成・一覧・編集・削除。
- **問題作成**: 木の任意ノードを「出題局面」として問題を作る。正解は単一手 or「木にある子の手ならOK」。解説文と、局面再生の起点ノードを設定できる。
- **問題演習**: 出題→1手回答→正誤判定→解説（符号表示＋起点からの局面再生）。**間違えた問題はセッションのプールに戻して再挑戦**。結果を `problem_reviews` に加算。
- **認証**: サインアップ／ログイン／ログアウト。ログイン中のみアプリ本体にアクセス可能。
- **PWA**: インストール可能（manifest, アイコン）。アプリシェルのオフラインキャッシュ。

---

## 5. 画面と想定ルート

| 画面 | ルート例 | 内容 |
|---|---|---|
| ログイン | `/login` | サインアップ／ログイン |
| ツリー一覧 | `/trees` | 定跡ツリーの一覧・新規作成 |
| ツリー編集 | `/trees/:treeId` | 盤面で手を指して木を育てる。分岐ラベル・コメント付与 |
| 樹形図 | `/trees/:treeId/graph` | 木を俯瞰。ノードタップで盤面へ。盤面⇔樹形図トグル |
| ノートブック一覧 | `/notebooks` | ノートブックの CRUD |
| 問題作成 | `/notebooks/:id/new` | 木のノードから問題を作る |
| 問題演習 | `/notebooks/:id/study` | 1手当て→正誤→解説→再挑戦 |

※ ルートは目安。実装しやすい構成に調整してよい。

---

## 6. 実装の要点

- **SFEN を局面の一意キーとして使う。** ノードの同一性・重複検出に利用。
- **合法手ハイライト**: `shogiops` の合法手・打ち駒生成を用い、選択中の駒（または打とうとしている駒種）に対応する移動先マスだけをハイライトする。
- **成り**: 成れる手では成／不成をユーザーに選ばせる。強制成り（行き所のない駒になる手）は自動で成りに確定。
- **打ち駒**: 打てるマスも合法手生成から得る（反則マスは自動的に除外される）。
- **解説の局面再生**: 解説はフリーテキスト（符号可）＋「再生の起点ノード」を持つ。再生は起点ノードから木の経路（子をたどる）をミニ盤でステップ表示する。**自由入力した符号文字列をパースして再生する方式は採らない**（棋譜フォーマット解析の沼を避ける）。
- **再挑戦**: 演習セッション内で、間違えた問題をプールに戻し、正解するまで／セッション終了まで再出題する。
- **SRS は MVP では未実装。** `problem_reviews` の `srs_*` 列は用意するだけで、スケジューリングロジックは書かない。
- **PWA**: `vite-plugin-pwa` で manifest（name, short_name, icons, theme_color, display: standalone）と service worker を設定。アプリシェルをキャッシュ。

---

## 7. 受け入れ条件（MVP の Definition of Done）

- [ ] サインアップ／ログイン／ログアウトができ、ログイン中のみアプリ本体にアクセスできる。
- [ ] 平手初期局面から駒を動かして手を指せ、合法手のみ受理される（反則手は選べない／弾かれる）。
- [ ] 成り／不成の選択、持ち駒を打つ操作ができる。
- [ ] 手を指すと木にノードが追加され、別の手を指すと分岐が作られる。
- [ ] ノードに分岐ラベル・コメントを付けられる。
- [ ] 樹形図で木全体を俯瞰でき、ノードタップで盤面がその局面に移動する。盤面⇔樹形図を切り替えられる。
- [ ] ツリー・ノード・ノートブック・問題が Supabase に保存され、別端末でログインすると同じデータが見える。
- [ ] ノートブックを作成・編集・削除できる。
- [ ] 木のノードから問題を作成でき、単一正解／「子ならどれでも正解」を設定できる。
- [ ] 演習で出題→回答→正誤→解説（符号＋局面再生）が動き、間違えた問題を再挑戦できる。
- [ ] 演習結果が `problem_reviews` に記録される。
- [ ] PWA としてインストールでき、オフラインでアプリシェルが表示される。
- [ ] RLS により、他ユーザーの行にアクセスできない。

---

## 8. スコープ外（MVP では作らない）

- 局面編集（空盤からの自由配置）※初期局面から手を指して到達する
- SRS 本体（忘却曲線に沿った復習スケジューリング）※データ列だけ用意
- 棋譜の KIF/CSA 等の入出力
- 他ユーザーとのデータ共有（対象は自分の複数端末のみ）
- 対局・検討（エンジン連携）機能

---

## 9. 推奨ビルド順（フェーズ）

- **Phase 0 — 雛形**: Vite + React + TS、`vite-plugin-pwa`、Supabase クライアント、認証（ログイン画面と保護ルート）。
- **Phase 1 — 盤と駒**: `shogiops` 統合。初期局面の表示、駒操作、合法手ハイライト、成り／不成、持ち駒を打つ。
- **Phase 2 — 木の編集と永続化**: 手を指す→ノード追加、分岐、ラベル／コメント、Supabase への保存・読込。
- **Phase 3 — 樹形図と表示切替**: nodes をツリー描画、ノードタップで盤面移動、盤面⇔樹形図トグル。
- **Phase 4 — ノートブック**: CRUD。
- **Phase 5 — 問題と演習**: 問題作成、出題→回答→正誤→解説→局面再生、プール再挑戦、成績記録。
- **Phase 6 — PWA 仕上げ**: インストール可能化、アイコン、オフラインキャッシュ、細部の調整。

各フェーズ完了時に、その時点で動く状態を保つ（インクリメンタルに）。

---

## 付録: shogiops メモ

- import 例（README を正とすること。API はバージョンで変わり得る）:
  ```ts
  import { initialSfen, parseSfen } from 'shogiops/sfen';
  import type { Rules } from 'shogiops/types';
  import { parseUsi } from 'shogiops/util';

  const rules: Rules = 'standard';
  const sfen = initialSfen(rules);
  const pos = parseSfen(rules, sfen).unwrap();
  const move = parseUsi('7g7f')!;
  pos.play(move);
  ```
- 合法手・打ち駒の列挙、妥当性チェック、USI/日本語/SFEN/KIF/CSA の入出力に対応。**まず最新の README とテストディレクトリの使用例を確認してから実装する。**
- ライセンスは GPL-3.0-or-later。個人アプリでの利用は問題ないが、配布形態を変える場合はライセンスに留意する。
