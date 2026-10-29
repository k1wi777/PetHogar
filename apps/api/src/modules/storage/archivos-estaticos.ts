import * as path from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';

/** Sirve solo `<uploads>/publico` bajo `/uploads`; `<uploads>/privado` queda fuera del servido. */
export function servirArchivosPublicos(app: NestExpressApplication, directorio: string): void {
  app.useStaticAssets(path.resolve(directorio, 'publico'), {
    prefix: '/uploads',
    index: false,
    dotfiles: 'deny',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // helmet fija same-origin y el navegador bloquearía las imágenes cargadas desde la web.
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });
}
