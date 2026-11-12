import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { BookOpen, Search, ArrowUpRight, CheckCircle2, Lightbulb } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/manual-sistema')({
  head: () => ({ meta: [
    { title: 'Manual do Sistema | Grupo Sorrisos' },
    { name: 'description', content: 'Guia completo de cada módulo e tela da Plataforma Gestão Grupo Sorrisos.' },
    { property: 'og:title', content: 'Manual do Sistema | Grupo Sorrisos' },
    { property: 'og:description', content: 'O que cada tela da plataforma faz e como utilizá-la.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: Manual,
});

type Screen = { to: string; name: string; summary: string; features: string[]; steps?: string[]; tip?: string };
type Module = { id: string; name: string; intro: string; screens: Screen[] };

const modules: Module[] = [
  { id: 'principal', name: 'Principal', intro: 'Acompanhamento do trabalho diário: projetos, tarefas, agenda e horas.', screens: [
    { to: '/', name: 'Dashboard', summary: 'Visão geral da operação com indicadores, gráficos e atividades recentes.', features: ['Indicadores de projetos, tarefas e prazos', 'Gráficos de andamento e produtividade', 'Atalhos para as ações mais usadas', 'Busca geral e criação rápida de tarefas pelo topo da tela'] },
    { to: '/projetos', name: 'Projetos', summary: 'Cadastro e acompanhamento de projetos.', features: ['Criar projetos pelo assistente por etapas', 'Acompanhar progresso, responsáveis e prazos', 'Filtrar e pesquisar projetos'] },
    { to: '/templates', name: 'Templates', summary: 'Modelos reutilizáveis de projetos e tarefas.', features: ['Criar, editar e remover modelos', 'Usar um modelo para iniciar um novo projeto', 'Confirmação antes de excluir'] },
    { to: '/kanban', name: 'Kanban', summary: 'Quadro visual das tarefas por situação.', features: ['Arrastar tarefas entre colunas', 'Visualizar responsável, prioridade e prazo', 'Abrir detalhes da tarefa'] },
    { to: '/minhas-tarefas', name: 'Minhas Tarefas', summary: 'Lista das tarefas atribuídas ao usuário.', features: ['Filtrar por situação e prazo', 'Concluir tarefas', 'Iniciar o cronômetro de horas'] },
    { to: '/calendario', name: 'Calendário', summary: 'Agenda de prazos, entregas e eventos.', features: ['Visualização mensal', 'Destaque de prazos e entregas'] },
    { to: '/timesheet', name: 'Timesheet', summary: 'Registro de horas trabalhadas.', features: ['Cronômetro iniciado a partir das tarefas', 'Lançamentos por projeto e período', 'Totais de horas'] },
  ] },
  { id: 'estoque', name: 'Estoque', intro: 'Controle completo de materiais por filial e depósito, com rastreabilidade de lotes e inventários.', screens: [
    { to: '/estoque', name: 'Visão Geral', summary: 'Painel do estoque da filial selecionada.', features: ['Saldo, valor em estoque e itens abaixo do mínimo', 'Gráficos por categoria e depósito', 'Alertas de reposição e vencimento'], tip: 'Use o seletor de filial no topo para mudar a unidade analisada.' },
    { to: '/estoque-avancado', name: 'Inteligência de Estoque', summary: 'Recursos avançados para reduzir faltas e perdas.', features: ['Reposição automática sugerida por consumo', 'Leitura de código de barras pela câmera, leitor ou digitação', 'Saída por FEFO (vence primeiro, sai primeiro)', 'Consumo por procedimento odontológico', 'Previsão de cobertura em dias e curva ABC', 'Aprovação de ajustes por outra pessoa', 'Alertas por filial'] },
    { to: '/materiais', name: 'Materiais e Produtos', summary: 'Catálogo de materiais.', features: ['Botão Novo abre cadastro por etapas', 'Código, código de barras, categoria, unidade, fabricante, fornecedor e descrição', 'CA obrigatório para EPIs', 'Preço com máscara em reais', 'Indicadores e gráficos do catálogo'], steps: ['Clique em Novo material', 'Preencha identificação e classificação', 'Informe fornecedor, preço e estoque mínimo', 'Revise e salve'] },
    { to: '/movimentacoes', name: 'Movimentações', summary: 'Entradas, saídas e ajustes de estoque.', features: ['Movimentar vários materiais de uma só vez', 'Materiais adicionados ficam marcados na lista', 'Revisão mostra volume e valor antes e depois', 'Destaque de saldos que ficarão abaixo do mínimo', 'Validação de todas as linhas antes de gravar'], steps: ['Clique em Nova movimentação', 'Escolha o tipo e a filial', 'Marque os materiais e quantidades', 'Confira a revisão e confirme'] },
    { to: '/transferencias', name: 'Transferências', summary: 'Envio de materiais entre filiais e depósitos.', features: ['Assistente de transferência por etapas', 'Acompanhamento de envio e recebimento', 'Gráficos de fluxo entre unidades'] },
    { to: '/lotes-validades', name: 'Lotes e Validades', summary: 'Rastreabilidade de lotes.', features: ['Cadastro de lotes com validade', 'Alertas de vencidos e a vencer', 'Gráfico por faixa de vencimento'] },
    { to: '/inventarios', name: 'Inventários', summary: 'Contagem física do estoque.', features: ['Inventário completo de uma filial ou por categoria', 'Contagem cega (sem mostrar o saldo esperado)', 'Progresso da contagem', 'Conciliação de diferenças e geração de ajustes', 'Histórico de inventários'] },
  ] },
  { id: 'compras', name: 'Pedidos & Compras', intro: 'Do pedido da clínica até a compra, aprovação, recebimento e entrada no estoque.', screens: [
    { to: '/central-pendencias', name: 'Central de Pendências', summary: 'Tudo o que precisa da sua ação em um só lugar.', features: ['Aprovações, respostas de fornecedores, recebimentos e inventários pendentes', 'Separação entre minhas ações e pendências da equipe', 'Atalho direto para cada pedido'] },
    { to: '/orcamentos-compras', name: 'Orçamentos de Compras', summary: 'Limite mensal de gastos por filial.', features: ['Definir limite mensal por filial', 'Escolher entre apenas alertar ou bloquear aprovações', 'Acompanhar valor comprometido e saldo'] },
    { to: '/desempenho-compras', name: 'Desempenho de Compras', summary: 'Indicadores de eficiência.', features: ['Tempo médio de aprovação', 'Pedidos em atraso', 'Economia obtida nas cotações', 'Qualidade das entregas por fornecedor'] },
    { to: '/pedidos', name: 'Pedidos de Materiais', summary: 'Solicitações das filiais ao CD ou a fornecedores.', features: ['Lista e Kanban com filtros, prioridades e alertas de atraso', 'Novo pedido em 5 etapas: identificação, origem (manual ou CSV), materiais, condições e revisão', 'Importação de CSV com reconhecimento por código, código de barras ou nome', 'Revisão com saldo da filial, disponibilidade no CD, orçamento e alerta de duplicidade', 'Etapas de aprovação configuráveis com histórico e observações', 'Visão completa do pedido: aprovações, compra, entrega e estoque'], steps: ['Clique em Novo pedido', 'Escolha CD ou fornecedor', 'Adicione itens manualmente ou envie um CSV', 'Revise e envie para aprovação'], tip: 'Configurar etapas (topo da tela) define quem aprova cada etapa, por usuário ou perfil, com regras por valor, filial e categoria.' },
    { to: '/centro-distribuicao', name: 'Centro de Distribuição', summary: 'Operação do CD.', features: ['Separação e expedição dos pedidos aprovados', 'Sugestões de reposição das filiais', 'Acompanhamento do recebimento'] },
    { to: '/compras', name: 'Compras e Fornecedores', summary: 'Requisições, cotações e ordens de compra.', features: ['Nova requisição e novo fornecedor por assistente', 'Comparação de cotações com frete, prazo e avaliação', 'Conferência de recebimento parcial, itens danificados e diferenças de preço', 'Entrada no estoque somente após conferência'] },
    { to: '/fornecedores', name: 'Pedidos por Fornecedor', summary: 'Pedidos enviados a cada fornecedor e respostas de preços.', features: ['Solicitar preços e acompanhar respostas versionadas', 'Importar resposta do fornecedor em CSV', 'Conferir, pedir correção ou aprovar a compra', 'Detalhes com etapas, observações e histórico'] },
  ] },
  { id: 'ia', name: 'Automação & IA', intro: 'Regras automáticas e análises inteligentes.', screens: [
    { to: '/automacoes', name: 'Automações', summary: 'Regras do tipo “quando acontecer, faça”.', features: ['Criar, ativar, pausar e remover automações', 'Confirmação antes de excluir'] },
    { to: '/insights', name: 'IA Insights', summary: 'Análises e recomendações geradas a partir dos dados.', features: ['Destaques de riscos e oportunidades', 'Assistente de IA disponível no canto da tela'] },
  ] },
  { id: 'negocios', name: 'Negócios', intro: 'Relacionamento comercial e finanças.', screens: [
    { to: '/comercial', name: 'Comercial', summary: 'Funil de oportunidades.', features: ['Etapas do funil e valores', 'Acompanhamento de propostas'] },
    { to: '/clientes', name: 'Clientes', summary: 'Cadastro de clientes.', features: ['Empresas, contatos e histórico', 'Pesquisa e filtros'] },
    { to: '/financeiro', name: 'Financeiro', summary: 'Receitas, despesas e faturas.', features: ['Indicadores financeiros', 'Valores com máscara em reais'] },
  ] },
  { id: 'documentos', name: 'Documentos', intro: 'Arquivos, aprovações e portais externos.', screens: [
    { to: '/documentos', name: 'Documentos', summary: 'Repositório de arquivos.', features: ['Organização por projeto e tipo', 'Pesquisa de documentos'] },
    { to: '/aprovacoes', name: 'Aprovações', summary: 'Aprovação de documentos e entregas.', features: ['Aprovar ou recusar com comentário', 'Histórico das decisões'] },
    { to: '/portal-cliente', name: 'Portal do Cliente', summary: 'Área externa para clientes e fornecedores.', features: ['Aba Pedidos de Compras: responder pedidos com preços', 'Envio de CSV com preenchimento automático dos valores', 'Observações na resposta; o pedido muda para Em conferência', 'Aba de projetos, documentos e faturas'], tip: 'O Portal do Fornecedor (/portal-fornecedor) tem o mesmo funcionamento, com acesso demonstrativo.' },
  ] },
  { id: 'gestao', name: 'Gestão', intro: 'Cadastros administrativos, pessoas, permissões e relatórios.', screens: [
    { to: '/cadastros', name: 'Central de Cadastros', summary: 'Atalhos para todos os cadastros.', features: ['Fornecedores, filiais, materiais, clientes, equipe e permissões'] },
    { to: '/cadastro-fornecedores', name: 'Cadastro de Fornecedores', summary: 'Ficha completa do fornecedor.', features: ['Cadastro em 5 etapas: identificação, contato, condições comerciais, acesso ao portal e revisão', 'Permitir ou bloquear acesso ao portal, com usuário, e-mail e troca de senha', 'Quantidade de pedidos, pendentes de resposta e compras', 'Filtros por categoria e acesso ao portal'] },
    { to: '/filiais', name: 'Filiais', summary: 'Unidades do grupo e seus depósitos.', features: ['Indicadores e distribuição regional', 'Cadastro em 4 etapas: identificação, localização e gestão, depósitos e revisão', 'Página de detalhe de cada filial'] },
    { to: '/usuarios-filiais', name: 'Usuários e Permissões', summary: 'Quem acessa o quê em cada filial.', features: ['Cadastro em 3 etapas: identificação, filiais e perfis, revisão', 'Perfis diferentes por filial', 'Simulação de usuário para testes'] },
    { to: '/equipe', name: 'Equipe', summary: 'Pessoas e vínculos.', features: ['Membros, funções e carga de trabalho'] },
    { to: '/relatorios', name: 'Relatórios', summary: 'Análises consolidadas.', features: ['Gráficos e indicadores por período'] },
    { to: '/perfis', name: 'Perfis de Acesso', summary: 'Modelos de permissão.', features: ['Definir o que cada perfil pode ver e fazer'] },
  ] },
  { id: 'sistema', name: 'Sistema', intro: 'Preferências gerais da plataforma.', screens: [
    { to: '/configuracoes', name: 'Configurações', summary: 'Ajustes da plataforma.', features: ['Cada item abre um assistente grande por etapas', 'Tema claro/escuro pelo botão do topo'] },
  ] },
];

function Manual() {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return modules;
    return modules.map(m => ({ ...m, screens: m.screens.filter(s => [s.name, s.summary, ...s.features, ...(s.steps ?? []), s.tip ?? ''].join(' ').toLowerCase().includes(t)) })).filter(m => m.screens.length);
  }, [q]);
  const total = modules.reduce((n, m) => n + m.screens.length, 0);
  return (
    <AppShell title="Manual do Sistema" subtitle={`${modules.length} módulos · ${total} telas`}>
      <div className="p-4 md:p-8 space-y-6">
        <section className="rounded-lg border border-border bg-card p-6 flex flex-col md:flex-row gap-4 md:items-center">
          <BookOpen className="h-10 w-10 text-primary shrink-0" />
          <div className="flex-1 space-y-1">
            <h2 className="text-xl font-semibold">Como usar a Plataforma Gestão</h2>
            <p className="text-sm text-muted-foreground">Veja o que cada tela faz e o passo a passo das principais ações. Os dados são demonstrativos: atualizar a página reinicia as informações.</p>
          </div>
          <div className="relative md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar no manual..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </section>
        <nav className="flex flex-wrap gap-2">{filtered.map(m => <a key={m.id} href={`#${m.id}`}><Badge variant="secondary" className="cursor-pointer">{m.name} · {m.screens.length}</Badge></a>)}</nav>
        {filtered.length === 0 && <p className="text-muted-foreground">Nada encontrado para “{q}”.</p>}
        {filtered.map(m => (
          <section key={m.id} id={m.id} className="space-y-3 scroll-mt-20">
            <div><h2 className="text-lg font-semibold">{m.name}</h2><p className="text-sm text-muted-foreground">{m.intro}</p></div>
            <div className="grid lg:grid-cols-2 gap-4">
              {m.screens.map(s => (
                <article key={s.to} className="rounded-lg border border-border bg-card p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="font-semibold">{s.name}</h3><p className="text-sm text-muted-foreground">{s.summary}</p></div>
                    <Button asChild size="sm" variant="outline"><Link to={s.to}>Abrir<ArrowUpRight className="h-4 w-4" /></Link></Button>
                  </div>
                  <ul className="space-y-1.5">{s.features.map(f => <li key={f} className="flex gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />{f}</li>)}</ul>
                  {s.steps && <div><p className="text-xs font-medium uppercase text-muted-foreground mb-1">Passo a passo</p><ol className="list-decimal pl-5 text-sm space-y-0.5">{s.steps.map(x => <li key={x}>{x}</li>)}</ol></div>}
                  {s.tip && <p className="flex gap-2 text-sm rounded-md bg-muted p-3"><Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />{s.tip}</p>}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
