import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { PoolClient } from 'pg';
import { getPool } from './database';

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

interface ProductRow {
  id: string;
  name: string;
  price: string | number;
  description: string;
  stock_quantity: number;
  created_at: Date | string;
  image_url: string | null;
  category: string | null;
}

interface CartItemRow {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  created_at: Date | string;
  product: ProductRow;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type ImportTable = 'users' | 'products' | 'carts' | 'cart_items' | 'orders' | 'order_items';

interface DataImportEvent {
  action: 'importRows';
  table: ImportTable;
  rows: Record<string, unknown>[];
}

const importColumns: Record<ImportTable, string[]> = {
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

const bedrock = new BedrockRuntimeClient({});

function response(
  statusCode: number,
  body?: unknown,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: body === undefined ? '' : JSON.stringify(body),
  };
}

function parseBody(event: APIGatewayProxyEventV2WithJWTAuthorizer): Record<string, unknown> {
  try {
    const body: unknown = JSON.parse(event.body ?? '{}');
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new HttpError(400, 'Request body must be a JSON object.');
    }
    return body as Record<string, unknown>;
  } catch (error: unknown) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
}

function currentUser(event: APIGatewayProxyEventV2WithJWTAuthorizer): {
  id: string;
  email: string;
  username: string;
} {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  const id = claims?.sub;
  const email = claims?.email;
  const username = claims?.preferred_username ?? email;
  if (
    typeof id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ||
    typeof email !== 'string' ||
    typeof username !== 'string'
  ) {
    throw new HttpError(401, 'A valid signed-in user is required.');
  }
  return { id, email, username };
}

async function ensureCart(client: PoolClient, userId: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO carts (user_id)
     VALUES ($1)
     ON CONFLICT (user_id)
     DO UPDATE SET last_modified_at = now()
     RETURNING id`,
    [userId],
  );
  return result.rows[0].id;
}

async function readCart(client: PoolClient, userId: string) {
  const cartId = await ensureCart(client, userId);
  const result = await client.query<CartItemRow>(
    `SELECT ci.id, ci.cart_id, ci.product_id, ci.quantity, ci.created_at,
            json_build_object(
              'id', p.id,
              'name', p.name,
              'price', p.price,
              'description', p.description,
              'stock_quantity', p.stock_quantity,
              'created_at', p.created_at,
              'image_url', p.image_url,
              'category', p.category
            ) AS product
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = $1
     ORDER BY ci.created_at`,
    [cartId],
  );
  return { id: cartId, items: result.rows };
}

async function getProfile(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const user = currentUser(event);
  const pool = await getPool();
  const result = await pool.query(
    `INSERT INTO users (id, email, username)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
     RETURNING id, username, full_name, email, created_at,
               shipping_address, billing_address, phone_number`,
    [user.id, user.email, user.username],
  );
  return response(200, result.rows[0]);
}

async function updateProfile(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const user = currentUser(event);
  const body = parseBody(event);
  const fields = {
    fullName: 'full_name',
    phoneNumber: 'phone_number',
    shippingAddress: 'shipping_address',
    billingAddress: 'billing_address',
  } as const;
  const values: string[] = [];
  const assignments: string[] = [];
  for (const [inputName, columnName] of Object.entries(fields)) {
    const value = body[inputName];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length > 1000) {
      throw new HttpError(400, `${inputName} must be a string of at most 1000 characters.`);
    }
    values.push(value.trim());
    assignments.push(`${columnName} = $${values.length}`);
  }
  if (assignments.length === 0) throw new HttpError(400, 'No profile fields were provided.');

  values.push(user.id);
  const pool = await getPool();
  const result = await pool.query(
    `UPDATE users SET ${assignments.join(', ')}
     WHERE id = $${values.length}
     RETURNING id, username, full_name, email, created_at,
               shipping_address, billing_address, phone_number`,
    values,
  );
  if (result.rowCount === 0) throw new HttpError(404, 'User profile was not found.');
  return response(200, result.rows[0]);
}

async function getProducts() {
  const pool = await getPool();
  const result = await pool.query<ProductRow>(
    `SELECT id, name, price, description, stock_quantity, created_at, image_url, category
     FROM products
     ORDER BY created_at DESC`,
  );
  return response(
    200,
    result.rows.map((product) => ({ ...product, price: Number(product.price) })),
  );
}

async function getCart(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const user = currentUser(event);
  const pool = await getPool();
  const client = await pool.connect();
  try {
    return response(200, await readCart(client, user.id));
  } finally {
    client.release();
  }
}

async function addCartItem(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const user = currentUser(event);
  const body = parseBody(event);
  const productId = body.productId;
  const quantity = body.quantity ?? 1;
  if (
    typeof productId !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(productId) ||
    !Number.isInteger(quantity) ||
    Number(quantity) < 1 ||
    Number(quantity) > 99
  ) {
    throw new HttpError(400, 'A valid productId and quantity from 1 to 99 are required.');
  }

  const pool = await getPool();
  const client = await pool.connect();
  try {
    const cartId = await ensureCart(client, user.id);
    await client.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, product_id)
       DO UPDATE SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, 99)`,
      [cartId, productId, quantity],
    );
    await client.query('UPDATE carts SET last_modified_at = now() WHERE id = $1', [cartId]);
    return response(200, await readCart(client, user.id));
  } finally {
    client.release();
  }
}

