import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import JMuxer from "jmuxer";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bug,
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
  ExternalLink,
  FileText,
  Home,
  Keyboard,
  Languages,
  Logs,
  Link,
  ListRestart,
  Maximize2,
  Menu,
  MonitorPlay,
  MousePointer2,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  Power,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Settings,
  Smartphone,
  Terminal,
  Trash2,
  Upload,
  SquareDashedMousePointer,
  Usb,
  UsersRound,
  UserRound,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import {
  bindDiscussionDoc,
  controlDevice,
  createDiscussionDoc,
  deleteDeviceScreenshot,
  endSession,
  fetchDeviceLogs,
  fetchDeviceScreenshots,
  fetchDevices,
  fetchDiscussionDoc,
  fetchPackages,
  installPackage,
  insertScreenshotToDiscussionDoc,
  longPressDevice,
  openDeeplink,
  publishDevice,
  saveAnnotatedScreenshot,
  saveDeviceScreenshot,
  startSession,
  swipeDevice,
  tapDevice,
  uploadPackage,
  unpublishDevice
} from "./api";
import type { AndroidDevice, ControlAction, DeviceLogs, DevicesResponse, DiscussionDocStatus, LogLevel, MirrorSession, SavedPackage, SavedScreenshot } from "./types";
import "./styles.css";

type PlayerStatus = "idle" | "connecting" | "live" | "error";
type Locale = "en" | "zh";
type ViewMode = "grid" | "focus";
type AnnotationMode = "control" | "rect" | "draw";
const ANNOTATION_COLORS = ["#ff5b57", "#d6ff59", "#58d8ff", "#9b7eff", "#ffbf47"] as const;
type AnnotationColor = (typeof ANNOTATION_COLORS)[number];
type ScreenshotPreviewState = {
  screenshot: SavedScreenshot;
};

