# Aimcheck Deploy Guide

This repository supports two deployment layouts:

- dedicated VPS with host Nginx
- shared VPS with an existing Dockerized Nginx and Certbot stack

Your current server is the second case. It already has `albavita-nginx-1` on public ports `80` and `443`, so this guide uses that shared-proxy layout.

Important:

- do not run host `nginx.service` for this setup
- do not use `certbot --nginx` on the host for this setup
- `aimcheck` should sit behind the existing Docker reverse proxy

## 1. DNS records

Create these records in your domain provider DNS panel.

If your VPS has a public IPv4:

- `A` record, host `@` -> `YOUR_SERVER_IPV4`
- `A` record, host `www` -> `YOUR_SERVER_IPV4`

If your VPS has a public IPv6:

- `AAAA` record, host `@` -> `YOUR_SERVER_IPV6`
- `AAAA` record, host `www` -> `YOUR_SERVER_IPV6`

Notes:

- The correct IPv6 record type is `AAAA`, not `AA`.
- `www` can be a `CNAME` to `aimcheck.ru` if you prefer.
- If you use Cloudflare, keep the records as `DNS only` during initial certificate issuance.
- Wait for DNS to resolve to the VPS before requesting certificates.

## 2. Publish images from GitHub Actions

Before the VPS can pull anything, the workflow must publish the images.

1. Push the repository to GitHub.
2. Make sure `.github/workflows/publish-images.yml` succeeds on `main`.
3. Confirm these images exist:

```text
ghcr.io/<github-owner>/aimcheck-client:latest
ghcr.io/<github-owner>/aimcheck-server:latest
```

If the packages are private, either make them public or log in on the VPS:

```bash
docker login ghcr.io -u <github-username>
```

Use a GitHub token with `read:packages` when prompted.

## 3. Prepare the VPS

Since Docker is already present on your server, install only what is still missing.

```bash
sudo apt update
sudo apt install -y git
```

Clone the project:

```bash
sudo mkdir -p /opt/aimcheck
sudo chown -R $USER:$USER /opt/aimcheck
git clone https://github.com/mut4bor/aimcheck.git /opt/aimcheck
cd /opt/aimcheck
```

If the repo is already there:

```bash
cd /opt/aimcheck
git pull
```

## 4. Configure the app environment

Create `.env` from the example:

```bash
cp .env.example .env
```

Set real values:

```env
GHCR_NAMESPACE=your-github-username-or-org
IMAGE_TAG=latest
SHARED_PROXY_NETWORK=shared-proxy

POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=use-a-strong-password

BETTER_AUTH_SECRET=use-a-long-random-secret
BETTER_AUTH_URL=https://aimcheck.ru
CLIENT_URL=https://aimcheck.ru
```

Notes:

- `GHCR_NAMESPACE` must be lowercase.
- `IMAGE_TAG=latest` is the simplest setup.
- If you want pinned deployments, use a published short SHA tag instead.
- `SHARED_PROXY_NETWORK` is the Docker network used by both `aimcheck` and your existing reverse proxy container.

## 5. Create the shared Docker network

Create the shared reverse-proxy network once:

```bash
docker network create shared-proxy
```

If it already exists, Docker will tell you and you can continue.

## 6. Attach the existing Nginx container to the shared network

Your existing public proxy container must be on the same Docker network as `aimcheck`.

If the other project is managed by Docker Compose, add this to that project:

```yaml
services:
  nginx:
    networks:
      - default
      - shared-proxy

networks:
  shared-proxy:
    external: true
    name: shared-proxy
```

Then recreate that Nginx service.

If you need a one-time manual attach first, you can also run:

```bash
docker network connect shared-proxy albavita-nginx-1
```

Important:

- make the Compose change in the other project as well, otherwise the manual network attach can disappear when that stack is recreated
- the Nginx container must still keep its current certbot-related volumes mounted

## 7. Deploy aimcheck behind the shared proxy

This repository includes [docker-compose.shared-proxy.yml](/e:/Sites/aimcheck/docker-compose.shared-proxy.yml:1), which attaches `aimcheck-client` and `aimcheck-server` to the shared proxy network with stable aliases.

Run:

```bash
cd /opt/aimcheck
docker compose -f docker-compose.yml -f docker-compose.shared-proxy.yml pull
docker compose -f docker-compose.yml -f docker-compose.shared-proxy.yml up -d
docker compose -f docker-compose.yml -f docker-compose.shared-proxy.yml ps
```

On that shared network, the services will be reachable as:

- `http://aimcheck-client`
- `http://aimcheck-server:3000`

