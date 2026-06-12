import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { installAgentRoutes, startAgentControlChannel, startAgentHeartbeat } from "./agent.js";
import { attachDeviceUiClient } from "./device-ui-state.js";
import { attachAgentControlClient, attachAgentVideoStream, attachHubVideoClient, installHubRoutes } from "./hub.js";
import { getLanAddress } from "./network.js";
import { installPackageRoutes } from "./packages.js";
import { attachPresenceClient } from "./presence.js";
import { installScreenshotRoutes } from "./screenshots.js";
import { attachClient } from "./sessions.js";

const app = express();
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";
const role = (process.env.ROLE ?? "standalone").toLowerCase();
const agentId = process.env.AGENT_ID ?? `${process.env.USER ?? "dev"}-${getLanAddress()}`.replace(/[^a-zA-Z0-9_.-]/g, "-");
const agentName = process.env.AGENT_NAME ?? process.env.USER;
const publicUrl = process.env.PUBLIC_URL;
const hubUrl = process.env.HUB_URL;

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? "40mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "pura", role, agentId: role === "agent" ? agentId : undefined });
});

installScreenshotRoutes(app);
installPackageRoutes(app);

if (role === "hub") {
  installHubRoutes(app);
} else {
  installAgentRoutes(app);
  if (role === "agent") {
    startAgentHeartbeat({ hubUrl, agentId, agentName, publicUrl, port });
    startAgentControlChannel({ hubUrl, agentId, agentName, publicUrl, port });
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, "../../dist/client");

app.use(express.static(clientDist));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

const server = app.listen(port, host, () => {
  console.log(`pura ${role} listening on http://${host}:${port}`);
  if (role === "agent" && hubUrl) {
    console.log(`pura agent ${agentId} connecting to ${hubUrl}`);
    console.log(`agent public URL: ${publicUrl ?? `http://${getLanAddress()}:${port}`}`);
  }
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const videoMatch = url.pathname.match(/^\/ws\/sessions\/([^/]+)\/video$/);
  const presenceMatch = url.pathname.match(/^\/ws\/presence\/([^/]+)$/);
  const deviceUiMatch = url.pathname.match(/^\/ws\/devices\/([^/]+)\/ui$/);
  const agentControlMatch = url.pathname.match(/^\/ws\/agents\/([^/]+)\/control$/);
  const agentVideoMatch = url.pathname.match(/^\/ws\/agents\/([^/]+)\/sessions\/([^/]+)\/video$/);

  if (!videoMatch && !presenceMatch && !deviceUiMatch && !agentControlMatch && !agentVideoMatch) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    if (presenceMatch) {
      attachPresenceClient(decodeURIComponent(presenceMatch[1]), ws);
    } else if (deviceUiMatch) {
      attachDeviceUiClient(decodeURIComponent(deviceUiMatch[1]), ws);
    } else if (role === "hub" && agentControlMatch) {
      attachAgentControlClient(decodeURIComponent(agentControlMatch[1]), ws);
    } else if (role === "hub" && agentVideoMatch) {
      attachAgentVideoStream(
        decodeURIComponent(agentVideoMatch[1]),
        decodeURIComponent(agentVideoMatch[2]),
        url.searchParams.get("hubSessionId") ?? "",
        ws
      );
    } else if (role === "hub" && videoMatch) {
      attachHubVideoClient(videoMatch![1], ws);
    } else if (videoMatch) {
      attachClient(videoMatch![1], ws);
    } else {
      ws.close(1008, "unsupported websocket route");
    }
  });
});
