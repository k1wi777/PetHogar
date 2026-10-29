import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/public.decorator';

@ApiTags('Salud')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Indica que la API está operativa (no consulta la base de datos)' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  comprobar(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