## 8. Add the temporary HTTP config to the existing Nginx stack

For first-time certificate issuance, use the HTTP-only config from [deploy/nginx/aimcheck.ru.shared-proxy.http.conf](/e:/Sites/aimcheck/deploy/nginx/aimcheck.ru.shared-proxy.http.conf:1).

Copy it into the config directory used by your existing Nginx container. Example:

```bash
cp /opt/aimcheck/deploy/nginx/aimcheck.ru.shared-proxy.http.conf <existing-nginx-conf-dir>/aimcheck.ru.conf
```

That directory must already be mounted into `albavita-nginx-1` as Nginx `conf.d` or an equivalent site directory.

This temporary config does two things:

- proxies `aimcheck.ru` to the new app
- serves `/.well-known/acme-challenge/` from `/var/www/certbot`

Reload the existing Nginx container:

```bash
docker exec albavita-nginx-1 nginx -t
docker exec albavita-nginx-1 nginx -s reload
```

Check:

```bash
curl -I http://aimcheck.ru
curl -I http://aimcheck.ru/api/health
```

## 9. Generate certificates with the existing Certbot container

Your VPS already has `albavita-certbot-1`, so reuse that setup instead of host Certbot.

This assumes:

- the Nginx container serves `/.well-known/acme-challenge/` from `/var/www/certbot`
- the Certbot container mounts the same `/var/www/certbot`
- the Certbot container mounts `/etc/letsencrypt`

Request the certificate:

```bash
docker exec -it albavita-certbot-1 certbot certonly --webroot -w /var/www/certbot -d aimcheck.ru -d www.aimcheck.ru
```

After success, the certs should exist inside the shared letsencrypt volume at:

```text
/etc/letsencrypt/live/aimcheck.ru/fullchain.pem
/etc/letsencrypt/live/aimcheck.ru/privkey.pem
```

## 10. Switch the existing Nginx stack to the final HTTPS config

Replace the temporary config with [deploy/nginx/aimcheck.ru.shared-proxy.conf](/e:/Sites/aimcheck/deploy/nginx/aimcheck.ru.shared-proxy.conf:1):

```bash
cp /opt/aimcheck/deploy/nginx/aimcheck.ru.shared-proxy.conf <existing-nginx-conf-dir>/aimcheck.ru.conf
```

Reload Nginx:

```bash
docker exec albavita-nginx-1 nginx -t
docker exec albavita-nginx-1 nginx -s reload
```

Verify:

```bash
curl -I https://aimcheck.ru
curl -I https://aimcheck.ru/api/health
```

## 11. First deployment checklist

The first deployment is complete when all of these are true:

- `https://aimcheck.ru` opens the frontend
- `https://aimcheck.ru/api/health` returns `200`
- `docker compose -f docker-compose.yml -f docker-compose.shared-proxy.yml ps` shows all `aimcheck` containers running
- `docker exec albavita-nginx-1 nginx -t` passes
- `docker exec -it albavita-certbot-1 certbot renew --dry-run` passes

## 12. Updating the app later

Normal update flow:

1. Push changes to `main`.
2. Wait for GitHub Actions to publish new images.
3. On the VPS run:

```bash
cd /opt/aimcheck
git pull
docker compose -f docker-compose.yml -f docker-compose.shared-proxy.yml pull
docker compose -f docker-compose.yml -f docker-compose.shared-proxy.yml up -d
docker image prune -f
```

If the Nginx config for `aimcheck.ru` did not change, no proxy reload is needed.

If you deploy by a specific image tag instead of `latest`:

1. Find the published short SHA tag in GHCR.
2. Set `IMAGE_TAG=<that-tag>` in `.env`.
3. Run:

```bash
cd /opt/aimcheck
docker compose -f docker-compose.yml -f docker-compose.shared-proxy.yml pull
docker compose -f docker-compose.yml -f docker-compose.shared-proxy.yml up -d
```

## 13. Useful commands

Show `aimcheck` containers:

```bash
docker compose -f docker-compose.yml -f docker-compose.shared-proxy.yml ps
```

Show backend logs:

```bash
docker compose -f docker-compose.yml -f docker-compose.shared-proxy.yml logs -f server
```

Show frontend logs:

```bash
docker compose -f docker-compose.yml -f docker-compose.shared-proxy.yml logs -f client
```

Show database logs:

```bash
docker compose -f docker-compose.yml -f docker-compose.shared-proxy.yml logs -f postgres
```

Check the existing proxy config:

```bash
docker exec albavita-nginx-1 nginx -t
```

Reload the existing proxy:

```bash
docker exec albavita-nginx-1 nginx -s reload
```
