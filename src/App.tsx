import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { BoardPage } from './pages/BoardPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { NotebookDetailPage } from './pages/NotebookDetailPage'
import { NotebooksPage } from './pages/NotebooksPage'
import { ProblemNewPage } from './pages/ProblemNewPage'
import { SetupNotice } from './pages/SetupNotice'
import { StudyPage } from './pages/StudyPage'
import { TreeEditorPage } from './pages/TreeEditorPage'
import { TreesPage } from './pages/TreesPage'
import { supabase } from './lib/supabase'

function App() {
  if (!supabase) {
    return <SetupNotice />
  }
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/board" element={<BoardPage />} />
            <Route path="/trees" element={<TreesPage />} />
            <Route path="/trees/:treeId" element={<TreeEditorPage />} />
            <Route path="/notebooks" element={<NotebooksPage />} />
            <Route path="/notebooks/:notebookId" element={<NotebookDetailPage />} />
            <Route path="/notebooks/:notebookId/new" element={<ProblemNewPage />} />
            <Route path="/notebooks/:notebookId/study" element={<StudyPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
