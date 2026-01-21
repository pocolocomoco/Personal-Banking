/**
 * Finance Aggregator - Plaid Client
 *
 * Handles all Plaid API interactions for fetching account balances.
 *
 * SETUP REQUIRED:
 * 1. Create Plaid account at https://plaid.com
 * 2. Get client_id and secret from dashboard
 * 3. Run storeCredentials() with your credentials
 * 4. Link accounts using Plaid Link (see PLAID_SETUP.md)
 * 5. Store access tokens using storeAccessToken()
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const PLAID_ENVIRONMENTS = {
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com'
};

/**
 * Gets Plaid configuration from Script Properties
 */
function getPlaidConfig() {
  const props = PropertiesService.getScriptProperties();
  const env = props.getProperty('PLAID_ENV') || 'development';

  return {
    clientId: props.getProperty('PLAID_CLIENT_ID'),
    secret: props.getProperty('PLAID_SECRET'),
    environment: env,
    baseUrl: PLAID_ENVIRONMENTS[env] || PLAID_ENVIRONMENTS.development
  };
}

/**
 * Checks if Plaid is configured
 */
function isPlaidConfigured() {
  const config = getPlaidConfig();
  return !!(config.clientId && config.secret);
}

// ============================================================================
// CREDENTIAL MANAGEMENT
// ============================================================================

/**
 * Stores Plaid credentials in Script Properties
 * Run this once from the Apps Script editor
 *
 * @param {string} clientId - Your Plaid client_id
 * @param {string} secret - Your Plaid secret (development or production)
 * @param {string} env - Environment: 'development' or 'production'
 */
function storeCredentials(clientId, secret, env = 'development') {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    'PLAID_CLIENT_ID': clientId,
    'PLAID_SECRET': secret,
    'PLAID_ENV': env
  });
  console.log('Plaid credentials stored successfully');
}

/**
 * Stores an access token for a linked institution
 *
 * @param {string} institutionKey - Key to identify this connection (e.g., 'wellsfargo', 'chase')
 * @param {string} accessToken - The access token from Plaid Link
 * @param {string} itemId - The item_id from Plaid (optional but recommended)
 */
function storeAccessToken(institutionKey, accessToken, itemId = '') {
  const props = PropertiesService.getScriptProperties();
  const tokens = JSON.parse(props.getProperty('PLAID_ACCESS_TOKENS') || '{}');

  tokens[institutionKey] = {
    accessToken: accessToken,
    itemId: itemId,
    linkedAt: new Date().toISOString()
  };

  props.setProperty('PLAID_ACCESS_TOKENS', JSON.stringify(tokens));
  console.log(`Access token stored for: ${institutionKey}`);
}

/**
 * Gets all stored access tokens
 */
function getAccessTokens() {
  const props = PropertiesService.getScriptProperties();
  return JSON.parse(props.getProperty('PLAID_ACCESS_TOKENS') || '{}');
}

/**
 * Removes an access token
 */
function removeAccessToken(institutionKey) {
  const props = PropertiesService.getScriptProperties();
  const tokens = JSON.parse(props.getProperty('PLAID_ACCESS_TOKENS') || '{}');

  delete tokens[institutionKey];
  props.setProperty('PLAID_ACCESS_TOKENS', JSON.stringify(tokens));
  console.log(`Access token removed for: ${institutionKey}`);
}

// ============================================================================
// API CALLS
// ============================================================================

/**
 * Makes a request to the Plaid API
 */
