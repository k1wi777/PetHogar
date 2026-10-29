import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import type { UsuarioAutenticado } from '../../common/auth/usuario-autenticado';
import { AdminUsuariosService } from './admin-usuarios.service';
import { ConsultaUsuariosDto } from './dto/consulta-usuarios.dto';
import { EstadoUsuarioDto } from './dto/estado-usuario.dto';
import { UsuarioAdminDto, UsuariosAdminPaginadoDto } from './dto/respuestas.dto';

@ApiTags('Administración — Usuarios')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión no válida o vencida' })
@ApiForbiddenResponse({ description: 'Solo administradores' })
@Roles('administrador')
@Controller('admin/usuarios')
export class AdminUsuariosController {
  constructor(private readonly admin: AdminUsuariosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuarios con filtros por nombre, correo y rol' })
  @ApiOkResponse({ type: UsuariosAdminPaginadoDto })
  listar(@Query() consulta: ConsultaUsuariosDto): Promise<UsuariosAdminPaginadoDto> {
    const { nombre, correo, rol } = consulta;
    return this.admin.listar({ nombre, correo, rol }, consulta);
  }

  @Patch(':id/estado')
  @ApiOperation({
    summary: 'Activa o desactiva una cuenta; al desactivar se cierran todas sus sesiones',
  })
  @ApiOkResponse({ type: UsuarioAdminDto })
  @ApiNotFoundResponse({ description: 'El usuario no existe' })
  @ApiConflictResponse({ description: 'Quedaría el sistema sin administradores activos' })
  cambiarEstado(
    @CurrentUser() actor: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EstadoUsuarioDto,
  ): Promise<UsuarioAdminDto> {
    return this.admin.cambiarEstado(actor.id, id, dto.activo);
  }
}
