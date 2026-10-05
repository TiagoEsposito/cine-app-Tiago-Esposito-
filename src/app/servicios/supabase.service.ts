/**
 * Implementa la lógica de supabase dentro de la aplicación Cine Avellaneda.
 */
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly cliente: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseKey,
  );
}
