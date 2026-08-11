import React, { useMemo, useState, useEffect } from "react";
import { Chip, Pagination, Tanstack, Button, Icon, Select, ListBox, ScrollShadow, Carousel, Description, Label, Separator, Router } from "@nextticket-frontend/commons";
import type { SortDescriptor, Key } from "@nextticket-frontend/commons";

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  total_capacity: number;
  createdAt?: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "UNDER_MAINTENANCE" | "REMOVED";
  images: React.ReactNode[];
}

type ChipColor = "default" | "success" | "warning" | "danger" | "accent";

const statusMap: Record<string, { label: string; color: ChipColor; icon: React.ReactNode }> = {
  ACTIVE: { label: "Activo", color: "success", icon: <Icon.Check /> },
  INACTIVE: { label: "Inactivo", color: "default", icon: <Icon.Minus /> },
  UNDER_MAINTENANCE: { label: "Mantenimiento", color: "warning", icon: <Icon.Wrench /> },
  REMOVED: { label: "Eliminado", color: "danger", icon: <Icon.X /> },
  DRAFT: { label: "Borrador", color: "accent", icon: <Icon.Pen /> },
};

const FloorSVG = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="-320 -250 890 710" width="100%" style={{ background: "transparent", fontFamily: "sans-serif" }}>
    <polygon points="-240,-170 110,-170 110,80 -240,80" fill="#2563eb" fillOpacity="0.22" stroke="#2563eb" strokeOpacity="0.7" strokeWidth="2" />
    <text x="-65" y="-45" textAnchor="middle" fontSize="14" fontFamily="sans-serif" fill="currentColor">Sección 1</text>
    <polygon points="140,-170 490,-170 490,80 140,80" fill="#8B5CF6" fillOpacity="0.22" stroke="#8B5CF6" strokeOpacity="0.7" strokeWidth="2" />
    <text x="315" y="-45" textAnchor="middle" fontSize="14" fontFamily="sans-serif" fill="currentColor">Sección 2</text>
    <polygon points="-240,130 110,130 110,380 -240,380" fill="#22C55E" fillOpacity="0.22" stroke="#22C55E" strokeOpacity="0.7" strokeWidth="2" />
    <text x="-65" y="255" textAnchor="middle" fontSize="14" fontFamily="sans-serif" fill="currentColor">Sección 3</text>
    <polygon points="140,130 490,130 490,380 140,380" fill="#EC4899" fillOpacity="0.22" stroke="#EC4899" strokeOpacity="0.7" strokeWidth="2" />
    <text x="315" y="255" textAnchor="middle" fontSize="14" fontFamily="sans-serif" fill="currentColor">Sección 4</text>
    <circle cx="-160" cy="-45" r="10" fill="#2563eb" fillOpacity="0.85" />
    <circle cx="-139" cy="-45" r="10" fill="#2563eb" fillOpacity="0.85" />
    <circle cx="-118" cy="-45" r="10" fill="#2563eb" fillOpacity="0.85" />
    <circle cx="-97" cy="-45" r="10" fill="#2563eb" fillOpacity="0.85" />
    <circle cx="-76" cy="-45" r="10" fill="#2563eb" fillOpacity="0.85" />
    <circle cx="-54" cy="-45" r="10" fill="#2563eb" fillOpacity="0.85" />
    <circle cx="-33" cy="-45" r="10" fill="#2563eb" fillOpacity="0.85" />
    <circle cx="-12" cy="-45" r="10" fill="#2563eb" fillOpacity="0.85" />
    <circle cx="9" cy="-45" r="10" fill="#2563eb" fillOpacity="0.85" />
    <circle cx="30" cy="-45" r="10" fill="#2563eb" fillOpacity="0.85" />
    <circle cx="220" cy="-45" r="10" fill="#8B5CF6" fillOpacity="0.85" />
    <circle cx="241" cy="-45" r="10" fill="#8B5CF6" fillOpacity="0.85" />
    <circle cx="262" cy="-45" r="10" fill="#8B5CF6" fillOpacity="0.85" />
    <circle cx="283" cy="-45" r="10" fill="#8B5CF6" fillOpacity="0.85" />
    <circle cx="304" cy="-45" r="10" fill="#8B5CF6" fillOpacity="0.85" />
    <circle cx="326" cy="-45" r="10" fill="#8B5CF6" fillOpacity="0.85" />
    <circle cx="347" cy="-45" r="10" fill="#8B5CF6" fillOpacity="0.85" />
    <circle cx="368" cy="-45" r="10" fill="#8B5CF6" fillOpacity="0.85" />
    <circle cx="389" cy="-45" r="10" fill="#8B5CF6" fillOpacity="0.85" />
    <circle cx="410" cy="-45" r="10" fill="#8B5CF6" fillOpacity="0.85" />
    <circle cx="-160" cy="255" r="10" fill="#22C55E" fillOpacity="0.85" />
    <circle cx="-139" cy="255" r="10" fill="#22C55E" fillOpacity="0.85" />
    <circle cx="-118" cy="255" r="10" fill="#22C55E" fillOpacity="0.85" />
    <circle cx="-97" cy="255" r="10" fill="#22C55E" fillOpacity="0.85" />
    <circle cx="-76" cy="255" r="10" fill="#22C55E" fillOpacity="0.85" />
    <circle cx="-54" cy="255" r="10" fill="#22C55E" fillOpacity="0.85" />
    <circle cx="-33" cy="255" r="10" fill="#22C55E" fillOpacity="0.85" />
    <circle cx="-12" cy="255" r="10" fill="#22C55E" fillOpacity="0.85" />
    <circle cx="9" cy="255" r="10" fill="#22C55E" fillOpacity="0.85" />
    <circle cx="30" cy="255" r="10" fill="#22C55E" fillOpacity="0.85" />
    <circle cx="220" cy="255" r="10" fill="#EC4899" fillOpacity="0.85" />
    <circle cx="241" cy="255" r="10" fill="#EC4899" fillOpacity="0.85" />
    <circle cx="262" cy="255" r="10" fill="#EC4899" fillOpacity="0.85" />
    <circle cx="283" cy="255" r="10" fill="#EC4899" fillOpacity="0.85" />
    <circle cx="304" cy="255" r="10" fill="#EC4899" fillOpacity="0.85" />
    <circle cx="326" cy="255" r="10" fill="#EC4899" fillOpacity="0.85" />
    <circle cx="347" cy="255" r="10" fill="#EC4899" fillOpacity="0.85" />
    <circle cx="368" cy="255" r="10" fill="#EC4899" fillOpacity="0.85" />
    <circle cx="389" cy="255" r="10" fill="#EC4899" fillOpacity="0.85" />
    <circle cx="410" cy="255" r="10" fill="#EC4899" fillOpacity="0.85" />
  </svg>
);

