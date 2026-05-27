# Living Site Secure Inference Setup

The living-site daemon must use an explicit cloud inference provider in production. Do **not** rely on the local LM Studio fallback on the VPS.

## Secret handling rule

Never commit API keys. Never paste them into logs. Store them only in a server-side environment file with root ownership and `0600` permissions.

Recommended path:

```bash
/etc/liminal/living-site.env
```

## One-time setup

From the deployed repo on the VPS:

```bash
sudo scripts/setup-living-site-secrets.sh /etc/liminal/living-site.env
```

The script asks which provider to use:

- `minimax` → `https://api.minimax.io/anthropic`, model `MiniMax-M2.7`, key variable `MINIMAX_API_KEY`
- `glm` → `https://api.z.ai/api/anthropic`, model `GLM-5v-turbo`, key variable `GLM_API_KEY`

It writes only server-side environment variables. The actual key value is not printed.

## Generated env shape

MiniMax example, with fake placeholders only:

```dotenv
LIMINAL_LLM_BASE_URL=https://api.minimax.io/anthropic
LIMINAL_LLM_MODEL=MiniMax-M2.7
MINIMAX_API_KEY=REPLACE_ON_SERVER_ONLY
LIMINAL_ALLOWED_HOSTS=api.minimax.io,api.z.ai,open.bigmodel.cn,bigmodel.cn,puenteworks.com,app.posthog.com
LIMINAL_ALLOW_PRIVATE_IP_LLM=false
LIMINAL_ALLOW_LOCALHOST_LLM=false
LIMINAL_POSTHOG_KEY=REPLACE_ON_SERVER_ONLY
LIMINAL_POSTHOG_HOST=https://puenteworks.com/ph
```

GLM example, with fake placeholders only:

```dotenv
LIMINAL_LLM_BASE_URL=https://api.z.ai/api/anthropic
LIMINAL_LLM_MODEL=GLM-5v-turbo
GLM_API_KEY=REPLACE_ON_SERVER_ONLY
LIMINAL_ALLOWED_HOSTS=api.minimax.io,api.z.ai,open.bigmodel.cn,bigmodel.cn,puenteworks.com,app.posthog.com
LIMINAL_ALLOW_PRIVATE_IP_LLM=false
LIMINAL_ALLOW_LOCALHOST_LLM=false
LIMINAL_POSTHOG_KEY=REPLACE_ON_SERVER_ONLY
LIMINAL_POSTHOG_HOST=https://puenteworks.com/ph
```

## systemd

Use `ops/systemd/liminal-living-site.service.example` as the production unit template. It loads:

```ini
EnvironmentFile=/etc/liminal/living-site.env
```

Install manually:

```bash
sudo cp ops/systemd/liminal-living-site.service.example /etc/systemd/system/liminal-living-site.service
sudo systemctl daemon-reload
sudo systemctl enable liminal-living-site
sudo systemctl start liminal-living-site
sudo systemctl status liminal-living-site --no-pager
```

## Verification without leaking secrets

```bash
sudo test -f /etc/liminal/living-site.env
sudo stat -c '%A %U:%G %n' /etc/liminal/living-site.env
sudo systemctl show liminal-living-site -p EnvironmentFiles --no-pager
sudo journalctl -u liminal-living-site -n 100 --no-pager
```

Do not run commands that print the env file contents after real keys are installed.
