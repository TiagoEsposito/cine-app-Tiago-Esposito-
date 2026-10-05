/**
 * Implementa la lógica de auth.guard dentro de la aplicación Cine Avellaneda.
 */
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../servicios/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.listo;

  return auth.haIniciadoSesion()
    ? true
    : router.createUrlTree(['/registro']);
};
