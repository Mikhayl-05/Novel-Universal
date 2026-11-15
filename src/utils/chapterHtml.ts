import type { Chapter } from '../types/novel';

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function decodeBasicHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function stripHtmlToText(html: string): string {
  if (typeof document !== 'undefined') {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html || '';
    return (tempDiv.textContent || tempDiv.innerText || '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  // Fallback for Node unit test environment without DOM
  return decodeBasicHtmlEntities((html || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildChapterHtml(ch: Chapter): string {
  const hasDropcap = !ch.isPrologue && !ch.isEnding;
  const safeNum = escapeHtml(ch.num || '');
  const safeTitle = escapeHtml(ch.title || '');
  const safeSetting = ch.setting ? escapeHtml(ch.setting.trim()) : '';
  const safeFeeling = ch.feeling ? escapeHtml(ch.feeling.trim()) : '';

  let contentHtml = `
        <div class="ch-header">
          <div class="ch-num">${safeNum}</div>
          <h1 class="ch-title">${safeTitle}</h1>
          ${safeSetting ? `<div class="ch-setting">📍 ${safeSetting}</div>` : ''}
        </div>
      `;
  if (safeFeeling) {
    contentHtml += `<span class="feeling-badge">Suasana: ${safeFeeling}</span>`;
  }
  if (ch.isEnding) {
    contentHtml += ch.content;
  } else {
    contentHtml += `<div class="prose ${hasDropcap ? 'has-dropcap' : ''}">${ch.content}</div>`;
  }
  return contentHtml;
}
