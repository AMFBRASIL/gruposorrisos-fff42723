import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  CalendarDays, UserPlus, IdCard, Building2, CheckCircle2,
  Sparkles, ArrowRight, ArrowLeft, X, Palette, Mail, ShieldCheck, MapPin, Pencil, KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { usersStore, useAccessProfiles, ACCESS_PAGES } from "@/lib/store";
import { useDirectory, type DirectoryRole, type DirectoryUser } from "@/lib/directory";
import { useBranches } from "@/lib/branches-live";
import wizardBg from "@/assets/wizard-bg.jpg";

const STEPS = [
  { id: 0, title: "Identidade", desc: "Nome, e-mail e cor", icon: IdCard },
  { id: 1, title: "Perfil", desc: "Perfil de acesso", icon: ShieldCheck },
  { id: 2, title: "Departamento", desc: "Área de atuação", icon: Building2 },
  { id: 3, title: "Filial", desc: "Unidade ou todas", icon: MapPin },
  { id: 4, title: "Revisão", desc: "Confirme e salve", icon: CheckCircle2 },
];

const COLORS = [
  "oklch(0.6 0.18 260)", "oklch(0.65 0.18 25)", "oklch(0.62 0.16 155)",
  "oklch(0.7 0.18 340)", "oklch(0.65 0.14 230)", "oklch(0.7 0.15 70)",
  "oklch(0.6 0.2 295)", "oklch(0.65 0.15 190)",
];

const DEPARTMENTS = ["Operações", "Diretoria", "Financeiro", "TI", "Marketing", "RH", "Comercial", "Jurídico"];

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("") || "?";

const folded = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function roleFor(roles: DirectoryRole[], profileName: string, allBranches: boolean) {
  const name = folded(profileName);
  const preferred = name.includes("diretor") ? "diret"
    : name.includes("gerente") ? "geren"
    : name.includes("supervisor") || name.includes("estoqu") ? "estoqu"
    : "colabor";
  const named = (list: DirectoryRole[]) => list.find((role) => folded(role.name).includes(preferred));
  const assigned = roles.filter((role) => role.scope === "assigned");
  const global = roles.filter((role) => role.scope === "all");
  const fallback = named(assigned) ?? assigned.find((role) => folded(role.name).includes("colabor")) ?? assigned[0] ?? roles[0];
  if (allBranches && preferred === "diret") return named(global) ?? fallback;
  return fallback;
}

