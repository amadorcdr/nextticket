import { Router } from "@nextticket-frontend/commons";
import { UsersView } from "./pages/UsersView";

export function UsersModule() {
  return (
    <Router.Routes>
      <Router.Route index element={<UsersView />} />
    </Router.Routes>
  );
}
