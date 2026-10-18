/**
 * Intelligent Media Title Parser
 * Extracts show title, season, episode, movie name, and clean display strings
 * from messy torrent, scene, or Google Drive filenames.
 */

export interface ParsedMediaTitle {
  raw: string;
  cleanTitle: string;
  displayTitle: string;
  displayState: string;
  season?: number;
  episode?: number;
  isEpisode: boolean;
  year?: string;
}

export function parseMediaTitle(fileName: string): ParsedMediaTitle {
  if (!fileName) {
    return {
      raw: '',
      cleanTitle: 'Unknown Media',
      displayTitle: 'Unknown Media',
      displayState: 'Watching',
      isEpisode: false,
    };
  }

  // 1. Remove file extension (.mkv, .mp4, .avi, etc.)
  let clean = fileName.replace(/\.[a-z0-9]{2,4}$/i, '');

  // 2. Detect typical series/anime episode patterns:
  // - S01E10 / s1e10 / S1.E10 / S01 - E10 / [S01E10]
  // - 1x10 / 01x10
  // - Episode 10 / Ep 10 / E10 / E100 / Ep. 10
  const sxxExxMatch = clean.match(/^(.*?)[ ._\-\[]+[Ss](\d{1,2})[ ._\-]*[Ee](\d{1,4})[ ._\-\]]*(.*)$/i);
  const nxnMatch = !sxxExxMatch ? clean.match(/^(.*?)[ ._\-]+(\d{1,2})x(\d{1,4})[ ._\-]+(.*)$/i) : null;
  const epOnlyMatch = !sxxExxMatch && !nxnMatch
    ? clean.match(/^(.*?)[ ._\-]+(?:[Ee]|ep|episode)[ ._\-]*(\d{1,4})[ ._\-]*(.*)$/i)
    : null;

  if (sxxExxMatch || nxnMatch || epOnlyMatch) {
    const match = (sxxExxMatch || nxnMatch || epOnlyMatch)!;
    const rawTitlePart = match[1];
    const s = sxxExxMatch ? parseInt(match[2], 10) : nxnMatch ? parseInt(match[2], 10) : 1;
    const e = sxxExxMatch ? parseInt(match[3], 10) : nxnMatch ? parseInt(match[3], 10) : parseInt(match[2], 10);
    const extraPart = match[sxxExxMatch ? 4 : nxnMatch ? 4 : 3] || '';

    // Clean up title part: replace dots/underscores, remove release group artifacts
    let title = rawTitlePart
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[._]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!title && clean) {
      title = clean.split(/[ ._\-][Ss]\d/i)[0] || 'Series';
    }

    const displayState = sxxExxMatch || nxnMatch
      ? `Season ${s} • Episode ${e}`
      : `Episode ${e}`;

    return {
      raw: fileName,
      cleanTitle: title,
      displayTitle: title,
      displayState,
      season: s,
      episode: e,
      isEpisode: true,
    };
  }

  // 3. For movies: strip resolution, codec, release group tags
  let movieTitle = clean
    .replace(/\b(2160p|1080p|720p|480p|4k|uhd|remux|bluray|bdrip|web-dl|webrip|hdr|10bit|x264|x265|hevc|avc|aac|dts|dts-hd|truehd|ddp5\.1|atmos|h264|h265|extended|unrated|director'?s cut)\b.*/gi, '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract year if present
  let year: string | undefined;
  const yearMatch = movieTitle.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    year = yearMatch[1];
    const withoutYear = movieTitle.replace(/\b(19\d{2}|20\d{2})\b/, '').trim();
    if (withoutYear) {
      movieTitle = `${withoutYear} (${year})`;
    }
  }

  return {
    raw: fileName,
    cleanTitle: movieTitle || clean,
    displayTitle: movieTitle || clean,
    displayState: 'Movie',
    isEpisode: false,
    year,
  };
}
