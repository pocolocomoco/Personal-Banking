# Phased Delivery Plan

This document details each phase of the Finance Aggregator implementation.

## Phase Overview

| Phase | Focus | Prerequisites | Key Deliverables |
|-------|-------|---------------|------------------|
| 0 | Foundation | None | Working sheet with manual entry |
| 1 | CSV Import | Phase 0 complete | Automated CSV parsing |
| 2 | Plaid Integration | Phase 1 complete, Plaid account | Automated balance fetching |
| 3 | Polish | Phase 2 stable | Charts, alerts, PDF parsing |

---

## Phase 0: Foundation (Complete)

### Goal
A working spreadsheet with manual balance entry and dashboard.

### Deliverables
- [x] Google Sheet with all required tabs
- [x] Apps Script with core functionality
- [x] Manual entry dialog
- [x] Dashboard with net worth calculations
- [x] Custom menu
- [x] Activity logging

### Success Criteria
- [ ] Can add accounts to Accounts tab
- [ ] Can enter balances via menu
- [ ] Dashboard shows correct net worth
- [ ] Stale account check works
- [ ] Backup export works

### Maintenance
- Update balances weekly (or more often)
- Check Dashboard accuracy monthly

---

## Phase 1: CSV Import

### Goal
Automatically parse balance information from bank CSV exports.

### Prerequisites
- Phase 0 complete and working
- Google Drive folder created for imports
- Sample CSV exports from each bank

### Implementation Steps

#### 1. Create Import Folder
```
1. Go to Google Drive
2. Create folder: "Finance Imports"
3. Right-click folder > Get link > Copy
4. Extract folder ID from URL (the long string after /folders/)
5. Add to Config tab: IMPORT_FOLDER_ID = [your folder ID]
```

#### 2. Enable Drive Trigger
```
1. In Apps Script, run: setupDriveTrigger()
2. Grant Drive permissions if prompted
3. Trigger checks for new files hourly
```

#### 3. Test CSV Import
```
1. Download a statement CSV from one bank
2. Upload to your Finance Imports folder
3. Wait for processing (up to 1 hour) or run manually:
   - Apps Script > Run > checkForNewImports
4. Check ImportLog tab for results
5. Check Balances tab for new entry
```

#### 4. Map CSV to Account
After import, you need to associate parsed data with the correct account:
```
1. Go to Balances tab
2. Find the new row (source = "csv")
3. Enter the correct account_id
4. Or update csvParser.gs with filename-to-account mapping
```

### CSV Format Notes

**Chase Credit Card:**
- Download: chase.com > Statements & Documents > Download
- Format: Transaction list with Amount column
- Parser extracts: Sum of transactions (verify against statement balance)

**Wells Fargo:**
- Download: wellsfargo.com > Statements & Documents
- Format: Varies by account type
- Parser looks for: "Ending Balance" row

**Bank of America:**
- Download: bankofamerica.com > Statements & Documents
- Format: Usually has "Running Bal." column
- Parser extracts: Most recent running balance

**Apple Card:**
- Export options are limited
- If CSV available: Transaction list only
- Recommendation: Use manual entry instead

### Success Criteria
- [ ] Import folder configured
- [ ] Drive trigger active
- [ ] At least one bank's CSV successfully parsed
- [ ] Parsed balance appears in Balances tab
- [ ] ImportLog shows successful import

### Troubleshooting

**File not processed:**
- Ensure file ends in .csv
- Check it's in the correct folder
- Run `checkForNewImports()` manually

**Wrong balance extracted:**
- CSV format may have changed
- Update parser in csvParser.gs
- Use manual entry as fallback

---

## Phase 2: Plaid Integration

### Goal
Automatically fetch balances from supported banks via Plaid API.

### Prerequisites
- Phase 1 complete
- Plaid developer account (free)
- Understanding of OAuth flow

### Plaid Setup

#### 1. Create Plaid Account
```
1. Go to https://plaid.com/
2. Click "Get API Keys"
3. Sign up for free developer account
4. Complete verification
```

#### 2. Get API Credentials
```
1. Log into Plaid Dashboard
2. Go to Team Settings > Keys
3. Copy:
   - client_id
   - Development secret (NOT production)
```

#### 3. Store Credentials
In Apps Script:
```javascript
// Run once in Apps Script console:
function storeCredentials() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('PLAID_CLIENT_ID', 'your_client_id');
  props.setProperty('PLAID_SECRET', 'your_development_secret');
  props.setProperty('PLAID_ENV', 'development');
}
```

#### 4. Link Bank Accounts
Plaid requires a web-based OAuth flow. Options:

**Option A: Use Plaid Quickstart (Recommended)**
```
1. Clone Plaid Quickstart: github.com/plaid/quickstart
2. Run locally or deploy to Vercel
3. Link each bank account
4. Copy access tokens to Script Properties
```

**Option B: Manual Token Generation**
```
1. Use Plaid's API directly via Postman
2. Create link token
3. Complete OAuth in browser
4. Exchange for access token
5. Store in Script Properties
```

