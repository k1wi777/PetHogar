import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EstadoMascota } from '../mascotas/entities/mascota.enum';
import { CierreAdopcionService } from './cierre-adopcion.service';
import { type CierreAdopcionDto, DestinoMascota, EstadoCierre } from './dto/cierre-adopcion.dto';
import { EstadoAdopcion } from './entities/adopcion.enum';

const MANAGER = { id: 'manager' } as never;
const BLOQUEADA = { id: 9, estado: EstadoAdopcion.Activa, mascotaId: 4 };
const DETALLE = { id: 9 };
const REVOCAR = {
  estado: EstadoCierre.Revocada,
  motivo: 'Maltrato',
  mascotaDestino: DestinoMascota.Disponible,
} as CierreAdopcionDto;
const FINALIZAR = { estado: EstadoCierre.Finalizada, motivo: 'Todo en orden' } as CierreAdopcionDto;

describe('CierreAdopcionService', () => {
  const llamadas: string[] = [];
  const dataSource = {
    // Simula la transacción: si el trabajo lanza, no hay commit (rollback).
    transaction: jest.fn(),
  };
  const adopciones = {
    bloquearParaCierre: jest.fn(),
    registrarCierre: jest.fn(),
    obtenerDeFundacion: jest.fn(),
  };
  const mascotas = { transicionar: jest.fn() };
  const seguimientos = { cancelarPendientesDeAdopcion: jest.fn() };
  const service = new CierreAdopcionService(
    dataSource as never,
    adopciones as never,
    mascotas as never,
    seguimientos as never,
  );

  const registrar =
    <T>(nombre: string, valor?: T) =>
    (): Promise<T | undefined> => {
      llamadas.push(nombre);
      return Promise.resolve(valor);
    };

  beforeEach(() => {
    jest.resetAllMocks();
    llamadas.length = 0;
    dataSource.transaction.mockImplementation(async (trabajo: (m: unknown) => Promise<unknown>) => {
      llamadas.push('BEGIN');
      const resultado = await trabajo(MANAGER);
      llamadas.push('COMMIT');
      return resultado;
    });
    adopciones.bloquearParaCierre.mockImplementation(registrar('bloquear', BLOQUEADA));
    adopciones.registrarCierre.mockImplementation(registrar('cerrar'));
    mascotas.transicionar.mockImplementation(registrar('mascota'));
    seguimientos.cancelarPendientesDeAdopcion.mockImplementation(registrar('seguimientos', 2));
    adopciones.obtenerDeFundacion.mockImplementation(registrar('leer', DETALLE));
  });

  it('revocar: bloquea, cierra, cambia la mascota, cancela pendientes y confirma, en ese orden', async () => {
    const resultado = await service.cerrar(9, 3, REVOCAR);
    expect(resultado).toBe(DETALLE);
    expect(llamadas).toEqual([
      'BEGIN',
      'bloquear',
      'cerrar',
      'mascota',
      'seguimientos',
      'COMMIT',
      'leer',
    ]);
    expect(adopciones.bloquearParaCierre).toHaveBeenCalledWith(MANAGER, 9, 3);
    expect(adopciones.registrarCierre).toHaveBeenCalledWith(
      MANAGER,
      9,
      EstadoAdopcion.Revocada,
      'Maltrato',
    );
    expect(mascotas.transicionar).toHaveBeenCalledWith(4, EstadoMascota.Disponible, 'revocacion', {
      manager: MANAGER,
    });
    expect(seguimientos.cancelarPendientesDeAdopcion).toHaveBeenCalledWith(9, MANAGER);
    expect(adopciones.obtenerDeFundacion).toHaveBeenCalledWith(9, 3);
  });

  it('revocar con destino inactiva deja la mascota inactiva', async () => {
    await service.cerrar(9, 3, { ...REVOCAR, mascotaDestino: DestinoMascota.Inactiva });
    expect(mascotas.transicionar).toHaveBeenCalledWith(4, EstadoMascota.Inactiva, 'revocacion', {
      manager: MANAGER,
    });
  });

  it('finalizar no toca la mascota pero sí cancela los pendientes', async () => {
    await service.cerrar(9, 3, FINALIZAR);
    expect(llamadas).toEqual(['BEGIN', 'bloquear', 'cerrar', 'seguimientos', 'COMMIT', 'leer']);
    expect(mascotas.transicionar).not.toHaveBeenCalled();
    expect(adopciones.registrarCierre).toHaveBeenCalledWith(
      MANAGER,
      9,
      EstadoAdopcion.Finalizada,
      'Todo en orden',
    );
  });

  it('finalizar ignora un mascotaDestino enviado', async () => {
    await service.cerrar(9, 3, { ...FINALIZAR, mascotaDestino: DestinoMascota.Inactiva });
    expect(mascotas.transicionar).not.toHaveBeenCalled();
  });

  it('revocar sin destino es 400 sin abrir la transacción', async () => {
    await expect(
      service.cerrar(9, 3, { estado: EstadoCierre.Revocada, motivo: 'x' } as CierreAdopcionDto),
    ).rejects.toThrow(
      new BadRequestException('Indica si la mascota vuelve a estar disponible o inactiva'),
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('adopción ajena o inexistente: 404 sin cambios', async () => {
    adopciones.bloquearParaCierre.mockResolvedValue(null);
    await expect(service.cerrar(9, 3, REVOCAR)).rejects.toThrow(
      new NotFoundException('La adopción no existe'),
    );
    expect(adopciones.registrarCierre).not.toHaveBeenCalled();
    expect(mascotas.transicionar).not.toHaveBeenCalled();
    expect(seguimientos.cancelarPendientesDeAdopcion).not.toHaveBeenCalled();
  });

  it.each([EstadoAdopcion.Finalizada, EstadoAdopcion.Revocada])(
    'adopción ya %s: 409 con su estado y sin cambios',
    async (estado) => {
      adopciones.bloquearParaCierre.mockResolvedValue({ ...BLOQUEADA, estado });
      await expect(service.cerrar(9, 3, REVOCAR)).rejects.toThrow(
        new ConflictException(`La adopción ya está ${estado}`),
      );
      expect(adopciones.registrarCierre).not.toHaveBeenCalled();
      expect(llamadas).not.toContain('COMMIT');
    },
  );

  describe('un fallo en cualquier paso propaga el error, no confirma y no sigue', () => {
    const casos: [string, () => void, string[]][] = [
      [
        'al bloquear',
        () => adopciones.bloquearParaCierre.mockRejectedValue(new Error('fallo')),
        [],
      ],
      [
        'al cerrar la adopción (UPDATE condicionado)',
        () => adopciones.registrarCierre.mockRejectedValue(new Error('fallo')),
        [],
      ],
      [
        'al cambiar la mascota',
        () => mascotas.transicionar.mockRejectedValue(new Error('fallo')),
        ['cerrar'],
      ],
      [
        'al cancelar los seguimientos',
        () => seguimientos.cancelarPendientesDeAdopcion.mockRejectedValue(new Error('fallo')),
        ['cerrar', 'mascota'],
      ],
    ];

    it.each(casos)('%s', async (_nombre, inyectar, previos) => {
      inyectar();
      await expect(service.cerrar(9, 3, REVOCAR)).rejects.toThrow('fallo');
      expect(llamadas).not.toContain('COMMIT');
      expect(llamadas).not.toContain('leer');
      for (const previo of previos) expect(llamadas).toContain(previo);
    });
  });

  it('si la mascota ya no está adoptada (409 del UPDATE condicionado) se deshace todo', async () => {
    mascotas.transicionar.mockRejectedValue(
      new ConflictException('La mascota está disponible y no admite esta acción'),
    );
    await expect(service.cerrar(9, 3, REVOCAR)).rejects.toThrow(ConflictException);
    expect(seguimientos.cancelarPendientesDeAdopcion).not.toHaveBeenCalled();
    expect(llamadas).not.toContain('COMMIT');
  });

  it('no depende del bus de eventos: el cierre no emite nada', () => {
    expect(Object.keys(service)).toEqual(['dataSource', 'adopciones', 'mascotas', 'seguimientos']);
  });
});
