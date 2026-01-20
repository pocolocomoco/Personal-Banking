# Personal Finance Aggregator

A Google Sheets-based system for aggregating balances from all your financial accounts into a single dashboard.

## Overview

This system provides:
- A unified view of your net worth across all accounts
- Manual and automated balance tracking
- Historical balance records
- Stale data alerts
- CSV import capabilities (Phase 1+)
- Plaid API integration (Phase 2+)

## Supported Accounts

| Institution | Ingestion Method | Notes |
|-------------|------------------|-------|
| Wells Fargo | Manual / Plaid | Full support |
| Bank of America | Manual / Plaid | Full support |
| Chase | Manual / Plaid | Full support |
| Apple Card | Manual only | No API access available |
| Fidelity | Manual / Plaid | Investment accounts |
| Schwab | Manual / Plaid | Investment accounts |
| Vanguard | Manual / Plaid | Investment accounts |

## Quick Start

### Step 1: Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new blank spreadsheet
3. Name it "Finance Aggregator"

### Step 2: Add the Apps Script Code

1. In your spreadsheet, go to **Extensions > Apps Script**
2. Delete any existing code in `Code.gs`
3. Copy the contents of each `.gs` file from the `apps-script/` folder:
   - `main.gs` - Main entry points and menu
   - `utils.gs` - Utility functions
   - `alerts.gs` - Email alerting
   - `triggers.gs` - Scheduled automation
   - `csvParser.gs` - CSV import (Phase 1+)
4. Create the HTML file:
   - Click **+** next to Files
   - Select **HTML**
   - Name it `ManualEntryDialog`
   - Paste contents from `ManualEntryDialog.html`
5. Update `appsscript.json`:
   - Click **Project Settings** (gear icon)
   - Check "Show 'appsscript.json' manifest file"
   - Go back to Editor, open `appsscript.json`
   - Replace contents with the provided manifest

### Step 3: Initialize the Sheet

1. Save all files (Ctrl+S)
2. Go back to your spreadsheet
3. Refresh the page
4. Click **Finance Aggregator > Admin > Initialize Sheet**
5. Grant permissions when prompted

### Step 4: Add Your Accounts

Go to the **Accounts** tab and add your accounts:

| account_id | institution | account_name | account_type | is_asset | plaid_account_id | ingestion_method | last_updated | is_active |
|------------|-------------|--------------|--------------|----------|------------------|------------------|--------------|-----------|
| wf_checking_001 | Wells Fargo | Primary Checking | checking | TRUE | | manual | | TRUE |
| wf_savings_001 | Wells Fargo | Emergency Fund | savings | TRUE | | manual | | TRUE |
| chase_credit_001 | Chase | Sapphire Preferred | credit | FALSE | | manual | | TRUE |
| apple_credit_001 | Apple Card | Apple Card | credit | FALSE | | manual | | TRUE |
| boa_checking_001 | Bank of America | Checking | checking | TRUE | | manual | | TRUE |

### Step 5: Enter Initial Balances

1. Click **Finance Aggregator > Add Manual Entry**
2. Select each account and enter current balance
3. Repeat for all accounts

### Step 6: Verify Dashboard

- Go to the **Dashboard** tab
- Verify net worth calculation is correct
- Check that all accounts appear

## Sheet Structure

### Tabs

| Tab | Purpose |
|-----|---------|
| Dashboard | Summary view with net worth, charts |
| Accounts | Master list of all accounts |
| Balances | Historical balance records |
| ImportLog | Activity and error log |
| Config | System settings |
| README | In-sheet documentation |

### Account Types

| Type | is_asset | Examples |
|------|----------|----------|
| `checking` | TRUE | Bank checking accounts |
| `savings` | TRUE | Savings, money market |
| `credit` | FALSE | Credit cards |
| `investment` | TRUE | Brokerage, IRA, 401k |
| `loan` | FALSE | Mortgage, auto, student loans |
| `other` | varies | Anything else |

### Ingestion Methods

| Method | Description |
|--------|-------------|
| `manual` | You enter balances via the menu |
| `csv` | Imported from CSV file (Phase 1+) |
| `plaid` | Automated via Plaid API (Phase 2+) |

## Configuration

Edit the **Config** tab to customize:

