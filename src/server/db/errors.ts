function hasPgCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === code
  );
}

/**
 * Postgres SQLSTATE 23505 = unique_violation. Drizzle wraps the driver's pg
 * error in a DrizzleQueryError, so the actual code lives on `err.cause`, not
 * on `err` itself - checking only the outer error misses every violation.
 */
export function isUniqueViolation(err: unknown): boolean {
  if (hasPgCode(err, "23505")) return true;
  const cause = err instanceof Error ? err.cause : undefined;
  return hasPgCode(cause, "23505");
}
