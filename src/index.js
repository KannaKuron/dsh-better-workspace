import Schema from '@deepseek-ai/schemastery'
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

/**
 * dsh >= 0.1.7 marks a Config field live-editable without remount; a
 * 0.1.6-era schemastery predates the method and the guard keeps this module
 * loadable there (values then behave as ordinary config, read through the
 * registered settings namespace instead).
 */
function live(schema) {
  return typeof schema.volatile === 'function' ? schema.volatile() : schema
}

/**
 * Row Config = the settings surface on dsh >= 0.1.7 (values persist under the
 * row id 'better-workspace' — the same string as the old settings namespace,
 * so the one-shot legacy settings.yaml import maps old user values onto the
 * new home). Inert metadata on older hosts. NOTE: settings are per-profile
 * on the new host; the client hides the manual cross-device sync section
 * accordingly (the shared settings.yaml home no longer exists).
 */
export const Config = Schema.object({
  compactChains: live(Schema.boolean().default(true)),
  statusPulse: live(Schema.boolean().default(true)),
  styling: live(Schema.dict(Schema.any()).default({})),
  appearance: live(Schema.dict(Schema.any()).default({})),
})

/** Read one Config value across eras: Volatile ref (>= 0.1.7) or plain value. */
export function valueOf(value) {
  return value && typeof value.get === 'function' ? value.get() : value
}

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
  // OLD-era namespace registration (dsh <= 0.1.6): the row Config above IS
  // the surface on dsh >= 0.1.7 — register() no longer exists there and this
  // block is skipped entirely.
  const legacySettings = (() => {
    try {
      const settings = ctx.get('settings')
      return !!(settings && typeof settings.register === 'function')
    } catch {
      return false
    }
  })()
  if (legacySettings) ctx.inject(['settings'], (sctx) => {
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
        // dsh >= 0.1.2-alpha.2 removed the settingsNamespace() helper from
        // @deepseek-ai/dsh-settings: register() now takes a plain string and
        // validates it at runtime (parseSettingsNamespace). The helper's old
        // signature was compile-time branding only, so a plain string is also
        // accepted by the older register() — one call, both eras. Only use the
        // helper when the installed package still ships it.
        const ns = typeof ds.settingsNamespace === 'function'
          ? ds.settingsNamespace('better-workspace')
          : 'better-workspace'
        settings.register(ns, Schema.object({
          // Cross-device preferences live in the HOST settings store
          // (~/.dsh/settings.yaml): web and the desktop app share one
          // DSH_HOME, so appearance (styling) and the two toggles follow
          // the user across surfaces. Per-device view state (expansion) and
          // the cold-restart title cache stay browser-local.
          compactChains: Schema.boolean().default(true),
          statusPulse: Schema.boolean().default(true),
          styling: Schema.dict(Schema.any()).default({}),
          // Default appearance (color / glow / weight / shadow / outline) for
          // rows without their own entry — shared with the other surface like
          // the rest of the prefs. The client half owns the shape, so it stays
          // a permissive dict.
          appearance: Schema.dict(Schema.any()).default({}),
        }))
        log('[dsh-better-workspace] settings namespace registered: better-workspace')
      })
      .catch((error) => {
        log('[dsh-better-workspace] settings namespace registration FAILED: ' + (error && error.stack || String(error)))
      })
  })
}
