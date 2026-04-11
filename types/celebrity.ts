export type Celebrity = {
  id: string;
  name: string;
  bornYear: number | null;
  diedYear: number | null;
  isAlive: boolean;
  wikipediaTitle: string | null;
  imageUrl: string | null;
};

export type CelebrityRoundResult = {
  celebrity: Celebrity;
  guessedAlive: boolean;
  isCorrect: boolean;
};
