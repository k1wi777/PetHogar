import { NotFoundException } from '@nestjs/common';
import { CatalogoMascotasService } from './catalogo-mascotas.service';

const K = 'publico/mascotas/11111111-1111-1111-1111-111111111111.jpg';

const FILA = {
  id: 1,
  nombre: 'Luna',
  especie: 'perro',
  raza: 'Labrador',
  sexo: 'hembra',
  edadMeses: 12,
  tamano: 'grande',
  ciudad: 'Bogotá',
  fundacionNombre: 'Patitas',
  fotoCatalogoClave: K,
};

const FICHA = {
  id: 1,
  nombre: 'Luna',
  especie: 'perro',
  raza: 'Labrador',
  sexo: 'hembra',
  edadMeses: 12,
  tamano: 'grande',
  color: null,
  esterilizado: true,
  vacunado: true,
  estadoSalud: 'Sana',
  descripcion: null,
  fechaPublicacion: new Date('2026-01-01T00:00:00Z'),
  fundacionId: 3,
  fundacionNombre: 'Patitas',
  fundacionCiudad: 'Bogotá',
  fundacionDescripcion: 'Rescate',
  // Campos que la consulta jamás debería traer, pero que un mapeo descuidado filtraría.
  nit: '900',
  documentoUrl: 'privado/x.pdf',
  email: 'a@b.co',
  direccion: 'Calle 1',
  contrasena: 'h',
};

describe('CatalogoMascotasService', () => {
  const repo = {
    contar: jest.fn(),
    listar: jest.fn(),
    existeVisible: jest.fn(),
    buscarFicha: jest.fn(),
  };
  const fotos = { listar: jest.fn() };
  const historial = { listar: jest.fn() };
  const storage = { urlPublica: jest.fn() };
  const service = new CatalogoMascotasService(
    repo as never,
    fotos as never,
    historial as never,
    storage as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    storage.urlPublica.mockImplementation((k: string) => `http://x/uploads/${k.slice(8)}`);
  });

  it('lista con la URL pública de la miniatura, sin la clave de almacenamiento', async () => {
    repo.contar.mockResolvedValue(25);
    repo.listar.mockResolvedValue([FILA, { ...FILA, id: 2, fotoCatalogoClave: null }]);
    const res = await service.listar({ ciudad: 'bogota' }, { page: 2, limit: 12 });
    expect(repo.listar).toHaveBeenCalledWith({ ciudad: 'bogota' }, 12, 12);
    expect(res).toMatchObject({ total: 25, page: 2, limit: 12 });
    expect(res.data[0]).toEqual({
      id: 1,
      nombre: 'Luna',
      especie: 'perro',
      raza: 'Labrador',
      sexo: 'hembra',
      edadMeses: 12,
      tamano: 'grande',
      ciudad: 'Bogotá',
      fundacion: { nombre: 'Patitas' },
      fotoPrincipal: {
        urlCatalogo: 'http://x/uploads/mascotas/11111111-1111-1111-1111-111111111111.jpg',
      },
    });
    expect(res.data[1].fotoPrincipal).toBeNull();
    expect(JSON.stringify(res)).not.toContain('publico/');
  });

  it('una foto con ruta heredada del seed demo (no es clave real) sale sin foto', async () => {
    repo.contar.mockResolvedValue(1);
    repo.listar.mockResolvedValue([{ ...FILA, fotoCatalogoClave: '/uploads/demo/luna.jpg' }]);
    const res = await service.listar({}, { page: 1, limit: 12 });
    expect(res.data[0].fotoPrincipal).toBeNull();
  });

  it('sin resultados devuelve lista vacía con total 0', async () => {
    repo.contar.mockResolvedValue(0);
    repo.listar.mockResolvedValue([]);
    await expect(service.listar({}, { page: 1, limit: 12 })).resolves.toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 12,
    });
  });

  it('la ficha combina datos, fotos, historial y solo los datos públicos de la fundación', async () => {
    repo.buscarFicha.mockResolvedValue(FICHA);
    fotos.listar.mockResolvedValue([
      { id: 9, esPrincipal: true, urlCatalogo: 'http://x/c', url: 'http://x/g' },
    ]);
    historial.listar.mockResolvedValue([
      { id: 4, tipo: 'vacuna', fecha: '2026-01-02', descripcion: 'Rabia', veterinario: null },
    ]);
    const ficha = await service.obtenerFicha(1);
    expect(ficha.fundacion).toEqual({
      id: 3,
      nombre: 'Patitas',
      ciudad: 'Bogotá',
      descripcion: 'Rescate',
    });
    expect(ficha.fotos).toHaveLength(1);
    expect(ficha.historial).toHaveLength(1);
    const texto = JSON.stringify(ficha);
    for (const prohibida of ['900', 'privado/', 'a@b.co', 'Calle 1', 'contrasena', 'fundacionId']) {
      expect(texto).not.toContain(prohibida);
    }
  });

  it('404 para una mascota que no está disponible o no existe (ficha e historial)', async () => {
    repo.buscarFicha.mockResolvedValue(null);
    await expect(service.obtenerFicha(1)).rejects.toThrow(NotFoundException);
    repo.existeVisible.mockResolvedValue(false);
    await expect(service.obtenerHistorial(1)).rejects.toThrow('La mascota no existe');
    expect(historial.listar).not.toHaveBeenCalled();
  });

  it('el historial público se devuelve si la mascota es visible', async () => {
    repo.existeVisible.mockResolvedValue(true);
    historial.listar.mockResolvedValue([{ id: 1 }]);
    await expect(service.obtenerHistorial(1)).resolves.toEqual([{ id: 1 }]);
  });
});
