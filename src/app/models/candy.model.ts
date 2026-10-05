/**
 * Define categorías, productos y elementos de Candy Bar.
 */
export interface CandyCategoria { id: number; nombre: string; activa: boolean; }
export interface CandyProducto {
  id: number;
  categoria_id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  imagen_url: string | null;
  activo: boolean;
}
export interface CandyItem extends CandyProducto { cantidad: number; }
