// Tiny static server + PNG sink for the offline asset render page.
//   node tools/render/server.mjs   then open http://localhost:3300/tools/render/render.html
// Loopback-only. Serves an allowlist of files read-only and accepts POST /save/<name>.png (raw PNG bytes) into tools/render/out/.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const out = path.join(here, "out");
fs.mkdirSync(out, { recursive: true });

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".wasm": "application/wasm", ".glb": "model/gltf-binary", ".webp": "image/webp", ".png": "image/png" };

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.method === "POST" && url.pathname.startsWith("/save/")) {
      const name = path.basename(url.pathname);
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        fs.writeFileSync(path.join(out, name), Buffer.concat(chunks));
        res.end("saved " + name);
      });
      return;
    }
    const file = path.join(root, decodeURIComponent(url.pathname));
    // Allowlist: only the render page, its three.js copy, and the two GLB inputs are served.
    const allowed =
      file.startsWith(path.join(root, "tools", "render") + path.sep) && !file.startsWith(out + path.sep) ||
      file === path.join(root, "public", "models", "astronaut.glb") ||
      file === path.join(root, "assets", "source", "human-skeleton.glb");
    if (!allowed || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.statusCode = 404;
      return res.end("not found");
    }
    res.setHeader("Content-Type", TYPES[path.extname(file)] ?? "application/octet-stream");
    fs.createReadStream(file).pipe(res);
  })
  .listen(3300, "127.0.0.1", () => console.log("render server on http://127.0.0.1:3300 (loopback only)"));
