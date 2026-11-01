import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** WCAG 2.0 y 2.1 A y AA (D4). Las reglas no se desactivan: lo que falle se corrige. */
export const ETIQUETAS_WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export interface Hallazgo {
  regla: string;
  impacto: string;
  nodos: string[];
}

export async function auditar(page: Page): Promise<Hallazgo[]> {
  const resultado = await new AxeBuilder({ page }).withTags(ETIQUETAS_WCAG).analyze();
  return resultado.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      regla: v.id,
      impacto: v.impact ?? '',
      nodos: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
    }));
}

export async function sinDesbordeHorizontal(page: Page, ancho: number): Promise<void> {
  const medidas = await page.evaluate(() => ({
    contenido: document.documentElement.scrollWidth,
    ventana: window.innerWidth,
  }));
  expect(medidas.contenido, `scrollWidth a ${ancho}px`).toBeLessThanOrEqual(medidas.ventana);
}
