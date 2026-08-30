/**
 * dsh-better-workspace — host half (plain JavaScript, no build step).
 *
 * The feature lives in the client half (src/client.js): the hierarchy tree,
 * the add-workspace parent-group popup, and view state (persisted in the
 * browser through the dsh client store). This host half exists so the cordis
 * plugin row has a valid Node entry, and to give future server-side features
 * (host-persisted folder registry, a settings-page backend) a home. It is
 * intentionally side-effect free.
 */
export const name = 'dsh-better-workspace'

export function apply(ctx) {
  const log = ctx && ctx.logger && typeof ctx.logger.info === 'function'
    ? (msg) => ctx.logger.info(msg)
    : (msg) => console.log(msg)
  log('[dsh-better-workspace] host half loaded; UI runs in the browser (client half)')
  if (!ctx || typeof ctx.inject !== 'function') return
  // Register the settings namespace so the browser card appears in
  // Settings → Plugins. The tab dispatches the intersection of served
  // namespaces and settings.plugin.item cards, and `settings` is a
  // cross-cutting service that may appear after this plugin's apply — so the
  // registration waits for its injection (the same pattern dsh-context uses).
  // The dsh-settings and zod modules resolve only through the dsh Loader; the
  // smoke test imports this file in plain Node with a logger-only ctx and
  // never reaches this path.
  ctx.inject(['settings'], (sctx) => {
    log('[dsh-better-workspace] settings inject fired')
    // The settings service calls the schema AS A FUNCTION to resolve a value
    // (schema(mergeLayers(...))) — that is @deepseek-ai/schemastery's contract:
    // its schemas are callable and fill defaults on undefined. zod objects are
    // NOT callable, so a zod schema throws "TypeError: ... is not a function"
    // at register(); the namespace is then never served and the Settings →
    // Plugins tab (served namespaces ∩ settings.plugin.item cards) never
    // dispatches our card. Both modules resolve at runtime through normal Node
    // resolution from the plugin's own node_modules (the same static-import
    // pattern dsh-context uses).
    Promise.all([import('@deepseek-ai/dsh-settings'), import('@deepseek-ai/schemastery')])
      .then(([ds, sm]) => {
        const settings = sctx && sctx.settings
        if (!settings || typeof settings.register !== 'function') return
        const Schema = sm.default
        settings.register(ds.settingsNamespace('better-workspace'), Schema.object({ compactChains: Schema.boolean().default(true) }))
        log('[dsh-better-workspace] settings namespace registered: better-workspace')
      })
      .catch((error) => {
        log('[dsh-better-workspace] settings namespace registration FAILED: ' + (error && error.stack || String(error)))
      })
  })
}