async function updateCartItem(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const user = currentUser(event);
  const body = parseBody(event);
  const quantity = body.quantity;
  if (!Number.isInteger(quantity) || Number(quantity) < 0 || Number(quantity) > 99) {
    throw new HttpError(400, 'Quantity must be an integer from 0 to 99.');
  }
  const pool = await getPool();
  const client = await pool.connect();
  try {
    const cartId = await ensureCart(client, user.id);
    if (Number(quantity) === 0) {
      await client.query(
        'DELETE FROM cart_items WHERE id = $1 AND cart_id = $2',
        [event.pathParameters?.id, cartId],
      );
    } else {
      await client.query(
        'UPDATE cart_items SET quantity = $1 WHERE id = $2 AND cart_id = $3',
        [quantity, event.pathParameters?.id, cartId],
      );
    }
    await client.query('UPDATE carts SET last_modified_at = now() WHERE id = $1', [cartId]);
    return response(200, await readCart(client, user.id));
  } finally {
    client.release();
  }
}

async function deleteCartItem(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const user = currentUser(event);
  const pool = await getPool();
  const client = await pool.connect();
  try {
    const cartId = await ensureCart(client, user.id);
    await client.query(
      'DELETE FROM cart_items WHERE id = $1 AND cart_id = $2',
      [event.pathParameters?.id, cartId],
    );
    await client.query('UPDATE carts SET last_modified_at = now() WHERE id = $1', [cartId]);
    return response(200, await readCart(client, user.id));
  } finally {
    client.release();
  }
}

async function clearCart(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const user = currentUser(event);
  const pool = await getPool();
  const client = await pool.connect();
  try {
    const cartId = await ensureCart(client, user.id);
    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
    await client.query('UPDATE carts SET last_modified_at = now() WHERE id = $1', [cartId]);
    return response(200, { id: cartId, items: [] });
  } finally {
    client.release();
  }
}

