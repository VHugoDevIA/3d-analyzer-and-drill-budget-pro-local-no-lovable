# Auditoria Técnica

Data: 2026-04-25

## Sumário

O projeto está numa fase funcional de protótipo avançado: já tem importação CSV/JSON/STEP, visualização 3D, tabela de furos, editor de preços e orçamento. A base técnica é adequada, mas ainda precisa de estabilização em documentação, testes, dependências e separação de responsabilidades.

## Estado Validado

```text
TypeScript direto: OK
ESLint: sem erros depois da correção inicial
ESLint warnings: 7 warnings de Fast Refresh em shadcn/ui
Vitest/build no ambiente local: bloqueado por spawn EPERM ao arrancar esbuild
npm audit: 53 vulnerabilidades reportadas antes de remediação
npm outdated: bloqueado por EPERM na cache npm local
```

## Pontos Fortes

- Stack moderna e adequada para uma app local de análise visual.
- Separação inicial entre tipos, parsers, cálculo de orçamento e componentes.
- Importação direta de STEP com `occt-import-js` e WebAssembly.
- Interface já orientada a fluxos reais: importar, alinhar, analisar, filtrar e orçamentar.
- Teste unitário existente para filtragem de profundidade.

## Riscos Técnicos

### 1. Lógica central concentrada

`src/pages/Index.tsx` concentra estado, conversão de features em furos, deduplicação, alinhamento e fluxo da aplicação.

Risco: alterações pequenas podem afetar várias partes da experiência.

Recomendação: extrair gradualmente hooks e funções puras, por exemplo:

```text
useHoleAnalysis
useImportedFile
hole-deduplication.ts
hole-axis.ts
```

### 2. Deteção STEP sensível

`src/lib/step-loader.ts` tem heurísticas geométricas extensas. É normal neste domínio, mas precisa de fixtures e testes para evitar regressões.

Risco: uma melhoria para um modelo pode estragar outro.

Recomendação: criar uma coleção pequena de modelos STEP ou fixtures simplificadas com resultados esperados.

### 3. Configuração TypeScript permissiva

O projeto ainda tem `strict: false`, `noImplicitAny: false` e `strictNullChecks: false` no `tsconfig`.

Risco: bugs de dados nulos ou formatos externos entram tarde, já na UI.

Recomendação: apertar TypeScript por fases, começando por `src/lib`.

### 4. Dependências e segurança

O `npm audit` reportou vulnerabilidades em dependências diretas e transitivas, incluindo Vite/esbuild, React Router, Recharts/lodash e ferramentas de desenvolvimento.

Risco: exposição em dev server, cadeia de build ou dependências sem correção imediata.

Recomendação: tratar numa branch dedicada de upgrades, com validação funcional.

### 5. Ambiente local Windows

`test` e `build` bloquearam com `spawn EPERM` no arranque do `esbuild`.

Risco: confundir problema da máquina local com problema do código.

Recomendação: usar GitHub Actions como validação neutra e documentar troubleshooting.

## Dívida Técnica Conhecida

- Warnings Fast Refresh em componentes shadcn/ui.
- Logs `console.log`/`console.error` em fluxo STEP e páginas.
- Pouca cobertura de testes para cálculo, parsers e deteção geométrica.
- README anterior estava vazio.
- Dois lockfiles Bun conviviam com `package-lock.json`, criando ambiguidade.

## Critério de Estabilização

Uma versão estável de base técnica deve cumprir:

```text
npm run lint       sem erros
npm run typecheck  OK
npm run test       OK em CI
npm run build      OK em CI
README e docs      atualizados
um gestor oficial  npm
```
