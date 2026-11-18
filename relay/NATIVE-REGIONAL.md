# Experimental regional native-stream backend

The current PS4 measurements show 141–371 ms relay RTT. This backend is prepared
for placement near the console, without routing media through a Durable Object.
It reuses the existing BXNativeRoom authorization, framing, queue limits, session
expiry, reset barriers and socket-loss rules; `ws` is the existing pinned relay
dependency. It does not implement a direct LAN/WebRTC/UDP path.

Run the native backend separately from the older control-only relay:

- Node 24+, `npm install --prefix relay --ignore-scripts --no-package-lock`.
- Provide distinct 64-hex `BX_CONSOLE_KEY` and `BX_PLAYER_KEY` through private
  environment configuration, never source code, shell history or URLs.
- Set `BX_PUBLIC_ORIGIN` to the exact public player origin (HTTPS, no final slash).
- Run `node relay/native-stream-server.mjs`. Default bind: 127.0.0.1:8080.
- Place a trusted HTTPS/WSS reverse proxy in front, preserve Upgrade/subprotocols,
  disable response buffering, and allow only the configured public player Origin.
- Verify the actual host location and end-to-end PS4 RTT before switching traffic.

Opt-in Worker variable `BX_REGIONAL_ORIGIN` must be a canonical HTTPS backend
origin. It moves ALL five transport routes together; the player assets remain on
the existing site. Without it, the current Durable Object route is unchanged.
Never point it back to the same Worker. Do not activate a route before the backend
is healthy and configured with the matching private keys. Existing sessions must
reconnect after switching; the PS4 registration and saved player profile remain.

Local tests use synthetic keys and real HTTP/WebSocket sockets. They test
role separation, binary roundtrips, origin rejection, bounded HTTP requests and
console loss closing the player. These tests establish compatibility, not lower
PS4 latency. No regional host has been deployed or paid plan activated.

Cloudflare Containers access was denied for the connected account because it
requires Workers Paid. Regional constraints alone do not prove a shorter route:
forwarding through an overseas Durable Object would retain the unwanted detour.
This backend can run behind a suitable regional HTTPS endpoint; production
hosting, costs, TLS endpoint and routing still need to be selected and verified.
