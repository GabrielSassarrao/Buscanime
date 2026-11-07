import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotificationPreference = 'none' | 'weekly' | 'finished';

export interface AnimeItem {
  mal_id: number;
  title: string;
  image: string;
  bannerImage?: string | null;
  synopsis: string;
  episodes: number;
  score: number | null;
  year: number | null;
  status: 'Finalizado' | 'Em Andamento';
  genres: string[];
  trailerUrl?: string | null;
  isAdult?: boolean;
  watched?: boolean;
  watchedEpisodes?: number[];
  nextAiringEpisode?: {
    episode: number;
    airingAt: number;
  } | null;
  notificationPref?: NotificationPreference;
}

export const APP_VERSION = '2.4.7';
const CACHE_PREFIX = '@buscanime_api_cache_v247_';
const CACHE_TTL = 1000 * 60 * 45;

const memoryCache = new Map<string, { timestamp: number; data: any }>();

// Garante que NUNCA exista um anime marcado como "Visto" sem todos os episódios marcados
export function syncWatchedAndEpisodes(
  watchedInput?: boolean,
  totalEpisodesInput?: number,
  watchedEpisodesInput?: number[]
): { watched: boolean; episodes: number; watchedEpisodes: number[] } {
  const rawList = Array.isArray(watchedEpisodesInput)
    ? Array.from(
        new Set(
          watchedEpisodesInput
            .map((n) => Number(n))
            .filter((n) => !isNaN(n) && n > 0)
        )
      ).sort((a, b) => a - b)
    : [];

  const maxEpInList = rawList.length > 0 ? rawList[rawList.length - 1] : 0;
  const totalEpisodes = Math.max(Number(totalEpisodesInput) || 12, maxEpInList, 1);
  const isWatched = Boolean(watchedInput) || rawList.length >= totalEpisodes;

  if (isWatched) {
    const fullEpisodes = Array.from({ length: totalEpisodes }, (_, i) => i + 1);
    return {
      watched: true,
      episodes: totalEpisodes,
      watchedEpisodes: fullEpisodes,
    };
  }

  return {
    watched: false,
    episodes: totalEpisodes,
    watchedEpisodes: rawList,
  };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 6500
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export const OFFICIAL_GENRES_MAP: Record<string, string> = {
  Action: 'Ação',
  Adventure: 'Aventura',
  Comedy: 'Comédia',
  Drama: 'Drama',
  Ecchi: 'Ecchi',
  Fantasy: 'Fantasia',
  Horror: 'Terror',
  'Mahou Shoujo': 'Mahou Shoujo',
  Mecha: 'Mecha',
  Music: 'Música',
  Mystery: 'Mistério',
  Psychological: 'Psicológico',
  Romance: 'Romance',
  'Sci-Fi': 'Ficção Científica',
  'Slice of Life': 'Slice of Life',
  Sports: 'Esportes',
  Supernatural: 'Sobrenatural',
  Thriller: 'Suspense',
  Hentai: 'Hentai',
};

export const OFFICIAL_TAGS_MAP: Record<string, string> = {
  Isekai: 'Isekai',
  Shounen: 'Shounen',
  Seinen: 'Seinen',
  Shoujo: 'Shoujo',
  Josei: 'Josei',
  'Martial Arts': 'Artes Marciais',
  Military: 'Militar',
  School: 'Escolar',
  Historical: 'Histórico',
  Vampire: 'Vampiros',
  Cyberpunk: 'Cyberpunk',
  Parody: 'Paródia',
  Samurai: 'Samurai',
  Space: 'Espaço',
  'Super Power': 'Super Poderes',
  Demons: 'Demônios',
  Harem: 'Harém',
  Detective: 'Policial / Detetive',
  Mythology: 'Mitologia',
  'Post-Apocalyptic': 'Pós-Apocalíptico',
  'Time Travel': 'Viagem no Tempo',
  Zombies: 'Zumbis',
  'Video Games': 'Jogos / RPG',
};

export const ALL_CATEGORIES_PT: string[] = [
  'Ação',
  'Aventura',
  'Comédia',
  'Drama',
  'Ecchi',
  'Fantasia',
  'Ficção Científica',
  'Romance',
  'Suspense',
  'Terror',
  'Mistério',
  'Psicológico',
  'Sobrenatural',
  'Slice of Life',
  'Esportes',
  'Mecha',
  'Mahou Shoujo',
  'Música',
  'Isekai',
  'Shounen',
  'Seinen',
  'Shoujo',
  'Josei',
  'Artes Marciais',
  'Escolar',
  'Militar',
  'Harém',
  'Super Poderes',
  'Demônios',
  'Vampiros',
  'Histórico',
  'Samurai',
  'Cyberpunk',
  'Jogos / RPG',
  'Paródia',
  'Espaço',
  'Policial / Detetive',
  'Mitologia',
  'Pós-Apocalíptico',
  'Viagem no Tempo',
  'Zumbis',
  'Hentai',
];

export function translateGenres(genres: string[], tags?: { name: string }[]): string[] {
  const result = new Set<string>();
  if (Array.isArray(genres)) {
    genres.forEach((g) => {
      result.add(OFFICIAL_GENRES_MAP[g] || OFFICIAL_TAGS_MAP[g] || g);
    });
  }
  if (Array.isArray(tags)) {
    tags.slice(0, 6).forEach((t) => {
      if (t?.name && OFFICIAL_TAGS_MAP[t.name]) {
        result.add(OFFICIAL_TAGS_MAP[t.name]);
      }
    });
  }
  return Array.from(result);
}

function splitCategoriesForApi(selectedPtCategories?: string[]): {
  apiGenres?: string[];
  apiTags?: string[];
} {
  if (!Array.isArray(selectedPtCategories) || selectedPtCategories.length === 0) {
    return {};
  }
  const reverseGenre: Record<string, string> = {};
  Object.entries(OFFICIAL_GENRES_MAP).forEach(([en, pt]) => {
    reverseGenre[pt] = en;
  });
  const reverseTag: Record<string, string> = {};
  Object.entries(OFFICIAL_TAGS_MAP).forEach(([en, pt]) => {
    reverseTag[pt] = en;
  });

  const apiGenres: string[] = [];
  const apiTags: string[] = [];

  selectedPtCategories.forEach((ptCat) => {
    if (reverseGenre[ptCat]) {
      apiGenres.push(reverseGenre[ptCat]);
    } else if (reverseTag[ptCat]) {
      apiTags.push(reverseTag[ptCat]);
    }
  });

  return {
    apiGenres: apiGenres.length > 0 ? apiGenres : undefined,
    apiTags: apiTags.length > 0 ? apiTags : undefined,
  };
}

export function isValidSynopsis(text?: string | null): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 12) return false;
  if (trimmed.includes('Sinopse indisponível')) return false;
  if (trimmed.includes('Sinopse indispon')) return false;
  if (trimmed.includes('Carregando sinopse')) return false;
  return true;
}

