// Local dev server: serves public/index.html and calls the functions in api/
// the same way Vercel does. Run: npm run dev → http://localhost:3000
// Not used on Vercel.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const PORT = Number(process.env.PORT) || 3000;
const ROUTES = new Set(["auth", "analyze", "daily"]);

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      const html = await readFile(new URL("./public/index.html", import.meta.url));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(html);
    }

    const name = url.pathname.match(/^\/api\/([a-z]+)$/)?.[1];
    if (name && ROUTES.has(name)) {
      const mod = await import(`./api/${name}.js`);
      const handler = mod[req.method];
      if (!handler) {
        res.writeHead(405);
        return res.end();
      }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const request = new Request(url, {
        method: req.method,
        headers: req.headers,
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      return res.end(Buffer.from(await response.arrayBuffer()));
    }

    res.writeHead(404);
    res.end("Not found");
  } catch (error) {
    console.error(error);
    res.writeHead(500);
    res.end("Server error");
  }
}).listen(PORT, () => console.log(`Vacancy Decoder: http://localhost:${PORT}`));
