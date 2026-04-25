# DrillAnalyzer Pro

Aplicação local para analisar modelos 3D e dados de furação, identificar furos, organizar a informação por eixo/diâmetro/profundidade e gerar uma estimativa de orçamento.

Pensa nela como uma pequena oficina digital:

```text
Ficheiro CSV/JSON/STEP
        |
        v
Importação e leitura dos dados
        |
        v
Deteção/classificação de furos
        |
        v
Tabela + vista 3D + estatísticas
        |
        v
Regras de preço -> orçamento
```

## Estado Atual

- Stack: Vite, React 18, TypeScript, Tailwind CSS, shadcn/ui, Three.js, React Three Fiber e `occt-import-js`.
- Gestor oficial: `npm`.
- Lockfile oficial: `package-lock.json`.
- Interface em Português, focada em análise de furação e orçamento.
- A aplicação corre no browser, mas o processamento STEP usa WebAssembly em `public/wasm/occt-import-js.wasm`.

## Instalação

```bash
npm install
npm run dev
```

Por predefinição, o Vite está configurado para usar a porta `8090`.

```text
http://localhost:8090
```

## Scripts

```bash
npm run dev        # servidor local de desenvolvimento
npm run build      # build de produção
npm run preview    # pré-visualizar build
npm run lint       # ESLint
npm run typecheck  # TypeScript sem gerar ficheiros
npm run test       # testes Vitest
npm run check      # lint + typecheck + test + build
npm run hooks:install # ativa hooks locais do repositório
```

## Formatos Suportados

### STEP/STP

Importação direta de modelos `.step` ou `.stp`. O fluxo é:

```text
STEP -> OCCT/WASM -> malha Three.js -> faces/features -> furos -> orçamento
```

Depois da importação, a aplicação pede alinhamento do modelo:

- selecionar face de topo para `Z+`;
- selecionar face de frente para `X+`;
- confirmar ou usar alinhamento automático.

### JSON

Aceita arrays diretos ou objetos com `furos`/`holes`.

Exemplo mínimo:

```json
[
  {
    "face": 1,
    "object": "peca-a",
    "x": 0,
    "y": 0,
    "z": 10,
    "diameter": 8,
    "depth": 25,
    "nx": 0,
    "ny": 0,
    "nz": 1
  }
]
```

### CSV/TXT

Aceita separadores por vírgula, ponto e vírgula ou tabulação. Os nomes das colunas podem estar em Português ou Inglês, por exemplo:

```text
Face #;Objeto;Centro X;Centro Y;Centro Z;Diâmetro (mm);Profundidade (mm);Normal X;Normal Y;Normal Z
1;peca-a;0;0;10;8;25;0;0;1
```

## Mapa da Arquitetura

```text
src/
  pages/Index.tsx              estado principal e fluxo importação/alinhamento/análise
  components/
    FileImport.tsx             entrada CSV/JSON/STEP
    AlignmentPicker.tsx        escolha visual dos eixos do modelo
    StepViewer3D.tsx           visualização Three.js
    HolesTable.tsx             tabela, seleção, filtros e ordenação
    PricingEditor.tsx          regras de preço
    BudgetView.tsx             orçamento final
    SummaryView.tsx            relatório textual
  lib/
    csv-parser.ts              normalização CSV/JSON para HoleData
    step-loader.ts             leitura STEP, geometria e deteção de features
    budget-calculator.ts       regras e cálculo de orçamento
  types/holes.ts               tipos principais da aplicação
```

## Qualidade e Validação

Validação recomendada antes de cada entrega:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Também pode usar:

```bash
npm run check
```

Nota: neste ambiente local foi observado `spawn EPERM` ao arrancar `esbuild`, bloqueando `npm run test` e `npm run build`. O `typecheck` passa e o `lint` fica sem erros, mantendo apenas warnings de Fast Refresh em componentes shadcn/ui.

## Troubleshooting

### Erro `spawn EPERM` no build/test

Normalmente está relacionado com permissões, antivírus, cache npm bloqueada ou execução de binários Node em Windows.

Passos práticos:

```bash
npm cache verify
npm install
npm run typecheck
npm run build
```

Se continuar, validar em CI/GitHub Actions para separar problema de código de problema da máquina local.

### STEP não carrega

Confirmar que existe:

```text
public/wasm/occt-import-js.wasm
```

E que a app está servida por Vite, não aberta diretamente como ficheiro HTML.

### Furos incorretos

Verificar:

- alinhamento `Z+`/`X+`;
- limiar Passante/Cego;
- dimensões do modelo em milímetros;
- faces cilíndricas muito grandes, que podem representar geometria exterior e não furos.

## Documentação Técnica

- [Auditoria técnica](docs/auditoria-tecnica.md)
- [Plano de correções](docs/plano-correcoes.md)
- [Roadmap](docs/roadmap.md)
- [Agentes e skills](docs/agentes-e-skills.md)
- [Hooks locais](docs/hooks.md)

## Boas Práticas do Projeto

- Usar `npm`, não misturar gestores de pacotes.
- Manter regras de orçamento separadas da interface.
- Testar parsers e cálculo com dados pequenos e previsíveis.
- Isolar alterações de geometria STEP em testes/fixtures próprios sempre que possível.
- Evitar refactors grandes misturados com correções de precisão geométrica.
