import { useEffect, useRef, useState, type RefObject } from "react";
import { motion } from "motion/react";
import { Play, Stop, Warning, X } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import type {
  BackendTrip,
  StartMyTripPayload,
} from "../../services/backendApi";
import type { useBrowserCNN } from "../../hook/useBrowserCNN";
import {
  tripFormWarnings,
  tripTitle,
  routeLabel,
  dateLabel,
} from "../../utils/trips/tripFormatters";
import {
  TRIP_CODE_MAX_LENGTH,
  ROUTE_POINT_MAX_LENGTH,
} from "../../utils/trips/tripFormConstants";
import { resolveAppLanguage } from "../../i18n";
import { SPRING } from "../../utils/trips/tripMotion";
import { TripMetric } from "./TripMetric";
import { TextField } from "./TextField";
import { AlertInfoRow, type AlertInfo } from "./AlertInfoRow";

type CnnMetrics = ReturnType<typeof useBrowserCNN>["metrics"];
type ActiveCnnMetrics = NonNullable<CnnMetrics>;
const NO_FACE_GUIDANCE_DELAY_MS = 2000;

interface TripDialogProps {
  activeTrip: BackendTrip | null;
  canClose: boolean;
  cnnEventCount: number;
  cnnMetrics: CnnMetrics;
  cnnRunning: boolean;
  cnnVideoRef: RefObject<HTMLVideoElement | null>;
  error: string;
  form: StartMyTripPayload;
  isBusy: boolean;
  liveAlerts: AlertInfo[];
  driverName: string;
  onClose: () => void;
  onEndTrip: () => void;
  onStartTrip: () => void;
  onUpdateForm: (field: keyof StartMyTripPayload, value: string) => void;
  escalationActive: boolean;
}

