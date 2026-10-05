/**
 * Implementa la lógica de registro dentro de la aplicación Cine Avellaneda.
 */
import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  email,
  form,
  FormField,
  FormRoot,
  minLength,
  pattern,
  required,
} from '@angular/forms/signals';
import { AuthService } from '../../servicios/auth.service';

@Component({
  selector: 'app-registro',
  imports: [FormField, FormRoot, NgTemplateOutlet],
  templateUrl: './registro.html',
  styleUrl: './registro.scss',
})
export class Registro {
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly tiposSangre = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  readonly coloresOjos = [
    'Marrones',
    'Negros',
    'Azules',
    'Verdes',
    'Celestes',
    'Grises',
    'Avellana',
  ];

  modelo = signal({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    dia: '',
    mes: '',
    anio: '',
    tipo_sangre: '',
    color_ojos: '',
    dias_vacaciones: '',
  });

  formulario = form(
    this.modelo,
    (ruta) => {
      required(ruta.nombre, { message: 'Ingresá tu nombre' });
      required(ruta.apellido, { message: 'Ingresá tu apellido' });

      required(ruta.email, { message: 'Ingresá tu email' });
      email(ruta.email, { message: 'Ingresá un email válido' });

      required(ruta.password, { message: 'Ingresá una contraseña' });
      minLength(ruta.password, 6, {
        message: 'La contraseña debe tener al menos 6 caracteres',
      });

      required(ruta.dia, { message: 'Ingresá el día' });
      pattern(ruta.dia, /^\d{1,2}$/, { message: 'Día inválido' });
      required(ruta.mes, { message: 'Ingresá el mes' });
      pattern(ruta.mes, /^\d{1,2}$/, { message: 'Mes inválido' });
      required(ruta.anio, { message: 'Ingresá el año' });
      pattern(ruta.anio, /^\d{4}$/, { message: 'El año debe tener 4 dígitos' });

      required(ruta.tipo_sangre, { message: 'Elegí tu tipo de sangre' });
      required(ruta.color_ojos, { message: 'Elegí tu color de ojos' });

      required(ruta.dias_vacaciones, { message: 'Ingresá tus días de vacaciones' });
      pattern(ruta.dias_vacaciones, /^\d{1,3}$/, {
        message: 'Ingresá un número entero',
      });
    },
    {
      submission: {
        action: (async (campo: any) => {
          const valores = this.modelo();

          const fecha = this.armarFecha(valores.dia, valores.mes, valores.anio);
          if (!fecha) {
            return {
              kind: 'fecha',
              message: 'Ingresá una fecha de nacimiento válida',
              fieldTree: campo.dia,
            };
          }

          const vacaciones = Number(valores.dias_vacaciones);
          if (vacaciones > 365) {
            return {
              kind: 'vacaciones',
              message: 'No puede superar los 365 días',
              fieldTree: campo.dias_vacaciones,
            };
          }

          const error = await this.auth.registrar({
            email: valores.email,
            password: valores.password,
            nombre: valores.nombre,
            apellido: valores.apellido,
            fecha_nacimiento: fecha,
            tipo_sangre: valores.tipo_sangre,
            color_ojos: valores.color_ojos,
            dias_vacaciones: vacaciones,
          });

          if (error) {
            return { kind: 'servidor', message: error };
          }

          await this.router.navigate(['/cartelera']);
          return undefined;
        }) as any,
      },
    },
  );

  /** Construye una fecha válida a partir de día, mes y año del formulario. */
  private armarFecha(dia: string, mes: string, anio: string): string | null {
  const d = Number(dia);
  const m = Number(mes);
  const a = Number(anio);

  const fecha = new Date(a, m - 1, d);

  if (
    fecha.getFullYear() !== a ||
    fecha.getMonth() !== m - 1 ||
    fecha.getDate() !== d ||
    fecha > new Date()
  ) {
    return null;
  }

  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}}
