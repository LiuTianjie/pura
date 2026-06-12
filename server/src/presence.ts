import { WebSocket } from "ws";

type PresenceClient = {
  id: string;
  name: string;
  color: string;
  socket: WebSocket;
  seenAt: number;
};

type CursorMessage = {
  type: "hello" | "cursor" | "leave" | "annotation" | "clear";
  clientId?: string;
  name?: string;
  color?: string;
  xRatio?: number;
  yRatio?: number;
  annotation?: unknown;
};

const rooms = new Map<string, Set<PresenceClient>>();

export function attachPresenceClient(roomId: string, socket: WebSocket) {
  const client: PresenceClient = {
    id: "",
    name: "Viewer",
    color: "#d6ff59",
    socket,
    seenAt: Date.now()
  };
  const room = rooms.get(roomId) ?? new Set<PresenceClient>();
  room.add(client);
  rooms.set(roomId, room);

  socket.on("message", (data) => {
    const message = parseCursorMessage(data);
    if (!message) return;

    client.id = message.clientId ?? client.id;
    client.name = (message.name ?? client.name).slice(0, 32);
    client.color = normalizeColor(message.color ?? client.color);
    client.seenAt = Date.now();

    if (message.type === "hello") {
      broadcastRoster(room);
      return;
    }

    if (message.type === "leave") {
      broadcast(room, client, { type: "leave", clientId: client.id });
      broadcastRoster(room);
      return;
    }

    if (message.type === "clear") {
      broadcast(room, client, { type: "clear", clientId: client.id });
      return;
    }

    if (message.type === "annotation") {
      broadcast(room, client, {
        type: "annotation",
        clientId: client.id,
        name: client.name,
        color: client.color,
        annotation:
          message.annotation && typeof message.annotation === "object"
            ? {
                ...message.annotation,
                name: client.name,
                color: client.color
              }
            : message.annotation,
        seenAt: Date.now()
      });
      return;
    }

    if (message.type === "cursor") {
      const xRatio = clamp(Number(message.xRatio), 0, 1);
      const yRatio = clamp(Number(message.yRatio), 0, 1);
      broadcast(room, client, {
        type: "cursor",
        clientId: client.id,
        name: client.name,
        color: client.color,
        xRatio,
        yRatio,
        seenAt: Date.now()
      });
    }
  });

  socket.on("close", () => {
    room.delete(client);
    broadcast(room, client, { type: "leave", clientId: client.id });
    broadcastRoster(room);
    if (room.size === 0) rooms.delete(roomId);
  });
}

function broadcast(room: Set<PresenceClient>, sender: PresenceClient, payload: unknown) {
  const text = JSON.stringify(payload);
  for (const client of room) {
    if (client !== sender && client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(text);
    }
  }
}

function broadcastRoster(room: Set<PresenceClient>) {
  const viewers = [...room]
    .filter((client) => client.id)
    .map((client) => ({
      clientId: client.id,
      name: client.name,
      color: client.color,
      seenAt: client.seenAt
    }));
  const text = JSON.stringify({ type: "roster", viewers });
  for (const client of room) {
    if (client.socket.readyState === WebSocket.OPEN) client.socket.send(text);
  }
}

function parseCursorMessage(data: WebSocket.RawData): CursorMessage | null {
  try {
    const message = JSON.parse(data.toString()) as CursorMessage;
    if (!["hello", "cursor", "leave", "annotation", "clear"].includes(message.type)) return null;
    return message;
  } catch {
    return null;
  }
}

function normalizeColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#d6ff59";
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
