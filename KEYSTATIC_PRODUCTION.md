# Keystatic production setup

Keystatic runs in local mode during development and uses GitHub mode on the
production site. Editors need write access to `daar/quinacare.org`.

## One-time GitHub setup

Create a GitHub App under the owner of `daar/quinacare.org` with these values:

- GitHub App name: `Quina Care Keystatic` (or another unique name)
- Homepage URL: `https://quinacare.org/keystatic`
- Callback URL: `https://quinacare.org/api/keystatic/github/oauth/callback`
- Request user authorization during installation: enabled
- Webhooks: disabled
- Repository permissions:
  - Contents: read and write
  - Metadata: read
  - Pull requests: read

Install the app only on `daar/quinacare.org`, then generate a client secret.
The app slug is the final part of its URL, for example `quina-care-keystatic`
in `https://github.com/apps/quina-care-keystatic`.

## Netlify environment variables

Add these variables to the Netlify production context. They must be available
to both builds and Functions:

| Variable                           | Value                              |
| ---------------------------------- | ---------------------------------- |
| `KEYSTATIC_GITHUB_CLIENT_ID`       | GitHub App client ID               |
| `KEYSTATIC_GITHUB_CLIENT_SECRET`   | Generated GitHub App client secret |
| `KEYSTATIC_SECRET`                 | Output of `openssl rand -hex 32`   |
| `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` | GitHub App slug                    |

Trigger a new production deploy after saving the variables. The build fails
early when a variable is missing or `KEYSTATIC_SECRET` is too short.

## Production smoke test

1. Open `https://quinacare.org/keystatic` and sign in with a GitHub account
   that has write access to the repository.
2. Confirm that the three news collections load.
3. Create a temporary draft news item and save it.
4. Confirm that GitHub receives the commit and Netlify deploys it.
5. Delete the temporary item through Keystatic.
6. Confirm that a GitHub account without write access cannot enter the CMS.

If GitHub reports a `redirect_uri` mismatch, add the callback URL above to the
GitHub App settings and retry.