const messages = {
  en: {
    appTitle: "Mirror Deck",
    appSubtitle: "LAN Android lab",
    refresh: "Refresh",
    publishedMachines: "Published machines",
    noMachinesPublished: "No machines published",
    devicesToPublish: "Devices to publish",
    allDevicesPublished: "All devices are published",
    collapseSidebar: "Collapse sidebar",
    expandSidebar: "Expand sidebar",
    usbHostViewer: "USB host viewer",
    waitingForDevice: "Waiting for device",
    stop: "Stop",
    starting: "Starting",
    forceRestartView: "Force restart",
    restartView: "Restart view",
    openView: "Open view",
    fullscreenView: "Fullscreen",
    unknownSize: "Unknown size",
    clickToTap: "Click, scroll, hold",
    annotationControl: "Control",
    annotationDraw: "Circle",
    annotationRect: "Box",
    annotationColor: "Annotation color",
    clearCanvas: "Clear canvas",
    copied: "Copied",
    copyImageFallback: "Image copy is unavailable here, downloaded instead",
    copyImage: "Copy image",
    cursorName: "Your name",
    cursorsOff: "Cursors off",
    cursorsOn: "Cursors on",
    deviceName: "Device name",
    deviceManagement: "Device management",
    deviceScreenshots: "Device screenshots",
    screenshotTray: "Screenshots",
    screenshotHistory: "Screenshot history",
    latestShot: "Latest shot",
    deleteScreenshot: "Delete screenshot",
    screenshotDeleted: "Screenshot deleted",
    discussionDoc: "Discussion doc",
    discussionDocMissing: "Lark app is not configured",
    discussionDocMissingHint: "Set LARK_APP_ID and LARK_APP_SECRET on the Hub. LARK_DOC_FOLDER_TOKEN is only an optional default folder.",
    discussionDocUrl: "Lark document URL",
    bindDoc: "Bind doc",
    createDoc: "New doc",
    openDoc: "Open doc",
    openDocInside: "Open inside Pura",
    closeDocPreview: "Close document preview",
    resizeDocPreview: "Resize document preview",
    docPreviewHint: "If Feishu blocks embedding, use the external open button.",
    insertDoc: "Insert into doc",
    docInserted: "Inserted into doc",
    docNotePlaceholder: "Optional note for this screenshot",
    noDiscussionDoc: "No document bound yet",
    errorDiscussionDoc: "Unable to update discussion document",
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
    controlOffline: "Control offline",
    errorControlOffline: "This device is from an offline Agent. Refresh or ask the owner to reconnect.",
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
    annotations: "Annotations",
    apps: "Apps",
    logs: "Logs",
    viewers: "viewing",
    logPresetCurrent: "Current app",
    logPresetCrash: "Crashes",
    logPresetNetwork: "Network",
    logPresetAll: "All",
    logSearch: "Search logs",
    logLevel: "Minimum log",
    logLevelVerbose: "All",
    logLevelDebug: "Debug",
    logLevelInfo: "Info",
    logLevelWarn: "Warn",
    logLevelError: "Error",
    logLevelFatal: "Fatal",
    logMeta: "Captured",
    logCurrentAppEmpty: "No current app logs. Open the app on the phone, then refresh.",
    liveLogs: "Live",
    pauseLogs: "Pause live",
    clearLogs: "Clear",
    refreshLogs: "Refresh logs",
    copyLogs: "Copy logs",
    noLogs: "No logs yet",
    uploadApk: "Upload APK",
    installApk: "Install APK",
    recentPackages: "Recent packages",
    deeplink: "Deeplink",
    deeplinkPlaceholder: "scheme://path or https://...",
    openDeeplink: "Open deeplink",
    apkInstalled: "APK install command sent",
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
    collapseSidebar: "收起侧栏",
    expandSidebar: "展开侧栏",
    usbHostViewer: "USB 主机预览",
    waitingForDevice: "等待设备上线",
    stop: "停止",
    starting: "启动中",
    forceRestartView: "强制重启",
    restartView: "重启画面",
    openView: "打开画面",
    fullscreenView: "全屏看",
    unknownSize: "未知尺寸",
    clickToTap: "点击、滚动、长按",
    annotationControl: "控制",
    annotationDraw: "圈画",
    annotationRect: "框选",
    annotationColor: "标注颜色",
    clearCanvas: "清除画布",
    copied: "已复制",
    copyImageFallback: "当前浏览器不支持复制图片，已改为下载",
    copyImage: "复制图片",
    cursorName: "你的名字",
    cursorsOff: "光标关",
    cursorsOn: "光标开",
    deviceName: "设备名称",
    deviceManagement: "设备管理",
    deviceScreenshots: "设备截图",
    screenshotTray: "截图",
    screenshotHistory: "截图历史",
    latestShot: "最新截图",
    deleteScreenshot: "删除截图",
    screenshotDeleted: "截图已删除",
    discussionDoc: "讨论文档",
    discussionDocMissing: "未配置飞书应用",
    discussionDocMissingHint: "请在 Hub 配置 LARK_APP_ID 和 LARK_APP_SECRET。LARK_DOC_FOLDER_TOKEN 只是可选默认目录。",
    discussionDocUrl: "飞书文档链接",
    bindDoc: "绑定文档",
    createDoc: "新建文档",
    openDoc: "打开文档",
    openDocInside: "内部查看",
    closeDocPreview: "关闭文档预览",
    resizeDocPreview: "调整文档宽度",
    docPreviewHint: "如果飞书限制嵌入，请使用外部打开。",
    insertDoc: "插入文档",
    docInserted: "已插入文档",
    docNotePlaceholder: "本次截图的可选备注",
    noDiscussionDoc: "暂未绑定文档",
    errorDiscussionDoc: "无法更新讨论文档",
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
    controlOffline: "控制离线",
    errorControlOffline: "这台设备来自已离线的 Agent，刷新或让负责人重新连接后再操作。",
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
    annotations: "标注",
    apps: "应用",
    logs: "日志",
    viewers: "正在看",
    logPresetCurrent: "当前应用",
    logPresetCrash: "崩溃",
    logPresetNetwork: "网络",
    logPresetAll: "全部",
    logSearch: "搜索日志",
    logLevel: "最低日志",
    logLevelVerbose: "全部",
    logLevelDebug: "调试",
    logLevelInfo: "信息",
    logLevelWarn: "警告",
    logLevelError: "错误",
    logLevelFatal: "致命",
    logMeta: "已抓取",
    logCurrentAppEmpty: "当前应用暂无日志，先在手机上打开目标应用再刷新。",
    liveLogs: "实时",
    pauseLogs: "暂停实时",
    clearLogs: "清空",
    refreshLogs: "刷新日志",
    copyLogs: "复制日志",
    noLogs: "暂无日志",
    uploadApk: "上传 APK",
    installApk: "安装 APK",
    recentPackages: "最近安装包",
    deeplink: "Deeplink",
    deeplinkPlaceholder: "scheme://path 或 https://...",
    openDeeplink: "打开 Deeplink",
    apkInstalled: "APK 安装命令已发送",
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
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [managedSerial, setManagedSerial] = useState<string | null>(null);
  const [cursorsEnabled, setCursorsEnabled] = useState(() => window.sessionStorage.getItem("pura.cursors") !== "off");
  const [viewerIdentity, setViewerIdentity] = useState(readClientIdentity);
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>("control");
  const [annotationColor, setAnnotationColor] = useState<AnnotationColor>(readAnnotationColor);
  const [clearSignal, setClearSignal] = useState(0);
  const [currentAnnotations, setCurrentAnnotations] = useState<SharedAnnotation[]>([]);
  const [viewerRoster, setViewerRoster] = useState<ViewerPresence[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [latestScreenshot, setLatestScreenshot] = useState<SavedScreenshot | null>(null);
  const [screenshotCopied, setScreenshotCopied] = useState(false);
  const [deviceScreenshots, setDeviceScreenshots] = useState<SavedScreenshot[]>([]);
  const [screenshotsLoading, setScreenshotsLoading] = useState(false);
  const [copiedScreenshotId, setCopiedScreenshotId] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<ScreenshotPreviewState | null>(null);
  const [selectedDiscussionDoc, setSelectedDiscussionDoc] = useState<DiscussionDocStatus | null>(null);
  const [embeddedDocUrl, setEmbeddedDocUrl] = useState<string | null>(null);
  const [embeddedDocWidth, setEmbeddedDocWidth] = useState(readEmbeddedDocWidth);
  const deviceUiSocketRef = useRef<WebSocket | null>(null);
  const embeddedDocUrlRef = useRef<string | null>(null);
  const screenshotPreviewTimerRef = useRef<number | undefined>(undefined);
  const t = useCallback((key: MessageKey) => messages[locale][key], [locale]);

  const selectedDevice = useMemo(
    () => data.devices.find((device) => device.serial === selectedSerial) ?? null,
    [data.devices, selectedSerial]
  );
  const selectedDeviceControllable = selectedDevice ? isDeviceControllable(selectedDevice) : false;
  const showEmbeddedDoc = Boolean(embeddedDocUrl && !logsOpen);
  const showAuxPanel = logsOpen || showEmbeddedDoc;
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

  useEffect(() => {
    if (!selectedDevice) {
      setSelectedDiscussionDoc(null);
      return;
    }

    let cancelled = false;
    setSelectedDiscussionDoc(null);
    void fetchDiscussionDoc(selectedDevice.serial)
      .then((status) => {
        if (!cancelled) setSelectedDiscussionDoc(status);
      })
      .catch(() => {
        if (!cancelled) setSelectedDiscussionDoc(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDevice?.serial]);

  useEffect(() => {
    if (!selectedDevice) {
      setDeviceScreenshots([]);
      setLatestScreenshot(null);
      setScreenshotPreview(null);
      return;
    }

    let cancelled = false;
    setDeviceScreenshots([]);
    setLatestScreenshot(null);
    setScreenshotPreview(null);
    setScreenshotCopied(false);
    setCopiedScreenshotId(null);
    setScreenshotsLoading(true);
    void fetchDeviceScreenshots(selectedDevice.serial)
      .then((screenshots) => {
        if (!cancelled) setDeviceScreenshots(screenshots);
      })
      .catch(() => {
        if (!cancelled) setDeviceScreenshots([]);
      })
      .finally(() => {
        if (!cancelled) setScreenshotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDevice?.serial]);

  useEffect(() => {
    return () => {
      if (screenshotPreviewTimerRef.current) window.clearTimeout(screenshotPreviewTimerRef.current);
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchDevices();
      setData(next);
      setError(null);
      if (!selectedSerial && next.devices.length > 0) {
        const firstReady =
          next.devices.find((device) => device.publication?.published && isDeviceControllable(device)) ??
          next.devices.find((device) => isDeviceControllable(device)) ??
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
    window.localStorage.setItem("pura.embeddedDocWidth", String(embeddedDocWidth));
  }, [embeddedDocWidth]);

  useEffect(() => {
    setCurrentAnnotations([]);
    setViewerRoster([]);
  }, [selectedDevice?.serial]);

  useEffect(() => {
    embeddedDocUrlRef.current = embeddedDocUrl;
  }, [embeddedDocUrl]);

  const sendDeviceUiState = useCallback((state: { embeddedDocUrl?: string | null; embeddedDocWidth?: number }) => {
    const socket = deviceUiSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "state", state }));
  }, []);

  const openEmbeddedDoc = useCallback(
    (url: string) => {
      setEmbeddedDocUrl(url);
      sendDeviceUiState({ embeddedDocUrl: url, embeddedDocWidth });
    },
    [embeddedDocWidth, sendDeviceUiState]
  );

  const closeEmbeddedDoc = useCallback(() => {
    setEmbeddedDocUrl(null);
    sendDeviceUiState({ embeddedDocUrl: null, embeddedDocWidth });
  }, [embeddedDocWidth, sendDeviceUiState]);

  const resizeEmbeddedDoc = useCallback(
    (width: number) => {
      setEmbeddedDocWidth(width);
      sendDeviceUiState({ embeddedDocUrl: embeddedDocUrlRef.current, embeddedDocWidth: width });
    },
    [sendDeviceUiState]
  );

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    deviceUiSocketRef.current?.close();
    deviceUiSocketRef.current = null;
    setEmbeddedDocUrl(null);
    if (!selectedDevice) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws/devices/${encodeURIComponent(selectedDevice.serial)}/ui`);
    deviceUiSocketRef.current = socket;

    socket.onmessage = (event) => {
      const message = parseDeviceUiMessage(event.data);
      if (!message) return;
      setEmbeddedDocUrl(message.embeddedDocUrl ?? null);
      if (message.embeddedDocWidth) setEmbeddedDocWidth(message.embeddedDocWidth);
    };

    socket.onclose = () => {
      if (deviceUiSocketRef.current === socket) deviceUiSocketRef.current = null;
    };

    return () => {
      socket.close();
    };
  }, [selectedDevice?.serial]);

  const openDevice = async (serial = selectedSerial, restart = false) => {
    if (!serial) return;
    const targetDevice = data.devices.find((device) => device.serial === serial);
    if (targetDevice && !isDeviceControllable(targetDevice)) {
      setError(t("errorControlOffline"));
      setSession(null);
      return;
    }
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
    if (!device || !isDeviceControllable(device)) {
      if (device) setError(t("errorControlOffline"));
      return undefined;
    }
    setLoading(true);
    setError(null);
    try {
      const screenshot = await saveDeviceScreenshot(device.serial);
      const annotatedScreenshot =
        currentAnnotations.length > 0 ? await annotateAndSaveScreenshot(device.serial, screenshot, currentAnnotations).catch(() => screenshot) : screenshot;
      setLatestScreenshot(annotatedScreenshot);
      setDeviceScreenshots((current) =>
        device.serial === selectedSerial ? [annotatedScreenshot, ...current.filter((item) => item.id !== annotatedScreenshot.id)] : current
      );
      setScreenshotPreview({ screenshot: annotatedScreenshot });
      if (screenshotPreviewTimerRef.current) window.clearTimeout(screenshotPreviewTimerRef.current);
      screenshotPreviewTimerRef.current = window.setTimeout(() => setScreenshotPreview(null), 4200);
      setScreenshotCopied(false);
      return annotatedScreenshot;
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
      setCopiedScreenshotId(screenshot.id);
      window.setTimeout(() => setScreenshotCopied(false), 1600);
      window.setTimeout(() => setCopiedScreenshotId(null), 1600);
      return "copied" as const;
    } catch (nextError) {
      downloadSavedScreenshot(screenshot);
      setScreenshotCopied(false);
      setError(t("copyImageFallback"));
      return "downloaded" as const;
    }
  };

  const removeScreenshot = async (screenshot: SavedScreenshot) => {
    setError(null);
    try {
      await deleteDeviceScreenshot(screenshot.deviceSerial, screenshot.id);
      setDeviceScreenshots((current) => current.filter((item) => item.id !== screenshot.id));
      if (latestScreenshot?.id === screenshot.id) setLatestScreenshot(null);
      if (screenshotPreview?.screenshot.id === screenshot.id) setScreenshotPreview(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("errorScreenshot"));
    }
  };

  const insertScreenshotIntoDoc = async (device: AndroidDevice, screenshot: SavedScreenshot, note?: string) => {
    setLoading(true);
    setError(null);
    try {
      await insertScreenshotToDiscussionDoc(device.serial, screenshot.id, note);
      return true;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("errorDiscussionDoc"));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const resetDeviceScopedUi = () => {
    setSelectedDiscussionDoc(null);
    setEmbeddedDocUrl(null);
    embeddedDocUrlRef.current = null;
    setDeviceScreenshots([]);
    setScreenshotsLoading(false);
    setLatestScreenshot(null);
    setScreenshotCopied(false);
    setCopiedScreenshotId(null);
    setScreenshotPreview(null);
    if (screenshotPreviewTimerRef.current) {
      window.clearTimeout(screenshotPreviewTimerRef.current);
      screenshotPreviewTimerRef.current = undefined;
    }
    setCurrentAnnotations([]);
    setViewerRoster([]);
    setClearSignal((current) => current + 1);
  };

  const selectDevice = (device: AndroidDevice) => {
    if (device.serial !== selectedSerial) resetDeviceScopedUi();
    setSelectedSerial(device.serial);
    if (session && session.serial !== device.serial) {
      setSession(null);
    }
  };

  const selectDeviceFromRail = async (device: AndroidDevice) => {
    selectDevice(device);
    setLatestScreenshot(null);
    setScreenshotCopied(false);
    if (viewMode === "focus" && isDeviceControllable(device)) {
      await openDevice(device.serial);
    }
  };

  const enterDevice = async (device: AndroidDevice) => {
    selectDevice(device);
    setViewMode("focus");
    if (isDeviceControllable(device)) {
      await openDevice(device.serial);
    } else {
      setError(t("errorControlOffline"));
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
    <main className={`shell ${railCollapsed ? "railCollapsed" : ""}`}>
      <aside className="rail" aria-label={t("appTitle")}>
        <div className="railTop">
          <div className="brand">
            <span className="brandMark">
              <MonitorPlay size={19} />
            </span>
            <div className="brandText">
              <h1>{t("appTitle")}</h1>
              <p>{t("appSubtitle")}</p>
            </div>
          </div>
          <button
            className="railCollapseButton"
            type="button"
            onClick={() => setRailCollapsed((current) => !current)}
            title={railCollapsed ? t("expandSidebar") : t("collapseSidebar")}
            aria-label={railCollapsed ? t("expandSidebar") : t("collapseSidebar")}
          >
            {railCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        <div className="railBody" aria-hidden={railCollapsed}>
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
                  <button className="deviceSelectButton" type="button" onClick={() => void selectDeviceFromRail(device)}>
                    <Smartphone size={19} />
                    <span className="deviceCopy">
                      <strong>{displayName(device)}</strong>
                      <small>{device.publication?.owner || device.serial}</small>
                    </span>
                    <StatusDot device={device} />
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
                  <button className="deviceSelectButton" type="button" onClick={() => void selectDeviceFromRail(device)}>
                    <Smartphone size={18} />
                    <span className="deviceCopy">
                      <strong>{formatDeviceName(device)}</strong>
                      <small>{device.serial}</small>
                    </span>
                    <StatusDot device={device} />
                  </button>
                  <button className="deviceManageButton" type="button" onClick={() => setManagedSerial(device.serial)} title={t("deviceManagement")}>
                    <Settings size={15} />
                  </button>
                </div>
              ))
            )}
          </section>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{viewMode === "grid" ? t("phoneGridEyebrow") : t("usbHostViewer")}</p>
            <h2>{viewMode === "grid" ? t("phoneGrid") : selectedDevice ? displayName(selectedDevice) : t("waitingForDevice")}</h2>
          </div>
          <div className={`viewTabs mode-${viewMode}`} role="tablist" aria-label="Console view">
            <button className={`segmentedItem ${viewMode === "grid" ? "active" : ""}`} type="button" onClick={() => setViewMode("grid")}>
              {t("gridView")}
            </button>
            <button className={`segmentedItem ${viewMode === "focus" ? "active" : ""}`} type="button" onClick={() => setViewMode("focus")}>
              {t("focusView")}
            </button>
          </div>
          <div className="actions">
              <button className="secondary" onClick={() => void stopCurrentSession()} disabled={!session}>
              <Power size={16} />
              {t("stop")}
            </button>
            <button className="secondary" onClick={() => void captureCurrentDevice()} disabled={!selectedDeviceControllable || loading}>
              <Camera size={16} />
              {t("screenshot")}
            </button>
            <button className={`secondary ${logsOpen ? "activeAction" : ""}`} onClick={() => setLogsOpen((current) => !current)} disabled={!selectedDeviceControllable}>
              <Logs size={16} />
              {t("logs")}
            </button>
            <button
              className="primary"
              onClick={() => void openDevice(selectedSerial)}
              disabled={!selectedSerial || !selectedDeviceControllable || loading}
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
            <FocusMetaBar
              device={selectedDevice}
              t={t}
              viewers={viewerRoster}
              self={viewerIdentity}
              cursorsEnabled={cursorsEnabled}
              onToggleCursors={() => setCursorsEnabled((current) => !current)}
              onNameChange={(name) => {
                const next = { ...viewerIdentity, name: normalizeViewerName(name, viewerIdentity.id) };
                saveClientIdentity(next);
                setViewerIdentity(next);
              }}
            />

            <div
              className={`focusSurface ${showAuxPanel ? "withAuxPanel" : ""}`}
              style={{ "--aux-panel-width": showAuxPanel ? `${embeddedDocWidth}px` : "0px" } as React.CSSProperties}
            >
              <div className="sidePanelStack">
                <ControlPanel
                  device={selectedDevice}
                  loading={loading}
                  t={t}
                  onError={(message) => setError(message)}
                />
                <ScreenshotTray
                  device={selectedDevice}
                  screenshots={deviceScreenshots}
                  latestScreenshot={latestScreenshot?.deviceSerial === selectedDevice?.serial ? latestScreenshot : null}
                  copiedScreenshotId={copiedScreenshotId}
                  loading={loading || screenshotsLoading}
                  t={t}
                  onCapture={() => captureCurrentDevice(selectedDevice ?? undefined)}
                  onCopy={(screenshot) => copyScreenshot(screenshot)}
                  onDelete={(screenshot) => removeScreenshot(screenshot)}
                  onInsertDoc={
                    selectedDevice && selectedDiscussionDoc?.enabled && selectedDiscussionDoc.configured && selectedDiscussionDoc.doc
                      ? (screenshot) => insertScreenshotIntoDoc(selectedDevice, screenshot)
                      : undefined
                  }
                />
                <AppToolsPanel key={`apps-${selectedSerial ?? "none"}`} device={selectedDevice} loading={loading} t={t} onError={(message) => setError(message)} />
                {selectedDevice ? (
                  <DiscussionDocPanel
                    device={selectedDevice}
                    latestScreenshot={latestScreenshot?.deviceSerial === selectedDevice.serial ? latestScreenshot : null}
                    status={selectedDiscussionDoc}
                    t={t}
                    onStatusChange={setSelectedDiscussionDoc}
                    onInsertDoc={(screenshot, note) => insertScreenshotIntoDoc(selectedDevice, screenshot, note)}
                    onOpenInside={openEmbeddedDoc}
                  />
                ) : null}
              </div>
              <MirrorPlayer
                device={selectedDevice}
                session={session}
                t={t}
                cursorsEnabled={cursorsEnabled}
                clientIdentity={viewerIdentity}
                annotationMode={annotationMode}
                annotationColor={annotationColor}
                onAnnotationModeChange={setAnnotationMode}
                onAnnotationColorChange={(color) => {
                  setAnnotationColor(color);
                  saveAnnotationColor(color);
                }}
                onClearAnnotations={() => setClearSignal((current) => current + 1)}
                clearSignal={clearSignal}
                onAnnotationsChange={setCurrentAnnotations}
                onViewersChange={setViewerRoster}
              />
              {showEmbeddedDoc && embeddedDocUrl ? (
                <EmbeddedDocPanel
                  url={embeddedDocUrl}
                  width={embeddedDocWidth}
                  t={t}
                  onResize={resizeEmbeddedDoc}
                  onOpenUrl={openEmbeddedDoc}
                  onClose={closeEmbeddedDoc}
                />
              ) : null}
              {logsOpen ? (
                <SideLogsPanel
                  key={`logs-${selectedSerial ?? "none"}`}
                  width={embeddedDocWidth}
                  device={selectedDevice}
                  loading={loading}
                  t={t}
                  onResize={resizeEmbeddedDoc}
                  onError={(message) => setError(message)}
                  onClose={() => setLogsOpen(false)}
                />
              ) : null}
            </div>
            {screenshotPreview && screenshotPreview.screenshot.deviceSerial === selectedDevice?.serial ? (
              <ScreenshotFlash
                screenshot={screenshotPreview.screenshot}
                copied={screenshotCopied && copiedScreenshotId === screenshotPreview.screenshot.id}
                t={t}
                onCopy={() => void copyScreenshot(screenshotPreview.screenshot)}
                onDismiss={() => setScreenshotPreview(null)}
              />
            ) : null}
          </>
        )}
      </section>

      {managedDevice ? (
        <DeviceManager
          device={managedDevice}
          loading={loading}
          t={t}
          onClose={() => setManagedSerial(null)}
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
  onPublish,
  onUnpublish
}: {
  device: AndroidDevice;
  loading: boolean;
  t: (key: MessageKey) => string;
  onClose: () => void;
  onPublish: (device: AndroidDevice, input: { label: string; owner?: string; note?: string }) => void;
  onUnpublish: (device: AndroidDevice) => void;
}) {
  const [label, setLabel] = useState(device.publication?.label ?? formatDeviceName(device));
  const [owner, setOwner] = useState(device.publication?.owner ?? "");
  const [note, setNote] = useState(device.publication?.note ?? "");

  useEffect(() => {
    setLabel(device.publication?.label ?? formatDeviceName(device));
    setOwner(device.publication?.owner ?? "");
    setNote(device.publication?.note ?? "");
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

      </section>
    </div>
  );
}

function DiscussionDocPanel({
  device,
  latestScreenshot,
  status,
  t,
  onStatusChange,
  onInsertDoc,
  onOpenInside
}: {
  device: AndroidDevice;
  latestScreenshot: SavedScreenshot | null;
  status: DiscussionDocStatus | null;
  t: (key: MessageKey) => string;
  onStatusChange: (status: DiscussionDocStatus) => void;
  onInsertDoc: (screenshot: SavedScreenshot, note?: string) => Promise<boolean>;
  onOpenInside: (url: string) => void;
}) {
  const larkReady = status?.enabled === true && status.configured;
  const [docUrl, setDocUrl] = useState("");
  const [docNote, setDocNote] = useState("");
  const [docBusy, setDocBusy] = useState(false);
  const [docMessage, setDocMessage] = useState("");
  const [inserted, setInserted] = useState(false);

  useEffect(() => {
    setDocUrl(status?.doc?.url ?? "");
    setDocNote("");
    setDocMessage("");
  }, [device.serial, status?.doc?.url]);

  const bindDoc = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!docUrl.trim()) return;
    setDocBusy(true);
    setDocMessage("");
    try {
      const nextStatus = await bindDiscussionDoc(device.serial, docUrl);
      onStatusChange(nextStatus);
      setDocUrl(nextStatus.doc?.url ?? docUrl);
      setDocMessage(nextStatus.doc?.lastStatus ?? t("bindDoc"));
    } catch (error) {
      setDocMessage(error instanceof Error ? error.message : t("errorDiscussionDoc"));
    } finally {
      setDocBusy(false);
    }
  };

  const createDoc = async () => {
    setDocBusy(true);
    setDocMessage("");
    try {
      const nextStatus = await createDiscussionDoc(device.serial);
      onStatusChange(nextStatus);
      setDocUrl(nextStatus.doc?.url ?? "");
      setDocMessage(nextStatus.doc?.lastStatus ?? t("createDoc"));
    } catch (error) {
      setDocMessage(error instanceof Error ? error.message : t("errorDiscussionDoc"));
    } finally {
      setDocBusy(false);
    }
  };

  const insertLatest = async () => {
    if (!latestScreenshot) return;
    setDocBusy(true);
    setDocMessage("");
    const ok = await onInsertDoc(latestScreenshot, docNote);
    if (ok) {
      setInserted(true);
      setDocMessage(t("docInserted"));
      window.setTimeout(() => setInserted(false), 1600);
    }
    setDocBusy(false);
  };

  return (
    <section className="discussionDocPanel">
      <div className="docHeader">
        <div>
          <span>
            <FileText size={14} />
            {t("discussionDoc")}
          </span>
          <strong>{status?.doc?.title ?? t("noDiscussionDoc")}</strong>
        </div>
        {status?.doc ? (
          <div className="docHeaderActions">
            <button className="docIconLink" type="button" onClick={() => onOpenInside(status.doc?.url ?? docUrl)} title={t("openDocInside")}>
              <PanelRightOpen size={14} />
            </button>
            <a className="docIconLink" href={status.doc.url} target="_blank" rel="noreferrer" title={t("openDoc")}>
              <ExternalLink size={14} />
            </a>
          </div>
        ) : null}
      </div>

      {status?.enabled === true && !status.configured ? (
        <div className="docConfigHint">
          <strong>{t("discussionDocMissing")}</strong>
          <span>{t("discussionDocMissingHint")}</span>
        </div>
      ) : null}

      <form className="docBindForm compact" onSubmit={bindDoc}>
        <div className="docBindRow">
          <Link size={14} />
          <input
            value={docUrl}
            aria-label={t("discussionDocUrl")}
            onChange={(event) => setDocUrl(event.target.value)}
            placeholder="https://.../docx/..."
          />
          <button className="docSmallButton" type="submit" disabled={docBusy || !docUrl.trim()}>
            {t("bindDoc")}
          </button>
        </div>
        {larkReady ? (
          <div className="docCompactActions">
            <button className="docSmallButton primaryTone" type="button" disabled={docBusy} onClick={() => void createDoc()}>
              <Plus size={13} />
              {t("createDoc")}
            </button>
          </div>
        ) : null}
      </form>

      {larkReady && status?.doc && latestScreenshot ? (
        <div className="docInsertArea">
          <textarea value={docNote} onChange={(event) => setDocNote(event.target.value)} placeholder={t("docNotePlaceholder")} />
          <button className="primary docInsertButton" type="button" disabled={docBusy} onClick={() => void insertLatest()}>
            {inserted ? <Check size={15} /> : <FileText size={15} />}
            {inserted ? t("docInserted") : t("insertDoc")}
          </button>
        </div>
      ) : null}

      {docMessage ? <div className="docStatus">{docMessage}</div> : null}
    </section>
  );
}

function EmbeddedDocPanel({
  url,
  width,
  t,
  onResize,
  onOpenUrl,
  onClose
}: {
  url: string;
  width: number;
  t: (key: MessageKey) => string;
  onResize: (width: number) => void;
  onOpenUrl: (url: string) => void;
  onClose: () => void;
}) {
  const [draftUrl, setDraftUrl] = useState(url);
  const [frameUrl, setFrameUrl] = useState(url);

  useEffect(() => {
    setDraftUrl(url);
    setFrameUrl(url);
  }, [url]);

  const openDraft = (event: React.FormEvent) => {
    event.preventDefault();
    const nextUrl = draftUrl.trim();
    if (!nextUrl) return;
    setFrameUrl(nextUrl);
    onOpenUrl(nextUrl);
  };

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = width;

    const move = (moveEvent: PointerEvent) => {
      onResize(clamp(startWidth - (moveEvent.clientX - startX), 360, 920));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };

  return (
    <section className="embeddedDocPanel" aria-label={t("discussionDoc")} style={{ width }}>
      <button className="embeddedDocResizeHandle" type="button" onPointerDown={startResize} title={t("resizeDocPreview")} aria-label={t("resizeDocPreview")} />
      <form className="embeddedDocAddressBar" onSubmit={openDraft}>
        <Link size={15} />
        <input
          value={draftUrl}
          aria-label={t("discussionDocUrl")}
          onChange={(event) => setDraftUrl(event.target.value)}
          placeholder="https://.../docx/..."
        />
        <a className="iconButton" href={frameUrl} target="_blank" rel="noreferrer" title={t("openDoc")}>
          <ExternalLink size={16} />
        </a>
        <button className="iconButton" type="button" onClick={onClose} title={t("closeDocPreview")}>
          <X size={17} />
        </button>
      </form>
      <iframe
        className="embeddedDocFrame"
        title={t("discussionDoc")}
        src={frameUrl}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </section>
  );
}

function SideLogsPanel({
  width,
  device,
  loading,
  t,
  onResize,
  onError,
  onClose
}: {
  width: number;
  device: AndroidDevice | null;
  loading: boolean;
  t: (key: MessageKey) => string;
  onResize: (width: number) => void;
  onError: (message: string) => void;
  onClose: () => void;
}) {
  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = width;

    const move = (moveEvent: PointerEvent) => {
      onResize(clamp(startWidth - (moveEvent.clientX - startX), 360, 920));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };

  return (
    <aside className="auxSidePanel logsSidePanel" style={{ width }} aria-label={t("logs")}>
      <button className="embeddedDocResizeHandle" type="button" onPointerDown={startResize} title={t("resizeDocPreview")} aria-label={t("resizeDocPreview")} />
      <LogsPanel device={device} loading={loading} t={t} onError={onError} onClose={onClose} />
    </aside>
  );
}

function ScreenshotTray({
  device,
  screenshots,
  latestScreenshot,
  copiedScreenshotId,
  loading,
  t,
  onCapture,
  onCopy,
  onDelete,
  onInsertDoc
}: {
  device: AndroidDevice | null;
  screenshots: SavedScreenshot[];
  latestScreenshot: SavedScreenshot | null;
  copiedScreenshotId: string | null;
  loading: boolean;
  t: (key: MessageKey) => string;
  onCapture: () => Promise<SavedScreenshot | undefined>;
  onCopy: (screenshot: SavedScreenshot) => Promise<"copied" | "downloaded">;
  onDelete: (screenshot: SavedScreenshot) => void;
  onInsertDoc?: (screenshot: SavedScreenshot) => Promise<boolean>;
}) {
  const [insertedScreenshotId, setInsertedScreenshotId] = useState<string | null>(null);
  const shownScreenshots = screenshots.filter((screenshot) => screenshot.id !== latestScreenshot?.id).slice(0, 8);

  const insert = async (screenshot: SavedScreenshot) => {
    if (!onInsertDoc) return;
    const ok = await onInsertDoc(screenshot);
    if (!ok) return;
    setInsertedScreenshotId(screenshot.id);
    window.setTimeout(() => setInsertedScreenshotId(null), 1600);
  };

  return (
    <section className="screenshotTray">
      <div className="trayHeader">
        <div>
          <span>
            <Camera size={14} />
            {t("screenshotTray")}
          </span>
          <strong>{latestScreenshot ? t("latestShot") : t("screenshotHistory")}</strong>
        </div>
        <button className="primary trayCaptureButton" type="button" disabled={!device || device.state !== "device" || loading} onClick={() => void onCapture()}>
          <Camera size={14} />
          {t("screenshot")}
        </button>
      </div>

      {latestScreenshot ? (
        <article className="latestScreenshotCard">
          <img src={latestScreenshot.url} alt="" />
          <div>
            <strong>{new Date(latestScreenshot.createdAt).toLocaleTimeString()}</strong>
            <span>{Math.round(latestScreenshot.sizeBytes / 1024)} KB</span>
          </div>
          <button className="iconButton" type="button" onClick={() => void onCopy(latestScreenshot)} title={t("copyImage")}>
            {copiedScreenshotId === latestScreenshot.id ? <Check size={15} /> : <Copy size={15} />}
          </button>
          <a className="iconButton" href={latestScreenshot.downloadUrl} download title={t("download")}>
            <Download size={15} />
          </a>
          <button className="iconButton dangerIcon" type="button" onClick={() => onDelete(latestScreenshot)} title={t("deleteScreenshot")}>
            <Trash2 size={15} />
          </button>
        </article>
      ) : null}

      {!latestScreenshot && shownScreenshots.length === 0 ? (
        <div className="screenshotEmpty">{loading ? t("starting") : t("noScreenshots")}</div>
      ) : shownScreenshots.length > 0 ? (
        <div className="screenshotList trayScreenshotList">
          {shownScreenshots.map((screenshot) => (
            <article className={`screenshotItem ${onInsertDoc ? "hasDocAction" : ""}`} key={screenshot.id}>
              <img src={screenshot.url} alt="" loading="lazy" />
              <div>
                <strong>{new Date(screenshot.createdAt).toLocaleString()}</strong>
                <span>{Math.round(screenshot.sizeBytes / 1024)} KB</span>
              </div>
              <button className="iconButton" type="button" onClick={() => void onCopy(screenshot)} title={t("copyImage")}>
                {copiedScreenshotId === screenshot.id ? <Check size={15} /> : <Copy size={15} />}
              </button>
              {onInsertDoc ? (
                <button className="iconButton" type="button" onClick={() => void insert(screenshot)} title={t("insertDoc")}>
                  {insertedScreenshotId === screenshot.id ? <Check size={15} /> : <FileText size={15} />}
                </button>
              ) : null}
              <a className="iconButton" href={screenshot.downloadUrl} download title={t("download")}>
                <Download size={15} />
              </a>
              <button className="iconButton dangerIcon" type="button" onClick={() => onDelete(screenshot)} title={t("deleteScreenshot")}>
                <Trash2 size={15} />
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ScreenshotFlash({
  screenshot,
  copied,
  t,
  onCopy,
  onDismiss
}: {
  screenshot: SavedScreenshot;
  copied: boolean;
  t: (key: MessageKey) => string;
  onCopy: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="screenshotFlash" role="status">
      <img src={screenshot.url} alt="" />
      <div className="screenshotFlashBody">
        <strong>{t("screenshotSaved")}</strong>
        <span>{new Date(screenshot.createdAt).toLocaleTimeString()}</span>
      </div>
      <button className="iconButton" type="button" onClick={onCopy} title={t("copyImage")}>
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
      <a className="iconButton" href={screenshot.downloadUrl} download title={t("download")}>
        <Download size={15} />
      </a>
      <button className="iconButton" type="button" onClick={onDismiss} title="Close">
        <X size={15} />
      </button>
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
            <button className="phoneOpenArea" type="button" disabled={!isDeviceControllable(device)} onClick={() => onOpen(device)}>
              <div className="phonePreview" aria-label={t("preview")}>
              <div className="phoneChrome" style={{ aspectRatio: deviceAspectRatio(device) }}>
                <span className="speaker" />
                <div className="previewScreen">
                  {isDeviceControllable(device) ? (
                    <DevicePreviewImage device={device} thumbnailTick={thumbnailTick} />
                  ) : null}
                  <span className={`previewSignal ${deviceStatusClass(device)}`} />
                  {!isDeviceControllable(device) ? (
                    <>
                      <Smartphone size={34} />
                      <small>{device.controlOnline === false ? t("controlOffline") : device.size ? `${device.size.width}x${device.size.height}` : t("unknownSize")}</small>
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
                <StatusDot device={device} />
                {device.controlOnline === false ? t("controlOffline") : device.state}
              </span>
              <div className="phoneActions">
                <button className="phoneAction" type="button" disabled={!isDeviceControllable(device)} onClick={() => onOpen(device)}>
                  {t("openDevice")}
                </button>
                {device.publication?.published ? (
                  <button className="phoneAction danger" type="button" disabled={loading} onClick={() => onUnpublish(device)}>
                    {t("unpublish")}
                  </button>
                ) : (
                  <button className="phoneAction" type="button" disabled={loading || !isDeviceControllable(device)} onClick={() => onPublish(device)}>
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

function FocusMetaBar({
  device,
  t,
  viewers,
  self,
  cursorsEnabled,
  onToggleCursors,
  onNameChange
}: {
  device: AndroidDevice | null;
  t: (key: MessageKey) => string;
  viewers: ViewerPresence[];
  self: ClientIdentity;
  cursorsEnabled: boolean;
  onToggleCursors: () => void;
  onNameChange: (name: string) => void;
}) {
  const visibleViewers = viewers.slice(0, 5);
  const overflow = Math.max(0, viewers.length - visibleViewers.length);

  return (
    <div className="focusMetaBar">
      <div className="deviceStatusBar">
        <InfoPill tone="link" icon={<Cable size={15} />} label={device?.transport.toUpperCase() ?? "USB"} />
        <InfoPill
          tone="screen"
          icon={<Smartphone size={15} />}
          label={device?.size ? `${device.size.width}x${device.size.height}` : t("unknownSize")}
        />
      </div>
      <div className="collabBar">
        <span className="viewerLabel">
          <UsersRound size={14} />
          {viewers.length || 1} {t("viewers")}
        </span>
        <div className="viewerStack" aria-label={t("viewers")}>
          {visibleViewers.map((viewer) => (
            <span className="viewerChip" key={viewer.clientId} title={viewer.name} style={{ "--viewer-color": viewer.color } as React.CSSProperties}>
              <span>{viewer.name.slice(0, 1).toUpperCase()}</span>
              <small>{viewer.name}</small>
            </span>
          ))}
          {overflow > 0 ? <span className="viewerMore">+{overflow}</span> : null}
        </div>
        <button className={`cursorToggle ${cursorsEnabled ? "active" : ""}`} type="button" onClick={onToggleCursors}>
          {cursorsEnabled ? <Eye size={15} /> : <EyeOff size={15} />}
          {cursorsEnabled ? t("cursorsOn") : t("cursorsOff")}
        </button>
        <label className="cursorNameControl">
          <UserRound size={14} />
          <input value={self.name} aria-label={t("cursorName")} title={t("cursorName")} maxLength={24} onChange={(event) => onNameChange(event.target.value)} />
        </label>
      </div>
    </div>
  );
}

function AnnotationToolbar({
  t,
  annotationMode,
  onAnnotationModeChange,
  annotationColor,
  onAnnotationColorChange,
  onClearAnnotations
}: {
  t: (key: MessageKey) => string;
  annotationMode: AnnotationMode;
  onAnnotationModeChange: (mode: AnnotationMode) => void;
  annotationColor: AnnotationColor;
  onAnnotationColorChange: (color: AnnotationColor) => void;
  onClearAnnotations: () => void;
}) {
  return (
    <div className={`annotationTools topAnnotationTools mode-${annotationMode}`} aria-label="Annotation tools">
      <button className={`annotationModeButton ${annotationMode === "control" ? "active" : ""}`} type="button" onClick={() => onAnnotationModeChange("control")} title={t("annotationControl")}>
        <MousePointer2 size={14} />
        {t("annotationControl")}
      </button>
      <button className={`annotationModeButton ${annotationMode === "rect" ? "active" : ""}`} type="button" onClick={() => onAnnotationModeChange("rect")} title={t("annotationRect")}>
        <SquareDashedMousePointer size={14} />
        {t("annotationRect")}
      </button>
      <button className={`annotationModeButton ${annotationMode === "draw" ? "active" : ""}`} type="button" onClick={() => onAnnotationModeChange("draw")} title={t("annotationDraw")}>
        <Circle size={13} />
        {t("annotationDraw")}
      </button>
      <span className={`annotationColorPicker ${annotationMode !== "control" ? "visible" : ""}`} aria-label={t("annotationColor")} aria-hidden={annotationMode === "control"}>
        {ANNOTATION_COLORS.map((color) => (
          <button
            className={`annotationColorSwatch ${annotationColor === color ? "active" : ""}`}
            type="button"
            key={color}
            disabled={annotationMode === "control"}
            tabIndex={annotationMode === "control" ? -1 : 0}
            onClick={() => onAnnotationColorChange(color)}
            title={t("annotationColor")}
            style={{ "--swatch-color": color } as React.CSSProperties}
          >
            <span />
          </button>
        ))}
      </span>
      <button type="button" onClick={onClearAnnotations} title={t("clearCanvas")}>
        <Delete size={14} />
        {t("clearCanvas")}
      </button>
    </div>
  );
}

function DevicePreviewImage({ device, thumbnailTick }: { device: AndroidDevice; thumbnailTick: number }) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const src = `/api/devices/${encodeURIComponent(device.serial)}/screenshot?t=${thumbnailTick}`;

  useEffect(() => {
    setFailed(false);
  }, [src]);

  useEffect(() => {
    setDisplaySrc(null);
    setFailed(false);
  }, [device.serial]);

  return (
    <>
      {!displaySrc && !failed ? <span className="previewLoading" /> : null}
      {displaySrc ? <img className="previewImage loaded" src={displaySrc} alt="" loading="lazy" draggable={false} /> : null}
      {!failed && src !== displaySrc ? (
        <img
          className="previewImage preloader"
          src={src}
          alt=""
          loading="eager"
          draggable={false}
          onLoad={() => setDisplaySrc(src)}
          onError={() => {
            setFailed(true);
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

function AppToolsPanel({
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
  const [packages, setPackages] = useState<SavedPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [deeplink, setDeeplink] = useState("");
  const [busy, setBusy] = useState(false);
  const disabled = !device || device.state !== "device" || loading || busy;

  useEffect(() => {
    void fetchPackages().then((items) => {
      setPackages(items);
      setSelectedPackageId((current) => current || items[0]?.id || "");
    }).catch(() => undefined);
  }, []);

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const pkg = await uploadPackage(file);
      setPackages((current) => [pkg, ...current.filter((item) => item.id !== pkg.id)]);
      setSelectedPackageId(pkg.id);
    } catch (error) {
      onError(error instanceof Error ? error.message : "APK upload failed");
    } finally {
      setBusy(false);
    }
  };

  const install = async () => {
    if (!device || !selectedPackageId) return;
    setBusy(true);
    try {
      await installPackage(device.serial, selectedPackageId);
    } catch (error) {
      onError(error instanceof Error ? error.message : "APK install failed");
    } finally {
      setBusy(false);
    }
  };

  const openLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!device || !deeplink.trim()) return;
    setBusy(true);
    try {
      await openDeeplink(device.serial, deeplink.trim());
    } catch (error) {
      onError(error instanceof Error ? error.message : "Deeplink failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="toolPanel appToolsPanel" aria-label={t("apps")}>
      <div className="toolPanelHeader">
        <span>
          <Package size={14} />
          {t("apps")}
        </span>
      </div>
      <label className="apkUpload">
        <Upload size={15} />
        {t("uploadApk")}
        <input type="file" accept=".apk,application/vnd.android.package-archive" onChange={(event) => void upload(event.currentTarget.files?.[0])} />
      </label>
      <div className="packageInstallRow">
        <select value={selectedPackageId} onChange={(event) => setSelectedPackageId(event.target.value)} aria-label={t("recentPackages")}>
          {packages.length === 0 ? <option value="">{t("recentPackages")}</option> : null}
          {packages.map((pkg) => (
            <option value={pkg.id} key={pkg.id}>
              {pkg.originalName}
            </option>
          ))}
        </select>
        <button className="secondary" type="button" disabled={disabled || !selectedPackageId} onClick={() => void install()}>
          {t("installApk")}
        </button>
      </div>
      <form className="deeplinkForm" onSubmit={(event) => void openLink(event)}>
        <span>
          <Link size={14} />
          {t("deeplink")}
        </span>
        <input value={deeplink} onChange={(event) => setDeeplink(event.target.value)} placeholder={t("deeplinkPlaceholder")} />
        <button className="primary" type="submit" disabled={disabled || !deeplink.trim()}>
          {t("openDeeplink")}
        </button>
      </form>
    </section>
  );
}

function LogsPanel({
  device,
  loading,
  t,
  onError,
  onClose
}: {
  device: AndroidDevice | null;
  loading: boolean;
  t: (key: MessageKey) => string;
  onError: (message: string) => void;
  onClose?: () => void;
}) {
  const [preset, setPreset] = useState<DeviceLogs["preset"]>("current_app");
  const [minLevel, setMinLevel] = useState<LogLevel>("V");
  const [query, setQuery] = useState("");
  const [logs, setLogs] = useState<DeviceLogs | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(true);
  const logOutputRef = useRef<HTMLDivElement | null>(null);
  const disabled = !device || device.state !== "device" || loading || busy;
  const appPidText = logs?.pids?.length ? ` #${logs.pids.join(",")}` : logs?.pid ? ` #${logs.pid}` : "";
  const currentTarget = logs?.packageName ? `${logs.packageName}${appPidText}` : t("logPresetAll");

  const refreshLogs = useCallback(async (silent = false) => {
    if (!device) return;
    if (!silent) setBusy(true);
    try {
      setLogs(await fetchDeviceLogs(device.serial, { preset, query, lines: 420, minLevel }));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to read logs");
    } finally {
      if (!silent) setBusy(false);
    }
  }, [device?.serial, preset, query, minLevel, onError]);

  useEffect(() => {
    if (!device || device.state !== "device") {
      setLogs(null);
      return;
    }
    setLogs(null);
    void refreshLogs();
  }, [device?.serial, preset, query, minLevel]);

  useEffect(() => {
    if (!live || !device || device.state !== "device") return;
    const timer = window.setInterval(() => {
      void refreshLogs(true);
    }, 1200);
    return () => window.clearInterval(timer);
  }, [live, device?.serial, preset, query, minLevel, refreshLogs]);

  useEffect(() => {
    const output = logOutputRef.current;
    if (!output || !live) return;
    output.scrollTop = output.scrollHeight;
  }, [logs?.capturedAt, live]);

  const copyLogs = async () => {
    const text = logs?.lines.join("\n") ?? "";
    if (!text) return;
    await navigator.clipboard?.writeText(text).catch(() => undefined);
  };

  return (
    <section className="toolPanel logsPanel" aria-label={t("logs")}>
      <div className="toolPanelHeader">
        <span>
          <Logs size={14} />
          {t("logs")}
        </span>
        <div className="logHeaderActions">
          <button className={`secondary miniToggle ${live ? "activeAction" : ""}`} type="button" disabled={!device || device.state !== "device"} onClick={() => setLive((current) => !current)}>
            {live ? t("pauseLogs") : t("liveLogs")}
          </button>
          <button className="iconButton" type="button" disabled={disabled} onClick={() => void refreshLogs()} title={t("refreshLogs")}>
            <RefreshCw size={14} />
          </button>
          {onClose ? (
            <button className="iconButton" type="button" onClick={onClose} title="Close">
              <X size={15} />
            </button>
          ) : null}
        </div>
      </div>
      <div className="logFilterCard">
        <div className="logFilterGroup">
          <span className="logFilterLabel">{t("logs")}</span>
          <div className={`logPresetRow preset-${preset}`}>
            {([
              ["current_app", t("logPresetCurrent"), <Terminal size={13} />],
              ["crash", t("logPresetCrash"), <Bug size={13} />],
              ["network", t("logPresetNetwork"), <Radio size={13} />],
              ["all", t("logPresetAll"), <Logs size={13} />]
            ] as const).map(([value, label, icon]) => (
              <button className={preset === value ? "active" : ""} type="button" key={value} onClick={() => {
                setPreset(value);
                setMinLevel(value === "crash" ? "E" : "V");
                setLogs(null);
              }}>
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="logFilterGroup">
          <span className="logFilterLabel">{t("logLevel")}</span>
          <div className={`logLevelRow level-${minLevel}`} aria-label={t("logLevel")}>
            {(["V", "D", "I", "W", "E", "F"] as const).map((level) => (
              <button
                className={minLevel === level ? "active" : ""}
                type="button"
                key={level}
                title={`${logLevelLabel(level, t)} (${level}+)`}
                onClick={() => {
                  setMinLevel(level);
                  setLogs(null);
                }}
              >
                {logLevelLabel(level, t)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="logSearchRow single">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("logSearch")} />
      </div>
      {logs ? (
        <div className="logMeta">
          {live ? t("liveLogs") : t("pauseLogs")} · {t("logMeta")} {logs.lines.length} · {t("logLevel")} {logLevelLabel(logs.minLevel ?? minLevel, t)} · {currentTarget}
        </div>
      ) : null}
      <div className="logOutput" ref={logOutputRef}>
        {busy ? (
          <span>{t("refreshLogs")}...</span>
        ) : logs?.lines.length ? (
          <pre className="logText">
            {logs.lines.map((line, index) => {
              const level = readClientLogLevel(line) ?? "V";
              return (
                <span className={`logLine level-${level}`} key={`${logs.capturedAt}-${index}`}>
                  {line}
                </span>
              );
            })}
          </pre>
        ) : (
          <span>{preset === "current_app" ? t("logCurrentAppEmpty") : t("noLogs")}</span>
        )}
      </div>
      <button className="secondary logCopyButton" type="button" disabled={!logs?.lines.length} onClick={() => void copyLogs()}>
        <Copy size={14} />
        {t("copyLogs")}
      </button>
      <button className="secondary logCopyButton" type="button" disabled={!logs?.lines.length} onClick={() => setLogs(null)}>
        <Delete size={14} />
        {t("clearLogs")}
      </button>
    </section>
  );
}

function readClientLogLevel(line: string): LogLevel | undefined {
  const match = line.match(/\s([VDIWEF])\/[^:]+:/);
  return match?.[1] as LogLevel | undefined;
}

function logLevelLabel(level: LogLevel, t: (key: MessageKey) => string) {
  const labels: Record<LogLevel, MessageKey> = {
    V: "logLevelVerbose",
    D: "logLevelDebug",
    I: "logLevelInfo",
    W: "logLevelWarn",
    E: "logLevelError",
    F: "logLevelFatal"
  };
  return t(labels[level]);
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

type ViewerPresence = {
  clientId: string;
  name: string;
  color: string;
  seenAt: number;
};

type PresenceMessage =
  | {
      type: "roster";
      viewers: ViewerPresence[];
    }
  | {
      type: "hello";
      clientId: string;
      name: string;
      color: string;
    }
  | {
      type: "clear";
      clientId: string;
    }
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
;

function MirrorPlayer({
  device,
  session,
  t,
  cursorsEnabled,
  clientIdentity,
  annotationMode,
  annotationColor,
  onAnnotationModeChange,
  onAnnotationColorChange,
  onClearAnnotations,
  clearSignal,
  onAnnotationsChange,
  onViewersChange
}: {
  device: AndroidDevice | null;
  session: MirrorSession | null;
  t: (key: MessageKey) => string;
  cursorsEnabled: boolean;
  clientIdentity: ClientIdentity;
  annotationMode: AnnotationMode;
  annotationColor: AnnotationColor;
  onAnnotationModeChange: (mode: AnnotationMode) => void;
  onAnnotationColorChange: (color: AnnotationColor) => void;
  onClearAnnotations: () => void;
  clearSignal: number;
  onAnnotationsChange: (annotations: SharedAnnotation[]) => void;
  onViewersChange: (viewers: ViewerPresence[]) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenFrameRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const pointerRef = useRef<{ x: number; y: number; moved: boolean; longPressed: boolean; startedAt: number } | null>(null);
  const wheelLockRef = useRef(false);
  const presenceRef = useRef<WebSocket | null>(null);
  const clientIdentityRef = useRef(clientIdentity);
  const annotationColorRef = useRef<AnnotationColor>(annotationColor);
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
    annotationColorRef.current = annotationColor;
  }, [annotationColor]);

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

    socket.onopen = () => {
      sendPresenceHello();
    };

    socket.onmessage = (event) => {
      const message = parsePresenceMessage(event.data);
      if (!message) return;

      if (message.type === "roster") {
        onViewersChange(message.viewers.length ? message.viewers : [identityToViewer(clientIdentityRef.current)]);
        return;
      }

      if (message.clientId === clientIdentityRef.current.id) return;

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
        if (message.type === "cursor") {
          next[message.clientId] = message;
        }
        return next;
      });
    };

    socket.onclose = () => {
      if (presenceRef.current === socket) presenceRef.current = null;
    };

    return () => {
      sendPresenceLeave();
      onViewersChange([]);
      socket.close();
    };
  }, [device?.serial]);

  useEffect(() => {
    sendPresenceHello();
  }, [clientIdentity.name, clientIdentity.color]);

  useEffect(() => {
    if (lastClearSignalRef.current === clearSignal) return;
    lastClearSignalRef.current = clearSignal;
    setAnnotations({});
    setDraftAnnotation(null);
    onAnnotationsChange([]);
    sendPresenceClear();
  }, [clearSignal]);

  useEffect(() => {
    onAnnotationsChange(Object.values(annotations));
  }, [annotations, onAnnotationsChange]);

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
      const id = createClientId();
      annotationRef.current = { id, start: point, points: [point], mode: annotationMode };
      setDraftAnnotation(createDraftAnnotation(id, annotationMode, point, point, [point], clientIdentityRef.current, annotationColorRef.current));
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
      setDraftAnnotation(createDraftAnnotation(annotation.id, annotation.mode, annotation.start, point, annotation.points, clientIdentityRef.current, annotationColorRef.current));
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
        clientIdentityRef.current,
        annotationColorRef.current
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

  const openFullscreen = async () => {
    const target = screenFrameRef.current;
    if (!target) return;
    if (target.requestFullscreen) {
      await target.requestFullscreen().catch(() => undefined);
      return;
    }

    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    video?.webkitEnterFullscreen?.();
  };

  return (
    <section className="stage">
      <div className="stageToolbar">
        <AnnotationToolbar
          t={t}
          annotationMode={annotationMode}
          onAnnotationModeChange={onAnnotationModeChange}
          annotationColor={annotationColor}
          onAnnotationColorChange={onAnnotationColorChange}
          onClearAnnotations={onClearAnnotations}
        />
      </div>
      <div className="screenFrame" ref={screenFrameRef} style={screenFrameStyle(device)}>
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
        <button className="fullscreenButton" type="button" onClick={() => void openFullscreen()} title={t("fullscreenView")}>
          <Maximize2 size={15} />
          {t("fullscreenView")}
        </button>
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

  function sendPresenceHello() {
    if (!presenceRef.current || presenceRef.current.readyState !== WebSocket.OPEN) return;
    const identity = clientIdentityRef.current;
    presenceRef.current.send(
      JSON.stringify({
        type: "hello",
        clientId: identity.id,
        name: identity.name,
        color: identity.color
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

async function annotateAndSaveScreenshot(serial: string, screenshot: SavedScreenshot, annotations: SharedAnnotation[]) {
  const image = await loadImage(screenshot.rawUrl ?? screenshot.url);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext("2d");
  if (!context) return screenshot;

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  drawAnnotations(context, canvas.width, canvas.height, annotations);
  const dataUrl = canvas.toDataURL("image/png");
  return saveAnnotatedScreenshot(serial, screenshot.id, dataUrl, annotations);
}

function drawAnnotations(context: CanvasRenderingContext2D, width: number, height: number, annotations: SharedAnnotation[]) {
  for (const annotation of annotations) {
    context.save();
    context.strokeStyle = annotation.color;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.shadowColor = "rgba(0, 0, 0, 0.28)";
    context.shadowBlur = 2;
    context.shadowOffsetY = 1;

    if (annotation.kind === "rect") {
      const x = annotation.rect.x * width;
      const y = annotation.rect.y * height;
      const rectWidth = annotation.rect.width * width;
      const rectHeight = annotation.rect.height * height;
      context.fillStyle = hexToRgba(annotation.color, 0.1);
      context.lineWidth = Math.max(2, Math.min(width, height) * 0.0032);
      context.fillRect(x, y, rectWidth, rectHeight);
      context.strokeRect(x, y, rectWidth, rectHeight);
    } else if (annotation.points.length > 1) {
      context.lineWidth = Math.max(2, Math.min(width, height) * 0.004);
      context.beginPath();
      annotation.points.forEach((point, index) => {
        const x = point.x * width;
        const y = point.y * height;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
    }

    context.restore();
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load screenshot image"));
    image.src = src;
  });
}

function hexToRgba(hex: string, alpha: number) {
  const match = hex.match(/^#([0-9a-f]{6})$/i);
  if (!match) return `rgba(214, 255, 89, ${alpha})`;
  const value = Number.parseInt(match[1], 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function downloadSavedScreenshot(screenshot: SavedScreenshot) {
  const link = document.createElement("a");
  link.href = screenshot.downloadUrl;
  link.download = screenshot.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function createDraftAnnotation(
  id: string,
  mode: Exclude<AnnotationMode, "control">,
  start: AnnotationPoint,
  end: AnnotationPoint,
  points: AnnotationPoint[],
  identity: ClientIdentity,
  color: AnnotationColor
): SharedAnnotation {
  if (mode === "rect") {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    return {
      id,
      kind: "rect",
      color,
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
    color,
    name: identity.name,
    points: points.length > 1 ? points : [start, end]
  };
}

function parsePresenceMessage(data: unknown): PresenceMessage | null {
  if (typeof data !== "string") return null;
  try {
    const message = JSON.parse(data) as PresenceMessage;
    if (message.type === "roster" && Array.isArray(message.viewers)) {
      return {
        type: "roster",
        viewers: message.viewers.filter(isViewerPresence)
      };
    }
    if (
      message.type === "hello" &&
      typeof message.clientId === "string" &&
      typeof message.name === "string" &&
      typeof message.color === "string"
    ) {
      return message;
    }
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

function isViewerPresence(value: unknown): value is ViewerPresence {
  if (!value || typeof value !== "object") return false;
  const viewer = value as Partial<ViewerPresence>;
  return (
    typeof viewer.clientId === "string" &&
    typeof viewer.name === "string" &&
    typeof viewer.color === "string" &&
    Number.isFinite(viewer.seenAt)
  );
}

function identityToViewer(identity: ClientIdentity): ViewerPresence {
  return {
    clientId: identity.id,
    name: identity.name,
    color: identity.color,
    seenAt: Date.now()
  };
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

  const id = createClientId();
  const identity = {
    id,
    name: defaultViewerName(id),
    color: colorFromId(id)
  };
  saveClientIdentity(identity);
  return identity;
}

function readAnnotationColor(): AnnotationColor {
  const saved = window.localStorage.getItem("pura.annotationColor");
  return isAnnotationColor(saved) ? saved : "#ff5b57";
}

function saveAnnotationColor(color: AnnotationColor) {
  window.localStorage.setItem("pura.annotationColor", color);
}

function isAnnotationColor(value: unknown): value is AnnotationColor {
  return typeof value === "string" && ANNOTATION_COLORS.includes(value as AnnotationColor);
}

function saveClientIdentity(identity: ClientIdentity) {
  window.localStorage.setItem("pura.viewer", JSON.stringify(identity));
}

function createClientId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
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

function StatusDot({ device }: { device: AndroidDevice }) {
  const status = deviceStatusClass(device);
  return <span className={`dot ${status}`} title={device.controlOnline === false ? "control offline" : device.state} />;
}

function formatDeviceName(device: AndroidDevice) {
  const name = [device.manufacturer, device.model].filter(Boolean).join(" ");
  return name || device.serial;
}

function displayName(device: AndroidDevice) {
  return device.publication?.label || formatDeviceName(device);
}

function isDeviceControllable(device: AndroidDevice) {
  return device.state === "device" && device.controlOnline !== false;
}

function deviceStatusClass(device: AndroidDevice) {
  if (device.controlOnline === false) return "controlOffline";
  return device.state;
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

function readEmbeddedDocWidth() {
  return clamp(Number(window.localStorage.getItem("pura.embeddedDocWidth")) || 620, 360, 920);
}

function parseDeviceUiMessage(data: unknown) {
  try {
    const message = JSON.parse(String(data)) as {
      type?: string;
      state?: {
        embeddedDocUrl?: string | null;
        embeddedDocWidth?: number;
      };
    };
    if (message.type !== "state") return null;
    return {
      embeddedDocUrl: typeof message.state?.embeddedDocUrl === "string" ? message.state.embeddedDocUrl : null,
      embeddedDocWidth: message.state?.embeddedDocWidth ? clamp(Number(message.state.embeddedDocWidth), 360, 920) : undefined
    };
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

createRoot(document.getElementById("root")!).render(<App />);
