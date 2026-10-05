/**
 * Implementa la lógica de admin dentro de la aplicación Cine Avellaneda.
 */
import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Sala } from '../models/sala.model';
import { Funcion } from '../models/funcion.model';
import { Combo, Cupon, Recompensa } from '../models/beneficios.model';
import { CandyCategoria, CandyProducto } from '../models/candy.model';
import { ActividadService } from './actividad.service';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly supabase = inject(SupabaseService);
  private readonly actividad = inject(ActividadService);

  /** Obtiene las salas disponibles del cine. */
  async obtenerSalas(): Promise<Sala[]> {
    const { data, error } = await this.supabase.cliente
      .from('salas')
      .select('*')
      .order('id');

    if (error) throw error;
    return data ?? [];
  }

  /** Crea una nueva sala de cine. */
  async crearSala(nombre: string): Promise<Sala> {
    const { data, error } = await this.supabase.cliente
      .from('salas')
      .insert({ nombre })
      .select()
      .single();

    if (error) throw error;
    await this.actividad.registrar('Crear sala', `Sala: ${nombre}`);
    return data;
  }

  /** Genera los asientos de una sala según su distribución y tipo. */
  async generarAsientos(salaId: number): Promise<number> {
    const { data: existentes, error: existentesError } = await this.supabase.cliente
      .from('asientos')
      .select('fila,numero')
      .eq('sala_id', salaId);

    if (existentesError) throw existentesError;

    const clave = new Set(
      (existentes ?? []).map(
        (a: { fila: string; numero: number }) => `${a.fila}-${a.numero}`
      )
    );

    const filas = 'ABCDEFGHIJKLMNOPQRST'.split('');
    const nuevos: {
      sala_id: number;
      fila: string;
      numero: number;
      tipo: 'normal' | 'accesible' | 'vip';
    }[] = [];

    for (const fila of filas) {
      const numeros =
        fila === 'J' || fila === 'K'
          ? [1, 2, 15, 16]
          : Array.from({ length: 28 }, (_, i) => i + 1);

      for (const numero of numeros) {
        const tipo =
          fila === 'J' || fila === 'K'
            ? 'accesible'
            : ['R', 'S', 'T'].includes(fila)
              ? 'vip'
              : 'normal';

        if (!clave.has(`${fila}-${numero}`)) {
          nuevos.push({ sala_id: salaId, fila, numero, tipo });
        }
      }
    }

    if (!nuevos.length) return 0;

    const { error } = await this.supabase.cliente
      .from('asientos')
      .insert(nuevos);

    if (error) throw error;
    await this.actividad.registrar('Generar butacas', `Sala #${salaId}: ${nuevos.length} butacas`);
    return nuevos.length;
  }

  /** Obtiene las funciones existentes, incluyendo sus películas y salas relacionadas. */
  async obtenerFunciones(): Promise<Funcion[]> {
    const { data, error } = await this.supabase.cliente
      .from('funciones')
      .select('*')
      .order('fecha')
      .order('hora_inicio');

    if (error) throw error;
    return data ?? [];
  }

  /** Crea una función asignando automáticamente una sala disponible y respetando los horarios. */
  async crearFuncionAuto(
    peliculaId: number,
    fecha: string,
    horaInicio: string,
    horaFin: string,
    precio: number,
    formato: '2D' | '3D' | '4D' | '5D' = '2D',
    idioma: 'Castellano' | 'Subtitulada' = 'Castellano',
  ): Promise<number> {
    const { data: salas, error: salasError } = await this.supabase.cliente
      .from('salas')
      .select('id')
      .order('id');

    if (salasError) throw salasError;
    if (!(salas ?? []).length) throw new Error('No hay salas creadas.');

    const { data: funciones, error: funcionesError } = await this.supabase.cliente
      .from('funciones')
      .select('sala_id,hora_inicio,hora_fin')
      .eq('fecha', fecha);

    if (funcionesError) throw funcionesError;

    const inicioNuevo = this.minutos(horaInicio);
    const finNuevo = this.minutos(horaFin);

    if (finNuevo <= inicioNuevo) {
      throw new Error('La hora de fin debe ser posterior a la hora de inicio.');
    }

    const salasDisponibles = (salas ?? []).filter((sala: { id: number }) => {
      const deSala = (funciones ?? []).filter(
        (f: any) => Number(f.sala_id) === Number(sala.id)
      );

      return deSala.every((f: any) => {
        const inicio = this.minutos(f.hora_inicio);
        const fin = this.minutos(f.hora_fin);
        return fin + 30 <= inicioNuevo || finNuevo + 30 <= inicio;
      });
    });

    if (!salasDisponibles.length) {
      throw new Error('No hay una sala disponible para ese horario.');
    }

    const salaLibre = salasDisponibles.sort(
      (a: { id: number }, b: { id: number }) => {
        const cantidadA = (funciones ?? []).filter(
          (f: any) => Number(f.sala_id) === Number(a.id)
        ).length;
        const cantidadB = (funciones ?? []).filter(
          (f: any) => Number(f.sala_id) === Number(b.id)
        ).length;

        return cantidadA - cantidadB || Number(a.id) - Number(b.id);
      }
    )[0];

    const { data, error } = await this.supabase.cliente
      .from('funciones')
      .insert({
        pelicula_id: peliculaId,
        sala_id: salaLibre.id,
        fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        precio,
        formato,
        idioma,
      })
      .select('id')
      .single();

    if (error) throw error;
    await this.actividad.registrar('Crear función', `Película #${peliculaId}, sala #${salaLibre.id}, ${fecha} ${horaInicio}, precio $${precio}`);
    return Number(data.id);
  }

  /** Convierte una hora en minutos para poder comparar horarios. */
  private minutos(hora: string): number {
    const [h, m] = String(hora).slice(0, 5).split(':').map(Number);
    return h * 60 + m;
  }

  /** Obtiene los cupones configurados en el sistema. */
  async obtenerCupones(): Promise<Cupon[]> {
    const { data, error } = await this.supabase.cliente
      .from('cupones')
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  /** Crea un cupón desde el panel de administración. */
  async crearCupon(
    codigo: string,
    porcentaje: number,
    primera_compra: boolean,
    edad_minima: number
  ): Promise<void> {
    const { error } = await this.supabase.cliente
      .from('cupones')
      .insert({
        codigo: codigo.toUpperCase(),
        porcentaje,
        primera_compra,
        edad_minima,
        activo: true,
      });

    if (error) throw error;
    await this.actividad.registrar('Crear cupón', `Cupón ${codigo.toUpperCase()} · ${porcentaje}%`);
  }

  /** Obtiene las recompensas disponibles para el sistema de fidelización. */
  async obtenerRecompensas(): Promise<Recompensa[]> {
    const { data, error } = await this.supabase.cliente
      .from('fidelizacion_recompensas')
      .select('*')
      .order('costo_puntos');

    if (error) throw error;
    return data ?? [];
  }

  /** Crea una recompensa desde el panel de administración. */
  async crearRecompensa(
    nombre: string,
    tipo: 'entrada' | 'candy',
    costo_puntos: number,
    producto_id: number | null,
    cantidad: number
  ): Promise<void> {
    const { error } = await this.supabase.cliente
      .from('fidelizacion_recompensas')
      .insert({
        nombre,
        tipo,
        costo_puntos,
        producto_id: tipo === 'candy' ? producto_id : null,
        cantidad,
        activo: true,
      });

    if (error) throw error;
    await this.actividad.registrar(
      'Crear recompensa',
      `${nombre} · ${tipo} · ${costo_puntos} puntos`
    );
  }

  /** Obtiene los combos disponibles junto con sus productos incluidos. */
  async obtenerCombos(): Promise<Combo[]> {
    const { data, error } = await this.supabase.cliente
      .from('combos')
      .select(
        '*, combo_items(producto_id,cantidad,candy_productos(id,nombre,precio))'
      )
      .order('id', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  /** Crea un combo y sus productos desde el panel de administración. */
  async crearCombo(
    nombre: string,
    precio: number,
    descripcion: string,
    items: { producto_id: number; cantidad: number }[],
    incluyeEntrada = true
  ): Promise<void> {
    const { data, error } = await this.supabase.cliente
      .from('combos')
      .insert({ nombre, precio, descripcion, activo: true, incluye_entrada: incluyeEntrada })
      .select('id')
      .single();

    if (error) throw error;

    const { error: itemsError } = await this.supabase.cliente
      .from('combo_items')
      .insert(items.map(item => ({ ...item, combo_id: data.id })));

    if (itemsError) throw itemsError;
    await this.actividad.registrar('Crear combo', `${nombre} · $${precio} · entrada incluida: ${incluyeEntrada ? 'sí' : 'no'}`);
  }

  /** Guarda la configuración de preventa de una película. */
  async configurarPreventa(
    peliculaId: number,
    activa: boolean,
    precio: number | null
  ): Promise<void> {
    const { error } = await this.supabase.cliente
      .from('peliculas')
      .update({ preventa_activa: activa, precio_preventa: precio })
      .eq('id', peliculaId);

    if (error) throw error;
    await this.actividad.registrar('Modificar precio', `Preventa película #${peliculaId}: $${precio ?? 0}`);
  }

  /** Obtiene las categorías del Candy Bar. */
  async obtenerCategorias(): Promise<CandyCategoria[]> {
    const { data, error } = await this.supabase.cliente
      .from('candy_categorias')
      .select('*')
      .order('nombre');

    if (error) throw error;
    return data ?? [];
  }

  /** Obtiene los productos del Candy Bar. */
  async obtenerProductos(): Promise<CandyProducto[]> {
    const { data, error } = await this.supabase.cliente
      .from('candy_productos')
      .select('*')
      .order('nombre');

    if (error) throw error;
    return data ?? [];
  }

  /** Crea una categoría desde el panel de administración. */
  async crearCategoria(nombre: string): Promise<void> {
    const { error } = await this.supabase.cliente
      .from('candy_categorias')
      .insert({ nombre, activa: true });

    if (error) throw error;
    await this.actividad.registrar('Crear categoría', `Categoría: ${nombre}`);
  }

  /** Activa o desactiva una categoría de productos. */
  async cambiarEstadoCategoria(id: number, activa: boolean): Promise<void> {
    const { error } = await this.supabase.cliente
      .from('candy_categorias')
      .update({ activa: !activa })
      .eq('id', id);

    if (error) throw error;
    await this.actividad.registrar('Modificar categoría', `Categoría #${id}: ${activa ? 'desactivar' : 'activar'}`);
  }

  /** Crea un nuevo producto del Candy Bar. */
  async crearProducto(producto: {
    categoria_id: number;
    nombre: string;
    descripcion: string | null;
    precio: number;
    imagen_url: string | null;
  }): Promise<void> {
    const { error } = await this.supabase.cliente
      .from('candy_productos')
      .insert({ ...producto, stock: 0, activo: true });

    if (error) throw error;
    await this.actividad.registrar('Crear producto', `Producto: ${producto.nombre} · $${producto.precio}`);
  }

  /** Actualiza los datos de un producto del Candy Bar. */
  async actualizarProducto(
    id: number,
    producto: {
      categoria_id: number;
      nombre: string;
      descripcion: string | null;
      precio: number;
      imagen_url: string | null;
    }
  ): Promise<void> {
    const { error } = await this.supabase.cliente
      .from('candy_productos')
      .update(producto)
      .eq('id', id);

    if (error) throw error;
    await this.actividad.registrar('Modificar precio', `Producto #${id}: $${producto.precio}`);
  }

  /** Activa o desactiva un producto del Candy Bar. */
  async cambiarEstadoProducto(id: number, activo: boolean): Promise<void> {
    const { error } = await this.supabase.cliente
      .from('candy_productos')
      .update({ activo: !activo })
      .eq('id', id);

    if (error) throw error;
    await this.actividad.registrar('Modificar producto', `Producto #${id}: ${activo ? 'desactivar' : 'activar'}`);
  }
  /** Obtiene el registro de actividad para mostrarlo en administración. */
  async obtenerActividad() {
    return this.actividad.obtener();
  }

}
