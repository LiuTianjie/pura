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
