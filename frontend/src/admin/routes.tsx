import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './AdminLayout'
import { BlogList, Moderation, PostEdit } from './Blog'
import Dashboard from './Dashboard'
import { FormEdit, FormsList } from './Forms'
import Newsletter from './Newsletter'
import Orders from './Orders'
import { Journal, Settings } from './Settings'
import { SessionDetail, TrainingEdit, TrainingsList } from './Trainings'
import { UserDetail, UsersList } from './Users'
import { WorkEdit, WorksList } from './Works'

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="oeuvres" element={<WorksList />} />
        <Route path="oeuvres/:id" element={<WorkEdit />} />
        <Route path="commandes" element={<Orders />} />
        <Route path="utilisateurs" element={<UsersList />} />
        <Route path="utilisateurs/:id" element={<UserDetail />} />
        <Route path="blog" element={<BlogList />} />
        <Route path="blog/:id" element={<PostEdit />} />
        <Route path="moderation" element={<Moderation />} />
        <Route path="formations" element={<TrainingsList />} />
        <Route path="formations/sessions/:id" element={<SessionDetail />} />
        <Route path="formations/:id" element={<TrainingEdit />} />
        <Route path="formulaires" element={<FormsList />} />
        <Route path="formulaires/:id" element={<FormEdit />} />
        <Route path="newsletter" element={<Newsletter />} />
        <Route path="pages" element={<Navigate to="/admin/parametres?onglet=pages" replace />} />
        <Route path="journal" element={<Journal />} />
        <Route path="parametres" element={<Settings />} />
      </Route>
    </Routes>
  )
}
