import { api } from './client'

export interface BuildInfo {
  build?: {
    version?: string
    time?: string
  }
}

export const systemApi = {
  /**
   * Backend build info from Spring's public actuator endpoint
   * ({ build: { version, … } }). Resolved under the app's base path
   * (/actuator/info in dev, /smagent/actuator/info on the demo VPS) so the
   * reverse proxy can forward it. Returns null when unreachable — the version
   * line degrades to a dash instead of erroring.
   */
  buildInfo: () =>
    api<BuildInfo>(
      'GET',
      `${import.meta.env.BASE_URL}actuator/info`,
      undefined,
      true,
    ),
}
