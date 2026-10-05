/**
 * Implementa la lógica de candy dentro de la aplicación Cine Avellaneda.
 */
import { inject, Injectable } from '@angular/core';
import { CandyCategoria, CandyProducto } from '../models/candy.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class CandyService {
  private readonly supabase = inject(SupabaseService);

  /** Obtiene las categorías del Candy Bar. */
  async obtenerCategorias(): Promise<CandyCategoria[]> {
    const { data, error } = await this.supabase.cliente
      .from('candy_categorias').select('*').eq('activa', true).order('nombre');
    if (error) throw error;
    return data ?? [];
  }

  /** Obtiene los productos del Candy Bar. */
  async obtenerProductos(): Promise<CandyProducto[]> {
    const { data, error } = await this.supabase.cliente
      .from('candy_productos').select('*').eq('activo', true).order('nombre');
    if (error) throw error;
    return data ?? [];
  }
}