export function cleanSynopsis(text?: string | null): string {
  if (!text || text.trim().length === 0) {
    return 'Sinopse indisponível no momento.';
  }
  const stripHtmlRegex = new RegExp('<[^>]*>?', 'gm');
  const cleaned = text
    .replace(stripHtmlRegex, '')
    .replace(/\[Written by MAL Rewrite\]/gi, '')
    .replace(/\(Source:.*?\)/gi, '')
    .trim();
  return cleaned.length > 0 ? cleaned : 'Sinopse indisponível no momento.';
}

export async function translateSynopsisToPt(text?: string | null): Promise<string> {
  const cleaned = cleanSynopsis(text);
  if (!isValidSynopsis(cleaned)) return 'Sinopse indisponível no momento.';

  const cacheKey = `${CACHE_PREFIX}pt_${cleaned.slice(0, 35)}_${cleaned.length}`;
  const mem = memoryCache.get(cacheKey);
  if (mem && isValidSynopsis(mem.data)) return mem.data;

  try {
    const saved = await AsyncStorage.getItem(cacheKey);
    if (saved && isValidSynopsis(saved)) {
      memoryCache.set(cacheKey, { timestamp: Date.now(), data: saved });
      return saved;
    }

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(
      cleaned
    )}`;
    const response = await fetchWithTimeout(url, {}, 4500);
    const json = await response.json();
    if (Array.isArray(json?.[0])) {
      const translated = json[0].map((part: any) => part[0]).join('');
      if (isValidSynopsis(translated)) {
        memoryCache.set(cacheKey, { timestamp: Date.now(), data: translated });
        await AsyncStorage.setItem(cacheKey, translated);
        return translated;
      }
    }
    return cleaned;
  } catch {
    return cleaned;
  }
}

export function normalizeStatus(rawStatus?: string | null): 'Finalizado' | 'Em Andamento' {
  if (!rawStatus) return 'Em Andamento';
  const s = String(rawStatus).toUpperCase().trim();
  if (
    s.includes('NOT_YET_AIRED') ||
    s.includes('NOT YET AIRED') ||
    s.includes('RELEASING') ||
    s.includes('CURRENTLY AIRING') ||
    s.includes('EM ANDAMENTO') ||
    s.includes('LANCANDO') ||
    s.includes('LANÇANDO') ||
    s.includes('HIATUS')
  ) {
    return 'Em Andamento';
  }
  if (
    s.includes('FINISHED') ||
    s.includes('COMPLETE') ||
    s.includes('FINALIZADO') ||
    s.includes('CONCLUIDO') ||
    s.includes('CONCLUÍDO')
  ) {
    return 'Finalizado';
  }
  return 'Em Andamento';
}

function getCurrentAnimeSeason(): {
  season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
  year: number;
} {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  if (month >= 1 && month <= 3) return { season: 'WINTER', year };
  if (month >= 4 && month <= 6) return { season: 'SPRING', year };
  if (month >= 7 && month <= 9) return { season: 'SUMMER', year };
  return { season: 'FALL', year };
}

function mapAniListToAnimeItem(media: any): AnimeItem {
  const airedEpisodes = media.nextAiringEpisode?.episode
    ? Math.max(media.nextAiringEpisode.episode - 1, 1)
    : 0;
  const totalEpisodes = media.episodes || airedEpisodes || 12;
  const trailerUrl =
    media.trailer?.site === 'youtube' && media.trailer?.id
      ? `https://www.youtube.com/watch?v=${media.trailer.id}`
      : null;

  return {
    mal_id: media.idMal || media.id,
    title: media.title?.romaji || media.title?.english || media.title?.native || 'Sem Título',
    image: media.coverImage?.extraLarge || media.coverImage?.large || '',
    bannerImage: media.bannerImage || null,
    synopsis: cleanSynopsis(media.description),
    episodes: totalEpisodes,
    score: media.averageScore ? Number((media.averageScore / 10).toFixed(1)) : null,
    year: media.seasonYear || media.startDate?.year || null,
    status: normalizeStatus(media.status),
    genres: translateGenres(media.genres || [], media.tags || []),
    trailerUrl,
    isAdult: media.isAdult || false,
    watched: false,
    watchedEpisodes: [],
    nextAiringEpisode: media.nextAiringEpisode
      ? {
          episode: media.nextAiringEpisode.episode,
          airingAt: media.nextAiringEpisode.airingAt,
        }
      : null,
  };
}

