import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** Credenciales de `POST /auth/login` (docs/07 473-489: validar entrada en runtime). */
export class LoginDto {
  // require_tld: false admite correos de host simple (p. ej. `owner@localhost`
  // en desarrollo); los correos reales siguen validando igual.
  @IsEmail({ require_tld: false }, { message: 'Correo invalido.' })
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(1, { message: 'La contrasena es obligatoria.' })
  @MaxLength(200)
  password!: string;
}
