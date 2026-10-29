import 'reflect-metadata';
import { CatalogosService } from '../catalogos/catalogos.service';
import { CatalogoMascotasService } from './catalogo/catalogo-mascotas.service';
import * as dtoRespuestas from './dto/respuestas.dto';
import * as dtoCatalogos from '../catalogos/dto/respuestas.dto';
import { FotosMascotaService } from './fotos/fotos-mascota.service';
import { HistorialService } from './historial/historial.service';
import { MascotasService } from './mascotas.service';

// Barrido (R23): ninguna respuesta puede traer claves de almacenamiento ni datos privados.
const CLAVE_PROHIBIDA =
  /^(nit|documento|documentoUrl|documento_url|email|correo|contrasena|password|telefono|direccion|logo|usuarioId|fundacionId|clave|observacionValidacion)$/i;
const VALOR_CLAVE_STORAGE = /(^|[\s"'])(publico|privado)\/[a-z-]+\//;

function barrer(valor: unknown, ruta = '$'): string[] {
  if (Array.isArray(valor)) return valor.flatMap((v, i) => barrer(v, `${ruta}[${i}]`));
  if (valor instanceof Date || valor === null) return [];
  if (typeof valor === 'string') return VALOR_CLAVE_STORAGE.test(valor) ? [`${ruta}=${valor}`] : [];
  if (typeof valor === 'object') {
    return Object.entries(valor as object).flatMap(([k, v]) => [
      ...(CLAVE_PROHIBIDA.test(k) ? [`${ruta}.${k}`] : []),
      ...barrer(v, `${ruta}.${k}`),
    ]);
  }
  return [];
}

const K1 = 'publico/mascotas/11111111-1111-1111-1111-111111111111.jpg';
const K2 = 'publico/mascotas/22222222-2222-2222-2222-222222222222.jpg';
const storage = { urlPublica: (k: string) => `http://localhost:3001/uploads/${k.slice(8)}` };

/** Datos «sucios»: lo que traería una entidad cruda con todo lo que no debe salir. */
const SUCIO = {
  nit: '900',
  documentoUrl: 'privado/fundaciones/x.pdf',
  email: 'a@b.co',
  contrasena: 'hash',
  direccion: 'Calle 1',
  usuarioId: 9,
};

const MASCOTA = {
  id: 1,
  fundacionId: 3,
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
  fechaPublicacion: new Date(),
  ...SUCIO,
};

describe('barrido de claves prohibidas en las salidas', () => {
  it('el barrido detecta lo que busca (control)', () => {
    expect(barrer({ a: { nit: 1 }, b: [K1], c: 'x privado/fundaciones/y' })).toHaveLength(3);
  });

  it('mascotas: gestión, listado y detalle del dueño', async () => {
    const repo = {
      buscarDeFundacion: jest.fn().mockResolvedValue(MASCOTA),
      listarDeFundacion: jest.fn().mockResolvedValue([[MASCOTA], 1]),
      crear: jest.fn().mockResolvedValue(MASCOTA),
    };
    const fotos = {
      listar: jest
        .fn()
        .mockResolvedValue([
          { id: 1, esPrincipal: true, urlCatalogo: 'http://x/c', url: 'http://x/g' },
        ]),
    };
    const service = new MascotasService(
      repo as never,
      { existeRaza: jest.fn().mockResolvedValue(true) } as never,
      fotos as never,
    );
    expect(barrer(await service.obtenerDetalleDeFundacion(1, 3))).toEqual([]);
    expect(barrer(await service.listarDeFundacion(3, {}, { page: 1, limit: 10 }))).toEqual([]);
    expect(barrer(await service.crear(3, { ...MASCOTA, razaId: 2 } as never))).toEqual([]);
  });

  it('fotos: todas las salidas llevan URLs, nunca claves', async () => {
    const fila = { id: 1, mascotaId: 7, esPrincipal: true, url: K2, urlCatalogo: K1, ...SUCIO };
    const repo = {
      listar: jest.fn().mockResolvedValue([fila]),
      contar: jest.fn().mockResolvedValue({ total: 0, principales: 0 }),
      insertar: jest.fn().mockResolvedValue(fila),
      enTransaccion: jest.fn((t: (m: unknown) => unknown) => t({})),
    };
    const service = new FotosMascotaService(
      repo as never,
      {
        buscarDeFundacion: jest.fn().mockResolvedValue(MASCOTA),
        bloquearDeFundacion: jest.fn().mockResolvedValue(true),
      } as never,
      {
        procesar: jest
          .fn()
          .mockResolvedValue({ catalogo: Buffer.from('c'), grande: Buffer.from('g') }),
      } as never,
      {
        guardar: jest
          .fn()
          .mockResolvedValueOnce({ clave: K1 })
          .mockResolvedValueOnce({ clave: K2 }),
        urlPublica: storage.urlPublica,
        eliminar: jest.fn(),
      } as never,
    );
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(8)]);
    const subida = await service.subir(7, 3, jpeg);
    expect(barrer(subida)).toEqual([]);
    expect(JSON.stringify(subida)).toContain('/uploads/mascotas/');
    expect(barrer(await service.listar(7))).toEqual([]);
  });

  it('historial: solo los campos del evento', async () => {
    const service = new HistorialService(
      {
        listar: jest.fn().mockResolvedValue([
          {
            id: 1,
            mascotaId: 7,
            tipo: 'vacuna',
            fecha: '2026-01-01',
            descripcion: 'x',
            veterinario: null,
            ...SUCIO,
          },
        ]),
      } as never,
      {} as never,
    );
    const salida = await service.listar(7);
    expect(barrer(salida)).toEqual([]);
    expect(Object.keys(salida[0]).sort()).toEqual([
      'descripcion',
      'fecha',
      'id',
      'tipo',
      'veterinario',
    ]);
  });

  it('catálogo y ficha: sin claves ni datos privados de la fundación', async () => {
    const fila = {
      id: 1,
      nombre: 'Luna',
      especie: 'perro',
      raza: 'Lab',
      sexo: 'hembra',
      edadMeses: 1,
      tamano: 'grande',
      ciudad: 'Cali',
      fundacionNombre: 'F',
      fotoCatalogoClave: K1,
      ...SUCIO,
    };
    const ficha = {
      ...fila,
      color: null,
      esterilizado: true,
      vacunado: true,
      estadoSalud: 'ok',
      descripcion: null,
      fechaPublicacion: new Date(),
      fundacionId: 3,
      fundacionCiudad: 'Cali',
      fundacionDescripcion: null,
    };
    const service = new CatalogoMascotasService(
      {
        contar: jest.fn().mockResolvedValue(1),
        listar: jest.fn().mockResolvedValue([fila]),
        buscarFicha: jest.fn().mockResolvedValue(ficha),
        existeVisible: jest.fn().mockResolvedValue(true),
      } as never,
      {
        listar: jest
          .fn()
          .mockResolvedValue([
            { id: 1, esPrincipal: true, urlCatalogo: 'http://x/c', url: 'http://x/g' },
          ]),
      } as never,
      { listar: jest.fn().mockResolvedValue([]) } as never,
      storage as never,
    );
    expect(barrer(await service.listar({}, { page: 1, limit: 12 }))).toEqual([]);
    const salidaFicha = await service.obtenerFicha(1);
    // En la ficha, `fundacion.id` es público (id/nombre/ciudad/descripcion); nada más.
    expect(Object.keys(salidaFicha.fundacion).sort()).toEqual([
      'ciudad',
      'descripcion',
      'id',
      'nombre',
    ]);
    const { fundacion: _f, ...resto } = salidaFicha;
    void _f;
    expect(barrer(resto)).toEqual([]);
  });

  it('catálogos: solo id y nombre', async () => {
    const service = new CatalogosService({
      listarEspecies: jest.fn().mockResolvedValue([{ id: 1, nombre: 'gato', ...SUCIO }]),
    } as never);
    expect(await service.listarEspecies()).toEqual([{ id: 1, nombre: 'gato' }]);
  });

  it('los DTO de respuesta (Swagger) no declaran ninguna propiedad prohibida', () => {
    const clases = [
      ...Object.values(dtoRespuestas),
      ...Object.values(dtoCatalogos),
    ] as (new () => object)[];
    expect(clases.length).toBeGreaterThan(8);
    let revisadas = 0;
    for (const clase of clases) {
      const props: string[] = (
        (Reflect.getMetadata('swagger/apiModelPropertiesArray', clase.prototype) as string[]) ?? []
      ).map((p) => p.replace(/^:/, ''));
      revisadas += props.length;
      for (const p of props) {
        expect([clase.name, p, CLAVE_PROHIBIDA.test(p)]).toEqual([clase.name, p, false]);
      }
    }
    expect(revisadas).toBeGreaterThan(50);
  });
});
