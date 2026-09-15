/**
 * The official Commander "Game Changers" list, per Wizards of the Coast's
 * Commander Brackets system. Current as of the February 9, 2026 update
 * (added Farewell and Biorhythm; no removals since).
 * https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-february-9-2026
 */
export const GAME_CHANGERS: string[] = [
  'Ad Nauseam',
  'Ancient Tomb',
  'Aura Shards',
  'Biorhythm',
  "Bolas's Citadel",
  'Braids, Cabal Minion',
  'Chrome Mox',
  'Coalition Victory',
  'Consecrated Sphinx',
  'Crop Rotation',
  'Cyclonic Rift',
  'Demonic Tutor',
  'Drannith Magistrate',
  'Enlightened Tutor',
  'Farewell',
  'Field of the Dead',
  'Fierce Guardianship',
  'Force of Will',
  "Gaea's Cradle",
  'Gamble',
  'Gifts Ungiven',
  'Glacial Chasm',
  'Grand Arbiter Augustin IV',
  'Grim Monolith',
  'Humility',
  'Imperial Seal',
  'Intuition',
  "Jeska's Will",
  "Lion's Eye Diamond",
  'Mana Vault',
  "Mishra's Workshop",
  'Mox Diamond',
  'Mystical Tutor',
  'Narset, Parter of Veils',
  'Natural Order',
  'Necropotence',
  'Notion Thief',
  'Opposition Agent',
  'Orcish Bowmasters',
  'Panoptic Mirror',
  'Rhystic Study',
  'Seedborn Muse',
  "Serra's Sanctum",
  'Smothering Tithe',
  'Survival of the Fittest',
  "Teferi's Protection",
  'Tergrid, God of Fright',
  "Thassa's Oracle",
  'The One Ring',
  'The Tabernacle at Pendrell Vale',
  'Underworld Breach',
  'Vampiric Tutor',
  'Worldly Tutor',
]

const GAME_CHANGERS_SET = new Set(GAME_CHANGERS.map((name) => name.toLowerCase()))

export function isGameChanger(cardName: string): boolean {
  return GAME_CHANGERS_SET.has(cardName.toLowerCase())
}
