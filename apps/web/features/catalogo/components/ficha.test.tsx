import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fichaEjemplo } from '../prueba-datos';
import { DatosMascota } from './DatosMascota';
import { FundacionResponsable } from './FundacionResponsable';
import { GaleriaFotos } from './GaleriaFotos';
import { HistorialMedico } from './HistorialMedico';

describe('GaleriaFotos', () => {
  it('muestra las fotos en orden con alt descriptivo y usa la miniatura si falta la grande', () => {
    const f = fichaEjemplo();
    render(<GaleriaFotos fotos={f.fotos} nombre="Luna" especie="perro" />);
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute('alt', 'Foto 1 de 2 de Luna, perro');
    expect(imgs[0].getAttribute('src')).toContain('a.webp');
    expect(imgs[1].getAttribute('src')).toContain('b-m.webp');
  });

  it('con una sola foto el alt no numera', () => {
    render(<GaleriaFotos fotos={[fichaEjemplo().fotos[0]]} nombre="Luna" especie="perro" />);
    expect(screen.getByAltText('Foto de Luna, perro')).toBeInTheDocument();
  });

  it('sin fotos (o sin URL pública) muestra un marcador accesible', () => {
    render(
      <GaleriaFotos
        fotos={[{ id: 1, esPrincipal: true, urlCatalogo: null, url: null }]}
        nombre="Luna"
        especie="perro"
      />,
    );
    expect(screen.getByRole('img', { name: 'Luna aún no tiene fotos' })).toBeInTheDocument();
  });
});

describe('DatosMascota', () => {
  it('muestra datos, salud y descripción', () => {
    render(<DatosMascota ficha={fichaEjemplo()} />);
    expect(screen.getByText('Cariñosa y juguetona.')).toBeInTheDocument();
    expect(screen.getByText('2 años y 6 meses')).toBeInTheDocument();
    expect(screen.getByText('Hembra')).toBeInTheDocument();
    expect(screen.getByText('Mediano')).toBeInTheDocument();
    expect(screen.getByText('Café')).toBeInTheDocument();
    const salud = screen.getByRole('region', { name: 'Salud' });
    expect(within(salud).getByText('Saludable')).toBeInTheDocument();
    expect(within(salud).getByText('Vacunado').nextSibling).toHaveTextContent('No');
    expect(within(salud).getByText('Esterilizado').nextSibling).toHaveTextContent('Sí');
  });
});

describe('HistorialMedico', () => {
  it('lista los eventos tal como llegan (reciente primero) con fecha legible', () => {
    render(<HistorialMedico eventos={fichaEjemplo().historial} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Cirugía · 5 de marzo de 2026');
    expect(items[0]).toHaveTextContent('Atendido por Dra. Pérez');
    expect(items[1]).toHaveTextContent('Vacuna');
    expect(items[1]).not.toHaveTextContent('Atendido por');
  });

  it('sin eventos lo dice', () => {
    render(<HistorialMedico eventos={[]} />);
    expect(screen.getByText('Todavía no hay registros médicos.')).toBeInTheDocument();
  });
});

describe('FundacionResponsable', () => {
  it('muestra solo nombre, ciudad y descripción', () => {
    const { container } = render(<FundacionResponsable fundacion={fichaEjemplo().fundacion} />);
    expect(screen.getByText('Huellitas')).toBeInTheDocument();
    expect(screen.getByText('Montería')).toBeInTheDocument();
    expect(screen.getByText('Rescatamos animales.')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/@|NIT|teléfono/i);
  });
});
