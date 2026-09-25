export function isForeignKeyError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === "P2003" || code === "P2014";
}
