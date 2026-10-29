import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/auth/public.decorator';
import { IdEnteroPipe } from '../../common/pipes/id-entero.pipe';
import { CatalogosService } from './catalogos.service';
import { EspecieDto, RazaDto } from './dto/respuestas.dto';

const LIMITE_PUBLICO = { default: { limit: 60, ttl: 60_000 } };

@ApiTags('Catálogos')
@Controller('especies')
export class CatalogosController {
  constructor(private readonly catalogos: CatalogosService) {}

  @Public()
  @Throttle(LIMITE_PUBLICO)
  @Get()
  @ApiOperation({ summary: 'Lista las especies' })
  @ApiOkResponse({ type: [EspecieDto] })
  listarEspecies(): Promise<EspecieDto[]> {
    return this.catalogos.listarEspecies();
  }

  @Public()
  @Throttle(LIMITE_PUBLICO)
  @Get(':id/razas')
  @ApiOperation({ summary: 'Lista las razas de una especie' })
  @ApiOkResponse({ type: [RazaDto] })
  @ApiNotFoundResponse({ description: 'La especie no existe' })
  listarRazas(@Param('id', IdEnteroPipe) id: number): Promise<RazaDto[]> {
    return this.catalogos.listarRazas(id);
  }
}
