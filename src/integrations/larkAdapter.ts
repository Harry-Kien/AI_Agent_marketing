import type { AppData } from "../domain/types";

type ExportTable = Record<string, unknown>[];

export interface LarkBaseExport {
  json: Record<"Repos" | "Tasks" | "Agents" | "Agent Runs" | "Daily Briefs", ExportTable>;
  csv: Record<"Repos" | "Tasks" | "Agents" | "Agent Runs" | "Daily Briefs", string>;
}

function normalizeRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      Array.isArray(value) || (typeof value === "object" && value !== null)
        ? JSON.stringify(value)
        : value
    ])
  );
}

function toCsv(records: ExportTable) {
  if (!records.length) return "";
  const headers = Object.keys(records[0]);
  const escapeCell = (value: unknown) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return [
    headers.join(","),
    ...records.map((record) => headers.map((header) => escapeCell(record[header])).join(","))
  ].join("\n");
}

export function exportForLarkBase(data: AppData): LarkBaseExport {
  const json = {
    Repos: data.repos.map((record) => normalizeRecord(record as unknown as Record<string, unknown>)),
    Tasks: data.tasks.map((record) => normalizeRecord(record as unknown as Record<string, unknown>)),
    Agents: data.agents.map((record) => normalizeRecord(record as unknown as Record<string, unknown>)),
    "Agent Runs": data.agentRuns.map((record) =>
      normalizeRecord(record as unknown as Record<string, unknown>)
    ),
    "Daily Briefs": data.dailyBriefs.map((record) =>
      normalizeRecord(record as unknown as Record<string, unknown>)
    )
  };

  return {
    json,
    csv: {
      Repos: toCsv(json.Repos),
      Tasks: toCsv(json.Tasks),
      Agents: toCsv(json.Agents),
      "Agent Runs": toCsv(json["Agent Runs"]),
      "Daily Briefs": toCsv(json["Daily Briefs"])
    }
  };
}

// Future integration point:
// Replace this export-only adapter with calls to Lark Base OpenAPI once the app has
// tenant credentials, base/table IDs, rate-limit handling, and an approval flow.
