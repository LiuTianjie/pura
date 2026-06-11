import { randomUUID } from "node:crypto";
import type express from "express";
import { WebSocket } from "ws";
import { makeDeviceId, parseDeviceId } from "./device-id.js";
import { httpToWs } from "./network.js";
import type { AndroidDevice } from "./adb.js";
import type { DevicePublication } from "./registry.js";
import type { PublicSession } from "./sessions.js";

type AgentHeartbeat = {
  agentId: string;
  agentName?: string;
  url: string;
  devices: AgentDevice[];
};

type AgentDevice = AndroidDevice & {
  publication?: DevicePublication;
};

type RegisteredAgent = AgentHeartbeat & {
  lastSeen: number;
};

type HubSession = {
  id: string;
  deviceId: string;
  agentId: string;
  agentUrl: string;
  agentSessionId: string;
  serial: string;
  startedAt: number;
};

const agents = new Map<string, RegisteredAgent>();
const sessions = new Map<string, HubSession>();
const AGENT_TTL_MS = Number(process.env.AGENT_TTL_MS ?? 15_000);

export function installHubRoutes(app: express.Express) {
  app.post("/api/agents/heartbeat", (req, res) => {
    const body = req.body as Partial<AgentHeartbeat>;
    if (!body.agentId || !body.url || !Array.isArray(body.devices)) {
      res.status(400).json({ error: "agentId, url and devices are required" });
      return;
    }

    agents.set(body.agentId, {
      agentId: body.agentId,
      agentName: body.agentName,
      url: body.url.replace(/\/$/, ""),
      devices: body.devices,
      lastSeen: Date.now()
    });

    res.json({ ok: true });
  });

  app.get("/api/devices", (_req, res) => {
    res.json({ devices: listHubDevices(), sessions: listHubSessions() });
  });

  app.put("/api/devices/:deviceId/publication", async (req, res) => {
    try {
      const target = findDevice(req.params.deviceId);
      const response = await fetch(`${target.agent.url}/api/devices/${encodeURIComponent(target.remoteSerial)}/publication`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body ?? {})
      });
      res.status(response.status).json(await response.json());
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to publish device" });
    }
  });

  app.delete("/api/devices/:deviceId/publication", async (req, res) => {
    try {
      const target = findDevice(req.params.deviceId);
      const response = await fetch(`${target.agent.url}/api/devices/${encodeURIComponent(target.remoteSerial)}/publication`, {
        method: "DELETE"
      });
      res.status(response.status).json(await response.json());
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to unpublish device" });
    }
  });

  app.post("/api/devices/:deviceId/session", async (req, res) => {
    try {
      const target = findDevice(req.params.deviceId);
      const response = await fetch(`${target.agent.url}/api/devices/${encodeURIComponent(target.remoteSerial)}/session`, {
        method: "POST"
      });
      if (!response.ok) {
        res.status(response.status).json(await response.json());
        return;
      }

      const body = (await response.json()) as { session: PublicSession };
      const session: HubSession = {
        id: randomUUID(),
        deviceId: req.params.deviceId,
        agentId: target.agent.agentId,
        agentUrl: target.agent.url,
        agentSessionId: body.session.id,
        serial: target.remoteSerial,
        startedAt: Date.now()
      };

      sessions.set(session.id, session);
      res.json({
        session: {
          ...body.session,
          id: session.id,
          serial: req.params.deviceId
        }
      });
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to start remote session" });
    }
  });

  app.post("/api/devices/:deviceId/tap", async (req, res) => {
    try {
      const target = findDevice(req.params.deviceId);
      const response = await fetch(`${target.agent.url}/api/devices/${encodeURIComponent(target.remoteSerial)}/tap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body ?? {})
      });
      res.status(response.status).json(await response.json());
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to tap remote device" });
    }
  });

  app.post("/api/devices/:deviceId/control", async (req, res) => {
    try {
      const target = findDevice(req.params.deviceId);
      const response = await fetch(`${target.agent.url}/api/devices/${encodeURIComponent(target.remoteSerial)}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body ?? {})
      });
      res.status(response.status).json(await response.json());
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to control remote device" });
    }
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    const session = sessions.get(req.params.id);
    sessions.delete(req.params.id);

    if (!session) {
      res.json({ deleted: false });
      return;
    }

    await fetch(`${session.agentUrl}/api/sessions/${encodeURIComponent(session.agentSessionId)}`, {
      method: "DELETE"
    }).catch(() => undefined);

    res.json({ deleted: true });
  });
}

export function attachHubVideoClient(sessionId: string, client: WebSocket) {
  const session = sessions.get(sessionId);
  if (!session) {
    client.close(1008, "session not found");
    return;
  }

  const remote = new WebSocket(`${httpToWs(session.agentUrl)}/ws/sessions/${session.agentSessionId}/video`);

  remote.on("message", (data, isBinary) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: isBinary });
    }
  });

  remote.on("error", () => {
    client.close(1011, "remote stream error");
  });

  remote.on("close", () => {
    client.close(1001, "remote stream closed");
  });

  client.on("close", () => {
    remote.close();
  });
}

function listHubDevices() {
  pruneAgents();
  return [...agents.values()].flatMap((agent) =>
    agent.devices.map((device) => ({
      ...device,
      serial: makeDeviceId(agent.agentId, device.serial),
      remoteSerial: device.serial,
      agentId: agent.agentId,
      agentName: agent.agentName,
      agentUrl: agent.url,
      publication: device.publication
        ? {
            ...device.publication,
            serial: makeDeviceId(agent.agentId, device.serial)
          }
        : undefined
    }))
  );
}

function listHubSessions() {
  return [...sessions.values()].map((session) => ({
    id: session.id,
    serial: session.deviceId,
    viewerCount: 0,
    startedAt: session.startedAt,
    stream: {
      codec: "h264",
      container: "annexb",
      size: process.env.STREAM_SIZE ?? "native",
      bitrate: process.env.STREAM_BITRATE ?? "8000000"
    }
  }));
}

function findDevice(deviceId: string) {
  pruneAgents();
  const parsed = parseDeviceId(deviceId);
  const agent = agents.get(parsed.agentId);
  if (!agent) throw new Error("Agent is offline");

  const device = agent.devices.find((item) => item.serial === parsed.serial);
  if (!device) throw new Error("Device is offline");

  return {
    agent,
    device,
    remoteSerial: parsed.serial
  };
}

function pruneAgents() {
  const now = Date.now();
  for (const [agentId, agent] of agents.entries()) {
    if (now - agent.lastSeen > AGENT_TTL_MS) {
      agents.delete(agentId);
    }
  }
}
