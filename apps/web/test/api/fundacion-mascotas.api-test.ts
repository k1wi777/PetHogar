import { beforeAll, describe, expect, it } from 'vitest';
import { listarMascotas, obtenerFicha } from '@/features/catalogo/api/mascotas';
import { listarEspecies, listarRazas } from '@/features/mascotas-gestion/api/catalogos';
import { eliminarFoto, marcarPrincipal, subirFoto } from '@/features/mascotas-gestion/api/fotos';
import { listarHistorialPublico, registrarEvento } from '@/features/mascotas-gestion/api/historial';
import {
  crearMascota,
  darDeBaja,
  editarMascota,
  listarMisMascotas,
  obtenerMascotaGestion,
} from '@/features/mascotas-gestion/api/mascotas';
import { CAMPOS_HISTORIAL, CAMPOS_MASCOTA } from '@/features/mascotas-gestion/lib/errores';
import { MAX_FOTOS, MENSAJE_CUPO, prepararArchivos } from '@/features/mascotas-gestion/lib/subida';
import { aDatosMascota, aMeses } from '@/features/mascotas-gestion/schemas/mascota';
import { crearClienteHttp, type ClienteHttp } from '@/shared/api/cliente';
import { esErrorApi } from '@/shared/api/errores';
import { crearClienteServidor } from '@/shared/api/servidor';
import type { RespuestaSesion } from '@/shared/api/tipos';
import { traducirError } from '@/shared/lib/errores-formulario';
import { conLimite } from './limite';

const API = process.env.TEST_API_URL;
const EMAIL = process.env.TEST_DEMO_EMAIL ?? 'fundacion.demo@pethogar.local';
const CLAVE = process.env.TEST_DEMO_PASSWORD;
const EJECUCION = Date.now().toString(36);

// PNG de 1x1 píxel: firma binaria real, que es lo que valida el backend.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const png = (nombre: string) => new File([PNG_1X1], nombre, { type: 'image/png' });

/** «Hoy» es el día de Bogotá, como en la API. */
function fechaBogota(sumarDias = 0): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const f = new Date(`${hoy}T00:00:00Z`);
  f.setUTCDate(f.getUTCDate() + sumarDias);
  return f.toISOString().slice(0, 10);
}

async function fallo(accion: () => Promise<unknown>) {
  try {
    await accion();
  } catch (error) {
    if (esErrorApi(error)) return error;
    throw error;
  }
  throw new Error('Se esperaba un error de la API y la llamada tuvo éxito');
}

