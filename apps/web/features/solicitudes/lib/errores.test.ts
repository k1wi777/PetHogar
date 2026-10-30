import { describe, expect, it } from 'vitest';
import { ErrorApi } from '@/shared/api/errores';
import { clasificarErrorEnvio } from './errores';

const http = (estado: number, mensaje: string) => new ErrorApi({ tipo: 'http', estado, mensaje });

describe('clasificarErrorEnvio', () => {
  it('409 «solicitud activa» es duplicada', () => {
    expect(
      clasificarErrorEnvio(http(409, 'Ya tienes una solicitud activa para esta mascota')).tipo,
    ).toBe('duplicada');
  });
  it('409 «ya no está disponible», 404 y 403 propia fundación son no disponible', () => {
    expect(
      clasificarErrorEnvio(http(409, 'La mascota ya no está disponible para adopción')).tipo,
    ).toBe('no-disponible');
    expect(clasificarErrorEnvio(http(404, 'La mascota no existe')).tipo).toBe('no-disponible');
    expect(
      clasificarErrorEnvio(http(403, 'No puedes solicitar una mascota de tu propia fundación'))
        .tipo,
    ).toBe('no-disponible');
  });
  it('cualquier otro error queda como otro, con el error original', () => {
    const e = http(400, 'El archivo supera el tamaño máximo de 5 MB');
    expect(clasificarErrorEnvio(e)).toEqual({ tipo: 'otro', error: e });
    expect(clasificarErrorEnvio(http(409, 'Otra cosa')).tipo).toBe('otro');
    expect(clasificarErrorEnvio(new TypeError('x')).tipo).toBe('otro');
  });
});
