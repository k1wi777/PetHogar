'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { esErrorApi } from '@/shared/api/errores';
import { SesionProvider } from '@/shared/auth/SesionProvider';
import { Toaster } from '@/shared/ui/Toaster';

function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // No se insiste cuando la API no responde o la sesión terminó.
        retry: (intentos, error) =>
          intentos < 1 && !(esErrorApi(error) && (error.esRed || error.esSesionVencida)),
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(crearQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <SesionProvider>
        {children}
        <Toaster />
      </SesionProvider>
    </QueryClientProvider>
  );
}
