# Hooks Locais

O projeto inclui hooks versionados em `.githooks/`.

## Ativar

```bash
npm run hooks:install
```

Depois disso, o Git passa a usar os hooks deste repositório.

## Pré-commit

O hook `.githooks/pre-commit` corre:

```bash
npm run lint
npm run typecheck
```

Isto é intencionalmente mais leve do que `npm run check`.

Analogia simples:

```text
pre-commit = verificar portas e janelas antes de sair
CI         = inspeção completa da casa
```

## Quando Usar `npm run check`

Antes de abrir PR ou entregar uma alteração:

```bash
npm run check
```

Se `test` ou `build` falharem com `spawn EPERM` no Windows, registar o bloqueio e confirmar no GitHub Actions.

## Desativar Temporariamente

Só em casos excecionais:

```bash
git commit --no-verify
```

Se isto for usado, explicar o motivo na mensagem da tarefa ou PR.
