'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MENSAJES, esErrorApi } from '@/shared/api/errores';
import { MENSAJE_LIMITE } from '../lib/errores-servidor';

/** Espera local entre reenvíos: protege el límite de 3 por minuto del servidor. */
export const ESPERA_REENVIO_SEGUNDOS = 60;

interface EstadoReenvio {
  enviando: boolean;
  restante: number;
  mensaje: string | null;
  error: string | null;
}

/** Reenvío con enfriamiento visible: `restante` baja cada segundo y bloquea nuevos envíos. */
export function useReenvio(
  accion: () => Promise<{ mensaje: string }>,
  espera: number = ESPERA_REENVIO_SEGUNDOS,
) {
  const [estado, setEstado] = useState<EstadoReenvio>({
    enviando: false,
    restante: 0,
    mensaje: null,
    error: null,
  });
  const enCurso = useRef(false);
  const hayEspera = estado.restante > 0;

  useEffect(() => {
    if (!hayEspera) return;
    const temporizador = setInterval(() => {
      setEstado((e) => ({ ...e, restante: Math.max(0, e.restante - 1) }));
    }, 1000);
    return () => clearInterval(temporizador);
  }, [hayEspera]);

  const reenviar = useCallback(async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    setEstado((e) => ({ ...e, enviando: true, mensaje: null, error: null }));
    try {
      const respuesta = await accion();
      setEstado({ enviando: false, restante: espera, mensaje: respuesta.mensaje, error: null });
    } catch (error) {
      const limite = esErrorApi(error) && error.estado === 429;
      const texto = limite
        ? MENSAJE_LIMITE
        : esErrorApi(error) && error.tipo === 'red'
          ? MENSAJES.red
          : esErrorApi(error)
            ? error.mensaje
            : MENSAJES.generico;
      setEstado((e) => ({ ...e, enviando: false, error: texto, restante: limite ? espera : 0 }));
    } finally {
      enCurso.current = false;
    }
  }, [accion, espera]);

  return { ...estado, reenviar };
}
