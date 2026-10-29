import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import type { UsuarioAutenticado } from '../../common/auth/usuario-autenticado';
import { ArchivoUnicoInterceptor } from '../storage/archivo-unico.interceptor';
import { DonacionesService } from './donaciones.service';
import { aResumenDto } from './donaciones.mapeo';
import { CrearDonacionDto } from './dto/crear-donacion.dto';
import { DonacionResumenDto } from './dto/respuestas.dto';

/**
 * Donar a una fundación aprobada. Pueden donar adoptantes y usuarios de fundación (a otra, no a la
 * propia); el administrador no. No hay pasarela de pago: solo se registra el aporte y su comprobante.
 */
@ApiTags('Donaciones')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión no válida o vencida' })
@ApiForbiddenResponse({ description: 'Solo adoptantes y fundaciones; no a la propia fundación' })
@Roles('adoptante', 'fundacion')
@Controller('donaciones')
export class DonacionesController {
  constructor(private readonly donaciones: DonacionesService) {}

  // Sube un archivo y escribe en la base: límite por IP más estricto que el global.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @UseInterceptors(ArchivoUnicoInterceptor('comprobante'))
  @ApiOperation({
    summary:
      'Registra una donación (sin pasarela de pago) con comprobante opcional (PDF, JPG o PNG, máx. 5 MB)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fundacionId', 'tipo'],
      properties: {
        fundacionId: { type: 'integer' },
        tipo: { type: 'string', enum: ['economica', 'especie'] },
        monto: { type: 'string', example: '50000.00', description: 'Obligatorio si es económica' },
        descripcion: {
          type: 'string',
          maxLength: 300,
          description: 'Obligatoria si es en especie',
        },
        comprobante: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ type: DonacionResumenDto })
  @ApiBadRequestResponse({ description: 'Datos o archivo inválidos' })
  @ApiPayloadTooLargeResponse({ description: 'El archivo supera 5 MB' })
  @ApiNotFoundResponse({ description: 'La fundación no existe o no recibe donaciones' })
  async crear(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Body() dto: CrearDonacionDto,
    @UploadedFile() comprobante?: Express.Multer.File,
  ): Promise<DonacionResumenDto> {
    return aResumenDto(await this.donaciones.crear(usuario, dto, comprobante?.buffer));
  }
}
