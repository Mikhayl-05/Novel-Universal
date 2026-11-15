import type { BgmKey, VfxKey } from '../../types/novel';
import type {
  DocumentMetrics,
  DocumentOutlineItem,
  NarrativeVariant,
  TiptapDocJson,
  TiptapMarkJson,
  TiptapNodeJson,
} from '../types/studio';

export const EMPTY_TIPTAP_DOC: TiptapDocJson = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

export function escapeAttr(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeHtmlText(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function sanitizeUrl(url: string | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^(https?:|\/|audio\/|asset\/|icons\/|data:image\/)/i.test(trimmed)) {
    return trimmed;
  }
  return '';
}

function extractAttr(attrsRaw: string, attrName: string): string | undefined {
  const re = new RegExp(`${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const match = re.exec(attrsRaw);
  if (!match) return undefined;
  return decodeHtmlEntities(match[1] ?? match[2] ?? '');
}

function parseStyleAlign(attrsRaw: string): string | undefined {
  const style = extractAttr(attrsRaw, 'style');
  if (!style) return undefined;
  const alignMatch = /text-align\s*:\s*(left|center|right|justify)/i.exec(style);
  return alignMatch ? alignMatch[1].toLowerCase() : undefined;
}

function parseStyleLineHeight(attrsRaw: string): string | undefined {
  const style = extractAttr(attrsRaw, 'style');
  if (!style) return undefined;
  const lhMatch = /line-height\s*:\s*([0-9.]+)/i.exec(style);
  return lhMatch ? lhMatch[1] : undefined;
}

/**
 * Parses inline HTML (strong/b, em/i, u, s/del, a, span style, br) into Tiptap inline nodes.
 */
function parseInlineHtml(html: string): TiptapNodeJson[] {
  const nodes: TiptapNodeJson[] = [];
  const activeMarks: TiptapMarkJson[] = [];
  const tagStack: string[] = [];

  const tokenRe = /(<\/?[a-zA-Z0-9]+(?:\s+[^>]*)?>)|([^<]+)/g;
  let match: RegExpExecArray | null;

  const pushText = (rawText: string) => {
    const decoded = decodeHtmlEntities(rawText);
    if (!decoded) return;
    const node: TiptapNodeJson = {
      type: 'text',
      text: decoded,
    };
    if (activeMarks.length > 0) {
      node.marks = activeMarks.map((m) => ({
        type: m.type,
        ...(m.attrs ? { attrs: { ...m.attrs } } : {}),
      }));
    }
    nodes.push(node);
  };

  while ((match = tokenRe.exec(html)) !== null) {
    const tagToken = match[1];
    const textToken = match[2];

    if (textToken !== undefined) {
      pushText(textToken);
      continue;
    }

    if (!tagToken) continue;

    if (/^<br\s*\/?>$/i.test(tagToken)) {
      nodes.push({ type: 'hardBreak' });
      continue;
    }

    const closeMatch = /^<\/([a-zA-Z0-9]+)\s*>$/.exec(tagToken);
    if (closeMatch) {
      const closeTag = closeMatch[1].toLowerCase();
      for (let i = tagStack.length - 1; i >= 0; i--) {
        if (tagStack[i] === closeTag) {
          tagStack.splice(i, 1);
          activeMarks.splice(i, 1);
          break;
        }
      }
      continue;
    }

    const openMatch = /^<([a-zA-Z0-9]+)([\s\S]*?)>$/.exec(tagToken);
    if (!openMatch) continue;
    const tagName = openMatch[1].toLowerCase();
    const attrsRaw = openMatch[2] || '';
    const isSelfClosing = /\/\s*$/.test(attrsRaw);
    if (isSelfClosing) continue;

    let mark: TiptapMarkJson | null = null;
    if (tagName === 'strong' || tagName === 'b') {
      mark = { type: 'bold' };
    } else if (tagName === 'em' || tagName === 'i') {
      mark = { type: 'italic' };
    } else if (tagName === 'u') {
      mark = { type: 'underline' };
    } else if (tagName === 's' || tagName === 'del' || tagName === 'strike') {
      mark = { type: 'strike' };
    } else if (tagName === 'mark') {
      const bg = extractAttr(attrsRaw, 'data-color') || '#fef08a';
      mark = { type: 'highlight', attrs: { color: bg } };
    } else if (tagName === 'a') {
      const href = sanitizeUrl(extractAttr(attrsRaw, 'href'));
      if (href) {
        mark = { type: 'link', attrs: { href, target: '_blank' } };
      }
    } else if (tagName === 'span') {
      const style = extractAttr(attrsRaw, 'style') || '';
      const colorMatch = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(style);
      const fontMatch = /font-family\s*:\s*([^;]+)/i.exec(style);
      const sizeMatch = /font-size\s*:\s*([^;]+)/i.exec(style);
      const textStyleAttrs: Record<string, string> = {};
      if (colorMatch) textStyleAttrs.color = colorMatch[1].trim();
      if (fontMatch) textStyleAttrs.fontFamily = fontMatch[1].trim();
      if (sizeMatch) textStyleAttrs.fontSize = sizeMatch[1].trim();
      if (Object.keys(textStyleAttrs).length > 0) {
        mark = { type: 'textStyle', attrs: textStyleAttrs };
      }
    }

    if (mark) {
      tagStack.push(tagName);
      activeMarks.push(mark);
    }
  }

  return nodes;
}

function findMatchingTagEnd(html: string, openTagEndIndex: number, tagName: string): number {
  const tagRe = new RegExp(`<(\\/)?${tagName}(?:\\s[^>]*)?>`, 'gi');
  tagRe.lastIndex = openTagEndIndex;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    if (m[1]) {
      depth -= 1;
      if (depth === 0) {
        return m.index;
      }
    } else {
      depth += 1;
    }
  }
  return html.length;
}

/**
 * Losslessly converts legacy HTML chapter content (and Novel Studio serialized HTML)
 * into a structured Tiptap JSONB document with custom Novel Studio blocks.
 */
export function parseLegacyHtmlToTiptapDoc(rawHtml: string): TiptapDocJson {
  const html = (rawHtml || '').trim();
  if (!html) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  const blocks: TiptapNodeJson[] = [];
  let cursor = 0;

  while (cursor < html.length) {
    const nextLt = html.indexOf('<', cursor);
    if (nextLt === -1) {
      const trailing = html.slice(cursor).trim();
      if (trailing) {
        blocks.push({ type: 'paragraph', content: parseInlineHtml(trailing) });
      }
      break;
    }

    if (nextLt > cursor) {
      const textChunk = html.slice(cursor, nextLt).trim();
      if (textChunk) {
        blocks.push({ type: 'paragraph', content: parseInlineHtml(textChunk) });
      }
      cursor = nextLt;
    }

    const tagClose = html.indexOf('>', cursor);
    if (tagClose === -1) break;

    const fullOpenTag = html.slice(cursor, tagClose + 1);
    const openMatch = /^<([a-zA-Z0-9]+)([\s\S]*?)>$/.exec(fullOpenTag);
    if (!openMatch) {
      cursor = tagClose + 1;
      continue;
    }

    const tagName = openMatch[1].toLowerCase();
    const attrsRaw = openMatch[2] || '';

    if (tagName === 'hr') {
      const cls = extractAttr(attrsRaw, 'class') || '';
      blocks.push({
        type: 'sceneBreak',
        attrs: {
          symbol: cls.includes('divider') ? '—' : '✦ ✦ ✦',
          style: cls.includes('divider') ? 'line' : 'ornament',
        },
      });
      cursor = tagClose + 1;
      continue;
    }

    if (tagName === 'img') {
      const src = sanitizeUrl(extractAttr(attrsRaw, 'src'));
      const alt = extractAttr(attrsRaw, 'alt') || '';
      if (src) {
        blocks.push({
          type: 'imageBlock',
          attrs: { src, alt, caption: '', width: 'normal', align: 'center' },
        });
      }
      cursor = tagClose + 1;
      continue;
    }

    const contentEnd = findMatchingTagEnd(html, tagClose + 1, tagName);
    const closingTagLen = `</${tagName}>`.length;
    const innerHtml = html.slice(tagClose + 1, contentEnd);
    cursor = Math.min(html.length, contentEnd + closingTagLen);

    const classAttr = extractAttr(attrsRaw, 'class') || '';
    const textAlign = parseStyleAlign(attrsRaw);
    const lineHeight = parseStyleLineHeight(attrsRaw);

    if (tagName === 'p') {
      const inlineNodes = parseInlineHtml(innerHtml);
      const attrs: Record<string, unknown> = {};
      if (textAlign) attrs.textAlign = textAlign;
      if (lineHeight) attrs.lineHeight = lineHeight;
      blocks.push({
        type: 'paragraph',
        ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
        ...(inlineNodes.length > 0 ? { content: inlineNodes } : {}),
      });
      continue;
    }

    if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3') {
      const level = Number(tagName[1]);
      const inlineNodes = parseInlineHtml(innerHtml);
      blocks.push({
        type: 'heading',
        attrs: {
          level,
          ...(textAlign ? { textAlign } : {}),
          ...(lineHeight ? { lineHeight } : {}),
        },
        ...(inlineNodes.length > 0 ? { content: inlineNodes } : {}),
      });
      continue;
    }

    if (tagName === 'ul' || tagName === 'ol') {
      const listItems: TiptapNodeJson[] = [];
      const liRe = /<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/gi;
      let liMatch: RegExpExecArray | null;
      while ((liMatch = liRe.exec(innerHtml)) !== null) {
        const inlineNodes = parseInlineHtml(liMatch[1]);
        listItems.push({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              ...(inlineNodes.length > 0 ? { content: inlineNodes } : {}),
            },
          ],
        });
      }
      if (listItems.length > 0) {
        blocks.push({
          type: tagName === 'ul' ? 'bulletList' : 'orderedList',
          content: listItems,
        });
      }
      continue;
    }

    if (tagName === 'figure' && classAttr.includes('novel-image-block')) {
      const imgMatch = /<img\s+([^>]+)>/i.exec(innerHtml);
      const capMatch = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i.exec(innerHtml);
      const src = imgMatch ? sanitizeUrl(extractAttr(imgMatch[1], 'src')) : '';
      const alt = imgMatch ? extractAttr(imgMatch[1], 'alt') || '' : '';
      const caption = capMatch ? decodeHtmlEntities(capMatch[1].replace(/<[^>]*>/g, '')).trim() : '';
      const width = extractAttr(attrsRaw, 'data-width') || 'normal';
      const align = extractAttr(attrsRaw, 'data-align') || 'center';
      if (src) {
        blocks.push({
          type: 'imageBlock',
          attrs: { src, alt, caption, width, align },
        });
      }
      continue;
    }

    if (tagName === 'div' && classAttr.includes('dialogue')) {
      let speaker = '';
      let dialogueInner = innerHtml.trim();
      const speakerMatch = /^<span\s+class=["']speaker["'][^>]*>([\s\S]*?)<\/span>/i.exec(
        dialogueInner,
      );
      if (speakerMatch) {
        speaker = decodeHtmlEntities(speakerMatch[1].replace(/<[^>]*>/g, '')).trim();
        dialogueInner = dialogueInner.slice(speakerMatch[0].length).trim();
      }
      const inlineNodes = parseInlineHtml(dialogueInner);
      blocks.push({
        type: 'dialogueBlock',
        attrs: {
          speaker,
          align: (textAlign as 'left' | 'center' | 'right') || 'left',
        },
        ...(inlineNodes.length > 0 ? { content: inlineNodes } : {}),
      });
      continue;
    }

    if (tagName === 'div' && classAttr.includes('inner-thought')) {
      const inlineNodes = parseInlineHtml(innerHtml.trim());
      blocks.push({
        type: 'innerThoughtBlock',
        attrs: {
          tone: extractAttr(attrsRaw, 'data-tone') || 'reflective',
        },
        ...(inlineNodes.length > 0 ? { content: inlineNodes } : {}),
      });
      continue;
    }

    if (tagName === 'div' && classAttr.includes('scene-break')) {
      const symbol =
        decodeHtmlEntities(innerHtml.replace(/<[^>]*>/g, '')).trim() || '✦ ✦ ✦';
      blocks.push({
        type: 'sceneBreak',
        attrs: { symbol, style: 'ornament' },
      });
      continue;
    }

    if (tagName === 'div' && classAttr.includes('reader-page-break')) {
      blocks.push({
        type: 'pageBreak',
        attrs: { label: extractAttr(attrsRaw, 'data-label') || 'Page Break' },
      });
      continue;
    }

    if (tagName === 'div' && classAttr.includes('novel-sfx-cue')) {
      blocks.push({
        type: 'sfxBlock',
        attrs: {
          cueName: extractAttr(attrsRaw, 'data-sfx-name') || 'Efek Suara',
          audioUrl: sanitizeUrl(extractAttr(attrsRaw, 'data-sfx-url')) || '',
          trigger: extractAttr(attrsRaw, 'data-trigger') || 'scroll',
          volume: Number(extractAttr(attrsRaw, 'data-volume') || 0.7),
          durationMs: Number(extractAttr(attrsRaw, 'data-duration') || 3000),
        },
      });
      continue;
    }

    if (tagName === 'div' && classAttr.includes('novel-vfx-cue')) {
      blocks.push({
        type: 'vfxBlock',
        attrs: {
          effect: (extractAttr(attrsRaw, 'data-vfx-effect') || 'dust_motes') as VfxKey,
          trigger: extractAttr(attrsRaw, 'data-vfx-trigger') || 'scroll',
          durationMs: Number(extractAttr(attrsRaw, 'data-vfx-duration') || 25000),
          label: extractAttr(attrsRaw, 'data-vfx-label') || 'Visual Effect Cue',
        },
      });
      continue;
    }

    if (tagName === 'div' && classAttr.includes('novel-bgm-cue')) {
      blocks.push({
        type: 'bgmCue',
        attrs: {
          bgmKey: (extractAttr(attrsRaw, 'data-bgm-key') || 'default') as BgmKey,
          action: extractAttr(attrsRaw, 'data-bgm-action') || 'play',
          volume: Number(extractAttr(attrsRaw, 'data-bgm-volume') || 0.42),
          loop: extractAttr(attrsRaw, 'data-bgm-loop') !== 'false',
        },
      });
      continue;
    }

    if (tagName === 'div' && classAttr.includes('novel-chapter-marker')) {
      blocks.push({
        type: 'chapterHeading',
        attrs: {
          num: extractAttr(attrsRaw, 'data-num') || 'Bab',
          title: extractAttr(attrsRaw, 'data-title') || 'Judul Bab',
          setting: extractAttr(attrsRaw, 'data-setting') || '',
          feeling: extractAttr(attrsRaw, 'data-feeling') || '',
        },
      });
      continue;
    }

    if (
      tagName === 'div' &&
      (classAttr.includes('flashback-wrap') ||
        classAttr.includes('chat-box') ||
        classAttr.includes('novel-narrative-card'))
    ) {
      let variant: NarrativeVariant = 'flashback';
      let label = 'Flashback';
      let innerBody = innerHtml.trim();

      if (classAttr.includes('chat-box')) {
        variant = 'chat';
        label = 'Chat Log';
      } else if (classAttr.includes('novel-narrative-card')) {
        variant = (extractAttr(attrsRaw, 'data-variant') as NarrativeVariant) || 'letter';
        const lblMatch = /^<div\s+class=["']novel-narrative-card-label["'][^>]*>([\s\S]*?)<\/div>/i.exec(
          innerBody,
        );
        if (lblMatch) {
          label = decodeHtmlEntities(lblMatch[1].replace(/<[^>]*>/g, '')).trim();
          innerBody = innerBody.slice(lblMatch[0].length).trim();
        }
      } else {
        const lblMatch = /^<div\s+class=["']flashback-label["'][^>]*>([\s\S]*?)<\/div>/i.exec(
          innerBody,
        );
        if (lblMatch) {
          label = decodeHtmlEntities(lblMatch[1].replace(/<[^>]*>/g, '')).trim();
          innerBody = innerBody.slice(lblMatch[0].length).trim();
        }
      }

      const nested = parseLegacyHtmlToTiptapDoc(innerBody);
      blocks.push({
        type: 'customNarrativeBlock',
        attrs: { variant, label },
        content: nested.content.length > 0 ? nested.content : [{ type: 'paragraph' }],
      });
      continue;
    }

    // Fallback for wrapper divs (e.g. ending-card or generic container): parse recursively
    if (tagName === 'div' || tagName === 'section' || tagName === 'blockquote') {
      const nested = parseLegacyHtmlToTiptapDoc(innerHtml);
      blocks.push(...nested.content);
    }
  }

  return {
    type: 'doc',
    content: blocks.length > 0 ? blocks : [{ type: 'paragraph' }],
  };
}

function serializeMarks(textHtml: string, marks?: TiptapMarkJson[]): string {
  if (!marks || marks.length === 0) return textHtml;
  let result = textHtml;
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        result = `<strong>${result}</strong>`;
        break;
      case 'italic':
        result = `<em>${result}</em>`;
        break;
      case 'underline':
        result = `<u>${result}</u>`;
        break;
      case 'strike':
        result = `<s>${result}</s>`;
        break;
      case 'highlight': {
        const color = typeof mark.attrs?.color === 'string' ? mark.attrs.color : '#fef08a';
        result = `<mark data-color="${escapeAttr(color)}" style="background-color:${escapeAttr(color)}">${result}</mark>`;
        break;
      }
      case 'link': {
        const href = sanitizeUrl(typeof mark.attrs?.href === 'string' ? mark.attrs.href : '');
        if (href) {
          result = `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${result}</a>`;
        }
        break;
      }
      case 'textStyle': {
        const styles: string[] = [];
        if (typeof mark.attrs?.color === 'string' && mark.attrs.color) {
          styles.push(`color:${escapeAttr(mark.attrs.color)}`);
        }
        if (typeof mark.attrs?.fontFamily === 'string' && mark.attrs.fontFamily) {
          styles.push(`font-family:${escapeAttr(mark.attrs.fontFamily)}`);
        }
        if (typeof mark.attrs?.fontSize === 'string' && mark.attrs.fontSize) {
          styles.push(`font-size:${escapeAttr(mark.attrs.fontSize)}`);
        }
        if (styles.length > 0) {
          result = `<span style="${styles.join(';')}">${result}</span>`;
        }
        break;
      }
      default:
        break;
    }
  }
  return result;
}

function serializeInlineNodes(nodes?: TiptapNodeJson[]): string {
  if (!nodes || nodes.length === 0) return '';
  return nodes
    .map((node) => {
      if (node.type === 'hardBreak') return '<br>';
      if (node.type === 'text') {
        return serializeMarks(escapeHtmlText(node.text || ''), node.marks);
      }
      return '';
    })
    .join('');
}

function buildBlockStyleAttr(attrs?: Record<string, unknown>): string {
  if (!attrs) return '';
  const styles: string[] = [];
  if (typeof attrs.textAlign === 'string' && attrs.textAlign && attrs.textAlign !== 'left') {
    styles.push(`text-align:${escapeAttr(attrs.textAlign)}`);
  }
  if (typeof attrs.lineHeight === 'string' && attrs.lineHeight) {
    styles.push(`line-height:${escapeAttr(attrs.lineHeight)}`);
  }
  return styles.length > 0 ? ` style="${styles.join(';')}"` : '';
}

function serializeNode(node: TiptapNodeJson): string {
  switch (node.type) {
    case 'paragraph': {
      const styleAttr = buildBlockStyleAttr(node.attrs);
      const inner = serializeInlineNodes(node.content);
      return `<p${styleAttr}>${inner}</p>`;
    }
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level || 2)));
      const styleAttr = buildBlockStyleAttr(node.attrs);
      return `<h${level}${styleAttr}>${serializeInlineNodes(node.content)}</h${level}>`;
    }
    case 'bulletList': {
      const items = (node.content || []).map(serializeNode).join('');
      return `<ul>${items}</ul>`;
    }
    case 'orderedList': {
      const items = (node.content || []).map(serializeNode).join('');
      return `<ol>${items}</ol>`;
    }
    case 'listItem': {
      const inner = (node.content || []).map(serializeNode).join('');
      return `<li>${inner}</li>`;
    }
    case 'horizontalRule':
      return `<hr class="divider">`;
    case 'blockquote': {
      const inner = (node.content || []).map(serializeNode).join('');
      return `<blockquote class="inner-thought">${inner}</blockquote>`;
    }
    case 'dialogueBlock': {
      const speaker = typeof node.attrs?.speaker === 'string' ? node.attrs.speaker.trim() : '';
      const align = typeof node.attrs?.align === 'string' && node.attrs.align !== 'left'
        ? ` style="text-align:${escapeAttr(node.attrs.align)}"`
        : '';
      const speakerHtml = speaker ? `<span class="speaker">${escapeHtmlText(speaker)}</span>` : '';
      return `<div class="dialogue"${align}>${speakerHtml}${serializeInlineNodes(node.content)}</div>`;
    }
    case 'innerThoughtBlock': {
      const tone = typeof node.attrs?.tone === 'string' ? node.attrs.tone : 'reflective';
      return `<div class="inner-thought" data-tone="${escapeAttr(tone)}">${serializeInlineNodes(node.content)}</div>`;
    }
    case 'sceneBreak': {
      const style = typeof node.attrs?.style === 'string' ? node.attrs.style : 'ornament';
      if (style === 'line') return `<hr class="divider">`;
      const symbol = typeof node.attrs?.symbol === 'string' ? node.attrs.symbol : '✦ ✦ ✦';
      return `<div class="scene-break">${escapeHtmlText(symbol)}</div>`;
    }
    case 'pageBreak': {
      const label = typeof node.attrs?.label === 'string' ? node.attrs.label : 'Page Break';
      return `<div class="reader-page-break" data-page-break="true" data-label="${escapeAttr(label)}" aria-hidden="true"></div>`;
    }
    case 'sfxBlock': {
      const cueName = typeof node.attrs?.cueName === 'string' ? node.attrs.cueName : 'Efek Suara';
      const audioUrl = sanitizeUrl(typeof node.attrs?.audioUrl === 'string' ? node.attrs.audioUrl : '');
      const trigger = typeof node.attrs?.trigger === 'string' ? node.attrs.trigger : 'scroll';
      const volume = Number(node.attrs?.volume ?? 0.7);
      const durationMs = Number(node.attrs?.durationMs ?? 3000);
      return `<div class="novel-sfx-cue" data-sfx-name="${escapeAttr(cueName)}" data-sfx-url="${escapeAttr(audioUrl)}" data-trigger="${escapeAttr(trigger)}" data-volume="${volume}" data-duration="${durationMs}" aria-hidden="true"></div>`;
    }
    case 'vfxBlock': {
      const effect = typeof node.attrs?.effect === 'string' ? node.attrs.effect : 'dust_motes';
      const trigger = typeof node.attrs?.trigger === 'string' ? node.attrs.trigger : 'scroll';
      const durationMs = Number(node.attrs?.durationMs ?? 25000);
      const label = typeof node.attrs?.label === 'string' ? node.attrs.label : 'Visual Effect Cue';
      return `<div class="novel-vfx-cue" data-vfx-effect="${escapeAttr(effect)}" data-vfx-trigger="${escapeAttr(trigger)}" data-vfx-duration="${durationMs}" data-vfx-label="${escapeAttr(label)}" aria-hidden="true"></div>`;
    }
    case 'bgmCue': {
      const bgmKey = typeof node.attrs?.bgmKey === 'string' ? node.attrs.bgmKey : 'default';
      const action = typeof node.attrs?.action === 'string' ? node.attrs.action : 'play';
      const volume = Number(node.attrs?.volume ?? 0.42);
      const loop = node.attrs?.loop !== false;
      return `<div class="novel-bgm-cue" data-bgm-key="${escapeAttr(bgmKey)}" data-bgm-action="${escapeAttr(action)}" data-bgm-volume="${volume}" data-bgm-loop="${loop}" aria-hidden="true"></div>`;
    }
    case 'chapterHeading': {
      const num = typeof node.attrs?.num === 'string' ? node.attrs.num : '';
      const title = typeof node.attrs?.title === 'string' ? node.attrs.title : '';
      const setting = typeof node.attrs?.setting === 'string' ? node.attrs.setting : '';
      const feeling = typeof node.attrs?.feeling === 'string' ? node.attrs.feeling : '';
      return `<div class="novel-chapter-marker" data-num="${escapeAttr(num)}" data-title="${escapeAttr(title)}" data-setting="${escapeAttr(setting)}" data-feeling="${escapeAttr(feeling)}"><div class="ch-num">${escapeHtmlText(num)}</div><h2 class="ch-title">${escapeHtmlText(title)}</h2>${setting ? `<div class="ch-setting">📍 ${escapeHtmlText(setting)}</div>` : ''}</div>`;
    }
    case 'imageBlock':
    case 'image': {
      const src = sanitizeUrl(typeof node.attrs?.src === 'string' ? node.attrs.src : '');
      if (!src) return '';
      const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : '';
      const caption = typeof node.attrs?.caption === 'string' ? node.attrs.caption : '';
      const width = typeof node.attrs?.width === 'string' ? node.attrs.width : 'normal';
      const align = typeof node.attrs?.align === 'string' ? node.attrs.align : 'center';
      return `<figure class="novel-image-block" data-width="${escapeAttr(width)}" data-align="${escapeAttr(align)}"><img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" loading="lazy" />${caption ? `<figcaption>${escapeHtmlText(caption)}</figcaption>` : ''}</figure>`;
    }
    case 'customNarrativeBlock': {
      const variant = (typeof node.attrs?.variant === 'string' ? node.attrs.variant : 'flashback') as NarrativeVariant;
      const label = typeof node.attrs?.label === 'string' ? node.attrs.label : '';
      const inner = (node.content || []).map(serializeNode).join('');
      if (variant === 'flashback') {
        return `<div class="flashback-wrap">${label ? `<div class="flashback-label">${escapeHtmlText(label)}</div>` : ''}${inner}</div>`;
      }
      if (variant === 'chat') {
        return `<div class="chat-box">${inner}</div>`;
      }
      return `<div class="novel-narrative-card" data-variant="${escapeAttr(variant)}">${label ? `<div class="novel-narrative-card-label">${escapeHtmlText(label)}</div>` : ''}${inner}</div>`;
    }
    default:
      if (node.content) {
        return node.content.map(serializeNode).join('');
      }
      return '';
  }
}

