/**
 * Implementa la lógica de cartelera dentro de la aplicación Cine Avellaneda.
 */
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Pelicula } from '../../models/pelicula.model';
import { PeliculasService } from '../../servicios/peliculas.service';
import { Resena } from '../../models/resena.model';
import { AuthService } from '../../servicios/auth.service';
import { Funcion } from '../../models/funcion.model';
import { FuncionesService } from '../../servicios/funciones.service';
import { RouterLink } from '@angular/router';
import { BeneficiosService } from '../../servicios/beneficios.service';

@Component({
  selector: 'app-cartelera',
  templateUrl: './cartelera.html',
  styleUrl: './cartelera.scss',
  imports: [RouterLink],
})
export class Cartelera implements OnInit {
  private readonly peliculasService = inject(PeliculasService);
  private readonly funcionesService = inject(FuncionesService);
  private readonly beneficios = inject(BeneficiosService);
  readonly auth = inject(AuthService);

  readonly peliculas = signal<Pelicula[]>([]);
  readonly error = signal<string | null>(null);
  readonly cargando = signal(true);

  readonly busqueda = signal('');

  readonly generos = signal<{ id: number; nombre: string }[]>([]);
  readonly generoSeleccionado = signal<number | null>(null);

  readonly resenas = signal<Record<number, Resena[]>>({});
  readonly funciones = signal<Record<number, Funcion[]>>({});
  readonly puntuacionSeleccionada = signal(0);
  readonly comentarioResena = signal('');
  readonly publicandoResena = signal(false);
  readonly errorResena = signal<string | null>(null);
  readonly proximamente = signal<Pelicula[]>([]);
  readonly preventa = signal<Pelicula[]>([]);
  readonly destacadas = signal<{
    id: number;
    titulo: string;
    url_poster: string | null;
    entradas: number;
  }[]>([]);

  /** Activa una alerta de estreno para una película. */
  async activarAlerta(pelicula: Pelicula): Promise<void> {
    const usuario = this.auth.perfil();
    if (!usuario) {
      this.error.set('Iniciá sesión para activar una alerta.');
      return;
    }

    try {
      await this.beneficios.activarAlerta(usuario.id, pelicula.id);

      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Cine Avellaneda', {
          body: `Te avisaremos cuando ${pelicula.titulo} esté disponible.`,
        });
      }

      this.error.set(null);
    } catch (e) {
      this.error.set(
        e instanceof Error ? e.message : 'No se pudo activar la alerta.'
      );
    }
  }

  readonly peliculasFiltradas = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const genero = this.generoSeleccionado();

    return this.peliculas().filter((pelicula) => {
      const coincideTitulo =
        !texto || pelicula.titulo.toLowerCase().includes(texto);

      const coincideGenero =
        genero === null ||
        pelicula.generos?.some((g) => g.id === genero);

      return coincideTitulo && coincideGenero;
    });
  });

  /** Inicializa el componente y carga los datos necesarios al entrar en la pantalla. */
  async ngOnInit(): Promise<void> {
    try {
      const [peliculas, generos] = await Promise.all([
        this.peliculasService.obtenerPeliculas(),
        this.peliculasService.obtenerGeneros(),
      ]);

      this.peliculas.set(peliculas);
      try {
        this.destacadas.set(await this.peliculasService.obtenerTop3Vendidas());
      } catch {
        this.destacadas.set([]);
      }

      const ahora = new Date();
      const peliculasPreventa = peliculas.filter((p) => {
        if (!p.preventa_activa || !p.fecha_estreno || p.precio_preventa == null) return false;
        const estreno = new Date(`${p.fecha_estreno}T00:00:00`);
        const inicioPreventa = new Date(estreno);
        inicioPreventa.setDate(inicioPreventa.getDate() - 7);
        return ahora >= inicioPreventa && ahora < estreno;
      });

      this.preventa.set(peliculasPreventa);
      this.proximamente.set(
        peliculas.filter(
          p => p.fecha_estreno && new Date(`${p.fecha_estreno}T00:00:00`) > ahora
        )
      );
      this.generos.set(generos);

      const resenasPorPelicula = await Promise.all(
        peliculas.map(async (pelicula) => {
          const resenas = await this.peliculasService.obtenerResenas(pelicula.id);
          return [pelicula.id, resenas] as const;
        })
      );
      this.resenas.set(Object.fromEntries(resenasPorPelicula));

      const funcionesPorPelicula = await Promise.all(
        peliculas.map(async (pelicula) => {
          const funciones = await this.funcionesService.obtenerFunciones(pelicula.id);
          return [pelicula.id, funciones] as const;
        })
      );
      this.funciones.set(Object.fromEntries(funcionesPorPelicula));
    } catch (error: unknown) {
      const mensaje = error instanceof Error
        ? error.message
        : 'Error al cargar la cartelera.';
      this.error.set(mensaje);
    } finally {
      this.cargando.set(false);
    }
  }
readonly promedios = computed(() => {
  const resultado: Record<number, number> = {};

  for (const [peliculaId, resenas] of Object.entries(this.resenas())) {
    if (resenas.length === 0) {
      continue;
    }

    const suma = resenas.reduce(
      (total, resena) => total + resena.puntuacion,
      0
    );

    resultado[Number(peliculaId)] = suma / resenas.length;
  }

  return resultado;
});
/** Valida y publica una reseña escrita por el usuario. */
async publicarResena(peliculaId: number): Promise<void> {
  const usuarioId = this.auth.sesion()?.user.id;
  const puntuacion = this.puntuacionSeleccionada();
  const comentario = this.comentarioResena().trim();

  if (!usuarioId) {
    this.errorResena.set('Tenés que iniciar sesión para publicar una reseña.');
    return;
  }

  if (puntuacion === 0) {
    this.errorResena.set('Seleccioná una puntuación.');
    return;
  }

  if (!comentario) {
    this.errorResena.set('Escribí un comentario.');
    return;
  }

  this.publicandoResena.set(true);
  this.errorResena.set(null);

  try {
    const nuevaResena = await this.peliculasService.crearResena(
      peliculaId,
      usuarioId,
      puntuacion,
      comentario
    );

    this.resenas.update((actuales) => ({
      ...actuales,
      [peliculaId]: [
        nuevaResena,
        ...(actuales[peliculaId] ?? []),
      ],
    }));

    this.puntuacionSeleccionada.set(0);
    this.comentarioResena.set('');
  } catch (error: unknown) {
    const mensaje =
      error instanceof Error
        ? error.message
        : 'No se pudo publicar la reseña.';

    this.errorResena.set(mensaje);
  } finally {
    this.publicandoResena.set(false);
  }
}

}