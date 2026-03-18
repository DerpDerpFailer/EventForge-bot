import { EventParticipant } from '@prisma/client';

interface CsvRow {
  [key: string]: string | number | boolean;
}

/**
 * Génère un CSV à partir d'un tableau d'objets
 */
function toCsv(rows: CsvRow[], columns: string[]): string {
  const header = columns.join(',');
  const lines = rows.map((row) =>
    columns
      .map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const str = String(val);
        // Échapper les guillemets et envelopper si nécessaire
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(',')
  );
  return [header, ...lines].join('\n');
}

/**
 * Exporte les participants d'un événement en CSV
 */
export function exportParticipantsCsv(
  participants: EventParticipant[],
  eventTitle: string
): string {
  const rows: CsvRow[] = participants.map((p) => ({
    userName: p.userName,
    option: `${p.optionEmoji} ${p.optionLabel}`,
    waitlisted: p.isWaitlisted ? 'Oui' : 'Non',
    waitlistPosition: p.waitlistPos ?? '',
    joinedAt: p.joinedAt.toISOString(),
  }));

  return toCsv(rows, [
    'userName',
    'option',
    'waitlisted',
    'waitlistPosition',
    'joinedAt',
  ]);
}

/**
 * Exporte les statistiques utilisateurs en CSV
 */
export function exportStatsCsv(
  stats: Array<{
    userName: string;
    attended: number;
    maybe: number;
    declined: number;
    noShow: number;
  }>
): string {
  const rows: CsvRow[] = stats.map((s) => ({
    userName: s.userName,
    attended: s.attended,
    maybe: s.maybe,
    declined: s.declined,
    noShow: s.noShow,
    total: s.attended + s.maybe + s.declined + s.noShow,
  }));

  return toCsv(rows, [
    'userName',
    'attended',
    'maybe',
    'declined',
    'noShow',
    'total',
  ]);
}
