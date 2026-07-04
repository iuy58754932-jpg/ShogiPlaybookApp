import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import {
  createTree,
  deleteTree,
  listTrees,
  updateTree,
} from '../lib/api/trees'
import type { TreeRow } from '../lib/db-types'

export function TreesPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [trees, setTrees] = useState<TreeRow[]>([])
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
        const rows = await listTrees()
        if (!cancelled) setTrees(rows)
      } catch {
        if (!cancelled) {
          setError(
            'ツリー一覧の読み込みに失敗しました。テーブルが未作成の場合は db/migrations/001_trees_nodes.sql を Supabase の SQL Editor で実行してください。',
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
      const tree = await createTree(
        userId,
        name.trim(),
        description.trim() === '' ? null : description.trim(),
      )
      navigate(`/trees/${tree.id}`)
    } catch {
      setError('ツリーの作成に失敗しました。')
      setCreating(false)
    }
  }

  function startEdit(tree: TreeRow) {
    setEditingId(tree.id)
    setEditName(tree.name)
    setEditDescription(tree.description ?? '')
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault()
    if (!editingId || editName.trim() === '') return
    setError(null)
    try {
      const updated = await updateTree(editingId, {
        name: editName.trim(),
        description: editDescription.trim() === '' ? null : editDescription.trim(),
      })
      setTrees((ts) => ts.map((t) => (t.id === updated.id ? updated : t)))
      setEditingId(null)
    } catch {
      setError('ツリーの更新に失敗しました。')
    }
  }

  async function handleDelete(tree: TreeRow) {
    if (
      !window.confirm(
        `「${tree.name}」を削除しますか？\nこのツリーのすべての局面（ノード）も削除されます。`,
      )
    ) {
      return
    }
    setError(null)
    try {
      await deleteTree(tree.id)
      setTrees((ts) => ts.filter((t) => t.id !== tree.id))
    } catch {
      setError('ツリーの削除に失敗しました。')
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>定跡ツリー</h1>
        <div className="header-right">
          <Link to="/" className="header-link">
            ホーム
          </Link>
        </div>
      </header>
      <main className="app-main">
        <form className="tree-form" onSubmit={handleCreate}>
          <h2>新しいツリー</h2>
          <label className="field">
            <span>名前（例: 四間飛車）</span>
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
            作成して開く
          </button>
        </form>

        {error && <p className="message message-error">{error}</p>}
        {loading && <p className="screen-message">読み込み中…</p>}
        {!loading && trees.length === 0 && !error && (
          <p className="empty-note">
            まだツリーがありません。上のフォームから作成してください。
          </p>
        )}

        <ul className="tree-list">
          {trees.map((tree) =>
            editingId === tree.id ? (
              <li key={tree.id} className="tree-card">
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
              <li key={tree.id} className="tree-card">
                <Link to={`/trees/${tree.id}`} className="tree-card-main">
                  <span className="tree-name">{tree.name}</span>
                  {tree.description && (
                    <span className="tree-description">{tree.description}</span>
                  )}
                </Link>
                <div className="tree-card-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => startEdit(tree)}
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    className="button-secondary button-danger"
                    onClick={() => handleDelete(tree)}
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
