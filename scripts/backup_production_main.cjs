const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pg = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

async function runBackup() {
  const connStr = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connStr || !connStr.includes('ep-raspy-hat-b3y04kgr')) {
    throw new Error('SAFETY STOP: Not pointing to production main compute ep-raspy-hat-b3y04kgr');
  }

  const pool = new pg.Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    console.log('Connected to Neon production main branch...');
    const timestamp = new Date().toISOString();
    const backupDir = path.resolve(__dirname, '..', '..', 'NativeBazar_backups');
    fs.mkdirSync(backupDir, { recursive: true });

    // 1. Get all tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log('Tables found on main:', tables);

    // 2. Extract column definitions & constraints & rows
    let sqlDump = `-- NEON PRODUCTION MAIN BACKUP\n-- Generated: ${timestamp}\n-- Branch: main (br-square-mud-b3mncdyw)\n-- Compute: ep-raspy-hat-b3y04kgr\n\nBEGIN;\n\n`;
    const fullJson = {
      timestamp,
      branch: 'main',
      compute: 'ep-raspy-hat-b3y04kgr',
      snapshotId: 'snap-empty-credit-b3g2fgcc',
      tables: {}
    };

    for (const tbl of tables) {
      const colsRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tbl]);

      const rowsRes = await client.query(`SELECT * FROM public."${tbl}"`);
      console.log(`  Table '${tbl}': ${rowsRes.rows.length} rows`);

      fullJson.tables[tbl] = {
        columns: colsRes.rows,
        rowCount: rowsRes.rows.length,
        rows: rowsRes.rows
      };

      sqlDump += `-- Table: ${tbl} (rows: ${rowsRes.rows.length})\n`;
      for (const row of rowsRes.rows) {
        const keys = Object.keys(row);
        const colNames = keys.map(k => `"${k}"`).join(', ');
        const vals = keys.map(k => {
          const v = row[k];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'boolean' || typeof v === 'number') return String(v);
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
          return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ');
        sqlDump += `INSERT INTO public."${tbl}" (${colNames}) VALUES (${vals}) ON CONFLICT DO NOTHING;\n`;
      }
      sqlDump += '\n';
    }

    sqlDump += 'COMMIT;\n';

    const sqlFile = path.join(backupDir, 'neon_main_pre_migration_backup_20261103.sql');
    const jsonFile = path.join(backupDir, 'neon_main_pre_migration_backup_20261103.json');

    fs.writeFileSync(sqlFile, sqlDump, 'utf8');
    fs.writeFileSync(jsonFile, JSON.stringify(fullJson, null, 2), 'utf8');

    const sqlSize = fs.statSync(sqlFile).size;
    const jsonSize = fs.statSync(jsonFile).size;
    const sqlHash = crypto.createHash('sha256').update(fs.readFileSync(sqlFile)).digest('hex');
    const jsonHash = crypto.createHash('sha256').update(fs.readFileSync(jsonFile)).digest('hex');

    console.log('\n=== PRODUCTION BACKUP SUMMARY ===');
    console.log('Location:', backupDir);
    console.log('SQL Dump File:', sqlFile);
    console.log('SQL File Size:', sqlSize, 'bytes');
    console.log('SQL SHA-256 Checksum:', sqlHash);
    console.log('JSON File:', jsonFile);
    console.log('JSON File Size:', jsonSize, 'bytes');
    console.log('JSON SHA-256 Checksum:', jsonHash);
    console.log('Neon Snapshot ID: snap-empty-credit-b3g2fgcc');

    // Validation
    if (sqlSize === 0 || jsonSize === 0) {
      throw new Error('Backup validation failed: backup files are empty');
    }
    if (fullJson.tables['users'].rowCount !== 42 || fullJson.tables['sessions'].rowCount !== 26) {
      throw new Error(`Backup validation failed: expected 42 users and 26 sessions, got ${fullJson.tables['users'].rowCount} and ${fullJson.tables['sessions'].rowCount}`);
    }
    console.log('✓ Validation PASSED: 42 users and 26 sessions verified intact in backup.');
  } finally {
    client.release();
    await pool.end();
  }
}

runBackup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});

