#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]


def patch(path: str, old: str, new: str):
    target = ROOT / path
    text = target.read_text()
    if new in text:
        print(f'already patched: {path}')
        return
    if old not in text:
        raise SystemExit(f'patch anchor not found in {path}: {old[:160]!r}')
    target.write_text(text.replace(old, new, 1))
    print(f'patched: {path}')

# Dropbox: every account token and PKCE value belongs to the active Atlas user.
patch(
    'src/lib/dropbox.ts',
    "import type { BackupPayload } from './googleDrive';\n",
    "import type { BackupPayload } from './googleDrive';\nimport {\n  getScopedCloudSessionItem,\n  removeScopedCloudSessionItem,\n  setScopedCloudSessionItem,\n} from '../services/cloudCredentialScope';\n",
)

replacements = {
    "window.sessionStorage.getItem(DROPBOX_ACCESS_TOKEN_KEY)": "getScopedCloudSessionItem(DROPBOX_ACCESS_TOKEN_KEY)",
    "window.sessionStorage.getItem(DROPBOX_ACCESS_TOKEN_EXPIRES_KEY)": "getScopedCloudSessionItem(DROPBOX_ACCESS_TOKEN_EXPIRES_KEY)",
    "window.sessionStorage.setItem(DROPBOX_ACCESS_TOKEN_KEY, token)": "setScopedCloudSessionItem(DROPBOX_ACCESS_TOKEN_KEY, token)",
    "window.sessionStorage.setItem(DROPBOX_ACCESS_TOKEN_EXPIRES_KEY, String(expiresAt))": "setScopedCloudSessionItem(DROPBOX_ACCESS_TOKEN_EXPIRES_KEY, String(expiresAt))",
    "window.sessionStorage.removeItem(DROPBOX_ACCESS_TOKEN_EXPIRES_KEY)": "removeScopedCloudSessionItem(DROPBOX_ACCESS_TOKEN_EXPIRES_KEY)",
    "window.sessionStorage.removeItem(DROPBOX_ACCESS_TOKEN_KEY)": "removeScopedCloudSessionItem(DROPBOX_ACCESS_TOKEN_KEY)",
    "window.sessionStorage.setItem(DROPBOX_PKCE_VERIFIER_KEY, verifier)": "setScopedCloudSessionItem(DROPBOX_PKCE_VERIFIER_KEY, verifier)",
    "window.sessionStorage.setItem(DROPBOX_OAUTH_STATE_KEY, state)": "setScopedCloudSessionItem(DROPBOX_OAUTH_STATE_KEY, state)",
    "window.sessionStorage.setItem(DROPBOX_REDIRECT_URI_KEY, redirectUri)": "setScopedCloudSessionItem(DROPBOX_REDIRECT_URI_KEY, redirectUri)",
    "window.sessionStorage.getItem(DROPBOX_OAUTH_STATE_KEY)": "getScopedCloudSessionItem(DROPBOX_OAUTH_STATE_KEY)",
    "window.sessionStorage.getItem(DROPBOX_PKCE_VERIFIER_KEY)": "getScopedCloudSessionItem(DROPBOX_PKCE_VERIFIER_KEY)",
    "window.sessionStorage.getItem(DROPBOX_REDIRECT_URI_KEY)": "getScopedCloudSessionItem(DROPBOX_REDIRECT_URI_KEY)",
    "window.sessionStorage.removeItem(DROPBOX_PKCE_VERIFIER_KEY)": "removeScopedCloudSessionItem(DROPBOX_PKCE_VERIFIER_KEY)",
    "window.sessionStorage.removeItem(DROPBOX_OAUTH_STATE_KEY)": "removeScopedCloudSessionItem(DROPBOX_OAUTH_STATE_KEY)",
    "window.sessionStorage.removeItem(DROPBOX_REDIRECT_URI_KEY)": "removeScopedCloudSessionItem(DROPBOX_REDIRECT_URI_KEY)",
}
for old, new in replacements.items():
    target = ROOT / 'src/lib/dropbox.ts'
    text = target.read_text()
    if old in text:
        target.write_text(text.replace(old, new))
print('patched: src/lib/dropbox.ts session credential namespace')

