import type { ControlAction, DevicePublication, DevicesResponse, MirrorSession, SavedScreenshot } from "./types";

export async function fetchDevices(): Promise<DevicesResponse> {
  const response = await fetch("/api/devices");
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function startSession(serial: string, options?: { restart?: boolean }): Promise<MirrorSession> {
  const response = await fetch(`/api/devices/${encodeURIComponent(serial)}/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ restart: options?.restart ?? false })
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = await response.json();
  return body.session;
}

export async function endSession(id: string) {
  const response = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function tapDevice(serial: string, xRatio: number, yRatio: number) {
  const response = await fetch(`/api/devices/${encodeURIComponent(serial)}/tap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ xRatio, yRatio })
  });

  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function longPressDevice(serial: string, xRatio: number, yRatio: number, durationMs = 650) {
  const response = await fetch(`/api/devices/${encodeURIComponent(serial)}/long-press`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ xRatio, yRatio, durationMs })
  });

  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function swipeDevice(
  serial: string,
  input: { xStartRatio: number; yStartRatio: number; xEndRatio: number; yEndRatio: number; durationMs?: number }
) {
  const response = await fetch(`/api/devices/${encodeURIComponent(serial)}/swipe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function controlDevice(serial: string, action: ControlAction, value?: string) {
  const response = await fetch(`/api/devices/${encodeURIComponent(serial)}/control`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action, value })
  });

  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function saveDeviceScreenshot(serial: string): Promise<SavedScreenshot> {
  const response = await fetch(`/api/devices/${encodeURIComponent(serial)}/screenshots`, {
    method: "POST"
  });

  if (!response.ok) throw new Error(await readError(response));
  const body = await response.json();
  return body.screenshot;
}

export async function fetchDeviceScreenshots(serial: string): Promise<SavedScreenshot[]> {
  const response = await fetch(`/api/devices/${encodeURIComponent(serial)}/screenshots`);

  if (!response.ok) throw new Error(await readError(response));
  const body = await response.json();
  return body.screenshots;
}

export async function publishDevice(serial: string, input: { label: string; owner?: string; note?: string }): Promise<DevicePublication> {
  const response = await fetch(`/api/devices/${encodeURIComponent(serial)}/publication`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(await readError(response));
  const body = await response.json();
  return body.publication;
}

export async function unpublishDevice(serial: string): Promise<DevicePublication | undefined> {
  const response = await fetch(`/api/devices/${encodeURIComponent(serial)}/publication`, {
    method: "DELETE"
  });

  if (!response.ok) throw new Error(await readError(response));
  const body = await response.json();
  return body.publication;
}

async function readError(response: Response) {
  try {
    const body = await response.json();
    return body.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}
