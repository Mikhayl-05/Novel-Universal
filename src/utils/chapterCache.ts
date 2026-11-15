import type { Chapter, ChapterId } from '../types/novel';
import { buildChapterHtml } from './chapterHtml';

export class ChapterHtmlCache {
  private readonly cache = new Map<ChapterId, string>();

  get(chapter: Chapter): string {
    const existing = this.cache.get(chapter.id);
    if (existing !== undefined) return existing;
    const html = buildChapterHtml(chapter);
    this.cache.set(chapter.id, html);
    return html;
  }

  has(chapterId: ChapterId): boolean {
    return this.cache.has(chapterId);
  }

  preload(chapter: Chapter): void {
    if (!this.cache.has(chapter.id)) {
      this.cache.set(chapter.id, buildChapterHtml(chapter));
    }
  }

  prune(keepIds: Iterable<ChapterId>): void {
    const keepSet = new Set(keepIds);
    for (const key of this.cache.keys()) {
      if (!keepSet.has(key)) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}
