import * as functions from "firebase-functions";
import fetch from "node-fetch";

const CLOUD_RUN_BASE_URL =
  "https://metryxone-server-655115016379.asia-south1.run.app";

export const api = functions.https.onRequest(async (req, res) => {
  const targetUrl = `${CLOUD_RUN_BASE_URL}${req.path}${
    req.url.includes("?") ? "?" + req.url.split("?")[1] : ""
  }`;

  const forwardHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.toLowerCase() === "host") continue;
    if (Array.isArray(value)) {
      forwardHeaders[key] = value.join(", ");
    } else if (value !== undefined) {
      forwardHeaders[key] = value;
    }
  }

  const hasBody =
    req.method !== "GET" && req.method !== "HEAD";

  let body: Buffer | undefined;
  if (hasBody && req.rawBody) {
    body = req.rawBody;
  }

  const upstreamResponse = await fetch(targetUrl, {
    method: req.method,
    headers: forwardHeaders,
    body: body,
  });

  res.status(upstreamResponse.status);

  const rawHeaders = upstreamResponse.headers.raw();
  for (const [key, values] of Object.entries(rawHeaders)) {
    if (key.toLowerCase() === "transfer-encoding") continue;
    res.setHeader(key, values.length === 1 ? values[0] : values);
  }

  const responseBody = await upstreamResponse.buffer();
  res.send(responseBody);
});
