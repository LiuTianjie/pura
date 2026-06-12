import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DeviceState = "device" | "unauthorized" | "offline";

export type AndroidDevice = {
  serial: string;
  state: DeviceState;
  transport: "usb" | "tcp";
  model?: string;
  manufacturer?: string;
  androidVersion?: string;
  size?: {
    width: number;
    height: number;
  };
};

export type ControlAction =
  | "back"
  | "home"
  | "recents"
  | "menu"
  | "power"
  | "volume_up"
  | "volume_down"
  | "mute"
  | "enter"
  | "delete"
  | "swipe_up"
  | "swipe_down"
  | "swipe_left"
  | "swipe_right"
  | "text";

const ADB = resolveAdbCommand();
const INCLUDE_TCP_DEVICES = process.env.INCLUDE_TCP_DEVICES === "true";

export function adbCommand(args: string[]) {
  return {
    command: ADB,
    args
  };
}

export async function listDevices(): Promise<AndroidDevice[]> {
  const { stdout } = await execFileAsync(ADB, ["devices", "-l"], {
    timeout: 5000,
    maxBuffer: 1024 * 1024
  });

  const baseDevices = stdout
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseDeviceLine)
    .filter((device): device is AndroidDevice => Boolean(device))
    .filter((device) => INCLUDE_TCP_DEVICES || device.transport === "usb");

  return Promise.all(baseDevices.map(enrichDevice));
}

export async function tapDevice(serial: string, xRatio: number, yRatio: number) {
  const size = await getDisplaySize(serial);
  const x = clamp(Math.round(xRatio * size.width), 0, size.width - 1);
  const y = clamp(Math.round(yRatio * size.height), 0, size.height - 1);

  await execFileAsync(ADB, ["-s", serial, "shell", "input", "tap", String(x), String(y)], {
    timeout: 3000,
    maxBuffer: 64 * 1024
  });

  return { x, y, width: size.width, height: size.height };
}

export async function longPressDevice(serial: string, xRatio: number, yRatio: number, durationMs = 650) {
  const size = await getDisplaySize(serial);
  const x = clamp(Math.round(xRatio * size.width), 0, size.width - 1);
  const y = clamp(Math.round(yRatio * size.height), 0, size.height - 1);
  const duration = clamp(Math.round(durationMs), 350, 2500);

  await execFileAsync(ADB, ["-s", serial, "shell", "input", "swipe", String(x), String(y), String(x), String(y), String(duration)], {
    timeout: 4000,
    maxBuffer: 64 * 1024
  });

  return { x, y, width: size.width, height: size.height, duration };
}

export async function swipeDevice(serial: string, input: { xStartRatio: number; yStartRatio: number; xEndRatio: number; yEndRatio: number; durationMs?: number }) {
  const size = await getDisplaySize(serial);
  const x1 = clamp(Math.round(input.xStartRatio * size.width), 0, size.width - 1);
  const y1 = clamp(Math.round(input.yStartRatio * size.height), 0, size.height - 1);
  const x2 = clamp(Math.round(input.xEndRatio * size.width), 0, size.width - 1);
  const y2 = clamp(Math.round(input.yEndRatio * size.height), 0, size.height - 1);
  const duration = clamp(Math.round(input.durationMs ?? 320), 80, 2500);

  await execFileAsync(ADB, ["-s", serial, "shell", "input", "swipe", String(x1), String(y1), String(x2), String(y2), String(duration)], {
    timeout: 5000,
    maxBuffer: 64 * 1024
  });

  return { from: { x: x1, y: y1 }, to: { x: x2, y: y2 }, width: size.width, height: size.height, duration };
}

export async function captureScreenshot(serial: string): Promise<Buffer> {
  const { stdout } = await execFileAsync(ADB, ["-s", serial, "exec-out", "screencap", "-p"], {
    encoding: "buffer",
    timeout: 5000,
    maxBuffer: 20 * 1024 * 1024
  });

  return stdout;
}

export async function controlDevice(serial: string, action: ControlAction, value?: string) {
  if (action === "text") {
    const text = sanitizeInputText(value ?? "");
    if (!text) throw new Error("Text input is empty");

    await execFileAsync(ADB, ["-s", serial, "shell", "input", "text", text], {
      timeout: 5000,
      maxBuffer: 64 * 1024
    });

    return { action, text };
  }

  const keyCode = keyEvents[action];
  if (keyCode) {
    await execFileAsync(ADB, ["-s", serial, "shell", "input", "keyevent", keyCode], {
      timeout: 3000,
      maxBuffer: 64 * 1024
    });

    return { action, keyCode };
  }

  if (action.startsWith("swipe_")) {
    const size = await getDisplaySize(serial);
    const [x1, y1, x2, y2] = swipePoints(action, size);

    await execFileAsync(ADB, ["-s", serial, "shell", "input", "swipe", String(x1), String(y1), String(x2), String(y2), "280"], {
      timeout: 4000,
      maxBuffer: 64 * 1024
    });

    return { action, from: { x: x1, y: y1 }, to: { x: x2, y: y2 }, width: size.width, height: size.height };
  }

  throw new Error(`Unsupported control action: ${action}`);
}

