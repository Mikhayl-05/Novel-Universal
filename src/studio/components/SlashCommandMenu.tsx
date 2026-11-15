import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import type { Editor } from '@tiptap/react';
import {
  BookOpen,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListOrdered,
  MessageSquareQuote,
  Minus,
  Music,
  Pilcrow,
  Scissors,
  Sparkles,
  Volume2,
} from 'lucide-react';
import {
  detectSlashTriggerText,
  filterSlashCommands,
  type SlashCommandItem,
} from '../editor/slashCommands';

interface SlashCommandMenuProps {
  editor: Editor | null;
  onInsertBlock: (blockType: string) => void;
  keyDownHandlerRef: MutableRefObject<((key: string) => boolean) | null>;
}

interface SlashMenuState {
  open: boolean;
  query: string;
  range: { from: number; to: number };
  left: number;
  top: number;
}

const INITIAL_STATE: SlashMenuState = {
  open: false,
  query: '',
  range: { from: 0, to: 0 },
  left: 0,
  top: 0,
};

function getCommandIcon(id: string) {
  switch (id) {
    case 'dialogue':
      return <MessageSquareQuote size={15} />;
    case 'thought':
      return <Sparkles size={15} />;
    case 'flashback':
      return <BookOpen size={15} />;
    case 'scene-break':
      return <Minus size={15} />;
    case 'page-break':
      return <Scissors size={15} />;
    case 'chapter-heading':
      return <Heading1 size={15} />;
    case 'image':
      return <ImageIcon size={15} />;
    case 'bgm':
      return <Music size={15} />;
    case 'sfx':
      return <Volume2 size={15} />;
    case 'vfx':
      return <Sparkles size={15} />;
    case 'h1':
      return <Heading1 size={15} />;
    case 'h2':
      return <Heading2 size={15} />;
    case 'h3':
      return <Heading3 size={15} />;
    case 'bullet-list':
      return <List size={15} />;
    case 'ordered-list':
      return <ListOrdered size={15} />;
    default:
      return <Pilcrow size={15} />;
  }
}

