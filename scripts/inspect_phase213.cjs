const Database = require('better-sqlite3');
const pg = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', 'NativeBazar', '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
}

async function inspectTaskDetails() {
  console.log('=== INSPECTION FOR PHASE 2.1.3 ===\n');

  // 1. Inspect user-supplier-meghna in Neon
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT id, role, name, name_bn, phone, email, district, upazila, shop_name, business_name, business_type, license_number, verified, security_pin FROM users WHERE id = 'user-supplier-meghna' OR phone = '01715889900'");
    console.log('--- user-supplier-meghna in Neon ---');
    console.log(JSON.stringify(res.rows, null, 2));

    // Also check all distinct roles in Neon users
    const rolesRes = await client.query('SELECT role, count(*)::int as count FROM users GROUP BY role');
    console.log('\n--- Neon user roles distribution ---');
    console.log(JSON.stringify(rolesRes.rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }

  // 2. Inspect Units in SQLite products
  const sqliteDb = new Database(path.resolve(__dirname, '..', 'nativebazar.db'), { readonly: true });
  const products = sqliteDb.prepare('SELECT id, crop_name, category, seller_role, target_role, quantity_kg, available_kg, price_per_kg FROM products').all();
  console.log('\n--- SQLite Products units / quantities sample ---');
  console.log(`Total products: ${products.length}`);
  for (const p of products.slice(0, 10)) {
    console.log(`ID: ${p.id}, crop: ${p.crop_name}, seller_role: ${p.seller_role}, qty: ${p.quantity_kg}, price: ${p.price_per_kg}`);
  }

  // Check columns in SQLite products
  const cols = sqliteDb.prepare('PRAGMA table_info("products")').all();
  console.log('\nDoes SQLite products have a "unit" column?');
  console.log(cols.map(c => c.name).includes('unit') ? 'YES' : 'NO (only quantity_kg, available_kg, min_order_kg, price_per_kg)');

  // 3. Inspect JSON supplierProducts
  const jsonDb = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'server_data', 'db.json'), 'utf8'));
  console.log('\n--- JSON supplierProducts ---');
  for (const s of jsonDb.supplierProducts) {
    console.log(`ID: ${s.id}, name: ${s.name}, unit: ${s.unit}, unitPriceBDT: ${s.unitPriceBDT}, stockQty: ${s.stockQty}, category: ${s.category}, supplierId: ${s.supplierId}`);
  }

  // 4. Inspect Master Catalog units
  const catalogUnits = new Set(jsonDb.catalog.map(c => c.unit));
  console.log('\n--- Catalog units in db.json ---', Array.from(catalogUnits));

  // 5. Inspect API endpoints for crops in server.ts
  const serverTs = fs.readFileSync(path.resolve(__dirname, '..', 'NativeBazar', 'server.ts'), 'utf8');
  const cropEndpoints = serverTs.match(/app\.(get|post|put|delete)\(['"`]\/api\/crops[\s\S]*?\}\);/g);
  console.log('\n--- Crop Endpoints in server.ts ---');
  if (cropEndpoints) {
    for (const ep of cropEndpoints) {
      console.log(ep.slice(0, 150) + '...\n');
    }
  }
}

inspectTaskDetails().catch(e => console.error(e));

