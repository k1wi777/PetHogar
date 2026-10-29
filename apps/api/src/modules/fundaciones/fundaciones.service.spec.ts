import { EstadoValidacion } from './entities/fundacion.enum';
import type { Fundacion } from './entities/fundacion.entity';
import { FundacionesRepository } from './fundaciones.repository';
import { FundacionesService } from './fundaciones.service';

const FILA = {
  id: 3,
  usuarioId: 9,
  nombre: 'Huellas',
  nit: '900123456-7',
  documentoUrl: 'privado/fundaciones/x.pdf',
  estadoValidacion: EstadoValidacion.Pendiente,
  observacionValidacion: 'texto interno',
} as Fundacion;

function crear(): { service: FundacionesService; repo: jest.Mocked<FundacionesRepository> } {
  const repo = {
    crear: jest.fn(),
    existeNit: jest.fn(),
    buscarPorUsuarioId: jest.fn(),
  } as unknown as jest.Mocked<FundacionesRepository>;
  return { service: new FundacionesService(repo), repo };
}

describe('FundacionesService', () => {
  it('crea la fundación con el EntityManager recibido y devuelve solo el resumen', async () => {
    const { service, repo } = crear();
    repo.crear.mockResolvedValue(FILA);
    const manager = {} as never;
    const datos = {
      usuarioId: 9,
      nombre: 'Huellas',
      nit: '900123456-7',
      direccion: 'Calle 1',
      ciudad: 'Montería',
      descripcion: null,
      documentoClave: 'privado/fundaciones/x.pdf',
    };
    const r = await service.crear(datos, manager);
    expect(repo.crear).toHaveBeenCalledWith(datos, manager);
    expect(r).toEqual({
      id: 3,
      nombre: 'Huellas',
      estadoValidacion: 'pendiente',
      observacionValidacion: null,
    });
    expect(r).not.toHaveProperty('documentoUrl');
  });

  it('solo expone la observación cuando la fundación fue rechazada', async () => {
    const { service, repo } = crear();
    repo.buscarPorUsuarioId.mockResolvedValue({
      ...FILA,
      estadoValidacion: EstadoValidacion.Rechazada,
      observacionValidacion: 'Documento ilegible',
    });
    expect(await service.obtenerPorUsuarioId(9)).toMatchObject({
      estadoValidacion: 'rechazada',
      observacionValidacion: 'Documento ilegible',
    });
  });

  it('devuelve null si el usuario no tiene fundación', async () => {
    const { service, repo } = crear();
    repo.buscarPorUsuarioId.mockResolvedValue(null);
    expect(await service.estadoPorUsuarioId(1)).toBeNull();
  });
});
