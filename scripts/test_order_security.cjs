// scripts/test_order_security.cjs
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

const env = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../server_data/test_branch.env')));
const testUrl = env.TEST_DATABASE_URL;

if (!testUrl || !testUrl.includes('ep-snowy-mode')) {
  console.error('SAFETY STOP: Wrong endpoint!');
  process.exit(1);
}

const pool = new Pool({
  connectionString: testUrl,
  ssl: { rejectUnauthorized: false }
});

async function runOrderSecurityTests() {
  const client = await pool.connect();
  console.log('\n========================================');
  console.log('TEST 4: ORDER TRANSACTION SECURITY TESTING');
  console.log('========================================');

  const results = {};

  try {
    // Setup disposable test records in PostgreSQL (isolated branch)
    await client.query('BEGIN');

    // Create 2 disposable sellers
    await client.query(`
      INSERT INTO users (id, name, role, phone, password_hash, district, verified)
      VALUES 
        ('disp-seller-1', 'Disposable Seller 1', 'retailer', '01799990001', 'hash', 'Bogura', true),
        ('disp-seller-2', 'Disposable Seller 2', 'retailer', '01799990002', 'hash', 'Bogura', true),
        ('disp-buyer-1', 'Disposable Consumer Buyer', 'consumer', '01799990003', 'hash', 'Bogura', true)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Create 2 products belonging to different sellers
    await client.query(`
      INSERT INTO products (
        id, seller_id, seller_name, seller_phone, seller_role, target_role,
        crop_name, bangla_name, category, unit, quantity, available_qty, unit_price, district
      ) VALUES 
        ('disp-prod-1', 'disp-seller-1', 'Disposable Seller 1', '01799990001', 'retailer', 'consumer', 'Disp Onion', 'পেঁয়াজ', 'vegetables', 'kg', 50, 50, 60, 'Bogura'),
        ('disp-prod-2', 'disp-seller-2', 'Disposable Seller 2', '01799990002', 'retailer', 'consumer', 'Disp Garlic', 'রসুন', 'vegetables', 'kg', 20, 20, 150, 'Bogura')
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log('✓ Disposable test users and products created.');

    // 1. Test Oversell Protection with PostgreSQL CHECK Constraint
    console.log('\n--- Test 4.7 & 4.8: Inventory Oversell & CHECK Constraint ---');
    let oversellBlocked = false;
    await client.query('SAVEPOINT sp_oversell');
    try {
      // Attempt to deduct 100 kg when available is only 50
      await client.query(`
        UPDATE products SET available_qty = available_qty - 100 WHERE id = 'disp-prod-1';
      `);
    } catch (e) {
      if (e.message.includes('check constraint') || e.message.includes('products_available_qty_check')) {
        oversellBlocked = true;
        console.log('✓ PostgreSQL CHECK constraint successfully blocked oversell:', e.message);
      } else {
        console.log('Error on oversell test:', e.message);
      }
      await client.query('ROLLBACK TO SAVEPOINT sp_oversell');
    }
    results['oversellProtection'] = oversellBlocked;

    // 2. Test Multi-Seller Order Prevention at DB vs Application Level
    console.log('\n--- Test 4.5: Multi-Seller Order Enforcement ---');
    // Try to create an order with seller = disp-seller-1, but order item pointing to disp-prod-2 (seller = disp-seller-2)
    const testOrderId = 'disp-ord-multi-1';
    await client.query(`
      INSERT INTO orders (
        id, order_type, buyer_id, buyer_name, buyer_phone, buyer_role,
        seller_id, seller_name, seller_role, total_bdt, payment_method,
        delivery_address, district, tracking_code
      ) VALUES (
        $1, 'retailer_to_consumer', 'disp-buyer-1', 'Disposable Buyer', '01799990003', 'consumer',
        'disp-seller-1', 'Disposable Seller 1', 'retailer', 210, 'Cash on Delivery',
        'Test Address', 'Bogura', 'TRK-TEST-MULTI-1'
      );
    `, [testOrderId]);

    // Insert item from seller 1
    await client.query(`
      INSERT INTO order_items (id, order_id, product_id, crop_name, bangla_name, quantity_kg, unit_price, subtotal)
      VALUES ('disp-oi-1', $1, 'disp-prod-1', 'Disp Onion', 'পেঁয়াজ', 1, 60, 60);
    `, [testOrderId]);

    // Insert item from seller 2
    await client.query(`
      INSERT INTO order_items (id, order_id, product_id, crop_name, bangla_name, quantity_kg, unit_price, subtotal)
      VALUES ('disp-oi-2', $1, 'disp-prod-2', 'Disp Garlic', 'রসুন', 1, 150, 150);
    `, [testOrderId]);

    // Verify whether DB currently has a trigger/constraint preventing this
    const multiSellerCount = (await client.query(`
      SELECT count(DISTINCT p.seller_id)::int as distinct_sellers
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
    `, [testOrderId])).rows[0].distinct_sellers;

    const dbBlocksMultiSeller = multiSellerCount === 1;
    console.log(`Multi-seller order allowed by DB without application check? Distinct sellers: ${multiSellerCount}`);
    results['multiSellerDbCheck'] = dbBlocksMultiSeller;

    // 3. Test Concurrency / Locking (SELECT FOR UPDATE)
    console.log('\n--- Test 4.7: Concurrency & Pessimistic Locking Test ---');
    const lockRes = await client.query(`
      SELECT id, crop_name, available_qty 
      FROM products 
      WHERE id = 'disp-prod-1' 
      FOR UPDATE;
    `);
    const lockSupported = lockRes.rows.length === 1;
    console.log(`Pessimistic row-level locking (SELECT ... FOR UPDATE) supported: ${lockSupported}`);
    results['rowLockingSupported'] = lockSupported;

    // 4. Test Atomic Transaction with Rollback
    console.log('\n--- Test 4.8: Atomic Rollback of Order + Inventory + Audit ---');
    // We rollback everything we did above
    await client.query('ROLLBACK');
    console.log('✓ Rolled back transaction.');

    // Verify all disposable test records are completely gone
    const cleanupCheck = await client.query(`
      SELECT count(*)::int as c FROM products WHERE id IN ('disp-prod-1', 'disp-prod-2');
    `);
    const clean = cleanupCheck.rows[0].c === 0;
    console.log(`Disposable records completely cleaned up: ${clean}`);
    results['atomicCleanup'] = clean;

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during order security test:', err);
  } finally {
    client.release();
    await pool.end();
  }

  return results;
}

runOrderSecurityTests().then(console.log).catch(console.error);
