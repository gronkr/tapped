export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });
export const fail = (status, error, extra = {}) => json({ error, ...extra }, status, { "cache-control": "no-store" });
