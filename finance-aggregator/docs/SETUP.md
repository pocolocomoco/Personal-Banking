# Detailed Setup Guide

This guide walks through the complete setup process for the Finance Aggregator.

## Prerequisites

- Google account
- Access to Google Sheets and Google Drive
- Basic familiarity with spreadsheets

## Step-by-Step Setup

### 1. Create the Spreadsheet

1. Open [Google Sheets](https://sheets.google.com)
2. Click **Blank** to create a new spreadsheet
3. Click "Untitled spreadsheet" and rename to **Finance Aggregator**
4. Note the URL - you'll need the spreadsheet ID later

### 2. Open Apps Script Editor

1. In your spreadsheet, click **Extensions** in the menu bar
2. Click **Apps Script**
3. A new tab opens with the script editor

### 3. Set Up Project Files

#### Delete Default Code
1. You'll see a file called `Code.gs` with a default function
2. Select all code and delete it

#### Add main.gs
1. Rename `Code.gs` to `main.gs` by clicking the three dots next to it
2. Copy the entire contents of `apps-script/main.gs`
3. Paste into the editor

#### Add Additional Script Files
For each of these files, repeat:
1. Click the **+** button next to "Files"
2. Select **Script**
3. Name it (without .gs extension - it's added automatically)
4. Paste the contents

Files to add:
- `utils` (from utils.gs)
- `alerts` (from alerts.gs)
- `triggers` (from triggers.gs)
- `csvParser` (from csvParser.gs)

#### Add HTML File
1. Click the **+** button next to "Files"
2. Select **HTML**
3. Name it `ManualEntryDialog`
4. Paste contents from `ManualEntryDialog.html`

#### Update Manifest
1. Click the gear icon (Project Settings)
2. Check **Show "appsscript.json" manifest file in editor**
3. Go back to Editor
4. Click `appsscript.json`
5. Replace contents with the provided manifest

### 4. Save and Deploy

1. Press **Ctrl+S** or click the save icon
2. Wait for "All changes saved" message
3. Close the Apps Script tab

### 5. Initialize the Sheet

1. Go back to your spreadsheet
2. **Refresh the page** (important!)
3. Wait a few seconds for the custom menu to appear
4. Click **Finance Aggregator** in the menu bar
5. Click **Admin > Initialize Sheet**
6. Click **Continue** on the authorization dialog
7. Select your Google account
8. Click **Allow** to grant permissions
9. Click **Yes** when asked to confirm initialization

### 6. Verify Tab Structure

After initialization, you should see these tabs:
- Dashboard
- Accounts
- Balances
- ImportLog
- Config
- README

### 7. Configure Your Accounts

Go to the **Accounts** tab. You'll see headers in row 1.

Add your accounts starting in row 2. Here's an example setup:

**Row 2 - Wells Fargo Checking:**
```
account_id: wf_checking_001
institution: Wells Fargo
account_name: Primary Checking
account_type: checking
is_asset: TRUE
plaid_account_id: (leave blank)
ingestion_method: manual
last_updated: (leave blank - auto-filled)
is_active: TRUE
```

**Row 3 - Chase Credit Card:**
```
account_id: chase_credit_001
institution: Chase
account_name: Sapphire Preferred
account_type: credit
is_asset: FALSE
plaid_account_id: (leave blank)
ingestion_method: manual
last_updated: (leave blank)
is_active: TRUE
```

**Row 4 - Apple Card:**
```
account_id: apple_credit_001
institution: Apple Card
account_name: Apple Card
account_type: credit
is_asset: FALSE
plaid_account_id: (leave blank)
ingestion_method: manual
last_updated: (leave blank)
is_active: TRUE
```

Repeat for all your accounts.

### 8. Enter Initial Balances

1. Click **Finance Aggregator > Add Manual Entry**
2. In the dialog:
   - Select your first account from the dropdown
   - Enter the current balance (positive number)
   - Verify the date (defaults to today)
   - Optionally add a note
3. Click **Add Entry**
4. Repeat for each account

### 9. Configure Alerts (Optional)

1. Go to the **Config** tab
2. Find the row with `ALERT_EMAIL`
3. In the `value` column, enter your email address
4. This enables:
   - Stale account warnings
   - Refresh failure notifications
   - Weekly summaries

### 10. Set Up Triggers (Optional)

For automated scheduling:

1. Go to **Extensions > Apps Script**
2. In the left sidebar, click the clock icon (Triggers)
3. Or run `setupAllTriggers()` from the editor

This creates:
- Daily balance refresh at 6 AM
- Weekly stale check on Mondays
- Weekly summary email on Sundays

## Verification Checklist

- [ ] Spreadsheet created and named
- [ ] All Apps Script files added
- [ ] Manifest updated with correct scopes
- [ ] Sheet initialized (all tabs present)
- [ ] At least one account added to Accounts tab
- [ ] At least one balance entry added
- [ ] Dashboard shows correct net worth
- [ ] Custom menu appears after refresh
- [ ] Manual entry dialog works

## Common Issues

### Menu doesn't appear
- Refresh the page
- Wait 10-15 seconds
- Check Apps Script for syntax errors

### Authorization failed
- Clear browser cache
- Try incognito mode
- Re-authorize from Apps Script editor

### Functions show #ERROR
- Open Apps Script and run any function
- This loads the functions into memory
- Refresh the spreadsheet

### Incorrect calculations
- Verify `is_asset` is TRUE/FALSE (not text)
- Check that account_id in Balances matches Accounts
- Ensure balance_amount is a number

## Next Steps

Once Phase 0 is working:

1. **Phase 1**: Set up CSV imports
   - Create a Google Drive folder for imports
   - Add the folder ID to Config
   - Download a statement and test import

2. **Phase 2**: Add Plaid integration
   - Sign up for Plaid developer account
   - Configure API keys
   - Link your bank accounts

See `PHASE_PLAN.md` for detailed instructions on each phase.
