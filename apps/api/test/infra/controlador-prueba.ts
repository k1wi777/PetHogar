import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Module,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { IsEmail, IsIn } from 'class-validator';
import { IMailService, MAIL_SERVICE } from '../../src/modules/mail/mail.interface';
import { MailModule } from '../../src/modules/mail/mail.module';
import { ArchivoUnicoInterceptor } from '../../src/modules/storage/archivo-unico.interceptor';
import { CARPETAS, type CarpetaArchivo } from '../../src/modules/storage/storage.constants';
import { IStorageService, STORAGE_SERVICE } from '../../src/modules/storage/storage.interface';
import { StorageModule } from '../../src/modules/storage/storage.module';

class SubirArchivoDto {
  @IsIn(['imagen', 'documento'])
  categoria!: 'imagen' | 'documento';

  @IsIn([...CARPETAS])
  carpeta!: CarpetaArchivo;
}

class EnviarCorreoDto {
  @IsEmail()
  destinatario!: string;
}

/** Solo para V9: expone storage y correo reales por HTTP; no forma parte de la aplicación. */
@Controller('pruebas')
class ControladorPrueba {
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
    if (!archivo) throw new BadRequestException('Debes adjuntar un archivo');
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
  async enviarCorreo(@Body() dto: EnviarCorreoDto): Promise<{ enviado: boolean }> {
    const { enviado } = await this.mail.enviar({
      para: dto.destinatario,
      plantilla: 'prueba',
      datos: { nombre: 'equipo PetHogar' },
    });
    return { enviado };
  }
}

@Module({ imports: [StorageModule, MailModule], controllers: [ControladorPrueba] })
export class ModuloPrueba {}
