const axios = require('axios');
const { URLSearchParams } = require('url');

const FLEX_BASE = 'https://gdcdyn.interactivebrokers.com/Universal/servlet';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendRequest({ token, queryId, version = '3' }) {
  const params = new URLSearchParams({
    t: token,
    q: queryId,
    v: version
  });

  const url = `${FLEX_BASE}/FlexStatementService.SendRequest?${params.toString()}`;
  try {
    const res = await axios.get(url, { timeout: 30000 });
    const text = res.data;

    if (typeof text === 'string') {
      if (text.includes('ErrorCode') || text.includes('<Status>Fail')) {
        throw new Error(text);
      }
      const refMatch = text.match(/<ReferenceCode>([^<]+)<\/ReferenceCode>/i);
      if (refMatch) {
        return refMatch[1];
      }
    }

    throw new Error('Unable to get ReferenceCode from SendRequest response: ' + text);
  } catch (err) {
    if (err.response && err.response.data) {
      throw new Error(String(err.response.data));
    }
    throw err;
  }
}

async function getStatement({ token, referenceCode, version = '3', maxRetries = 12, retryDelayMs = 3000 }) {
  const params = new URLSearchParams({
    t: token,
    q: referenceCode,
    v: version
  });

  const url = `${FLEX_BASE}/FlexStatementService.GetStatement?${params.toString()}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.get(url, { timeout: 30000 });
      const text = res.data;

      if (typeof text === 'string') {
        // ErrorCode 1003 or "Statement is being generated" is normal while IBKR prepares the report
        if (text.includes('1003') || text.toLowerCase().includes('being generated') || text.toLowerCase().includes('in progress')) {
          if (attempt < maxRetries) {
            console.log(`IBKR report is generating (attempt ${attempt}/${maxRetries}). Waiting ${retryDelayMs / 1000}s...`);
            await sleep(retryDelayMs);
            continue;
          }
        }

        if (text.includes('ErrorCode') || text.includes('<Status>Fail')) {
          throw new Error(text);
        }

        if (text.trim().startsWith('<')) {
          return text;
        }
        return text;
      }

      throw new Error('Unexpected response from GetStatement');
    } catch (err) {
      const errStr = (err.response && err.response.data) ? String(err.response.data) : err.message;
      if ((errStr.includes('1003') || errStr.toLowerCase().includes('being generated')) && attempt < maxRetries) {
        console.log(`IBKR report is generating (attempt ${attempt}/${maxRetries}). Waiting ${retryDelayMs / 1000}s...`);
        await sleep(retryDelayMs);
        continue;
      }
      if (attempt >= maxRetries) throw new Error(errStr);
      await sleep(retryDelayMs);
    }
  }
}

async function fetchFlexReport({ token, queryId, version = '3' }) {
  const ref = await sendRequest({ token, queryId, version });
  const xml = await getStatement({ token, referenceCode: ref, version });
  return xml;
}

module.exports = {
  sendRequest,
  getStatement,
  fetchFlexReport
};
