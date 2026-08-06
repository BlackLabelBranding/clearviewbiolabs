# Clear View Biolabs — export notes

This package contains the complete tracked source and assets from Sites project version 2, commit `cc4fb652ceca69c93bd3d2fc25801dbb5a6934aa`.

## Requirements

- Node.js 22.13.0 or newer
- npm (the included `package-lock.json` should be used)
- A Cloudflare-compatible deployment with a D1 database binding named `DB`

## Environment variables

- `ADMIN_EMAILS` — required for administrator access. Set it as a secret to a comma-separated list of authorized administrator email addresses. No secret value is included in this export.

## Install and build

```bash
npm ci
npm run build
```

For local development:

```bash
npm run dev
```

The production start command is `npm run start`.

## Database and deployment

- `.openai/hosting.json` declares the D1 binding as `DB`; no R2 bucket is required.
- Apply the included migration at `drizzle/0000_clear_view_commerce.sql` to the target D1 database before using product, order, account, or admin features.
- The site expects the hosting layer to supply the ChatGPT/Sites identity headers described in `README.md`. If deploying elsewhere, provide equivalent authentication and authorization behavior.
- The current Sites deployment uses restricted custom access. Recreate the desired access policy in the destination host; access settings are not embedded as credentials in this ZIP.

## GitHub upload

Upload the contents of the `Clear-View-Biolabs` folder as the repository root. The ZIP excludes `.git`, installed dependencies, and generated build output.
