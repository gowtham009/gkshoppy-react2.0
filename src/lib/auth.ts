export interface AuthSession {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface CognitoResponse {
  AuthenticationResult?: {
    IdToken?: string;
    AccessToken?: string;
    RefreshToken?: string;
    ExpiresIn?: number;
  };
}

const SESSION_KEY = 'gkshoppy.auth.session';
const DEMO_ACCOUNTS_KEY = 'gkshoppy.demo.accounts';
const DEMO_SESSION_KEY = 'gkshoppy.demo.session';

interface DemoAccount {
  email: string;
  password: string;
  username: string;
  confirmed: boolean;
}

export function isLocalAuthMode() {
  const runtime = window.__env ?? {};
  const region = runtime.VITE_AWS_REGION ?? import.meta.env.VITE_AWS_REGION;
  const clientId = runtime.VITE_COGNITO_CLIENT_ID ?? import.meta.env.VITE_COGNITO_CLIENT_ID;
  return !region || !clientId;
}

function demoAccounts(): DemoAccount[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_ACCOUNTS_KEY) || '[]') as DemoAccount[];
  } catch {
    return [];
  }
}

function saveDemoAccounts(accounts: DemoAccount[]) {
  localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function makeDemoSession(account: DemoAccount): AuthSession {
  const claims = {
    sub: `demo-${btoa(account.email).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`,
    email: account.email,
    preferred_username: account.username,
  };
  const encodedClaims = btoa(JSON.stringify(claims)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const idToken = `eyJhbGciOiJub25lIn0.${encodedClaims}.demo`;
  const session: AuthSession = {
    idToken,
    accessToken: 'demo-access-token',
    refreshToken: 'demo-refresh-token',
    expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  sessionStorage.setItem(DEMO_SESSION_KEY, account.email);
  return session;
}

function config() {
  const runtime = window.__env ?? {};
  const region = runtime.VITE_AWS_REGION ?? import.meta.env.VITE_AWS_REGION;
  const clientId = runtime.VITE_COGNITO_CLIENT_ID ?? import.meta.env.VITE_COGNITO_CLIENT_ID;
  if (!region || !clientId) {
    throw new Error('AWS Cognito is not configured. Set VITE_AWS_REGION and VITE_COGNITO_CLIENT_ID.');
  }
  return { region, clientId };
}

async function cognitoRequest<T>(target: string, input: Record<string, unknown>): Promise<T> {
  const { region } = config();
  const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-amz-json-1.1',
      'x-amz-target': `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(input),
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const error = result as { message?: string; Message?: string; __type?: string };
    const message = error.message ?? error.Message ?? 'Cognito request failed.';
    throw new Error(message.replace(/^.*#/, ''));
  }
  return result as T;
}

function saveSession(result: CognitoResponse['AuthenticationResult'], previous?: AuthSession) {
  if (!result?.IdToken || !result.AccessToken) {
    throw new Error('Cognito did not return an authenticated session.');
  }
  const expiresAt = Math.floor(Date.now() / 1000) + (result.ExpiresIn ?? 3600);
  const session: AuthSession = {
    idToken: result.IdToken,
    accessToken: result.AccessToken,
    refreshToken: result.RefreshToken ?? previous?.refreshToken ?? '',
    expiresAt,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function signUp(email: string, password: string, username: string) {
  if (isLocalAuthMode()) {
    const normalizedEmail = email.trim().toLowerCase();
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    const accounts = demoAccounts();
    if (accounts.some(account => account.email === normalizedEmail)) {
      throw new Error('An account with this email already exists.');
    }
    accounts.push({ email: normalizedEmail, password, username: username.trim(), confirmed: false });
    saveDemoAccounts(accounts);
    return;
  }
  const { clientId } = config();
  await cognitoRequest('SignUp', {
    ClientId: clientId,
    Username: email.trim().toLowerCase(),
    Password: password,
    UserAttributes: [
      { Name: 'email', Value: email.trim().toLowerCase() },
      { Name: 'preferred_username', Value: username.trim() },
    ],
  });
}

export async function confirmSignUp(email: string, code: string) {
  if (isLocalAuthMode()) {
    if (code.trim() !== '123456') throw new Error('Use the demo confirmation code 123456.');
    const normalizedEmail = email.trim().toLowerCase();
    const accounts = demoAccounts();
    const account = accounts.find(item => item.email === normalizedEmail);
    if (!account) throw new Error('No account was found for this email.');
    account.confirmed = true;
    saveDemoAccounts(accounts);
    return;
  }
  const { clientId } = config();
  await cognitoRequest('ConfirmSignUp', {
    ClientId: clientId,
    Username: email.trim().toLowerCase(),
    ConfirmationCode: code.trim(),
  });
}

export async function signIn(email: string, password: string) {
  if (isLocalAuthMode()) {
    const normalizedEmail = email.trim().toLowerCase();
    const account = demoAccounts().find(item => item.email === normalizedEmail);
    if (!account) throw new Error('No account found with this email.');
    if (!account.confirmed) throw new Error('Confirm your email before signing in.');
    if (account.password !== password) throw new Error('Incorrect email or password.');
    return makeDemoSession(account);
  }
  const { clientId } = config();
  const result = await cognitoRequest<CognitoResponse>('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: clientId,
    AuthParameters: {
      USERNAME: email.trim().toLowerCase(),
      PASSWORD: password,
    },
  });
  return saveSession(result.AuthenticationResult);
}

export async function startPasswordReset(email: string) {
  if (isLocalAuthMode()) {
    const account = demoAccounts().find(item => item.email === email.trim().toLowerCase());
    if (!account) throw new Error('No account found with this email.');
    return;
  }
  const { clientId } = config();
  await cognitoRequest('ForgotPassword', {
    ClientId: clientId,
    Username: email.trim().toLowerCase(),
  });
}

export async function confirmPasswordReset(email: string, code: string, password: string) {
  if (isLocalAuthMode()) {
    if (code.trim() !== '123456') throw new Error('Use the demo reset code 123456.');
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    const accounts = demoAccounts();
    const account = accounts.find(item => item.email === email.trim().toLowerCase());
    if (!account) throw new Error('No account found with this email.');
    account.password = password;
    saveDemoAccounts(accounts);
    return;
  }
  const { clientId } = config();
  await cognitoRequest('ConfirmForgotPassword', {
    ClientId: clientId,
    Username: email.trim().toLowerCase(),
    ConfirmationCode: code.trim(),
    Password: password,
  });
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(DEMO_SESSION_KEY);
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (!stored) return null;

  let session: AuthSession;
  try {
    session = JSON.parse(stored) as AuthSession;
  } catch {
    clearSession();
    return null;
  }
  if (
    !session.idToken ||
    !session.accessToken ||
    !session.refreshToken ||
    !Number.isFinite(session.expiresAt)
  ) {
    clearSession();
    return null;
  }
  if (isLocalAuthMode()) {
    if (session.expiresAt > Math.floor(Date.now() / 1000)) return session;
    clearSession();
    return null;
  }
  if (session.expiresAt > Math.floor(Date.now() / 1000) + 60) return session;

  const { clientId } = config();
  try {
    const refreshed = await cognitoRequest<CognitoResponse>('InitiateAuth', {
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: clientId,
      AuthParameters: { REFRESH_TOKEN: session.refreshToken },
    });
    return saveSession(refreshed.AuthenticationResult, session);
  } catch (error: unknown) {
    clearSession();
    throw error;
  }
}

export async function getValidIdToken(): Promise<string | null> {
  return (await getCurrentSession())?.idToken ?? null;
}

export function getUserFromSession(session: AuthSession) {
  try {
    const payload = session.idToken.split('.')[1];
    if (!payload) throw new Error('Invalid Cognito ID token.');
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as {
      sub?: string;
      email?: string;
      preferred_username?: string;
    };
    if (!claims.sub || !claims.email) throw new Error('Cognito ID token is missing user claims.');
    return {
      id: claims.sub,
      email: claims.email,
      username: claims.preferred_username ?? claims.email,
    };
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('Could not read the Cognito user session.');
  }
}
