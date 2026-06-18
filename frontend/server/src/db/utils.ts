/**
 * Convert camelCase keys to snake_case for API responses.
 * Drizzle ORM returns camelCase keys from schema definitions,
 * but the frontend expects snake_case (matching raw SQL column names).
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function rowToSnake<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[toSnakeCase(key)] = value;
  }
  return result;
}

export function rowsToSnake<T extends Record<string, unknown>>(rows: T[]): Record<string, unknown>[] {
  return rows.map(rowToSnake);
}
