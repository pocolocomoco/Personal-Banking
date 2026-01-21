/**
 * Finance Aggregator - SimpleFIN Client
 *
 * SimpleFIN is a personal finance data service that's simpler and more
 * affordable than Plaid for personal use.
 *
 * SETUP:
 * 1. Go to https://bridge.simplefin.org
 * 2. Create account and connect your banks
 * 3. Get your Setup Token
 * 4. Run setupSimpleFIN() and paste the token
 * 5. Done - balances will be fetched automatically
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Gets SimpleFIN Access URL from Script Properties
 */
function getSimpleFINAccessURL() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('SIMPLEFIN_ACCESS_URL');
}

/**
 * Checks if SimpleFIN is configured
 */
function isSimpleFINConfigured() {
  return !!getSimpleFINAccessURL();
}

// ============================================================================
// SETUP
// ============================================================================

/**
 * Interactive setup for SimpleFIN
 * Prompts for Setup Token and exchanges it for Access URL
 */
function setupSimpleFIN() {
  const ui = SpreadsheetApp.getUi();

  // Check if already configured
  if (isSimpleFINConfigured()) {
    const response = ui.alert(
      'SimpleFIN Already Configured',
      'SimpleFIN is already set up. Do you want to reconfigure with a new token?',
      ui.ButtonSet.YES_NO
    );
    if (response !== ui.Button.YES) return;
  }

  // Show instructions
  ui.alert(
    'SimpleFIN Setup (1/2)',
    'To get your Setup Token:\n\n' +
    '1. Go to https://bridge.simplefin.org\n' +
    '2. Create an account (or log in)\n' +
    '3. Connect your bank accounts\n' +
    '4. Click "Get Setup Token"\n' +
    '5. Copy the token\n\n' +
    'Click OK when you have your token.',
    ui.ButtonSet.OK
  );

  // Get the setup token
  const tokenResponse = ui.prompt(
    'SimpleFIN Setup (2/2)',
    'Paste your SimpleFIN Setup Token:',
    ui.ButtonSet.OK_CANCEL
  );

  if (tokenResponse.getSelectedButton() !== ui.Button.OK) return;

  const setupToken = tokenResponse.getResponseText().trim();

  if (!setupToken) {
    ui.alert('Error', 'No token provided. Setup cancelled.', ui.ButtonSet.OK);
    return;
  }

  // Exchange setup token for access URL
  try {
    ui.alert('Processing', 'Exchanging token... This may take a moment.', ui.ButtonSet.OK);

    const accessURL = exchangeSetupToken(setupToken);

    // Store the access URL
    const props = PropertiesService.getScriptProperties();
    props.setProperty('SIMPLEFIN_ACCESS_URL', accessURL);

    // Test the connection
    const testResult = fetchSimpleFINAccounts();

    ui.alert(
      'Setup Complete!',
      `SimpleFIN is now configured.\n\n` +
      `Found ${testResult.accounts.length} account(s):\n` +
      testResult.accounts.map(a => `- ${a.org.name}: ${a.name}`).join('\n') +
      `\n\nUse "Refresh All Balances" to fetch balances.`,
      ui.ButtonSet.OK
    );

    logActivity('SIMPLEFIN_SETUP', `Connected ${testResult.accounts.length} accounts`);

  } catch (error) {
    logError('setupSimpleFIN', error);
    ui.alert(
      'Setup Failed',
      `Error: ${error.message}\n\nPlease check your token and try again.`,
      ui.ButtonSet.OK
    );
  }
}

/**
 * Exchanges a SimpleFIN Setup Token for an Access URL
 * This is a one-time operation - the setup token becomes invalid after use
 */
function exchangeSetupToken(setupToken) {
  // Decode the base64 setup token to get the claim URL
  const claimURL = Utilities.newBlob(Utilities.base64Decode(setupToken)).getDataAsString();

  // POST to the claim URL to get credentials
  const response = UrlFetchApp.fetch(claimURL, {
    method: 'POST',
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`Failed to claim token: ${response.getContentText()}`);
  }

  // Response is the Access URL
  const accessURL = response.getContentText().trim();

  if (!accessURL.startsWith('https://')) {
    throw new Error('Invalid access URL received');
  }

  return accessURL;
}

// ============================================================================
// API CALLS
// ============================================================================

/**
 * Fetches all accounts from SimpleFIN
 */
