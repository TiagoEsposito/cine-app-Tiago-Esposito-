import { inject, Injectable } from '@angular/core';
import { Combo, Cupon, Recompensa } from '../models/beneficios.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class BeneficiosService {
  private readonly supabase = inject(SupabaseService);

  async obtenerCupon(codigo: string): Promise<Cupon | null> {
    const { data, error } = await this.supabase.cliente
      .from('cupones')
      .select('*')
      .eq('codigo', codigo.trim().toUpperCase())
      .eq('activo', true)
      .maybeSingle();
    if (error) throw error;
    return data as Cupon | null;
  }

  async tieneCompras(usuarioId: string): Promise<boolean> {
    const { count, error } = await this.supabase.cliente
      .from('ventas')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', usuarioId);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async obtenerCombos(): Promise<Combo[]> {
    const { data, error } = await this.supabase.cliente
      .from('combos')
      .select('*')
      .eq('activo', true)
      .order('id');

    if (error) throw error;

    const combos = (data ?? []) as Combo[];

    for (const combo of combos) {
      const { data: items, error: itemsError } = await this.supabase.cliente
        .from('combo_items')
        .select('producto_id, cantidad')
        .eq('combo_id', combo.id);

      if (itemsError) throw itemsError;

      const comboItems = items ?? [];
      const ids = comboItems.map(item => item.producto_id);

      if (!ids.length) {
        combo.combo_items = [];
        continue;
      }

      const { data: productos, error: productosError } = await this.supabase.cliente
        .from('candy_productos')
        .select('id, nombre, precio')
        .in('id', ids);

      if (productosError) throw productosError;

      combo.combo_items = comboItems.map(item => ({
        ...item,
        producto: productos?.find(producto => producto.id === item.producto_id),
      }));
    }

    return combos;
  }

  async obtenerRecompensas(): Promise<Recompensa[]> {
    const { data, error } = await this.supabase.cliente
      .from('fidelizacion_recompensas')
      .select('*')
      .eq('activo', true)
      .order('costo_puntos');
    if (error) throw error;
    return (data ?? []) as Recompensa[];
  }

  async sumarPuntos(usuarioId: string, puntos: number, ventaId: number): Promise<void> {
    const cantidad = Math.floor(puntos);
    if (cantidad <= 0) return;

    const { data: perfil, error } = await this.supabase.cliente
      .from('perfiles')
      .select('puntos')
      .eq('id', usuarioId)
      .single();
    if (error) throw error;

    const { error: updateError } = await this.supabase.cliente
      .from('perfiles')
      .update({ puntos: Number(perfil?.puntos ?? 0) + cantidad })
      .eq('id', usuarioId);
    if (updateError) {
      throw new Error(`No se pudieron actualizar los puntos: ${updateError.message}`);
    }

    const { error: movimientoError } = await this.supabase.cliente
      .from('fidelizacion_movimientos')
      .insert({
        usuario_id: usuarioId,
        venta_id: ventaId,
        tipo: 'compra',
        puntos: cantidad,
        detalle: 'Puntos por compra',
      });
    if (movimientoError) throw movimientoError;
  }

  async obtenerCanjes(usuarioId: string): Promise<any[]> {
    const { data, error } = await this.supabase.cliente
      .from('fidelizacion_movimientos')
      .select('id,puntos,detalle,fecha_creacion')
      .eq('usuario_id', usuarioId)
      .eq('tipo', 'canje')
      .order('fecha_creacion', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((item: any) => ({
      id: item.id,
      puntos: Math.abs(Number(item.puntos)),
      nombre: item.detalle?.match(/^Canje: (.+?) \| Código:/)?.[1] ?? 'Recompensa',
      codigo: item.detalle?.match(/Código: ([A-Z0-9]+)/)?.[1] ?? '—',
      fecha_creacion: item.fecha_creacion,
    }));
  }

  async canjearRecompensa(id: number): Promise<string> {
    const usuario = (await this.supabase.cliente.auth.getUser()).data.user;
    if (!usuario) throw new Error('Iniciá sesión.');

    const { data: recompensa, error } = await this.supabase.cliente
      .from('fidelizacion_recompensas')
      .select('*')
      .eq('id', id)
      .eq('activo', true)
      .single();
    if (error) throw error;

    const { data: perfil, error: perfilError } = await this.supabase.cliente
      .from('perfiles')
      .select('puntos')
      .eq('id', usuario.id)
      .single();
    if (perfilError) throw perfilError;

    const costo = Number(recompensa.costo_puntos);
    if (Number(perfil.puntos ?? 0) < costo) {
      throw new Error('No tenés puntos suficientes.');
    }

    const codigo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.slice(0, 10).toUpperCase();

    const { error: updateError } = await this.supabase.cliente
      .from('perfiles')
      .update({ puntos: Number(perfil.puntos) - costo })
      .eq('id', usuario.id);
    if (updateError) {
      throw new Error(`No se pudieron actualizar los puntos: ${updateError.message}`);
    }

    const { error: movimientoError } = await this.supabase.cliente
      .from('fidelizacion_movimientos')
      .insert({
        usuario_id: usuario.id,
        tipo: 'canje',
        puntos: -costo,
        detalle: `Canje: ${recompensa.nombre} | Código: ${codigo}`,
      });
    if (movimientoError) {
      // Si falla el historial, devolvemos los puntos para no dejar al usuario con un saldo incorrecto.
      await this.supabase.cliente
        .from('perfiles')
        .update({ puntos: Number(perfil.puntos) })
        .eq('id', usuario.id);
      throw new Error(`No se pudo guardar el canje: ${movimientoError.message}`);
    }

    return codigo;
  }

  async activarAlerta(usuarioId: string, peliculaId: number): Promise<void> {
    const { error } = await this.supabase.cliente
      .from('alertas_estreno')
      .upsert({ usuario_id: usuarioId, pelicula_id: peliculaId }, { onConflict: 'usuario_id,pelicula_id' });
    if (error) throw error;
  }

  async configurarPreventa(peliculaId: number, activa: boolean, precio: number | null): Promise<void> {
    const { error } = await this.supabase.cliente
      .from('peliculas')
      .update({ preventa_activa: activa, precio_preventa: precio })
      .eq('id', peliculaId);
    if (error) throw error;
  }

  async crearCupon(codigo: string, porcentaje: number, primeraCompra: boolean, edadMinima: number): Promise<void> {
    const { error } = await this.supabase.cliente
      .from('cupones')
      .insert({
        codigo: codigo.trim().toUpperCase(),
        porcentaje,
        primera_compra: primeraCompra,
        edad_minima: edadMinima,
        activo: true,
      });
    if (error) throw error;
  }

  async crearRecompensa(nombre: string, costo: number): Promise<void> {
    const { error } = await this.supabase.cliente
      .from('fidelizacion_recompensas')
      .insert({ nombre, tipo: 'entrada', costo_puntos: costo, activo: true });
    if (error) throw error;
  }

  async crearCombo(nombre: string, precio: number, descripcion: string, productoId: number, cantidad: number): Promise<void> {
    const { data, error } = await this.supabase.cliente
      .from('combos')
      .insert({ nombre, precio, descripcion, activo: true })
      .select('id')
      .single();
    if (error) throw error;

    const { error: itemError } = await this.supabase.cliente
      .from('combo_items')
      .insert({ combo_id: data.id, producto_id: productoId, cantidad });
    if (itemError) throw itemError;
  }
}
