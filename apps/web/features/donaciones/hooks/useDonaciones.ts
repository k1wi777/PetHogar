'use client';

import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { crearDonacion } from '../api/donaciones';
import { leerFundacionDestino } from '../api/fundaciones';
import type { DatosDonacion } from '../schemas/donacion';

/** Hoy lee la fundación de la URL; pasar a un selector solo cambia este hook y `api/fundaciones.ts`. */
export function useFundacionDestino() {
  return leerFundacionDestino(useSearchParams());
}

export function useCrearDonacion(fundacionId: number) {
  return useMutation({ mutationFn: (datos: DatosDonacion) => crearDonacion(fundacionId, datos) });
}
