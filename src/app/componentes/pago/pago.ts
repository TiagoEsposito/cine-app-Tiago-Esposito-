/**
 * Implementa la lógica de pago dentro de la aplicación Cine Avellaneda.
 */
import { Component, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { AsientosService } from '../../servicios/asientos.service';
import { AuthService } from '../../servicios/auth.service';
import { CompraService } from '../../servicios/compra.service';
import { BeneficiosService } from '../../servicios/beneficios.service';
import { Asiento } from '../../models/asiento.model';
import { PeliculasService } from '../../servicios/peliculas.service';

@Component({ selector: 'app-pago', templateUrl: './pago.html', styleUrl: './pago.scss', imports: [RouterLink] })
export class Pago {
  private readonly asientosService = inject(AsientosService);
  readonly authService = inject(AuthService);
  private readonly beneficios = inject(BeneficiosService);
  private readonly router = inject(Router);
  private readonly peliculasService = inject(PeliculasService);
  readonly compra = inject(CompraService);
  readonly procesando = signal(false);
  readonly error = signal<string | null>(null);
  readonly codigoCupon = signal('');
  readonly aplicandoCupon = signal(false);
  readonly usarCredito = signal(true);
  readonly requiereAdulto = signal(false);

  /** Obtiene el precio calculado del asiento desde el servicio de compra. */
  obtenerPrecioAsiento(asiento: Asiento): number { return this.compra.obtenerPrecioAsiento(asiento); }
  /** Obtiene el subtotal actual de la compra. */
  obtenerSubtotal(): number { return this.compra.subtotal(); }
  /** Obtiene el total final de la compra. */
  obtenerTotal(): number { return this.compra.total(); }

  /** Obtiene el crédito disponible del usuario actual. */
  obtenerCreditoDisponible(): number {
    return Number(this.authService.perfil()?.credito ?? 0);
  }

  /** Calcula cuánto crédito se utilizará para pagar la compra. */
  obtenerCreditoAplicado(): number {
    if (!this.usarCredito()) return 0;
    return Math.min(this.obtenerCreditoDisponible(), this.obtenerTotal());
  }

  /** Calcula cuánto debe abonarse con tarjeta después de aplicar el crédito. */
  obtenerMontoTarjeta(): number {
    return Math.max(0, this.obtenerTotal() - this.obtenerCreditoAplicado());
  }

  /** Calcula la edad actual a partir de una fecha de nacimiento. */
  private calcularEdad(fecha: string): number {
    const nacimiento = new Date(`${fecha}T12:00:00`);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();

    if (hoy < new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate())) {
      edad--;
    }

    return edad;
  }

  /** Comprueba que el usuario cumpla la edad mínima de la película y determina si necesita un adulto. */
  private async validarEdad(): Promise<void> {
    const funcion = this.compra.funcion();
    if (!funcion) return;

    const pelicula = await this.peliculasService.obtenerPelicula(funcion.pelicula_id);
    const edadMinima = Number(pelicula?.edad_minima ?? 0);

    this.requiereAdulto.set(false);
    this.compra.requiereAdulto.set(false);

    if (!edadMinima) return;

    const perfil = this.authService.perfil();

    if (!perfil?.fecha_nacimiento) {
      throw new Error('Esta película tiene restricción de edad. Iniciá sesión y completá tu fecha de nacimiento para continuar.');
    }

    const edad = this.calcularEdad(perfil.fecha_nacimiento);

    if (edad < edadMinima) {
      throw new Error(`No podés comprar esta entrada. La película es para mayores de ${edadMinima} años.`);
    }

    if (edad < 18) {
      this.requiereAdulto.set(true);
      this.compra.requiereAdulto.set(true);
    }
  }

  /** Busca y valida un cupón antes de aplicarlo a la compra. */
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

  /** Valida la compra, aplica crédito, crea la venta y finaliza el pago. */
  async pagar(): Promise<void> {
    if (!this.compra.tieneSeleccion() || this.procesando()) return;

    const funcion = this.compra.funcion()!;
    const asientoIds = this.compra.asientos().map(a => a.id);
    let creditoAplicado = 0;

    this.procesando.set(true);
    this.error.set(null);

    try {
      await this.validarEdad();

      const ocupados = await this.asientosService.obtenerAsientosOcupados(funcion.id);
      if (asientoIds.some(id => ocupados.includes(id))) {
        throw new Error('Uno de los asientos seleccionados ya fue ocupado. Volvé a elegir tus asientos.');
      }

      const usuarioId = this.authService.perfil()?.id ?? null;
      creditoAplicado = this.obtenerCreditoAplicado();

      if (creditoAplicado > 0) {
        await this.authService.modificarCredito(-creditoAplicado);
      }

      const detalleCompra = {
        combos: this.compra.combos().map(combo => ({
          nombre: combo.nombre,
          cantidad: combo.cantidad,
          precio: Number(combo.precio),
        })),
        candy: this.compra.candy().map(item => ({
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio: Number(item.precio),
        })),
        credito_usado: creditoAplicado,
        requiere_adulto: this.requiereAdulto(),
      };

      try {
        const venta = await this.asientosService.crearVenta(
          funcion.id,
          usuarioId,
          asientoIds,
          this.obtenerTotal(),
          this.compra.productosParaVenta(),
          detalleCompra
        );

        if (usuarioId) {
          try {
            await this.beneficios.sumarPuntos(usuarioId, this.obtenerTotal(), venta.id);
            await this.authService.recargarPerfil();
          } catch {
            // El pago no se revierte por un fallo de puntos.
          }
        }

        this.compra.guardarVenta(venta);
        await this.router.navigate(['/compra', venta.id]);
      } catch (error) {
        if (creditoAplicado > 0) {
          await this.authService.modificarCredito(creditoAplicado);
        }
        throw error;
      }
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo procesar el pago.');
    } finally {
      this.procesando.set(false);
    }
  }
}
