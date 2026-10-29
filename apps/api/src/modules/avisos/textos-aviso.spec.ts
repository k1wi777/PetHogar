import * as T from './textos-aviso';

/** Cadenas que ningún aviso debe contener, aunque se las pasen por descuido. */
const PRIVADOS = {
  estadoBienestar: 'BIENESTAR-MALO',
  observaciones: 'OBSERVACION-PRIVADA-DEL-SEGUIMIENTO',
  email: 'secreto@correo.privado',
  telefono: '3001112233',
  numeroDocumento: 'DOC-123456',
  adoptanteNombre: 'NOMBRE-DEL-ADOPTANTE',
  donanteNombre: 'NOMBRE-DEL-DONANTE',
  motivoCierre: 'MOTIVO-PRIVADO-DEL-CIERRE',
};

const avisos = [
  [
    'fundacionRegistrada',
    T.fundacionRegistrada({ fundacionId: 3, nombre: 'Huellas', ...PRIVADOS } as never),
  ],
  [
    'fundacionValidada aprobada',
    T.fundacionValidada({
      fundacionId: 3,
      decision: 'aprobada',
      observacion: null,
      ...PRIVADOS,
    } as never),
  ],
  [
    'fundacionValidada rechazada',
    T.fundacionValidada({
      fundacionId: 3,
      decision: 'rechazada',
      observacion: 'Falta el RUT',
      ...PRIVADOS,
    } as never),
  ],
  [
    'solicitudRecibida',
    T.solicitudRecibida({ solicitudId: 5, mascota: 'Luna', ...PRIVADOS } as never),
  ],
  [
    'solicitudAprobada',
    T.solicitudAprobada({ solicitudId: 5, mascota: 'Luna', ...PRIVADOS } as never),
  ],
  [
    'solicitudRechazada manual',
    T.solicitudRechazada({
      solicitudId: 5,
      mascota: 'Luna',
      observacion: 'No cumple',
      automatica: false,
      ...PRIVADOS,
    } as never),
  ],
  [
    'solicitudRechazada automática',
    T.solicitudRechazada({
      solicitudId: 5,
      mascota: 'Luna',
      observacion: 'otra aprobada',
      automatica: true,
      ...PRIVADOS,
    } as never),
  ],
  [
    'adopcionCerrada finalizada',
    T.adopcionCerrada({
      adopcionId: 9,
      estado: 'finalizada',
      mascota: 'Luna',
      ...PRIVADOS,
    } as never),
  ],
  [
    'adopcionCerrada revocada',
    T.adopcionCerrada({ adopcionId: 9, estado: 'revocada', mascota: 'Luna', ...PRIVADOS } as never),
  ],
  [
    'seguimientoProgramado',
    T.seguimientoProgramado({
      seguimientoId: 7,
      fundacion: 'Huellas',
      tipo: 'visita',
      mascota: 'Luna',
      fecha: '2026-11-05',
      ...PRIVADOS,
    } as never),
  ],
  [
    'seguimientoPorVencer',
    T.seguimientoPorVencer({
      seguimientoId: 7,
      tipo: 'reporte',
      mascota: 'Luna',
      fecha: '2026-11-05',
      diasRestantes: 2,
      ...PRIVADOS,
    } as never),
  ],
  [
    'seguimientoVencidoAdoptante',
    T.seguimientoVencidoAdoptante({ seguimientoId: 7, mascota: 'Luna', ...PRIVADOS } as never),
  ],
  [
    'seguimientoVencidoFundacion',
    T.seguimientoVencidoFundacion({ seguimientoId: 7, mascota: 'Luna', ...PRIVADOS } as never),
  ],
  [
    'reporteRecibido',
    T.reporteRecibido({ seguimientoId: 7, mascota: 'Luna', ...PRIVADOS } as never),
  ],
  [
    'alertaBienestarFundacion',
    T.alertaBienestarFundacion({ seguimientoId: 7, mascota: 'Luna', ...PRIVADOS } as never),
  ],
  [
    'alertaBienestarAdministrador',
    T.alertaBienestarAdministrador({
      seguimientoId: 7,
      fundacionId: 3,
      fundacion: 'Huellas',
      mascota: 'Luna',
      ...PRIVADOS,
    } as never),
  ],
  [
    'donacionRecibida económica',
    T.donacionRecibida({
      donacionId: 8,
      tipo: 'economica',
      monto: '50000.50',
      ...PRIVADOS,
    } as never),
  ],
  [
    'donacionRecibida especie',
    T.donacionRecibida({ donacionId: 8, tipo: 'especie', monto: null, ...PRIVADOS } as never),
  ],
] as const;

