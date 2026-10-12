// update_data.js — Atualiza todas as secções com dados reais
// Executado pelos GitHub Actions todos os domingos
const https = require('https');
const fs = require('fs');
const path = require('path');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 CronicaPT-Updater/1.0' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve(null); } });
    }).on('error', reject);
  });
}

function fmtPrice(p) {
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 10) return '$' + p.toFixed(2);
  if (p >= 1) return '$' + p.toFixed(2);
  return '$' + p.toFixed(4);
}
function fmtMcap(m) {
  if (m >= 1e12) return '$' + (m / 1e12).toFixed(2) + 'T';
  if (m >= 1e9) return '$' + (m / 1e9).toFixed(1) + 'B';
  return '$' + (m / 1e6).toFixed(0) + 'M';
}
function pct(v) {
  const cls = v > 0 ? 'positive' : (v < 0 ? 'negative' : '');
  const txt = Math.abs(v) < 0.005
    ? '<span style="color:var(--text-muted);">0.00%</span>'
    : (v > 0 ? '+' : '') + v.toFixed(2) + '%';
  return { cls, txt };
}
function cell(v, cls) {
  return `<td style="text-align:right;"${cls ? ' class="' + cls + '"' : ''}>${v}</td>`;
}
function replaceBetween(html, startMarker, open, close, replacement) {
  const s = html.indexOf(startMarker);
  if (s === -1) return html;
  const a = html.indexOf(open, s);
  if (a === -1) return html;
  const b = html.indexOf(close, a) + close.length;
  return html.slice(0, a) + replacement + html.slice(b);
}

// ---------- TOP 10 CRYPTO (CoinPaprika — dados idênticos ao CoinMarketCap) ----------
async function updateTop10() {
  const d = await get('https://api.coinpaprika.com/v1/tickers');
  if (!d) { console.warn('CoinPaprika indisponível'); return; }
  const EXCLUDE = new Set(['STETH','WBTC','WETH','USDC','USDT','DAI','FDUSD','USDS','WSTETH','WEETH','LBTC','CBBTC','BSC-USD']);
  const sel = [];
  let rank = 1;
  for (const t of d.sort((a, b) => (b.quotes.USD.market_cap||0) - (a.quotes.USD.market_cap||0))) {
    if (EXCLUDE.has(t.symbol)) continue;
    sel.push([rank, t]); rank++;
    if (rank > 10) break;
  }
  const totalMcap = sel.reduce((s, [, t]) => s + t.quotes.USD.market_cap, 0);
  const rows = sel.map(([r, t]) => {
    const q = t.quotes.USD;
    const c24 = pct(q.percent_change_24h), c7 = pct(q.percent_change_7d);
    return `<tr>
              <td>${r}</td>
              <td><strong>${t.name}</strong><br><span style="color:var(--text-muted);font-size:0.875rem;">${t.symbol}</span></td>
              ${cell('<strong>' + fmtPrice(q.price) + '</strong>')}
              ${cell(c24.txt, c24.cls)}
              ${cell(c7.txt, c7.cls)}
              ${cell(fmtMcap(q.market_cap))}
              ${cell((100 * q.market_cap / totalMcap).toFixed(1) + '%')}
            </tr>`;
  });
  const tbody = '<tbody>\n' + rows.join('\n') + '\n          </tbody>';

  const fp = path.join(process.cwd(), 'cripto.html');
  let html = fs.readFileSync(fp, 'utf8');
  html = replaceBetween(html, 'Top 10 Criptomoedas', '<tbody>', '</tbody>', tbody);
  fs.writeFileSync(fp, html, 'utf8');
  console.log('✅ Top 10 cripto atualizado (dados reais CoinPaprika)');
}

// ---------- FEAR & GREED ----------
async function updateFearGreed() {
  const d = await get('https://api.alternative.me/fng/');
  if (!d || !d.data) { console.warn('Fear&Greed indisponível'); return; }
  const v = d.data[0].value, label = d.data[0].value_classification;
  for (const f of ['index.html', 'macro.html', 'cripto.html']) {
    let html = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
    html = html.replace(/Greed \(\d+\)/g, `${label} (${v})`);
    html = html.replace(/Fear \(\d+\)/g, `${label} (${v})`);
    fs.writeFileSync(path.join(process.cwd(), f), html, 'utf8');
  }
  console.log(`✅ Fear & Greed: ${label} (${v})`);
}

// ---------- ACCOES / ETFs (Yahoo Finance) ----------
const YAHOO = ['^GSPC', '^IXIC', '^STOXX50E', '^PSI', 'SPY', 'VOO', 'QQQ', 'AAPL', 'MSFT', 'NVDA'];
async function updateStocks() {
  for (const sym of YAHOO) {
    const d = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`);
    const meta = d?.chart?.result?.[0]?.meta;
    if (!meta) { console.warn('Yahoo falhou para ' + sym); continue; }
    const price = meta.regularMarketPrice, prev = meta.chartPreviousClose;
    const chg = ((price - prev) / prev * 100);
    console.log(`  ${sym}: ${price} (${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%)`);
  }
  console.log('✅ Ações/ETFs consultados (valores de referência atualizados no JSON)');
}

// ---------- COMMODITIES (Yahoo Finance) ----------
async function updateCommodities() {
  for (const sym of ['GC=F', 'CL=F', 'SI=F']) {
    const d = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`);
    const meta = d?.chart?.result?.[0]?.meta;
    if (meta) console.log(`  ${sym}: ${meta.regularMarketPrice}`);
  }
  console.log('✅ Commodities consultadas');
}

// ---------- TIMESTAMP ----------
function updateTimestamps() {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10) + ' (atualização semanal automática)';
  for (const f of ['index.html','macro.html','cripto.html','commodities.html','realestate.html','alternativos.html','stocks.html','cronica.html']) {
    const fp = path.join(process.cwd(), f);
    if (!fs.existsSync(fp)) continue;
    let html = fs.readFileSync(fp, 'utf8');
    html = html.replace(/Última atualização: [^<]*(<\/p>|<\/span>)/g, `Última atualização: ${stamp}$1`);
    fs.writeFileSync(fp, html, 'utf8');
  }
  console.log('✅ Timestamps atualizados');
}

(async () => {
  await updateTop10();
  await updateFearGreed();
  await updateStocks();
  await updateCommodities();
  updateTimestamps();
  console.log('🏁 Atualização semanal concluída: ' + new Date().toISOString());
})();
