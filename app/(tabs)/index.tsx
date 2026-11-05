import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AnimeItem,
  NotificationPreference,
  fetchAnimesCatalog,
  fetchCompleteAnimeDetails,
  fetchRandomRecommendation,
  fetchWeeklyScheduleAnimes,
  normalizeLegacyBackupList,
  syncFavoritesOnlineWithAlerts,
} from '../../services/animeService';

const FAVORITES_STORAGE_KEY = '@buscanime_favorites_v4';
const AUTO_BACKUP_STORAGE_KEY = '@buscanime_auto_backup_snapshot';
const AUTO_BACKUP_DATE_KEY = '@buscanime_auto_backup_date';
const LEGACY_KEYS = [
  '@buscanime_favorites_v3',
  '@buscanime_favorites_v2',
  '@buscanime_favorites',
  'favorites',
  '@favorites',
];

const THEME_STORAGE_KEY = '@buscanime_theme_mode';
const ADULT_STORAGE_KEY = '@buscanime_include_adult';

const GENRES_LIST = [
  'Ação',
  'Aventura',
  'Comédia',
  'Drama',
  'Fantasia',
  'Ficção Científica',
  'Romance',
  'Suspense',
  'Terror',
  'Mistério',
  'Sobrenatural',
  'Slice of Life',
  'Esportes',
  'Hentai',
];

const WEEK_DAYS = [
  { id: 0, short: 'Dom', full: 'Domingo' },
  { id: 1, short: 'Seg', full: 'Segunda' },
  { id: 2, short: 'Ter', full: 'Terça' },
  { id: 3, short: 'Qua', full: 'Quarta' },
  { id: 4, short: 'Qui', full: 'Quinta' },
  { id: 5, short: 'Sex', full: 'Sexta' },
  { id: 6, short: 'Sáb', full: 'Sábado' },
];

type TabType = 'home' | 'favorites' | 'menu';
type SortOption = 'alphabetical' | 'newest' | 'oldest' | 'rating';
type WatchStatusFilter = 'all' | 'watched' | 'unwatched';
type AiringStatusFilter = 'all' | 'finished' | 'airing';

