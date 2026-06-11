import os from "node:os";

export function getLanAddress() {
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const item of interfaces ?? []) {
      if (item.family === "IPv4" && !item.internal) {
        return item.address;
      }
    }
  }

  return "127.0.0.1";
}

export function normalizeHttpUrl(input: string) {
  const value = input.trim();
  if (!value) throw new Error("Missing URL");
  return /^https?:\/\//i.test(value) ? value.replace(/\/$/, "") : `http://${value.replace(/\/$/, "")}`;
}

export function httpToWs(input: string) {
  return input.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
}
