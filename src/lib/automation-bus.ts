import type { DomainFact } from "@/lib/automation-engine";

type Handler = (fact: DomainFact) => void;
const handlers = new Set<Handler>();

export function onAutomation(handler: Handler) {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function publishAutomation(fact: DomainFact) {
  for (const handler of handlers) {
    try { handler(fact); } catch { /* a regra não desfaz a operação que já aconteceu */ }
  }
}