function plaidRequest(endpoint, payload) {
  const config = getPlaidConfig();

  if (!config.clientId || !config.secret) {
    throw new Error('Plaid credentials not configured. Run storeCredentials() first.');
  }

  const fullPayload = {
    client_id: config.clientId,
    secret: config.secret,
    ...payload
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(fullPayload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(config.baseUrl + endpoint, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    const error = JSON.parse(responseText);
    throw new Error(`Plaid API error: ${error.error_message || error.error_code || 'Unknown error'}`);
  }

  return JSON.parse(responseText);
}

/**
 * Fetches account balances for a single access token
 */
function fetchBalancesForToken(accessToken) {
  return plaidRequest('/accounts/balance/get', {
    access_token: accessToken
  });
}

/**
 * Gets institution info for an item
 */
function getItemInfo(accessToken) {
  return plaidRequest('/item/get', {
    access_token: accessToken
  });
}

// ============================================================================
// MAIN FETCH FUNCTIONS
// ============================================================================

/**
 * Fetches balances from all linked Plaid accounts
 * This is the main function called by the daily trigger
 */
function fetchAllPlaidBalances() {
  if (!isPlaidConfigured()) {
    console.log('Plaid not configured, skipping fetch');
    return { success: false, error: 'Plaid not configured' };
  }

  const tokens = getAccessTokens();
  const results = {
    success: true,
    fetched: [],
    errors: [],
    timestamp: new Date().toISOString()
  };

  if (Object.keys(tokens).length === 0) {
    console.log('No Plaid accounts linked');
    return { success: false, error: 'No accounts linked' };
  }

  for (const [institutionKey, tokenData] of Object.entries(tokens)) {
    try {
      console.log(`Fetching balances for: ${institutionKey}`);

      const response = fetchBalancesForToken(tokenData.accessToken);

      // Process each account in the response
      for (const account of response.accounts) {
        const balance = account.balances.current;
        const availableBalance = account.balances.available;
        const accountName = account.name;
        const accountType = mapPlaidAccountType(account.type, account.subtype);
        const plaidAccountId = account.account_id;

        // Try to find matching account in our sheet
        const matchedAccountId = findMatchingAccount(institutionKey, plaidAccountId, accountName);

        if (matchedAccountId) {
          // Write balance to sheet
          writeBalanceFromPlaid(matchedAccountId, balance, plaidAccountId);
          results.fetched.push({
            institution: institutionKey,
            account: accountName,
            balance: balance,
            sheetAccountId: matchedAccountId
          });
        } else {
          // Log unmatched account for user to configure
          console.log(`Unmatched Plaid account: ${institutionKey} - ${accountName} (${plaidAccountId})`);
          results.fetched.push({
            institution: institutionKey,
            account: accountName,
            balance: balance,
            sheetAccountId: null,
            note: 'No matching account in sheet - add plaid_account_id to Accounts tab'
          });
        }
      }

    } catch (error) {
      console.error(`Error fetching ${institutionKey}: ${error.message}`);
      results.errors.push({
        institution: institutionKey,
        error: error.message
      });
      results.success = false;
    }
  }

  // Log results
  logActivity('PLAID_FETCH', JSON.stringify(results, null, 2));

  // Update Plaid Status tab
  updatePlaidStatus(results);

  return results;
}

/**
 * Maps Plaid account types to our account types
 */
function mapPlaidAccountType(plaidType, plaidSubtype) {
  const typeMap = {
    'depository': {
      'checking': 'checking',
      'savings': 'savings',
      'money market': 'savings',
      'cd': 'savings',
      'default': 'checking'
    },
    'credit': {
      'credit card': 'credit',
      'default': 'credit'
    },
    'loan': {
      'mortgage': 'loan',
      'student': 'loan',
      'auto': 'loan',
      'default': 'loan'
    },
    'investment': {
      '401k': 'investment',
      'ira': 'investment',
      'roth': 'investment',
      'brokerage': 'investment',
      'default': 'investment'
    }
  };

  const typeCategory = typeMap[plaidType] || { 'default': 'other' };
  return typeCategory[plaidSubtype] || typeCategory['default'] || 'other';
}

/**
 * Finds a matching account in our Accounts sheet
 */
function findMatchingAccount(institutionKey, plaidAccountId, accountName) {
  const accounts = getAccountsMap();

  // First, try to match by plaid_account_id (most reliable)
  for (const [id, account] of Object.entries(accounts)) {
    if (account.plaidAccountId === plaidAccountId) {
      return id;
    }
  }

  // Second, try to match by institution + similar name
  const institutionLower = institutionKey.toLowerCase();
  for (const [id, account] of Object.entries(accounts)) {
    if (!account.isActive) continue;
    if (account.ingestionMethod !== 'plaid') continue;

    const accountInstitutionLower = account.institution.toLowerCase().replace(/\s+/g, '');
    if (accountInstitutionLower.includes(institutionLower) || institutionLower.includes(accountInstitutionLower)) {
      // Institution matches, check if plaid_account_id is empty (needs to be set)
      if (!account.plaidAccountId) {
        return id; // Return first unlinked account for this institution
      }
    }
  }

  return null;
}

/**
 * Writes a balance fetched from Plaid to the Balances sheet
 */
function writeBalanceFromPlaid(accountId, balance, plaidAccountId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Balances');

  if (!sheet) {
    throw new Error('Balances sheet not found');
  }

  const balanceId = Utilities.getUuid();
  const now = new Date();

  sheet.appendRow([
    balanceId,
    accountId,
    now,
    Math.abs(balance), // Store as positive, is_asset determines sign
    'plaid',
    `Plaid account: ${plaidAccountId}`,
    now
  ]);

  // Update last_updated in Accounts
  updateAccountLastUpdated(accountId, now);

  // Update plaid_account_id if not set
  updateAccountPlaidId(accountId, plaidAccountId);
}

/**
 * Updates the plaid_account_id for an account if not already set
 */
function updateAccountPlaidId(accountId, plaidAccountId) {
  const accounts = getAccountsMap();
  const account = accounts[accountId];

  if (!account || account.plaidAccountId) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Accounts');

  // plaid_account_id is column 6
  sheet.getRange(account.rowIndex, 6).setValue(plaidAccountId);
}

// ============================================================================
// STATUS & MONITORING
// ============================================================================

/**
 * Updates the Plaid Status tab with connection health
 */
function updatePlaidStatus(results) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('PlaidStatus');

  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet('PlaidStatus');
    sheet.getRange(1, 1, 1, 5).setValues([[
      'institution', 'status', 'last_fetch', 'accounts_fetched', 'error'
    ]]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  }

  // Clear existing data (except headers)
  if (sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }

  const tokens = getAccessTokens();
  const rows = [];

  for (const institutionKey of Object.keys(tokens)) {
    const fetchedAccounts = results.fetched.filter(f => f.institution === institutionKey);
    const error = results.errors.find(e => e.institution === institutionKey);

    rows.push([
      institutionKey,
      error ? 'ERROR' : 'OK',
      new Date(),
      fetchedAccounts.length,
      error ? error.error : ''
    ]);
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 5).setValues(rows);
  }
}