export async function fetchAnimesCatalog(params: {
  page?: number;
  search?: string;
  genres?: string[];
  category?: 'trending' | 'season' | 'airing' | 'top' | 'popular';
  year?: string;
  includeAdult?: boolean;
  forceRefresh?: boolean;
}): Promise<AnimeItem[]> {
  const page = params.page || 1;
  const cacheKey = `${CACHE_PREFIX}catalog_${JSON.stringify({ ...params, forceRefresh: false })}`;
  const cached = memoryCache.get(cacheKey);
  if (!params.forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  let sort = ['POPULARITY_DESC'];
  let statusFilter: string | undefined = undefined;
  let seasonFilter: string | undefined = undefined;
  let seasonYearFilter: number | undefined = undefined;

  if (params.category === 'trending') sort = ['TRENDING_DESC', 'POPULARITY_DESC'];
  if (params.category === 'top') sort = ['SCORE_DESC'];
  if (params.category === 'airing') {
    sort = ['POPULARITY_DESC'];
    statusFilter = 'RELEASING';
  }
  if (params.category === 'season') {
    const current = getCurrentAnimeSeason();
    seasonFilter = current.season;
    seasonYearFilter = current.year;
    sort = ['POPULARITY_DESC'];
  }

  if (params.year && /^\d{4}$/.test(params.year.trim())) {
    seasonYearFilter = Number(params.year.trim());
  }

  const { apiGenres, apiTags } = splitCategoriesForApi(params.genres);

  const query = `
    query (
      $page: Int,
      $search: String,
      $genres: [String],
      $tags: [String],
      $sort: [MediaSort],
      $status: MediaStatus,
      $season: MediaSeason,
      $seasonYear: Int,
      $isAdult: Boolean
    ) {
      Page(page: $page, perPage: 24) {
        media(
          type: ANIME,
          isAdult: $isAdult,
          search: $search,
          genre_in: $genres,
          tag_in: $tags,
          sort: $sort,
          status: $status,
          season: $season,
          seasonYear: $seasonYear
        ) {
          id
          idMal
          title { romaji english native }
          coverImage { extraLarge large }
          bannerImage
          description(asHtml: false)
          episodes
          nextAiringEpisode { episode airingAt }
          averageScore
          seasonYear
          startDate { year }
          status
          genres
          tags { name }
          isAdult
          trailer { id site }
        }
      }
    }
  `;

  const variables: any = {
    page,
    sort,
    isAdult: params.includeAdult ?? false,
  };

  if (params.search && params.search.trim().length > 0) {
    variables.search = params.search.trim();
    seasonFilter = undefined;
  }
  if (apiGenres) variables.genres = apiGenres;
  if (apiTags) variables.tags = apiTags;
  if (statusFilter) variables.status = statusFilter;
  if (seasonFilter) variables.season = seasonFilter;
  if (seasonYearFilter) variables.seasonYear = seasonYearFilter;

  try {
    const response = await fetchWithTimeout(
      'https://graphql.anilist.co',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables }),
      },
      7500
    );

    if (response.ok) {
      const json = await response.json();
      const mediaList = json?.data?.Page?.media;
      if (Array.isArray(mediaList) && mediaList.length > 0) {
        const mapped = mediaList.map(mapAniListToAnimeItem);
        memoryCache.set(cacheKey, { timestamp: Date.now(), data: mapped });
        return mapped;
      }
    }
  } catch (err) {
    console.warn('Erro ao carregar catálogo AniList:', err);
  }

  try {
    let jikanUrl = `https://api.jikan.moe/v4/top/anime?page=${page}&limit=24`;
    if (params.category === 'season') {
      jikanUrl = `https://api.jikan.moe/v4/seasons/now?page=${page}&limit=24`;
    } else if (params.category === 'airing') {
      jikanUrl = `https://api.jikan.moe/v4/top/anime?filter=airing&page=${page}&limit=24`;
    } else if (params.search && params.search.trim()) {
      jikanUrl = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(
        params.search.trim()
      )}&page=${page}&limit=24`;
    }

    const res = await fetchWithTimeout(jikanUrl, {}, 7500);
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.data) && json.data.length > 0) {
        const mapped: AnimeItem[] = json.data.map((d: any) => ({
          mal_id: d.mal_id,
          title: d.title || d.title_english || 'Sem Título',
          image: d.images?.jpg?.large_image_url || d.images?.jpg?.image_url || '',
          bannerImage: d.trailer?.images?.maximum_image_url || null,
          synopsis: cleanSynopsis(d.synopsis),
          episodes: d.episodes || 12,
          score: d.score ? Number(Number(d.score).toFixed(1)) : null,
          year: d.year || d.aired?.prop?.from?.year || null,
          status: normalizeStatus(d.status),
          genres: translateGenres((d.genres || []).map((g: any) => g.name)),
          trailerUrl: d.trailer?.url || null,
          isAdult: d.rating?.includes('Rx') || false,
          watched: false,
          watchedEpisodes: [],
        }));
        memoryCache.set(cacheKey, { timestamp: Date.now(), data: mapped });
        return mapped;
      }
    }
  } catch {}

  return [];
}

export async function fetchWeeklyScheduleAnimes(includeAdult: boolean = false): Promise<AnimeItem[]> {
  const cacheKey = `${CACHE_PREFIX}weekly_schedule_${includeAdult}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const query = `
    query ($isAdult: Boolean) {
      Page(page: 1, perPage: 50) {
        media(type: ANIME, status: RELEASING, isAdult: $isAdult, sort: [POPULARITY_DESC]) {
          id
          idMal
          title { romaji english native }
          coverImage { extraLarge large }
          bannerImage
          description(asHtml: false)
          episodes
          nextAiringEpisode { episode airingAt }
          averageScore
          seasonYear
          startDate { year }
          status
          genres
          tags { name }
          isAdult
          trailer { id site }
        }
      }
    }
  `;

  try {
    const res = await fetchWithTimeout(
      'https://graphql.anilist.co',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables: { isAdult: includeAdult } }),
      },
      7000
    );
    if (res.ok) {
      const json = await res.json();
      const list = (json?.data?.Page?.media || [])
        .map(mapAniListToAnimeItem)
        .filter((item: AnimeItem) => item.nextAiringEpisode?.airingAt);
      memoryCache.set(cacheKey, { timestamp: Date.now(), data: list });
      return list;
    }
  } catch (e) {
    console.warn('Erro ao buscar calendário semanal:', e);
  }
  return [];
}

