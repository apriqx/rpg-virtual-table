// Mapeamento genérico de campos da ficha para barras do token (itens 54-58)
// Cada barra pode apontar para qualquer campo numérico da ficha via "path"
// (ex.: "hp.current", "combat.ac"), com atual + máximo opcionais.

export const STANDARD_FIELD_PATHS = [
  { path: 'hp.current', label: 'Vida > PV atual' },
  { path: 'hp.max', label: 'Vida > PV máximo' },
  { path: 'hp.temp', label: 'Vida > PV temporários' },
  { path: 'combat.ac', label: 'Combate > CA' },
  { path: 'combat.speed', label: 'Combate > Deslocamento' },
  { path: 'combat.initiative', label: 'Combate > Iniciativa' },
  { path: 'combat.proficiency', label: 'Combate > Proficiência' },
  { path: 'combat.passivePerception', label: 'Combate > Percepção passiva' },
];

export function resolveFieldPath(data, path) {
  if (!data || typeof path !== 'string' || !path) return null;
  let cur = data;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return null;
    cur = cur[part];
  }
  const n = Number(cur);
  return (cur !== null && cur !== '' && Number.isFinite(n)) ? n : null;
}

function walk(node, prefix, out, depth) {
  if (!node || typeof node !== 'object' || depth > 3) return;
  for (const key of Object.keys(node)) {
    const path = prefix ? prefix + '.' + key : key;
    const val = node[key];
    if (val !== null && typeof val === 'object') walk(val, path, out, depth + 1);
    else {
      const n = Number(val);
      if (val !== '' && val !== null && val !== undefined && Number.isFinite(n)) {
        out.push({ path, label: path.split('.').join(' > ') });
      }
    }
  }
}

export function collectFieldPaths(data) {
  const found = [];
  walk(data || {}, '', found, 0);
  const seen = new Set(found.map((f) => f.path));
  for (const std of STANDARD_FIELD_PATHS) {
    if (!seen.has(std.path)) found.push(std);
  }
  return found;
}
