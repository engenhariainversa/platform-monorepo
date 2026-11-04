# Websockets in production (live presentations)

Live sessions (EI-3b) use GraphQL subscriptions over a websocket on the backend's
existing `/graphql` endpoint. These are **manual steps on the production server**, done
once, **before** deploying the first version that contains EI-3b. Design:
`docs/superpowers/specs/2026-10-01-ei-3b-presentations-live-design.md`.

## 1. nginx

In the `http` block (once per server):

```nginx
map $http_upgrade $connection_upgrade { default upgrade; '' close; }
```

In the `location` that proxies the backend's `/graphql` (API hostname):

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```

Then `nginx -t && nginx -s reload` (or the container equivalent).

`CF-Connecting-IP` matters: the backend caps each IP at 10 concurrent sockets. Without
the header every visitor appears to come from the proxy's address and the 11th viewer is
refused (close code `4429`).

## 2. Cloudflare

Zone → **Network → WebSockets**: enabled. The Tunnel forwards the upgrade; no ingress
change is needed when the API hostname already points at nginx.

## 3. Backend environment

- `CORS_ORIGINS` (set in `docker-compose.yml`) must list the landing and CMS origins:
  the socket's `Origin` is checked against it.
- `LANDING_URL` (set in `docker-compose.yml`) is the base of presenter link URLs.

Neither is a secret; no GitHub secret changes.

## 4. Reserved slug

`/apresentacoes/controle` is the presenter link page. Before the first deploy, make sure
no presentation created under EI-3a uses that slug:

```bash
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT id, title FROM presentations WHERE slug = 'controle';"
```

Rename it in the CMS if a row comes back (new presentations can no longer take it).

## 5. Verify from outside, after deploying

```bash
npx wscat -c wss://<api-host>/graphql -s graphql-transport-ws
> {"type":"connection_init"}
< {"type":"connection_ack"}
```

A `connection_ack` proves nginx, Cloudflare and the backend agree. Then leave the socket
idle for 3 minutes: it must stay open (the server pings every 12 s, under Cloudflare's
~100 s idle timeout).

## Limits to keep in mind

- **One backend instance.** Sessions, viewers and reactions live in memory. A restart
  drops them; the presenter's player re-creates the session within a few seconds.
  Scaling out needs a Redis PubSub and the session map moved out of process.
- Every viewer of a public presentation holds a socket while the page is open, live or
  not. The per-IP cap and the keepalive bound it; revisit if traffic grows.
