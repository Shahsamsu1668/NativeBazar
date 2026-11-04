const fs = require('fs');
const dotenv = require('dotenv');
const Database = require('better-sqlite3');
const { Pool } = require('pg');

const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({
  connectionString: env.TEST_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const sqliteDb = new Database('nativebazar.db', { readonly: true });
const jsonDb = JSON.parse(fs.readFileSync('server_data/db.json', 'utf8'));

async function inspectMigrationCompleteness() {
  console.log('=== DATA MIGRATION COMPLETENESS AUDIT ===\n');

  // 1. SQLite Inspection
  console.log('--- 1. SQLITE SOURCE (nativebazar.db) ---');
  const sqliteTables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(t => t.name);
  const sqliteCounts = {};
  for (const t of sqliteTables) {
    const c = sqliteDb.prepare(`SELECT count(*) as count FROM "${t}"`).get().count;
    sqliteCounts[t] = c;
  }
  console.table(sqliteCounts);

  // 2. JSON Source Inspection
  console.log('\n--- 2. JSON SOURCE (server_data/db.json) ---');
  const jsonCounts = {};
  for (const k of Object.keys(jsonDb)) {
    if (Array.isArray(jsonDb[k])) {
      jsonCounts[k] = jsonDb[k].length;
    } else if (typeof jsonDb[k] === 'object' && jsonDb[k] !== null) {
      jsonCounts[k] = Object.keys(jsonDb[k]).length + ' (keys)';
    } else {
      jsonCounts[k] = typeof jsonDb[k];
    }
  }
  console.table(jsonCounts);

  // 3. Neon Destination Inspection
  console.log('\n--- 3. NEON TEST BRANCH (dev-migration-test) ---');
  const neonTablesRes = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  const neonTables = neonTablesRes.rows.map(r => r.table_name);
  const neonCounts = {};
  for (const t of neonTables) {
    const res = await pool.query(`SELECT count(*)::int as count FROM "${t}"`);
    neonCounts[t] = res.rows[0].count;
  }
  console.table(neonCounts);

  // 4. Detailed Cross-Source Mapping & Reconciliation
  console.log('\n--- 4. CROSS-SOURCE RECONCILIATION ---');
  
  // Users
  const sqliteUsers = sqliteDb.prepare('SELECT id, phone, role, name FROM users').all();
  const jsonUsers = jsonDb.users || [];
  const neonUsers = (await pool.query('SELECT id, phone, role, name FROM users')).rows;

  console.log(`Users: SQLite=${sqliteUsers.length}, JSON=${jsonUsers.length}, Neon=${neonUsers.length}`);

  // Products
  const sqliteProducts = sqliteDb.prepare('SELECT id, crop_name, seller_id, available_kg FROM products').all();
  const jsonCrops = jsonDb.crops || [];
  const jsonSupplierProducts = jsonDb.supplierProducts || [];
  const neonProducts = (await pool.query('SELECT id, crop_name, seller_id, available_qty FROM products')).rows;

  console.log(`Products: SQLite=${sqliteProducts.length}, JSON crops=${jsonCrops.length}, JSON supplierProducts=${jsonSupplierProducts.length}, Neon products=${neonProducts.length}`);

  // Orders
  const sqliteOrders = sqliteDb.prepare('SELECT id, total_bdt, delivery_status FROM orders').all();
  const jsonOrders = jsonDb.orders || [];
  const neonOrders = (await pool.query('SELECT id, total_bdt, delivery_status FROM orders')).rows;

  console.log(`Orders: SQLite=${sqliteOrders.length}, JSON=${jsonOrders.length}, Neon=${neonOrders.length}`);

  // Wholesaler Offers / Bids
  const sqliteOffers = sqliteDb.prepare('SELECT id, crop_name, quantity_kg_needed FROM wholesaler_offers').all();
  const jsonBids = jsonDb.wholesalerBids || [];
  const neonOffers = (await pool.query('SELECT id, crop_name, quantity_kg_needed FROM wholesaler_offers')).rows;

  console.log(`Wholesaler Offers/Bids: SQLite=${sqliteOffers.length}, JSON=${jsonBids.length}, Neon=${neonOffers.length}`);

  // Market Prices / Rates
  const sqliteRates = sqliteDb.prepare('SELECT * FROM market_prices').all();
  const jsonRates = jsonDb.marketRates || [];
  const neonRates = (await pool.query('SELECT * FROM market_prices')).rows;

  console.log(`Market Prices/Rates: SQLite=${sqliteRates.length}, JSON=${jsonRates.length}, Neon=${neonRates.length}`);
  if (sqliteRates.length > 0) {
    console.log('Sample SQLite market price columns:', Object.keys(sqliteRates[0]));
  }
  if (neonRates.length > 0) {
    console.log('Sample Neon market price columns:', Object.keys(neonRates[0]));
  }

  // Messages
  const jsonMessages = jsonDb.messages || [];
  const neonMessages = (await pool.query('SELECT count(*)::int as c FROM messages')).rows[0].c;
  console.log(`Messages: JSON=${jsonMessages.length}, Neon=${neonMessages}`);

  // Connections
  const jsonConnections = jsonDb.connections || [];
  const neonConnections = (await pool.query('SELECT count(*)::int as c FROM connections')).rows[0].c;
  console.log(`Connections: JSON=${jsonConnections.length}, Neon=${neonConnections}`);

  // Notifications
  const jsonNotifications = jsonDb.notifications || [];
  const neonNotifications = (await pool.query('SELECT count(*)::int as c FROM notifications')).rows[0].c;
  console.log(`Notifications: JSON=${jsonNotifications.length}, Neon=${neonNotifications}`);

  // Catalog
  const neonCatalog = (await pool.query('SELECT count(*)::int as c FROM catalog')).rows[0].c;
  console.log(`Master Catalog: Neon=${neonCatalog}`);

  // Reviews
  const jsonReviews = jsonDb.reviews || [];
  const neonReviews = (await pool.query('SELECT count(*)::int as c FROM reviews')).rows[0].c;
  console.log(`Reviews: JSON=${jsonReviews.length}, Neon=${neonReviews}`);

  // Call Logs
  const neonCallLogs = (await pool.query('SELECT count(*)::int as c FROM call_logs')).rows[0].c;
  console.log(`Call Logs: Neon=${neonCallLogs}`);

  // Farmer Expenses
  const neonExpenses = (await pool.query('SELECT count(*)::int as c FROM farmer_expenses')).rows[0].c;
  console.log(`Farmer Expenses: Neon=${neonExpenses}`);

  // Negotiations
  const neonNegotiations = (await pool.query('SELECT count(*)::int as c FROM negotiations')).rows[0].c;
  console.log(`Negotiations: Neon=${neonNegotiations}`);

  await pool.end();
}

inspectMigrationCompleteness().catch(err => {
  console.error('Migration completeness inspection error:', err);
  process.exit(1);
});
