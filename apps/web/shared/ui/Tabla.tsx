import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

export function Tabla({
  className,
  titulo,
  children,
  ...props
}: HTMLAttributes<HTMLTableElement> & { titulo?: string }) {
  return (
    <div className="border-border-suave overflow-x-auto rounded-md border">
      <table className={cn('w-full border-collapse text-left text-base', className)} {...props}>
        {titulo && (
          <caption className="text-muted-foreground p-3 text-left text-sm">{titulo}</caption>
        )}
        {children}
      </table>
    </div>
  );
}

export function TablaCabecera(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="bg-muted" {...props} />;
}

export function TablaCuerpo(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TablaFila({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-border-suave border-b last:border-0', className)} {...props} />;
}

export function TablaTitulo({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn('px-4 py-3 font-semibold', className)} {...props} />;
}

export function TablaCelda({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3', className)} {...props} />;
}
