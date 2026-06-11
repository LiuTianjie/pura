import type express from "express";
import { WebSocket } from "ws";
import { captureScreenshot, controlDevice, listDevices, longPressDevice, swipeDevice, tapDevice, type ControlAction } from "./adb.js";
import { getLanAddress, httpToWs, normalizeHttpUrl } from "./network.js";
import { getPublications, publishDevice, unpublishDevice } from "./registry.js";
import { listDeviceScreenshots, saveScreenshot } from "./screenshots.js";
import { deleteSession, getOrCreateSession, listSessions } from "./sessions.js";

export type AgentOptions = {
  hubUrl?: string;
  agentId: string;
  agentName?: string;
  publicUrl?: string;
  port: number;
};

type HubControlRequest = {
  type: "request";
  requestId: string;
  command: string;
  serial?: string;
  body?: Record<string, unknown>;
};

type AgentControlResponse = {
  type: "response";
  requestId: string;
  ok: boolean;
  body?: unknown;
  error?: string;
};

const activeVideoRelays = new Map<string, { hub: WebSocket; local: WebSocket }>();

export function installAgentRoutes(app: express.Express) {
  app.get("/api/devices", async (_req, res) => {
    try {
      res.json({ devices: await listAgentDevices(), sessions: listSessions() });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to list devices"
      });
    }
  });

  app.put("/api/devices/:serial/publication", (req, res) => {
    res.json({
      publication: publishDevice(req.params.serial, {
        label: req.body?.label,
        owner: req.body?.owner,
        note: req.body?.note
      })
    });
  });

  app.delete("/api/devices/:serial/publication", (req, res) => {
    res.json({ publication: unpublishDevice(req.params.serial) });
  });

  app.post("/api/devices/:serial/session", (req, res) => {
    res.json({ session: getOrCreateSession(req.params.serial, { restart: req.body?.restart === true }) });
  });

  app.get("/api/devices/:serial/screenshot", async (req, res) => {
    try {
      const image = await captureScreenshot(req.params.serial);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store");
      res.end(image);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to capture device screenshot"
      });
    }
  });

  app.post("/api/devices/:serial/screenshots", async (req, res) => {
    try {
      const image = await captureScreenshot(req.params.serial);
      res.json({ screenshot: await saveScreenshot(image, req.params.serial) });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to save device screenshot"
      });
    }
  });

  app.get("/api/devices/:serial/screenshots", (req, res) => {
    res.json({ screenshots: listDeviceScreenshots(req.params.serial) });
  });

  app.post("/api/devices/:serial/tap", async (req, res) => {
    const xRatio = Number(req.body?.xRatio);
    const yRatio = Number(req.body?.yRatio);

    if (!Number.isFinite(xRatio) || !Number.isFinite(yRatio) || xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) {
      res.status(400).json({ error: "xRatio and yRatio must be numbers between 0 and 1" });
      return;
    }

    try {
      res.json({ tap: await tapDevice(req.params.serial, xRatio, yRatio) });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to tap device"
      });
    }
  });

  app.post("/api/devices/:serial/long-press", async (req, res) => {
    const xRatio = Number(req.body?.xRatio);
    const yRatio = Number(req.body?.yRatio);
    const durationMs = Number(req.body?.durationMs ?? 650);

    if (!Number.isFinite(xRatio) || !Number.isFinite(yRatio) || xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) {
      res.status(400).json({ error: "xRatio and yRatio must be numbers between 0 and 1" });
      return;
    }

    try {
      res.json({ longPress: await longPressDevice(req.params.serial, xRatio, yRatio, durationMs) });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to long press device"
      });
    }
  });

  app.post("/api/devices/:serial/swipe", async (req, res) => {
    const xStartRatio = Number(req.body?.xStartRatio);
    const yStartRatio = Number(req.body?.yStartRatio);
    const xEndRatio = Number(req.body?.xEndRatio);
    const yEndRatio = Number(req.body?.yEndRatio);
    const durationMs = Number(req.body?.durationMs ?? 320);

    if (![xStartRatio, yStartRatio, xEndRatio, yEndRatio].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) {
      res.status(400).json({ error: "Swipe ratios must be numbers between 0 and 1" });
      return;
    }

    try {
      res.json({ swipe: await swipeDevice(req.params.serial, { xStartRatio, yStartRatio, xEndRatio, yEndRatio, durationMs }) });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to swipe device"
      });
    }
  });

  app.post("/api/devices/:serial/control", async (req, res) => {
    const action = req.body?.action as ControlAction | undefined;

    if (!action || !controlActions.includes(action)) {
      res.status(400).json({ error: "A supported control action is required" });
      return;
    }

    try {
      res.json({ control: await controlDevice(req.params.serial, action, req.body?.value) });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to control device"
      });
    }
  });

  app.delete("/api/sessions/:id", (req, res) => {
    res.json({ deleted: deleteSession(req.params.id) });
  });
}