function fetchSimpleFINAccounts() {
  const accessURL = getSimpleFINAccessURL();

  if (!accessURL) {
    throw new Error('SimpleFIN not configured. Run Setup SimpleFIN first.');
  }

  // The access URL already contains auth credentials
  // Append /accounts to get account data
  const accountsURL = accessURL.replace(/\/$/, '') + '/accounts';

  const response = UrlFetchApp.fetch(accountsURL, {
    method: 'GET',
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();

  if (responseCode === 403) {
    throw new Error('Access denied. Your SimpleFIN connection may have expired. Please run Setup SimpleFIN again.');
  }

  if (responseCode !== 200) {
    throw new Error(`SimpleFIN API error (${responseCode}): ${response.getContentText()}`);
  }

  return JSON.parse(response.getContentText());
}

// ============================================================================
// BALANCE FETCHING
// ============================================================================

/**
 * Fetches balances from SimpleFIN and writes to sheet
 * Main function called by triggers and manual refresh
 */
function fetchAllSimpleFINBalances() {
  if (!isSimpleFINConfigured()) {
    console.log('SimpleFIN not configured, skipping fetch');
    return { success: false, error: 'SimpleFIN not configured' };
  }

  const results = {
    success: true,
    fetched: [],
    errors: [],
    timestamp: new Date().toISOString()
  };

  try {
    console.log('Fetching SimpleFIN accounts...');
    const data = fetchSimpleFINAccounts();

    if (!data.accounts || data.accounts.length === 0) {
      return { success: false, error: 'No accounts found in SimpleFIN' };
    }

    for (const account of data.accounts) {
      try {
        const orgName = account.org?.name || 'Unknown';
        const accountName = account.name || 'Unknown';
        const balance = account.balance;
        const simplefinId = account.id;

        // Try to find matching account in our sheet
        const matchedAccountId = findMatchingSimpleFINAccount(orgName, simplefinId, accountName);

        if (matchedAccountId) {
          // Write balance to sheet
          writeBalanceFromSimpleFIN(matchedAccountId, balance, simplefinId);
          results.fetched.push({
            institution: orgName,
            account: accountName,
            balance: balance,
            sheetAccountId: matchedAccountId
          });
        } else {
          // Log unmatched account
          console.log(`Unmatched SimpleFIN account: ${orgName} - ${accountName} (${simplefinId})`);
          results.fetched.push({
            institution: orgName,
            account: accountName,
            balance: balance,
            sheetAccountId: null,
            simplefinId: simplefinId,
            note: 'No matching account in sheet - add simplefin_id to Accounts tab'
          });
        }

      } catch (accountError) {
        console.error(`Error processing account: ${accountError.message}`);
        results.errors.push({
          account: account.name,
          error: accountError.message
        });
      }
    }

    // Update status tab
    updateSimpleFINStatus(results);

  } catch (error) {
    console.error(`SimpleFIN fetch error: ${error.message}`);
    results.success = false;
    results.errors.push({ error: error.message });
  }

  logActivity('SIMPLEFIN_FETCH', `Fetched ${results.fetched.length} accounts, ${results.errors.length} errors`);

  return results;
}

/**
 * Finds a matching account in our Accounts sheet
 */
function findMatchingSimpleFINAccount(institution, simplefinId, accountName) {
  const accounts = getAccountsMap();

  // First, try to match by simplefin_id (stored in plaid_account_id column for now)
  for (const [id, account] of Object.entries(accounts)) {
    if (account.plaidAccountId === simplefinId) {
      return id;
    }
  }

  // Second, try to match by institution name
  const institutionLower = institution.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const [id, account] of Object.entries(accounts)) {
    if (!account.isActive) continue;
    if (account.ingestionMethod !== 'simplefin' && account.ingestionMethod !== 'plaid') continue;

    const accountInstitutionLower = account.institution.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Check if institutions match
    if (accountInstitutionLower.includes(institutionLower) ||
        institutionLower.includes(accountInstitutionLower)) {
      // If no ID set yet, use this account
      if (!account.plaidAccountId) {
        return id;
      }
    }
  }

  return null;
}

/**
 * Writes a balance from SimpleFIN to the sheet
 */
function writeBalanceFromSimpleFIN(accountId, balance, simplefinId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Balances');

  if (!sheet) {
    throw new Error('Balances sheet not found');
  }

  const balanceId = Utilities.getUuid();
  const now = new Date();

  // SimpleFIN returns negative balances for credit cards (amount owed)
  // We store as positive and use is_asset to determine sign
  const balanceAmount = Math.abs(parseFloat(balance) || 0);

  sheet.appendRow([
    balanceId,
    accountId,
    now,
    balanceAmount,
    'simplefin',
    `SimpleFIN ID: ${simplefinId}`,
    now
  ]);

  // Update last_updated in Accounts
  updateAccountLastUpdated(accountId, now);

  // Update simplefin_id if not set (using plaid_account_id column)
  updateAccountSimpleFINId(accountId, simplefinId);
}

/**
 * Updates the SimpleFIN ID for an account (stored in plaid_account_id column)
 */
function updateAccountSimpleFINId(accountId, simplefinId) {
  const accounts = getAccountsMap();
  const account = accounts[accountId];

  if (!account || account.plaidAccountId) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Accounts');

  // plaid_account_id is column 6
  sheet.getRange(account.rowIndex, 6).setValue(simplefinId);
}

// ============================================================================
// STATUS & MONITORING
// ============================================================================

/**
 * Updates the SimpleFIN status tab
 */
function updateSimpleFINStatus(results) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('SimpleFINStatus');

  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet('SimpleFINStatus');
    sheet.getRange(1, 1, 1, 5).setValues([[
      'institution', 'account', 'balance', 'matched', 'last_fetch'
    ]]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  }

  // Clear existing data (except headers)
  if (sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }

  const rows = results.fetched.map(f => [
    f.institution,
    f.account,
    f.balance,
    f.sheetAccountId ? 'Yes' : 'No - needs setup',
    new Date()
  ]);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 5).setValues(rows);
  }
}

