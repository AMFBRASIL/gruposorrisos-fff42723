# Pedidos com CSV e atendimento por fornecedor

## Objetivo
Modernizar a tela de pedidos e o cadastro por etapas, mantendo o visual do Grupo Sorrisos. A equipe pode montar uma lista manualmente ou importar um CSV. Nos pedidos externos, um fornecedor definido responde com seus preços — pela própria área ou por um arquivo importado pela equipe.

## 1. Dois atendimentos claramente separados
- **Pedido interno:** filial solicita materiais ao Centro de Distribuição; mantém aprovação, separação, expedição e recebimento existentes.
- **Pedido ao fornecedor:** filial escolhe um fornecedor antes de montar a lista; segue conferência dos preços, aprovação da compra, envio e recebimento.
- Não enviar pedidos externos para o fluxo de separação do CD nem criar duas entradas de estoque para a mesma entrega.
- A tela de Pedidos terá filtros por atendimento, filial, fornecedor, situação, prioridade e prazo; lista e Kanban mostram responsável, itens, total e pendências.

## 2. Novo pedido em cinco etapas
1. **Identificação:** filial, solicitante, CD ou fornecedor definido, prioridade, prazo e observações.
2. **Origem dos materiais:** escolha entre catálogo manual e arquivo CSV; permitir complementar a importação manualmente.
3. **Materiais e conciliação:** conferir correspondências, quantidades, unidades e eventuais preços; corrigir ou excluir linhas antes de adicioná-las ao pedido.
4. **Condições:** entrega e observações comerciais para pedidos externos; notas de atendimento para pedidos internos.
5. **Revisão:** tabela com código, material, unidade, quantidade, saldo atual da filial, disponibilidade no CD quando aplicável, preço unitário e subtotal; totais de quantidade separados por unidade e total monetário. Valores do cadastro são estimativas, distintos dos preços confirmados pelo fornecedor.

O modal mantém tamanho grande, imagem lateral, etapas e resumo; os materiais já escolhidos ficam marcados. Salvar rascunho não envia ao fornecedor nem altera estoque.

## 3. Importação segura de CSV
- Modelo para download com código, código de barras, material, unidade, quantidade e preço unitário opcional.
- Reconhecer CSV separado por ponto e vírgula ou vírgula, campos entre aspas, acentos e preços brasileiros como `1.234,56`; permitir selecionar a codificação quando necessário.
- Prévia com mapeamento de colunas para aceitar arquivos de ERPs diferentes.
- Identificar primeiro por código/código de barras; depois por vínculo previamente confirmado entre o código daquele fornecedor e o catálogo do Grupo Sorrisos; por último, nome exato normalizado.
- Nomes parecidos são apenas sugestões: ambiguidades e materiais não encontrados exigem escolha humana, nunca cadastro ou substituição automática.
- Validar números, unidades, duplicidades e campos obrigatórios. Mostrar erro por linha; somente linhas válidas e confirmadas entram na lista.
- Limites iniciais: 5 MB e 2.000 linhas por arquivo. Preservar códigos com zeros à esquerda e proteger exportações contra fórmulas de planilha.
- Preços importados não alteram o custo cadastrado do material. Manter origem e data dos preços no pedido.

## 4. Área interna por fornecedor
- Tela de Fornecedores com busca, contato, pedidos abertos, valores em negociação e prazos.
- Ao abrir um fornecedor, listar somente os pedidos destinados a ele.
- A equipe pode importar o CSV recebido ou preencher preços manualmente.
- CSV de resposta é conciliado apenas com os materiais daquele pedido; itens extras são sinalizados e não acrescentados silenciosamente.
- Conferência lado a lado entre lista solicitada e resposta: preço anterior, preço proposto, diferença, quantidade, unidade e disponibilidade informada.
- Confirmar a resposta registra uma nova versão; não apaga silenciosamente preços anteriores nem aprova a compra.

## 5. Área do próprio fornecedor
- Acesso individual vinculado ao fornecedor; sem seletor que permita trocar de empresa.
- Ver apenas os pedidos e materiais destinados à sua empresa, sem estoque interno, pedidos de concorrentes ou valores de outros fornecedores.
- Abrir solicitação, baixar lista, importar CSV de preços ou responder manualmente; revisar antes de enviar.
- Situações: aguardando resposta → resposta recebida → em conferência → aprovada → enviada para atendimento → recebida parcialmente/concluída; correções retornam ao fornecedor com motivo.
- Mudanças após envio geram nova versão; após aprovação, mudanças comerciais exigem nova conferência e aprovação.
- Somente a equipe autorizada aprova a compra e confirma o recebimento. O envio de preços pelo fornecedor nunca movimenta estoque.

## Entrega por fases
**Fase 1 — Demonstração:** novo wizard, CSV real processado no navegador, conciliação, revisão enriquecida e área interna por fornecedor, com dados em memória como hoje. Prévia da área do fornecedor será explicitamente demonstrativa, sem alegar isolamento seguro entre empresas.

**Fase 2 — Acesso externo real:** ativar Lovable Cloud, login individual, vínculo usuário–fornecedor, pedidos e versões salvos, histórico e validações no servidor. Essa fase é necessária antes de convidar fornecedores reais e será tratada como migração do modo demonstrativo; não expor dados externos por uma simples tela simulada.

## Detalhes técnicos
- Reutilizar WizardShell, CurrencyInput e componentes existentes; R$ com ponto nos milhares e vírgula nos centavos.
- Usar uma biblioteca estabelecida para parsing CSV; regras de correspondência e conciliação em funções puras testáveis, fora da interface.
- Manter pedidos internos separados de ordens de compra externas, conectados na tela sem duplicar os registros operacionais.
- Na fase real, acesso por fornecedor e filial é validado no servidor e nas políticas de dados; identidade nunca vem de um fornecedor selecionado no navegador.
- Registrar importações, respostas e revisões sem incluir credenciais ou dados sensíveis nos logs.

## Verificação
- Testar códigos com zeros, preços brasileiros, delimitadores, campos entre aspas, nomes ambíguos, unidades incompatíveis, linhas duplicadas, limites e erros sem importação parcial silenciosa.
- Testar que resposta de preço não aprova compra, não altera custo cadastrado e não muda estoque.
- Conferir no navegador: criar pedido por CSV, resolver correspondências, enviar, importar resposta do fornecedor e consultar revisão e valores; repetir em celular.
- Na fase real, verificar com duas contas que um fornecedor não consegue ler ou alterar pedidos do outro.