import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, useWatch } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampoDocumento } from './CampoDocumento';

function DocumentoPrueba({ alCambiar }: { alCambiar?: (f: File | undefined) => void }) {
  const { control } = useForm<{ documento?: File }>();
  const valor = useWatch({ control, name: 'documento' });
  alCambiar?.(valor);
  return <CampoDocumento control={control} nombre="documento" etiqueta="Documento legal" />;
}

describe('CampoDocumento', () => {
  const crear = vi.fn(() => 'blob:vista-1');
  const revocar = vi.fn();
  beforeEach(() => {
    crear.mockClear();
    revocar.mockClear();
    URL.createObjectURL = crear;
    URL.revokeObjectURL = revocar;
  });
  afterEach(() => vi.restoreAllMocks());

  it('rechaza un tipo no permitido con mensaje y no deja archivo seleccionado', async () => {
    const valores: Array<File | undefined> = [];
    render(<DocumentoPrueba alCambiar={(f) => valores.push(f)} />);
    const entrada = screen.getByLabelText(/Documento legal/);
    await userEvent.upload(entrada, new File(['x'], 'a.gif', { type: 'image/gif' }), {
      applyAccept: false,
    });
    expect(await screen.findByText('Solo se permiten archivos JPG, PNG o PDF')).toBeInTheDocument();
    expect(valores.at(-1)).toBeUndefined();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('rechaza un archivo de más de 5 MB', async () => {
    render(<DocumentoPrueba />);
    const grande = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText(/Documento legal/), grande);
    expect(
      await screen.findByText('El archivo supera el tamaño máximo de 5 MB'),
    ).toBeInTheDocument();
  });

  it('previsualiza una imagen, muestra nombre y tamaño, y revoca la URL al quitarla', async () => {
    const valores: Array<File | undefined> = [];
    render(<DocumentoPrueba alCambiar={(f) => valores.push(f)} />);
    const png = new File([new Uint8Array(2048)], 'acta.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText(/Documento legal/), png);
    const imagen = await screen.findByRole('img', { name: /acta\.png/ });
    expect(imagen).toHaveAttribute('src', 'blob:vista-1');
    expect(screen.getByText('2 KB')).toBeInTheDocument();
    expect(valores.at(-1)).toBe(png);

    await userEvent.click(screen.getByRole('button', { name: /Quitar documento/ }));
    expect(revocar).toHaveBeenCalledWith('blob:vista-1');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(valores.at(-1)).toBeUndefined();
  });

  it('un PDF se muestra como ficha, sin incrustarlo', async () => {
    render(<DocumentoPrueba />);
    await userEvent.upload(
      screen.getByLabelText(/Documento legal/),
      new File(['%PDF'], 'camara.pdf', { type: 'application/pdf' }),
    );
    expect(await screen.findByText('camara.pdf')).toBeInTheDocument();
    expect(crear).not.toHaveBeenCalled();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('reemplazar libera la URL anterior', async () => {
    render(<DocumentoPrueba />);
    const entrada = screen.getByLabelText(/Documento legal/);
    await userEvent.upload(entrada, new File(['a'], 'uno.png', { type: 'image/png' }));
    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    await userEvent.upload(entrada, new File(['b'], 'dos.png', { type: 'image/png' }));
    await waitFor(() => expect(crear).toHaveBeenCalledTimes(2));
    expect(revocar).toHaveBeenCalledWith('blob:vista-1');
  });
});
