import { useMemo, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Copy,
  FilePlus2,
  GripVertical,
  ListTree,
  Plus,
  Search,
  Settings,
  Trash2,
} from 'lucide-react';
import type { WorkType } from '../../types/novel';
import type {
  DocumentOutlineItem,
  StudioChapter,
  StudioNovel,
} from '../types/studio';
import { hasUnpublishedChanges } from '../utils/chapterOrdering';

const WORK_TYPE_SHORT: Record<WorkType, string> = {
  novel: 'Novel',
  cerpen: 'Cerpen',
  notes: 'Notes',
};

interface StudioSidebarProps {
  novels: StudioNovel[];
  activeNovelId: string | null;
  chapters: StudioChapter[];
  activeChapterId: string | null;
  outline: DocumentOutlineItem[];
  onSelectNovel: (novelId: string) => void;
  onOpenNewNovel: () => void;
  onOpenWorkSettings: () => void;
  onSelectChapter: (chapterId: string) => void;
  onNewChapter: () => void;
  onDuplicateChapter: (chapter: StudioChapter) => void;
  onArchiveToggle: (chapter: StudioChapter) => void;
  onRequestDeleteChapter: (chapter: StudioChapter) => void;
  onReorderChapters: (draggedId: string, targetId: string) => void;
  onMoveChapterDelta: (chapterId: string, delta: -1 | 1) => void;
  onJumpToOutlineItem: (item: DocumentOutlineItem) => void;
}

