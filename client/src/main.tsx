import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import JMuxer from "jmuxer";
import {
  Cable,
  Circle,
  FileText,
  MonitorPlay,
  MousePointer2,
  PencilLine,
  Power,
  Radio,
  RefreshCw,
  Send,
  Smartphone,
  Usb,
  UserRound
} from "lucide-react";
import { endSession, fetchDevices, publishDevice, startSession, tapDevice, unpublishDevice } from "./api";
import type { AndroidDevice, DevicesResponse, MirrorSession } from "./types";
import "./styles.css";

type PlayerStatus = "idle" | "connecting" | "live" | "error";

function App() {
  const [data, setData] = useState<DevicesResponse>({ devices: [], sessions: [] });
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);
  const [session, setSession] = useState<MirrorSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishForm, setPublishForm] = useState({ label: "", owner: "", note: "" });

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
      setError(nextError instanceof Error ? nextError.message : "Unable to refresh devices");
    }
  }, [selectedSerial]);

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

  const openSelectedDevice = async () => {
    if (!selectedSerial) return;
    setLoading(true);
    setError(null);
    try {
      const next = await startSession(selectedSerial);
      setSession(next);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to start session");
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

  const publishSelectedDevice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedDevice) return;

    setLoading(true);
    setError(null);
    try {
      await publishDevice(selectedDevice.serial, publishForm);
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to publish device");
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
      setError(nextError instanceof Error ? nextError.message : "Unable to unpublish device");
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
            <h1>Mirror Deck</h1>
            <p>LAN Android lab</p>
          </div>
        </div>

        <button className="refreshButton" onClick={() => void refresh()}>
          <RefreshCw size={16} />
          Refresh
        </button>

        <section className="deviceList" aria-label="Published Android devices">
          <div className="sectionLabel">
            <Radio size={14} />
            Published machines
          </div>
          {publishedDevices.length === 0 ? (
            <div className="emptyState">
              <MonitorPlay size={22} />
              <span>No machines published</span>
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

        <section className="deviceList compact" aria-label="Local USB devices">
          <div className="sectionLabel">
            <Usb size={14} />
            Devices to publish
          </div>
          {localDevices.length === 0 ? (
            <div className="emptyState small">
              <Usb size={18} />
              <span>All devices are published</span>
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
            <p className="eyebrow">USB host viewer</p>
            <h2>{selectedDevice ? displayName(selectedDevice) : "Waiting for device"}</h2>
          </div>
          <div className="actions">
            <button className="secondary" onClick={() => void stopCurrentSession()} disabled={!session}>
              <Power size={16} />
              Stop
            </button>
            <button className="primary" onClick={() => void openSelectedDevice()} disabled={!selectedSerial || loading}>
              <MonitorPlay size={17} />
              {loading ? "Starting" : session ? "Restart view" : "Open view"}
            </button>
          </div>
        </header>

        <div className="metaStrip">
          <InfoPill icon={<Cable size={15} />} label={selectedDevice?.transport.toUpperCase() ?? "USB"} />
          <InfoPill
            icon={<Smartphone size={15} />}
            label={selectedDevice?.size ? `${selectedDevice.size.width}x${selectedDevice.size.height}` : "Unknown size"}
          />
          <InfoPill icon={<Circle size={13} />} label={selectedDevice?.state ?? "offline"} />
          <InfoPill icon={<MousePointer2 size={15} />} label="Click to tap" />
          {selectedDevice?.agentName ? <InfoPill icon={<Radio size={15} />} label={selectedDevice.agentName} /> : null}
          {selectedDevice?.publication?.owner ? <InfoPill icon={<UserRound size={15} />} label={selectedDevice.publication.owner} /> : null}
        </div>

        {error ? <div className="errorBanner">{error}</div> : null}

        {selectedDevice ? (
          <form className="publishPanel" onSubmit={(event) => void publishSelectedDevice(event)}>
            <label>
              <span>
                <PencilLine size={14} />
                Device name
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
                Developer
              </span>
              <input
                value={publishForm.owner}
                onChange={(event) => setPublishForm((current) => ({ ...current, owner: event.target.value }))}
                placeholder="Owner"
              />
            </label>
            <label>
              <span>
                <FileText size={14} />
                Note
              </span>
              <input
                value={publishForm.note}
                onChange={(event) => setPublishForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Build, branch, scenario"
              />
            </label>
            <div className="publishActions">
              <button className="secondary" type="button" onClick={() => void unpublishSelectedDevice()} disabled={loading || !selectedDevice.publication?.published}>
                Unpublish
              </button>
              <button className="primary" type="submit" disabled={loading || selectedDevice.state !== "device"}>
                <Send size={16} />
                {selectedDevice.publication?.published ? "Update info" : "Publish"}
              </button>
            </div>
          </form>
        ) : null}

        <MirrorPlayer device={selectedDevice} session={session} />
      </section>
    </main>
  );
}

function MirrorPlayer({ device, session }: { device: AndroidDevice | null; session: MirrorSession | null }) {
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
    const ratios = getObjectFitRatios(event.currentTarget, event.clientX, event.clientY);
    if (!ratios) return;

    setTapPulse({ x: ratios.displayX, y: ratios.displayY, id: Date.now() });
    await tapDevice(device.serial, ratios.xRatio, ratios.yRatio).catch(() => setStatus("error"));
  };

  return (
    <section className="stage">
      <div className="screenFrame">
        <video ref={videoRef} className="screen" muted playsInline autoPlay onClick={(event) => void handleClick(event)} />
        {tapPulse ? <span className="tapPulse" key={tapPulse.id} style={{ left: tapPulse.x, top: tapPulse.y }} /> : null}
        <div className={`statusBadge ${status}`}>
          <span />
          {statusLabel(status)}
        </div>
        {!session ? (
          <div className="standby">
            <MonitorPlay size={34} />
            <strong>Select a device and open view</strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function getObjectFitRatios(video: HTMLVideoElement, clientX: number, clientY: number) {
  const rect = video.getBoundingClientRect();
  const videoWidth = video.videoWidth || rect.width;
  const videoHeight = video.videoHeight || rect.height;
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

function statusLabel(status: PlayerStatus) {
  if (status === "connecting") return "Connecting";
  if (status === "live") return "Live";
  if (status === "error") return "Stream error";
  return "Idle";
}

createRoot(document.getElementById("root")!).render(<App />);
