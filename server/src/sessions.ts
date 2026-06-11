import { spawn, type ChildProcessByStdio } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { WebSocket } from "ws";
import { adbCommand } from "./adb.js";

type MirrorSession = {
  id: string;
  serial: string;
  clients: Set<WebSocket>;
  process?: ChildProcessByStdio<null, Readable, Readable>;
  restartTimer?: NodeJS.Timeout;
  stopTimer?: NodeJS.Timeout;
  startedAt?: number;
  lastError?: string;
};

const sessions = new Map<string, MirrorSession>();
const sessionsBySerial = new Map<string, string>();

const STREAM_SIZE = process.env.STREAM_SIZE;
const STREAM_BITRATE = process.env.STREAM_BITRATE ?? "8000000";
const STREAM_TIME_LIMIT_SECONDS = process.env.STREAM_TIME_LIMIT_SECONDS ?? "180";

export type PublicSession = {
  id: string;
  serial: string;
  viewerCount: number;
  startedAt?: number;
  lastError?: string;
  stream: {
    codec: "h264";
    container: "annexb";
    size: string;
    bitrate: string;
  };
};

export function getOrCreateSession(serial: string): PublicSession {
  const existingId = sessionsBySerial.get(serial);
  if (existingId) {
    const existing = sessions.get(existingId);
    if (existing) return toPublicSession(existing);
  }

  const session: MirrorSession = {
    id: randomUUID(),
    serial,
    clients: new Set()
  };

  sessions.set(session.id, session);
  sessionsBySerial.set(serial, session.id);
  startStream(session);

  return toPublicSession(session);
}

export function getSession(id: string) {
  return sessions.get(id);
}

export function deleteSession(id: string) {
  const session = sessions.get(id);
  if (!session) return false;

  cleanupSession(session);
  return true;
}

export function attachClient(id: string, socket: WebSocket) {
  const session = sessions.get(id);
  if (!session) {
    socket.close(1008, "session not found");
    return;
  }

  session.clients.add(socket);
  if (session.stopTimer) {
    clearTimeout(session.stopTimer);
    session.stopTimer = undefined;
  }

  if (!session.process) {
    startStream(session);
  }

  socket.on("close", () => {
    session.clients.delete(socket);
    scheduleStopIfIdle(session);
  });
}

export function listSessions(): PublicSession[] {
  return [...sessions.values()].map(toPublicSession);
}

function startStream(session: MirrorSession) {
  if (session.process || session.restartTimer) return;

  const args = [
    "-s",
    session.serial,
    "exec-out",
    "screenrecord",
    "--output-format=h264",
    "--bit-rate",
    STREAM_BITRATE,
    "--time-limit",
    STREAM_TIME_LIMIT_SECONDS,
    "-"
  ];

  if (STREAM_SIZE) {
    args.splice(6, 0, "--size", STREAM_SIZE);
  }

  const adb = adbCommand(args);

  const child = spawn(adb.command, adb.args, {
    stdio: ["ignore", "pipe", "pipe"]
  });

  session.process = child;
  session.startedAt = Date.now();
  session.lastError = undefined;

  child.stdout.on("data", (chunk: Buffer) => {
    for (const client of session.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(chunk, { binary: true });
      }
    }
  });

  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8").trim();
    if (text) session.lastError = text.slice(-800);
  });

  child.on("error", (error) => {
    session.lastError = error.message;
  });

  child.on("close", () => {
    session.process = undefined;
    if (session.clients.size > 0) {
      session.restartTimer = setTimeout(() => {
        session.restartTimer = undefined;
        startStream(session);
      }, 600);
    } else {
      scheduleStopIfIdle(session);
    }
  });
}

function scheduleStopIfIdle(session: MirrorSession) {
  if (session.clients.size > 0 || session.stopTimer) return;

  session.stopTimer = setTimeout(() => {
    if (session.clients.size === 0) cleanupSession(session);
  }, 5000);
}

function cleanupSession(session: MirrorSession) {
  if (session.restartTimer) clearTimeout(session.restartTimer);
  if (session.stopTimer) clearTimeout(session.stopTimer);

  if (session.process && !session.process.killed) {
    session.process.kill("SIGTERM");
  }

  for (const client of session.clients) {
    client.close(1001, "session ended");
  }

  sessions.delete(session.id);
  sessionsBySerial.delete(session.serial);
}

function toPublicSession(session: MirrorSession): PublicSession {
  return {
    id: session.id,
    serial: session.serial,
    viewerCount: session.clients.size,
    startedAt: session.startedAt,
    lastError: session.lastError,
    stream: {
      codec: "h264",
      container: "annexb",
      size: STREAM_SIZE ?? "native",
      bitrate: STREAM_BITRATE
    }
  };
}
