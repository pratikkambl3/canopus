/* ================================================================
   CANOPUS — Environment Variable Loader Helper
   Resolves and loads .env from multiple candidate paths across
   workspace, root, and backend directories seamlessly.
   Supports both 'dotenv' library and a zero-dependency fallback parser.
   ================================================================ */

const path = require('path');
const fs = require('fs');

let dotenv = null;
try {
  dotenv = require('dotenv');
} catch {
  // Optional: fallback parser used if dotenv package is not installed locally
}

let loaded = false;

function parseEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = line.substring(0, eqIdx).trim();
      let val = line.substring(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'),    // canopus/.env
    path.resolve(__dirname, '../../../.env'),   // workspace root .env
    path.resolve(__dirname, '../.env'),        // backend/.env
  ];

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      if (dotenv && typeof dotenv.config === 'function') {
        dotenv.config({ path: envPath });
      } else {
        parseEnvFile(envPath);
      }
      loaded = true;
    }
  }

  if (!loaded && dotenv && typeof dotenv.config === 'function') {
    dotenv.config();
  }
}

// Auto-run on import
loadEnv();

module.exports = { loadEnv, parseEnvFile };
