/**
 * Finance Aggregator - Utility Functions
 *
 * Shared helper functions used across the application
 */

// ============================================================================
// DATA ACCESS HELPERS
// ============================================================================

/**
 * Gets all accounts as a map keyed by account_id
 * @returns {Object} Map of account_id -> account data
 */
function getAccountsMap() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Accounts');

  if (!sheet || sheet.getLastRow() < 2) {
    return {};
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const accounts = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const accountId = row[0];

    if (!accountId) continue;

    accounts[accountId] = {
      accountId: row[0],
      institution: row[1],
      accountName: row[2],
      accountType: row[3],
      isAsset: row[4] === true || row[4] === 'TRUE' || row[4] === true,
      plaidAccountId: row[5],
      ingestionMethod: row[6],
      lastUpdated: row[7] ? new Date(row[7]) : null,
      isActive: row[8] === true || row[8] === 'TRUE' || row[8] === true,
      rowIndex: i + 1 // 1-indexed for sheet operations
    };
  }

  return accounts;
}

/**
 * Gets the latest balance for each account
 * @returns {Object} Map of account_id -> latest balance amount
 */
function getLatestBalances() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Balances');

  if (!sheet || sheet.getLastRow() < 2) {
    return {};
  }

  const data = sheet.getDataRange().getValues();
  const balances = {};

  // Process all rows and keep only the latest per account
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const accountId = row[1];
    const balanceDate = row[2] ? new Date(row[2]) : null;
    const amount = parseFloat(row[3]) || 0;

    if (!accountId || !balanceDate) continue;

    if (!balances[accountId] || balanceDate > balances[accountId].date) {
      balances[accountId] = {
        date: balanceDate,
        amount: amount
      };
    }
  }

  // Flatten to just amounts
  const result = {};
  for (const [id, data] of Object.entries(balances)) {
    result[id] = data.amount;
  }

  return result;
}

/**
 * Gets configuration values from Config tab
 * @returns {Object} Configuration key-value pairs
 */
function getConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Config');

  if (!sheet || sheet.getLastRow() < 2) {
    return getDefaultConfig();
  }

  const data = sheet.getDataRange().getValues();
  const config = {};

  for (let i = 1; i < data.length; i++) {
    const key = data[i][0];
    const value = data[i][1];
    if (key) {
      config[key] = value;
    }
  }

  return config;
}

/**
 * Returns default configuration values
 */
function getDefaultConfig() {
  return {
    STALE_THRESHOLD_DAYS: 7,
    ALERT_EMAIL: '',
    LAST_REFRESH: '',
    PLAID_ENVIRONMENT: 'development',
    AUTO_REFRESH_ENABLED: false,
    IMPORT_FOLDER_ID: ''
  };
}

/**
 * Updates a config value
 */
function setConfigValue(key, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Config');

  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return true;
    }
  }

  // Key not found, add it
  sheet.appendRow([key, value, '']);
  return true;
}

// ============================================================================
// UPDATE HELPERS
// ============================================================================

/**
 * Updates the last_updated field for an account
 */
function updateAccountLastUpdated(accountId, date) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Accounts');
  const accounts = getAccountsMap();

  const account = accounts[accountId];
  if (!account) return false;

  // last_updated is column 8 (index 7, but we use 8 for getRange)
  sheet.getRange(account.rowIndex, 8).setValue(date || new Date());
  return true;
}

/**
 * Updates the last refresh timestamp in config
 */
function updateLastRefreshTime() {
  setConfigValue('LAST_REFRESH', new Date().toISOString());
}

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Logs an activity to the ImportLog sheet
 */
function logActivity(action, details) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('ImportLog');

  if (!sheet) return;

  sheet.appendRow([
    new Date(),
    action,
    details,
    'OK'
  ]);

  // Keep log manageable - trim if over 1000 rows
  if (sheet.getLastRow() > 1000) {
    sheet.deleteRows(2, 100); // Delete oldest 100 entries
  }
}

