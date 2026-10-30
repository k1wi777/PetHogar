'use client';

import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useSesion } from '@/shared/auth/SesionProvider';
import { CLAVE_MASCOTAS_GESTION } from '@/shared/lib/claves-consulta';
import { listarEspecies, listarRazas } from '../api/catalogos';
import { eliminarFoto, marcarPrincipal, subirFoto } from '../api/fotos';
import { listarHistorialPublico, registrarEvento } from '../api/historial';
import {
  crearMascota,
  darDeBaja,
  editarMascota,
  listarMisMascotas,
  obtenerMascotaGestion,
} from '../api/mascotas';
import type {
  CambiosMascota,
  ConsultaMascotas,
  DatosHistorial,
  DatosMascota,
  EventoMedico,
  FotoGestion,
  MascotaGestion,
  MascotaGestionDetalle,
} from '../types';

/** Claves con prefijo propio: ninguna otra feature las toca. */
export const claves = {
  lista: (c: ConsultaMascotas) => [CLAVE_MASCOTAS_GESTION, 'lista', c] as const,
  todasLasListas: [CLAVE_MASCOTAS_GESTION, 'lista'] as const,
  detalle: (id: number) => [CLAVE_MASCOTAS_GESTION, 'detalle', id] as const,
  historial: (id: number) => [CLAVE_MASCOTAS_GESTION, 'historial', id] as const,
  especies: [CLAVE_MASCOTAS_GESTION, 'especies'] as const,
  razas: (especieId: number) => [CLAVE_MASCOTAS_GESTION, 'razas', especieId] as const,
};

const CATALOGO_STALE_MS = 10 * 60 * 1000;

/**
 * Las consultas operativas solo corren con sesión y fundación aprobada: con otro estado el
 * backend responde 403 y la pantalla muestra el aviso sin lanzar peticiones evitables.
 */
function useActiva(): boolean {
  const { estado, usuario } = useSesion();
  return estado === 'autenticado' && usuario?.fundacion?.estadoValidacion === 'aprobada';
}

export function useMisMascotas(consulta: ConsultaMascotas) {
  const activa = useActiva();
  return useQuery({
    queryKey: claves.lista(consulta),
    queryFn: () => listarMisMascotas(consulta),
    enabled: activa,
    placeholderData: keepPreviousData,
  });
}

export function useMascotaGestion(id: number | null) {
  const activa = useActiva();
  return useQuery({
    queryKey: claves.detalle(id ?? 0),
    queryFn: () => obtenerMascotaGestion(id as number),
    enabled: activa && id !== null,
  });
}

export function useEspecies() {
  return useQuery({
    queryKey: claves.especies,
    queryFn: () => listarEspecies(),
    staleTime: CATALOGO_STALE_MS,
  });
}

export function useRazas(especieId: number | null) {
  return useQuery({
    queryKey: claves.razas(especieId ?? 0),
    queryFn: () => listarRazas(especieId as number),
    enabled: especieId !== null,
    staleTime: CATALOGO_STALE_MS,
  });
}

/**
 * El detalle solo trae `razaId`: la especie se resuelve pidiendo las razas de cada especie en
 * paralelo (son pocas y quedan en caché). `especieId` es `null` mientras carga o si no se halla.
 */
export function useEspecieDeRaza(razaId: number | null) {
  const especies = useEspecies();
  const razas = useQueries({
    queries: (especies.data ?? []).map((e) => ({
      queryKey: claves.razas(e.id),
      queryFn: () => listarRazas(e.id),
      staleTime: CATALOGO_STALE_MS,
    })),
  });
  const cargando = especies.isPending || razas.some((r) => r.isPending);
  const error = especies.isError || razas.some((r) => r.isError);
  const indice =
    razaId === null ? -1 : razas.findIndex((r) => r.data?.some((raza) => raza.id === razaId));
  const especie = indice >= 0 ? (especies.data?.[indice] ?? null) : null;
  const raza = indice >= 0 ? (razas[indice]?.data?.find((r) => r.id === razaId) ?? null) : null;
  return {
    especieId: especie?.id ?? null,
    nombreEspecie: especie?.nombre ?? null,
    nombreRaza: raza?.nombre ?? null,
    cargando,
    error,
    reintentar: () => {
      void especies.refetch();
      razas.filter((r) => r.isError).forEach((r) => void r.refetch());
    },
  };
}

