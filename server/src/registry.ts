import fs from "node:fs";
import path from "node:path";

export type DevicePublication = {
  serial: string;
  label: string;
  owner?: string;
  note?: string;
  published: boolean;
  updatedAt: string;
};

type RegistryFile = {
  publications: Record<string, DevicePublication>;
};

const dataDir = path.resolve(process.env.DATA_DIR ?? "data");
const registryPath = path.join(dataDir, "devices.json");

export function getPublication(serial: string) {
  return readRegistry().publications[serial];
}

export function getPublications() {
  return readRegistry().publications;
}

export function publishDevice(serial: string, input: { label?: string; owner?: string; note?: string }) {
  const registry = readRegistry();
  const current = registry.publications[serial];
  const label = clean(input.label) || current?.label || serial;

  const publication: DevicePublication = {
    serial,
    label,
    owner: clean(input.owner) || undefined,
    note: clean(input.note) || undefined,
    published: true,
    updatedAt: new Date().toISOString()
  };

  registry.publications[serial] = publication;
  writeRegistry(registry);

  return publication;
}

export function unpublishDevice(serial: string) {
  const registry = readRegistry();
  const current = registry.publications[serial];

  if (!current) return undefined;

  const publication: DevicePublication = {
    ...current,
    published: false,
    updatedAt: new Date().toISOString()
  };

  registry.publications[serial] = publication;
  writeRegistry(registry);

  return publication;
}

function readRegistry(): RegistryFile {
  try {
    const text = fs.readFileSync(registryPath, "utf8");
    const parsed = JSON.parse(text) as RegistryFile;
    return {
      publications: parsed.publications ?? {}
    };
  } catch {
    return { publications: {} };
  }
}

function writeRegistry(registry: RegistryFile) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
}

function clean(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 120);
}
