import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

const CODIGO_VIOLACION_UNICA = '23505';

const MENSAJE_POR_CONSTRAINT: Record<string, string> = {
  uq_usuario_email: 'Ya existe una cuenta registrada con este correo',
  uq_adoptante_numero_documento: 'Ya existe una cuenta registrada con este número de documento',
  uq_fundacion_nit: 'Ya existe una fundación registrada con este NIT',
};

/**
 * Cubre la carrera entre la precomprobación y el INSERT: si Postgres rechaza por un único
 * conocido se devuelve un 409 claro; cualquier otro error se devuelve tal cual.
 */
export function traducirErrorUnico(error: unknown): unknown {
  if (!(error instanceof QueryFailedError)) return error;
  const { code, constraint } = error.driverError as { code?: string; constraint?: string };
  const mensaje =
    code === CODIGO_VIOLACION_UNICA && constraint && MENSAJE_POR_CONSTRAINT[constraint];
  return mensaje ? new ConflictException(mensaje) : error;
}
