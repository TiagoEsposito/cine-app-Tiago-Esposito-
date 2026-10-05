/**
 * Implementa la lógica de compras dentro de la aplicación Cine Avellaneda.
 */
import { inject, Injectable } from '@angular/core';
import { Asiento } from '../models/asiento.model';
import { CompraHistorial } from '../models/compra.model';
import { Funcion } from '../models/funcion.model';
import { Pelicula } from '../models/pelicula.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class ComprasService {
  private readonly supabase = inject(SupabaseService);

  /** Obtiene el historial de compras de un usuario con sus funciones, asientos y productos. */
  async obtenerHistorial(usuarioId: string): Promise<CompraHistorial[]> {
    const { data, error } = await this.supabase.cliente
      .from('ventas')
      .select(`
        id,
        funcion_id,
        usuario_id,
        total,
        estado,
        codigo_qr,
        fecha_creacion,
        fecha_cancelacion,
        credito_generado,
        funciones (
          id,
          pelicula_id,
          sala_id,
          fecha,
          hora_inicio,
          hora_fin,
          precio,
          fecha_creacion,
          peliculas (
            id,
            titulo,
            sinopsis,
            duracion_minutos,
            url_poster,
            edad_minima,
            fecha_estreno,
            activa,
            fecha_creacion
          )
        ),
        venta_asientos (
          asiento_id,
          asientos (
            id, sala_id, fila, numero, tipo
          )
        ),
        venta_productos (
          producto_id, cantidad, precio_unitario, subtotal,
          candy_productos (id, nombre)
        )
      `)
      .eq('usuario_id', usuarioId)
      .order('fecha_creacion', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((venta: any) => {
      const funcion = venta.funciones as Funcion & { peliculas?: Pelicula };
      const pelicula = funcion?.peliculas as Pelicula;
      const asientos = (venta.venta_asientos ?? [])
        .map((item: any) => item.asientos as Asiento)
        .filter(Boolean);

      const productos = (venta.venta_productos ?? []).map((item: any) => ({
        producto_id: Number(item.producto_id),
        nombre: item.candy_productos?.nombre ?? 'Producto',
        cantidad: Number(item.cantidad),
        precio_unitario: Number(item.precio_unitario),
        subtotal: Number(item.subtotal),
      }));

      return {
        id: venta.id,
        funcion_id: venta.funcion_id,
        usuario_id: venta.usuario_id,
        total: Number(venta.total),
        estado: venta.estado,
        codigo_qr: venta.codigo_qr,
        fecha_creacion: venta.fecha_creacion,
        fecha_cancelacion: venta.fecha_cancelacion ?? null,
        credito_generado: Number(venta.credito_generado ?? 0),
        funcion,
        pelicula,
        asientos,
        productos,
      } as CompraHistorial;
    });
  }

  /** Solicita la cancelación de una compra y actualiza el perfil con el crédito devuelto. */
  async cancelarCompra(ventaId: number): Promise<number> {
    const usuario = (await this.supabase.cliente.auth.getUser()).data.user;
    if (!usuario) throw new Error('Iniciá sesión para cancelar una compra.');

    const { data: compra, error } = await this.supabase.cliente
      .from('ventas')
      .select('id, usuario_id, total, estado, funcion_id')
      .eq('id', ventaId)
      .eq('usuario_id', usuario.id)
      .single();
    if (error) throw error;
    if (compra.estado !== 'pagada') throw new Error('La compra ya fue cancelada.');

    const { data: funcion, error: funcionError } = await this.supabase.cliente
      .from('funciones')
      .select('fecha,hora_inicio')
      .eq('id', compra.funcion_id)
      .single();
    if (funcionError) throw funcionError;

    const inicio = new Date(`${funcion.fecha}T${funcion.hora_inicio}`);
    if (Date.now() >= inicio.getTime() - 2 * 60 * 60 * 1000) {
      throw new Error('Solo podés cancelar la compra hasta 2 horas antes de la función.');
    }

    const credito = Number(compra.total);

    const { data: productos, error: productosError } = await this.supabase.cliente
      .from('venta_productos')
      .select('producto_id,cantidad')
      .eq('venta_id', ventaId);
    if (productosError) throw productosError;


    const { error: ventaError } = await this.supabase.cliente
      .from('ventas')
      .update({
        estado: 'cancelada',
        fecha_cancelacion: new Date().toISOString(),
        credito_generado: credito,
      })
      .eq('id', ventaId)
      .eq('usuario_id', usuario.id)
      .eq('estado', 'pagada');
    if (ventaError) throw ventaError;

    const { error: asientosError } = await this.supabase.cliente
      .from('venta_asientos')
      .update({ activo: false })
      .eq('venta_id', ventaId);
    if (asientosError) throw asientosError;

    const { data: perfil, error: perfilError } = await this.supabase.cliente
      .from('perfiles')
      .select('credito')
      .eq('id', usuario.id)
      .single();
    if (perfilError) throw perfilError;

    const { error: creditoError } = await this.supabase.cliente
      .from('perfiles')
      .update({ credito: Number(perfil.credito ?? 0) + credito })
      .eq('id', usuario.id);
    if (creditoError) throw creditoError;

    return credito;
  }

  /** Comprueba si una compra todavía puede cancelarse según el límite de tiempo. */
  puedeCancelar(compra: CompraHistorial): boolean {
    if (compra.estado !== 'pagada') return false;

    const funcion = new Date(`${compra.funcion.fecha}T${compra.funcion.hora_inicio}`);
    const limite = funcion.getTime() - 2 * 60 * 60 * 1000;

    return Date.now() < limite;
  }
}
