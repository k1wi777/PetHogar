import { Users } from 'lucide-react';
import { BadgeEstado } from '@/shared/ui/BadgeEstado';
import { Boton } from '@/shared/ui/Boton';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaFila,
  TablaTitulo,
} from '@/shared/ui/Tabla';
import { ETIQUETA_ROL, type ConsultaUsuarios, type UsuarioAdmin } from '../types';

/**
 * Una cuenta por fila con su estado siempre en texto. En la fila de la propia cuenta del
 * administrador no hay botón (se explica con texto): el servidor sigue siendo la barrera.
 */
export function TablaUsuarios({
  usuarios,
  consulta,
  idPropio,
  alCambiar,
  alQuitarFiltros,
}: {
  usuarios: UsuarioAdmin[];
  consulta: ConsultaUsuarios;
  idPropio: number | undefined;
  alCambiar: (usuario: UsuarioAdmin, activo: boolean) => void;
  alQuitarFiltros: () => void;
}) {
  if (usuarios.length === 0) {
    return consulta.nombre || consulta.correo || consulta.rol ? (
      <EstadoVacio
        icono={Users}
        titulo="No encontramos usuarios con esa búsqueda"
        descripcion="Prueba con otro nombre, otro correo u otro rol, o muestra todos los usuarios."
        accion={
          <Boton variante="contorno" onClick={alQuitarFiltros}>
            Quitar filtros
          </Boton>
        }
      />
    ) : (
      <EstadoVacio icono={Users} titulo="Aún no hay usuarios registrados" />
    );
  }
  return (
    <Tabla titulo="Cuentas de la plataforma">
      <TablaCabecera>
        <tr>
          <TablaTitulo>Nombre</TablaTitulo>
          <TablaTitulo>Correo</TablaTitulo>
          <TablaTitulo>Rol</TablaTitulo>
          <TablaTitulo>Estado</TablaTitulo>
          <TablaTitulo>Acciones</TablaTitulo>
        </tr>
      </TablaCabecera>
      <TablaCuerpo>
        {usuarios.map((u) => {
          const propia = u.id === idPropio;
          const quien = u.nombre ?? u.email;
          return (
            <TablaFila key={u.id}>
              <TablaCelda className="font-semibold break-words">{u.nombre ?? '—'}</TablaCelda>
              <TablaCelda className="break-all">{u.email}</TablaCelda>
              <TablaCelda>{ETIQUETA_ROL[u.rol]}</TablaCelda>
              <TablaCelda>
                <BadgeEstado estado={u.activo ? 'activa' : 'desactivada'} />
              </TablaCelda>
              <TablaCelda>
                {propia ? (
                  <span className="text-muted-foreground">Es tu cuenta</span>
                ) : u.activo ? (
                  <Boton
                    variante="contorno"
                    onClick={() => alCambiar(u, false)}
                    aria-label={`Desactivar la cuenta de ${quien}`}
                  >
                    Desactivar
                  </Boton>
                ) : (
                  <Boton
                    variante="contorno"
                    onClick={() => alCambiar(u, true)}
                    aria-label={`Activar la cuenta de ${quien}`}
                  >
                    Activar
                  </Boton>
                )}
              </TablaCelda>
            </TablaFila>
          );
        })}
      </TablaCuerpo>
    </Tabla>
  );
}
