import type { MtgCard } from '../types/mtg'

const BASE_URL = 'https://api.scryfall.com'

interface ScryfallSearchResponse {
  data: MtgCard[]
  has_more: boolean
  total_cards?: number
}

export async function searchCards(
  query: string,
  order: string = 'name',
  dir: 'asc' | 'desc' = 'asc',
): Promise<MtgCard[]> {
  if (!query.trim()) return []

  const res = await fetch(
    `${BASE_URL}/cards/search?q=${encodeURIComponent(query)}&order=${order}&dir=${dir}`,
  )

  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`Scryfall search failed: ${res.status}`)
  }

  const json: ScryfallSearchResponse = await res.json()
  return json.data
}

export function cardImageUrl(card: MtgCard): string | undefined {
  return (
    card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal
  )
}

interface ScryfallCollectionResponse {
  data: MtgCard[]
  not_found: Array<{ name?: string }>
}

export interface CardLookupResult {
  found: Map<string, MtgCard>
  notFound: string[]
}

export async function getCardsByNames(names: string[]): Promise<CardLookupResult> {
  const found = new Map<string, MtgCard>()
  const notFound: string[] = []
  const uniqueNames = Array.from(new Set(names))

  for (let i = 0; i < uniqueNames.length; i += 75) {
    const batch = uniqueNames.slice(i, i + 75)
    const res = await fetch(`${BASE_URL}/cards/collection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: batch.map((name) => ({ name })) }),
    })

    if (!res.ok) throw new Error(`Scryfall collection lookup failed: ${res.status}`)

    const json: ScryfallCollectionResponse = await res.json()
    for (const card of json.data) {
      found.set(card.name.toLowerCase(), card)
    }
    for (const missing of json.not_found) {
      if (missing.name) notFound.push(missing.name)
    }
  }

  return { found, notFound }
}
