import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldLabel, OptionCard, ReviewGrid, WizardFooter, WizardShell, selectCls } from "@/components/erp-wizard";
import { automationsStore } from "@/lib/store";
import { AUTOMATION_MODULES, actionsFor, eventById, moduleById } from "@/lib/automation-catalog";
import { COLUMNS, priorityMeta, type ActionType, type AutomationRule, type Priority } from "@/lib/mock-data";

const STEPS = [
  { title: "Módulo", desc: "Escolha de qual parte do sistema a regra escuta", icon: AUTOMATION_MODULES[0].icon },
  { title: "Quando", desc: "O acontecimento que dispara a automação", icon: AUTOMATION_MODULES[1].icon },
  { title: "Ação", desc: "O que o sistema faz em seguida", icon: AUTOMATION_MODULES[2].icon },
  { title: "Revisão", desc: "Nome, descrição e conferência antes de salvar", icon: AUTOMATION_MODULES[6].icon },
];

function payloadFor(type: ActionType, config: { status: string; priority: string; title: string }): Record<string, string> {
  if (type === "move_status") return { to: config.status };
  if (type === "set_priority") return { value: config.priority };
  if (type === "create_task" && config.title.trim()) return { title: config.title.trim() };
  return {};
}

function Form({ open, rule, onClose }: { open: boolean; rule: AutomationRule | null; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [moduleId, setModuleId] = useState(rule?.module || "tarefas");
  const [trigger, setTrigger] = useState(rule?.trigger || moduleById(rule?.module).events[0].id);
  const [config, setConfig] = useState<Record<string, string>>(rule?.triggerConfig ?? { days: "0" });
  const initialActions = rule?.actions.map((item) => item.type).filter((item) => actionsFor(rule?.module || "tarefas").some((action) => action.id === item)) ?? ["notify"];
  const [selected, setSelected] = useState<ActionType[]>(initialActions.length ? initialActions : ["notify"]);
  const [actionConfig, setActionConfig] = useState({
    status: rule?.actions.find((item) => item.type === "move_status")?.payload.to || "analise",
    priority: rule?.actions.find((item) => item.type === "set_priority")?.payload.value || "alta",
    title: rule?.actions.find((item) => item.type === "create_task")?.payload.title || "",
  });
  const [name, setName] = useState(rule?.name ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const currentModule = moduleById(moduleId);
  const currentEvent = currentModule.events.find((item) => item.id === trigger) ?? currentModule.events[0];
  const availableActions = actionsFor(moduleId);
  const chooseModule = (id: string) => {
    setModuleId(id);
    const events = moduleById(id).events;
    const nextTrigger = events.some((item) => item.id === trigger) ? trigger : events[0].id;
    setTrigger(nextTrigger);
    const allowed = new Set(actionsFor(id).map((item) => item.id));
    setSelected((current) => current.filter((item) => allowed.has(item)));
  };
  const toggle = (id: ActionType) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const save = () => {
    if (!name.trim() || !selected.length) return;
    const kept = (rule?.actions ?? []).filter((item) => !availableActions.some((action) => action.id === item.type) && !actionsFor("tarefas").some((action) => action.id === item.type));
    const next = {
      module: moduleId,
      name: name.trim(),
      description: description.trim(),
      trigger: currentEvent.id,
      triggerConfig: config,
      actions: [...selected.map((type) => ({ type, payload: { ...(rule?.actions.find((item) => item.type === type)?.payload ?? {}), ...payloadFor(type, actionConfig) } })), ...kept],
    };
    if (rule) automationsStore.updateRule(rule.id, next);
    else automationsStore.addRule({ ...next, id: `auto_${Date.now().toString(36)}`, enabled: true, conditions: [], runs: 0, createdAt: new Date().toISOString().slice(0, 10), color: currentModule.id === "estoque" ? "oklch(0.62 0.16 155)" : "oklch(0.65 0.14 230)" });
    onClose();
  };
  const canNext = step === 2 ? selected.length > 0 : step === 3 ? name.trim().length > 0 : true;
  return (
    <WizardShell open={open} onClose={onClose} badge={rule ? "Editar automação" : "Nova automação"} headline={<>Quando acontecer,<br /><span className="opacity-60">o sistema faz.</span></>} sub={currentModule.label} steps={STEPS} step={step} setStep={setStep} footer={<WizardFooter step={step} last={3} setStep={setStep} onClose={onClose} onFinish={save} finishLabel={rule ? "Salvar alterações" : "Criar e ativar"} canNext={canNext} />}>
      {step === 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {AUTOMATION_MODULES.map((item) => <OptionCard key={item.id} selected={moduleId === item.id} onClick={() => chooseModule(item.id)} icon={item.icon} title={item.label} desc={item.desc} />)}
        </div>
      )}
      {step === 1 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {currentModule.events.map((item) => <OptionCard key={item.id} selected={currentEvent.id === item.id} onClick={() => setTrigger(item.id)} icon={item.icon} title={item.label} desc={item.desc} />)}
          </div>
          {(currentEvent.id === "due_soon" || currentEvent.id === "overdue") && (
            <div className="max-w-xs">
              <FieldLabel>Dias {currentEvent.id === "due_soon" ? "antes do prazo" : "após o vencimento"}</FieldLabel>
              <Input type="number" min={0} value={config.days || "0"} onChange={(event) => setConfig({ ...config, days: event.target.value })} />
            </div>
          )}
          {currentEvent.id === "status_change" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>De</FieldLabel>
                <select value={config.from || ""} onChange={(event) => setConfig({ ...config, from: event.target.value })} className={selectCls}>
                  <option value="">Qualquer coluna</option>
                  {COLUMNS.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Para</FieldLabel>
                <select value={config.to || ""} onChange={(event) => setConfig({ ...config, to: event.target.value })} className={selectCls}>
                  <option value="">Qualquer coluna</option>
                  {COLUMNS.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      )}
      {step === 2 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {availableActions.map((item) => <OptionCard key={item.id} selected={selected.includes(item.id)} onClick={() => toggle(item.id)} icon={item.icon} title={item.label} desc={item.desc} />)}
          </div>
          {(selected.includes("move_status") || selected.includes("set_priority") || selected.includes("create_task")) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {selected.includes("move_status") && (
                <div>
                  <FieldLabel>Mover para</FieldLabel>
                  <select value={actionConfig.status} onChange={(event) => setActionConfig({ ...actionConfig, status: event.target.value })} className={selectCls}>
                    {COLUMNS.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
                  </select>
                </div>
              )}
              {selected.includes("set_priority") && (
                <div>
                  <FieldLabel>Prioridade</FieldLabel>
                  <select value={actionConfig.priority} onChange={(event) => setActionConfig({ ...actionConfig, priority: event.target.value })} className={selectCls}>
                    {(Object.keys(priorityMeta) as Priority[]).map((item) => <option key={item} value={item}>{priorityMeta[item].label}</option>)}
                  </select>
                </div>
              )}
              {selected.includes("create_task") && (
                <div className="sm:col-span-2">
                  <FieldLabel>Título da tarefa</FieldLabel>
                  <Input value={actionConfig.title} maxLength={160} onChange={(event) => setActionConfig({ ...actionConfig, title: event.target.value })} placeholder="Se ficar vazio, usa o nome do acontecimento" />
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">A regra avisa e pode abrir uma tarefa. Ela não recebe estoque, não aprova orçamento e não muda a etapa de um pedido sozinha.</p>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <FieldLabel>Nome</FieldLabel>
            <Input autoFocus value={name} maxLength={120} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Abrir tarefa quando um pedido entrar em transporte" />
          </div>
          <div>
            <FieldLabel>Descrição</FieldLabel>
            <Textarea value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} placeholder="Explique o que essa automação faz" className="min-h-24" />
          </div>
          <ReviewGrid items={[
            ["Módulo", currentModule.label],
            ["Quando", currentEvent.label],
            ["Ações", selected.map((item) => availableActions.find((action) => action.id === item)?.label ?? item).join(", ") || "Nenhuma"],
          ]} />
        </div>
      )}
    </WizardShell>
  );
}

export function AutomationWizard({ open, rule, onClose }: { open: boolean; rule: AutomationRule | null; onClose: () => void }) {
  return <Form key={`${rule?.id ?? "nova"}-${open ? "aberta" : "fechada"}`} open={open} rule={open ? rule : null} onClose={onClose} />;
}
