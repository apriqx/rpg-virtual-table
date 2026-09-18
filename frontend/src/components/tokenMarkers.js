export const STATUS_MARKERS = [
  { key: 'dead', emoji: '💀', label: 'Morto' },
  { key: 'hurt', emoji: '🩸', label: 'Ferido' },
  { key: 'stunned', emoji: '💫', label: 'Atordoado' },
  { key: 'poisoned', emoji: '🤢', label: 'Envenenado' },
  { key: 'blind', emoji: '🙈', label: 'Cego' },
  { key: 'paralyzed', emoji: '🧊', label: 'Paralisado' },
  { key: 'downed', emoji: '💤', label: 'Derrubado' },
  { key: 'concentrating', emoji: '🌀', label: 'Concentrando' },
  { key: 'invisible', emoji: '👻', label: 'Invisivel' },
  { key: 'marked', emoji: '🎯', label: 'Marcado' },
  { key: 'buff', emoji: '🔺', label: 'Buff' },
  { key: 'debuff', emoji: '🔻', label: 'Debuff' },
];

export const MARKER_MAP = STATUS_MARKERS.reduce((acc, m) => { acc[m.key] = m; return acc; }, {});

export function markerEmoji(key) {
  return MARKER_MAP[key] ? MARKER_MAP[key].emoji : '⬜';
}

export function markerLabel(key) {
  return MARKER_MAP[key] ? MARKER_MAP[key].label : key;
}