describe('textos de los avisos', () => {
  it.each(avisos)('%s: en español, dentro de los límites y sin datos privados', (_n, aviso) => {
    expect(aviso.titulo.length).toBeGreaterThan(0);
    expect(Array.from(aviso.titulo).length).toBeLessThanOrEqual(100);
    expect(Array.from(aviso.mensaje).length).toBeLessThanOrEqual(300);
    expect(aviso.clave).toMatch(/^[a-z-]+\.[a-z-]+:\d+(:[a-z]+)?$/);
    const texto = JSON.stringify(aviso);
    for (const privado of Object.values(PRIVADOS)) expect(texto).not.toContain(privado);
    expect(aviso.referencia.id).toBeGreaterThan(0);
  });

  it('claves de deduplicación y referencias por evento', () => {
    expect(T.fundacionRegistrada({ fundacionId: 3, nombre: 'H' })).toMatchObject({
      clave: 'foundation.registered:3',
      referencia: { tipo: 'fundacion', id: 3 },
      tipo: 'validacion',
    });
    // Una fundación rechazada puede aprobarse después: ambos avisos deben poder existir.
    const rechazada = T.fundacionValidada({
      fundacionId: 3,
      decision: 'rechazada',
      observacion: 'x',
    });
    const aprobada = T.fundacionValidada({
      fundacionId: 3,
      decision: 'aprobada',
      observacion: null,
    });
    expect(rechazada.clave).toBe('foundation.validated:3:rechazada');
    expect(aprobada.clave).toBe('foundation.validated:3:aprobada');
    expect(T.solicitudAprobada({ solicitudId: 5, mascota: 'L' }).clave).toBe('adoption.approved:5');
    expect(
      T.solicitudRechazada({ solicitudId: 5, mascota: 'L', observacion: null, automatica: false })
        .clave,
    ).toBe('adoption.rejected:5');
    expect(T.solicitudRecibida({ solicitudId: 5, mascota: 'L' }).clave).toBe(
      'adoption-request.created:5',
    );
    expect(T.adopcionCerrada({ adopcionId: 9, estado: 'revocada', mascota: 'L' })).toMatchObject({
      clave: 'adoption.closed:9',
      tipo: 'adopcion',
      referencia: { tipo: 'adopcion', id: 9 },
    });
    expect(T.reporteRecibido({ seguimientoId: 7, mascota: 'L' }).clave).toBe(
      'follow-up.report-received:7',
    );
    expect(T.donacionRecibida({ donacionId: 8, tipo: 'especie', monto: null })).toMatchObject({
      clave: 'donation.registered:8',
      tipo: 'donacion',
      referencia: { tipo: 'donacion', id: 8 },
    });
  });

  it('el rechazo manual incluye la observación; el automático explica que la mascota ya fue adoptada', () => {
    const manual = T.solicitudRechazada({
      solicitudId: 5,
      mascota: 'Luna',
      observacion: 'No cumple',
      automatica: false,
    });
    expect(manual.mensaje).toContain('No cumple');
    const auto = T.solicitudRechazada({
      solicitudId: 5,
      mascota: 'Luna',
      observacion: 'otra',
      automatica: true,
    });
    expect(auto.mensaje).toContain('ya fue adoptada');
    expect(auto.mensaje).not.toContain('TEXTO-INTERNO');
  });

  it('el rechazo de fundación muestra su observación o un texto genérico', () => {
    expect(
      T.fundacionValidada({ fundacionId: 1, decision: 'rechazada', observacion: 'Falta RUT' })
        .mensaje,
    ).toContain('Falta RUT');
    expect(
      T.fundacionValidada({ fundacionId: 1, decision: 'rechazada', observacion: null }).mensaje,
    ).toContain('rechazó');
  });

  it('la alerta de bienestar al administrador apunta a la fundación y comparte clave con la de la fundación', () => {
    const admin = T.alertaBienestarAdministrador({
      seguimientoId: 7,
      fundacionId: 3,
      fundacion: 'Huellas',
      mascota: 'Luna',
    });
    const fundacion = T.alertaBienestarFundacion({ seguimientoId: 7, mascota: 'Luna' });
    expect(admin.referencia).toEqual({ tipo: 'fundacion', id: 3 });
    expect(fundacion.referencia).toEqual({ tipo: 'seguimiento', id: 7 });
    expect(admin.clave).toBe(fundacion.clave);
    expect(admin.mensaje).toContain('Huellas');
  });

  it('las fechas salen en español y en el día de Bogotá', () => {
    expect(T.fechaLarga('2026-11-05')).toBe('5 de noviembre de 2026');
    expect(T.fechaLarga('2026-01-01')).toBe('1 de enero de 2026');
    // 02:00Z del 6 de nov es todavía el 5 en Bogotá.
    expect(T.fechaLargaDeInstante(new Date('2026-11-06T02:00:00Z'))).toBe('5 de noviembre de 2026');
    const programado = T.seguimientoProgramado({
      seguimientoId: 7,
      fundacion: 'Huellas',
      tipo: 'visita',
      mascota: 'Luna',
      fecha: '2026-11-05',
    });
    expect(programado.mensaje).toBe(
      'Huellas programó una visita para Luna el 5 de noviembre de 2026.',
    );
    expect(
      T.seguimientoProgramado({
        seguimientoId: 7,
        fundacion: 'H',
        tipo: 'reporte',
        mascota: 'L',
        fecha: '2026-11-05',
      }).mensaje,
    ).toContain('un reporte');
  });

  it.each([
    [0, 'hoy'],
    [1, 'mañana'],
    [3, 'en 3 días'],
  ])('el recordatorio con %i día(s) dice «vence %s»', (dias, texto) => {
    const a = T.seguimientoPorVencer({
      seguimientoId: 7,
      tipo: 'visita',
      mascota: 'Luna',
      fecha: '2026-11-05',
      diasRestantes: dias,
    });
    expect(a.mensaje).toContain(`vence ${texto},`);
  });

  it('el vencido al adoptante invita a reportar; el de la fundación solo informa', () => {
    expect(T.seguimientoVencidoAdoptante({ seguimientoId: 7, mascota: 'Luna' }).mensaje).toContain(
      'Envía tu reporte',
    );
    expect(T.seguimientoVencidoFundacion({ seguimientoId: 7, mascota: 'Luna' }).mensaje).toBe(
      'Seguimiento vencido de Luna.',
    );
  });

  it('recorta un texto largo (nombre de mascota u observación) en lugar de fallar', () => {
    const largo = T.solicitudRechazada({
      solicitudId: 5,
      mascota: 'L'.repeat(100),
      observacion: 'o'.repeat(300),
      automatica: false,
    });
    expect(Array.from(largo.mensaje)).toHaveLength(300);
    expect(largo.mensaje.endsWith('…')).toBe(true);
  });

  it('cierre de adopción: finalizada y revocada, sin motivo', () => {
    expect(T.adopcionCerrada({ adopcionId: 9, estado: 'finalizada', mascota: 'Luna' }).titulo).toBe(
      'Tu adopción fue finalizada',
    );
    expect(T.adopcionCerrada({ adopcionId: 9, estado: 'revocada', mascota: 'Luna' }).titulo).toBe(
      'Tu adopción fue revocada',
    );
  });
});

