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
}
