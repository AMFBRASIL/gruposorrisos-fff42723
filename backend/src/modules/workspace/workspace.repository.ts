import type { Pool, ResultSetHeader, RowDataPacket } from "../../database/pool.js";

const KINDS = ["project", "task", "template", "automation", "time_entry", "client", "deal", "invoice", "document", "approval"] as const;

type Kind = (typeof KINDS)[number];

const payloadOf = (value: unknown) => (typeof value === "string" ? JSON.parse(value) as unknown : value);

export class WorkspaceRepository {
  constructor(private readonly pool: Pool) {}

  async snapshot() {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT kind, payload FROM workspace_records WHERE kind IN (${KINDS.map(() => "?").join(",")}) ORDER BY updated_at DESC`,
      [...KINDS],
    );
    const grouped: Record<Kind, unknown[]> = {
      project: [], task: [], template: [], automation: [], time_entry: [], client: [], deal: [], invoice: [], document: [], approval: [],
    };
    for (const row of rows) {
      const kind = String(row.kind) as Kind;
      if (grouped[kind]) grouped[kind].push(payloadOf(row.payload));
    }
    return {
      projects: grouped.project,
      tasks: grouped.task,
      templates: grouped.template,
      automations: grouped.automation,
      timeEntries: grouped.time_entry,
      clients: grouped.client,
      deals: grouped.deal,
      invoices: grouped.invoice,
      documents: grouped.document,
      approvals: grouped.approval,
    };
  }

  async save(kind: string, id: string, payload: Record<string, unknown>) {
    if (!KINDS.includes(kind as Kind)) throw new Error("KIND");
    await this.pool.query<ResultSetHeader>(
      `INSERT INTO workspace_records (kind, record_id, payload) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = CURRENT_TIMESTAMP`,
      [kind, id, JSON.stringify({ ...payload, id })],
    );
  }

  async remove(kind: string, id: string) {
    if (!KINDS.includes(kind as Kind)) throw new Error("KIND");
    await this.pool.query(`DELETE FROM workspace_records WHERE kind = ? AND record_id = ?`, [kind, id]);
  }
}
