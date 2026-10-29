import { PdfService } from './pdf.service';

describe('PdfService (pdfmake real, sin red)', () => {
  const servicio = new PdfService();

  it('carga pdfmake con CommonJS y genera un PDF válido con acentos y ñ', async () => {
    const pdf = await servicio.generar({
      content: [
        { svg: servicio.logoSvg, width: 40 },
        { text: 'Niño con señales de adopción: Sofía, Ángel, Óscar, ¿cómo estás?' },
      ],
    });
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(5_000);
    expect(pdf.subarray(-6).toString('latin1')).toContain('%%EOF');
  });

  it('no permite leer archivos fuera de assets ni descargar imágenes de la red', async () => {
    await expect(
      servicio.generar({ content: [{ image: '/etc/hostname', width: 10 }] }),
    ).rejects.toThrow();
    await expect(
      servicio.generar({ content: [{ image: 'https://example.com/a.png', width: 10 }] }),
    ).rejects.toThrow();
  });
});
