import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { QueryFailedError } from 'typeorm';
import { FundacionesService } from '../fundaciones/fundaciones.service';
import type { IMailService } from '../mail/mail.interface';
import type { IStorageService } from '../storage/storage.interface';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { RegistroAdoptanteDto } from './dto/registro-adoptante.dto';
import type { RegistroFundacionDto } from './dto/registro-fundacion.dto';
import { RegistroService } from './registro.service';
import { VerificacionService } from './verificacion.service';

const AHORA = new Date('2026-10-29T12:00:00Z');
const MANAGER = { id: 'manager' } as never;

const ADOPTANTE: RegistroAdoptanteDto = {
  primerNombre: 'Ana',
  segundoNombre: undefined,
  primerApellido: 'Pérez',
  segundoApellido: undefined,
  tipoDocumento: 'CC',
  numeroDocumento: '123456789',
  fechaNacimiento: '1995-04-23',
  telefono: '3001234567',
  email: 'ana@example.com',
  direccion: 'Calle 1 # 2-3',
  ciudad: 'Montería',
  contrasena: 'Clave1234',
  aceptaPoliticaDatos: true,
};

const FUNDACION: RegistroFundacionDto = {
  nombre: 'Huellas',
  nit: '900123456-7',
  direccion: 'Carrera 5',
  ciudad: 'Montería',
  descripcion: undefined,
  telefono: '3109876543',
  email: 'huellas@example.com',
  contrasena: 'Clave1234',
  aceptaPoliticaDatos: true,
};

const DOCUMENTO = {
  buffer: Buffer.from('%PDF-1.7 x'),
  originalname: 'acta.pdf',
} as Express.Multer.File;

function uniqueViolation(constraint: string): QueryFailedError {
  return new QueryFailedError('INSERT', [], { code: '23505', constraint } as never);
}

function crear() {
  const usuarios = {
    existeEmail: jest.fn().mockResolvedValue(false),
    existeDocumento: jest.fn().mockResolvedValue(false),
    crearAdoptante: jest.fn().mockResolvedValue({ id: 1, email: 'ana@example.com' }),
    crearUsuarioFundacion: jest.fn().mockResolvedValue({ id: 2, email: 'huellas@example.com' }),
  };
  const fundaciones = {
    existeNit: jest.fn().mockResolvedValue(false),
    crear: jest.fn().mockResolvedValue({}),
  };
  const verificacion = {
    generarToken: jest
      .fn()
      .mockReturnValue({ token: 'tok', hash: 'hash', expira: new Date(AHORA.getTime() + 1000) }),
    enviarCorreo: jest.fn().mockResolvedValue(undefined),
  };
  const storage = {
    guardar: jest.fn().mockResolvedValue({ clave: 'privado/fundaciones/a.pdf' }),
    eliminar: jest.fn().mockResolvedValue(undefined),
  };
  const mail = { enviar: jest.fn().mockResolvedValue({ enviado: true }) };
  const dataSource = {
    transaction: jest.fn((cb: (m: unknown) => Promise<unknown>) => cb(MANAGER)),
  };
  const service = new RegistroService(
    dataSource as never,
    usuarios as unknown as UsuariosService,
    fundaciones as unknown as FundacionesService,
    verificacion as unknown as VerificacionService,
    storage as unknown as IStorageService,
    mail as unknown as IMailService,
  );
  return { service, usuarios, fundaciones, verificacion, storage, mail, dataSource };
}

describe('RegistroService — adoptante', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(AHORA);
  });
  afterEach(() => jest.useRealTimers());

  it('crea usuario y adoptante en una transacción, con bcrypt y token solo como hash', async () => {
    const { service, usuarios, verificacion, dataSource } = crear();
    const r = await service.registrarAdoptante(ADOPTANTE);

    expect(r.mensaje).toContain('Revisa tu correo');
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    const [datos, manager] = usuarios.crearAdoptante.mock.calls[0];
    expect(manager).toBe(MANAGER);
    expect(datos.contrasenaHash).not.toBe('Clave1234');
    expect(await bcrypt.compare('Clave1234', datos.contrasenaHash)).toBe(true);
    expect(datos).toMatchObject({
      email: 'ana@example.com',
      aceptaPoliticaDatos: true,
      fechaAceptacion: AHORA,
      segundoNombre: null,
      tokenVerificacionHash: 'hash',
    });
    expect(JSON.stringify(datos)).not.toContain('"tok"');
    expect(verificacion.enviarCorreo).toHaveBeenCalledWith('ana@example.com', 'Ana', 'tok');
  });

  it('rechaza a un menor de edad sin crear nada ni enviar correo', async () => {
    const { service, usuarios, verificacion } = crear();
    await expect(
      service.registrarAdoptante({ ...ADOPTANTE, fechaNacimiento: '2015-01-01' }),
    ).rejects.toThrow('Debes ser mayor de 18 años');
    expect(usuarios.crearAdoptante).not.toHaveBeenCalled();
    expect(verificacion.enviarCorreo).not.toHaveBeenCalled();
  });

  it('rechaza correo y documento duplicados con 409', async () => {
    const a = crear();
    a.usuarios.existeEmail.mockResolvedValue(true);
    await expect(a.service.registrarAdoptante(ADOPTANTE)).rejects.toThrow(
      new ConflictException('Ya existe una cuenta registrada con este correo'),
    );
    const b = crear();
    b.usuarios.existeDocumento.mockResolvedValue(true);
    await expect(b.service.registrarAdoptante(ADOPTANTE)).rejects.toThrow('número de documento');
    expect(b.usuarios.crearAdoptante).not.toHaveBeenCalled();
  });

  it('traduce la violación de unicidad de una carrera a 409 y no envía correo', async () => {
    const { service, usuarios, verificacion } = crear();
    usuarios.crearAdoptante.mockRejectedValue(uniqueViolation('uq_adoptante_numero_documento'));
    await expect(service.registrarAdoptante(ADOPTANTE)).rejects.toBeInstanceOf(ConflictException);
    expect(verificacion.enviarCorreo).not.toHaveBeenCalled();
  });

  it('propaga cualquier otro error de base de datos sin traducirlo', async () => {
    const { service, usuarios } = crear();
    const error = new Error('conexión perdida');
    usuarios.crearAdoptante.mockRejectedValue(error);
    await expect(service.registrarAdoptante(ADOPTANTE)).rejects.toBe(error);
  });
});

