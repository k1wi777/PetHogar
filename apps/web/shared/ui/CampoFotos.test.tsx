import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, useWatch } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampoFotos } from './CampoFotos';

let n = 0;
const crear = vi.fn(() => `blob:foto-${++n}`);
const revocar = vi.fn();

function Prueba({
  alCambiar,
  maximo,
}: {
  alCambiar?: (f: File[] | undefined) => void;
  maximo?: number;
}) {
  const { control } = useForm<{ fotos?: File[] }>();
  const valor = useWatch({ control, name: 'fotos' });
  alCambiar?.(valor);
  return <CampoFotos control={control} nombre="fotos" etiqueta="Fotos" maximo={maximo} />;
}

const png = (nombre: string, bytes = 100) =>
  new File([new Uint8Array(bytes)], nombre, { type: 'image/png' });
const subir = (...archivos: File[]) =>
  userEvent.upload(screen.getByLabelText('Fotos'), archivos, { applyAccept: false });

describe('CampoFotos', () => {
  beforeEach(() => {
    n = 0;
    crear.mockClear();
    revocar.mockClear();
    URL.createObjectURL = crear;
    URL.revokeObjectURL = revocar;
  });

  it('añade fotos válidas con previsualización y contador', async () => {
    const valores: Array<File[] | undefined> = [];
    render(<Prueba alCambiar={(f) => valores.push(f)} />);
    expect(screen.getByText('0 de 5 fotos')).toBeInTheDocument();
    await subir(png('a.png'), png('b.png'));
    expect(await screen.findAllByRole('img')).toHaveLength(2);
    expect(screen.getByText('2 de 5 fotos')).toBeInTheDocument();
    expect(valores.at(-1)).toHaveLength(2);
  });

  it('rechaza PDF, tipos ajenos, vacíos y de más de 5 MB sin añadirlos', async () => {
    render(<Prueba />);
    await subir(new File(['%PDF'], 'a.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText(/a\.pdf: Solo se permiten fotos JPG o PNG/)).toBeInTheDocument();
    await subir(png('grande.png', 5 * 1024 * 1024 + 1));
    expect(await screen.findByText(/grande\.png: El archivo supera/)).toBeInTheDocument();
    await subir(png('vacia.png', 0));
    expect(await screen.findByText(/vacia\.png: El archivo está vacío/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('0 de 5 fotos')).toBeInTheDocument();
  });

  it('no deja añadir la sexta foto y lo explica', async () => {
    render(<Prueba />);
    await subir(png('1.png'), png('2.png'), png('3.png'), png('4.png'), png('5.png'), png('6.png'));
    expect(await screen.findByText(/hasta 5 fotos/)).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(5);
    expect(screen.getByLabelText('Fotos')).toBeDisabled();
  });

  it('quitar una foto libera su URL y actualiza el valor', async () => {
    const valores: Array<File[] | undefined> = [];
    render(<Prueba alCambiar={(f) => valores.push(f)} />);
    await subir(png('a.png'), png('b.png'));
    await screen.findAllByRole('img');
    await userEvent.click(screen.getByRole('button', { name: 'Quitar la foto a.png' }));
    expect(revocar).toHaveBeenCalledWith('blob:foto-1');
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1));
    expect(valores.at(-1)?.map((f) => f.name)).toEqual(['b.png']);
    expect(screen.getByText('1 de 5 fotos')).toBeInTheDocument();
  });

  it('libera todas las URL al desmontar', async () => {
    const { unmount } = render(<Prueba />);
    await subir(png('a.png'), png('b.png'));
    await screen.findAllByRole('img');
    unmount();
    expect(revocar).toHaveBeenCalledWith('blob:foto-1');
    expect(revocar).toHaveBeenCalledWith('blob:foto-2');
  });
});
