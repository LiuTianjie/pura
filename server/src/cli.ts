#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { listDevices } from "./adb.js";
import { type PuraConfig, readConfig, writeConfig } from "./config.js";
import { getLanAddress, normalizeHttpUrl } from "./network.js";

const args = process.argv.slice(2);
const command = args[0];
const launchAgentLabel = "tech.itool.pura.agent";
const launchAgentPath = path.join(os.homedir(), "Library", "LaunchAgents", `${launchAgentLabel}.plist`);

if (!command || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

if (command === "hub") {
  startServer({
    ROLE: "hub",
    PORT: readFlag("--port") ?? "8787",
    HOST: readFlag("--host") ?? "0.0.0.0"
  });
} else if (command === "connect") {
  await handleConnect();
} else if (command === "auto-connect") {
  await handleAutoConnect();
} else if (command === "devices") {
  console.table(await listDevices());
} else {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

async function handleConnect() {
  const target = args[1];
  if (!target) {
    console.error("Missing hub address or subcommand.");
    printHelp();
    process.exit(1);
  }

  if (target === "device") {
    await publishLocalDevice();
    return;
  }

  const hubUrl = normalizeHttpUrl(target);
  const config = readConfig();
  const agentId = readFlag("--id") ?? config.agentId ?? randomUUID();
  const agentName = readFlag("--name") ?? config.agentName ?? process.env.USER ?? "developer";
  const port = readFlag("--port") ?? "8788";
  const publicUrl = readFlag("--public-url") ?? `http://${getLanAddress()}:${port}`;
  const host = readFlag("--host") ?? "0.0.0.0";
  const dataDir = resolveAgentDataDir(readFlag("--data-dir") ?? config.dataDir);

  writeConfig({ hubUrl, agentId, agentName, agentPort: port, publicUrl, host, dataDir });

  console.log(`pura-cli saved hub: ${hubUrl}`);
  console.log(`agent URL announced to hub: ${publicUrl}`);

  if (hasFlag("--background") || hasFlag("--install")) {
    installLaunchAgent();
    return;
  }

  console.log(`pura-cli starting agent: ${agentName} (${agentId})`);
  console.log("Tip: use `--background` to keep the Agent running after this terminal closes.");

  startServer({
    ROLE: "agent",
    HUB_URL: hubUrl,
    AGENT_ID: agentId,
    AGENT_NAME: agentName,
    PUBLIC_URL: publicUrl,
    PORT: port,
    HOST: host,
    DATA_DIR: dataDir
  });
}

async function handleAutoConnect() {
  if (hasFlag("--install")) {
    installLaunchAgent();
    return;
  }

  if (hasFlag("--uninstall")) {
    uninstallLaunchAgent();
    return;
  }

  if (hasFlag("--status")) {
    printLaunchAgentStatus();
    return;
  }

  const config = readConfig();
  if (!config.hubUrl) {
    console.error("No saved hub found. Run `pura-cli connect <hub-url> --name <name>` once first.");
    process.exit(1);
  }

  startSavedAgent(config);
}

async function publishLocalDevice() {
  const config = readConfig();
  const agentPort = readFlag("--port") ?? config.agentPort ?? "8788";
  const devices = await listDevices();
  const serial = readFlag("--serial") ?? devices.find((device) => device.state === "device")?.serial;

  if (!serial) {
    console.error("No ready ADB device found. Run `adb devices -l` and authorize USB debugging first.");
    process.exit(1);
  }

  const device = devices.find((item) => item.serial === serial);
  const fallbackName = [device?.manufacturer, device?.model].filter(Boolean).join(" ") || serial;
  const label = readFlag("--name") ?? fallbackName;
  const owner = readFlag("--owner") ?? config.agentName ?? process.env.USER;
  const note = readFlag("--note") ?? "";

  const response = await fetch(`http://127.0.0.1:${agentPort}/api/devices/${encodeURIComponent(serial)}/publication`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, owner, note })
  });

  if (!response.ok) {
    console.error(`Failed to publish device: ${await response.text()}`);
    process.exit(1);
  }

  console.log(`Published ${label} (${serial}) to ${config.hubUrl ?? "configured hub"}`);
}

function startSavedAgent(config: PuraConfig) {
  const port = readFlag("--port") ?? config.agentPort ?? "8788";
  const publicUrl = readFlag("--public-url") ?? config.publicUrl ?? `http://${getLanAddress()}:${port}`;
  const agentId = readFlag("--id") ?? config.agentId ?? randomUUID();
  const agentName = readFlag("--name") ?? config.agentName ?? process.env.USER ?? "developer";
  const host = readFlag("--host") ?? config.host ?? "0.0.0.0";
  const dataDir = resolveAgentDataDir(readFlag("--data-dir") ?? config.dataDir);

  writeConfig({
    hubUrl: config.hubUrl,
    agentId,
    agentName,
    agentPort: port,
    publicUrl,
    host,
    dataDir
  });

  console.log(`pura-cli auto-connecting agent: ${agentName} (${agentId})`);
  console.log(`hub: ${config.hubUrl}`);
  console.log(`agent URL announced to hub: ${publicUrl}`);

  startServer({
    ROLE: "agent",
    HUB_URL: config.hubUrl,
    AGENT_ID: agentId,
    AGENT_NAME: agentName,
    PUBLIC_URL: publicUrl,
    PORT: port,
    HOST: host,
    DATA_DIR: dataDir
  });
}

