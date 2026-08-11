import { Button, Router } from "@nextticket-frontend/commons";
import { Profile } from "./components/Profile";

function UsersHome() {
  return (
    <div>
      <h1 className="bg-cyan-500">Users Module</h1>
      <Button>HeroUI Button</Button>
    </div>
  );
}

export function UsersModule() {
  return (
    <Router.Routes>
      <Router.Route index element={<UsersHome />} />
      <Router.Route path="profile" element={<Profile />} />
    </Router.Routes>
  );
}