#### 5. Store Access Tokens
```javascript
// For each linked account:
function storeAccessToken(accountId, accessToken) {
  const props = PropertiesService.getScriptProperties();
  const tokens = JSON.parse(props.getProperty('PLAID_ACCESS_TOKENS') || '{}');
  tokens[accountId] = accessToken;
  props.setProperty('PLAID_ACCESS_TOKENS', JSON.stringify(tokens));
}
```

### Plaid API Implementation

Create `plaidClient.gs`:

```javascript
/**
 * Fetches balances from Plaid for all connected accounts
 */
function fetchPlaidBalances() {
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('PLAID_CLIENT_ID');
  const secret = props.getProperty('PLAID_SECRET');
  const tokens = JSON.parse(props.getProperty('PLAID_ACCESS_TOKENS') || '{}');

  const results = [];

  for (const [accountId, accessToken] of Object.entries(tokens)) {
    try {
      const balance = getAccountBalance(clientId, secret, accessToken);
      writeBalance(accountId, balance, 'plaid');
      results.push({ accountId, balance, success: true });
    } catch (error) {
      results.push({ accountId, error: error.message, success: false });
    }
  }

  return results;
}

function getAccountBalance(clientId, secret, accessToken) {
  const url = 'https://development.plaid.com/accounts/balance/get';

  const response = UrlFetchApp.fetch(url, {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify({
      client_id: clientId,
      secret: secret,
      access_token: accessToken
    })
  });

  const data = JSON.parse(response.getContentText());

  // Return first account's current balance
  // Adjust based on your needs
  return data.accounts[0].balances.current;
}
```

### Update Accounts Tab
For Plaid-connected accounts, update:
```
ingestion_method: plaid
plaid_account_id: [ID from Plaid response]
```

### Success Criteria
- [ ] Plaid credentials stored in Script Properties
- [ ] At least one bank linked via Plaid
- [ ] Access token stored for linked bank
- [ ] `fetchPlaidBalances()` runs without error
- [ ] Balance appears in Balances tab with source="plaid"
- [ ] Daily trigger updates balances automatically

### Plaid Limitations
- Development environment: 100 Items (connections) max
- Token refresh: Required every 90-180 days per bank
- Some banks require re-authentication periodically
- Apple Card: NOT supported (no Plaid integration)

---

## Phase 3: Polish & Monitoring

### Goal
Add charts, enhanced alerting, and quality-of-life improvements.

### Features

#### Balance Trend Charts
Add to Dashboard tab:
```
1. Select balance data range
2. Insert > Chart
3. Choose Line chart
4. X-axis: balance_date
5. Y-axis: balance_amount
6. Group by: account_id or institution
```

#### Enhanced Alerting
- Email digest with balance changes
- Alert if balance drops below threshold
- Alert if unusual transaction detected

#### PDF Statement Parsing
For Apple Card and other non-API banks:
```javascript
function parsePDFStatement(fileId) {
  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();

  // Convert PDF to Google Doc (extracts text)
  const doc = Drive.Files.insert(
    { title: 'temp_statement', mimeType: MimeType.GOOGLE_DOCS },
    blob
  );

  // Read text content
  const text = DocumentApp.openById(doc.id).getBody().getText();

  // Parse for balance (regex specific to statement format)
  const match = text.match(/New Balance[:\s]*\$?([\d,]+\.?\d*)/i);

  // Clean up temp file
  DriveApp.getFileById(doc.id).setTrashed(true);

  return match ? parseFloat(match[1].replace(',', '')) : null;
}
```

#### Conditional Formatting
Apply to Dashboard:
- Green: Recently updated (< 3 days)
- Yellow: Getting stale (3-7 days)
- Red: Stale (> 7 days)

### Success Criteria
- [ ] Balance trend chart visible on Dashboard
- [ ] Conditional formatting shows data freshness
- [ ] Weekly email summary received
- [ ] All accounts updating reliably

---

## Maintenance Checklist

### Weekly
- [ ] Update manual accounts (Apple Card, etc.)
- [ ] Review Dashboard for accuracy
- [ ] Check ImportLog for errors

### Monthly
- [ ] Verify all account balances against statements
- [ ] Export backup
- [ ] Review Plaid connection health

### Quarterly
- [ ] Re-authenticate Plaid connections if needed
- [ ] Review and close any inactive accounts
- [ ] Clean up old balance records if desired

---

## Rollback Procedures

### If Phase 1 breaks Phase 0
1. Disable Drive trigger in Apps Script
2. Remove IMPORT_FOLDER_ID from Config
3. Continue using manual entry

### If Phase 2 breaks earlier phases
1. Remove daily Plaid trigger
2. Clear PLAID_* from Script Properties
3. Change affected accounts to `ingestion_method: manual`

### Full reset
1. Run `removeAllTriggers()`
2. Delete Script Properties
3. Use **Admin > Initialize Sheet** to recreate structure
4. Re-enter accounts and initial balances
