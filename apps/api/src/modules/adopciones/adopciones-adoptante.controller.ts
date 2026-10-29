import { Controller, Get, Param, Query, Res, StreamableFile } from '@nestjs/common';
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
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import type { UsuarioAutenticado } from '../../common/auth/usuario-autenticado';
import { IdEnteroPipe } from '../../common/pipes/id-entero.pipe';
import { CabecerasDescargaSegura, enviarDescarga } from '../storage/descarga';
import { aAdopcionAdoptanteDto, RUTA_ACTA_ADOPTANTE } from './adopciones.mapeo';
import { AdopcionesService } from './adopciones.service';
import { ConsultaAdopcionesDto } from './dto/consulta-adopciones.dto';
import { AdopcionesAdoptantePaginadoDto } from './dto/respuestas.dto';

/** Adopciones del adoptante: cada uno ve únicamente las suyas. */
@ApiTags('Adopciones — Adoptante')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión no válida o vencida' })
@ApiForbiddenResponse({ description: 'Solo adoptantes' })
@Roles('adoptante')
@Controller('mis-adopciones')
export class AdopcionesAdoptanteController {
  constructor(private readonly adopciones: AdopcionesService) {}

  @Get()
  @ApiOperation({ summary: 'Mis adopciones, con la mascota, la fecha de entrega y el acta' })
  @ApiOkResponse({ type: AdopcionesAdoptantePaginadoDto })
  async listar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Query() consulta: ConsultaAdopcionesDto,
  ): Promise<AdopcionesAdoptantePaginadoDto> {
    const pagina = await this.adopciones.listarMias(
      usuario.id,
      { estado: consulta.estado },
      consulta,
    );
    return {
      ...pagina,
      data: pagina.data.map((a) => aAdopcionAdoptanteDto(a, RUTA_ACTA_ADOPTANTE)),
    };
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':id/acta')
  @CabecerasDescargaSegura()
  @ApiOperation({ summary: 'Descarga el acta firmada de una adopción mía' })
  @ApiProduces('application/pdf', 'image/jpeg', 'image/png')
  @ApiNotFoundResponse({ description: 'La adopción o su acta no existen' })
  async acta(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Param('id', IdEnteroPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const archivo = await this.adopciones.leerActa(id, {
      tipo: 'adoptante',
      usuarioId: usuario.id,
    });
    return enviarDescarga(res, archivo);
  }
}
