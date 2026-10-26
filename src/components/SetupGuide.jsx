import { clientIdMessage } from '../lib/clientId.js'

export function SetupGuide({ reason }) {
  return (
    <section className="rounded-2xl border border-line bg-card/90 p-5 shadow-sm">
      {reason ? (
        <p role="alert" className="mb-4 rounded-xl bg-[#fdf1ee] px-3 py-2 text-sm text-clay">
          {clientIdMessage(reason)}
        </p>
      ) : (
        <p className="mb-3 text-sm text-mute">
          Row One calls the Google Sheets API from this browser. A public Web client ID is the only Google credential it uses.
        </p>
      )}
      <details key={reason || 'ready'} open={Boolean(reason)} className="group">
        <summary className="cursor-pointer text-sm font-semibold">Google Cloud setup</summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 break-words text-ink/90">
          <li>
            In{' '}
            <a className="font-medium text-moss underline" href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">
              Google Cloud Console
            </a>
            , create or select a project.
          </li>
          <li>
            Enable the{' '}
            <a className="font-medium text-moss underline" href="https://console.cloud.google.com/apis/library/sheets.googleapis.com" target="_blank" rel="noopener noreferrer">
              Google Sheets API
            </a>{' '}
            and the{' '}
            <a className="font-medium text-moss underline" href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener noreferrer">
              Google Drive API
            </a>
            . Drive lists spreadsheet names and shares a spreadsheet with an email you add.
          </li>
          <li>
            Open Google Auth platform and configure the consent screen. For a personal Gmail account, set the audience to External and leave the app in Testing. Add your Google account under test users.
          </li>
          <li>
            Under Data Access, add <code className="rounded bg-paper px-1 py-0.5 text-xs break-all">https://www.googleapis.com/auth/spreadsheets</code> and <code className="rounded bg-paper px-1 py-0.5 text-xs break-all">https://www.googleapis.com/auth/drive</code>, plus the openid, email, and profile scopes so the app can show which account is signed in. Sign out and sign in again after adding the Drive scope.
          </li>
          <li>
            Create an OAuth client of type Web application. Add <code className="rounded bg-paper px-1 py-0.5 text-xs break-all">http://localhost:5173</code> as an authorized JavaScript origin. Do not put a client secret in this app.
          </li>
          <li>
            Copy <code className="rounded bg-paper px-1 py-0.5 text-xs break-all">.env.example</code> to <code className="rounded bg-paper px-1 py-0.5 text-xs break-all">.env</code>, set <code className="rounded bg-paper px-1 py-0.5 text-xs break-all">VITE_GOOGLE_CLIENT_ID</code>, and restart <code className="rounded bg-paper px-1 py-0.5 text-xs break-all">npm run dev</code>.
          </li>
        </ol>
        <p className="mt-3 text-sm text-mute">
          The full click-path, consent-screen notes, and troubleshooting are in the project README.
        </p>
      </details>
    </section>
  )
}
