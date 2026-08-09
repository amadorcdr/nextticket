import { useState } from "react";
import { Icon, ListBox, Select, SearchField, Table } from "@nextticket-frontend/commons";

const EVENTOS_SELECT = ["Neon Nights Festival 2024", "Clásicos de Otoño: Orquesta", "Rock Revolution Tour", "Electronic Beach Party"];

interface ZonaData {
  label: string;
  count: number;
}

const ZONAS: ZonaData[] = [
  { label: "VIP Gold", count: 561 },
  { label: "General A", count: 312 },
  { label: "General B", count: 187 },
  { label: "Palcos", count: 188 },
];

const TOTAL_VENDIDOS = ZONAS.reduce((s, z) => s + z.count, 0);

interface VentaRow {
  folio: string;
  zona: string;
  asiento: string;
  cliente: string;
  fecha: string;
  hora: string;
  monto: number;
}

const VENTAS: VentaRow[] = [
  { folio: "#TK-9872", zona: "VIP Gold", asiento: "B-12", cliente: "Juan Pérez", fecha: "26 Oct", hora: "14:20", monto: 2500 },
  { folio: "#TK-9871", zona: "General A", asiento: "C-08", cliente: "María García", fecha: "26 Oct", hora: "13:45", monto: 800 },
  { folio: "#TK-9870", zona: "VIP Gold", asiento: "A-01", cliente: "Carlos Slim", fecha: "26 Oct", hora: "12:30", monto: 2500 },
  { folio: "#TK-9869", zona: "Palcos", asiento: "P-04", cliente: "Lucía Méndez", fecha: "26 Oct", hora: "11:15", monto: 3800 },
  { folio: "#TK-9868", zona: "General B", asiento: "F-22", cliente: "Roberto Gómez", fecha: "26 Oct", hora: "10:50", monto: 600 },
  { folio: "#TK-9867", zona: "General A", asiento: "D-11", cliente: "Elena Poniatowska", fecha: "26 Oct", hora: "09:12", monto: 800 },
  { folio: "#TK-9866", zona: "VIP Gold", asiento: "B-02", cliente: "Diego Luna", fecha: "25 Oct", hora: "22:05", monto: 2500 },
];

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface border border-border rounded-[10px] p-3">
      <p className="text-muted text-[11px] font-semibold uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-foreground text-lg font-bold">{value}</p>
        {sub && (
          <span className="text-success text-[11px] font-semibold flex items-center gap-0.5">
            <Icon.TrendingUp className="size-3" />
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

export function SalesEvent() {
  const [selectedEvent, setSelectedEvent] = useState(EVENTOS_SELECT[0]);
  const [search, setSearch] = useState("");

  const filteredVentas = VENTAS.filter(
    (v) => v.folio.toLowerCase().includes(search.toLowerCase()) || v.cliente.toLowerCase().includes(search.toLowerCase()) || v.zona.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-3 animate-in fade-in duration-500">
      {/* Título + selector de evento */}
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h3>Ventas por Evento</h3>
          <p className="text-muted text-xs mt-0.5">{selectedEvent} — resumen de boletos y transacciones</p>
        </div>

        <Select className="w-fit" aria-label="Evento" value={selectedEvent} onChange={(v) => v && setSelectedEvent(v as string)}>
          <Select.Trigger>
            <div className="flex items-center gap-2">
              <Icon.Calendar className="shrink-0 size-3.5" />
              <Select.Value className="line-clamp-1 max-w-50 text-xs">{() => selectedEvent}</Select.Value>
            </div>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {EVENTOS_SELECT.map((e) => (
                <ListBox.Item key={e} id={e} textValue={e}>
                  {e}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard label="Boletos Vendidos" value="1.2k" sub="+12%" />
        <StatCard label="Ventas Totales" value="$150k" sub="+8%" />
        <StatCard label="Zona Más Vendida" value="VIP Gold" />
        <StatCard label="Asientos Disponibles" value="450" />
      </div>

      {/* Ventas por zona + tabla */}
      <div className="grid md:grid-cols-[240px_1fr] gap-2">
        <div className="bg-surface border border-border rounded-[10px] p-3">
          <p className="text-foreground font-semibold text-xs mb-2">Ventas por Zona</p>
          <div className="flex flex-col gap-2">
            {ZONAS.map((z) => {
              const pct = Math.round((z.count / TOTAL_VENDIDOS) * 100);
              return (
                <div key={z.label} className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted">{z.label}</span>
                    <span className="text-foreground font-medium">{z.count.toLocaleString()}</span>
                  </div>
                  <div className="h-1 rounded-full bg-default overflow-hidden">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-2 border-t border-border flex justify-between text-[11px]">
            <span className="text-muted uppercase tracking-wide font-semibold">Total</span>
            <span className="text-foreground font-bold">{TOTAL_VENDIDOS.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <SearchField name="search-sales" className="max-w-80" value={search} onChange={setSearch}>
            <SearchField.Group>
              <SearchField.SearchIcon>
                <Icon.Search />
              </SearchField.SearchIcon>
              <SearchField.Input placeholder="Buscar folio, cliente..." />
              <SearchField.ClearButton>
                <Icon.X />
              </SearchField.ClearButton>
            </SearchField.Group>
          </SearchField>

          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Ventas recientes" className="min-w-140 text-xs">
                <Table.Header>
                  <Table.Column isRowHeader id="folio" minWidth={90} className="text-center">
                    Folio
                  </Table.Column>
                  <Table.Column id="zona" minWidth={100} className="text-center">
                    Zona
                  </Table.Column>
                  <Table.Column id="asiento" minWidth={70} className="text-center">
                    Asiento
                  </Table.Column>
                  <Table.Column id="cliente" minWidth={140} className="text-center">
                    Cliente
                  </Table.Column>
                  <Table.Column id="fecha" minWidth={80} className="text-center">
                    Fecha
                  </Table.Column>
                  <Table.Column id="monto" minWidth={80} className="text-center">
                    Monto
                  </Table.Column>
                </Table.Header>
                <Table.Body items={filteredVentas}>
                  {(v) => (
                    <Table.Row>
                      <Table.Cell className="text-center">
                        <span className="font-mono text-xs text-foreground">{v.folio}</span>
                      </Table.Cell>
                      <Table.Cell className="text-center">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-default text-foreground">{v.zona}</span>
                      </Table.Cell>
                      <Table.Cell className="text-center">
                        <span className="text-xs">{v.asiento}</span>
                      </Table.Cell>
                      <Table.Cell className="text-center">
                        <span className="text-xs">{v.cliente}</span>
                      </Table.Cell>
                      <Table.Cell className="text-center">
                        <div>
                          <p className="text-foreground text-xs">{v.fecha}</p>
                          <p className="text-muted text-[11px]">{v.hora}</p>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="text-center">
                        <span className="text-foreground text-xs font-semibold">${v.monto.toLocaleString()}</span>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </div>
      </div>
    </div>
  );
}
