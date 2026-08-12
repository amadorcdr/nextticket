import { Router } from "@nextticket-frontend/commons";
import { Profile } from "./components/Profile";
import { UsersView } from "./pages/UsersView";

export function UsersModule() {
  return (
    <Router.Routes>
      <Router.Route index element={<UsersView />} />
      <Router.Route path="profile" element={<Profile />} />
    </Router.Routes>
  );
}