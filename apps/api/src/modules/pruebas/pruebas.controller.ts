import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IMailService, MAIL_SERVICE, type ResultadoEnvio } from '../mail/mail.interface';
import { ArchivoUnicoInterceptor } from '../storage/archivo-unico.interceptor';
import { IStorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { EnviarCorreoDto } from './dto/enviar-correo.dto';
import { SubirArchivoDto } from './dto/subir-archivo.dto';
import { EndpointsPruebaGuard } from './endpoints-prueba.guard';

/**
 * TEMPORAL: endpoints de verificación de storage y correo, sin autenticación y tras el flag
 * HABILITAR_ENDPOINTS_PRUEBA. No forman parte de la API definitiva; se retiran cuando B-10
 * (correo real) y B-20 (subida real) los reemplacen.
 */
@ApiExcludeController()
@UseGuards(EndpointsPruebaGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('pruebas')
export class PruebasController {
  constructor(
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
    @Inject(MAIL_SERVICE) private readonly mail: IMailService,
  ) {}

  @Post('archivos')
  @UseInterceptors(ArchivoUnicoInterceptor('archivo'))
  async subirArchivo(
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body() dto: SubirArchivoDto,
  ): Promise<{ clave: string; url?: string }> {
    if (!archivo) throw new BadRequestException('Debes adjuntar un archivo en el campo "archivo"');
    const guardado = await this.storage.guardar(
      { buffer: archivo.buffer, nombreOriginal: archivo.originalname },
      { categoria: dto.categoria, carpeta: dto.carpeta },
    );
    return guardado.visibilidad === 'publico'
      ? { clave: guardado.clave, url: this.storage.urlPublica(guardado.clave) }
      : { clave: guardado.clave };
  }

  @Post('correo')
  @HttpCode(200)
  enviarCorreo(@Body() dto: EnviarCorreoDto): Promise<ResultadoEnvio> {
    return this.mail
      .enviar({ para: dto.destinatario, plantilla: 'prueba', datos: { nombre: 'equipo PetHogar' } })
      .then(({ enviado }) => ({ enviado }));
  }
}
