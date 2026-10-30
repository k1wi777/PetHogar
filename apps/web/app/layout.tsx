import type { Metadata } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

const fuenteTitulo = localFont({
  src: '../shared/fonts/nunito-latin-wght-normal.woff2',
  weight: '200 1000',
  variable: '--font-titulo',
  display: 'swap',
  fallback: ['ui-rounded', 'system-ui', 'Segoe UI', 'sans-serif'],
});

const fuenteTexto = localFont({
  src: '../shared/fonts/inter-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-texto',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'PetHogar',
  description: 'Plataforma de adopción de mascotas',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" className={`${fuenteTitulo.variable} ${fuenteTexto.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
