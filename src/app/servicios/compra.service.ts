import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Asiento } from '../models/asiento.model';
import { CandyItem } from '../models/candy.model';
import { Funcion } from '../models/funcion.model';
import { Combo, Cupon } from '../models/beneficios.model';

export interface VentaCreada { id: number; codigoQr: string; total: number; }

@Injectable({ providedIn: 'root' })
export class CompraService {
  private readonly router = inject(Router);
  readonly funcion = signal<Funcion | null>(null);
  readonly asientos = signal<Asiento[]>([]);
  readonly candy = signal<CandyItem[]>([]);
  readonly combos = signal<(Combo & { cantidad: number })[]>([]);
  readonly cupon = signal<Cupon | null>(null);
  readonly venta = signal<VentaCreada | null>(null);

  guardarSeleccion(funcion: Funcion, asientos: Asiento[]): void {
    this.funcion.set(funcion); this.asientos.set(asientos); this.candy.set([]); this.combos.set([]); this.cupon.set(null); this.venta.set(null);
  }
  agregarCandy(item: CandyItem): void {
    this.candy.update(actual => {
      const existente = actual.find(x => x.id === item.id);
      if (existente) return actual.map(x => x.id === item.id ? { ...x, cantidad: x.cantidad + 1 } : x);
      return [...actual, { ...item, cantidad: 1 }];
    });
  }
  quitarCandy(id: number): void {
    this.candy.update(actual => actual.flatMap(x =>
      x.id === id
        ? (x.cantidad > 1 ? [{ ...x, cantidad: x.cantidad - 1 }] : [])
        : [x]
    ));
  }
  eliminarCandy(id: number): void { this.candy.update(actual => actual.filter(x => x.id !== id)); }

  puedeAgregarCombo(_combo: Combo): boolean {
    return true;
  }

  agregarCombo(combo: Combo): void {
    if (!this.puedeAgregarCombo(combo)) return;
    this.combos.update(actual => {
      const existe = actual.find(x => x.id === combo.id);
      return existe
        ? actual.map(x => x.id === combo.id ? { ...x, cantidad: x.cantidad + 1 } : x)
        : [...actual, { ...combo, cantidad: 1 }];
    });
  }

  quitarCombo(comboId: number): void {
    this.combos.update(actual => actual.flatMap(combo =>
      combo.id === comboId
        ? (combo.cantidad > 1 ? [{ ...combo, cantidad: combo.cantidad - 1 }] : [])
        : [combo]
    ));
  }

  productosParaVenta(): CandyItem[] {
    const productos = new Map<number, CandyItem>();

    for (const item of this.candy()) {
      productos.set(item.id, { ...item });
    }

    for (const combo of this.combos()) {
      for (const item of combo.combo_items ?? []) {
        if (!item.producto) continue;
        const actual = productos.get(item.producto.id);
        const cantidad = item.cantidad * combo.cantidad;
        if (actual) actual.cantidad += cantidad;
        else productos.set(item.producto.id, {
          id: item.producto.id,
          categoria_id: 0,
          nombre: item.producto.nombre,
          descripcion: null,
          precio: item.producto.precio,
          imagen_url: null,
          activo: true,
          cantidad
        });
      }
    }

    return [...productos.values()];
  }

  totalCandy(): number {
    const productos = this.candy().reduce((total, item) => total + item.precio * item.cantidad, 0);
    const combos = this.combos().reduce((total, combo) => total + combo.precio * combo.cantidad, 0);
    return productos + combos;
  }

  subtotal(): number {
    const entradas = this.asientos().reduce((total, asiento) => total + this.obtenerPrecioAsiento(asiento), 0);
    return entradas + this.totalCandy();
  }

  obtenerPrecioAsiento(asiento: Asiento): number {
    const base = this.funcion()?.precio ?? 0;
    return asiento.tipo === 'vip' ? base * 1.5 : base;
  }

  descuento(): number { return this.cupon() ? this.subtotal() * (this.cupon()!.porcentaje / 100) : 0; }
  total(): number { return Math.max(0, this.subtotal() - this.descuento()); }
  aplicarCupon(cupon: Cupon): void { this.cupon.set(cupon); }
  quitarCupon(): void { this.cupon.set(null); }
  guardarVenta(venta: VentaCreada): void { this.venta.set(venta); }
  tieneSeleccion(): boolean { return this.funcion() !== null && this.asientos().length > 0; }
  tieneVenta(): boolean { return this.venta() !== null; }
  volverAAsientos(): void { const funcion = this.funcion(); if (funcion) void this.router.navigate(['/funcion', funcion.id]); }
  limpiar(): void { this.funcion.set(null); this.asientos.set([]); this.candy.set([]); this.combos.set([]); this.cupon.set(null); this.venta.set(null); }
}
