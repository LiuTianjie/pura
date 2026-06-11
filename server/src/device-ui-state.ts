import { WebSocket } from "ws";

type DeviceUiState = {
  embeddedDocUrl?: string | null;
  embeddedDocWidth?: number;
  updatedAt?: number;
};

type DeviceUiMessage = {
  type: "state";
  state?: DeviceUiState;
};

const rooms = new Map<string, Set<WebSocket>>();
const states = new Map<string, DeviceUiState>();

export function attachDeviceUiClient(deviceId: string, socket: WebSocket) {
  const room = rooms.get(deviceId) ?? new Set<WebSocket>();
  room.add(socket);
  rooms.set(deviceId, room);

  socket.send(JSON.stringify({ type: "state", state: states.get(deviceId) ?? {} }));

  socket.on("message", (data) => {
    const message = parseDeviceUiMessage(data);
    if (!message) return;

    const nextState = normalizeDeviceUiState({
      ...(states.get(deviceId) ?? {}),
      ...(message.state ?? {}),
      updatedAt: Date.now()
    });
    states.set(deviceId, nextState);
    broadcast(room, nextState);
  });

  socket.on("close", () => {
    room.delete(socket);
    if (room.size === 0) rooms.delete(deviceId);
  });
}

function broadcast(room: Set<WebSocket>, state: DeviceUiState) {
  const text = JSON.stringify({ type: "state", state });
  for (const client of room) {
    if (client.readyState === WebSocket.OPEN) client.send(text);
  }
}

function parseDeviceUiMessage(data: WebSocket.RawData): DeviceUiMessage | null {
  try {
    const message = JSON.parse(data.toString()) as DeviceUiMessage;
    if (message.type !== "state") return null;
    return message;
  } catch {
    return null;
  }
}

function normalizeDeviceUiState(state: DeviceUiState): DeviceUiState {
  return {
    embeddedDocUrl: typeof state.embeddedDocUrl === "string" ? state.embeddedDocUrl.slice(0, 2000) : null,
    embeddedDocWidth: clamp(Number(state.embeddedDocWidth) || 620, 360, 920),
    updatedAt: state.updatedAt
  };
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
