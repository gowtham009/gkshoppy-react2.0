import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { Pool } from 'pg';

let poolPromise: Promise<Pool> | undefined;
const secrets = new SecretsManagerClient({});

export async function getPool(): Promise<Pool> {
  if (!poolPromise) {
    poolPromise = (async () => {
      const secretArn = process.env.DB_SECRET_ARN;
      const host = process.env.DB_HOST;
      const database = process.env.DB_NAME;
      if (!secretArn || !host || !database) {
        throw new Error('Database connection environment is incomplete.');
      }

      const secret = await secrets.send(
        new GetSecretValueCommand({ SecretId: secretArn }),
      );
      if (!secret.SecretString) {
        throw new Error('The database secret has no SecretString.');
      }
      const credentials = JSON.parse(secret.SecretString) as {
        username?: string;
        password?: string;
      };
      if (!credentials.username || !credentials.password) {
        throw new Error('The database secret is missing credentials.');
      }

      return new Pool({
        host,
        port: 5432,
        database,
        user: credentials.username,
        password: credentials.password,
        ssl: { rejectUnauthorized: true },
        max: 2,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
      });
    })();
  }
  try {
    return await poolPromise;
  } catch (error: unknown) {
    poolPromise = undefined;
    throw error;
  }
}
