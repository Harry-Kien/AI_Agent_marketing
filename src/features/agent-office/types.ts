export interface OfficeAgent {
  id: string;
  name: string;
  department: string;
  state: "working" | "waiting_approval" | "available" | "offline";
  task: string;
  latency: string;
}

export interface OfficeSnapshot {
  connected: boolean;
  campaignId: string;
  campaignTitle: string;
  stage: string;
  approvals: number;
  agents: OfficeAgent[];
  activity: Array<{ id: string; time: string; actor: string; message: string }>;
  services: Array<{ name: string; state: "online" | "guarded" | "offline"; detail: string }>;
}
