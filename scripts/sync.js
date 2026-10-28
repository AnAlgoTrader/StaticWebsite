const fs = require('fs');
const path = require('path');
const { fetchFlexReport } = require('../lib/flex');
const { parseFlexXML } = require('../lib/parser');

// Load .env if present (convenient for local CLI runs)
try {
  require('dotenv').config();
} catch (e) {}

const DATA_DIR = path.join(__dirname, '..', 'data');
const TRADES_FILE = path.join(DATA_DIR, 'trades.json');
const STATUS_FILE = path.join(DATA_DIR, 'status.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

async function run() {
  ensureDataDir();

  const token = process.env.FLEX_TOKEN;
  const queryId = process.env.FLEX_QUERY_ID;
  const version = process.env.FLEX_VERSION || '3';

  if (!token || !queryId) {
    console.log('⚠️ Notice: FLEX_TOKEN or FLEX_QUERY_ID is not configured in environment secrets.');
    console.log('Skipping IBKR Flex download. Existing trade records in data/trades.json will be retained.');

    if (!fs.existsSync(STATUS_FILE)) {
      let tradeCount = 0;
      if (fs.existsSync(TRADES_FILE)) {
        try {
          tradeCount = JSON.parse(fs.readFileSync(TRADES_FILE, 'utf8')).length;
        } catch (e) {}
      }
      fs.writeFileSync(STATUS_FILE, JSON.stringify({
        hasToken: false,
        hasQuery: false,
        lastSync: new Date().toISOString(),
        tradeCount,
        staticMode: true,
        source: 'static-build'
      }, null, 2));
    }
    return;
  }

  console.log(`Starting IBKR Flex fetch for Query ID: ${queryId}...`);
  try {
    const xml = await fetchFlexReport({ token, queryId, version });
    console.log(`Downloaded statement XML (${xml.length} bytes).`);

    const trades = parseFlexXML(xml);
    console.log(`Parsed ${trades.length} futures trades.`);

    fs.writeFileSync(TRADES_FILE, JSON.stringify(trades, null, 2));

    const status = {
      hasToken: true,
      hasQuery: true,
      lastSync: new Date().toISOString(),
      tradeCount: trades.length,
      staticMode: true,
      source: 'github-actions'
    };
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));

    console.log(`✅ Successfully updated ${TRADES_FILE} and ${STATUS_FILE}`);
  } catch (err) {
    console.error(`❌ IBKR Flex Sync Error:`, err.message);
    if (fs.existsSync(TRADES_FILE)) {
      console.warn('Preserving existing data/trades.json file so dashboard remains populated.');
    } else {
      process.exit(1);
    }
  }
}

run();
