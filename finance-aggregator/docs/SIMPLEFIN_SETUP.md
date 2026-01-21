# SimpleFIN Setup Guide

SimpleFIN is a personal finance data service designed for individuals. It's simpler and more affordable than enterprise solutions like Plaid.

## Overview

| Feature | Details |
|---------|---------|
| **Cost** | Pay-what-you-want (can be $0) |
| **Bank Support** | Most major US banks |
| **Setup Time** | ~5 minutes |
| **Data** | Account balances (and transactions if needed) |

## Step 1: Create SimpleFIN Account

1. Go to **https://bridge.simplefin.org**
2. Click **"Get Started"** or **"Sign Up"**
3. Create an account with your email

## Step 2: Connect Your Banks

1. After logging in, click **"Add Connection"** or **"Link Bank"**
2. Search for your bank (Wells Fargo, Chase, Bank of America, etc.)
3. Log in with your bank credentials
4. Complete any MFA verification
5. Repeat for each bank you want to connect

**Supported Banks Include:**
- Wells Fargo
- Bank of America
- Chase
- Most credit unions
- Many investment brokerages

**Not Supported:**
- Apple Card (Goldman Sachs) - use manual entry

## Step 3: Get Your Setup Token

1. In SimpleFIN Bridge, look for **"Create Setup Token"** or **"Get Token"**
2. Click to generate a new token
3. Copy the token (it's a long string of characters)

**Important:** Each token can only be used once. If setup fails, generate a new token.

## Step 4: Configure Google Sheet

1. Open your Finance Aggregator Google Sheet
2. Go to **Finance Aggregator > SimpleFIN > Setup SimpleFIN**
3. Follow the prompts
4. Paste your Setup Token when asked
5. Wait for the connection to complete

If successful, you'll see a list of connected accounts.

## Step 5: Map Accounts

After setup, check the **SimpleFINStatus** tab. You'll see all accounts from SimpleFIN.

For each account you want to track:

1. Go to the **Accounts** tab
2. Find or add the matching account row
3. Set `ingestion_method` to `simplefin`
4. The `plaid_account_id` column will auto-fill with the SimpleFIN ID on next fetch

**Example:**
| account_id | institution | ingestion_method |
|------------|-------------|------------------|
| wf_checking_001 | Wells Fargo | simplefin |
| chase_credit_001 | Chase | simplefin |
| apple_credit_001 | Apple Card | manual |

## Step 6: Test the Connection

1. Go to **Finance Aggregator > SimpleFIN > Fetch Balances Now**
2. Check that balances appear in the **Balances** tab
3. Verify the **SimpleFINStatus** tab shows all accounts

## Step 7: Enable Automation (Optional)

To fetch balances automatically every day:

1. Go to **Finance Aggregator > Admin > Setup Triggers**
2. In the **Config** tab, set `AUTO_REFRESH_ENABLED` to `TRUE`

Balances will update daily at 6 AM.

## Troubleshooting

### "SimpleFIN not configured"
Run **Finance Aggregator > SimpleFIN > Setup SimpleFIN** and enter your token.

### "Access denied" or "Connection expired"
Your SimpleFIN connection may have expired.
1. Log into https://bridge.simplefin.org
2. Re-authenticate any disconnected banks
3. Generate a new Setup Token
4. Run Setup SimpleFIN again

### Account not matching
If a SimpleFIN account isn't matching to your sheet:
1. Check the **SimpleFINStatus** tab for the SimpleFIN ID
2. Copy the ID
3. Paste it into the `plaid_account_id` column for the correct account in **Accounts** tab

### Bank not supported
If your bank isn't available in SimpleFIN:
- Use manual entry for that account
- Set `ingestion_method` to `manual` in the Accounts tab

## Security

- SimpleFIN uses bank-level OAuth connections (not screen scraping)
- Your credentials go directly to your bank, not SimpleFIN
- Access tokens are stored encrypted in Google Apps Script Properties
- You can revoke access anytime via SimpleFIN Bridge

## Cost

SimpleFIN uses a **pay-what-you-want** model:
- You can use it for free
- Suggested donation helps support development
- No forced payments or trials

## Menu Reference

| Menu Item | What It Does |
|-----------|--------------|
| **Setup SimpleFIN** | Connect SimpleFIN to your sheet |
| **Fetch Balances Now** | Manually fetch latest balances |
| **View Status** | Show connected accounts and balances |
| **Disconnect** | Remove SimpleFIN connection |

## Comparison: SimpleFIN vs Plaid

| Feature | SimpleFIN | Plaid |
|---------|-----------|-------|
| Cost | Pay-what-you-want | $0.10+ per call |
| Target User | Individuals | Businesses |
| Setup | Simple | Complex |
| Bank Coverage | Good | Better |
| Apple Card | No | No |

For personal finance tracking, SimpleFIN is the better choice.
