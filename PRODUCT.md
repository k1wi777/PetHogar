# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Fundaciones y refugios** (usuario principal, uso frecuente): gestionan las fichas de sus
  mascotas y el historial médico, evalúan solicitudes de adopción, programan y registran
  seguimientos, registran donaciones y generan sus reportes.
- **Adoptantes** (usuarios secundarios): personas sin conocimientos técnicos que buscan una
  mascota, envían solicitudes y reportes de seguimiento, registran donaciones y consultan sus
  notificaciones.
- **Administrador de la plataforma**: valida fundaciones, gestiona cuentas y consulta estadísticas
  globales.
- Contexto: proyecto académico de la Universidad de Córdoba (2026).

## Product Purpose

PetHogar centraliza la adopción de mascotas en fundaciones y refugios: publicación de animales con
historial médico, solicitudes de adopción con criterios uniformes, seguimiento post-adopción con
alertas, registro de donaciones y reportes en PDF y gráficas. Sustituye la gestión dispersa en redes
sociales, mensajería, papel y hojas de cálculo.

## Positioning

La adopción completa en un solo lugar: cada mascota se publica con su historial médico, todas las
solicitudes se evalúan con los mismos criterios, cada aprobación o rechazo queda registrado con su
observación y la adaptación se acompaña con visitas y reportes.

## Operating Context

- Flujo: la fundación se registra y la valida un administrador; publica mascotas; el adoptante las
  busca, envía su solicitud con un formulario adjunto y la fundación decide; la adopción tiene
  seguimientos programados.
- Funciona en local (Docker Compose con PostgreSQL y Mailpit); no hay despliegue a producción en
  esta etapa.
- Interfaz en español, con los términos del dominio del ERS (mascota, solicitud, adopción,
  seguimiento, donación, fundación).

## Capabilities and Constraints

- Las donaciones solo se registran con su comprobante: no hay pasarela de pagos.
- Roles con acceso separado: adoptante, fundación y administrador.
- Privacidad: datos personales conforme a la Ley 1581 de 2012.
- Mensajes claros en español y confirmaciones explícitas; nunca texto técnico para el usuario.

## Brand Commitments

- Nombre: «PetHogar», como logotipo de texto con el icono de huella de la biblioteca de iconos del
  proyecto (supuesto aprobado: no existe logotipo, color ni fotografía propia que conservar).
- Carácter cálido y cercano: colores cálidos, fotos de mascotas protagonistas y formas amables.

## Evidence on Hand

- Fotos de demostración con licencia libre, con autor y origen en
  `apps/api/src/database/seeds/assets/LICENCIAS.md` y, para las publicadas en la portada, en
  `apps/web/public/portada/LICENCIAS.md`. No representan animales reales de una fundación.
- No hay testimonios, cifras de adopciones, clientes, prensa ni logotipo: no se deben inventar.

## Product Principles

- Simplicidad para personas no técnicas.
- Trazabilidad de las decisiones; las operaciones críticas son atómicas.
- Privacidad y seguridad.
- Funciona en local primero.
- Modularidad.

## Accessibility & Inclusion

WCAG 2.1 AA: contraste suficiente, uso completo con teclado, foco visible, nombres accesibles,
controles táctiles cómodos y respeto de la preferencia de movimiento reducido.
