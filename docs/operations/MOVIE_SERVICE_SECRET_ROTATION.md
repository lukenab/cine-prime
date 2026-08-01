# Movie-service secret rotation

The repository contains configuration keys only. Runtime credentials must come from environment
variables or the ignored root `.env` file.

## Required rotation

1. Revoke the previously committed TMDB API key in the TMDB account and create a new key.
2. Rotate the Cloudinary API secret. Create a restricted upload preset/API key when the account
   supports it.
3. Generate a new HS512 signing key with at least 64 random characters. Update every backend
   service at the same time because JWTs are shared across services.
4. Generate a new internal-service key and update every service in the same deployment.
5. Change the PostgreSQL password and update `POSTGRES_PASSWORD` before recreating containers.

Copy `.env.example` to `.env`, set the new values, and keep `.env` untracked. CI/CD and production
must provide the same variable names through the platform secret store.

## Verification

Run the following after setting the variables:

```powershell
docker compose config --quiet
docker compose up -d --build movie-service
docker compose exec movie-service sh -c 'test -n "$TMDB_API_KEY"'
```

The last command should exit successfully without printing the secret. Never paste secret values
into logs, issues, screenshots, or source files. Validate JWT access with an ADMIN token after rotating
the shared signer key, then run one TMDB search and one preview/import request.
