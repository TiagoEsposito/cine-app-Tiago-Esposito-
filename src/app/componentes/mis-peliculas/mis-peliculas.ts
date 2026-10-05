/**
 * Implementa la lógica de mis peliculas dentro de la aplicación Cine Avellaneda.
 */
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../servicios/auth.service';
import { ComprasService } from '../../servicios/compras.service';
import { PeliculasService } from '../../servicios/peliculas.service';
import { CompraHistorial } from '../../models/compra.model';

@Component({
  selector: 'app-mis-peliculas',
  templateUrl: './mis-peliculas.html',
  styleUrl: './mis-peliculas.scss',
  imports: [RouterLink],
})
export class MisPeliculas implements OnInit {
  readonly auth = inject(AuthService);
  private readonly comprasService = inject(ComprasService);
  private readonly peliculasService = inject(PeliculasService);

  readonly compras = signal<CompraHistorial[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly misPuntuaciones = signal<Map<number, number>>(new Map());

  /** Inicializa el componente y carga los datos necesarios al entrar en la pantalla. */
  async ngOnInit(): Promise<void> {
    await this.auth.listo;
    const usuarioId = this.auth.perfil()?.id;
    if (!usuarioId) {
      this.error.set('No se pudo recuperar tu perfil.');
      this.cargando.set(false);
      return;
    }

    try {
      const [historial, resenas] = await Promise.all([
        this.comprasService.obtenerHistorial(usuarioId),
        this.peliculasService.obtenerResenasDelUsuario(usuarioId),
      ]);

      this.compras.set(historial.filter((compra) => compra.estado === 'pagada'));

      this.misPuntuaciones.set(
        new Map(resenas.map((resena) => [resena.pelicula_id, resena.puntuacion]))
      );
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cargar tus películas.');
    } finally {
      this.cargando.set(false);
    }
  }

  /** Formatea una fecha para mostrarla de forma legible. */
  formatearFecha(fecha: string): string {
    return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(`${fecha}T12:00:00`));
  }

  /** Obtiene todos los asientos de una sala ordenados por fila y número. */
  obtenerAsientos(compra: CompraHistorial): string {
    return compra.asientos.map((asiento) => `${asiento.fila}${asiento.numero}`).join(', ');
  }
}
