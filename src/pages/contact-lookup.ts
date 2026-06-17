import type { APIRoute } from "astro";
import { getEnv } from "../lib/env";
import { normalizeEmail } from "../lib/config";
import { corsHeaders, isSameSite, json } from "../lib/http";
import { rateLimit, clientIp } from "../lib/ratelimit";
import { findByEmail } from "../lib/store";

export const prerender = false;

// GET /api/contact-lookup?email=someone@company.com
// Returns the single matching contact's autofill fields, or { match: false }.
// Never returns more than one record and never lists contacts.
export const GET: APIRoute = async ({ request, locals }) => {
  const env = getEnv(locals);
  const cors = corsHeaders(env, request.headers.get("Origin"));

  // 1) Only our own published site may call this.
  if (!isSameSite(env, request)) {
    return json({ error: "forbidden" }, { status: 403 }, cors);
  }

  // 2) Per-IP rate limit (blunts enumeration scraping).
  const rl = await rateLimit(env, `lookup:${clientIp(request)}`, {
    limit: 30,
    windowSeconds: 60,
  });
  if (!rl.ok) {
    return json({ error: "rate_limited" }, { status: 429 }, cors);
  }

  // 3) Exact, full-email match only — no partial / prefix matching.
  const email = normalizeEmail(new URL(request.url).searchParams.get("email"));
  if (!email || !email.includes("@")) {
    return json({ match: false }, { status: 200 }, cors);
  }

  const row = await findByEmail(env, email);
  if (!row) {
    return json({ match: false }, { status: 200 }, cors);
  }

  // 4) Return only the minimal autofill field set.
  return json(
    {
      match: true,
      contact: {
        firstName: row.firstName ?? "",
        lastName: row.lastName ?? "",
        organization: row.organization ?? "",
        city: row.city ?? "",
        phone: row.phone ?? "",
        role: row.role ?? "",
        region: row.region ?? "",
      },
    },
    { status: 200 },
    cors,
  );
};

export const OPTIONS: APIRoute = ({ request, locals }) => {
  const env = getEnv(locals);
  return new Response(null, {
    status: 204,
    headers: corsHeaders(env, request.headers.get("Origin")),
  });
};
