import type {
  Chapter,
  ChapterId,
  SearchIndexEntry,
  SearchMatchInfo,
} from '../types/novel';
import { escapeHtml, stripHtmlToText } from './chapterHtml';

export function buildSearchIndex(
  chapters: readonly Chapter[],
): Map<ChapterId, SearchIndexEntry> {
  const index = new Map<ChapterId, SearchIndexEntry>();
  for (const ch of chapters) {
    const contentText = stripHtmlToText(ch.content);
    index.set(ch.id, {
      chapterId: ch.id,
      contentText,
      contentLower: contentText.toLowerCase(),
    });
  }
  return index;
}

export function buildHighlightedSnippet(
  text: string,
  matchPos: number,
  matchLen: number,
  radius = 55,
): string {
  const start = Math.max(0, matchPos - radius);
  const end = Math.min(text.length, matchPos + matchLen + radius);

  const before = escapeHtml(text.slice(start, matchPos));
  const match = escapeHtml(text.slice(matchPos, matchPos + matchLen));
  const after = escapeHtml(text.slice(matchPos + matchLen, end));

  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';

  return `${prefix}${before}<mark>${match}</mark>${after}${suffix}`;
}

export function chapterMatchesSearch(
  ch: Chapter,
  searchIndex: ReadonlyMap<ChapterId, SearchIndexEntry>,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) return true;
  const matchTitle = ch.title.toLowerCase().includes(normalizedQuery);
  const matchNum = ch.num.toLowerCase().includes(normalizedQuery);
  const matchSetting = !!(
    ch.setting && ch.setting.toLowerCase().includes(normalizedQuery)
  );
  const matchFeeling = !!(
    ch.feeling && ch.feeling.toLowerCase().includes(normalizedQuery)
  );
  const entry = searchIndex.get(ch.id);
  const matchContent = !!(entry && entry.contentLower.includes(normalizedQuery));
  return matchTitle || matchNum || matchSetting || matchFeeling || matchContent;
}

export function getSearchMatchInfo(
  ch: Chapter,
  searchIndex: ReadonlyMap<ChapterId, SearchIndexEntry>,
  normalizedQuery: string,
): SearchMatchInfo {
  const matchTitle = ch.title.toLowerCase().includes(normalizedQuery);
  const entry = searchIndex.get(ch.id);
  let snippetHtml: string | null = null;
  if (entry && normalizedQuery) {
    const pos = entry.contentLower.indexOf(normalizedQuery);
    if (pos !== -1) {
      snippetHtml = buildHighlightedSnippet(
        entry.contentText,
        pos,
        normalizedQuery.length,
      );
    }
  }
  return { matchTitle, snippetHtml };
}

export const PARAGRAPH_SELECTOR = '.prose p, .dialogue, .inner-thought';

export function findFirstMatchingParagraph(
  container: HTMLElement,
  query: string,
): HTMLElement | null {
  const lowerQuery = query.toLowerCase();
  const paras = container.querySelectorAll<HTMLElement>(PARAGRAPH_SELECTOR);
  for (const p of paras) {
    if ((p.textContent || '').toLowerCase().includes(lowerQuery)) {
      return p;
    }
  }
  return null;
}
