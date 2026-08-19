import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";
import RaceDetail from "./pages/RaceDetail";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import OrganizerProfile from "./pages/OrganizerProfile";
import OrganizerPage from "./pages/OrganizerPage";
import Account from "./pages/Account";
import Rules from "./pages/Rules";
import Cookies from "./pages/Cookies";
import AdminLayout from "./admin/AdminLayout";
import PendingRaces from "./admin/PendingRaces";
import RacesManager from "./admin/RacesManager";
import CommentsModeration from "./admin/CommentsModeration";
import UsersManager from "./admin/UsersManager";
import OrganizersManager from "./admin/OrganizersManager";

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/courses/:id" element={<RaceDetail />} />
        <Route path="/organizers/:id" element={<OrganizerPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/organizer/profile" element={<OrganizerProfile />} />
        <Route path="/account" element={<Account />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/cookies" element={<Cookies />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<PendingRaces />} />
          <Route path="races" element={<RacesManager />} />
          <Route path="comments" element={<CommentsModeration />} />
          <Route path="users" element={<UsersManager />} />
          <Route path="organizers" element={<OrganizersManager />} />
        </Route>
      </Routes>
    </>
  );
}
