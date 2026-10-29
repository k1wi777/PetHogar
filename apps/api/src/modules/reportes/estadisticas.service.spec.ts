import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EstadisticasService } from './estadisticas.service';

function crear() {
  const repo = {
    existeFundacion: jest.fn().mockResolvedValue(true),
    adopcionesPorMes: jest.fn().mockResolvedValue([{ mes: '2026-10', cantidad: 2 }]),
    adopcionesPorEspecie: jest.fn().mockResolvedValue([{ especie: 'perro', cantidad: 2 }]),
    solicitudesPorEstado: jest.fn().mockResolvedValue([{ estado: 'pendiente', cantidad: 1 }]),
    seguimientosPorEstado: jest.fn().mockResolvedValue([]),
    seguimientosPorBienestar: jest.fn().mockResolvedValue([]),
    donacionesPorMes: jest.fn().mockResolvedValue([]),
    donacionesPorTipo: jest.fn().mockResolvedValue([]),
  };
  const manager = { id: 'snapshot' };
  const instantanea = { leer: jest.fn((fn: (m: unknown) => Promise<unknown>) => fn(manager)) };
  const reloj = { ahora: () => new Date('2026-10-29T03:00:00Z') }; // 28 de octubre, 22:00 en Bogotá
  const service = new EstadisticasService(repo as never, instantanea as never, reloj as never);
  return { service, repo, instantanea, manager };
}

describe('EstadisticasService', () => {
  it('fundación: todas las consultas usan su fundación y la MISMA instantánea', async () => {
    const { service, repo, instantanea, manager } = crear();
    const r = await service.deFundacion(7, '2026-10-01', '2026-10-31');
    expect(instantanea.leer).toHaveBeenCalledTimes(1);
    for (const [nombre, mock] of Object.entries(repo)) {
      if (nombre === 'existeFundacion') continue;
      const llamada = mock.mock.calls[0];
      expect(llamada[0]).toMatchObject({
        fundacionId: 7,
        desde: '2026-10-01',
        hasta: '2026-10-31',
      });
      expect(llamada[llamada.length - 1]).toBe(manager);
    }
    expect(repo.existeFundacion).not.toHaveBeenCalled();
    expect(r.filtros).toEqual({ fundacionId: 7, desde: '2026-10-01', hasta: '2026-10-31' });
    expect(r.adopciones.total).toBe(2);
    expect(r.solicitudes.porEstado.pendiente).toBe(1);
  });

  it('los seguimientos vencidos se calculan con el día de hoy en Bogotá', async () => {
    const { service, repo } = crear();
    await service.deFundacion(7);
    expect(repo.seguimientosPorEstado.mock.calls[0][1]).toBe('2026-10-28');
  });

  it('administrador sin fundación: global (sin filtro de propiedad) y sin comprobar existencia', async () => {
    const { service, repo } = crear();
    const r = await service.deAdministrador(undefined);
    expect(repo.adopcionesPorMes.mock.calls[0][0].fundacionId).toBeUndefined();
    expect(repo.existeFundacion).not.toHaveBeenCalled();
    expect(r.filtros.fundacionId).toBeNull();
  });

  it('administrador con fundación inexistente: 404 y no consulta nada más', async () => {
    const { service, repo } = crear();
    repo.existeFundacion.mockResolvedValue(false);
    await expect(service.deAdministrador(99)).rejects.toThrow(NotFoundException);
    expect(repo.adopcionesPorMes).not.toHaveBeenCalled();
  });

  it('rango invertido: 400 antes de abrir la instantánea', async () => {
    const { service, instantanea } = crear();
    await expect(service.deFundacion(1, '2026-10-05', '2026-10-01')).rejects.toThrow(
      BadRequestException,
    );
    expect(instantanea.leer).not.toHaveBeenCalled();
  });
});
