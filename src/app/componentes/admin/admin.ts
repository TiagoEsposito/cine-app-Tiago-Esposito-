import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../servicios/admin.service';
import { PeliculasService } from '../../servicios/peliculas.service';
import { CandyService } from '../../servicios/candy.service';
import { Pelicula } from '../../models/pelicula.model';
import { Sala } from '../../models/sala.model';
import { Funcion } from '../../models/funcion.model';
import { Combo, Cupon, Recompensa } from '../../models/beneficios.model';
import { CandyProducto } from '../../models/candy.model';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
  imports: [FormsModule],
})
export class Admin implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly peliculasService = inject(PeliculasService);
  private readonly candy = inject(CandyService);
  readonly salas = signal<Sala[]>([]);
  readonly funciones = signal<Funcion[]>([]);
  readonly peliculas = signal<Pelicula[]>([]);
  readonly productos = signal<CandyProducto[]>([]);
  readonly cupones = signal<Cupon[]>([]);
  readonly recompensas = signal<Recompensa[]>([]);
  readonly combos = signal<Combo[]>([]);
  readonly mensaje = signal('');
  readonly error = signal('');
  nuevaSala = '';
  salaEnProceso = signal<number | null>(null);
  peliculaId = 0;
  fecha = '';
  horaInicio = '';
  horaFin = '';
  precio = 5000;
  codigo = '';
  porcentaje = 20;
  primeraCompra = true;
  edadMinima = 0;
  recompensaNombre = 'Entrada gratis';
  costoPuntos = 500;
  comboNombre = 'Combo Cine';
  comboPrecio = 8000;
  comboDescripcion = 'Entrada + pochoclos + bebida';
  comboProductoId = 0;
  comboCantidad = 1;
  comboProductoId2 = 0;
  comboCantidad2 = 1;
  comboProductoId3 = 0;
  comboCantidad3 = 1;
  preventaPrecio = 0;
  preventaPelicula = 0;
  preventaActiva = false;
  async ngOnInit() {
    await this.recargar();
    this.peliculas.set(await this.peliculasService.obtenerPeliculas());
    this.productos.set(await this.candy.obtenerProductos());
    this.cupones.set(await this.admin.obtenerCupones());
    this.recompensas.set(await this.admin.obtenerRecompensas());
    this.combos.set(await this.admin.obtenerCombos());
  }
  async recargar() {
    this.salas.set(await this.admin.obtenerSalas());
    this.funciones.set(await this.admin.obtenerFunciones());
  }
  async crearSala() {
    if (!this.nuevaSala.trim()) return;
    try {
      await this.admin.crearSala(this.nuevaSala.trim());
      this.nuevaSala = '';
      this.mensaje.set('Sala creada.');
      await this.recargar();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo crear la sala.');
    }
  }
  async generarAsientos(sala: Sala) {
    this.salaEnProceso.set(sala.id);
    this.error.set('');
    try {
      const total = await this.admin.generarAsientos(sala.id);
      this.mensaje.set(`Se generaron ${total} asientos en ${sala.nombre}.`);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudieron generar los asientos.');
    } finally {
      this.salaEnProceso.set(null);
    }
  }
  async crearFuncion() {
    this.error.set('');
    this.mensaje.set('');
    if (!this.peliculaId || !this.fecha || !this.horaInicio || !this.horaFin) return;
    try {
      const id = await this.admin.crearFuncionAuto(
        this.peliculaId,
        this.fecha,
        this.horaInicio,
        this.horaFin,
        this.precio,
      );
      this.mensaje.set(`Función #${id} creada y sala asignada automáticamente.`);
      await this.recargar();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo crear la función.');
    }
  }
  async crearCupon() {
    try {
      await this.admin.crearCupon(
        this.codigo,
        this.porcentaje,
        this.primeraCompra,
        this.edadMinima,
      );
      this.codigo = '';
      this.mensaje.set('Cupón creado.');
      this.cupones.set(await this.admin.obtenerCupones());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo crear el cupón.');
    }
  }
  async crearRecompensa() {
    try {
      await this.admin.crearRecompensa(this.recompensaNombre, this.costoPuntos);
      this.mensaje.set('Recompensa creada.');
      this.recompensas.set(await this.admin.obtenerRecompensas());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo crear la recompensa.');
    }
  }
  async crearCombo() {
    try {
      if (!this.comboProductoId) return;
      const items = [
        { producto_id: this.comboProductoId, cantidad: this.comboCantidad },
        { producto_id: this.comboProductoId2, cantidad: this.comboCantidad2 },
        { producto_id: this.comboProductoId3, cantidad: this.comboCantidad3 },
      ].filter((x) => x.producto_id > 0);
      await this.admin.crearCombo(this.comboNombre, this.comboPrecio, this.comboDescripcion, items);
      this.mensaje.set('Combo creado.');
      this.combos.set(await this.admin.obtenerCombos());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo crear el combo.');
    }
  }
  async guardarPreventa() {
    try {
      await this.admin.configurarPreventa(
        this.preventaPelicula,
        this.preventaActiva,
        this.preventaPrecio || null,
      );
      this.mensaje.set('Preventa actualizada.');
      this.peliculas.set(await this.peliculasService.obtenerPeliculas());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo actualizar la preventa.');
    }
  }
  peliculaTitulo(id: number) {
    return this.peliculas().find((p) => p.id === id)?.titulo ?? `Película #${id}`;}
}
