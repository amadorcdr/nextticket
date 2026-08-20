import { Router } from "@nextticket-frontend/commons";
import { UsersView } from "./pages/UsersView";
import { UserFormPage } from "./pages/UserFormPage";

export function UsersModule() {
  return (
    <Router.Routes>
      <Router.Route index element={<UsersView />} />
      <Router.Route path="new" element={<UserFormPage />} />
      <Router.Route path=":id/edit" element={<UserFormPage />} />
    </Router.Routes>
  );
}
