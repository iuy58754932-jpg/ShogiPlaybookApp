# 定跡ツリー（ShogiPlaybookApp）

将棋の定跡・問題集アプリ（PWA）。定跡を「局面ノードを手でつないだ1つの木」として育て、
仕掛けが成立する局面を記録し、1手当ての問題集にして反復学習する。

詳細仕様は [docs/01_claude_code_実装指示書.md](docs/01_claude_code_実装指示書.md)（実装の正）と
[docs/03_エンジニア向け仕様書.md](docs/03_エンジニア向け仕様書.md) を参照。

## 技術スタック

- React + TypeScript + Vite（PWA: vite-plugin-pwa）
- 将棋ルール: [shogiops](https://github.com/WandererXII/shogiops)（GPL-3.0）— 合法手・SFEN/USI
- 盤 UI: 自作（9×9 グリッド + 持ち駒台 + 樹形図 SVG）
- バックエンド: Supabase（Postgres + Auth + RLS）

## セットアップ

```sh
npm install
copy .env.example .env   # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を設定
npm run dev
```

DB は `db/migrations/` の SQL を番号順に Supabase の SQL Editor で実行して作成する。

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 型チェック + 本番ビルド（`dist/`、SW 生成込み） |
| `npm run preview` | 本番ビルドのローカル配信 |
| `npm run lint` | oxlint |

## 注意

- `vite build` は `import.meta.env.*` をビルド時に焼き込む。**本番デプロイでは
  ホスティング側の環境変数に Supabase の URL / publishable キーを設定してからビルドすること**
  （未設定だとアプリ本体がツリーシェイクされ「設定案内画面だけ」のバンドルになる）。
- フロントに置いてよいのは publishable（anon）キーのみ。service_role / secret キーは厳禁。
