import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../../common/auth/roles.decorator';
import { AdminFundacionesService } from './admin-fundaciones.service';
import { ConsultaFundacionesDto } from './dto/consulta-fundaciones.dto';
import { FundacionAdminDetalleDto, FundacionesAdminPaginadoDto } from './dto/respuestas.dto';
import { ValidacionFundacionDto } from './dto/validacion-fundacion.dto';

@ApiTags('Administración — Fundaciones')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión no válida o vencida' })
@ApiForbiddenResponse({ description: 'Solo administradores' })
@Roles('administrador')
@Controller('admin/fundaciones')
export class AdminFundacionesController {
  constructor(private readonly admin: AdminFundacionesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista fundaciones por estado de validación (pendientes por defecto)' })
  @ApiOkResponse({ type: FundacionesAdminPaginadoDto })
  listar(@Query() consulta: ConsultaFundacionesDto): Promise<FundacionesAdminPaginadoDto> {
    return this.admin.listar(consulta.estado, consulta);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una fundación con su NIT, contacto y enlace al documento' })
  @ApiOkResponse({ type: FundacionAdminDetalleDto })
  @ApiNotFoundResponse({ description: 'La fundación no existe' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<FundacionAdminDetalleDto> {
    return this.admin.obtener(id);
  }

  @Get(':id/documento')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'private, no-store')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  @ApiOperation({
    summary: 'Descarga el documento legal privado (PDF, JPG o PNG según su contenido real)',
  })
  @ApiProduces('application/pdf', 'image/jpeg', 'image/png')
  @ApiNotFoundResponse({ description: 'La fundación o el documento no existen' })
  async documento(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const archivo = await this.admin.obtenerDocumento(id);
    res.setHeader('Content-Disposition', `inline; filename="${archivo.nombreArchivo}"`);
    return new StreamableFile(archivo.buffer, { type: archivo.tipo, length: archivo.tamano });
  }

  @Patch(':id/validacion')
  @ApiOperation({ summary: 'Aprueba o rechaza una fundación (el rechazo exige observación)' })
  @ApiOkResponse({ type: FundacionAdminDetalleDto })
  @ApiNotFoundResponse({ description: 'La fundación no existe' })
  validar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ValidacionFundacionDto,
  ): Promise<FundacionAdminDetalleDto> {
    return this.admin.decidir(id, dto.decision, dto.observacion);
  }
}
