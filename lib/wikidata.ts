import { italianCelebrities } from '@/lib/italianCelebrities';
import type { Celebrity } from '@/types/celebrity';

export async function fetchWikidataCelebrities(): Promise<Celebrity[]> {
  return italianCelebrities;
}
