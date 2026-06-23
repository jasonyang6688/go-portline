export type FileSearchMatch = {
  start: number;
  end: number;
};

export function findEditorSearchMatches(content: string, query: string, matchCase = false): FileSearchMatch[] {
  if (!query) {
    return [];
  }

  const haystack = matchCase ? content : content.toLowerCase();
  const needle = matchCase ? query : query.toLowerCase();
  const matches: FileSearchMatch[] = [];
  let cursor = 0;

  for (;;) {
    const start = haystack.indexOf(needle, cursor);
    if (start < 0) {
      return matches;
    }
    const end = start + query.length;
    matches.push({ start, end });
    cursor = end;
  }
}

export function replaceEditorSearchMatch(content: string, match: FileSearchMatch, replacement: string): string {
  return `${content.slice(0, match.start)}${replacement}${content.slice(match.end)}`;
}

export function replaceAllEditorSearchMatches(
  content: string,
  query: string,
  replacement: string,
  matchCase = false,
): { content: string; count: number } {
  const matches = findEditorSearchMatches(content, query, matchCase);
  const nextContent = matches
    .slice()
    .reverse()
    .reduce((current, match) => replaceEditorSearchMatch(current, match, replacement), content);
  return { content: nextContent, count: matches.length };
}
