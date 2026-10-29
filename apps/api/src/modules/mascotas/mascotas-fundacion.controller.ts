import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiPayloadTooLargeResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../common/auth/roles.decorator';
import { IdEnteroPipe } from '../../common/pipes/id-entero.pipe';
import { ArchivoUnicoInterceptor } from '../storage/archivo-unico.interceptor';
import { FundacionId } from '../fundaciones/decorators/fundacion-id.decorator';
import { ApprovedFoundationGuard } from '../fundaciones/guards/approved-foundation.guard';
import { ConsultaMascotasFundacionDto } from './dto/consulta-mascotas-fundacion.dto';
import { CrearMascotaDto } from './dto/crear-mascota.dto';
import { EditarMascotaDto } from './dto/editar-mascota.dto';
import {
  EventoMedicoDto,
  FotoGestionDto,
  MascotaGestionDetalleDto,
  MascotaGestionDto,
  MascotasGestionPaginadoDto,
} from './dto/respuestas.dto';
import { CrearHistorialDto } from './dto/crear-historial.dto';
import { FotosMascotaService } from './fotos/fotos-mascota.service';
import { HistorialService } from './historial/historial.service';
import { MascotasService } from './mascotas.service';

/**
 * Gestión de mascotas por su fundación. Orden de los guards: globales (throttler, jwt, cuenta
 * activa, roles) y después `ApprovedFoundationGuard`, de modo que el 403 por rol precede a la
 * consulta del estado de la fundación. Una mascota ajena responde igual que una inexistente.
 */
@ApiTags('Mascotas — Gestión de la fundación')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión no válida o vencida' })
@ApiForbiddenResponse({ description: 'Solo fundaciones aprobadas' })
@Roles('fundacion')
@UseGuards(ApprovedFoundationGuard)
@Controller()
export class MascotasFundacionController {
  constructor(
    private readonly mascotas: MascotasService,
    private readonly fotos: FotosMascotaService,
    private readonly historial: HistorialService,
  ) {}

  @Post('mascotas')
  @ApiOperation({ summary: 'Publica una mascota (queda disponible)' })
  @ApiCreatedResponse({ type: MascotaGestionDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos, con mensajes por campo' })
  crear(
    @FundacionId() fundacionId: number,
    @Body() dto: CrearMascotaDto,
  ): Promise<MascotaGestionDto> {
    return this.mascotas.crear(fundacionId, dto);
  }

  @Patch('mascotas/:id')
  @ApiOperation({ summary: 'Edita los datos de una mascota propia (nunca su estado)' })
  @ApiOkResponse({ type: MascotaGestionDto })
  @ApiNotFoundResponse({ description: 'La mascota no existe' })
  @ApiConflictResponse({ description: 'La mascota está adoptada o inactiva' })
  editar(
    @FundacionId() fundacionId: number,
    @Param('id', IdEnteroPipe) id: number,
    @Body() dto: EditarMascotaDto,
  ): Promise<MascotaGestionDto> {
    return this.mascotas.editar(id, fundacionId, dto);
  }

  @Patch('mascotas/:id/baja')
  @ApiOperation({
    summary: 'Da de baja una mascota disponible: pasa a inactiva y sale del catálogo',
  })
  @ApiOkResponse({ type: MascotaGestionDto })
  @ApiNotFoundResponse({ description: 'La mascota no existe' })
  @ApiConflictResponse({ description: 'La mascota no está disponible' })
  baja(
    @FundacionId() fundacionId: number,
    @Param('id', IdEnteroPipe) id: number,
  ): Promise<MascotaGestionDto> {
    return this.mascotas.darDeBaja(id, fundacionId);
  }

  @Get('fundacion/mascotas')
  @ApiOperation({ summary: 'Lista las mascotas de la fundación, filtrable por estado' })
  @ApiOkResponse({ type: MascotasGestionPaginadoDto })
  listar(
    @FundacionId() fundacionId: number,
    @Query() consulta: ConsultaMascotasFundacionDto,
  ): Promise<MascotasGestionPaginadoDto> {
    return this.mascotas.listarDeFundacion(fundacionId, { estado: consulta.estado }, consulta);
  }

  @Get('fundacion/mascotas/:id')
  @ApiOperation({ summary: 'Detalle de una mascota propia en cualquier estado' })
  @ApiOkResponse({ type: MascotaGestionDetalleDto })
  @ApiNotFoundResponse({ description: 'La mascota no existe' })
  obtener(
    @FundacionId() fundacionId: number,
    @Param('id', IdEnteroPipe) id: number,
  ): Promise<MascotaGestionDetalleDto> {
    return this.mascotas.obtenerDetalleDeFundacion(id, fundacionId);
  }

  // Subida de imágenes: más costosa (sharp), por eso su límite por IP es más estricto.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('mascotas/:id/fotos')
  @UseInterceptors(ArchivoUnicoInterceptor('foto'))
  @ApiOperation({
    summary: 'Sube una foto JPG o PNG (máx. 5 MB, hasta 6 por mascota); la primera queda principal',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['foto'],
      properties: { foto: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ type: FotoGestionDto })
  @ApiBadRequestResponse({ description: 'El archivo no es una imagen JPG o PNG válida' })
  @ApiPayloadTooLargeResponse({ description: 'El archivo supera 5 MB' })
  @ApiNotFoundResponse({ description: 'La mascota no existe' })
  @ApiConflictResponse({ description: 'La mascota ya tiene 6 fotos' })
  subirFoto(
    @FundacionId() fundacionId: number,
    @Param('id', IdEnteroPipe) id: number,
    @UploadedFile() archivo?: Express.Multer.File,
  ): Promise<FotoGestionDto> {
    return this.fotos.subir(id, fundacionId, archivo?.buffer);
  }

  @Patch('mascotas/:id/fotos/:fotoId/principal')
  @ApiOperation({ summary: 'Marca una foto como principal (la mascota queda con una sola)' })
  @ApiOkResponse({ type: [FotoGestionDto], description: 'Galería actualizada, principal primero' })
  @ApiNotFoundResponse({ description: 'La mascota o la foto no existen' })
  marcarPrincipal(
    @FundacionId() fundacionId: number,
    @Param('id', IdEnteroPipe) id: number,
    @Param('fotoId', IdEnteroPipe) fotoId: number,
  ): Promise<FotoGestionDto[]> {
    return this.fotos.marcarPrincipal(id, fotoId, fundacionId);
  }

  @Delete('mascotas/:id/fotos/:fotoId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Elimina una foto y sus archivos; si era la principal promueve otra' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'La mascota o la foto no existen' })
  eliminarFoto(
    @FundacionId() fundacionId: number,
    @Param('id', IdEnteroPipe) id: number,
    @Param('fotoId', IdEnteroPipe) fotoId: number,
  ): Promise<void> {
    return this.fotos.eliminar(id, fotoId, fundacionId);
  }

  @Post('mascotas/:id/historial')
  @ApiOperation({ summary: 'Registra un evento médico de una mascota propia' })
  @ApiCreatedResponse({ type: EventoMedicoDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos o fecha posterior a hoy' })
  @ApiNotFoundResponse({ description: 'La mascota no existe' })
  registrarHistorial(
    @FundacionId() fundacionId: number,
    @Param('id', IdEnteroPipe) id: number,
    @Body() dto: CrearHistorialDto,
  ): Promise<EventoMedicoDto> {
    return this.historial.registrar(id, fundacionId, dto);
  }
}
