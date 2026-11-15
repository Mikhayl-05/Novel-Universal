import assert from 'node:assert/strict';
import test from 'node:test';
import type { TiptapDocJson } from '../src/studio/types/studio';
import {
  createNewChapterPayload,
  detectVersionConflict,
  duplicateChapterPayload,
  hasLocalBackupChanges,
  hasUnpublishedChanges,
  mergeSyncedChapterMetadata,
  moveChapterByDelta,
  reorderChaptersByIds,
  shouldClearPendingSave,
  shouldReloadEditorDocument,
} from '../src/studio/utils/chapterOrdering';
import { buildChapterHtml } from '../src/utils/chapterHtml';
import {
  detectSlashTriggerText,
  filterSlashCommands,
} from '../src/studio/editor/slashCommands';
import {
  extractDocumentMetrics,
  extractDocumentOutline,
  parseLegacyHtmlToTiptapDoc,
  serializeTiptapDocToReaderHtml,
  validateChapterForPublish,
} from '../src/studio/utils/novelContentCodec';

test('custom novel studio blocks round-trip cleanly between HTML and Tiptap JSONB', () => {
  const doc: TiptapDocJson = {
    type: 'doc',
    content: [
      {
        type: 'chapterHeading',
        attrs: {
          num: 'Bab X',
          title: 'Hujan Sore',
          setting: 'Taman Kota',
          feeling: 'Hangat',
        },
      },
      {
        type: 'paragraph',
        attrs: { textAlign: 'justify', lineHeight: '1.8' },
        content: [
          { type: 'text', text: 'Ini adalah ', marks: [] },
          { type: 'text', text: 'teks tebal', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' dan ', marks: [] },
          {
            type: 'text',
            text: 'tautan',
            marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
          },
        ],
      },
      {
        type: 'dialogueBlock',
        attrs: { speaker: 'Tokoh A', align: 'left' },
        content: [{ type: 'text', text: '"Kamu masih ingat tempat ini?"' }],
      },
      {
        type: 'innerThoughtBlock',
        attrs: { tone: 'reflective' },
        content: [{ type: 'text', text: 'Aku selalu mengingatnya.' }],
      },
      {
        type: 'sceneBreak',
        attrs: { symbol: '✦ ✦ ✦', style: 'ornament' },
      },
      {
        type: 'pageBreak',
        attrs: { label: 'Batas Bab' },
      },
      {
        type: 'sfxBlock',
        attrs: {
          cueName: 'Hujan',
          audioUrl: '/audio/breathe.mp3',
          trigger: 'scroll',
          volume: 0.6,
          durationMs: 4000,
        },
      },
      {
        type: 'vfxBlock',
        attrs: {
          effect: 'dust_motes',
          trigger: 'immediate',
          durationMs: 18000,
          label: 'Debu Sore',
        },
      },
      {
        type: 'bgmCue',
        attrs: {
          bgmKey: 'about_you',
          action: 'crossfade',
          volume: 0.5,
          loop: true,
        },
      },
      {
        type: 'imageBlock',
        attrs: {
          src: '/asset/preview.jpg',
          alt: 'Sampul',
          caption: 'Ilustrasi Utama',
          width: 'wide',
          align: 'center',
        },
      },
      {
        type: 'customNarrativeBlock',
        attrs: { variant: 'flashback', label: 'Flashback 2015' },
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Suara bel sekolah berbunyi.' }],
          },
        ],
      },
    ],
  };

  const serialized = serializeTiptapDocToReaderHtml(doc);
  assert.ok(serialized.includes('class="dialogue"'));
  assert.ok(serialized.includes('<span class="speaker">Tokoh A</span>'));
  assert.ok(serialized.includes('class="inner-thought"'));
  assert.ok(serialized.includes('class="scene-break"'));
  assert.ok(serialized.includes('class="reader-page-break"'));
  assert.ok(serialized.includes('class="novel-sfx-cue"'));
  assert.ok(serialized.includes('class="novel-vfx-cue"'));
  assert.ok(serialized.includes('class="novel-bgm-cue"'));
  assert.ok(serialized.includes('class="novel-chapter-marker"'));
  assert.ok(serialized.includes('class="novel-image-block"'));
  assert.ok(serialized.includes('class="flashback-wrap"'));

  const reparsed = parseLegacyHtmlToTiptapDoc(serialized);
  const blockTypes = reparsed.content.map((n) => n.type);
  assert.deepEqual(blockTypes, [
    'chapterHeading',
    'paragraph',
    'dialogueBlock',
    'innerThoughtBlock',
    'sceneBreak',
    'pageBreak',
    'sfxBlock',
    'vfxBlock',
    'bgmCue',
    'imageBlock',
    'customNarrativeBlock',
  ]);
});

