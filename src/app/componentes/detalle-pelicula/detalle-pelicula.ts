/**
 * Implementa la lógica de detalle pelicula dentro de la aplicación Cine Avellaneda.
 */
import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PeliculasService } from '../../servicios/peliculas.service';
import { FuncionesService } from '../../servicios/funciones.service';
import { AuthService } from '../../servicios/auth.service';
import { Pelicula } from '../../models/pelicula.model';
import { Funcion } from '../../models/funcion.model';
import { Resena } from '../../models/resena.model';

@Component({
  selector: 'app-detalle-pelicula',
  templateUrl: './detalle-pelicula.html',
  styleUrl: './detalle-pelicula.scss',
  imports: [RouterLink, CommonModule],
})
export class DetallePelicula implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly peliculasService = inject(PeliculasService);
  private readonly funcionesService = inject(FuncionesService);
  readonly auth = inject(AuthService);

  readonly pelicula = signal<Pelicula | null>(null);
  readonly funciones = signal<Funcion[]>([]);
  readonly resenas = signal<Resena[]>([]);
  readonly miResena = signal<Resena | null>(null);
  readonly puntuacionSeleccionada = signal(0);
  readonly comentarioResena = signal('');
  readonly publicandoResena = signal(false);
  readonly errorResena = signal<string | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly promedio = computed(() => {
    const lista = this.resenas();
    if (!lista.length) return 0;
    return lista.reduce((suma, resena) => suma + resena.puntuacion, 0) / lista.length;
  });

  /** Inicializa el componente y carga los datos necesarios al entrar en la pantalla. */
  async ngOnInit(): Promise<void> {
    try {
      const id = Number(this.route.snapshot.paramMap.get('id'));
      if (!id) throw new Error('Película no encontrada.');

      await this.auth.listo;

      const [pelicula, funciones, resenas] = await Promise.all([
        this.peliculasService.obtenerPelicula(id),
        this.funcionesService.obtenerFunciones(id),
        this.peliculasService.obtenerResenas(id),
      ]);

      this.pelicula.set(pelicula);
      this.funciones.set(funciones);
      try {
        await this.peliculasService.registrarVista(id, this.auth.sesion()?.user.id ?? null);
      } catch {
        // Registrar una vista no debe impedir abrir la película.
      }
      this.resenas.set(resenas);

      const usuarioId = this.auth.sesion()?.user.id;
      if (usuarioId) {
        this.miResena.set(
          await this.peliculasService.obtenerResenaDelUsuario(id, usuarioId)
        );
      }
    } catch (error: unknown) {
      this.error.set(
        error instanceof Error ? error.message : 'No se pudo cargar la película.'
      );
    } finally {
      this.cargando.set(false);
    }
  }

  /** Selecciona la cantidad de estrellas para una reseña. */
  seleccionarPuntuacion(valor: number): void {
    this.puntuacionSeleccionada.set(valor);
  }

  /** Valida y publica una reseña escrita por el usuario. */
  async publicarResena(): Promise<void> {
    const pelicula = this.pelicula();
    const usuarioId = this.auth.sesion()?.user.id;
    const puntuacion = this.puntuacionSeleccionada();
    const comentario = this.comentarioResena().trim();

    if (!pelicula || !usuarioId) {
      this.errorResena.set('Tenés que iniciar sesión para publicar una reseña.');
      return;
    }

    if (this.miResena()) {
      this.errorResena.set('Ya dejaste una reseña para esta película.');
      return;
    }

    if (puntuacion < 1 || puntuacion > 5) {
      this.errorResena.set('Seleccioná una puntuación de 1 a 5 estrellas.');
      return;
    }

    if (comentario.length < 3) {
      this.errorResena.set('Escribí un comentario breve.');
      return;
    }

    this.publicandoResena.set(true);
    this.errorResena.set(null);

    try {
      const nueva = await this.peliculasService.crearResena(
        pelicula.id,
        usuarioId,
        puntuacion,
        comentario
      );

      const perfil = this.auth.perfil();
      const completa: Resena = {
        ...nueva,
        usuario: perfil
          ? { nombre: perfil.nombre, apellido: perfil.apellido }
          : { nombre: 'Usuario', apellido: '' },
      };

      this.resenas.update((actuales) => [completa, ...actuales]);
      this.miResena.set(completa);
      this.puntuacionSeleccionada.set(0);
      this.comentarioResena.set('');
    } catch (error: unknown) {
      this.errorResena.set(
        error instanceof Error ? error.message : 'No se pudo publicar la reseña.'
      );
    } finally {
      this.publicandoResena.set(false);
    }
  }
}
