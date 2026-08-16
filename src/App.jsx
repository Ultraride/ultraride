import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";
import RaceDetail from "./pages/RaceDetail";
import Login from "./pages/Login";
import OrganizerProfile from "./pages/OrganizerProfile";
import AdminLayout from "./admin/AdminLayout";
import PendingRaces from "./admin/PendingRaces";
import RacesManager from "./admin/RacesManager";
import CommentsModeration from "./admin/CommentsModeration";
import UsersManager from "./admin/UsersManager";

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/courses/:id" element={<RaceDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/organizer/profile" element={<OrganizerProfile />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<PendingRaces />} />
          <Route path="races" element={<RacesManager />} />
          <Route path="comments" element={<CommentsModeration />} />
          <Route path="users" element={<UsersManager />} />
        </Route>
      </Routes>
    </>
  );
}
