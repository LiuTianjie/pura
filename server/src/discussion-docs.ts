import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { SavedScreenshot } from "./screenshots.js";

const dataDir = path.resolve(process.env.DATA_DIR ?? "data");
const discussionDocStorePath = path.join(dataDir, "discussion-docs.json");
const openApiBaseUrl = process.env.LARK_OPEN_BASE_URL?.replace(/\/$/, "") ?? "https://open.feishu.cn";
const defaultDocBaseUrl = process.env.LARK_DOC_BASE_URL?.replace(/\/$/, "") ?? "https://www.feishu.cn";

export type DiscussionDocBinding = {
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
  doc?: DiscussionDocBinding;
};

type DiscussionDocStore = {
  docs: Record<string, DiscussionDocBinding>;
};

type DeviceDocInput = {
  deviceId: string;
  deviceName: string;
  owner?: string;
  folderToken?: string;
};

type LarkDocumentResponse = {
  document?: {
    document_id?: string;
    title?: string;
  };
};

type LarkBlock = {
  block_type: number;
  text?: {
    elements: Array<{
      text_run: {
        content: string;
      };
    }>;
  };
  image?: Record<string, never>;
  divider?: Record<string, never>;
};

type LarkCreateBlocksResponse = {
  children?: Array<{
    block_id?: string;
    block_type?: number;
  }>;
};

type LarkMediaUploadResponse = {
  file_token?: string;
};

type LarkWikiNodeResponse = {
  node?: {
    obj_token?: string;
    obj_type?: string;
    title?: string;
  };
};

let tokenCache: { token: string; expiresAt: number } | null = null;

export function getDiscussionDocStatus(deviceId: string): DiscussionDocStatus {
  const status = getLarkConfigStatus();
  return {
    ...status,
    doc: readStore().docs[deviceId]
  };
}

export async function bindDiscussionDoc(deviceId: string, input: { url: string; title?: string }): Promise<DiscussionDocBinding> {
  assertLarkEnabled();
  const parsed = await resolveLarkDocumentRef(input.url);
  const now = new Date().toISOString();
  const store = readStore();
  const existing = store.docs[deviceId];
  const doc: DiscussionDocBinding = {
    deviceId,
    documentId: parsed.documentId,
    url: parsed.url,
    title: input.title?.trim() || parsed.title || existing?.title || `飞书讨论文档 ${parsed.documentId.slice(0, 6)}`,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastInsertedAt: existing?.lastInsertedAt,
    lastStatus: "已绑定飞书文档"
  };

  store.docs[deviceId] = doc;
  await writeStore(store);
  return doc;
}

export async function createDiscussionDoc(input: DeviceDocInput): Promise<DiscussionDocBinding> {
  assertLarkConfigured();

  const now = new Date();
  const date = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  const title = `${input.deviceName} 讨论文档 - ${input.owner || "未指定"} - ${date}`;
  const folderToken = input.folderToken ?? process.env.LARK_DOC_FOLDER_TOKEN ?? "";
  const body = await larkJson<LarkDocumentResponse>(`/open-apis/docx/v1/documents?folder_token=${encodeURIComponent(folderToken)}`, {
    method: "POST",
    body: JSON.stringify({
      title
    })
  });

  const documentId = body.document?.document_id;
  if (!documentId) {
    throw new Error("飞书未返回文档 ID");
  }

  const doc: DiscussionDocBinding = {
    deviceId: input.deviceId,
    documentId,
    url: `${defaultDocBaseUrl}/docx/${documentId}`,
    title: body.document?.title || title,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    lastStatus: "已新建飞书文档"
  };

  const store = readStore();
  store.docs[input.deviceId] = doc;
  await writeStore(store);
  return doc;
}