export async function fetchRandomRecommendation(params: {
  genres: string[];
  excludedIds: Set<number>;
  includeAdult: boolean;
}): Promise<AnimeItem | null> {
  const { apiGenres, apiTags } = splitCategoriesForApi(params.genres);
  const randomPage = Math.floor(Math.random() * 5) + 1;

  const query = `
    query ($page: Int, $genres: [String], $tags: [String], $isAdult: Boolean) {
      Page(page: $page, perPage: 40) {
        media(
          type: ANIME,
          isAdult: $isAdult,
          genre_in: $genres,
          tag_in: $tags,
          sort: [POPULARITY_DESC, SCORE_DESC]
        ) {
          id
          idMal
          title { romaji english native }
          coverImage { extraLarge large }
          bannerImage
          description(asHtml: false)
          episodes
          nextAiringEpisode { episode airingAt }
          averageScore
          seasonYear
          startDate { year }
          status
          genres
          tags { name }
          isAdult
          trailer { id site }
        }
      }
    }
  `;

  try {
    const res = await fetchWithTimeout(
      'https://graphql.anilist.co',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query,
          variables: {
            page: randomPage,
            genres: apiGenres,
            tags: apiTags,
            isAdult: params.includeAdult,
          },
        }),
      },
      7000
    );
    if (res.ok) {
      const json = await res.json();
      const mediaList: AnimeItem[] = (json?.data?.Page?.media || []).map(mapAniListToAnimeItem);
      const unseenCandidates = mediaList.filter((a) => !params.excludedIds.has(a.mal_id));
      if (unseenCandidates.length > 0) {
        const picked =
          unseenCandidates[Math.floor(Math.random() * unseenCandidates.length)];
        return await fetchCompleteAnimeDetails(picked, true);
      }
    }
  } catch (e) {
    console.warn('Erro ao sortear recomendação:', e);
  }
  return null;
}

