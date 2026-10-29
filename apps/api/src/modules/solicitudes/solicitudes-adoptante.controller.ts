import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import type { UsuarioAutenticado } from '../../common/auth/usuario-autenticado';
import { IdEnteroPipe } from '../../common/pipes/id-entero.pipe';
import { ArchivoUnicoInterceptor } from '../storage/archivo-unico.interceptor';
import { CabecerasDescargaSegura, enviarDescarga } from '../storage/descarga';
import { CrearSolicitudDto } from './dto/crear-solicitud.dto';
import { ConsultaMisSolicitudesDto } from './dto/consultas.dto';
import {
  SolicitudDetalleAdoptanteDto,
  SolicitudesAdoptantePaginadoDto,
} from './dto/respuestas.dto';
import { FormularioService } from './formulario.service';
import { SolicitudesService } from './solicitudes.service';
import { aDetalleAdoptanteDto, aResumenAdoptanteDto } from './solicitudes.mapeo';

/** Rutas del adoptante: sus solicitudes son suyas; una ajena responde igual que una inexistente. */
@ApiTags('Solicitudes — Adoptante')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión no válida o vencida' })
@ApiForbiddenResponse({ description: 'Solo adoptantes' })
@Roles('adoptante')
@Controller()
export class SolicitudesAdoptanteController {
  constructor(
    private readonly solicitudes: SolicitudesService,
    private readonly formularios: FormularioService,
  ) {}

  // Sube un archivo y escribe en la base: límite por IP más estricto que el global.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('solicitudes')
  @UseInterceptors(ArchivoUnicoInterceptor('formulario'))
  @ApiOperation({
    summary:
      'Envía una solicitud de adopción con el formulario firmado (PDF, JPG o PNG, máx. 5 MB)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['mascotaId', 'motivo', 'tipoVivienda', 'tieneOtrasMascotas', 'formulario'],
      properties: {
        mascotaId: { type: 'integer' },
        motivo: { type: 'string', maxLength: 500 },
        tipoVivienda: { type: 'string', enum: ['casa', 'apartamento', 'finca'] },
        tieneOtrasMascotas: { type: 'boolean' },
        formulario: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ type: SolicitudDetalleAdoptanteDto })
  @ApiBadRequestResponse({ description: 'Datos o archivo inválidos' })
  @ApiPayloadTooLargeResponse({ description: 'El archivo supera 5 MB' })
  @ApiNotFoundResponse({ description: 'La mascota no existe' })
  @ApiConflictResponse({
    description: 'La mascota no está disponible o ya hay una solicitud activa',
  })
  async crear(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Body() dto: CrearSolicitudDto,
    @UploadedFile() archivo?: Express.Multer.File,
  ): Promise<SolicitudDetalleAdoptanteDto> {
    return aDetalleAdoptanteDto(await this.solicitudes.crear(usuario, dto, archivo?.buffer));
  }

  @Get('mis-solicitudes')
  @ApiOperation({ summary: 'Mis solicitudes, de la más reciente a la más antigua' })
  @ApiOkResponse({ type: SolicitudesAdoptantePaginadoDto })
  async listar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Query() consulta: ConsultaMisSolicitudesDto,
  ): Promise<SolicitudesAdoptantePaginadoDto> {
    const pagina = await this.solicitudes.listarMias(
      usuario.id,
      { estado: consulta.estado },
      consulta,
    );
    return { ...pagina, data: pagina.data.map(aResumenAdoptanteDto) };
  }

  @Get('mis-solicitudes/:id')
  @ApiOperation({ summary: 'Detalle de una solicitud mía, con la observación de la fundación' })
  @ApiOkResponse({ type: SolicitudDetalleAdoptanteDto })
  @ApiNotFoundResponse({ description: 'La solicitud no existe' })
  async obtener(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Param('id', IdEnteroPipe) id: number,
  ): Promise<SolicitudDetalleAdoptanteDto> {
    return aDetalleAdoptanteDto(await this.solicitudes.obtenerMia(usuario.id, id));
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('mis-solicitudes/:id/formulario')
  @CabecerasDescargaSegura()
  @ApiOperation({ summary: 'Descarga el formulario firmado de una solicitud mía' })
  @ApiProduces('application/pdf', 'image/jpeg', 'image/png')
  @ApiNotFoundResponse({ description: 'La solicitud no existe' })
  async formulario(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Param('id', IdEnteroPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const archivo = await this.formularios.leer(id, { tipo: 'adoptante', usuarioId: usuario.id });
    return enviarDescarga(res, archivo);
  }

  @Patch('solicitudes/:id/cancelar')
  @ApiOperation({ summary: 'Cancela una solicitud mía mientras esté pendiente' })
  @ApiOkResponse({ type: SolicitudDetalleAdoptanteDto })
  @ApiNotFoundResponse({ description: 'La solicitud no existe' })
  @ApiConflictResponse({ description: 'La solicitud ya no está pendiente' })
  async cancelar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Param('id', IdEnteroPipe) id: number,
  ): Promise<SolicitudDetalleAdoptanteDto> {
    return aDetalleAdoptanteDto(await this.solicitudes.cancelar(usuario.id, id));
  }
}
