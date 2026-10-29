import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TipoHistorialMedico } from '../entities/historial-medico.enum';
import { HistorialService } from './historial.service';

const DTO = {
  tipo: TipoHistorialMedico.Vacuna,
  fecha: '2026-03-09',
  descripcion: 'Rabia',
  veterinario: undefined,
};

describe('HistorialService', () => {
  const historial = { insertar: jest.fn(), listar: jest.fn() };
  const mascotas = { buscarDeFundacion: jest.fn() };
  const service = new HistorialService(historial as never, mascotas as never);
  // 2026-03-10 02:00 UTC = 9 de marzo en Bogotá.
  const AHORA = new Date('2026-03-10T02:00:00Z');

  beforeEach(() => {
    jest.resetAllMocks();
    mascotas.buscarDeFundacion.mockResolvedValue({ id: 7 });
    historial.insertar.mockImplementation((d: object) => Promise.resolve({ id: 1, ...d }));
  });

  it('registra el evento de hoy en Colombia aunque en UTC ya sea mañana', async () => {
    const evento = await service.registrar(7, 3, DTO, AHORA);
    expect(historial.insertar).toHaveBeenCalledWith({ mascotaId: 7, ...DTO, veterinario: null });
    expect(evento).toEqual({
      id: 1,
      tipo: 'vacuna',
      fecha: '2026-03-09',
      descripcion: 'Rabia',
      veterinario: null,
    });
    expect(evento).not.toHaveProperty('mascotaId');
  });

  it('rechaza con 400 por campo una fecha posterior al día de Bogotá', async () => {
    const error = await service
      .registrar(7, 3, { ...DTO, fecha: '2026-03-10' }, AHORA)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      errores: [{ campo: 'fecha', mensajes: ['La fecha del registro no puede ser futura'] }],
    });
    expect(historial.insertar).not.toHaveBeenCalled();
  });

  it('404 si la mascota es ajena o no existe (antes de revisar la fecha)', async () => {
    mascotas.buscarDeFundacion.mockResolvedValue(null);
    await expect(service.registrar(7, 3, { ...DTO, fecha: '2099-01-01' }, AHORA)).rejects.toThrow(
      NotFoundException,
    );
    expect(historial.insertar).not.toHaveBeenCalled();
  });

  it('lista mapeando solo los campos públicos', async () => {
    historial.listar.mockResolvedValue([
      {
        id: 2,
        mascotaId: 7,
        tipo: 'consulta',
        fecha: '2026-01-02',
        descripcion: 'x',
        veterinario: 'Dr. A',
      },
    ]);
    expect(await service.listar(7)).toEqual([
      { id: 2, tipo: 'consulta', fecha: '2026-01-02', descripcion: 'x', veterinario: 'Dr. A' },
    ]);
  });
});
