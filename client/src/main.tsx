import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import JMuxer from "jmuxer";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Cable,
  Camera,
  Check,
  Circle,
  Copy,
  CornerDownLeft,
  Delete,
  Download,
  Eye,
  EyeOff,
  Home,
  Keyboard,
  Languages,
  ListRestart,
  Menu,
  MonitorPlay,
  MousePointer2,
  Power,
  Radio,
  RefreshCw,
  Send,
  Settings,
  Smartphone,
  SquareDashedMousePointer,
  Usb,
  UserRound,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { controlDevice, endSession, fetchDeviceScreenshots, fetchDevices, longPressDevice, publishDevice, saveDeviceScreenshot, startSession, swipeDevice, tapDevice, unpublishDevice } from "./api";
import type { AndroidDevice, ControlAction, DevicesResponse, MirrorSession, SavedScreenshot } from "./types";
import "./styles.css";

type PlayerStatus = "idle" | "connecting" | "live" | "error";
type Locale = "en" | "zh";
type ViewMode = "grid" | "focus";
type AnnotationMode = "control" | "rect" | "draw";

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
    forceRestartView: "Force restart",
    restartView: "Restart view",
    openView: "Open view",
    unknownSize: "Unknown size",
    clickToTap: "Click, scroll, hold",
    annotationControl: "Control",
    annotationDraw: "Circle",
    annotationRect: "Box",
    clearCanvas: "Clear canvas",
    copied: "Copied",
    copyImage: "Copy image",
    cursorName: "Your name",
    cursorsOff: "Cursors off",
    cursorsOn: "Cursors on",
    deviceName: "Device name",
    deviceManagement: "Device management",
    deviceScreenshots: "Device screenshots",
    developer: "Developer",
    download: "Download",
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
    errorScreenshot: "Unable to save screenshot",
    errorUnpublish: "Unable to unpublish device",
    gridView: "Grid",
    focusView: "Focus",
    phoneGrid: "Phone grid",
    phoneGridEyebrow: "Device wall",
    phoneCount: "phones online",
    openDevice: "Open device",
    preview: "Preview",
    noDevicesOnline: "No devices online",
    noScreenshots: "No screenshots yet",
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
    screenshot: "Screenshot",
    screenshotSaved: "Screenshot saved",
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
    forceRestartView: "强制重启",
    restartView: "重启画面",
    openView: "打开画面",
    unknownSize: "未知尺寸",
    clickToTap: "点击、滚动、长按",
    annotationControl: "控制",
    annotationDraw: "圈画",
    annotationRect: "框选",
    clearCanvas: "清除画布",
    copied: "已复制",
    copyImage: "复制图片",
    cursorName: "你的名字",
    cursorsOff: "光标关",
    cursorsOn: "光标开",
    deviceName: "设备名称",
    deviceManagement: "设备管理",
    deviceScreenshots: "设备截图",
    developer: "研发",
    download: "下载",
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
    errorScreenshot: "无法保存截屏",
    errorUnpublish: "无法取消发布设备",
    gridView: "网格",
    focusView: "控制",
    phoneGrid: "手机网格",
    phoneGridEyebrow: "设备墙",
    phoneCount: "台设备在线",
    openDevice: "进入设备",
    preview: "预览",
    noDevicesOnline: "暂无在线设备",
    noScreenshots: "暂无截图",
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
    screenshot: "截屏",
    screenshotSaved: "截屏已保存",
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
  const [locale, setLocale] = useState<Locale>(readInitialLocale);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [managedSerial, setManagedSerial] = useState<string | null>(null);
  const [cursorsEnabled, setCursorsEnabled] = useState(() => window.sessionStorage.getItem("pura.cursors") !== "off");
  const [viewerIdentity, setViewerIdentity] = useState(readClientIdentity);
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>("control");
  const [clearSignal, setClearSignal] = useState(0);
  const [latestScreenshot, setLatestScreenshot] = useState<SavedScreenshot | null>(null);
  const [screenshotCopied, setScreenshotCopied] = useState(false);
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
  const managedDevice = useMemo(
    () => data.devices.find((device) => device.serial === managedSerial) ?? null,
    [data.devices, managedSerial]
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
    window.sessionStorage.setItem("pura.cursors", cursorsEnabled ? "on" : "off");
  }, [cursorsEnabled]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const openDevice = async (serial = selectedSerial, restart = false) => {
    if (!serial) return;
    setLoading(true);
    setError(null);
    try {
      const next = await startSession(serial, { restart });
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

  const captureCurrentDevice = async (device = selectedDevice) => {
    if (!device || device.state !== "device") return undefined;
    setLoading(true);
    setError(null);
    try {
      const screenshot = await saveDeviceScreenshot(device.serial);
      setLatestScreenshot(screenshot);
      setScreenshotCopied(false);
      return screenshot;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("errorScreenshot"));
      return undefined;
    } finally {
      setLoading(false);
    }
  };

  const copyScreenshot = async (screenshot: SavedScreenshot) => {
    try {
      await copyScreenshotImage(screenshot);
      setScreenshotCopied(true);
      window.setTimeout(() => setScreenshotCopied(false), 1600);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("errorScreenshot"));
    }
  };

  const selectDevice = (device: AndroidDevice) => {
    setSelectedSerial(device.serial);
  };

  const enterDevice = async (device: AndroidDevice) => {
    selectDevice(device);
    setViewMode("focus");
    if (device.state === "device") {
      await openDevice(device.serial);
    }
  };

  const publishSelectedDevice = async (
    device: AndroidDevice,
    input?: { label: string; owner?: string; note?: string }
  ) => {
    setLoading(true);
    setError(null);
    try {
      await publishDevice(
        device.serial,
        input ?? {
          label: device.publication?.label ?? formatDeviceName(device),
          owner: device.publication?.owner,
          note: device.publication?.note
        }
      );
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("errorPublish"));
    } finally {
      setLoading(false);
    }
  };

  const unpublishSelectedDevice = async (device: AndroidDevice) => {
    setLoading(true);
    setError(null);
    try {
      await unpublishDevice(device.serial);
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
              <div
                className={`deviceItem published ${device.serial === selectedSerial ? "selected" : ""}`}
                key={device.serial}
              >
                <button className="deviceSelectButton" type="button" onClick={() => selectDevice(device)}>
                  <Smartphone size={19} />
                  <span className="deviceCopy">
                    <strong>{displayName(device)}</strong>
                    <small>{device.publication?.owner || device.serial}</small>
                  </span>
                  <StatusDot state={device.state} />
                </button>
                <button className="deviceManageButton" type="button" onClick={() => setManagedSerial(device.serial)} title={t("deviceManagement")}>
                  <Settings size={15} />
                </button>
              </div>
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
              <div
                className={`deviceItem ${device.serial === selectedSerial ? "selected" : ""}`}
                key={device.serial}
              >
                <button className="deviceSelectButton" type="button" onClick={() => selectDevice(device)}>
                  <Smartphone size={18} />
                  <span className="deviceCopy">
                    <strong>{formatDeviceName(device)}</strong>
                    <small>{device.serial}</small>
                  </span>
                  <StatusDot state={device.state} />
                </button>
                <button className="deviceManageButton" type="button" onClick={() => setManagedSerial(device.serial)} title={t("deviceManagement")}>
                  <Settings size={15} />
                </button>
              </div>
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
            <button className="secondary" onClick={() => void captureCurrentDevice()} disabled={!selectedDevice || selectedDevice.state !== "device" || loading}>
              <Camera size={16} />
              {t("screenshot")}
            </button>
            <button
              className="primary"
              onClick={() => void openDevice(selectedSerial)}
              disabled={!selectedSerial || loading}
            >
              <MonitorPlay size={17} />
              {loading ? t("starting") : session ? t("restartView") : t("openView")}
            </button>
            {session && selectedSerial === session.serial ? (
              <button className="secondary" onClick={() => void openDevice(selectedSerial, true)} disabled={loading}>
                <RefreshCw size={16} />
                {t("forceRestartView")}
              </button>
            ) : null}
          </div>
        </header>

        {error ? <div className="errorBanner">{error}</div> : null}

        {viewMode === "grid" ? (
          <DeviceGrid
            devices={data.devices}
            selectedSerial={selectedSerial}
            session={session}
            loading={loading}
            t={t}
            onOpen={(device) => void enterDevice(device)}
            onPublish={(device) => void publishSelectedDevice(device)}
            onUnpublish={(device) => void unpublishSelectedDevice(device)}
          />
        ) : (
          <>
            <div className="metaStrip">
              <InfoPill tone="link" icon={<Cable size={15} />} label={selectedDevice?.transport.toUpperCase() ?? "USB"} />
              <InfoPill
                tone="screen"
                icon={<Smartphone size={15} />}
                label={selectedDevice?.size ? `${selectedDevice.size.width}x${selectedDevice.size.height}` : t("unknownSize")}
              />
              <InfoPill tone={selectedDevice?.state === "device" ? "ready" : "warning"} icon={<Circle size={13} />} label={selectedDevice?.state ?? "offline"} />
              <InfoPill tone="gesture" icon={<MousePointer2 size={15} />} label={t("clickToTap")} />
              {selectedDevice?.agentName ? <InfoPill tone="agent" icon={<Radio size={15} />} label={selectedDevice.agentName} /> : null}
              {selectedDevice?.publication?.owner ? <InfoPill tone="owner" icon={<UserRound size={15} />} label={selectedDevice.publication.owner} /> : null}
              <button
                className={`cursorToggle ${cursorsEnabled ? "active" : ""}`}
                type="button"
                onClick={() => setCursorsEnabled((current) => !current)}
              >
                {cursorsEnabled ? <Eye size={15} /> : <EyeOff size={15} />}
                {cursorsEnabled ? t("cursorsOn") : t("cursorsOff")}
              </button>
              <label className="cursorNameControl">
                <UserRound size={14} />
                <input
                  value={viewerIdentity.name}
                  aria-label={t("cursorName")}
                  title={t("cursorName")}
                  maxLength={24}
                  onChange={(event) => {
                    const next = {
                      ...viewerIdentity,
                      name: normalizeViewerName(event.target.value, viewerIdentity.id)
                    };
                    saveClientIdentity(next);
                    setViewerIdentity(next);
                  }}
                />
              </label>
              <div className="annotationTools" aria-label="Annotation tools">
                <button
                  className={annotationMode === "control" ? "active" : ""}
                  type="button"
                  onClick={() => setAnnotationMode("control")}
                  title={t("annotationControl")}
                >
                  <MousePointer2 size={14} />
                  {t("annotationControl")}
                </button>
                <button
                  className={annotationMode === "rect" ? "active" : ""}
                  type="button"
                  onClick={() => setAnnotationMode("rect")}
                  title={t("annotationRect")}
                >
                  <SquareDashedMousePointer size={14} />
                  {t("annotationRect")}
                </button>
                <button
                  className={annotationMode === "draw" ? "active" : ""}
                  type="button"
                  onClick={() => setAnnotationMode("draw")}
                  title={t("annotationDraw")}
                >
                  <Circle size={13} />
                  {t("annotationDraw")}
                </button>
                <button type="button" onClick={() => setClearSignal((current) => current + 1)} title={t("clearCanvas")}>
                  <Delete size={14} />
                  {t("clearCanvas")}
                </button>
              </div>
            </div>

            {latestScreenshot && latestScreenshot.deviceSerial === selectedDevice?.serial ? (
              <ScreenshotResult
                screenshot={latestScreenshot}
                copied={screenshotCopied}
                t={t}
                onCopy={() => void copyScreenshot(latestScreenshot)}
              />
            ) : null}

            <div className="focusSurface">
              <ControlPanel
                device={selectedDevice}
                loading={loading}
                t={t}
                onError={(message) => setError(message)}
              />
              <MirrorPlayer
                device={selectedDevice}
                session={session}
                t={t}
                cursorsEnabled={cursorsEnabled}
                clientIdentity={viewerIdentity}
                annotationMode={annotationMode}
                clearSignal={clearSignal}
              />
            </div>
          </>
        )}
      </section>

      {managedDevice ? (
        <DeviceManager
          device={managedDevice}
          loading={loading}
          t={t}
          onClose={() => setManagedSerial(null)}
          onCapture={(device) => captureCurrentDevice(device)}
          onCopy={(screenshot) => copyScreenshot(screenshot)}
          onPublish={(device, input) => void publishSelectedDevice(device, input)}
          onUnpublish={(device) => void unpublishSelectedDevice(device)}
        />
      ) : null}
    </main>
  );
}

