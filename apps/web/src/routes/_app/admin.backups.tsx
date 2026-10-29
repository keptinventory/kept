/**
 * Admin → Backups (D64, D66, D144, D181, D186, D193): how the
 * backups stand, where they go and their password (backup-target-form.tsx), Test and Run now, the
 * runs on the list standard (backup-runs.tsx, its filters in the URL) and the repository's
 * snapshots, read-only (snapshots-list.tsx). Inside the admin frame (admin.tsx), which says "For
 * instance admins" to anyone else; its chunk loads on demand from assets/household/
 * (vite.config.ts), and offline the frame's error screen says "Needs a connection".
 *
 * In the Home Assistant app (D272; `homeAssistant` on GET /admin/status, as Admin → Status reads)
 * Kept's own backups can't run: the serving process never holds the database owner's login, and the
 * server answers 409 `home_assistant_backups` to the target, Test and Run now. The page says so
 * and points at Home Assistant's backups instead, with no form, runs or snapshots.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useBackupSettings, useOpsStatus } from '@/api/ops/queries';
import type { BackupSettingsView, StatusPageData } from '@/api/ops/types';
import { BackupRuns } from '@/components/ops/backup-runs';
import {
  BackupForm,
  RunNowButton,
  TestButton,
  useTargetWords,
} from '@/components/ops/backup-target-form';
import { useSize } from '@/components/ops/ops-words';
import { SnapshotsList } from '@/components/ops/snapshots-list';
import { ErrorState, LoadingRows, Notice, Pill, Section } from '@/components/page';
import { Button } from '@/components/ui/button';
import { homeAssistantHref } from '@/lib/base-path';
import { useFormat } from '@/lib/format';
import { listSearch } from '@/lib/url-state';

export const Route = createFileRoute('/_app/admin/backups')({
  validateSearch: listSearch(['kind', 'status']),
  component: AdminBackupsPage,
});

/** "Last good backup 4 hours ago", the snapshots and the repository's size. */
function Headline({ status }: { status: StatusPageData | undefined }) {
  const f = useFormat();
  const size = useSize();
  const b = status?.backup;
  if (!b?.configured) return null;
  const lastGood = b.lastOk?.finishedAt ? f.relative(b.lastOk.finishedAt) : null;
  const repo = b.repositoryBytes !== null ? size(b.repositoryBytes) : null;
  const snapshots = b.snapshots !== null ? f.num(b.snapshots) : null;
  return (
    <div className="grid gap-0.5">
      <p className="m-0 font-semibold text-[17px]">
        {lastGood ? <Trans>Last good backup {lastGood}</Trans> : <Trans>No good backup yet</Trans>}
      </p>
      {repo || snapshots ? (
        <p className="m-0 text-small text-ink-2">
          {snapshots ? <Trans>{snapshots} snapshots</Trans> : null}
          {snapshots && repo ? f.sep : null}
          {repo ? <Trans>{repo} in the repository</Trans> : null}
        </p>
      ) : null}
    </div>
  );
}

