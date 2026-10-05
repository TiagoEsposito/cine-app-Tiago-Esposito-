/**
 * Implementa la lógica de peliculas dentro de la aplicación Cine Avellaneda.
 */
import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Pelicula } from '../models/pelicula.model';
import { Resena } from '../models/resena.model';
import { ActividadService } from './actividad.service';

export interface PeliculaVendida {
  id: number;
  titulo: string;
  url_poster: string | null;
  entradas: number;
}

@Injectable({ providedIn: 'root' })
export class PeliculasService {
  private readonly supabase = inject(SupabaseService);
  private readonly actividad = inject(ActividadService);

  /** Obtiene las películas desde Supabase, pudiendo limitarse a las que están activas. */
  async obtenerPeliculas(soloActivas = true): Promise<Pelicula[]> {
    let consulta = this.supabase.cliente
      .from('peliculas')
      .select('*, generos(id, nombre)')
      .order('fecha_estreno', { ascending: false });

    if (soloActivas) {
      consulta = consulta.eq('activa', true);
    }

    const { data, error } = await consulta;

    if (error) throw error;
    return (data ?? []) as Pelicula[];
  }

  /** Obtiene la lista de géneros disponibles para filtros y formularios. */
  async obtenerGeneros(): Promise<{ id: number; nombre: string }[]> {
    const { data, error } = await this.supabase.cliente
      .from('generos')
      .select('id, nombre')
      .order('nombre');

    if (error) throw error;
    return data ?? [];
  }

  /** Calcula las tres películas con más entradas vendidas. */
  async obtenerTop3Vendidas(): Promise<PeliculaVendida[]> {
    const { data, error } = await this.supabase.cliente
      .from('ventas')
      .select(`
        estado,
        venta_asientos(asiento_id,activo),
        funciones(
          pelicula_id,
          peliculas(id,titulo,url_poster)
        )
      `)
      .eq('estado', 'pagada');

    if (error) throw error;

    const mapa = new Map<number, PeliculaVendida>();

    for (const venta of data ?? []) {
      const funcion = (venta as any).funciones;
      const pelicula = funcion?.peliculas;
      if (!pelicula) continue;

      const entradas = ((venta as any).venta_asientos ?? [])
        .filter((item: any) => item.activo !== false).length;

      if (!entradas) continue;

      const actual = mapa.get(Number(pelicula.id)) ?? {
        id: Number(pelicula.id),
        titulo: pelicula.titulo,
        url_poster: pelicula.url_poster ?? null,
        entradas: 0,
      };

      actual.entradas += entradas;
      mapa.set(actual.id, actual);
    }

    return [...mapa.values()]
      .sort((a, b) => b.entradas - a.entradas)
      .slice(0, 3);
  }

  /** Obtiene las reseñas públicas de una película. */
  async obtenerResenas(peliculaId: number): Promise<Resena[]> {
    const { data, error } = await this.supabase.cliente
      .from('reseñas_publicas')
      .select('*')
      .eq('pelicula_id', peliculaId)
      .order('fecha_creacion', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((resena: any) => ({
      id: resena.id,
      pelicula_id: resena.pelicula_id,
      usuario_id: resena.usuario_id,
      puntuacion: resena.puntuacion,
      comentario: resena.comentario,
      fecha_creacion: resena.fecha_creacion,
      usuario: {
        nombre: resena.nombre ?? 'Usuario',
        apellido: resena.apellido ?? '',
      },
    }));
  }

  /** Obtiene las puntuaciones que realizó un usuario sobre películas. */
  async obtenerResenasDelUsuario(
    usuarioId: string
  ): Promise<{ pelicula_id: number; puntuacion: number }[]> {
    const { data, error } = await this.supabase.cliente
      .from('reseñas')
      .select('pelicula_id, puntuacion')
      .eq('usuario_id', usuarioId);

    if (error) throw error;

    return (data ?? []).map((resena: any) => ({
      pelicula_id: Number(resena.pelicula_id),
      puntuacion: Number(resena.puntuacion),
    }));
  }

  /** Busca la reseña que un usuario ya realizó para una película. */
  async obtenerResenaDelUsuario(
    peliculaId: number,
    usuarioId: string
  ): Promise<Resena | null> {
    const { data, error } = await this.supabase.cliente
      .from('reseñas')
      .select('*')
      .eq('pelicula_id', peliculaId)
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (error) throw error;
    return data as Resena | null;
  }

  /** Crea una nueva reseña para una película y controla si ya existe una reseña del usuario. */
  async crearResena(
    peliculaId: number,
    usuarioId: string,
    puntuacion: number,
    comentario: string
  ): Promise<Resena> {
    const { data, error } = await this.supabase.cliente
      .from('reseñas')
      .insert({
        pelicula_id: peliculaId,
        usuario_id: usuarioId,
        puntuacion,
        comentario,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Ya dejaste una reseña para esta película.');
      }
      throw error;
    }

    return data as Resena;
  }

  /** Busca una película concreta por su ID. */
  async obtenerPelicula(id: number): Promise<Pelicula | null> {
    const { data, error } = await this.supabase.cliente
      .from('peliculas')
      .select('*, generos(id, nombre)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Pelicula;
  }

  /** Actualiza los datos de una película en Supabase y registra la actividad. */
  async actualizarPelicula(
    id: number,
    cambios: {
      titulo: string;
      sinopsis: string;
      duracion_minutos: number;
      url_poster: string | null;
      edad_minima: number;
      fecha_estreno: string | null;
      activa: boolean;
    }
  ): Promise<void> {
    const { error } = await this.supabase.cliente
      .from('peliculas')
      .update(cambios)
      .eq('id', id);

    if (error) throw error;
    await this.actividad.registrar('Modificar película', `Película #${id} · precio/edad/datos actualizados`);
  }

  /** Registra que una película fue visualizada para estadísticas. */
  async registrarVista(peliculaId: number, usuarioId: string | null): Promise<void> {
    const { error } = await this.supabase.cliente
      .from('pelicula_vistas')
      .insert({
        pelicula_id: peliculaId,
        usuario_id: usuarioId,
      });

    if (error) throw error;
  }
}
