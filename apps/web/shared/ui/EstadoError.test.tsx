import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorApi, MENSAJES } from '@/shared/api/errores';
import { MENSAJE_LIMITE } from '@/shared/lib/errores-usuario';
import { EstadoError } from './EstadoError';

describe('EstadoError', () => {
  it('sin error mantiene el texto de conexión', () => {
    render(<EstadoError alReintentar={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa tu conexión');
  });

  it('traduce el error según su causa, sin texto técnico', () => {
    const { rerender } = render(
      <EstadoError
        error={new ErrorApi({ tipo: 'http', estado: 429, mensaje: 'Too Many Requests' })}
        alReintentar={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAJE_LIMITE);
    rerender(
      <EstadoError
        error={new ErrorApi({ tipo: 'http', estado: 503, mensaje: 'Service Unavailable' })}
        alReintentar={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAJES.servidor);
    expect(screen.getByRole('alert')).not.toHaveTextContent(/unavailable/i);
  });
});
