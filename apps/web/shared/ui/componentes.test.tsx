import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BadgeEstado } from './BadgeEstado';
import { Boton } from './Boton';
import { Campo, Entrada } from './Campo';
import { DialogoConfirmacion } from './DialogoConfirmacion';
import { EstadoVacio } from './EstadoVacio';
import { Paginacion } from './Paginacion';
import { Selector } from './Selector';
import { Skeleton } from './Skeleton';

describe('Campo', () => {
  it('asocia la etiqueta, la ayuda y el error al control', () => {
    render(
      <Campo
        etiqueta="Correo"
        ayuda="Usaremos este correo"
        error="Escribe un correo válido"
        requerido
      >
        <Entrada />
      </Campo>,
    );
    const entrada = screen.getByLabelText(/Correo/);
    expect(entrada).toHaveAttribute('aria-invalid', 'true');
    expect(entrada).toHaveAccessibleDescription(/Usaremos este correo/);
    expect(entrada).toHaveAccessibleDescription(/Escribe un correo válido/);
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe un correo válido');
  });

  it('sin error no marca el control como inválido', () => {
    render(
      <Campo etiqueta="Nombre">
        <Entrada />
      </Campo>,
    );
    expect(screen.getByLabelText('Nombre')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('DialogoConfirmacion', () => {
  function Prueba({ onConfirmar }: { onConfirmar: () => void }) {
    const [abierto, setAbierto] = useState(false);
    return (
      <>
        <Boton onClick={() => setAbierto(true)}>Abrir</Boton>
        <DialogoConfirmacion
          abierto={abierto}
          onAbiertoChange={setAbierto}
          titulo="¿Seguro?"
          descripcion="Esta acción no se puede deshacer"
          textoConfirmar="Sí, continuar"
          destructivo
          onConfirmar={onConfirmar}
        />
      </>
    );
  }

  it('atrapa el foco y Escape cierra sin confirmar', async () => {
    const usuario = userEvent.setup();
    const onConfirmar = vi.fn();
    render(<Prueba onConfirmar={onConfirmar} />);
    await usuario.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialogo = await screen.findByRole('dialog', { name: '¿Seguro?' });
    expect(dialogo).toHaveAccessibleDescription('Esta acción no se puede deshacer');
    for (let i = 0; i < 6; i++) {
      await usuario.tab();
      expect(dialogo).toContainElement(document.activeElement as HTMLElement);
    }
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it('Cancelar no ejecuta y Confirmar sí, con el teclado', async () => {
    const usuario = userEvent.setup();
    const onConfirmar = vi.fn();
    render(<Prueba onConfirmar={onConfirmar} />);
    await usuario.click(screen.getByRole('button', { name: 'Abrir' }));
    await usuario.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(onConfirmar).not.toHaveBeenCalled();
    await usuario.click(screen.getByRole('button', { name: 'Abrir' }));
    const confirmar = await screen.findByRole('button', { name: 'Sí, continuar' });
    confirmar.focus();
    await usuario.keyboard('{Enter}');
    expect(onConfirmar).toHaveBeenCalledTimes(1);
  });
});

describe('Selector', () => {
  it('se opera con teclado y notifica el valor', async () => {
    const usuario = userEvent.setup();
    const onCambio = vi.fn();
    render(
      <Campo etiqueta="Especie">
        <Selector
          opciones={[
            { valor: 'perro', texto: 'Perro' },
            { valor: 'gato', texto: 'Gato' },
          ]}
          onCambio={onCambio}
        />
      </Campo>,
    );
    const combo = screen.getByRole('combobox', { name: 'Especie' });
    combo.focus();
    await usuario.keyboard('{Enter}');
    const lista = await screen.findByRole('listbox');
    expect(within(lista).getAllByRole('option')).toHaveLength(2);
    await usuario.keyboard('{ArrowDown}{Enter}');
    expect(onCambio).toHaveBeenCalledWith('gato');
  });
});

describe('Paginacion', () => {
  it('deshabilita los extremos y cambia de página con teclado', async () => {
    const usuario = userEvent.setup();
    const onCambio = vi.fn();
    const { rerender } = render(
      <Paginacion pagina={1} limite={10} total={25} onCambio={onCambio} />,
    );
    expect(screen.getByRole('navigation', { name: 'Paginación' })).toBeInTheDocument();
    expect(screen.getByText(/Página 1 de 3/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Anterior/ })).toBeDisabled();
    screen.getByRole('button', { name: /Siguiente/ }).focus();
    await usuario.keyboard('{Enter}');
    expect(onCambio).toHaveBeenCalledWith(2);
    rerender(<Paginacion pagina={3} limite={10} total={25} onCambio={onCambio} />);
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeDisabled();
  });

  it('con total 0 muestra una sola página', () => {
    render(<Paginacion pagina={1} limite={10} total={0} onCambio={() => {}} />);
    expect(screen.getByText(/Página 1 de 1 · 0 resultados/)).toBeInTheDocument();
  });
});

describe('BadgeEstado, Skeleton, EstadoVacio y Boton', () => {
  it('el badge comunica el estado con texto en español', () => {
    render(<BadgeEstado estado="en_proceso" />);
    expect(screen.getByText('En proceso')).toBeInTheDocument();
  });

  it('el skeleton anuncia la carga', () => {
    render(<Skeleton />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando');
  });

  it('el estado vacío muestra título, descripción y acción', () => {
    render(
      <EstadoVacio
        titulo="Sin mascotas"
        descripcion="Aún no hay"
        accion={<Boton>Publicar</Boton>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Sin mascotas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument();
  });

  it('un botón cargando queda deshabilitado y ocupado', () => {
    render(<Boton cargando>Guardar</Boton>);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('aria-busy', 'true');
  });
});
