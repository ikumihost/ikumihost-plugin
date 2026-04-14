#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import { readFile, stat, writeFile, mkdir } from "fs/promises";
import { z } from "zod";
import https from "https";
import { lookup as mimeLookup } from "mime-types";

const VERSION = "1.0.0";
const API_KEY = process.env.AIHOST_API_KEY;

// --- Sync state ---
// Stores the mtime of each local file at the time it was last successfully uploaded.
// Persisted in CLAUDE_PLUGIN_DATA so it survives session restarts.

const SYNC_STATE_PATH = process.env.CLAUDE_PLUGIN_DATA
  ? `${process.env.CLAUDE_PLUGIN_DATA}/sync-state.json`
  : null;

let syncState = {};

async function loadSyncState() {
  if (!SYNC_STATE_PATH) return;
  try {
    const raw = await readFile(SYNC_STATE_PATH, "utf8");
    syncState = JSON.parse(raw);
  } catch {
    syncState = {};
  }
}

async function saveSyncState() {
  if (!SYNC_STATE_PATH) return;
  await mkdir(process.env.CLAUDE_PLUGIN_DATA, { recursive: true });
  await writeFile(SYNC_STATE_PATH, JSON.stringify(syncState, null, 2), "utf8");
}

async function isFileUnchanged(localPath) {
  const recorded = syncState[localPath];
  if (!recorded) return false;
  const { mtimeMs } = await stat(localPath);
  return mtimeMs === recorded;
}

async function recordUpload(localPath) {
  const { mtimeMs } = await stat(localPath);
  syncState[localPath] = mtimeMs;
  await saveSyncState();
}
const API_BASE = process.env.AIHOST_API_BASE ?? "https://zf3s8xhw89.execute-api.eu-west-3.amazonaws.com";

if (!API_KEY) {
  console.error("Error: AIHOST_API_KEY environment variable is not set.");
  process.exit(1);
}

// --- Credential management ---

let credentials = null;

async function apiPost(path, body = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function fetchCredentials() {
  const res = await apiPost("/v1/credentials");
  if (res.status === 401) throw new Error("Invalid API key.");
  if (res.status === 403) throw new Error(`Account access denied: ${res.body.error}`);
  if (res.status !== 200) throw new Error(`Credentials request failed: ${res.body.error}`);

  const creds = res.body;

  // Version check
  if (VERSION < creds.minVersion) {
    console.error(`This MCP server (v${VERSION}) is outdated. Please update to v${creds.minVersion} or later.`);
    process.exit(1);
  }

  credentials = {
    ...creds,
    expiresAt: new Date(creds.expiresAt)
  };
}

async function getCredentials() {
  const now = new Date();
  // Refresh if missing or expiring within 5 minutes
  if (!credentials || credentials.expiresAt - now < 5 * 60 * 1000) {
    await fetchCredentials();
  }
  return credentials;
}

function getS3Client(creds) {
  return new S3Client({
    region: creds.region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken
    }
  });
}

// --- Path sanitisation ---

function sanitizePath(inputPath) {
  // Remove leading slash, resolve traversal, prepend userCode
  const clean = inputPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = clean.split("/").filter(p => p && p !== ".");
  const safe = [];
  for (const part of parts) {
    if (part === "..") {
      safe.pop();
    } else {
      safe.push(part);
    }
  }
  if (safe.length === 0) throw new Error("Invalid path.");
  return safe.join("/");
}

function getS3Key(creds, path) {
  return `${creds.userCode}/${sanitizePath(path)}`;
}

function getCacheControl(path) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "html" || ext === "json") return "public, max-age=60";
  return "public, max-age=31536000";
}

// --- MCP server ---

const server = new McpServer({
  name: "ai-host-mcp",
  version: VERSION
});

/**
 * Upload a file to S3, skipping if the content is unchanged.
 * Skip detection: compute MD5 of the new content and compare against the
 * existing S3 ETag (which equals the MD5 for non-multipart uploads).
 * If they match, the upload is skipped to avoid unnecessary transfers.
 */
server.registerTool(
  "upload_file",
  {
    description: "Upload a file to your hosted website. Upload all files first, then call publish() once.",
    inputSchema: {
      path: z.string().describe("Relative file path e.g. index.html or assets/style.css"),
      content: z.string().describe("File content"),
      encoding: z.enum(["utf8", "base64"]).default("utf8").describe("Content encoding")
    }
  },
  async ({ path, content, encoding }) => {
    const creds = await getCredentials();
    const key = getS3Key(creds, path);

    const body = encoding === "base64"
      ? Buffer.from(content, "base64")
      : Buffer.from(content, "utf8");

    if (body.byteLength > 10 * 1024 * 1024) {
      return { content: [{ type: "text", text: "Error: file exceeds 10MB limit." }] };
    }

    const s3 = getS3Client(creds);

    // Check if the file already exists with the same content (ETag = MD5 for non-multipart uploads)
    const md5 = createHash("md5").update(body).digest("hex");
    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: creds.bucket, Key: key }));
      const existingEtag = (head.ETag ?? "").replace(/"/g, "");
      if (existingEtag === md5) {
        return { content: [{ type: "text", text: `Skipped: ${path} (unchanged)` }] };
      }
    } catch {
      // File doesn't exist yet — proceed with upload
    }

    const contentType = mimeLookup(path) || "application/octet-stream";

    await s3.send(new PutObjectCommand({
      Bucket: creds.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: getCacheControl(path)
    }));

    return { content: [{ type: "text", text: `Uploaded: ${path}` }] };
  }
);

