/**
 * Implementa la lógica de actividad dentro de la aplicación Cine Avellaneda.
 */
import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Actividad {
  id: number;
  usuario_id: string | null;
  accion: string;
  detalle: string;
  fecha: string;
  usuario?: { nombre: string; apellido: string; email?: string };
}

@Injectable({ providedIn: 'root' })
export class ActividadService {
  private readonly supabase = inject(SupabaseService);

  /** Registra un usuario nuevo mediante Supabase Auth y crea/carga su perfil. */
  async registrar(accion: string, detalle: string): Promise<void> {
    const usuario = (await this.supabase.cliente.auth.getUser()).data.user;

    const { error } = await this.supabase.cliente
      .from('log_actividad')
      .insert({
        usuario_id: usuario?.id ?? null,
        accion,
        detalle,
      });

    if (error) throw error;
  }

  /** Obtiene el historial de actividad registrado en el sistema. */
  async obtener(): Promise<Actividad[]> {
    const { data, error } = await this.supabase.cliente
      .from('log_actividad')
      .select('id,usuario_id,accion,detalle,fecha,perfiles(nombre,apellido,email)')
      .order('fecha', { ascending: false })
      .limit(50);

    if (error) throw error;

    return (data ?? []).map((item: any) => ({
      id: Number(item.id),
      usuario_id: item.usuario_id,
      accion: item.accion,
      detalle: item.detalle,
      fecha: item.fecha,
      usuario: item.perfiles
        ? {
            nombre: item.perfiles.nombre ?? '',
            apellido: item.perfiles.apellido ?? '',
            email: item.perfiles.email ?? '',
          }
        : undefined,
    }));
  }
}
