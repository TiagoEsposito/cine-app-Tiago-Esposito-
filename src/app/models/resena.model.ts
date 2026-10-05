/**
 * Define la estructura de las reseñas de películas.
 */
export interface Resena {
  id: number;
  pelicula_id: number;
  usuario_id: string;
  puntuacion: number;
  comentario: string;
  fecha_creacion: string;
  usuario?: {
    nombre: string;
    apellido: string;
  };
}