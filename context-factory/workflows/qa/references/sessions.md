# Local API sessions

Read [fixture accounts](accounts.md), then run from the repository root:

```sh
node context-factory/tools/qa/session.mjs admin1@gmail.com
```

The helper loads the API environment privately, logs in through `/v1/auth/login`, checks `/v1/me`, and prints the account identity, local API base, and path to a mode-0600 temporary cookie-header file. It uses `API_PORT` (default 3000); an optional second argument supplies the full local API base including `/v1`. It rejects remote/credential-bearing URLs and unsupported fixture addresses.

Use the returned file without printing it:

```sh
curl --fail-with-body --header @/tmp/clemora-qa-EXAMPLE/cookie-header http://localhost:3000/v1/me
```

Replace the example path/base with the helper's actual output. The cookie is `em_session`, not a Firebase bearer token. Reuse it for the authorized checks. When finished, POST to the same base's `/auth/logout` with that header, then remove the generated temporary directory.

SQL cannot recover the cookie: `sessions.token_hash` holds its SHA-256 hash, not the usable token. Do not weaken storage or use the hash as a cookie. Keep runtime tokens, cookie-file contents, hashes, DB credentials, and service-account data out of chat and committed artifacts.
