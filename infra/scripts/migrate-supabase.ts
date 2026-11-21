import { randomBytes } from 'node:crypto';
import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { createClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;

interface SupabaseExportClient {
  from(table: TableName): {
    select(columns: string): {
      range(from: number, to: number): PromiseLike<{
        data: Row[] | null;
        error: { message: string } | null;
      }>;
    };
  };
}

const tableNames = ['users', 'products', 'carts', 'cart_items', 'orders', 'order_items'] as const;
type TableName = (typeof tableNames)[number];

const columns: Record<TableName, string[]> = {
  users: [
    'id',
    'username',
    'full_name',
    'email',
    'created_at',
    'shipping_address',
    'billing_address',
    'phone_number',
  ],
  products: [
    'id',
    'name',
    'price',
    'description',
    'stock_quantity',
    'created_at',
    'image_url',
    'category',
  ],
  carts: ['id', 'user_id', 'created_at', 'last_modified_at'],
  cart_items: ['id', 'cart_id', 'product_id', 'quantity', 'created_at'],
  orders: ['id', 'user_id', 'order_date', 'total_amount', 'status'],
  order_items: [
    'id',
    'order_id',
    'product_id',
    'quantity',
    'price_at_time_of_purchase',
  ],
};

async function readAllRows(
  supabase: SupabaseExportClient,
  table: TableName,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(offset, offset + 999);
    if (error) throw new Error(`Supabase export failed for ${table}: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function provisionCognitoUser(
  cognito: CognitoIdentityProviderClient,
  userPoolId: string,
  row: Row,
): Promise<string> {
  const email = String(row.email ?? '').trim().toLowerCase();
  if (!email) throw new Error(`Supabase user ${String(row.id)} has no email address.`);
  const username = String(row.username ?? email.split('@')[0]).slice(0, 128);

  try {
    const existing = await cognito.send(
      new AdminGetUserCommand({ UserPoolId: userPoolId, Username: email }),
    );
    const sub = existing.UserAttributes?.find((attribute) => attribute.Name === 'sub')?.Value;
    if (!sub) throw new Error(`Cognito user ${email} has no sub attribute.`);
    return sub;
  } catch (error: unknown) {
    if (!(error instanceof UserNotFoundException)) throw error;
  }

  const created = await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'preferred_username', Value: username },
      ],
    }),
  );
  const sub = created.User?.Attributes?.find((attribute) => attribute.Name === 'sub')?.Value;
  if (!sub) throw new Error(`Cognito did not return a user ID for ${email}.`);

  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: email,
      Password: 'gA1!' + randomBytes(48).toString('base64url'),
      Permanent: true,
    }),
  );
  return sub;
}

function prepareRows(
  table: TableName,
  rows: Row[],
  userIds: Map<string, string>,
): Row[] {
  const names = columns[table];
  return rows.map((row) => {
    const migrated: Row = {};
    for (const name of names) {
      if (name === 'id' && table === 'users') {
        const mappedId = userIds.get(String(row.id));
        if (!mappedId) throw new Error(`No Cognito user mapping for Supabase user ${String(row.id)}.`);
        migrated[name] = mappedId;
      } else if (name === 'user_id') {
        const mappedId = userIds.get(String(row.user_id));
        if (!mappedId) throw new Error(`No Cognito user mapping for ${String(row.user_id)}.`);
        migrated[name] = mappedId;
      } else {
        migrated[name] = row[name] ?? null;
      }
    }
    return migrated;
  });
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const functionName = process.env.API_FUNCTION_NAME;
  const region = process.env.AWS_REGION ?? 'us-east-1';
  if (!supabaseUrl || !serviceRoleKey || !userPoolId || !functionName) {
    throw new Error(
      'Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, COGNITO_USER_POOL_ID, and API_FUNCTION_NAME.',
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const exported = new Map<TableName, Row[]>();
  for (const table of tableNames) exported.set(table, await readAllRows(supabase, table));

  const cognito = new CognitoIdentityProviderClient({ region });
  const userIds = new Map<string, string>();
  for (const user of exported.get('users') ?? []) {
    userIds.set(
      String(user.id),
      await provisionCognitoUser(cognito, userPoolId, user),
    );
  }

  const lambda = new LambdaClient({ region });
  for (const table of tableNames) {
    const rows = prepareRows(table, exported.get(table) ?? [], userIds);
    for (let offset = 0; offset < rows.length; offset += 100) {
      const payload = JSON.stringify({
        action: 'importRows',
        table,
        rows: rows.slice(offset, offset + 100),
      });
      const result = await lambda.send(
        new InvokeCommand({
          FunctionName: functionName,
          InvocationType: 'RequestResponse',
          Payload: Buffer.from(payload),
        }),
      );
      if (result.FunctionError) {
        const detail = result.Payload
          ? Buffer.from(result.Payload).toString('utf8')
          : 'Unknown Lambda import error.';
        throw new Error(`Importing ${table} failed: ${detail}`);
      }
    }
  }

  console.log(
    `Imported ${[...exported.values()].reduce((count, rows) => count + rows.length, 0)} ` +
      `rows into GKShoppy. Migrated users must use Forgot password to create a new password.`,
  );
}

main().catch((error: unknown) => {
  console.error('Supabase data migration failed:', error);
  process.exitCode = 1;
});
