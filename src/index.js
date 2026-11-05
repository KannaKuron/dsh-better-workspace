/**
 * dsh-better-workspace — host half (plain JavaScript, no build step).
 *
 * The feature lives in the client half (src/client.js): the hierarchy tree,
 * the add-workspace flow, and view state (persisted in the browser through the
 * dsh client store). This host half exists so the cordis plugin row has a
 * valid Node entry and so Config metadata is available to the Loader.
 */
import { registerTitleSource } from './title-source.js'

export const name = 'dsh-better-workspace'

/**
 * The schemastery module, resolved LAZILY: it is a PEER, so a profile whose
 * node_modules does not hoist it — the desktop app's bundled runtime, or any
 * install that resolved the peers elsewhere — would otherwise fail the static
 * import at the top of this file. The Loader treats a failed plugin import as
 * a non-fatal skip (ctx.logger.error + no fiber), so the row silently never
 * mounted: no host half, no dsh.client scan, no client bundle in the boot
 * graph, and the official sidebar quietly took the seat — the same
 * all-green-log failure class as issue #9. Deferring the import hides the
 * schema where the module is absent instead of killing the row. Null when
 * unresolvable.
 */
let Schema = null
try {
  Schema = (await import('@deepseek-ai/schemastery')).default
} catch (error) {
  Schema = null
  console.warn(
    '[dsh-better-workspace] @deepseek-ai/schemastery is not resolvable here; the row Config surface is absent'
    + ' (the browser features do not depend on it): ' + (error && error.message || String(error)),
  )
}

/**
 * Row Config = the settings surface on dsh >= 0.2.2-rc.1. Values persist in
 * this profile's plugin patch; the shared-settings-home era is gone. Every
 * field is volatile so the settings card can live-edit it without a remount.
 * Absent when schemastery is unresolvable (cordis then passes the row config
 * through unvalidated; the browser half reads every value with its own
 * fallbacks either way).
 */
export const Config = Schema === null
  ? undefined
  : Schema.object({
    compactChains: Schema.boolean().default(true).volatile(),
    statusPulse: Schema.boolean().default(true).volatile(),
    styling: Schema.dict(Schema.any()).default({}).volatile(),
    appearance: Schema.dict(Schema.any()).default({}).volatile(),
  })

export const inject = ['sessionProjections']

export async function apply(ctx) {
  const log = ctx && ctx.logger && typeof ctx.logger.info === 'function'
    ? (msg) => ctx.logger.info(msg)
    : (msg) => console.log(msg)
  const registered = await registerTitleSource(ctx, log)
  log('[dsh-better-workspace] host half loaded; UI runs in the browser (client half)'
    + (registered ? '; session title provenance projection registered' : '; title provenance unavailable'))
}
