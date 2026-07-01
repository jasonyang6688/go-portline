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

export function calculateEditorSearchScrollTop(
  content: string,
  matchStart: number,
  viewportHeight: number,
  lineHeight: number,
): number {
  const boundedStart = Math.max(0, Math.min(matchStart, content.length));
  let lineIndex = 0;

  for (let index = 0; index < boundedStart; index += 1) {
    if (content.charCodeAt(index) === 10) {
      lineIndex += 1;
    }
  }

  const targetTop = lineIndex * lineHeight;
  const centeredOffset = Math.max(0, (viewportHeight - lineHeight) / 2);
  return Math.max(0, Math.round(targetTop - centeredOffset));
}

export function nextEditorSearchMatchIndex(currentIndex: number, matchCount: number, direction: 1 | -1): number {
  if (matchCount <= 0) {
    return 0;
  }
  return (currentIndex + direction + matchCount) % matchCount;
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
