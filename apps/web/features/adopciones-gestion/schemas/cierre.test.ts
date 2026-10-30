import { describe, expect, it } from 'vitest';
import {
  MAX_MOTIVO_CIERRE,
  MENSAJE_DESTINO,
  MENSAJE_ESTADO_CIERRE,
  MENSAJE_MOTIVO_CIERRE,
  MENSAJE_MOTIVO_LARGO,
  esquemaCierre,
} from './cierre';

const mensajes = (r: ReturnType<typeof esquemaCierre.safeParse>) =>
  r.success ? [] : r.error.issues.map((i) => i.message);

describe('esquema de cierre de adopción', () => {
  it('sin estado, no hay cierre por defecto', () => {
    expect(mensajes(esquemaCierre.safeParse({ motivo: 'x' }))).toEqual([MENSAJE_ESTADO_CIERRE]);
    expect(mensajes(esquemaCierre.safeParse({}))).toEqual([MENSAJE_ESTADO_CIERRE]);
  });
  it('el motivo es obligatorio (también en blanco) para ambos estados', () => {
    for (const estado of ['finalizada', 'revocada'] as const) {
      const base = estado === 'revocada' ? { mascotaDestino: 'inactiva' } : {};
      expect(mensajes(esquemaCierre.safeParse({ estado, ...base }))).toContain(
        MENSAJE_MOTIVO_CIERRE,
      );
      expect(mensajes(esquemaCierre.safeParse({ estado, motivo: '   ', ...base }))).toEqual([
        MENSAJE_MOTIVO_CIERRE,
      ]);
    }
  });
  it('el motivo admite hasta 300 caracteres recortados', () => {
    const ok = esquemaCierre.safeParse({ estado: 'finalizada', motivo: ` ${'a'.repeat(300)} ` });
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.motivo).toHaveLength(MAX_MOTIVO_CIERRE);
    expect(
      mensajes(esquemaCierre.safeParse({ estado: 'finalizada', motivo: 'a'.repeat(301) })),
    ).toEqual([MENSAJE_MOTIVO_LARGO]);
  });
  it('el destino de la mascota solo es obligatorio al revocar', () => {
    expect(mensajes(esquemaCierre.safeParse({ estado: 'revocada', motivo: 'x' }))).toEqual([
      MENSAJE_DESTINO,
    ]);
    expect(
      mensajes(
        esquemaCierre.safeParse({ estado: 'revocada', motivo: 'x', mascotaDestino: 'otro' }),
      ),
    ).toEqual([MENSAJE_DESTINO]);
    for (const d of ['disponible', 'inactiva']) {
      expect(
        esquemaCierre.safeParse({ estado: 'revocada', motivo: 'x', mascotaDestino: d }).success,
      ).toBe(true);
    }
  });
  it('al finalizar el destino se descarta (no se envía)', () => {
    const r = esquemaCierre.safeParse({
      estado: 'finalizada',
      motivo: 'x',
      mascotaDestino: 'inactiva',
    });
    expect(r.success && r.data).toEqual({ estado: 'finalizada', motivo: 'x' });
  });
  it('rechaza estados que no son un cierre', () => {
    expect(esquemaCierre.safeParse({ estado: 'activa', motivo: 'x' }).success).toBe(false);
  });
});
