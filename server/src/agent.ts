import type express from "express";
import { controlDevice, listDevices, tapDevice, type ControlAction } from "./adb.js";
import { getLanAddress, normalizeHttpUrl } from "./network.js";
import { getPublications, publishDevice, unpublishDevice } from "./registry.js";
import { deleteSession, getOrCreateSession, listSessions } from "./sessions.js";

export type AgentOptions = {
  hubUrl?: string;
  agentId: string;
  agentName?: string;
  publicUrl?: string;
  port: number;
};

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
    res.json({ session: getOrCreateSession(req.params.serial) });
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

async function listAgentDevices() {
  const publications = getPublications();
  return (await listDevices()).map((device) => ({
    ...device,
    publication: publications[device.serial]
  }));
}
