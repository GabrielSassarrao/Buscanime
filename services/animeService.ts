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
    airingAt: number; // Unix timestamp em segundos
  } | null;
  notificationPref?: NotificationPreference;
}

const CACHE_PREFIX = '@buscanime_api_cache_v6_';
const CACHE_TTL = 1000 * 60 * 45;
const memoryCache = new Map<string, { timestamp: number; data: any }>();

export const GENRE_TRANSLATIONS: Record<string, string> = {
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
  Adult: 'Adulto',
};

export function translateGenres(genres: string[]): string[] {
  if (!Array.isArray(genres)) return [];
  return genres.map((g) => GENRE_TRANSLATIONS[g] || g);
}

export function cleanSynopsis(text: string): string {
  if (!text || text.trim().length === 0) {
    return 'Sinopse indisponível no momento.';
  }
  return text
    .replace(/<[^>]*>?/gm, '')
    .replace(/\[Written by MAL Rewrite\]/gi, '')
    .replace(/\(Source:.*?\)/gi, '')
    .trim();
}

export async function translateSynopsisToPt(text: string): Promise<string> {
  const cleaned = cleanSynopsis(text);
  if (cleaned === 'Sinopse indisponível no momento.') return cleaned;

  const cacheKey = `${CACHE_PREFIX}pt_${cleaned.slice(0, 35)}_${cleaned.length}`;
  const mem = memoryCache.get(cacheKey);
  if (mem) return mem.data;

  try {
    const saved = await AsyncStorage.getItem(cacheKey);
    if (saved) {
      memoryCache.set(cacheKey, { timestamp: Date.now(), data: saved });
      return saved;
    }

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(
      cleaned
    )}`;
    const response = await fetch(url);
    const json = await response.json();

    if (Array.isArray(json?.[0])) {
      const translated = json[0].map((part: any) => part[0]).join('');
      memoryCache.set(cacheKey, { timestamp: Date.now(), data: translated });
      await AsyncStorage.setItem(cacheKey, translated);
      return translated;
    }
    return cleaned;
  } catch {
    return cleaned;
  }
}

export function normalizeStatus(rawStatus?: string | null): 'Finalizado' | 'Em Andamento' {
  if (!rawStatus) return 'Em Andamento';
  const s = String(rawStatus).toUpperCase();
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
    genres: translateGenres(media.genres || []),
    trailerUrl,
    isAdult: media.isAdult || false,
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
}): Promise<AnimeItem[]> {
  const page = params.page || 1;
  const cacheKey = `${CACHE_PREFIX}catalog_${JSON.stringify(params)}`;
  const cached = memoryCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  let sort = ['POPULARITY_DESC'];
  let statusFilter: string | undefined = undefined;
  let isCurrentSeason = false;

  if (params.category === 'trending') sort = ['TRENDING_DESC', 'POPULARITY_DESC'];
  if (params.category === 'top') sort = ['SCORE_DESC'];
  if (params.category === 'airing') {
    sort = ['POPULARITY_DESC'];
    statusFilter = 'RELEASING';
  }
  if (params.category === 'season') {
    isCurrentSeason = true;
  }

  const reverseGenreMap: Record<string, string> = {};
  Object.entries(GENRE_TRANSLATIONS).forEach(([en, pt]) => {
    reverseGenreMap[pt] = en;
  });

  const apiGenres =
    Array.isArray(params.genres) && params.genres.length > 0
      ? params.genres.map((g) => reverseGenreMap[g] || g)
      : undefined;

  const query = `
    query ($page: Int, $search: String, $genres: [String], $sort: [MediaSort], $status: MediaStatus, $seasonYear: Int, $isAdult: Boolean) {
      Page(page: $page, perPage: 24) {
        media(
          type: ANIME,
          isAdult: $isAdult,
          search: $search,
          genre_in: $genres,
          sort: $sort,
          status: $status,
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
  }
  if (apiGenres) {
    variables.genres = apiGenres;
  }
  if (statusFilter) {
    variables.status = statusFilter;
  }
  if (params.year && /^\d{4}$/.test(params.year.trim())) {
    variables.seasonYear = Number(params.year.trim());
  }

  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    });

    if (response.ok) {
      const json = await response.json();
      const mediaList = json?.data?.Page?.media;
      if (Array.isArray(mediaList) && mediaList.length > 0) {
        let mapped = mediaList.map(mapAniListToAnimeItem);

        if (isCurrentSeason) {
          mapped = mapped.filter((i) => i.status === 'Em Andamento' || (i.year && i.year >= 2025));
        }

        memoryCache.set(cacheKey, { timestamp: Date.now(), data: mapped });
        return mapped;
      }
    }
  } catch (err) {
    console.warn('Erro ao carregar catálogo AniList:', err);
  }

  return [];
}

