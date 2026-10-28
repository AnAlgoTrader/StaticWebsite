const { XMLParser } = require('fast-xml-parser');

function toNum(val) {
  if (val === undefined || val === null || val === '') return 0;
  const n = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function normalizeSymbol(row) {
  return row.symbol || row.Symbol || row.Ticker || row.ContractSymbol || row.underlyingSymbol || row.Description || '';
}

function isFutures(row) {
  const asset = (row.assetCategory || row.AssetCategory || row.assetClass || row.AssetClass || row.Asset_Category || '').toString().toUpperCase();
  const secType = (row.SecurityType || row.SecType || '').toString().toUpperCase();
  if (asset === 'FUT') return true;
  if (secType === 'FUT') return true;
  if (!asset && !secType) return true;
  return false;
}

function extractArray(obj) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  return [obj];
}

function parseFlexXML(xml) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true
  });

  const json = parser.parse(xml);
  const rawTrades = [];

  const paths = [
    json?.FlexQueryResponse?.FlexStatements?.FlexStatement?.Trades?.Trade,
    json?.FlexStatementResponse?.FlexStatements?.FlexStatement?.Trades?.Trade,
    json?.FlexStatements?.FlexStatement?.Trades?.Trade,
    json?.FlexStatement?.Trades?.Trade,
  ];

  for (const p of paths) {
    const list = extractArray(p);
    for (const row of list) {
      if (!row) continue;
      if (isFutures(row)) {
        rawTrades.push(row);
      }
    }
    if (rawTrades.length > 0) break;
  }

  if (rawTrades.length === 0) {
    const candidates = [];
    function walk(o, depth = 0) {
      if (!o || depth > 12) return;
      if (typeof o === 'object') {
        if ((o.symbol || o.Symbol) && (o.quantity !== undefined || o.Quantity !== undefined || o.tradePrice !== undefined || o.TradePrice !== undefined)) {
          candidates.push(o);
        }
        for (const k of Object.keys(o)) {
          walk(o[k], depth + 1);
        }
      }
    }
    walk(json);
    for (const c of candidates) {
      if (isFutures(c)) rawTrades.push(c);
    }
  }

  const trades = [];
  for (const row of rawTrades) {
    trades.push(normalizeTradeRow(row));
  }

  const seen = new Set();
  const deduped = [];
  for (const t of trades) {
    const key = t.tradeID || `${t.symbol}|${t.datetime}|${t.side}|${t.qty}|${t.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(t);
  }

  return deduped;
}

function normalizeTradeRow(row) {
  const symbol = normalizeSymbol(row);
  const qty = Math.abs(toNum(row.quantity || row.Quantity));
  const price = toNum(row.tradePrice || row.TradePrice || row.price || row.Price);
  const sideRaw = (row.buySell || row.BuySell || row.side || row.Side || '').toString().toUpperCase();
  const side = sideRaw.startsWith('B') ? 'BUY' : sideRaw.startsWith('S') ? 'SELL' : sideRaw;

  const datetime = row.dateTime || row.DateTime || row.tradeDate || row.TradeDate || '';
  const tradeDate = row.tradeDate || row.TradeDate || (datetime.split(';')[0]) || '';
  const tradeID = row.tradeID || row.TradeID || row.ibExecID || '';
  const orderID = row.ibOrderID || row.OrderID || '';

  const commission = Math.abs(toNum(row.ibCommission || row.commission || row.Commission));
  const fees = Math.abs(toNum(row.fees || row.Fees || 0));
  const realizedPnL = toNum(row.fifoPnlRealized || row.RealizedPnL || row.realizedPnL || 0);
  const openClose = (row.openCloseIndicator || row.OpenCloseIndicator || '').toString().toUpperCase();

  const multiplier = toNum(row.multiplier || row.Multiplier) || 1;
  const gross = qty * price * multiplier;

  let net;
  if (realizedPnL !== 0) {
    net = realizedPnL - commission - fees;
  } else if (openClose === 'O') {
    net = -commission - fees;
  } else {
    net = realizedPnL - commission - fees;
  }

  return {
    id: tradeID || `${symbol}-${datetime}-${Math.random().toString(36).slice(2,8)}`,
    symbol,
    side,
    qty,
    price,
    datetime,
    tradeDate,
    tradeID,
    orderID,
    commission,
    fees,
    realizedPnL,
    multiplier,
    gross,
    net,
    assetClass: row.assetCategory || row.AssetCategory || 'FUT',
    exchange: row.exchange || row.Exchange || '',
    description: row.description || row.Description || '',
    openClose
  };
}

module.exports = {
  parseFlexXML
};