const placeholderImages: React.ReactNode[] = [FloorSVG, FloorSVG, FloorSVG];

const baseVenues = [
  { id: "1", name: "Auditorio Nacional", address: "Av. Paseo de la Reforma 50", city: "Ciudad de México", state: "CDMX", total_capacity: 10000, status: "ACTIVE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "2", name: "Foro Sol", address: "Viad. Río de la Piedad S/N", city: "Ciudad de México", state: "CDMX", total_capacity: 65000, status: "UNDER_MAINTENANCE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "3", name: "Arena Monterrey", address: "Av. Francisco I. Madero 2500", city: "Monterrey", state: "Nuevo León", total_capacity: 17599, status: "ACTIVE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "4", name: "Auditorio Telmex", address: "Obreros de Cananea 747", city: "Zapopan", state: "Jalisco", total_capacity: 11500, status: "INACTIVE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "5", name: "Palacio de los Deportes", address: "Granjas México", city: "Ciudad de México", state: "CDMX", total_capacity: 20000, status: "ACTIVE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "6", name: "Teatro Diana", address: "Av. 16 de Septiembre 710", city: "Guadalajara", state: "Jalisco", total_capacity: 2345, status: "DRAFT", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "7", name: "Pepsi Center WTC", address: "Dakota s/n", city: "Ciudad de México", state: "CDMX", total_capacity: 8000, status: "ACTIVE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "8", name: "Arena VFG", address: "Km 20, Carr. a Chapala", city: "Tlajomulco", state: "Jalisco", total_capacity: 15000, status: "REMOVED", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "9", name: "Arena Ciudad de México", address: "Av. de las Granjas 800", city: "Ciudad de México", state: "CDMX", total_capacity: 22300, status: "ACTIVE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "10", name: "Estadio Azteca", address: "Calz. de Tlalpan 3465", city: "Ciudad de México", state: "CDMX", total_capacity: 83264, status: "UNDER_MAINTENANCE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "11", name: "Estadio BBVA", address: "Av. Pablo Livas 2011", city: "Guadalupe", state: "Nuevo León", total_capacity: 53500, status: "ACTIVE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "12", name: "Estadio Akron", address: "Circuito JVC 2800", city: "Zapopan", state: "Jalisco", total_capacity: 49850, status: "ACTIVE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "13", name: "Auditorio Citibanamex", address: "Privada Fundidora s/n", city: "Monterrey", state: "Nuevo León", total_capacity: 8000, status: "ACTIVE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "14", name: "Teatro Metropólitan", address: "Av. Independencia 90", city: "Ciudad de México", state: "CDMX", total_capacity: 3165, status: "ACTIVE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "15", name: "Showcenter Complex", address: "Av. Batallón de San Patricio 1000", city: "San Pedro Garza García", state: "Nuevo León", total_capacity: 4500, status: "DRAFT", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "16", name: "Foro GNP Seguros", address: "Carretera Mérida - Progreso Km 14.5", city: "Mérida", state: "Yucatán", total_capacity: 10000, status: "ACTIVE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "17", name: "Auditorio Pabellón M", address: "Constitución 1002", city: "Monterrey", state: "Nuevo León", total_capacity: 4277, status: "ACTIVE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "18", name: "Centro Citibanamex", address: "Av. del Conscripto 311", city: "Ciudad de México", state: "CDMX", total_capacity: 15000, status: "INACTIVE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "19", name: "Plaza de Toros México", address: "C. Augusto Rodin 241", city: "Ciudad de México", state: "CDMX", total_capacity: 41262, status: "ACTIVE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "20", name: "Estadio Olímpico Universitario", address: "Av. de los Insurgentes Sur S/N", city: "Ciudad de México", state: "CDMX", total_capacity: 72000, status: "ACTIVE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "21", name: "Velódromo Olímpico", address: "Radamés Treviño S/N", city: "Ciudad de México", state: "CDMX", total_capacity: 6400, status: "REMOVED", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "22", name: "Teatro Galerías", address: "Av. Lapizlázuli 3445", city: "Zapopan", state: "Jalisco", total_capacity: 1800, status: "ACTIVE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "23", name: "Foro Indie Rocks!", address: "Zacatecas 39", city: "Ciudad de México", state: "CDMX", total_capacity: 500, status: "ACTIVE", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "24", name: "El Plaza Condesa", address: "Juan Escutia 4", city: "Ciudad de México", state: "CDMX", total_capacity: 2100, status: "REMOVED", createdAt: "2026-07-17T18:12:08.026Z" },
  { id: "25", name: "Auditorio Josefa Ortiz de Domínguez", address: "Av. Constituyentes Esq. Luis Pasteur", city: "Querétaro", state: "Querétaro", total_capacity: 4800, status: "ACTIVE", createdAt: "2026-07-17T18:12:08.026Z" },
];

const venues: Venue[] = baseVenues.map((v) => ({ ...v, images: placeholderImages, status: v.status as any }));

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
                onClick={() => navigate("/users/profile")}
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
