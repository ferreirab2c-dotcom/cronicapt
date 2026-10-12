# CrónicaPT Investimento — notas operacionais

## Pipeline de atualização (update_data.js)
- Corre nos GitHub Actions (`.github/workflows/daily-update.yml`), cron `0 21 * * 0` (domingos 21h UTC/22h PT) + `workflow_dispatch`.
- Fontes: CoinPaprika (Top 10 crypto), Alternative.me (Fear&Greed), Yahoo Finance v8 chart (índices/ETFs/ações/commodities), RSS (ECO, Fed, BCE, WSJ Markets, Cointelegraph).
- PSI20: usar ticker `PSI20.LS` (o `^PSI` falha). S&P=`^GSPC`, Nasdaq=`^IXIC`, IBEX35=`^IBEX`, EuroStoxx=`^STOXX50E`.
- Sem dependências npm — apenas módulos nativos (`https`, `fs`, `path`). Validar com `node --check update_data.js`.

## Sistema de notícias semanais
- Cada página tem um bloco delimitado: `<!-- NEWS-START:<key> -->` ... `<!-- NEWS-END -->`.
- Chaves: resumo=index, macro=macro, stocks=stocks, commodities=commodities, cripto=cripto, realestate=realestate, alternativos=alternativos, geral=cronica.
- `updateWeeklyNews()` filtra feeds por palavras-chave por bucket, ordena por frescura, dedup, e substitui o conteúdo entre marcadores.
- NÃO usar `replaceBetween(html, 'NEWS-START:x', fullMarker...)`: indexOf('NEWS-START:x') aponta para dentro do próprio marcador completo e o indexOf seguinte devolve -1 (bug silencioso). Localizar o marcador completo diretamente.

## i18n (PT/EN)
- `translations.js` define `var PT_EN` (browser) — dicionário plano chave=PT, valor=EN; `script.js` traduz por nós de texto. `translations.json` é cópia para referência.
- Ao adicionar textos estáticos novos, acrescentar chaves a AMBOS os dicionários e manter vírgulas válidas (JS não termina entrada final sem `,` antes de `};`).

## Publicação
- GitHub Pages publica da branch `main`. Validar build: `GET /repos/ferreirab2c-dotcom/cronicapt/pages/builds/latest`.
- Repo: https://github.com/ferreirab2c-dotcom/cronicapt — site: https://ferreirab2c-dotcom.github.io/cronicapt/
