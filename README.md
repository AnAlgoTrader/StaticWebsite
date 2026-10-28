# IBKR Futures Journal (GitHub Pages)

Static web dashboard for Interactive Brokers futures trades with automated daily sync via GitHub Actions.

Live URL: **https://analgotrader.github.io/StaticWebsite/**

---

## How It Works

1. **Dashboard (Frontend)**: Serves a high-performance, dark-mode trading journal built with HTML5, vanilla CSS/JS, and Chart.js.
2. **Data**: Pre-rendered from [`data/trades.json`](data/trades.json).
3. **Automated Sync**: A GitHub Actions workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) runs every Monday–Friday at 22:00 UTC (after US market close):
   - Securely fetches new statements from IBKR Flex Web Service using GitHub Secrets.
   - Parses futures trades, commissions, and realized P&L.
   - Updates `data/trades.json` and redeploys the site automatically.

---

## Setup: Adding IBKR Secrets to GitHub

To enable automated synchronization, add your IBKR Flex credentials as repository secrets:

1. On GitHub, navigate to your repository: **`AnAlgoTrader/StaticWebsite`**
2. Click **Settings** > **Secrets and variables** > **Actions**.
3. Under **Repository secrets**, click **New repository secret**:
   - Name: `FLEX_TOKEN`
     - Value: *(your IBKR Flex Web Service token)*
   - Name: `FLEX_QUERY_ID`
     - Value: *(your IBKR Flex Query ID)*
   - *(Optional)* Name: `FLEX_VERSION`
     - Value: `3`
4. Click **Add secret**.

---

## Triggering a Manual Sync

You don't need to wait for the scheduled cron run:
1. Go to the **Actions** tab in GitHub.
2. Select **Deploy IBKR Trading Journal to GitHub Pages** from the left sidebar.
3. Click **Run workflow** > select branch `main` > click **Run workflow**.

---

## Local Development / Testing

```bash
# Install dependencies
npm install

# Test sync locally using your .env credentials
node -r dotenv/config scripts/sync.js

# Serve locally
npx serve .
```
