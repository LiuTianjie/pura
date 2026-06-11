import { execFile } from "node:child_process";
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

const ADB = process.env.ADB_PATH ?? "adb";
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
