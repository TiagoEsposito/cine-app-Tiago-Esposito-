/**
 * Implementa la lógica de reportes dentro de la aplicación Cine Avellaneda.
 */
import { CommonModule } from '@angular/common';
import * as XLSX from 'xlsx';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  ReporteCandy,
  ReportePeriodo,
  ReporteVista,
  ReportesService,
} from '../../servicios/reportes.service';

@Component({
  selector: 'app-reportes',
  templateUrl: './reportes.html',
  styleUrl: './reportes.scss',
  imports: [CommonModule],
})
export class Reportes implements OnInit {
  private readonly servicio = inject(ReportesService);

  readonly resumen = signal({ ingresos: 0, entradas: 0, compras: 0 });
  readonly semana = signal<ReportePeriodo[]>([]);
  readonly mes = signal<ReportePeriodo[]>([]);
  readonly vistasSemana = signal<ReporteVista[]>([]);
  readonly vistasMes = signal<ReporteVista[]>([]);
  readonly candy = signal<ReporteCandy[]>([]);
  readonly error = signal('');
  readonly cargando = signal(true);
  readonly fecha = new Date().toISOString().slice(0, 10);

  readonly candyMasVendido = computed(() => this.candy()[0] ?? null);

  /** Inicializa el componente y carga los datos necesarios al entrar en la pantalla. */
  async ngOnInit(): Promise<void> {
    try {
      const hoy = new Date();
      const inicioSemana = new Date(hoy);
      inicioSemana.setDate(hoy.getDate() - 6);

      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const fin = this.formatear(hoy);
      const semana = this.formatear(inicioSemana);
      const mes = this.formatear(inicioMes);

      const [resumen, ventasSemana, ventasMes, vistasSemana, vistasMes, candy] =
        await Promise.all([
          this.servicio.resumenDia(this.fecha),
          this.servicio.ventasPorPeliculas(semana, fin),
          this.servicio.ventasPorPeliculas(mes, fin),
          this.servicio.vistasPorPeliculas(semana, fin),
          this.servicio.vistasPorPeliculas(mes, fin),
          this.servicio.candyMasVendido(mes, fin),
        ]);

      this.resumen.set(resumen);
      this.semana.set(ventasSemana);
      this.mes.set(ventasMes);
      this.vistasSemana.set(vistasSemana);
      this.vistasMes.set(vistasMes);
      this.candy.set(candy);
    } catch (e) {
      this.error.set(
        e instanceof Error ? e.message : 'No se pudieron cargar los reportes.'
      );
    } finally {
      this.cargando.set(false);
    }
  }

  /** Calcula el porcentaje que representa un elemento respecto de una lista. */
  porcentaje(item: ReporteVista, lista: ReporteVista[]): number {
    const mayor = lista[0]?.cantidad ?? 0;
    return mayor ? (item.cantidad / mayor) * 100 : 0;
  }


  /** Prepara la vista de reportes para imprimirla o guardarla como PDF. */
  exportarPdf(): void {
    window.print();
  }

  /** Genera un archivo Excel con los datos del reporte. */
  exportarExcel(): void {
    const datos = [
      ...this.semana().map(item => ({
        Tipo: 'Ventas 7 días',
        Nombre: item.nombre,
        Cantidad: item.entradas,
        Ingresos: item.ingresos,
      })),
      ...this.mes().map(item => ({
        Tipo: 'Ventas mes',
        Nombre: item.nombre,
        Cantidad: item.entradas,
        Ingresos: item.ingresos,
      })),
      ...this.vistasSemana().map(item => ({
        Tipo: 'Vistas semana',
        Nombre: item.nombre,
        Cantidad: item.cantidad,
        Ingresos: 0,
      })),
      ...this.vistasMes().map(item => ({
        Tipo: 'Vistas mes',
        Nombre: item.nombre,
        Cantidad: item.cantidad,
        Ingresos: 0,
      })),
      ...this.candy().map(item => ({
        Tipo: 'Candy Bar mes',
        Nombre: item.nombre,
        Cantidad: item.cantidad,
        Ingresos: item.ingresos,
      })),
    ];

    const hoja = XLSX.utils.json_to_sheet(datos);
    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, 'Reporte');
    XLSX.writeFile(libro, 'reporte-cine-avellaneda.xlsx');
  }

  /** Formatea una fecha para mostrarla en los reportes. */
  private formatear(fecha: Date): string {
    return fecha.toISOString().slice(0, 10);
  }
}
