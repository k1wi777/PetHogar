---
name: PetHogar
description: Jornada de adopción en el barrio, cálida y clara para personas no técnicas.
colors:
  background: '#fffbf9'
  foreground: '#2d1b2e'
  card: '#ffffff'
  card-foreground: '#2d1b2e'
  muted: '#f6ebf0'
  muted-foreground: '#675064'
  primary: '#86246a'
  primary-foreground: '#ffffff'
  secondary: '#fbe3ef'
  secondary-foreground: '#6a1a53'
  acento: '#ffc23d'
  acento-foreground: '#2d1b2e'
  destructive: '#b42318'
  destructive-foreground: '#ffffff'
  success: '#dcfce7'
  success-foreground: '#14532d'
  warning: '#fef3c7'
  warning-foreground: '#7c2d12'
  info: '#dbeafe'
  info-foreground: '#1e3a8a'
  neutral: '#e5e7eb'
  neutral-foreground: '#2d1b2e'
  border: '#8d7388'
  border-suave: '#ead9e2'
  ring: '#1d4ed8'
typography:
  display:
    fontFamily: 'Nunito, ui-rounded, system-ui, sans-serif'
    fontSize: 'clamp(3rem, 1.75rem + 5.5vw, 4.5rem)'
    fontWeight: 800
    lineHeight: 1
  headline:
    fontFamily: 'Nunito, ui-rounded, system-ui, sans-serif'
    fontSize: 'clamp(2rem, 1.5rem + 2vw, 3rem)'
    fontWeight: 800
    lineHeight: 1.1
  title:
    fontFamily: 'Nunito, ui-rounded, system-ui, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 800
    lineHeight: 1.2
  body:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 600
rounded:
  sm: '8px'
  md: '12px'
  lg: '20px'
  xl: '24px'
  full: '9999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '16px'
  lg: '24px'
  xl: '40px'
  2xl: '56px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-foreground}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: '8px 20px'
    height: '44px'
  button-primary-hover:
    backgroundColor: '{colors.secondary-foreground}'
  button-secondary:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.secondary-foreground}'
    rounded: '{rounded.full}'
  button-outline:
    backgroundColor: '{colors.card}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.full}'
  button-destructive:
    backgroundColor: '{colors.destructive}'
    textColor: '{colors.destructive-foreground}'
    rounded: '{rounded.full}'
  input:
    backgroundColor: '{colors.card}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
    padding: '8px 14px'
    height: '44px'
  card:
    backgroundColor: '{colors.card}'
    textColor: '{colors.card-foreground}'
    rounded: '{rounded.xl}'
    padding: '20px'
  nav-link-current:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.secondary-foreground}'
    rounded: '{rounded.full}'
  menu-item-current:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-foreground}'
    rounded: '{rounded.full}'
---

# Design System: PetHogar

## Overview

**Creative North Star: "Jornada de adopción en el barrio"**

Pañoletas de color, carteles amables y la foto del animal en grande. Las superficies que invitan
(portada, acceso, catálogo y ficha) comprometen el color en campos amplios de mango y ciruela sobre
un blanco cálido; los paneles son sobrios: neutros y ciruela, con el mango apenas en la identidad.

Hay un solo tema claro, pensado para uso diurno en el móvil por personas sin conocimientos técnicos.
La fuente única de los colores es `apps/web/shared/lib/tokens.ts`, repetida en
`apps/web/app/globals.css` (una prueba comprueba que coincidan y mide los contrastes).

**Key Characteristics:**

- Fotos de mascotas como elemento dominante.
- Formas amables: botones en píldora, campos suaves y tarjetas muy redondeadas.
- Texto oscuro ciruela, nunca gris neutro sobre fondos de color.
- Un solo momento de movimiento en la portada y un realce de foto en las tarjetas.

## Colors

Ciruela como voz, mango como campo y blanco cálido como fondo.

### Primary

