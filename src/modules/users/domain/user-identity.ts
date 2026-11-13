/**
 * Regras de normalização dos identificadores do utilizador.
 *
 * Aplicadas no registo E no login, para que "Ana@Bulir.ao " e "ana@bulir.ao"
 * sejam a mesma conta. A BD reforça isto com CHECK (email = lower(email)) e
 * CHECK (nif = upper(nif) AND nif !~ '\s'), por isso o UNIQUE simples já é,
 * na prática, case-insensitive — sem precisar de CITEXT nem de índice em lower().
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Remove todos os espaços (inclusive no meio: "004 512 345 LA 041") e põe em maiúsculas. */
export function normalizeNif(nif: string): string {
  return nif.replace(/\s+/g, '').toUpperCase();
}

/**
 * Um identificador de login com "@" é um e-mail; caso contrário é um NIF.
 * É inequívoco porque o NIF só aceita letras e dígitos (ver validação no registo).
 */
export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes('@');
}
