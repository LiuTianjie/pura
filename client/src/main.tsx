import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import JMuxer from "jmuxer";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Cable,
  Circle,
  CornerDownLeft,
  Delete,
  FileText,
  Home,
  Keyboard,
  Languages,
  ListRestart,
  Menu,
  MonitorPlay,
  MousePointer2,
  PencilLine,
  Power,
  Radio,
  RefreshCw,
  Send,
  Smartphone,
  Usb,
  UserRound,
  Volume2,
  VolumeX
} from "lucide-react";
import { controlDevice, endSession, fetchDevices, publishDevice, startSession, tapDevice, unpublishDevice } from "./api";
import type { AndroidDevice, ControlAction, DevicesResponse, MirrorSession } from "./types";
import "./styles.css";

type PlayerStatus = "idle" | "connecting" | "live" | "error";
type Locale = "en" | "zh";
type ViewMode = "grid" | "focus";

const messages = {
  en: {
    appTitle: "Mirror Deck",
    appSubtitle: "LAN Android lab",
    refresh: "Refresh",
    publishedMachines: "Published machines",
    noMachinesPublished: "No machines published",
    devicesToPublish: "Devices to publish",
    allDevicesPublished: "All devices are published",
    usbHostViewer: "USB host viewer",
    waitingForDevice: "Waiting for device",
    stop: "Stop",
    starting: "Starting",
    restartView: "Restart view",
    openView: "Open view",
    unknownSize: "Unknown size",
    clickToTap: "Click to tap",
    deviceName: "Device name",
    developer: "Developer",
    owner: "Owner",
    note: "Note",
    notePlaceholder: "Build, branch, scenario",
    unpublish: "Unpublish",
    updateInfo: "Update info",
    publish: "Publish",
    standbyTitle: "Select a device and open view",
    statusConnecting: "Connecting",
    statusLive: "Live",
    statusError: "Stream error",
    statusIdle: "Idle",
    errorRefresh: "Unable to refresh devices",
    errorStart: "Unable to start session",
    errorPublish: "Unable to publish device",
    errorUnpublish: "Unable to unpublish device",
    gridView: "Grid",
    focusView: "Focus",
    phoneGrid: "Phone grid",
    phoneGridEyebrow: "Device wall",
    phoneCount: "phones online",
    openDevice: "Open device",
    preview: "Preview",
    noDevicesOnline: "No devices online",
    controls: "Controls",
    systemControls: "System",
    gestureControls: "Gestures",
    inputControls: "Input",
    back: "Back",
    home: "Home",
    recents: "Recents",
    menu: "Menu",
    power: "Power",
    volumeUp: "Vol +",
    volumeDown: "Vol -",
    mute: "Mute",
    swipeUp: "Swipe up",
    swipeDown: "Swipe down",
    swipeLeft: "Swipe left",
    swipeRight: "Swipe right",
    enter: "Enter",
    delete: "Delete",
    textPlaceholder: "Type text to send",
    sendText: "Send text",
    errorControl: "Unable to control device",
    languageToggle: "中文"
  },
  zh: {
    appTitle: "镜像控制台",
    appSubtitle: "局域网 Android 设备墙",
    refresh: "刷新",
    publishedMachines: "已发布设备",
    noMachinesPublished: "暂无已发布设备",
    devicesToPublish: "待发布设备",
    allDevicesPublished: "所有设备已发布",
    usbHostViewer: "USB 主机预览",
    waitingForDevice: "等待设备上线",
    stop: "停止",
    starting: "启动中",
    restartView: "重启画面",
    openView: "打开画面",
    unknownSize: "未知尺寸",
    clickToTap: "点击即触控",
    deviceName: "设备名称",
    developer: "研发",
    owner: "负责人",
    note: "备注",
    notePlaceholder: "构建、分支、场景",
    unpublish: "取消发布",
    updateInfo: "更新信息",
    publish: "发布",
    standbyTitle: "选择设备并打开画面",
    statusConnecting: "连接中",
    statusLive: "直播中",
    statusError: "流异常",
    statusIdle: "空闲",
    errorRefresh: "无法刷新设备",
    errorStart: "无法启动会话",
    errorPublish: "无法发布设备",
    errorUnpublish: "无法取消发布设备",
    gridView: "网格",
    focusView: "控制",
    phoneGrid: "手机网格",
    phoneGridEyebrow: "设备墙",
    phoneCount: "台设备在线",
    openDevice: "进入设备",
    preview: "预览",
    noDevicesOnline: "暂无在线设备",
    controls: "控制",
    systemControls: "系统键",
    gestureControls: "手势",
    inputControls: "输入",
    back: "返回",
    home: "主页",
    recents: "多任务",
    menu: "菜单",
    power: "电源",
    volumeUp: "音量 +",
    volumeDown: "音量 -",
    mute: "静音",
    swipeUp: "上滑",
    swipeDown: "下滑",
    swipeLeft: "左滑",
    swipeRight: "右滑",
    enter: "回车",
    delete: "删除",
    textPlaceholder: "输入要发送的文字",
    sendText: "发送文字",
    errorControl: "无法控制设备",
    languageToggle: "EN"
  }
} as const;

