import React, { useMemo, useState, useEffect } from "react";
import { Chip, Pagination, Tanstack, Button, Icon, Select, ListBox, ScrollShadow, Carousel, Description, Label, Separator, Router } from "@nextticket-frontend/commons";
import type { SortDescriptor, Key } from "@nextticket-frontend/commons";
import type { Venue } from "./types/venue";
import { VENUES } from "./mocks/venues";

export type { Venue };

type ChipColor = "default" | "success" | "warning" | "danger" | "accent";

const statusMap: Record<string, { label: string; color: ChipColor; icon: React.ReactNode }> = {
  ACTIVE: { label: "Activo", color: "success", icon: <Icon.Check /> },
  INACTIVE: { label: "Inactivo", color: "default", icon: <Icon.Minus /> },
  UNDER_MAINTENANCE: { label: "Mantenimiento", color: "warning", icon: <Icon.Wrench /> },
  REMOVED: { label: "Eliminado", color: "danger", icon: <Icon.X /> },
  DRAFT: { label: "Borrador", color: "accent", icon: <Icon.Pen /> },
};

const venues: Venue[] = VENUES;

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
  statusFilter,
  stateFilter,
  capacityFilter,
  sorting = []
}: {
  statusFilter?: Key[],
  stateFilter?: Key[],
  capacityFilter?: number[],
  sorting?: { id: string, desc: boolean }[]
}) {
  const navigate = Router.useNavigate();
  const [pageSize, setPageSize] = useState<Key | null>("8");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 8 });
  const [activeFloors, setActiveFloors] = useState<Record<string, number>>({});

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageSize: Number(pageSize), pageIndex: 0 }));
  }, [pageSize]);

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
  }, [statusFilter, stateFilter, capacityFilter]);

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
  const start = pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, filteredVenues.length);

  return (
    <div className="flex flex-col h-full gap-4 relative">

      <ScrollShadow className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-2 gap-y-3">
          {table.getRowModel().rows.map((row) => {
            const venue = row.original;
            const status = statusMap[venue.status];

            return (
              <button
                key={venue.id}
                type="button"
                onClick={() => navigate(`/venues/${venue.id}/edit`)}
                className="text-left w-full rounded-3xl bg-surface cursor-pointer flex flex-col transition-all duration-300 group shadow-surface hover:shadow-lg hover:bg-surface-secondary active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {/* Image Section */}
                <div className="w-full rounded-2xl relative shrink-0 overflow-hidden flex flex-col items-center justify-center">
                  <Carousel
                    autoplay={true}
                    autoplayDelay={4000}
                    pauseOnHover={true}
                    loop={true}
                    round={false}
                    onChange={(index) => {
                      setActiveFloors(prev => {
                        if (prev[venue.id] === index) return prev;
                        return { ...prev, [venue.id]: index };
                      });
                    }}
                  >
                    {venue.images.map((img, i) => (
                      <div key={i} className="w-full h-full flex items-center justify-center group-hover:scale-105 transition-transform duration-700 ease-out">
                        {img}
                      </div>
                    ))}
                  </Carousel>
                  <Chip size="sm" className="absolute top-4 left-4 z-10">
                    Piso {(activeFloors[venue.id] || 0) + 1}
                  </Chip>
                  <Button size="sm" isIconOnly variant="tertiary" className="absolute top-4 right-4 z-10">
                    <Icon.Maximize />
                  </Button>
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
                    <Chip size="sm" variant="soft">7 Pisos</Chip>
                    <Chip size="sm" variant="soft">28 Secciones</Chip>
                    <Chip size="sm" variant="soft">20 Elementos</Chip>
                  </ScrollShadow>
                  <Button fullWidth>
                    <Icon.SquarePen />
                    Editar
                  </Button>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollShadow>

      <div className="shrink-0 flex justify-center md:justify-between items-center flex-wrap gap-4">
        <Pagination>
          <Pagination.Summary>

            <Select
              aria-label="Filas por página"
              value={pageSize}
              onChange={(value) => setPageSize(value)}
            >
              <Select.Trigger>
                <div className="flex items-center gap-2">
                  <Icon.Rows3 />
                  <span className="max-[1400px]:hidden">Filas:</span>
                  <Select.Value />
                </div>
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {[4, 8, 12, 16].map((size) => (
                    <ListBox.Item key={size.toString()} id={size.toString()} textValue={size.toString()}>
                      {size}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
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
    </div>
  );
}
