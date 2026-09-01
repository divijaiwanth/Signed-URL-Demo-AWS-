import { randomUUID } from 'node:crypto';

export function buildObjectKey(filename) {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `uploads/${randomUUID()}-${sanitized}`;
}