export async function fetchCompleteAnimeDetails(
  anime: AnimeItem,
  forceRefresh: boolean = false
): Promise<AnimeItem> {
  const cacheKey = `${CACHE_PREFIX}full_${anime.mal_id}_${anime.title}`;
  const cached = memoryCache.get(cacheKey);
  if (
    !forceRefresh &&
    cached &&
    Date.now() - cached.timestamp < CACHE_TTL &&
    isValidSynopsis(cached.data?.synopsis) &&
    Array.isArray(cached.data?.genres) &&
    cached.data.genres.length > 0
  ) {
    const syncedCached = syncWatchedAndEpisodes(
      anime.watched,
      cached.data.episodes,
      anime.watchedEpisodes
    );
    return {
      ...cached.data,
      episodes: syncedCached.episodes,
      watched: syncedCached.watched,
      watchedEpisodes: syncedCached.watchedEpisodes,
      notificationPref: anime.notificationPref || 'none',
    };
  }

  let episodes = anime.episodes || 0;
  let rawSynopsis = isValidSynopsis(anime.synopsis) ? anime.synopsis : '';
  let status = anime.status;
  let year = anime.year;
  let score = anime.score;
  let genres = Array.isArray(anime.genres) && anime.genres.length > 0 ? anime.genres : [];
  let image = anime.image || '';
  let trailerUrl = anime.trailerUrl || null;
  let nextAiringEpisode = anime.nextAiringEpisode || null;
  let matchedOnAniList = false;

  const anilistQuery = `
    query ($idMal: Int, $id: Int, $search: String) {
      Media(idMal: $idMal, id: $id, search: $search, type: ANIME) {
        id
        idMal
        title { romaji english native }
        coverImage { extraLarge large }
        description(asHtml: false)
        episodes
        nextAiringEpisode { episode airingAt }
        status
        seasonYear
        startDate { year }
        averageScore
        genres
        tags { name }
        trailer { id site }
      }
    }
  `;

  const applyAniListMedia = (m: any) => {
    if (!m) return;
    matchedOnAniList = true;
    const airedCount = m.nextAiringEpisode?.episode
      ? Math.max(m.nextAiringEpisode.episode - 1, 1)
      : 0;
    episodes = m.episodes || airedCount || episodes || 12;
    if (isValidSynopsis(m.description)) {
      rawSynopsis = cleanSynopsis(m.description);
    }
    if (m.status) {
      status = normalizeStatus(m.status);
    }
    year = m.seasonYear || m.startDate?.year || year;
    if (m.averageScore) {
      score = Number((m.averageScore / 10).toFixed(1));
    }
    if (Array.isArray(m.genres) && m.genres.length > 0) {
      genres = translateGenres(m.genres, m.tags || []);
    }
    if (!image && (m.coverImage?.extraLarge || m.coverImage?.large)) {
      image = m.coverImage?.extraLarge || m.coverImage?.large;
    }
    if (m.trailer?.site === 'youtube' && m.trailer?.id) {
      trailerUrl = `https://www.youtube.com/watch?v=${m.trailer.id}`;
    }
    if (m.nextAiringEpisode) {
      nextAiringEpisode = {
        episode: m.nextAiringEpisode.episode,
        airingAt: m.nextAiringEpisode.airingAt,
      };
    } else if (status === 'Finalizado') {
      nextAiringEpisode = null;
    }
  };

  try {
    if (anime.mal_id) {
      const resByIdMal = await fetchWithTimeout(
        'https://graphql.anilist.co',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            query: anilistQuery,
            variables: { idMal: Number(anime.mal_id) },
          }),
        },
        5000
      );
      if (resByIdMal.ok) {
        const json = await resByIdMal.json();
        applyAniListMedia(json?.data?.Media);
      }

      // Caso o anime tenha sido salvo com o ID do próprio AniList (ex: lançamentos futuros de 2027)
      if (!matchedOnAniList) {
        const resByAniId = await fetchWithTimeout(
          'https://graphql.anilist.co',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              query: anilistQuery,
              variables: { id: Number(anime.mal_id) },
            }),
          },
          5000
        );
        if (resByAniId.ok) {
          const json = await resByAniId.json();
          applyAniListMedia(json?.data?.Media);
        }
      }
    }

    if ((!matchedOnAniList || !isValidSynopsis(rawSynopsis) || genres.length === 0) && anime.title) {
      const resByTitle = await fetchWithTimeout(
        'https://graphql.anilist.co',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            query: anilistQuery,
            variables: { search: anime.title },
          }),
        },
        5000
      );
      if (resByTitle.ok) {
        const json = await resByTitle.json();
        applyAniListMedia(json?.data?.Media);
      }
    }
  } catch {}

  if (!isValidSynopsis(rawSynopsis) || !matchedOnAniList || episodes <= 0) {
    try {
      const jikanUrl =
        anime.mal_id && !matchedOnAniList
          ? `https://api.jikan.moe/v4/anime/${anime.mal_id}`
          : `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(anime.title)}&limit=1`;
      const jikanRes = await fetchWithTimeout(jikanUrl, {}, 5000);
      if (jikanRes.ok) {
        const jikanJson = await jikanRes.json();
        const d = Array.isArray(jikanJson?.data) ? jikanJson.data[0] : jikanJson?.data;
        if (d) {
          if (!isValidSynopsis(rawSynopsis) && isValidSynopsis(d.synopsis)) {
            rawSynopsis = cleanSynopsis(d.synopsis);
          }
          if (d.score && score === null) {
            score = Number(Number(d.score).toFixed(1));
          }
          if (d.episodes && (!episodes || (!matchedOnAniList && episodes === 12))) {
            episodes = d.episodes;
          }
          if (d.status && !matchedOnAniList) {
            status = normalizeStatus(d.status);
          }
          if (!year && (d.year || d.aired?.prop?.from?.year)) {
            year = d.year || d.aired?.prop?.from?.year;
          }
          if (genres.length === 0 && Array.isArray(d.genres)) {
            genres = translateGenres(d.genres.map((g: any) => g.name));
          }
          if (!image && d.images?.jpg?.large_image_url) {
            image = d.images.jpg.large_image_url;
          }
        }
      }
    } catch {}
  }

  const translatedSynopsis = await translateSynopsisToPt(rawSynopsis);
  const synced = syncWatchedAndEpisodes(anime.watched, episodes, anime.watchedEpisodes);

  const enriched: AnimeItem = {
    ...anime,
    image: image || anime.image,
    episodes: synced.episodes,
    watched: synced.watched,
    watchedEpisodes: synced.watchedEpisodes,
    synopsis: translatedSynopsis,
    status,
    year,
    score,
    genres,
    trailerUrl,
    nextAiringEpisode,
    notificationPref: anime.notificationPref || 'none',
  };

  memoryCache.set(cacheKey, { timestamp: Date.now(), data: enriched });
  return enriched;
}

