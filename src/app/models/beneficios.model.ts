/**
 * Define los tipos de datos usados para cupones, recompensas y combos.
 */
export interface Cupon {
  id: number;
  codigo: string;
  porcentaje: number;
  primera_compra: boolean;
  edad_minima: number;
  activo: boolean;
}

export interface ComboItem {
  producto_id: number;
  cantidad: number;
  producto?: { id: number; nombre: string; precio: number };
}

export interface Combo {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  activo: boolean;
  destacado?: boolean;
  incluye_entrada?: boolean;
  combo_items?: ComboItem[];
}

export interface Recompensa {
  id: number;
  nombre: string;
  tipo: string;
  costo_puntos: number;
  producto_id?: number | null;
  cantidad: number;
  activo: boolean;
  producto?: { id: number; nombre: string; precio: number } | null;
}