/**
 * Shows SimpleFIN status dialog
 */
function showSimpleFINStatus() {
  const ui = SpreadsheetApp.getUi();

  if (!isSimpleFINConfigured()) {
    ui.alert(
      'SimpleFIN Status',
      'SimpleFIN is not configured.\n\nGo to Finance Aggregator > SimpleFIN > Setup SimpleFIN',
      ui.ButtonSet.OK
    );
    return;
  }

  try {
    const data = fetchSimpleFINAccounts();

    const lines = [
      `Connected Accounts: ${data.accounts.length}`,
      ''
    ];

    for (const account of data.accounts) {
      lines.push(`- ${account.org?.name}: ${account.name} ($${account.balance})`);
    }

    ui.alert('SimpleFIN Status', lines.join('\n'), ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('SimpleFIN Error', `Error: ${error.message}`, ui.ButtonSet.OK);
  }
}

/**
 * Manual trigger to fetch SimpleFIN balances
 */
function manualSimpleFINFetch() {
  const ui = SpreadsheetApp.getUi();

  if (!isSimpleFINConfigured()) {
    ui.alert(
      'Not Configured',
      'SimpleFIN is not set up yet.\n\nGo to Finance Aggregator > SimpleFIN > Setup SimpleFIN',
      ui.ButtonSet.OK
    );
    return;
  }

  const results = fetchAllSimpleFINBalances();

  if (results.success && results.fetched.length > 0) {
    const summary = results.fetched
      .filter(f => f.sheetAccountId)
      .map(f => `${f.institution} - ${f.account}: $${Math.abs(f.balance).toLocaleString()}`)
      .join('\n');

    const unmatched = results.fetched.filter(f => !f.sheetAccountId);
    let message = `Fetched ${results.fetched.length} account(s):\n\n${summary}`;

    if (unmatched.length > 0) {
      message += `\n\n⚠️ ${unmatched.length} unmatched account(s) - check SimpleFINStatus tab`;
    }

    ui.alert('Fetch Complete', message, ui.ButtonSet.OK);
  } else {
    const errorMsg = results.errors.map(e => e.error || e.message).join('\n') || results.error;
    ui.alert('Fetch Error', `Error: ${errorMsg}`, ui.ButtonSet.OK);
  }
}

/**
 * Removes SimpleFIN configuration
 */
function disconnectSimpleFIN() {
  const ui = SpreadsheetApp.getUi();

  const response = ui.alert(
    'Disconnect SimpleFIN',
    'This will remove your SimpleFIN connection. You will need to set up again to fetch balances.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('SIMPLEFIN_ACCESS_URL');

  ui.alert('Disconnected', 'SimpleFIN has been disconnected.', ui.ButtonSet.OK);
  logActivity('SIMPLEFIN_DISCONNECT', 'SimpleFIN connection removed');
}
