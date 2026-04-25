# Plano de Correções Prioritárias

## Prioridade 0 - Base de Qualidade

- Manter `npm` como gestor oficial e remover lockfiles alternativos.
- Garantir `npm run lint` sem erros.
- Garantir `npm run typecheck` sem erros.
- Validar `npm run test` e `npm run build` em CI para contornar o bloqueio local `spawn EPERM`.
- Documentar comandos e fluxo no README.

## Prioridade 1 - Testes Essenciais

Adicionar testes unitários para:

- `calculateBudget`, incluindo furos sem regra;
- regras com limites mínimos e máximos;
- `parseCSV` com vírgula, ponto e vírgula e tabulação;
- `parseJSON` com array direto e objeto `{ furos: [...] }`;
- classificação de eixos `X/Y/Z/Obliquo`;
- deduplicação de furos, quando for extraída para função testável.

Exemplo de raciocínio:

```text
Entrada: furo Ø8, profundidade 20, regra 2.50 + 0.10/mm
Saída: 4.50 €
```

## Prioridade 2 - Separação de Responsabilidades

Extrair lógica de `Index.tsx` para módulos pequenos:

- cálculo de eixo e ângulo;
- conversão de features STEP para `HoleData`;
- deduplicação;
- gestão de fluxo importação/alinhamento/análise.

Objetivo: a página deve orquestrar, não fazer todo o trabalho.

## Prioridade 3 - Geometria STEP

- Reduzir logs diretos e criar modo debug controlado.
- Criar fixtures de modelos pequenos.
- Documentar heurísticas de rejeição: faces exteriores, chanfros, fillets e cilindros extremos.
- Testar passante/cego com espessuras conhecidas.

## Prioridade 4 - Dependências

Tratar vulnerabilidades numa branch própria:

- atualizar Vite/Vitest/esbuild quando houver caminho compatível;
- avaliar React Router e risco real da vulnerabilidade reportada;
- avaliar Recharts/lodash ou alternativa;
- correr regressão visual e funcional depois dos upgrades.

Não misturar esta fase com refactors de geometria.

## Prioridade 5 - UX Industrial

- Melhorar mensagens de erro na importação.
- Mostrar estado quando não há furos ou quando todas as regras falham.
- Permitir exportar relatório/orçamento.
- Guardar regras de preço localmente ou importar/exportar tabela de preços.
- Adicionar confirmação antes de apagar regras de preço.

## Critérios de Aceitação

```text
P0: projeto documentado, lint/typecheck OK, CI criado
P1: testes cobrem parsers e orçamento
P2: Index.tsx reduzido e lógica crítica testável
P3: alterações STEP acompanhadas de fixtures
P4: npm audit revisto e riscos registados
P5: fluxos principais mais claros para utilizador final
```
