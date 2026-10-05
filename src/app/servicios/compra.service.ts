/**
 * Implementa la lógica de compra dentro de la aplicación Cine Avellaneda.
 */
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
  readonly requiereAdulto = signal(false);

  /** Guarda temporalmente la función y los asientos seleccionados para continuar la compra. */
  guardarSeleccion(funcion: Funcion, asientos: Asiento[]): void {
    this.funcion.set(funcion); this.asientos.set(asientos); this.candy.set([]); this.combos.set([]); this.cupon.set(null); this.venta.set(null); this.requiereAdulto.set(false);
  }
  /** Agrega un producto de Candy Bar al carrito o aumenta su cantidad. */
  agregarCandy(item: CandyItem): void {
    this.candy.update(actual => {
      const existente = actual.find(x => x.id === item.id);
      if (existente) return actual.map(x => x.id === item.id ? { ...x, cantidad: x.cantidad + 1 } : x);
      return [...actual, { ...item, cantidad: 1 }];
    });
  }
  /** Reduce en uno la cantidad de un producto de Candy Bar. */
  quitarCandy(id: number): void {
    this.candy.update(actual => actual.flatMap(x =>
      x.id === id
        ? (x.cantidad > 1 ? [{ ...x, cantidad: x.cantidad - 1 }] : [])
        : [x]
    ));
  }
  /** Elimina por completo un producto de Candy Bar del carrito. */
  eliminarCandy(id: number): void { this.candy.update(actual => actual.filter(x => x.id !== id)); }

  /** Comprueba si todavía se puede agregar un combo que incluye entrada. */
  puedeAgregarCombo(combo: Combo): boolean {
    if (!combo.incluye_entrada) return true;
    const cantidadActual = this.combos()
      .filter(item => item.incluye_entrada)
      .reduce((total, item) => total + item.cantidad, 0);
    return cantidadActual < this.asientos().length;
  }

  /** Agrega un combo al carrito respetando el límite de entradas disponibles. */
  agregarCombo(combo: Combo): void {
    if (!this.puedeAgregarCombo(combo)) return;
    this.combos.update(actual => {
      const existe = actual.find(x => x.id === combo.id);
      return existe
        ? actual.map(x => x.id === combo.id ? { ...x, cantidad: x.cantidad + 1 } : x)
        : [...actual, { ...combo, cantidad: 1 }];
    });
  }

  /** Reduce en uno la cantidad de un combo del carrito. */
  quitarCombo(comboId: number): void {
    this.combos.update(actual => actual.flatMap(combo =>
      combo.id === comboId
        ? (combo.cantidad > 1 ? [{ ...combo, cantidad: combo.cantidad - 1 }] : [])
        : [combo]
    ));
  }

  /** Convierte los productos sueltos y los productos incluidos en combos en el detalle que se registra en la venta. */
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

  /** Calcula el total correspondiente a productos y combos de Candy Bar. */
  totalCandy(): number {
    const productos = this.candy().reduce((total, item) => total + item.precio * item.cantidad, 0);
    const combos = this.combos().reduce((total, combo) => total + combo.precio * combo.cantidad, 0);
    return productos + combos;
  }

  /** Calcula el subtotal de entradas, combos con entrada y Candy Bar antes del descuento. */
  subtotal(): number {
    const entradas = this.asientos().reduce(
      (total, asiento) => total + this.obtenerPrecioAsiento(asiento),
      0
    );

    const combosConEntrada = this.combos().reduce(
      (total, combo) => total + (combo.incluye_entrada ? combo.cantidad * (this.funcion()?.precio ?? 0) : 0),
      0
    );

    return Math.max(0, entradas - combosConEntrada) + this.totalCandy();
  }

  /** Obtiene el precio calculado del asiento desde el servicio de compra. */
  obtenerPrecioAsiento(asiento: Asiento): number {
    const base = this.funcion()?.precio ?? 0;
    return asiento.tipo === 'vip' ? base * 1.5 : base;
  }

  /** Calcula el importe de descuento que corresponde al cupón aplicado. */
  descuento(): number { return this.cupon() ? this.subtotal() * (this.cupon()!.porcentaje / 100) : 0; }
  /** Calcula el total final de la compra después de aplicar el descuento. */
  total(): number { return Math.max(0, this.subtotal() - this.descuento()); }
  /** Busca y valida un cupón antes de aplicarlo a la compra. */
  aplicarCupon(cupon: Cupon): void { this.cupon.set(cupon); }
  /** Quita el cupón aplicado a la compra actual. */
  quitarCupon(): void { this.cupon.set(null); }
  /** Guarda en el estado de compra los datos de la venta creada. */
  guardarVenta(venta: VentaCreada): void { this.venta.set(venta); }
  /** Comprueba si existe una función y al menos un asiento seleccionado. */
  tieneSeleccion(): boolean { return this.funcion() !== null && this.asientos().length > 0; }
  /** Comprueba si la compra ya tiene una venta confirmada. */
  tieneVenta(): boolean { return this.venta() !== null; }
  /** Vuelve a la pantalla de selección de asientos para modificar la compra. */
  volverAAsientos(): void { const funcion = this.funcion(); if (funcion) void this.router.navigate(['/funcion', funcion.id]); }
  /** Reinicia todos los datos temporales de la compra. */
  limpiar(): void { this.funcion.set(null); this.asientos.set([]); this.candy.set([]); this.combos.set([]); this.cupon.set(null); this.venta.set(null); this.requiereAdulto.set(false); }
}
