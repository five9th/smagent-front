import featuresDoc from '../../FEATURES.md?raw'
import { systemApi } from '../api/system'
import { useApiQuery } from '../hooks/useApiQuery'

/** Open the feature guide as plain text in a new tab (a blob, so it works from any base path). */
function openFeatureGuide() {
  const url = URL.createObjectURL(new Blob([featuresDoc], { type: 'text/plain' }))
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Build versions in the rail footer: the frontend version is baked in at
 * build time (package.json version + git hash); the backend's comes from the
 * public /actuator/info endpoint. A dash means the backend didn't answer —
 * never an error worth surfacing louder.
 */
export function VersionLine() {
  const { data } = useApiQuery(() => systemApi.buildInfo().catch(() => null), ['actuator-info'])
  const backend = data?.build?.version ?? '—'
  const builtAt = data?.build?.time ? new Date(data.build.time).toLocaleDateString('en-GB') : null

  return (
    <div className="versions mono">
      <div title="frontend build (package.json version + git commit)">front {__APP_VERSION__}</div>
      <div title={builtAt ? `backend built ${builtAt}` : 'backend build version (/actuator/info)'}>
        back {backend}
      </div>
      <button
        className="linklike"
        onClick={openFeatureGuide}
        title="What the app can do and how to use it — opens as plain text in a new tab"
      >
        feature guide
      </button>
    </div>
  )
}