function installLaunchAgent() {
  const config = readConfig();
  if (!config.hubUrl) {
    console.error("No saved hub found. Run `pura-cli connect <hub-url> --name <name>` once first.");
    process.exit(1);
  }

  if (process.platform !== "darwin") {
    console.error("`pura-cli auto-connect --install` currently supports macOS launchd only.");
    process.exit(1);
  }

  const cliPath = path.resolve(process.argv[1]);
  fs.mkdirSync(path.dirname(launchAgentPath), { recursive: true });
  fs.writeFileSync(launchAgentPath, makeLaunchAgentPlist(process.execPath, cliPath));

  const guiTarget = getLaunchdGuiTarget();
  const serviceTarget = `${guiTarget}/${launchAgentLabel}`;

  runLaunchctl(["bootout", serviceTarget], { allowFailure: true });
  runLaunchctl(["bootstrap", guiTarget, launchAgentPath]);
  runLaunchctl(["enable", serviceTarget], { allowFailure: true });
  runLaunchctl(["kickstart", "-k", serviceTarget], { allowFailure: true });

  console.log(`Installed pura auto-connect LaunchAgent: ${launchAgentPath}`);
  console.log(`It will start on login and keep the Agent connected to ${config.hubUrl}.`);
  if (cliPath.includes(`${path.sep}_npx${path.sep}`)) {
    console.warn("This was installed from an npx cache path. For long-term use, install pura-cli globally and run the install command again.");
  }
}

function uninstallLaunchAgent() {
  if (process.platform !== "darwin") {
    console.error("`pura-cli auto-connect --uninstall` currently supports macOS launchd only.");
    process.exit(1);
  }

  runLaunchctl(["bootout", `${getLaunchdGuiTarget()}/${launchAgentLabel}`], { allowFailure: true });
  if (fs.existsSync(launchAgentPath)) {
    fs.unlinkSync(launchAgentPath);
  }

  console.log("Removed pura auto-connect LaunchAgent.");
}

function printLaunchAgentStatus() {
  if (process.platform !== "darwin") {
    console.log("pura auto-connect status is only available for macOS launchd.");
    return;
  }

  const result = spawnSync("launchctl", ["print", `${getLaunchdGuiTarget()}/${launchAgentLabel}`], {
    encoding: "utf8"
  });

  if (result.status === 0) {
    console.log(result.stdout.trim());
  } else {
    console.log("pura auto-connect is not installed or not loaded.");
  }
}

function makeLaunchAgentPlist(nodePath: string, cliPath: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(launchAgentLabel)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(nodePath)}</string>
    <string>${escapeXml(cliPath)}</string>
    <string>auto-connect</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${escapeXml(path.join(os.homedir(), "Library", "Logs", "pura-agent.log"))}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(path.join(os.homedir(), "Library", "Logs", "pura-agent.err.log"))}</string>
</dict>
</plist>
`;
}

function runLaunchctl(args: string[], options?: { allowFailure?: boolean }) {
  const result = spawnSync("launchctl", args, { encoding: "utf8" });
  if (result.status !== 0 && !options?.allowFailure) {
    const message = result.stderr.trim() || result.stdout.trim() || `launchctl ${args.join(" ")} failed`;
    console.error(message);
    process.exit(result.status ?? 1);
  }
}

function getLaunchdGuiTarget() {
  if (!process.getuid) {
    console.error("Could not determine the current macOS user id.");
    process.exit(1);
  }

  return `gui/${process.getuid()}`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function resolveAgentDataDir(value?: string) {
  if (!value) return path.join(os.homedir(), ".pura", "agent-data");
  return path.isAbsolute(value) ? value : path.resolve(value);
}

function startServer(env: NodeJS.ProcessEnv) {
  const child = spawn(process.execPath, [new URL("./index.js", import.meta.url).pathname], {
    stdio: "inherit",
    env: {
      ...process.env,
      ...env
    }
  });

  child.on("exit", (code) => process.exit(code ?? 0));
}

function readFlag(name: string) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function hasFlag(name: string) {
  return args.includes(name);
}

function printHelp() {
  console.log(`pura-cli

Usage:
  pura-cli hub [--host 0.0.0.0] [--port 8787]
  pura-cli connect <hub-ip-or-url> [--name developer] [--port 8788] [--public-url http://lan-ip:8788] [--background]
  pura-cli auto-connect [--install|--uninstall|--status]
  pura-cli connect device [--serial adb-serial] [--name device-name] [--owner developer] [--note text]
  pura-cli devices
`);
}
