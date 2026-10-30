'use client';

import { Hourglass } from 'lucide-react';
import { useState } from 'react';
import { useSesion } from '@/shared/auth/SesionProvider';
import { Boton } from '@/shared/ui/Boton';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';

/**
 * Estado claro cuando la fundación no está aprobada: el motivo y, si fue rechazada, la observación
 * del administrador (texto, nunca HTML). `mensajeServidor` es el 403 recibido a mitad de sesión.
 */
export function AvisoFundacionNoAprobada({ mensajeServidor }: { mensajeServidor?: string }) {
  const { usuario, refrescarPerfil } = useSesion();
  const [actualizando, setActualizando] = useState(false);
  const fundacion = usuario?.fundacion;
  const rechazada = fundacion?.estadoValidacion === 'rechazada';
  const observacion = fundacion?.observacionValidacion?.trim();

  let descripcion: string;
  if (rechazada) {
    descripcion = observacion
      ? `Observación del administrador: ${observacion}`
      : 'Comunícate con un administrador de PetHogar para más información.';
  } else if (fundacion?.estadoValidacion === 'pendiente') {
    descripcion =
      'Un administrador la revisará y te avisaremos. Podrás publicar y gestionar mascotas cuando sea aprobada.';
  } else {
    descripcion =
      mensajeServidor ??
      'Podrás gestionar tus mascotas cuando la validación de tu fundación esté aprobada.';
  }

  async function actualizar() {
    setActualizando(true);
    try {
      await refrescarPerfil();
    } finally {
      setActualizando(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4" role="status">
      <EstadoVacio
        icono={Hourglass}
        titulo={
          rechazada
            ? 'La validación de tu fundación fue rechazada'
            : 'Tu fundación aún no está aprobada'
        }
        descripcion={descripcion}
        accion={
          <Boton variante="contorno" onClick={actualizar} cargando={actualizando}>
            Actualizar mi estado
          </Boton>
        }
      />
      {mensajeServidor && (rechazada || fundacion?.estadoValidacion === 'pendiente') && (
        <p className="text-muted-foreground text-sm">{mensajeServidor}</p>
      )}
    </div>
  );
}
