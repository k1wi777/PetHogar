import { beforeAll, describe, expect, it } from 'vitest';
import { listarEspecies } from '@/features/catalogo/api/especies';
import { listarMascotas, obtenerFicha } from '@/features/catalogo/api/mascotas';
import { aConsultaApi, parsearFiltros } from '@/features/catalogo/lib/consulta';
import { crearClienteHttp, type ClienteHttp } from '@/shared/api/cliente';
import { crearClienteServidor } from '@/shared/api/servidor';
import type { Pagina, RespuestaSesion } from '@/shared/api/tipos';
import { conLimite } from './limite';

const API = process.env.TEST_API_URL;
const EMAIL = process.env.TEST_DEMO_EMAIL ?? 'fundacion.demo@pethogar.local';
const CLAVE = process.env.TEST_DEMO_PASSWORD;

// PNG de 1x1 píxel: firma binaria real, que es lo que valida el backend.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

// Cuidado con el límite de 60 peticiones/min por IP: pocas peticiones, sin bucles.
describe('V17: capa de datos del catálogo contra la API real', () => {
  let servidor: ClienteHttp;
  let fundacion: ClienteHttp;
  const ids: Record<string, number> = {};
  let idAdoptada: number;

  beforeAll(async () => {
    if (!API || !CLAVE) {
      throw new Error(
        'Define TEST_API_URL y TEST_DEMO_PASSWORD (API real con seed:demo). Ver verification.md (V17).',
      );
    }
    servidor = crearClienteServidor({ baseUrl: API });

    // La fundación demo se usa solo para preparar datos (historial, foto) y localizar una mascota adoptada.
    fundacion = crearClienteHttp({ baseUrl: API, cerrojos: null });
    // El login admite 5 por minuto por IP y los demás archivos de V17 también lo gastan.
    const sesion = await conLimite(() =>
      fundacion.post<RespuestaSesion>('/auth/login', {
        autenticada: false,
        cuerpo: { email: EMAIL, contrasena: CLAVE },
      }),
    );
    fundacion.tokens.guardar(sesion.accessToken);
    const adoptadas = await fundacion.get<Pagina<{ id: number }>>('/fundacion/mascotas', {
      consulta: { estado: 'adoptada' },
    });
    idAdoptada = adoptadas.data[0].id;

    const todas = await listarMascotas({}, servidor);
    for (const m of todas.data) ids[m.nombre] = m.id;
  }, 90_000);

  it('el catálogo público lista las 4 mascotas disponibles del seed, sin las adoptadas', async () => {
    const pagina = await listarMascotas({}, servidor);
    expect(pagina.total).toBeGreaterThanOrEqual(4);
    expect(pagina.limit).toBe(12);
    for (const nombre of ['Firulais', 'Luna', 'Michi', 'Nieve']) expect(ids[nombre]).toBeDefined();
    expect(pagina.data.map((m) => m.id)).not.toContain(idAdoptada);
    const m = pagina.data.find((x) => x.nombre === 'Firulais')!;
    expect(m).toMatchObject({
      especie: 'perro',
      tamano: 'mediano',
      edadMeses: 24,
      fundacion: { nombre: expect.any(String) },
    });
    expect(Object.keys(m).sort()).toEqual(
      [
        'ciudad',
        'edadMeses',
        'especie',
        'fotoPrincipal',
        'fundacion',
        'id',
        'nombre',
        'raza',
        'sexo',
        'tamano',
      ].sort(),
    );
  });

  it('filtra por tamaño y por especie con la consulta que construye el front', async () => {
    const especies = await listarEspecies(servidor);
    const gato = especies.find((e) => e.nombre === 'gato')!;
    expect(gato).toBeDefined();

    const grandes = parsearFiltros({ tamano: 'grande' });
    const resGrandes = await listarMascotas(
      aConsultaApi(grandes.filtros, grandes.rangoInvalido),
      servidor,
    );
    expect(resGrandes.data.length).toBeGreaterThan(0);
    expect(resGrandes.data.every((m) => m.tamano === 'grande')).toBe(true);
    expect(resGrandes.data.map((m) => m.nombre)).toContain('Luna');

    const gatos = parsearFiltros({ especie: String(gato.id), edadMax: '12' });
    const resGatos = await listarMascotas(
      aConsultaApi(gatos.filtros, gatos.rangoInvalido),
      servidor,
    );
    expect(resGatos.data.map((m) => m.nombre)).toEqual(['Michi']);
  });

  it('un rango de edad incoherente que llegara a la API sería un 400 mapeado; el front no lo envía', async () => {
    await expect(
      listarMascotas({ edadMinMeses: 30, edadMaxMeses: 10 }, servidor),
    ).rejects.toMatchObject({ tipo: 'http', estado: 400 });
    const { filtros, rangoInvalido } = parsearFiltros({ edadMin: '30', edadMax: '10' });
    expect(rangoInvalido).toBe(true);
    await expect(
      listarMascotas(aConsultaApi(filtros, rangoInvalido), servidor),
    ).resolves.toMatchObject({
      total: expect.any(Number),
    });
  });

  it('la ficha trae fundación pública sin contacto, y las fotos del seed no tienen URL pública', async () => {
    const ficha = await obtenerFicha(String(ids.Firulais), servidor);
    expect(ficha).not.toBeNull();
    expect(ficha!.fundacion).toEqual({
      id: expect.any(Number),
      nombre: expect.any(String),
      ciudad: expect.any(String),
      descripcion: expect.toBeOneOf([null, expect.any(String)]),
    });
    const texto = JSON.stringify(ficha);
    expect(texto).not.toMatch(/"(email|telefono|nit|direccion|documento\w*)"/i);
    // Las claves de la foto del seed no son reales: la API no las expone.
    expect(ficha!.fotos.every((f) => f.url === null && f.urlCatalogo === null)).toBe(true);
    const lista = await listarMascotas({}, servidor);
    expect(lista.data.find((m) => m.nombre === 'Firulais')!.fotoPrincipal).toBeNull();
  });

  it('el historial se devuelve con el más reciente primero', async () => {
    const id = ids.Luna;
    for (const [fecha, descripcion] of [
      ['2026-01-10', 'Vacuna antirrábica'],
      ['2026-03-05', 'Desparasitación interna'],
    ] as const) {
      await fundacion.post(`/mascotas/${id}/historial`, {
        cuerpo: {
          tipo: descripcion.startsWith('Vacuna') ? 'vacuna' : 'desparasitacion',
          fecha,
          descripcion,
          veterinario: 'Dra. Pérez',
        },
      });
    }
    const ficha = await obtenerFicha(String(id), servidor);
    const fechas = ficha!.historial.map((e) => e.fecha);
    expect(fechas.length).toBeGreaterThanOrEqual(2);
    expect(fechas).toEqual([...fechas].sort().reverse());
    expect(ficha!.historial[0]).toMatchObject({ fecha: '2026-03-05', veterinario: 'Dra. Pérez' });
  });

  it('una foto subida sale con URL pública (no clave interna) y se sirve a otro origen', async () => {
    const id = ids.Nieve;
    const previa = await obtenerFicha(String(id), servidor);
    let real = previa!.fotos.find((f) => f.url);
    let fotoId = real?.id;
    if (!real) {
      const form = new FormData();
      form.append('foto', new File([PNG_1X1], 'nieve.png', { type: 'image/png' }));
      fotoId = (await fundacion.post<{ id: number }>(`/mascotas/${id}/fotos`, { cuerpo: form })).id;
      real = undefined;
    }
    // La foto de relleno del seed ya es la principal: se promueve la real.
    if (!real?.esPrincipal) await fundacion.patch(`/mascotas/${id}/fotos/${fotoId}/principal`);
    const ficha = await obtenerFicha(String(id), servidor);
    const principal = ficha!.fotos[0];
    expect(principal.esPrincipal).toBe(true);
    for (const url of [principal.url!, principal.urlCatalogo!]) {
      expect(url).toMatch(/^https?:\/\/[^/]+\/uploads\/mascotas\/[\w.-]+$/);
    }
    const lista = await listarMascotas({}, servidor);
    const enLista = lista.data.find((m) => m.nombre === 'Nieve')!;
    expect(enLista.fotoPrincipal!.urlCatalogo).toBe(principal.urlCatalogo);

    const imagen = await fetch(principal.urlCatalogo!);
    expect(imagen.status).toBe(200);
    expect(imagen.headers.get('content-type')).toMatch(/^image\//);
    expect(imagen.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
  });

  it('una mascota adoptada o inexistente no tiene ficha (null ⇒ 404 en el front)', async () => {
    await expect(obtenerFicha(String(idAdoptada), servidor)).resolves.toBeNull();
    await expect(obtenerFicha('999999', servidor)).resolves.toBeNull();
  });

  it('la ficha en PDF es pública y se descarga como adjunto', async () => {
    const r = await fetch(`${API}/mascotas/${ids.Firulais}/ficha.pdf`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toMatch(/^application\/pdf/);
    expect(r.headers.get('content-disposition')).toMatch(
      new RegExp(`^attachment; filename="?ficha-mascota-${ids.Firulais}\\.pdf"?`),
    );
    const cuerpo = Buffer.from(await r.arrayBuffer());
    expect(cuerpo.subarray(0, 4).toString()).toBe('%PDF');

    const adoptada = await fetch(`${API}/mascotas/${idAdoptada}/ficha.pdf`);
    expect(adoptada.status).toBe(404);
  });
});
