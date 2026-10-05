/**
 * Implementa la lógica de staff.guard dentro de la aplicación Cine Avellaneda.
 */
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../servicios/auth.service';

export const staffGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.listo;
  return auth.esStaff() ? true : router.createUrlTree(['/cartelera']);
};
