import type { Venue } from "../types/venue";

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

const placeholderImages = [FloorSVG, FloorSVG, FloorSVG];

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

export const VENUES: Venue[] = baseVenues.map((v) => ({
  ...v,
  images: placeholderImages,
  status: v.status as Venue["status"],
  description: `${v.name} es uno de los recintos más solicitados en ${v.city}, con capacidad para ${v.total_capacity.toLocaleString("es-MX")} personas.`,
}));