async function fetchBatchFromAniListByMalIds(malIds: number[]) {
  const resultMap = new Map<number, any>();
  if (malIds.length === 0) return resultMap;

  const queryByMal = `
    query ($ids: [Int]) {
      Page(page: 1, perPage: 50) {
        media(idMal_in: $ids, type: ANIME) {
          id
          idMal
          title { romaji english native }
          coverImage { extraLarge large }
          description(asHtml: false)
          episodes
          nextAiringEpisode { episode airingAt }
          status
          seasonYear
          startDate { year }
          averageScore
          genres
          tags { name }
          trailer { id site }
        }
      }
    }
  `;

  try {
    const res = await fetchWithTimeout(
      'https://graphql.anilist.co',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: queryByMal, variables: { ids: malIds } }),
      },
      8000
    );
    if (res.ok) {
      const json = await res.json();
      const mediaList = json?.data?.Page?.media || [];
      mediaList.forEach((m: any) => {
        if (m?.idMal) {
          resultMap.set(Number(m.idMal), m);
        }
      });
    }
  } catch {}

  // Busca complementar por ID direto do AniList para animes futuros (ex: 2027) sem idMal vinculado
  const missingIds = malIds.filter((id) => !resultMap.has(Number(id)));
  if (missingIds.length > 0) {
    const queryByAniId = `
      query ($ids: [Int]) {
        Page(page: 1, perPage: 50) {
          media(id_in: $ids, type: ANIME) {
            id
            idMal
            title { romaji english native }
            coverImage { extraLarge large }
            description(asHtml: false)
            episodes
            nextAiringEpisode { episode airingAt }
            status
            seasonYear
            startDate { year }
            averageScore
            genres
            tags { name }
            trailer { id site }
          }
        }
      }
    `;
    try {
      const resAni = await fetchWithTimeout(
        'https://graphql.anilist.co',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query: queryByAniId, variables: { ids: missingIds } }),
        },
        8000
      );
      if (resAni.ok) {
        const jsonAni = await resAni.json();
        const mediaListAni = jsonAni?.data?.Page?.media || [];
        mediaListAni.forEach((m: any) => {
          if (m?.id && !resultMap.has(Number(m.id))) {
            resultMap.set(Number(m.id), m);
          }
        });
      }
    } catch {}
  }

  return resultMap;
}

