import React, { useMemo, useState } from "react";
import { ApiError, Chip, Pagination, Tanstack, Button, Icon, ScrollShadow, Description, Router, toast, useApi } from "@nextticket-frontend/commons";
import type { SortDescriptor, Key } from "@nextticket-frontend/commons";
import type { Venue } from "./types/venue";
import { ModalToggleVenueStatus } from "./components/ModalToggleVenueStatus";

export type { Venue };

type ChipColor = "default" | "success" | "warning" | "danger" | "accent";

const statusMap: Record<string, { label: string; color: ChipColor; icon: React.ReactNode }> = {
  ACTIVE: { label: "Activo", color: "success", icon: <Icon.Check /> },
  INACTIVE: { label: "Inactivo", color: "danger", icon: <Icon.Minus /> },
  UNDER_MAINTENANCE: { label: "Mantenimiento", color: "warning", icon: <Icon.Wrench /> },
  REMOVED: { label: "Eliminado", color: "danger", icon: <Icon.X /> },
  DRAFT: { label: "Borrador", color: "accent", icon: <Icon.Pen /> },
};

/** Tono determinístico a partir del id, para que cada recinto tenga su propia
 *  "portada" de color (el backend no guarda fotos de recintos). */
function hueFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 360;
  return hash;
}

/** Vista previa tipo plano de piso: bloques abstractos sobre un degradado de
 *  color propio del recinto, a falta de una imagen real. */
