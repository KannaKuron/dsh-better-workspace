/**
 * Title provenance: the host knows WHY a session title exists — the
 * `session/title` event carries `source.kind` (`fallback` | `provider` |
 * `user`), and the official title projection deliberately exposes only the
 * plain string. Without the source, the sidebar can only guess from the text
 * whether a `/` was a deliberate grouping or part of an auto-generated
 * sentence (issue #19). This optional summary projection carries the kind to
 * the list rows so the client can trust intent instead of guessing it.
 *
 * It is a separate module so the fold can be unit-tested without booting the
 * plugin row. Registration is best-effort: when zod is unavailable (a profile
 * that did not hoist the host's dependency), the client keeps its display-layer
 * fallback and the plugin still mounts.
 */
export const TITLE_SOURCE_KEY = 'betterWorkspace/titleSource'

/**
 * Build the projection definition. `z` is zod's namespace, injected so the
 * fold can be tested with a real schema without a top-level import.
 * @param z - zod namespace (v4).
 * @returns a summary projection definition for `sessionProjections.register`.
 */
export function titleSourceProjection(z) {
  const schema = z.string().nullable()
  return {
    key: TITLE_SOURCE_KEY,
    stateVersion: 1,
    stateSchema: schema,
    init: () => null,
    apply: (state, event) => {
      if (!event || event.type !== 'session/title') return state
      const kind = event.data && event.data.source && event.data.source.kind
      return typeof kind === 'string' && kind !== '' ? kind : state
    },
    // A summary unit by default: the list row needs this value. Eager
    // providers must stay cheap; this fold only reads session/title events.
    wire: { viewSchema: schema, view: (state) => state },
  }
}

/**
 * Register the projection on the plugin context. Never throws: a missing zod
 * or a registration conflict degrades to the client's text fallback.
 * @param ctx - the plugin host context carrying `sessionProjections`.
 * @param log - diagnostic sink.
 * @returns whether the projection was registered.
 */
export async function registerTitleSource(ctx, log = () => {}) {
  let z
  try {
    ({ z } = await import('zod'))
  } catch (error) {
    log('[dsh-better-workspace] zod is not resolvable; session title provenance falls back to display heuristics: '
      + (error && error.message || String(error)))
    return false
  }
  try {
    await ctx.sessionProjections.register(titleSourceProjection(z))
    return true
  } catch (error) {
    log('[dsh-better-workspace] title provenance projection was not registered; '
      + 'session titles fall back to display heuristics: ' + (error && error.message || String(error)))
    return false
  }
}