const controlActions: ControlAction[] = [
  "back",
  "home",
  "recents",
  "menu",
  "power",
  "volume_up",
  "volume_down",
  "mute",
  "enter",
  "delete",
  "swipe_up",
  "swipe_down",
  "swipe_left",
  "swipe_right",
  "text"
];

export function startAgentHeartbeat(options: AgentOptions) {
  if (!options.hubUrl) return;

  const hubUrl = normalizeHttpUrl(options.hubUrl);
  const publicUrl = options.publicUrl ?? `http://${getLanAddress()}:${options.port}`;

  const tick = async () => {
    try {
      const devices = await listAgentDevices();
      await fetch(`${hubUrl}/api/agents/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: options.agentId,
          agentName: options.agentName,
          url: publicUrl,
          devices
        })
      });
    } catch (error) {
      console.error(`Hub heartbeat failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  void tick();
  setInterval(tick, Number(process.env.HEARTBEAT_MS ?? 3000));
}

export function startAgentControlChannel(options: AgentOptions) {
  if (!options.hubUrl) return;

  const hubUrl = normalizeHttpUrl(options.hubUrl);
  const controlUrl = `${httpToWs(hubUrl)}/ws/agents/${encodeURIComponent(options.agentId)}/control`;
  let reconnectTimer: NodeJS.Timeout | undefined;

  const connect = () => {
    const socket = new WebSocket(controlUrl);

    socket.on("open", () => {
      socket.send(JSON.stringify({
        type: "hello",
        agentId: options.agentId,
        agentName: options.agentName
      }));
    });

    socket.on("message", (data) => {
      void handleControlMessage(socket, data.toString("utf8"), options);
    });

    socket.on("close", () => {
      reconnectTimer = setTimeout(connect, Number(process.env.AGENT_RECONNECT_MS ?? 1500));
    });

    socket.on("error", (error) => {
      console.error(`Hub control channel failed: ${error instanceof Error ? error.message : String(error)}`);
      socket.close();
    });
  };

  connect();

  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
  };
}

async function handleControlMessage(socket: WebSocket, text: string, options: AgentOptions) {
  let request: HubControlRequest;
  try {
    request = JSON.parse(text) as HubControlRequest;
  } catch {
    socket.close(1003, "invalid control message");
    return;
  }

  if (request.type !== "request" || !request.requestId || !request.command) return;

  try {
    const body = await runControlCommand(request, options);
    sendControlResponse(socket, { type: "response", requestId: request.requestId, ok: true, body });
  } catch (error) {
    sendControlResponse(socket, {
      type: "response",
      requestId: request.requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function runControlCommand(request: HubControlRequest, options: AgentOptions) {
  const serial = request.serial;
  const body = request.body ?? {};

  switch (request.command) {
    case "publish":
      return {
        publication: publishDevice(requireSerial(serial), {
          label: asString(body.label),
          owner: asString(body.owner),
          note: asString(body.note)
        })
      };
    case "unpublish":
      return { publication: unpublishDevice(requireSerial(serial)) };
    case "start-session": {
      const session = getOrCreateSession(requireSerial(serial), { restart: body.restart === true });
      const hubSessionId = asString(body.hubSessionId);
      if (!hubSessionId) throw new Error("hubSessionId is required");
      connectVideoRelay({
        hubUrl: requireHubUrl(options.hubUrl),
        agentId: options.agentId,
        agentSessionId: session.id,
        hubSessionId,
        port: options.port
      });
      return { session };
    }
    case "delete-session":
      return { deleted: deleteSession(requireString(body.sessionId, "sessionId")) };
    case "screenshot": {
      const image = await captureScreenshot(requireSerial(serial));
      return { contentType: "image/png", data: image.toString("base64") };
    }
    case "tap":
      return { tap: await tapDevice(requireSerial(serial), requireRatio(body.xRatio, "xRatio"), requireRatio(body.yRatio, "yRatio")) };
    case "long-press":
      return {
        longPress: await longPressDevice(
          requireSerial(serial),
          requireRatio(body.xRatio, "xRatio"),
          requireRatio(body.yRatio, "yRatio"),
          asNumber(body.durationMs) ?? 650
        )
      };
    case "swipe":
      return {
        swipe: await swipeDevice(requireSerial(serial), {
          xStartRatio: requireRatio(body.xStartRatio, "xStartRatio"),
          yStartRatio: requireRatio(body.yStartRatio, "yStartRatio"),
          xEndRatio: requireRatio(body.xEndRatio, "xEndRatio"),
          yEndRatio: requireRatio(body.yEndRatio, "yEndRatio"),
          durationMs: asNumber(body.durationMs)
        })
      };
    case "control": {
      const action = asString(body.action) as ControlAction | undefined;
      if (!action || !controlActions.includes(action)) throw new Error("A supported control action is required");
      return { control: await controlDevice(requireSerial(serial), action, asString(body.value)) };
    }
    default:
      throw new Error(`Unsupported agent command: ${request.command}`);
  }
}

function connectVideoRelay(options: { hubUrl: string; agentId: string; agentSessionId: string; hubSessionId: string; port: number }) {
  activeVideoRelays.get(options.hubSessionId)?.hub.close();
  activeVideoRelays.get(options.hubSessionId)?.local.close();

  const hub = new WebSocket(
    `${httpToWs(options.hubUrl)}/ws/agents/${encodeURIComponent(options.agentId)}/sessions/${encodeURIComponent(options.agentSessionId)}/video?hubSessionId=${encodeURIComponent(options.hubSessionId)}`
  );
  const local = new WebSocket(`ws://127.0.0.1:${options.port}/ws/sessions/${encodeURIComponent(options.agentSessionId)}/video`);

  activeVideoRelays.set(options.hubSessionId, { hub, local });

  local.on("message", (data, isBinary) => {
    if (hub.readyState === WebSocket.OPEN) {
      hub.send(data, { binary: isBinary });
    }
  });

  const cleanup = () => {
    const relay = activeVideoRelays.get(options.hubSessionId);
    if (relay?.hub === hub && relay.local === local) {
      activeVideoRelays.delete(options.hubSessionId);
    }
    if (hub.readyState === WebSocket.OPEN || hub.readyState === WebSocket.CONNECTING) hub.close();
    if (local.readyState === WebSocket.OPEN || local.readyState === WebSocket.CONNECTING) local.close();
  };

  hub.on("close", cleanup);
  local.on("close", cleanup);
  hub.on("error", cleanup);
  local.on("error", cleanup);
}

function sendControlResponse(socket: WebSocket, response: AgentControlResponse) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(response));
  }
}

function requireHubUrl(value?: string) {
  if (!value) throw new Error("Agent is missing HUB_URL");
  return normalizeHttpUrl(value);
}

function requireSerial(value?: string) {
  if (!value) throw new Error("serial is required");
  return value;
}

function requireString(value: unknown, name: string) {
  const text = asString(value);
  if (!text) throw new Error(`${name} is required`);
  return text;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function requireRatio(value: unknown, name: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new Error(`${name} must be a number between 0 and 1`);
  }
  return number;
}

async function listAgentDevices() {
  const publications = getPublications();
  return (await listDevices()).map((device) => ({
    ...device,
    publication: publications[device.serial]
  }));
}
