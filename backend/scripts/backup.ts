import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL is not set in backend/.env');
  process.exit(1);
}

// Sanitize connection URL for pg_dump (strip Prisma-specific parameters like sslaccept)
let cleanDatabaseUrl = databaseUrl;
try {
  const parsedUrl = new URL(databaseUrl);
  const allowedParams = ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslcrl', 'application_name', 'connect_timeout', 'options'];
  const keysToDelete: string[] = [];
  parsedUrl.searchParams.forEach((_, key) => {
    if (!allowedParams.includes(key.toLowerCase())) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(k => parsedUrl.searchParams.delete(k));
  if (!parsedUrl.searchParams.has('sslmode')) {
    parsedUrl.searchParams.set('sslmode', 'require');
  }
  cleanDatabaseUrl = parsedUrl.toString();
} catch (e) {
  // if url parsing fails, keep original
}

// Locate pg_dump.exe
const localPgDump = path.resolve(__dirname, '../tools/bin/pg_dump.exe');
const pgDumpExecutable = fs.existsSync(localPgDump) ? localPgDump : 'pg_dump';

const now = new Date();
const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;

const backupDir = path.resolve(__dirname, '../backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const sqlFileName = `neon_maga_backup_${timestamp}.sql`;
const sqlFilePath = path.join(backupDir, sqlFileName);

console.log('═══════════════════════════════════════════════════════════════');
console.log('📦 Starting Neon Database Backup (Method 1: SQL Dump)...');
console.log(`🕒 Timestamp: ${timestamp}`);
console.log(`📁 Destination: ${sqlFilePath}`);
console.log('═══════════════════════════════════════════════════════════════\n');

const args = [
  `--dbname=${cleanDatabaseUrl}`,
  '--format=plain',
  '--no-owner',
  '--no-privileges',
  '--verbose',
  `--file=${sqlFilePath}`
];

const proc = spawn(pgDumpExecutable, args, {
  stdio: ['ignore', 'inherit', 'pipe']
});

let stderrData = '';
proc.stderr.on('data', (data) => {
  const str = data.toString();
  stderrData += str;
  // Print verbose pg_dump progress
  process.stdout.write(str);
});

proc.on('close', (code) => {
  if (code === 0) {
    const stats = fs.statSync(sqlFilePath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ Database backup completed successfully!');
    console.log(`📄 Backup File: ${sqlFileName}`);
    console.log(`📏 File Size: ${sizeInMB} MB (${stats.size.toLocaleString()} bytes)`);
    console.log(`📍 Full Path: ${sqlFilePath}`);
    console.log('═══════════════════════════════════════════════════════════════');
  } else {
    console.error(`\n❌ Backup failed with exit code ${code}`);
    console.error(stderrData);
    process.exit(code || 1);
  }
});