test('extractDocumentMetrics & extractDocumentOutline compute accurate counts and outline items', () => {
  const doc: TiptapDocJson = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Pembuka' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Satu dua tiga empat lima.' }],
      },
      {
        type: 'dialogueBlock',
        attrs: { speaker: 'Tokoh B' },
        content: [{ type: 'text', text: '"Enam tujuh."' }],
      },
      { type: 'pageBreak', attrs: { label: 'Hal 2' } },
      { type: 'sceneBreak', attrs: { symbol: '✦ ✦ ✦', style: 'ornament' } },
    ],
  };

  const metrics = extractDocumentMetrics(doc);
  assert.equal(metrics.wordCount, 8);
  assert.equal(metrics.paragraphCount, 1);
  assert.equal(metrics.dialogueCount, 1);
  assert.equal(metrics.pageCount, 2);

  const outline = extractDocumentOutline(doc);
  assert.equal(outline.length, 3);
  assert.equal(outline[0].kind, 'heading');
  assert.equal(outline[1].kind, 'dialogue');
  assert.equal(outline[2].kind, 'scene-break');
});

test('chapter creation adapts to workType and preserves UUID stability and contiguous sortOrder', () => {
  const novelId = '11111111-1111-4111-8111-111111111111';
  const ch1 = createNewChapterPayload(novelId, [], { num: 'Bab 1', title: 'Satu' });
  const ch2 = createNewChapterPayload(novelId, [ch1], { num: 'Bab 2', title: 'Dua' });
  const ch3 = createNewChapterPayload(novelId, [ch1, ch2], {
    num: 'Bab 3',
    title: 'Tiga',
  });

  assert.notEqual(ch1.id, ch2.id);
  assert.notEqual(ch2.id, ch3.id);

  const cerpen = createNewChapterPayload(novelId, [], { workType: 'cerpen' });
  assert.equal(cerpen.num, 'Cerita Pendek');

  const note = createNewChapterPayload(novelId, [], { workType: 'notes' });
  assert.equal(note.num, 'Catatan');

  const reordered = reorderChaptersByIds([ch1, ch2, ch3], ch3.id, ch1.id);
  assert.deepEqual(
    reordered.map((c) => [c.title, c.sortOrder]),
    [
      ['Tiga', 0],
      ['Satu', 1],
      ['Dua', 2],
    ],
  );

  const movedDown = moveChapterByDelta(reordered, ch3.id, 1);
  assert.deepEqual(
    movedDown.map((c) => c.title),
    ['Satu', 'Tiga', 'Dua'],
  );

  const { duplicated, reordered: afterDup } = duplicateChapterPayload(
    ch2,
    [ch1, ch2, ch3],
  );
  assert.notEqual(duplicated.id, ch2.id);
  assert.equal(duplicated.status, 'draft');
  assert.equal(afterDup.length, 4);
  assert.deepEqual(
    afterDup.map((c) => c.sortOrder),
    [0, 1, 2, 3],
  );
});

