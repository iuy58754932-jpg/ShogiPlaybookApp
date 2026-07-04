import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/auth-context'

type Mode = 'login' | 'signup'

export function LoginPage() {
  const { session, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return <p className="screen-message">読み込み中…</p>
  }
  if (session) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setError(null)
    setNotice(null)
    setSubmitting(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        // 成功時は onAuthStateChange でセッションが入り、上の <Navigate> で遷移する
        if (error) setError(error.message)
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) {
          setError(error.message)
        } else if (!data.session) {
          if (data.user?.identities?.length === 0) {
            // 登録済みメールの場合、Supabase は列挙攻撃対策として identities が
            // 空のダミーユーザーを返す（確認メールは送信されない）
            setError(
              'このメールアドレスは登録済みの可能性があります。ログインするか、パスワードをお確かめください。',
            )
          } else {
            // Confirm email が有効なプロジェクトでは session が null で返る
            setNotice(
              '確認メールを送信しました。メール内のリンクを開いて登録を完了してから、ログインしてください。',
            )
          }
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  return (
    <div className="screen">
      <div className="card">
        <h1 className="app-title">定跡ツリー</h1>
        <p className="app-subtitle">将棋の定跡・問題集アプリ</p>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>メールアドレス</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            <span>パスワード</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              minLength={6}
              required
            />
          </label>
          {error && <p className="message message-error">{error}</p>}
          {notice && <p className="message message-notice">{notice}</p>}
          <button type="submit" className="button-primary" disabled={submitting}>
            {mode === 'login' ? 'ログイン' : 'サインアップ'}
          </button>
        </form>
        <p className="mode-switch">
          {mode === 'login' ? (
            <>
              アカウントをお持ちでない方は{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => switchMode('signup')}
                disabled={submitting}
              >
                サインアップ
              </button>
            </>
          ) : (
            <>
              アカウントをお持ちの方は{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => switchMode('login')}
                disabled={submitting}
              >
                ログイン
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
