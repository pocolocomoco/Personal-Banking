# Plaid Integration Setup Guide

This guide walks you through setting up Plaid to automatically fetch balances from your bank accounts.

## Overview

Plaid is a financial data aggregation service used by thousands of apps (Venmo, Robinhood, etc.). It provides secure, bank-approved connections to financial institutions.

**What Plaid provides:**
- Official bank integrations (not screen scraping)
- MFA handling built-in
- Daily balance updates
- ToS-compliant access

**Limitations:**
- Apple Card is NOT supported
- Some smaller banks/credit unions may not be available
- Free tier limited to 100 connections (plenty for personal use)

## Supported Institutions

These institutions are confirmed to work with Plaid:

| Institution | Status | Notes |
|-------------|--------|-------|
| Wells Fargo | Supported | All account types |
| Bank of America | Supported | All account types |
| Chase | Supported | All account types |
| Fidelity | Supported | Brokerage, retirement |
| Charles Schwab | Supported | All account types |
| Vanguard | Supported | Investment accounts |
| TD Ameritrade | Supported | Investment accounts |
| Apple Card | NOT Supported | Use manual entry |

## Step 1: Create a Plaid Account

1. Go to [https://dashboard.plaid.com/signup](https://dashboard.plaid.com/signup)
2. Sign up for a free account
3. Verify your email
4. Complete the basic profile (select "Building for myself/personal use")

## Step 2: Get Your API Keys

1. Log into [Plaid Dashboard](https://dashboard.plaid.com)
2. Go to **Team Settings** (left sidebar) > **Keys**
3. You'll see:
   - `client_id` - A long string starting with letters
   - `Development secret` - Used for testing (free, up to 100 Items)
   - `Production secret` - Used for production (paid)

**For personal use, you only need Development credentials.**

Copy your `client_id` and `Development secret` - you'll need these next.

## Step 3: Store Credentials in Apps Script

In your Google Sheet:

1. Open **Extensions > Apps Script**
2. Run the setup wizard: **Finance Aggregator > Plaid > Setup Plaid Credentials**
3. Enter your `client_id` when prompted
4. Enter your `Development secret` when prompted
5. Select "Development" environment

**Or manually via script:**

```javascript
// Run this in Apps Script console (Run > Run function > storeCredentials)
function setupMyCredentials() {
  storeCredentials(
    'your_client_id_here',
    'your_development_secret_here',
    'development'
  );
}
```

## Step 4: Link Your Bank Accounts

This is the trickiest part. Plaid requires a web-based "Link" flow to connect bank accounts. Since Apps Script can't run this directly, you have two options:

### Option A: Use Plaid Quickstart (Recommended)

1. Go to [https://github.com/plaid/quickstart](https://github.com/plaid/quickstart)
2. Clone or download the repository
3. Follow their setup instructions for your preferred language (Node.js is simplest)
4. Run it locally: `npm install && npm start`
5. Open `http://localhost:3000` in your browser
6. Click "Launch Link" and connect your bank
7. After connecting, the Quickstart will show you the `access_token`
8. Copy this token - you'll need it for the next step

### Option B: Use Plaid's Link Demo

1. Go to [https://plaid.com/docs/link/](https://plaid.com/docs/link/)
2. Look for the interactive demo
3. Note: This may not give you a usable access token for your account

### Option C: Minimal Node.js Script

Create a file called `link-account.js`:

```javascript
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const express = require('express');
const app = express();

const config = new Configuration({
  basePath: PlaidEnvironments.development,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': 'YOUR_CLIENT_ID',
      'PLAID-SECRET': 'YOUR_DEVELOPMENT_SECRET',
    },
  },
});

const plaidClient = new PlaidApi(config);

app.get('/create-link-token', async (req, res) => {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: 'user-1' },
    client_name: 'Finance Aggregator',
    products: ['transactions'],
    country_codes: ['US'],
    language: 'en',
  });
  res.json(response.data);
});

app.get('/exchange-token', async (req, res) => {
  const publicToken = req.query.public_token;
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });
  console.log('ACCESS TOKEN:', response.data.access_token);
  console.log('ITEM ID:', response.data.item_id);
  res.json(response.data);
});

app.listen(3000, () => console.log('Open http://localhost:3000/create-link-token'));
```

Run with:
```bash
npm init -y
npm install plaid express
node link-account.js
```

## Step 5: Store Access Tokens

Once you have an access token from Plaid Link:

1. In your Google Sheet, go to **Finance Aggregator > Plaid > Add Access Token**
2. Enter the institution name (e.g., "wellsfargo", "chase")
3. Paste the access token

**Or via script:**

```javascript
// Run in Apps Script console
function addMyToken() {
  storeAccessToken('wellsfargo', 'access-development-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
}
```

**Repeat for each bank you want to connect.**

## Step 6: Configure Accounts in Sheet

For each Plaid-connected account, update the **Accounts** tab:

| account_id | institution | ingestion_method | plaid_account_id |
|------------|-------------|------------------|------------------|
| wf_checking_001 | Wells Fargo | plaid | (auto-filled) |
| chase_credit_001 | Chase | plaid | (auto-filled) |

The `plaid_account_id` will be automatically filled when the first fetch runs.

## Step 7: Test the Connection

1. Go to **Finance Aggregator > Plaid > Fetch Balances Now**
2. Wait for the fetch to complete
3. Check the results dialog
4. Verify balances appear in the **Balances** tab
5. Check **PlaidStatus** tab for connection health

## Step 8: Enable Daily Automation

Once everything is working:

1. In Apps Script, run `setupAllTriggers()`
2. This creates a daily trigger at 6 AM
3. Balances will update automatically

## Troubleshooting

### "Plaid credentials not configured"
Run the setup wizard or `storeCredentials()` function.

### "No accounts linked"
You need to complete the Plaid Link flow and store access tokens.

### "ITEM_LOGIN_REQUIRED"
The bank connection has expired. You need to re-authenticate:
1. Run Plaid Link again for that institution
2. Get a new access token
3. Update with `storeAccessToken()`

### "INVALID_ACCESS_TOKEN"
The token is malformed or from a different environment. Make sure you're using Development tokens with Development credentials.

### Account not matching
If Plaid accounts aren't matching to your sheet:
1. Check the **ImportLog** for unmatched accounts
2. Copy the `plaid_account_id` from the log
3. Paste it into the **Accounts** tab for the right account

### Rate limits
Plaid Development allows plenty of requests for personal use. If you hit limits, space out your fetches.

## Security Notes

- Access tokens are stored in Google Apps Script Properties (encrypted at rest)
- Tokens are not visible in the spreadsheet itself
- Never share your access tokens or Plaid credentials
- Each access token is scoped to one institution
- You can revoke access tokens via Plaid Dashboard

## Maintenance

### Token Refresh
Plaid tokens don't expire, but bank connections can break if:
- You change your bank password
- The bank requires re-verification
- MFA settings change

When this happens, you'll see errors in **PlaidStatus**. Re-run Plaid Link to get a new token.

### Adding New Accounts
When you open a new account at an already-linked bank:
1. The new account appears automatically in the next fetch
2. Add a row to **Accounts** tab with matching details
3. Set `ingestion_method` to `plaid`
4. The `plaid_account_id` will auto-fill on next fetch

### Removing Connections
To disconnect a bank:
1. In Apps Script, run: `removeAccessToken('institutionname')`
2. Optionally, revoke in Plaid Dashboard
3. Change affected accounts to `ingestion_method: manual`

## Cost

**Development environment (personal use):**
- Free for up to 100 Items (bank connections)
- No monthly fees
- Sufficient for tracking all your personal accounts

**Production environment (if needed):**
- Starts at $0.30 per Item per month
- Required if you exceed 100 connections
- Not necessary for personal use
