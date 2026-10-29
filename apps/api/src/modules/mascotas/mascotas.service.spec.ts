import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import type { CrearMascotaDto } from './dto/crear-mascota.dto';
import { EditarMascotaDto } from './dto/editar-mascota.dto';
import { EstadoMascota, SexoMascota, TamanoMascota } from './entities/mascota.enum';
import { MascotasService } from './mascotas.service';

const FILA = {
  id: 7,
  fundacionId: 3,
  razaId: 2,
  nombre: 'Luna',
  sexo: SexoMascota.Hembra,
  edadMeses: 12,
  tamano: TamanoMascota.Mediano,
  color: null,
  esterilizado: false,
  vacunado: true,
  estadoSalud: 'Sana',
  descripcion: null,
  estado: EstadoMascota.Disponible,
  fechaPublicacion: new Date('2026-01-01T00:00:00Z'),
};

describe('MascotasService', () => {
  const repo = {
    crear: jest.fn(),
    buscarDeFundacion: jest.fn(),
    buscarEstado: jest.fn(),
    listarDeFundacion: jest.fn(),
    cambiarEstado: jest.fn(),
    editar: jest.fn(),
  };
  const catalogos = { existeRaza: jest.fn() };
  const fotos = { listar: jest.fn() };
  const service = new MascotasService(repo as never, catalogos as never, fotos as never);

  beforeEach(() => {
    jest.resetAllMocks();
    catalogos.existeRaza.mockResolvedValue(true);
  });

  describe('crear', () => {
    const dto = {
      nombre: 'Luna',
      razaId: 2,
      sexo: SexoMascota.Hembra,
      edadMeses: 12,
      tamano: TamanoMascota.Mediano,
      estadoSalud: 'Sana',
    } as CrearMascotaDto;

    it('asocia la mascota a la fundación del guard y aplica valores por defecto', async () => {
      repo.crear.mockResolvedValue(FILA);
      const mascota = await service.crear(3, dto);
      expect(repo.crear).toHaveBeenCalledWith(
        3,
        expect.objectContaining({
          color: null,
          descripcion: null,
          esterilizado: false,
          vacunado: false,
        }),
      );
      expect(mascota).toEqual({
        id: 7,
        razaId: 2,
        nombre: 'Luna',
        sexo: 'hembra',
        edadMeses: 12,
        tamano: 'mediano',
        color: null,
        esterilizado: false,
        vacunado: true,
        estadoSalud: 'Sana',
        descripcion: null,
        estado: 'disponible',
        fechaPublicacion: FILA.fechaPublicacion,
      });
      expect(mascota).not.toHaveProperty('fundacionId');
    });

    it('rechaza con error por campo una raza inexistente, sin crear nada', async () => {
      catalogos.existeRaza.mockResolvedValue(false);
      const error = await service.crear(3, dto).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        errores: [{ campo: 'razaId', mensajes: ['La raza no existe'] }],
      });
      expect(repo.crear).not.toHaveBeenCalled();
    });
  });

  describe('editar', () => {
    const editar = (datos: object) => plainToInstance(EditarMascotaDto, datos);

    it('actualiza solo los campos enviados, filtrando por fundación y estados editables', async () => {
      repo.editar.mockResolvedValue(true);
      repo.buscarDeFundacion.mockResolvedValue({ ...FILA, nombre: 'Nueva' });
      const res = await service.editar(7, 3, editar({ nombre: 'Nueva', color: null }));
      expect(repo.editar).toHaveBeenCalledWith(
        7,
        3,
        [EstadoMascota.Disponible, EstadoMascota.EnProceso],
        { nombre: 'Nueva', color: null },
      );
      expect(res.nombre).toBe('Nueva');
    });

    it('no acepta una edición vacía', async () => {
      await expect(service.editar(7, 3, editar({}))).rejects.toThrow(BadRequestException);
      expect(repo.editar).not.toHaveBeenCalled();
    });

    it('revalida la raza solo si cambia', async () => {
      repo.editar.mockResolvedValue(true);
      repo.buscarDeFundacion.mockResolvedValue(FILA);
      await service.editar(7, 3, editar({ nombre: 'X' }));
      expect(catalogos.existeRaza).not.toHaveBeenCalled();
      catalogos.existeRaza.mockResolvedValue(false);
      await expect(service.editar(7, 3, editar({ razaId: 99 }))).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.editar).toHaveBeenCalledTimes(1);
    });

    it('da el mismo 404 para una mascota ajena y para una inexistente', async () => {
      repo.editar.mockResolvedValue(false);
      repo.buscarDeFundacion.mockResolvedValue(null);
      const e1 = await service.editar(7, 3, editar({ nombre: 'X' })).catch((e: unknown) => e);
      const e2 = await service.editar(8888, 3, editar({ nombre: 'X' })).catch((e: unknown) => e);
      expect(e1).toBeInstanceOf(NotFoundException);
      expect((e1 as Error).message).toBe('La mascota no existe');
      expect((e2 as Error).message).toBe((e1 as Error).message);
    });

    it.each([
      [EstadoMascota.Adoptada, 'adoptada'],
      [EstadoMascota.Inactiva, 'inactiva'],
    ])('responde 409 con el estado actual si la mascota está %s', async (estado, texto) => {
      repo.editar.mockResolvedValue(false);
      repo.buscarDeFundacion.mockResolvedValue({ ...FILA, estado });
      const error = await service.editar(7, 3, editar({ nombre: 'X' })).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as Error).message).toBe(`La mascota está ${texto} y no admite esta acción`);
    });
  });

  describe('darDeBaja', () => {
    it('pasa a inactiva solo desde disponible y solo si es de la fundación', async () => {
      repo.cambiarEstado.mockResolvedValue(true);
      repo.buscarDeFundacion.mockResolvedValue({ ...FILA, estado: EstadoMascota.Inactiva });
      const res = await service.darDeBaja(7, 3);
      expect(repo.cambiarEstado).toHaveBeenCalledWith(
        7,
        [EstadoMascota.Disponible],
        EstadoMascota.Inactiva,
        3,
        undefined,
      );
      expect(res.estado).toBe('inactiva');
    });

    it('404 idéntico si es ajena o no existe', async () => {
      repo.cambiarEstado.mockResolvedValue(false);
      repo.buscarDeFundacion.mockResolvedValue(null);
      const error = await service.darDeBaja(7, 3).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as Error).message).toBe('La mascota no existe');
    });

    it('409 si está en proceso (la baja concurrente que pierde recibe el mismo 409)', async () => {
      repo.cambiarEstado.mockResolvedValue(false);
      repo.buscarDeFundacion.mockResolvedValue({ ...FILA, estado: EstadoMascota.EnProceso });
      await expect(service.darDeBaja(7, 3)).rejects.toThrow(
        'La mascota está en proceso de adopción y no admite esta acción',
      );
      repo.buscarDeFundacion.mockResolvedValue({ ...FILA, estado: EstadoMascota.Inactiva });
      await expect(service.darDeBaja(7, 3)).rejects.toThrow(ConflictException);
    });
  });

  describe('transicionar (uso futuro de adopciones)', () => {
    it('aprobar: en_proceso → adoptada con el manager de la transacción', async () => {
      const manager = {} as never;
      repo.cambiarEstado.mockResolvedValue(true);
      await service.transicionar(7, EstadoMascota.Adoptada, 'adopcion', { manager });
      expect(repo.cambiarEstado).toHaveBeenCalledWith(
        7,
        [EstadoMascota.EnProceso],
        EstadoMascota.Adoptada,
        undefined,
        manager,
      );
    });

    it('un destino sin transición para ese origen es 409 sin tocar la base', async () => {
      repo.buscarEstado.mockResolvedValue(EstadoMascota.Disponible);
      await expect(
        service.transicionar(7, EstadoMascota.Disponible, 'fundacion', { fundacionId: 3 }),
      ).rejects.toThrow();
      expect(repo.cambiarEstado).not.toHaveBeenCalled();
    });

    it('404 si no existe', async () => {
      repo.cambiarEstado.mockResolvedValue(false);
      repo.buscarEstado.mockResolvedValue(null);
      await expect(service.transicionar(7, EstadoMascota.Adoptada, 'adopcion')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('lectura', () => {
    it('lista solo con el filtro de la fundación y pagina', async () => {
      repo.listarDeFundacion.mockResolvedValue([[FILA], 31]);
      const res = await service.listarDeFundacion(
        3,
        { estado: EstadoMascota.Disponible },
        { page: 2, limit: 10 },
      );
      expect(repo.listarDeFundacion).toHaveBeenCalledWith(
        3,
        { estado: EstadoMascota.Disponible },
        10,
        10,
      );
      expect(res).toMatchObject({ total: 31, page: 2, limit: 10 });
      expect(res.data[0]).not.toHaveProperty('fundacionId');
    });

    it('el detalle incluye la galería de la mascota propia', async () => {
      repo.buscarDeFundacion.mockResolvedValue(FILA);
      fotos.listar.mockResolvedValue([{ id: 1, esPrincipal: true, urlCatalogo: 'c', url: 'g' }]);
      const res = await service.obtenerDetalleDeFundacion(7, 3);
      expect(res.fotos).toHaveLength(1);
      expect(fotos.listar).toHaveBeenCalledWith(7);
    });

    it('el detalle de una ajena no consulta fotos', async () => {
      repo.buscarDeFundacion.mockResolvedValue(null);
      await expect(service.obtenerDetalleDeFundacion(7, 3)).rejects.toThrow(NotFoundException);
      expect(fotos.listar).not.toHaveBeenCalled();
    });

    it('detalle de una mascota ajena o inexistente: 404', async () => {
      repo.buscarDeFundacion.mockResolvedValue(null);
      await expect(service.obtenerDeFundacion(7, 3)).rejects.toThrow('La mascota no existe');
    });
  });
});