async function createOrder(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const user = currentUser(event);
  const body = parseBody(event);
  const couponCode = body.couponCode;
  if (couponCode !== undefined && couponCode !== null && typeof couponCode !== 'string') {
    throw new HttpError(400, 'couponCode must be a string.');
  }
  if (
    typeof couponCode === 'string' &&
    couponCode.length > 0 &&
    couponCode.toUpperCase() !== 'CRAFT20'
  ) {
    throw new HttpError(400, 'The coupon code is invalid.');
  }

  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cartId = await ensureCart(client, user.id);
    const items = await client.query<{
      product_id: string;
      quantity: number;
      price: string;
      name: string;
    }>(
      `SELECT ci.product_id, ci.quantity, p.price, p.name
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = $1
       ORDER BY ci.created_at
       FOR UPDATE OF ci`,
      [cartId],
    );
    if (items.rowCount === 0) throw new HttpError(400, 'Your cart is empty.');

    const subtotal = items.rows.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0,
    );
    const discount = couponCode ? subtotal * 0.2 : 0;
    const shipping = subtotal >= 499 ? 0 : 49;
    const total = Number((subtotal - discount + shipping).toFixed(2));
    const orderResult = await client.query<{
      id: string;
      user_id: string;
      order_date: Date | string;
      total_amount: string;
      status: string;
    }>(
      `INSERT INTO orders (user_id, total_amount, status)
       VALUES ($1, $2, 'pending')
       RETURNING id, user_id, order_date, total_amount, status`,
      [user.id, total],
    );
    const order = orderResult.rows[0];
    for (const item of items.rows) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price_at_time_of_purchase)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.product_id, item.quantity, item.price],
      );
    }
    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
    await client.query('UPDATE carts SET last_modified_at = now() WHERE id = $1', [cartId]);
    await client.query('COMMIT');

    return response(201, {
      ...order,
      total_amount: total,
      items: items.rows.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_time_of_purchase: Number(item.price),
        product: { id: item.product_id, name: item.name, price: Number(item.price) },
      })),
    });
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getOrders(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const user = currentUser(event);
  const pool = await getPool();
  const orders = await pool.query<{
    id: string;
    user_id: string;
    order_date: Date | string;
    total_amount: string;
    status: string;
  }>(
    `SELECT id, user_id, order_date, total_amount, status
     FROM orders WHERE user_id = $1
     ORDER BY order_date DESC`,
    [user.id],
  );
  if (orders.rows.length === 0) return response(200, []);

  const items = await pool.query(
    `SELECT oi.id, oi.order_id, oi.product_id, oi.quantity,
            oi.price_at_time_of_purchase,
            json_build_object(
              'id', p.id, 'name', p.name, 'price', p.price,
              'description', p.description, 'stock_quantity', p.stock_quantity,
              'created_at', p.created_at, 'image_url', p.image_url, 'category', p.category
            ) AS product
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     WHERE o.user_id = $1
     ORDER BY oi.id`,
    [user.id],
  );
  const itemsByOrder = new Map<string, typeof items.rows>();
  for (const item of items.rows) {
    const orderItems = itemsByOrder.get(item.order_id) ?? [];
    orderItems.push(item);
    itemsByOrder.set(item.order_id, orderItems);
  }
  return response(
    200,
    orders.rows.map((order) => ({
      ...order,
      total_amount: Number(order.total_amount),
      items: itemsByOrder.get(order.id) ?? [],
    })),
  );
}

async function chat(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const user = currentUser(event);
  const body = parseBody(event);
  const message = body.message;
  const conversationId = body.conversationId;
  if (typeof message !== 'string' || !message.trim() || message.length > 2000) {
    throw new HttpError(400, 'A message of 1 to 2000 characters is required.');
  }
  if (
    conversationId !== undefined &&
    (typeof conversationId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(conversationId))
  ) {
    throw new HttpError(400, 'conversationId must be a valid ID.');
  }

  const modelId = process.env.BEDROCK_MODEL_ID;
  if (!modelId) throw new Error('BEDROCK_MODEL_ID is not configured.');
  const pool = await getPool();
  const historyResult =
    typeof conversationId === 'string'
      ? await pool.query<{ messages: ChatMessage[] }>(
          'SELECT messages FROM chat_conversations WHERE id = $1 AND user_id = $2',
          [conversationId, user.id],
        )
      : { rows: [] as { messages: ChatMessage[] }[] };
  if (typeof conversationId === 'string' && historyResult.rows.length === 0) {
    throw new HttpError(404, 'Chat conversation was not found.');
  }
  const history = historyResult.rows[0]?.messages ?? [];

  const products = await pool.query<ProductRow>(
    `SELECT name, price, description, category, stock_quantity
     FROM products
     ORDER BY created_at DESC
     LIMIT 20`,
  );
  const catalog = products.rows
    .map(
      (product) =>
        `${product.name} (${product.category ?? 'General'}) - ₹${Number(product.price).toFixed(2)}; ` +
        `stock: ${product.stock_quantity}; ${product.description.slice(0, 240)}`,
    )
    .join('\n');

  const modelMessages = [...history.slice(-20), { role: 'user' as const, content: message.trim() }];
  const result = await bedrock.send(
    new ConverseCommand({
      modelId,
      system: [
        {
          text:
            'You are GK Shoppy’s customer-support assistant for a paper-craft store. ' +
            'Use the current product catalog below when recommending items and do not invent product names, prices, stock, or policies. ' +
            'Free shipping applies to orders of ₹499 or more; otherwise shipping is ₹49. ' +
            'You cannot place orders or modify account data. Never ask for passwords, one-time codes, payment-card details, or CVV. ' +
            'Do not claim to have taken actions in the customer’s account.\n\n' +
            `Current product catalog:\n${catalog || 'No catalog products are available.'}`,
        },
      ],
      messages: modelMessages.map((entry) => ({
        role: entry.role,
        content: [{ text: entry.content }],
      })),
      inferenceConfig: { maxTokens: 500, temperature: 0.3 },
    }),
  );
  const reply = result.output?.message?.content
    ?.map((block) => ('text' in block ? block.text ?? '' : ''))
    .join('')
    .trim();
  if (!reply) throw new Error('Bedrock returned an empty chat response.');

  const nextMessages: ChatMessage[] = [
    ...history,
    { role: 'user', content: message.trim() },
    { role: 'assistant', content: reply },
  ];
  let savedConversationId = conversationId as string | undefined;
  if (savedConversationId) {
    const saved = await pool.query(
      `UPDATE chat_conversations
       SET messages = $1::jsonb, updated_at = now()
       WHERE id = $2 AND user_id = $3
       RETURNING id`,
      [JSON.stringify(nextMessages), savedConversationId, user.id],
    );
    if (saved.rowCount === 0) throw new HttpError(404, 'Chat conversation was not found.');
  } else {
    const saved = await pool.query<{ id: string }>(
      `INSERT INTO chat_conversations (user_id, messages)
       VALUES ($1, $2::jsonb)
       RETURNING id`,
      [user.id, JSON.stringify(nextMessages)],
    );
    savedConversationId = saved.rows[0].id;
  }

  return response(200, {
    conversationId: savedConversationId,
    message: reply,
  });
}

