import { Logger } from '@nestjs/common';
import { EntregaAvisoService } from './entrega-aviso.service';
import type { Aviso } from './textos-aviso';

const AVISO: Aviso = {
  tipo: 'solicitud',
  titulo: 'Tu solicitud fue aprobada',
  mensaje: 'Tu solicitud para Luna fue aprobada.',
  referencia: { tipo: 'solicitud', id: 5 },
  clave: 'adoption.approved:5',
};
const CORREO = { correo: { plantilla: 'notificacion' as const } };

function crear() {
  const usuarios = { contactoActivo: jest.fn() };
  const notificaciones = { crear: jest.fn() };
  const mail = { enviar: jest.fn() };
  const config = { get: jest.fn().mockReturnValue('http://localhost:3000/') };
  usuarios.contactoActivo.mockResolvedValue({ email: 'ana@x.co', nombre: 'Ana' });
  notificaciones.crear.mockResolvedValue({ creada: true });
  mail.enviar.mockResolvedValue({ enviado: true });
  const service = new EntregaAvisoService(
    usuarios as never,
    notificaciones as never,
    mail as never,
    config as never,
  );
  return { service, usuarios, notificaciones, mail };
}

describe('EntregaAvisoService', () => {
  let error: jest.SpyInstance;
  beforeEach(() => {
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('crea la notificación con el aviso completo y envía el correo con el enlace', async () => {
    const { service, notificaciones, mail } = crear();
    await service.entregar(9, AVISO, CORREO);
    expect(notificaciones.crear).toHaveBeenCalledWith({ usuarioId: 9, ...AVISO });
    expect(mail.enviar).toHaveBeenCalledWith({
      para: 'ana@x.co',
      plantilla: 'notificacion',
      datos: {
        nombre: 'Ana',
        titulo: AVISO.titulo,
        mensaje: AVISO.mensaje,
        enlace: 'http://localhost:3000/notificaciones',
      },
    });
  });

  it('sin correo solicitado solo crea la notificación', async () => {
    const { service, mail } = crear();
    await service.entregar(9, AVISO);
    expect(mail.enviar).not.toHaveBeenCalled();
  });

  it('una cuenta desactivada (o inexistente) no recibe notificación ni correo', async () => {
    const { service, usuarios, notificaciones, mail } = crear();
    usuarios.contactoActivo.mockResolvedValue(null);
    await service.entregar(9, AVISO, CORREO);
    expect(notificaciones.crear).not.toHaveBeenCalled();
    expect(mail.enviar).not.toHaveBeenCalled();
  });

  it('un duplicado (misma clave) no reenvía el correo', async () => {
    const { service, notificaciones, mail } = crear();
    notificaciones.crear.mockResolvedValue({ creada: false });
    await service.entregar(9, AVISO, CORREO);
    expect(mail.enviar).not.toHaveBeenCalled();
  });

  it('si crear lanza, lo registra, no propaga y el correo se intenta igual', async () => {
    const { service, notificaciones, mail } = crear();
    notificaciones.crear.mockRejectedValue(new Error('BD caída'));
    await expect(service.entregar(9, AVISO, CORREO)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('BD caída'));
    expect(mail.enviar).toHaveBeenCalledTimes(1);
  });

  it('un correo que falla (enviado: false o excepción) se registra y no propaga', async () => {
    const { service, notificaciones, mail } = crear();
    mail.enviar.mockResolvedValueOnce({ enviado: false, error: 'SMTP caído' });
    await expect(service.entregar(9, AVISO, CORREO)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('SMTP caído'));
    mail.enviar.mockRejectedValueOnce(new Error('boom'));
    await expect(service.entregar(9, AVISO, CORREO)).resolves.toBeUndefined();
    expect(notificaciones.crear).toHaveBeenCalledTimes(2);
  });

  it('si ni siquiera se puede leer el contacto, no propaga', async () => {
    const { service, usuarios } = crear();
    usuarios.contactoActivo.mockRejectedValue(new Error('BD caída'));
    await expect(service.entregar(9, AVISO, CORREO)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });

  it('usa el nombre indicado (fundación) o uno genérico si el contacto no tiene', async () => {
    const { service, usuarios, mail } = crear();
    await service.entregar(9, AVISO, { ...CORREO, nombre: 'Huellas' });
    expect(mail.enviar.mock.calls[0][0].datos.nombre).toBe('Huellas');
    usuarios.contactoActivo.mockResolvedValue({ email: 'f@x.co', nombre: null });
    await service.entregar(9, AVISO, CORREO);
    expect(mail.enviar.mock.calls[1][0].datos.nombre).toBe('usuario de PetHogar');
  });

  it('la confirmación de donación usa su plantilla con detalle y fecha', async () => {
    const { service, mail } = crear();
    await service.entregar(9, AVISO, {
      correo: {
        plantilla: 'donacion-confirmacion',
        fundacion: 'Huellas',
        detalle: 'Donación económica de $ 50.000 COP',
        fecha: '29 de octubre de 2026',
      },
    });
    expect(mail.enviar).toHaveBeenCalledWith({
      para: 'ana@x.co',
      plantilla: 'donacion-confirmacion',
      datos: {
        nombre: 'Ana',
        fundacion: 'Huellas',
        detalle: 'Donación económica de $ 50.000 COP',
        fecha: '29 de octubre de 2026',
      },
    });
  });
});
