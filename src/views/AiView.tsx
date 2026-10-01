import { useState } from 'react'
import { Callout, Pill, PlatformChip, SectionHead } from '../components/ui'
import { Icon } from '../components/Icon'
import { PLATFORMS, PLATFORM_LIST } from '../lib/platform'
import type { Platform } from '../api/types'

/**
 * STUB VIEW — the backend endpoints for AI providers (/api/ai-providers) and
 * generation (/api/ai/generate, /api/ai/chat) are designed but not implemented
 * yet. This screen previews the planned UI; every control is inert.
 */

type Tab = 'providers' | 'generate'

function ProvidersTab() {
  return (
    <>
      <SectionHead
        title="AI providers"
        hint="keep several providers and switch the active one anytime"
        actions={
          <span className="dim">
            <button className="btn primary" disabled>
              <Icon name="plus" />
              Add provider
            </button>
          </span>
        }
      />

      <div className="grid cols-2">
        {/* Example card — shows the intended design, clearly marked as sample */}
        <div className="card pad" style={{ position: 'relative' }}>
          <span
            className="pill p-scheduled"
            style={{ position: 'absolute', top: 14, right: 14 }}
          >
            <i />
            example
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span className="avatar">A</span>
            <div>
              <b>Anthropic main</b>
              <div className="meta mono" style={{ color: 'var(--text-mute)', fontSize: 11 }}>
                ANTHROPIC · api.anthropic.com
              </div>
            </div>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <Pill value="PLANNED" label="active" />
            </span>
          </div>
          <div className="kv">
            <span className="k">API key</span>
            <span className="v mono" style={{ fontSize: 11 }}>••••••••7f2a</span>
            <span className="k">Default model</span>
            <span className="v mono" style={{ fontSize: 11 }}>claude-sonnet-5</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="score-line" style={{ gridTemplateColumns: '116px 1fr 54px' }}>
              <span className="sl">Tokens used</span>
              <span className="meter">
                <i style={{ width: 42 }} />
              </span>
              <span className="sv">200.5k</span>
            </div>
            <p className="hint" style={{ margin: '4px 0 0' }}>
              152.3k in · 48.2k out · 37 requests — usage is tracked automatically; “remaining credits”
              appears only for providers that report it.
            </p>
          </div>
          <div className="btn-row dim" style={{ marginTop: 12 }}>
            <button className="btn" disabled>
              <Icon name="refresh" />
              Verify
            </button>
            <button className="btn" disabled>
              Activate
            </button>
            <button className="btn danger" disabled>
              <Icon name="trash" />
              Remove
            </button>
          </div>
        </div>

        <div className="card pad">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Supported provider types
          </div>
          <div className="kv" style={{ gridTemplateColumns: '180px 1fr' }}>
            <span className="k">Anthropic</span>
            <span>Claude models via Anthropic’s own API</span>
            <span className="k">OpenAI-compatible</span>
            <span>OpenAI, OpenRouter, Groq, Mistral, DeepSeek, local Ollama and more</span>
          </div>
          <div style={{ marginTop: 14 }} className="callout">
            API keys will be stored securely and never shown in full — just like your social account
            credentials.
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />
      <Callout tone="warn">
        <b>Not available yet.</b> This is a preview: connect several AI providers, mark one active, and
        keep an eye on token usage.
      </Callout>
    </>
  )
}

function GenerateTab() {
  // Stub view — the platform picker below is inert, so a constant is enough.
  const platform: Platform = 'FACEBOOK'
  return (
    <>
      <SectionHead title="Generate post text" hint="AI only generates text — images stay manual for now" />
      <div className="composer-grid" style={{ gridTemplateColumns: '1fr 320px' }}>
        <div className="card pad dim">
          <label className="field">
            <span className="lab">What should the post say?</span>
            <textarea rows={4} disabled placeholder="e.g. Post about releasing v2 of our CLI tool" />
          </label>
          <div className="grid cols-2">
            <label className="field">
              <span className="lab">Tone</span>
              <select disabled defaultValue="casual">
                <option value="casual">casual</option>
                <option value="professional">professional</option>
                <option value="playful">playful</option>
              </select>
            </label>
            <label className="field">
              <span className="lab">Max length</span>
              <input type="number" disabled defaultValue={500} />
            </label>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <input type="checkbox" disabled />
            <span style={{ fontSize: 12.5 }}>Needs a title (Reddit)</span>
          </label>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn primary" disabled>
              <Icon name="ai" />
              Generate
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card pad dim">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Provider / model
            </div>
            <label className="field">
              <span className="lab">Provider</span>
              <select disabled defaultValue="">
                <option value="">no providers configured yet</option>
              </select>
            </label>
            <label className="field">
              <span className="lab">Model</span>
              <select disabled defaultValue="">
                <option value="">provider’s default</option>
              </select>
            </label>
            <div className="eyebrow" style={{ margin: '6px 0 8px' }}>
              Platform shaping
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PLATFORM_LIST.map((p) => (
                <button
                  key={p}
                  className="btn ghost"
                  style={{
                    padding: '5px 10px',
                    fontSize: 11.5,
                    borderColor: p === platform ? 'var(--gold-line)' : undefined,
                    color: p === platform ? 'var(--text)' : undefined,
                  }}
                  disabled
                >
                  <PlatformChip platform={p} />
                </button>
              ))}
            </div>
            <p className="hint" style={{ margin: '8px 0 0' }}>
              Generated text is written to fit the platform — {PLATFORMS[platform].label}:{' '}
              {PLATFORMS[platform].requiresTitle ? 'a title plus the body' : 'just the body'}, up to ~
              {PLATFORMS[platform].maxLength.toLocaleString('en-US')} characters.
            </p>
          </div>

          <div className="card pad">
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Planned flow
            </div>
            <p className="hint" style={{ margin: 0 }}>
              Generate → preview → edit → send to the composer. Nothing is ever posted automatically.
              You’ll also be able to refine a draft in a short chat: “shorter”, “add an emoji”, …
            </p>
          </div>
        </div>
      </div>
      <div style={{ height: 14 }} />
      <Callout tone="warn">
        <b>Not available yet.</b> Once it’s here, you’ll draft with your chosen provider and tweak the
        result before it ever reaches a platform.
      </Callout>
    </>
  )
}

export default function AiView() {
  const [tab, setTab] = useState<Tab>('providers')
  return (
    <>
      <SectionHead
        title="AI Assistant"
        hint={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>planned — not available yet <Pill value="PLANNED" /></span>}
      />
      <div className="tabs">
        <button className={tab === 'providers' ? 'active' : ''} onClick={() => setTab('providers')}>
          Providers &amp; usage
        </button>
        <button className={tab === 'generate' ? 'active' : ''} onClick={() => setTab('generate')}>
          Generate
        </button>
      </div>
      {tab === 'providers' ? <ProvidersTab /> : <GenerateTab />}
    </>
  )
}
