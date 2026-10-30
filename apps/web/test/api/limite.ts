import { esErrorApi } from '@/shared/api/errores';

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

/**
 * Los límites por minuto de la API (login y registro, 3 a 5 por IP) se comparten entre todos los
 * archivos de V17. Si la API responde 429 se espera a que se renueve la ventana y se reintenta,
 * así el resultado no depende del punto del minuto en que caiga cada archivo.
 */
export async function conLimite<T>(accion: () => Promise<T>, intentos = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await accion();
    } catch (error) {
      if (!(esErrorApi(error) && error.estado === 429) || i >= intentos) throw error;
      await esperar(61_000);
    }
  }
}
