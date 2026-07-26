import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(projectRoot, "deploy-site");
const distRoot = path.join(projectRoot, "dist");
const clientRoot = path.join(distRoot, "client");
const serverRoot = path.join(distRoot, "server");

await rm(distRoot, { recursive: true, force: true });
await mkdir(clientRoot, { recursive: true });
await mkdir(serverRoot, { recursive: true });

await cp(sourceRoot, clientRoot, {
  recursive: true,
  filter(source) {
    const relative = path.relative(sourceRoot, source);
    return relative !== ".vercel" && !relative.startsWith(`.vercel${path.sep}`);
  },
});

const worker = `export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    const url = new URL(request.url);
    if (url.pathname.includes(".")) return response;

    url.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(url, request));
  },
};
`;

await writeFile(path.join(serverRoot, "index.js"), worker);
console.log("Sites production bundle built.");
