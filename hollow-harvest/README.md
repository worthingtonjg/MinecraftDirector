# Hollow Harvest prototype

An experimental Minecraft adventure director: inventory milestones, story books, concurrent hunts, earned rewards, death markers, maps, bounded encounters and persistent delivery receipts.

Run its offline tests from the repository root with `npm test`. Tests use synthetic player names and mock game responses. The main README describes the shared runtime and dry-mode bridge.

The live `host.mjs` requires `--live`, reviewed `activation.local.json`, `journeys.local.json`, a dedicated `server-26.3/hollow-harvest-opening` world and compatible Java runtime in the parent project. It also validates server properties, EULA acceptance, existing objective identities and conflicting host locks. These checks intentionally fail when local configuration is absent. `Start-Prototype.ps1` is a Windows launcher after setup and approval, not an installer.

This repository does not distribute playable worlds, player data, local plans, server jars, map builds, activation approvals or captured session history. World-specific survey/preparation scripts are development tools, not safe general-purpose setup commands. Review them before using them with a new world. Do not run them against an existing world merely to test the code.