export default function BuscanimeApp() {
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [includeAdult, setIncludeAdult] = useState<boolean>(false);

  // Catálogo e Carrossel Semanal
  const [catalogAnimes, setCatalogAnimes] = useState<AnimeItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [yearFilterHome, setYearFilterHome] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<
    'trending' | 'season' | 'airing' | 'top' | 'popular'
  >('trending');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  // Estados do Carrossel Semanal na Tela Inicial
  const [weeklyAnimes, setWeeklyAnimes] = useState<AnimeItem[]>([]);
  const [selectedWeekDay, setSelectedWeekDay] = useState<number>(new Date().getDay());
  const [showWeeklyCarousel, setShowWeeklyCarousel] = useState<boolean>(true);

  // Favoritos
  const [favorites, setFavorites] = useState<AnimeItem[]>([]);
  const [syncingFavorites, setSyncingFavorites] = useState<boolean>(false);
  const [favSearchQuery, setFavSearchQuery] = useState<string>('');
  const [favSortBy, setFavSortBy] = useState<SortOption>('alphabetical');
  const [favWatchFilter, setFavWatchFilter] = useState<WatchStatusFilter>('all');
  const [favAiringFilter, setFavAiringFilter] = useState<AiringStatusFilter>('all');

  // Estados da Roleta Inteligente (Sugerir Anime Aleatório)
  const [rouletteModalVisible, setRouletteModalVisible] = useState<boolean>(false);
  const [rouletteGenres, setRouletteGenres] = useState<string[]>([]);
  const [rouletteSource, setRouletteSource] = useState<'catalog' | 'favorites'>('catalog');
  const [rouletteLoading, setRouletteLoading] = useState<boolean>(false);
  const [rouletteResult, setRouletteResult] = useState<AnimeItem | null>(null);

  // Estados de Backup Facilitado
  const [lastAutoBackupDate, setLastAutoBackupDate] = useState<string>('Nenhum ponto salvo');
  const [codeBackupModalVisible, setCodeBackupModalVisible] = useState<boolean>(false);
  const [backupCodeText, setBackupCodeText] = useState<string>('');

  // Modal Detalhes
  const [selectedAnime, setSelectedAnime] = useState<AnimeItem | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // Mescla duas listas mantendo episódios marcados e preferências de notificação
  const mergeAnimeLists = (currentList: AnimeItem[], importedList: AnimeItem[]): AnimeItem[] => {
    const map = new Map<number, AnimeItem>();
    currentList.forEach((item) => map.set(item.mal_id, item));

    importedList.forEach((imported) => {
      const existing = map.get(imported.mal_id);
      if (!existing) {
        map.set(imported.mal_id, imported);
      } else {
        const mergedEpisodes = Array.from(
          new Set([...(existing.watchedEpisodes || []), ...(imported.watchedEpisodes || [])])
        ).sort((a, b) => a - b);
        const maxTotal = Math.max(existing.episodes || 12, imported.episodes || 12);
        map.set(imported.mal_id, {
          ...existing,
          ...imported,
          episodes: maxTotal,
          watchedEpisodes: mergedEpisodes,
          watched: existing.watched || imported.watched || mergedEpisodes.length >= maxTotal,
          notificationPref:
            existing.notificationPref && existing.notificationPref !== 'none'
              ? existing.notificationPref
              : imported.notificationPref || 'none',
        });
      }
    });

    return Array.from(map.values());
  };

  // Dispara notificação local imediata quando uma temporada monitorada termina
  const triggerFinishedSeasonAlert = async (titles: string[]) => {
    if (titles.length === 0) return;
    try {
      if (Platform.OS !== 'web') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          for (const t of titles) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Temporada Finalizada! 🎉',
                body: `O anime "${t}" completou todos os episódios e já está pronto para você maratonar!`,
              },
              trigger: null,
            });
          }
        }
      }
      Alert.alert(
        'Temporada Finalizada! 🎉',
        `Os seguintes animes dos seus favoritos acabaram de finalizar a temporada:\n\n• ${titles.join(
          '\n• '
        )}`
      );
    } catch {}
  };

  // Carregamento inicial + Migração + Calendário Semanal
  useEffect(() => {
    (async () => {
      try {
        const themeSaved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (themeSaved !== null) setIsDarkMode(themeSaved === 'dark');

        const adultSaved = await AsyncStorage.getItem(ADULT_STORAGE_KEY);
        const isAdultEnabled = adultSaved === 'true';
        if (adultSaved !== null) setIncludeAdult(isAdultEnabled);

        const savedBackupDate = await AsyncStorage.getItem(AUTO_BACKUP_DATE_KEY);
        if (savedBackupDate) setLastAutoBackupDate(savedBackupDate);

        // Carrega calendário semanal para o carrossel da tela inicial
        fetchWeeklyScheduleAnimes(isAdultEnabled).then(setWeeklyAnimes);

        let initialList: AnimeItem[] = [];
        const rawFavs = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
        if (rawFavs) {
          initialList = normalizeLegacyBackupList(JSON.parse(rawFavs));
        }

        for (const oldKey of LEGACY_KEYS) {
          const oldRaw = await AsyncStorage.getItem(oldKey);
          if (oldRaw) {
            const oldList = normalizeLegacyBackupList(JSON.parse(oldRaw));
            if (oldList.length > 0) {
              initialList = mergeAnimeLists(initialList, oldList);
            }
          }
        }

        if (initialList.length > 0) {
          setFavorites(initialList);
          await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(initialList));

          setSyncingFavorites(true);
          const { updatedList, newlyFinishedTitles } =
            await syncFavoritesOnlineWithAlerts(initialList);
          setFavorites(updatedList);
          await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updatedList));
          setSyncingFavorites(false);

          if (newlyFinishedTitles.length > 0) {
            triggerFinishedSeasonAlert(newlyFinishedTitles);
          }
        }
      } catch {
        setSyncingFavorites(false);
      }
    })();
  }, []);

  const toggleTheme = async () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
  };

  const toggleAdultFilter = async () => {
    const next = !includeAdult;
    setIncludeAdult(next);
    await AsyncStorage.setItem(ADULT_STORAGE_KEY, String(next));
    fetchWeeklyScheduleAnimes(next).then(setWeeklyAnimes);
  };

  const saveFavoritesToStorage = async (newList: AnimeItem[]) => {
    setFavorites(newList);
    try {
      const jsonStr = JSON.stringify(newList);
      await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, jsonStr);

      if (newList.length > 0) {
        const nowFormatted = new Date().toLocaleString('pt-BR');
        await AsyncStorage.setItem(AUTO_BACKUP_STORAGE_KEY, jsonStr);
        await AsyncStorage.setItem(AUTO_BACKUP_DATE_KEY, nowFormatted);
        setLastAutoBackupDate(nowFormatted);
      }
    } catch {}
  };

  // Configurar Notificação para Anime em Lançamento (Semanal ou Fim de Temporada)
  const handleSetNotificationPreference = async (
    anime: AnimeItem,
    pref: NotificationPreference
  ) => {
    Haptics.selectionAsync().catch(() => {});

    const updatedAnime: AnimeItem = {
      ...anime,
      notificationPref: pref,
    };

    if (selectedAnime && selectedAnime.mal_id === anime.mal_id) {
      setSelectedAnime(updatedAnime);
    }

    const exists = favorites.some((f) => f.mal_id === anime.mal_id);
    const nextFavorites = exists
      ? favorites.map((f) => (f.mal_id === anime.mal_id ? updatedAnime : f))
      : [updatedAnime, ...favorites];

    await saveFavoritesToStorage(nextFavorites);

    if (pref === 'none') {
      Alert.alert('Alertas Desativados', `Você não receberá alertas para "${anime.title}".`);
      return;
    }

    if (Platform.OS !== 'web') {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          if (pref === 'weekly') {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `Novo episódio na semana: ${anime.title} 📺`,
                body: anime.nextAiringEpisode
                  ? `O episódio ${anime.nextAiringEpisode.episode} está programado no calendário da semana!`
                  : `Confira se já saiu episódio novo de ${anime.title} nos seus favoritos!`,
              },
              trigger: null,
            });
          } else if (pref === 'finished') {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `Monitorando fim de temporada: ${anime.title} ⏳`,
                body: `Avisaremos você assim que todos os episódios de ${anime.title} forem lançados!`,
              },
              trigger: null,
            });
          }
        }
      } catch {}
    }

    if (pref === 'weekly') {
      Alert.alert(
        'Alerta Semanal Ativado! 🔔',
        ` "${anime.title}" foi salvo nos seus favoritos com lembrete semanal de novos episódios.`
      );
    } else if (pref === 'finished') {
      Alert.alert(
        'Alerta de Fim de Temporada Ativado! 🏁',
        `Você será avisado assim que "${anime.title}" finalizar o lançamento de todos os episódios.`
      );
    }
  };

  // Carregar Catálogo
  const loadCatalog = useCallback(
    async (pageNum: number, reset: boolean = false) => {
      if (reset) {
        setLoadingCatalog(true);
      } else {
        setLoadingMore(true);
      }

      const results = await fetchAnimesCatalog({
        page: pageNum,
        search: searchQuery,
        genres: selectedGenres,
        category: selectedCategory,
        year: yearFilterHome,
        includeAdult: includeAdult,
      });

      setCatalogAnimes((prev) => {
        if (reset) return results;
        const existingIds = new Set(prev.map((i) => i.mal_id));
        const filtered = results.filter((i) => !existingIds.has(i.mal_id));
        return [...prev, ...filtered];
      });

      setLoadingCatalog(false);
      setLoadingMore(false);
    },
    [searchQuery, selectedGenres, selectedCategory, yearFilterHome, includeAdult]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadCatalog(1, true);
    }, 300);
    return () => clearTimeout(timer);
  }, [loadCatalog]);

  const toggleGenreSelection = (genre: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  // Filtra os animes do Carrossel Semanal pelo dia da semana selecionado (0 = Dom ... 6 = Sáb)
  const animesForSelectedDay = useMemo(() => {
    return weeklyAnimes
      .filter((anime) => {
        if (!anime.nextAiringEpisode?.airingAt) return false;
        const date = new Date(anime.nextAiringEpisode.airingAt * 1000);
        return date.getDay() === selectedWeekDay;
      })
      .sort(
        (a, b) =>
          (a.nextAiringEpisode?.airingAt || 0) - (b.nextAiringEpisode?.airingAt || 0)
      );
  }, [weeklyAnimes, selectedWeekDay]);

  // =========================================================================
  // ESTATÍSTICAS DE HORAS DE VIDA E GÊNEROS FAVORITOS
  // =========================================================================
  const userWatchStats = useMemo(() => {
    let totalWatchedEpisodes = 0;
    const genreCounts: Record<string, number> = {};

    favorites.forEach((fav) => {
      const epCount = Array.isArray(fav.watchedEpisodes)
        ? fav.watchedEpisodes.length
        : fav.watched
        ? fav.episodes || 12
        : 0;

      totalWatchedEpisodes += epCount;

      if (epCount > 0 && Array.isArray(fav.genres)) {
        fav.genres.forEach((g) => {
          genreCounts[g] = (genreCounts[g] || 0) + epCount;
        });
      }
    });

    // Média de 24 minutos por episódio de anime
    const totalMinutes = totalWatchedEpisodes * 24;
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre, count]) => ({ genre, count }));

    return {
      totalWatchedEpisodes,
      totalHours,
      days,
      hours,
      minutes,
      topGenres,
    };
  }, [favorites]);

  // =========================================================================
  // ROLETA INTELIGENTE DE ANIME ALEATÓRIO (BASEADO NO QUE JÁ VIU + GÊNEROS)
  // =========================================================================
  const handleSpinRoulette = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setRouletteLoading(true);
    setRouletteResult(null);

    // 1. Identifica todos os animes que o usuário já viu (ou já começou a ver) para nunca repetir
    const seenIds = new Set<number>();
    favorites.forEach((f) => {
      const watchedCount = Array.isArray(f.watchedEpisodes) ? f.watchedEpisodes.length : 0;
      if (f.watched || watchedCount > 0) {
        seenIds.add(f.mal_id);
      }
    });

    // 2. Se o usuário escolheu sortear dentro dos próprios Favoritos Não Vistos:
    if (rouletteSource === 'favorites') {
      const unwatchedFavs = favorites.filter((f) => {
        const watchedCount = Array.isArray(f.watchedEpisodes) ? f.watchedEpisodes.length : 0;
        const isUnwatched = !f.watched && watchedCount === 0;
        if (!isUnwatched) return false;
        if (rouletteGenres.length > 0) {
          return rouletteGenres.some((g) => (f.genres || []).includes(g));
        }
        return true;
      });

      if (unwatchedFavs.length === 0) {
        setRouletteLoading(false);
        Alert.alert(
          'Nenhum Favorito Pendente',
          'Você não tem animes "Não Vistos" nos seus favoritos com esses gêneros. Tente sortear do Catálogo Geral!'
        );
        return;
      }

      const randomFav = unwatchedFavs[Math.floor(Math.random() * unwatchedFavs.length)];
      const complete = await fetchCompleteAnimeDetails(randomFav);
      setRouletteResult(complete);
      setRouletteLoading(false);
      return;
    }

    // 3. Se não selecionou gêneros manualmente, usa os 2 gêneros que ele mais assistiu na vida!
    const genresToUse =
      rouletteGenres.length > 0
        ? rouletteGenres
        : userWatchStats.topGenres.slice(0, 2).map((g) => g.genre);

    const recommended = await fetchRandomRecommendation({
      genres: genresToUse,
      excludedIds: seenIds,
      includeAdult,
    });

    if (recommended) {
      setRouletteResult(recommended);
    } else {
      // Fallback nos carregados do catálogo que ainda não foram vistos
      const fallbackPool = catalogAnimes.filter((a) => !seenIds.has(a.mal_id));
      if (fallbackPool.length > 0) {
        const picked = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
        setRouletteResult(await fetchCompleteAnimeDetails(picked));
      } else {
        Alert.alert('Ops!', 'Tente selecionar menos gêneros para encontrar mais opções.');
      }
    }

    setRouletteLoading(false);
  };

  const handleOpenAnimeDetails = async (anime: AnimeItem) => {
    Haptics.selectionAsync().catch(() => {});
    const favMatch = favorites.find((f) => f.mal_id === anime.mal_id);
    const initialData: AnimeItem = favMatch
      ? { ...anime, ...favMatch }
      : { ...anime, watched: false, watchedEpisodes: [], notificationPref: 'none' };

    setSelectedAnime(initialData);
    setLoadingDetails(true);

    const complete = await fetchCompleteAnimeDetails(initialData);
    const updatedFavMatch = favorites.find((f) => f.mal_id === anime.mal_id);

    const merged: AnimeItem = {
      ...complete,
      watched: updatedFavMatch ? updatedFavMatch.watched : initialData.watched,
      watchedEpisodes: updatedFavMatch
        ? updatedFavMatch.watchedEpisodes || []
        : initialData.watchedEpisodes || [],
      notificationPref: updatedFavMatch
        ? updatedFavMatch.notificationPref || 'none'
        : initialData.notificationPref || 'none',
    };

    setSelectedAnime(merged);
    setLoadingDetails(false);

    if (updatedFavMatch) {
      const updatedList = favorites.map((f) => (f.mal_id === merged.mal_id ? merged : f));
      saveFavoritesToStorage(updatedList);
    }
  };

  const toggleFavorite = (anime: AnimeItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const exists = favorites.some((f) => f.mal_id === anime.mal_id);
    let updatedList: AnimeItem[];

    if (exists) {
      updatedList = favorites.filter((f) => f.mal_id !== anime.mal_id);
    } else {
      const newFav: AnimeItem = {
        ...anime,
        watched: anime.watched || false,
        watchedEpisodes: anime.watchedEpisodes || [],
        notificationPref: anime.notificationPref || 'none',
      };
      updatedList = [newFav, ...favorites];
    }
    saveFavoritesToStorage(updatedList);
  };

  const toggleEpisodeWatched = (episodeNumber: number) => {
    if (!selectedAnime) return;
    Haptics.selectionAsync().catch(() => {});

    const currentWatched = Array.isArray(selectedAnime.watchedEpisodes)
      ? [...selectedAnime.watchedEpisodes]
      : [];

    const exists = currentWatched.includes(episodeNumber);
    const nextWatched = exists
      ? currentWatched.filter((ep) => ep !== episodeNumber)
      : [...currentWatched, episodeNumber].sort((a, b) => a - b);

    const totalEps = selectedAnime.episodes || 12;
    const isAllWatched = nextWatched.length >= totalEps;

    const updatedAnime: AnimeItem = {
      ...selectedAnime,
      watchedEpisodes: nextWatched,
      watched: isAllWatched,
    };

    setSelectedAnime(updatedAnime);

    const isFav = favorites.some((f) => f.mal_id === updatedAnime.mal_id);
    if (isFav) {
      const updatedList = favorites.map((f) =>
        f.mal_id === updatedAnime.mal_id ? updatedAnime : f
      );
      saveFavoritesToStorage(updatedList);
    } else {
      saveFavoritesToStorage([updatedAnime, ...favorites]);
    }
  };

  const toggleWholeAnimeWatched = () => {
    if (!selectedAnime) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    const totalEps = selectedAnime.episodes || 12;
    const willBeWatched = !selectedAnime.watched;
    const allEpsArray = willBeWatched
      ? Array.from({ length: totalEps }, (_, i) => i + 1)
      : [];

    const updatedAnime: AnimeItem = {
      ...selectedAnime,
      watched: willBeWatched,
      watchedEpisodes: allEpsArray,
    };

    setSelectedAnime(updatedAnime);

    const isFav = favorites.some((f) => f.mal_id === updatedAnime.mal_id);
    if (isFav) {
      const updatedList = favorites.map((f) =>
        f.mal_id === updatedAnime.mal_id ? updatedAnime : f
      );
      saveFavoritesToStorage(updatedList);
    } else {
      saveFavoritesToStorage([updatedAnime, ...favorites]);
    }
  };

  const filteredFavorites = useMemo(() => {
    return favorites
      .filter((anime) => {
        const q = favSearchQuery.trim().toLowerCase();
        if (q.length > 0) {
          const matchName = (anime.title || '').toLowerCase().includes(q);
          const matchYear = String(anime.year || '').includes(q);
          if (!matchName && !matchYear) return false;
        }

        const totalEps = anime.episodes || 12;
        const watchedCount = Array.isArray(anime.watchedEpisodes)
          ? anime.watchedEpisodes.length
          : 0;
        const isWatched = anime.watched === true || (totalEps > 0 && watchedCount >= totalEps);

        if (favWatchFilter === 'watched' && !isWatched) return false;
        if (favWatchFilter === 'unwatched' && isWatched) return false;

        const isFinished = anime.status === 'Finalizado';
        if (favAiringFilter === 'finished' && !isFinished) return false;
        if (favAiringFilter === 'airing' && isFinished) return false;

        return true;
      })
      .sort((a, b) => {
        if (favSortBy === 'alphabetical') {
          return (a.title || '').localeCompare(b.title || '');
        }
        if (favSortBy === 'rating') {
          return (Number(b.score) || 0) - (Number(a.score) || 0);
        }
        const yearA = Number(a.year || 0);
        const yearB = Number(b.year || 0);
        if (favSortBy === 'newest') return yearB - yearA;
        if (favSortBy === 'oldest') return yearA - yearB;
        return 0;
      });
  }, [favorites, favSearchQuery, favSortBy, favWatchFilter, favAiringFilter]);

  // =========================================================================
  // BACKUP FACILITADO
  // =========================================================================
  const handleEasyExportBackup = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      if (favorites.length === 0) {
        Alert.alert('Lista Vazia', 'Adicione pelo menos 1 anime aos favoritos antes de fazer backup.');
        return;
      }

      const jsonString = JSON.stringify(favorites, null, 2);

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `buscanime_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      const fileUri = `${
        FileSystem.documentDirectory || FileSystem.cacheDirectory
      }buscanime_backup.json`;

      await FileSystem.writeAsStringAsync(fileUri, jsonString, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Enviar ou Salvar Backup do Buscanime',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('Backup Criado!', `Arquivo salvo em: ${fileUri}`);
      }
    } catch {
      Alert.alert(
        'Alternativa Rápida',
        'Use a opção "Backup por Código (Copiar/Colar)" logo abaixo para copiar sua lista.'
      );
    }
  };

  const handleEasyImportBackup = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      let content = '';
      if (Platform.OS === 'web' && (asset as any).file) {
        content = await (asset as any).file.text();
      } else if (Platform.OS === 'web' && asset.uri) {
        const res = await fetch(asset.uri);
        content = await res.text();
      } else {
        content = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      const parsed = JSON.parse(content);
      const listToImport = normalizeLegacyBackupList(parsed);

      if (listToImport.length > 0) {
        const merged = mergeAnimeLists(favorites, listToImport);
        await saveFavoritesToStorage(merged);
        Alert.alert(
          'Backup Restaurado! 🎉',
          `${listToImport.length} animes do arquivo foram carregados com sucesso (Total na lista: ${merged.length}).`
        );
      } else {
        Alert.alert('Arquivo Inválido', 'Nenhum anime foi encontrado neste arquivo JSON.');
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível ler o arquivo selecionado.');
    }
  };

  const handleRestoreAutoSnapshot = async () => {
    try {
      const rawSnap = await AsyncStorage.getItem(AUTO_BACKUP_STORAGE_KEY);
      if (!rawSnap) {
        Alert.alert('Aviso', 'Ainda não há um ponto automático salvo neste aparelho.');
        return;
      }
      const snapList = normalizeLegacyBackupList(JSON.parse(rawSnap));
      if (snapList.length > 0) {
        const merged = mergeAnimeLists(favorites, snapList);
        await saveFavoritesToStorage(merged);
        Alert.alert(
          'Recuperado com Sucesso! ✅',
          `Sua lista foi restaurada do backup automático (${merged.length} animes).`
        );
      }
    } catch {
      Alert.alert('Erro', 'Falha ao recuperar o backup automático.');
    }
  };

  const handleOpenCodeBackupModal = () => {
    setBackupCodeText(JSON.stringify(favorites));
    setCodeBackupModalVisible(true);
  };

  const handleRestoreFromCodeText = async () => {
    try {
      if (!backupCodeText.trim()) {
        Alert.alert('Campo Vazio', 'Cole o código do seu backup na caixa de texto.');
        return;
      }
      const parsed = JSON.parse(backupCodeText.trim());
      const imported = normalizeLegacyBackupList(parsed);
      if (imported.length > 0) {
        const merged = mergeAnimeLists(favorites, imported);
        await saveFavoritesToStorage(merged);
        setCodeBackupModalVisible(false);
        Alert.alert(
          'Código Restaurado! 🎉',
          `${imported.length} animes foram importados com sucesso.`
        );
      } else {
        Alert.alert('Código Inválido', 'O texto colado não contém animes válidos.');
      }
    } catch {
      Alert.alert('Código Inválido', 'Verifique se copiou o texto JSON completo.');
    }
  };

  const theme = {
    bg: isDarkMode ? '#070F1E' : '#F1F5F9',
    cardBg: isDarkMode ? '#111E36' : '#FFFFFF',
    text: isDarkMode ? '#F8FAFC' : '#0F172A',
    subText: isDarkMode ? '#94A3B8' : '#64748B',
    border: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    bottomBarBg: isDarkMode ? '#0B162C' : '#FFFFFF',
  };

  const renderAnimeCard = ({ item, index }: { item: AnimeItem; index: number }) => {
    const favItem = favorites.find((f) => f.mal_id === item.mal_id);
    const displayItem = favItem ? { ...item, ...favItem } : item;
    const totalEps = displayItem.episodes || 12;
    const watchedCount = Array.isArray(displayItem.watchedEpisodes)
      ? displayItem.watchedEpisodes.length
      : 0;
    const isWatched = displayItem.watched || (totalEps > 0 && watchedCount >= totalEps);
    const progressPercent = Math.min((watchedCount / totalEps) * 100, 100);
    const isFinished = displayItem.status === 'Finalizado';
    const notifPref = displayItem.notificationPref || 'none';

    return (
      <Animated.View
        entering={FadeInDown.delay(Math.min(index * 35, 250)).duration(260)}
        style={styles.cardWrapper}
      >
        <TouchableOpacity
          activeOpacity={0.86}
          style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
          onPress={() => handleOpenAnimeDetails(displayItem)}
        >
          <View style={styles.posterBox}>
            <Image
              source={{ uri: displayItem.image }}
              style={styles.posterImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
            <View style={styles.scorePill}>
              <Ionicons name="star" size={11} color="#FBBF24" />
              <Text style={styles.scoreText}>
                {displayItem.score ? displayItem.score.toFixed(1) : 'N/A'}
              </Text>
            </View>

            {favItem && (
              <View style={styles.favBadgeTop}>
                <Ionicons name="bookmark" size={13} color="#38BDF8" />
                {notifPref !== 'none' && (
                  <Ionicons
                    name={notifPref === 'weekly' ? 'notifications' : 'flag'}
                    size={12}
                    color="#FBBF24"
                    style={{ marginLeft: 4 }}
                  />
                )}
              </View>
            )}

            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: isFinished
                    ? 'rgba(16, 185, 129, 0.92)'
                    : 'rgba(14, 165, 233, 0.92)',
                },
              ]}
            >
              <Text style={styles.statusPillText}>{displayItem.status}</Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <Text numberOfLines={2} style={[styles.cardTitle, { color: theme.text }]}>
              {displayItem.title}
            </Text>

            <View style={styles.cardMetaRow}>
              <Text style={[styles.cardMetaText, { color: theme.subText }]}>
                {displayItem.year || '----'} • {totalEps} eps
              </Text>
              {isWatched && (
                <View style={styles.watchedTag}>
                  <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                  <Text style={styles.watchedTagText}>Visto</Text>
                </View>
              )}
            </View>

            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressTrack,
                  { backgroundColor: isDarkMode ? '#070F1E' : '#E2E8F0' },
                ]}
              >
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={[styles.progressCount, { color: theme.subText }]}>
                {watchedCount}/{totalEps}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Cabeçalho da FlatList na Tela Inicial com o Carrossel Semanal de Lançamentos
  const renderHomeListHeader = () => {
    if (!showWeeklyCarousel || weeklyAnimes.length === 0) return null;

    return (
      <View
        style={[
          styles.weeklyContainer,
          { backgroundColor: theme.cardBg, borderColor: theme.border },
        ]}
      >
        <View style={styles.weeklyHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="calendar" size={16} color="#38BDF8" />
            <Text style={[styles.weeklyTitle, { color: theme.text }]}>
              Calendário Semanal de Lançamentos
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowWeeklyCarousel(false)}>
            <Text style={{ color: theme.subText, fontSize: 11, fontWeight: '600' }}>Ocultar</Text>
          </TouchableOpacity>
        </View>

        {/* Seletor de Dias da Semana (Dom a Sáb) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.weekDaysScroll}
        >
          {WEEK_DAYS.map((d) => {
            const isToday = d.id === new Date().getDay();
            const isSelected = d.id === selectedWeekDay;
            return (
              <TouchableOpacity
                key={d.id}
                style={[
                  styles.weekDayBtn,
                  { borderColor: theme.border },
                  isSelected && styles.weekDayBtnActive,
                ]}
                onPress={() => setSelectedWeekDay(d.id)}
              >
                <Text
                  style={[
                    styles.weekDayText,
                    { color: theme.subText },
                    isSelected && styles.weekDayTextActive,
                  ]}
                >
                  {d.short} {isToday ? '•' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Carrossel de Animes que saem no dia escolhido */}
        {animesForSelectedDay.length === 0 ? (
          <Text style={[styles.noScheduleText, { color: theme.subText }]}>
            Nenhum episódio programado para {WEEK_DAYS[selectedWeekDay].full}.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {animesForSelectedDay.map((anime) => {
              const airDate = anime.nextAiringEpisode?.airingAt
                ? new Date(anime.nextAiringEpisode.airingAt * 1000)
                : null;
              const timeStr = airDate
                ? airDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <TouchableOpacity
                  key={`sched_${anime.mal_id}`}
                  style={styles.carouselCard}
                  activeOpacity={0.85}
                  onPress={() => handleOpenAnimeDetails(anime)}
                >
                  <Image
                    source={{ uri: anime.image }}
                    style={styles.carouselPoster}
                    contentFit="cover"
                  />
                  <View style={styles.carouselEpBadge}>
                    <Text style={styles.carouselEpBadgeText}>
                      Ep {anime.nextAiringEpisode?.episode} • {timeStr}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[styles.carouselAnimeTitle, { color: theme.text }]}
                  >
                    {anime.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: Math.max(insets.top, 12) }]}>
      {/* CABEÇALHO DO APP COM BOTÃO DE SORTEAR ANIME ALEATÓRIO */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.brandTitle, { color: theme.text }]}>
            Busc<Text style={styles.brandAccent}>anime</Text>
          </Text>
          <Text style={[styles.brandSubtitle, { color: theme.subText }]}>
            {activeTab === 'home'
              ? `${userWatchStats.totalHours}h assistidas • Explore catálogos`
              : activeTab === 'favorites'
              ? `${favorites.length} animes salvos`
              : 'Estatísticas, Backup e Ajustes'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Botão da Roleta Inteligente (Sugerir Anime Aleatório) */}
          <TouchableOpacity
            style={styles.rouletteHeaderBtn}
            onPress={() => setRouletteModalVisible(true)}
          >
            <Ionicons name="dice" size={17} color="#FFFFFF" />
            <Text style={styles.rouletteHeaderBtnText}>Sortear</Text>
          </TouchableOpacity>

          {activeTab === 'favorites' && (
            <TouchableOpacity
              style={styles.syncButton}
              onPress={async () => {
                if (favorites.length === 0) return;
                setSyncingFavorites(true);
                const { updatedList, newlyFinishedTitles } =
                  await syncFavoritesOnlineWithAlerts(favorites);
                await saveFavoritesToStorage(updatedList);
                setSyncingFavorites(false);
                if (newlyFinishedTitles.length > 0) {
                  triggerFinishedSeasonAlert(newlyFinishedTitles);
                } else {
                  Alert.alert('Sincronizado!', 'Favoritos e status de temporada atualizados.');
                }
              }}
              disabled={syncingFavorites}
            >
              {syncingFavorites ? (
                <ActivityIndicator size="small" color="#38BDF8" />
              ) : (
                <Ionicons name="sync" size={16} color="#38BDF8" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ABA 1: INÍCIO */}
      {activeTab === 'home' && (
        <Animated.View entering={FadeIn.duration(220)} style={styles.flexOne}>
          <View style={styles.filtersContainer}>
            <View style={styles.searchRow}>
              <View
                style={[
                  styles.searchInputBox,
                  { backgroundColor: theme.cardBg, borderColor: theme.border, flex: 1 },
                ]}
              >
                <Ionicons name="search" size={18} color={theme.subText} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Buscar anime..."
                  placeholderTextColor={theme.subText}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={theme.subText} />
                  </TouchableOpacity>
                )}
              </View>

              <View
                style={[
                  styles.yearInputBox,
                  { backgroundColor: theme.cardBg, borderColor: theme.border },
                ]}
              >
                <Ionicons name="calendar-outline" size={16} color={theme.subText} />
                <TextInput
                  style={[styles.yearInput, { color: theme.text }]}
                  placeholder="Ano"
                  placeholderTextColor={theme.subText}
                  keyboardType="numeric"
                  maxLength={4}
                  value={yearFilterHome}
                  onChangeText={setYearFilterHome}
                />
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
            >
              {[
                { id: 'trending', label: '🔥 Em Alta' },
                { id: 'season', label: '🌸 Da Temporada' },
                { id: 'airing', label: '⚡ Em Lançamento' },
                { id: 'top', label: '⭐ Melhores' },
                { id: 'popular', label: '🏆 Populares' },
              ].map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    { backgroundColor: theme.cardBg, borderColor: theme.border },
                    selectedCategory === cat.id && styles.categoryChipActive,
                  ]}
                  onPress={() => setSelectedCategory(cat.id as any)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: theme.subText },
                      selectedCategory === cat.id && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
            >
              {GENRES_LIST.map((genre) => {
                const isSelected = selectedGenres.includes(genre);
                return (
                  <TouchableOpacity
                    key={genre}
                    style={[
                      styles.genrePill,
                      { backgroundColor: theme.cardBg, borderColor: theme.border },
                      isSelected && styles.genrePillActive,
                    ]}
                    onPress={() => toggleGenreSelection(genre)}
                  >
                    <Text
                      style={[
                        styles.genrePillText,
                        { color: theme.subText },
                        isSelected && styles.genrePillTextActive,
                      ]}
                    >
                      {genre} {isSelected && '✓'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {loadingCatalog ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#38BDF8" />
              <Text style={[styles.loadingText, { color: theme.subText }]}>
                Carregando animes...
              </Text>
            </View>
          ) : (
            <FlatList
              data={catalogAnimes}
              keyExtractor={(item, idx) => `${item.mal_id}_${idx}`}
              numColumns={2}
              ListHeaderComponent={renderHomeListHeader}
              renderItem={renderAnimeCard}
              contentContainerStyle={styles.gridContent}
              onEndReached={() => {
                if (!loadingMore && catalogAnimes.length >= 12) {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  loadCatalog(nextPage, false);
                }
              }}
              onEndReachedThreshold={0.5}
            />
          )}
        </Animated.View>
      )}

      {/* ABA 2: FAVORITOS */}
      {activeTab === 'favorites' && (
        <Animated.View entering={FadeIn.duration(220)} style={styles.flexOne}>
          <View style={[styles.favFiltersWrapper, { borderBottomColor: theme.border }]}>
            <View
              style={[
                styles.searchInputBox,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
            >
              <Ionicons name="search" size={18} color={theme.subText} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Buscar favoritos por nome ou ano..."
                placeholderTextColor={theme.subText}
                value={favSearchQuery}
                onChangeText={setFavSearchQuery}
              />
              {favSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setFavSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={theme.subText} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.filterGroupLabel, { color: theme.subText }]}>ORDENAÇÃO</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
            >
              {[
                { id: 'alphabetical', label: 'A-Z' },
                { id: 'newest', label: 'Mais Novos' },
                { id: 'oldest', label: 'Mais Antigos' },
                { id: 'rating', label: 'Melhor Avaliados' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.categoryChip,
                    { backgroundColor: theme.cardBg, borderColor: theme.border },
                    favSortBy === opt.id && styles.categoryChipActive,
                  ]}
                  onPress={() => setFavSortBy(opt.id as SortOption)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: theme.subText },
                      favSortBy === opt.id && styles.categoryChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.filterGroupLabel, { color: theme.subText }]}>
              STATUS DE VISUALIZAÇÃO
            </Text>
            <View style={styles.segmentedRow}>
              {[
                { id: 'all', label: 'Todos' },
                { id: 'watched', label: 'Visto' },
                { id: 'unwatched', label: 'Não Visto' },
              ].map((st) => (
                <TouchableOpacity
                  key={st.id}
                  style={[
                    styles.segmentButton,
                    { backgroundColor: theme.cardBg, borderColor: theme.border },
                    favWatchFilter === st.id && styles.segmentButtonActive,
                  ]}
                  onPress={() => setFavWatchFilter(st.id as WatchStatusFilter)}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      { color: theme.subText },
                      favWatchFilter === st.id && styles.segmentButtonTextActive,
                    ]}
                  >
                    {st.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.filterGroupLabel, { color: theme.subText }]}>
              STATUS DE LANÇAMENTO
            </Text>
            <View style={styles.segmentedRow}>
              {[
                { id: 'all', label: 'Todos' },
                { id: 'finished', label: 'Finalizado' },
                { id: 'airing', label: 'Em Andamento' },
              ].map((air) => (
                <TouchableOpacity
                  key={air.id}
                  style={[
                    styles.segmentButton,
                    { backgroundColor: theme.cardBg, borderColor: theme.border },
                    favAiringFilter === air.id && styles.segmentButtonActive,
                  ]}
                  onPress={() => setFavAiringFilter(air.id as AiringStatusFilter)}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      { color: theme.subText },
                      favAiringFilter === air.id && styles.segmentButtonTextActive,
                    ]}
                  >
                    {air.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {filteredFavorites.length === 0 ? (
            <View style={styles.centerBox}>
              <Ionicons name="bookmark-outline" size={48} color={theme.subText} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Nenhum favorito encontrado
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredFavorites}
              keyExtractor={(item, idx) => `fav_${item.mal_id}_${idx}`}
              numColumns={2}
              renderItem={renderAnimeCard}
              contentContainerStyle={styles.gridContent}
            />
          )}
        </Animated.View>
      )}

      {/* ABA 3: MENU, ESTATÍSTICAS DE HORAS E CENTRAL DE BACKUP */}
      {activeTab === 'menu' && (
        <Animated.View entering={FadeIn.duration(220)} style={styles.flexOne}>
          <ScrollView contentContainerStyle={styles.menuScroll}>
            {/* Card Principal do Horômetro / Tempo de Vida em Animes */}
            <View
              style={[
                styles.watchTimeCard,
                { backgroundColor: theme.cardBg, borderColor: 'rgba(56, 189, 248, 0.35)' },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="time" size={22} color="#38BDF8" />
                <Text style={[styles.watchTimeHeader, { color: theme.text }]}>
                  Seu Tempo Total em Animes
                </Text>
              </View>

              <Text style={styles.watchTimeBig}>
                {userWatchStats.days}d {userWatchStats.hours}h {userWatchStats.minutes}min
              </Text>
              <Text style={[styles.watchTimeSub, { color: theme.subText }]}>
                {userWatchStats.totalWatchedEpisodes} episódios assistidos ({userWatchStats.totalHours}{' '}
                horas acumuladas)
              </Text>

              {userWatchStats.topGenres.length > 0 && (
                <View style={styles.topGenresBox}>
                  <Text style={[styles.topGenresLabel, { color: theme.subText }]}>
                    SEUS GÊNEROS MAIS ASSISTIDOS:
                  </Text>
                  <View style={styles.topGenresRow}>
                    {userWatchStats.topGenres.map((g) => (
                      <View key={g.genre} style={styles.topGenreBadge}>
                        <Text style={styles.topGenreBadgeText}>
                          {g.genre} ({g.count} eps)
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            <View style={styles.statsGrid}>
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: theme.cardBg, borderColor: theme.border },
                ]}
              >
                <Text style={styles.statValue}>{favorites.length}</Text>
                <Text style={[styles.statLabel, { color: theme.subText }]}>Favoritos</Text>
              </View>
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: theme.cardBg, borderColor: theme.border },
                ]}
              >
                <Text style={styles.statValue}>{favorites.filter((f) => f.watched).length}</Text>
                <Text style={[styles.statLabel, { color: theme.subText }]}>Animes Completos</Text>
              </View>
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: theme.cardBg, borderColor: theme.border },
                ]}
              >
                <Text style={styles.statValue}>
                  {favorites.filter((f) => f.notificationPref && f.notificationPref !== 'none').length}
                </Text>
                <Text style={[styles.statLabel, { color: theme.subText }]}>Alertas Ativos</Text>
              </View>
            </View>

            <Text style={[styles.menuSectionTitle, { color: theme.subText }]}>
              Backup Fácil (Compatível com Versão Antiga)
            </Text>

            <View
              style={[
                styles.autoBackupBanner,
                { backgroundColor: theme.cardBg, borderColor: 'rgba(16, 185, 129, 0.35)' },
              ]}
            >
              <View style={styles.autoBackupHeader}>
                <Ionicons name="shield-checkmark" size={20} color="#10B981" />
                <Text style={[styles.autoBackupTitle, { color: theme.text }]}>
                  Auto-Backup Ativo no Aparelho
                </Text>
              </View>
              <Text style={[styles.autoBackupSub, { color: theme.subText }]}>
                Último salvamento automático: {lastAutoBackupDate}
              </Text>
              <TouchableOpacity
                style={styles.autoRestoreBtn}
                onPress={handleRestoreAutoSnapshot}
              >
                <Ionicons name="refresh-circle" size={18} color="#10B981" />
                <Text style={styles.autoRestoreBtnText}>
                  Recuperar Lista do Auto-Backup (1 Toque)
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.menuActionCard,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
              onPress={handleEasyExportBackup}
            >
              <View style={[styles.menuIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                <Ionicons name="share-social-outline" size={22} color="#38BDF8" />
              </View>
              <View style={styles.flexOne}>
                <Text style={[styles.menuActionTitle, { color: theme.text }]}>
                  Salvar ou Enviar Backup (1 Clique)
                </Text>
                <Text style={[styles.menuActionDesc, { color: theme.subText }]}>
                  Envia para o WhatsApp, Google Drive ou baixa o arquivo .json compatível
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.subText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.menuActionCard,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
              onPress={handleEasyImportBackup}
            >
              <View style={[styles.menuIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="folder-open-outline" size={22} color="#10B981" />
              </View>
              <View style={styles.flexOne}>
                <Text style={[styles.menuActionTitle, { color: theme.text }]}>
                  Restaurar Arquivo de Backup (.json)
                </Text>
                <Text style={[styles.menuActionDesc, { color: theme.subText }]}>
                  Lê backups antigos e novos somando à sua lista atual sem apagar nada
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.subText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.menuActionCard,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
              onPress={handleOpenCodeBackupModal}
            >
              <View style={[styles.menuIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <Ionicons name="copy-outline" size={22} color="#A855F7" />
              </View>
              <View style={styles.flexOne}>
                <Text style={[styles.menuActionTitle, { color: theme.text }]}>
                  Backup por Código (Copiar / Colar)
                </Text>
                <Text style={[styles.menuActionDesc, { color: theme.subText }]}>
                  Mais fácil: copie ou cole sua lista em texto sem precisar achar arquivos
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.subText} />
            </TouchableOpacity>

            <Text style={[styles.menuSectionTitle, { color: theme.subText, marginTop: 10 }]}>
              Aparência e Conteúdo
            </Text>

            <View
              style={[
                styles.menuActionCard,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
            >
              <View style={[styles.menuIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                <Ionicons name={isDarkMode ? 'moon' : 'sunny'} size={22} color="#38BDF8" />
              </View>
              <View style={styles.flexOne}>
                <Text style={[styles.menuActionTitle, { color: theme.text }]}>
                  Modo Escuro / Claro
                </Text>
                <Text style={[styles.menuActionDesc, { color: theme.subText }]}>
                  Alternar tema visual do aplicativo
                </Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ true: '#0284C7', false: '#CBD5E1' }}
              />
            </View>

            <View
              style={[
                styles.menuActionCard,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
            >
              <View style={[styles.menuIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Ionicons name="alert-circle-outline" size={22} color="#EF4444" />
              </View>
              <View style={styles.flexOne}>
                <Text style={[styles.menuActionTitle, { color: theme.text }]}>
                  Conteúdo +18 / Hentai
                </Text>
                <Text style={[styles.menuActionDesc, { color: theme.subText }]}>
                  Incluir animes adultos no catálogo
                </Text>
              </View>
              <Switch
                value={includeAdult}
                onValueChange={toggleAdultFilter}
                trackColor={{ true: '#EF4444', false: '#CBD5E1' }}
              />
            </View>

            {!showWeeklyCarousel && (
              <TouchableOpacity
                style={[
                  styles.menuActionCard,
                  { backgroundColor: theme.cardBg, borderColor: theme.border },
                ]}
                onPress={() => setShowWeeklyCarousel(true)}
              >
                <View style={[styles.menuIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                  <Ionicons name="calendar-outline" size={22} color="#38BDF8" />
                </View>
                <View style={styles.flexOne}>
                  <Text style={[styles.menuActionTitle, { color: theme.text }]}>
                    Reexibir Carrossel Semanal na Tela Inicial
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </ScrollView>
        </Animated.View>
      )}

      {/* ========================================================================= */}
      {/* MODAL DA ROLETA INTELIGENTE (SUGERIR ANIME ALEATÓRIO) */}
      {/* ========================================================================= */}
      <Modal
        visible={rouletteModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setRouletteModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDarkMode ? '#0A1528' : '#FFFFFF',
                paddingBottom: Math.max(insets.bottom + 16, 24),
              },
            ]}
          >
            <View style={styles.modalHeaderBar}>
              <Text style={[styles.modalHeaderTitle, { color: theme.text, textAlign: 'left' }]}>
                🎲 Sugerir Anime Aleatório
              </Text>
              <TouchableOpacity
                style={[styles.modalCloseBtn, { backgroundColor: theme.cardBg }]}
                onPress={() => setRouletteModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.menuActionDesc, { color: theme.subText, marginBottom: 10 }]}>
                O sorteio exclui automaticamente os animes que você já assistiu e leva em conta seu
                gosto ou os gêneros marcados abaixo:
              </Text>

              <Text style={[styles.filterGroupLabel, { color: theme.subText }]}>
                ONDE SORTEAR?
              </Text>
              <View style={styles.segmentedRow}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    { backgroundColor: theme.cardBg, borderColor: theme.border },
                    rouletteSource === 'catalog' && styles.segmentButtonActive,
                  ]}
                  onPress={() => setRouletteSource('catalog')}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      { color: theme.subText },
                      rouletteSource === 'catalog' && styles.segmentButtonTextActive,
                    ]}
                  >
                    Catálogo Geral (Baseado no que já vi)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    { backgroundColor: theme.cardBg, borderColor: theme.border },
                    rouletteSource === 'favorites' && styles.segmentButtonActive,
                  ]}
                  onPress={() => setRouletteSource('favorites')}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      { color: theme.subText },
                      rouletteSource === 'favorites' && styles.segmentButtonTextActive,
                    ]}
                  >
                    Meus Favoritos Não Vistos
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.filterGroupLabel, { color: theme.subText, marginTop: 10 }]}>
                FILTRAR GÊNEROS PARA O SORTEIO (OPCIONAL)
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 14 }}
              >
                {GENRES_LIST.map((g) => {
                  const active = rouletteGenres.includes(g);
                  return (
                    <TouchableOpacity
                      key={`roul_${g}`}
                      style={[
                        styles.genrePill,
                        { backgroundColor: theme.cardBg, borderColor: theme.border },
                        active && styles.genrePillActive,
                      ]}
                      onPress={() =>
                        setRouletteGenres((prev) =>
                          prev.includes(g) ? prev.filter((item) => item !== g) : [...prev, g]
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.genrePillText,
                          { color: theme.subText },
                          active && styles.genrePillTextActive,
                        ]}
                      >
                        {g} {active && '✓'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={styles.spinActionBtn}
                onPress={handleSpinRoulette}
                disabled={rouletteLoading}
              >
                {rouletteLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                    <Text style={styles.spinActionBtnText}>
                      {rouletteResult ? 'Sortear Outro Anime' : 'Girar Roleta Agora'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {rouletteResult && (
                <View
                  style={[
                    styles.rouletteResultCard,
                    { backgroundColor: theme.cardBg, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.modalHeroRow}>
                    <Image
                      source={{ uri: rouletteResult.image }}
                      style={styles.modalPoster}
                      contentFit="cover"
                    />
                    <View style={styles.modalHeroInfo}>
                      <Text style={[styles.modalAnimeTitle, { color: theme.text }]}>
                        {rouletteResult.title}
                      </Text>
                      <Text style={[styles.modalMetaLine, { color: theme.subText }]}>
                        {rouletteResult.year || '----'} • {rouletteResult.episodes || 12} eps • ⭐{' '}
                        {rouletteResult.score ? rouletteResult.score.toFixed(1) : 'N/A'}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={[styles.modalMetaLine, { color: '#38BDF8', fontWeight: '600' }]}
                      >
                        {(rouletteResult.genres || []).join(' • ')}
                      </Text>

                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <TouchableOpacity
                          style={[styles.actionBtnPrimary, { flex: 1 }]}
                          onPress={() => {
                            setRouletteModalVisible(false);
                            handleOpenAnimeDetails(rouletteResult);
                          }}
                        >
                          <Text style={styles.actionBtnText}>Ver Detalhes</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.actionBtnPrimary,
                            { backgroundColor: '#10B981', paddingHorizontal: 10 },
                          ]}
                          onPress={() => toggleFavorite(rouletteResult)}
                        >
                          <Ionicons
                            name={
                              favorites.some((f) => f.mal_id === rouletteResult.mal_id)
                                ? 'bookmark'
                                : 'bookmark-outline'
                            }
                            size={16}
                            color="#FFF"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                  <Text
                    numberOfLines={4}
                    style={[styles.synopsisText, { color: theme.text, padding: 4 }]}
                  >
                    {rouletteResult.synopsis}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL DE BACKUP POR CÓDIGO */}
      <Modal
        visible={codeBackupModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setCodeBackupModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDarkMode ? '#0A1528' : '#FFFFFF',
                paddingBottom: Math.max(insets.bottom + 16, 24),
              },
            ]}
          >
            <View style={styles.modalHeaderBar}>
              <Text style={[styles.modalHeaderTitle, { color: theme.text, textAlign: 'left' }]}>
                Backup Rápido em Texto
              </Text>
              <TouchableOpacity
                style={[styles.modalCloseBtn, { backgroundColor: theme.cardBg }]}
                onPress={() => setCodeBackupModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.menuActionDesc, { color: theme.subText, marginBottom: 10 }]}>
              Copie todo o código abaixo para guardar ou cole seu código antigo/novo para restaurar:
            </Text>

            <TextInput
              style={[
                styles.codeBackupInput,
                {
                  backgroundColor: theme.cardBg,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              multiline
              value={backupCodeText}
              onChangeText={setBackupCodeText}
              placeholder="Cole aqui o código JSON do seu backup..."
              placeholderTextColor={theme.subText}
            />

            <View style={styles.codeModalActions}>
              <TouchableOpacity
                style={[styles.actionBtnPrimary, { flex: 1, backgroundColor: '#475569' }]}
                onPress={() => setBackupCodeText('')}
              >
                <Ionicons name="trash-outline" size={16} color="#FFF" />
                <Text style={styles.actionBtnText}>Limpar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtnPrimary, { flex: 2, backgroundColor: '#10B981' }]}
                onPress={handleRestoreFromCodeText}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                <Text style={styles.actionBtnText}>Restaurar deste Código</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL DETALHES DO ANIME + CONFIGURAÇÃO DE NOTIFICAÇÕES DE LANÇAMENTO */}
      {/* ========================================================================= */}
      <Modal
        visible={!!selectedAnime}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedAnime(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDarkMode ? '#0A1528' : '#FFFFFF',
                paddingBottom: Math.max(insets.bottom + 16, 24),
              },
            ]}
          >
            {selectedAnime && (
              <>
                <View style={styles.modalHeaderBar}>
                  <TouchableOpacity
                    style={[styles.modalCloseBtn, { backgroundColor: theme.cardBg }]}
                    onPress={() => setSelectedAnime(null)}
                  >
                    <Ionicons name="arrow-back" size={22} color={theme.text} />
                  </TouchableOpacity>
                  <Text numberOfLines={1} style={[styles.modalHeaderTitle, { color: theme.text }]}>
                    {selectedAnime.title}
                  </Text>
                  <TouchableOpacity
                    style={[styles.modalCloseBtn, { backgroundColor: theme.cardBg }]}
                    onPress={() => toggleFavorite(selectedAnime)}
                  >
                    <Ionicons
                      name={
                        favorites.some((f) => f.mal_id === selectedAnime.mal_id)
                          ? 'bookmark'
                          : 'bookmark-outline'
                      }
                      size={22}
                      color="#38BDF8"
                    />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.modalHeroRow}>
                    <Image
                      source={{ uri: selectedAnime.image }}
                      style={styles.modalPoster}
                      contentFit="cover"
                    />
                    <View style={styles.modalHeroInfo}>
                      <Text style={[styles.modalAnimeTitle, { color: theme.text }]}>
                        {selectedAnime.title}
                      </Text>
                      <Text style={[styles.modalMetaLine, { color: theme.subText }]}>
                        Ano: {selectedAnime.year || '----'} • Nota:{' '}
                        {selectedAnime.score ? selectedAnime.score.toFixed(1) : 'N/A'} ⭐
                      </Text>
                      <Text style={[styles.modalMetaLine, { color: theme.subText }]}>
                        Status: {selectedAnime.status} ({selectedAnime.episodes || 12} eps)
                      </Text>

                      <View style={styles.modalActionButtons}>
                        <TouchableOpacity
                          style={[
                            styles.actionBtnPrimary,
                            selectedAnime.watched && styles.actionBtnWatched,
                          ]}
                          onPress={toggleWholeAnimeWatched}
                        >
                          <Ionicons
                            name={selectedAnime.watched ? 'checkmark-done' : 'eye-outline'}
                            size={16}
                            color="#FFF"
                          />
                          <Text style={styles.actionBtnText}>
                            {selectedAnime.watched ? 'Visto' : 'Marcar Visto'}
                          </Text>
                        </TouchableOpacity>

                        {selectedAnime.trailerUrl && (
                          <TouchableOpacity
                            style={styles.trailerBtn}
                            onPress={() => Linking.openURL(selectedAnime.trailerUrl!)}
                          >
                            <Ionicons name="logo-youtube" size={16} color="#EF4444" />
                            <Text style={styles.trailerBtnText}>Trailer</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* SELETOR DE ALERTAS PARA ANIMES EM LANÇAMENTO */}
                  {selectedAnime.status === 'Em Andamento' && (
                    <View
                      style={[
                        styles.notifSectionBox,
                        { backgroundColor: theme.cardBg, borderColor: theme.border },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Ionicons name="notifications" size={16} color="#FBBF24" />
                        <Text style={[styles.modalSectionTitle, { color: theme.text, fontSize: 13 }]}>
                          Notificações deste Lançamento
                        </Text>
                      </View>
                      <View style={styles.segmentedRow}>
                        {[
                          { id: 'none', label: 'Desativado' },
                          { id: 'weekly', label: 'Avisar Semanalmente' },
                          { id: 'finished', label: 'Quando Acabar Temp.' },
                        ].map((opt) => {
                          const currentPref = selectedAnime.notificationPref || 'none';
                          const active = currentPref === opt.id;
                          return (
                            <TouchableOpacity
                              key={opt.id}
                              style={[
                                styles.segmentButton,
                                { borderColor: theme.border },
                                active && styles.segmentButtonActive,
                              ]}
                              onPress={() =>
                                handleSetNotificationPreference(
                                  selectedAnime,
                                  opt.id as NotificationPreference
                                )
                              }
                            >
                              <Text
                                style={[
                                  styles.segmentButtonText,
                                  { color: theme.subText, fontSize: 11 },
                                  active && styles.segmentButtonTextActive,
                                ]}
                              >
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  <View style={styles.modalSection}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={[styles.modalSectionTitle, { color: theme.text }]}>Sinopse</Text>
                      {loadingDetails && <ActivityIndicator size="small" color="#38BDF8" />}
                    </View>
                    <Text
                      style={[
                        styles.synopsisText,
                        { backgroundColor: theme.cardBg, color: theme.text },
                      ]}
                    >
                      {selectedAnime.synopsis || 'Carregando sinopse...'}
                    </Text>
                  </View>

                  <View style={styles.modalSection}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={[styles.modalSectionTitle, { color: theme.text }]}>
                        Episódios (
                        {Array.isArray(selectedAnime.watchedEpisodes)
                          ? selectedAnime.watchedEpisodes.length
                          : 0}
                        /{selectedAnime.episodes || 12})
                      </Text>
                    </View>

                    <View style={styles.episodesGrid}>
                      {Array.from(
                        { length: Math.min(selectedAnime.episodes || 12, 1500) },
                        (_, idx) => idx + 1
                      ).map((epNum) => {
                        const isEpWatched =
                          Array.isArray(selectedAnime.watchedEpisodes) &&
                          selectedAnime.watchedEpisodes.includes(epNum);
                        return (
                          <TouchableOpacity
                            key={epNum}
                            style={[
                              styles.epPill,
                              { backgroundColor: theme.cardBg, borderColor: theme.border },
                              isEpWatched && styles.epPillWatched,
                            ]}
                            onPress={() => toggleEpisodeWatched(epNum)}
                          >
                            <Ionicons
                              name={isEpWatched ? 'checkmark-circle' : 'play-circle-outline'}
                              size={14}
                              color={isEpWatched ? '#FFFFFF' : theme.subText}
                            />
                            <Text
                              style={[
                                styles.epPillText,
                                { color: theme.subText },
                                isEpWatched && styles.epPillTextWatched,
                              ]}
                            >
                              Ep {epNum}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MENU INFERIOR FIXADO ACIMA DA BARRA DO CELULAR */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.bottomBarBg,
            borderTopColor: theme.border,
            paddingBottom: Math.max(insets.bottom, 12),
            height: 62 + Math.max(insets.bottom, 12),
          },
        ]}
      >
        <TouchableOpacity style={styles.bottomTabBtn} onPress={() => setActiveTab('home')}>
          <Ionicons
            name={activeTab === 'home' ? 'home' : 'home-outline'}
            size={22}
            color={activeTab === 'home' ? '#38BDF8' : theme.subText}
          />
          <Text
            style={[
              styles.bottomTabLabel,
              { color: theme.subText },
              activeTab === 'home' && styles.bottomTabLabelActive,
            ]}
          >
            Início
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomTabBtn} onPress={() => setActiveTab('favorites')}>
          <Ionicons
            name={activeTab === 'favorites' ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={activeTab === 'favorites' ? '#38BDF8' : theme.subText}
          />
          <Text
            style={[
              styles.bottomTabLabel,
              { color: theme.subText },
              activeTab === 'favorites' && styles.bottomTabLabelActive,
            ]}
          >
            Favoritos ({favorites.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomTabBtn} onPress={() => setActiveTab('menu')}>
          <Ionicons
            name={activeTab === 'menu' ? 'menu' : 'menu-outline'}
            size={24}
            color={activeTab === 'menu' ? '#38BDF8' : theme.subText}
          />
          <Text
            style={[
              styles.bottomTabLabel,
              { color: theme.subText },
              activeTab === 'menu' && styles.bottomTabLabelActive,
            ]}
          >
            Menu
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flexOne: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  brandTitle: { fontSize: 24, fontWeight: '800' },
  brandAccent: { color: '#38BDF8' },
  brandSubtitle: { fontSize: 12, marginTop: 2 },
  rouletteHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  rouletteHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  filtersContainer: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  favFiltersWrapper: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  searchInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 13, marginLeft: 8 },
  yearInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    width: 88,
    height: 44,
    borderWidth: 1,
  },
  yearInput: { flex: 1, fontSize: 13, marginLeft: 6 },
  horizontalScroll: { marginBottom: 8 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
  },
  categoryChipActive: { backgroundColor: '#0284C7', borderColor: '#38BDF8' },
  categoryChipText: { fontSize: 12, fontWeight: '600' },
  categoryChipTextActive: { color: '#FFFFFF' },
  genrePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 6,
    borderWidth: 1,
  },
  genrePillActive: { backgroundColor: 'rgba(56, 189, 248, 0.2)', borderColor: '#38BDF8' },
  genrePillText: { fontSize: 12 },
  genrePillTextActive: { color: '#38BDF8', fontWeight: '700' },
  weeklyContainer: {
    marginHorizontal: 6,
    marginBottom: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  weeklyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  weeklyTitle: { fontSize: 13, fontWeight: '800' },
  weekDaysScroll: { marginBottom: 10 },
  weekDayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
  },
  weekDayBtnActive: { backgroundColor: '#0284C7', borderColor: '#38BDF8' },
  weekDayText: { fontSize: 12, fontWeight: '700' },
  weekDayTextActive: { color: '#FFFFFF' },
  noScheduleText: { fontSize: 12, paddingVertical: 8 },
  carouselCard: { width: 115, marginRight: 10 },
  carouselPoster: { width: 115, height: 155, borderRadius: 12 },
  carouselEpBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    backgroundColor: 'rgba(7, 15, 30, 0.88)',
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRadius: 6,
    alignItems: 'center',
  },
  carouselEpBadgeText: { color: '#38BDF8', fontSize: 10, fontWeight: '800' },
  carouselAnimeTitle: { fontSize: 11, fontWeight: '700', marginTop: 5 },
  filterGroupLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 5,
    letterSpacing: 0.6,
  },
  segmentedRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  segmentButton: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    borderWidth: 1,
  },
  segmentButtonActive: { backgroundColor: '#0284C7', borderColor: '#38BDF8' },
  segmentButtonText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  segmentButtonTextActive: { color: '#FFFFFF', fontWeight: '700' },
  gridContent: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 24 },
  cardWrapper: { flex: 1, maxWidth: '50%', padding: 6 },
  card: { borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  posterBox: { width: '100%', height: 210, position: 'relative', backgroundColor: '#0B1528' },
  posterImage: { width: '100%', height: '100%' },
  scorePill: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(7, 15, 30, 0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  scoreText: { color: '#F8FAFC', fontSize: 11, fontWeight: '700' },
  favBadgeTop: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(7, 15, 30, 0.88)',
    padding: 5,
    borderRadius: 8,
  },
  statusPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 13, fontWeight: '700', minHeight: 36, lineHeight: 17 },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardMetaText: { fontSize: 11 },
  watchedTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  watchedTagText: { color: '#10B981', fontSize: 10, fontWeight: '700' },
  progressContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  progressTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#38BDF8' },
  progressCount: { fontSize: 10, fontWeight: '600' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 10, fontSize: 13 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  menuScroll: { padding: 16 },
  watchTimeCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  watchTimeHeader: { fontSize: 15, fontWeight: '800' },
  watchTimeBig: {
    color: '#38BDF8',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 8,
  },
  watchTimeSub: { fontSize: 12, marginTop: 2 },
  topGenresBox: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  topGenresLabel: { fontSize: 10, fontWeight: '800', marginBottom: 6 },
  topGenresRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  topGenreBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  topGenreBadgeText: { color: '#38BDF8', fontSize: 11, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, padding: 12, borderRadius: 14, alignItems: 'center', borderWidth: 1 },
  statValue: { color: '#38BDF8', fontSize: 19, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 4, textAlign: 'center' },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  autoBackupBanner: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  autoBackupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  autoBackupTitle: { fontSize: 14, fontWeight: '800' },
  autoBackupSub: { fontSize: 12, marginTop: 4, marginBottom: 10 },
  autoRestoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  autoRestoreBtnText: { color: '#10B981', fontSize: 12, fontWeight: '700' },
  menuActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    gap: 12,
  },
  menuIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuActionTitle: { fontSize: 14, fontWeight: '700' },
  menuActionDesc: { fontSize: 12, marginTop: 2 },
  spinActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
    marginBottom: 14,
  },
  spinActionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  rouletteResultCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  notifSectionBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  codeBackupInput: {
    height: 150,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 12,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  codeModalActions: { flexDirection: 'row', gap: 10 },
  bottomBar: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 8, elevation: 20 },
  bottomTabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomTabLabel: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  bottomTabLabelActive: { color: '#38BDF8', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  modalHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 10,
  },
  modalHeroRow: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  modalPoster: { width: 115, height: 165, borderRadius: 12 },
  modalHeroInfo: { flex: 1, justifyContent: 'center' },
  modalAnimeTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  modalMetaLine: { fontSize: 12, marginBottom: 4 },
  modalActionButtons: { marginTop: 8, gap: 8 },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnWatched: { backgroundColor: '#10B981' },
  actionBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  trailerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  trailerBtnText: { color: '#F87171', fontSize: 12, fontWeight: '700' },
  modalSection: { marginBottom: 18 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalSectionTitle: { fontSize: 14, fontWeight: '800' },
  synopsisText: { fontSize: 13, lineHeight: 20, padding: 12, borderRadius: 12 },
  episodesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  epPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 5,
    borderWidth: 1,
  },
  epPillWatched: { backgroundColor: '#0284C7', borderColor: '#38BDF8' },
  epPillText: { fontSize: 12, fontWeight: '600' },
  epPillTextWatched: { color: '#FFFFFF', fontWeight: '700' },
});