async function deleteChat(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const user = currentUser(event);
  const conversationId = event.pathParameters?.id;
  if (!conversationId || !/^[0-9a-f-]{36}$/i.test(conversationId)) {
    throw new HttpError(400, 'A valid conversation ID is required.');
  }
  const pool = await getPool();
  await pool.query(
    'DELETE FROM chat_conversations WHERE id = $1 AND user_id = $2',
    [conversationId, user.id],
  );
  return response(200, { deleted: true });
}

async function getLatestChat(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const user = currentUser(event);
  const pool = await getPool();
  const result = await pool.query<{ id: string; messages: ChatMessage[] }>(
    `SELECT id, messages
     FROM chat_conversations
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [user.id],
  );
  const conversation = result.rows[0];
  return response(
    200,
    conversation
      ? { conversationId: conversation.id, messages: conversation.messages }
      : null,
  );
}

async function importRows(event: DataImportEvent) {
  const columns = importColumns[event.table];
  if (!columns || !Array.isArray(event.rows) || event.rows.length > 100) {
    throw new Error('The data import request is invalid or too large.');
  }
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of event.rows) {
      const values = columns.map((column) => row[column] ?? null);
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
      const updateSet = columns
        .filter((column) => column !== 'id')
        .map((column) => `${column} = EXCLUDED.${column}`)
        .join(', ');
      await client.query(
        `INSERT INTO ${event.table} (${columns.join(', ')}) VALUES (${placeholders}) ` +
          `ON CONFLICT (id) DO UPDATE SET ${updateSet}`,
        values,
      );
    }
    await client.query('COMMIT');
    return { imported: event.rows.length };
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function isDataImportEvent(event: unknown): event is DataImportEvent {
  if (typeof event !== 'object' || event === null || !('action' in event)) return false;
  return event.action === 'importRows';
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer | DataImportEvent,
): Promise<APIGatewayProxyStructuredResultV2 | { imported: number }> {
  if (!('routeKey' in event) && isDataImportEvent(event)) {
    return importRows(event);
  }

  try {
    const route = event.routeKey;
    switch (route) {
      case 'GET /products':
        return await getProducts();
      case 'GET /profile':
        return await getProfile(event);
      case 'PUT /profile':
        return await updateProfile(event);
      case 'GET /cart':
        return await getCart(event);
      case 'POST /cart/items':
        return await addCartItem(event);
      case 'PATCH /cart/items/{id}':
        return await updateCartItem(event);
      case 'DELETE /cart/items/{id}':
        return await deleteCartItem(event);
      case 'DELETE /cart':
        return await clearCart(event);
      case 'GET /orders':
        return await getOrders(event);
      case 'POST /orders':
        return await createOrder(event);
      case 'POST /chat':
        return await chat(event);
      case 'GET /chat':
        return await getLatestChat(event);
      case 'DELETE /chat/{id}':
        return await deleteChat(event);
      default:
        return response(404, { error: 'Route not found.' });
    }
  } catch (error: unknown) {
    if (error instanceof HttpError) return response(error.statusCode, { error: error.message });
    console.error('GK Shoppy API request failed:', error);
    return response(500, { error: 'The request could not be completed.' });
  }
}
