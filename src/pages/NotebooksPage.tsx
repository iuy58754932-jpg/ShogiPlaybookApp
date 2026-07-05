import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import {
  createNotebook,
  deleteNotebook,
  listNotebooks,
  updateNotebook,
} from '../lib/api/notebooks'
import type { NotebookRow } from '../lib/db-types'

export function NotebooksPage() {
  const { session } = useAuth()
  const [notebooks, setNotebooks] = useState<NotebookRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listNotebooks()
        if (!cancelled) setNotebooks(rows)
      } catch {
        if (!cancelled) {
          setError(
            'ノートブック一覧の読み込みに失敗しました。テーブルが未作成の場合は db/migrations/003_notebooks.sql を Supabase の SQL Editor で実行してください。',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    const userId = session?.user.id
    if (!userId || name.trim() === '') return
    setCreating(true)
    setError(null)
    try {
      const notebook = await createNotebook(
        userId,
        name.trim(),
        description.trim() === '' ? null : description.trim(),
      )
      setName('')
      setDescription('')
      // 初回読込が失敗していた場合に不完全な一覧を「正常」に見せないよう、
      // 作成成功時はサーバーから一覧を取り直す（失敗時のみ手元に追記）
      try {
        setNotebooks(await listNotebooks())
      } catch {
        setNotebooks((ns) => [notebook, ...ns])
      }
    } catch {
      setError('ノートブックの作成に失敗しました。')
    } finally {
      setCreating(false)
    }
  }

  function startEdit(notebook: NotebookRow) {
    setEditingId(notebook.id)
    setEditName(notebook.name)
    setEditDescription(notebook.description ?? '')
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault()
    if (!editingId || editName.trim() === '') return
    setError(null)
    try {
      const updated = await updateNotebook(editingId, {
        name: editName.trim(),
        description: editDescription.trim() === '' ? null : editDescription.trim(),
      })
      setNotebooks((ns) => ns.map((n) => (n.id === updated.id ? updated : n)))
      setEditingId(null)
    } catch {
      setError('ノートブックの更新に失敗しました。')
    }
  }

  async function handleDelete(notebook: NotebookRow) {
    if (
      !window.confirm(
        `「${notebook.name}」を削除しますか？\n中の問題と成績履歴もすべて削除されます。`,
      )
    ) {
      return
    }
    setError(null)
    try {
      await deleteNotebook(notebook.id)
      setNotebooks((ns) => ns.filter((n) => n.id !== notebook.id))
    } catch {
      setError('ノートブックの削除に失敗しました。')
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>ノートブック</h1>
        <div className="header-right">
          <Link to="/" className="header-link">
            ホーム
          </Link>
        </div>
      </header>
      <main className="app-main">
        <form className="tree-form" onSubmit={handleCreate}>
          <h2>新しいノートブック</h2>
          <label className="field">
            <span>名前（例: 四間飛車の仕掛け集）</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>説明（任意）</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <button type="submit" className="button-primary" disabled={creating}>
            作成
          </button>
        </form>

        {error && <p className="message message-error">{error}</p>}
        {loading && <p className="screen-message">読み込み中…</p>}
        {!loading && notebooks.length === 0 && !error && (
          <p className="empty-note">
            まだノートブックがありません。上のフォームから作成し、開いた先で
            定跡ツリーの局面から問題を作成・演習できます。
          </p>
        )}

        <ul className="tree-list">
          {notebooks.map((notebook) =>
            editingId === notebook.id ? (
              <li key={notebook.id} className="tree-card">
                <form className="tree-edit-form" onSubmit={handleUpdate}>
                  <label className="field">
                    <span>名前</span>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>説明</span>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </label>
                  <div className="tree-card-actions">
                    <button type="submit" className="button-primary">
                      保存
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setEditingId(null)}
                    >
                      キャンセル
                    </button>
                  </div>
                </form>
              </li>
            ) : (
              <li key={notebook.id} className="tree-card">
                <Link
                  to={`/notebooks/${notebook.id}`}
                  className="tree-card-main"
                >
                  <span className="tree-name">{notebook.name}</span>
                  {notebook.description && (
                    <span className="tree-description">
                      {notebook.description}
                    </span>
                  )}
                </Link>
                <div className="tree-card-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => startEdit(notebook)}
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    className="button-secondary button-danger"
                    onClick={() => handleDelete(notebook)}
                  >
                    削除
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      </main>
    </div>
  )
}
