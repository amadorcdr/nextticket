import { Button, Router } from "@nextticket-frontend/commons";

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
    </Router.Routes>
  );
}