export function useCrearMascota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: DatosMascota) => crearMascota(datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: claves.todasLasListas }),
  });
}

/** Une los datos nuevos al detalle en caché conservando las fotos (la edición no las devuelve). */
function fusionarDetalle(
  previo: MascotaGestionDetalle | undefined,
  nueva: MascotaGestion,
): MascotaGestionDetalle | undefined {
  return previo ? { ...previo, ...nueva, fotos: previo.fotos } : undefined;
}

/** Edición pesimista: se escribe la respuesta del servidor; con error (409) se relee el estado real. */
export function useEditarMascota(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cambios: CambiosMascota) => editarMascota(id, cambios),
    onSuccess: (nueva) => {
      queryClient.setQueryData<MascotaGestionDetalle | undefined>(claves.detalle(id), (previo) =>
        fusionarDetalle(previo, nueva),
      );
      return queryClient.invalidateQueries({ queryKey: claves.todasLasListas });
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: claves.detalle(id) }),
  });
}

export function useDarDeBaja(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => darDeBaja(id),
    onSuccess: (nueva) => {
      queryClient.setQueryData<MascotaGestionDetalle | undefined>(claves.detalle(id), (previo) =>
        fusionarDetalle(previo, nueva),
      );
      return queryClient.invalidateQueries({ queryKey: claves.todasLasListas });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: claves.detalle(id) });
      void queryClient.invalidateQueries({ queryKey: claves.todasLasListas });
    },
  });
}

/** Principal primero, como entrega el servidor. */
function ordenarGaleria(fotos: FotoGestion[]): FotoGestion[] {
  return [...fotos].sort((a, b) => Number(b.esPrincipal) - Number(a.esPrincipal) || a.id - b.id);
}

function conFotos(
  queryClient: ReturnType<typeof useQueryClient>,
  id: number,
  cambio: (fotos: FotoGestion[]) => FotoGestion[],
) {
  queryClient.setQueryData<MascotaGestionDetalle | undefined>(claves.detalle(id), (previo) =>
    previo ? { ...previo, fotos: cambio(previo.fotos) } : previo,
  );
}

export function useSubirFoto(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (archivo: File) => subirFoto(id, archivo),
    onSuccess: (foto) => conFotos(queryClient, id, (fotos) => ordenarGaleria([...fotos, foto])),
    // Un 409 por cupo indica que la galería cambió en otro lugar: se relee.
    onError: () => void queryClient.invalidateQueries({ queryKey: claves.detalle(id) }),
  });
}

export function useMarcarPrincipal(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fotoId: number) => marcarPrincipal(id, fotoId),
    onSuccess: (galeria) => conFotos(queryClient, id, () => galeria),
    onError: () => void queryClient.invalidateQueries({ queryKey: claves.detalle(id) }),
  });
}

/** El 204 no dice cuál pasa a ser la principal: siempre se relee el detalle. */
export function useEliminarFoto(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fotoId: number) => eliminarFoto(id, fotoId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: claves.detalle(id) }),
  });
}

/** Ordena del más reciente al más antiguo (desempate por id). */
export function ordenarHistorial(eventos: EventoMedico[]): EventoMedico[] {
  return [...eventos].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
}

export function useHistorial(id: number, habilitado: boolean) {
  const activa = useActiva();
  return useQuery({
    queryKey: claves.historial(id),
    queryFn: async () => ordenarHistorial(await listarHistorialPublico(id)),
    enabled: activa && habilitado,
  });
}

export function useRegistrarEvento(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: DatosHistorial) => registrarEvento(id, datos),
    onSuccess: (evento) =>
      queryClient.setQueryData<EventoMedico[]>(claves.historial(id), (previo) =>
        ordenarHistorial([evento, ...(previo ?? [])]),
      ),
  });
}
