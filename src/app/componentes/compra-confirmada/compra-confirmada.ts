/**
 * Implementa la lógica de compra confirmada dentro de la aplicación Cine Avellaneda.
 */
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { CompraService } from '../../servicios/compra.service';
import { Asiento } from '../../models/asiento.model';

@Component({
  selector: 'app-compra-confirmada',
  templateUrl: './compra-confirmada.html',
  styleUrl: './compra-confirmada.scss',
  imports: [RouterLink, QRCodeComponent],
})
export class CompraConfirmada {
  readonly compra = inject(CompraService);

  /** Obtiene el precio calculado del asiento desde el servicio de compra. */
  obtenerPrecioAsiento(asiento: Asiento): number {
    const precioBase = this.compra.funcion()?.precio ?? 0;

    return asiento.tipo === 'vip'
      ? precioBase * 1.5
      : precioBase;
  }

  /** Obtiene el total de la venta confirmada. */
  obtenerTotal(): number { return this.compra.venta()?.total ?? 0; }

  /** Abre la impresión del comprobante para guardarlo como PDF. */
  descargarPdf(): void {
    window.print();
  }
}
