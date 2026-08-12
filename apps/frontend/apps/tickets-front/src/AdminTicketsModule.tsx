import { Router } from "@nextticket-frontend/commons";
import { AdminTicketsOverview } from "./pages/AdminTicketsOverview";
import { AdminEventTicketsDetail } from "./pages/AdminEventTicketsDetail";

export function AdminTicketsModule() {
    return (
        <Router.Routes>
            <Router.Route index element={<AdminTicketsOverview />} />
            <Router.Route path=":eventId" element={<AdminEventTicketsDetail />} />
        </Router.Routes>
    );
}