// Límites: 6 subidas + 1 rechazada por cupo + 1 de contenido falso (20/min) y menos de 60
// peticiones por minuto en total. La mascota queda inactiva: no afecta al catálogo del seed.
describe('V17: gestión de mascotas de la fundación contra la API real (capa de datos de la feature)', () => {
  let fundacion: ClienteHttp;
  let servidor: ClienteHttp;
  let razaId: number;
  let id: number;
  const nombre = `V17 gestión ${EJECUCION}`.slice(0, 60);

  beforeAll(async () => {
    if (!API || !CLAVE) {
      throw new Error('Define TEST_API_URL y TEST_DEMO_PASSWORD. Ver verification.md (V17).');
    }
    servidor = crearClienteServidor({ baseUrl: API });
    fundacion = crearClienteHttp({ baseUrl: API, cerrojos: null });
    const sesion = await conLimite(() =>
      fundacion.post<RespuestaSesion>('/auth/login', {
        autenticada: false,
        cuerpo: { email: EMAIL, contrasena: CLAVE },
      }),
    );
    fundacion.tokens.guardar(sesion.accessToken);
    const especies = await listarEspecies(fundacion);
    const razas = await listarRazas(especies[0]!.id, fundacion);
    razaId = razas[0]!.id;
  }, 400_000);

  it('publicar crea una mascota disponible con la edad en meses y la muestra el catálogo público', async () => {
    const creada = await crearMascota(
      aDatosMascota({
        nombre,
        especieId: '1',
        razaId: String(razaId),
        sexo: 'macho',
        anios: '2',
        meses: '6',
        tamano: 'mediano',
        estadoSalud: 'Sano',
        color: '',
        descripcion: '',
        esterilizado: false,
        vacunado: true,
      }),
      fundacion,
    );
    id = creada.id;
    expect(creada).toMatchObject({
      nombre,
      estado: 'disponible',
      edadMeses: aMeses(2, 6),
      vacunado: true,
    });

    const ficha = await obtenerFicha(String(id), servidor);
    expect(ficha).toMatchObject({ nombre, edadMeses: 30 });
    const catalogo = await listarMascotas({}, servidor);
    expect(catalogo.data.map((m) => m.id)).toContain(id);

    const propia = await listarMisMascotas({ pagina: 1, estado: 'disponible' }, fundacion);
    expect(propia.data.map((m) => m.id)).toContain(id);
  });

  it('editar con PATCH parcial se refleja en el detalle y en la ficha pública', async () => {
    const editada = await editarMascota(
      id,
      { tamano: 'grande', edadMeses: aMeses(3, 0) },
      fundacion,
    );
    expect(editada).toMatchObject({ tamano: 'grande', edadMeses: 36, nombre });
    const detalle = await obtenerMascotaGestion(id, fundacion);
    expect(detalle).toMatchObject({ tamano: 'grande', edadMeses: 36, razaId });
    expect(detalle.fotos).toEqual([]);
    expect((await obtenerFicha(String(id), servidor))?.tamano).toBe('grande');
  });

  it('un 400 por raza inexistente cae en el campo y los datos inválidos se traducen por campo', async () => {
    const error = await fallo(() => editarMascota(id, { razaId: 999_999 }, fundacion));
    expect(error.estado).toBe(400);
    const salida = traducirError(error, CAMPOS_MASCOTA);
    expect(salida).toMatchObject({ tipo: 'campos', campos: [{ campo: 'razaId' }] });
    const edad = await fallo(() => editarMascota(id, { edadMeses: 361 }, fundacion));
    expect(traducirError(edad, CAMPOS_MASCOTA)).toMatchObject({
      tipo: 'campos',
      campos: [{ campo: 'edadMeses', mensaje: 'La edad no puede superar 360 meses' }],
    });
  });

  it('sube dos PNG reales (la primera queda principal) y marcar la segunda deja una sola principal', async () => {
    const a = await subirFoto(id, png('a.png'), fundacion);
    const b = await subirFoto(id, png('b.png'), fundacion);
    expect(a.esPrincipal).toBe(true);
    expect(b.esPrincipal).toBe(false);
    expect(a.urlCatalogo).toMatch(/\/uploads\/mascotas\//);

    const galeria = await marcarPrincipal(id, b.id, fundacion);
    expect(galeria).toHaveLength(2);
    expect(galeria.filter((f) => f.esPrincipal).map((f) => f.id)).toEqual([b.id]);
    expect(galeria[0]!.id).toBe(b.id);
    const detalle = await obtenerMascotaGestion(id, fundacion);
    expect(detalle.fotos.filter((f) => f.esPrincipal)).toHaveLength(1);
  });

  it('un archivo con contenido falso se rechaza con 400', async () => {
    const falso = new File([Buffer.from('no soy una imagen')], 'falsa.png', { type: 'image/png' });
    const error = await fallo(() => subirFoto(id, falso, fundacion));
    expect(error.estado).toBe(400);
    expect((await obtenerMascotaGestion(id, fundacion)).fotos).toHaveLength(2);
  });

  it('la séptima foto se rechaza antes de enviar y, si llegara, con 409 y el mensaje de cupo', async () => {
    for (let i = 3; i <= MAX_FOTOS; i++) await subirFoto(id, png(`f${i}.png`), fundacion);
    const llena = await obtenerMascotaGestion(id, fundacion);
    expect(llena.fotos).toHaveLength(MAX_FOTOS);

    const previa = prepararArchivos([png('septima.png')], llena.fotos.length);
    expect(previa.aceptados).toEqual([]);
    expect(previa.rechazados[0]!.mensaje).toBe(MENSAJE_CUPO);

    const error = await fallo(() => subirFoto(id, png('septima.png'), fundacion));
    expect(error.estado).toBe(409);
    expect(error.mensaje).toBe(MENSAJE_CUPO);
    expect((await obtenerMascotaGestion(id, fundacion)).fotos).toHaveLength(MAX_FOTOS);
  });

  it('eliminar la principal promueve otra y libera el cupo', async () => {
    const antes = await obtenerMascotaGestion(id, fundacion);
    const principal = antes.fotos.find((f) => f.esPrincipal)!;
    await eliminarFoto(id, principal.id, fundacion);
    const despues = await obtenerMascotaGestion(id, fundacion);
    expect(despues.fotos).toHaveLength(MAX_FOTOS - 1);
    expect(despues.fotos.map((f) => f.id)).not.toContain(principal.id);
    expect(despues.fotos.filter((f) => f.esPrincipal)).toHaveLength(1);
    expect(prepararArchivos([png('otra.png')], despues.fotos.length).aceptados).toHaveLength(1);
  });

  it('el historial registrado aparece en la ficha pública; una fecha futura da 400 en «fecha»', async () => {
    const ayer = fechaBogota(-1);
    const evento = await registrarEvento(
      id,
      { tipo: 'vacuna', fecha: ayer, descripcion: 'Refuerzo V17', veterinario: 'Dra. Pérez' },
      fundacion,
    );
    expect(evento).toMatchObject({ tipo: 'vacuna', fecha: ayer, veterinario: 'Dra. Pérez' });
    const publico = await listarHistorialPublico(id, fundacion);
    expect(publico.map((e) => e.id)).toContain(evento.id);
    const ficha = await obtenerFicha(String(id), servidor);
    expect(ficha!.historial.map((e) => e.descripcion)).toContain('Refuerzo V17');

    const error = await fallo(() =>
      registrarEvento(
        id,
        { tipo: 'consulta', fecha: fechaBogota(1), descripcion: 'Futuro' },
        fundacion,
      ),
    );
    expect(error.estado).toBe(400);
    expect(traducirError(error, CAMPOS_HISTORIAL)).toMatchObject({
      tipo: 'campos',
      campos: [{ campo: 'fecha', mensaje: 'La fecha del registro no puede ser futura' }],
    });
  });

  it('dar de baja retira la mascota del catálogo, queda inactiva y no admite más cambios', async () => {
    const baja = await darDeBaja(id, fundacion);
    expect(baja.estado).toBe('inactiva');
    expect(await obtenerFicha(String(id), servidor)).toBeNull();
    const catalogo = await listarMascotas({}, servidor);
    expect(catalogo.data.map((m) => m.id)).not.toContain(id);

    const inactivas = await listarMisMascotas({ pagina: 1, estado: 'inactiva' }, fundacion);
    expect(inactivas.data.map((m) => m.id)).toContain(id);
    expect((await obtenerMascotaGestion(id, fundacion)).estado).toBe('inactiva');

    expect((await fallo(() => darDeBaja(id, fundacion))).estado).toBe(409);
    expect((await fallo(() => editarMascota(id, { nombre: 'Otro' }, fundacion))).estado).toBe(409);
    // El historial público no sirve mascotas que no están disponibles (decisión 1 del diseño).
    expect((await fallo(() => listarHistorialPublico(id, fundacion))).estado).toBe(404);
  });
});