export async function syncFavoritesOnlineWithProgress(
  favorites: AnimeItem[],
  options: {
    forceRefresh?: boolean;
    shouldCancel: () => boolean;
    onProgress: (current: number, total: number, currentTitle: string) => void;
    onPartialSave: (partialUpdatedList: AnimeItem[]) => Promise<void>;
  }
): Promise<{
  updatedList: AnimeItem[];
  newlyFinishedTitles: string[];
  wasCancelled: boolean;
}> {
  const total = favorites.length;
  if (!Array.isArray(favorites) || total === 0) {
    return { updatedList: [], newlyFinishedTitles: [], wasCancelled: false };
  }

  const newlyFinishedTitles: string[] = [];
  const workingList: AnimeItem[] = [...favorites];
  const CHUNK_SIZE = 45;
  const batchMediaMap = new Map<number, any>();

  for (let i = 0; i < total; i += CHUNK_SIZE) {
    if (options.shouldCancel()) {
      return { updatedList: workingList, newlyFinishedTitles, wasCancelled: true };
    }
    const chunkIds = workingList
      .slice(i, i + CHUNK_SIZE)
      .map((item) => Number(item.mal_id))
      .filter((id) => id > 0);
    const chunkMap = await fetchBatchFromAniListByMalIds(chunkIds);
    chunkMap.forEach((val, key) => batchMediaMap.set(key, val));
  }

  for (let idx = 0; idx < total; idx++) {
    if (options.shouldCancel()) {
      await options.onPartialSave(workingList);
      return { updatedList: workingList, newlyFinishedTitles, wasCancelled: true };
    }

    const fav = workingList[idx];
    options.onProgress(idx + 1, total, fav.title);

    const wasAiring = fav.status === 'Em Andamento';
    const preloaded = batchMediaMap.get(Number(fav.mal_id));

    try {
      let updatedItem: AnimeItem = { ...fav };

      if (preloaded) {
        const airedCount = preloaded.nextAiringEpisode?.episode
          ? Math.max(preloaded.nextAiringEpisode.episode - 1, 1)
          : 0;
        const rawEpisodes = preloaded.episodes || airedCount || fav.episodes || 12;
        const status = normalizeStatus(preloaded.status);
        const year = preloaded.seasonYear || preloaded.startDate?.year || fav.year;
        const score = preloaded.averageScore
          ? Number((preloaded.averageScore / 10).toFixed(1))
          : fav.score;
        const genres =
          Array.isArray(preloaded.genres) && preloaded.genres.length > 0
            ? translateGenres(preloaded.genres, preloaded.tags || [])
            : fav.genres || [];
        const image =
          fav.image || preloaded.coverImage?.extraLarge || preloaded.coverImage?.large || '';
        const trailerUrl =
          preloaded.trailer?.site === 'youtube' && preloaded.trailer?.id
            ? `https://www.youtube.com/watch?v=${preloaded.trailer.id}`
            : fav.trailerUrl || null;

        let synopsis = fav.synopsis;
        if (!isValidSynopsis(synopsis) || options.forceRefresh) {
          const rawDesc = cleanSynopsis(preloaded.description);
          if (isValidSynopsis(rawDesc)) {
            synopsis = await translateSynopsisToPt(rawDesc);
          }
        }

        // Sincroniza o estado "Visto" com todos os episódios 1..N
        const synced = syncWatchedAndEpisodes(fav.watched, rawEpisodes, fav.watchedEpisodes);

        if (wasAiring && status === 'Finalizado' && fav.notificationPref === 'finished') {
          newlyFinishedTitles.push(fav.title);
        }

        updatedItem = {
          ...fav,
          image,
          episodes: synced.episodes,
          watched: synced.watched,
          watchedEpisodes: synced.watchedEpisodes,
          synopsis: isValidSynopsis(synopsis) ? synopsis : fav.synopsis,
          status,
          year,
          score,
          genres,
          trailerUrl,
          nextAiringEpisode: preloaded.nextAiringEpisode
            ? {
                episode: preloaded.nextAiringEpisode.episode,
                airingAt: preloaded.nextAiringEpisode.airingAt,
              }
            : null,
          notificationPref: fav.notificationPref || 'none',
        };
      } else if (
        !isValidSynopsis(fav.synopsis) ||
        !fav.genres ||
        fav.genres.length === 0 ||
        !fav.year ||
        fav.status === 'Em Andamento'
      ) {
        const details = await fetchCompleteAnimeDetails(fav, true);
        const synced = syncWatchedAndEpisodes(
          fav.watched,
          details.episodes,
          fav.watchedEpisodes
        );

        if (wasAiring && details.status === 'Finalizado' && fav.notificationPref === 'finished') {
          newlyFinishedTitles.push(fav.title);
        }

        updatedItem = {
          ...fav,
          ...details,
          episodes: synced.episodes,
          watched: synced.watched,
          watchedEpisodes: synced.watchedEpisodes,
          notificationPref: fav.notificationPref || 'none',
        };
      } else {
        // Mesmo que não precise buscar na rede, garante que se estiver Visto todos os episódios estão marcados
        const synced = syncWatchedAndEpisodes(fav.watched, fav.episodes, fav.watchedEpisodes);
        updatedItem = {
          ...fav,
          episodes: synced.episodes,
          watched: synced.watched,
          watchedEpisodes: synced.watchedEpisodes,
        };
      }

      workingList[idx] = updatedItem;
    } catch {}

    if ((idx + 1) % 8 === 0 || idx === total - 1) {
      await options.onPartialSave([...workingList]);
    }
  }

  return { updatedList: workingList, newlyFinishedTitles, wasCancelled: false };
}

