import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PaginacionQueryDto } from '../../common/pagination/paginacion-query.dto';
import { recortar } from './notificaciones.mapeo';
import { NotificacionesService } from './notificaciones.service';

const FILA = {
  id: 5,
  tipo: 'solicitud',
  titulo: 'Título',
  mensaje: 'Mensaje',
  leida: false,
  fechaCreacion: new Date('2026-10-29T12:00:00Z'),
  entidad: 'solicitud',
  entidadId: 11,
  // Lo que un SELECT * dejaría pasar y no debe salir.
  usuarioId: 9,
  clave: 'adoption.approved:11',
};

function crear() {
  const repo = {
    insertar: jest.fn(),
    listar: jest.fn(),
    contarNoLeidas: jest.fn(),
    marcarLeida: jest.fn(),
    marcarTodas: jest.fn(),
  };
  return { service: new NotificacionesService(repo as never), repo };
}

describe('recortar', () => {
  it('deja intacto lo que cabe y recorta con puntos suspensivos sin pasarse del máximo', () => {
    expect(recortar('hola', 4)).toBe('hola');
    const largo = recortar('a'.repeat(150), 100);
    expect(Array.from(largo)).toHaveLength(100);
    expect(largo.endsWith('…')).toBe(true);
  });

  it('cuenta caracteres reales: no parte un emoji', () => {
    const texto = '🐶'.repeat(120);
    const r = recortar(texto, 100);
    expect(Array.from(r)).toHaveLength(100);
    expect(r).toBe(`${'🐶'.repeat(99)}…`);
  });
});

describe('NotificacionesService.crear', () => {
  it('recorta título (100) y mensaje (300), guarda la referencia y la clave', async () => {
    const { service, repo } = crear();
    repo.insertar.mockResolvedValue(true);
    const r = await service.crear({
      usuarioId: 9,
      tipo: 'solicitud',
      titulo: 'T'.repeat(130),
      mensaje: 'M'.repeat(400),
      referencia: { tipo: 'solicitud', id: 11 },
      clave: 'adoption.approved:11',
    });
    expect(r).toEqual({ creada: true });
    const datos = repo.insertar.mock.calls[0][0];
    expect(Array.from(datos.titulo)).toHaveLength(100);
    expect(Array.from(datos.mensaje)).toHaveLength(300);
    expect(datos).toMatchObject({
      usuarioId: 9,
      tipo: 'solicitud',
      entidad: 'solicitud',
      entidadId: 11,
      clave: 'adoption.approved:11',
    });
  });

  it('sin referencia ni clave guarda nulos', async () => {
    const { service, repo } = crear();
    repo.insertar.mockResolvedValue(true);
    await service.crear({ usuarioId: 9, tipo: 'donacion', titulo: 't', mensaje: 'm' });
    expect(repo.insertar.mock.calls[0][0]).toMatchObject({
      entidad: null,
      entidadId: null,
      clave: null,
    });
  });

  it('creada es false cuando la clave ya existía (conflicto)', async () => {
    const { service, repo } = crear();
    repo.insertar.mockResolvedValue(false);
    await expect(
      service.crear({ usuarioId: 9, tipo: 'donacion', titulo: 't', mensaje: 'm', clave: 'k' }),
    ).resolves.toEqual({ creada: false });
  });

  it('propaga el error del repository (quien avisa decide qué hacer)', async () => {
    const { service, repo } = crear();
    repo.insertar.mockRejectedValue(new Error('BD caída'));
    await expect(
      service.crear({ usuarioId: 9, tipo: 'donacion', titulo: 't', mensaje: 'm' }),
    ).rejects.toThrow('BD caída');
  });
});

describe('NotificacionesService — lectura', () => {
  it('listar mapea sin usuarioId ni clave y construye la referencia', async () => {
    const { service, repo } = crear();
    repo.listar.mockResolvedValue([[FILA, { ...FILA, id: 4, entidad: null, entidadId: null }], 7]);
    const pagina = plainToInstance(PaginacionQueryDto, { page: '2', limit: '2' });
    const r = await service.listar(9, { leida: false }, pagina);
    expect(repo.listar).toHaveBeenCalledWith(9, { leida: false }, 2, 2);
    expect(r).toMatchObject({ total: 7, page: 2, limit: 2 });
    expect(Object.keys(r.data[0]).sort()).toEqual([
      'fechaCreacion',
      'id',
      'leida',
      'mensaje',
      'referencia',
      'tipo',
      'titulo',
    ]);
    expect(r.data[0].referencia).toEqual({ tipo: 'solicitud', id: 11 });
    expect(r.data[1].referencia).toBeNull();
    expect(JSON.stringify(r)).not.toMatch(/usuarioId|clave|adoption\.approved/);
  });

  it('contarNoLeidas y marcarTodas devuelven su cantidad', async () => {
    const { service, repo } = crear();
    repo.contarNoLeidas.mockResolvedValue(3);
    repo.marcarTodas.mockResolvedValue(3);
    await expect(service.contarNoLeidas(9)).resolves.toEqual({ noLeidas: 3 });
    await expect(service.marcarTodas(9)).resolves.toEqual({ actualizadas: 3 });
    expect(repo.contarNoLeidas).toHaveBeenCalledWith(9);
    expect(repo.marcarTodas).toHaveBeenCalledWith(9);
  });

  it('marcarLeida filtra por usuario y devuelve la vista', async () => {
    const { service, repo } = crear();
    repo.marcarLeida.mockResolvedValue({ ...FILA, leida: true });
    const r = await service.marcarLeida(9, 5);
    expect(repo.marcarLeida).toHaveBeenCalledWith(5, 9);
    expect(r.leida).toBe(true);
    expect(r).not.toHaveProperty('usuarioId');
  });

  it('ajena o inexistente: el mismo 404', async () => {
    const { service, repo } = crear();
    repo.marcarLeida.mockResolvedValue(null);
    await expect(service.marcarLeida(9, 5)).rejects.toThrow(
      new NotFoundException('La notificación no existe'),
    );
  });
});
