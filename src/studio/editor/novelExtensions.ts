import { Extension, mergeAttributes, Node, type SingleCommands } from '@tiptap/core';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import {
  Color,
  FontFamily,
  FontSize,
  LineHeight,
  TextStyle,
} from '@tiptap/extension-text-style';
import { ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  BgmCueView,
  ChapterHeadingView,
  CustomNarrativeBlockView,
  DialogueBlockView,
  ImageBlockView,
  InnerThoughtBlockView,
  PageBreakView,
  SceneBreakView,
  SfxBlockView,
  VfxBlockView,
} from './NovelBlockViews';

export interface StudioExtensionCallbacks {
  onSaveShortcut?: () => void;
  onLinkShortcut?: () => void;
  slashKeyDownRef?: { current: ((key: string) => boolean) | null };
}

/**
 * Adds paragraph/heading-level lineHeight attribute so Google Docs-style line spacing
 * works across entire blocks as well as inline selections.
 */
export const BlockLineSpacing = Extension.create({
  name: 'blockLineSpacing',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'dialogueBlock', 'innerThoughtBlock'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setBlockLineSpacing:
        (lineHeight: string | null) =>
        ({ commands }: { commands: SingleCommands }) => {
          return (
            commands.updateAttributes('paragraph', { lineHeight }) ||
            commands.updateAttributes('heading', { lineHeight }) ||
            commands.updateAttributes('dialogueBlock', { lineHeight }) ||
            commands.updateAttributes('innerThoughtBlock', { lineHeight })
          );
        },
    } as Record<string, unknown>;
  },
});

export const DialogueBlock = Node.create({
  name: 'dialogueBlock',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      speaker: {
        default: '',
        parseHTML: (el) => {
          const sp = el.querySelector('.speaker');
          return sp?.textContent?.trim() ?? '';
        },
      },
      align: {
        default: 'left',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div.dialogue' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'dialogue' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DialogueBlockView);
  },
});

export const InnerThoughtBlock = Node.create({
  name: 'innerThoughtBlock',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      tone: {
        default: 'reflective',
        parseHTML: (el) => el.getAttribute('data-tone') || 'reflective',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div.inner-thought' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'inner-thought' }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InnerThoughtBlockView);
  },
});

export const SceneBreak = Node.create({
  name: 'sceneBreak',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      symbol: { default: '✦ ✦ ✦' },
      style: { default: 'ornament' },
    };
  },

  parseHTML() {
    return [{ tag: 'div.scene-break' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'scene-break' }),
      String(HTMLAttributes.symbol ?? '✦ ✦ ✦'),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SceneBreakView);
  },
});

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      label: { default: 'Page Break' },
    };
  },

  parseHTML() {
    return [{ tag: 'div.reader-page-break' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'reader-page-break',
        'data-page-break': 'true',
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () =>
        this.editor.chain().focus().insertContent({ type: this.name }).run(),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageBreakView);
  },
});

export const SfxBlock = Node.create({
  name: 'sfxBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      cueName: { default: 'Efek Suara' },
      audioUrl: { default: '' },
      trigger: { default: 'scroll' },
      volume: { default: 0.7 },
      durationMs: { default: 3000 },
    };
  },

  parseHTML() {
    return [{ tag: 'div.novel-sfx-cue' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'novel-sfx-cue' }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SfxBlockView);
  },
});

export const VfxBlock = Node.create({
  name: 'vfxBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      effect: { default: 'dust_motes' },
      trigger: { default: 'scroll' },
      durationMs: { default: 25000 },
      label: { default: 'Visual Effect Cue' },
    };
  },

  parseHTML() {
    return [{ tag: 'div.novel-vfx-cue' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'novel-vfx-cue' }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VfxBlockView);
  },
});

export const BgmCue = Node.create({
  name: 'bgmCue',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      bgmKey: { default: 'default' },
      action: { default: 'play' },
      volume: { default: 0.42 },
      loop: { default: true },
    };
  },

  parseHTML() {
    return [{ tag: 'div.novel-bgm-cue' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'novel-bgm-cue' }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BgmCueView);
  },
});

export const ChapterHeading = Node.create({
  name: 'chapterHeading',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      num: { default: 'Bagian Baru' },
      title: { default: 'Judul Bagian' },
      setting: { default: '' },
      feeling: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div.novel-chapter-marker' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'novel-chapter-marker' }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChapterHeadingView);
  },
});

export const ImageBlock = Node.create({
  name: 'imageBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      caption: { default: '' },
      width: { default: 'normal' },
      align: { default: 'center' },
    };
  },

  parseHTML() {
    return [{ tag: 'figure.novel-image-block' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, { class: 'novel-image-block' }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView);
  },
});

export const CustomNarrativeBlock = Node.create({
  name: 'customNarrativeBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      variant: { default: 'flashback' },
      label: { default: 'Flashback' },
    };
  },

  parseHTML() {
    return [
      { tag: 'div.flashback-wrap' },
      { tag: 'div.chat-box' },
      { tag: 'div.novel-narrative-card' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'novel-narrative-card' }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CustomNarrativeBlockView);
  },
});

export function createNovelEditorExtensions(callbacks?: StudioExtensionCallbacks) {
  const StudioShortcuts = Extension.create({
    name: 'studioShortcuts',
    addKeyboardShortcuts() {
      return {
        'Mod-s': () => {
          callbacks?.onSaveShortcut?.();
          return true;
        },
        'Mod-k': () => {
          callbacks?.onLinkShortcut?.();
          return true;
        },
        'Mod-Shift-x': () => this.editor.chain().focus().toggleStrike().run(),
        ArrowDown: () => Boolean(callbacks?.slashKeyDownRef?.current?.('ArrowDown')),
        ArrowUp: () => Boolean(callbacks?.slashKeyDownRef?.current?.('ArrowUp')),
        Enter: () => Boolean(callbacks?.slashKeyDownRef?.current?.('Enter')),
        Tab: () => Boolean(callbacks?.slashKeyDownRef?.current?.('Tab')),
        Escape: () => Boolean(callbacks?.slashKeyDownRef?.current?.('Escape')),
      };
    },
  });

  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      },
    }),
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    LineHeight,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({
      types: ['heading', 'paragraph', 'dialogueBlock', 'customNarrativeBlock'],
    }),
    Image.configure({ inline: false, allowBase64: true }),
    CharacterCount,
    Placeholder.configure({
      placeholder:
        'Mulai menulis naskah di sini… (ketik "/" untuk menyisipkan blok atau dialog)',
    }),
    BlockLineSpacing,
    DialogueBlock,
    InnerThoughtBlock,
    SceneBreak,
    PageBreak,
    SfxBlock,
    VfxBlock,
    BgmCue,
    ChapterHeading,
    ImageBlock,
    CustomNarrativeBlock,
    StudioShortcuts,
  ];
}
