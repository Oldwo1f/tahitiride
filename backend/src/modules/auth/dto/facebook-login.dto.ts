import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body of `POST /api/auth/facebook`. The frontend obtains the
 * `access_token` from the Facebook JS SDK (`FB.login` callback,
 * `authResponse.accessToken`) and forwards it as-is. The backend
 * verifies it against Graph API before doing anything with the user.
 *
 * Min length 20 keeps obviously invalid strings out without trying to
 * mirror Facebook's opaque token format (which they reserve the right
 * to change).
 */
export class FacebookLoginDto {
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  access_token!: string;
}
