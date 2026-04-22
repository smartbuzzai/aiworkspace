// Pre-compile all pages by hitting the dev server once, then exit.
// This works around the `next build` worker spawn issue on Contabo VPS.
import { createServer } from "http";
import { parse } from "url";
import next from "next";

const app = next({ dev: true, hostname: "127.0.0.1", port: 3001 });
const handle = app.getRequestHandler();

async function build() {
  await app.prepare();

  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  await new Promise(resolve => server.listen(3001, resolve));
  console.log("Pre-compiling pages...");

  // Hit the main page to trigger compilation
  try {
    const r = await fetch("http://127.0.0.1:3001/");
    console.log(`/ → ${r.status}`);
  } catch (e) {
    console.log("/ compile:", e.message);
  }

  try {
    const r = await fetch("http://127.0.0.1:3001/auth/verify?token=test");
    console.log(`/auth/verify → ${r.status}`);
  } catch (e) {
    console.log("/auth/verify compile:", e.message);
  }

  console.log("Pre-compilation done");
  server.close();
  process.exit(0);
}

build().catch(err => {
  console.error("Build failed:", err);
  process.exit(1);
});
