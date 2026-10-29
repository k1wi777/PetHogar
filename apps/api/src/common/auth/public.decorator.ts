import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICA = 'esPublica';

/** Marca una ruta (o un controller) como accesible sin access token. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(ES_PUBLICA, true);