# Google Drive token: user-scoped session key, and Drive OAuth cannot switch Atlas UID.
patch(
    'src/lib/firebase.ts',
    "  getRedirectResult,\n  signInAnonymously,\n",
    "  getRedirectResult,\n  linkWithPopup,\n  linkWithRedirect,\n  reauthenticateWithPopup,\n  reauthenticateWithRedirect,\n  signInAnonymously,\n",
)
patch(
    'src/lib/firebase.ts',
    "import firebaseConfig from '../../firebase-applet-config.json';\n",
    "import firebaseConfig from '../../firebase-applet-config.json';\nimport {\n  getScopedCloudSessionItem,\n  removeScopedCloudSessionItem,\n  setScopedCloudSessionItem,\n} from '../services/cloudCredentialScope';\n",
)
patch(
    'src/lib/firebase.ts',
    "const DRIVE_TOKEN_KEY = 'caspa_google_drive_access_token';\nconst GOOGLE_REDIRECT_INTENT_KEY = 'caspa_google_redirect_intent';\n",
    "const DRIVE_TOKEN_KEY = 'caspa_google_drive_access_token';\nconst DRIVE_EXPECTED_UID_KEY = 'caspa_google_drive_expected_uid';\nconst GOOGLE_REDIRECT_INTENT_KEY = 'caspa_google_redirect_intent';\n",
)
patch(
    'src/lib/firebase.ts',
    "// Keep the Google API token for the browser session. Firebase itself persists the user account;\n// the API token is deliberately not written to long-lived localStorage.\nlet cachedAccessToken: string | null =\n  typeof window !== 'undefined' ? window.sessionStorage.getItem(DRIVE_TOKEN_KEY) : null;\n\nexport const setCachedAccessToken = (token: string | null) => {\n  cachedAccessToken = token;\n\n  if (typeof window === 'undefined') return;\n\n  if (token) {\n    window.sessionStorage.setItem(DRIVE_TOKEN_KEY, token);\n    // Kept only as a backwards-compatible UI hint for older components.\n    window.localStorage.setItem('ls_gdrive_connected', 'true');\n  } else {\n    window.sessionStorage.removeItem(DRIVE_TOKEN_KEY);\n    window.localStorage.removeItem('ls_gdrive_connected');\n  }\n};\n\nexport const getCachedAccessToken = (): string | null => {\n  if (!cachedAccessToken && typeof window !== 'undefined') {\n    cachedAccessToken = window.sessionStorage.getItem(DRIVE_TOKEN_KEY);\n  }\n  return cachedAccessToken;\n};\n",
    "// Keep the Google API token only for the mounted Atlas user's browser session.\n// A different Atlas UID cannot inherit this token on a shared browser.\nexport const setCachedAccessToken = (token: string | null) => {\n  if (typeof window === 'undefined') return;\n  if (token) {\n    setScopedCloudSessionItem(DRIVE_TOKEN_KEY, token);\n    // This hint lives inside the mounted per-user workspace envelope.\n    window.localStorage.setItem('ls_gdrive_connected', 'true');\n  } else {\n    removeScopedCloudSessionItem(DRIVE_TOKEN_KEY);\n    window.localStorage.removeItem('ls_gdrive_connected');\n  }\n};\n\nexport const getCachedAccessToken = (): string | null => {\n  if (typeof window === 'undefined') return null;\n  return getScopedCloudSessionItem(DRIVE_TOKEN_KEY);\n};\n",
)
patch(
    'src/lib/firebase.ts',
    "export async function connectGoogleDrive() {\n  console.log('Attempting Google Drive connection...');\n  try {\n    await authPersistenceReady;\n    clearTenantId();\n\n    if (isAppleWebKit()) {\n      return await startRedirect(googleDriveProvider, 'drive');\n    }\n\n    try {\n      const result = await signInWithPopup(auth, googleDriveProvider);\n      return await completeGoogleResult(result, true);\n    } catch (popupError: any) {\n      if (popupError?.code === 'auth/popup-closed-by-user') {\n        throw popupError;\n      }\n\n      const fallbackCodes = new Set([\n        'auth/popup-blocked',\n        'auth/cancelled-popup-request',\n        'auth/cancelled-interactive-request',\n        'auth/redirect-cancelled-by-user',\n        'auth/network-request-failed',\n      ]);\n\n      if (fallbackCodes.has(popupError.code)) {\n        console.log('Drive popup failed; falling back to redirect...', popupError.code);\n        return await startRedirect(googleDriveProvider, 'drive');\n      }\n\n      throw popupError;\n    }\n  } catch (error) {\n    const normalised = normaliseAuthError(error);\n    console.error('Google Drive connection error:', normalised);\n    throw normalised;\n  }\n}\n",
    "export async function connectGoogleDrive() {\n  console.log('Attempting Google Drive connection for the current Atlas user...');\n  try {\n    await authPersistenceReady;\n    clearTenantId();\n\n    const atlasUser = auth.currentUser;\n    if (!atlasUser) {\n      throw new Error('Sign in to an Atlas account before connecting Google Drive.');\n    }\n    const expectedUid = atlasUser.uid;\n    setScopedCloudSessionItem(DRIVE_EXPECTED_UID_KEY, expectedUid);\n    const alreadyGoogleLinked = atlasUser.providerData.some((provider) => provider.providerId === 'google.com');\n\n    if (isAppleWebKit()) {\n      if (typeof window !== 'undefined') window.sessionStorage.setItem(GOOGLE_REDIRECT_INTENT_KEY, 'drive');\n      if (alreadyGoogleLinked) {\n        await reauthenticateWithRedirect(atlasUser, googleDriveProvider);\n      } else {\n        await linkWithRedirect(atlasUser, googleDriveProvider);\n      }\n      return null;\n    }\n\n    try {\n      const result = alreadyGoogleLinked\n        ? await reauthenticateWithPopup(atlasUser, googleDriveProvider)\n        : await linkWithPopup(atlasUser, googleDriveProvider);\n      if (result.user.uid !== expectedUid) {\n        throw new Error('Google Drive authorisation returned a different Atlas identity. Connection refused.');\n      }\n      removeScopedCloudSessionItem(DRIVE_EXPECTED_UID_KEY);\n      return await completeGoogleResult(result, true);\n    } catch (popupError: any) {\n      if (popupError?.code === 'auth/popup-closed-by-user') throw popupError;\n      const fallbackCodes = new Set([\n        'auth/popup-blocked',\n        'auth/cancelled-popup-request',\n        'auth/cancelled-interactive-request',\n        'auth/redirect-cancelled-by-user',\n        'auth/network-request-failed',\n      ]);\n      if (fallbackCodes.has(popupError.code)) {\n        if (typeof window !== 'undefined') window.sessionStorage.setItem(GOOGLE_REDIRECT_INTENT_KEY, 'drive');\n        if (alreadyGoogleLinked) {\n          await reauthenticateWithRedirect(atlasUser, googleDriveProvider);\n        } else {\n          await linkWithRedirect(atlasUser, googleDriveProvider);\n        }\n        return null;\n      }\n      throw popupError;\n    }\n  } catch (error) {\n    removeScopedCloudSessionItem(DRIVE_EXPECTED_UID_KEY);\n    const normalised = normaliseAuthError(error);\n    console.error('Google Drive connection error:', normalised);\n    throw normalised;\n  }\n}\n",
)
patch(
    'src/lib/firebase.ts',
    "    if (result) {\n      const user = await completeGoogleResult(result, intent === 'drive');\n      if (typeof window !== 'undefined') {\n        window.sessionStorage.removeItem(GOOGLE_REDIRECT_INTENT_KEY);\n      }\n      return user;\n    }\n",
    "    if (result) {\n      if (intent === 'drive') {\n        const expectedUid = getScopedCloudSessionItem(DRIVE_EXPECTED_UID_KEY);\n        if (!expectedUid || result.user.uid !== expectedUid) {\n          removeScopedCloudSessionItem(DRIVE_EXPECTED_UID_KEY);\n          throw new Error('Google Drive authorisation did not return to the same Atlas user. Connection refused.');\n        }\n        removeScopedCloudSessionItem(DRIVE_EXPECTED_UID_KEY);\n      }\n      const user = await completeGoogleResult(result, intent === 'drive');\n      if (typeof window !== 'undefined') {\n        window.sessionStorage.removeItem(GOOGLE_REDIRECT_INTENT_KEY);\n      }\n      return user;\n    }\n",
)

