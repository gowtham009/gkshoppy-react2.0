import {
  CloudFormationCustomResourceEvent,
} from 'aws-lambda';
import schema from '../sql/schema.sql';
import { getPool } from './database';

export async function handler(
  event: CloudFormationCustomResourceEvent,
): Promise<{ PhysicalResourceId: string }> {
  const physicalResourceId = 'GKShoppyDatabaseSchema';
  if (event.RequestType === 'Delete') {
    return { PhysicalResourceId: event.PhysicalResourceId ?? physicalResourceId };
  }

  const pool = await getPool();
  await pool.query(schema);
  return { PhysicalResourceId: physicalResourceId };
}
