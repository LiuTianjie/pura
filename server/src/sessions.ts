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
  h264Pending?: Buffer;
  h264Config: Buffer[];
  h264Replay: Buffer[];
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

export function getOrCreateSession(serial: string, options?: { restart?: boolean }): PublicSession {
  const existingId = sessionsBySerial.get(serial);
  if (existingId) {
    const existing = sessions.get(existingId);
    if (existing && !options?.restart) return toPublicSession(existing);
    if (existing) cleanupSession(existing);
  }

  const session: MirrorSession = {
    id: randomUUID(),
    serial,
    clients: new Set(),
    h264Config: [],
    h264Replay: []
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

  sendReplay(session, socket);

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
    recordReplay(session, chunk);
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

function sendReplay(session: MirrorSession, socket: WebSocket) {
  for (const chunk of session.h264Replay) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(chunk, { binary: true });
    }
  }
}

function recordReplay(session: MirrorSession, chunk: Buffer) {
  const data = session.h264Pending ? Buffer.concat([session.h264Pending, chunk]) : chunk;
  const starts = findStartCodes(data);

  if (starts.length < 2) {
    session.h264Pending = starts.length === 1 ? data.subarray(starts[0]) : data.subarray(Math.max(0, data.length - 4));
    return;
  }

  for (let index = 0; index < starts.length - 1; index += 1) {
    const start = starts[index];
    const nextStart = starts[index + 1];
    if (nextStart <= start) continue;
    recordNalUnit(session, data.subarray(start, nextStart));
  }

  session.h264Pending = data.subarray(starts[starts.length - 1]);
}

function recordNalUnit(session: MirrorSession, nal: Buffer) {
  const nalType = getNalType(nal);
  if (!nalType) return;

  if (nalType === 7 || nalType === 8) {
    const existingIndex = session.h264Config.findIndex((item) => getNalType(item) === nalType);
    if (existingIndex >= 0) {
      session.h264Config[existingIndex] = Buffer.from(nal);
    } else {
      session.h264Config.push(Buffer.from(nal));
    }
  }

  if (nalType === 5) {
    session.h264Replay = [...session.h264Config.map((item) => Buffer.from(item)), Buffer.from(nal)];
    return;
  }

  if (session.h264Replay.length > 0) {
    session.h264Replay.push(Buffer.from(nal));
    trimReplay(session);
  }
}

function trimReplay(session: MirrorSession) {
  const maxBytes = 4 * 1024 * 1024;
  let total = session.h264Replay.reduce((sum, item) => sum + item.length, 0);
  while (session.h264Replay.length > session.h264Config.length + 1 && total > maxBytes) {
    const removed = session.h264Replay.splice(session.h264Config.length, 1)[0];
    total -= removed.length;
  }
}

function getNalType(nal: Buffer) {
  const startCodeLength = nal[2] === 1 ? 3 : nal[3] === 1 ? 4 : 0;
  if (!startCodeLength || nal.length <= startCodeLength) return undefined;
  return nal[startCodeLength] & 0x1f;
}

function findStartCodes(data: Buffer) {
  const starts: number[] = [];
  for (let index = 0; index < data.length - 3; index += 1) {
    if (data[index] !== 0 || data[index + 1] !== 0) continue;
    if (data[index + 2] === 1) {
      starts.push(index);
      index += 2;
    } else if (data[index + 2] === 0 && data[index + 3] === 1) {
      starts.push(index);
      index += 3;
    }
  }
  return starts;
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
