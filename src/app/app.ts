/**
 * Componente raíz de la aplicación; contiene la estructura y navegación global.
 */
import { Component, inject } from '@angular/core';
import { AuthService } from './servicios/auth.service';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly auth = inject(AuthService);
}
