import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./lib/AuthContext";
import Header from "./components/Header";
import DisclaimerModal from "./components/DisclaimerModal";
import AnalyticsTracker from "./components/AnalyticsTracker";
import CookieBanner from "./components/CookieBanner";
import MobileTabBar from "./components/MobileTabBar";
import { AccountPrompt } from "./mobile/ui";
import NativeBridge from "./components/NativeBridge";
import ScrollToTop from "./components/ScrollToTop";
import { NotificationsScreen } from "./mobile/NotificationSettings";
import { HomeRoute, RaceRoute, AccountRoute } from "./mobile/routes";
import EventPage from "./pages/EventPage";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import AuthCallback from "./pages/AuthCallback";
import Welcome from "./pages/Welcome";
import OrganizerProfile from "./pages/OrganizerProfile";
import OrganizerRaces from "./pages/OrganizerRaces";
import OrganizerPage from "./pages/OrganizerPage";
import Rules from "./pages/Rules";
import Cookies from "./pages/Cookies";
import SubmitRace from "./pages/SubmitRace";
import LegalPage from "./pages/LegalPage";
import cgu from "./content/cgu.md?raw";
import confidentialite from "./content/confidentialite.md?raw";
import leProjet from "./content/le-projet.md?raw";
import modeEmploi from "./content/mode-d-emploi.md?raw";
import AdminLayout from "./admin/AdminLayout";
import PendingRaces from "./admin/PendingRaces";
import RacesManager from "./admin/RacesManager";
import CommentsModeration from "./admin/CommentsModeration";
import UsersManager from "./admin/UsersManager";
import OrganizersManager from "./admin/OrganizersManager";
import RaceSubmissions from "./admin/RaceSubmissions";
import Analytics from "./admin/Analytics";
import AdminOverview from "./admin/AdminOverview";
import InstagramGenerator from "./admin/InstagramGenerator";
import ImageOptimizer from "./admin/ImageOptimizer";
import QualityFamily from "./admin/QualityFamily";
import RaceUpdates from "./admin/RaceUpdates";
import { trackVisit } from "./lib/trackVisit";

// Compte Google / Apple pas encore finalisé (rôle + CGU) → /bienvenue,
// sauf sur les pages légales qu'il doit pouvoir lire.
const ONBOARDING_FREE = ["/bienvenue", "/auth/callback", "/cgu", "/confidentialite", "/rules", "/cookies"];
function OnboardingGate() {
  const { needsOnboarding } = useAuth();
  const { pathname } = useLocation();
  if (needsOnboarding && !ONBOARDING_FREE.includes(pathname)) return <Navigate to="/bienvenue" replace />;
  return null;
}

export default function App() {
  useEffect(() => { trackVisit(); }, []);

  return (
    <>
      <Header />
      <DisclaimerModal />
      <AnalyticsTracker />
      <CookieBanner />
      <NativeBridge />
      <ScrollToTop />
      <OnboardingGate />
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/carte" element={<HomeRoute view="map" />} />
        <Route path="/ultras" element={<HomeRoute view="list" />} />
        <Route path="/courses/:id" element={<RaceRoute />} />
        <Route path="/evenements/:slug" element={<EventPage />} />
        <Route path="/organizers/:id" element={<OrganizerPage />} />
        <Route path="/notifications" element={<NotificationsScreen />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/bienvenue" element={<Welcome />} />
        <Route path="/organizer/profile" element={<OrganizerProfile />} />
        <Route path="/organizer/races" element={<OrganizerRaces />} />
        <Route path="/account" element={<AccountRoute />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/cookies" element={<Cookies />} />
        <Route path="/proposer-course" element={<SubmitRace />} />
        <Route path="/cgu" element={<LegalPage content={cgu} title="CGU — UltraRide" />} />
        <Route path="/confidentialite" element={<LegalPage content={confidentialite} title="Confidentialité — UltraRide" />} />
        <Route path="/le-projet" element={<LegalPage content={leProjet} title="Le projet — UltraRide" />} />
        <Route path="/mode-d-emploi" element={<LegalPage content={modeEmploi} title="Mode d'emploi — UltraRide" className="nowrap-first-cols" />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="a-valider" element={<PendingRaces />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="races" element={<RacesManager />} />
          <Route path="comments" element={<CommentsModeration />} />
          <Route path="users" element={<UsersManager />} />
          <Route path="organizers" element={<OrganizersManager />} />
          <Route path="submissions" element={<RaceSubmissions />} />
          <Route path="instagram" element={<InstagramGenerator />} />
          <Route path="images" element={<ImageOptimizer />} />
          <Route path="mises-a-jour" element={<RaceUpdates />} />
          <Route path="qualite/:family" element={<QualityFamily />} />
        </Route>
      </Routes>
      <MobileTabBar />
      <AccountPrompt />
    </>
  );
}
