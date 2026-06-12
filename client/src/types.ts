export type AndroidDevice = {
  serial: string;
  state: "device" | "unauthorized" | "offline";
  transport: "usb" | "tcp";
  model?: string;
  manufacturer?: string;
  androidVersion?: string;
  size?: {
    width: number;
    height: number;
  };
  publication?: DevicePublication;
  remoteSerial?: string;
  agentId?: string;
  agentName?: string;
  agentUrl?: string;
  controlOnline?: boolean;
};

export type DevicePublication = {
  serial: string;
  label: string;
  owner?: string;
  note?: string;
  published: boolean;
  updatedAt: string;
};

export type MirrorSession = {
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

export type SavedScreenshot = {
  id: string;
  deviceSerial: string;
  fileName: string;
  annotatedFileName?: string;
  url: string;
  downloadUrl: string;
  rawUrl?: string;
  rawDownloadUrl?: string;
  createdAt: string;
  sizeBytes: number;
  annotationCount?: number;
  annotations?: unknown[];
};

export type SavedPackage = {
  id: string;
  fileName: string;
  originalName: string;
  url: string;
  createdAt: string;
  sizeBytes: number;
};

export type DeviceLogs = {
  preset: "current_app" | "crash" | "network" | "all";
  minLevel?: LogLevel;
  packageName?: string;
  pid?: string;
  pids?: string[];
  lines: string[];
  capturedAt: string;
};

export type LogLevel = "V" | "D" | "I" | "W" | "E" | "F";

export type DiscussionDoc = {
  deviceId: string;
  documentId: string;
  url: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastInsertedAt?: string;
  lastStatus?: string;
};

export type DiscussionDocStatus = {
  enabled: boolean;
  configured: boolean;
  missing: string[];
  defaultFolderToken?: string;
  doc?: DiscussionDoc;
};

export type DevicesResponse = {
  devices: AndroidDevice[];
  sessions: MirrorSession[];
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
