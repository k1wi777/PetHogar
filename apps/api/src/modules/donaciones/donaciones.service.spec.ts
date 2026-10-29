import { BadRequestException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { DonationRegistered } from '../../common/events';
import { EstadoValidacion } from '../fundaciones/entities/fundacion.enum';
import { clausulaDeDonaciones } from './donaciones.repository';
import { DonacionesService, filtroDePeriodo } from './donaciones.service';
import type { DonacionesDeFundacion, FilaDonacion } from './donaciones.types';
import { ConsultaDonacionesDto } from './dto/consulta-donaciones.dto';
import type { CrearDonacionManualDto } from './dto/crear-donacion-manual.dto';
import type { CrearDonacionDto } from './dto/crear-donacion.dto';
import { TipoDonacion } from './entities/donacion.enum';

const USUARIO = { id: 9, rol: 'adoptante' } as const;
const FUNDACION = {
  id: 3,
  nombre: 'Huellas',
  usuarioId: 20,
  estadoValidacion: EstadoValidacion.Aprobada,
};
const PDF = Buffer.from('%PDF-1.7 x');
const GUARDADA = { id: 55, fecha: new Date('2026-10-29T15:00:00Z'), monto: '50000.50' };
const ECONOMICA = {
  fundacionId: 3,
  tipo: TipoDonacion.Economica,
  monto: '50000.5',
} as CrearDonacionDto;
const ESPECIE = {
  fundacionId: 3,
  tipo: TipoDonacion.Especie,
  descripcion: 'Dos bultos de croquetas',
} as CrearDonacionDto;

function crear() {
  const orden: string[] = [];
  const repo = {
    insertar: jest.fn(),
    listar: jest.fn(),
    agregar: jest.fn(),
    buscarParaAviso: jest.fn(),
  };
  const fundaciones = { datosBasicos: jest.fn(), nombresPorUsuarioIds: jest.fn() };
  const usuarios = { nombresPorUsuarioIds: jest.fn() };
  const storage = { guardar: jest.fn(), eliminar: jest.fn() };
  const eventos = { emit: jest.fn() };
  fundaciones.datosBasicos.mockResolvedValue(FUNDACION);
  fundaciones.nombresPorUsuarioIds.mockResolvedValue(new Map());
  usuarios.nombresPorUsuarioIds.mockResolvedValue(new Map());
  storage.guardar.mockImplementation(() => {
    orden.push('archivo');
    return Promise.resolve({ clave: 'privado/donaciones/a.pdf' });
  });
  storage.eliminar.mockResolvedValue(undefined);
  repo.insertar.mockImplementation(() => {
    orden.push('insert');
    return Promise.resolve(GUARDADA);
  });
  eventos.emit.mockImplementation(() => orden.push('evento'));
  const service = new DonacionesService(
    repo as never,
    fundaciones as never,
    usuarios as never,
    storage as never,
    eventos as never,
  );
  return { service, repo, fundaciones, usuarios, storage, eventos, orden };
}

describe('DonacionesService.crear', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('económica con comprobante: valida, guarda el archivo, inserta y emite, en ese orden', async () => {
    const { service, repo, storage, eventos, orden } = crear();
    const r = await service.crear(USUARIO, ECONOMICA, PDF);

    expect(orden).toEqual(['archivo', 'insert', 'evento']);
    expect(storage.guardar).toHaveBeenCalledWith(
      { buffer: PDF },
      { categoria: 'documento', carpeta: 'donaciones' },
    );
    expect(repo.insertar).toHaveBeenCalledWith({
      fundacionId: 3,
      usuarioId: 9,
      nombreDonante: null,
      tipo: 'economica',
      monto: '50000.50',
      descripcionEspecie: null,
      comprobanteClave: 'privado/donaciones/a.pdf',
    });
    expect(eventos.emit).toHaveBeenCalledWith(
      DonationRegistered.eventName,
      new DonationRegistered(55, 3, 9),
    );
    expect(r).toEqual({
      id: 55,
      fundacion: { id: 3, nombre: 'Huellas' },
      tipo: 'economica',
      monto: '50000.50',
      descripcionEspecie: null,
      fecha: GUARDADA.fecha,
      comprobante: true,
    });
    expect(JSON.stringify(r)).not.toContain('privado/');
  });

  it('en especie guarda la descripción, no el monto, y sin comprobante no toca el storage', async () => {
    const { service, repo, storage } = crear();
    repo.insertar.mockResolvedValue({ ...GUARDADA, monto: null });
    const r = await service.crear(
      USUARIO,
      { ...ESPECIE, monto: '999' } as CrearDonacionDto,
      undefined,
    );
    expect(storage.guardar).not.toHaveBeenCalled();
    expect(repo.insertar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'especie',
        monto: null,
        descripcionEspecie: 'Dos bultos de croquetas',
        comprobanteClave: null,
      }),
    );
    expect(r).toMatchObject({ monto: null, comprobante: false });
  });

  it('el monto se normaliza por cadena, sin pasar por Number', async () => {
    const { service, repo } = crear();
    await service.crear(USUARIO, { ...ECONOMICA, monto: '9007199254740993.1' } as CrearDonacionDto);
    expect(repo.insertar.mock.calls[0][0].monto).toBe('9007199254740993.10');
  });

  it.each([
    ['inexistente', null],
    ['pendiente', { ...FUNDACION, estadoValidacion: EstadoValidacion.Pendiente }],
    ['rechazada', { ...FUNDACION, estadoValidacion: EstadoValidacion.Rechazada }],
  ])('fundación %s: el mismo 404, sin archivo, sin fila y sin evento', async (_n, fundacion) => {
    const { service, fundaciones, repo, storage, eventos } = crear();
    fundaciones.datosBasicos.mockResolvedValue(fundacion);
    const error = await service.crear(USUARIO, ECONOMICA, PDF).catch((e: unknown) => e);
    expect(error).toEqual(new NotFoundException('La fundación no existe o no recibe donaciones'));
    expect(storage.guardar).not.toHaveBeenCalled();
    expect(repo.insertar).not.toHaveBeenCalled();
    expect(eventos.emit).not.toHaveBeenCalled();
  });

  it('donar a la propia fundación es 403 y no guarda nada', async () => {
    const { service, repo, storage } = crear();
    await expect(
      service.crear({ id: 20, rol: 'fundacion' }, ECONOMICA, PDF),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.guardar).not.toHaveBeenCalled();
    expect(repo.insertar).not.toHaveBeenCalled();
  });

  it('una fundación puede donar a otra', async () => {
    const { service } = crear();
    await expect(service.crear({ id: 21, rol: 'fundacion' }, ECONOMICA)).resolves.toMatchObject({
      id: 55,
    });
  });

  it('si el INSERT falla borra el comprobante, propaga el error original y no emite', async () => {
    const { service, repo, storage, eventos } = crear();
    const original = new Error('fallo de BD');
    repo.insertar.mockRejectedValue(original);
    await expect(service.crear(USUARIO, ECONOMICA, PDF)).rejects.toBe(original);
    expect(storage.eliminar).toHaveBeenCalledWith('privado/donaciones/a.pdf');
    expect(eventos.emit).not.toHaveBeenCalled();
  });

  it('si además falla la limpieza, lo registra y no oculta el error original', async () => {
    const { service, repo, storage } = crear();
    const original = new Error('fallo de BD');
    repo.insertar.mockRejectedValue(original);
    storage.eliminar.mockRejectedValue(new Error('disco'));
    await expect(service.crear(USUARIO, ECONOMICA, PDF)).rejects.toBe(original);
    expect(Logger.prototype.error).toHaveBeenCalled();
  });

  it('un comprobante inválido (el storage lanza) no inserta nada ni emite', async () => {
    const { service, repo, storage, eventos } = crear();
    storage.guardar.mockRejectedValue(
      new BadRequestException('Solo se permiten archivos JPG, PNG o PDF'),
    );
    await expect(service.crear(USUARIO, ECONOMICA, PDF)).rejects.toThrow('JPG, PNG o PDF');
    expect(repo.insertar).not.toHaveBeenCalled();
    expect(storage.eliminar).not.toHaveBeenCalled();
    expect(eventos.emit).not.toHaveBeenCalled();
  });

  it('un listener que lanza no rompe la donación', async () => {
    const { service, eventos } = crear();
    eventos.emit.mockImplementation(() => {
      throw new Error('listener roto');
    });
    await expect(service.crear(USUARIO, ECONOMICA)).resolves.toMatchObject({ id: 55 });
  });

  it('defensa en profundidad: sin monto o sin descripción es 400 sin guardar', async () => {
    const { service, storage } = crear();
    await expect(
      service.crear(
        USUARIO,
        { fundacionId: 3, tipo: TipoDonacion.Economica } as CrearDonacionDto,
        PDF,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.crear(
        USUARIO,
        { fundacionId: 3, tipo: TipoDonacion.Especie } as CrearDonacionDto,
        PDF,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.guardar).not.toHaveBeenCalled();
  });
});