describe('montos y detalle de donación', () => {
  it.each([
    ['50000', '$ 50.000 COP'],
    ['50000.00', '$ 50.000 COP'],
    ['50000.50', '$ 50.000,50 COP'],
    ['999', '$ 999 COP'],
    ['1000000000.00', '$ 1.000.000.000 COP'],
    ['0.05', '$ 0,05 COP'],
  ])('formatearMonto(%s) = %s', (monto, esperado) =>
    expect(T.formatearMonto(monto)).toBe(esperado),
  );

  it('el aviso a la fundación indica el tipo y el monto, sin datos del donante', () => {
    expect(
      T.donacionRecibida({ donacionId: 8, tipo: 'economica', monto: '50000.00' }).mensaje,
    ).toBe('Recibiste una donación económica de $ 50.000 COP.');
    expect(T.donacionRecibida({ donacionId: 8, tipo: 'especie', monto: null }).mensaje).toBe(
      'Recibiste una donación en especie.',
    );
  });

  it('la notificación al donante nombra la fundación y comparte clave con la de la fundación', () => {
    const donante = T.donacionRegistrada({
      donacionId: 8,
      fundacion: 'Huellas',
      tipo: 'economica',
      monto: '1500.50',
    });
    expect(donante.mensaje).toBe(
      'Registramos tu donación económica de $ 1.500,50 COP a Huellas. ¡Gracias por ayudar!',
    );
    // Las claves son por destinatario: donante y fundación son usuarios distintos.
    expect(donante.clave).toBe(
      T.donacionRecibida({ donacionId: 8, tipo: 'especie', monto: null }).clave,
    );
  });

  it('el detalle del correo al donante incluye su descripción', () => {
    expect(
      T.detalleDonacion({ tipo: 'economica', monto: '1500.50', descripcionEspecie: null }),
    ).toBe('Donación económica de $ 1.500,50 COP');
    expect(T.detalleDonacion({ tipo: 'especie', monto: null, descripcionEspecie: 'Cobijas' })).toBe(
      'Donación en especie: Cobijas',
    );
    expect(T.detalleDonacion({ tipo: 'especie', monto: null, descripcionEspecie: null })).toBe(
      'Donación en especie',
    );
  });
});