/**
 * Logs an error to the ImportLog sheet and console
 */
function logError(functionName, error) {
  console.error(`[${functionName}] ${error.message}`, error.stack);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('ImportLog');

  if (!sheet) return;

  sheet.appendRow([
    new Date(),
    'ERROR',
    `${functionName}: ${error.message}`,
    'FAIL'
  ]);
}

// ============================================================================
// CALCULATION FUNCTIONS (Used by Dashboard)
// ============================================================================

/**
 * Calculates total net worth
 * Can be called as custom function: =calculateNetWorth()
 */
function calculateNetWorth() {
  const accounts = getAccountsMap();
  const balances = getLatestBalances();

  let netWorth = 0;

  for (const [id, account] of Object.entries(accounts)) {
    if (!account.isActive) continue;

    const balance = balances[id] || 0;
    if (account.isAsset) {
      netWorth += balance;
    } else {
      netWorth -= balance;
    }
  }

  return netWorth;
}

/**
 * Sums balances by account type and asset/liability status
 * Can be called as custom function: =sumByType("checking", TRUE)
 */
function sumByType(accountType, isAsset) {
  const accounts = getAccountsMap();
  const balances = getLatestBalances();

  let total = 0;

  for (const [id, account] of Object.entries(accounts)) {
    if (!account.isActive) continue;
    if (account.accountType !== accountType) continue;
    if (account.isAsset !== isAsset) continue;

    total += balances[id] || 0;
  }

  return total;
}

/**
 * Sums all assets
 * Can be called as custom function: =sumAllAssets()
 */
function sumAllAssets() {
  const accounts = getAccountsMap();
  const balances = getLatestBalances();

  let total = 0;

  for (const [id, account] of Object.entries(accounts)) {
    if (!account.isActive) continue;
    if (!account.isAsset) continue;

    total += balances[id] || 0;
  }

  return total;
}

/**
 * Sums all liabilities
 * Can be called as custom function: =sumAllLiabilities()
 */
function sumAllLiabilities() {
  const accounts = getAccountsMap();
  const balances = getLatestBalances();

  let total = 0;

  for (const [id, account] of Object.entries(accounts)) {
    if (!account.isActive) continue;
    if (account.isAsset) continue;

    total += balances[id] || 0;
  }

  return total;
}

/**
 * Gets balance for a specific account
 * Can be called as custom function: =getAccountBalance("chase_checking_001")
 */
function getAccountBalance(accountId) {
  const balances = getLatestBalances();
  return balances[accountId] || 0;
}

/**
 * Gets last updated date for a specific account
 * Can be called as custom function: =getAccountLastUpdated("chase_checking_001")
 */
function getAccountLastUpdated(accountId) {
  const accounts = getAccountsMap();
  const account = accounts[accountId];

  if (!account || !account.lastUpdated) {
    return 'Never';
  }

  return account.lastUpdated;
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Formats a number as currency
 */
function formatCurrency(amount) {
  return '$' + amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Formats a date as YYYY-MM-DD
 */
function formatDate(date) {
  if (!date) return '';
  return Utilities.formatDate(new Date(date), 'America/Los_Angeles', 'yyyy-MM-dd');
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates account type
 */
function isValidAccountType(type) {
  const validTypes = ['checking', 'savings', 'credit', 'investment', 'loan', 'other'];
  return validTypes.includes(type.toLowerCase());
}

/**
 * Validates ingestion method
 */
function isValidIngestionMethod(method) {
  const validMethods = ['manual', 'csv', 'plaid'];
  return validMethods.includes(method.toLowerCase());
}

/**
 * Generates a standard account ID
 */
function generateAccountId(institution, accountType, sequence) {
  const instAbbrev = institution.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 10);

  return `${instAbbrev}_${accountType}_${String(sequence).padStart(3, '0')}`;
}
