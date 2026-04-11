const WIKIPEDIA_API_ENDPOINT = "https://en.wikipedia.org/w/api.php";
const REVALIDATE_SECONDS = 60 * 60 * 12;

type WikipediaPage = {
  title?: string;
  original?: {
    source?: string;
  };
  thumbnail?: {
    source?: string;
  };
};

type WikipediaQueryResponse = {
  query?: {
    pages?: Record<string, WikipediaPage>;
  };
};

export async function fetchWikipediaImages(
  titles: string[],
): Promise<Record<string, string | null>> {
  const uniqueTitles = Array.from(
    new Set(titles.map((title) => title.trim()).filter(Boolean)),
  );

  if (uniqueTitles.length === 0) {
    return {};
  }

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: "1",
    prop: "pageimages",
    piprop: "original|thumbnail",
    pithumbsize: "1200",
    titles: uniqueTitles.join("|"),
  });

  const response = await fetch(`${WIKIPEDIA_API_ENDPOINT}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Still-Here-MVP/1.0 (Next.js demo app)",
    },
    next: {
      revalidate: REVALIDATE_SECONDS,
    },
  });

  if (!response.ok) {
    throw new Error(`Wikipedia request failed with status ${response.status}`);
  }

  const data = (await response.json()) as WikipediaQueryResponse;
  const pages = data.query?.pages ?? {};

  return Object.values(pages).reduce<Record<string, string | null>>((acc, page) => {
    if (page.title) {
      acc[page.title] = page.original?.source ?? page.thumbnail?.source ?? null;
    }
    return acc;
  }, {});
}
