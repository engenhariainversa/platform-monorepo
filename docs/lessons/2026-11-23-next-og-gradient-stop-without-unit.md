# next/og: gradiente com parada sem unidade derruba a imagem, e o erro chega como 200

## Sintoma
`GET /apresentacoes/<slug>/og.png` fecha a conexão sem corpo (`curl` mostra `000`, um `HEAD` responde 200) e o log do Next traz
`⨯ Error: failed to pipe response` com `[cause]: Error: 0): Missing )` e `source: '0)'`,
com a pilha em `next/dist/compiled/@vercel/og/index.node.js`.

## Causa
Duas coisas somadas:

1. O parser de gradientes do Satori embutido no Next 14.2 não aceita uma parada de cor com `0` sem unidade.
   `radial-gradient(circle at 2px 2px, rgba(...) 2px, transparent 0)` é CSS válido no navegador, mas ali o
   `0)` final sobra e o parser acusa parêntese faltando.
2. `ImageResponse` renderiza de forma preguiçosa, dentro do stream do corpo. Os cabeçalhos (200, `image/png`)
   já saíram quando o Satori falha, então o erro não vira 500: vira um 200 com corpo truncado.

## Correção
- `apps/landing/lib/og-card.tsx`: toda parada de gradiente com unidade ou porcentagem (`transparent 7%`, nunca `transparent 0`).
- `apps/landing/app/apresentacoes/[slug]/og.png/route.tsx`: `await image.arrayBuffer()` antes de responder e devolver
  um `Response` com o buffer. Uma falha de renderização passa a ser um 500 de verdade, que nenhum scraper guarda como card.

## Evidência
Antes: `curl -s -o og.png -w "%{http_code} %{size_download}\n" http://localhost:4052/apresentacoes/curta/og.png` → `000 0`.
Depois: `200 238210`, `content-type: image/png`, tanto em `next dev` quanto em `next build` + `next start`.