/**
 * Upload a local file to S3 by path, without Claude needing to read or encode it.
 * The MCP server reads the file directly from the local filesystem — faster for
 * all file types, and avoids shell encoding commands for binary files.
 */
server.registerTool(
  "upload_local_file",
  {
    description: "Upload a local file directly to your hosted website by its path on disk. Use this for all files — faster than upload_file as the server reads the file directly without any encoding.",
    inputSchema: {
      local_path: z.string().describe("Absolute path to the local file e.g. /Users/user/mysite/images/photo.jpg"),
      remote_path: z.string().describe("Destination path on the website e.g. images/photo.jpg")
    }
  },
  async ({ local_path, remote_path }) => {
    // Fast path: skip if local mtime matches the recorded mtime from last upload
    if (await isFileUnchanged(local_path)) {
      return { content: [{ type: "text", text: `Skipped: ${remote_path} (unchanged)` }] };
    }

    const creds = await getCredentials();
    const key = getS3Key(creds, remote_path);
    const s3 = getS3Client(creds);

    const body = await readFile(local_path);

    if (body.byteLength > 10 * 1024 * 1024) {
      return { content: [{ type: "text", text: "Error: file exceeds 10MB limit." }] };
    }

    // Fallback: no local record — compare MD5 against S3 ETag to avoid re-uploading
    // unchanged files on first run or after sync state is cleared
    if (!syncState[local_path]) {
      const md5 = createHash("md5").update(body).digest("hex");
      try {
        const head = await s3.send(new HeadObjectCommand({ Bucket: creds.bucket, Key: key }));
        const existingEtag = (head.ETag ?? "").replace(/"/g, "");
        if (existingEtag === md5) {
          await recordUpload(local_path); // record mtime so future runs use the fast path
          return { content: [{ type: "text", text: `Skipped: ${remote_path} (unchanged)` }] };
        }
      } catch {
        // File doesn't exist on S3 yet — proceed with upload
      }
    }

    const contentType = mimeLookup(remote_path) || "application/octet-stream";

    await s3.send(new PutObjectCommand({
      Bucket: creds.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: getCacheControl(remote_path)
    }));

    await recordUpload(local_path);

    return { content: [{ type: "text", text: `Uploaded: ${remote_path}` }] };
  }
);

// list_files
server.registerTool(
  "list_files",
  {
    description: "List files on your hosted website.",
    inputSchema: {
      prefix: z.string().optional().describe("Optional folder prefix to filter results")
    }
  },
  async ({ prefix }) => {
    const creds = await getCredentials();
    const s3 = getS3Client(creds);
    const s3Prefix = prefix ? `${creds.userCode}/${sanitizePath(prefix)}/` : `${creds.userCode}/`;

    const res = await s3.send(new ListObjectsV2Command({
      Bucket: creds.bucket,
      Prefix: s3Prefix
    }));

    const files = (res.Contents ?? []).map(obj => {
      const path = obj.Key.slice(`${creds.userCode}/`.length);
      const size = obj.Size ?? 0;
      const kb = size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`;
      return `${path} (${kb})`;
    });

    return { content: [{ type: "text", text: files.length ? files.join("\n") : "No files found." }] };
  }
);

// get_file
server.registerTool(
  "get_file",
  {
    description: "Get the contents of a text file on your hosted website.",
    inputSchema: {
      path: z.string().describe("Relative file path e.g. index.html")
    }
  },
  async ({ path }) => {
    const creds = await getCredentials();
    const key = getS3Key(creds, path);
    const s3 = getS3Client(creds);

    const res = await s3.send(new GetObjectCommand({
      Bucket: creds.bucket,
      Key: key
    }));

    const text = await res.Body.transformToString("utf8");
    return { content: [{ type: "text", text }] };
  }
);

// delete_file
server.registerTool(
  "delete_file",
  {
    description: "Delete a file from your hosted website and invalidate it from the CDN.",
    inputSchema: {
      path: z.string().describe("Relative file path e.g. old-page.html")
    }
  },
  async ({ path }) => {
    const creds = await getCredentials();
    const key = getS3Key(creds, path);
    const s3 = getS3Client(creds);

    await s3.send(new DeleteObjectCommand({
      Bucket: creds.bucket,
      Key: key
    }));

    await apiPost("/v1/invalidation", { path: `/${sanitizePath(path)}` });

    return { content: [{ type: "text", text: `Deleted: ${path}` }] };
  }
);

// publish
server.registerTool(
  "publish",
  {
    description: "Publish your website by invalidating the CDN cache. Call this once after all files are uploaded."
  },
  async () => {
    await apiPost("/v1/invalidation");
    return { content: [{ type: "text", text: "Published. Your website is live." }] };
  }
);

// --- Start ---

await loadSyncState();
await fetchCredentials();

const transport = new StdioServerTransport();
await server.connect(transport);
