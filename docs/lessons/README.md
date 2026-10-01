# Lições

Erros não óbvios que já custaram investigação, para não pagar o custo de novo.
Antes de depurar um erro estranho, procure aqui pela assinatura literal.

Um arquivo por lição: `docs/lessons/<yyyy-mm-dd>-<slug>.md`, com as seções:

- `## Sintoma` — a assinatura literal do erro (mensagem, comando que falhou).
- `## Causa` — o porquê, não só o quê.
- `## Correção` — o que foi alterado (arquivos, comandos).
- `## Evidência` — comando e saída que provam que a correção funciona.

Nunca inclua segredos (senhas, tokens, `.env`).
