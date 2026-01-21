# Plaid Link Helper

A simple local tool to link bank accounts via Plaid and get access tokens.

## Setup

1. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your Plaid credentials:**
   ```
   PLAID_CLIENT_ID=your_client_id
   PLAID_SECRET=your_development_secret
   PLAID_ENV=development
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Open in browser:**
   ```
   http://localhost:3000
   ```

## Usage

1. Click "Link Bank Account"
2. Select your bank and log in
3. Complete MFA if required
4. Access token appears on the page
5. Copy the token
6. Add to Google Sheet via **Finance Aggregator > Plaid > Add Access Token**

## Security Notes

- Access tokens are shown in the browser and logged to console
- Don't run this on a public server
- Close the server after linking accounts
- Tokens are not stored persistently by this tool
