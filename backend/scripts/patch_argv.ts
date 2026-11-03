import fs from 'fs';
import path from 'path';

const scriptPath = path.resolve(__dirname, 'UPLODSCRIP.ts');
let raw = fs.readFileSync(scriptPath, 'utf8');
const isCrlf = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

function normalizeStr(str: string): string {
  return str.replace(/\r\n/g, '\n');
}

const target = normalizeStr(`  // 1. Parse CLI Arguments (Supports: [filePath] [projectCode] OR --file=... --project=... --dry-run)
  const args = process.argv.slice(2);
  let explicitFilePath: string | null = null;
  let explicitProject: string | null = null;
  const isDryRun = args.includes('--dry-run') || args.includes('-d');
  if (isDryRun) {
    console.log(\`\${YELLOW}\${BOLD}🧪 RUNNING IN DRY RUN MODE (No database writes will occur)\${RESET}
\`);
  }

  for (let aIdx = 0; aIdx < args.length; aIdx++) {
    const arg = args[aIdx].trim();
    if (arg.startsWith('--file=')) {
      explicitFilePath = arg.split('=')[1].trim();
    } else if (arg === '--file' || arg === '-f') {
      if (args[aIdx + 1]) {
        explicitFilePath = args[aIdx + 1].trim();
        aIdx++;
      }
    } else if (arg.startsWith('--project=')) {
      explicitProject = arg.split('=')[1].trim();
    } else if (arg === '--project' || arg === '-p') {
      if (args[aIdx + 1]) {
        explicitProject = args[aIdx + 1].trim();
        aIdx++;
      }
    } else if (arg.endsWith('.csv') || arg.endsWith('.tsv') || arg.endsWith('.txt')) {
      explicitFilePath = arg;
    } else if (!explicitProject && !arg.startsWith('-')) {
      explicitProject = arg;
    }
  }

  // 2. Resolve Input File
  const defaultFilePath = path.join(__dirname, 'labor_data.csv');
  const masterSheetPath = path.join(__dirname, 'Company labour Master Upload Sheet.csv');
  let targetFilePath = explicitFilePath ? path.resolve(explicitFilePath) : defaultFilePath;

  if (explicitFilePath && !fs.existsSync(targetFilePath)) {
    const relativeToScripts = path.join(__dirname, explicitFilePath);
    if (fs.existsSync(relativeToScripts)) {
      targetFilePath = relativeToScripts;
    }
  }

  // Fallback to Company labour Master Upload Sheet if labor_data.csv does not exist or has 0/sample rows
  if (!explicitFilePath && !fs.existsSync(defaultFilePath) && fs.existsSync(masterSheetPath)) {
    targetFilePath = masterSheetPath;
  }`);

const replacement = normalizeStr(`  // 1. Parse CLI Arguments (Supports: [filePath] [projectCode] OR --file=... --project=... --dry-run)
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || args.includes('-d');
  if (isDryRun) {
    console.log(\`\${YELLOW}\${BOLD}🧪 RUNNING IN DRY RUN MODE (No database writes will occur)\${RESET}\\n\`);
  }

  // 2. Resolve Input File (Smart detection handling spaces, quotes, and defaults)
  const defaultFilePath = path.join(__dirname, 'labor_data.csv');
  const masterSheetPath = path.join(__dirname, 'Company labour Master Upload Sheet.csv');
  let explicitFilePath: string | null = null;
  let explicitProject: string | null = null;

  // Match any file argument (even if split by spaces by the shell)
  for (let i = 0; i < args.length; i++) {
    for (let j = args.length; j > i; j--) {
      const candidate = args.slice(i, j).join(' ').replace(/^[\\"'\\\`]+|[\\"'\\\`]+$/g, '').trim();
      if (!candidate || candidate.startsWith('-')) continue;
      if (fs.existsSync(candidate)) {
        explicitFilePath = path.resolve(candidate);
        args.splice(i, j - i);
        break;
      } else if (fs.existsSync(path.join(__dirname, candidate))) {
        explicitFilePath = path.join(__dirname, candidate);
        args.splice(i, j - i);
        break;
      }
    }
    if (explicitFilePath) break;
  }

  // Look for project argument in remaining args
  for (const a of args) {
    if (a.startsWith('--project=')) {
      explicitProject = a.split('=')[1].trim();
    } else if (!a.startsWith('-')) {
      explicitProject = a.trim();
    }
  }

  let targetFilePath = explicitFilePath;
  if (!targetFilePath) {
    // If Company labour Master Upload Sheet exists, prioritize it for upload
    if (fs.existsSync(masterSheetPath)) {
      targetFilePath = masterSheetPath;
    } else {
      targetFilePath = defaultFilePath;
    }
  }`);

if (content.includes(target)) {
  content = content.replace(target, replacement);
  console.log('✓ Successfully updated argument parsing in UPLODSCRIP.ts');
} else {
  console.warn('✗ Could not match target in UPLODSCRIP.ts');
}

const finalContent = isCrlf ? content.replace(/\n/g, '\r\n') : content;
fs.writeFileSync(scriptPath, finalContent, 'utf8');