export function normalizeLegacyBackupList(rawParsed: any): AnimeItem[] {
  let rawArray: any[] = [];
  if (Array.isArray(rawParsed)) {
    rawArray = rawParsed;
  } else if (rawParsed && Array.isArray(rawParsed.favorites)) {
    rawArray = rawParsed.favorites;
  } else if (rawParsed && Array.isArray(rawParsed.data)) {
    rawArray = rawParsed.data;
  } else if (rawParsed && Array.isArray(rawParsed.animes)) {
    rawArray = rawParsed.animes;
  }

  return rawArray
    .filter((item) => item && (item.mal_id || item.id || item.title))
    .map((item, idx) => {
      const id = Number(item.mal_id || item.id || idx + 1);
      const image =
        item.image ||
        item.coverImage ||
        item.images?.jpg?.large_image_url ||
        item.images?.jpg?.image_url ||
        '';

      const rawWatchedEpisodes = Array.isArray(item.watchedEpisodes)
        ? item.watchedEpisodes.map(Number)
        : Array.isArray(item.episodesWatched)
        ? item.episodesWatched.map(Number)
        : [];

      const rawEpisodes = Number(
        item.episodes || item.totalEpisodes || item.total_episodes || rawWatchedEpisodes.length || 12
      );
      const rawWatchedFlag =
        Boolean(item.watched) ||
        Boolean(item.completed) ||
        item.statusUser === 'watched';

      // Preenche automaticamente 1..N episódios se o anime estiver marcado como visto
      const synced = syncWatchedAndEpisodes(rawWatchedFlag, rawEpisodes, rawWatchedEpisodes);

      return {
        mal_id: id,
        title: String(item.title || item.name || 'Sem Título'),
        image,
        bannerImage: item.bannerImage || null,
        synopsis: cleanSynopsis(item.synopsis || item.description || ''),
        episodes: synced.episodes,
        score: item.score !== undefined && item.score !== null ? Number(item.score) : null,
        year: Number(item.year || item.seasonYear || item.aired?.prop?.from?.year || 0) || null,
        status: normalizeStatus(item.status),
        genres: Array.isArray(item.genres)
          ? translateGenres(
              item.genres.map((g: any) => (typeof g === 'string' ? g : g?.name || '')).filter(Boolean)
            )
          : [],
        trailerUrl: item.trailerUrl || item.trailer?.url || null,
        isAdult: Boolean(item.isAdult),
        watched: synced.watched,
        watchedEpisodes: synced.watchedEpisodes,
        nextAiringEpisode: item.nextAiringEpisode || null,
        notificationPref: item.notificationPref || 'none',
      };
    });
}