/** The saved settings in a few lines, with Edit, Test and Run now. */
function Summary({
  view,
  https,
  onEdit,
}: {
  view: BackupSettingsView;
  https: boolean;
  onEdit: () => void;
}) {
  const f = useFormat();
  const words = useTargetWords();
  const target = view.target.value;
  const time = view.time.value;
  const daily = f.num(view.keep.daily.value);
  const weekly = f.num(view.keep.weekly.value);
  const monthly = f.num(view.keep.monthly.value);
  return (
    <div className="grid gap-3 rounded-[10px] border border-line bg-surface p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-[16px]">
          {target ? words.kind(target.kind) : <Trans>No target</Trans>}
        </span>
        <Pill tone={view.configured ? 'ok' : 'warn'}>
          {view.configured ? <Trans>Configured</Trans> : <Trans>Not configured</Trans>}
        </Pill>
        {view.target.locked ? (
          <Pill>
            <Trans>Set by the server's environment</Trans>
          </Pill>
        ) : null}
      </div>
      {target ? (
        <p className="m-0 text-ink-2 [overflow-wrap:anywhere]">
          <span className="ltr">{words.where(target)}</span>
          {target.kind === 's3' && target.secretAccessKeySet ? (
            <>
              {f.sep}
              <Trans>secret key saved</Trans>
            </>
          ) : null}
          {target.kind === 'sftp' && target.privateKeySet ? (
            <>
              {f.sep}
              <Trans>private key saved</Trans>
            </>
          ) : null}
        </p>
      ) : null}
      <p className="m-0 text-small text-ink-2">
        <Trans>
          Every night at <span className="tabular-nums">{time}</span> UTC, keeping {daily} daily,{' '}
          {weekly} weekly and {monthly} monthly snapshots.
        </Trans>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onPress={onEdit}>
          <Trans>Edit</Trans>
        </Button>
        <TestButton disabled={!https || !view.configured} />
        <RunNowButton disabled={!view.configured} />
      </div>
    </div>
  );
}

/** The app's backups are Home Assistant's: what they hold, and where to take or schedule one. Under
 * ingress, Home Assistant's backups page is a link in the top window; on Kept's own address the
 * words alone, since Home Assistant's address isn't known there. */
function HomeAssistantBackups() {
  const href = homeAssistantHref('/config/backup');
  const where = <Trans>Settings → System → Backups</Trans>;
  return (
    <Notice tone="info" title={<Trans>Home Assistant backs up Kept</Trans>}>
      <Trans>
        Home Assistant backs up Kept: the database, photos and files, and Kept's keys. Take or
        schedule backups in Home Assistant →{' '}
        {href ? (
          <a href={href} target="_top" className="underline underline-offset-2">
            {where}
          </a>
        ) : (
          where
        )}
        .
      </Trans>
    </Notice>
  );
}

function AdminBackupsPage() {
  const { t } = useLingui();
  const settings = useBackupSettings();
  const status = useOpsStatus();
  const [editing, setEditing] = useState(false);
  if (settings.isPending || status.isPending)
    return <LoadingRows rows={3} label={t`Loading backups`} />;
  if (status.data?.homeAssistant) return <HomeAssistantBackups />;
  if (settings.error)
    return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;
  const view = settings.data;
  const https = status.data?.https !== false;
  const showForm = editing || !view.configured;
  return (
    <div className="grid gap-5">
      <Headline status={status.data} />
      {!view.configured ? (
        <Notice tone="warn" title={<Trans>No backup configured</Trans>}>
          <Trans>
            Choose where backups go and a password. Kept then backs up the database, the files and a
            readable copy of every location every night, encrypted.
          </Trans>
        </Notice>
      ) : null}
      {status.data?.backup?.sameVolume ? (
        <Notice tone="warn" title={<Trans>Backups are on the same disk as your data</Trans>}>
          <Trans>
            If that disk fails, the backups go with it. Point the backup at another disk.
          </Trans>
        </Notice>
      ) : null}
      {!https && !showForm ? (
        <Notice tone="warn" title={<Trans>This page is on plain HTTP</Trans>}>
          <Trans>Backup settings and the recovery kit can only be changed over HTTPS.</Trans>
        </Notice>
      ) : null}
      {showForm ? (
        <Section title={<Trans>Settings</Trans>}>
          <BackupForm
            key={view.version}
            view={view}
            status={status.data}
            {...(view.configured ? { onDone: () => setEditing(false) } : {})}
          />
        </Section>
      ) : (
        <Summary view={view} https={https} onEdit={() => setEditing(true)} />
      )}
      {view.configured ? <SnapshotsList /> : null}
      <Section title={<Trans>Runs</Trans>}>
        <BackupRuns />
      </Section>
    </div>
  );
}
