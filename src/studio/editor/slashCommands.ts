export type SlashCommandAction =
  | { kind: 'block'; blockType: string }
  | { kind: 'heading'; level: 1 | 2 | 3 }
  | { kind: 'paragraph' }
  | { kind: 'bulletList' }
  | { kind: 'orderedList' };

export interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  category: 'Blok Novel' | 'Audio & Visual' | 'Format Teks';
  keywords: string[];
  action: SlashCommandAction;
}

export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  {
    id: 'dialogue',
    label: 'Dialog Karakter',
    description: 'Blok ucapan tokoh lengkap dengan nama pembicara',
    category: 'Blok Novel',
    keywords: ['dialog', 'percakapan', 'ucapan', 'speaker', 'tokoh', 'ariel', 'alie'],
    action: { kind: 'block', blockType: 'dialogueBlock' },
  },
  {
    id: 'thought',
    label: 'Monolog Batin',
    description: 'Pikiran internal tokoh dengan gaya miring lembut',
    category: 'Blok Novel',
    keywords: ['batin', 'monolog', 'pikiran', 'thought', 'inner'],
    action: { kind: 'block', blockType: 'innerThoughtBlock' },
  },
  {
    id: 'flashback',
    label: 'Blok Naratif (Flashback / Chat / Surat)',
    description: 'Kotak adegan kilas balik, pesan chat, atau memo khusus',
    category: 'Blok Novel',
    keywords: ['flashback', 'kilas', 'chat', 'surat', 'naratif', 'memo', 'card'],
    action: { kind: 'block', blockType: 'customNarrativeBlock' },
  },
  {
    id: 'scene-break',
    label: 'Pemisah Adegan (✦ ✦ ✦)',
    description: 'Ornamen jeda perpindahan waktu atau adegan',
    category: 'Blok Novel',
    keywords: ['adegan', 'scene', 'pemisah', 'jeda', 'break', 'bintang', 'ornamen'],
    action: { kind: 'block', blockType: 'sceneBreak' },
  },
  {
    id: 'page-break',
    label: 'Batas Halaman (Page Break)',
    description: 'Pembatas halaman baru saat cetak dan pratinjau',
    category: 'Blok Novel',
    keywords: ['halaman', 'page', 'break', 'pindah'],
    action: { kind: 'block', blockType: 'pageBreak' },
  },
  {
    id: 'chapter-heading',
    label: 'Penanda Sub-Bab',
    description: 'Sisipkan kepala sub-bab beserta latar tempat & waktu',
    category: 'Blok Novel',
    keywords: ['bab', 'subbab', 'chapter', 'bagian', 'heading'],
    action: { kind: 'block', blockType: 'chapterHeading' },
  },
  {
    id: 'image',
    label: 'Gambar Ilustrasi',
    description: 'Sisipkan ilustrasi atau foto ke dalam naskah',
    category: 'Audio & Visual',
    keywords: ['gambar', 'image', 'foto', 'ilustrasi', 'visual'],
    action: { kind: 'block', blockType: 'imageBlock' },
  },
  {
    id: 'bgm',
    label: 'Musik Latar (BGM Cue)',
    description: 'Atur transisi atau mulai musik latar di titik adegan ini',
    category: 'Audio & Visual',
    keywords: ['bgm', 'musik', 'lagu', 'audio', 'soundtrack'],
    action: { kind: 'block', blockType: 'bgmCue' },
  },
  {
    id: 'sfx',
    label: 'Efek Suara (SFX Cue)',
    description: 'Picu suara efek pendek saat pembaca menggulir bagian ini',
    category: 'Audio & Visual',
    keywords: ['sfx', 'suara', 'sound', 'efek'],
    action: { kind: 'block', blockType: 'sfxBlock' },
  },
  {
    id: 'vfx',
    label: 'Efek Visual (VFX Cue)',
    description: 'Tambahkan partikel debu, kelopak, atau kunang-kunang',
    category: 'Audio & Visual',
    keywords: ['vfx', 'efek visual', 'partikel', 'kelopak', 'debu', 'kunang'],
    action: { kind: 'block', blockType: 'vfxBlock' },
  },
  {
    id: 'h1',
    label: 'Heading 1',
    description: 'Judul bagian utama berukuran besar',
    category: 'Format Teks',
    keywords: ['h1', 'heading1', 'judul', 'besar'],
    action: { kind: 'heading', level: 1 },
  },
  {
    id: 'h2',
    label: 'Heading 2',
    description: 'Subjudul adegan berukuran sedang',
    category: 'Format Teks',
    keywords: ['h2', 'heading2', 'subjudul'],
    action: { kind: 'heading', level: 2 },
  },
  {
    id: 'h3',
    label: 'Heading 3',
    description: 'Subjudul kecil untuk penanda bagian',
    category: 'Format Teks',
    keywords: ['h3', 'heading3', 'kecil'],
    action: { kind: 'heading', level: 3 },
  },
  {
    id: 'bullet-list',
    label: 'Daftar Poin',
    description: 'Daftar catatan atau rincian berpoin',
    category: 'Format Teks',
    keywords: ['list', 'bullet', 'poin', 'daftar'],
    action: { kind: 'bulletList' },
  },
  {
    id: 'ordered-list',
    label: 'Daftar Bernomor',
    description: 'Daftar langkah atau urutan angka',
    category: 'Format Teks',
    keywords: ['ordered', 'number', 'nomor', 'angka', 'daftar'],
    action: { kind: 'orderedList' },
  },
  {
    id: 'paragraph',
    label: 'Paragraf Normal',
    description: 'Kembali ke format paragraf prosa standar',
    category: 'Format Teks',
    keywords: ['paragraf', 'normal', 'teks', 'prosa', 'text'],
    action: { kind: 'paragraph' },
  },
];

export interface SlashTriggerMatch {
  query: string;
  /** Offset from start of current textblock where `/` begins */
  slashOffsetInParent: number;
  /** Offset from start of current textblock at cursor */
  endOffsetInParent: number;
}

/**
 * Matches `/query` when typed at the start of a line or immediately after whitespace.
 */
export function detectSlashTriggerText(textBeforeCursor: string): SlashTriggerMatch | null {
  const match = /(?:^|\s)\/([^\s/]{0,24})$/.exec(textBeforeCursor);
  if (!match) return null;
  const query = match[1] ?? '';
  const slashOffsetInParent = textBeforeCursor.length - query.length - 1;
  return {
    query,
    slashOffsetInParent,
    endOffsetInParent: textBeforeCursor.length,
  };
}

export function filterSlashCommands(query: string): SlashCommandItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return SLASH_COMMAND_ITEMS;
  return SLASH_COMMAND_ITEMS.filter((item) => {
    if (item.label.toLowerCase().includes(normalized)) return true;
    if (item.description.toLowerCase().includes(normalized)) return true;
    return item.keywords.some((kw) => kw.includes(normalized));
  });
}
