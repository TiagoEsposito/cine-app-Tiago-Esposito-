import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmpleadoService, VentaQr } from '../../servicios/empleado.service';

@Component({
  selector: 'app-empleado',
  templateUrl: './empleado.html',
  styleUrl: './empleado.scss',
  imports: [FormsModule],
})
export class Empleado {
  private readonly servicio = inject(EmpleadoService);
  codigo = '';
  readonly venta = signal<VentaQr | null>(null);
  readonly mensaje = signal('');
  readonly error = signal('');
  readonly cargando = signal(false);

  async buscar(): Promise<void> {
    this.error.set('');
    this.mensaje.set('');
    this.venta.set(null);
    if (!this.codigo.trim()) {
      this.error.set('Ingresá el código que figura en el QR.');
      return;
    }

    this.cargando.set(true);
    try {
      this.venta.set(await this.servicio.buscarPorQr(this.codigo));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo buscar la compra.');
    } finally {
      this.cargando.set(false);
    }
  }

  async validar(): Promise<void> {
    this.error.set('');
    this.mensaje.set('');
    this.cargando.set(true);

    try {
      const venta = await this.servicio.validarQr(this.codigo);
      this.venta.set(venta);
      const tieneCandy = (venta.detalle_compra?.combos?.length ?? 0) > 0
        || (venta.detalle_compra?.candy?.length ?? 0) > 0
        || (venta.productos?.length ?? 0) > 0;
      this.mensaje.set(
        tieneCandy
          ? 'Compra validada correctamente. Entrada y Candy Bar registrados.'
          : 'Entrada validada correctamente.'
      );
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo validar el QR.');
    } finally {
      this.cargando.set(false);
    }
  }
}
