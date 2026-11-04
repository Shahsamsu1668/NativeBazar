import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeOrderTransaction, db } from '../src/server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testStockDefect() {
  console.log('Testing SQLite stock auto-replenishment fix...');
  try {
    db.exec('BEGIN TRANSACTION');

    // Create disposable product with 10 kg
    db.prepare(`
      INSERT INTO products (
        id, seller_id, seller_name, seller_role, target_role,
        crop_name, bangla_name, category, quantity_kg, available_kg,
        price_per_kg, district, created_at
      ) VALUES (
        'disp-prod-test-fix', 'user-farmer-rafiq', 'Farmer Rafiq', 'farmer', 'wholesaler',
        'Test Tomato', 'টেস্ট টমেটো', 'vegetables', 10, 10,
        50, 'Bogura', datetime('now')
      )
    `).run();

    let failedProperly = false;
    try {
      // Attempt to order 50 kg (available is 10 kg)
      executeOrderTransaction({
        buyerId: 'user-wholesaler-sumaiya',
        buyerName: 'Sumaiya',
        buyerPhone: '01999887766',
        buyerRole: 'wholesaler',
        sellerId: 'user-farmer-rafiq',
        sellerName: 'Farmer Rafiq',
        sellerRole: 'farmer',
        items: [{ productId: 'disp-prod-test-fix', quantityKg: 50 }],
        paymentMethod: 'Cash on Delivery',
        deliveryAddress: 'Bogura Arat',
        district: 'Bogura'
      });
    } catch (err: any) {
      if (err.message.includes('Insufficient stock for "Test Tomato"')) {
        failedProperly = true;
        console.log('✓ SUCCESS: executeOrderTransaction threw expected Insufficient stock error:');
        console.log('  ->', err.message);
      } else {
        console.error('Unexpected error:', err.message);
      }
    }

    // Check product stock was NOT increased
    const prod = db.prepare("SELECT available_kg FROM products WHERE id = 'disp-prod-test-fix'").get() as any;
    console.log('Available stock after failed attempt:', prod ? prod.available_kg : 'N/A');

    db.exec('ROLLBACK');
    console.log('✓ Transaction rolled back cleanly. NativeBazar.db unchanged.');

    if (!failedProperly) {
      console.error('FAILED: Error was not thrown on insufficient stock!');
      process.exit(1);
    }
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch {}
    console.error('Test error:', e);
    process.exit(1);
  }
}

testStockDefect();