describe('DonacionesService.crearManual', () => {
  const MANUAL = {
    nombreDonante: 'Ana Ruiz',
    tipo: TipoDonacion.Economica,
    monto: '100',
  } as CrearDonacionManualDto;

  it('usa la fundación del token, sin usuario donante, y no emite evento', async () => {
    const { service, repo, eventos } = crear();
    const r = await service.crearManual(3, MANUAL, PDF);
    expect(repo.insertar).toHaveBeenCalledWith(
      expect.objectContaining({
        fundacionId: 3,
        usuarioId: null,
        nombreDonante: 'Ana Ruiz',
        monto: '100.00',
      }),
    );
    expect(eventos.emit).not.toHaveBeenCalled();
    expect(r).toMatchObject({ id: 55, fundacion: { id: 3, nombre: 'Huellas' } });
  });

  it('limpia el comprobante si el INSERT falla', async () => {
    const { service, repo, storage } = crear();
    repo.insertar.mockRejectedValue(new Error('fallo'));
    await expect(service.crearManual(3, MANUAL, PDF)).rejects.toThrow('fallo');
    expect(storage.eliminar).toHaveBeenCalledWith('privado/donaciones/a.pdf');
  });
});

describe('filtroDePeriodo', () => {
  const consulta = (datos: object) => plainToInstance(ConsultaDonacionesDto, datos);

  it('convierte el periodo de Bogotá a un intervalo semiabierto con el último día incluido', () => {
    const f = filtroDePeriodo(consulta({ desde: '2026-10-01', hasta: '2026-10-31' }));
    // 00:00 en Bogotá = 05:00Z; el día siguiente al último a las 05:00Z queda fuera.
    expect(f.desde?.toISOString()).toBe('2026-10-01T05:00:00.000Z');
    expect(f.hastaExclusivo?.toISOString()).toBe('2026-11-01T05:00:00.000Z');
  });

  it('un solo día (desde = hasta) cubre las 24 horas de Bogotá', () => {
    const f = filtroDePeriodo(consulta({ desde: '2026-10-05', hasta: '2026-10-05' }));
    expect(f.hastaExclusivo!.getTime() - f.desde!.getTime()).toBe(86_400_000);
  });

  it('sin fechas no filtra por periodo y conserva el tipo', () => {
    expect(filtroDePeriodo(consulta({ tipo: 'especie' }))).toEqual({
      desde: undefined,
      hastaExclusivo: undefined,
      tipo: 'especie',
    });
  });

  it('hasta anterior a desde es 400', () => {
    expect(() => filtroDePeriodo(consulta({ desde: '2026-10-05', hasta: '2026-10-04' }))).toThrow(
      new BadRequestException('La fecha final no puede ser anterior a la inicial'),
    );
  });
});

