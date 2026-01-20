/**
 * Finance Aggregator - Main Entry Points
 *
 * This file contains the main menu setup and entry point functions
 * for the personal finance aggregation system.
 */

// ============================================================================
// MENU SETUP
// ============================================================================

/**
 * Creates custom menu when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Finance Aggregator')
    .addItem('Refresh All Balances', 'refreshAllBalances')
    .addItem('Add Manual Entry', 'showManualEntryDialog')
    .addSeparator()
    .addItem('Check Stale Accounts', 'checkStaleAccounts')
    .addItem('View System Status', 'showSystemStatus')
    .addSeparator()
    .addSubMenu(ui.createMenu('Admin')
      .addItem('Initialize Sheet', 'initializeSheet')
      .addItem('Clear All Balances', 'clearAllBalances')
      .addItem('Export Backup', 'exportBackup'))
    .addToUi();
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Refreshes all balances from all sources
 * Called manually or by daily trigger
 */
function refreshAllBalances() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const log = [];

  log.push(`[${new Date().toISOString()}] Starting balance refresh...`);

  try {
    // Phase 0: Only manual accounts exist
    // Phase 1+: Add CSV import processing here
    // Phase 2+: Add Plaid fetching here

    // Update the last refresh timestamp
    updateLastRefreshTime();

    log.push(`[${new Date().toISOString()}] Balance refresh completed successfully`);

    // Show completion message
    SpreadsheetApp.getUi().alert('Balance refresh completed successfully.');

  } catch (error) {
    log.push(`[${new Date().toISOString()}] ERROR: ${error.message}`);
    logError('refreshAllBalances', error);
    SpreadsheetApp.getUi().alert(`Error during refresh: ${error.message}`);
  }

  // Log activity
  logActivity('REFRESH_ALL', log.join('\n'));
}

/**
 * Shows the manual entry dialog
 */
function showManualEntryDialog() {
  const html = HtmlService.createHtmlOutputFromFile('ManualEntryDialog')
    .setWidth(400)
    .setHeight(500)
    .setTitle('Add Manual Balance Entry');
  SpreadsheetApp.getUi().showModalDialog(html, 'Add Manual Balance Entry');
}

/**
 * Processes manual entry form submission
 * Called from the HTML dialog
 */
function processManualEntry(formData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const balancesSheet = ss.getSheetByName('Balances');
    const accountsSheet = ss.getSheetByName('Accounts');

    if (!balancesSheet || !accountsSheet) {
      throw new Error('Required sheets not found. Please run Initialize Sheet first.');
    }

    // Validate account exists
    const accounts = getAccountsMap();
    if (!accounts[formData.accountId]) {
      throw new Error(`Account ID "${formData.accountId}" not found in Accounts sheet.`);
    }

    // Generate balance ID
    const balanceId = Utilities.getUuid();

    // Parse and validate amount
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount < 0) {
      throw new Error('Invalid balance amount. Must be a positive number.');
    }

    // Parse date
    const balanceDate = formData.date ? new Date(formData.date) : new Date();

    // Append to Balances sheet
    balancesSheet.appendRow([
      balanceId,
      formData.accountId,
      balanceDate,
      amount,
      'manual',
      formData.notes || '',
      new Date()
    ]);

    // Update last_updated in Accounts sheet
    updateAccountLastUpdated(formData.accountId, balanceDate);

    logActivity('MANUAL_ENTRY', `Added balance for ${formData.accountId}: $${amount.toFixed(2)}`);

    return { success: true, message: 'Balance entry added successfully.' };

  } catch (error) {
    logError('processManualEntry', error);
    return { success: false, message: error.message };
  }
}

/**
 * Gets list of active accounts for the manual entry dropdown
 */
function getActiveAccountsList() {
  const accounts = getAccountsMap();
  const result = [];

  for (const [id, account] of Object.entries(accounts)) {
    if (account.isActive) {
      result.push({
        id: id,
        label: `${account.institution} - ${account.accountName} (${account.accountType})`
      });
    }
  }

  // Sort by label
  result.sort((a, b) => a.label.localeCompare(b.label));

  return result;
}

// ============================================================================
// ACCOUNT STATUS FUNCTIONS
// ============================================================================

/**
 * Checks for stale accounts and optionally sends alert
 */
