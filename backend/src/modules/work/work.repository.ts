import type { Pool, RowDataPacket } from "../../database/pool.js";

const text = (value: unknown) => (value == null ? "" : String(value));

export class WorkRepository {
  constructor(private readonly pool: Pool) {}

  async summary() {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT kind, payload FROM workspace_records WHERE kind IN ('project', 'task') ORDER BY updated_at DESC`,
    );
    const projects: { id: string; name: string }[] = [];
    const tasks: { id: string; projectId: string; assigneeId: string; department: string; status: string; dueDate: string }[] = [];
    for (const row of rows) {
      const payload = (typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload) as Record<string, unknown>;
      if (row.kind === "project") projects.push({ id: text(payload.id), name: text(payload.name) });
      else tasks.push({
        id: text(payload.id),
        projectId: text(payload.projectId),
        assigneeId: text(payload.assigneeId),
        department: text(payload.department),
        status: text(payload.status),
        dueDate: text(payload.dueDate).slice(0, 10),
      });
    }
    return { projects, tasks };
  }
}
