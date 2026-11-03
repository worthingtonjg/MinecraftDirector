# MinecraftDirector

Experimental Node.js tools for directing a local Minecraft Java server through bounded commands. Includes a stdio MCP bridge, local mailbox transport, autosaving, inventory-based quests, persistent reward receipts, and the Hollow Harvest adventure prototype.

## Run the offline checks

Use Node.js 22 or newer. There are no npm dependencies to install.

```sh
npm test
npm start
```

`npm test` runs both test directories using synthetic players and mocked game operations. `npm start` starts the bridge in dry mode over stdio: it does not launch Java or modify a world. Tests cover command validation, save scheduling, inventory parsing, reward idempotence, multiplayer progression, maps, story events and recovery behavior.

## Local setup

This is a source-only prototype, not a bundled Minecraft server or a one-command installer. World saves, player data, backups, server distributions, Java runtimes, logs, credentials, machine settings and local session history are excluded from Git. Keep separate backups of those local files; cloning this repository does not restore them.

1. Obtain a compatible Minecraft Java server and Java runtime from their official distributors. The existing adapters target Minecraft 26.3 and Java 25 on Windows; other versions have not been validated.
2. Copy `examples/settings.example.json` to `settings.local.json` and review the player names and bind address. Defaults are synthetic players and loopback. Preserve the objective/marker identifiers when reconnecting to an existing world.
3. For the basic bridge, put the Java runtime under `runtime25/jdk-25*/bin/java.exe` and the server jar under `server-26.3/server.jar`. Configure a dedicated `director-fresh-world`. Start from the example server properties; never reuse an unrelated world.
4. Review the Minecraft EULA yourself before creating an accepted `eula.txt`. Copy and explicitly review the approval example as `approval.local.json`; its default values do not authorize live actions.
5. Only after local setup and explicit approval, `node bridge.mjs --live` starts the server via stdio. `Start-Director.ps1` starts the persistent local mailbox host; `node client.mjs` connects a stdio client to that host. Do not start both hosts simultaneously.

`examples/codex-config.example.toml` is a disabled project-local MCP example. Replace its placeholder path and review the enabled tools before use. No global client configuration or firewall changes are installed by this project. Network exposure requires separate configuration and approval; online authentication remains enabled and RCON/query remain disabled.

## Hollow Harvest

`hollow-harvest/` contains the additional story, progression, map and encounter logic with its own tests. Its live host requires reviewed world-specific plans and activation records that are deliberately not published. See its README. Automated checks use mocks; they do not establish that a fresh live server installation is ready.

## Publication boundaries

The root `.gitignore` defaults to excluding everything except reviewed source, tests and examples. Add new public files deliberately. Private original files from publication preparation remain local under `private-originals/`; they are not part of this repository. No live server was started for publication validation.

No license has been selected for this repository. Public visibility does not imply an open-source license. Minecraft and Java distributions are not included.
