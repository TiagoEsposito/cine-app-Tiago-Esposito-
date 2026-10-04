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

  obtenerPrecioAsiento(asiento: Asiento): number {
    const precioBase = this.compra.funcion()?.precio ?? 0;

    return asiento.tipo === 'vip'
      ? precioBase * 1.5
      : precioBase;
  }

  obtenerTotal(): number { return this.compra.venta()?.total ?? 0; }

  descargarPdf(): void {
    window.print();
  }
}
