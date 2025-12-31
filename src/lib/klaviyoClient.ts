// src/lib/klaviyoClient.ts
import { randomUUID } from "crypto";

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function sendKlaviyoEvent(params: {
  metricName: "Order Created" | "Order Modified";
  properties: Record<string, any>;
  profileEmail: string;         // make it required to avoid silent drops
  uniqueId?: string;            // helpful for deduplication
}) {
  const privateKey = requiredEnv("Klaviyo_Private_API_Key");

  const res = await fetch("https://a.klaviyo.com/api/events/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Klaviyo-API-Key ${privateKey}`,
      revision: "2025-10-15",
    },
    body: JSON.stringify({
      data: {
        type: "event",
        attributes: {
          properties: params.properties,
          unique_id: params.uniqueId ?? randomUUID(),

          // ✅ IMPORTANT: metric + profile belong under attributes (not relationships)
          metric: {
            data: {
              type: "metric",
              attributes: { name: params.metricName },
            },
          },
          profile: {
            data: {
              type: "profile",
              attributes: { email: params.profileEmail },
            },
          },
        },
      },
    }),
  });

  const json = await res.json().catch(() => ({}));
    // ✅ Debug logs (server terminal)
  console.log("[Klaviyo] status", res.status);
  console.log("[Klaviyo] body", json);
  if (!res.ok) {
    throw new Error(`Klaviyo error ${res.status}: ${JSON.stringify(json)}`);
  }

//   return json;

    // ✅ Return both status + body so caller can inspect
  return { status: res.status, body: json };
}
