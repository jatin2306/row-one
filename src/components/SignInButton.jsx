function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}

export function SignInButton({ disabled, busy, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex h-10 items-center gap-3 rounded-md border border-[#747775] bg-white px-4 text-sm font-medium text-[#1f1f1f] shadow-sm transition hover:bg-[#f7f8f8] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? (
        <span className="size-4 animate-spin rounded-full border-2 border-[#1f1f1f]/20 border-t-[#1f1f1f]" />
      ) : (
        <GoogleGlyph />
      )}
      {busy ? 'Waiting for Google…' : 'Sign in with Google'}
    </button>
  )
}

function initialFor(session) {
  const source = session.name || session.email || '?'
  return source.trim().charAt(0).toUpperCase() || '?'
}

export function AccountChip({ session, onSignOut, disabled }) {
  const label = session.email || session.name || 'Signed in to Google'

  return (
    <div className="flex items-center gap-3 rounded-full border border-line bg-card py-1 pr-1.5 pl-1.5 shadow-sm">
      {session.picture ? (
        <img
          src={session.picture}
          alt=""
          referrerPolicy="no-referrer"
          className="size-8 rounded-full object-cover"
        />
      ) : (
        <span className="flex size-8 items-center justify-center rounded-full bg-moss text-sm font-semibold text-white">
          {initialFor(session)}
        </span>
      )}
      <span className="max-w-44 truncate text-sm font-medium" title={label}>
        {label}
      </span>
      <button
        type="button"
        onClick={onSignOut}
        disabled={disabled}
        className="rounded-full px-3 py-1.5 text-sm font-medium text-moss hover:bg-moss/10 disabled:opacity-50"
      >
        Sign out
      </button>
    </div>
  )
}
