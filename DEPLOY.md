# Aimcheck VPS Deploy Guide

This guide assumes:

- Ubuntu 22.04 or 24.04 on the VPS
- domain: `aimcheck.ru`
- optional alias: `www.aimcheck.ru`
- Docker images are published by GitHub Actions to `ghcr.io`
- app files live in `/opt/aimcheck`

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
- If you prefer, `www` can be a `CNAME` to `aimcheck.ru` instead of separate `A` and `AAAA` records.
- If you use Cloudflare, keep the records as `DNS only` during the first certificate issuance to avoid validation surprises.
- Wait until DNS resolves to the VPS before running Certbot.

## 2. Publish images from GitHub Actions

Before the VPS can pull anything, the workflow must publish the images.

1. Push the repository to GitHub.
2. Make sure the workflow in `.github/workflows/publish-images.yml` runs successfully on `main`.
3. Confirm these images exist in GHCR:

```text
ghcr.io/<github-owner>/aimcheck-client:latest
ghcr.io/<github-owner>/aimcheck-server:latest
```

If the packages are private, either:

- make the packages public in GitHub Packages, or
- create a GitHub Personal Access Token with `read:packages` and use it on the VPS with `docker login ghcr.io`

## 3. Prepare the VPS

Connect to the server and install the required software:

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
sudo systemctl enable --now docker
sudo systemctl enable --now nginx
sudo usermod -aG docker $USER
```

If you use UFW, allow web traffic:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Log out and back in after adding your user to the `docker` group.

## 4. Clone the project on the VPS

```bash
sudo mkdir -p /opt/aimcheck
sudo chown -R $USER:$USER /opt/aimcheck
git clone https://github.com/<github-owner>/<repo-name>.git /opt/aimcheck
cd /opt/aimcheck
```

If the repo is already cloned:

```bash
cd /opt/aimcheck
git pull
```

## 5. Configure environment variables

Create the production `.env` from the example:

```bash
cp .env.example .env
```

Edit `.env` and set real values:

```env
GHCR_NAMESPACE=your-github-username-or-org
IMAGE_TAG=latest

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
- If you want locked deployments, set `IMAGE_TAG` to a published commit SHA tag instead of `latest`.

## 6. Log in to GHCR if packages are private

Skip this step if the packages are public.

```bash
docker login ghcr.io -u <github-username>
```

When prompted for the password, use your GitHub token with `read:packages`.

## 7. Start the containers

```bash
cd /opt/aimcheck
docker compose pull
docker compose up -d
docker compose ps
```

At this point:

- frontend is available only on `127.0.0.1:8080`
- backend is available only on `127.0.0.1:3000`
- Postgres runs inside Docker and is not exposed publicly

## 8. Enable a temporary HTTP-only Nginx config

The final repo config uses certificate files, so do not enable it yet on a fresh server.

Create `/etc/nginx/sites-available/aimcheck.ru.conf` with this temporary content:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    listen [::]:80;
    server_name aimcheck.ru www.aimcheck.ru;

    client_max_body_size 10m;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -sf /etc/nginx/sites-available/aimcheck.ru.conf /etc/nginx/sites-enabled/aimcheck.ru.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Check:

```bash
curl -I http://aimcheck.ru
curl -I http://aimcheck.ru/api/health
```

## 9. Generate SSL certificates

Run Certbot after DNS is pointed to the VPS and port `80` is reachable:

```bash
sudo certbot certonly --nginx -d aimcheck.ru -d www.aimcheck.ru
```

This will create certificates in:

```text
/etc/letsencrypt/live/aimcheck.ru/fullchain.pem
/etc/letsencrypt/live/aimcheck.ru/privkey.pem
```

Check auto-renewal:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

## 10. Switch Nginx to the final HTTPS config

Copy the repo config into Nginx:

```bash
sudo cp /opt/aimcheck/deploy/nginx/aimcheck.ru.conf /etc/nginx/sites-available/aimcheck.ru.conf
sudo nginx -t
sudo systemctl reload nginx
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
- `docker compose ps` shows all containers as running
- `sudo nginx -t` passes
- `sudo certbot renew --dry-run` passes

## 12. Updating the app later

Normal update flow:

1. Push changes to `main`.
2. Wait for GitHub Actions to publish fresh images.
3. On the VPS run:

```bash
cd /opt/aimcheck
git pull
docker compose pull
docker compose up -d
docker image prune -f
```

If you deploy by a specific image tag instead of `latest`:

1. Find the published short SHA tag in GHCR.
2. Edit `.env` and set `IMAGE_TAG=<that-tag>`.
3. Run:

```bash
cd /opt/aimcheck
docker compose pull
docker compose up -d
```

## 13. Useful commands

Show running containers:

```bash
docker compose ps
```

Show backend logs:

```bash
docker compose logs -f server
```

Show frontend logs:

```bash
docker compose logs -f client
```

Show database logs:

```bash
docker compose logs -f postgres
```

Restart everything:

```bash
docker compose restart
```

Check Nginx config:

```bash
sudo nginx -t
```

Reload Nginx:

```bash
sudo systemctl reload nginx
```
