import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { movieApi, type CinemaRoomDetail, type CinemaRoomMasterData, type LayoutPosition, type RoomConfigurationTemplate, type RoomLayoutDetail, type RoomResponse } from "../../api/movieApi";
import { LoadingState } from "../../components/shared/LoadingState";
import { ErrorBanner } from "../../components/shared/ErrorBanner";
import { Toast, type ToastType } from "../../components/shared/Toast";
import { CinemaRoomHeader } from "./cinemaRoomEditor/CinemaRoomHeader";
import { RoomConfigurationPanel } from "./cinemaRoomEditor/RoomConfigurationPanel";
import { BasicInformationSection } from "./cinemaRoomEditor/BasicInformationSection";
import { PhysicalDimensionsSection } from "./cinemaRoomEditor/PhysicalDimensionsSection";
import { ProjectionConfigurationSection } from "./cinemaRoomEditor/ProjectionConfigurationSection";
import { AudioConfigurationSection } from "./cinemaRoomEditor/AudioConfigurationSection";
import { GridConfigurationSection } from "./cinemaRoomEditor/GridConfigurationSection";
import { LayoutAssistantSection } from "./cinemaRoomEditor/LayoutAssistantSection";
import { RoomQuickStartSection } from "./cinemaRoomEditor/RoomQuickStartSection";
import { SeatLayoutWorkspace } from "./cinemaRoomEditor/SeatLayoutWorkspace";
import { EditorActionBar } from "./cinemaRoomEditor/EditorActionBar";
import type { AuditoriumVisualizationConfig, GridConfigForm, LayoutAssistantForm, RoomInfoForm, TechConfigForm } from "./cinemaRoomEditor/cinemaRoomEditor.types";
import { generateInitialGrid, generateLayoutFromAssistant, parseRowLabelIndex, renumberLayout, suggestVerticalAisleColumns } from "./cinemaRoomEditor/cinemaRoomLayoutGenerator";
import { validateCinemaRoomEditor } from "./cinemaRoomEditor/cinemaRoomValidation";
import { calculateRoomCapacityEnvelope } from "./cinemaRoomEditor/cinemaRoomCapacity";

const EDITABLE_LAYOUT_STATUSES = new Set(["DRAFT", "REJECTED"]);

const DEFAULT_LAYOUT_ASSISTANT: LayoutAssistantForm = {
  templateCode: "BALANCED",
  templateVersion: 1,
  zones: [
    { id: "default-standard", fromRow: 0, toRow: 2, seatType: "STANDARD" },
    { id: "default-vip", fromRow: 3, toRow: 6, seatType: "VIP" },
    { id: "default-couple", fromRow: 7, toRow: 7, seatType: "COUPLE" },
  ],
  verticalAisleColumns: [],
  horizontalAisleRows: [],
  preserveManualOverrides: true,
};

function parseAssistantConfig(raw?: string): LayoutAssistantForm | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<LayoutAssistantForm>;
    if (!Array.isArray(value.zones) || !Array.isArray(value.verticalAisleColumns) || !Array.isArray(value.horizontalAisleRows)) return null;
    return {
      templateCode: value.templateCode ?? "CUSTOM",
      templateVersion: value.templateVersion ?? 1,
      zones: value.zones,
      verticalAisleColumns: value.verticalAisleColumns,
      horizontalAisleRows: value.horizontalAisleRows,
      preserveManualOverrides: value.preserveManualOverrides ?? true,
    };
  } catch {
    return null;
  }
}

export function getNextRoomSuggestion(rooms: RoomResponse[]) {
  const sequenceNumbers = rooms.flatMap((room) => {
    const roomCodeMatch = room.roomCode?.trim().match(/^R0*(\d+)$/i);
    const roomNameMatch = room.cinemaRoomName?.trim().match(/^Room\s+0*(\d+)$/i);
    return [roomCodeMatch?.[1], roomNameMatch?.[1]]
      .filter((value): value is string => Boolean(value))
      .map(Number)
      .filter((value) => Number.isInteger(value) && value > 0);
  });
  // Using the highest known sequence avoids reusing a retired room code. The
  // room count is a fallback for legacy rooms that do not have a code yet.
  const nextNumber = Math.max(0, rooms.length, ...sequenceNumbers) + 1;
  return {
    roomCode: `R${String(nextNumber).padStart(2, "0")}`,
    cinemaRoomName: `Room ${nextNumber}`,
  };
}