/**
 * Shows Plaid connection status in a dialog
 */
function showPlaidStatus() {
  const ui = SpreadsheetApp.getUi();

  if (!isPlaidConfigured()) {
    ui.alert('Plaid Status', 'Plaid is not configured. Please run storeCredentials() first.', ui.ButtonSet.OK);
    return;
  }

  const tokens = getAccessTokens();
  const tokenCount = Object.keys(tokens).length;

  if (tokenCount === 0) {
    ui.alert('Plaid Status', 'No accounts are linked to Plaid yet.\n\nSee PLAID_SETUP.md for instructions.', ui.ButtonSet.OK);
    return;
  }

  const lines = ['Connected Institutions:', ''];
  for (const [key, data] of Object.entries(tokens)) {
    const linkedDate = data.linkedAt ? new Date(data.linkedAt).toLocaleDateString() : 'Unknown';
    lines.push(`- ${key} (linked: ${linkedDate})`);
  }

  ui.alert('Plaid Status', lines.join('\n'), ui.ButtonSet.OK);
}

/**
 * Manual trigger to fetch Plaid balances
 */
function manualPlaidFetch() {
  const ui = SpreadsheetApp.getUi();

  ui.alert('Fetching Balances', 'Fetching balances from Plaid. This may take a moment...', ui.ButtonSet.OK);

  const results = fetchAllPlaidBalances();

  if (results.success) {
    const summary = results.fetched.map(f =>
      `${f.institution} - ${f.account}: $${f.balance.toLocaleString()}`
    ).join('\n');

    ui.alert('Fetch Complete', `Successfully fetched ${results.fetched.length} account(s):\n\n${summary}`, ui.ButtonSet.OK);
  } else {
    const errorMsg = results.errors.map(e => `${e.institution}: ${e.error}`).join('\n');
    ui.alert('Fetch Error', `Errors occurred:\n\n${errorMsg || results.error}`, ui.ButtonSet.OK);
  }
}

