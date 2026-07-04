const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT) || 3000;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const filePath = path.resolve(root, `.${decodeURIComponent(pathname)}`);
    const relativePath = path.relative(root, filePath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    const content = await fs.readFile(filePath);
    const contentType = mimeTypes[path.extname(filePath)] || "application/octet-stream";

    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": contentType,
    });
    response.end(content);
  } catch (error) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`YouTube Sync Player: http://127.0.0.1:${port}`);
});
