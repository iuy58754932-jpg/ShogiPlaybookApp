export function SetupNotice() {
  return (
    <div className="screen">
      <div className="card">
        <h1 className="app-title">定跡ツリー</h1>
        <p className="app-subtitle">Supabase が未設定です</p>
        <div className="setup-steps">
          <p>アプリを使うには Supabase の接続情報を設定してください。</p>
          <ol>
            <li>
              プロジェクト直下の <code>.env.example</code> をコピーして{' '}
              <code>.env</code> を作成する
            </li>
            <li>
              <code>VITE_SUPABASE_URL</code> と{' '}
              <code>VITE_SUPABASE_ANON_KEY</code> に Supabase プロジェクトの
              URL と anon キーを設定する
            </li>
            <li>
              開発サーバーを再起動する（<code>npm run dev</code>）
            </li>
          </ol>
          <p className="setup-note">
            ※ anon キーのみを使用してください。service_role キーは絶対にフロントに
            置かないこと。
          </p>
        </div>
      </div>
    </div>
  )
}
