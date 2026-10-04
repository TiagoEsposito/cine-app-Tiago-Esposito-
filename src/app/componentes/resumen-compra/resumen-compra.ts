import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CompraService } from '../../servicios/compra.service';
import { Asiento } from '../../models/asiento.model';
import { CandyCategoria, CandyProducto } from '../../models/candy.model';
import { CandyService } from '../../servicios/candy.service';
import { BeneficiosService } from '../../servicios/beneficios.service';
import { Combo } from '../../models/beneficios.model';

@Component({ selector: 'app-resumen-compra', templateUrl: './resumen-compra.html', styleUrl: './resumen-compra.scss', imports: [RouterLink] })
export class ResumenCompra implements OnInit {
  readonly compra = inject(CompraService);
  private readonly candyService = inject(CandyService);
  private readonly beneficios = inject(BeneficiosService);
  readonly categorias = signal<CandyCategoria[]>([]);
  readonly categoriaSeleccionada = signal<number | null>(null);
  readonly productos = signal<CandyProducto[]>([]);
  readonly combos = signal<Combo[]>([]);
  readonly cargandoCandy = signal(true);
  readonly errorCandy = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const [categorias, productos, combos] = await Promise.all([this.candyService.obtenerCategorias(), this.candyService.obtenerProductos(), this.beneficios.obtenerCombos()]);
      this.categorias.set(categorias); this.productos.set(productos); this.combos.set(combos);}
    finally { this.cargandoCandy.set(false); }
  }
  obtenerPrecioAsiento(asiento: Asiento): number { return this.compra.obtenerPrecioAsiento(asiento); }
  obtenerTotalEntradas(): number { return this.compra.asientos().reduce((t, a) => t + this.obtenerPrecioAsiento(a), 0); }
  obtenerTotal(): number { return this.compra.total(); }
  cantidad(id: number): number { return this.compra.candy().find(x => x.id === id)?.cantidad ?? 0; }
  productosFiltrados(): CandyProducto[] { const categoria = this.categoriaSeleccionada(); return categoria ? this.productos().filter(p => p.categoria_id === categoria) : this.productos(); }
}
