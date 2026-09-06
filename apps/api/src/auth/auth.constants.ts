/**
 * Constantes de autenticacion. Los valores numericos son configurables por
 * variable de entorno (ver `.env.example`); estos son los predeterminados.
 * Decisiones justificadas en docs/07 seccion 43.
 */

/** Nombre de la cookie httpOnly que transporta el token de sesion opaco. */
export const SESSION_COOKIE_NAME = 'ferreteria_session';

/** Duracion de una sesion sin uso antes de expirar (deslizante). Default 7 dias. */
export const DEFAULT_SESSION_TTL_HOURS = 24 * 7;

/** Coste de bcrypt para el hash de contrasenas (docs/07 seccion 43). */
export const DEFAULT_BCRYPT_COST = 12;

/** Rate limit de `POST /auth/login`: intentos por ventana e IP. */
export const DEFAULT_LOGIN_RATE_LIMIT = 5;
export const DEFAULT_LOGIN_RATE_TTL_SECONDS = 60;

/** Bytes de entropia del token de sesion en claro. */
export const SESSION_TOKEN_BYTES = 32;