// ============================================================================
// SETUP HELPERS
// ============================================================================

/**
 * Interactive setup wizard for Plaid credentials
 * Prompts user for credentials and stores them
 */
function setupPlaidCredentials() {
  const ui = SpreadsheetApp.getUi();

  // Get client ID
  const clientIdResponse = ui.prompt(
    'Plaid Setup (1/3)',
    'Enter your Plaid client_id:\n(Find this in your Plaid Dashboard > Team Settings > Keys)',
    ui.ButtonSet.OK_CANCEL
  );

  if (clientIdResponse.getSelectedButton() !== ui.Button.OK) return;
  const clientId = clientIdResponse.getResponseText().trim();

  // Get secret
  const secretResponse = ui.prompt(
    'Plaid Setup (2/3)',
    'Enter your Plaid secret (Development):\n(Use the Development secret, not Production)',
    ui.ButtonSet.OK_CANCEL
  );

  if (secretResponse.getSelectedButton() !== ui.Button.OK) return;
  const secret = secretResponse.getResponseText().trim();

  // Confirm environment
  const envResponse = ui.alert(
    'Plaid Setup (3/3)',
    'Use Development environment?\n\n' +
    'Click YES for Development (recommended, free)\n' +
    'Click NO for Production (requires paid plan)',
    ui.ButtonSet.YES_NO
  );

  const env = envResponse === ui.Button.YES ? 'development' : 'production';

  // Store credentials
  storeCredentials(clientId, secret, env);

  ui.alert(
    'Setup Complete',
    'Plaid credentials have been stored.\n\n' +
    'Next step: Link your bank accounts using Plaid Link.\n' +
    'See PLAID_SETUP.md for detailed instructions.',
    ui.ButtonSet.OK
  );
}

/**
 * Prompts user to add an access token for a linked institution
 */
function addPlaidAccessToken() {
  const ui = SpreadsheetApp.getUi();

  // Get institution name
  const instResponse = ui.prompt(
    'Add Access Token (1/2)',
    'Enter institution name (e.g., wellsfargo, chase, bankofamerica):',
    ui.ButtonSet.OK_CANCEL
  );

  if (instResponse.getSelectedButton() !== ui.Button.OK) return;
  const institutionKey = instResponse.getResponseText().trim().toLowerCase().replace(/\s+/g, '');

  // Get access token
  const tokenResponse = ui.prompt(
    'Add Access Token (2/2)',
    'Paste the access token from Plaid Link:',
    ui.ButtonSet.OK_CANCEL
  );

  if (tokenResponse.getSelectedButton() !== ui.Button.OK) return;
  const accessToken = tokenResponse.getResponseText().trim();

  // Store token
  storeAccessToken(institutionKey, accessToken);

  ui.alert(
    'Token Stored',
    `Access token stored for: ${institutionKey}\n\n` +
    'The system will now fetch balances for this institution.\n' +
    'Make sure you have matching accounts in the Accounts tab with ingestion_method = "plaid"',
    ui.ButtonSet.OK
  );

  // Offer to fetch immediately
  const fetchNow = ui.alert(
    'Fetch Now?',
    'Would you like to fetch balances for this institution now?',
    ui.ButtonSet.YES_NO
  );

  if (fetchNow === ui.Button.YES) {
    manualPlaidFetch();
  }
}
