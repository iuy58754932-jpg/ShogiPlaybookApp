import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/auth-context'

export function HomePage() {
  const { session } = useAuth()
  const [signOutError, setSignOutError] = useState<string | null>(null)

  async function handleSignOut() {
    setSignOutError(null)
    // scope: 'local' — この端末だけログアウトする（既定の 'global' は全端末を落とす）
    const { error } = (await supabase?.auth.signOut({ scope: 'local' })) ?? {}
    // サーバー側の signOut が失敗するとローカルセッションは残ったままになる
    // （SIGNED_OUT が発火しない）ため、無言にせずエラーを表示する
    if (error) {
      setSignOutError(
        'ログアウトに失敗しました。通信環境を確認して、もう一度お試しください。',
      )
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>定跡ツリー</h1>
        <div className="header-right">
          <span className="user-email">{session?.user.email}</span>
          <button type="button" className="button-secondary" onClick={handleSignOut}>
            ログアウト
          </button>
        </div>
      </header>
      <main className="app-main">
        {signOutError && <p className="message message-error">{signOutError}</p>}
        <p>
          Phase 2 まで実装済みです。ノートブック（Phase 4）はこれから入ります。
        </p>
        <div className="home-links">
          <Link to="/trees" className="button-link">
            定跡ツリー
          </Link>
          <Link to="/board" className="button-link button-link-secondary">
            盤面（練習）
          </Link>
        </div>
      </main>
    </div>
  )
}