function VenuePreview({ id }: { id: string }) {
  const hue = hueFromId(id);
  return (
    <div
      className="absolute inset-0"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 65% 42%) 0%, hsl(${(hue + 40) % 360} 65% 30%) 100%)` }}
    >
      <svg viewBox="0 0 100 56" preserveAspectRatio="none" className="absolute inset-0 w-full h-full opacity-25">
        <rect x="4" y="6" width="34" height="20" rx="2" fill="white" />
        <rect x="42" y="6" width="22" height="20" rx="2" fill="white" />
        <rect x="4" y="30" width="58" height="20" rx="2" fill="white" />
        <rect x="68" y="6" width="28" height="44" rx="2" fill="white" />
      </svg>
    </div>
  );
}

// --- TanStack Column Definitions (Kept for sorting/logic) ---
const columnHelper = Tanstack.createColumnHelper<Venue>();

const columns = [
  columnHelper.accessor("name", { header: "Nombre" }),
  columnHelper.accessor("address", { header: "Dirección" }),
  columnHelper.accessor("city", { header: "Ciudad" }),
  columnHelper.accessor("state", { header: "Estado" }),
  columnHelper.accessor("total_capacity", { header: "Capacidad" }),
  columnHelper.accessor("createdAt", { header: "Fecha de creación" }),
  columnHelper.accessor("status", { header: "Estado" }),
];

export function VenuesTable({
  venues,
  loading,
  onRefetch,
  statusFilter,
  stateFilter,
  capacityFilter,
  sorting = []
}: {
  venues: Venue[],
  loading: boolean,
  onRefetch: () => void,
  statusFilter?: Key[],
  stateFilter?: Key[],
  capacityFilter?: number[],
  sorting?: { id: string, desc: boolean }[]
}) {
  const navigate = Router.useNavigate();
  const api = useApi();
  // Solo cambia cuántas cards se ven antes de paginar, no su tamaño — por
  // eso no hay un selector para esto, queda fijo.
  const PAGE_SIZE = 8;
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE });

  const [toggleOpen, setToggleOpen] = useState(false);
  const [venueToToggle, setVenueToToggle] = useState<Venue | null>(null);

  const filteredVenues = useMemo(() => {
    let result = venues;
    if (statusFilter && statusFilter.length > 0) {
      result = result.filter(v => statusFilter.includes(v.status));
    }
    if (stateFilter && stateFilter.length > 0) {
      result = result.filter(v => {
        const normalizedState = v.state === "CDMX" ? "Ciudad de México" : v.state;
        return stateFilter.includes(normalizedState);
      });
    }
    if (capacityFilter && capacityFilter.length === 2) {
      result = result.filter(v => {
        const isWithinMin = v.total_capacity >= capacityFilter[0];
        const isWithinMax = capacityFilter[1] === 100000 ? true : v.total_capacity <= capacityFilter[1];
        return isWithinMin && isWithinMax;
      });
    }
    return result;
  }, [venues, statusFilter, stateFilter, capacityFilter]);

  const table = Tanstack.useReactTable({
    columns,
    data: filteredVenues,
    getCoreRowModel: Tanstack.getCoreRowModel(),
    getPaginationRowModel: Tanstack.getPaginationRowModel(),
    getSortedRowModel: Tanstack.getSortedRowModel(),
    onPaginationChange: setPagination,
    state: { sorting, pagination },
  });

  const { pageIndex } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  const start = filteredVenues.length === 0 ? 0 : pageIndex * pagination.pageSize + 1;
  const end = Math.min((pageIndex + 1) * pagination.pageSize, filteredVenues.length);

  const openToggleStatus = (venue: Venue) => {
    setVenueToToggle(venue);
    setToggleOpen(true);
  };

  const confirmToggleStatus = () => {
    if (!venueToToggle) return;
    const nextStatus = venueToToggle.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    api
      .patch(`/venues/${venueToToggle.id}`, { status: nextStatus })
      .then(() => {
        toast.success(nextStatus === "ACTIVE" ? "Recinto activado" : "Recinto desactivado");
        onRefetch();
      })
      .catch((err) => toast.danger(err instanceof ApiError ? err.message : "No se pudo actualizar el estado"));
  };

  if (loading) {
    return <p className="text-muted text-xs py-16 text-center">Cargando recintos...</p>;
  }

  return (
    <div className="flex flex-col h-full gap-4 relative">

      <ScrollShadow className="flex-1 overflow-auto">
        {filteredVenues.length === 0 ? (
          <p className="text-muted text-xs py-16 text-center">No hay recintos que coincidan con los filtros.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-2 gap-y-3">
            {table.getRowModel().rows.map((row) => {
              const venue = row.original;
              const status = statusMap[venue.status];
              const isActive = venue.status === "ACTIVE";

              return (
                <div
                  key={venue.id}
                  className="text-left w-full rounded-3xl bg-surface flex flex-col transition-all duration-300 group shadow-surface hover:shadow-lg"
                >
                  {/* Vista previa — el backend no guarda imágenes del recinto */}
                  <div className="w-full h-28 rounded-2xl relative shrink-0 overflow-hidden">
                    <VenuePreview id={venue.id} />
                    <Chip size="sm" className="absolute top-4 left-4 z-10">
                      {venue.floorsCount} {venue.floorsCount === 1 ? "Piso" : "Pisos"}
                    </Chip>
                    {/* stopPropagation en el wrapper: evita que el clic también navegue al Editar de la card */}
                    <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        isIconOnly
                        variant="tertiary"
                        color={isActive ? "danger" : "success"}
                        onPress={() => openToggleStatus(venue)}
                      >
                        {isActive ? <Icon.Minus /> : <Icon.Check />}
                      </Button>
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="p-4 flex flex-col justify-between flex-1">

                    <div className="flex gap-2 justify-between items-end">
                      <h4 className="line-clamp-1">{venue.name}</h4>
                      <Chip size="sm" variant="soft" color={status.color} className="h-fit">
                        {status.icon}
                        {status.label}
                      </Chip>
                    </div>

                    <Description className="pb-4">
                      <Icon.MapPin />{venue.city}, {venue.state}
                    </Description>

                    <ScrollShadow className="flex gap-1 pr-0 pb-6" orientation="horizontal" hideScrollBar>
                      <Chip size="sm" variant="soft">{venue.total_capacity.toLocaleString("es-MX")} Lugares</Chip>
                      <Chip size="sm" variant="soft">{venue.floorsCount} {venue.floorsCount === 1 ? "Piso" : "Pisos"}</Chip>
                      <Chip size="sm" variant="soft">{venue.sectionsCount} Secciones</Chip>
                    </ScrollShadow>
                    <Button fullWidth onPress={() => navigate(`/venues/${venue.id}/edit`)}>
                      <Icon.SquarePen />
                      Editar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollShadow>

      <div className="shrink-0 flex justify-center md:justify-between items-center flex-wrap gap-4">
        <Pagination size="sm">
          <Pagination.Summary>
            <div className="flex items-center gap-4">
              <span className="text-muted">
                <span className="text-foreground font-medium">{start}</span> al{" "}
                <span className="text-foreground font-medium">{end}</span> de{" "}
                <span className="text-foreground font-medium">{filteredVenues.length}</span> resultados
              </span>
            </div>
          </Pagination.Summary>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous
                isDisabled={!table.getCanPreviousPage()}
                onPress={() => table.previousPage()}
              >
                <Pagination.PreviousIcon />
                Anterior
              </Pagination.Previous>
            </Pagination.Item>
            {pages.map((p) => (
              <Pagination.Item key={p}>
                <Pagination.Link
                  isActive={p === pageIndex + 1}
                  onPress={() => table.setPageIndex(p - 1)}
                >
                  {p}
                </Pagination.Link>
              </Pagination.Item>
            ))}
            <Pagination.Item>
              <Pagination.Next
                isDisabled={!table.getCanNextPage()}
                onPress={() => table.nextPage()}
              >
                Siguiente
                <Pagination.NextIcon />
              </Pagination.Next>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      </div>

      <ModalToggleVenueStatus
        open={toggleOpen}
        onClose={() => setToggleOpen(false)}
        onConfirm={confirmToggleStatus}
        venueName={venueToToggle?.name}
        isActive={venueToToggle?.status === "ACTIVE"}
      />
    </div>
  );
}
