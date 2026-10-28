/**
 * "Start from a floor plan" (1.14.3, D266, spec §5.1): one image or PDF of a plan, turned before
 * it is sent, with what the read costs and where it goes, then uploaded and read.
 *
 * - Choose a file takes an image (JPEG, PNG, WebP, HEIC, GIF) or a PDF; Take a photo is the system
 *   camera through a file input (`capture`), never the live scanner.
 * - An image the browser decodes is re-encoded here, at most 3,072 px on its long side, JPEG q0.92,
 *   which drops its EXIF and GPS before it leaves the phone; anything else (a PDF, a HEIC this
 *   browser can't read) goes as it is and the server strips it when it re-encodes. The quarter
 *   turn goes with the request: the server turns the image before the model reads it.
 * - Try Kept offers only its sample plan: no AI runs there and nothing is kept.
 */
import { FLOOR_PLAN_FILE, type ProviderKind, planEstimate } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useMemo, useState } from 'react';
import { FileTrigger } from 'react-aria-components';
import { mapApi } from '@/api/map/queries';
import type { FloorPlanView } from '@/api/map/types';
import { canvasToJpeg, decodeWithBitmap, drawScaled } from '@/camera/image';
import { useProviderName } from '@/components/ai/labels';
import { useErrorText } from '@/components/page';
import { Sheet } from '@/components/things/sheet';
import { putFile } from '@/components/things/upload';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/lib/format';
import { TRY } from '@/try/flag';
import { samplePlanImage } from './sample-plan';

const JPEG_Q = 0.92;
const TURNS = [0, 90, 180, 270] as const;
type Turn = (typeof TURNS)[number];

type Picked = { file: File; preview: string | null; size: { w: number; h: number } | null };

/** The plan as it is sent: a decodable image re-encoded without its metadata, else as it is. */
export async function planUpload(
  file: File,
): Promise<{ file: File; size: { w: number; h: number } | null }> {
  if (!file.type.startsWith('image/')) return { file, size: null };
  try {
    const img = await decodeWithBitmap(file);
    const canvas = drawScaled(img, FLOOR_PLAN_FILE.maxPx);
    const jpeg = await canvasToJpeg(canvas, JPEG_Q);
    return {
      file: new File([jpeg], 'floor-plan.jpg', { type: 'image/jpeg' }),
      size: { w: canvas.width, h: canvas.height },
    };
  } catch {
    return { file, size: null };
  }
}

export function StartPlanSheet({
  isOpen,
  onOpenChange,
  locationId,
  provider,
  onStarted,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
  /** The provider that would read it, for the cost and privacy lines; null when unknown. */
  provider: ProviderKind | null;
  onStarted: (plan: FloorPlanView, preview: string | null) => void;
}) {
  const { t } = useLingui();
  const f = useFormat();
  const errorText = useErrorText();
  const providerName = useProviderName();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [turn, setTurn] = useState<Turn>(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) return;
    setPicked(null);
    setTurn(0);
    setProblem(null);
  }, [isOpen]);

  async function pick(file: File | null) {
    if (!file) return;
    setProblem(null);
    const isImage = file.type.startsWith('image/');
    let size: Picked['size'] = null;
    if (isImage) {
      try {
        const img = await decodeWithBitmap(file);
        size = { w: img.width, h: img.height };
      } catch {
        size = null;
      }
    }
    setPicked({ file, preview: isImage ? URL.createObjectURL(file) : null, size });
    setTurn(0);
  }

  async function pickSample() {
    const blob = await samplePlanImage();
    await pick(new File([blob], 'sample-floor-plan.png', { type: 'image/png' }));
  }

  async function read() {
    if (!picked) return;
    setBusy(true);
    setProblem(null);
    try {
      const sent = await planUpload(picked.file);
      const file = await putFile({ file: sent.file, locationId });
      const plan = await mapApi.startPlan(locationId, {
        fileId: file.deduplicatedFrom ?? file.id,
        sha256: file.sha256,
        turn,
      });
      onStarted(plan, picked.preview);
      onOpenChange(false);
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const pdf = picked?.file.type === 'application/pdf';
  const estimate = useMemo(() => {
    if (!provider) return null;
    const s = picked?.size ?? { w: FLOOR_PLAN_FILE.maxPx, h: FLOOR_PLAN_FILE.maxPx };
    const quarter = turn % 180 === 90;
    return planEstimate({
      kind: provider,
      width: quarter ? s.h : s.w,
      height: quarter ? s.w : s.h,
    });
  }, [provider, picked, turn]);
  const name = provider ? providerName(provider) : null;
  const tokens = estimate === null ? '' : f.num(estimate);

  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title={t`Start from a floor plan`}>
      <div className="grid gap-4 text-[15px]">
        <p className="m-0 text-ink-2 [overflow-wrap:anywhere]">
          <Trans>
            A photo, a screenshot or a PDF of a plan. Kept reads the rooms and their sizes; you
            check them before anything is added.
          </Trans>
        </p>
        <div className="flex flex-wrap gap-2">
          {TRY ? (
            <Button variant="secondary" onPress={() => void pickSample()}>
              <Trans>Use a sample floor plan</Trans>
            </Button>
          ) : (
            <>
              <FileTrigger
                acceptedFileTypes={['image/*', 'application/pdf']}
                onSelect={(list) => void pick(list?.[0] ?? null)}
              >
                <Button variant="secondary">
                  <Trans>Choose a file</Trans>
                </Button>
              </FileTrigger>
              <FileTrigger
                acceptedFileTypes={['image/*']}
                defaultCamera="environment"
                onSelect={(list) => void pick(list?.[0] ?? null)}
              >
                <Button variant="secondary">
                  <Trans>Take a photo</Trans>
                </Button>
              </FileTrigger>
            </>
          )}
        </div>
        {picked ? (
          <div className="grid gap-2">
            {picked.preview ? (
              <div className="grid min-h-40 place-items-center overflow-hidden rounded-[10px] border border-line bg-sunken p-2">
                <img
                  src={picked.preview}
                  alt={t`The plan you chose`}
                  className="max-h-64 max-w-full object-contain transition-transform"
                  style={{ transform: `rotate(${turn}deg)` }}
                />
              </div>
            ) : (
              <p className="m-0 rounded-[10px] border border-line bg-sunken p-3 text-[13px] [overflow-wrap:anywhere]">
                <bdi>{picked.file.name}</bdi>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="small"
                aria-label={t`Turn the plan a quarter turn`}
                onPress={() => setTurn((x) => TURNS[(TURNS.indexOf(x) + 1) % 4] as Turn)}
              >
                <Trans>Turn</Trans>
              </Button>
              {pdf ? (
                <span className="text-[13px] text-ink-3">
                  <Trans>Only the first page is read.</Trans>
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
        {!TRY ? (
          <div className="grid gap-1 text-[13px] text-ink-2">
            {estimate !== null && name ? (
              <p className="m-0 [overflow-wrap:anywhere]">
                {[t`Up to ~${tokens} tokens`, name].join(f.sep)}
              </p>
            ) : null}
            {name ? (
              <p className="m-0 [overflow-wrap:anywhere]">
                <Trans>
                  Kept sends the plan, without its location data, to <bdi>{name}</bdi>. It is
                  deleted when you finish, unless you keep it.
                </Trans>
              </p>
            ) : null}
          </div>
        ) : null}
        {problem ? (
          <p role="alert" className="m-0 text-[13px] text-danger [overflow-wrap:anywhere]">
            {problem}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="primary"
            isDisabled={!picked}
            isPending={busy}
            onPress={() => void read()}
          >
            <Trans>Read the plan</Trans>
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
