/**
 * Implementa la lógica de funciones dentro de la aplicación Cine Avellaneda.
 */
import { inject, Injectable } from '@angular/core';
import { Funcion } from '../models/funcion.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class FuncionesService {
  private readonly supabase = inject(SupabaseService);

  /** Aplica el precio de preventa a las funciones que estén dentro del período configurado. */
  private aplicarPreventa(funciones: Funcion[], peliculas: any[]): Funcion[] {
    const hoy = new Date();
    return funciones.map(f => {
      const pelicula = peliculas.find(p => p.id === f.pelicula_id);
      if (!pelicula?.preventa_activa || !pelicula?.fecha_estreno) return f;
      const estreno = new Date(`${pelicula.fecha_estreno}T00:00:00`);
      const inicio = new Date(estreno); inicio.setDate(inicio.getDate() - 7);
      const fechaFuncion = new Date(`${f.fecha}T${f.hora_inicio}`);
      const hoyInicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      const esPreventa = pelicula.precio_preventa != null && fechaFuncion >= inicio && fechaFuncion < estreno && fechaFuncion >= hoyInicio && hoy < estreno;
      return esPreventa ? { ...f, precio: Number(pelicula.precio_preventa), es_preventa: true } : f;
    });
  }

  /** Obtiene las funciones existentes, incluyendo sus películas y salas relacionadas. */
  async obtenerFunciones(peliculaId: number): Promise<Funcion[]> {
    const { data, error } = await this.supabase.cliente.from('funciones').select('*').eq('pelicula_id', peliculaId).order('fecha').order('hora_inicio');
    if (error) throw error;
    const { data: peliculas } = await this.supabase.cliente.from('peliculas').select('id,preventa_activa,precio_preventa,fecha_estreno').eq('id', peliculaId);
    return this.aplicarPreventa((data ?? []) as Funcion[], peliculas ?? []);
  }

  /** Obtiene una función concreta por su ID. */
  async obtenerFuncion(id: number): Promise<Funcion | null> {
    const { data, error } = await this.supabase.cliente.from('funciones').select('*').eq('id', id).single();
    if (error) throw error;
    const { data: peliculas } = await this.supabase.cliente.from('peliculas').select('id,preventa_activa,precio_preventa,fecha_estreno').eq('id', data.pelicula_id);
    return this.aplicarPreventa([data as Funcion], peliculas ?? [])[0] ?? null;
  }
}