export function buildDraftFromRoomTemplate(template: RoomConfigurationTemplate) {
  const grid: GridConfigForm = {
    numberOfRows: template.numberOfRows,
    maxPositionsPerRow: template.maxPositionsPerRow,
    firstRowLabel: "A",
    numberingDirection: "LEFT_TO_RIGHT",
    numberingPolicy: "CONTIGUOUS_SEATS",
  };
  const availableRows = Math.max(1, template.numberOfRows - (template.coupleLastRow ? 1 : 0));
  const standardRows = template.layoutTemplateCode === "ALL_STANDARD"
    ? availableRows
    : Math.max(1, Math.min(availableRows, Math.round(availableRows * template.standardRowPercentage / 100)));
  const zones: LayoutAssistantForm["zones"] = [];
  if (standardRows > 0) zones.push({ id: crypto.randomUUID(), fromRow: 0, toRow: standardRows - 1, seatType: "STANDARD" });
  if (standardRows < availableRows) zones.push({ id: crypto.randomUUID(), fromRow: standardRows, toRow: availableRows - 1, seatType: "VIP" });
  if (template.coupleLastRow) zones.push({
    id: crypto.randomUUID(), fromRow: template.numberOfRows - 1, toRow: template.numberOfRows - 1, seatType: "COUPLE",
  });
  const assistant: LayoutAssistantForm = {
    templateCode: template.layoutTemplateCode,
    templateVersion: 1,
    zones,
    verticalAisleColumns: buildTemplateAisleColumns(template),
    horizontalAisleRows: template.crossAisle && template.numberOfRows >= 2
      ? [Math.floor(template.numberOfRows / 2)]
      : [],
    preserveManualOverrides: true,
  };
  const positions = generateLayoutFromAssistant([], grid, assistant).positions;
  return { grid, assistant, positions };
}

/** Suggests aisle columns without leaving an unpaired physical position in a
 * Couple row. Even-width rooms use two symmetric side aisles (the Premium
 * Laser reference layout is 2 seats + aisle + 8 seats + aisle + 2 seats).
 * Odd-width rooms use one near-centre aisle whose two remaining runs are even. */
export function buildTemplateAisleColumns(template: RoomConfigurationTemplate): number[] {
  if (!template.centerAisle || template.maxPositionsPerRow < 2) return [];
  return suggestVerticalAisleColumns(template.maxPositionsPerRow, template.coupleLastRow);
}

