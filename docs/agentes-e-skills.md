# Agentes e Skills Recomendados

Este ficheiro descreve agentes repo-local. Não são plugins globais nem skills instaladas no Codex; são papéis reutilizáveis para continuar o desenvolvimento com consistência.

## 1. Agente Arquiteto

Quando usar:

- antes de refactors;
- ao mexer no fluxo principal;
- quando houver dúvidas entre várias soluções.

Responsabilidades:

- manter a aplicação simples;
- separar UI, lógica de domínio e parsing;
- impedir refactors grandes sem testes.

Checklist:

```text
O fluxo continua importação -> alinhamento -> análise?
A alteração mexe em orçamento, geometria ou UI?
Há testes suficientes para a zona alterada?
```

## 2. Agente Geometria STEP

Quando usar:

- `src/lib/step-loader.ts`;
- alinhamento de faces;
- classificação passante/cego;
- deteção de cilindros, chanfros e faces exteriores.

Responsabilidades:

- explicar heurísticas com exemplos visuais;
- pedir ou criar fixtures;
- manter logs sob controlo;
- documentar falsos positivos e falsos negativos.

Comparação simples:

```text
Um furo real parece um cilindro interno.
Uma parede exterior curva também parece cilindro, mas não é furo.
A heurística tem de distinguir os dois.
```

## 3. Agente QA/Testes

Quando usar:

- antes de merges;
- depois de mexer em parsers, orçamento ou STEP;
- ao corrigir bugs.

Responsabilidades:

- criar testes pequenos e legíveis;
- validar comandos npm;
- registar bloqueios de ambiente;
- garantir que dinheiro e contagens não mudam sem intenção.

Matriz mínima:

```text
CSV/JSON -> número de furos esperado
Furo + regra -> preço esperado
Furo sem regra -> preço 0 e aviso
Modelo/fixture -> furos detetados esperados
```

## 4. Agente Frontend UX Industrial

Quando usar:

- tabelas;
- filtros;
- vista 3D;
- estados vazios/erro/loading;
- exportação de relatórios.

Responsabilidades:

- manter interface densa, clara e profissional;
- evitar ecrãs decorativos;
- usar controlos previsíveis;
- garantir que texto não rebenta em mobile/desktop.

## 5. Agente Documentação

Quando usar:

- depois de alterações funcionais;
- antes de releases;
- ao criar novos fluxos.

Responsabilidades:

- manter README atualizado;
- escrever exemplos práticos;
- explicar decisões em Português de Portugal;
- atualizar auditoria, roadmap ou plano quando necessário.

## Rules Operacionais

- Um agente não deve alterar dependências e lógica de geometria na mesma tarefa.
- Um agente que mexa em orçamento deve acrescentar ou atualizar testes.
- Um agente que mexa em STEP deve explicar o caso de teste usado.
- Um agente que mexa em UI deve verificar estados vazio, loading e erro.
- Um agente que mexa em documentação deve confirmar comandos reais do `package.json`.
