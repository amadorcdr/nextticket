import { Table } from "@nextticket-frontend/commons";

interface EventRow {
  name: string;
  venue: string;
  date: string;
  sold: number;
  total: number;
  pct: number;
  status: "Activo" | "Draft";
}

const EVENTS: EventRow[] = [
  { name: "Rock Revolution Tour", venue: "Arena Stadium", date: "15 Nov, 2024", sold: 1200, total: 1500, pct: 80, status: "Activo" },
  { name: "Standup Night Live", venue: "Teatro Rex", date: "22 Nov, 2024", sold: 450, total: 500, pct: 90, status: "Activo" },
  { name: "Electronic Beach Party", venue: "Playa del Sol", date: "05 Dic, 2024", sold: 0, total: 2000, pct: 0, status: "Draft" },
];

const SALES_BY_EVENT = [
  { label: "Rock Revolution Tour", proj: 70, rev: 85 },
  { label: "Standup Night Live", proj: 90, rev: 60 },
  { label: "Techno Fest", proj: 50, rev: 95 },
  { label: "Art Expo", proj: 65, rev: 45 },
  { label: "Gala Dinner", proj: 80, rev: 75 },
];

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-[10px] p-3">
      <p className="text-muted text-[11px] font-semibold uppercase tracking-wide mb-1">{label}</p>
      <p className="text-foreground text-lg font-bold">{value}</p>
    </div>
  );
}

export function OrganizerDashboard() {
  const topEvent = EVENTS[0];

  return (
    <div className="flex flex-col gap-3 animate-in fade-in duration-500">
      {/* Título */}
      <div>
        <h3>Resumen de Gestión</h3>
        <p className="text-muted text-xs mt-0.5">Monitorea el rendimiento de tus producciones en tiempo real.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard label="Total Eventos" value="12" />
        <StatCard label="Eventos Activos" value="8" />
        <StatCard label="Boletos Vendidos" value="2,450" />
        <StatCard label="Ventas Totales" value="$120,400" />
      </div>

      {/* Ventas por evento + Top evento */}
      <div className="grid md:grid-cols-2 gap-2">
        <div className="bg-surface border border-border rounded-[10px] p-3">
          <p className="text-foreground font-semibold text-xs mb-2">Ventas por Evento</p>
          <div className="flex flex-col gap-2">
            {SALES_BY_EVENT.map(({ label, proj, rev }) => (
              <div key={label} className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted">{label}</span>
                  <span className="text-foreground font-medium">{rev}%</span>
                </div>
                <div className="h-1 rounded-full bg-default overflow-hidden relative">
                  <div className="h-full rounded-full bg-muted/40 absolute inset-y-0 left-0" style={{ width: `${proj}%` }} />
                  <div className="h-full rounded-full bg-accent absolute inset-y-0 left-0" style={{ width: `${rev}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-[10px] p-3 flex flex-col justify-center">
          <p className="text-muted text-[11px] font-semibold uppercase tracking-wide">Top Evento (Revenue)</p>
          <p className="text-foreground text-sm font-semibold mt-1">{topEvent.name}</p>
          <p className="text-foreground text-xl font-bold my-1">${(topEvent.sold * 20).toLocaleString()}</p>
          <p className="text-muted text-xs">
            {topEvent.venue} · {topEvent.date}
          </p>
        </div>
      </div>

      {/* Próximos eventos */}
      <div className="flex flex-col gap-1.5">
        <p className="text-foreground font-semibold text-xs">Próximos Eventos</p>
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Próximos eventos" className="min-w-160 text-xs">
              <Table.Header>
                <Table.Column isRowHeader id="name" minWidth={200} className="text-center">
                  Evento
                </Table.Column>
                <Table.Column id="date" minWidth={110} className="text-center">
                  Fecha
                </Table.Column>
                <Table.Column id="sold" minWidth={160} className="text-center">
                  Boletos Vendidos
                </Table.Column>
                <Table.Column id="status" minWidth={100} className="text-center">
                  Estado
                </Table.Column>
              </Table.Header>
              <Table.Body items={EVENTS}>
                {(ev) => (
                  <Table.Row>
                    <Table.Cell className="text-center">
                      <div>
                        <p className="text-foreground text-xs font-medium">{ev.name}</p>
                        <p className="text-muted text-[11px]">{ev.venue}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-center">
                      <span className="text-xs">{ev.date}</span>
                    </Table.Cell>
                    <Table.Cell className="text-center">
                      <div className="flex flex-col gap-1 w-36 mx-auto">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted font-mono">
                            {ev.sold.toLocaleString()} / {ev.total.toLocaleString()}
                          </span>
                          <span className="text-foreground font-medium">{ev.pct}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-default overflow-hidden">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${ev.pct}%` }} />
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-center">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${ev.status === "Activo" ? "text-success" : "text-muted"}`}>
                        <span className={`size-1.5 rounded-full ${ev.status === "Activo" ? "bg-success" : "bg-muted"}`} />
                        {ev.status}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </div>
    </div>
  );
}