export default function CinemaRoomEditorPage() {
  const { clusterId, roomId: roomIdParam } = useParams<{ clusterId: string; roomId?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const duplicateSourceId = !roomIdParam ? Number(searchParams.get("duplicateFrom")) || null : null;

  const [masterData, setMasterData] = useState<CinemaRoomMasterData | null>(null);
  const [loadingMasterData, setLoadingMasterData] = useState(true);
  const [masterDataError, setMasterDataError] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(!!roomIdParam);
  const [hydratingDuplicate, setHydratingDuplicate] = useState(Boolean(duplicateSourceId));

  const [roomId, setRoomId] = useState<number | null>(roomIdParam ? Number(roomIdParam) : null);
  const [layoutId, setLayoutId] = useState<number | null>(null);
  const [room, setRoom] = useState<CinemaRoomDetail | null>(null);

  const [roomInfo, setRoomInfo] = useState<RoomInfoForm>({
    cinemaRoomName: "", roomCode: "", auditoriumClassId: null, lengthM: "", widthM: "", clearHeightM: "",
  });
  const [techConfig, setTechConfig] = useState<TechConfigForm>({
    projectionTechnologyId: null, presentationSystem: "STANDARD", resolutionId: null, screenWidthM: "", screenHeightM: "",
    audioFormatId: null, supports2d: true, supports3d: false,
  });
  const [gridConfig, setGridConfig] = useState<GridConfigForm>({
    numberOfRows: 8, maxPositionsPerRow: 10, firstRowLabel: "A", numberingDirection: "LEFT_TO_RIGHT",
    numberingPolicy: "CONTIGUOUS_SEATS",
  });
  const [layoutAssistant, setLayoutAssistant] = useState<LayoutAssistantForm>(DEFAULT_LAYOUT_ASSISTANT);
  const [positions, setPositions] = useState<LayoutPosition[]>([]);
  const [assistantPreview, setAssistantPreview] = useState<LayoutPosition[] | null>(null);

  const [clusterName, setClusterName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"config" | "seats">("config");
  // Gates inline "X is required" messages until the user actually tries to
  // save/submit — the red * on each label already marks required fields, so
  // repeating "required" as text before they've touched anything is just noise.
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const showToast = (type: ToastType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const loadMasterData = useCallback(async () => {
    setLoadingMasterData(true);
    setMasterDataError(null);
    try {
      const res = await movieApi.getRoomMasterData();
      setMasterData(res.result);
    } catch (err: any) {
      setMasterDataError(err?.response?.data?.message ?? "Failed to load room configuration options.");
    } finally {
      setLoadingMasterData(false);
    }
  }, []);

  useEffect(() => { loadMasterData(); }, [loadMasterData]);

  // Use the named Standard Digital baseline for new rooms. Never select the
  // first master-data item blindly, and never overwrite edit/duplicate data.
  useEffect(() => {
    if (!masterData || roomIdParam || duplicateSourceId) return;
    const standardTemplate = masterData.roomTemplates?.find((template) => template.code === "STANDARD_DIGITAL");
    const baseProjectionId = standardTemplate?.projectionTechnologyId
      ?? masterData.projectionTechnologies.find((item) => item.code === "XENON")?.id;
    const baseAudioId = standardTemplate?.audioFormatId
      ?? masterData.audioFormats.find((item) => item.code === "DOLBY_5_1")?.id;
    setTechConfig((current) => ({
      ...current,
      projectionTechnologyId: current.projectionTechnologyId ?? baseProjectionId ?? null,
      audioFormatId: current.audioFormatId ?? baseAudioId ?? null,
    }));
  }, [duplicateSourceId, masterData, roomIdParam]);

  // The real cinema name for the cluster this room lives in — fetched independently
  // of the room draft so it's correct even before a room has ever been saved
  // (Basic Information showed a meaningless "Current cluster" placeholder before this).
  useEffect(() => {
    if (!clusterId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await movieApi.getClusterById(Number(clusterId));
        if (!cancelled) setClusterName(res.result.clusterName);
      } catch {
        // Non-fatal — the header/section fall back to a neutral placeholder.
      }
    })();
    return () => { cancelled = true; };
  }, [clusterId]);

  // New rooms receive an editable operational suggestion. Never overwrite a
  // value the operator has already typed while this request is in flight.
  useEffect(() => {
    if (!clusterId || roomIdParam) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await movieApi.getRoomsByCluster(Number(clusterId));
        if (cancelled) return;
        const suggestion = getNextRoomSuggestion(res.result ?? []);
        setRoomInfo((current) => ({
          ...current,
          roomCode: current.roomCode.trim() || suggestion.roomCode,
          cinemaRoomName: current.cinemaRoomName.trim() || suggestion.cinemaRoomName,
        }));
      } catch {
        // Suggestion failure must not block manual room creation.
      }
    })();
    return () => { cancelled = true; };
  }, [clusterId, roomIdParam]);

  // Resume an in-progress draft on reload (roomId is carried in the URL once the
  // configuration is first saved).
  useEffect(() => {
    if (!roomIdParam) return;
    let cancelled = false;
    (async () => {
      setHydrating(true);
      try {
        const roomRes = await movieApi.getRoomDetail(Number(roomIdParam));
        if (cancelled) return;
        const r = roomRes.result;
        setRoom(r);
        setRoomInfo({
          cinemaRoomName: r.cinemaRoomName,
          roomCode: r.roomCode ?? "",
          auditoriumClassId: r.auditoriumClassId ?? null,
          lengthM: r.lengthM != null ? String(r.lengthM) : "",
          widthM: r.widthM != null ? String(r.widthM) : "",
          clearHeightM: r.clearHeightM != null ? String(r.clearHeightM) : "",
        });
        setTechConfig({
          projectionTechnologyId: r.projectionTechnologyId ?? null,
          presentationSystem: r.presentationSystem ?? "STANDARD",
          resolutionId: r.resolutionId ?? null,
          screenWidthM: r.screenWidthM != null ? String(r.screenWidthM) : "",
          screenHeightM: r.screenHeightM != null ? String(r.screenHeightM) : "",
          audioFormatId: r.audioFormatId ?? null,
          supports2d: r.supports2d ?? true,
          supports3d: r.supports3d ?? false,
        });
        if (r.activeLayout) {
          setLayoutId(r.activeLayout.roomLayoutId);
          const layoutRes = await movieApi.getRoomLayout(r.cinemaRoomId, r.activeLayout.roomLayoutId);
          if (cancelled) return;
          const layout = layoutRes.result;
          setGridConfig({
            numberOfRows: layout.numberOfRows || 8,
            maxPositionsPerRow: layout.maxPositionsPerRow || 10,
            firstRowLabel: layout.firstRowLabel || "A",
            numberingDirection: layout.numberingDirection,
            numberingPolicy: layout.numberingPolicy ?? "CONTIGUOUS_SEATS",
          });
          const restoredAssistant = parseAssistantConfig(layout.generationConfig);
          if (restoredAssistant) setLayoutAssistant(restoredAssistant);
          else if (layout.generatorTemplateCode) {
            setLayoutAssistant((current) => ({
              ...current,
              templateCode: layout.generatorTemplateCode ?? current.templateCode,
              templateVersion: layout.generatorTemplateVersion ?? current.templateVersion,
            }));
          }
          if (layout.positions.length > 0) setPositions(layout.positions);
        }
      } catch (err: any) {
        setErrorMsg(err?.response?.data?.message ?? "Failed to load the draft room.");
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [roomIdParam]);

  const layoutStatus = room?.activeLayout?.status;
  const isEditable = !layoutStatus || EDITABLE_LAYOUT_STATUSES.has(layoutStatus);

  // Auto-generate a starting grid the first time an editable room has no
  // positions yet (brand-new room, or a draft whose layout was never built),
  // so the user sees a working seat map immediately instead of an empty state
  // that requires configuring rows/columns and clicking Generate first. Runs
  // once, right after the initial master-data/hydration fetches settle.
  const autoGeneratedRef = useRef(false);
  useEffect(() => {
    if (loadingMasterData || hydrating || hydratingDuplicate || autoGeneratedRef.current || !isEditable) return;
    if (positions.length === 0) {
      autoGeneratedRef.current = true;
      const firstRowLabelIndex = parseRowLabelIndex(gridConfig.firstRowLabel);
      setPositions(generateInitialGrid(gridConfig.numberOfRows, gridConfig.maxPositionsPerRow, firstRowLabelIndex, gridConfig.numberingDirection));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMasterData, hydrating, hydratingDuplicate]);

  /** Technical-config fields shared by both create and update — everything
   *  else (name/code/tier/dimensions) differs in whether it's required. */
  const buildTechPayload = () => ({
    projectionTechnologyId: techConfig.projectionTechnologyId ?? undefined,
    presentationSystem: techConfig.presentationSystem ?? "STANDARD",
    resolutionId: techConfig.resolutionId ?? undefined,
    screenWidthM: techConfig.screenWidthM ? Number(techConfig.screenWidthM) : undefined,
    screenHeightM: techConfig.screenHeightM ? Number(techConfig.screenHeightM) : undefined,
    audioFormatId: techConfig.audioFormatId ?? undefined,
    supports2d: techConfig.supports2d,
    supports3d: techConfig.supports3d,
  });

  /** Saves Basic Information / Physical Dimensions / Projection / Audio in one
   *  request. Returns the ids to use right away (state setters here don't land
   *  until next render, so callers must not rely on the `roomId`/`layoutId`
   *  state directly in the same action). */
  const saveConfiguration = async (): Promise<{ roomId: number; layoutId: number | null } | null> => {
    if (!clusterId) return null;
    try {
      if (!roomId) {
        const res = await movieApi.createRoomDraft({
          cinemaRoomName: roomInfo.cinemaRoomName.trim(),
          roomCode: roomInfo.roomCode.trim().toUpperCase(),
          clusterId: Number(clusterId),
          auditoriumClassId: roomInfo.auditoriumClassId!,
          lengthM: Number(roomInfo.lengthM),
          widthM: Number(roomInfo.widthM),
          clearHeightM: Number(roomInfo.clearHeightM),
          ...buildTechPayload(),
        });
        setRoomId(res.result.cinemaRoomId);
        setLayoutId(res.result.activeLayout?.roomLayoutId ?? null);
        setRoom(res.result);
        navigate(`/admin/clusters/${clusterId}/rooms/${res.result.cinemaRoomId}/edit`, { replace: true });
        return { roomId: res.result.cinemaRoomId, layoutId: res.result.activeLayout?.roomLayoutId ?? null };
      }
      const res = await movieApi.updateRoomDraft(roomId, {
        cinemaRoomName: roomInfo.cinemaRoomName.trim(),
        roomCode: roomInfo.roomCode.trim().toUpperCase(),
        auditoriumClassId: roomInfo.auditoriumClassId ?? undefined,
        lengthM: roomInfo.lengthM ? Number(roomInfo.lengthM) : undefined,
        widthM: roomInfo.widthM ? Number(roomInfo.widthM) : undefined,
        clearHeightM: roomInfo.clearHeightM ? Number(roomInfo.clearHeightM) : undefined,
        ...buildTechPayload(),
      });
      setRoom(res.result);
      return { roomId, layoutId };
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message ?? "Failed to save room configuration.");
      return null;
    }
  };

  const saveLayout = async (targetRoomId: number, targetLayoutId: number | null): Promise<boolean> => {
    if (!targetLayoutId) return true;
    try {
      await movieApi.saveRoomLayout(targetRoomId, targetLayoutId, {
        numberOfRows: gridConfig.numberOfRows,
        maxPositionsPerRow: gridConfig.maxPositionsPerRow,
        firstRowLabel: gridConfig.firstRowLabel,
        numberingDirection: gridConfig.numberingDirection,
        numberingPolicy: gridConfig.numberingPolicy,
        generatorTemplateCode: layoutAssistant.templateCode,
        generatorTemplateVersion: layoutAssistant.templateVersion,
        generationConfig: JSON.stringify(layoutAssistant),
        positions,
      });
      return true;
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message ?? "Failed to save the seat layout.");
      return false;
    }
  };

  const handleCancel = () => navigate(clusterId ? `/admin/clusters/${clusterId}` : "/admin/clusters");

  const handleSaveDraft = async () => {
    setSubmitAttempted(true);
    setSaving(true);
    setErrorMsg(null);
    const cfg = await saveConfiguration();
    if (cfg) {
      const ok = await saveLayout(cfg.roomId, cfg.layoutId);
      if (ok) showToast("success", "Draft saved.");
    }
    setSaving(false);
  };

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    setSaving(true);
    setErrorMsg(null);
    const cfg = await saveConfiguration();
    if (cfg && cfg.layoutId) {
      const ok = await saveLayout(cfg.roomId, cfg.layoutId);
      if (ok) {
        try {
          await movieApi.submitRoomLayout(cfg.roomId, cfg.layoutId);
          showToast("success", "Submitted for approval.");
          navigate(`/admin/clusters/${clusterId}`);
        } catch (err: any) {
          setErrorMsg(err?.response?.data?.message ?? "Submit failed.");
        }
      }
    } else if (cfg && !cfg.layoutId) {
      setErrorMsg("This room doesn't have a layout to submit yet — design the seat map first.");
    }
    setSaving(false);
  };

  const handleTemplateWarnings = (warnings: string[]) => {
    if (warnings.length > 0) showToast("error", warnings.join(" "));
  };

  const handleApplyRoomTemplate = (template: RoomConfigurationTemplate) => {
    const draft = buildDraftFromRoomTemplate(template);
    setRoomInfo((current) => ({ ...current, auditoriumClassId: template.auditoriumClassId }));
    setTechConfig((current) => ({
      ...current,
      presentationSystem: "STANDARD",
      projectionTechnologyId: template.projectionTechnologyId,
      resolutionId: template.resolutionId,
      audioFormatId: template.audioFormatId,
      supports2d: template.supports2d,
      supports3d: template.supports3d,
    }));
    setGridConfig(draft.grid);
    setLayoutAssistant(draft.assistant);
    setPositions(draft.positions);
    setAssistantPreview(null);
    showToast("success", `${template.name} applied. Verify physical and screen measurements before saving.`);
  };

  const handleDuplicateRoom = (sourceRoom: CinemaRoomDetail, source: RoomLayoutDetail, sourceRoomName: string) => {
    const groupIds = new Map<string, string>();
    const cloned = source.positions.map(({ positionId: _positionId, seatStatus: _seatStatus, ...position }) => {
      let seatGroupId = position.seatGroupId ?? null;
      if (seatGroupId) {
        if (!groupIds.has(seatGroupId)) groupIds.set(seatGroupId, crypto.randomUUID());
        seatGroupId = groupIds.get(seatGroupId)!;
      }
      return { ...position, seatGroupId, manualOverride: false };
    });
    const nextGrid: GridConfigForm = {
      numberOfRows: source.numberOfRows,
      maxPositionsPerRow: source.maxPositionsPerRow,
      firstRowLabel: source.firstRowLabel,
      numberingDirection: source.numberingDirection,
      numberingPolicy: source.numberingPolicy ?? "CONTIGUOUS_SEATS",
    };
    setGridConfig(nextGrid);
    setRoomInfo((current) => ({ ...current, auditoriumClassId: sourceRoom.auditoriumClassId ?? current.auditoriumClassId }));
    setTechConfig((current) => ({
      ...current,
      projectionTechnologyId: sourceRoom.projectionTechnologyId ?? current.projectionTechnologyId,
      presentationSystem: sourceRoom.presentationSystem ?? current.presentationSystem ?? "STANDARD",
      resolutionId: sourceRoom.resolutionId ?? current.resolutionId,
      audioFormatId: sourceRoom.audioFormatId ?? current.audioFormatId,
      supports2d: sourceRoom.supports2d ?? current.supports2d,
      supports3d: sourceRoom.supports3d ?? current.supports3d,
    }));
    setPositions(renumberLayout(cloned, nextGrid.numberingPolicy, nextGrid.numberingDirection));
    setLayoutAssistant(parseAssistantConfig(source.generationConfig) ?? {
      ...DEFAULT_LAYOUT_ASSISTANT,
      templateCode: source.generatorTemplateCode ?? "CLONED_ROOM",
      templateVersion: source.generatorTemplateVersion ?? source.version,
    });
    showToast("success", `Configuration duplicated from ${sourceRoomName}. Verify physical and screen measurements before saving.`);
  };

  const duplicateAppliedRef = useRef(false);
  useEffect(() => {
    if (!duplicateSourceId || roomIdParam || duplicateAppliedRef.current) return;
    duplicateAppliedRef.current = true;
    let cancelled = false;
    (async () => {
      setHydratingDuplicate(true);
      try {
        const roomResponse = await movieApi.getRoomDetail(duplicateSourceId);
        if (cancelled) return;
        const sourceRoom = roomResponse.result;
        if (!sourceRoom.activeLayout) throw new Error("The selected room does not have an active layout to duplicate.");
        const layoutResponse = await movieApi.getRoomLayout(duplicateSourceId, sourceRoom.activeLayout.roomLayoutId);
        if (cancelled) return;
        handleDuplicateRoom(sourceRoom, layoutResponse.result, sourceRoom.cinemaRoomName);
      } catch (error: any) {
        if (!cancelled) setErrorMsg(error?.response?.data?.message ?? error?.message ?? "Failed to duplicate the selected room.");
      } finally {
        if (!cancelled) setHydratingDuplicate(false);
      }
    })();
    return () => { cancelled = true; };
    // Run once for the source encoded in the create-room URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateSourceId, roomIdParam]);

  if (loadingMasterData || hydrating || hydratingDuplicate) {
    return <LoadingState label={hydratingDuplicate ? "Duplicating room configuration…" : hydrating ? "Loading saved draft…" : "Loading room configuration options…"} />;
  }
  if (masterDataError || !masterData) {
    return <ErrorBanner message={masterDataError ?? "Failed to load master data."} onRetry={loadMasterData} />;
  }

  const validationIssues = validateCinemaRoomEditor({
    clusterId: clusterId ? Number(clusterId) : null,
    roomInfo, techConfig, gridConfig, positions,
  });
  const capacityEnvelope = calculateRoomCapacityEnvelope(roomInfo, techConfig, positions);
  const workspaceCapacityEnvelope = assistantPreview
    ? calculateRoomCapacityEnvelope(roomInfo, techConfig, assistantPreview)
    : capacityEnvelope;
  const selectedProjection = masterData.projectionTechnologies.find((item) => item.id === techConfig.projectionTechnologyId);
  const selectedResolution = masterData.resolutions.find((item) => item.id === techConfig.resolutionId);
  const selectedAudio = masterData.audioFormats.find((item) => item.id === techConfig.audioFormatId);
  const visualizationConfig: AuditoriumVisualizationConfig = {
    presentationSystem: techConfig.presentationSystem ?? "STANDARD",
    projectionTechnologyCode: selectedProjection?.code,
    projectionTechnologyName: selectedProjection?.name,
    resolutionCode: selectedResolution?.code,
    audioFormatCode: selectedAudio?.code,
    audioFormatName: selectedAudio?.name,
  };
  const blockingIssues = validationIssues.filter((i) => i.severity === "error");
  const warningIssues = validationIssues.filter((i) => i.severity === "warning");
  // Only surface inline field messages once the user has tried to save/submit —
  // Submit itself is still gated on `blockingIssues` regardless of this.
  const displayedIssues = submitAttempted ? validationIssues : [];
  const effectiveClusterName = clusterName ?? room?.clusterName;
  // The seat editor's own validation panel only cares about layout-scoped
  // issues (a position it can jump to, or a general "layout is empty/has no
  // sellable seats" notice) — room-info/tech-config field issues stay in the
  // page-level summary only, shown once the user tries to Save/Submit.
  const layoutIssues = validationIssues.filter((i) => (i.positionKeys && i.positionKeys.length > 0) || i.field === "positions");

  const tabClass = (tab: "config" | "seats") =>
    `flex-1 py-2.5 rounded-lg text-center ${activeTab === tab ? "font-semibold" : ""}`;

  return (
    <>
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <CinemaRoomHeader
        mode={roomIdParam ? "edit" : "create"}
        roomName={roomInfo.cinemaRoomName}
        clusterName={effectiveClusterName}
        layoutStatus={layoutStatus}
        layoutVersion={room?.activeLayout?.version}
        onBack={handleCancel}
        actions={isEditable ? (
          <EditorActionBar
            layoutStatus={layoutStatus}
            saving={saving}
            onSaveDraft={handleSaveDraft}
            onSubmit={handleSubmit}
            submitDisabled={blockingIssues.length > 0}
          />
        ) : undefined}
      />

      {errorMsg && <ErrorBanner message={errorMsg} />}

      {!isEditable && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5" style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.25)" }}>
          <AlertTriangle size={16} style={{ color: "#2563eb", flexShrink: 0 }} />
          <p style={{ fontSize: "13px", color: "var(--text-main)" }}>
            This layout is <strong>{layoutStatus}</strong> and can't be edited here. Approving, rejecting, or
            activating a layout is done from the room detail page.
          </p>
        </div>
      )}

      {/* Small-screen tab switcher — both columns always render side-by-side at lg: and up. */}
      <div className="flex gap-2 mb-4 p-1 rounded-xl lg:hidden" style={{ background: "var(--bg-main)", border: "1px solid var(--border-color)" }}>
        <button type="button" onClick={() => setActiveTab("config")} className={tabClass("config")}
          style={{ fontSize: "13px", color: activeTab === "config" ? "#2563eb" : "var(--text-sub)", background: activeTab === "config" ? "var(--bg-card)" : "transparent" }}>
          Configuration
        </button>
        <button type="button" onClick={() => setActiveTab("seats")} className={tabClass("seats")}
          style={{ fontSize: "13px", color: activeTab === "seats" ? "#2563eb" : "var(--text-sub)", background: activeTab === "seats" ? "var(--bg-card)" : "transparent" }}>
          Seat Layout
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div className={`${activeTab === "config" ? "block" : "hidden"} lg:block w-full`} style={{ flex: "0 0 300px", position: "sticky", top: "16px", maxHeight: "calc(100vh - 32px)", overflowY: "auto" }}>
          <RoomConfigurationPanel
            quickStart={
              <RoomQuickStartSection
                templates={masterData.roomTemplates ?? []}
                hasExistingWork={positions.length > 0 || roomInfo.auditoriumClassId != null
                  || techConfig.projectionTechnologyId != null || techConfig.audioFormatId != null}
                onApply={handleApplyRoomTemplate}
                disabled={!isEditable}
              />
            }
            basic={
              <BasicInformationSection
                masterData={masterData} value={roomInfo} onChange={setRoomInfo}
                issues={displayedIssues} disabled={!isEditable}
              />
            }
            dimensions={
              <PhysicalDimensionsSection
                value={roomInfo} onChange={setRoomInfo}
                issues={displayedIssues} disabled={!isEditable}
              />
            }
            projection={
              <ProjectionConfigurationSection
                masterData={masterData} value={techConfig} onChange={setTechConfig} issues={displayedIssues}
                roomWidthM={roomInfo.widthM} roomClearHeightM={roomInfo.clearHeightM} disabled={!isEditable}
              />
            }
            audio={
              <AudioConfigurationSection masterData={masterData} value={techConfig} onChange={setTechConfig} issues={displayedIssues} disabled={!isEditable} />
            }
            grid={
              <GridConfigurationSection
                value={gridConfig} onChange={setGridConfig} positions={positions}
                onResizePositions={setPositions} issues={displayedIssues}
                capacityEnvelope={capacityEnvelope} disabled={!isEditable}
              />
            }
            distribution={
              <LayoutAssistantSection
                value={layoutAssistant} onChange={setLayoutAssistant}
                gridConfig={gridConfig} positions={positions}
                onApply={setPositions} onPreview={setAssistantPreview} onWarnings={handleTemplateWarnings}
                disabled={!isEditable}
              />
            }
          />
        </div>

        <div className={`${activeTab === "seats" ? "block" : "hidden"} lg:block flex-1 min-w-0 w-full rounded-xl p-4`} style={{ background: "var(--bg-main)", border: "1px solid var(--border-color)" }}>
          <SeatLayoutWorkspace
            positions={assistantPreview ?? positions}
            onChange={setPositions}
            gridConfig={gridConfig}
            onError={(msg) => showToast("error", msg)}
            layoutIssues={layoutIssues}
            capacityEnvelope={workspaceCapacityEnvelope}
            visualizationConfig={visualizationConfig}
            readOnly={!isEditable || assistantPreview != null}
            previewMode={assistantPreview != null}
          />
        </div>
      </div>

      {isEditable && submitAttempted && validationIssues.length > 0 && (
        <div className="rounded-xl p-4 mt-6" style={{ background: "var(--bg-main)", border: "1px solid var(--border-color)" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-sub)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "8px" }}>
            Validation Summary
          </p>
          <ul className="space-y-1.5">
            {blockingIssues.map((issue, i) => (
              <li key={`err-${i}`} className="flex items-start gap-2" style={{ color: "#ef4444" }}>
                <AlertTriangle size={14} style={{ marginTop: "2px", flexShrink: 0 }} />
                <span style={{ fontSize: "13px" }}>{issue.message}</span>
              </li>
            ))}
            {warningIssues.map((issue, i) => (
              <li key={`warn-${i}`} className="flex items-start gap-2" style={{ color: "#d97706" }}>
                <AlertTriangle size={14} style={{ marginTop: "2px", flexShrink: 0 }} />
                <span style={{ fontSize: "13px" }}>{issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {isEditable && submitAttempted && validationIssues.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl p-4 mt-6" style={{ background: "var(--bg-main)", border: "1px solid var(--border-color)", color: "#059669" }}>
          <CheckCircle2 size={16} />
          <span style={{ fontSize: "13px", fontWeight: 600 }}>No issues found — ready to submit.</span>
        </div>
      )}

    </>
  );
}
