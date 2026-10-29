import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/auth/public.decorator';
import { IdEnteroPipe } from '../../../common/pipes/id-entero.pipe';
import { ConsultaCatalogoDto } from '../dto/consulta-catalogo.dto';
import {
  EventoMedicoDto,
  MascotaFichaDto,
  MascotasCatalogoPaginadoDto,
} from '../dto/respuestas.dto';
import { CatalogoMascotasService } from './catalogo-mascotas.service';

const LIMITE_PUBLICO = { default: { limit: 60, ttl: 60_000 } };

/** Catálogo y ficha públicos: sin autenticación, solo mascotas disponibles, con límite por IP. */
@ApiTags('Mascotas — Catálogo público')
@Controller('mascotas')
export class MascotasCatalogoController {
  constructor(private readonly catalogo: CatalogoMascotasService) {}

  @Public()
  @Throttle(LIMITE_PUBLICO)
  @Get()
  @ApiOperation({
    summary:
      'Catálogo de mascotas disponibles, por fecha de publicación descendente, con filtros opcionales',
  })
  @ApiOkResponse({ type: MascotasCatalogoPaginadoDto })
  @ApiBadRequestResponse({
    description: 'Algún filtro es inválido o el rango de edad es incoherente',
  })
  listar(@Query() consulta: ConsultaCatalogoDto): Promise<MascotasCatalogoPaginadoDto> {
    const { especieId, tamano, edadMinMeses, edadMaxMeses, ciudad } = consulta;
    return this.catalogo.listar(
      { especieId, tamano, edadMinMeses, edadMaxMeses, ciudad },
      consulta,
    );
  }

  @Public()
  @Throttle(LIMITE_PUBLICO)
  @Get(':id')
  @ApiOperation({ summary: 'Ficha completa de una mascota disponible' })
  @ApiOkResponse({ type: MascotaFichaDto })
  @ApiNotFoundResponse({ description: 'La mascota no existe o no está disponible' })
  obtener(@Param('id', IdEnteroPipe) id: number): Promise<MascotaFichaDto> {
    return this.catalogo.obtenerFicha(id);
  }

  @Public()
  @Throttle(LIMITE_PUBLICO)
  @Get(':id/historial')
  @ApiOperation({ summary: 'Historial médico de una mascota disponible, más reciente primero' })
  @ApiOkResponse({ type: [EventoMedicoDto] })
  @ApiNotFoundResponse({ description: 'La mascota no existe o no está disponible' })
  historial(@Param('id', IdEnteroPipe) id: number): Promise<EventoMedicoDto[]> {
    return this.catalogo.obtenerHistorial(id);
  }
}
