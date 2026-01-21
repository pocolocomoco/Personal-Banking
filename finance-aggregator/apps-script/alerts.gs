/**
 * Finance Aggregator - Alert Functions
 *
 * Email notifications and alerting functionality
 */

// ============================================================================
// EMAIL ALERTS
// ============================================================================

/**
 * Sends an alert email for stale accounts
 */
function sendStaleAccountAlert(staleAccounts) {
  const config = getConfig();
  const email = config.ALERT_EMAIL;

  if (!email) {
    console.log('No alert email configured, skipping notification');
    return;
  }

  const subject = `[Finance Aggregator] ${staleAccounts.length} Stale Account(s) Detected`;

  const body = [
    'The following accounts have not been updated recently:',
    '',
    ...staleAccounts.map(s =>
      `- ${s.account.institution} / ${s.account.accountName}: ${s.reason}`
    ),
    '',
    'Please update these accounts to keep your finance dashboard accurate.',
    '',
    '---',
    'This is an automated message from your Finance Aggregator spreadsheet.'
  ].join('\n');

  try {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: body
    });

    logActivity('ALERT_SENT', `Stale account alert sent to ${email}`);
  } catch (error) {
    logError('sendStaleAccountAlert', error);
  }
}

/**
 * Sends an alert email for refresh failures
 */
function sendRefreshFailureAlert(errors) {
  const config = getConfig();
  const email = config.ALERT_EMAIL;

  if (!email) return;

  const subject = '[Finance Aggregator] Balance Refresh Failed';

  const body = [
    'The automatic balance refresh encountered errors:',
    '',
    ...errors.map(e => `- ${e}`),
    '',
    'Please check your spreadsheet and connections.',
    '',
    '---',
    'This is an automated message from your Finance Aggregator spreadsheet.'
  ].join('\n');

  try {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: body
    });

    logActivity('ALERT_SENT', `Refresh failure alert sent to ${email}`);
  } catch (error) {
    logError('sendRefreshFailureAlert', error);
  }
}

/**
 * Sends a weekly summary email
 */
function sendWeeklySummary() {
  const config = getConfig();
  const email = config.ALERT_EMAIL;

  if (!email) return;

  const accounts = getAccountsMap();
  const balances = getLatestBalances();

  let totalAssets = 0;
  let totalLiabilities = 0;
  const accountSummaries = [];

  for (const [id, account] of Object.entries(accounts)) {
    if (!account.isActive) continue;

    const balance = balances[id] || 0;
    if (account.isAsset) {
      totalAssets += balance;
    } else {
      totalLiabilities += balance;
    }

    accountSummaries.push({
      institution: account.institution,
      name: account.accountName,
      balance: balance,
      isAsset: account.isAsset,
      lastUpdated: account.lastUpdated
    });
  }

  const netWorth = totalAssets - totalLiabilities;

  const subject = `[Finance Aggregator] Weekly Summary - Net Worth: ${formatCurrency(netWorth)}`;

  const body = [
    'WEEKLY FINANCE SUMMARY',
    '======================',
    '',
    `Net Worth: ${formatCurrency(netWorth)}`,
    `Total Assets: ${formatCurrency(totalAssets)}`,
    `Total Liabilities: ${formatCurrency(totalLiabilities)}`,
    '',
    'ACCOUNT BREAKDOWN',
    '-----------------',
    '',
    'ASSETS:',
    ...accountSummaries
      .filter(a => a.isAsset)
      .map(a => `  ${a.institution} - ${a.name}: ${formatCurrency(a.balance)}`),
    '',
    'LIABILITIES:',
    ...accountSummaries
      .filter(a => !a.isAsset)
      .map(a => `  ${a.institution} - ${a.name}: ${formatCurrency(a.balance)}`),
    '',
    '---',
    'This is an automated message from your Finance Aggregator spreadsheet.'
  ].join('\n');

  try {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: body
    });

    logActivity('SUMMARY_SENT', `Weekly summary sent to ${email}`);
  } catch (error) {
    logError('sendWeeklySummary', error);
  }
}

// ============================================================================
// SCHEDULED CHECKS
// ============================================================================

/**
 * Scheduled function to check for stale accounts
 * Set up as a weekly trigger (e.g., Monday 9 AM)
 */
function scheduledStaleCheck() {
  const staleAccounts = checkStaleAccountsSilent();

  if (staleAccounts.length > 0) {
    sendStaleAccountAlert(staleAccounts);
  }
}

/**
 * Silent version of stale check (no UI alerts)
 * Used by scheduled functions
 */
function checkStaleAccountsSilent() {
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

  return staleAccounts;
}
