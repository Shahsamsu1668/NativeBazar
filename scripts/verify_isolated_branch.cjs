const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', 'server_data', 'test_branch.env') });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  console.error('TEST_DATABASE_URL not found.');
  process.exit(1);
}

// Check host without exposing credentials
const parsed = new URL(testUrl);
const host = parsed.hostname;

console.log('=== STAGE A: ISOLATED BRANCH VERIFICATION ===');
console.log('Compute Hostname:', host);

const isProductionHost = host.includes('ep-orange-forest');
const isTestBranchHost = host.includes('ep-snowy-mode');

console.log('Points to Production Endpoint (ep-orange-forest):', isProductionHost);
console.log('Points to Isolated Test Endpoint (ep-snowy-mode):', isTestBranchHost);

if (isProductionHost || !isTestBranchHost) {
  console.error('CRITICAL SAFETY STOP: Connection is NOT pointing to the isolated test branch compute!');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: testUrl,
  ssl: { rejectUnauthorized: false }
});

async function verifyDb() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT current_database() as db, current_user as usr, version() as ver, NOW() as ts');
    console.log('\n--- Metadata from Isolated Test Branch ---');
    console.log('Database Name:', res.rows[0].db);
    console.log('Connected User:', res.rows[0].usr);
    console.log('Server Timestamp:', res.rows[0].ts);
    console.log('Branch State: READY & VERIFIED');
  } finally {
    client.release();
    await pool.end();
  }
}

verifyDb().catch(e => console.error('Connection verification failed:', e.message));

