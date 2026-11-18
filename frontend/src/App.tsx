import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { RequireAuth, Spinner } from './components/ui'
import { AuthProvider, useAuth } from './lib/auth'
import { CartProvider } from './lib/cart'
import { useSettings } from './lib/hooks'
import { ToastProvider } from './lib/toast'
import Account from './pages/Account'
import { ForgotPassword, Login, Register, ResetPassword, VerifyEmail, VerifySent } from './pages/Auth'
import Blog, { PostDetail } from './pages/Blog'
import Cart, { Checkout } from './pages/Cart'
import Home from './pages/Home'
import Library, { AccessForm } from './pages/Library'
import { GiftRedeem, PaymentReturn, PaymentSimulation } from './pages/Payment'
import Shop from './pages/Shop'
import { CertificateCheck, CmsPage, Contact, Maintenance, NotFound, Search, Unsubscribe } from './pages/Static'
import Trainings, { EnrollmentTicket, TrainingDetail, TrainingEnroll } from './pages/Trainings'
import WorkDetail from './pages/WorkDetail'

// Lecteur et back-office chargés à la demande : l'accueil reste léger sur mobile.
const Reader = lazy(() => import('./pages/Reader'))
const Admin = lazy(() => import('./admin/routes'))
const OtpGate = lazy(() => import('./admin/AdminLayout').then((m) => ({ default: m.OtpGate })))

function Gate({ children }: { children: React.ReactNode }) {
  const { data } = useSettings()
  const { user } = useAuth()
  const loc = useLocation()
  const bypass = loc.pathname.startsWith('/admin') || loc.pathname.startsWith('/connexion') || user?.is_staff_role
  if (data?.maintenance_mode && !bypass) return <Maintenance message={data.maintenance_message} />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <Gate>
              <Suspense fallback={<Spinner />}>
                <Routes>
                  <Route path="/lire/:slug" element={<Reader />} />
                  <Route path="/admin/verification" element={<OtpGate />} />
                  <Route path="/admin/*" element={<Admin />} />
                  <Route element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="boutique" element={<Shop />} />
                    <Route path="livres/:slug" element={<WorkDetail />} />
                    <Route path="panier" element={<Cart />} />
                    <Route path="paiement" element={<Checkout />} />
                    <Route path="paiement/simulation" element={<RequireAuth><PaymentSimulation /></RequireAuth>} />
                    <Route path="paiement/retour" element={<RequireAuth><PaymentReturn /></RequireAuth>} />
                    <Route path="cadeau" element={<RequireAuth><GiftRedeem /></RequireAuth>} />
                    <Route path="bibliotheque" element={<RequireAuth><Library /></RequireAuth>} />
                    <Route path="acces/:slug" element={<RequireAuth><AccessForm /></RequireAuth>} />
                    <Route path="compte/formations/:id" element={<RequireAuth><EnrollmentTicket /></RequireAuth>} />
                    <Route path="compte/*" element={<RequireAuth><Account /></RequireAuth>} />
                    <Route path="blog" element={<Blog />} />
                    <Route path="blog/:slug" element={<PostDetail />} />
                    <Route path="formations" element={<Trainings />} />
                    <Route path="formations/:slug" element={<TrainingDetail />} />
                    <Route path="formations/:slug/inscription/:sessionId" element={<RequireAuth><TrainingEnroll /></RequireAuth>} />
                    <Route path="attestation/:code" element={<CertificateCheck />} />
                    <Route path="connexion" element={<Login />} />
                    <Route path="inscription" element={<Register />} />
                    <Route path="mot-de-passe" element={<ForgotPassword />} />
                    <Route path="mot-de-passe/nouveau" element={<ResetPassword />} />
                    <Route path="verifier-email" element={<VerifyEmail />} />
                    <Route path="verification-envoyee" element={<VerifySent />} />
                    <Route path="desinscription" element={<Unsubscribe />} />
                    <Route path="contact" element={<Contact />} />
                    <Route path="recherche" element={<Search />} />
                    <Route path="a-propos" element={<CmsPage pageKey="a-propos" title="À propos d'Adjougbe" />} />
                    <Route path="cgu" element={<CmsPage pageKey="cgu" title="Conditions générales" />} />
                    <Route path="confidentialite" element={<CmsPage pageKey="confidentialite" title="Confidentialité" />} />
                    <Route path="mentions-legales" element={<CmsPage pageKey="mentions-legales" title="Mentions légales" />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </Suspense>
            </Gate>
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
