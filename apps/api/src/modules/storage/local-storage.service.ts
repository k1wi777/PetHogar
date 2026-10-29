import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import {
  BadRequestException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ArchivoInvalidoException } from './archivo-invalido.exception';
import {
  CARPETAS,
  EXTENSION_POR_TIPO,
  MAX_BYTES,
  MENSAJE_ARCHIVO_GRANDE,
  MENSAJE_ARCHIVO_VACIO,
  MENSAJE_SOLO_DOCUMENTOS,
  MENSAJE_SOLO_IMAGENES,
  POLITICA_POR_CATEGORIA,
  VISIBILIDAD_POR_CARPETA,
  type CarpetaArchivo,
  type Visibilidad,
} from './storage.constants';
import type {
  ArchivoEntrada,
  ArchivoLeido,
  ArchivoGuardado,
  IStorageService,
  OpcionesGuardado,
} from './storage.interface';
import { detectarTipo } from './tipo-archivo';

const MENSAJE_ARCHIVO_NO_DISPONIBLE = 'El documento no está disponible';

export interface LocalStorageOpciones {
  /** Directorio raíz de uploads (relativo al cwd o absoluto). */
  directorio: string;
  /** URL base de la API, sin barra final. */
  urlBase: string;
}

/** Almacenamiento en disco local: `uploads/publico|privado/<carpeta>/<uuid>.<ext>`. */
export class LocalStorageService implements IStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly raiz: string;
  private readonly urlBase: string;

  constructor(opciones: LocalStorageOpciones) {
    this.raiz = path.resolve(opciones.directorio);
    this.urlBase = opciones.urlBase.replace(/\/+$/, '');
  }

  async guardar(archivo: ArchivoEntrada, opciones: OpcionesGuardado): Promise<ArchivoGuardado> {
    const visibilidad = VISIBILIDAD_POR_CARPETA[opciones.carpeta];
    if (!visibilidad || !CARPETAS.includes(opciones.carpeta)) {
      throw new ArchivoInvalidoException('La carpeta de destino no es válida');
    }
    const { buffer } = archivo;
    if (buffer.length === 0) throw new ArchivoInvalidoException(MENSAJE_ARCHIVO_VACIO);
    if (buffer.length > MAX_BYTES) throw new PayloadTooLargeException(MENSAJE_ARCHIVO_GRANDE);

    const tipo = detectarTipo(buffer);
    const permitidos = POLITICA_POR_CATEGORIA[opciones.categoria];
    if (!tipo || !permitidos?.includes(tipo)) {
      throw new ArchivoInvalidoException(
        opciones.categoria === 'imagen' ? MENSAJE_SOLO_IMAGENES : MENSAJE_SOLO_DOCUMENTOS,
      );
    }

    const clave = `${visibilidad}/${opciones.carpeta}/${randomUUID()}.${EXTENSION_POR_TIPO[tipo]}`;
    const destino = this.resolverClave(clave);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, buffer, { flag: 'wx' });
    this.logger.log(`Archivo guardado: ${clave} (${buffer.length} bytes)`);
    return { clave, visibilidad, tipo, tamano: buffer.length };
  }

  async leer(clave: string): Promise<ArchivoLeido> {
    const origen = this.resolverClave(clave);
    let buffer: Buffer;
    try {
      buffer = await readFile(origen);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      this.logger.warn(`Archivo no encontrado: ${clave}`);
      throw new NotFoundException(MENSAJE_ARCHIVO_NO_DISPONIBLE);
    }
    // El tipo sale de la firma, no de la extensión: un archivo alterado en disco no se sirve como lo que dice ser.
    const tipo = detectarTipo(buffer);
    if (!tipo) {
      this.logger.warn(`Archivo con firma no reconocida: ${clave}`);
      throw new NotFoundException(MENSAJE_ARCHIVO_NO_DISPONIBLE);
    }
    return { buffer, tipo, tamano: buffer.length };
  }

  async eliminar(clave: string): Promise<void> {
    const destino = this.resolverClave(clave);
    try {
      await unlink(destino);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  urlPublica(clave: string): string {
    this.resolverClave(clave);
    if (!clave.startsWith('publico/')) {
      throw new BadRequestException('El archivo no es público');
    }
    return `${this.urlBase}/uploads/${clave.slice('publico/'.length)}`;
  }

  /** Valida la forma de la clave y comprueba que la ruta resuelta no escape de la raíz. */
  private resolverClave(clave: string): string {
    const partes = clave.split('/');
    const [visibilidad, carpeta, nombre] = partes;
    const valida =
      partes.length === 3 &&
      (visibilidad === 'publico' || visibilidad === 'privado') &&
      CARPETAS.includes(carpeta as CarpetaArchivo) &&
      VISIBILIDAD_POR_CARPETA[carpeta as CarpetaArchivo] === (visibilidad as Visibilidad) &&
      /^[0-9a-f-]{36}\.(jpg|png|pdf)$/.test(nombre);
    if (!valida) throw new BadRequestException('La clave del archivo no es válida');

    const resuelta = path.resolve(this.raiz, visibilidad, carpeta, nombre);
    if (!resuelta.startsWith(this.raiz + path.sep)) {
      throw new BadRequestException('La clave del archivo no es válida');
    }
    return resuelta;
  }
}
