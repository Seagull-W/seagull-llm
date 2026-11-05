// Adjacent entries share a plate in the wide catalogue. The section's own
// portrait leads when that section is selected, including on narrow screens.
export const graceParties = [
  [{ id: 'ranni', name: '菈妮', section: 'papers' }, { id: 'blaidd', name: '布莱泽', section: 'linux-notes' }],
  [{ id: 'melina', name: '梅琳娜', section: 'rl-book' }, { id: 'alexander', name: '亚历山大', section: 'rust-notes' }],
  [{ id: 'leda', name: '蕾妲', section: 'westlake-rl' }, { id: 'ansbach', name: '安帕赫', section: 'research' }],
  [{ id: 'messmer', name: '梅瑟莫', section: 'cs336' }, { id: 'rellana', name: '蕾菈娜', section: 'tags' }],
] as const

export const graceCharacters = graceParties.flat()
export function graceCharacterFor(section: string) {
  return graceCharacters.find(character => character.section === section) ?? graceCharacters[0]
}
export function portraitPath(character: typeof graceCharacters[number]) {
  return `/images/grace-archive/characters/${character.id}.webp`
}
