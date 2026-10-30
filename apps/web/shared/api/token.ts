/** Access token solo en memoria: nunca en storage ni en cookies legibles (R5). */
export interface AlmacenToken {
  obtener(): string | null;
  guardar(token: string): void;
  limpiar(): void;
}

export function crearAlmacenToken(): AlmacenToken {
  let token: string | null = null;
  return {
    obtener: () => token,
    guardar: (nuevo) => {
      token = nuevo;
    },
    limpiar: () => {
      token = null;
    },
  };
}