export function SlashCommandMenu({
  editor,
  onInsertBlock,
  keyDownHandlerRef,
}: SlashCommandMenuProps) {
  const [menuState, setMenuState] = useState<SlashMenuState>(INITIAL_STATE);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dismissedAtFromRef = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo(
    () => filterSlashCommands(menuState.query),
    [menuState.query],
  );

  useEffect(() => {
    setSelectedIndex((prev) => {
      if (items.length === 0) return 0;
      return Math.min(prev, items.length - 1);
    });
  }, [items.length]);

  const executeItem = useCallback(
    (item: SlashCommandItem) => {
      if (!editor) return;
      const { range } = menuState;
      setMenuState(INITIAL_STATE);
      dismissedAtFromRef.current = null;

      const chain = editor.chain().focus().deleteRange(range);
      switch (item.action.kind) {
        case 'heading':
          chain.setHeading({ level: item.action.level }).run();
          break;
        case 'paragraph':
          chain.setParagraph().run();
          break;
        case 'bulletList':
          chain.toggleBulletList().run();
          break;
        case 'orderedList':
          chain.toggleOrderedList().run();
          break;
        case 'block':
          chain.run();
          onInsertBlock(item.action.blockType);
          break;
      }
    },
    [editor, menuState, onInsertBlock],
  );

  const evaluateTrigger = useCallback(() => {
    if (!editor || !editor.isFocused) {
      setMenuState((prev) => (prev.open ? INITIAL_STATE : prev));
      return;
    }

    const { selection } = editor.state;
    if (!selection.empty) {
      setMenuState((prev) => (prev.open ? INITIAL_STATE : prev));
      return;
    }

    const { $from } = selection;
    const parentType = $from.parent.type.name;
    if (parentType !== 'paragraph' && parentType !== 'heading') {
      setMenuState((prev) => (prev.open ? INITIAL_STATE : prev));
      return;
    }

    if (editor.isActive('link')) {
      setMenuState((prev) => (prev.open ? INITIAL_STATE : prev));
      return;
    }

    const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\0', '\0');
    const match = detectSlashTriggerText(textBefore);

    if (!match) {
      dismissedAtFromRef.current = null;
      setMenuState((prev) => (prev.open ? INITIAL_STATE : prev));
      return;
    }

    const blockStart = $from.start();
    const from = blockStart + match.slashOffsetInParent;
    const to = blockStart + match.endOffsetInParent;

    if (dismissedAtFromRef.current === from) {
      return;
    }
    dismissedAtFromRef.current = null;

    try {
      const coords = editor.view.coordsAtPos(to);
      const menuWidth = 310;
      const menuHeight = 320;
      const left = Math.max(
        12,
        Math.min(coords.left, window.innerWidth - menuWidth - 12),
      );
      const openBelow = coords.bottom + menuHeight + 12 <= window.innerHeight;
      const top = openBelow
        ? coords.bottom + 6
        : Math.max(12, coords.top - menuHeight - 6);

      setMenuState((prev) => {
        const nextQuery = match.query;
        if (!prev.open || prev.query !== nextQuery) {
          setSelectedIndex(0);
        }
        return {
          open: true,
          query: nextQuery,
          range: { from, to },
          left,
          top,
        };
      });
    } catch {
      setMenuState((prev) => (prev.open ? INITIAL_STATE : prev));
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => evaluateTrigger();
    const onBlur = () => {
      // Delay slightly so mouse click on slash item completes cleanly before blur closes menu
      setTimeout(() => {
        if (
          menuRef.current &&
          document.activeElement &&
          menuRef.current.contains(document.activeElement)
        ) {
          return;
        }
        setMenuState((prev) => (prev.open ? INITIAL_STATE : prev));
      }, 120);
    };

    editor.on('update', onUpdate);
    editor.on('selectionUpdate', onUpdate);
    editor.on('blur', onBlur);
    return () => {
      editor.off('update', onUpdate);
      editor.off('selectionUpdate', onUpdate);
      editor.off('blur', onBlur);
    };
  }, [editor, evaluateTrigger]);

  // Outside mousedown dismisses popup
  useEffect(() => {
    if (!menuState.open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        dismissedAtFromRef.current = menuState.range.from;
        setMenuState(INITIAL_STATE);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [menuState.open, menuState.range.from]);

  // Delegate ArrowUp, ArrowDown, Enter, Tab, Escape from Tiptap shortcuts
  useEffect(() => {
    keyDownHandlerRef.current = (key: string) => {
      if (!menuState.open) return false;
      if (key === 'Escape') {
        dismissedAtFromRef.current = menuState.range.from;
        setMenuState(INITIAL_STATE);
        return true;
      }
      if (items.length === 0) {
        return false;
      }
      if (key === 'ArrowDown') {
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      }
      if (key === 'ArrowUp') {
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        return true;
      }
      if (key === 'Enter' || key === 'Tab') {
        const picked = items[selectedIndex] ?? items[0];
        if (picked) {
          executeItem(picked);
          return true;
        }
      }
      return false;
    };
    return () => {
      keyDownHandlerRef.current = null;
    };
  }, [
    executeItem,
    items,
    keyDownHandlerRef,
    menuState.open,
    menuState.range.from,
    selectedIndex,
  ]);

  // Keep active item visible when navigating by keyboard
  useLayoutEffect(() => {
    if (!menuState.open || !menuRef.current) return;
    const activeEl = menuRef.current.querySelector<HTMLElement>(
      '[data-slash-active="true"]',
    );
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [menuState.open, selectedIndex]);

  if (!menuState.open) return null;

  return (
    <div
      ref={menuRef}
      className="studio-slash-menu"
      role="listbox"
      aria-label="Menu sisipkan blok cepat"
      style={{
        left: `${menuState.left}px`,
        top: `${menuState.top}px`,
      }}
    >
      <div className="studio-slash-head">
        <span>Sisipkan Blok / Format</span>
        {menuState.query && <code>/{menuState.query}</code>}
      </div>

      {items.length === 0 ? (
        <div className="studio-slash-empty">
          Tidak ada blok cocok dengan <code>/{menuState.query}</code>
        </div>
      ) : (
        <div className="studio-slash-list">
          {items.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const prevCategory = idx > 0 ? items[idx - 1].category : null;
            const showCategory = item.category !== prevCategory;
            return (
              <div key={item.id}>
                {showCategory && (
                  <div className="studio-slash-category">{item.category}</div>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-slash-active={isSelected ? 'true' : 'false'}
                  className={`studio-slash-item${isSelected ? ' is-active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeItem(item);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className="studio-slash-icon" aria-hidden="true">
                    {getCommandIcon(item.id)}
                  </span>
                  <span className="studio-slash-text">
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="studio-slash-foot">
        <span>↑↓ Pilih</span>
        <span>Enter Sisipkan</span>
        <span>Esc Tutup</span>
      </div>
    </div>
  );
}