test('conflict detection, publish validation, and draftBgmUrl unpublished diff guardrails work accurately', () => {
  assert.equal(
    detectVersionConflict({
      localBaseVersion: 3,
      localBaseUpdatedAt: '2026-11-14T10:00:00.000Z',
      serverVersion: 4,
      serverUpdatedAt: '2026-11-14T10:01:00.000Z',
    }),
    true,
  );

  assert.equal(
    detectVersionConflict({
      localBaseVersion: 3,
      localBaseUpdatedAt: '2026-11-14T10:00:00.000Z',
      serverVersion: 3,
      serverUpdatedAt: '2026-11-14T10:00:00.000Z',
    }),
    false,
  );

  const emptyChapter = createNewChapterPayload('novel-1', [], {
    num: '',
    title: '',
    draftDoc: { type: 'doc', content: [{ type: 'paragraph' }] },
    draftHtml: '<p></p>',
  });
  const invalid = validateChapterForPublish(emptyChapter);
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.length, 3);

  const validChapter = createNewChapterPayload('novel-1', [], {
    num: 'Bab 1',
    title: 'Awal',
    draftDoc: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Halo dunia' }] }],
    },
    draftHtml: '<p>Halo dunia</p>',
  });
  assert.equal(validateChapterForPublish(validChapter).valid, true);
  assert.equal(hasUnpublishedChanges(validChapter), true);

  const syncedPublished = {
    ...validChapter,
    status: 'published' as const,
    publishedAt: '2026-11-14T10:00:00.000Z',
    publishedNum: validChapter.num,
    publishedTitle: validChapter.title,
    publishedSetting: validChapter.setting,
    publishedFeeling: validChapter.feeling,
    publishedIsPrologue: validChapter.isPrologue,
    publishedIsEnding: validChapter.isEnding,
    publishedHtml: validChapter.draftHtml,
    publishedBgm: validChapter.draftBgm,
    publishedBgmUrl: validChapter.draftBgmUrl,
    publishedEffect: validChapter.draftEffect,
  };
  assert.equal(hasUnpublishedChanges(syncedPublished), false);

  const editedAfterPublish = {
    ...syncedPublished,
    draftHtml: '<p>Halo dunia versi revisi</p>',
  };
  assert.equal(hasUnpublishedChanges(editedAfterPublish), true);

  const uploadedBgmAfterPublish = {
    ...syncedPublished,
    draftBgmUrl: 'https://cdn.example.com/custom-bgm.mp3',
  };
  assert.equal(hasUnpublishedChanges(uploadedBgmAfterPublish), true);
});

test('cursor-preserving autosave never reloads editor on version bump and keeps mid-flight typing', () => {
  assert.equal(
    shouldReloadEditorDocument({
      loadedChapterId: 'ch-1',
      nextChapterId: 'ch-1',
      syncedReloadCounter: 0,
      reloadCounter: 0,
    }),
    false,
  );

  assert.equal(
    shouldReloadEditorDocument({
      loadedChapterId: 'ch-1',
      nextChapterId: 'ch-2',
      syncedReloadCounter: 0,
      reloadCounter: 0,
    }),
    true,
  );
  assert.equal(
    shouldReloadEditorDocument({
      loadedChapterId: 'ch-1',
      nextChapterId: 'ch-1',
      syncedReloadCounter: 0,
      reloadCounter: 1,
    }),
    true,
  );

  assert.equal(shouldClearPendingSave(4, 4), true);
  assert.equal(shouldClearPendingSave(4, 5), false);

  const localNewer = createNewChapterPayload('novel-1', [], {
    title: 'Judul Terbaru Saat Mengetik',
    draftHtml: '<p>Paragraf terbaru yang belum terunggah</p>',
    draftVersion: 1,
  });
  const serverStaleResponse = {
    ...localNewer,
    title: 'Judul Lama',
    draftHtml: '<p>Paragraf lama</p>',
    draftVersion: 2,
    updatedAt: '2026-11-14T20:00:00.000Z',
  };

  const merged = mergeSyncedChapterMetadata(localNewer, serverStaleResponse, true);
  assert.equal(merged.draftVersion, 2);
  assert.equal(merged.title, 'Judul Terbaru Saat Mengetik');
  assert.equal(merged.draftHtml, '<p>Paragraf terbaru yang belum terunggah</p>');
});

test('slash command trigger detects `/` cleanly and filters novel blocks', () => {
  const startMatch = detectSlashTriggerText('/');
  assert.deepEqual(startMatch, {
    query: '',
    slashOffsetInParent: 0,
    endOffsetInParent: 1,
  });

  const midLineMatch = detectSlashTriggerText('Hari itu /dialog');
  assert.deepEqual(midLineMatch, {
    query: 'dialog',
    slashOffsetInParent: 9,
    endOffsetInParent: 16,
  });

  assert.equal(detectSlashTriggerText('Senin/Selasa'), null);
  assert.equal(detectSlashTriggerText('https://example.com'), null);

  const dialogMatches = filterSlashCommands('dialog');
  assert.ok(dialogMatches.some((item) => item.id === 'dialogue'));

  const bgmMatches = filterSlashCommands('musik');
  assert.ok(bgmMatches.some((item) => item.id === 'bgm'));
});

