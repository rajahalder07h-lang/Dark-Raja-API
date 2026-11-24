export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Secret"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (!env.API_ORIGIN) {
      return Response.json({
        status: false,
        message: "API_ORIGIN is not configured"
      }, {
        status: 500,
        headers: corsHeaders
      });
    }

    const incomingUrl = new URL(request.url);
    const targetUrl =
      env.API_ORIGIN.replace(/\/$/, "") +
      incomingUrl.pathname +
      incomingUrl.search;

    const headers = new Headers(request.headers);
    headers.delete("host");

    if (env.API_SECRET) {
      headers.set("x-api-secret", env.API_SECRET);
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method)
        ? undefined
        : request.body
    });

    const newHeaders = new Headers(response.headers);

    for (const [key, value] of Object.entries(corsHeaders)) {
      newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders
    });
  }
};
