import { useState } from 'react'
import { errorMessage } from '../../lib/errors'
import type { SignInCheck } from '../../shared/download'
import {
  YOUTUBE_BROWSERS,
  type CookieSource,
  type DownloadPace,
  type YoutubeBrowser,
  type YoutubeCookies
} from '../../shared/settings'
import { useSettings } from '../../store/SettingsContext'
import PathField from '../item/PathField'
import SegmentedControl from '../item/SegmentedControl'
import SelectField from '../item/SelectField'
import './YoutubeSignIn.css'

const SOURCE_OPTIONS: { value: CookieSource; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'browser', label: 'From a browser' },
  { value: 'file', label: 'From a file' }
]

const PACE_OPTIONS: { value: DownloadPace; label: string }[] = [
  { value: 'fast', label: 'Fast' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'gentle', label: 'Gentle' }
]

const PACE_HINTS: Record<DownloadPace, string> = {
  fast: 'No waiting between tracks. YouTube may refuse after about a hundred tracks.',
  balanced: 'A few seconds between tracks. A good choice for most playlists.',
  gentle: 'About 5 to 10 seconds between tracks. Best for very long playlists.'
}

function summary(cookies: YoutubeCookies): string {
  if (cookies.source === 'browser') {
    return YOUTUBE_BROWSERS.find((browser) => browser.value === cookies.browser)?.label ?? 'Browser'
  }
  if (cookies.source === 'file') return cookies.file === '' ? 'No file chosen' : 'Cookies file'
  return 'Off'
}

/**
 * YouTube sometimes answers "Sign in to confirm you're not a bot". Giving yt-dlp the cookies of
 * a signed-in browser, or a cookies.txt file, gets past it.
 */
export default function YoutubeSignIn({ defaultOpen }: { defaultOpen: boolean }) {
  const { settings, updateDownload } = useSettings()
  const cookies = settings.download.cookies
  const [checking, setChecking] = useState(false)
  const [check, setCheck] = useState<SignInCheck | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  function change(patch: Partial<YoutubeCookies>) {
    setCheck(null)
    setFailure(null)
    updateDownload({ cookies: { ...cookies, ...patch } })
  }

  async function chooseFile() {
    setFailure(null)
    try {
      const file = await window.api.chooseCookiesFile()
      if (file) change({ source: 'file', file })
    } catch (error) {
      setFailure(errorMessage(error))
    }
  }

  async function runCheck() {
    setChecking(true)
    setCheck(null)
    setFailure(null)
    try {
      setCheck(await window.api.checkYoutubeSignIn(cookies))
    } catch (error) {
      setFailure(errorMessage(error))
    } finally {
      setChecking(false)
    }
  }

  return (
    // A new key opens the box again when a download fails because of the sign-in.
    <details className="yt-signin" key={String(defaultOpen)} open={defaultOpen}>
      <summary>
        YouTube sign-in and speed
        <span className={`yt-signin-badge ${cookies.source === 'off' ? '' : 'on'}`}>
          {summary(cookies)}
        </span>
      </summary>

      <div className="yt-signin-body">
        <p>
          YouTube sometimes refuses downloads with &ldquo;Sign in to confirm you&rsquo;re not a
          bot&rdquo;. Giving yt-dlp the sign-in of a browser where you are logged in to YouTube gets
          past it.
        </p>

        <SegmentedControl
          label="Where the YouTube sign-in comes from"
          options={SOURCE_OPTIONS}
          value={cookies.source}
          onChange={(source) => change({ source })}
        />

        {cookies.source === 'browser' && (
          <>
            <div className="yt-signin-row">
              <SelectField<YoutubeBrowser>
                label="Browser"
                value={cookies.browser}
                options={YOUTUBE_BROWSERS}
                onChange={(browser) => change({ browser })}
              />
            </div>
            <ul className="yt-signin-tips">
              <li>Be signed in to YouTube in that browser.</li>
              <li>
                Firefox works best. Chrome, Edge and Brave often cannot share their cookies while
                they are open, or because they encrypt them: close the browser first, or use a file
                instead.
              </li>
            </ul>
          </>
        )}

        {cookies.source === 'file' && (
          <>
            <PathField label="Cookies file" path={cookies.file === '' ? null : cookies.file}>
              <button type="button" className="btn" onClick={() => void chooseFile()}>
                Choose file...
              </button>
              {cookies.file !== '' && (
                <button type="button" className="btn" onClick={() => change({ file: '' })}>
                  Clear
                </button>
              )}
            </PathField>
            <ul className="yt-signin-tips">
              <li>
                Export your YouTube cookies as a <code>cookies.txt</code> file with a browser
                extension such as &ldquo;Get cookies.txt LOCALLY&rdquo;.
              </li>
              <li>
                For cookies that keep working: open a private window, sign in to YouTube, open{' '}
                <code>youtube.com/robots.txt</code>, export the cookies from that tab, then close
                the private window.
              </li>
              <li>The file stays where it is. yt-dlp may update it.</li>
            </ul>
          </>
        )}

        <div className="yt-signin-row">
          <button type="button" className="btn" disabled={checking} onClick={() => void runCheck()}>
            {checking ? 'Testing...' : 'Test sign-in'}
          </button>
          {check && (
            <span className={check.ok ? 'settings-success' : 'settings-error'} role="status">
              {check.message}
              {check.version && ` (yt-dlp ${check.version})`}
            </span>
          )}
          {failure && (
            <span className="settings-error" role="status">
              {failure}
            </span>
          )}
        </div>

        <div className="yt-signin-pace">
          <span>Speed of long downloads</span>
          <SegmentedControl
            label="Speed of long downloads"
            options={PACE_OPTIONS}
            value={settings.download.pace}
            onChange={(pace) => updateDownload({ pace })}
          />
          <p className="yt-signin-tips">{PACE_HINTS[settings.download.pace]}</p>
          <p className="yt-signin-tips">
            If YouTube still stops a long playlist, Ambrosia waits a few minutes, then goes on from
            where it stopped, at the gentle speed. It keeps the tracks that are done.
          </p>
        </div>

        <p className="yt-signin-note">
          Cookies give access to your YouTube account, so keep the file private. YouTube can
          sometimes flag an account that is used for downloads: a spare account is safer. YouTube
          also changes often, so keep yt-dlp up to date with{' '}
          <code>winget upgrade yt-dlp.yt-dlp</code>.
        </p>
      </div>
    </details>
  )
}