describe('clausulaDeDonaciones', () => {
  it('siempre filtra por fundación y numera los parámetros en orden', () => {
    const { where, parametros } = clausulaDeDonaciones(3, {
      desde: new Date('2026-10-01T05:00:00Z'),
      hastaExclusivo: new Date('2026-11-01T05:00:00Z'),
      tipo: TipoDonacion.Economica,
    });
    expect(where).toBe(
      '"fundacion_id" = $1 AND "fecha" >= $2::timestamptz AND "fecha" < $3::timestamptz AND "tipo" = $4',
    );
    expect(parametros).toEqual([
      3,
      '2026-10-01T05:00:00.000Z',
      '2026-11-01T05:00:00.000Z',
      'economica',
    ]);
  });

  it('sin filtros solo acota por fundación', () => {
    expect(clausulaDeDonaciones(3, {})).toEqual({ where: '"fundacion_id" = $1', parametros: [3] });
  });
});

describe('DonacionesService.listar', () => {
  const FILAS: FilaDonacion[] = [
    {
      id: 3,
      tipo: TipoDonacion.Economica,
      monto: '10.00',
      descripcionEspecie: null,
      fecha: new Date(),
      usuarioId: 9,
      nombreDonante: null,
      tieneComprobante: true,
    },
    {
      id: 2,
      tipo: TipoDonacion.Especie,
      monto: null,
      descripcionEspecie: 'Cobijas',
      fecha: new Date(),
      usuarioId: 21,
      nombreDonante: null,
      tieneComprobante: false,
    },
    {
      id: 1,
      tipo: TipoDonacion.Economica,
      monto: '5.50',
      descripcionEspecie: null,
      fecha: new Date(),
      usuarioId: null,
      nombreDonante: 'Pedro Paz',
      tieneComprobante: false,
    },
  ];

  it('usa el MISMO filtro para la página y para el agregado y suma el total del agregado', async () => {
    const { service, repo, usuarios, fundaciones } = crear();
    repo.listar.mockResolvedValue(FILAS);
    repo.agregar.mockResolvedValue([
      { tipo: 'economica', cantidad: 7, monto: '1500.50' },
      { tipo: 'especie', cantidad: 2, monto: '0.00' },
    ]);
    usuarios.nombresPorUsuarioIds.mockResolvedValue(new Map([[9, 'Ana Pérez']]));
    fundaciones.nombresPorUsuarioIds.mockResolvedValue(new Map([[21, 'Otra Fundación']]));
    const consulta = plainToInstance(ConsultaDonacionesDto, {
      desde: '2026-10-01',
      page: '2',
      limit: '3',
    });

    const r: DonacionesDeFundacion = await service.listar(3, consulta);

    const filtroPagina = repo.listar.mock.calls[0][1];
    expect(repo.agregar.mock.calls[0][1]).toBe(filtroPagina);
    expect(repo.listar).toHaveBeenCalledWith(3, filtroPagina, 3, 3);
    expect(r).toMatchObject({ total: 9, page: 2, limit: 3 });
    expect(r.totales).toEqual({
      economica: { cantidad: 7, monto: '1500.50' },
      especie: { cantidad: 2 },
    });
    expect(typeof r.totales.economica.monto).toBe('string');
    expect(r.data.map((d) => d.donante)).toEqual([
      { nombre: 'Ana Pérez', origen: 'plataforma' },
      { nombre: 'Otra Fundación', origen: 'plataforma' },
      { nombre: 'Pedro Paz', origen: 'manual' },
    ]);
    expect(r.data.map((d) => d.comprobante)).toEqual([
      { url: '/api/fundacion/donaciones/3/comprobante' },
      null,
      null,
    ]);
    // Los nombres se piden en lote, una vez, y las fundaciones solo para lo que no era adoptante.
    expect(usuarios.nombresPorUsuarioIds).toHaveBeenCalledTimes(1);
    expect(usuarios.nombresPorUsuarioIds).toHaveBeenCalledWith([9, 21]);
    expect(fundaciones.nombresPorUsuarioIds).toHaveBeenCalledWith([21]);
  });

  it('sin filas devuelve ceros como cadenas y no consulta nombres', async () => {
    const { service, repo, usuarios } = crear();
    repo.listar.mockResolvedValue([]);
    repo.agregar.mockResolvedValue([]);
    const r = await service.listar(3, plainToInstance(ConsultaDonacionesDto, {}));
    expect(r).toMatchObject({
      data: [],
      total: 0,
      totales: { economica: { cantidad: 0, monto: '0.00' }, especie: { cantidad: 0 } },
    });
    expect(usuarios.nombresPorUsuarioIds).toHaveBeenCalledWith([]);
  });

  it('un periodo invertido es 400 y no consulta', async () => {
    const { service, repo } = crear();
    await expect(
      service.listar(
        3,
        plainToInstance(ConsultaDonacionesDto, { desde: '2026-10-05', hasta: '2026-10-01' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.listar).not.toHaveBeenCalled();
    expect(repo.agregar).not.toHaveBeenCalled();
  });

  it('datosParaAviso delega en el repository', async () => {
    const { service, repo } = crear();
    repo.buscarParaAviso.mockResolvedValue({ tipo: 'especie' });
    await expect(service.datosParaAviso(5)).resolves.toEqual({ tipo: 'especie' });
    expect(repo.buscarParaAviso).toHaveBeenCalledWith(5);
  });
});
