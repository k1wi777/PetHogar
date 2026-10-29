import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AdopcionesService } from './adopciones.service';
import { EstadoAdopcion } from './entities/adopcion.enum';

const MANAGER = { id: 'm' } as never;
const PDF = Buffer.from('%PDF-1.7');
const ADOPCION = { id: 5, estado: EstadoAdopcion.Activa, tieneActa: true };

describe('AdopcionesService', () => {
  const repo = {
    insertar: jest.fn(),
    enTransaccion: jest.fn(),
    listarDeAdoptante: jest.fn(),
    listarDeFundacion: jest.fn(),
    obtenerDeFundacion: jest.fn(),
    buscarEstadoDeFundacion: jest.fn(),
    claveActaDeFundacion: jest.fn(),
    claveActaDeAdoptante: jest.fn(),
    bloquearParaActa: jest.fn(),
    actualizarActa: jest.fn(),
  };
  const usuarios = { adoptantePorUsuarioId: jest.fn() };
  const storage = { guardar: jest.fn(), eliminar: jest.fn(), leer: jest.fn() };
  const service = new AdopcionesService(repo as never, usuarios as never, storage as never);

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    usuarios.adoptantePorUsuarioId.mockResolvedValue({ id: 4 });
    repo.enTransaccion.mockImplementation((trabajo: (m: unknown) => unknown) => trabajo(MANAGER));
  });

  it('crear delega el INSERT en el manager de la transacción ajena', async () => {
    repo.insertar.mockResolvedValue(5);
    expect(await service.crear(11, '2026-12-01', MANAGER)).toBe(5);
    expect(repo.insertar).toHaveBeenCalledWith(11, '2026-12-01', MANAGER);
  });

  describe('listados por rol', () => {
    it('el adoptante lista solo con su id de adoptante', async () => {
      repo.listarDeAdoptante.mockResolvedValue([[ADOPCION], 1]);
      const r = await service.listarMias(
        9,
        { estado: EstadoAdopcion.Activa },
        { page: 2, limit: 5 },
      );
      expect(repo.listarDeAdoptante).toHaveBeenCalledWith(
        4,
        { estado: EstadoAdopcion.Activa },
        5,
        5,
      );
      expect(r).toEqual({ data: [ADOPCION], total: 1, page: 2, limit: 5 });
    });

    it('un usuario sin perfil de adoptante es 403', async () => {
      usuarios.adoptantePorUsuarioId.mockResolvedValue(null);
      await expect(service.listarMias(9, {}, { page: 1, limit: 10 })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('la fundación lista con su id (propiedad en la consulta)', async () => {
      repo.listarDeFundacion.mockResolvedValue([[], 0]);
      await service.listarDeFundacion(3, {}, { page: 1, limit: 10 });
      expect(repo.listarDeFundacion).toHaveBeenCalledWith(3, {}, 0, 10);
    });
  });

  describe('subirActa', () => {
    beforeEach(() => {
      repo.buscarEstadoDeFundacion.mockResolvedValue(EstadoAdopcion.Activa);
      storage.guardar.mockResolvedValue({ clave: 'privado/solicitudes/nueva.pdf' });
      repo.bloquearParaActa.mockResolvedValue({
        estado: EstadoAdopcion.Activa,
        actaClave: 'privado/solicitudes/vieja.pdf',
      });
      repo.obtenerDeFundacion.mockResolvedValue(ADOPCION);
    });

    it('sin archivo o vacío: 400 sin consultar nada', async () => {
      await expect(service.subirActa(5, 3)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.subirActa(5, 3, Buffer.alloc(0))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.buscarEstadoDeFundacion).not.toHaveBeenCalled();
    });

    it('adopción ajena o inexistente: 404 sin guardar archivo', async () => {
      repo.buscarEstadoDeFundacion.mockResolvedValue(null);
      await expect(service.subirActa(5, 3, PDF)).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.guardar).not.toHaveBeenCalled();
    });

    it.each([EstadoAdopcion.Finalizada, EstadoAdopcion.Revocada])(
      'adopción %s: 409 sin guardar',
      async (estado) => {
        repo.buscarEstadoDeFundacion.mockResolvedValue(estado);
        await expect(service.subirActa(5, 3, PDF)).rejects.toBeInstanceOf(ConflictException);
        expect(storage.guardar).not.toHaveBeenCalled();
      },
    );

    it('guarda en carpeta privada, actualiza bajo bloqueo y borra el acta anterior tras el commit', async () => {
      const orden: string[] = [];
      repo.actualizarActa.mockImplementation(() => orden.push('update'));
      repo.enTransaccion.mockImplementation(async (t: (m: unknown) => unknown) => {
        const r = await t(MANAGER);
        orden.push('commit');
        return r;
      });
      storage.eliminar.mockImplementation(() => orden.push('borrar-anterior'));
      const r = await service.subirActa(5, 3, PDF);
      expect(storage.guardar).toHaveBeenCalledWith(
        { buffer: PDF },
        { categoria: 'documento', carpeta: 'solicitudes' },
      );
      expect(repo.bloquearParaActa).toHaveBeenCalledWith(MANAGER, 5, 3);
      expect(repo.actualizarActa).toHaveBeenCalledWith(MANAGER, 5, 'privado/solicitudes/nueva.pdf');
      expect(storage.eliminar).toHaveBeenCalledTimes(1);
      expect(storage.eliminar).toHaveBeenCalledWith('privado/solicitudes/vieja.pdf');
      expect(orden).toEqual(['update', 'commit', 'borrar-anterior']);
      expect(r).toBe(ADOPCION);
    });

    it('la primera acta no borra nada', async () => {
      repo.bloquearParaActa.mockResolvedValue({ estado: EstadoAdopcion.Activa, actaClave: null });
      await service.subirActa(5, 3, PDF);
      expect(storage.eliminar).not.toHaveBeenCalled();
    });

    it('si falla la transacción borra el archivo NUEVO y conserva el anterior', async () => {
      const error = new Error('update roto');
      repo.actualizarActa.mockRejectedValue(error);
      await expect(service.subirActa(5, 3, PDF)).rejects.toBe(error);
      expect(storage.eliminar).toHaveBeenCalledTimes(1);
      expect(storage.eliminar).toHaveBeenCalledWith('privado/solicitudes/nueva.pdf');
    });

    it('la adopción se cerró mientras tanto (bajo bloqueo): 409 y borra el nuevo', async () => {
      repo.bloquearParaActa.mockResolvedValue({
        estado: EstadoAdopcion.Finalizada,
        actaClave: null,
      });
      await expect(service.subirActa(5, 3, PDF)).rejects.toBeInstanceOf(ConflictException);
      expect(repo.actualizarActa).not.toHaveBeenCalled();
      expect(storage.eliminar).toHaveBeenCalledWith('privado/solicitudes/nueva.pdf');
    });

    it('un archivo inválido (el almacenamiento lo rechaza) no deja nada ni toca la base', async () => {
      storage.guardar.mockRejectedValue(
        new BadRequestException('Solo se permiten archivos JPG, PNG o PDF'),
      );
      await expect(service.subirActa(5, 3, PDF)).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.enTransaccion).not.toHaveBeenCalled();
      expect(storage.eliminar).not.toHaveBeenCalled();
    });

    it('un fallo al borrar el anterior se registra y no rompe la respuesta', async () => {
      storage.eliminar.mockRejectedValue(new Error('disco'));
      await expect(service.subirActa(5, 3, PDF)).resolves.toBe(ADOPCION);
    });
  });

  describe('leerActa', () => {
    beforeEach(() => {
      storage.leer.mockResolvedValue({ buffer: PDF, tipo: 'application/pdf', tamano: PDF.length });
    });

    it('la fundación dueña la lee con nombre construido por nosotros', async () => {
      repo.claveActaDeFundacion.mockResolvedValue('privado/solicitudes/a.bin');
      const r = await service.leerActa(5, { tipo: 'fundacion', fundacionId: 3 });
      expect(repo.claveActaDeFundacion).toHaveBeenCalledWith(5, 3);
      expect(r.nombreArchivo).toBe('acta-adopcion-5.pdf');
      expect(JSON.stringify(r)).not.toContain('privado/');
    });

    it('el adoptante de la adopción la lee con el filtro de su adoptante', async () => {
      repo.claveActaDeAdoptante.mockResolvedValue('privado/solicitudes/a.bin');
      await service.leerActa(5, { tipo: 'adoptante', usuarioId: 9 });
      expect(repo.claveActaDeAdoptante).toHaveBeenCalledWith(5, 4);
    });

    it('adopción ajena o inexistente (undefined): 404 uniforme', async () => {
      repo.claveActaDeFundacion.mockResolvedValue(undefined);
      await expect(service.leerActa(5, { tipo: 'fundacion', fundacionId: 3 })).rejects.toThrow(
        'La adopción no existe',
      );
      usuarios.adoptantePorUsuarioId.mockResolvedValue(null);
      await expect(service.leerActa(5, { tipo: 'adoptante', usuarioId: 9 })).rejects.toThrow(
        'La adopción no existe',
      );
      expect(storage.leer).not.toHaveBeenCalled();
    });

    it('sin acta subida: 404 con mensaje claro', async () => {
      repo.claveActaDeFundacion.mockResolvedValue(null);
      await expect(service.leerActa(5, { tipo: 'fundacion', fundacionId: 3 })).rejects.toThrow(
        'todavía no tiene acta',
      );
    });
  });
});
