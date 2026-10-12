// update_data.js — Atualiza todas as secções com dados reais
// Executado pelos GitHub Actions todos os domingos (21h UTC)
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

// ---------- ÍNDICES, AÇÕES E ETFs (Yahoo Finance) ----------
const INDICES = [
  { sym: 'PSI20.LS',  key: 'psi20', nome: 'PSI20' },
  { sym: '^IBEX',     key: 'ibex',  nome: 'IBEX35' },
  { sym: '^GSPC',     key: 'gspc',  nome: 'S&P 500' },
  { sym: '^IXIC',     key: 'ixic',  nome: 'Nasdaq' },
  { sym: '^STOXX50E', key: 'stoxx', nome: 'Euro Stoxx 50' },
];
const STOCKS = [
  { sym: 'NVDA', nome: 'NVIDIA (NVDA)',        sub: 'Semicondutores AI' },
  { sym: 'AMD',  nome: 'AMD (AMD)',            sub: 'Semicondutores' },
  { sym: 'META', nome: 'Meta Platforms (META)', sub: 'Social Media + AI' },
  { sym: 'AAPL', nome: 'Apple (AAPL)',         sub: 'Consumer Tech' },
  { sym: 'TSLA', nome: 'Tesla (TSLA)',         sub: 'EV + Autonomy' },
];
const ETFS = [
  { sym: 'VWCE.DE', nome: 'VWCE — Vanguard FTSE All-World', sub: 'Global ACWI UCITS', nota: '✅ Recomendado PT', eur: true },
  { sym: 'IWDA.AS', nome: 'iShares Core MSCI World (IWDA)', sub: 'Developed Markets', nota: '✅ Excelente alternativa', eur: true },
  { sym: 'EQQQ.DE', nome: 'Invesco NASDAQ 100 (EQQQ)',      sub: 'Tech Heavy',        nota: '⚡ Tech focus', eur: true },
  { sym: 'SUSW.L',  nome: 'iShares MSCI World SRI (SUSW)',  sub: 'ESG Global',        nota: '🌱 Sustentável', eur: true },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function yahooQuote(sym) {
  const d = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`);
  const meta = d && d.chart && d.chart.result && d.chart.result[0] && d.chart.result[0].meta;
  if (!meta || !meta.regularMarketPrice) return null;
  const price = meta.regularMarketPrice;
  const prev = meta.chartPreviousClose || meta.previousClose || price;
  return { price, chg: (price - prev) / prev * 100 };
}

function indexRow(nome, flag, sub, q) {
  if (!q) return '';
  const c = pct(q.chg);
  const tend = c.cls === 'positive' ? '<span style="color:var(--green);">🔺 Alta</span>' : (c.cls === 'negative' ? '<span style="color:var(--red);">↓ Baixa</span>' : '<span style="color:var(--text-muted);">→ Lateral</span>');
  return `<tr>
            <td><strong>${flag} ${nome}</strong><br><span style="color:var(--text-muted);font-size:0.875rem;">${sub}</span></td>
            <td style="text-align:right;"><strong>${Math.round(q.price).toLocaleString('en-US')}</strong></td>
            ${cell(c.txt, c.cls)}
            <td style="text-align:right;">—</td>
            <td>${tend}</td>
          </tr>`;
}

function etfRow(i, e, q) {
  if (!q) return '';
  const c = pct(q.chg);
  const cur = e.eur ? '€' : '$';
  return `<tr>
            <td>${i}</td>
            <td><strong>${e.nome}</strong><br><span style="color:var(--text-muted);font-size:0.875rem;">${e.sub}</span></td>
            <td style="text-align:right;">${cur}${q.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            ${cell(c.txt, c.cls)}
            <td style="text-align:right;">—</td>
            <td style="color:var(--blue);">${e.nota}</td>
          </tr>`;
}

function stockRow(s, q) {
  if (!q) return '';
  const c = pct(q.chg);
  return `<tr>
            <td><strong>${s.nome}</strong><br><span style="color:var(--text-muted);font-size:0.875rem;">${s.sub}</span></td>
            <td style="text-align:right;"><strong>$${q.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
            <td style="text-align:right;">—</td>
            ${cell(c.txt, c.cls)}
            <td style="font-size:0.875rem;">Cotação automática de ${new Date().toISOString().slice(0, 10)}</td>
          </tr>`;
}

async function updateMarkets(dataOut) {
  const fp = path.join(process.cwd(), 'stocks.html');
  let html = fs.readFileSync(fp, 'utf8');

  const idx = {};
  for (const cfg of INDICES) {
    idx[cfg.key] = await yahooQuote(cfg.sym);
    if (idx[cfg.key]) console.log(`  ${cfg.nome}: ${idx[cfg.key].price.toFixed(2)} (${idx[cfg.key].chg >= 0 ? '+' : ''}${idx[cfg.key].chg.toFixed(2)}%)`);
    else console.warn(`Yahoo falhou para ${cfg.sym}`);
    await sleep(1200);
  }
  const flags = { psi20: '🇵🇹', ibex: '🇪🇸', gspc: '🇺🇸', ixic: '🇺🇸', stoxx: '🇪🇺' };
  const subs  = { psi20: 'Portugal', ibex: 'Espanha', gspc: 'EUA Large Cap', ixic: 'Nasdaq Composite', stoxx: 'Europa Blue Chip' };
  const iRows = INDICES.map(c => indexRow(c.nome, flags[c.key], subs[c.key], idx[c.key])).filter(Boolean).join('\n          ');
  if (iRows) html = replaceBetween(html, 'Índices Principais', '<tbody>', '</tbody>',
    '<tbody>\n          ' + iRows + '\n        </tbody>');

  const etf = {};
  for (const cfg of ETFS) {
    etf[cfg.sym] = await yahooQuote(cfg.sym);
    if (etf[cfg.sym]) console.log(`  ${cfg.nome}: ${etf[cfg.sym].price.toFixed(2)}`);
    await sleep(1200);
  }
  const eRows = ETFS.map((e, i) => etfRow(i + 1, e, etf[e.sym])).filter(Boolean).join('\n          ');
  if (eRows) html = replaceBetween(html, 'Maiores ETFs Mundiais', '<tbody>', '</tbody>',
    '<tbody>\n          ' + eRows + '\n        </tbody>');

  const st = {};
  for (const cfg of STOCKS) {
    st[cfg.sym] = await yahooQuote(cfg.sym);
    if (st[cfg.sym]) console.log(`  ${cfg.nome}: $${st[cfg.sym].price.toFixed(2)}`);
    await sleep(1200);
  }
  const sRows = STOCKS.map(s => stockRow(s, st[s.sym])).filter(Boolean).join('\n          ');
  if (sRows) html = replaceBetween(html, 'Principais Ações por Mercado', '<tbody>', '</tbody>',
    '<tbody>\n          ' + sRows + '\n        </tbody>');

  fs.writeFileSync(fp, html, 'utf8');
  console.log('✅ stocks.html atualizado (índices + ETFs + ações reais Yahoo)');

  dataOut['indices'] = idx;
  dataOut['etfs'] = etf;
  dataOut['stocks'] = st;
}

// ---------- COMMODITIES (Yahoo Finance) ----------
const COMMOD = [
  { sym: 'GC=F', key: 'gold',    nome: 'Ouro' },
  { sym: 'SI=F', key: 'silver',  nome: 'Prata' },
  { sym: 'CL=F', key: 'wti',     nome: 'Petróleo WTI' },
  { sym: 'BZ=F', key: 'brent',   nome: 'Brent' },
  { sym: 'NG=F', key: 'gas',     nome: 'Gás Natural' },
  { sym: 'HG=F', key: 'copper',  nome: 'Cobre' },
  { sym: 'KC=F', key: 'coffee',  nome: 'Café' },
  { sym: 'ZW=F', key: 'wheat',   nome: 'Trigo' },
  { sym: 'PL=F', key: 'platina', nome: 'Platina' },
];

function commodRow(nome, sub, q, cur, unid) {
  if (!q) return '';
  const c = pct(q.chg);
  const tend = c.cls === 'positive' ? '<span style="color:var(--green);">↑ Alta</span>' : (c.cls === 'negative' ? '<span style="color:var(--red);">↓ Baixa</span>' : '<span style="color:var(--text-muted);">→ Estável</span>');
  return `<tr>
            <td><strong>${nome}</strong><br><span style="color:var(--text-muted);font-size:0.875rem;">${sub}</span></td>
            <td style="text-align:right;">${cur}${q.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}${unid}</td>
            ${cell(c.txt, c.cls)}
            <td>${tend}</td>
          </tr>`;
}

async function updateCommodities(dataOut) {
  const d = {};
  for (const cfg of COMMOD) {
    d[cfg.key] = await yahooQuote(cfg.sym);
    if (d[cfg.key]) console.log(`  ${cfg.nome}: ${d[cfg.key].price} (${d[cfg.key].chg >= 0 ? '+' : ''}${d[cfg.key].chg.toFixed(2)}%)`);
    await sleep(1200);
  }

  const fp = path.join(process.cwd(), 'commodities.html');
  let html = fs.readFileSync(fp, 'utf8');

  if (d.gold) {
    html = html.replace('$4,321', '$' + Math.round(d.gold.price).toLocaleString('en-US'));
    html = html.replace('$4,163.20/oz', '$' + d.gold.price.toFixed(2) + '/oz');
  }
  if (d.silver) html = html.replace('$60.47/oz', '$' + d.silver.price.toFixed(2) + '/oz');
  if (d.wti) {
    html = html.replace('$92.41', '$' + d.wti.price.toFixed(2));
    html = html.replace('$91.58/bbl', '$' + d.wti.price.toFixed(2) + '/bbl');
  }
  if (d.brent) html = html.replace('$95.42/bbl', '$' + d.brent.price.toFixed(2) + '/bbl');
  if (d.gas) html = html.replace('$3.02/MMBtu', '$' + d.gas.price.toFixed(2) + '/MMBtu');

  const rows = [
    commodRow('Cobre (Cu)', 'Metal industrial chave', d.copper, '$', '/lb'),
    commodRow('Café (KC)', 'Exportações brasileiras', d.coffee, '$', '/lb'),
    commodRow('Trigo (ZW)', 'Alimentos/grãos', d.wheat, '$', '/bu'),
    commodRow('Platina (PL)', 'Metal precioso industrial', d.platina, '$', '/oz'),
  ].filter(Boolean).join('\n          ');
  if (rows) html = replaceBetween(html, 'Outras Commodities Importantes', '<tbody>', '</tbody>',
    '<tbody>\n          ' + rows + '\n        </tbody>');

  fs.writeFileSync(fp, html, 'utf8');
  console.log('✅ commodities.html atualizado (preços reais Yahoo)');

  dataOut['commodities'] = d;
}

// ---------- TIMESTAMP + JSON ----------
function updateTimestamps(dataOut) {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10) + ' (atualização semanal automática)';
  for (const f of ['index.html','macro.html','cripto.html','commodities.html','realestate.html','alternativos.html','stocks.html','cronica.html']) {
    const fp = path.join(process.cwd(), f);
    if (!fs.existsSync(fp)) continue;
    let html = fs.readFileSync(fp, 'utf8');
    html = html.replace(/Última atualização: [^<]*(<\/p>|<\/span>)/g, `Última atualização: ${stamp}$1`);
    fs.writeFileSync(fp, html, 'utf8');
  }
  dataOut['updated'] = now.toISOString();
  fs.writeFileSync(path.join(process.cwd(), 'market_data.json'), JSON.stringify(dataOut, null, 2) + '\n');
  console.log('✅ Timestamps + market_data.json atualizados');
}

(async () => {
  const dataOut = {};
  await updateTop10();
  await updateFearGreed();
  await updateMarkets(dataOut);
  await updateCommodities(dataOut);
  updateTimestamps(dataOut);
  console.log('🏁 Atualização semanal concluída: ' + new Date().toISOString());
})();
