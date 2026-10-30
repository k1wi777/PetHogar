import { Building2 } from 'lucide-react';
import Link from 'next/link';
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
import { rutaDetalle } from '../lib/consulta';
import type { ConsultaFundaciones, ResumenFundacion } from '../types';

/** Una fundación por fila: el estado siempre en texto y un enlace «Revisar» a su detalle. */
export function ListaFundaciones({
  fundaciones,
  consulta,
}: {
  fundaciones: ResumenFundacion[];
  consulta: ConsultaFundaciones;
}) {
  if (fundaciones.length === 0) {
    return consulta.estado === 'pendiente' ? (
      <EstadoVacio
        icono={Building2}
        titulo="No hay fundaciones por validar"
        descripcion="Cuando una fundación se registre y espere tu revisión, aparecerá aquí."
      />
    ) : (
      <EstadoVacio
        icono={Building2}
        titulo="No hay fundaciones en este estado"
        descripcion="Prueba con otro estado del filtro."
      />
    );
  }
  return (
    <Tabla titulo="Fundaciones registradas">
      <TablaCabecera>
        <tr>
          <TablaTitulo>Fundación</TablaTitulo>
          <TablaTitulo>NIT</TablaTitulo>
          <TablaTitulo>Ciudad</TablaTitulo>
          <TablaTitulo>Estado</TablaTitulo>
          <TablaTitulo>Acciones</TablaTitulo>
        </tr>
      </TablaCabecera>
      <TablaCuerpo>
        {fundaciones.map((f) => (
          <TablaFila key={f.id}>
            <TablaCelda className="font-semibold break-words">{f.nombre}</TablaCelda>
            <TablaCelda className="whitespace-nowrap">{f.nit}</TablaCelda>
            <TablaCelda>{f.ciudad}</TablaCelda>
            <TablaCelda>
              <BadgeEstado estado={f.estadoValidacion} />
            </TablaCelda>
            <TablaCelda>
              <Boton comoHijo variante="contorno">
                <Link
                  href={rutaDetalle(f.id, consulta)}
                  aria-label={`Revisar la fundación ${f.nombre}`}
                >
                  Revisar
                </Link>
              </Boton>
            </TablaCelda>
          </TablaFila>
        ))}
      </TablaCuerpo>
    </Tabla>
  );
}
