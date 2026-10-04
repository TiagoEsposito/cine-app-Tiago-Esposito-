import { Component, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { AsientosService } from '../../servicios/asientos.service';
import { AuthService } from '../../servicios/auth.service';
import { CompraService } from '../../servicios/compra.service';
import { BeneficiosService } from '../../servicios/beneficios.service';
import { Asiento } from '../../models/asiento.model';

@Component({ selector: 'app-pago', templateUrl: './pago.html', styleUrl: './pago.scss', imports: [RouterLink] })
export class Pago {
  private readonly asientosService = inject(AsientosService);
  private readonly authService = inject(AuthService);
  private readonly beneficios = inject(BeneficiosService);
  private readonly router = inject(Router);
  readonly compra = inject(CompraService);
  readonly procesando = signal(false);
  readonly error = signal<string | null>(null);
  readonly codigoCupon = signal('');
  readonly aplicandoCupon = signal(false);

  obtenerPrecioAsiento(asiento: Asiento): number { return this.compra.obtenerPrecioAsiento(asiento); }
  obtenerSubtotal(): number { return this.compra.subtotal(); }
  obtenerTotal(): number { return this.compra.total(); }

  async aplicarCupon(): Promise<void> {
    const codigo = this.codigoCupon().trim();
    if (!codigo) return;
    this.aplicandoCupon.set(true); this.error.set(null);
    try {
      const cupon = await this.beneficios.obtenerCupon(codigo);
      if (!cupon) throw new Error('Cupón inexistente o inactivo.');
      const usuario = this.authService.perfil();
      if (cupon.primera_compra) {
        if (!usuario) throw new Error('El cupón de primera compra requiere iniciar sesión.');
        if (await this.beneficios.tieneCompras(usuario.id)) throw new Error('Este cupón es solo para la primera compra.');
      }
      if (cupon.edad_minima > 0) {
        if (!usuario?.fecha_nacimiento) throw new Error('Necesitamos tu fecha de nacimiento para usar este cupón.');
        const nacimiento = new Date(usuario.fecha_nacimiento); const hoy = new Date();
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        if (hoy < new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate())) edad--;
        if (edad < cupon.edad_minima) throw new Error(`Este cupón es para mayores de ${cupon.edad_minima} años.`);
      }
      this.compra.aplicarCupon(cupon);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'No se pudo aplicar el cupón.'); }
    finally { this.aplicandoCupon.set(false); }
  }

  async pagar(): Promise<void> {
    if (!this.compra.tieneSeleccion() || this.procesando()) return;
    const funcion = this.compra.funcion()!; const asientoIds = this.compra.asientos().map(a => a.id);
    this.procesando.set(true); this.error.set(null);
    try {
      const ocupados = await this.asientosService.obtenerAsientosOcupados(funcion.id);
      if (asientoIds.some(id => ocupados.includes(id))) throw new Error('Uno de los asientos seleccionados ya fue ocupado. Volvé a elegir tus asientos.');
      const usuarioId = this.authService.perfil()?.id ?? null;
      const detalleCompra = {
        combos: this.compra.combos().map(combo => ({ nombre: combo.nombre, cantidad: combo.cantidad, precio: Number(combo.precio) })),
        candy: this.compra.candy().map(item => ({ nombre: item.nombre, cantidad: item.cantidad, precio: Number(item.precio) })),
      };
      const venta = await this.asientosService.crearVenta(funcion.id, usuarioId, asientoIds, this.obtenerTotal(), this.compra.productosParaVenta(), detalleCompra);
      if (usuarioId) {
        try { await this.beneficios.sumarPuntos(usuarioId, this.obtenerTotal(), venta.id); await this.authService.recargarPerfil(); } catch { /* el pago no se revierte por un fallo de puntos */ }
      }
      this.compra.guardarVenta(venta); await this.router.navigate(['/compra', venta.id]);
    } catch (error: unknown) { this.error.set(error instanceof Error ? error.message : 'No se pudo procesar el pago.'); }
    finally { this.procesando.set(false); }
  }
}
