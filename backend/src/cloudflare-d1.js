/**
 * Cloudflare D1 Serverless SQL Adapter
 * Provides 5 GB free edge database storage for worker GPS locations and in-ticket chat messages.
 * Communicates via Cloudflare D1 REST API with zero external dependencies.
 */

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID ?? '';
const CF_D1_DATABASE_ID = process.env.CF_D1_DATABASE_ID ?? '';
const CF_API_TOKEN = process.env.CF_API_TOKEN ?? '';

export function isD1Configured() {
  return Boolean(CF_ACCOUNT_ID && CF_D1_DATABASE_ID && CF_API_TOKEN);
}

export const D1_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS worker_locations (
  worker_id INTEGER PRIMARY KEY,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  sender_role TEXT NOT NULL,
  message TEXT NOT NULL,
  read_by TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id, created_at);
`;

/**
 * Execute raw SQL query against Cloudflare D1 REST API.
 */
export async function queryD1(sql, params = []) {
  if (!isD1Configured()) {
    throw new Error('Cloudflare D1 is not configured.');
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/query`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql,
        params,
      }),
      signal: controller.signal,
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      const err = data.errors?.[0]?.message || `HTTP ${response.status} from Cloudflare D1`;
      throw new Error(`Cloudflare D1 Query Failed: ${err}`);
    }

    const firstResult = data.result?.[0];
    return firstResult?.results ?? [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Auto-initializes D1 tables if D1 is configured.
 */
export async function initD1Tables() {
  if (!isD1Configured()) return false;
  try {
    const statements = D1_SCHEMA_SQL.trim()
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      await queryD1(stmt);
    }
    console.log('[d1] Cloudflare D1 tables initialized successfully.');
    return true;
  } catch (err) {
    console.warn('[d1] Cloudflare D1 initialization error (will use fallback):', err.message);
    return false;
  }
}

function mapLocationRow(row) {
  if (!row) return null;
  return {
    workerId: Number(row.worker_id),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracy: Number(row.accuracy),
    updatedAt: new Date(Number(row.updated_at)),
    expiresAt: new Date(Number(row.expires_at)),
  };
}

function mapMessageRow(row) {
  if (!row) return null;
  let readBy = [];
  try {
    readBy = JSON.parse(row.read_by || '[]');
  } catch {
    readBy = [];
  }
  return {
    id: Number(row.id),
    ticketId: Number(row.ticket_id),
    senderId: Number(row.sender_id),
    senderRole: String(row.sender_role),
    message: String(row.message),
    readBy,
    createdAt: new Date(Number(row.created_at)),
  };
}

/**
 * D1 Worker Location Client compatible with Mongoose model methods.
 */
export const D1WorkerLocation = {
  async findOneAndUpdate(filter, update, _options = {}) {
    const workerId = Number(filter.workerId);
    const data = update.$set || update;
    const lat = Number(data.latitude);
    const lng = Number(data.longitude);
    const acc = Number(data.accuracy);
    const updatedAtMs = data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now();
    const expiresAtMs = data.expiresAt ? new Date(data.expiresAt).getTime() : Date.now() + 120000;

    const sql = `
      INSERT INTO worker_locations (worker_id, latitude, longitude, accuracy, updated_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(worker_id) DO UPDATE SET
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy = excluded.accuracy,
        updated_at = excluded.updated_at,
        expires_at = excluded.expires_at
      RETURNING *;
    `;
    const results = await queryD1(sql, [workerId, lat, lng, acc, updatedAtMs, expiresAtMs]);
    return mapLocationRow(results[0]);
  },

  findOne(filter) {
    const workerId = Number(filter.workerId);
    const nowMs = Date.now();
    const promise = queryD1(
      'SELECT * FROM worker_locations WHERE worker_id = ? AND expires_at > ? LIMIT 1;',
      [workerId, nowMs],
    ).then((results) => mapLocationRow(results[0]));

    // Chainable .lean() support
    promise.lean = () => promise;
    return promise;
  },

  async deleteOne(filter) {
    const workerId = Number(filter.workerId);
    await queryD1('DELETE FROM worker_locations WHERE worker_id = ?;', [workerId]);
    return { acknowledged: true, deletedCount: 1 };
  },
};

/**
 * D1 Ticket Message Client compatible with Mongoose model methods.
 */
export const D1TicketMessage = {
  async create(data) {
    const id = Number(data.id);
    const ticketId = Number(data.ticketId);
    const senderId = Number(data.senderId);
    const senderRole = String(data.senderRole);
    const message = String(data.message);
    const readByStr = JSON.stringify(Array.isArray(data.readBy) ? data.readBy : []);
    const createdAtMs = data.createdAt ? new Date(data.createdAt).getTime() : Date.now();

    const sql = `
      INSERT INTO ticket_messages (id, ticket_id, sender_id, sender_role, message, read_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *;
    `;
    const results = await queryD1(sql, [
      id,
      ticketId,
      senderId,
      senderRole,
      message,
      readByStr,
      createdAtMs,
    ]);
    return mapMessageRow(results[0]);
  },

  find(filter = {}) {
    let limitCount = 200;
    const ticketId = filter.ticketId ? Number(filter.ticketId) : null;

    const execute = async () => {
      let sql = 'SELECT * FROM ticket_messages';
      const params = [];
      if (ticketId) {
        sql += ' WHERE ticket_id = ?';
        params.push(ticketId);
      }
      sql += ' ORDER BY created_at ASC LIMIT ?;';
      params.push(limitCount);

      const results = await queryD1(sql, params);
      return results.map(mapMessageRow);
    };

    const queryObj = {
      sort(_opts) {
        return queryObj;
      },
      limit(n) {
        limitCount = Number(n) || 200;
        return queryObj;
      },
      then(resolve, reject) {
        return execute().then(resolve, reject);
      },
    };

    return queryObj;
  },

  findOne(filter = {}, projection = {}) {
    let orderDesc = false;

    const execute = async () => {
      let sql = 'SELECT * FROM ticket_messages';
      if (orderDesc) {
        sql += ' ORDER BY id DESC LIMIT 1;';
      } else {
        sql += ' LIMIT 1;';
      }
      const results = await queryD1(sql, []);
      return mapMessageRow(results[0]);
    };

    const queryObj = {
      sort(opts) {
        if (opts && opts.id === -1) orderDesc = true;
        return queryObj;
      },
      lean() {
        return queryObj;
      },
      then(resolve, reject) {
        return execute().then(resolve, reject);
      },
    };

    return queryObj;
  },

  async deleteMany(filter = {}) {
    if (filter.ticketId) {
      if (typeof filter.ticketId === 'object' && Array.isArray(filter.ticketId.$in)) {
        const ids = filter.ticketId.$in.map(Number).filter(Number.isFinite);
        if (ids.length) {
          const placeholders = ids.map(() => '?').join(', ');
          await queryD1(`DELETE FROM ticket_messages WHERE ticket_id IN (${placeholders});`, ids);
        }
      } else {
        const id = Number(filter.ticketId);
        await queryD1('DELETE FROM ticket_messages WHERE ticket_id = ?;', [id]);
      }
    }
    return { acknowledged: true };
  },
};
