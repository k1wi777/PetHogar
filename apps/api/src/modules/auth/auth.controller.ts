import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import type { UsuarioAutenticado } from '../../common/auth/usuario-autenticado';
import { cookieSegura, type EnvironmentVariables } from '../../config/env.validation';
import { ArchivoUnicoInterceptor } from '../storage/archivo-unico.interceptor';
import {
  borrarCookieRefresh,
  escribirCookieRefresh,
  leerCookie,
  NOMBRE_COOKIE_REFRESH,
} from './cookie-refresh';
import { LoginDto } from './dto/login.dto';
import { RegistroAdoptanteDto } from './dto/registro-adoptante.dto';
import { RegistroFundacionDto, RegistroFundacionMultipartDto } from './dto/registro-fundacion.dto';
import {
  MensajeDto,
  RegistroFundacionRespuestaDto,
  SesionRespuestaDto,
  UsuarioPerfilDto,
} from './dto/respuestas.dto';
import { ReenviarVerificacionDto, VerificarCorreoQueryDto } from './dto/verificacion.dto';
import { RestablecerContrasenaDto, SolicitarRecuperacionDto } from './dto/recuperacion.dto';
import { LoginService } from './login.service';
import { PerfilService } from './perfil.service';
import { RecuperacionService } from './recuperacion.service';
import { RegistroService } from './registro.service';
import { MENSAJE_SESION_NO_VALIDA, SesionEmitida, SesionService } from './sesion.service';
import { VerificacionService } from './verificacion.service';

const MINUTO_MS = 60_000;

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registro: RegistroService,
    private readonly verificacion: VerificacionService,
    private readonly login: LoginService,
    private readonly sesion: SesionService,
    private readonly perfil: PerfilService,
    private readonly recuperacion: RecuperacionService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: MINUTO_MS } })
  @Post('register/adoptante')
  @ApiOperation({ summary: 'Registra un adoptante y envía el correo de verificación' })
  @ApiCreatedResponse({ type: MensajeDto })
  registrarAdoptante(@Body() dto: RegistroAdoptanteDto): Promise<MensajeDto> {
    return this.registro.registrarAdoptante(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: MINUTO_MS } })
  @Post('register/fundacion')
  @UseInterceptors(ArchivoUnicoInterceptor('documento'))
  @ApiOperation({
    summary: 'Registra una fundación (pendiente de validación) con su documento legal',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: RegistroFundacionMultipartDto })
  @ApiCreatedResponse({ type: RegistroFundacionRespuestaDto })
  registrarFundacion(
    @Body() dto: RegistroFundacionDto,
    @UploadedFile() documento: Express.Multer.File | undefined,
  ): Promise<RegistroFundacionRespuestaDto> {
    return this.registro.registrarFundacion(dto, documento);
  }

  @Public()
  @Get('verify-email')
  @ApiOperation({ summary: 'Verifica el correo con el token recibido por email' })
  @ApiOkResponse({ type: MensajeDto })
  verificarCorreo(@Query() query: VerificarCorreoQueryDto): Promise<MensajeDto> {
    return this.verificacion.verificar(query.token);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: MINUTO_MS } })
  @Post('verify-email/resend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reenvía el enlace de verificación (siempre responde lo mismo)' })
  @ApiOkResponse({ type: MensajeDto })
  reenviarVerificacion(@Body() dto: ReenviarVerificacionDto): Promise<MensajeDto> {
    return this.verificacion.reenviar(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: MINUTO_MS } })
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Envía un código de recuperación por correo (siempre responde lo mismo)',
  })
  @ApiOkResponse({ type: MensajeDto })
  solicitarRecuperacion(@Body() dto: SolicitarRecuperacionDto): Promise<MensajeDto> {
    return this.recuperacion.solicitar(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: MINUTO_MS } })
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cambia la contraseña con el código recibido por correo y cierra todas las sesiones',
  })
  @ApiOkResponse({ type: MensajeDto })
  @ApiBadRequestResponse({ description: 'Código no válido o vencido, o contraseña insegura' })
  restablecerContrasena(@Body() dto: RestablecerContrasenaDto): Promise<MensajeDto> {
    return this.recuperacion.restablecer(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: MINUTO_MS } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Inicia sesión: devuelve el access token y deja el refresh token en una cookie httpOnly',
  })
  @ApiOkResponse({ type: SesionRespuestaDto })
  @ApiUnauthorizedResponse({ description: 'Correo o contraseña incorrectos' })
  async iniciarSesion(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SesionRespuestaDto> {
    return this.entregar(res, await this.login.iniciarSesion(dto));
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: MINUTO_MS } })
  @Post('refresh')
  @HttpCode(200)
  @ApiCookieAuth(NOMBRE_COOKIE_REFRESH)
  @ApiOperation({ summary: 'Rota el refresh token (cookie) y devuelve un nuevo access token' })
  @ApiOkResponse({ type: SesionRespuestaDto })
  async renovar(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SesionRespuestaDto> {
    const token = leerCookie(req.headers.cookie, NOMBRE_COOKIE_REFRESH);
    try {
      if (!token) throw new UnauthorizedException(MENSAJE_SESION_NO_VALIDA);
      return this.entregar(res, await this.sesion.renovar(token));
    } catch (error) {
      borrarCookieRefresh(res, this.cookieSegura());
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiCookieAuth(NOMBRE_COOKIE_REFRESH)
  @ApiOperation({ summary: 'Revoca el refresh token de la cookie y la borra' })
  @ApiNoContentResponse()
  async cerrarSesion(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = leerCookie(req.headers.cookie, NOMBRE_COOKIE_REFRESH);
    if (token) await this.sesion.revocar(token);
    borrarCookieRefresh(res, this.cookieSegura());
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil del usuario autenticado (incluye el estado de su fundación)' })
  @ApiOkResponse({ type: UsuarioPerfilDto })
  obtenerPerfil(@CurrentUser() usuario: UsuarioAutenticado): Promise<UsuarioPerfilDto> {
    return this.perfil.obtener(usuario.id);
  }

  private entregar(res: Response, sesion: SesionEmitida): SesionRespuestaDto {
    escribirCookieRefresh(res, sesion.refreshToken, this.cookieSegura(), sesion.refreshVigenciaMs);
    return sesion.respuesta;
  }

  private cookieSegura(): boolean {
    return cookieSegura({
      COOKIE_SECURE: this.config.get('COOKIE_SECURE', { infer: true }),
      NODE_ENV: this.config.get('NODE_ENV', { infer: true }),
    });
  }
}
