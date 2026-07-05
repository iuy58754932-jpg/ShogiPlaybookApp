import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { SetupNotice } from './pages/SetupNotice'
import { supabase } from './lib/supabase'

// 盤・木・演習まわりは重い（shogiops を含む）ため、ルート単位で遅延読込する
const BoardPage = lazy(() =>
  import('./pages/BoardPage').then((m) => ({ default: m.BoardPage })),
)
const TreesPage = lazy(() =>
  import('./pages/TreesPage').then((m) => ({ default: m.TreesPage })),
)
const TreeEditorPage = lazy(() =>
  import('./pages/TreeEditorPage').then((m) => ({ default: m.TreeEditorPage })),
)
const NotebooksPage = lazy(() =>
  import('./pages/NotebooksPage').then((m) => ({ default: m.NotebooksPage })),
)
const NotebookDetailPage = lazy(() =>
  import('./pages/NotebookDetailPage').then((m) => ({
    default: m.NotebookDetailPage,
  })),
)
const ProblemNewPage = lazy(() =>
  import('./pages/ProblemNewPage').then((m) => ({ default: m.ProblemNewPage })),
)
const StudyPage = lazy(() =>
  import('./pages/StudyPage').then((m) => ({ default: m.StudyPage })),
)

function App() {
  if (!supabase) {
    return <SetupNotice />
  }
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppErrorBoundary>
        <Suspense fallback={<p className="screen-message">読み込み中…</p>}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/board" element={<BoardPage />} />
              <Route path="/trees" element={<TreesPage />} />
              <Route path="/trees/:treeId" element={<TreeEditorPage />} />
              <Route path="/notebooks" element={<NotebooksPage />} />
              <Route
                path="/notebooks/:notebookId"
                element={<NotebookDetailPage />}
              />
              <Route
                path="/notebooks/:notebookId/new"
                element={<ProblemNewPage />}
              />
              <Route
                path="/notebooks/:notebookId/study"
                element={<StudyPage />}
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </AppErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
