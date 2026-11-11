# Grupo Sorrisos — ERP Multifiliais (demonstração)

Implementação do documento "Expansão Avançada", mantendo **dados de demonstração** (sem banco/login real) e o layout atual. Cada fase fica utilizável e testável no navegador antes da próxima.

## Diagnóstico do que já existe
- Interface: menu lateral escuro por categorias, cabeçalho com título e botão principal, wizards grandes com etapas à esquerda.
- Estoque (Onda 1): visão geral, materiais, movimentações, transferências, lotes — dados de exemplo em memória, sem filiais configuráveis.
- Perfis de Acesso e Equipe já existem, mas as permissões são só por página, sem filial.
- Riscos: como os dados ficam só na sessão do navegador, recarregar a página volta ao estado inicial; as permissões não são proteção real, apenas simulação visual.

## Fase 2 — Filiais, usuários e permissões
- **Filiais** (menu Gestão): lista + wizard "Nova Filial" (dados, endereço, responsável, centro de custo, depósitos). Inativar/editar. Página de detalhes com estoque, pedidos e usuários da filial.
- **Depósitos e localizações** por filial (sem limite de quantidade).
- **Usuários por filial**: no cadastro de membro, escolher uma ou várias filiais e o papel em cada uma.
- **Perfis sugeridos** do documento (Superadmin, Diretoria, Gestor regional, Gerente de filial, Estoquista central/local, Comprador, Colaborador, Auditor) com permissões por ação (ex.: pedidos.aprovar, estoque.movimentar).
- **Seletor de filial no cabeçalho** + seletor "ver como usuário" para simular perfis; telas mostram só as filiais permitidas e escondem botões sem permissão.

## Fase 3 — Estoque por filial
- Saldos por filial/depósito/lote: disponível, reservado, em trânsito, bloqueado.
- Mínimo, máximo e ponto de reposição por filial.
- Todas as telas de estoque respeitam o seletor de filial; visão consolidada quando "Todas".

## Fase 4 — Pedidos de Materiais (módulo principal)
- Tela com indicadores, alternância Lista / Kanban, filtros (status, filial, prioridade, período).
- Wizard "Novo Pedido": cabeçalho, busca de materiais com disponibilidade, carrinho, revisão; salvar rascunho.
- Fluxo: Enviado → Aprovado (ou rejeitado/correção) → Reservado → Em separação (parcial, lote) → Em transporte → Recebido (parcial, divergência) → Concluído.
- Regras: sem expedição duplicada, sem receber acima do expedido, aprovação só por quem tem permissão, cancelamento só em estados válidos, histórico de cada etapa.
- **Painel do Centro de Distribuição**: fila de separação e expedição.

## Fase 5 — Transferências entre filiais
- Transferências integradas ao novo estoque (saída na origem, trânsito, entrada no destino), recebimento parcial.

## Fase 6 — Compras e inventários
- Fornecedores, solicitações de compra, cotações, pedidos de compra, recebimento com entrada no estoque.
- Inventário por filial: contagem, diferenças, ajuste aprovado.
- Reposição automática: sugestão de pedido quando abaixo do ponto de reposição.

## Fase 7 — Integração
- Dashboards por perfil, cartões no Kanban para pedidos, notificações no sino, relatórios por filial.

## Fase 8 — Testes
- Testes automáticos das regras: saldo nunca negativo, máquina de estados dos pedidos, recebimento ≤ expedido, usuário local não vê outra filial.

## Detalhes técnicos
- Uma camada de dados única em memória (store) para filiais, depósitos, saldos, pedidos e eventos, com funções de domínio puras (ex.: `approveOrder`, `shipOrder`) testadas com Vitest.
- O seletor de filial e o usuário simulado ficam salvos no navegador.
- As permissões são checadas nessas funções de domínio, não só escondendo botões — prontas para migrar para backend real depois.
- Unidades usadas como exemplo serão marcadas como dados fictícios.

Ordem de entrega: Fase 2 → 3 → 4 nesta sequência; 5–8 em seguida.
