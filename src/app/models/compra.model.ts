/**
 * Define los tipos utilizados para el historial y detalle de compras.
 */
import { Asiento } from './asiento.model';
import { Funcion } from './funcion.model';
import { Pelicula } from './pelicula.model';

export interface CompraHistorial {
  id: number;
  funcion_id: number;
  usuario_id: string | null;
  total: number;
  estado: 'pagada' | 'cancelada' | 'pendiente' | string;
  codigo_qr: string;
  fecha_creacion: string;
  fecha_cancelacion: string | null;
  credito_generado: number;
  funcion: Funcion;
  pelicula: Pelicula;
  asientos: Asiento[];
  productos?: { producto_id: number; nombre: string; cantidad: number; precio_unitario: number; subtotal: number }[];
}
