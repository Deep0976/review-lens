// Forwards Review Lens requests to the Cloudflare Worker for networks that block workers.dev.
// Replaces the Netlify proxy, which gives up after ~26 s (a 300-review analysis can take longer).
export const config = { maxDuration: 60 };

const WORKER = "https://review-lens.deep0976.workers.dev";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" };

async function forward(request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path") || ""; // set by the rewrite in vercel.json
  url.searchParams.delete("path");
  const target = `${WORKER}/${path}${url.search}`;
  const r = await fetch(target, {
    method: request.method,
    headers: { "content-type": request.headers.get("content-type") || "application/json" },
    body: request.method === "POST" ? await request.text() : undefined,
  });
  return new Response(await r.text(), { status: r.status, headers: { ...CORS, "content-type": r.headers.get("content-type") || "application/json" } });
}

export const GET = forward;
export const POST = forward;
export const OPTIONS = () => new Response(null, { headers: CORS });
