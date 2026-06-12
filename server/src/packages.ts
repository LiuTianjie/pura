import { randomUUID } from "node:crypto";
import express from "express";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.env.DATA_DIR ?? "data");
const packagesDir = path.join(dataDir, "packages");
const packageIndexPath = path.join(packagesDir, "index.json");

export type SavedPackage = {
  id: string;
  fileName: string;
  originalName: string;
  url: string;
  createdAt: string;
  sizeBytes: number;
};

type PackageIndex = {
  packages: SavedPackage[];
};

export function installPackageRoutes(app: express.Express) {
  app.get("/api/packages", (_req, res) => {
    res.json({ packages: listPackages() });
  });

  app.post(
    "/api/packages",
    express.raw({
      limit: process.env.PACKAGE_UPLOAD_LIMIT ?? "300mb",
      type: ["application/vnd.android.package-archive", "application/octet-stream"]
    }),
    async (req, res) => {
      try {
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          res.status(400).json({ error: "APK 文件为空" });
          return;
        }
        const originalName = sanitizePackageName(String(req.header("x-file-name") ?? "app.apk"));
        const pkg = await savePackage(req.body, originalName);
        res.json({ package: pkg });
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to save package" });
      }
    }
  );

  app.get("/api/packages/:id/download", (req, res) => {
    const pkg = getPackage(req.params.id);
    if (!pkg) {
      res.status(404).json({ error: "Package not found" });
      return;
    }
    res.download(getPackagePath(pkg), pkg.originalName);
  });
}

export function listPackages() {
  return readIndex().packages.slice(0, 20);
}

export function getPackage(id: string) {
  return readIndex().packages.find((pkg) => pkg.id === id);
}

export function getPackagePath(pkg: SavedPackage) {
  return path.join(packagesDir, path.basename(pkg.fileName));
}

async function savePackage(apk: Buffer, originalName: string): Promise<SavedPackage> {
  await fs.promises.mkdir(packagesDir, { recursive: true });
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const fileName = `${createdAt.replace(/[:.]/g, "-")}-${id.slice(0, 8)}-${originalName}`;
  await fs.promises.writeFile(path.join(packagesDir, fileName), apk);

  const pkg: SavedPackage = {
    id,
    fileName,
    originalName,
    url: `/api/packages/${encodeURIComponent(id)}/download`,
    createdAt,
    sizeBytes: apk.length
  };

  const index = readIndex();
  index.packages = [pkg, ...index.packages.filter((item) => item.id !== id)].slice(0, 50);
  await fs.promises.writeFile(packageIndexPath, `${JSON.stringify(index, null, 2)}\n`);
  return pkg;
}

function sanitizePackageName(name: string) {
  const base = path.basename(decodeURIComponent(name)).replace(/[^a-zA-Z0-9_.-]/g, "-");
  const normalized = base.toLowerCase().endsWith(".apk") ? base : `${base || "app"}.apk`;
  return normalized.slice(0, 96);
}

function readIndex(): PackageIndex {
  try {
    const parsed = JSON.parse(fs.readFileSync(packageIndexPath, "utf8")) as PackageIndex;
    return {
      packages: Array.isArray(parsed.packages) ? parsed.packages : []
    };
  } catch {
    return { packages: [] };
  }
}
