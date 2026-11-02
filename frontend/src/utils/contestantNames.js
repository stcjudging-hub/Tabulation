const nameComparer = new Intl.Collator('en', { sensitivity: 'base' });

export const sameContestantName = (first, second) =>
  nameComparer.compare(first.trim(), second.trim()) === 0;

export function findDuplicateContestant(contestants) {
  return contestants.find((contestant, index) =>
    contestants.slice(0, index).some((existing) => sameContestantName(existing.name, contestant.name))
  );
}
