# Group contribution report

**Project:** Coffee Shop Management System

## Group members

| Member name | Student number | Role |
| --- | --- | --- |
| Lefa Moopisa | 901021212 | Front-end |
| Kibiti Asanda | 901020612 | Researcher |
| Refuoe Lechesa | 901020610 | Database manager |
| Mathabi Matsoetlane | 901020661 | Deployer |

## Contribution by project area

| Area | What it covers | Member(s) |
| --- | --- | --- |
| React interface | Menu, cart, checkout, order confirmation and status lookup (`client/src/App.tsx`, `client/src/styles.css`) | Lefa Moopisa |
| Staff dashboard | Menu management, order processing and daily summary (`client/src/App.tsx`) | Lefa Moopisa |
| Fetch API integration | API client and error handling (`client/src/api.ts`) | Kibiti Asanda |
| Express REST API | Routes, staff authentication, validation and error handling (`server/src/app.js`, `schemas.js`, `errors.js`) | Kibiti Asanda |
| Key-value database | Redis storage design and persistence (`server/src/store.js`) | Refuoe Lechesa |
| Testing | API tests and manual testing (`server/test/app.test.js`) | Mathabi Matsoetlane |
| Deployment | Render, Netlify and database setup (`render.yaml`, `client/netlify.toml`) | Mathabi Matsoetlane |
| Documentation | README, demonstration guide and screenshots | Kibiti Asanda |
| GitHub management | Repository, branches and reviewing changes | Refuoe Lechesa |

## Tools and assistance

| Tool | How it was used |
| --- | --- |
| GitHub Copilot (AI assistant) | On 2026-11-05: co-authored the first commit, which built the application, and the commit that ignores generated TypeScript files. |
| Claude Code (AI assistant) | On 2026-11-05: reviewed the project against the brief; fixed menu ordering, the health check response and smaller interface issues; added API tests and a database record viewer; ran end-to-end checks; captured the screenshots; and drafted the README and demonstration guide. |
| Claude Code (AI assistant) | On 2026-11-07: restyled the website from templates the group chose; adapted the navigation bar component the group supplied; changed prices to Lesotho maloti; added the photos; fixed the backend so it starts when the database is unavailable; helped find and fix the deployment problems; retook the screenshots; and added the live addresses to the README. |
| Claude Code (AI assistant) | On 2026-11-10: found why the renamed website could not reach the backend, and updated the website address in the README and demonstration guide. |
