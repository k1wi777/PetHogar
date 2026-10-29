import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

export function aSnakeCase(texto: string): string {
  return texto
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/** Nombres de tablas y columnas en snake_case a partir de propiedades en camelCase. */
export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  override tableName(className: string, customName?: string): string {
    return customName ?? aSnakeCase(className);
  }

  override columnName(
    propertyName: string,
    customName: string | undefined,
    prefixes: string[],
  ): string {
    const base = customName ?? aSnakeCase(propertyName);
    return [...prefixes.map(aSnakeCase), base].join('_');
  }

  override relationName(propertyName: string): string {
    return aSnakeCase(propertyName);
  }

  override joinColumnName(relationName: string, referencedColumnName: string): string {
    return aSnakeCase(`${relationName}_${referencedColumnName}`);
  }

  override joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
  ): string {
    return aSnakeCase(
      `${firstTableName}_${firstPropertyName.replace(/\./gi, '_')}_${secondTableName}`,
    );
  }

  override joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return aSnakeCase(`${tableName}_${columnName ?? propertyName}`);
  }
}
