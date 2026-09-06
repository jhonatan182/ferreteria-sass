/**
 * Lectura minima de cookies de la cabecera `Cookie`. Evita una dependencia
 * (`cookie-parser`) para el unico uso que tenemos: leer la cookie de sesion
 * (AGENTS.md 23 — no agregar librerias innecesariamente). La escritura de la
 * cookie la hace Express con `res.cookie(...)`.
 */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) {
    return out;
  }
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const name = part.slice(0, eq).trim();
    if (!name) {
      continue;
    }
    const value = part.slice(eq + 1).trim();
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}
