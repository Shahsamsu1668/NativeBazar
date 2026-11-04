const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', 'NativeBazar', '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
}

async function searchSupplier() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT id, name, phone, role, shop_name FROM users WHERE name ILIKE '%meghna%' OR phone ILIKE '%9900%' OR shop_name ILIKE '%meghna%'");
    console.log('Search meghna in Neon:', res.rows);

    const jsonDb = JSON.parse(require('fs').readFileSync(path.resolve(__dirname, '..', 'server_data', 'db.json'), 'utf8'));
    const jsonUser = jsonDb.users.find(u => u.id === 'user-supplier-meghna' || (u.phone && u.phone.includes('9900')));
    console.log('user-supplier-meghna in JSON DB:', jsonUser);

    const sqliteDb = new (require('better-sqlite3'))(path.resolve(__dirname, '..', 'nativebazar.db'), { readonly: true });
    const sqliteUser = sqliteDb.prepare("SELECT * FROM users WHERE id = 'user-supplier-meghna' OR phone LIKE '%9900%'").get();
    console.log('user-supplier-meghna in SQLite:', sqliteUser);
  } finally {
    client.release();
    await pool.end();
  }
}

searchSupplier().catch(e => console.error(e));

