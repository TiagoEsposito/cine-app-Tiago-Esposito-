import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Asiento } from '../models/asiento.model';
import { CandyItem } from '../models/candy.model';

@Injectable({ providedIn: 'root' })
export class AsientosService {
  private readonly supabase = inject(SupabaseService);

  async obtenerAsientos(salaId: number): Promise<Asiento[]> {
    const { data, error } = await this.supabase.cliente
      .from('asientos')
      .select('*')
      .eq('sala_id', salaId)
      .order('fila')
      .order('numero');
    if (error) throw error;
    return data ?? [];
  }

  async obtenerAsientosOcupados(funcionId: number): Promise<number[]> {
    const { data: ventas, error: ventasError } = await this.supabase.cliente
      .from('ventas')
      .select('id')
      .eq('funcion_id', funcionId)
      .eq('estado', 'pagada');

    if (ventasError) throw ventasError;
    const ventaIds = (ventas ?? []).map((v: { id: number }) => v.id);
    if (!ventaIds.length) return [];

    const { data, error } = await this.supabase.cliente
      .from('venta_asientos')
      .select('asiento_id')
      .in('venta_id', ventaIds)
      .eq('activo', true);

    if (error) throw error;
    return (data ?? []).map((item: { asiento_id: number }) => Number(item.asiento_id));
  }

  async crearVenta(
    funcionId: number,
    usuarioId: string | null,
    asientoIds: number[],
    total: number,
    candy: CandyItem[] = [],
    detalleCompra: { combos: { nombre: string; cantidad: number; precio: number }[]; candy: { nombre: string; cantidad: number; precio: number }[] } = { combos: [], candy: [] },
  ): Promise<{ id: number; codigoQr: string; total: number }> {
    if (!asientoIds.length) throw new Error('Seleccioná al menos una butaca.');

    // Última comprobación antes de crear la venta.
    const ocupados = await this.obtenerAsientosOcupados(funcionId);
    if (asientoIds.some(id => ocupados.includes(id))) {
      throw new Error('Uno de los asientos seleccionados ya fue ocupado. Volvé a elegir tus asientos.');
    }

    for (const item of candy) {
      const { data: producto, error } = await this.supabase.cliente
        .from('candy_productos')
        .select('id, stock, precio, activo')
        .eq('id', item.id)
        .single();
      if (error) throw error;
      if (!producto.activo || Number(producto.stock) < item.cantidad) {
        throw new Error(`No hay stock suficiente de ${item.nombre}.`);
      }
    }

    const codigoQr = crypto.randomUUID();

    const { data: venta, error: ventaError } = await this.supabase.cliente
      .from('ventas')
      .insert({
        funcion_id: funcionId,
        usuario_id: usuarioId,
        total: Number(total),
        estado: 'pagada',
        codigo_qr: codigoQr,
        detalle_compra: detalleCompra,
      })
      .select('id,total,codigo_qr')
      .single();

    if (ventaError) throw ventaError;

    const filasAsientos = asientoIds.map(asientoId => ({
      venta_id: venta.id,
      funcion_id: funcionId,
      asiento_id: asientoId,
      activo: true,
    }));

    const { error: asientosError } = await this.supabase.cliente
      .from('venta_asientos')
      .insert(filasAsientos);

    if (asientosError) {
      await this.supabase.cliente.from('ventas').delete().eq('id', venta.id);
      throw asientosError;
    }

    for (const item of candy) {
      const subtotal = Number(item.precio) * Number(item.cantidad);
      const { error: productoVentaError } = await this.supabase.cliente
        .from('venta_productos')
        .insert({
          venta_id: venta.id,
          producto_id: item.id,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          subtotal,
        });

      if (productoVentaError) {
        await this.supabase.cliente.from('venta_asientos').delete().eq('venta_id', venta.id);
        await this.supabase.cliente.from('ventas').delete().eq('id', venta.id);
        throw productoVentaError;
      }

      const { data: productoActual, error: stockError } = await this.supabase.cliente
        .from('candy_productos')
        .select('stock')
        .eq('id', item.id)
        .single();
      if (stockError) throw stockError;

      const nuevoStock = Number(productoActual.stock) - Number(item.cantidad);
      if (nuevoStock < 0) throw new Error(`No hay stock suficiente de ${item.nombre}.`);

      const { error: updateStockError } = await this.supabase.cliente
        .from('candy_productos')
        .update({ stock: nuevoStock })
        .eq('id', item.id);
      if (updateStockError) throw updateStockError;
    }

    return {
      id: Number(venta.id),
      codigoQr: venta.codigo_qr,
      total: Number(total),
    };
  }
}