describe('RegistroService — fundación', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('guarda el documento en la carpeta privada y crea usuario y fundación en una transacción', async () => {
    const { service, usuarios, fundaciones, storage, mail } = crear();
    const r = await service.registrarFundacion(FUNDACION, DOCUMENTO);

    expect(storage.guardar).toHaveBeenCalledWith(
      { buffer: DOCUMENTO.buffer, nombreOriginal: 'acta.pdf' },
      { categoria: 'documento', carpeta: 'fundaciones' },
    );
    expect(usuarios.crearUsuarioFundacion.mock.calls[0][1]).toBe(MANAGER);
    expect(fundaciones.crear).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 2, documentoClave: 'privado/fundaciones/a.pdf' }),
      MANAGER,
    );
    expect(r).toMatchObject({ estadoValidacion: 'pendiente' });
    expect(r.mensaje).toContain('revisará');
    expect(mail.enviar).toHaveBeenCalledWith({
      para: 'huellas@example.com',
      plantilla: 'registro-fundacion-recibido',
      datos: { nombreFundacion: 'Huellas' },
    });
  });

  it('exige el documento y no toca nada si falta', async () => {
    const { service, storage, usuarios } = crear();
    await expect(service.registrarFundacion(FUNDACION, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(storage.guardar).not.toHaveBeenCalled();
    expect(usuarios.existeEmail).not.toHaveBeenCalled();
  });

  it('rechaza NIT o correo duplicados antes de guardar el archivo', async () => {
    const a = crear();
    a.fundaciones.existeNit.mockResolvedValue(true);
    await expect(a.service.registrarFundacion(FUNDACION, DOCUMENTO)).rejects.toThrow('NIT');
    expect(a.storage.guardar).not.toHaveBeenCalled();
    const b = crear();
    b.usuarios.existeEmail.mockResolvedValue(true);
    await expect(b.service.registrarFundacion(FUNDACION, DOCUMENTO)).rejects.toThrow('correo');
    expect(b.storage.guardar).not.toHaveBeenCalled();
  });

  it('propaga el error del storage (tipo o tamaño inválidos) sin crear datos', async () => {
    const { service, storage, usuarios } = crear();
    storage.guardar.mockRejectedValue(
      new BadRequestException('Solo se permiten archivos JPG, PNG o PDF'),
    );
    await expect(service.registrarFundacion(FUNDACION, DOCUMENTO)).rejects.toThrow(
      'JPG, PNG o PDF',
    );
    expect(usuarios.crearUsuarioFundacion).not.toHaveBeenCalled();
  });

  it('elimina el archivo si la transacción falla y conserva el error original', async () => {
    const { service, fundaciones, storage, mail } = crear();
    fundaciones.crear.mockRejectedValue(uniqueViolation('uq_fundacion_nit'));
    await expect(service.registrarFundacion(FUNDACION, DOCUMENTO)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(storage.eliminar).toHaveBeenCalledWith('privado/fundaciones/a.pdf');
    expect(mail.enviar).not.toHaveBeenCalled();
  });

  it('si además falla la limpieza, registra el fallo y no oculta el error original', async () => {
    const { service, fundaciones, storage } = crear();
    const original = new Error('fallo de BD');
    fundaciones.crear.mockRejectedValue(original);
    storage.eliminar.mockRejectedValue(new Error('disco'));
    await expect(service.registrarFundacion(FUNDACION, DOCUMENTO)).rejects.toBe(original);
    expect(Logger.prototype.error).toHaveBeenCalled();
  });

  it('un fallo de envío del correo de recepción no revierte el registro', async () => {
    const { service, mail, storage } = crear();
    mail.enviar.mockResolvedValue({ enviado: false, error: 'SMTP caído' });
    await expect(service.registrarFundacion(FUNDACION, DOCUMENTO)).resolves.toMatchObject({
      estadoValidacion: 'pendiente',
    });
    expect(storage.eliminar).not.toHaveBeenCalled();
  });
});
