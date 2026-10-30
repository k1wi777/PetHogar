'use client';

import { useState } from 'react';
import { Boton } from '@/shared/ui/Boton';
import { Campo, Entrada } from '@/shared/ui/Campo';
import { Selector } from '@/shared/ui/Selector';
import { esquemaFiltrosUsuarios, MAX_BUSQUEDA } from '../schemas/filtros';
import { ETIQUETA_ROL, ROLES, type ConsultaUsuarios, type RolUsuario } from '../types';

const TODOS = 'todos';
const OPCIONES_ROL = [
  { valor: TODOS, texto: 'Todos los roles' },
  ...ROLES.map((r) => ({ valor: r, texto: ETIQUETA_ROL[r] })),
];

/**
 * Búsqueda por nombre, correo y rol. Valida antes de cambiar la URL; se vuelve a montar (por
 * `key`) cuando cambia la URL.
 */
export function FiltroUsuarios({
  consulta,
  alAplicar,
}: {
  consulta: ConsultaUsuarios;
  alAplicar: (siguiente: ConsultaUsuarios) => void;
}) {
  const [nombre, setNombre] = useState(consulta.nombre ?? '');
  const [correo, setCorreo] = useState(consulta.correo ?? '');
  const [rol, setRol] = useState<RolUsuario | undefined>(consulta.rol);
  const [errores, setErrores] = useState<{ nombre?: string; correo?: string }>({});

  function aplicar(e: React.FormEvent) {
    e.preventDefault();
    const r = esquemaFiltrosUsuarios.safeParse({ nombre, correo, rol });
    if (!r.success) {
      const siguiente: { nombre?: string; correo?: string } = {};
      for (const i of r.error.issues) {
        const campo = i.path[0] as 'nombre' | 'correo';
        siguiente[campo] ??= i.message;
      }
      setErrores(siguiente);
      return;
    }
    setErrores({});
    alAplicar({
      pagina: 1,
      nombre: r.data.nombre || undefined,
      correo: r.data.correo || undefined,
      rol: r.data.rol,
    });
  }

  return (
    <form
      noValidate
      onSubmit={aplicar}
      aria-label="Buscar usuarios"
      className="border-border-suave bg-card flex flex-col gap-4 rounded-lg border p-4"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etiqueta="Nombre" error={errores.nombre}>
          <Entrada
            value={nombre}
            maxLength={MAX_BUSQUEDA + 20}
            onChange={(e) => setNombre(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Correo" error={errores.correo}>
          <Entrada
            type="search"
            value={correo}
            maxLength={MAX_BUSQUEDA + 20}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Rol">
          <Selector
            opciones={OPCIONES_ROL}
            valor={rol ?? TODOS}
            onCambio={(v) => setRol(v === TODOS ? undefined : (v as RolUsuario))}
          />
        </Campo>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Boton type="submit" className="w-full sm:w-auto">
          Buscar
        </Boton>
        <Boton
          variante="contorno"
          onClick={() => alAplicar({ pagina: 1 })}
          className="w-full sm:w-auto"
        >
          Quitar filtros
        </Boton>
      </div>
    </form>
  );
}
