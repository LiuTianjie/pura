#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { listDevices } from "./adb.js";
import { readConfig, writeConfig } from "./config.js";
import { getLanAddress, normalizeHttpUrl } from "./network.js";

const args = process.argv.slice(2);
const command = args[0];

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

  writeConfig({ hubUrl, agentId, agentName });

  console.log(`pura-cli saved hub: ${hubUrl}`);
  console.log(`pura-cli starting agent: ${agentName} (${agentId})`);
  console.log(`agent URL announced to hub: ${publicUrl}`);

  startServer({
    ROLE: "agent",
    HUB_URL: hubUrl,
    AGENT_ID: agentId,
    AGENT_NAME: agentName,
    PUBLIC_URL: publicUrl,
    PORT: port,
    HOST: readFlag("--host") ?? "0.0.0.0",
    DATA_DIR: readFlag("--data-dir") ?? "data-agent"
  });
}

async function publishLocalDevice() {
  const config = readConfig();
  const agentPort = readFlag("--port") ?? "8788";
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

function printHelp() {
  console.log(`pura-cli

Usage:
  pura-cli hub [--host 0.0.0.0] [--port 8787]
  pura-cli connect <hub-ip-or-url> [--name developer] [--port 8788] [--public-url http://lan-ip:8788]
  pura-cli connect device [--serial adb-serial] [--name device-name] [--owner developer] [--note text]
  pura-cli devices
`);
}
