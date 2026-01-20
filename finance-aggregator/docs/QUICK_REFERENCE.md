# Finance Aggregator Quick Reference

## Menu Commands

| Command | What It Does |
|---------|--------------|
| **Refresh All Balances** | Updates all automated accounts |
| **Add Manual Entry** | Opens dialog to record a balance |
| **Check Stale Accounts** | Lists accounts not updated recently |
| **View System Status** | Shows net worth and account summary |
| **Initialize Sheet** | Creates/repairs tab structure |
| **Clear All Balances** | Deletes all history (careful!) |
| **Export Backup** | Creates copy of entire sheet |

## Account Types

| Type | is_asset | Use For |
|------|----------|---------|
| `checking` | TRUE | Bank checking accounts |
| `savings` | TRUE | Savings, money market, CDs |
| `credit` | FALSE | Credit cards |
| `investment` | TRUE | Brokerage, IRA, 401k |
| `loan` | FALSE | Mortgage, auto, student |
| `other` | varies | Anything else |

## Ingestion Methods

| Method | Behavior |
|--------|----------|
| `manual` | You enter via menu |
| `csv` | Parsed from uploaded file |
| `plaid` | Fetched automatically via API |

## Account ID Format

```
{institution}_{type}_{number}
```

Examples:
- `chase_checking_001`
- `apple_credit_001`
- `fidelity_invest_001`

## Custom Functions (for formulas)

| Function | Returns |
|----------|---------|
| `=calculateNetWorth()` | Total net worth |
| `=sumAllAssets()` | Sum of all assets |
| `=sumAllLiabilities()` | Sum of all liabilities |
| `=sumByType("checking", TRUE)` | Sum by type and asset status |
| `=getAccountBalance("account_id")` | Balance for specific account |
| `=getAccountLastUpdated("account_id")` | Last update date |

## Config Keys

| Key | Purpose |
|-----|---------|
| `STALE_THRESHOLD_DAYS` | Days before stale warning |
| `ALERT_EMAIL` | Email for notifications |
| `AUTO_REFRESH_ENABLED` | Enable daily automation |
| `IMPORT_FOLDER_ID` | Google Drive folder for CSVs |

## Weekly Maintenance

1. Update Apple Card (manual)
2. Update any other manual accounts
3. Check Dashboard accuracy
4. Review ImportLog for errors

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Menu missing | Refresh page, wait 15 seconds |
| #ERROR in cells | Run any menu command, refresh |
| Permissions denied | Re-authorize in Apps Script |
| Wrong net worth | Check is_asset values in Accounts |

## Key Files (Apps Script)

| File | Purpose |
|------|---------|
| `main.gs` | Menu, core functions |
| `utils.gs` | Helpers, calculations |
| `alerts.gs` | Email notifications |
| `triggers.gs` | Scheduled automation |
| `csvParser.gs` | CSV import logic |
| `ManualEntryDialog.html` | Entry form UI |

## Support

- Check ImportLog tab for errors
- Review README tab in sheet
- See full documentation in `/docs/` folder