| Key | Description | Default |
|-----|-------------|---------|
| `STALE_THRESHOLD_DAYS` | Days before account is flagged stale | 7 |
| `ALERT_EMAIL` | Email for alerts (blank = disabled) | |
| `AUTO_REFRESH_ENABLED` | Enable daily auto-refresh | FALSE |
| `IMPORT_FOLDER_ID` | Google Drive folder for CSV imports | |

## Usage

### Adding a Balance Manually

1. **Finance Aggregator > Add Manual Entry**
2. Select account from dropdown
3. Enter balance amount
4. Optionally adjust date and add notes
5. Click "Add Entry"

### Checking for Stale Accounts

1. **Finance Aggregator > Check Stale Accounts**
2. Review any accounts that haven't been updated recently

### Setting Up Email Alerts

1. Go to **Config** tab
2. Enter your email in `ALERT_EMAIL`
3. Run **Finance Aggregator > Admin > Initialize Sheet** to set up triggers

### Setting Up Automated Triggers

1. In Apps Script, run `setupAllTriggers()`
2. This creates:
   - Daily refresh at 6 AM
   - Weekly stale check on Monday
   - Weekly summary email on Sunday

## Apple Card Handling

Apple Card does not support Plaid or any API access. Options:

### Option 1: Monthly Manual Entry (Recommended)
1. Open Apple Wallet app
2. Tap Apple Card
3. Note current balance
4. Use **Finance Aggregator > Add Manual Entry**

### Option 2: CSV Export (If Available)
1. In Apple Wallet, tap Apple Card
2. Scroll down to "Transactions"
3. Export if option available
4. Upload to import folder

### Option 3: PDF Statement Parsing (Phase 3)
- Download monthly PDF statement
- Upload to designated folder
- System extracts "New Balance"

## Maintenance Schedule

| Task | Frequency | Method |
|------|-----------|--------|
| Update manual accounts | Weekly | Menu > Add Manual Entry |
| Check stale accounts | Weekly | Menu > Check Stale Accounts |
| Verify dashboard accuracy | Monthly | Manual review |
| Re-authenticate Plaid | Every 90-180 days | Plaid Link (Phase 2+) |

## Troubleshooting

### "Required sheets not found"
Run **Finance Aggregator > Admin > Initialize Sheet**

### Custom functions show #ERROR
1. Reload the spreadsheet
2. Wait 30 seconds for functions to load
3. If persists, check Apps Script for errors

### Triggers not running
1. Go to Apps Script > Triggers (clock icon)
2. Verify triggers are listed
3. Check execution log for errors

### Permission errors
1. Run any menu function
2. Click through OAuth consent
3. Grant all requested permissions

## Security Notes

- API keys stored in Script Properties (encrypted at rest)
- No credentials stored in sheet cells
- OAuth tokens not visible to sheet viewers
- Backup regularly using **Admin > Export Backup**

## File Structure

```
finance-aggregator/
├── apps-script/
│   ├── main.gs              # Entry points, menu, core functions
│   ├── utils.gs             # Helper functions, calculations
│   ├── alerts.gs            # Email notifications
│   ├── triggers.gs          # Scheduled automation
│   ├── csvParser.gs         # CSV import logic
│   ├── ManualEntryDialog.html
│   └── appsscript.json      # Manifest with permissions
├── docs/
│   ├── SETUP.md             # Detailed setup guide
│   ├── PHASE_PLAN.md        # Phased delivery plan
│   └── APPLE_CARD.md        # Apple Card workarounds
└── README.md
```

## Roadmap

### Phase 0 (Current) - Foundation
- [x] Sheet structure and tabs
- [x] Manual balance entry
- [x] Dashboard with formulas
- [x] Custom menu

### Phase 1 - CSV Import
- [ ] Drive folder monitoring
- [ ] CSV parsers for each bank
- [ ] Import logging

### Phase 2 - Plaid Integration
- [ ] Plaid account setup
- [ ] OAuth link flow
- [ ] Automated balance fetching
- [ ] Connection health monitoring

### Phase 3 - Polish
- [ ] Balance trend charts
- [ ] PDF statement parsing
- [ ] Mobile-friendly view
- [ ] Advanced alerting

## License

Personal use only. Not intended for redistribution.
