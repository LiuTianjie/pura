import type { DevicePublication, DevicesResponse, MirrorSession } from "./types";

export async function fetchDevices(): Promise<DevicesResponse> {
  const response = await fetch("/api/devices");
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function startSession(serial: string): Promise<MirrorSession> {
  const response = await fetch(`/api/devices/${encodeURIComponent(serial)}/session`, {
    method: "POST"
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