export async function insertScreenshotIntoDiscussionDoc(input: {
  deviceId: string;
  deviceName: string;
  screenshot: SavedScreenshot;
  screenshotPath: string;
  note?: string;
}): Promise<DiscussionDocBinding> {
  assertLarkConfigured();

  const store = readStore();
  const doc = store.docs[input.deviceId];
  if (!doc) {
    throw new Error("请先绑定或新建飞书讨论文档");
  }
  if (!fs.existsSync(input.screenshotPath)) {
    throw new Error("截图文件不存在，请重新截屏后再插入");
  }

  const insertedAt = new Date().toISOString();
  const lines = [
    `Pura 截图 ${new Date(insertedAt).toLocaleString("zh-CN", { hour12: false })}`,
    `设备：${input.deviceName}`
  ];
  if (input.note?.trim()) {
    lines.push(`备注：${input.note.trim()}`);
  }

  const created = await appendBlocks(doc.documentId, [
    textBlock(lines.join("\n")),
    { block_type: 27, image: {} },
    { block_type: 22, divider: {} }
  ]);
  const imageBlock = created.children?.find((child) => child.block_type === 27 && child.block_id);
  if (!imageBlock?.block_id) {
    throw new Error("飞书图片块创建失败");
  }

  const fileToken = await uploadImageToBlock(doc.documentId, imageBlock.block_id, input.screenshotPath, input.screenshot.fileName);
  await bindImageTokenToBlock(doc.documentId, imageBlock.block_id, fileToken);

  const nextDoc: DiscussionDocBinding = {
    ...doc,
    updatedAt: insertedAt,
    lastInsertedAt: insertedAt,
    lastStatus: "截图已插入飞书文档"
  };
  store.docs[input.deviceId] = nextDoc;
  await writeStore(store);
  return nextDoc;
}

function getLarkConfigStatus() {
  const enabled = process.env.PURA_FEATURE_LARK_DOCS === "true";
  const required = ["LARK_APP_ID", "LARK_APP_SECRET"];
  const missing = enabled ? required.filter((key) => !process.env[key]) : [];
  return {
    enabled,
    configured: missing.length === 0,
    missing,
    defaultFolderToken: process.env.LARK_DOC_FOLDER_TOKEN
  };
}

function assertLarkConfigured() {
  const status = getLarkConfigStatus();
  assertLarkEnabled();
  if (!status.configured) {
    throw new Error(`未配置飞书文档：缺少 ${status.missing.join(", ")}`);
  }
}

function assertLarkEnabled() {
  if (!getLarkConfigStatus().enabled) {
    throw new Error("飞书讨论文档功能未启用");
  }
}

async function resolveLarkDocumentRef(rawUrl: string) {
  const parsed = parseLarkDocumentUrl(rawUrl);
  if (parsed.kind !== "wiki") return parsed;

  assertLarkConfigured();
  const body = await larkJson<LarkWikiNodeResponse>(
    `/open-apis/wiki/v2/spaces/get_node?token=${encodeURIComponent(parsed.documentId)}`,
    {
      method: "GET"
    }
  );
  const objType = body.node?.obj_type?.toLowerCase();
  const objToken = body.node?.obj_token;

  if (!objToken) {
    throw new Error("飞书 Wiki 链接未解析到真实文档，请确认应用有该知识库节点权限");
  }
  if (objType !== "docx") {
    throw new Error(`当前只支持绑定 Wiki 中的 Docx 文档，这个节点类型是 ${body.node?.obj_type ?? "未知"}`);
  }

  return {
    ...parsed,
    documentId: objToken,
    title: body.node?.title
  };
}

function parseLarkDocumentUrl(rawUrl: string) {
  const value = rawUrl.trim();
  if (!value) {
    throw new Error("请粘贴飞书文档链接");
  }

  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/(docx|docs|wiki)\/([^/?#]+)/);
    if (!match?.[1] || !match[2]) {
      throw new Error("请粘贴飞书 Docx 或 Wiki 文档链接");
    }
    return {
      kind: match[1],
      documentId: match[2],
      url: url.toString(),
      title: undefined
    };
  } catch (error) {
    if (/^[a-zA-Z0-9_-]{8,}$/.test(value)) {
      return {
        kind: "docx",
        documentId: value,
        url: `${defaultDocBaseUrl}/docx/${value}`,
        title: undefined
      };
    }
    if (error instanceof Error && error.message !== "Invalid URL") {
      throw error;
    }
    throw new Error("飞书文档链接格式不正确，请粘贴 /docx/ 或 /wiki/ 链接");
  }
}

function textBlock(content: string): LarkBlock {
  return {
    block_type: 2,
    text: {
      elements: [
        {
          text_run: {
            content
          }
        }
      ]
    }
  };
}

async function appendBlocks(documentId: string, children: LarkBlock[]) {
  return larkJson<LarkCreateBlocksResponse>(
    `/open-apis/docx/v1/documents/${encodeURIComponent(documentId)}/blocks/${encodeURIComponent(documentId)}/children?document_revision_id=-1`,
    {
      method: "POST",
      body: JSON.stringify({
        index: -1,
        children
      })
    }
  );
}

async function uploadImageToBlock(_documentId: string, blockId: string, filePath: string, fileName: string) {
  const token = await getTenantAccessToken();
  const image = await fs.promises.readFile(filePath);
  const safeFileName = path.basename(fileName) || "pura-screenshot.png";
  const { body, boundary } = buildMultipartBody([
    { name: "file_name", value: safeFileName },
    { name: "parent_type", value: "docx_image" },
    { name: "parent_node", value: blockId },
    { name: "size", value: String(image.length) },
    {
      name: "file",
      value: image,
      fileName: safeFileName,
      contentType: "image/png"
    }
  ]);

  const response = await fetch(`${openApiBaseUrl}/open-apis/drive/v1/medias/upload_all`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(body.length)
    },
    body
  });

  const result = (await response.json().catch(() => undefined)) as
    | { code?: number; msg?: string; data?: LarkMediaUploadResponse }
    | undefined;
  if (!response.ok || result?.code !== 0) {
    throw new Error(`飞书图片上传失败：${result?.msg ?? response.statusText}`);
  }
  if (!result.data?.file_token) {
    throw new Error("飞书图片上传失败：未返回 file_token");
  }
  return result.data.file_token;
}