type MessageKey = keyof typeof messages.en;

function App() {
  const [data, setData] = useState<DevicesResponse>({ devices: [], sessions: [] });
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);
  const [session, setSession] = useState<MirrorSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishForm, setPublishForm] = useState({ label: "", owner: "", note: "" });
  const [locale, setLocale] = useState<Locale>(readInitialLocale);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const t = useCallback((key: MessageKey) => messages[locale][key], [locale]);

  const selectedDevice = useMemo(
    () => data.devices.find((device) => device.serial === selectedSerial) ?? null,
    [data.devices, selectedSerial]
  );
  const publishedDevices = useMemo(
    () => data.devices.filter((device) => device.publication?.published),
    [data.devices]
  );
  const localDevices = useMemo(
    () => data.devices.filter((device) => !device.publication?.published),
    [data.devices]
  );

  const refresh = useCallback(async () => {
    try {
      const next = await fetchDevices();
      setData(next);
      setError(null);
      if (!selectedSerial && next.devices.length > 0) {
        const firstReady =
          next.devices.find((device) => device.publication?.published && device.state === "device") ??
          next.devices.find((device) => device.state === "device") ??
          next.devices[0];
        setSelectedSerial(firstReady.serial);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("errorRefresh"));
    }
  }, [selectedSerial, t]);

  useEffect(() => {
    window.localStorage.setItem("pura.locale", locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!selectedDevice) return;
    setPublishForm({
      label: selectedDevice.publication?.label ?? formatDeviceName(selectedDevice),
      owner: selectedDevice.publication?.owner ?? "",
      note: selectedDevice.publication?.note ?? ""
    });
  }, [selectedDevice?.serial]);

  const openDevice = async (serial = selectedSerial) => {
    if (!serial) return;
    setLoading(true);
    setError(null);
    try {
      const next = await startSession(serial);
      setSession(next);
      setViewMode("focus");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("errorStart"));
    } finally {
      setLoading(false);
    }
  };

  const stopCurrentSession = async () => {
    if (!session) return;
    const id = session.id;
    setSession(null);
    await endSession(id).catch(() => undefined);
  };

  const selectDevice = (device: AndroidDevice) => {
    setSelectedSerial(device.serial);
    setPublishForm({
      label: device.publication?.label ?? formatDeviceName(device),
      owner: device.publication?.owner ?? "",
      note: device.publication?.note ?? ""
    });
  };

  const enterDevice = async (device: AndroidDevice) => {
    selectDevice(device);
    setViewMode("focus");
    if (device.state === "device") {
      await openDevice(device.serial);
    }
  };

  const publishSelectedDevice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedDevice) return;

    setLoading(true);
    setError(null);
    try {
      await publishDevice(selectedDevice.serial, publishForm);
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("errorPublish"));
    } finally {
      setLoading(false);
    }
  };

  const unpublishSelectedDevice = async () => {
    if (!selectedDevice) return;

    setLoading(true);
    setError(null);
    try {
      await unpublishDevice(selectedDevice.serial);
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("errorUnpublish"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="shell">
      <aside className="rail">
        <div className="brand">
          <span className="brandMark">
            <MonitorPlay size={19} />
          </span>
          <div>
            <h1>{t("appTitle")}</h1>
            <p>{t("appSubtitle")}</p>
          </div>
        </div>

        <div className="railControls">
          <button className="refreshButton" onClick={() => void refresh()}>
            <RefreshCw size={16} />
            {t("refresh")}
          </button>
          <button className="languageButton" onClick={() => setLocale((current) => (current === "en" ? "zh" : "en"))}>
            <Languages size={15} />
            {t("languageToggle")}
          </button>
        </div>

        <section className="deviceList" aria-label={t("publishedMachines")}>
          <div className="sectionLabel">
            <Radio size={14} />
            {t("publishedMachines")}
          </div>
          {publishedDevices.length === 0 ? (
            <div className="emptyState">
              <MonitorPlay size={22} />
              <span>{t("noMachinesPublished")}</span>
            </div>
          ) : (
            publishedDevices.map((device) => (
              <button
                className={`deviceItem published ${device.serial === selectedSerial ? "selected" : ""}`}
                key={device.serial}
                onClick={() => selectDevice(device)}
              >
                <Smartphone size={19} />
                <span className="deviceCopy">
                  <strong>{displayName(device)}</strong>
                  <small>{device.publication?.owner || device.serial}</small>
                </span>
                <StatusDot state={device.state} />
              </button>
            ))
          )}
        </section>

        <section className="deviceList compact" aria-label={t("devicesToPublish")}>
          <div className="sectionLabel">
            <Usb size={14} />
            {t("devicesToPublish")}
          </div>
          {localDevices.length === 0 ? (
            <div className="emptyState small">
              <Usb size={18} />
              <span>{t("allDevicesPublished")}</span>
            </div>
          ) : (
            localDevices.map((device) => (
              <button
                className={`deviceItem ${device.serial === selectedSerial ? "selected" : ""}`}
                key={device.serial}
                onClick={() => selectDevice(device)}
              >
                <Smartphone size={18} />
                <span className="deviceCopy">
                  <strong>{formatDeviceName(device)}</strong>
                  <small>{device.serial}</small>
                </span>
                <StatusDot state={device.state} />
              </button>
            ))
          )}
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{viewMode === "grid" ? t("phoneGridEyebrow") : t("usbHostViewer")}</p>
            <h2>{viewMode === "grid" ? t("phoneGrid") : selectedDevice ? displayName(selectedDevice) : t("waitingForDevice")}</h2>
          </div>
          <div className="viewTabs" role="tablist" aria-label="Console view">
            <button className={viewMode === "grid" ? "active" : ""} type="button" onClick={() => setViewMode("grid")}>
              {t("gridView")}
            </button>
            <button className={viewMode === "focus" ? "active" : ""} type="button" onClick={() => setViewMode("focus")}>
              {t("focusView")}
            </button>
          </div>
          <div className="actions">
            <button className="secondary" onClick={() => void stopCurrentSession()} disabled={!session}>
              <Power size={16} />
              {t("stop")}
            </button>
            <button className="primary" onClick={() => void openDevice()} disabled={!selectedSerial || loading}>
              <MonitorPlay size={17} />
              {loading ? t("starting") : session ? t("restartView") : t("openView")}
            </button>
          </div>
        </header>

        {error ? <div className="errorBanner">{error}</div> : null}

        {viewMode === "grid" ? (
          <DeviceGrid devices={data.devices} selectedSerial={selectedSerial} session={session} t={t} onOpen={(device) => void enterDevice(device)} />
        ) : (
          <>
            <div className="metaStrip">
              <InfoPill icon={<Cable size={15} />} label={selectedDevice?.transport.toUpperCase() ?? "USB"} />
              <InfoPill
                icon={<Smartphone size={15} />}
                label={selectedDevice?.size ? `${selectedDevice.size.width}x${selectedDevice.size.height}` : t("unknownSize")}
              />
              <InfoPill icon={<Circle size={13} />} label={selectedDevice?.state ?? "offline"} />
              <InfoPill icon={<MousePointer2 size={15} />} label={t("clickToTap")} />
              {selectedDevice?.agentName ? <InfoPill icon={<Radio size={15} />} label={selectedDevice.agentName} /> : null}
              {selectedDevice?.publication?.owner ? <InfoPill icon={<UserRound size={15} />} label={selectedDevice.publication.owner} /> : null}
            </div>

            {selectedDevice ? (
              <form className="publishPanel" onSubmit={(event) => void publishSelectedDevice(event)}>
                <label>
                  <span>
                    <PencilLine size={14} />
                    {t("deviceName")}
                  </span>
                  <input
                    value={publishForm.label}
                    onChange={(event) => setPublishForm((current) => ({ ...current, label: event.target.value }))}
                    placeholder={formatDeviceName(selectedDevice)}
                  />
                </label>
                <label>
                  <span>
                    <UserRound size={14} />
                    {t("developer")}
                  </span>
                  <input
                    value={publishForm.owner}
                    onChange={(event) => setPublishForm((current) => ({ ...current, owner: event.target.value }))}
                    placeholder={t("owner")}
                  />
                </label>
                <label>
                  <span>
                    <FileText size={14} />
                    {t("note")}
                  </span>
                  <input
                    value={publishForm.note}
                    onChange={(event) => setPublishForm((current) => ({ ...current, note: event.target.value }))}
                    placeholder={t("notePlaceholder")}
                  />
                </label>
                <div className="publishActions">
                  <button className="secondary" type="button" onClick={() => void unpublishSelectedDevice()} disabled={loading || !selectedDevice.publication?.published}>
                    {t("unpublish")}
                  </button>
                  <button className="primary" type="submit" disabled={loading || selectedDevice.state !== "device"}>
                    <Send size={16} />
                    {selectedDevice.publication?.published ? t("updateInfo") : t("publish")}
                  </button>
                </div>
              </form>
            ) : null}

            <ControlPanel
              device={selectedDevice}
              loading={loading}
              t={t}
              onError={(message) => setError(message)}
            />

            <MirrorPlayer device={selectedDevice} session={session} t={t} />
          </>
        )}
      </section>
    </main>
  );
}

function DeviceGrid({
  devices,
  selectedSerial,
  session,
  t,
  onOpen
}: {
  devices: AndroidDevice[];
  selectedSerial: string | null;
  session: MirrorSession | null;
  t: (key: MessageKey) => string;
  onOpen: (device: AndroidDevice) => void;
}) {
  if (devices.length === 0) {
    return (
      <section className="phoneGrid empty">
        <div className="emptyState">
          <Smartphone size={28} />
          <span>{t("noDevicesOnline")}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="phoneGrid" aria-label={t("phoneGrid")}>
      <div className="gridSummary">
        <strong>{devices.length}</strong>
        <span>{t("phoneCount")}</span>
      </div>
      <div className="phoneCards">
        {devices.map((device) => (
          <button
            className={`phoneCard ${device.serial === selectedSerial ? "selected" : ""}`}
            key={device.serial}
            type="button"
            onClick={() => onOpen(device)}
          >
            <div className="phonePreview" aria-label={t("preview")}>
              <div className="phoneChrome" style={{ aspectRatio: deviceAspectRatio(device) }}>
                <span className="speaker" />
                <div className="previewScreen">
                  <span className={`previewSignal ${device.state}`} />
                  <Smartphone size={34} />
                  <small>{device.size ? `${device.size.width}x${device.size.height}` : t("unknownSize")}</small>
                </div>
              </div>
              {session?.serial === device.serial ? <span className="liveTag">{t("statusLive")}</span> : null}
            </div>
            <div className="phoneMeta">
              <strong>{displayName(device)}</strong>
              <span>{device.agentName ?? device.agentId ?? device.serial}</span>
              {device.publication?.note ? <small>{device.publication.note}</small> : null}
            </div>
            <div className="phoneFooter">
              <span>
                <StatusDot state={device.state} />
                {device.state}
              </span>
              <span>{t("openDevice")}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function ControlPanel({
  device,
  loading,
  t,
  onError
}: {
  device: AndroidDevice | null;
  loading: boolean;
  t: (key: MessageKey) => string;
  onError: (message: string) => void;
}) {
  const [text, setText] = useState("");
  const disabled = !device || device.state !== "device" || loading;

  const sendControl = async (action: ControlAction, value?: string) => {
    if (!device || disabled) return;
    try {
      await controlDevice(device.serial, action, value);
    } catch (error) {
      onError(error instanceof Error ? error.message : t("errorControl"));
    }
  };

  const sendText = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    await sendControl("text", text);
    setText("");
  };

  return (
    <section className="controlPanel" aria-label={t("controls")}>
      <div className="controlGroup">
        <span className="controlLabel">{t("systemControls")}</span>
        <ControlButton icon={<ArrowLeft size={15} />} label={t("back")} disabled={disabled} onClick={() => void sendControl("back")} />
        <ControlButton icon={<Home size={15} />} label={t("home")} disabled={disabled} onClick={() => void sendControl("home")} />
        <ControlButton icon={<ListRestart size={15} />} label={t("recents")} disabled={disabled} onClick={() => void sendControl("recents")} />
        <ControlButton icon={<Menu size={15} />} label={t("menu")} disabled={disabled} onClick={() => void sendControl("menu")} />
        <ControlButton icon={<Power size={15} />} label={t("power")} disabled={disabled} onClick={() => void sendControl("power")} />
      </div>

      <div className="controlGroup">
        <span className="controlLabel">{t("gestureControls")}</span>
        <ControlButton icon={<ArrowUp size={15} />} label={t("swipeUp")} disabled={disabled} onClick={() => void sendControl("swipe_up")} />
        <ControlButton icon={<ArrowDown size={15} />} label={t("swipeDown")} disabled={disabled} onClick={() => void sendControl("swipe_down")} />
        <ControlButton icon={<ArrowLeft size={15} />} label={t("swipeLeft")} disabled={disabled} onClick={() => void sendControl("swipe_left")} />
        <ControlButton icon={<ArrowRight size={15} />} label={t("swipeRight")} disabled={disabled} onClick={() => void sendControl("swipe_right")} />
      </div>

      <div className="controlGroup">
        <span className="controlLabel">{t("inputControls")}</span>
        <ControlButton icon={<Volume2 size={15} />} label={t("volumeUp")} disabled={disabled} onClick={() => void sendControl("volume_up")} />
        <ControlButton icon={<Volume2 size={15} />} label={t("volumeDown")} disabled={disabled} onClick={() => void sendControl("volume_down")} />
        <ControlButton icon={<VolumeX size={15} />} label={t("mute")} disabled={disabled} onClick={() => void sendControl("mute")} />
        <ControlButton icon={<CornerDownLeft size={15} />} label={t("enter")} disabled={disabled} onClick={() => void sendControl("enter")} />
        <ControlButton icon={<Delete size={15} />} label={t("delete")} disabled={disabled} onClick={() => void sendControl("delete")} />
      </div>

      <form className="textControl" onSubmit={(event) => void sendText(event)}>
        <Keyboard size={15} />
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder={t("textPlaceholder")} disabled={disabled} />
        <button className="primary" type="submit" disabled={disabled || !text.trim()}>
          <Send size={15} />
          {t("sendText")}
        </button>
      </form>
    </section>
  );
}

function ControlButton({ icon, label, disabled, onClick }: { icon: React.ReactNode; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button className="controlButton" type="button" disabled={disabled} onClick={onClick} title={label}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MirrorPlayer({ device, session, t }: { device: AndroidDevice | null; session: MirrorSession | null; t: (key: MessageKey) => string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [tapPulse, setTapPulse] = useState<{ x: number; y: number; id: number } | null>(null);

  useEffect(() => {
    if (!session || !videoRef.current) {
      setStatus("idle");
      return;
    }

    setStatus("connecting");
    const nodeId = `mirror-video-${session.id}`;
    videoRef.current.id = nodeId;

    const muxer = new JMuxer({
      node: nodeId,
      mode: "video",
      fps: 30,
      flushingTime: 0,
      maxDelay: 250,
      clearBuffer: true,
      onError: () => setStatus("error")
    });

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws/sessions/${session.id}/video`);
    socket.binaryType = "arraybuffer";

    socket.onopen = () => setStatus("live");
    socket.onerror = () => setStatus("error");
    socket.onclose = () => setStatus((current) => (current === "idle" ? current : "idle"));
    socket.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        muxer.feed({ video: new Uint8Array(event.data) });
      }
    };

    return () => {
      socket.close();
      muxer.destroy();
    };
  }, [session]);

  const handleClick = async (event: React.MouseEvent<HTMLVideoElement>) => {
    if (!device || device.state !== "device") return;
    const ratios = getObjectFitRatios(event.currentTarget, event.clientX, event.clientY, device);
    if (!ratios) return;

    setTapPulse({ x: ratios.displayX, y: ratios.displayY, id: Date.now() });
    await tapDevice(device.serial, ratios.xRatio, ratios.yRatio).catch(() => setStatus("error"));
  };

  return (
    <section className="stage">
      <div className="screenFrame" style={screenFrameStyle(device)}>
        <video ref={videoRef} className="screen" muted playsInline autoPlay onClick={(event) => void handleClick(event)} />
        {tapPulse ? <span className="tapPulse" key={tapPulse.id} style={{ left: tapPulse.x, top: tapPulse.y }} /> : null}
        <div className={`statusBadge ${status}`}>
          <span />
          {statusLabel(status, t)}
        </div>
        {!session ? (
          <div className="standby">
            <MonitorPlay size={34} />
            <strong>{t("standbyTitle")}</strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function getObjectFitRatios(video: HTMLVideoElement, clientX: number, clientY: number, device: AndroidDevice) {
  const rect = video.getBoundingClientRect();
  const videoWidth = device.size?.width || video.videoWidth || rect.width;
  const videoHeight = device.size?.height || video.videoHeight || rect.height;
  const elementRatio = rect.width / rect.height;
  const videoRatio = videoWidth / videoHeight;

  let contentWidth = rect.width;
  let contentHeight = rect.height;
  let offsetX = 0;
  let offsetY = 0;

  if (videoRatio > elementRatio) {
    contentHeight = rect.width / videoRatio;
    offsetY = (rect.height - contentHeight) / 2;
  } else {
    contentWidth = rect.height * videoRatio;
    offsetX = (rect.width - contentWidth) / 2;
  }

  const localX = clientX - rect.left - offsetX;
  const localY = clientY - rect.top - offsetY;

  if (localX < 0 || localY < 0 || localX > contentWidth || localY > contentHeight) return null;

  return {
    xRatio: localX / contentWidth,
    yRatio: localY / contentHeight,
    displayX: offsetX + localX,
    displayY: offsetY + localY
  };
}

function InfoPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="infoPill">
      {icon}
      {label}
    </span>
  );
}

function StatusDot({ state }: { state: AndroidDevice["state"] }) {
  return <span className={`dot ${state}`} title={state} />;
}

function formatDeviceName(device: AndroidDevice) {
  const name = [device.manufacturer, device.model].filter(Boolean).join(" ");
  return name || device.serial;
}

function displayName(device: AndroidDevice) {
  return device.publication?.label || formatDeviceName(device);
}

function deviceAspectRatio(device: AndroidDevice) {
  if (!device.size) return "9 / 16";
  return `${device.size.width} / ${device.size.height}`;
}

function screenFrameStyle(device: AndroidDevice | null): React.CSSProperties | undefined {
  if (!device?.size) return undefined;
  return {
    aspectRatio: deviceAspectRatio(device),
    maxWidth: `min(100%, max(260px, calc((100vh - 240px) * ${device.size.width / device.size.height})))`
  };
}

function statusLabel(status: PlayerStatus, t: (key: MessageKey) => string) {
  if (status === "connecting") return t("statusConnecting");
  if (status === "live") return t("statusLive");
  if (status === "error") return t("statusError");
  return t("statusIdle");
}

function readInitialLocale(): Locale {
  const saved = window.localStorage.getItem("pura.locale");
  if (saved === "zh" || saved === "en") return saved;
  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

createRoot(document.getElementById("root")!).render(<App />);
