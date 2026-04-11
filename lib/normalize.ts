import { Celebrity } from "@/types/celebrity";

type WikidataBinding = {
  person?: { value?: string };
  personLabel?: { value?: string };
  dob?: { value?: string };
  dod?: { value?: string };
  article?: { value?: string };
};

export function extractEntityId(url: string | undefined): string {
  if (!url) {
    return "";
  }

  const match = url.match(/\/(Q\d+)$/);
  return match?.[1] ?? url;
}

export function extractWikipediaTitle(articleUrl: string | undefined): string | null {
  if (!articleUrl) {
    return null;
  }

  try {
    const url = new URL(articleUrl);
    const title = url.pathname.replace("/wiki/", "");
    return decodeURIComponent(title) || null;
  } catch {
    return null;
  }
}

export function extractYear(dateString: string | undefined): number | null {
  if (!dateString) {
    return null;
  }

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.getUTCFullYear();
}

export function normalizeCelebrity(
  binding: WikidataBinding,
  imageUrl: string | null,
): Celebrity | null {
  const id = extractEntityId(binding.person?.value);
  const name = binding.personLabel?.value?.trim();
  const wikipediaTitle = extractWikipediaTitle(binding.article?.value);
  const bornYear = extractYear(binding.dob?.value);
  const diedYear = extractYear(binding.dod?.value);

  if (!id || !name || !bornYear) {
    return null;
  }

  return {
    id,
    name,
    bornYear,
    diedYear,
    isAlive: diedYear === null,
    wikipediaTitle,
    imageUrl,
  };
}
