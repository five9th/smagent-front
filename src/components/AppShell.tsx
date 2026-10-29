import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ACCOUNTS_CHANGED_EVENT, accountsApi } from '../api/accounts'
import { useApiQuery } from '../hooks/useApiQuery'
import { useAuth } from '../hooks/useAuth'
import { Icon, type IconName } from './Icon'
import { AdminSettingsModal } from './AdminSettingsModal'
import { VersionLine } from './VersionLine'

const NAV: Array<{ to: string; label: string; icon: IconName }> = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/posts', label: 'Posts', icon: 'posts' },
  { to: '/inbox', label: 'Inbox', icon: 'inbox' },
  { to: '/ai', label: 'AI Assistant', icon: 'ai' },
  { to: '/accounts', label: 'Accounts', icon: 'accounts' },
]

function viewTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard'
  if (pathname.startsWith('/posts')) return 'Posts'
  if (pathname.startsWith('/accounts')) return 'Accounts'
  if (pathname.startsWith('/ai')) return 'AI Assistant'
  if (pathname.startsWith('/inbox')) return 'Inbox'
  if (pathname.startsWith('/feedback')) return 'Demo feedback'
  return 'SMAgent'
}

function statusDot(status: string): string {
  return status === 'ACTIVE' ? 'i-ok' : status === 'INVALID' ? 'i-bad' : 'i-warn'
}

function toggleTheme() {
  const root = document.documentElement
  const next = root.dataset.theme === 'light' ? 'dark' : 'light'
  root.dataset.theme = next
  try {
    localStorage.setItem('smagent-theme', next)
  } catch {
    /* private mode — theme just won't persist */
  }
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const [adminOpen, setAdminOpen] = useState(false)
  const nav = useNavigate()
  const { pathname } = useLocation()
  const { data: accounts, refetch: refetchAccounts } = useApiQuery(() => accountsApi.list(), [
    'accounts',
    'shell',
  ])

  // Account mutations on the Accounts page announce themselves; refresh so the
  // topbar health dots always reflect the latest statuses.
  useEffect(() => {
    const onChange = () => refetchAccounts()
    window.addEventListener(ACCOUNTS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(ACCOUNTS_CHANGED_EVENT, onChange)
  }, [refetchAccounts])

  const onLogout = async () => {
    await logout()
    nav('/login')
  }

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          <div className="mark">SM</div>
          <div>
            <b>SMAgent</b>
            <span>Social Agent</span>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <nav className="nav nav-bottom">
          <NavLink to="/feedback">
            <Icon name="feedback" />
            <span>Demo feedback</span>
          </NavLink>
        </nav>
        <div className="foot">
          <div className="avatar">{(user?.username ?? '?').slice(0, 1).toUpperCase()}</div>
          <div className="who">
            <b>{user?.username ?? ''}</b>
            <span>{user?.role ?? ''}</span>
          </div>
          <button className="tbtn" onClick={onLogout} title="Log out" aria-label="Log out">
            <Icon name="logout" />
          </button>
        </div>
        <VersionLine />
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <h1>{viewTitle(pathname)}</h1>
            <div className="sub mono">{today}</div>
          </div>
          <div className="spacer" />
          <div className="health">
            {(accounts ?? []).map((a) => (
              <span key={a.id} className="dot" title={`${a.displayName ?? a.platform} — ${a.status}`}>
                <i className={statusDot(a.status)} />
                <span>{a.platform.charAt(0) + a.platform.slice(1).toLowerCase()}</span>
              </span>
            ))}
          </div>
          <Link className="tbtn gold" to="/posts/new">
            <Icon name="plus" />
            New post
          </Link>
          {/* Desktop rail has the Demo feedback tab; on mobile this is the only entry point. */}
          <Link className="tbtn feedback-btn" to="/feedback" title="Demo feedback" aria-label="Demo feedback">
            <Icon name="feedback" />
          </Link>
          <button
            className="tbtn"
            onClick={() => setAdminOpen(true)}
            title="Admin settings (OAuth app credentials)"
            aria-label="Admin settings"
          >
            <Icon name="settings" />
          </button>
          <button className="tbtn" onClick={toggleTheme} title="Toggle light / dark" aria-label="Toggle theme">
            ◐
          </button>
        </header>

        <section className="view">
          <div className="view-inner">
            <Outlet />
          </div>
        </section>

        <nav className="mnav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {adminOpen && <AdminSettingsModal onClose={() => setAdminOpen(false)} />}
    </div>
  )
}