export type LogPreset = "current_app" | "crash" | "network" | "all";
export type LogLevel = "V" | "D" | "I" | "W" | "E" | "F";

export async function readDeviceLogs(
  serial: string,
  input: { preset?: LogPreset; query?: string; lines?: number; minLevel?: LogLevel } = {}
) {
  const lines = clamp(Math.round(input.lines ?? 350), 50, 1200);
  const preset = isLogPreset(input.preset) ? input.preset : "current_app";
  const currentPackage = preset === "current_app" ? await getFocusedPackage(serial).catch(() => undefined) : undefined;
  const pids = currentPackage ? await getPackagePids(serial, currentPackage).catch(() => []) : [];

  const minLevel = isLogLevel(input.minLevel) ? input.minLevel : preset === "crash" ? "E" : "V";
  const query = input.query?.trim().toLowerCase();
  const readLogcat = async () => {
    const args = ["-s", serial, "logcat", "-d", "-v", "time", "-t", String(lines * 3)];
    const { stdout } = await execFileAsync(ADB, args, {
      timeout: 6500,
      maxBuffer: 8 * 1024 * 1024
    });
    return stdout;
  };
  const filterLogs = (stdout: string) => stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => preset !== "current_app" || pids.length === 0 || pids.includes(readLogPid(line) ?? ""))
    .filter((line) => matchesLogPreset(line, preset))
    .filter((line) => logLevelRank(readLogLevel(line)) >= logLevelRank(minLevel))
    .filter((line) => !query || line.toLowerCase().includes(query))
    .slice(-lines);
  const missingCurrentApp = preset === "current_app" && (!currentPackage || pids.length === 0);
  const filtered = missingCurrentApp ? [] : filterLogs(await readLogcat());

  return {
    preset,
    minLevel,
    packageName: currentPackage,
    pid: pids[0],
    pids,
    lines: filtered,
    capturedAt: new Date().toISOString()
  };
}

export async function installApk(serial: string, apkPath: string) {
  const { stdout, stderr } = await execFileAsync(ADB, ["-s", serial, "install", "-r", apkPath], {
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024
  });

  return {
    ok: /Success/i.test(stdout) || /Success/i.test(stderr),
    output: [stdout, stderr].filter(Boolean).join("\n").trim()
  };
}

export async function openDeeplink(serial: string, url: string) {
  if (!/^([a-z][a-z0-9+.-]*):\/\//i.test(url)) {
    throw new Error("A valid deeplink URL is required");
  }

  const { stdout, stderr } = await execFileAsync(
    ADB,
    ["-s", serial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", url],
    {
      timeout: 8000,
      maxBuffer: 256 * 1024
    }
  );

  return {
    url,
    output: [stdout, stderr].filter(Boolean).join("\n").trim()
  };
}

function parseDeviceLine(line: string): AndroidDevice | null {
  const [serial, state] = line.split(/\s+/, 2);
  if (!serial || !state) return null;
  if (!["device", "unauthorized", "offline"].includes(state)) return null;

  return {
    serial,
    state: state as DeviceState,
    transport: serial.includes(":") ? "tcp" : "usb"
  };
}

async function enrichDevice(device: AndroidDevice): Promise<AndroidDevice> {
  if (device.state !== "device") return device;

  const [manufacturer, model, androidVersion, size] = await Promise.all([
    getProp(device.serial, "ro.product.manufacturer"),
    getProp(device.serial, "ro.product.model"),
    getProp(device.serial, "ro.build.version.release"),
    getDisplaySize(device.serial).catch(() => undefined)
  ]);

  return {
    ...device,
    manufacturer: manufacturer || undefined,
    model: model || undefined,
    androidVersion: androidVersion || undefined,
    size
  };
}

async function getProp(serial: string, prop: string) {
  const { stdout } = await execFileAsync(ADB, ["-s", serial, "shell", "getprop", prop], {
    timeout: 2500,
    maxBuffer: 64 * 1024
  });

  return stdout.trim();
}

async function getFocusedPackage(serial: string) {
  const outputs = await Promise.allSettled([
    execFileAsync(ADB, ["-s", serial, "shell", "dumpsys", "window", "windows"], {
      timeout: 3500,
      maxBuffer: 512 * 1024
    }),
    execFileAsync(ADB, ["-s", serial, "shell", "dumpsys", "activity", "activities"], {
      timeout: 3500,
      maxBuffer: 1024 * 1024
    }),
    execFileAsync(ADB, ["-s", serial, "shell", "dumpsys", "activity", "top"], {
      timeout: 3500,
      maxBuffer: 1024 * 1024
    })
  ]);
  const text = outputs
    .map((result) => (result.status === "fulfilled" ? result.value.stdout : ""))
    .join("\n");
  return parseFocusedPackage(text);
}

function parseFocusedPackage(text: string) {
  const patterns = [
    /mCurrentFocus=.*?\s([a-zA-Z0-9_.]+)\/[^\s}]+/,
    /mFocusedApp=.*?\s([a-zA-Z0-9_.]+)\/[^\s}]+/,
    /topResumedActivity=.*?\s([a-zA-Z0-9_.]+)\/[^\s}]+/,
    /mResumedActivity:.*?\s([a-zA-Z0-9_.]+)\/[^\s}]+/,
    /ResumedActivity:.*?\s([a-zA-Z0-9_.]+)\/[^\s}]+/,
    /ACTIVITY\s+([a-zA-Z0-9_.]+)\/[^\s]+/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1] && match[1] !== "null") return match[1];
  }
  return undefined;
}