export function CreateMemberWizard({ open, onClose, member = null }: { open: boolean; onClose: () => void; member?: DirectoryUser | null }) {
  const profiles = useAccessProfiles();
  const directory = useDirectory();
  const liveBranches = useBranches();
  const units = (liveBranches.length ? liveBranches.filter((branch) => branch.active) : directory.branches)
    .map((branch) => ({ id: branch.id, name: branch.name }));
  const editing = Boolean(member?.id);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [profileId, setProfileId] = useState<string>(profiles[0]?.id ?? "");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [branchChoice, setBranchChoice] = useState("all");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const prettyDate = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  const reset = () => {
    setStep(0); setName(""); setEmail(""); setColor(COLORS[0]);
    setProfileId(profiles[0]?.id ?? ""); setDepartment(DEPARTMENTS[0]); setBranchChoice("all");
    setPassword(""); setPasswordConfirm("");
  };

  useEffect(() => {
    if (!open) return;
    if (!member) {
      reset();
      return;
    }
    setStep(0);
    setName(member.name);
    setEmail(member.email);
    setColor(member.color || COLORS[0]);
    setProfileId(member.profileId || profiles[0]?.id || "");
    setDepartment(member.department || DEPARTMENTS[0]);
    setBranchChoice(member.seesAllBranches ? "all" : member.memberships[0]?.branchId || "all");
    setPassword("");
    setPasswordConfirm("");
  }, [open, member?.id]);

  const departmentOptions = department && !DEPARTMENTS.includes(department)
    ? [department, ...DEPARTMENTS]
    : DEPARTMENTS;
  const colorOptions = color && !COLORS.includes(color) ? [color, ...COLORS] : COLORS;

  const close = () => { reset(); onClose(); };

  const selectedProfile = profiles.find(p => p.id === profileId) ?? profiles[0];
  const branchReady = branchChoice === "all" ? units.length > 0 : units.some((unit) => unit.id === branchChoice);
  const branchText = branchChoice === "all" ? "Todas as filiais" : units.find((unit) => unit.id === branchChoice)?.name ?? "Filial";
  const passwordValue = password.trim();
  const passwordOk = !passwordValue || (passwordValue.length >= 8 && passwordValue === passwordConfirm.trim());
  const passwordHint = !passwordValue
    ? (editing ? "Deixe em branco para manter a senha atual." : "Se ficar vazio, o sistema gera uma senha temporária.")
    : passwordValue.length < 8
      ? "A senha precisa ter ao menos 8 caracteres."
      : passwordValue !== passwordConfirm.trim()
        ? "A confirmação precisa ser igual à senha."
        : editing
          ? "A senha será atualizada ao salvar."
          : "Essa senha será usada no primeiro acesso.";

  const submit = async () => {
    if (!name.trim() || !selectedProfile || !branchReady || !passwordOk) return;
    try {
      const role = roleFor(directory.roles, selectedProfile.name, branchChoice === "all");
      const anchor = branchChoice === "all" ? units[0]?.id : branchChoice;
      if (!role || !anchor) {
        toast.error("Não foi possível definir a filial desse membro.");
        return;
      }
      const memberships = [{ branchId: anchor, roleId: role.id }];
      const payload = {
        name: name.trim(),
        email: email.trim() || `${name.trim().split(/\s+/)[0]?.toLowerCase()}@gruposorrisos.com.br`,
        role: selectedProfile.name,
        department,
        initials: initialsOf(name),
        color,
        profileId: selectedProfile.id,
        memberships,
        seesAllBranches: branchChoice === "all",
        ...(passwordValue ? { password: passwordValue } : {}),
      };
      if (editing && member) {
        await usersStore.updateUser({ ...payload, id: member.id }, { ...selectedProfile.access });
        toast.success(passwordValue ? "Membro e senha atualizados" : "Membro atualizado");
      } else {
        const temporary = await usersStore.addUser({
          ...payload,
          id: `u_${Date.now().toString(36)}`,
        }, { ...selectedProfile.access });
        toast.success(
          passwordValue
            ? "Membro cadastrado com a senha informada"
            : temporary
              ? `Membro cadastrado. Senha inicial: ${temporary}`
              : "Membro cadastrado",
        );
      }
      close();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : editing ? "Não foi possível atualizar o membro." : "Não foi possível cadastrar o membro.");
    }
  };

  const canNext = step === 0 ? name.trim().length > 0 && passwordOk : step === 3 ? branchReady : true;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0 border-0 [&>button]:hidden">
        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] min-h-[600px]">
          <aside
            className="relative hidden md:flex flex-col justify-between p-7 text-white overflow-hidden"
            style={{ backgroundImage: `url(${wizardBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-black/55 via-black/40 to-black/70" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-[11px] font-medium border border-white/20">
                {editing ? <Pencil className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                {editing ? "Editar membro" : "Novo membro"}
              </div>
              <h2 className="mt-5 text-2xl font-semibold leading-tight">
                {editing ? <>Atualize os dados<br />do colaborador.</> : <>Faça a equipe<br />crescer junto.</>}
              </h2>
              <p className="mt-2 text-sm text-white/75 capitalize">{prettyDate}</p>
            </div>

            <ol className="relative space-y-1">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const active = i === step;
                const done = i < step;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => { if (i <= step) setStep(i); }}
                      className={`relative w-full flex items-start gap-3 rounded-xl p-3 text-left transition-all ${
                        active ? "bg-white/15 backdrop-blur border border-white/25" : "hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                        done ? "bg-emerald-400/90 border-emerald-300 text-emerald-950"
                        : active ? "bg-white text-primary border-white"
                        : "bg-white/10 border-white/20 text-white/70"
                      }`}>
                        {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <div className={`text-sm font-medium ${active ? "text-white" : "text-white/85"}`}>{s.title}</div>
                        <div className="text-[11px] text-white/60 leading-tight mt-0.5">{s.desc}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="relative text-[11px] text-white/60">
              Passo {step + 1} de {STEPS.length}
              <div className="mt-2 h-1 w-full rounded-full bg-white/15 overflow-hidden">
                <div className="h-full bg-white transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
              </div>
            </div>
          </aside>

          <div className="flex flex-col">
            <div className="flex items-center justify-between px-7 pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span className="capitalize">{prettyDate}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={close}><X className="h-4 w-4" /></Button>
            </div>

            <div className="flex-1 px-7 py-6 overflow-y-auto">
              <div key={step} className="animate-fade-in">
                {step === 0 && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-semibold">Quem está chegando?</h3>
                      <p className="text-sm text-muted-foreground mt-1">Informe o nome, e-mail e a cor de identificação do avatar.</p>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nome completo</Label>
                      <Input
                        autoFocus value={name} onChange={(e) => setName(e.target.value)}
                        placeholder="Ex.: Maria Fernanda Costa"
                        className="mt-2 h-12 text-base"
                      />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" /> E-mail
                      </Label>
                      <Input
                        type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="maria@gruposorrisos.com.br"
                        className="mt-2 h-11"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                          <KeyRound className="h-3.5 w-3.5" /> {editing ? "Nova senha" : "Senha"}
                        </Label>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={editing ? "Opcional" : "Opcional · gera automática"}
                          className="mt-2 h-11"
                        />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Confirmar senha</Label>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          placeholder="Repita a senha"
                          className="mt-2 h-11"
                          disabled={!passwordValue}
                        />
                      </div>
                      <p className={`sm:col-span-2 text-xs ${passwordOk ? "text-muted-foreground" : "text-destructive"}`}>{passwordHint}</p>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <Palette className="h-3.5 w-3.5" /> Cor do avatar
                      </Label>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {colorOptions.map(c => (
                          <button
                            key={c} type="button" onClick={() => setColor(c)}
                            aria-label={`Cor ${c}`}
                            className={`h-10 w-10 rounded-xl transition-all ${color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-card/40 p-4 flex items-center gap-3">
                      <span className="h-12 w-12 rounded-full shrink-0 flex items-center justify-center text-white font-semibold" style={{ backgroundColor: color }}>
                        {initialsOf(name)}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{name || "Nome do membro"}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{email || "Pré-visualização do cartão"}</div>
                      </div>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-semibold">Qual é o perfil?</h3>
                      <p className="text-sm text-muted-foreground mt-1">Selecione o perfil de acesso desse membro. Os perfis são gerenciados em Perfis de Acesso.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {profiles.map(p => {
                        const selected = profileId === p.id;
                        const liberadas = ACCESS_PAGES.filter(pg => p.access[pg]).length;
                        return (
                          <button
                            key={p.id} type="button" onClick={() => setProfileId(p.id)}
                            className={`rounded-xl border p-5 text-left transition-all ${
                              selected ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm" : "border-border hover:border-primary/50"
                            }`}
                          >
                            <span className="flex h-11 w-11 items-center justify-center rounded-lg text-white" style={{ backgroundColor: p.color }}>
                              <ShieldCheck className="h-5 w-5" />
                            </span>
                            <div className="mt-3 text-base font-semibold">{p.name}</div>
                            <div className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{p.description}</div>
                            <div className="mt-2 text-[11px] font-medium text-primary">{liberadas} de {ACCESS_PAGES.length} páginas liberadas</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-semibold">Onde vai atuar?</h3>
                      <p className="text-sm text-muted-foreground mt-1">Escolha o departamento desse membro.</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {departmentOptions.map(d => {
                        const selected = department === d;
                        return (
                          <button
                            key={d} type="button" onClick={() => setDepartment(d)}
                            className={`rounded-xl border p-4 text-left transition-all ${
                              selected ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm" : "border-border hover:border-primary/50"
                            }`}
                          >
                            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                              <Building2 className="h-4 w-4" />
                            </span>
                            <div className="mt-2.5 text-sm font-semibold">{d}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-semibold">Qual é a filial?</h3>
                      <p className="text-sm text-muted-foreground mt-1">Escolha a unidade desse membro ou libere a visão de todas as filiais.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button" onClick={() => setBranchChoice("all")}
                        className={`rounded-xl border p-4 text-left transition-all sm:col-span-2 ${
                          branchChoice === "all" ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm" : "border-border hover:border-primary/50"
                        }`}
                      >
                        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${branchChoice === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          <MapPin className="h-4 w-4" />
                        </span>
                        <div className="mt-2.5 text-sm font-semibold">Todas as filiais</div>
                        <div className="text-xs text-muted-foreground mt-1">O membro poderá ver as unidades do grupo.</div>
                      </button>
                      {units.map((unit) => {
                        const selected = branchChoice === unit.id;
                        return (
                          <button
                            key={unit.id} type="button" onClick={() => setBranchChoice(unit.id)}
                            className={`rounded-xl border p-4 text-left transition-all ${
                              selected ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm" : "border-border hover:border-primary/50"
                            }`}
                          >
                            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                              <Building2 className="h-4 w-4" />
                            </span>
                            <div className="mt-2.5 text-sm font-semibold">{unit.name}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-semibold">Tudo certo?</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {editing ? "Revise as informações antes de salvar as alterações." : "Revise as informações antes de cadastrar o membro."}
                      </p>
                    </div>
                    <div className="rounded-xl border bg-card/40 p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <span className="h-12 w-12 rounded-full shrink-0 flex items-center justify-center text-white font-semibold" style={{ backgroundColor: color }}>
                          {initialsOf(name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-base font-semibold truncate">{name || "Sem nome"}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Mail className="h-3 w-3" /> {email || "E-mail gerado automaticamente"}</div>
                        </div>
                      </div>
                      <div className="h-px bg-border" />
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <Field label="Perfil">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded text-white" style={{ backgroundColor: selectedProfile?.color }}>
                              <ShieldCheck className="h-3 w-3" />
                            </span>
                            <span className="font-medium">{selectedProfile?.name}</span>
                          </div>
                        </Field>
                        <Field label="Departamento">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            <span className="font-medium">{department}</span>
                          </div>
                        </Field>
                        <Field label="Filial">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            <span className="font-medium">{branchText}</span>
                          </div>
                        </Field>
                        <Field label="Senha">
                          <div className="flex items-center gap-2">
                            <KeyRound className="h-4 w-4 text-primary" />
                            <span className="font-medium">
                              {passwordValue
                                ? editing ? "Será atualizada" : "Definida manualmente"
                                : editing ? "Mantém a atual" : "Será gerada"}
                            </span>
                          </div>
                        </Field>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O membro herdará as permissões do perfil <span className="font-medium text-foreground">{selectedProfile?.name}</span>. Ajuste as permissões em <span className="font-medium text-foreground">Perfis de Acesso</span>.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t px-7 py-4">
              <Button variant="ghost" onClick={step === 0 ? close : () => setStep(s => s - 1)}>
                {step === 0 ? "Cancelar" : (<><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</>)}
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => canNext && setStep(s => s + 1)} disabled={!canNext}>
                  Continuar <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={submit} disabled={!name.trim() || !branchReady || !passwordOk}>
                  {editing ? <><Pencil className="h-4 w-4 mr-1" /> Salvar alterações</> : <><UserPlus className="h-4 w-4 mr-1" /> Cadastrar membro</>}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}
