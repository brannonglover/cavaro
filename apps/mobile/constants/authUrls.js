/**
 * Supabase auth redirect targets. Email links open in the browser, so use the web
 * callback URL for resetPasswordForEmail / emailRedirectTo. The web page handles
 * recovery and signup confirmation; the app deep link is used when opening from web.
 */
export const AUTH_CALLBACK_WEB_URL =
  process.env.EXPO_PUBLIC_AUTH_CALLBACK_URL || 'https://cavaroapp.com/auth/callback';

export const AUTH_CALLBACK_APP_URL = 'cavaro://auth/callback';
