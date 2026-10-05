export interface Funcion {
  id: number;
  pelicula_id: number;
  sala_id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  precio: number;
  formato?: '2D' | '3D' | '4D' | '5D';
  idioma?: 'Castellano' | 'Subtitulada';
  fecha_creacion: string;
  es_preventa?: boolean;
}
