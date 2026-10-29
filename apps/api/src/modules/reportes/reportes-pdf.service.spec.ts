import { NotFoundException } from '@nestjs/common';
import { PdfService } from './pdf/pdf.service';
import { ReportesPdfService } from './reportes-pdf.service';

const FICHA = {
  id: 7,
  nombre: 'Peñita',
  especie: 'perro',
  raza: 'Mestizo',
  sexo: 'hembra',
  edadMeses: 27,
  tamano: 'pequeño',
  color: 'Café',
  esterilizado: true,
  vacunado: true,
  estadoSalud: 'Sano',
  descripcion: 'Cariñosa',
  fundacion: { id: 2, nombre: 'Patitas', ciudad: 'Montería', descripcion: null },
  fotos: [],
  historial: [],
};

function crear() {
  const catalogo = { obtenerFicha: jest.fn() };
  const fotoFicha = { leerPrincipal: jest.fn().mockResolvedValue(null) };
  const reloj = { ahora: () => new Date('2026-10-29T15:00:00Z') };
  const manager = { id: 'snapshot' };
  const eventos: string[] = [];
  const instantanea = {
    leer: jest.fn(async (fn: (m: unknown) => Promise<unknown>) => {
      const r = await fn(manager);
      eventos.push('instantanea cerrada');
      return r;
    }),
  };
  const repo = {
    listarSolicitudes: jest.fn().mockResolvedValue([]),
    contarSolicitudes: jest.fn().mockResolvedValue(0),
    listarSeguimientos: jest.fn().mockResolvedValue([]),
    contarSeguimientos: jest.fn().mockResolvedValue(0),
    listarDonaciones: jest.fn().mockResolvedValue([]),
    totalesDonaciones: jest.fn().mockResolvedValue([]),
  };
  const pdf = new PdfService();
  const generar = pdf.generar.bind(pdf);
  jest.spyOn(pdf, 'generar').mockImplementation((def) => {
    eventos.push('renderizado');
    return generar(def);
  });
  const service = new ReportesPdfService(
    pdf,
    reloj as never,
    instantanea as never,
    repo as never,
    catalogo as never,
    fotoFicha as never,
  );
  return { service, catalogo, fotoFicha, repo, manager, eventos, pdf };
}

const esPdf = (b: Buffer): boolean => b.subarray(0, 5).toString('latin1') === '%PDF-';

describe('ReportesPdfService.fichaMascota', () => {
  it('genera un PDF real con la ficha del catálogo', async () => {
    const { service, catalogo, fotoFicha } = crear();
    catalogo.obtenerFicha.mockResolvedValue(FICHA);
    expect(esPdf(await service.fichaMascota(7))).toBe(true);
    expect(catalogo.obtenerFicha).toHaveBeenCalledWith(7);
    expect(fotoFicha.leerPrincipal).toHaveBeenCalledWith(7);
  });

  it('una mascota no visible es 404 y no lee la foto ni genera nada', async () => {
    const { service, catalogo, fotoFicha, pdf } = crear();
    catalogo.obtenerFicha.mockRejectedValue(new NotFoundException('No existe'));
    await expect(service.fichaMascota(9)).rejects.toThrow(NotFoundException);
    expect(fotoFicha.leerPrincipal).not.toHaveBeenCalled();
    expect(pdf.generar).not.toHaveBeenCalled();
  });
});

describe('reportes de fundación', () => {
  it('solicitudes: filtra por la fundación y el estado, con tope de 1000 y la misma instantánea; PDF válido sin filas', async () => {
    const { service, repo, manager, eventos } = crear();
    const pdf = await service.solicitudes(4, { estado: 'pendiente', desde: '2026-10-01' } as never);
    expect(esPdf(pdf)).toBe(true);
    const [filtro, estado, limite, m] = repo.listarSolicitudes.mock.calls[0];
    expect(filtro).toMatchObject({ fundacionId: 4, desde: '2026-10-01' });
    expect([estado, limite, m]).toEqual(['pendiente', 1000, manager]);
    expect(repo.contarSolicitudes.mock.calls[0][2]).toBe(manager);
    // La instantánea se cierra antes de renderizar.
    expect(eventos).toEqual(['instantanea cerrada', 'renderizado']);
  });

  it('seguimientos: usa el día de hoy en Bogotá para calcular los vencidos', async () => {
    const { service, repo } = crear();
    await service.seguimientos(4, { estado: 'vencido' } as never);
    expect(repo.listarSeguimientos.mock.calls[0].slice(1, 4)).toEqual([
      'vencido',
      '2026-10-29',
      1000,
    ]);
    expect(repo.contarSeguimientos.mock.calls[0].slice(1, 3)).toEqual(['vencido', '2026-10-29']);
  });

  it('donaciones: la fundación es la del token y el total sale de los totales por tipo', async () => {
    const { service, repo } = crear();
    repo.totalesDonaciones.mockResolvedValue([
      { tipo: 'economica', cantidad: 1500, monto: '123.00' },
      { tipo: 'especie', cantidad: 10, monto: '0.00' },
    ]);
    repo.listarDonaciones.mockResolvedValue([
      {
        fecha: '2026-10-01',
        donante: 'Ana',
        tipo: 'economica',
        monto: '123.00',
        descripcion: null,
      },
    ]);
    const pdf = await service.donaciones(4, { tipo: 'economica' } as never);
    expect(esPdf(pdf)).toBe(true);
    expect(repo.listarDonaciones.mock.calls[0].slice(0, 4)).toEqual([
      4,
      expect.anything(),
      'economica',
      1000,
    ]);
  });

  it('un rango invertido es 400 antes de consultar', async () => {
    const { service, repo } = crear();
    await expect(
      service.solicitudes(4, { desde: '2026-10-05', hasta: '2026-10-01' } as never),
    ).rejects.toThrow('La fecha final no puede ser anterior a la inicial');
    expect(repo.listarSolicitudes).not.toHaveBeenCalled();
  });
});
