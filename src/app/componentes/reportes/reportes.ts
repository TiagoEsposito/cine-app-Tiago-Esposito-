import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ReporteCandy, ReportePeriodo, ReportesService } from '../../servicios/reportes.service';

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
  readonly candy = signal<ReporteCandy[]>([]);
  readonly error = signal('');
  readonly cargando = signal(true);
  readonly fecha = new Date().toISOString().slice(0, 10);

  async ngOnInit(): Promise<void> {
    try {
      const hoy = new Date();
      const inicioSemana = new Date(hoy); inicioSemana.setDate(hoy.getDate() - 6);
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const fin = this.formatear(hoy);
      this.resumen.set(await this.servicio.resumenDia(this.fecha));
      this.semana.set(await this.servicio.ventasPorPeliculas(this.formatear(inicioSemana), fin));
      this.mes.set(await this.servicio.ventasPorPeliculas(this.formatear(inicioMes), fin));
      this.candy.set(await this.servicio.candyMasVendido(this.formatear(inicioMes), fin));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudieron cargar los reportes.');
    } finally { this.cargando.set(false); }
  }

  private formatear(fecha: Date): string { return fecha.toISOString().slice(0, 10); }
}
