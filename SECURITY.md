# Security Policy

## Supported versions

pura is pre-1.0. Security fixes target the latest released version.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub Security Advisories when available, or email the maintainers listed in the repository.

Do not open a public issue for vulnerabilities that expose device control, network access, or local command execution risks.

## Security model

pura is designed for trusted local networks:

- Hub and Agent APIs are unauthenticated by default.
- Agents can execute `adb shell input tap` on connected Android devices.
- Hub must be able to reach each Agent over the LAN.
- Do not expose Hub or Agent ports directly to the public internet.