export default function TripDialog({
  activeTrip,
  canClose,
  cnnEventCount,
  cnnMetrics,
  cnnRunning,
  cnnVideoRef,
  error,
  form,
  isBusy,
  liveAlerts,
  driverName,
  onClose,
  onEndTrip,
  onStartTrip,
  onUpdateForm,
  escalationActive,
}: TripDialogProps) {
  const { t, i18n } = useTranslation(["trips", "common"]);
  const warnings = tripFormWarnings(form);
  const language = resolveAppLanguage(i18n.resolvedLanguage ?? i18n.language);
  const localeTag = language === "vi" ? "vi-VN" : "en-US";
  const titleFallback = t("common:fallback.tripWithoutCode");
  const routeFallback = t("common:fallback.routeNotProvided");
  const [showNoFaceGuidance, setShowNoFaceGuidance] = useState(false);
  const shouldStartNoFaceTimer =
    Boolean(activeTrip) && cnnRunning && cnnMetrics?.faceDetected === false;

  useEffect(() => {
    if (!shouldStartNoFaceTimer) {
      const timeoutId = window.setTimeout(() => {
        setShowNoFaceGuidance(false);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    const timeoutId = window.setTimeout(() => {
      setShowNoFaceGuidance(true);
    }, NO_FACE_GUIDANCE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [shouldStartNoFaceTimer]);

  return (
    <div
      className="theme-overlay fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && canClose) onClose();
      }}
      role="presentation"
    >
      <motion.section
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...SPRING, delay: 0.04 }}
        className="bezel-shell flex max-h-[92vh] w-full max-w-5xl flex-col"
      >
        <div className="bezel-core relative flex flex-col gap-5 overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div
                className={`eyebrow-chip mb-2 ${
                  activeTrip ? "border-accent-warn/30 bg-accent-warn/10" : ""
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    activeTrip
                      ? "bg-accent-warn shadow-[0_0_8px_rgba(245,158,11,0.7)]"
                      : "bg-accent-active"
                  }`}
                />
                <span>
                  {activeTrip
                    ? t("tripDialog.eyebrow.live")
                    : t("tripDialog.eyebrow.new")}
                </span>
              </div>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-text-primary">
                {activeTrip
                  ? t("tripDialog.title.active")
                  : t("tripDialog.title.new")}
              </h2>
              <p className="mt-1 text-xs text-text-tertiary">
                {activeTrip
                  ? t("tripDialog.subtitle.active")
                  : t("tripDialog.subtitle.new")}
              </p>
            </div>
            {canClose ? (
              <button
                type="button"
                aria-label={t("form.close")}
                onClick={onClose}
                disabled={isBusy}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-subtle-bg text-text-secondary transition-colors duration-200 hover:bg-subtle-bg-hover hover:text-text-primary disabled:opacity-50"
              >
                <X size={14} weight="bold" />
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-xl border border-accent-warn/30 bg-accent-warn/6 px-4 py-2.5 text-xs text-accent-warn">
              {error}
            </div>
          ) : null}

          {!activeTrip ? (
            <div className="grid gap-4">
              <div className="grid gap-3">
                <TextField
                  labelKey="tripDialog.fields.tripCode"
                  value={form.code ?? ""}
                  placeholderKey="tripDialog.fields.tripCodePlaceholder"
                  maxLength={TRIP_CODE_MAX_LENGTH}
                  readOnly
                  onChange={(value) => onUpdateForm("code", value)}
                />
                <div className="flex flex-col gap-3 md:flex-row">
                  <div className="flex-1">
                    <TextField
                      labelKey="tripDialog.fields.origin"
                      value={form.origin ?? ""}
                      placeholderKey="tripDialog.fields.originPlaceholder"
                      maxLength={ROUTE_POINT_MAX_LENGTH}
                      onChange={(value) => onUpdateForm("origin", value)}
                    />
                  </div>
                  <div className="flex-1">
                    <TextField
                      labelKey="tripDialog.fields.destination"
                      value={form.destination ?? ""}
                      placeholderKey="tripDialog.fields.destinationPlaceholder"
                      maxLength={ROUTE_POINT_MAX_LENGTH}
                      onChange={(value) => onUpdateForm("destination", value)}
                    />
                  </div>
                </div>
              </div>

              {warnings.length > 0 ? (
                <div className="grid gap-1 rounded-xl border border-accent-warn/30 bg-accent-warn/6 px-4 py-2.5 text-xs text-accent-warn">
                  {warnings.map((warning) => (
                    <p key={warning.key}>{t(warning.key, warning.params)}</p>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="cta-ghost"
                  disabled={isBusy}
                  onClick={onClose}
                >
                  {t("form.cancel")}
                </button>
                <button
                  type="button"
                  className="cta-primary"
                  disabled={isBusy}
                  onClick={onStartTrip}
                >
                  <Play size={12} weight="fill" />
                  <span>{t("form.startTrip")}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1.4fr_0.85fr]">
              <div className="grid gap-4">
                <div className="grid gap-2.5 text-sm md:grid-cols-3 xl:grid-cols-5">
                  <TripMetric
                    label={t("tripDialog.metrics.tripCode")}
                    value={tripTitle(activeTrip, { fallback: titleFallback })}
                  />
                  <TripMetric
                    label={t("tripDialog.metrics.route")}
                    value={routeLabel(activeTrip, {
                      fallback: routeFallback,
                      arrow: "→",
                    })}
                  />
                  <TripMetric
                    label={t("tripDialog.metrics.startTime")}
                    value={dateLabel(
                      activeTrip.actual_start_at ?? activeTrip.start_time,
                      localeTag,
                    )}
                  />
                  <TripMetric
                    label={t("tripDialog.metrics.driver")}
                    value={driverName}
                  />
                  <TripMetric
                    label={t("tripDialog.metrics.detection")}
                    value={
                      cnnRunning
                        ? t("tripDialog.metrics.detectionRunning")
                        : t("tripDialog.metrics.detectionStarting")
                    }
                  />
                </div>

                <div
                  className={`theme-video-surface relative aspect-4/3 w-full overflow-hidden rounded-2xl border border-hairline ${
                    cnnRunning ? "" : "hidden"
                  }`}
                >
                  <CameraMonitoringOverlay
                    metrics={cnnMetrics}
                    videoRef={cnnVideoRef}
                  />
                  {showNoFaceGuidance ? (
                    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/45 px-4 text-center backdrop-blur-[1px]">
                      <div className="max-w-md rounded-2xl border border-accent-warn/40 bg-accent-warn/90 px-4 py-3 text-text-primary shadow-[0_10px_34px_rgba(217,119,6,0.35)]">
                        <p className="text-sm font-bold uppercase tracking-[0.12em]">
                          {t("tripDialog.driverGuidance.noFace.title")}
                        </p>
                        <p className="mt-1 text-xs font-medium leading-5">
                          {t("tripDialog.driverGuidance.noFace.message")}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {escalationActive ? (
                    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-accent-critical/40 backdrop-blur-[2px]">
                      <span className="animate-pulse text-center text-3xl font-black uppercase tracking-[0.08em] text-white drop-shadow-[0_4px_22px_rgba(127,29,29,0.95)] sm:text-5xl">
                        {t("tripDialog.overlay.stayAlert")}
                      </span>
                    </div>
                  ) : null}
                </div>

                {!cnnRunning ? (
                  <div className="rounded-2xl border border-hairline bg-subtle-bg px-4 py-10 text-center text-xs text-text-tertiary">
                    {t("tripDialog.metrics.waitingForLive")}
                  </div>
                ) : null}

                <DriverMonitoringBanner
                  hasConnectionIssue={Boolean(error)}
                  isCameraRunning={cnnRunning}
                  showNoFaceGuidance={showNoFaceGuidance}
                />
              </div>

              <div className="grid content-start gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold tracking-[-0.01em] text-text-primary">
                      {t("tripDialog.alertsTitle")}
                    </h3>
                    <span className="rounded-full border border-accent-active/30 bg-accent-active/10 px-2 py-0.5 font-mono-num text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-active tabular-nums">
                      {t("tripDialog.eventsCount", { count: cnnEventCount })}
                    </span>
                  </div>
                </div>
                <div className="grid gap-2">
                  {liveAlerts.length > 0 ? (
                    liveAlerts.map((alert) => (
                      <AlertInfoRow key={alert.id} alert={alert} />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-hairline bg-subtle-bg px-4 py-6 text-center text-xs text-text-tertiary">
                      {t("tripDialog.noLiveAlerts")}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="cta-danger mt-1"
                  disabled={isBusy}
                  onClick={onEndTrip}
                >
                  <Stop size={12} weight="fill" />
                  <span>{t("form.endTrip")}</span>
                </button>

                {escalationActive ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-accent-critical/30 bg-accent-critical/6 px-3.5 py-2.5 text-[11px] text-accent-critical">
                    <Warning
                      size={14}
                      weight="fill"
                      className="text-accent-critical"
                    />
                    <span>{t("tripDialog.overlay.escalationEngaged")}</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}

function CameraMonitoringOverlay({
  metrics,
  videoRef,
}: {
  metrics: CnnMetrics;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      if (!metrics) return;

      const videoWidth = video?.videoWidth || 4;
      const videoHeight = video?.videoHeight || 3;
      const videoAspect = videoWidth / Math.max(1, videoHeight);
      const canvasAspect = width / height;
      const drawWidth = videoAspect > canvasAspect ? width : height * videoAspect;
      const drawHeight = videoAspect > canvasAspect ? width / videoAspect : height;
      const offsetX = (width - drawWidth) / 2;
      const offsetY = (height - drawHeight) / 2;

      drawCameraOverlay(ctx, metrics, {
        height,
        offsetX,
        offsetY,
        width,
        videoHeight: drawHeight,
        videoWidth: drawWidth,
      });
    };

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [metrics, videoRef]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="h-full w-full scale-x-[-1] object-contain"
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        aria-hidden="true"
      />
    </>
  );
}

function drawCameraOverlay(
  ctx: CanvasRenderingContext2D,
  metrics: ActiveCnnMetrics,
  bounds: {
    height: number;
    offsetX: number;
    offsetY: number;
    width: number;
    videoHeight: number;
    videoWidth: number;
  },
) {
  const scale = Math.max(0.85, Math.min(1.35, bounds.width / 760));
  const left = bounds.offsetX + 12 * scale;
  const top = bounds.offsetY + 26 * scale;
  const right = bounds.offsetX + bounds.videoWidth - 12 * scale;
  const bottom = bounds.offsetY + bounds.videoHeight - 18 * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  drawOutlinedText(ctx, `EAR: ${metrics.ear.toFixed(3)}`, left, top, {
    color: "#f8fafc",
    fontSize: 16 * scale,
  });
  drawOutlinedText(ctx, `MAR: ${metrics.mar.toFixed(2)}`, left, top + 24 * scale, {
    color: metrics.marAlert ? "#ef4444" : "#f8fafc",
    fontSize: 16 * scale,
  });
  drawOutlinedText(ctx, `FPS: ${metrics.fps ?? "--"}`, right, top, {
    align: "right",
    color: "#f8fafc",
    fontSize: 16 * scale,
  });

  drawOutlinedText(ctx, "=== TRANG THAI ===", left, bottom - 92 * scale, {
    color: "#f8fafc",
    fontSize: 14 * scale,
  });
  drawOutlinedText(
    ctx,
    `MAT: ${metrics.earAlert ? "NHAM" : "MO"}`,
    left,
    bottom - 66 * scale,
    { color: metrics.earAlert ? "#ef4444" : "#22c55e", fontSize: 16 * scale },
  );
  drawOutlinedText(
    ctx,
    `MIENG: ${metrics.marAlert ? "NGAP" : "THUONG"}`,
    left,
    bottom - 40 * scale,
    { color: metrics.marAlert ? "#ef4444" : "#22c55e", fontSize: 16 * scale },
  );
  drawOutlinedText(ctx, `DAU: ${metrics.poseAlert ? "GAT" : "BINH THUONG"}`, left, bottom - 14 * scale, {
    color: metrics.poseAlert ? "#f59e0b" : "#22c55e",
    fontSize: 16 * scale,
  });

  if (metrics.poseAlert) {
    drawOutlinedText(ctx, "GAT DAU!", bounds.width / 2, bounds.offsetY + 116 * scale, {
      align: "center",
      color: "#f59e0b",
      fontSize: 24 * scale,
      lineWidth: 6 * scale,
      weight: 800,
    });
  }
}

function drawOutlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    align?: "left" | "right" | "center" | "start" | "end";
    color: string;
    fontSize: number;
    lineWidth?: number;
    weight?: number;
  },
) {
  ctx.font = `${options.weight ?? 700} ${options.fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textAlign = options.align ?? "left";
  ctx.textBaseline = "alphabetic";
  ctx.lineWidth = options.lineWidth ?? 4;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.88)";
  ctx.fillStyle = options.color;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function DriverMonitoringBanner({
  hasConnectionIssue,
  isCameraRunning,
  showNoFaceGuidance,
}: {
  hasConnectionIssue: boolean;
  isCameraRunning: boolean;
  showNoFaceGuidance: boolean;
}) {
  const { t } = useTranslation("trips");

  if (hasConnectionIssue) {
    return (
      <MonitoringNotice
        tone="critical"
        title={t("tripDialog.driverGuidance.connectionLost.title")}
        message={t("tripDialog.driverGuidance.connectionLost.message")}
      />
    );
  }

  if (!isCameraRunning) {
    return (
      <MonitoringNotice
        tone="warn"
        title={t("tripDialog.driverGuidance.cameraStopped.title")}
        message={t("tripDialog.driverGuidance.cameraStopped.message")}
      />
    );
  }

  if (showNoFaceGuidance) {
    return (
      <MonitoringNotice
        tone="warn"
        title={t("tripDialog.driverGuidance.noFace.title")}
        message={t("tripDialog.driverGuidance.noFace.message")}
      />
    );
  }

  return null;
}

function MonitoringNotice({
  tone,
  title,
  message,
}: {
  tone: "warn" | "critical";
  title: string;
  message: string;
}) {
  const toneClass =
    tone === "critical"
      ? "border-accent-critical/30 bg-accent-critical/6 text-accent-critical"
      : "border-accent-warn/30 bg-accent-warn/6 text-accent-warn";

  return (
    <div className={`flex gap-2 rounded-2xl border px-4 py-3 text-xs ${toneClass}`}>
      <Warning size={16} weight="fill" className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 leading-5 opacity-90">{message}</p>
      </div>
    </div>
  );
}
