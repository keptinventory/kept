/**
 * What a Homebox import's new location tracks, asked before its choices: Essentials (finding
 * things: rooms, boxes, labels and search) and, ticked on top of it, each module the backup has
 * data for, with how much: prices → Money, warranties → Warranties, maintenance → Schedules
 * (homeboxModules in @kept/shared, from the inspection's counts). Unticked, that data stays in the
 * things' notes as text, which can't become records later. A backup with none of it shows plain
 * Essentials. The three preset cards stay, and the same choice is offered for Personal, so the
 * menu doesn't fill with modules nobody asked for. Anything can be switched on later in Location
 * settings → What to track; turning something off never deletes anything.
 */
import { homeboxModules, type ModuleId, type Preset, presetModules } from '@kept/shared';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import type { HomeboxMappingHints } from '@/api/portability/types';
import { Notice } from '@/components/page';
import { PresetPicker } from '@/components/preset-picker';
import { Switch } from '@/components/ui/switch';
import { TickBox } from '@/components/ui/tick-box';
import { useModuleLabels } from '@/lib/labels';

export type TrackDraft = { preset: Preset; modules: ModuleId[]; alsoPersonal: boolean };

/** Essentials, with every module the backup has data for ticked. */
export const initialTrack = (hints: HomeboxMappingHints | undefined): TrackDraft => ({
  preset: 'essentials',
  modules: homeboxModules(hints ?? {}).map((m) => m.module),
  alsoPersonal: false,
});

/** The modules to send: the ticked ones the preset doesn't already switch on. */
export const extraModules = (draft: TrackDraft): ModuleId[] => {
  const base = presetModules(draft.preset);
  return draft.modules.filter((m) => !base.has(m));
};

export function TrackStep({
  draft,
  onChange,
  hints,
}: {
  draft: TrackDraft;
  onChange: (draft: TrackDraft) => void;
  hints: HomeboxMappingHints | undefined;
}) {
  const { t } = useLingui();
  const labels = useModuleLabels();
  const base = presetModules(draft.preset);
  const uses = homeboxModules(hints ?? {}).filter((m) => !base.has(m.module));
  const unticked = uses.some((m) => !draft.modules.includes(m.module));
  const toggle = (module: ModuleId, on: boolean) =>
    onChange({
      ...draft,
      modules: on ? [...draft.modules, module] : draft.modules.filter((m) => m !== module),
    });
  return (
    <div className="grid gap-4">
      <p className="m-0 text-ink-2">
        <Trans>
          Start with what you need; turn anything else on later in Location settings → What to
          track. Turning something off never deletes anything.
        </Trans>
      </p>
      <PresetPicker
        label={t`What to track`}
        value={draft.preset}
        onChange={(preset) => onChange({ ...draft, preset })}
      />
      {uses.length > 0 ? (
        <section className="grid gap-1" aria-labelledby="track-uses">
          <h3 id="track-uses" className="m-0 font-semibold text-[17px]">
            <Trans>And what the backup uses</Trans>
          </h3>
          {uses.map(({ module, count }) => {
            const name = labels[module];
            return (
              <TickBox
                key={module}
                isSelected={draft.modules.includes(module)}
                onChange={(on) => toggle(module, on)}
                description={<Trans>Turns on {name}</Trans>}
              >
                {module === 'money' ? (
                  <Plural value={count} one="Prices on # thing" other="Prices on # things" />
                ) : module === 'warranties' ? (
                  <Plural value={count} one="# warranty" other="# warranties" />
                ) : (
                  <Plural value={count} one="# maintenance entry" other="# maintenance entries" />
                )}
              </TickBox>
            );
          })}
          {unticked ? (
            <Notice tone="warn">
              <Trans>
                What's unticked stays in the things' notes as text. Notes can't become records
                later: to keep it as records, tick it now.
              </Trans>
            </Notice>
          ) : null}
        </section>
      ) : null}
      <div className="grid gap-1">
        <Switch
          isSelected={draft.alsoPersonal}
          onChange={(alsoPersonal) => onChange({ ...draft, alsoPersonal })}
        >
          <Trans>Also for Personal</Trans>
        </Switch>
        <p className="m-0 text-small text-ink-2">
          <Trans>
            Personal, your own location, tracks the same from when the import runs. The menu shows
            what any of your locations tracks.
          </Trans>
        </p>
      </div>
    </div>
  );
}