export function StudioSidebar({
  novels,
  activeNovelId,
  chapters,
  activeChapterId,
  outline,
  onSelectNovel,
  onOpenNewNovel,
  onOpenWorkSettings,
  onSelectChapter,
  onNewChapter,
  onDuplicateChapter,
  onArchiveToggle,
  onRequestDeleteChapter,
  onReorderChapters,
  onMoveChapterDelta,
  onJumpToOutlineItem,
}: StudioSidebarProps) {
  const [tab, setTab] = useState<'chapters' | 'outline'>('chapters');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const activeNovel = novels.find((n) => n.id === activeNovelId) ?? null;
  const newItemLabel =
    activeNovel?.workType === 'cerpen'
      ? 'Bagian Baru'
      : activeNovel?.workType === 'notes'
        ? 'Catatan Baru'
        : 'Bab Baru';

  const filteredChapters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return chapters.filter((ch) => {
      if (!showArchived && ch.status === 'archived') return false;
      if (!q) return true;
      return (
        ch.num.toLowerCase().includes(q) ||
        ch.title.toLowerCase().includes(q) ||
        ch.setting.toLowerCase().includes(q)
      );
    });
  }, [chapters, searchQuery, showArchived]);

  return (
    <aside className="studio-sidebar" aria-label="Navigasi karya dan kerangka dokumen">
      <div className="studio-novel-bar">
        <div className="studio-novel-select-row">
          <select
            className="studio-novel-select"
            aria-label="Pilih karya"
            value={activeNovelId ?? ''}
            onChange={(e) => onSelectNovel(e.target.value)}
          >
            {novels.length === 0 && <option value="">Belum ada karya</option>}
            {novels.map((n) => (
              <option key={n.id} value={n.id}>
                [{WORK_TYPE_SHORT[n.workType]}] {n.title}
              </option>
            ))}
          </select>
          {activeNovel && (
            <button
              type="button"
              className="studio-icon-btn"
              title="Pengaturan karya ini"
              aria-label="Pengaturan karya ini"
              onClick={onOpenWorkSettings}
            >
              <Settings size={15} />
            </button>
          )}
          <button
            type="button"
            className="studio-icon-btn"
            title="Buat karya baru"
            aria-label="Buat karya baru"
            onClick={onOpenNewNovel}
          >
            <Plus size={15} />
          </button>
        </div>

        <div className="studio-sidebar-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'chapters'}
            className={`studio-side-tab${tab === 'chapters' ? ' is-active' : ''}`}
            onClick={() => setTab('chapters')}
          >
            <span>Bab ({chapters.filter((c) => c.status !== 'archived').length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'outline'}
            className={`studio-side-tab${tab === 'outline' ? ' is-active' : ''}`}
            onClick={() => setTab('outline')}
          >
            <ListTree size={13} />
            <span>Outline ({outline.length})</span>
          </button>
        </div>
      </div>

      {tab === 'chapters' ? (
        <div className="studio-side-pane">
          <div className="studio-side-controls">
            <div className="studio-side-search">
              <Search size={13} />
              <input
                type="search"
                aria-label="Filter bab"
                placeholder="Cari bab atau judul…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="studio-btn studio-btn-primary studio-btn-sm"
              onClick={onNewChapter}
            >
              <FilePlus2 size={14} />
              <span>{newItemLabel}</span>
            </button>
          </div>

          <label className="studio-side-archive-toggle">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            <span>Tampilkan yang diarsipkan</span>
          </label>

          <div className="studio-chapter-list" role="list">
            {filteredChapters.length === 0 ? (
              <div className="studio-side-empty">
                {chapters.length === 0
                  ? 'Belum ada naskah pada karya ini.'
                  : 'Tidak ada bagian yang cocok dengan filter.'}
              </div>
            ) : (
              filteredChapters.map((ch) => {
                const isActive = ch.id === activeChapterId;
                const dirtyVsPub = hasUnpublishedChanges(ch);
                return (
                  <div
                    key={ch.id}
                    role="listitem"
                    draggable={!searchQuery.trim()}
                    onDragStart={() => setDraggedId(ch.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedId && draggedId !== ch.id) {
                        setDragOverId(ch.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverId === ch.id) setDragOverId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedId && draggedId !== ch.id) {
                        onReorderChapters(draggedId, ch.id);
                      }
                      setDraggedId(null);
                      setDragOverId(null);
                    }}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDragOverId(null);
                    }}
                    className={`studio-chapter-item${isActive ? ' is-active' : ''}${
                      dragOverId === ch.id ? ' is-drag-over' : ''
                    }${ch.status === 'archived' ? ' is-archived' : ''}`}
                  >
                    <span
                      className="studio-chapter-drag"
                      title="Seret untuk mengurutkan"
                      aria-hidden="true"
                    >
                      <GripVertical size={13} />
                    </span>

                    <button
                      type="button"
                      className="studio-chapter-main"
                      onClick={() => onSelectChapter(ch.id)}
                    >
                      <div className="studio-chapter-top">
                        <span className="studio-chapter-num">{ch.num}</span>
                        <span
                          className={`studio-status-dot status-${ch.status}`}
                          title={
                            ch.status === 'published'
                              ? dirtyVsPub
                                ? 'Terpublikasi (ada perubahan draft)'
                                : 'Terpublikasi'
                              : ch.status === 'archived'
                                ? 'Diarsipkan'
                                : 'Draft'
                          }
                        />
                      </div>
                      <div className="studio-chapter-title">{ch.title}</div>
                      <div className="studio-chapter-meta">
                        {ch.status === 'published'
                          ? dirtyVsPub
                            ? 'Live · Draft diubah'
                            : 'Live'
                          : ch.status === 'archived'
                            ? 'Arsip'
                            : 'Draft'}
                      </div>
                    </button>

                    <div className="studio-chapter-actions">
                      <button
                        type="button"
                        className="studio-mini-btn"
                        title="Naikkan urutan"
                        aria-label={`Naikkan urutan ${ch.title}`}
                        onClick={() => onMoveChapterDelta(ch.id, -1)}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        className="studio-mini-btn"
                        title="Turunkan urutan"
                        aria-label={`Turunkan urutan ${ch.title}`}
                        onClick={() => onMoveChapterDelta(ch.id, 1)}
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        type="button"
                        className="studio-mini-btn"
                        title="Duplikat"
                        aria-label={`Duplikat ${ch.title}`}
                        onClick={() => onDuplicateChapter(ch)}
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        type="button"
                        className="studio-mini-btn"
                        title={
                          ch.status === 'archived' ? 'Pulihkan dari arsip' : 'Arsipkan'
                        }
                        aria-label={
                          ch.status === 'archived'
                            ? `Pulihkan ${ch.title}`
                            : `Arsipkan ${ch.title}`
                        }
                        onClick={() => onArchiveToggle(ch)}
                      >
                        <Archive size={12} />
                      </button>
                      <button
                        type="button"
                        className="studio-mini-btn danger"
                        title="Hapus"
                        aria-label={`Hapus ${ch.title}`}
                        onClick={() => onRequestDeleteChapter(ch)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="studio-side-pane">
          <div className="studio-outline-list">
            {outline.length === 0 ? (
              <div className="studio-side-empty">
                Tambahkan Heading, Chapter Marker, Scene Break, atau Dialog untuk
                melihat kerangka bab.
              </div>
            ) : (
              outline.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`studio-outline-item level-${item.level} kind-${item.kind}`}
                  onClick={() => onJumpToOutlineItem(item)}
                >
                  <span className="studio-outline-badge">
                    {item.kind === 'heading'
                      ? `H${item.level}`
                      : item.kind === 'chapter-heading'
                        ? 'BAB'
                        : item.kind === 'scene-break'
                          ? '✦'
                          : item.kind === 'dialogue'
                            ? '“”'
                            : 'CUE'}
                  </span>
                  <span className="studio-outline-label">{item.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