async function getPackagePids(serial: string, packageName: string) {
  const { stdout } = await execFileAsync(ADB, ["-s", serial, "shell", "pidof", packageName], {
    timeout: 2500,
    maxBuffer: 64 * 1024
  });
  return stdout.trim().split(/\s+/).filter(Boolean);
}

function matchesLogPreset(line: string, preset: LogPreset) {
  if (preset === "all" || preset === "current_app") return true;
  if (preset === "crash") return /(fatal exception|androidruntime|exception|crash| force finishing |F\/)/i.test(line);
  if (preset === "network") return /(http|https|okhttp|retrofit|websocket|grpc|socket|ssl|dns|network)/i.test(line);
  return true;
}

function isLogPreset(value: unknown): value is LogPreset {
  return value === "current_app" || value === "crash" || value === "network" || value === "all";
}

function isLogLevel(value: unknown): value is LogLevel {
  return value === "V" || value === "D" || value === "I" || value === "W" || value === "E" || value === "F";
}

function readLogLevel(line: string) {
  const match = line.match(/\s([VDIWEF])\/[^:]+:/);
  return match?.[1] as LogLevel | undefined;
}

function readLogPid(line: string) {
  return line.match(/\(\s*(\d+)\)/)?.[1];
}

function logLevelRank(level?: "V" | "D" | "I" | "W" | "E" | "F") {
  if (level === "D") return 1;
  if (level === "I") return 2;
  if (level === "W") return 3;
  if (level === "E") return 4;
  if (level === "F") return 5;
  return 0;
}

export async function getDisplaySize(serial: string) {
  const { stdout } = await execFileAsync(ADB, ["-s", serial, "shell", "wm", "size"], {
    timeout: 2500,
    maxBuffer: 64 * 1024
  });

  const overrideMatch = stdout.match(/Override size:\s*(\d+)x(\d+)/i);
  const physicalMatch = stdout.match(/Physical size:\s*(\d+)x(\d+)/i);
  const match = overrideMatch ?? physicalMatch;

  if (!match) {
    throw new Error(`Unable to parse display size: ${stdout.trim() || "empty output"}`);
  }

  return {
    width: Number(match[1]),
    height: Number(match[2])
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveAdbCommand() {
  if (process.env.ADB_PATH) return process.env.ADB_PATH;

  const sdkRoot = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  const candidates = [
    sdkRoot ? path.join(sdkRoot, "platform-tools", "adb") : "",
    path.join(os.homedir(), "Library", "Android", "sdk", "platform-tools", "adb"),
    "/opt/homebrew/bin/adb",
    "/usr/local/bin/adb"
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? "adb";
}

const keyEvents: Partial<Record<ControlAction, string>> = {
  back: "KEYCODE_BACK",
  home: "KEYCODE_HOME",
  recents: "KEYCODE_APP_SWITCH",
  menu: "KEYCODE_MENU",
  power: "KEYCODE_POWER",
  volume_up: "KEYCODE_VOLUME_UP",
  volume_down: "KEYCODE_VOLUME_DOWN",
  mute: "KEYCODE_VOLUME_MUTE",
  enter: "KEYCODE_ENTER",
  delete: "KEYCODE_DEL"
};

function swipePoints(action: ControlAction, size: { width: number; height: number }) {
  const left = Math.round(size.width * 0.22);
  const right = Math.round(size.width * 0.78);
  const centerX = Math.round(size.width * 0.5);
  const top = Math.round(size.height * 0.24);
  const bottom = Math.round(size.height * 0.78);
  const centerY = Math.round(size.height * 0.5);

  if (action === "swipe_up") return [centerX, bottom, centerX, top];
  if (action === "swipe_down") return [centerX, top, centerX, bottom];
  if (action === "swipe_left") return [right, centerY, left, centerY];
  return [left, centerY, right, centerY];
}

function sanitizeInputText(value: string) {
  return value.trim().replaceAll("%", "%25").replace(/\s/g, "%s").slice(0, 500);
}
