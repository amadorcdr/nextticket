// Compara con la variante runtime:
//   runtime:    const M = lazy(() => import('inventory_front/ProductsModule'))
//   build-time: import { InventoryModule } from '@nimbus/inventory-front'
// Aquí NO hace falta lazy, ni Suspense, ni boundary: ya está en el bundle.
export function App() {
    return (
        <div>
            <h1>Bienvenido</h1>
        </div>
    );
}

/*
function Home() {
    return (
        <div style={{ maxWidth: 640 }}>
            <h1 style={{ marginTop: 0 }}>Bienvenido a Nimbus Console</h1>
            <p style={{ lineHeight: 1.7 }}>
                El módulo de Inventario vive como un paquete del workspace que se importa y se compila DENTRO de este mismo bundle.
            </p>
        </div>
    );
}*/