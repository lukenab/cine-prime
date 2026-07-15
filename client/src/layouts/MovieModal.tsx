import {
  X, Film, Upload, Loader2, Search, GripVertical, Trash2,
  AlertCircle, Check, Tag, Globe, Users, Images, Clock,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import {
  movieApi,
  type GenreResponse,
  type ScreeningFormatResponse,
  type AgeRatingResponse,
  type ProductionCompanyResponse,
  type PersonResponse,
  type TmdbSearchItem,
  type CastRequest,
  type CreateMovieRequest,
  type UpdateMovieRequest,
  type MovieV2,
  type MovieImageResponse,
  type MovieImageRequest,
} from "../api/movieApi";
import {
  MOVIE_CONTENT_STATUS_META,
  toMovieContentStatus,
} from "../utils/movieContentStatus";

// ─────────────────────────────────────────────────────────────────────────────
// Local types
// ─────────────────────────────────────────────────────────────────────────────

type CastRow = {
  _key: string;
  /**
   * Issue #188 companion fix: null nghia la cast nay den tu TMDB preview nhung CHUA tung
   * duoc import vao DB (backend preview khong con tu tao Person nua). Se duoc resolveCastPersonIds()
   * tao that su (POST /api/persons) ngay luc admin bam Save, dung luc command duoc xac nhan.
   */
  personId: number | null;
  /** tmdbId goc tu TMDB - dung de tao Person moi (neu can) va giu provenance. */
  tmdbPersonId?: number;
  fullName: string;
  photoUrl?: string;
  roleType: "ACTOR" | "DIRECTOR";
  characterName: string;
};

type FormState = {
  originalTitle: string;
  originalLanguage: string;
  durationMinutes: number;
  releaseDate: string;
  endDate: string;
  country: string;
  ageRatingId: number | null;
  companyId: number | null;
  companyName: string;
  genreIds: number[];
  formatIds: number[];
  posterUrl: string;
  thumbnailUrl: string;
  trailerUrl: string;
  tmdbId?: number;
  imdbId?: string;
  vi_title: string;
  vi_synopsis: string;
  en_title: string;
  en_synopsis: string;
  cast: CastRow[];
};

const emptyForm: FormState = {
  originalTitle: "",
  originalLanguage: "en",
  durationMinutes: 120,
  releaseDate: "",
  endDate: "",
  country: "",
  ageRatingId: null,
  companyId: null,
  companyName: "",
  genreIds: [],
  formatIds: [],
  posterUrl: "",
  thumbnailUrl: "",
  trailerUrl: "",
  vi_title: "",
  vi_synopsis: "",
  en_title: "",
  en_synopsis: "",
  cast: [],
};

function movieToForm(mv: MovieV2): FormState {
  const vi = mv.translations?.find((t) => t.languageCode === "vi");
  const en = mv.translations?.find((t) => t.languageCode === "en");
  return {
    originalTitle: mv.originalTitle ?? "",
    originalLanguage: mv.originalLanguage ?? "en",
    durationMinutes: mv.durationMinutes ?? 120,
    releaseDate: mv.releaseDate ?? "",
    endDate: mv.endDate ?? "",
    country: mv.country ?? "",
    ageRatingId: mv.ageRating?.ratingId ?? null,
    companyId: null,
    companyName: mv.companyName ?? "",
    genreIds: mv.genres?.map((g) => g.genreId) ?? [],
    formatIds: mv.formats?.map((f) => f.formatId) ?? [],
    posterUrl: mv.posterUrl ?? "",
    thumbnailUrl: mv.thumbnailUrl ?? "",
    trailerUrl: mv.trailerUrl ?? "",
    tmdbId: mv.tmdbId,
    imdbId: mv.imdbId,
    vi_title: vi?.title ?? "",
    vi_synopsis: vi?.synopsis ?? "",
    en_title: en?.title ?? "",
    en_synopsis: en?.synopsis ?? "",
    cast:
      mv.cast?.map((c, i) => ({
        _key: `${c.personId}-${i}`,
        personId: c.personId,
        fullName: c.fullName,
        photoUrl: c.photoUrl,
        roleType: c.roleType === "DIRECTOR" ? "DIRECTOR" : "ACTOR",
        characterName: c.characterName ?? "",
      })) ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (data: CreateMovieRequest) => Promise<MovieV2>;
  onUpdate: (id: number, data: UpdateMovieRequest) => Promise<void>;
  editMovieId?: number | null;
  genres: GenreResponse[];
  formats: ScreeningFormatResponse[];
  ageRatings: AgeRatingResponse[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const LANG_OPTIONS = [
  { code: "en", label: "English" },
  { code: "vi", label: "Tiếng Việt (Vietnamese)" },
  { code: "ko", label: "한국어 (Korean)" },
  { code: "ja", label: "日本語 (Japanese)" },
  { code: "zh", label: "中文 (Chinese)" },
  { code: "fr", label: "Français" },
  { code: "th", label: "ภาษาไทย (Thai)" },
];

const TABS = [
  { id: 0, label: "Info",      Icon: Film },
  { id: 1, label: "Genres",    Icon: Tag },
  { id: 2, label: "Languages", Icon: Globe },
  { id: 3, label: "Cast",      Icon: Users },
  { id: 4, label: "Gallery",   Icon: Images },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function MovieModal({
  open,
  onClose,
  onCreate,
  onUpdate,
  editMovieId,
  genres,
  formats,
  ageRatings,
}: Props) {
  // ── Core state ─────────────────────────────────────────────
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loadingMovie, setLoadingMovie] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const currentContentStatus = currentStatus ? toMovieContentStatus(currentStatus) : null;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // ── Image upload ───────────────────────────────────────────
  const [uploadingImg, setUploadingImg] = useState<"posterUrl" | "thumbnailUrl" | null>(null);
  const [uploadError, setUploadError] = useState("");

  // ── TMDB overlay ───────────────────────────────────────────
  const [showTmdb, setShowTmdb] = useState(false);
  const [tmdbTab, setTmdbTab] = useState<"now_playing" | "upcoming" | "search">("now_playing");
  const [tmdbQ, setTmdbQ] = useState("");
  const [tmdbResults, setTmdbResults] = useState<TmdbSearchItem[]>([]);
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<TmdbSearchItem[]>([]);
  const [nowPlayingLoading, setNowPlayingLoading] = useState(false);
  const [nowPlayingLoaded, setNowPlayingLoaded] = useState(false);
  const [upcoming, setUpcoming] = useState<TmdbSearchItem[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [upcomingLoaded, setUpcomingLoaded] = useState(false);
  const tmdbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Company combobox ───────────────────────────────────────
  const [companyQ, setCompanyQ] = useState("");
  const [companies, setCompanies] = useState<ProductionCompanyResponse[]>([]);
  const [showCompanyDrop, setShowCompanyDrop] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(false);
  const companyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companyRef = useRef<HTMLDivElement>(null);
  /**
   * Issue #188 companion fix: company lay tu TMDB preview nhung CHUA tung duoc import
   * (localCompanyId null) duoc giu tam o day - se tao that su (POST /api/companies) ngay
   * luc admin bam Save (resolveCompanyId()), khong phai luc xem preview.
   */
  const [pendingCompany, setPendingCompany] = useState<
    { name: string; country?: string; logoUrl?: string } | null
  >(null);

  // ── Person search ──────────────────────────────────────────
  const [personQ, setPersonQ] = useState("");
  const [personResults, setPersonResults] = useState<PersonResponse[]>([]);
  const [showPersonDrop, setShowPersonDrop] = useState(false);
  const [personLoading, setPersonLoading] = useState(false);
  const personTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const personRef = useRef<HTMLDivElement>(null);

  // ── Lang sub-tab ───────────────────────────────────────────
  const [langTab, setLangTab] = useState<"vi" | "en">("vi");

  // ── DnD for cast ───────────────────────────────────────────
  const dragIdx = useRef<number>(-1);

  // ── Movie images (only for edit mode) ─────────────────────
  const [movieImages, setMovieImages] = useState<MovieImageResponse[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [imageType, setImageType] = useState<MovieImageRequest["imageType"]>("STILL");
  const [imageCaption, setImageCaption] = useState("");
  const [addingImage, setAddingImage] = useState(false);

  // ── Post-create state (Gallery unlocked after first save) ──
  const [localEditId, setLocalEditId] = useState<number | null>(null);
  const [justCreated, setJustCreated] = useState(false);

  // ── Load movie when editing ────────────────────────────────
  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setTab(0);
      setError("");
      setSubmitted(false);
      setCurrentStatus(null);
      setUploadError("");
      setMovieImages([]);
      setImageUrl("");
      setLocalEditId(null);
      setJustCreated(false);
      setPendingCompany(null);
      return;
    }
    if (!editMovieId) {
      setForm(emptyForm);
      setCurrentStatus(null);
      return;
    }
    setLoadingMovie(true);
    movieApi
      .getMovieById(editMovieId)
      .then((res) => {
        const mv = res.result;
        setCurrentStatus(mv.status);
        const f = movieToForm(mv);
        setForm(f);
        // Load gallery images
        if (mv.images?.length) setMovieImages(mv.images);
        else movieApi.getMovieImages(editMovieId).then((r) => setMovieImages(r.result ?? [])).catch(() => {});
        // Resolve companyId from name
        if (mv.companyName) {
          movieApi
            .searchCompanies(mv.companyName)
            .then((cr) => {
              const found = cr.result.find((c) => c.name === mv.companyName);
              if (found) setForm((prev) => ({ ...prev, companyId: found.companyId }));
            })
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMovie(false));
  }, [open, editMovieId]);

  // ── TMDB debounce ──────────────────────────────────────────
  useEffect(() => {
    if (tmdbTimer.current) clearTimeout(tmdbTimer.current);
    if (!tmdbQ.trim()) { setTmdbResults([]); return; }
    tmdbTimer.current = setTimeout(() => {
      setTmdbLoading(true);
      movieApi.tmdbSearch(tmdbQ)
        .then((r) => setTmdbResults(r.result ?? []))
        .catch(() => {})
        .finally(() => setTmdbLoading(false));
    }, 400);
  }, [tmdbQ]);

  // ── TMDB now playing (fetch once, khi overlay mo o tab "Dang chieu") ──
  useEffect(() => {
    if (!showTmdb || tmdbTab !== "now_playing" || nowPlayingLoaded) return;
    setNowPlayingLoading(true);
    movieApi.tmdbNowPlaying("VN", 1)
      .then((r) => setNowPlaying(r.result ?? []))
      .catch(() => {})
      .finally(() => { setNowPlayingLoading(false); setNowPlayingLoaded(true); });
  }, [showTmdb, tmdbTab, nowPlayingLoaded]);

  // ── TMDB upcoming (fetch once, khi overlay mo o tab "Sap ra mat") ──
  useEffect(() => {
    if (!showTmdb || tmdbTab !== "upcoming" || upcomingLoaded) return;
    setUpcomingLoading(true);
    movieApi.tmdbUpcoming("VN", 1)
      .then((r) => setUpcoming(r.result ?? []))
      .catch(() => {})
      .finally(() => { setUpcomingLoading(false); setUpcomingLoaded(true); });
  }, [showTmdb, tmdbTab, upcomingLoaded]);

  // ── Company debounce ───────────────────────────────────────
  useEffect(() => {
    if (companyTimer.current) clearTimeout(companyTimer.current);
    if (!companyQ.trim()) { setCompanies([]); return; }
    companyTimer.current = setTimeout(() => {
      setCompanyLoading(true);
      movieApi.searchCompanies(companyQ)
        .then((r) => setCompanies(r.result ?? []))
        .catch(() => {})
        .finally(() => setCompanyLoading(false));
    }, 300);
  }, [companyQ]);

  // ── Person debounce ────────────────────────────────────────
  useEffect(() => {
    if (personTimer.current) clearTimeout(personTimer.current);
    if (!personQ.trim()) { setPersonResults([]); return; }
    personTimer.current = setTimeout(() => {
      setPersonLoading(true);
      movieApi.searchPersons(personQ)
        .then((r) => setPersonResults(r.result ?? []))
        .catch(() => {})
        .finally(() => setPersonLoading(false));
    }, 300);
  }, [personQ]);

  // ── Close dropdowns on outside click ──────────────────────
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (companyRef.current && !companyRef.current.contains(e.target as Node))
        setShowCompanyDrop(false);
      if (personRef.current && !personRef.current.contains(e.target as Node))
        setShowPersonDrop(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!open) return null;

  // ── Helpers ────────────────────────────────────────────────
  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((p) => ({ ...p, [key]: val }));

  const fmtDuration = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
  };

  /**
   * Issue #188 companion fix: companyId/cast KHONG con doc truc tiep tu form.companyId /
   * form.cast[].personId nua ma phai nhan tu tham so - buoc goi phai di qua
   * resolveCompanyId()/resolveCastPersonIds() truoc (xem handleSubmit), dam bao moi Person/
   * ProductionCompany con thieu (den tu TMDB, chua tung import) da duoc tao that su truoc khi
   * xay dung payload nay.
   */
  const buildPayload = (
    resolvedCompanyId: number | undefined,
    resolvedCast: CastRequest[]
  ): CreateMovieRequest => {
    const translations: { languageCode: string; title: string; synopsis?: string }[] = [];
    if (form.vi_title.trim())
      translations.push({ languageCode: "vi", title: form.vi_title.trim(), synopsis: form.vi_synopsis.trim() || undefined });
    if (form.en_title.trim())
      translations.push({ languageCode: "en", title: form.en_title.trim(), synopsis: form.en_synopsis.trim() || undefined });

    return {
      originalTitle: form.originalTitle.trim(),
      originalLanguage: form.originalLanguage,
      durationMinutes: form.durationMinutes,
      releaseDate: form.releaseDate || undefined,
      endDate: form.endDate || undefined,
      country: form.country.trim() || undefined,
      ageRatingId: form.ageRatingId ?? undefined,
      companyId: resolvedCompanyId,
      genreIds: form.genreIds,
      formatIds: form.formatIds,
      posterUrl: form.posterUrl.trim() || undefined,
      thumbnailUrl: form.thumbnailUrl.trim() || undefined,
      trailerUrl: form.trailerUrl.trim() || undefined,
      tmdbId: form.tmdbId,
      imdbId: form.imdbId,
      translations: translations.length ? translations : undefined,
      cast: resolvedCast,
    };
  };

  /**
   * Issue #188 companion fix: tao that su ProductionCompany/Person con thieu (den tu TMDB
   * preview, chua tung import - id null) NGAY LUC NAY, tuc la luc admin xac nhan Save, KHONG
   * phai luc xem preview trong applyTmdb(). Neu form.companyId/personId da co san (chon tu
   * dropdown, hoac TMDB company/person do tung duoc import roi) thi dung nguyen, khong tao lai.
   */
  const resolveCompanyId = async (): Promise<number | undefined> => {
    if (form.companyId) return form.companyId;
    if (!pendingCompany) return undefined;
    const created = await movieApi.createCompany({
      name: pendingCompany.name,
      country: pendingCompany.country,
      logoUrl: pendingCompany.logoUrl,
    });
    return created.result.companyId;
  };

  const resolveCastPersonIds = async (): Promise<CastRequest[]> => {
    const resolved: CastRequest[] = [];
    for (let i = 0; i < form.cast.length; i++) {
      const c = form.cast[i];
      let personId = c.personId;
      if (personId == null) {
        const created = await movieApi.createPerson({
          fullName: c.fullName,
          photoUrl: c.photoUrl,
          tmdbId: c.tmdbPersonId,
        });
        personId = created.result.personId;
      }
      resolved.push({
        personId,
        roleType: c.roleType,
        characterName: c.characterName.trim() || undefined,
        billingOrder: i + 1,
      });
    }
    return resolved;
  };

  const validate = (): { ok: boolean; errTab?: number; msg?: string } => {
    if (!form.originalTitle.trim())
      return { ok: false, errTab: 0, msg: "Please enter the original title." };
    if (!form.durationMinutes || form.durationMinutes < 1)
      return { ok: false, errTab: 0, msg: "Duration must be ≥ 1 minute." };
    if (form.genreIds.length === 0)
      return { ok: false, errTab: 1, msg: "Select at least 1 genre." };
    if (form.formatIds.length === 0)
      return { ok: false, errTab: 1, msg: "Select at least 1 screening format." };
    return { ok: true };
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    const { ok, errTab, msg } = validate();
    if (!ok) {
      if (errTab !== undefined) setTab(errTab);
      setError(msg ?? "Please review the form.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      // Issue #188 companion fix: tao that su moi ProductionCompany/Person con thieu (den tu
      // TMDB, chua tung import) O DAY - luc admin xac nhan Save - khong phai luc xem preview.
      const [resolvedCompanyId, resolvedCast] = await Promise.all([
        resolveCompanyId(),
        resolveCastPersonIds(),
      ]);
      // Ghi lai ID that vao form state de tranh tao trung Company/Person neu bam Save lan nua.
      setForm((p) => ({
        ...p,
        companyId: resolvedCompanyId ?? p.companyId,
        cast: p.cast.map((c, i) => ({ ...c, personId: resolvedCast[i]?.personId ?? c.personId })),
      }));
      setPendingCompany(null);

      const payload = buildPayload(resolvedCompanyId, resolvedCast);
      if (editMovieId) {
        await onUpdate(editMovieId, payload);
        onClose();
      } else {
        // After create: stay open, unlock Gallery tab with the new ID
        const created = await onCreate(payload);
        setLocalEditId(created.movieId);
        setJustCreated(true);
        setTab(4); // Switch to Gallery
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Save failed, please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── TMDB auto-fill ─────────────────────────────────────────
  const applyTmdb = async (item: TmdbSearchItem) => {
    setTmdbLoading(true);
    setError("");
    try {
      const response = await movieApi.tmdbDetails(item.tmdbId);
      const details = response.result;
      const vietnamese = details.translations?.find((translation) => translation.languageCode === "vi");
      const english = details.translations?.find((translation) => translation.languageCode === "en");

      // Issue #188: preview khong con tra san companyId/cast[].personId da-tao-truoc nua
      // (backend fix ngan preview tu upsert Company/Person). Company dau tien duoc "khop thu"
      // theo ten - neu chua tung import (localCompanyId null) thi giu lai thong tin TMDB goc
      // trong pendingCompany, se tao that su luc admin bam Save (xem resolveCompanyId()).
      const primaryCompany = details.companies?.[0];
      if (primaryCompany) {
        setPendingCompany(
          primaryCompany.localCompanyId
            ? null
            : { name: primaryCompany.name, country: primaryCompany.country, logoUrl: primaryCompany.logoUrl }
        );
      }

      setForm((p) => ({
        ...p,
        originalTitle: details.originalTitle || item.originalTitle || item.title || p.originalTitle,
        originalLanguage: details.originalLanguage || p.originalLanguage,
        durationMinutes: details.durationMinutes || p.durationMinutes,
        releaseDate: details.releaseDate || item.releaseDate || p.releaseDate,
        country: details.country || p.country,
        companyId: primaryCompany ? (primaryCompany.localCompanyId ?? null) : p.companyId,
        companyName: primaryCompany ? primaryCompany.name : p.companyName,
        posterUrl: details.posterUrl || item.posterUrl || p.posterUrl,
        thumbnailUrl: details.posterUrl || item.posterUrl || p.thumbnailUrl,
        tmdbId: details.tmdbId,
        imdbId: details.imdbId,
        genreIds: details.genreIds?.length ? details.genreIds : p.genreIds,
        ageRatingId: details.ageRatingId ?? p.ageRatingId,
        vi_title: vietnamese?.title ?? p.vi_title,
        vi_synopsis: vietnamese?.synopsis ?? p.vi_synopsis,
        en_title: english?.title ?? details.originalTitle ?? p.en_title,
        en_synopsis: english?.synopsis ?? details.overview ?? p.en_synopsis,
        // Issue #188: cast moi (chua tung import - localPersonId null) van hien thi day du
        // (ten/anh tu TMDB), chi la personId=null cho toi khi resolveCastPersonIds() tao that
        // su luc Save. tmdbPersonId duoc giu lai de tao Person voi dung provenance.
        cast: (details.cast ?? []).map((member, index) => ({
          _key: `${member.tmdbId}-${member.roleType}-${index}`,
          personId: member.localPersonId ?? null,
          tmdbPersonId: member.tmdbId,
          fullName: member.fullName,
          photoUrl: member.photoUrl,
          roleType: member.roleType === "DIRECTOR" ? "DIRECTOR" : "ACTOR",
          characterName: member.characterName ?? "",
        })),
      }));
      setShowTmdb(false);
      setTmdbQ("");
      setTmdbResults([]);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to load movie details from TMDB.");
    } finally {
      setTmdbLoading(false);
    }
  };

  // ── Cast DnD ───────────────────────────────────────────────
  const handleDrop = (toIdx: number) => {
    const from = dragIdx.current;
    if (from < 0 || from === toIdx) return;
    const next = [...form.cast];
    const [item] = next.splice(from, 1);
    next.splice(toIdx, 0, item);
    set("cast", next);
    dragIdx.current = -1;
  };

  const addCastMember = (p: PersonResponse) => {
    if (form.cast.find((c) => c.personId === p.personId)) return;
    set("cast", [
      ...form.cast,
      {
        _key: `${p.personId}-${Date.now()}`,
        personId: p.personId,
        fullName: p.fullName,
        photoUrl: p.photoUrl,
        roleType: "ACTOR",
        characterName: "",
      },
    ]);
    setPersonQ("");
    setPersonResults([]);
    setShowPersonDrop(false);
  };

  const removeCast = (idx: number) => {
    const next = [...form.cast];
    next.splice(idx, 1);
    set("cast", next);
  };

  const updateCast = <K extends keyof CastRow>(idx: number, key: K, val: CastRow[K]) => {
    const next = [...form.cast];
    next[idx] = { ...next[idx], [key]: val };
    set("cast", next);
  };

  // ── Image upload ───────────────────────────────────────────
  const handleImgUpload = async (field: "posterUrl" | "thumbnailUrl", file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be JPG/PNG/WebP, max 5MB.");
      return;
    }
    setUploadError("");
    setUploadingImg(field);
    try {
      const r = await movieApi.uploadImage(file);
      const url = r.result?.secureUrl || r.result?.url;
      if (url) set(field, url);
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploadingImg(null);
    }
  };

  // ── Style constants ────────────────────────────────────────
  const IS: React.CSSProperties = {
    fontSize: "14px",
    background: "var(--bg-main)",
    color: "var(--text-main)",
    border: "1px solid var(--border-color)",
  };
  const IC = "w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors";
  const FL: React.CSSProperties = { fontSize: "13px", color: "var(--text-sub)", display: "block", marginBottom: "6px" };
  const SL: React.CSSProperties = {
    fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em",
    textTransform: "uppercase", color: "var(--text-sub)", marginBottom: "12px",
  };

  const reqBorder = (val: string | number | null | undefined) =>
    submitted && (!val || val === 0 || (typeof val === "string" && !val.trim()))
      ? "1px solid #f87171"
      : IS.border as string;

  // ── Poster upload zone ─────────────────────────────────────
  const renderPoster = (field: "posterUrl" | "thumbnailUrl", label: string) => {
    const v = form[field] as string;
    const uploading = uploadingImg === field;
    return (
      <div>
        <label style={FL}>{label}</label>
        {v ? (
          <div className="relative rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
            <img src={v} alt={label} className="w-full h-36 object-cover" />
            <button
              type="button"
              onClick={() => set(field, "")}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <label
            className="flex flex-col items-center justify-center gap-1.5 h-36 rounded-xl border-2 border-dashed cursor-pointer hover:border-blue-400 transition-colors"
            style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
          >
            {uploading ? (
              <>
                <Loader2 size={22} className="animate-spin text-blue-500" />
                <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>Uploading…</span>
              </>
            ) : (
              <>
                <Upload size={22} className="text-blue-500" />
                <span style={{ fontSize: "12.5px", fontWeight: 500, color: "var(--text-main)" }}>Click to upload</span>
                <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>JPG · PNG · WebP · ≤ 5MB</span>
              </>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={(e) => { handleImgUpload(field, e.target.files?.[0]); e.currentTarget.value = ""; }}
            />
          </label>
        )}
        <input
          type="text"
          placeholder="or paste image URL…"
          value={v}
          onChange={(e) => set(field, e.target.value)}
          className={IC + " mt-2"}
          style={{ ...IS, fontSize: "12px" }}
        />
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="relative w-full max-w-3xl mx-4 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--bg-main)", maxHeight: "92vh" }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Film size={16} className="text-blue-600" />
            </div>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)" }}>
              {editMovieId ? "Edit Movie" : "Add New Movie"}
            </h2>
            {currentContentStatus && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ background: MOVIE_CONTENT_STATUS_META[currentContentStatus].text }}
              >
                {MOVIE_CONTENT_STATUS_META[currentContentStatus].label}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            style={{ color: "var(--text-sub)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b flex-shrink-0" style={{ borderColor: "var(--border-color)" }}>
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className="flex items-center gap-2 px-5 py-3 border-b-2 transition-colors"
                style={{
                  fontSize: "13px",
                  fontWeight: active ? 600 : 400,
                  borderBottomColor: active ? "#2563eb" : "transparent",
                  color: active ? "#2563eb" : "var(--text-sub)",
                  background: "transparent",
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Loading ── */}
        {loadingMovie && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        )}

        {/* ── Tab content ── */}
        {!loadingMovie && (
          <div className="overflow-y-auto flex-1 px-6 py-5">

            {/* ══ TAB 0: Thông tin ══ */}
            {tab === 0 && (
              <div className="space-y-5">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <p style={SL}>Basic Info</p>
                  <button
                    type="button"
                    onClick={() => setShowTmdb(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600"
                    style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}
                  >
                    <Search size={12} /> Search TMDB
                  </button>
                </div>

                {form.tmdbId && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50" style={{ width: "fit-content" }}>
                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <Check size={10} className="text-white" />
                    </div>
                    <span style={{ fontSize: "12px", color: "#065f46", fontWeight: 500 }}>TMDB</span>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>·</span>
                    <a
                      href={`https://www.themoviedb.org/movie/${form.tmdbId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "12px", color: "#059669", fontWeight: 500, textDecoration: "none" }}
                      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                    >
                      #{form.tmdbId}
                    </a>
                    {form.imdbId && (
                      <>
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>·</span>
                        <a
                          href={`https://www.imdb.com/title/${form.imdbId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: "12px", color: "#f59e0b", fontWeight: 500, textDecoration: "none" }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >
                          IMDb
                        </a>
                      </>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {/* Original title */}
                  <div className="col-span-2">
                    <label style={FL}>Original Title <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      placeholder="e.g. Parasite"
                      value={form.originalTitle}
                      onChange={(e) => set("originalTitle", e.target.value)}
                      className={IC}
                      style={{ ...IS, border: reqBorder(form.originalTitle) }}
                    />
                  </div>

                  {/* Original language */}
                  <div>
                    <label style={FL}>Original Language <span className="text-rose-500">*</span></label>
                    <select
                      value={form.originalLanguage}
                      onChange={(e) => set("originalLanguage", e.target.value)}
                      className={IC + " cursor-pointer"}
                      style={IS}
                    >
                      {LANG_OPTIONS.map((o) => (
                        <option key={o.code} value={o.code}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Duration */}
                  <div>
                    <label style={FL}>Duration (minutes) <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      min="1"
                      value={form.durationMinutes}
                      onChange={(e) => set("durationMinutes", parseInt(e.target.value) || 0)}
                      className={IC}
                      style={{ ...IS, border: reqBorder(form.durationMinutes) }}
                    />
                    {form.durationMinutes > 0 && (
                      <span style={{ fontSize: "11px", color: "var(--text-sub)", display: "block", marginTop: "4px" }}>
                        {fmtDuration(form.durationMinutes)}
                      </span>
                    )}
                  </div>

                  {/* Release date */}
                  <div>
                    <label style={FL}>Release Date</label>
                    <input
                      type="date"
                      value={form.releaseDate}
                      onChange={(e) => set("releaseDate", e.target.value)}
                      className={IC}
                      style={IS}
                    />
                  </div>

                  {/* End date */}
                  <div>
                    <label style={FL}>End Date <span style={{ fontWeight: 400, color: "var(--text-sub)" }}>(auto-ends showing)</span></label>
                    <input
                      type="date"
                      value={form.endDate}
                      min={form.releaseDate || undefined}
                      onChange={(e) => set("endDate", e.target.value)}
                      className={IC}
                      style={IS}
                    />
                  </div>

                  {/* Country */}
                  <div>
                    <label style={FL}>Country</label>
                    <input
                      type="text"
                      placeholder="e.g. South Korea"
                      value={form.country}
                      onChange={(e) => set("country", e.target.value)}
                      className={IC}
                      style={IS}
                    />
                  </div>

                  {/* Age rating */}
                  <div className="col-span-2">
                    <label style={FL}>Age Rating</label>
                    <select
                      value={form.ageRatingId ?? ""}
                      onChange={(e) => set("ageRatingId", e.target.value ? Number(e.target.value) : null)}
                      className={IC + " cursor-pointer"}
                      style={IS}
                    >
                      <option value="">— None —</option>
                      {ageRatings.map((ar) => (
                        <option key={ar.ratingId} value={ar.ratingId}>
                          {ar.ratingCode} — {ar.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Company combobox */}
                <div ref={companyRef} className="relative">
                  <label style={FL}>Production Company</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type company name to search…"
                      value={form.companyName}
                      onFocus={() => { setCompanyQ(form.companyName); if (form.companyName) setShowCompanyDrop(true); }}
                      onChange={(e) => {
                        set("companyName", e.target.value);
                        set("companyId", null);
                        setCompanyQ(e.target.value);
                        setShowCompanyDrop(true);
                      }}
                      className={IC}
                      style={IS}
                    />
                    {companyLoading ? (
                      <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />
                    ) : form.companyId ? (
                      <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                    ) : null}
                  </div>
                  {showCompanyDrop && companies.length > 0 && (
                    <div
                      className="absolute z-20 w-full mt-1 rounded-xl border shadow-lg overflow-hidden"
                      style={{ background: "var(--bg-main)", borderColor: "var(--border-color)" }}
                    >
                      {companies.map((c) => (
                        <button
                          key={c.companyId}
                          type="button"
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors"
                          onClick={() => {
                            set("companyId", c.companyId);
                            set("companyName", c.name);
                            setShowCompanyDrop(false);
                          }}
                        >
                          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }}>{c.name}</span>
                          {c.country && (
                            <span style={{ fontSize: "12px", color: "var(--text-sub)", marginLeft: "8px" }}>{c.country}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Images */}
                <div>
                  <p style={SL}>Images</p>
                  {uploadError && (
                    <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                      {uploadError}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {renderPoster("posterUrl", "Poster")}
                    {renderPoster("thumbnailUrl", "Thumbnail")}
                  </div>
                </div>

                {/* Trailer URL */}
                <div>
                  <label style={FL}>Trailer URL</label>
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=…"
                    value={form.trailerUrl}
                    onChange={(e) => set("trailerUrl", e.target.value)}
                    className={IC}
                    style={IS}
                  />
                </div>
              </div>
            )}

            {/* ══ TAB 1: Thể loại & Định dạng ══ */}
            {tab === 1 && (
              <div className="space-y-6">
                {/* Genres */}
                <div>
                  <p style={SL}>Genres <span className="text-rose-500">*</span></p>
                  {genres.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Loading…</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {genres.map((g) => {
                        const sel = form.genreIds.includes(g.genreId);
                        return (
                          <button
                            key={g.genreId}
                            type="button"
                            onClick={() =>
                              set("genreIds", sel
                                ? form.genreIds.filter((id) => id !== g.genreId)
                                : [...form.genreIds, g.genreId])
                            }
                            className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                            style={{
                              background: sel ? "#2563eb" : "transparent",
                              color: sel ? "#fff" : "var(--text-sub)",
                              borderColor: sel ? "#2563eb" : "var(--border-color)",
                            }}
                          >
                            {g.genreName}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {submitted && form.genreIds.length === 0 && (
                    <p className="mt-2 text-xs text-rose-500">Select at least 1 genre.</p>
                  )}
                </div>

                {/* Screening formats */}
                <div>
                  <p style={SL}>Screening Formats <span className="text-rose-500">*</span></p>
                  {formats.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Loading…</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {formats.map((f) => {
                        const sel = form.formatIds.includes(f.formatId);
                        return (
                          <button
                            key={f.formatId}
                            type="button"
                            onClick={() =>
                              set("formatIds", sel
                                ? form.formatIds.filter((id) => id !== f.formatId)
                                : [...form.formatIds, f.formatId])
                            }
                            className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                            style={{
                              background: sel ? "#2563eb" : "transparent",
                              color: sel ? "#fff" : "var(--text-sub)",
                              borderColor: sel ? "#2563eb" : "var(--border-color)",
                            }}
                          >
                            {f.formatCode}
                            {f.formatName && f.formatName !== f.formatCode && ` — ${f.formatName}`}
                            {Number(f.surcharge) > 0 && (
                              <span className="ml-1 opacity-70">(+{Number(f.surcharge).toLocaleString()})</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {submitted && form.formatIds.length === 0 && (
                    <p className="mt-2 text-xs text-rose-500">Select at least 1 screening format.</p>
                  )}
                </div>
              </div>
            )}

            {/* ══ TAB 2: Ngôn ngữ ══ */}
            {tab === 2 && (
              <div className="space-y-4">
                <p style={SL}>Multilingual Titles & Descriptions</p>

                {/* Lang sub-tabs */}
                <div
                  className="inline-flex gap-1 p-1 rounded-lg"
                  style={{ background: "var(--bg-card)" }}
                >
                  {(["vi", "en"] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setLangTab(lang)}
                      className="px-4 py-1.5 rounded-md transition-colors"
                      style={{
                        fontSize: "13px",
                        fontWeight: langTab === lang ? 600 : 400,
                        background: langTab === lang ? "var(--bg-main)" : "transparent",
                        color: langTab === lang ? "var(--text-main)" : "var(--text-sub)",
                        boxShadow: langTab === lang ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                      }}
                    >
                      {lang === "vi" ? "🇻🇳 Vietnamese" : "🇬🇧 English"}
                    </button>
                  ))}
                </div>

                {langTab === "vi" && (
                  <div className="space-y-3">
                    <div>
                      <label style={FL}>Movie Title (Vietnamese)</label>
                      <input
                        type="text"
                        placeholder="e.g. Ký Sinh Trùng"
                        value={form.vi_title}
                        onChange={(e) => set("vi_title", e.target.value)}
                        className={IC}
                        style={IS}
                      />
                    </div>
                    <div>
                      <label style={FL}>Synopsis (Vietnamese)</label>
                      <textarea
                        rows={6}
                        placeholder="Brief synopsis in Vietnamese…"
                        value={form.vi_synopsis}
                        onChange={(e) => set("vi_synopsis", e.target.value)}
                        className={IC + " resize-none"}
                        style={IS}
                      />
                    </div>
                  </div>
                )}

                {langTab === "en" && (
                  <div className="space-y-3">
                    <div>
                      <label style={FL}>Movie Title (English)</label>
                      <input
                        type="text"
                        placeholder="e.g. Parasite"
                        value={form.en_title}
                        onChange={(e) => set("en_title", e.target.value)}
                        className={IC}
                        style={IS}
                      />
                    </div>
                    <div>
                      <label style={FL}>Synopsis (English)</label>
                      <textarea
                        rows={6}
                        placeholder="Brief synopsis in English…"
                        value={form.en_synopsis}
                        onChange={(e) => set("en_synopsis", e.target.value)}
                        className={IC + " resize-none"}
                        style={IS}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══ TAB 3: Diễn viên ══ */}
            {tab === 3 && (
              <div className="space-y-4">
                <p style={SL}>Cast & Crew</p>

                {/* Person search */}
                <div ref={personRef} className="relative">
                  <label style={FL}>Search person</label>
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: "var(--text-sub)" }}
                    />
                    <input
                      type="text"
                      placeholder="Actor or director name…"
                      value={personQ}
                      onChange={(e) => { setPersonQ(e.target.value); setShowPersonDrop(true); }}
                      onFocus={() => { if (personQ) setShowPersonDrop(true); }}
                      className={IC + " pl-9"}
                      style={IS}
                    />
                    {personLoading && (
                      <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />
                    )}
                  </div>
                  {showPersonDrop && personResults.length > 0 && (
                    <div
                      className="absolute z-20 w-full mt-1 rounded-xl border shadow-lg overflow-hidden"
                      style={{ background: "var(--bg-main)", borderColor: "var(--border-color)" }}
                    >
                      {personResults.map((p) => (
                        <button
                          key={p.personId}
                          type="button"
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors"
                          onClick={() => addCastMember(p)}
                        >
                          {p.photoUrl ? (
                            <img src={p.photoUrl} alt={p.fullName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div
                              className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center"
                              style={{ fontSize: "12px", color: "#6b7280" }}
                            >
                              {p.fullName[0]}
                            </div>
                          )}
                          <div className="text-left">
                            <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }}>{p.fullName}</p>
                            {p.nationality && (
                              <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>{p.nationality}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cast list */}
                {form.cast.length === 0 ? (
                  <div
                    className="flex flex-col items-center justify-center py-10 rounded-xl border-2 border-dashed"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <Users size={28} style={{ color: "var(--text-sub)", marginBottom: "8px" }} />
                    <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                      No cast added yet. Use the search above.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p style={{ fontSize: "11px", color: "var(--text-sub)", marginBottom: "4px" }}>
                      Drag ⠿ to reorder billing
                    </p>
                    {form.cast.map((c, idx) => (
                      <div
                        key={c._key}
                        draggable
                        onDragStart={() => { dragIdx.current = idx; }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDrop(idx)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                        style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", cursor: "grab" }}
                      >
                        <GripVertical size={16} style={{ color: "var(--text-sub)", flexShrink: 0 }} />

                        <span
                          className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0"
                          style={{ fontSize: "11px", fontWeight: 600 }}
                        >
                          {idx + 1}
                        </span>

                        {c.photoUrl ? (
                          <img src={c.photoUrl} alt={c.fullName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center"
                            style={{ fontSize: "12px", color: "#6b7280" }}
                          >
                            {c.fullName[0]}
                          </div>
                        )}

                        <span
                          style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)", minWidth: "90px", flexShrink: 0 }}
                        >
                          {c.fullName}
                        </span>

                        <select
                          value={c.roleType}
                          onChange={(e) => updateCast(idx, "roleType", e.target.value as "ACTOR" | "DIRECTOR")}
                          className="px-2 py-1 rounded-lg border text-xs cursor-pointer flex-shrink-0"
                          style={{ background: "var(--bg-main)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
                        >
                          <option value="ACTOR">Actor</option>
                          <option value="DIRECTOR">Director</option>
                        </select>

                        <input
                          type="text"
                          placeholder="Character name (optional)"
                          value={c.characterName}
                          onChange={(e) => updateCast(idx, "characterName", e.target.value)}
                          className="flex-1 px-2 py-1 rounded-lg border text-xs outline-none focus:border-blue-400 min-w-0"
                          style={{ background: "var(--bg-main)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
                        />

                        <button
                          type="button"
                          onClick={() => removeCast(idx)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors flex-shrink-0"
                          style={{ color: "var(--text-sub)" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══ TAB 4: Gallery ══ */}
            {tab === 4 && (() => {
              const activeId = localEditId ?? editMovieId;
              return (
                <div className="space-y-5">
                  <p style={SL}>Photo Gallery</p>

                  {justCreated && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50">
                      <Check size={15} className="text-emerald-600 flex-shrink-0" />
                      <p style={{ fontSize: "13px", color: "#065f46" }}>
                        Movie created! Add images below, then close when done.
                      </p>
                    </div>
                  )}

                  {!activeId ? (
                    <div className="flex flex-col items-center justify-center py-12 rounded-xl border-2 border-dashed" style={{ borderColor: "var(--border-color)" }}>
                      <Images size={32} style={{ color: "var(--text-sub)", marginBottom: "10px" }} />
                      <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>Save the movie first, then come back to add images.</p>
                    </div>
                  ) : (
                    <>
                      {/* Add image form */}
                      <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>Add New Image</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label style={FL}>Image URL</label>
                            <input
                              type="text"
                              placeholder="https://..."
                              value={imageUrl}
                              onChange={(e) => setImageUrl(e.target.value)}
                              className={IC}
                              style={IS}
                            />
                          </div>
                          <div>
                            <label style={FL}>Image Type</label>
                            <select
                              value={imageType}
                              onChange={(e) => setImageType(e.target.value as MovieImageRequest["imageType"])}
                              className={IC + " cursor-pointer"}
                              style={IS}
                            >
                              <option value="POSTER">Poster</option>
                              <option value="BACKDROP">Backdrop</option>
                              <option value="STILL">Still</option>
                              <option value="PROMOTIONAL">Promotional</option>
                            </select>
                          </div>
                          <div>
                            <label style={FL}>Caption</label>
                            <input
                              type="text"
                              placeholder="Caption (optional)"
                              value={imageCaption}
                              onChange={(e) => setImageCaption(e.target.value)}
                              className={IC}
                              style={IS}
                            />
                          </div>
                        </div>
                        {imageUrl && (
                          <img
                            src={imageUrl}
                            alt="preview"
                            className="w-full h-32 object-cover rounded-lg"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                          />
                        )}
                        <button
                          type="button"
                          disabled={!imageUrl.trim() || addingImage}
                          onClick={async () => {
                            if (!imageUrl.trim() || !activeId) return;
                            setAddingImage(true);
                            try {
                              const r = await movieApi.addMovieImage(activeId, {
                                imageUrl: imageUrl.trim(),
                                imageType,
                                caption: imageCaption.trim() || undefined,
                                displayOrder: movieImages.length,
                              });
                              setMovieImages((prev) => [...prev, r.result]);
                              setImageUrl("");
                              setImageCaption("");
                            } catch (e: any) {
                              setError(e?.response?.data?.message ?? "Failed to add image.");
                            } finally {
                              setAddingImage(false);
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                          style={{ fontSize: "13px" }}
                        >
                          {addingImage ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                          Add Image
                        </button>
                      </div>

                      {/* Image gallery */}
                      {movieImages.length === 0 ? (
                        <div className="text-center py-10 rounded-xl border-2 border-dashed" style={{ borderColor: "var(--border-color)" }}>
                          <Images size={28} style={{ color: "var(--text-sub)", margin: "0 auto 8px" }} />
                          <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>No images yet.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-3">
                          {movieImages.map((img) => (
                            <div key={img.imageId} className="relative rounded-xl overflow-hidden border" style={{ borderColor: "var(--border-color)" }}>
                              <img src={img.imageUrl} alt={img.caption ?? ""} className="w-full h-28 object-cover" />
                              <div className="absolute inset-x-0 bottom-0 px-2 py-1.5" style={{ background: "rgba(0,0,0,0.55)" }}>
                                <span className="px-1.5 py-0.5 rounded text-white" style={{ fontSize: "10px", background: "rgba(255,255,255,0.2)" }}>
                                  {img.imageType}
                                </span>
                                {img.caption && (
                                  <p className="text-white mt-0.5" style={{ fontSize: "10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {img.caption}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!activeId) return;
                                  try {
                                    await movieApi.deleteMovieImage(activeId, img.imageId);
                                    setMovieImages((prev) => prev.filter((i) => i.imageId !== img.imageId));
                                  } catch (e: any) {
                                    setError(e?.response?.data?.message ?? "Failed to delete image.");
                                  }
                                }}
                                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-rose-600 transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

          </div>
        )}

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t flex-shrink-0" style={{ borderColor: "var(--border-color)" }}>
          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-rose-500" />
              <p className="text-xs text-rose-600 leading-relaxed">{error}</p>
            </div>
          )}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl border transition-colors hover:opacity-80 disabled:opacity-50"
              style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
            >
              {justCreated ? "Done" : "Cancel"}
            </button>
            {!justCreated && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || loadingMovie}
                className="px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                style={{ fontSize: "14px", fontWeight: 500 }}
              >
                {submitting ? "Saving…" : editMovieId ? "Save Changes" : "Add Movie"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── TMDB Search Overlay ── */}
      {showTmdb && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 60 }}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowTmdb(false)} />
          <div
            className="relative w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ background: "var(--bg-main)", maxHeight: "70vh" }}
          >
            {/* TMDB header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-main)" }}>Nhập phim từ TMDB</h3>
              <button
                type="button"
                onClick={() => setShowTmdb(false)}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center"
                style={{ color: "var(--text-sub)" }}
              >
                <X size={15} />
              </button>
            </div>

            {/* TMDB tabs */}
            <div className="flex items-center gap-1.5 px-5 pt-3">
              <button
                type="button"
                onClick={() => setTmdbTab("now_playing")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: tmdbTab === "now_playing" ? "#eff6ff" : "transparent",
                  color: tmdbTab === "now_playing" ? "#2563eb" : "var(--text-sub)",
                }}
              >
                <Film size={12} /> Đang chiếu (VN)
              </button>
              <button
                type="button"
                onClick={() => setTmdbTab("upcoming")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: tmdbTab === "upcoming" ? "#eff6ff" : "transparent",
                  color: tmdbTab === "upcoming" ? "#2563eb" : "var(--text-sub)",
                }}
              >
                <Clock size={12} /> Sắp ra mắt
              </button>
              <button
                type="button"
                onClick={() => setTmdbTab("search")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: tmdbTab === "search" ? "#eff6ff" : "transparent",
                  color: tmdbTab === "search" ? "#2563eb" : "var(--text-sub)",
                }}
              >
                <Search size={12} /> Tìm kiếm
              </button>
            </div>

            {/* TMDB search input (chi hien o tab Tim kiem) */}
            {tmdbTab === "search" && (
              <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Tên phim…"
                    value={tmdbQ}
                    onChange={(e) => setTmdbQ(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border outline-none focus:border-blue-400"
                    style={{ ...IS, fontSize: "14px" }}
                  />
                  {tmdbLoading && (
                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />
                  )}
                </div>
              </div>
            )}

            {/* Ghi chu nguon du lieu (chi hien o tab Dang chieu / Sap ra mat) */}
            {(tmdbTab === "now_playing" || tmdbTab === "upcoming") && (
              <div className="px-5 py-2.5 border-b flex items-center justify-between" style={{ borderColor: "var(--border-color)" }}>
                <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>
                  {tmdbTab === "now_playing"
                    ? "Phim đang chiếu rạp tại VN — nguồn: TMDB Now Playing."
                    : "Phim sắp ra mắt tại VN — nguồn: TMDB Upcoming."}
                </p>
                {(nowPlayingLoading || upcomingLoading) && <Loader2 size={13} className="animate-spin text-blue-500 flex-shrink-0" />}
              </div>
            )}

            {/* TMDB results (dung chung cho ca 3 tab) */}
            <div className="overflow-y-auto flex-1 py-2">
              {tmdbTab === "search" && !tmdbQ && (
                <p className="text-center py-8" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                  Gõ tên phim để tìm kiếm.
                </p>
              )}
              {tmdbTab === "search" && tmdbQ && !tmdbLoading && tmdbResults.length === 0 && (
                <p className="text-center py-8" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                  Không tìm thấy kết quả.
                </p>
              )}
              {tmdbTab === "now_playing" && !nowPlayingLoading && nowPlaying.length === 0 && (
                <p className="text-center py-8" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                  Không lấy được danh sách phim đang chiếu.
                </p>
              )}
              {tmdbTab === "upcoming" && !upcomingLoading && upcoming.length === 0 && (
                <p className="text-center py-8" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                  Không lấy được danh sách phim sắp ra mắt.
                </p>
              )}
              {(tmdbTab === "search" ? tmdbResults : tmdbTab === "now_playing" ? nowPlaying : upcoming).map((item) => (
                <button
                  key={item.tmdbId}
                  type="button"
                  disabled={item.alreadyImported}
                  onClick={() => { if (!item.alreadyImported) applyTmdb(item); }}
                  className={`w-full flex items-start gap-3 px-5 py-3 transition-colors text-left ${
                    item.alreadyImported ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-50"
                  }`}
                >
                  {item.posterUrl ? (
                    <img src={item.posterUrl} alt={item.title} className="w-10 h-14 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-14 rounded bg-gray-200 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>{item.title}</p>
                      {item.alreadyImported && (
                        <span
                          className="px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ fontSize: "9px", fontWeight: 600, background: "#f3f4f6", color: "#6b7280" }}
                        >
                          Đã nhập
                        </span>
                      )}
                    </div>
                    {item.originalTitle && item.originalTitle !== item.title && (
                      <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>{item.originalTitle}</p>
                    )}
                    {item.releaseDate && (
                      <p style={{ fontSize: "11px", color: "#3b82f6" }}>{item.releaseDate.substring(0, 4)}</p>
                    )}
                    {item.overview && (
                      <p
                        className="line-clamp-2"
                        style={{ fontSize: "11px", color: "var(--text-sub)", marginTop: "2px" }}
                      >
                        {item.overview}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
