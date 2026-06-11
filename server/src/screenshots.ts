import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type express from "express";

const dataDir = path.resolve(process.env.DATA_DIR ?? "data");
const screenshotsDir = path.join(dataDir, "screenshots");
const screenshotsIndexPath = path.join(screenshotsDir, "index.json");

export type SavedScreenshot = {
  id: string;
  deviceSerial: string;
  fileName: string;
  url: string;
  downloadUrl: string;
  createdAt: string;
  sizeBytes: number;
};

type ScreenshotIndex = {
  screenshots: SavedScreenshot[];
};

export function installScreenshotRoutes(app: express.Express) {
  app.get("/api/screenshots/:fileName", (req, res) => {
    const safeName = path.basename(req.params.fileName);
    const filePath = path.join(screenshotsDir, safeName);

    if (!safeName.endsWith(".png") || !fs.existsSync(filePath)) {
      res.status(404).json({ error: "Screenshot not found" });
      return;
    }

    if (req.query.download === "1") {
      res.download(filePath, safeName);
      return;
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=86400");
    fs.createReadStream(filePath).pipe(res);
  });
}

export function listDeviceScreenshots(deviceSerial: string): SavedScreenshot[] {
  return readIndex().screenshots.filter((screenshot) => screenshot.deviceSerial === deviceSerial).slice(0, 24);
}

export function getScreenshot(screenshotId: string, deviceSerial?: string): SavedScreenshot | undefined {
  return readIndex().screenshots.find(
    (screenshot) => screenshot.id === screenshotId && (!deviceSerial || screenshot.deviceSerial === deviceSerial)
  );
}

export function getScreenshotPath(screenshot: SavedScreenshot): string {
  return path.join(screenshotsDir, path.basename(screenshot.fileName));
}

export async function saveScreenshot(image: Buffer, deviceSerial: string): Promise<SavedScreenshot> {
  await fs.promises.mkdir(screenshotsDir, { recursive: true });
  const createdAt = new Date().toISOString();
  const safeLabel = deviceSerial.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 48) || "device";
  const id = randomUUID();
  const fileName = `${createdAt.replace(/[:.]/g, "-")}-${safeLabel}-${id.slice(0, 8)}.png`;
  const filePath = path.join(screenshotsDir, fileName);

  await fs.promises.writeFile(filePath, image);

  const screenshot = {
    id,
    deviceSerial,
    fileName,
    url: `/api/screenshots/${encodeURIComponent(fileName)}`,
    downloadUrl: `/api/screenshots/${encodeURIComponent(fileName)}?download=1`,
    createdAt,
    sizeBytes: image.length
  };

  const index = readIndex();
  index.screenshots = [screenshot, ...index.screenshots.filter((item) => item.id !== id)].slice(0, 500);
  await fs.promises.writeFile(screenshotsIndexPath, `${JSON.stringify(index, null, 2)}\n`);

  return screenshot;
}

function readIndex(): ScreenshotIndex {
  try {
    const parsed = JSON.parse(fs.readFileSync(screenshotsIndexPath, "utf8")) as ScreenshotIndex;
    return {
      screenshots: Array.isArray(parsed.screenshots) ? parsed.screenshots : []
    };
  } catch {
    return { screenshots: [] };
  }
}
