export default {
  fetch(request: Request): Response {
    if (request.method === "GET" && new URL(request.url).pathname === "/api/health") {
      return Response.json({ ok: true });
    }

    return new Response(null, { status: 404 });
  },
};