export function serializeTiptapDocToReaderHtml(doc: TiptapDocJson | null | undefined): string {
  if (!doc || !Array.isArray(doc.content)) return '';
  return doc.content.map(serializeNode).filter(Boolean).join('\n');
}

function collectPlainText(node: TiptapNodeJson): string {
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return ' ';
  if (!node.content) return '';
  return node.content.map(collectPlainText).join('');
}

export function extractDocumentMetrics(doc: TiptapDocJson | null | undefined): DocumentMetrics {
  if (!doc || !Array.isArray(doc.content)) {
    return {
      wordCount: 0,
      characterCount: 0,
      characterCountNoSpaces: 0,
      pageCount: 1,
      paragraphCount: 0,
      dialogueCount: 0,
    };
  }

  let plainSegments: string[] = [];
  let explicitPageBreaks = 0;
  let paragraphCount = 0;
  let dialogueCount = 0;

  const walk = (nodes: TiptapNodeJson[]) => {
    for (const node of nodes) {
      if (node.type === 'pageBreak') {
        explicitPageBreaks += 1;
      } else if (node.type === 'dialogueBlock') {
        dialogueCount += 1;
        plainSegments.push(collectPlainText(node));
      } else if (node.type === 'paragraph' || node.type === 'innerThoughtBlock') {
        paragraphCount += 1;
        plainSegments.push(collectPlainText(node));
      } else if (node.type === 'heading') {
        plainSegments.push(collectPlainText(node));
      } else if (node.content) {
        walk(node.content);
      }
    }
  };

  walk(doc.content);
  const fullText = plainSegments.join('\n').trim();
  const words = fullText ? fullText.split(/\s+/).filter(Boolean) : [];
  const characterCount = fullText.length;
  const characterCountNoSpaces = fullText.replace(/\s+/g, '').length;
  // Standard novel page estimate (~320 words per A4/manuscript page) + explicit page breaks
  const estimatedPagesByWords = Math.max(1, Math.ceil(words.length / 320));
  const pageCount = Math.max(estimatedPagesByWords, explicitPageBreaks + 1);

  return {
    wordCount: words.length,
    characterCount,
    characterCountNoSpaces,
    pageCount,
    paragraphCount,
    dialogueCount,
  };
}

