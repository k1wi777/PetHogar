import { BadRequestException, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { FotosMascotaService } from './fotos-mascota.service';

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
const PDF = Buffer.from('%PDF-1.7\nx');
const K_CAT = 'publico/mascotas/11111111-1111-1111-1111-111111111111.jpg';
const K_GRA = 'publico/mascotas/22222222-2222-2222-2222-222222222222.jpg';
const MANAGER = { id: 'manager' };

describe('FotosMascotaService', () => {
  const fotos = {
    enTransaccion: jest.fn(),
    listar: jest.fn(),
    contar: jest.fn(),
    insertar: jest.fn(),
    existe: jest.fn(),
    marcarPrincipal: jest.fn(),
    eliminar: jest.fn(),
    promoverMenor: jest.fn(),
  };
  const mascotas = { buscarDeFundacion: jest.fn(), bloquearDeFundacion: jest.fn() };
  const procesador = { procesar: jest.fn() };
  const storage = { guardar: jest.fn(), eliminar: jest.fn(), urlPublica: jest.fn() };
  const service = new FotosMascotaService(
    fotos as never,
    mascotas as never,
    procesador as never,
    storage as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    fotos.enTransaccion.mockImplementation((trabajo: (m: unknown) => unknown) => trabajo(MANAGER));
    mascotas.buscarDeFundacion.mockResolvedValue({ id: 7 });
    mascotas.bloquearDeFundacion.mockResolvedValue(true);
    fotos.contar.mockResolvedValue({ total: 0, principales: 0 });
    procesador.procesar.mockResolvedValue({ catalogo: Buffer.from('c'), grande: Buffer.from('g') });
    storage.guardar.mockResolvedValueOnce({ clave: K_CAT }).mockResolvedValueOnce({ clave: K_GRA });
    storage.eliminar.mockResolvedValue(undefined);
    storage.urlPublica.mockImplementation((k: string) => `http://x/uploads/${k.slice(8)}`);
    fotos.insertar.mockImplementation((_m: unknown, d: object) => Promise.resolve({ id: 1, ...d }));
  });

  describe('subir', () => {
    it('procesa, guarda ambas versiones y registra la primera como principal', async () => {
      const foto = await service.subir(7, 3, JPEG);
      expect(mascotas.buscarDeFundacion).toHaveBeenCalledWith(7, 3);
      expect(mascotas.bloquearDeFundacion).toHaveBeenCalledWith(MANAGER, 7, 3);
      expect(storage.guardar).toHaveBeenCalledTimes(2);
      expect(storage.guardar.mock.calls[0][1]).toEqual({
        categoria: 'imagen',
        carpeta: 'mascotas',
      });
      expect(fotos.insertar).toHaveBeenCalledWith(MANAGER, {
        mascotaId: 7,
        url: K_GRA,
        urlCatalogo: K_CAT,
        esPrincipal: true,
      });
      expect(foto).toEqual({
        id: 1,
        esPrincipal: true,
        urlCatalogo: 'http://x/uploads/mascotas/11111111-1111-1111-1111-111111111111.jpg',
        url: 'http://x/uploads/mascotas/22222222-2222-2222-2222-222222222222.jpg',
      });
      expect(JSON.stringify(foto)).not.toContain('publico/');
    });

    it('una foto posterior no es principal si ya hay una', async () => {
      fotos.contar.mockResolvedValue({ total: 2, principales: 1 });
      const foto = await service.subir(7, 3, JPEG);
      expect(foto.esPrincipal).toBe(false);
    });

    it('rechaza con 400 sin archivo, vacío o que no es JPG/PNG, sin procesar nada', async () => {
      await expect(service.subir(7, 3, undefined)).rejects.toThrow(BadRequestException);
      await expect(service.subir(7, 3, Buffer.alloc(0))).rejects.toThrow(BadRequestException);
      await expect(service.subir(7, 3, PDF)).rejects.toThrow('Solo se permiten imágenes JPG o PNG');
      expect(procesador.procesar).not.toHaveBeenCalled();
      expect(storage.guardar).not.toHaveBeenCalled();
    });

    it('404 si la mascota es ajena o no existe, sin procesar', async () => {
      mascotas.buscarDeFundacion.mockResolvedValue(null);
      await expect(service.subir(7, 3, JPEG)).rejects.toThrow('La mascota no existe');
      expect(procesador.procesar).not.toHaveBeenCalled();
    });

    it('409 anticipado con 6 fotos, sin gastar CPU ni disco', async () => {
      fotos.contar.mockResolvedValue({ total: 6, principales: 1 });
      await expect(service.subir(7, 3, JPEG)).rejects.toThrow(
        'Solo puedes subir hasta 6 fotos por mascota',
      );
      expect(procesador.procesar).not.toHaveBeenCalled();
    });

    it('si el conteo bajo bloqueo ya es 6 (carrera) devuelve 409 y elimina los dos archivos', async () => {
      fotos.contar
        .mockResolvedValueOnce({ total: 5, principales: 1 })
        .mockResolvedValueOnce({ total: 6, principales: 1 });
      await expect(service.subir(7, 3, JPEG)).rejects.toThrow(ConflictException);
      expect(fotos.insertar).not.toHaveBeenCalled();
      expect(storage.eliminar.mock.calls.map((c) => c[0]).sort()).toEqual([K_CAT, K_GRA].sort());
    });

    it('un fallo del procesador no guarda archivos', async () => {
      procesador.procesar.mockRejectedValue(new BadRequestException('dañada'));
      await expect(service.subir(7, 3, JPEG)).rejects.toThrow('dañada');
      expect(storage.guardar).not.toHaveBeenCalled();
      expect(storage.eliminar).not.toHaveBeenCalled();
    });

    it('si falla guardar la segunda versión elimina la primera', async () => {
      storage.guardar.mockReset();
      storage.guardar
        .mockResolvedValueOnce({ clave: K_CAT })
        .mockRejectedValueOnce(new Error('disco lleno'));
      await expect(service.subir(7, 3, JPEG)).rejects.toThrow('disco lleno');
      expect(storage.eliminar).toHaveBeenCalledTimes(1);
      expect(storage.eliminar).toHaveBeenCalledWith(K_CAT);
    });

    it('si falla el registro elimina ambos archivos y conserva el error original', async () => {
      fotos.insertar.mockRejectedValue(new Error('violación de índice'));
      storage.eliminar.mockRejectedValueOnce(new Error('no se pudo borrar'));
      await expect(service.subir(7, 3, JPEG)).rejects.toThrow('violación de índice');
      expect(storage.eliminar).toHaveBeenCalledTimes(2);
    });

    it('404 si la mascota desaparece o cambia de dueño antes del bloqueo; limpia archivos', async () => {
      mascotas.bloquearDeFundacion.mockResolvedValue(false);
      await expect(service.subir(7, 3, JPEG)).rejects.toThrow(NotFoundException);
      expect(storage.eliminar).toHaveBeenCalledTimes(2);
    });
  });

  describe('marcarPrincipal', () => {
    it('bajo el bloqueo deja una sola principal y devuelve la galería', async () => {
      fotos.existe.mockResolvedValue(true);
      fotos.listar.mockResolvedValue([
        { id: 5, esPrincipal: true, urlCatalogo: K_CAT, url: K_GRA },
      ]);
      const res = await service.marcarPrincipal(7, 5, 3);
      expect(fotos.marcarPrincipal).toHaveBeenCalledWith(MANAGER, 7, 5);
      expect(res[0]).toMatchObject({ id: 5, esPrincipal: true });
    });

    it('404 si la foto no es de la mascota o la mascota es ajena', async () => {
      fotos.existe.mockResolvedValue(false);
      await expect(service.marcarPrincipal(7, 5, 3)).rejects.toThrow('La foto no existe');
      expect(fotos.marcarPrincipal).not.toHaveBeenCalled();
      mascotas.bloquearDeFundacion.mockResolvedValue(false);
      await expect(service.marcarPrincipal(7, 5, 3)).rejects.toThrow('La mascota no existe');
    });
  });

  describe('eliminar', () => {
    it('borra la fila, promueve otra si era principal y después borra los dos archivos', async () => {
      fotos.eliminar.mockResolvedValue({ url: K_GRA, urlCatalogo: K_CAT, esPrincipal: true });
      await service.eliminar(7, 5, 3);
      expect(fotos.promoverMenor).toHaveBeenCalledWith(MANAGER, 7);
      expect(storage.eliminar.mock.calls.map((c) => c[0]).sort()).toEqual([K_CAT, K_GRA].sort());
    });

    it('si no era principal no promueve', async () => {
      fotos.eliminar.mockResolvedValue({ url: K_GRA, urlCatalogo: K_CAT, esPrincipal: false });
      await service.eliminar(7, 5, 3);
      expect(fotos.promoverMenor).not.toHaveBeenCalled();
    });

    it('404 sin tocar archivos si la foto o la mascota no son propias', async () => {
      fotos.eliminar.mockResolvedValue(null);
      await expect(service.eliminar(7, 5, 3)).rejects.toThrow('La foto no existe');
      mascotas.bloquearDeFundacion.mockResolvedValue(false);
      await expect(service.eliminar(7, 5, 3)).rejects.toThrow('La mascota no existe');
      expect(storage.eliminar).not.toHaveBeenCalled();
    });

    it('si falla la transacción no borra archivos (la fila sigue existiendo)', async () => {
      fotos.eliminar.mockResolvedValue({ url: K_GRA, urlCatalogo: K_CAT, esPrincipal: true });
      fotos.promoverMenor.mockRejectedValue(new Error('fallo'));
      await expect(service.eliminar(7, 5, 3)).rejects.toThrow('fallo');
      expect(storage.eliminar).not.toHaveBeenCalled();
    });

    it('un fallo al borrar archivos tras confirmar solo se registra', async () => {
      fotos.eliminar.mockResolvedValue({ url: K_GRA, urlCatalogo: K_CAT, esPrincipal: false });
      storage.eliminar.mockRejectedValue(new Error('permiso denegado'));
      await expect(service.eliminar(7, 5, 3)).resolves.toBeUndefined();
    });
  });

  describe('listar', () => {
    it('no expone claves: las rutas del seed demo salen como null', async () => {
      fotos.listar.mockResolvedValue([
        {
          id: 1,
          esPrincipal: true,
          url: '/uploads/demo/luna.jpg',
          urlCatalogo: '/uploads/demo/luna.jpg',
        },
        { id: 2, esPrincipal: false, url: K_GRA, urlCatalogo: K_CAT },
      ]);
      const lista = await service.listar(7);
      expect(lista[0]).toEqual({ id: 1, esPrincipal: true, url: null, urlCatalogo: null });
      expect(lista[1].url).toContain('/uploads/mascotas/');
    });
  });
});
