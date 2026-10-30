import { describe, expect, it } from 'vitest';
import { ErrorApi } from '@/shared/api/errores';
import { clasificarErrorLogin } from './estado-cuenta';

const http = (estado: number, mensaje: string) => new ErrorApi({ tipo: 'http', estado, mensaje });

describe('clasificarErrorLogin (mensajes reales de la API)', () => {
  it.each([
    [http(401, 'Correo o contraseña incorrectos'), 'credenciales'],
    [
      http(
        403,
        'Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intenta de nuevo en 12 minutos.',
      ),
      'bloqueada',
    ],
    [
      http(403, 'Tu cuenta está desactivada. Comunícate con un administrador de PetHogar.'),
      'desactivada',
    ],
    [
      http(
        403,
        'Debes verificar tu correo antes de iniciar sesión. Revisa tu bandeja o solicita un nuevo enlace.',
      ),
      'sin-verificar',
    ],
    [http(403, 'Otro motivo desconocido'), 'otro'],
    [http(500, 'Algo salió mal'), 'otro'],
    [http(429, 'Demasiadas solicitudes, inténtalo de nuevo más tarde'), 'transitorio'],
    [new ErrorApi({ tipo: 'red', mensaje: 'sin red' }), 'transitorio'],
  ] as const)('%#', (error, esperado) => {
    expect(clasificarErrorLogin(error)).toBe(esperado);
  });

  it('un valor que no es ErrorApi es «otro»', () => {
    expect(clasificarErrorLogin(new Error('x'))).toBe('otro');
  });
});
