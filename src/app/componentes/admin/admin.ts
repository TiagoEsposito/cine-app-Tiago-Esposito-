/**
 * Implementa la lógica de admin dentro de la aplicación Cine Avellaneda.
 */
import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../servicios/admin.service';
import { PeliculasService } from '../../servicios/peliculas.service';
import { CandyService } from '../../servicios/candy.service';
import { Pelicula } from '../../models/pelicula.model';
import { Sala } from '../../models/sala.model';
import { Funcion } from '../../models/funcion.model';
import { Combo, Cupon, Recompensa } from '../../models/beneficios.model';
import { CandyCategoria, CandyProducto } from '../../models/candy.model';
import { Actividad } from '../../servicios/actividad.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
  imports: [FormsModule, DatePipe],
})
export class Admin implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly peliculasService = inject(PeliculasService);
  private readonly candy = inject(CandyService);

  readonly salas = signal<Sala[]>([]);
  readonly funciones = signal<Funcion[]>([]);
  readonly peliculas = signal<Pelicula[]>([]);
  readonly productos = signal<CandyProducto[]>([]);
  readonly categorias = signal<CandyCategoria[]>([]);
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
  formato: '2D' | '3D' | '4D' | '5D' = '2D';
  idioma: 'Castellano' | 'Subtitulada' = 'Castellano';

  peliculaEdicionId = 0;
  peliculaTituloEdit = '';
  peliculaSinopsis = '';
  peliculaDuracion = 120;
  peliculaPoster = '';
  peliculaEdad = 0;
  peliculaEstreno = '';
  peliculaActiva = true;

  codigo = '';
  porcentaje = 20;
  primeraCompra = true;
  edadMinima = 0;

  recompensaNombre = 'Entrada gratis';
  recompensaTipo: 'entrada' | 'candy' = 'entrada';
  recompensaProductoId = 0;
  recompensaCantidad = 1;
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
  comboIncluyeEntrada = true;

  preventaPrecio = 0;
  preventaPelicula = 0;
  preventaActiva = false;

  nuevaCategoria = '';
  productoEdicionId = 0;
  productoNombre = '';
  productoDescripcion = '';
  productoPrecio = 0;
  productoCategoriaId = 0;
  productoImagen = '';
  productoActivo = true;
  readonly actividad = signal<Actividad[]>([]);

  /** Inicializa el componente y carga los datos necesarios al entrar en la pantalla. */
  async ngOnInit() {
    try {
      await this.recargar();
      await this.recargarPeliculas();
      await this.recargarCandy();
      this.cupones.set(await this.admin.obtenerCupones());
      this.recompensas.set(await this.admin.obtenerRecompensas());
      this.combos.set(await this.admin.obtenerCombos());
      this.actividad.set(await this.admin.obtenerActividad());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo cargar el panel.');
    }
  }

  /** Vuelve a cargar todos los datos utilizados por el panel de administración. */
  async recargar() {
    this.salas.set(await this.admin.obtenerSalas());
    this.funciones.set(await this.admin.obtenerFunciones());
  }

  /** Recarga la lista de películas del panel de administración. */
  async recargarPeliculas() {
    this.peliculas.set(await this.peliculasService.obtenerPeliculas(false));
  }

  /** Recarga categorías y productos del Candy Bar. */
  async recargarCandy() {
    this.productos.set(await this.admin.obtenerProductos());
    this.categorias.set(await this.admin.obtenerCategorias());
  }

  /** Crea una nueva sala de cine. */
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

  /** Genera los asientos de una sala según su distribución y tipo. */
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

  /** Valida los datos y crea una nueva función cinematográfica. */
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
        this.formato,
        this.idioma
      );

      this.mensaje.set(`Función #${id} creada y sala asignada automáticamente.`);
      await this.recargar();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo crear la función.');
    }
  }

  /** Selecciona una película para editarla en el formulario de administración. */
  seleccionarPelicula() {
    const pelicula = this.peliculas().find(p => p.id === this.peliculaEdicionId);
    if (!pelicula) return;

    this.peliculaTituloEdit = pelicula.titulo;
    this.peliculaSinopsis = pelicula.sinopsis;
    this.peliculaDuracion = pelicula.duracion_minutos;
    this.peliculaPoster = pelicula.url_poster ?? '';
    this.peliculaEdad = pelicula.edad_minima;
    this.peliculaEstreno = pelicula.fecha_estreno ?? '';
    this.peliculaActiva = pelicula.activa;
  }

  /** Crea o actualiza una película según el estado del formulario. */
  async guardarPelicula() {
    if (!this.peliculaEdicionId || !this.peliculaTituloEdit.trim()) return;

    try {
      await this.peliculasService.actualizarPelicula(this.peliculaEdicionId, {
        titulo: this.peliculaTituloEdit.trim(),
        sinopsis: this.peliculaSinopsis.trim(),
        duracion_minutos: Number(this.peliculaDuracion),
        url_poster: this.peliculaPoster.trim() || null,
        edad_minima: Number(this.peliculaEdad),
        fecha_estreno: this.peliculaEstreno || null,
        activa: this.peliculaActiva,
      });

      this.mensaje.set('Película actualizada.');
      await this.recargarPeliculas();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo actualizar la película.');
    }
  }

  /** Selecciona un producto para editarlo. */
  seleccionarProducto() {
    const producto = this.productos().find(p => p.id === this.productoEdicionId);
    if (!producto) return;

    this.productoNombre = producto.nombre;
    this.productoDescripcion = producto.descripcion ?? '';
    this.productoPrecio = producto.precio;
    this.productoCategoriaId = producto.categoria_id;
    this.productoImagen = producto.imagen_url ?? '';
    this.productoActivo = producto.activo;
  }

  /** Limpia el formulario de producto para crear uno nuevo. */
  limpiarProducto() {
    this.productoEdicionId = 0;
    this.productoNombre = '';
    this.productoDescripcion = '';
    this.productoPrecio = 0;
    this.productoCategoriaId = 0;
    this.productoImagen = '';
    this.productoActivo = true;
  }

  /** Crea o actualiza un producto del Candy Bar. */
  async guardarProducto() {
    if (!this.productoNombre.trim() || !this.productoCategoriaId) return;

    const producto = {
      categoria_id: Number(this.productoCategoriaId),
      nombre: this.productoNombre.trim(),
      descripcion: this.productoDescripcion.trim() || null,
      precio: Number(this.productoPrecio),
      imagen_url: this.productoImagen.trim() || null,
    };

    try {
      if (this.productoEdicionId) {
        await this.admin.actualizarProducto(this.productoEdicionId, producto);
        this.mensaje.set('Producto actualizado.');
      } else {
        await this.admin.crearProducto(producto);
        this.mensaje.set('Producto creado.');
      }

      this.limpiarProducto();
      await this.recargarCandy();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo guardar el producto.');
    }
  }

  /** Activa o desactiva un producto del Candy Bar. */
  async cambiarEstadoProducto(producto: CandyProducto) {
    try {
      await this.admin.cambiarEstadoProducto(producto.id, producto.activo);
      this.mensaje.set(producto.activo ? 'Producto desactivado.' : 'Producto activado.');
      await this.recargarCandy();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo cambiar el estado.');
    }
  }

  /** Crea una categoría desde el panel de administración. */
  async crearCategoria() {
    if (!this.nuevaCategoria.trim()) return;

    try {
      await this.admin.crearCategoria(this.nuevaCategoria.trim());
      this.nuevaCategoria = '';
      this.mensaje.set('Categoría creada.');
      await this.recargarCandy();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo crear la categoría.');
    }
  }

  /** Activa o desactiva una categoría de productos. */
  async cambiarEstadoCategoria(categoria: CandyCategoria) {
    try {
      await this.admin.cambiarEstadoCategoria(categoria.id, categoria.activa);
      this.mensaje.set(categoria.activa ? 'Categoría desactivada.' : 'Categoría activada.');
      await this.recargarCandy();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo cambiar la categoría.');
    }
  }

  /** Crea un cupón desde el panel de administración. */
  async crearCupon() {
    try {
      await this.admin.crearCupon(
        this.codigo,
        this.porcentaje,
        this.primeraCompra,
        this.edadMinima
      );
      this.codigo = '';
      this.mensaje.set('Cupón creado.');
      this.cupones.set(await this.admin.obtenerCupones());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo crear el cupón.');
    }
  }

  /** Crea una recompensa desde el panel de administración. */
  async crearRecompensa() {
    try {
      if (this.recompensaTipo === 'candy' && !this.recompensaProductoId) return;

      await this.admin.crearRecompensa(
        this.recompensaNombre,
        this.recompensaTipo,
        this.costoPuntos,
        this.recompensaTipo === 'candy' ? this.recompensaProductoId : null,
        this.recompensaCantidad
      );

      this.mensaje.set('Recompensa creada.');
      this.recompensas.set(await this.admin.obtenerRecompensas());
      this.actividad.set(await this.admin.obtenerActividad());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo crear la recompensa.');
    }
  }

  /** Crea un combo y sus productos desde el panel de administración. */
  async crearCombo() {
    try {
      if (!this.comboProductoId) return;

      const items = [
        { producto_id: this.comboProductoId, cantidad: this.comboCantidad },
        { producto_id: this.comboProductoId2, cantidad: this.comboCantidad2 },
        { producto_id: this.comboProductoId3, cantidad: this.comboCantidad3 },
      ].filter(x => x.producto_id > 0);

      if (this.comboIncluyeEntrada && items.length < 2) {
        throw new Error('Un combo con entrada debe incluir al menos dos productos del Candy Bar.');
      }

      await this.admin.crearCombo(
        this.comboNombre,
        this.comboPrecio,
        this.comboDescripcion,
        items,
        this.comboIncluyeEntrada
      );

      this.mensaje.set('Combo creado.');
      this.combos.set(await this.admin.obtenerCombos());
      this.actividad.set(await this.admin.obtenerActividad());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo crear el combo.');
    }
  }

  /** Guarda la configuración de preventa de una película desde el panel. */
  async guardarPreventa() {
    try {
      await this.admin.configurarPreventa(
        this.preventaPelicula,
        this.preventaActiva,
        this.preventaPrecio || null
      );
      this.mensaje.set('Preventa actualizada.');
      await this.recargarPeliculas();
      this.actividad.set(await this.admin.obtenerActividad());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo actualizar la preventa.');
    }
  }

  /** Obtiene el título de una película a partir de su ID. */
  peliculaTitulo(id: number) {
    return this.peliculas().find(p => p.id === id)?.titulo ?? `Película #${id}`;
  }
}
