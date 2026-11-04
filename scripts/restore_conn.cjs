const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function restore() {
  await pool.query(`
    INSERT INTO connections (
      id, requester_id, requester_name, requester_role, requester_phone, requester_district,
      recipient_id, recipient_name, recipient_role, recipient_phone, recipient_district,
      status, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
    ) ON CONFLICT (id) DO NOTHING;
  `, [
    'conn-1792735087425-hs2i',
    'user-farmer-rafiq', 'Md. Rafiqul Islam', 'farmer', '01712458920', 'Bogura',
    'user-wholesaler-sumaiya', 'Sumaiya Islam', 'wholesaler', '01711209934', 'Bogura',
    'pending', '2026-10-23T05:58:07.425Z'
  ]);
  const c = await pool.query('SELECT count(*) FROM connections');
  console.log('Restored connections count:', c.rows[0].count);
  await pool.end();
}
restore();

