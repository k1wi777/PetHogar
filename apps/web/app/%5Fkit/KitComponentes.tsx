'use client';

import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { ESTADOS, BadgeEstado } from '@/shared/ui/BadgeEstado';
import { Boton } from '@/shared/ui/Boton';
import { Campo, Entrada } from '@/shared/ui/Campo';
import { DialogoConfirmacion } from '@/shared/ui/DialogoConfirmacion';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import { Paginacion } from '@/shared/ui/Paginacion';
import { Selector } from '@/shared/ui/Selector';
import { Skeleton } from '@/shared/ui/Skeleton';
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaFila,
  TablaTitulo,
} from '@/shared/ui/Tabla';
import { TarjetaMascota } from '@/shared/ui/TarjetaMascota';
import { aviso } from '@/shared/ui/Toaster';

function Seccion({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="font-heading text-2xl font-bold">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export function KitComponentes() {
  const [dialogo, setDialogo] = useState(false);
  const [dialogoDestructivo, setDialogoDestructivo] = useState(false);
  const [pagina, setPagina] = useState(2);
  const [especie, setEspecie] = useState<string>();

  return (
    <main id="contenido" className="mx-auto flex max-w-4xl flex-col gap-10 p-6">
      <h1 className="text-3xl">Catálogo de componentes</h1>
      <p className="text-muted-foreground">
        Solo visible en desarrollo. Se puede recorrer con el teclado.
      </p>

      <Seccion id="k-botones" titulo="Botones">
        <div className="flex flex-wrap gap-3">
          <Boton>Primario</Boton>
          <Boton variante="secundario">Secundario</Boton>
          <Boton variante="contorno">Contorno</Boton>
          <Boton variante="destructivo">Destructivo</Boton>
          <Boton variante="fantasma">Fantasma</Boton>
          <Boton cargando>Guardando</Boton>
          <Boton disabled>Deshabilitado</Boton>
        </div>
      </Seccion>

      <Seccion id="k-campos" titulo="Campos y selector">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Correo electrónico" ayuda="Lo usaremos para avisarte" requerido>
            <Entrada type="email" />
          </Campo>
          <Campo etiqueta="Nombre" error="El nombre es obligatorio">
            <Entrada />
          </Campo>
          <Campo etiqueta="Especie">
            <Selector
              valor={especie}
              onCambio={setEspecie}
              opciones={[
                { valor: 'perro', texto: 'Perro' },
                { valor: 'gato', texto: 'Gato' },
              ]}
            />
          </Campo>
        </div>
      </Seccion>

      <Seccion id="k-dialogos" titulo="Diálogo de confirmación y avisos">
        <div className="flex flex-wrap gap-3">
          <Boton variante="contorno" onClick={() => setDialogo(true)}>
            Abrir confirmación
          </Boton>
          <Boton variante="destructivo" onClick={() => setDialogoDestructivo(true)}>
            Abrir confirmación destructiva
          </Boton>
          <Boton variante="secundario" onClick={() => aviso.exito('Cambios guardados')}>
            Aviso de éxito
          </Boton>
          <Boton variante="secundario" onClick={() => aviso.error('No se pudo guardar')}>
            Aviso de error
          </Boton>
        </div>
        <DialogoConfirmacion
          abierto={dialogo}
          onAbiertoChange={setDialogo}
          titulo="¿Quieres continuar?"
          descripcion="Podrás cambiarlo más adelante."
          onConfirmar={() => setDialogo(false)}
        />
        <DialogoConfirmacion
          abierto={dialogoDestructivo}
          onAbiertoChange={setDialogoDestructivo}
          titulo="¿Eliminar el registro?"
          descripcion="Esta acción no se puede deshacer."
          textoConfirmar="Sí, eliminar"
          destructivo
          onConfirmar={() => setDialogoDestructivo(false)}
        />
      </Seccion>

      <Seccion id="k-tabla" titulo="Tabla y paginación">
        <Tabla titulo="Ejemplo de solicitudes">
          <TablaCabecera>
            <TablaFila>
              <TablaTitulo>Mascota</TablaTitulo>
              <TablaTitulo>Estado</TablaTitulo>
            </TablaFila>
          </TablaCabecera>
          <TablaCuerpo>
            <TablaFila>
              <TablaCelda>Luna</TablaCelda>
              <TablaCelda>
                <BadgeEstado estado="pendiente" />
              </TablaCelda>
            </TablaFila>
            <TablaFila>
              <TablaCelda>Toby</TablaCelda>
              <TablaCelda>
                <BadgeEstado estado="aprobada" />
              </TablaCelda>
            </TablaFila>
          </TablaCuerpo>
        </Tabla>
        <Paginacion pagina={pagina} limite={10} total={45} onCambio={setPagina} />
      </Seccion>

      <Seccion id="k-badges" titulo="Badges de estado">
        <div className="flex flex-wrap gap-2">
          {Object.keys(ESTADOS).map((e) => (
            <BadgeEstado key={e} estado={e} />
          ))}
        </div>
      </Seccion>

      <Seccion id="k-tarjeta" titulo="Tarjeta de mascota">
        <div className="grid gap-4 sm:grid-cols-2">
          <TarjetaMascota
            mascota={{
              nombre: 'Luna',
              especie: 'Perro',
              raza: 'Criolla',
              edad: '2 años',
              estado: 'disponible',
            }}
          >
            <Boton variante="contorno">Ver ficha</Boton>
          </TarjetaMascota>
          <TarjetaMascota mascota={{ nombre: 'Michi', especie: 'Gato', estado: 'en_proceso' }} />
        </div>
      </Seccion>

      <Seccion id="k-carga" titulo="Carga y estado vacío">
        <Skeleton className="h-16" />
        <EstadoVacio
          icono={Inbox}
          titulo="Todavía no hay nada aquí"
          descripcion="Cuando haya información la verás en esta sección."
          accion={<Boton>Acción sugerida</Boton>}
        />
      </Seccion>
    </main>
  );
}
