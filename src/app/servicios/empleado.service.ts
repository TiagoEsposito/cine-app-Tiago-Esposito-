import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface VentaQr {
  id: number;
  codigo_qr: string;
  estado: string;
  total: number;
  entrada_validada: boolean;
  candy_retirado: boolean;
  funcion_id: number;
  detalle_compra?: {
    combos?: { nombre: string; cantidad: number; precio: number }[];
    candy?: { nombre: string; cantidad: number; precio: number }[];
  } | null;
  productos?: { nombre: string; cantidad: number; precio?: number }[];
  funcion?: {
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    sala_id: number;
    pelicula_id: number;
    pelicula?: { titulo: string; url_poster: string | null };
  };
}

@Injectable({ providedIn: 'root' })
export class EmpleadoService {
  private readonly supabase = inject(SupabaseService);

  async buscarPorQr(codigo: string): Promise<VentaQr> {
    const limpio = codigo.trim();
    if (!limpio) throw new Error('Ingresá un código QR.');

    const { data, error } = await this.supabase.cliente
      .from('ventas')
      .select('id,codigo_qr,estado,total,entrada_validada,candy_retirado,funcion_id,detalle_compra')
      .eq('codigo_qr', limpio)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('No encontramos una compra con ese código.');

    const venta = data as any;

    const [{ data: funcion, error: funcionError }, { data: productosVenta, error: productosError }] = await Promise.all([
      this.supabase.cliente
        .from('funciones')
        .select('fecha,hora_inicio,hora_fin,sala_id,pelicula_id')
        .eq('id', venta.funcion_id)
        .maybeSingle(),
      this.supabase.cliente
        .from('venta_productos')
        .select('cantidad,precio_unitario,candy_productos(nombre)')
        .eq('venta_id', venta.id),
    ]);

    if (funcionError) throw funcionError;
    if (productosError) throw productosError;

    let pelicula: { titulo: string; url_poster: string | null } | undefined;
    if (funcion?.pelicula_id) {
      const { data: peliculaData, error: peliculaError } = await this.supabase.cliente
        .from('peliculas')
        .select('titulo,url_poster')
        .eq('id', funcion.pelicula_id)
        .maybeSingle();
      if (peliculaError) throw peliculaError;
      pelicula = peliculaData ?? undefined;
    }

    return {
      ...venta,
      funcion: funcion ? { ...funcion, pelicula } : undefined,
      productos: (productosVenta ?? []).map((item: any) => ({
        nombre: item.candy_productos?.nombre ?? 'Producto',
        cantidad: Number(item.cantidad ?? 0),
        precio: Number(item.precio_unitario ?? 0),
      })),
    } as VentaQr;
  }

  async validarQr(codigo: string): Promise<VentaQr> {
    const venta = await this.buscarPorQr(codigo);
    if (venta.estado !== 'pagada') throw new Error('La compra no está activa.');
    if (venta.entrada_validada || venta.candy_retirado) {
      throw new Error('Este QR ya fue utilizado y dejó de estar disponible.');
    }

    const usuario = (await this.supabase.cliente.auth.getUser()).data.user;
    if (!usuario) throw new Error('No hay un empleado autenticado.');

    const tieneCandy = (venta.detalle_compra?.combos?.length ?? 0) > 0
      || (venta.detalle_compra?.candy?.length ?? 0) > 0
      || (venta.productos?.length ?? 0) > 0;

    const ahora = new Date().toISOString();
    const cambios = {
      entrada_validada: true,
      entrada_validada_at: ahora,
      entrada_validada_por: usuario.id,
      candy_retirado: tieneCandy,
      candy_retirado_at: tieneCandy ? ahora : null,
      candy_retirado_por: tieneCandy ? usuario.id : null,
    };

    const { error: updateError } = await this.supabase.cliente
      .from('ventas')
      .update(cambios)
      .eq('id', venta.id)
      .eq('estado', 'pagada')
      .eq('entrada_validada', false)
      .eq('candy_retirado', false);

    if (updateError) throw updateError;

    const { error: logError } = await this.supabase.cliente
      .from('validaciones_qr')
      .insert({ venta_id: venta.id, empleado_id: usuario.id, tipo: 'compra' });

    if (logError) throw logError;

    return this.buscarPorQr(codigo);
  }
}
