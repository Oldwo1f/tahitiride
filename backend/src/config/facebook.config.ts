import { registerAs } from '@nestjs/config';

/**
 * Facebook Login (server-side token verification flow). The frontend
 * uses the Facebook JS SDK to obtain a short-lived `access_token`,
 * sends it to `POST /api/auth/facebook`, and the backend verifies it
 * against Graph API before issuing the local JWT.
 *
 * Leave `appId` and `appSecret` empty to disable the feature: the
 * `FacebookService` then throws `ServiceUnavailableException` and the
 * frontend hides the "Continue with Facebook" button.
 *
 * Get credentials at https://developers.facebook.com/apps (type
 * "Consumer", add the "Facebook Login for the Web" product).
 */
export default registerAs('facebook', () => ({
  appId: process.env.FACEBOOK_APP_ID || '',
  appSecret: process.env.FACEBOOK_APP_SECRET || '',
  graphVersion: process.env.FACEBOOK_GRAPH_VERSION || 'v20.0',
}));
