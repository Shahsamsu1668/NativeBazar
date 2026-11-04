const pg = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function verifyDigestQuery() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        'users' AS table_name,
        count(*)::text AS row_count,
        encode(sha256(COALESCE(string_agg(encode(sha256(to_jsonb(u)::text::bytea), 'hex'), '' ORDER BY u.id), '')::bytea), 'hex') AS sha256_canonical_sorted_row_digest
      FROM public.users u
      UNION ALL
      SELECT 
        'sessions' AS table_name,
        count(*)::text AS row_count,
        encode(sha256(COALESCE(string_agg(encode(sha256(to_jsonb(s)::text::bytea), 'hex'), '' ORDER BY s.id), '')::bytea), 'hex') AS sha256_canonical_sorted_row_digest
      FROM public.sessions s
      UNION ALL
      SELECT 
        'login_audit_logs' AS table_name,
        count(*)::text AS row_count,
        encode(sha256(COALESCE(string_agg(encode(sha256(to_jsonb(l)::text::bytea), 'hex'), '' ORDER BY l.id), '')::bytea), 'hex') AS sha256_canonical_sorted_row_digest
      FROM public.login_audit_logs l;
    `);
    console.log('Results:');
    console.table(res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}
verifyDigestQuery().catch(console.error);