export function extractDocumentOutline(doc: TiptapDocJson | null | undefined): DocumentOutlineItem[] {
  if (!doc || !Array.isArray(doc.content)) return [];
  const outline: DocumentOutlineItem[] = [];

  doc.content.forEach((node, index) => {
    if (node.type === 'heading') {
      const text = collectPlainText(node).trim();
      if (text) {
        outline.push({
          id: `outline-${index}`,
          kind: 'heading',
          level: Number(node.attrs?.level || 1),
          label: text,
          posIndex: index,
        });
      }
    } else if (node.type === 'chapterHeading') {
      const title = String(node.attrs?.title || node.attrs?.num || 'Chapter Heading');
      outline.push({
        id: `outline-${index}`,
        kind: 'chapter-heading',
        level: 1,
        label: title,
        posIndex: index,
      });
    } else if (node.type === 'sceneBreak') {
      outline.push({
        id: `outline-${index}`,
        kind: 'scene-break',
        level: 2,
        label: `Scene Break (${String(node.attrs?.symbol || '✦ ✦ ✦')})`,
        posIndex: index,
      });
    } else if (node.type === 'dialogueBlock') {
      const speaker = String(node.attrs?.speaker || '').trim();
      const snippet = collectPlainText(node).trim().slice(0, 28);
      if (speaker || snippet) {
        outline.push({
          id: `outline-${index}`,
          kind: 'dialogue',
          level: 3,
          label: speaker ? `${speaker}: ${snippet}` : snippet,
          posIndex: index,
        });
      }
    } else if (node.type === 'sfxBlock' || node.type === 'vfxBlock' || node.type === 'bgmCue') {
      const label =
        node.type === 'sfxBlock'
          ? `SFX: ${String(node.attrs?.cueName || 'Cue')}`
          : node.type === 'vfxBlock'
            ? `VFX: ${String(node.attrs?.effect || 'Effect')}`
            : `BGM: ${String(node.attrs?.bgmKey || 'default')}`;
      outline.push({
        id: `outline-${index}`,
        kind: 'cue',
        level: 3,
        label,
        posIndex: index,
      });
    }
  });

  return outline;
}

export function validateChapterForPublish(chapter: {
  num: string;
  title: string;
  draftHtml: string;
  draftDoc: TiptapDocJson;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!chapter.num || !chapter.num.trim()) {
    errors.push('Nomor bab wajib diisi sebelum publikasi.');
  }
  if (!chapter.title || !chapter.title.trim()) {
    errors.push('Judul bab wajib diisi sebelum publikasi.');
  }
  const metrics = extractDocumentMetrics(chapter.draftDoc);
  const plainHtmlLen = chapter.draftHtml.replace(/<[^>]*>/g, '').trim().length;
  if (metrics.characterCountNoSpaces === 0 && plainHtmlLen === 0) {
    errors.push('Konten bab masih kosong dan belum dapat dipublikasikan.');
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}
