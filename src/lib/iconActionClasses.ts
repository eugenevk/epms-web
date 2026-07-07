/** Icon button colors — slightly lighter than main navigation (`text-epms-800`). */

const iconActionBase =
  'inline-flex items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60'

const iconActionColor = 'text-epms-700 hover:bg-epms-50 hover:text-epms-900'

export const iconActionEditClass =
  `${iconActionBase} p-2 text-epms-700 hover:bg-epms-200 hover:text-epms-900`
export const iconActionDeleteClass =
  `${iconActionBase} p-2 text-epms-700 hover:bg-red-100 hover:text-red-800`
export const iconActionSuccessClass =
  `${iconActionBase} p-2 text-epms-700 hover:bg-emerald-100 hover:text-emerald-800`
export const iconActionNeutralClass = `${iconActionBase} p-2 ${iconActionColor}`

/** Compact variant for dense grids (e.g. KB articles). */
export const iconActionEditClassCompact =
  `${iconActionBase} p-1.5 text-epms-700 hover:bg-epms-200 hover:text-epms-900`
export const iconActionDeleteClassCompact =
  `${iconActionBase} p-1.5 text-epms-700 hover:bg-red-100 hover:text-red-800`

/** External link icon buttons. */
export const iconExternalLinkClass =
  'inline-flex shrink-0 items-center justify-center rounded-lg border border-epms-300 p-2.5 text-epms-700 transition hover:bg-epms-50 hover:text-epms-900'