- **Ciruela** (`primary` #86246a): acción principal, selección actual, enlaces y primera serie de las
  gráficas. Al pasar el puntero baja a `secondary-foreground` (#6a1a53).

### Secondary

- **Ciruela suave** (`secondary` #fbe3ef con `secondary-foreground` #6a1a53): sección actual,
  campo de «Cómo funciona», fondo de las pantallas de acceso, fundación responsable, cabeceras de
  tabla y sustituto de foto.

### Tertiary

- **Mango** (`acento` #ffc23d con `acento-foreground` #2d1b2e): campo de la portada, marca, marcos de
  foto, código de las páginas de mensaje y selección de texto.

### Neutral

- **Blanco cálido** (`background` #fffbf9), **blanco** (`card`), **rosa gris** (`muted` #f6ebf0).
- **Tinta ciruela** (`foreground` #2d1b2e) y **tinta suave** (`muted-foreground` #675064).
- **Borde de control** (`border` #8d7388, al menos 3:1) y **borde decorativo** (`border-suave`).
- **Foco** (`ring` #1d4ed8).
- Estados: `destructive`, `success`, `warning`, `info` y `neutral`, siempre acompañados de texto.

### Named Rules

**La regla del mango.** `acento` es fondo de campos; nunca es color de texto sobre claro ni sustituye
a `warning`.

**La regla de los pares.** Todo par texto/fondo nuevo se añade a `PARES_TEXTO` (4.5:1) y todo borde,
foco o serie nuevos cumplen 3:1 contra la superficie que los rodea (`PARES_NO_TEXTO`). Sobre `acento`,
el borde de control es `primary`: `border` solo alcanza 2,64:1.

## Typography

**Display Font:** Nunito variable (autoalojada), redondeada y cercana.
**Body Font:** Inter variable (autoalojada), legible en tamaños pequeños.

### Hierarchy

- **Display** (800, `text-portada`, 3rem a 4.5rem, línea 1): título de la portada y nombre de la
  mascota en la ficha.
- **Headline** (800, `text-titulo`, 2rem a 3rem, línea 1.1): títulos de las páginas públicas, de
  acceso y de mensaje. Los paneles usan tamaños fijos.
- **Title** (800, 1.25rem a 1.5rem): secciones, tarjetas, diálogos y estados.
- **Body** (400, 1rem, línea 1.6): texto corrido, con medida máxima cercana a 70 caracteres.
- **Label** (600, 1rem): etiquetas, botones y enlaces de navegación (0.875rem en la cabecera móvil).

### Named Rules

**La regla sin antetítulos.** El título carga su propio peso; no hay rótulos sobre los encabezados ni
texto en degradado. Los títulos usan `text-wrap: balance` y las cifras de tablas son tabulares.

## Layout

Contenedor centrado de 72rem (`max-w-6xl`) con 16 px de margen lateral. Ritmo en múltiplos de 4 px:
8 y 12 px dentro de un grupo, 24 px entre bloques y 40 a 80 px entre secciones.

- Portada: en `lg`, texto y grupo asimétrico de fotos (una grande y dos pequeñas); en móvil, texto,
  acciones y fotos, con la foto principal visible en la primera vista.
- Catálogo: 1, 2 (`sm`) y 3 columnas (`lg`).
- Ficha: en `lg`, foto principal grande a la izquierda y nombre, acciones y datos a la derecha.
- Acceso: tarjeta sobre campo ciruela suave; ingreso y recuperación añaden en `lg` un lateral
  decorativo con foto.
- Cabecera pública: en móvil la marca flota y los enlaces se ordenan en dos filas, sin menú oculto.
- Paneles: barra superior, menú lateral desde `md` y hoja lateral en móvil.

## Elevation & Depth

Mayormente plano, con capas de tono y dos sombras suaves teñidas con la tinta.

### Shadow Vocabulary

- **Reposo** (`shadow-sm`: `0 2px 4px rgb(45 27 46 / 0.06), 0 6px 16px -8px rgb(45 27 46 / 0.18)`):
  botón principal, tarjetas, filtros y tablas.
- **Elevada** (`shadow-lg`: `0 8px 16px -8px rgb(45 27 46 / 0.12), 0 24px 48px -16px rgb(45 27 46 / 0.28)`):
  diálogos, desplegables, fotos protagonistas y tarjeta de mascota al pasar el puntero.

## Shapes

Píldora (`rounded-full`) para botones, pestañas, opciones, insignias y navegación; 12 px
(`rounded-md`) para campos; 20 px (`rounded-lg`) para avisos, filas y bloques; 24 px (`rounded-xl`)
para tarjetas, fotos, diálogos y estados. Los marcos de foto de la portada llevan un borde blanco y
una leve inclinación en escritorio.

## Components

### Buttons

- **Shape:** píldora, mínimo 44 px de alto (56 px en «Quiero adoptar»).
- **Primary / Secondary / Outline / Destructive / Ghost:** variantes de `Boton`; cargando muestra un
  indicador y deshabilitado baja al 60 % de opacidad.
- **Focus:** contorno de 2 px de `ring` separado 2 px.

### Cards / Containers

- Fondo `card`, borde `border-suave`, radio 24 px; nunca una tarjeta dentro de otra.
- **Tarjeta de mascota:** foto 4:5 dominante, nombre grande, datos y ubicación; un único enlace que
  cubre toda la tarjeta. Sin foto, huella sobre ciruela suave.

### Inputs / Fields

- Fondo `card`, borde `border`, radio 12 px, 44 px de alto; borde ciruela al pasar el puntero y borde
  `destructive` de 2 px con error y mensaje enlazado.
- Opciones de radio en píldora; la elegida usa ciruela suave.

### Navigation

- Marca: «PetHogar» en ciruela con la huella decorativa sobre un círculo mango.
- Cabecera pública: la sección actual lleva `aria-current="page"` y píldora ciruela suave.
- Menú de panel: la opción actual es una píldora ciruela.

### Feedback

- Estados vacío y de error: tarjeta centrada con icono en círculo y acción.
- Páginas de mensaje: código en píldora mango, título y salida.

## Do's and Don'ts

### Do:

- **Do** tomar los colores de los tokens y añadir cada par nuevo a las pruebas de contraste.
- **Do** dejar que la foto domine las superficies persuasivas.
- **Do** mantener controles de al menos 44 px y el foco visible.
- **Do** animar solo dentro de `prefers-reduced-motion: no-preference`, con el estado base visible.

### Don't:

- **Don't** usar mango como color de texto sobre claro ni como aviso.
- **Don't** añadir antetítulos, texto en degradado, vidrio decorativo ni barras laterales de color
  nuevas.
- **Don't** anidar tarjetas ni repetir tarjetas iguales de icono como estructura de página.
- **Don't** presentar las fotos de demostración como mascotas en adopción.
