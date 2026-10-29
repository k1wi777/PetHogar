import { Logger } from '@nestjs/common';
import { SmtpMailService } from './smtp-mail.service';
import { renderizar } from './plantillas/plantillas';

const REMITENTE = 'PetHogar <no-reply@pethogar.local>';

describe('renderizar', () => {
  it('genera asunto, texto y HTML en español para la plantilla de prueba', () => {
    const r = renderizar('prueba', { nombre: 'Ana' });
    expect(r.asunto).toBe('Correo de prueba de PetHogar');
    expect(r.texto).toContain('Hola, Ana.');
    expect(r.html).toContain('<html lang="es">');
    expect(r.html).toContain('PetHogar');
  });

  it('escapa los datos dinámicos en el HTML y los deja tal cual en el texto', () => {
    const r = renderizar('notificacion', {
      nombre: '<b>Ana</b>',
      titulo: 'Tu "solicitud"\r\nBcc: x@y.z',
      mensaje: '<script>alert(1)</script> & más',
      enlace: 'http://localhost:3000/?a=1&b="2"',
    });
    expect(r.html).not.toContain('<script>');
    expect(r.html).not.toContain('<b>Ana');
    expect(r.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; más');
    expect(r.html).toContain('a=1&amp;b=&quot;2&quot;');
    expect(r.texto).toContain('<script>alert(1)</script> & más');
    expect(r.asunto).not.toMatch(/[\r\n]/);
  });

  it('genera la confirmación de donación con detalle y fecha, escapando los datos', () => {
    const r = renderizar('donacion-confirmacion', {
      nombre: '<b>Ana</b>',
      fundacion: 'Huellas & Patas',
      detalle: 'Donación en especie: <script>x</script>',
      fecha: '29 de octubre de 2026',
    });
    expect(r.asunto).toBe('Confirmamos tu donación en PetHogar');
    expect(r.texto).toContain('Huellas & Patas');
    expect(r.texto).toContain('29 de octubre de 2026');
    expect(r.html).toContain('Huellas &amp; Patas');
    expect(r.html).not.toContain('<script>');
    expect(r.html).not.toContain('<b>Ana');
  });

  it('genera el correo de verificación con el enlace y su vigencia, escapando el nombre', () => {
    const enlace = 'http://localhost:3000/verificar-correo?token=abc_-123';
    const r = renderizar('verificacion-correo', {
      nombre: '<i>Ana</i>',
      enlace,
      horasVigencia: 24,
    });
    expect(r.asunto).toBe('Verifica tu correo en PetHogar');
    expect(r.texto).toContain(enlace);
    expect(r.texto).toContain('24 horas');
    expect(r.html).toContain(`href="${enlace}"`);
    expect(r.html).not.toContain('<i>Ana');
  });

  it('genera el correo de recuperación con el código y su vigencia, escapando el nombre', () => {
    const r = renderizar('recuperacion-contrasena', {
      nombre: '<i>Ana</i>',
      codigo: '012345',
      minutosVigencia: 15,
    });
    expect(r.asunto).toBe('Tu código de recuperación de PetHogar');
    expect(r.texto).toContain('012345');
    expect(r.texto).toContain('15 minutos');
    expect(r.texto).toContain('No lo compartas');
    expect(r.html).toContain('012345');
    expect(r.html).not.toContain('<i>Ana');
  });

  it('genera el correo de recepción de la fundación', () => {
    const r = renderizar('registro-fundacion-recibido', { nombreFundacion: 'Huellas & Patas' });
    expect(r.asunto).toBe('Recibimos el registro de tu fundación');
    expect(r.html).toContain('Huellas &amp; Patas');
    expect(r.texto).toContain('hasta que tu fundación sea aprobada');
  });
});

describe('SmtpMailService', () => {
  let error: jest.SpyInstance;

  beforeEach(() => {
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('envía el correo renderizado con el remitente configurado', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    const servicio = new SmtpMailService({ sendMail }, REMITENTE);

    const r = await servicio.enviar({
      para: 'ana@example.com',
      plantilla: 'prueba',
      datos: { nombre: 'Ana' },
    });

    expect(r).toEqual({ enviado: true });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: REMITENTE,
        to: 'ana@example.com',
        subject: 'Correo de prueba de PetHogar',
        text: expect.stringContaining('Ana'),
        html: expect.stringContaining('Ana'),
      }),
    );
  });

  it('no lanza si el SMTP falla: lo registra y devuelve enviado=false', async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED'));
    const servicio = new SmtpMailService({ sendMail }, REMITENTE);

    const r = await servicio.enviar({
      para: 'ana@example.com',
      plantilla: 'prueba',
      datos: { nombre: 'Ana' },
    });

    expect(r).toEqual({ enviado: false, error: 'connect ECONNREFUSED' });
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).not.toContain('ana@example.com');
  });

  it('no lanza si la plantilla es inválida', async () => {
    const sendMail = jest.fn();
    const servicio = new SmtpMailService({ sendMail }, REMITENTE);
    const r = await servicio.enviar({ para: 'a@b.c', plantilla: 'inexistente' } as never);
    expect(r.enviado).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
