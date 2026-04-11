# Research: multiplayer feasibility

## Description

**Research only — no implementation.** The user asked whether 2+ player multiplayer is feasible for this project within the competition deadline (2026-04-13). A research agent should investigate and deliver a written recommendation.

## Scope of Research

- Netcode architecture options for React Three Fiber + Rapier WASM games:
  - Authoritative server vs peer-to-peer
  - Lockstep vs snapshot interpolation vs client-side prediction + rollback
- Browser transport options:
  - WebRTC data channels (low latency, p2p, NAT traversal cost)
  - WebSocket (simple, needs a host)
  - Cloudflare Durable Objects / Partykit (serverless authoritative, fits our Cloudflare Pages deploy target)
- State sync surface for our game:
  - Boats (position, velocity, rotation, health)
  - Projectiles (spawn events + deterministic trajectory, OR synced pool)
  - Waves (deterministic — shared seed + time means both clients already agree)
  - Enemy AI (server-authoritative only — cannot be p2p safely)
- Effort estimate: hours vs competition deadline
- Risk assessment: what could tank the main game if we pivot to multiplayer

## Deliverable

A markdown document at `docs/research/multiplayer-feasibility.md` with:

1. Recommendation (GO / NO-GO / GO-AFTER-COMP)
2. If GO: recommended architecture + transport + minimal scope for a working 2-player match
3. If NO-GO: reasoning and what would need to change
4. Effort estimate
5. Risk to the main single-player game

## Constraints

- Do NOT change any game code during this research
- Do NOT add libraries
- Use Context7 MCP for current docs on any netcode/transport library you recommend
- Single-player must remain the competition submission target unless recommendation is GO and the user approves
