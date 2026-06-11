import { randomUUID } from "node:crypto";
import type express from "express";
import { WebSocket } from "ws";
import { makeDeviceId, parseDeviceId } from "./device-id.js";
import { listDeviceScreenshots, saveScreenshot } from "./screenshots.js";
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
  control?: WebSocket;
};

type HubSession = {
  id: string;
  deviceId: string;
  agentId: string;
  agentSessionId: string;
  serial: string;
  startedAt: number;
  clients: Set<WebSocket>;
  stream?: WebSocket;
  stopTimer?: NodeJS.Timeout;
};

type AgentRequestPayload = {
  serial?: string;
  body?: unknown;
};

type AgentResponseMessage = {
  type: "response";
  requestId: string;
  ok: boolean;
  body?: unknown;
  error?: string;
};

type AgentHelloMessage = {
  type: "hello";
  agentId: string;
  agentName?: string;
};

type PendingAgentRequest = {
  resolve: (body: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

type ScreenshotResponse = {
  contentType?: string;
  data: string;
};

const agents = new Map<string, RegisteredAgent>();
const sessions = new Map<string, HubSession>();
const pendingAgentRequests = new Map<string, PendingAgentRequest>();
const AGENT_TTL_MS = Number(process.env.AGENT_TTL_MS ?? 15_000);
const AGENT_REQUEST_TIMEOUT_MS = Number(process.env.AGENT_REQUEST_TIMEOUT_MS ?? 30_000);

export function installHubRoutes(app: express.Express) {
  app.post("/api/agents/heartbeat", (req, res) => {
    const body = req.body as Partial<AgentHeartbeat>;
    if (!body.agentId || !Array.isArray(body.devices)) {
      res.status(400).json({ error: "agentId and devices are required" });
      return;
    }

    const existing = agents.get(body.agentId);
    agents.set(body.agentId, {
      agentId: body.agentId,
      agentName: body.agentName,
      url: body.url?.replace(/\/$/, "") ?? existing?.url ?? "",
      devices: body.devices,
      lastSeen: Date.now(),
      control: existing?.control
    });

    res.json({ ok: true });
  });

  app.get("/api/devices", (_req, res) => {
    res.json({ devices: listHubDevices(), sessions: listHubSessions() });
  });

  app.put("/api/devices/:deviceId/publication", async (req, res) => {
    try {
      const target = findDevice(req.params.deviceId);
      const body = await sendAgentRequest<{ publication?: DevicePublication }>(target.agent, "publish", {
        serial: target.remoteSerial,
        body: req.body ?? {}
      });
      res.json({
        publication: body.publication
          ? { ...body.publication, serial: req.params.deviceId }
          : body.publication
      });
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to publish device" });
    }
  });

  app.delete("/api/devices/:deviceId/publication", async (req, res) => {
    try {
      const target = findDevice(req.params.deviceId);
      const body = await sendAgentRequest<{ publication?: DevicePublication }>(target.agent, "unpublish", {
        serial: target.remoteSerial
      });
      res.json({
        publication: body.publication
          ? { ...body.publication, serial: req.params.deviceId }
          : body.publication
      });
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to unpublish device" });
    }
  });

  app.post("/api/devices/:deviceId/session", async (req, res) => {
    try {
      const target = findDevice(req.params.deviceId);
      const restart = req.body?.restart === true;
      if (restart) {
        await deleteHubSessionsForDevice(req.params.deviceId);
      }

      const sessionId = randomUUID();
      const body = await sendAgentRequest<{ session: PublicSession }>(target.agent, "start-session", {
        serial: target.remoteSerial,
        body: { restart, hubSessionId: sessionId }
      });

      const session: HubSession = {
        id: sessionId,
        deviceId: req.params.deviceId,
        agentId: target.agent.agentId,
        agentSessionId: body.session.id,
        serial: target.remoteSerial,
        startedAt: Date.now(),
        clients: new Set()
      };

      sessions.set(session.id, session);
      scheduleHubSessionStopIfIdle(session);
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

  app.get("/api/devices/:deviceId/screenshot", async (req, res) => {
    try {
      const image = await captureRemoteScreenshot(req.params.deviceId);
      res.setHeader("Content-Type", image.contentType);
      res.setHeader("Cache-Control", "no-store");
      res.end(image.buffer);
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to capture remote device screenshot" });
    }
  });

  app.post("/api/devices/:deviceId/screenshots", async (req, res) => {
    try {
      const image = await captureRemoteScreenshot(req.params.deviceId);
      res.json({ screenshot: await saveScreenshot(image.buffer, req.params.deviceId) });
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to save remote device screenshot" });
    }
  });

  app.get("/api/devices/:deviceId/screenshots", (req, res) => {
    try {
      findDevice(req.params.deviceId);
      res.json({ screenshots: listDeviceScreenshots(req.params.deviceId) });
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to list device screenshots" });
    }
  });

  app.post("/api/devices/:deviceId/tap", async (req, res) => {
    try {
      const target = findDevice(req.params.deviceId);
      res.json(await sendAgentRequest(target.agent, "tap", { serial: target.remoteSerial, body: req.body ?? {} }));
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to tap remote device" });
    }
  });

  app.post("/api/devices/:deviceId/long-press", async (req, res) => {
    try {
      const target = findDevice(req.params.deviceId);
      res.json(await sendAgentRequest(target.agent, "long-press", { serial: target.remoteSerial, body: req.body ?? {} }));
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to long press remote device" });
    }
  });

  app.post("/api/devices/:deviceId/swipe", async (req, res) => {
    try {
      const target = findDevice(req.params.deviceId);
      res.json(await sendAgentRequest(target.agent, "swipe", { serial: target.remoteSerial, body: req.body ?? {} }));
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to swipe remote device" });
    }
  });

  app.post("/api/devices/:deviceId/control", async (req, res) => {
    try {
      const target = findDevice(req.params.deviceId);
      res.json(await sendAgentRequest(target.agent, "control", { serial: target.remoteSerial, body: req.body ?? {} }));
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

    closeHubSession(session);
    const agent = agents.get(session.agentId);
    if (agent) {
      await sendAgentRequest(agent, "delete-session", {
        body: { sessionId: session.agentSessionId }
      }).catch(() => undefined);
    }

    res.json({ deleted: true });
  });
}

export function attachAgentControlClient(agentId: string, socket: WebSocket) {
  const existing = agents.get(agentId);
  if (existing?.control && existing.control.readyState === WebSocket.OPEN) {
    existing.control.close(1001, "replaced by a new control channel");
  }

  agents.set(agentId, {
    agentId,
    agentName: existing?.agentName,
    url: existing?.url ?? "",
    devices: existing?.devices ?? [],
    lastSeen: Date.now(),
    control: socket
  });

  socket.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString("utf8")) as AgentResponseMessage | AgentHelloMessage;
      if (message.type === "hello") {
        const agent = agents.get(agentId);
        if (agent) {
          agent.agentName = message.agentName ?? agent.agentName;
          agent.lastSeen = Date.now();
        }
        return;
      }

      if (message.type !== "response") return;
      const pending = pendingAgentRequests.get(message.requestId);
      if (!pending) return;

      pendingAgentRequests.delete(message.requestId);
      clearTimeout(pending.timer);
      if (message.ok) {
        pending.resolve(message.body);
      } else {
        pending.reject(new Error(message.error || "Agent request failed"));
      }
    } catch {
      socket.close(1003, "invalid control message");
    }
  });

  socket.on("close", () => {
    const agent = agents.get(agentId);
    if (agent?.control === socket) {
      agent.control = undefined;
      agent.lastSeen = Date.now();
    }
  });
}

export function attachAgentVideoStream(agentId: string, agentSessionId: string, hubSessionId: string, stream: WebSocket) {
  const session = sessions.get(hubSessionId);
  if (!session || session.agentId !== agentId || session.agentSessionId !== agentSessionId) {
    stream.close(1008, "session not found");
    return;
  }

  if (session.stream && session.stream.readyState === WebSocket.OPEN) {
    session.stream.close(1001, "replaced by a new stream");
  }

  session.stream = stream;
  stream.on("message", (data, isBinary) => {
    for (const client of session.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    }
  });

  stream.on("close", () => {
    if (session.stream === stream) {
      session.stream = undefined;
      for (const client of session.clients) {
        client.close(1001, "agent stream closed");
      }
    }
  });
}

export function attachHubVideoClient(sessionId: string, client: WebSocket) {
  const session = sessions.get(sessionId);
  if (!session) {
    client.close(1008, "session not found");
    return;
  }

  session.clients.add(client);
  if (session.stopTimer) {
    clearTimeout(session.stopTimer);
    session.stopTimer = undefined;
  }

  const waitTimer = setTimeout(() => {
    if (!session.stream || session.stream.readyState !== WebSocket.OPEN) {
      client.close(1011, "agent stream unavailable");
    }
  }, 8000);

  client.on("close", () => {
    clearTimeout(waitTimer);
    session.clients.delete(client);
    scheduleHubSessionStopIfIdle(session);
  });
}

async function captureRemoteScreenshot(deviceId: string) {
  const target = findDevice(deviceId);
  const screenshot = await sendAgentRequest<ScreenshotResponse>(target.agent, "screenshot", {
    serial: target.remoteSerial
  });

  if (!screenshot.data) {
    throw new Error("Agent returned an empty screenshot");
  }

  return {
    contentType: screenshot.contentType ?? "image/png",
    buffer: Buffer.from(screenshot.data, "base64")
  };
}

async function deleteHubSessionsForDevice(deviceId: string) {
  const staleSessions = [...sessions.values()].filter((session) => session.deviceId === deviceId);
  await Promise.all(
    staleSessions.map(async (session) => {
      sessions.delete(session.id);
      closeHubSession(session);
      const agent = agents.get(session.agentId);
      if (agent) {
        await sendAgentRequest(agent, "delete-session", {
          body: { sessionId: session.agentSessionId }
        }).catch(() => undefined);
      }
    })
  );
}

function closeHubSession(session: HubSession) {
  if (session.stopTimer) {
    clearTimeout(session.stopTimer);
    session.stopTimer = undefined;
  }

  if (session.stream && session.stream.readyState === WebSocket.OPEN) {
    session.stream.close(1001, "session ended");
  }

  for (const client of session.clients) {
    client.close(1001, "session ended");
  }
}

function scheduleHubSessionStopIfIdle(session: HubSession) {
  if (session.clients.size > 0 || session.stopTimer) return;

  session.stopTimer = setTimeout(() => {
    if (session.clients.size > 0) return;
    sessions.delete(session.id);
    closeHubSession(session);
    const agent = agents.get(session.agentId);
    if (agent) {
      void sendAgentRequest(agent, "delete-session", {
        body: { sessionId: session.agentSessionId }
      }).catch(() => undefined);
    }
  }, 5000);
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
      controlOnline: agent.control?.readyState === WebSocket.OPEN,
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
    viewerCount: session.clients.size,
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

function sendAgentRequest<T = unknown>(agent: RegisteredAgent, command: string, payload: AgentRequestPayload = {}) {
  if (!agent.control || agent.control.readyState !== WebSocket.OPEN) {
    throw new Error("Agent control channel is offline");
  }

  const requestId = randomUUID();
  const message = {
    type: "request",
    requestId,
    command,
    ...payload
  };

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingAgentRequests.delete(requestId);
      reject(new Error(`Agent request timed out: ${command}`));
    }, AGENT_REQUEST_TIMEOUT_MS);

    pendingAgentRequests.set(requestId, {
      resolve: (body) => resolve(body as T),
      reject,
      timer
    });

    agent.control?.send(JSON.stringify(message), (error) => {
      if (!error) return;
      pendingAgentRequests.delete(requestId);
      clearTimeout(timer);
      reject(error);
    });
  });
}

function pruneAgents() {
  const now = Date.now();
  for (const [agentId, agent] of agents.entries()) {
    if (now - agent.lastSeen > AGENT_TTL_MS && agent.control?.readyState !== WebSocket.OPEN) {
      agents.delete(agentId);
    }
  }
}
