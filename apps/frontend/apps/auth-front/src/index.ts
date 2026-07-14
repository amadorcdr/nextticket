// A diferencia de la variante runtime (export default vía Federation), aquí
// el host consume un named export normal de paquete:
//   import { InventoryModule } from '@nimbus/inventory-front';
export { AuthModule } from './AuthModule';