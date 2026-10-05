/**
 * Punto de entrada de la aplicación Angular; inicia el componente raíz con la configuración principal.
 */
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/** Inicia la aplicación Angular con el componente raíz y la configuración definida. */
bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