function DeviceManager({
  device,
  loading,
  t,
  onClose,
  onCapture,
  onCopy,
  onPublish,
  onUnpublish
}: {
  device: AndroidDevice;
  loading: boolean;
  t: (key: MessageKey) => string;
  onClose: () => void;
  onCapture: (device: AndroidDevice) => Promise<SavedScreenshot | undefined>;
  onCopy: (screenshot: SavedScreenshot) => Promise<void>;
  onPublish: (device: AndroidDevice, input: { label: string; owner?: string; note?: string }) => void;
  onUnpublish: (device: AndroidDevice) => void;
}) {
  const [label, setLabel] = useState(device.publication?.label ?? formatDeviceName(device));
  const [owner, setOwner] = useState(device.publication?.owner ?? "");
  const [note, setNote] = useState(device.publication?.note ?? "");
  const [screenshots, setScreenshots] = useState<SavedScreenshot[]>([]);
  const [copiedScreenshotId, setCopiedScreenshotId] = useState<string | null>(null);

  useEffect(() => {
    setLabel(device.publication?.label ?? formatDeviceName(device));
    setOwner(device.publication?.owner ?? "");
    setNote(device.publication?.note ?? "");
    void fetchDeviceScreenshots(device.serial).then(setScreenshots).catch(() => setScreenshots([]));
  }, [device]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextLabel = label.trim() || formatDeviceName(device);
    onPublish(device, {
      label: nextLabel,
      owner: owner.trim() || undefined,
      note: note.trim() || undefined
    });
  };

  const capture = async () => {
    const screenshot = await onCapture(device);
    if (screenshot) {
      setScreenshots((current) => [screenshot, ...current.filter((item) => item.id !== screenshot.id)]);
    }
  };

  const copy = async (screenshot: SavedScreenshot) => {
    await onCopy(screenshot);
    setCopiedScreenshotId(screenshot.id);
    window.setTimeout(() => setCopiedScreenshotId(null), 1600);
  };

  return (
    <div className="managerScrim" role="presentation" onMouseDown={onClose}>
      <section className="managerPanel" aria-label={t("deviceManagement")} onMouseDown={(event) => event.stopPropagation()}>
        <div className="managerHeader">
          <div>
            <span>{t("deviceManagement")}</span>
            <strong>{displayName(device)}</strong>
          </div>
          <button className="iconButton" type="button" onClick={onClose} title="Close">
            <X size={17} />
          </button>
        </div>

        <form className="managerForm" onSubmit={submit}>
          <label>
            <span>
              <Settings size={14} />
              {t("deviceName")}
            </span>
            <input value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <label>
            <span>
              <UserRound size={14} />
              {t("developer")}
            </span>
            <input value={owner} onChange={(event) => setOwner(event.target.value)} />
          </label>
          <label>
            <span>
              <Keyboard size={14} />
              {t("note")}
            </span>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("notePlaceholder")} />
          </label>

          <div className="managerActions">
            {device.publication?.published ? (
              <button className="secondary danger" type="button" disabled={loading} onClick={() => onUnpublish(device)}>
                {t("unpublish")}
              </button>
            ) : null}
            <button className="primary" type="submit" disabled={loading || device.state !== "device"}>
              <Send size={15} />
              {device.publication?.published ? t("updateInfo") : t("publish")}
            </button>
          </div>
        </form>

        <section className="managerScreenshots">
          <div className="managerSectionHeader">
            <span>{t("deviceScreenshots")}</span>
            <button className="secondary" type="button" disabled={loading || device.state !== "device"} onClick={() => void capture()}>
              <Camera size={15} />
              {t("screenshot")}
            </button>
          </div>
          {screenshots.length === 0 ? (
            <div className="screenshotEmpty">{t("noScreenshots")}</div>
          ) : (
            <div className="screenshotList">
              {screenshots.map((screenshot) => (
                <article className="screenshotItem" key={screenshot.id}>
                  <img src={screenshot.url} alt="" loading="lazy" />
                  <div>
                    <strong>{new Date(screenshot.createdAt).toLocaleString()}</strong>
                    <span>{Math.round(screenshot.sizeBytes / 1024)} KB</span>
                  </div>
                  <button className="iconButton" type="button" onClick={() => void copy(screenshot)} title={t("copyImage")}>
                    {copiedScreenshotId === screenshot.id ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                  <a className="iconButton" href={screenshot.downloadUrl} download title={t("download")}>
                    <Download size={15} />
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function ScreenshotResult({
  screenshot,
  copied,
  t,
  onCopy
}: {
  screenshot: SavedScreenshot;
  copied: boolean;
  t: (key: MessageKey) => string;
  onCopy: () => void;
}) {
  return (
    <div className="screenshotResult">
      <span>
        <Camera size={15} />
        {t("screenshotSaved")}
      </span>
      <button className="secondary" type="button" onClick={onCopy}>
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {copied ? t("copied") : t("copyImage")}
      </button>
      <a className="secondary" href={screenshot.downloadUrl} download>
        <Download size={15} />
        {t("download")}
      </a>
    </div>
  );
}

function DeviceGrid({
  devices,
  selectedSerial,
  session,
  loading,
  t,
  onOpen,
  onPublish,
  onUnpublish
}: {
  devices: AndroidDevice[];
  selectedSerial: string | null;
  session: MirrorSession | null;
  loading: boolean;
  t: (key: MessageKey) => string;
  onOpen: (device: AndroidDevice) => void;
  onPublish: (device: AndroidDevice) => void;
  onUnpublish: (device: AndroidDevice) => void;
}) {
  const [thumbnailTick, setThumbnailTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setThumbnailTick(Date.now()), 7000);
    return () => window.clearInterval(timer);
  }, []);

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
          <article
            className={`phoneCard ${device.serial === selectedSerial ? "selected" : ""}`}
            key={device.serial}
          >
            <button className="phoneOpenArea" type="button" onClick={() => onOpen(device)}>
              <div className="phonePreview" aria-label={t("preview")}>
              <div className="phoneChrome" style={{ aspectRatio: deviceAspectRatio(device) }}>
                <span className="speaker" />
                <div className="previewScreen">
                  {device.state === "device" ? (
                    <DevicePreviewImage device={device} thumbnailTick={thumbnailTick} />
                  ) : null}
                  <span className={`previewSignal ${device.state}`} />
                  {device.state !== "device" ? (
                    <>
                      <Smartphone size={34} />
                      <small>{device.size ? `${device.size.width}x${device.size.height}` : t("unknownSize")}</small>
                    </>
                  ) : null}
                </div>
              </div>
              {session?.serial === device.serial ? <span className="liveTag">{t("statusLive")}</span> : null}
              </div>
              <div className="phoneMeta">
                <strong>{displayName(device)}</strong>
                <span>{device.agentName ?? device.agentId ?? device.serial}</span>
                {device.publication?.note ? <small>{device.publication.note}</small> : null}
              </div>
            </button>
            <div className="phoneFooter">
              <span>
                <StatusDot state={device.state} />
                {device.state}
              </span>
              <div className="phoneActions">
                <button className="phoneAction" type="button" onClick={() => onOpen(device)}>
                  {t("openDevice")}
                </button>
                {device.publication?.published ? (
                  <button className="phoneAction danger" type="button" disabled={loading} onClick={() => onUnpublish(device)}>
                    {t("unpublish")}
                  </button>
                ) : (
                  <button className="phoneAction" type="button" disabled={loading || device.state !== "device"} onClick={() => onPublish(device)}>
                    {t("publish")}
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DevicePreviewImage({ device, thumbnailTick }: { device: AndroidDevice; thumbnailTick: number }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = `/api/devices/${encodeURIComponent(device.serial)}/screenshot?t=${thumbnailTick}`;

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  return (
    <>
      {!loaded ? <span className="previewLoading" /> : null}
      {!failed ? (
        <img
          className={`previewImage ${loaded ? "loaded" : ""}`}
          src={src}
          alt=""
          loading="lazy"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            setLoaded(false);
          }}
        />
      ) : null}
    </>
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

type RemoteCursor = {
  clientId: string;
  name: string;
  color: string;
  xRatio: number;
  yRatio: number;
  seenAt: number;
};

type AnnotationPoint = {
  x: number;
  y: number;
};

type SharedAnnotation =
  | {
      id: string;
      kind: "rect";
      color: string;
      name: string;
      rect: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }
  | {
      id: string;
      kind: "draw";
      color: string;
      name: string;
      points: AnnotationPoint[];
    };

type DraftAnnotation = SharedAnnotation;

type ClientIdentity = {
  id: string;
  name: string;
  color: string;
};

type PresenceMessage =
  | {
      type: "cursor";
      clientId: string;
      name: string;
      color: string;
      xRatio: number;
      yRatio: number;
      seenAt: number;
    }
  | {
      type: "leave";
      clientId: string;
    }
  | {
      type: "annotation";
      clientId: string;
      name: string;
      color: string;
      annotation: SharedAnnotation;
      seenAt: number;
    }
  | {
      type: "clear";
      clientId: string;
    };

function MirrorPlayer({
  device,
  session,
  t,
  cursorsEnabled,
  clientIdentity,
  annotationMode,
  clearSignal
}: {
  device: AndroidDevice | null;
  session: MirrorSession | null;
  t: (key: MessageKey) => string;
  cursorsEnabled: boolean;
  clientIdentity: ClientIdentity;
  annotationMode: AnnotationMode;
  clearSignal: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const pointerRef = useRef<{ x: number; y: number; moved: boolean; longPressed: boolean; startedAt: number } | null>(null);
  const wheelLockRef = useRef(false);
  const presenceRef = useRef<WebSocket | null>(null);
  const clientIdentityRef = useRef(clientIdentity);
  const lastCursorSentRef = useRef(0);
  const annotationRef = useRef<{ id: string; start: AnnotationPoint; points: AnnotationPoint[]; mode: Exclude<AnnotationMode, "control"> } | null>(null);
  const lastClearSignalRef = useRef(clearSignal);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [tapPulse, setTapPulse] = useState<{ x: number; y: number; id: number } | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const [annotations, setAnnotations] = useState<Record<string, SharedAnnotation>>({});
  const [draftAnnotation, setDraftAnnotation] = useState<DraftAnnotation | null>(null);

  useEffect(() => {
    clientIdentityRef.current = clientIdentity;
  }, [clientIdentity]);

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

  useEffect(() => {
    setRemoteCursors({});
    if (!device) {
      presenceRef.current?.close();
      presenceRef.current = null;
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws/presence/${encodeURIComponent(device.serial)}`);
    presenceRef.current = socket;

    socket.onmessage = (event) => {
      const message = parsePresenceMessage(event.data);
      if (!message || message.clientId === clientIdentityRef.current.id) return;

      if (message.type === "clear") {
        setAnnotations({});
        setDraftAnnotation(null);
        return;
      }

      if (message.type === "annotation") {
        setAnnotations((currentAnnotations) => ({
          ...currentAnnotations,
          [message.annotation.id]: message.annotation
        }));
        return;
      }

      setRemoteCursors((current) => {
        const next = { ...current };
        if (message.type === "leave") {
          delete next[message.clientId];
          return next;
        }
        next[message.clientId] = message;
        return next;
      });
    };

    socket.onclose = () => {
      if (presenceRef.current === socket) presenceRef.current = null;
    };

    return () => {
      sendPresenceLeave();
      socket.close();
    };
  }, [device?.serial]);

  useEffect(() => {
    if (lastClearSignalRef.current === clearSignal) return;
    lastClearSignalRef.current = clearSignal;
    setAnnotations({});
    setDraftAnnotation(null);
    sendPresenceClear();
  }, [clearSignal]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const staleBefore = Date.now() - 3500;
      setRemoteCursors((current) => {
        const next = Object.fromEntries(Object.entries(current).filter(([, cursor]) => cursor.seenAt > staleBefore));
        return Object.keys(next).length === Object.keys(current).length ? current : next;
      });
    }, 1200);
    return () => window.clearInterval(timer);
  }, []);

  const sendTap = async (video: HTMLVideoElement, clientX: number, clientY: number) => {
    if (!device || device.state !== "device") return;
    const ratios = getObjectFitRatios(video, clientX, clientY, device);
    if (!ratios) return;

    setTapPulse({ x: ratios.displayX, y: ratios.displayY, id: Date.now() });
    await tapDevice(device.serial, ratios.xRatio, ratios.yRatio).catch(() => setStatus("error"));
  };

  const sendLongPress = async (video: HTMLVideoElement, clientX: number, clientY: number) => {
    if (!device || device.state !== "device") return;
    const ratios = getObjectFitRatios(video, clientX, clientY, device);
    if (!ratios) return;

    setTapPulse({ x: ratios.displayX, y: ratios.displayY, id: Date.now() });
    await longPressDevice(device.serial, ratios.xRatio, ratios.yRatio).catch(() => setStatus("error"));
  };

  const sendSwipe = async (video: HTMLVideoElement, startX: number, startY: number, endX: number, endY: number, durationMs: number) => {
    if (!device || device.state !== "device") return;
    const start = getObjectFitRatios(video, startX, startY, device);
    const end = getObjectFitRatios(video, endX, endY, device);
    if (!start || !end) return;

    await swipeDevice(device.serial, {
      xStartRatio: start.xRatio,
      yStartRatio: start.yRatio,
      xEndRatio: end.xRatio,
      yEndRatio: end.yRatio,
      durationMs
    }).catch(() => setStatus("error"));
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLVideoElement>) => {
    if (!device || device.state !== "device") return;
    sendPresenceCursor(event.currentTarget, event.clientX, event.clientY);
    if (annotationMode !== "control") {
      const ratios = getObjectFitRatios(event.currentTarget, event.clientX, event.clientY, device);
      if (!ratios) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      clearLongPressTimer();
      const point = { x: ratios.xRatio, y: ratios.yRatio };
      const id = crypto.randomUUID();
      annotationRef.current = { id, start: point, points: [point], mode: annotationMode };
      setDraftAnnotation(createDraftAnnotation(id, annotationMode, point, point, [point], clientIdentityRef.current));
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = { x: event.clientX, y: event.clientY, moved: false, longPressed: false, startedAt: Date.now() };
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.moved) return;
      pointer.longPressed = true;
      void sendLongPress(event.currentTarget, pointer.x, pointer.y);
    }, 520);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLVideoElement>) => {
    sendPresenceCursor(event.currentTarget, event.clientX, event.clientY);
    if (annotationRef.current && device) {
      const ratios = getObjectFitRatios(event.currentTarget, event.clientX, event.clientY, device);
      if (!ratios) return;
      const point = { x: ratios.xRatio, y: ratios.yRatio };
      const annotation = annotationRef.current;
      if (annotation.mode === "draw") {
        const previous = annotation.points[annotation.points.length - 1];
        if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.006) {
          annotation.points.push(point);
        }
      }
      setDraftAnnotation(createDraftAnnotation(annotation.id, annotation.mode, annotation.start, point, annotation.points, clientIdentityRef.current));
      return;
    }
    const pointer = pointerRef.current;
    if (!pointer) return;
    const distance = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y);
    if (distance > 8) {
      pointer.moved = true;
      clearLongPressTimer();
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLVideoElement>) => {
    if (annotationRef.current && device) {
      const ratios = getObjectFitRatios(event.currentTarget, event.clientX, event.clientY, device);
      const point = ratios
        ? { x: ratios.xRatio, y: ratios.yRatio }
        : annotationRef.current.points[annotationRef.current.points.length - 1] ?? annotationRef.current.start;
      const annotation = createDraftAnnotation(
        annotationRef.current.id,
        annotationRef.current.mode,
        annotationRef.current.start,
        point,
        annotationRef.current.points,
        clientIdentityRef.current
      );
      annotationRef.current = null;
      setDraftAnnotation(null);
      setAnnotations((current) => ({ ...current, [annotation.id]: annotation }));
      sendPresenceAnnotation(annotation);
      return;
    }
    const pointer = pointerRef.current;
    clearLongPressTimer();
    pointerRef.current = null;
    if (!pointer || pointer.longPressed) return;
    if (pointer.moved) {
      void sendSwipe(event.currentTarget, pointer.x, pointer.y, event.clientX, event.clientY, Date.now() - pointer.startedAt);
      return;
    }
    void sendTap(event.currentTarget, event.clientX, event.clientY);
  };

  const handlePointerCancel = () => {
    clearLongPressTimer();
    pointerRef.current = null;
    annotationRef.current = null;
    setDraftAnnotation(null);
    sendPresenceLeave();
  };

  const handleWheel = (event: React.WheelEvent<HTMLVideoElement>) => {
    if (!device || device.state !== "device" || wheelLockRef.current) return;
    event.preventDefault();
    wheelLockRef.current = true;
    window.setTimeout(() => {
      wheelLockRef.current = false;
    }, 220);

    const action: ControlAction = event.deltaY > 0 ? "swipe_up" : "swipe_down";
    void controlDevice(device.serial, action).catch(() => setStatus("error"));
  };

  return (
    <section className="stage">
      <div className="screenFrame" style={screenFrameStyle(device)}>
        <video
          ref={videoRef}
          className="screen"
          muted
          playsInline
          autoPlay
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerCancel}
          onWheel={handleWheel}
        />
        {tapPulse ? <span className="tapPulse" key={tapPulse.id} style={{ left: tapPulse.x, top: tapPulse.y }} /> : null}
        <AnnotationLayer annotations={Object.values(annotations)} draft={draftAnnotation} />
        {cursorsEnabled
          ? Object.values(remoteCursors).map((cursor) => (
              <span
                className="remoteCursor"
                key={cursor.clientId}
                style={{
                  left: `${cursor.xRatio * 100}%`,
                  top: `${cursor.yRatio * 100}%`,
                  "--cursor-color": cursor.color
                } as React.CSSProperties}
              >
                <MousePointer2 size={18} />
                <small>{cursor.name}</small>
              </span>
            ))
          : null}
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

  function sendPresenceCursor(video: HTMLVideoElement, clientX: number, clientY: number) {
    if (!device || !presenceRef.current || presenceRef.current.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    if (now - lastCursorSentRef.current < 45) return;
    const ratios = getObjectFitRatios(video, clientX, clientY, device);
    if (!ratios) return;

    lastCursorSentRef.current = now;
    const identity = clientIdentityRef.current;
    presenceRef.current.send(
      JSON.stringify({
        type: "cursor",
        clientId: identity.id,
        name: identity.name,
        color: identity.color,
        xRatio: ratios.xRatio,
        yRatio: ratios.yRatio
      })
    );
  }

  function sendPresenceLeave() {
    if (!presenceRef.current || presenceRef.current.readyState !== WebSocket.OPEN) return;
    presenceRef.current.send(
      JSON.stringify({
        type: "leave",
        clientId: clientIdentityRef.current.id
      })
    );
  }

  function sendPresenceAnnotation(annotation: SharedAnnotation) {
    if (!presenceRef.current || presenceRef.current.readyState !== WebSocket.OPEN) return;
    presenceRef.current.send(
      JSON.stringify({
        type: "annotation",
        clientId: clientIdentityRef.current.id,
        name: clientIdentityRef.current.name,
        color: clientIdentityRef.current.color,
        annotation
      })
    );
  }

  function sendPresenceClear() {
    if (!presenceRef.current || presenceRef.current.readyState !== WebSocket.OPEN) return;
    presenceRef.current.send(
      JSON.stringify({
        type: "clear",
        clientId: clientIdentityRef.current.id
      })
    );
  }
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

function AnnotationLayer({ annotations, draft }: { annotations: SharedAnnotation[]; draft: DraftAnnotation | null }) {
  const allAnnotations = draft ? [...annotations, draft] : annotations;
  if (allAnnotations.length === 0) return null;

  return (
    <svg className="annotationLayer" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
      {allAnnotations.map((annotation) =>
        annotation.kind === "rect" ? (
          <rect
            key={annotation.id}
            x={annotation.rect.x}
            y={annotation.rect.y}
            width={annotation.rect.width}
            height={annotation.rect.height}
            className="annotationRect"
            style={{ "--annotation-color": annotation.color } as React.CSSProperties}
          />
        ) : (
          <polyline
            key={annotation.id}
            points={annotation.points.map((point) => `${point.x},${point.y}`).join(" ")}
            className="annotationDraw"
            style={{ "--annotation-color": annotation.color } as React.CSSProperties}
          />
        )
      )}
    </svg>
  );
}

async function copyScreenshotImage(screenshot: SavedScreenshot) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Clipboard image copy is not supported in this browser");
  }

  const response = await fetch(screenshot.url);
  if (!response.ok) throw new Error("Unable to read screenshot");
  const blob = await response.blob();
  await navigator.clipboard.write([
    new ClipboardItem({
      [blob.type || "image/png"]: blob
    })
  ]);
}

function createDraftAnnotation(
  id: string,
  mode: Exclude<AnnotationMode, "control">,
  start: AnnotationPoint,
  end: AnnotationPoint,
  points: AnnotationPoint[],
  identity: ClientIdentity
): SharedAnnotation {
  if (mode === "rect") {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    return {
      id,
      kind: "rect",
      color: identity.color,
      name: identity.name,
      rect: {
        x,
        y,
        width: Math.max(0.002, Math.abs(end.x - start.x)),
        height: Math.max(0.002, Math.abs(end.y - start.y))
      }
    };
  }

  return {
    id,
    kind: "draw",
    color: identity.color,
    name: identity.name,
    points: points.length > 1 ? points : [start, end]
  };
}

function parsePresenceMessage(data: unknown): PresenceMessage | null {
  if (typeof data !== "string") return null;
  try {
    const message = JSON.parse(data) as PresenceMessage;
    if (message.type === "leave" && typeof message.clientId === "string") return message;
    if (message.type === "clear" && typeof message.clientId === "string") return message;
    if (
      message.type === "annotation" &&
      typeof message.clientId === "string" &&
      typeof message.name === "string" &&
      typeof message.color === "string" &&
      isSharedAnnotation(message.annotation)
    ) {
      return message;
    }
    if (
      message.type === "cursor" &&
      typeof message.clientId === "string" &&
      typeof message.name === "string" &&
      typeof message.color === "string" &&
      Number.isFinite(message.xRatio) &&
      Number.isFinite(message.yRatio) &&
      Number.isFinite(message.seenAt)
    ) {
      return message;
    }
  } catch {
    return null;
  }
  return null;
}

function isSharedAnnotation(value: unknown): value is SharedAnnotation {
  if (!value || typeof value !== "object") return false;
  const annotation = value as Partial<SharedAnnotation>;
  if (typeof annotation.id !== "string" || typeof annotation.color !== "string" || typeof annotation.name !== "string") return false;
  if (annotation.kind === "rect") {
    const rect = annotation.rect;
    return Boolean(
      rect &&
        Number.isFinite(rect.x) &&
        Number.isFinite(rect.y) &&
        Number.isFinite(rect.width) &&
        Number.isFinite(rect.height)
    );
  }
  if (annotation.kind === "draw") {
    return Array.isArray(annotation.points) && annotation.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  }
  return false;
}


function readClientIdentity(): ClientIdentity {
  const saved = window.localStorage.getItem("pura.viewer");
  if (saved) {
    try {
      const identity = JSON.parse(saved) as ClientIdentity;
      if (identity.id && identity.name && identity.color) {
        const next = {
          ...identity,
          name: normalizeViewerName(identity.name, identity.id),
          color: colorFromId(identity.id)
        };
        saveClientIdentity(next);
        return next;
      }
    } catch {
      window.localStorage.removeItem("pura.viewer");
    }
  }

  const id = crypto.randomUUID();
  const identity = {
    id,
    name: defaultViewerName(id),
    color: colorFromId(id)
  };
  saveClientIdentity(identity);
  return identity;
}

function saveClientIdentity(identity: ClientIdentity) {
  window.localStorage.setItem("pura.viewer", JSON.stringify(identity));
}

function defaultViewerName(id: string) {
  return `Viewer ${id.slice(0, 4)}`;
}

function normalizeViewerName(value: string, id: string) {
  const next = value.slice(0, 24);
  return next.trim() ? next : defaultViewerName(id);
}

function colorFromId(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }

  const hue = hash % 360;
  return hslToHex(hue, 94, 66);
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];
  return `#${[r, g, b]
    .map((value) => Math.round((value + m) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function InfoPill({ icon, label, tone = "neutral" }: { icon: React.ReactNode; label: string; tone?: "neutral" | "link" | "screen" | "ready" | "warning" | "gesture" | "agent" | "owner" }) {
  return (
    <span className={`infoPill tone-${tone}`}>
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
