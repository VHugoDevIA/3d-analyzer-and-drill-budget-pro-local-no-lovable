# Roadmap

## Fase 1 - Fundação Técnica

Objetivo: tornar o projeto fácil de compreender, validar e continuar.

- README completo.
- AGENTS.md com regras de colaboração.
- Scripts `typecheck` e `check`.
- Hook local de pré-commit.
- GitHub Actions para validação.
- Lint sem erros e TypeScript OK.

## Fase 2 - Cobertura de Testes

Objetivo: proteger a lógica que calcula dinheiro e interpreta ficheiros externos.

- Testes para `budget-calculator`.
- Testes para CSV/JSON.
- Testes para eixos e ângulos.
- Fixtures pequenas para casos de furação.

## Fase 3 - Organização Interna

Objetivo: reduzir risco em alterações futuras.

- Extrair lógica de análise de `Index.tsx`.
- Isolar funções puras em `src/lib`.
- Criar hooks dedicados para importação e análise.
- Remover estilos/ficheiros herdados que já não são usados.

## Fase 4 - Precisão STEP

Objetivo: melhorar confiança na deteção automática.

- Fixtures STEP reais e sintéticas.
- Modo debug para features detetadas.
- Relatório de incerteza por furo.
- Regras claras para passante/cego/oblíquo.

## Fase 5 - Produto

Objetivo: aproximar a app de uso profissional.

- Exportação PDF/CSV do relatório.
- Guardar tabelas de preços.
- Perfis de materiais/operações.
- Histórico de análises.
- Comparação entre versões da mesma peça.

## Fase 6 - Segurança e Manutenção

Objetivo: reduzir risco acumulado.

- Remediação de `npm audit`.
- Atualização controlada de dependências.
- CI com matriz Node LTS.
- Documentação de releases.
