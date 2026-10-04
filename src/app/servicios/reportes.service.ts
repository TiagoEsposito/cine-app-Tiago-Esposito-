import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface ReportePeriodo { nombre: string; entradas: number; ingresos: number; }
export interface ReporteCandy { nombre: string; cantidad: number; ingresos: number; }

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly supabase = inject(SupabaseService);

  async resumenDia(fecha: string): Promise<{ ingresos: number; entradas: number; compras: number }> {
    const { data, error } = await this.supabase.cliente
      .from('ventas')
      .select('id,total,estado,venta_asientos(asiento_id)')
      .eq('estado', 'pagada')
      .gte('fecha_creacion', `${fecha}T00:00:00`)
      .lt('fecha_creacion', `${fecha}T23:59:59.999`);
    if (error) throw error;
    const ventas = data ?? [];
    return {
      ingresos: ventas.reduce((s: number, v: any) => s + Number(v.total ?? 0), 0),
      entradas: ventas.reduce((s: number, v: any) => s + (v.venta_asientos?.length ?? 0), 0),
      compras: ventas.length,
    };
  }

  async ventasPorPeliculas(desde: string, hasta: string): Promise<ReportePeriodo[]> {
    const { data, error } = await this.supabase.cliente
      .from('ventas')
      .select('total,funcion_id,funciones(pelicula_id,peliculas(titulo)),venta_asientos(asiento_id)')
      .eq('estado', 'pagada')
      .gte('fecha_creacion', `${desde}T00:00:00`)
      .lt('fecha_creacion', `${hasta}T23:59:59.999`);
    if (error) throw error;
    const mapa = new Map<string, ReportePeriodo>();
    for (const venta of data ?? []) {
      const titulo = (venta as any).funciones?.peliculas?.titulo ?? 'Película';
      const actual = mapa.get(titulo) ?? { nombre: titulo, entradas: 0, ingresos: 0 };
      actual.entradas += ((venta as any).venta_asientos?.length ?? 0);
      actual.ingresos += Number((venta as any).total ?? 0);
      mapa.set(titulo, actual);
    }
    return [...mapa.values()].sort((a,b) => b.entradas - a.entradas);
  }

  async candyMasVendido(desde: string, hasta: string): Promise<ReporteCandy[]> {
    const { data, error } = await this.supabase.cliente
      .from('venta_productos')
      .select('cantidad,subtotal,candy_productos(nombre),ventas!inner(estado,fecha_creacion)')
      .eq('ventas.estado', 'pagada')
      .gte('ventas.fecha_creacion', `${desde}T00:00:00`)
      .lt('ventas.fecha_creacion', `${hasta}T23:59:59.999`);
    if (error) throw error;
    const mapa = new Map<string, ReporteCandy>();
    for (const item of data ?? []) {
      const nombre = (item as any).candy_productos?.nombre ?? 'Producto';
      const actual = mapa.get(nombre) ?? { nombre, cantidad: 0, ingresos: 0 };
      actual.cantidad += Number((item as any).cantidad ?? 0);
      actual.ingresos += Number((item as any).subtotal ?? 0);
      mapa.set(nombre, actual);
    }
    return [...mapa.values()].sort((a,b) => b.cantidad - a.cantidad);
  }
}
