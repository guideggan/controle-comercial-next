# Deferred Items — Phase 03 (vendas-e-parcelas)

## [Out of scope] Mesmo bug de data em plano-comissao.repo.ts (Fase 2)

**Encontrado durante:** smoke test do plano 03-04 (verificação end-to-end contra o Neon real).

**Descrição:** `src/server/repositories/plano-comissao.repo.ts` (`criarPlanoRow`, `fecharVigencia`) passa strings `"YYYY-MM-DD"` puras para os campos `@db.Date` (`vigenciaInicio`/`vigenciaFim`) sem conversão para `Date`. Confirmado por probe direto contra o banco real: `db.planoComissao.create({ data: { vigenciaInicio: "2026-01-01" } })` lança `Invalid value for argument vigenciaInicio: premature end of input. Expected ISO-8601 DateTime` no Prisma Client 6.19.3 — o mesmo sintoma corrigido em `venda.repo.ts` neste plano (03-04).

**Por que não foi corrigido aqui:** fora do escopo de arquivos do plano 03-04 (`files_modified` não inclui `plano-comissao.repo.ts`); é uma regressão da Fase 2, não introduzida por este plano. Os testes de `plano-comissao.repo.ts`/`.service.ts` usam mocks do repo (nunca tocam o Prisma real), por isso o bug não foi pego antes.

**Impacto real:** qualquer chamada de `definirPlanoComissaoAction` (trocar/definir plano de comissão de um colaborador) contra o banco real do Neon está quebrada hoje — lança exceção ao tentar `db.planoComissao.create`/`update`. Não bloqueia a Fase 3 (venda/parcela não depende de plano de comissão), mas bloqueia a Fase 2 (COLAB-02..05) em produção.

**Fix sugerido (mesmo padrão já aplicado em venda.repo.ts):** extrair `paraDataUTC(data: string): Date` (ou compartilhar um helper único em `src/lib/`) e aplicar em `criarPlanoRow`/`fecharVigencia` antes de passar `vigenciaInicio`/`vigenciaFim` ao Prisma.

**Recomendação:** abrir um plano de correção rápido no início da Fase 4 (ou antes) para não deixar COLAB-02..05 quebrado em produção.
