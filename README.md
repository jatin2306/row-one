# Row One

Row One is a React app for the Google account you sign in with. It lists your spreadsheets, opens a tab as a table, and lets you add, edit, or delete any row. It can also create a spreadsheet: you choose the file name, the tab name, and the column headers, and the app writes those headers, in order, into row 1.

It runs entirely in the browser. There is no custom backend, database, or Google Apps Script. The only Google credential in the project is a public OAuth client ID. Do not add a client secret, private key, or refresh token.

## What you need

- Node.js 20 or newer
- A Google account
- A Google Cloud project where you can enable APIs and create an OAuth client

## 1. Enable the Google APIs

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. Open [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com) and click **Enable**.
3. Open [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com) and click **Enable**. Drive is used only to list spreadsheet names. Row contents are read and written with the Sheets API.

## 2. Configure the OAuth consent screen

1. Go to [Google Auth platform → Branding](https://console.cloud.google.com/auth/branding).
2. If the platform is not set up yet, click **Get started**.
3. Set the app name to `Row One` and choose your email as the user support email.
4. For a personal Gmail account, set the audience to **External**. For a Google Workspace organization, **Internal** is enough if only people in that organization will use it.
5. Leave an External app in **Testing** while you are the only user. Add your Google account under [Audience → Test users](https://console.cloud.google.com/auth/audience).
6. Open [Data Access](https://console.cloud.google.com/auth/scopes) and add these scopes:

   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.metadata.readonly`
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`

   `spreadsheets` lets the app create a spreadsheet and read or change its rows. `drive.metadata.readonly` lets the app list spreadsheet names and links. It does not read other Drive files. The other three only let the app show which Google account is signed in.

While the app is in Testing, Google shows an unverified-app warning. That is expected. Continue past it only because you created the Cloud project and added yourself as a test user. Publishing an External app for other people requires Google’s verification of the sensitive Sheets scope. You do not need verification to use the app yourself in Testing.

## 3. Create a browser OAuth client ID

1. Open [Google Auth platform → Clients](https://console.cloud.google.com/auth/clients).
2. Click **Create client**.
3. Choose application type **Web application**.
4. Name it `Row One local`.
5. Under **Authorized JavaScript origins**, add:

   ```text
   http://localhost:5173
   ```

   Use the origin only. Do not add a trailing slash or a path. The Google Identity Services token flow used here does not need an authorized redirect URI.

6. Create the client and copy the **client ID**. It ends in `.apps.googleusercontent.com`.

Google’s JavaScript Sheets quickstart does not use a client secret for a Web application. If the console also shows a client secret, leave it there. Do not copy it into this project, a `.env` file, source code, or the browser.

## 4. Run the app

```bash
cd row-one
npm install
copy .env.example .env
```

On macOS or Linux, use `cp .env.example .env` instead of `copy`.

Edit `.env`:

```bash
VITE_GOOGLE_CLIENT_ID=1234567890-abcdef.apps.googleusercontent.com
```

Replace the example with your client ID, then start the app:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The host and port must match the authorized JavaScript origin. Restart the dev server after changing `.env`.

## 5. Create a spreadsheet

1. Click **Sign in with Google** and choose the account that should own the file.
2. Allow the Sheets and Drive permissions. If Google says the app is unverified, choose **Advanced** and continue only for the Cloud project you just configured.
3. Enter a spreadsheet name and a sheet tab name.
4. Add, edit, delete, and reorder columns. The preview shows row 1 in that order. Alt+Up and Alt+Down also reorder a column.
5. Click **Create spreadsheet**.

The app calls `spreadsheets.create` on the Google Sheets API. Google returns the file URL. **Open spreadsheet** opens that file in a new tab. The signed-in account owns it, and it also appears in Google Drive.

The created tab is the only tab. Row 1 is frozen and bold, with those column names from left to right. Refreshing the page keeps the signed-in account in this tab. Creating again makes a second spreadsheet, even if the name matches.

## 6. View and edit rows

1. Open **Your spreadsheets**. The list is every spreadsheet in the signed-in account, newest first.
2. Click **View table** to load the first tab. If the file has more than one tab, use the tab menu.
3. **Add row** appends a row. **Edit** changes that sheet row. **Delete** removes it after you confirm.
4. Row 1 is included, so a header row can be edited or deleted like any other row.

Sign out and sign in again after adding the Drive scope so Google grants the new permission. A normal page refresh keeps the account signed in.

## How sign-in works

The page loads two official browser libraries:

- [Google Identity Services](https://accounts.google.com/gsi/client), which opens Google’s account prompt and returns an access token
- [Google API JavaScript client](https://apis.google.com/js/api.js), which calls the Sheets API with that token

This is the browser flow from Google’s [Sheets JavaScript quickstart](https://developers.google.com/workspace/sheets/api/quickstart/js). The access token is kept in `sessionStorage` for this tab so a refresh stays signed in. Sign out deletes it. Nothing is written to `localStorage`, and no request is sent to a server you operate. Google access tokens still expire after about an hour.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the app at http://localhost:5173 |
| `npm test` | Run validation and guard tests |
| `npm run lint` | Run oxlint |
| `npm run build` | Build the production bundle |

## Troubleshooting

**Sign-in button stays disabled.** `VITE_GOOGLE_CLIENT_ID` is missing, still the placeholder, or not a Web client ID. Restart `npm run dev` after saving `.env`.

**“This site is not an authorized JavaScript origin.”** Add `http://localhost:5173` to the Web client, with no trailing slash. Open that exact URL, not `127.0.0.1`.

**Popup closes or never appears.** Allow popups for localhost. Sign in again and wait until you accept the Sheets permission.

**`access_denied` or “app blocked”.** The consent screen is in Testing and the signed-in account is not a test user, or the Sheets scope was not added under Data Access.

**403, Sheets API or Drive API has not been used or is disabled.** Enable both APIs on the same Cloud project as the OAuth client, wait a minute, and try again.

**The spreadsheet list asks you to sign in again.** The Drive metadata scope was added after the last consent. Sign out, sign in, and allow both Sheets and Drive access. Add that scope under Data Access if Google rejects it.

**401 or “session expired”.** Sign in again. Access tokens last about an hour. A refresh keeps a token that is still valid; after it expires, sign in again.

**The file was created but you cannot see it.** It belongs to the Google account you selected in the prompt. Check that account’s Drive, or open the URL from the success panel.

## Use a deployed site

Add the deployed origin, such as `https://sheets.example.com`, to the same Web client’s authorized JavaScript origins. Serve the app over HTTPS. Keep the client ID in the host’s environment as `VITE_GOOGLE_CLIENT_ID` at build time. Still do not add a client secret. An External app that other people can use must be published, and the sensitive `spreadsheets` scope must pass Google’s verification.
