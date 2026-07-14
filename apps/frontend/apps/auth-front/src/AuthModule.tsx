// El CONTENIDO es el mismo CRUD. La ÚNICA diferencia relevante es la exportación:
//   runtime:    export default function ProductsModule()
//   build-time: export function InventoryModule()   ← named export de paquete
export function AuthModule() {
  return (
    <div>
      <h1>Auth Module</h1>
    </div>
  );
}