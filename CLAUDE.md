# Security Advisory Dashboard — Frontend

React CDN SPA. Deployed on GitHub Pages.
Main file: index.html (~4400 lines).

## Key rules
- Single file only — no build step, no npm, no webpack
- Deploy: Ctrl+A replace index.html in GitHub web editor → commit
- Full file replacement only — never partial edits
- PROXY_URL points to Render backend

## Features built
- CRS scoring (computeCRS) — KEV=30, CNX=25, EPSS=15, CVSS=15, Exploit=10, OEM=5
- Focus Mode — filters CRS>=60 | CNX match | KEV
- Source state in Supabase (not localStorage)
- Admin PIN gate on API Keys panel
- Request coalescing, gzip, slim_advisory payload reduction

## Team
Pankaj (admin/dev), Wisnu, Ganesh, Sai, Unassigned analysts
Auth: shared access code via Render env var ACCESS_CODE
