/**
 * Implementa la lógica de login dentro de la aplicación Cine Avellaneda.
 */
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { email, form, FormField, FormRoot, minLength, required } from '@angular/forms/signals';
import { AuthService } from '../../servicios/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormField, FormRoot],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  modelo = signal({
    email: '',
    password: '',
  });

  formulario = form(this.modelo, (ruta) => {
    required(ruta.email, { message: 'Ingresá tu email' });
    email(ruta.email, { message: 'Ingresá un email válido' });
    required(ruta.password, { message: 'Ingresá tu contraseña' });
    minLength(ruta.password, 6, {
      message: 'La contraseña debe tener al menos 6 caracteres',
    });
  }, {
    submission: {
      action: (async (campo: any) => {
        const valores = this.modelo();
        const error = await this.auth.iniciarSesion(valores.email, valores.password);

        if (error) {
          return { kind: 'servidor', message: error, fieldTree: campo.email };
        }

        await this.router.navigate(['/cartelera']);
        return undefined;
      }) as any,
    },
  });
}