# Explicitly clear that Atlas user's cloud credentials before unmounting the user DB.
patch(
    'src/App.tsx',
    "import { ingestKnowledgeText } from './services/knowledgeClient';\n",
    "import { ingestKnowledgeText } from './services/knowledgeClient';\nimport { clearCloudCredentialsForScope } from './services/cloudCredentialScope';\n",
)
patch(
    'src/App.tsx',
    "  const handleSignOut = async () => {\n    try {\n      persistActiveUserDatabase();\n",
    "  const handleSignOut = async () => {\n    try {\n      clearCloudCredentialsForScope();\n      persistActiveUserDatabase();\n",
)

# Make the UI promise match the enforced behaviour.
patch(
    'src/components/KnowledgeCloudPanel.tsx',
    "          <span style={small}>{googleConnected ? 'Connected for this browser session' : 'Not connected'}</span>\n",
    "          <span style={small}>{googleConnected ? 'Connected to this Atlas user for this browser session' : 'Not connected'}</span>\n",
)
patch(
    'src/components/KnowledgeCloudPanel.tsx',
    "          <span style={small}>{dropboxConnected ? 'Connected for this browser session' : 'Not connected'}</span>\n",
    "          <span style={small}>{dropboxConnected ? 'Connected to this Atlas user for this browser session' : 'Not connected'}</span>\n",
)
patch(
    'src/components/KnowledgeCloudPanel.tsx',
    "        Exact duplicates across providers are linked to one canonical index entry. Large archives and unsupported binaries are skipped rather than copied. Current cloud tokens are session-only; unattended refresh-token syncing belongs on the server, not in browser storage.\n",
    "        Cloud access tokens are session-only, namespaced to the mounted Atlas user and destroyed on Atlas sign-out. Exact duplicates across providers are linked to one canonical index entry. Large archives and unsupported binaries are skipped rather than copied. Unattended refresh-token syncing belongs in encrypted server-side per-user storage, not browser storage.\n",
)

trigger = ROOT / '.deploy-atlas-trigger'
now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
trigger.write_text(f'deploy requested {now}\nreason: enforce per-user Drive and Dropbox credential isolation\n')
print('updated: .deploy-atlas-trigger')
