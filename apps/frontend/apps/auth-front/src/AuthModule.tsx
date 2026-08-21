import { Router, useApi } from "@nextticket-frontend/commons";
import { useEffect, useState } from "react";
import { DriftWall } from "@nextticket-frontend/events-front";

export function AuthModule() {
  const api = useApi();
  const [driftWallItems, setDriftWallItems] = useState<any[]>([]);

  useEffect(() => {
    api.get<any>(`/events?limit=40`)
      .then((res) => {
        const visible = res.data.filter((e: any) => e.status === "PUBLISHED" || e.status === "SOLD_OUT");
        setDriftWallItems(visible.map((event: any) => ({
          image: event.imageUrl || "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop",
          title: event.name,
          href: `/event/${event.id}`
        })));
      })
      .catch(() => { });
  }, []);

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center px-4 py-10 bg-background overflow-hidden">
      <div className="absolute inset-0 z-0">
        <DriftWall items={driftWallItems} radius={10} gap={24}
          tileWidth={240}
          tileHeight={160} direction="up" columns={7} overlayColor="transparent" dim={0.8} />
      </div>

      <div className="relative z-10 w-full flex items-center justify-center pointer-events-none">
        <Router.Outlet />
      </div>
    </div>
  );
}