// Busca os animes em lançamento com episódio programado para montar o Carrossel Semanal
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
          isAdult
          trailer { id site }
        }
      }
    }
  `;

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { isAdult: includeAdult } }),
    });
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

// Sorteia um anime inteligente levando em conta gêneros escolhidos e excluindo os que o usuário já viu
export async function fetchRandomRecommendation(params: {
  genres: string[];
  excludedIds: Set<number>;
  includeAdult: boolean;
}): Promise<AnimeItem | null> {
  const reverseGenreMap: Record<string, string> = {};
  Object.entries(GENRE_TRANSLATIONS).forEach(([en, pt]) => {
    reverseGenreMap[pt] = en;
  });

  const apiGenres =
    params.genres.length > 0
      ? params.genres.map((g) => reverseGenreMap[g] || g)
      : undefined;

  // Busca páginas variadas entre os mais populares/bem avaliados para ter boas recomendações
  const randomPage = Math.floor(Math.random() * 5) + 1;

  const query = `
    query ($page: Int, $genres: [String], $isAdult: Boolean) {
      Page(page: $page, perPage: 40) {
        media(
          type: ANIME,
          isAdult: $isAdult,
          genre_in: $genres,
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
          isAdult
          trailer { id site }
        }
      }
    }
  `;

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query,
        variables: {
          page: randomPage,
          genres: apiGenres,
          isAdult: params.includeAdult,
        },
      }),
    });

    if (res.ok) {
      const json = await res.json();
      const mediaList: AnimeItem[] = (json?.data?.Page?.media || []).map(mapAniListToAnimeItem);
      const unseenCandidates = mediaList.filter((a) => !params.excludedIds.has(a.mal_id));

      if (unseenCandidates.length > 0) {
        const picked =
          unseenCandidates[Math.floor(Math.random() * unseenCandidates.length)];
        return await fetchCompleteAnimeDetails(picked);
      }
    }
  } catch (e) {
    console.warn('Erro ao sortear recomendação:', e);
  }

  return null;
}

export async function fetchCompleteAnimeDetails(anime: AnimeItem): Promise<AnimeItem> {
  const cacheKey = `${CACHE_PREFIX}full_${anime.mal_id}_${anime.title}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return {
      ...cached.data,
      watched: anime.watched,
      watchedEpisodes: anime.watchedEpisodes,
      notificationPref: anime.notificationPref || 'none',
    };
  }

  let episodes = anime.episodes || 0;
  let rawSynopsis = anime.synopsis || '';
  let status = anime.status;
  let year = anime.year;
  let score = anime.score;
  let genres = anime.genres || [];
  let trailerUrl = anime.trailerUrl || null;
  let nextAiringEpisode = anime.nextAiringEpisode || null;

  try {
    const query = `
      query ($idMal: Int, $search: String) {
        Media(idMal: $idMal, search: $search, type: ANIME) {
          id
          idMal
          description(asHtml: false)
          episodes
          nextAiringEpisode { episode airingAt }
          status
          seasonYear
          startDate { year }
          averageScore
          genres
          trailer { id site }
        }
      }
    `;
    const variables: any = anime.mal_id ? { idMal: Number(anime.mal_id) } : { search: anime.title };
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    });

    if (res.ok) {
      const json = await res.json();
      const m = json?.data?.Media;
      if (m) {
        const airedCount = m.nextAiringEpisode?.episode
          ? Math.max(m.nextAiringEpisode.episode - 1, 1)
          : 0;
        episodes = m.episodes || airedCount || episodes || 12;
        if (m.description) rawSynopsis = cleanSynopsis(m.description);
        status = normalizeStatus(m.status);
        year = m.seasonYear || m.startDate?.year || year;
        if (m.averageScore) score = Number((m.averageScore / 10).toFixed(1));
        if (Array.isArray(m.genres) && m.genres.length > 0) {
          genres = translateGenres(m.genres);
        }
        if (m.trailer?.site === 'youtube' && m.trailer?.id) {
          trailerUrl = `https://www.youtube.com/watch?v=${m.trailer.id}`;
        }
        nextAiringEpisode = m.nextAiringEpisode
          ? {
              episode: m.nextAiringEpisode.episode,
              airingAt: m.nextAiringEpisode.airingAt,
            }
          : null;
      }
    }
  } catch {}

  const translatedSynopsis = await translateSynopsisToPt(rawSynopsis);

  const enriched: AnimeItem = {
    ...anime,
    episodes: episodes > 0 ? episodes : 12,
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

// Sincroniza favoritos e também retorna quais animes acabaram de finalizar para disparar alerta de Fim de Temporada
export async function syncFavoritesOnlineWithAlerts(favorites: AnimeItem[]): Promise<{
  updatedList: AnimeItem[];
  newlyFinishedTitles: string[];
}> {
  if (!Array.isArray(favorites) || favorites.length === 0) {
    return { updatedList: [], newlyFinishedTitles: [] };
  }

  const newlyFinishedTitles: string[] = [];

  const updatedList = await Promise.all(
    favorites.map(async (fav) => {
      try {
        const wasAiring = fav.status === 'Em Andamento';
        const details = await fetchCompleteAnimeDetails(fav);
        const watchedEps = Array.isArray(fav.watchedEpisodes) ? fav.watchedEpisodes : [];
        const isAllWatched =
          fav.watched === true || (details.episodes > 0 && watchedEps.length >= details.episodes);

        // Detecta se o anime estava "Em Andamento", o usuário pediu aviso quando acabasse ('finished') e agora está "Finalizado"
        if (
          wasAiring &&
          details.status === 'Finalizado' &&
          fav.notificationPref === 'finished'
        ) {
          newlyFinishedTitles.push(fav.title);
        }

        return {
          ...fav,
          episodes: details.episodes || fav.episodes || 12,
          synopsis: details.synopsis || fav.synopsis,
          status: details.status || fav.status,
          year: details.year || fav.year,
          score: details.score ?? fav.score,
          genres: details.genres?.length ? details.genres : fav.genres,
          nextAiringEpisode: details.nextAiringEpisode ?? fav.nextAiringEpisode ?? null,
          watched: isAllWatched,
          watchedEpisodes: watchedEps,
          notificationPref: fav.notificationPref || 'none',
        };
      } catch {
        return fav;
      }
    })
  );

  return { updatedList, newlyFinishedTitles };
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
      const watchedEpisodes = Array.isArray(item.watchedEpisodes)
        ? item.watchedEpisodes.map(Number)
        : Array.isArray(item.episodesWatched)
        ? item.episodesWatched.map(Number)
        : [];
      const episodes = Number(item.episodes || item.totalEpisodes || watchedEpisodes.length || 12);
      const watched =
        Boolean(item.watched) ||
        Boolean(item.completed) ||
        item.statusUser === 'watched' ||
        (episodes > 0 && watchedEpisodes.length >= episodes);

      return {
        mal_id: id,
        title: String(item.title || item.name || 'Sem Título'),
        image,
        bannerImage: item.bannerImage || null,
        synopsis: cleanSynopsis(item.synopsis || item.description || ''),
        episodes,
        score: item.score ? Number(item.score) : null,
        year: Number(item.year || item.seasonYear || item.aired?.prop?.from?.year || 0) || null,
        status: normalizeStatus(item.status),
        genres: Array.isArray(item.genres)
          ? item.genres.map((g: any) => (typeof g === 'string' ? g : g?.name || '')).filter(Boolean)
          : [],
        trailerUrl: item.trailerUrl || item.trailer?.url || null,
        isAdult: Boolean(item.isAdult),
        watched,
        watchedEpisodes,
        nextAiringEpisode: item.nextAiringEpisode || null,
        notificationPref: item.notificationPref || 'none',
      };
    });
}