test('hasLocalBackupChanges detects real dirty diffs and ignores matching metadata', () => {
  const baseChapter = createNewChapterPayload('novel-1', [], {
    num: 'Bab 1',
    title: 'Awal Mula',
    setting: 'Stasiun Lama',
    feeling: 'Tenang',
    draftHtml: '<p>Paragraf pembuka.</p>',
    draftBgm: 'about_you',
    draftBgmUrl: null,
  });

  const identicalPatch = {
    num: 'Bab 1',
    title: 'Awal Mula',
    setting: 'Stasiun Lama',
    feeling: 'Tenang',
    isPrologue: false,
    isEnding: false,
    draftHtml: '<p>Paragraf pembuka.</p>',
    draftBgm: 'about_you',
    draftBgmUrl: undefined as unknown as string | null,
    draftBgmVolume: baseChapter.draftBgmVolume,
    draftBgmLoop: baseChapter.draftBgmLoop,
    draftEffect: baseChapter.draftEffect,
    draftVfxTrigger: baseChapter.draftVfxTrigger,
    draftVfxDurationMs: baseChapter.draftVfxDurationMs,
  };
  assert.equal(hasLocalBackupChanges(baseChapter, identicalPatch), false);

  const emptyFeelingChapter = { ...baseChapter, feeling: '' };
  assert.equal(
    hasLocalBackupChanges(emptyFeelingChapter, { ...identicalPatch, feeling: '' }),
    false,
  );

  assert.equal(
    hasLocalBackupChanges(baseChapter, { ...identicalPatch, title: 'Judul Baru' }),
    true,
  );
  assert.equal(
    hasLocalBackupChanges(baseChapter, { ...identicalPatch, num: 'Bab I' }),
    true,
  );
  assert.equal(
    hasLocalBackupChanges(baseChapter, {
      ...identicalPatch,
      draftHtml: '<p>Revisi cepat</p>',
    }),
    true,
  );
  assert.equal(
    hasLocalBackupChanges(baseChapter, { ...identicalPatch, draftBgm: 'iris' }),
    true,
  );
  assert.equal(
    hasLocalBackupChanges(baseChapter, {
      ...identicalPatch,
      draftBgmUrl: 'https://cdn.example.com/music.mp3',
    }),
    true,
  );
});

test('buildChapterHtml escapes metadata and omits empty setting marker', () => {
  const htmlWithXss = buildChapterHtml({
    id: 'ch-xss',
    num: '<script>alert(1)</script>',
    title: 'Malam & <Bintang>',
    setting: '  Kafe <Sudut>  ',
    feeling: '<b>Rindu</b>',
    bgm: 'default',
    content: '<p>Isi aman</p>',
    isPrologue: false,
    isEnding: false,
  });

  assert.ok(htmlWithXss.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(htmlWithXss.includes('Malam &amp; &lt;Bintang&gt;'));
  assert.ok(htmlWithXss.includes('Kafe &lt;Sudut&gt;'));
  assert.ok(htmlWithXss.includes('Suasana: &lt;b&gt;Rindu&lt;/b&gt;'));
  assert.ok(!htmlWithXss.includes('<script>alert(1)</script>'));
  assert.ok(htmlWithXss.includes('class="ch-setting"'));

  const htmlWithoutSetting = buildChapterHtml({
    id: 'ch-clean',
    num: 'Bab 2',
    title: 'Tanpa Latar',
    setting: '   ',
    feeling: '',
    bgm: 'default',
    content: '<p>Teks</p>',
  });

  assert.ok(!htmlWithoutSetting.includes('class="ch-setting"'));
  assert.ok(!htmlWithoutSetting.includes('class="feeling-badge"'));
});

test('bgmCue actions pause and fadeout survive HTML serialization and re-parsing', () => {
  const doc: TiptapDocJson = {
    type: 'doc',
    content: [
      {
        type: 'bgmCue',
        attrs: {
          bgmKey: 'default',
          action: 'pause',
          volume: 0.4,
          loop: false,
        },
      },
      {
        type: 'bgmCue',
        attrs: {
          bgmKey: 'iris',
          action: 'fadeout',
          volume: 0.35,
          loop: false,
        },
      },
    ],
  };

  const serialized = serializeTiptapDocToReaderHtml(doc);
  assert.ok(serialized.includes('data-bgm-action="pause"'));
  assert.ok(serialized.includes('data-bgm-action="fadeout"'));

  const reparsed = parseLegacyHtmlToTiptapDoc(serialized);
  assert.equal(reparsed.content.length, 2);
  assert.equal(reparsed.content[0].type, 'bgmCue');
  assert.equal(reparsed.content[0].attrs?.action, 'pause');
  assert.equal(reparsed.content[1].type, 'bgmCue');
  assert.equal(reparsed.content[1].attrs?.action, 'fadeout');
});

