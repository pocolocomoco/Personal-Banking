/**
 * Plaid Link Helper
 *
 * A simple local server to link bank accounts via Plaid Link
 * and retrieve access tokens for use in Google Apps Script.
 *
 * Usage:
 * 1. Copy .env.example to .env and add your Plaid credentials
 * 2. Run: npm install
 * 3. Run: npm start
 * 4. Open http://localhost:3000 in your browser
 * 5. Click "Link Account" and connect your bank
 * 6. Copy the access token and add it to your Google Sheet
 */

require('dotenv').config();
const express = require('express');
const { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } = require('plaid');

const app = express();
app.use(express.json());

// Plaid configuration
const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'development'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(config);

// Store tokens temporarily (in-memory for this session only)
const linkedAccounts = [];

// Serve the HTML page
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Plaid Link Helper</title>
  <script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 { color: #333; }
    .card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    button {
      background: #0066ff;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
    }
    button:hover { background: #0052cc; }
    button:disabled { background: #ccc; }
    .token-box {
      background: #f0f0f0;
      padding: 15px;
      border-radius: 4px;
      font-family: monospace;
      word-break: break-all;
      margin: 10px 0;
    }
    .instructions {
      background: #e8f4ff;
      padding: 15px;
      border-radius: 4px;
      margin: 10px 0;
    }
    .success { color: #00aa00; }
    .error { color: #cc0000; }
    #accounts-list { margin-top: 20px; }
    .account-item {
      border: 1px solid #ddd;
      padding: 15px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .copy-btn {
      background: #28a745;
      padding: 8px 16px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h1>Plaid Link Helper</h1>

  <div class="card">
    <h2>Step 1: Link a Bank Account</h2>
    <p>Click the button below to connect a bank account via Plaid Link.</p>
    <button id="link-btn" onclick="openPlaidLink()">Link Bank Account</button>
    <p id="status"></p>
  </div>

  <div class="card" id="accounts-list">
    <h2>Step 2: Copy Access Tokens</h2>
    <p>After linking, your access tokens will appear here. Copy them to your Google Sheet.</p>
    <div id="tokens-container">
      <p><em>No accounts linked yet. Click "Link Bank Account" above.</em></p>
    </div>
  </div>

  <div class="card">
    <h2>Step 3: Add to Google Sheet</h2>
    <div class="instructions">
      <p>In your Google Sheet:</p>
      <ol>
        <li>Go to <strong>Finance Aggregator > Plaid > Add Access Token</strong></li>
        <li>Enter the institution name (e.g., "wellsfargo")</li>
        <li>Paste the access token</li>
      </ol>
      <p>Or run in Apps Script:</p>
      <code>storeAccessToken('wellsfargo', 'access-development-xxx...');</code>
    </div>
  </div>

  <script>
    let linkToken = null;

    // Get link token on page load
    fetch('/api/create-link-token')
      .then(res => res.json())
      .then(data => {
        linkToken = data.link_token;
        document.getElementById('link-btn').disabled = false;
      })
      .catch(err => {
        document.getElementById('status').innerHTML =
          '<span class="error">Error: Could not initialize Plaid. Check your credentials.</span>';
      });

    function openPlaidLink() {
      if (!linkToken) {
        alert('Link token not ready. Please refresh the page.');
        return;
      }

      const handler = Plaid.create({
        token: linkToken,
        onSuccess: async (publicToken, metadata) => {
          document.getElementById('status').innerHTML = 'Exchanging token...';

          const response = await fetch('/api/exchange-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              public_token: publicToken,
              institution: metadata.institution
            })
          });

          const data = await response.json();

          if (data.error) {
            document.getElementById('status').innerHTML =
              '<span class="error">Error: ' + data.error + '</span>';
          } else {
            document.getElementById('status').innerHTML =
              '<span class="success">Successfully linked ' + data.institution + '!</span>';
            addTokenToList(data);

            // Get a new link token for linking more accounts
            const newToken = await fetch('/api/create-link-token').then(r => r.json());
            linkToken = newToken.link_token;
          }
        },
        onExit: (err, metadata) => {
          if (err) {
            document.getElementById('status').innerHTML =
              '<span class="error">Link cancelled or error occurred.</span>';
          }
        }
      });

      handler.open();
    }

    function addTokenToList(data) {
      const container = document.getElementById('tokens-container');

      // Remove the "no accounts" message if present
      if (container.querySelector('em')) {
        container.innerHTML = '';
      }

      const item = document.createElement('div');
      item.className = 'account-item';
      item.innerHTML = \`
        <h3>\${data.institution}</h3>
        <p><strong>Institution Key:</strong> \${data.institutionKey}</p>
        <p><strong>Item ID:</strong> \${data.item_id}</p>
        <p><strong>Access Token:</strong></p>
        <div class="token-box" id="token-\${data.institutionKey}">\${data.access_token}</div>
        <button class="copy-btn" onclick="copyToken('\${data.institutionKey}')">Copy Token</button>
      \`;
      container.appendChild(item);
    }

    function copyToken(key) {
      const tokenBox = document.getElementById('token-' + key);
      navigator.clipboard.writeText(tokenBox.textContent).then(() => {
        alert('Token copied to clipboard!');
      });
    }
  </script>
</body>
</html>
  `);
});

// Create link token
app.get('/api/create-link-token', async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'finance-aggregator-user' },
      client_name: 'Finance Aggregator',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error creating link token:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error_message || error.message });
  }
});

// Exchange public token for access token
app.post('/api/exchange-token', async (req, res) => {
  try {
    const { public_token, institution } = req.body;

    const response = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;
    const institutionName = institution?.name || 'Unknown';
    const institutionKey = institutionName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Store in memory
    linkedAccounts.push({
      institution: institutionName,
      institutionKey: institutionKey,
      access_token: accessToken,
      item_id: itemId,
      linked_at: new Date().toISOString()
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`LINKED: ${institutionName}`);
    console.log(`Institution Key: ${institutionKey}`);
    console.log(`Access Token: ${accessToken}`);
    console.log(`Item ID: ${itemId}`);
    console.log(`${'='.repeat(60)}\n`);

    res.json({
      institution: institutionName,
      institutionKey: institutionKey,
      access_token: accessToken,
      item_id: itemId
    });
  } catch (error) {
    console.error('Error exchanging token:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error_message || error.message });
  }
});

// List all linked accounts (for debugging)
app.get('/api/accounts', (req, res) => {
  res.json(linkedAccounts);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Plaid Link Helper');
  console.log(`${'='.repeat(60)}`);
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.PLAID_ENV || 'development'}`);
  console.log(`\nOpen the URL above in your browser to link accounts.`);
  console.log(`${'='.repeat(60)}\n`);
});
