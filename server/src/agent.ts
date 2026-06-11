import type express from "express";
import { captureScreenshot, controlDevice, listDevices, longPressDevice, swipeDevice, tapDevice, type ControlAction } from "./adb.js";
import { getLanAddress, normalizeHttpUrl } from "./network.js";
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

async function listAgentDevices() {
  const publications = getPublications();
  return (await listDevices()).map((device) => ({
    ...device,
    publication: publications[device.serial]
  }));
}
