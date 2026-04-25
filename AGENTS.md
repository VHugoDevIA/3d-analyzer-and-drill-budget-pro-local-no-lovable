# Instruções para Agentes

Atua sempre em Português de Portugal, com tom prático, claro e pedagógico. Assume que o utilizador está a aprender e explica decisões com exemplos simples quando isso ajuda.

## Contexto do Projeto

DrillAnalyzer Pro é uma aplicação Vite + React + TypeScript para:

- importar CSV/JSON/STEP;
- detetar e classificar furos;
- visualizar modelos 3D;
- calcular orçamentos por regras configuráveis.

O gestor oficial é `npm`. Não introduzir Bun, Yarn ou pnpm sem decisão explícita.

## Comandos Base

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npm run check
```

Se `test` ou `build` falharem com `spawn EPERM`, registar como problema de ambiente e confirmar `lint` + `typecheck`.

## Regras de Edição

- Antes de alterar código, ler os ficheiros envolvidos e perceber o fluxo atual.
- Manter alterações pequenas e focadas.
- Não reverter alterações de outra pessoa.
- Não misturar upgrades de dependências com refactors funcionais.
- Preservar a lógica de negócio quando a tarefa for documentação, automação ou qualidade.
- Usar comentários só quando o código não for autoexplicativo.

## Qualidade Esperada

Antes de terminar uma alteração técnica:

```text
lint sem erros
typecheck OK
testes executados ou bloqueio documentado
build executado ou bloqueio documentado
```

Warnings de Fast Refresh nos componentes shadcn/ui são dívida técnica conhecida. Não os tratar como falha bloqueante salvo se a tarefa for refactor de UI base.

## Cuidados com Geometria STEP

O ficheiro `src/lib/step-loader.ts` é sensível. Alterações nesta zona devem ser pequenas, testáveis e bem documentadas.

Analogia simples: a deteção de furos funciona como procurar tubos cilíndricos dentro da peça. Se a regra for demasiado aberta, apanha superfícies exteriores; se for demasiado fechada, perde furos reais.

Ao mexer nesta área:

- confirmar unidades em milímetros;
- validar normais/eixos;
- testar passantes, cegos e oblíquos;
- evitar logs ruidosos em produção;
- preferir funções pequenas e fixtures de teste.

## Cuidados com Orçamentos

O orçamento depende de:

```text
furo -> regra de preço -> preço por furo + preço por mm
```

Ao alterar regras:

- manter comportamento previsível quando não há regra;
- testar limites mínimos/máximos;
- documentar precedência se houver sobreposição de regras.

## Documentação

Documentar em Português de Portugal. Para mudanças importantes, atualizar:

- `README.md`;
- `docs/auditoria-tecnica.md`, se for uma descoberta/risco;
- `docs/plano-correcoes.md`, se alterar prioridades;
- `docs/roadmap.md`, se mudar direção de produto.

Quando explicar alterações ao utilizador, mostrar o essencial em formato antes/depois sempre que for útil:

```text
Antes: lint falhava com 5 erros.
Depois: lint passa sem erros, mantendo 7 warnings conhecidos.
```
