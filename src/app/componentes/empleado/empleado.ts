/**
 * Implementa la lógica de empleado dentro de la aplicación Cine Avellaneda.
 */
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmpleadoService, RecompensaCanje, VentaQr } from '../../servicios/empleado.service';

@Component({
  selector: 'app-empleado',
  templateUrl: './empleado.html',
  styleUrl: './empleado.scss',
  imports: [FormsModule],
})
export class Empleado {
  private readonly servicio = inject(EmpleadoService);

  codigoCompra = '';
  codigoRecompensa = '';

  readonly compra = signal<VentaQr | null>(null);
  readonly recompensa = signal<RecompensaCanje | null>(null);
  readonly mensajeCompra = signal('');
  readonly mensajeRecompensa = signal('');
  readonly errorCompra = signal('');
  readonly errorRecompensa = signal('');
  readonly cargandoCompra = signal(false);
  readonly cargandoRecompensa = signal(false);

  /** Busca una compra exclusivamente por el código asociado a su QR. */
  async buscarCompra(): Promise<void> {
    this.errorCompra.set('');
    this.mensajeCompra.set('');
    this.compra.set(null);

    if (!this.codigoCompra.trim()) {
      this.errorCompra.set('Ingresá el código de la compra.');
      return;
    }

    this.cargandoCompra.set(true);
    try {
      this.compra.set(await this.servicio.buscarCompraPorQr(this.codigoCompra));
    } catch (e) {
      this.errorCompra.set(e instanceof Error ? e.message : 'No se pudo buscar la compra.');
    } finally {
      this.cargandoCompra.set(false);
    }
  }

  /** Valida la compra encontrada y registra la entrada y el Candy Bar, si corresponde. */
  async validarCompra(): Promise<void> {
    this.errorCompra.set('');
    this.mensajeCompra.set('');
    this.cargandoCompra.set(true);

    try {
      const venta = await this.servicio.validarQr(this.codigoCompra);
      this.compra.set(venta);
      const tieneCandy = (venta.detalle_compra?.combos?.length ?? 0) > 0
        || (venta.detalle_compra?.candy?.length ?? 0) > 0
        || (venta.productos?.length ?? 0) > 0;
      this.mensajeCompra.set(
        tieneCandy
          ? 'Compra validada correctamente. Entrada y Candy Bar registrados.'
          : 'Entrada validada correctamente.'
      );
    } catch (e) {
      this.errorCompra.set(e instanceof Error ? e.message : 'No se pudo validar la compra.');
    } finally {
      this.cargandoCompra.set(false);
    }
  }

  /** Busca exclusivamente un código generado al canjear una recompensa con puntos. */
  async buscarRecompensa(): Promise<void> {
    this.errorRecompensa.set('');
    this.mensajeRecompensa.set('');
    this.recompensa.set(null);

    if (!this.codigoRecompensa.trim()) {
      this.errorRecompensa.set('Ingresá el código de la recompensa.');
      return;
    }

    this.cargandoRecompensa.set(true);
    try {
      this.recompensa.set(await this.servicio.buscarRecompensaPorCodigo(this.codigoRecompensa));
    }
     finally {
      this.cargandoRecompensa.set(false);
    }
  }

  /** Valida el código de recompensa y lo marca como utilizado. */
  async validarRecompensa(): Promise<void> {
    this.errorRecompensa.set('');
    this.mensajeRecompensa.set('');
    this.cargandoRecompensa.set(true);

    try {
      const recompensa = await this.servicio.validarRecompensa(this.codigoRecompensa);
      this.recompensa.set(recompensa);
      this.mensajeRecompensa.set(`Recompensa validada correctamente: ${recompensa.nombre}.`);
    }
     finally {
      this.cargandoRecompensa.set(false);
    }
  }
}