async function bindImageTokenToBlock(documentId: string, blockId: string, fileToken: string) {
  await larkJson<Record<string, unknown>>(
    `/open-apis/docx/v1/documents/${encodeURIComponent(documentId)}/blocks/batch_update`,
    {
      method: "PATCH",
      body: JSON.stringify({
        requests: [
          {
            block_id: blockId,
            replace_image: {
              token: fileToken
            }
          }
        ]
      })
    }
  );
}

function buildMultipartBody(
  parts: Array<
    | {
        name: string;
        value: string;
      }
    | {
        name: string;
        value: Buffer;
        fileName: string;
        contentType: string;
      }
  >
) {
  const boundary = `pura-${randomUUID()}`;
  const chunks: Buffer[] = [];

  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if ("fileName" in part) {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"; filename="${escapeMultipartValue(part.fileName)}"\r\n` +
            `Content-Type: ${part.contentType}\r\n\r\n`
        )
      );
      chunks.push(part.value);
      chunks.push(Buffer.from("\r\n"));
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n`));
      chunks.push(Buffer.from(`${part.value}\r\n`));
    }
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    boundary,
    body: Buffer.concat(chunks)
  };
}

function escapeMultipartValue(value: string) {
  return value.replace(/["\r\n]/g, "_");
}

async function larkJson<T>(pathName: string, init: RequestInit): Promise<T> {
  const token = await getTenantAccessToken();
  const response = await fetch(`${openApiBaseUrl}${pathName}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
      ...init.headers
    }
  });
  const body = (await response.json().catch(() => undefined)) as { code?: number; msg?: string; data?: T } | undefined;
  if (!response.ok || body?.code !== 0 || !body.data) {
    throw new Error(`飞书接口失败：${body?.msg ?? response.statusText}`);
  }
  return body.data;
}

async function getTenantAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  const response = await fetch(`${openApiBaseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      app_id: process.env.LARK_APP_ID,
      app_secret: process.env.LARK_APP_SECRET
    })
  });
  const body = (await response.json().catch(() => undefined)) as
    | { code?: number; msg?: string; tenant_access_token?: string; expire?: number }
    | undefined;

  if (!response.ok || body?.code !== 0 || !body.tenant_access_token) {
    throw new Error(`飞书授权失败：${body?.msg ?? response.statusText}`);
  }

  tokenCache = {
    token: body.tenant_access_token,
    expiresAt: Date.now() + Math.max(60, (body.expire ?? 7200) - 120) * 1000
  };
  return tokenCache.token;
}

function readStore(): DiscussionDocStore {
  try {
    const parsed = JSON.parse(fs.readFileSync(discussionDocStorePath, "utf8")) as DiscussionDocStore;
    return {
      docs: parsed.docs && typeof parsed.docs === "object" ? parsed.docs : {}
    };
  } catch {
    return { docs: {} };
  }
}

async function writeStore(store: DiscussionDocStore) {
  await fs.promises.mkdir(dataDir, { recursive: true });
  await fs.promises.writeFile(discussionDocStorePath, `${JSON.stringify(store, null, 2)}\n`);
}