function checkStaleAccounts() {
  const config = getConfig();
  const staleDays = config.STALE_THRESHOLD_DAYS || 7;
  const accounts = getAccountsMap();
  const staleAccounts = [];
  const now = new Date();

  for (const [id, account] of Object.entries(accounts)) {
    if (!account.isActive) continue;

    if (!account.lastUpdated) {
      staleAccounts.push({ id, account, reason: 'Never updated' });
    } else {
      const daysSinceUpdate = Math.floor((now - account.lastUpdated) / (1000 * 60 * 60 * 24));
      if (daysSinceUpdate > staleDays) {
        staleAccounts.push({ id, account, reason: `${daysSinceUpdate} days old` });
      }
    }
  }

  if (staleAccounts.length > 0) {
    const message = staleAccounts.map(s =>
      `- ${s.account.institution} / ${s.account.accountName}: ${s.reason}`
    ).join('\n');

    SpreadsheetApp.getUi().alert(
      'Stale Accounts Detected',
      `The following accounts have not been updated recently:\n\n${message}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    // Send email alert if configured
    if (config.ALERT_EMAIL) {
      sendStaleAccountAlert(staleAccounts);
    }
  } else {
    SpreadsheetApp.getUi().alert('All accounts are up to date!');
  }

  return staleAccounts;
}

/**
 * Shows system status dialog
 */
function showSystemStatus() {
  const config = getConfig();
  const accounts = getAccountsMap();
  const balances = getLatestBalances();

  let totalAssets = 0;
  let totalLiabilities = 0;
  let accountCount = 0;

  for (const [id, account] of Object.entries(accounts)) {
    if (!account.isActive) continue;
    accountCount++;

    const balance = balances[id] || 0;
    if (account.isAsset) {
      totalAssets += balance;
    } else {
      totalLiabilities += balance;
    }
  }

  const status = [
    `Active Accounts: ${accountCount}`,
    `Total Assets: $${totalAssets.toLocaleString('en-US', {minimumFractionDigits: 2})}`,
    `Total Liabilities: $${totalLiabilities.toLocaleString('en-US', {minimumFractionDigits: 2})}`,
    `Net Worth: $${(totalAssets - totalLiabilities).toLocaleString('en-US', {minimumFractionDigits: 2})}`,
    '',
    `Last Refresh: ${config.LAST_REFRESH || 'Never'}`,
    `Stale Threshold: ${config.STALE_THRESHOLD_DAYS || 7} days`
  ].join('\n');

  SpreadsheetApp.getUi().alert('System Status', status, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initializes the spreadsheet with all required tabs and headers
 * Safe to run multiple times - won't overwrite existing data
 */
function initializeSheet() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Initialize Sheet',
    'This will create any missing tabs and headers. Existing data will NOT be deleted. Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Create tabs if they don't exist
  createTabIfMissing(ss, 'Dashboard');
  createTabIfMissing(ss, 'Accounts');
  createTabIfMissing(ss, 'Balances');
  createTabIfMissing(ss, 'ImportLog');
  createTabIfMissing(ss, 'Config');
  createTabIfMissing(ss, 'README');

  // Set up headers
  setupAccountsHeaders(ss);
  setupBalancesHeaders(ss);
  setupImportLogHeaders(ss);
  setupConfigDefaults(ss);
  setupDashboard(ss);
  setupReadme(ss);

  ui.alert('Initialization complete! Check each tab for structure.');
  logActivity('INIT', 'Sheet initialized successfully');
}

/**
 * Creates a tab if it doesn't exist
 */
function createTabIfMissing(ss, tabName) {
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
  }
  return sheet;
}

/**
 * Sets up Accounts tab headers
 */
function setupAccountsHeaders(ss) {
  const sheet = ss.getSheetByName('Accounts');
  const headers = [
    'account_id',
    'institution',
    'account_name',
    'account_type',
    'is_asset',
    'plaid_account_id',
    'ingestion_method',
    'last_updated',
    'is_active'
  ];

  // Only set headers if row 1 is empty
  const existing = sheet.getRange(1, 1).getValue();
  if (!existing) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
}

/**
 * Sets up Balances tab headers
 */
function setupBalancesHeaders(ss) {
  const sheet = ss.getSheetByName('Balances');
  const headers = [
    'balance_id',
    'account_id',
    'balance_date',
    'balance_amount',
    'source',
    'notes',
    'created_at'
  ];

  const existing = sheet.getRange(1, 1).getValue();
  if (!existing) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
}

/**
 * Sets up ImportLog tab headers
 */
function setupImportLogHeaders(ss) {
  const sheet = ss.getSheetByName('ImportLog');
  const headers = [
    'timestamp',
    'action',
    'details',
    'status'
  ];

  const existing = sheet.getRange(1, 1).getValue();
  if (!existing) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
}

/**
 * Sets up Config tab with default values
 */
function setupConfigDefaults(ss) {
  const sheet = ss.getSheetByName('Config');

  const existing = sheet.getRange(1, 1).getValue();
  if (!existing) {
    const configData = [
      ['key', 'value', 'description'],
      ['STALE_THRESHOLD_DAYS', '7', 'Days before an account is considered stale'],
      ['ALERT_EMAIL', '', 'Email address for alerts (leave blank to disable)'],
      ['LAST_REFRESH', '', 'Timestamp of last refresh (auto-updated)'],
      ['PLAID_ENVIRONMENT', 'development', 'Plaid environment: development or production'],
      ['AUTO_REFRESH_ENABLED', 'FALSE', 'Enable daily auto-refresh trigger'],
      ['IMPORT_FOLDER_ID', '', 'Google Drive folder ID for CSV imports']
    ];

    sheet.getRange(1, 1, configData.length, 3).setValues(configData);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
}

/**
 * Sets up the Dashboard tab with formulas
 */
function setupDashboard(ss) {
  const sheet = ss.getSheetByName('Dashboard');

  const existing = sheet.getRange(1, 1).getValue();
  if (existing) return; // Don't overwrite existing dashboard

  // Set up dashboard structure
  const dashboardContent = [
    ['PERSONAL FINANCE DASHBOARD', '', '', ''],
    ['', '', '', ''],
    ['NET WORTH', '', '', ''],
    ['=calculateNetWorth()', '', '', ''],
    ['', '', '', ''],
    ['ASSETS', '', 'LIABILITIES', ''],
    ['Checking', '=sumByType("checking", TRUE)', 'Credit Cards', '=sumByType("credit", FALSE)'],
    ['Savings', '=sumByType("savings", TRUE)', 'Loans', '=sumByType("loan", FALSE)'],
    ['Investments', '=sumByType("investment", TRUE)', '', ''],
    ['TOTAL ASSETS', '=sumAllAssets()', 'TOTAL LIABILITIES', '=sumAllLiabilities()'],
    ['', '', '', ''],
    ['BY INSTITUTION', '', '', ''],
    ['Institution', 'Balance', 'Last Updated', 'Status'],
    // Institution rows will be populated by formulas or script
  ];

  sheet.getRange(1, 1, dashboardContent.length, 4).setValues(dashboardContent);

  // Formatting
  sheet.getRange(1, 1).setFontSize(18).setFontWeight('bold');
  sheet.getRange(3, 1).setFontWeight('bold');
  sheet.getRange(4, 1).setFontSize(24).setFontWeight('bold');
  sheet.getRange(6, 1).setFontWeight('bold');
  sheet.getRange(6, 3).setFontWeight('bold');
  sheet.getRange(10, 1).setFontWeight('bold');
  sheet.getRange(10, 3).setFontWeight('bold');
  sheet.getRange(12, 1).setFontWeight('bold');
  sheet.getRange(13, 1, 1, 4).setFontWeight('bold');

  // Set column widths
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 120);
}

/**
 * Sets up README tab with documentation
 */
function setupReadme(ss) {
  const sheet = ss.getSheetByName('README');

  const existing = sheet.getRange(1, 1).getValue();
  if (existing) return;

  const readme = [
    ['FINANCE AGGREGATOR - README'],
    [''],
    ['OVERVIEW'],
    ['This spreadsheet aggregates balances from all your financial accounts into one view.'],
    [''],
    ['TABS'],
    ['- Dashboard: Summary view of net worth and balances'],
    ['- Accounts: Master list of all financial accounts'],
    ['- Balances: Historical balance records'],
    ['- ImportLog: Activity and import history'],
    ['- Config: System configuration settings'],
    [''],
    ['ADDING A NEW ACCOUNT'],
    ['1. Go to the Accounts tab'],
    ['2. Add a new row with:'],
    ['   - account_id: Unique ID (e.g., "chase_checking_001")'],
    ['   - institution: Bank/brokerage name'],
    ['   - account_name: Your name for this account'],
    ['   - account_type: checking, savings, credit, investment, or loan'],
    ['   - is_asset: TRUE for assets, FALSE for liabilities'],
    ['   - ingestion_method: manual, csv, or plaid'],
    ['   - is_active: TRUE'],
    [''],
    ['RECORDING A BALANCE'],
    ['Option 1: Use menu Finance Aggregator > Add Manual Entry'],
    ['Option 2: Directly add a row to the Balances tab'],
    [''],
    ['MAINTENANCE'],
    ['- Update manual accounts at least weekly'],
    ['- Check for stale accounts via menu'],
    ['- Run "Refresh All Balances" to update automated accounts'],
  ];

  sheet.getRange(1, 1, readme.length, 1).setValues(readme.map(r => [r[0] || r]));
  sheet.getRange(1, 1).setFontSize(16).setFontWeight('bold');
  sheet.getRange(3, 1).setFontWeight('bold');
  sheet.getRange(6, 1).setFontWeight('bold');
  sheet.getRange(13, 1).setFontWeight('bold');
  sheet.getRange(24, 1).setFontWeight('bold');
  sheet.getRange(28, 1).setFontWeight('bold');
  sheet.setColumnWidth(1, 600);
}

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * Clears all balance data (requires confirmation)
 */
function clearAllBalances() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Clear All Balances',
    'This will DELETE all balance history. This cannot be undone. Are you sure?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Balances');

  if (sheet && sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }

  ui.alert('All balance data has been cleared.');
  logActivity('ADMIN', 'Cleared all balance data');
}

/**
 * Exports a backup of all data to a new spreadsheet
 */
function exportBackup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timestamp = Utilities.formatDate(new Date(), 'America/Los_Angeles', 'yyyy-MM-dd_HHmm');
  const backupName = `Finance_Backup_${timestamp}`;

  const backup = ss.copy(backupName);

  SpreadsheetApp.getUi().alert(
    'Backup Created',
    `Backup created: ${backupName}\nLocation: ${backup.getUrl()}`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  logActivity('BACKUP', `Created backup: ${backupName}`);
}
