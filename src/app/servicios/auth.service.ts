/**
 * Implementa la lógica de auth dentro de la aplicación Cine Avellaneda.
 */
import { computed, inject, Injectable, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { DatosPerfilEditable, DatosRegistro, Perfil } from '../models/perfil.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);

  readonly sesion = signal<Session | null>(null);
  readonly perfil = signal<Perfil | null>(null);

  readonly haIniciadoSesion = computed(() => this.sesion() !== null);
  readonly esAdmin = computed(() => this.perfil()?.rol === 'admin');
  readonly esStaff = computed(
    () => this.perfil()?.rol === 'admin' || this.perfil()?.rol === 'empleado',
  );

  readonly listo: Promise<void>;

  /** Inicializa el servicio y configura las suscripciones o datos necesarios para su funcionamiento. */
  constructor() {
    this.listo = this.inicializar();

    this.supabase.cliente.auth.onAuthStateChange((_evento, sesion) => {
      this.sesion.set(sesion);
      if (sesion) {
        setTimeout(() => void this.cargarPerfil(sesion.user.id), 0);
      } else {
        this.perfil.set(null);
      }
    });
  }

  /** Registra un usuario nuevo mediante Supabase Auth y crea/carga su perfil. */
  async registrar(datos: DatosRegistro): Promise<string | null> {
    const { email, password, ...resto } = datos;

    const { data, error } = await this.supabase.cliente.auth.signUp({
      email,
      password,
      options: { data: resto },
    });

    if (error) {
      return this.traducirError(error.code, error.message);
    }

    if (data.session && data.user) {
      await this.cargarPerfil(data.user.id);
    }

    return null;
  }

  /** Inicia sesión con email y contraseña y carga el perfil del usuario. */
  async iniciarSesion(email: string, password: string): Promise<string | null> {
    const { data, error } = await this.supabase.cliente.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return this.traducirError(error.code, error.message);
    }

    await this.cargarPerfil(data.user.id);
    return null;
  }


  /** Actualiza los datos editables del perfil del usuario. */
  async actualizarPerfil(datos: DatosPerfilEditable): Promise<string | null> {
    const usuarioId = this.sesion()?.user.id;

    if (!usuarioId) {
      return 'No hay una sesión activa.';
    }

    const { error } = await this.supabase.cliente
      .from('perfiles')
      .update({
        nombre: datos.nombre,
        apellido: datos.apellido,
        fecha_nacimiento: datos.fecha_nacimiento,
        tipo_sangre: datos.tipo_sangre,
        color_ojos: datos.color_ojos,
        dias_vacaciones: datos.dias_vacaciones,
      })
      .eq('id', usuarioId);

    if (error) {
      return error.message;
    }

    await this.cargarPerfil(usuarioId);
    return null;
  }

  /** Vuelve a consultar el perfil actual desde Supabase. */
  async recargarPerfil(): Promise<void> {
    const usuarioId = this.sesion()?.user.id;
    if (usuarioId) {
      await this.cargarPerfil(usuarioId);
    }
  }

  /** Suma o resta crédito del usuario y evita que quede en negativo. */
  async modificarCredito(cambio: number): Promise<void> {
    const usuarioId = this.sesion()?.user.id;
    if (!usuarioId) throw new Error('No hay una sesión activa.');

    const creditoActual = Number(this.perfil()?.credito ?? 0);
    const nuevoCredito = creditoActual + cambio;

    if (nuevoCredito < 0) {
      throw new Error('No tenés crédito suficiente.');
    }

    const { error } = await this.supabase.cliente
      .from('perfiles')
      .update({ credito: nuevoCredito })
      .eq('id', usuarioId);

    if (error) throw error;
    await this.cargarPerfil(usuarioId);
  }

  /** Cierra la sesión y redirige al usuario fuera de su perfil. */
  async cerrarSesion(): Promise<void> {
    const { error } = await this.supabase.cliente.auth.signOut();
    if (error) {
      throw error;
    }
  }

  /** Inicializa el estado de autenticación y escucha cambios de sesión. */
  private async inicializar(): Promise<void> {
    const { data, error } = await this.supabase.cliente.auth.getSession();

    if (error) {
      console.error('No se pudo recuperar la sesión:', error);
      return;
    }

    this.sesion.set(data.session);
    if (data.session) {
      await this.cargarPerfil(data.session.user.id);
    }
  }

  /** Obtiene el perfil de un usuario y actualiza el estado de autenticación. */
  private async cargarPerfil(id: string): Promise<void> {
    const { data, error } = await this.supabase.cliente
      .from('perfiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('No se pudo cargar el perfil:', error);
      this.perfil.set(null);
      return;
    }

    this.perfil.set(data as Perfil);
  }

  /** Convierte errores de autenticación de Supabase en mensajes entendibles para el usuario. */
  private traducirError(codigo: string | undefined, mensaje: string): string {
    switch (codigo) {
      case 'user_already_exists':
        return 'Ya existe una cuenta con ese email.';
      case 'weak_password':
        return 'La contraseña es muy débil.';
      case 'invalid_credentials':
        return 'Email o contraseña incorrectos.';
      case 'over_request_rate_limit':
      case 'over_email_send_rate_limit':
        return 'Demasiados intentos. Probá de nuevo en unos minutos.';
      default:
        return mensaje;
    }
  }
}
