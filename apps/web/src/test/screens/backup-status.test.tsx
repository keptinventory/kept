/**
 * Admin → Status's step-8 tiles (frames 107, 108) on the ops mock's
 * scenarios: each warning state, the fix each links to, the update line and the update check's
 * wording, in English and Arabic.
 */
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ownerScenario } from '@/api/mock/fixtures';
import { ops, setOpsScenario } from '@/api/ops/mock/state';
import type { UpdateCheckError } from '@/api/ops/types';
import { renderApp } from '@/test/app';
import { expectLogicalOnly } from '@/test/render';

const DAY = 86_400_000;

describe('Admin → Status: backups and operations', () => {
  it('shows each tile with its warning, and links each warning to its fix', async () => {
    await renderApp('/admin/status');
    expect(await screen.findByText('Last good backup 4 hours ago')).toBeInTheDocument();
    expect(screen.getByText('2.1 GB in the repository')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Open Backups' })[0]).toHaveAttribute(
      'href',
      '/admin/backups',
    );
    expect(screen.getByText('Last drill 41 days ago')).toBeInTheDocument();
    expect(screen.getByText('Checked 5 days ago')).toBeInTheDocument();
    expect(screen.getByText('File bucket versioning')).toBeInTheDocument();
    expect(screen.getByText(/only come back if the bucket keeps versions/)).toBeInTheDocument();
    expect(screen.getByText(/88% full/)).toBeInTheDocument();
    expect(screen.getByText('2 in the last day')).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('link', { name: 'Failed jobs' })
        .every((a) => a.getAttribute('href') === '/admin/jobs'),
    ).toBe(true);
    expect(screen.getByText(/Database at migration/)).toBeInTheDocument();
    // The update line, and the tile.
    expect(screen.getAllByText(/is available/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('link', { name: "What's new" })).toHaveAttribute(
      'href',
      'https://example.org/kept/releases/1.3.0',
    );
    expect(screen.getByRole('button', { name: 'Check now' })).toBeInTheDocument();
  });

  it('says what the last run’s trouble was, in words', async () => {
    const state = ownerScenario();
    ops(state).runs.shift();
    await renderApp('/admin/status', { state });
    expect(await screen.findByText(/much smaller than the last good one/)).toBeInTheDocument();
  });

  it('says loudly that nothing is backed up', async () => {
    const state = ownerScenario();
    setOpsScenario(state, 'unconfigured');
    await renderApp('/admin/status', { state });
    expect((await screen.findAllByText('No backup configured')).length).toBe(2);
    expect(screen.getAllByRole('link', { name: 'Set up backups' })[0]).toHaveAttribute(
      'href',
      '/admin/backups',
    );
    expect(screen.queryByText('File bucket versioning')).not.toBeInTheDocument();
  });

  describe('in the Home Assistant app', () => {
    const appState = () => {
      const state = ownerScenario();
      setOpsScenario(state, 'unconfigured');
      state.admin.status.homeAssistant = true;
      // A database an earlier app version upgraded without Kept's own snapshot.
      ops(state).status.backup.upgradeWithoutSnapshot = {
        fromVersion: '1.14.2',
        toVersion: '1.14.3',
        at: new Date(Date.now() - DAY).toISOString(),
      };
      return state;
    };
    afterEach(() => {
      document.head.querySelector('meta[name="kept-ingress"]')?.remove();
    });

    it('says Home Assistant backs up Kept, and warns of no missing backup', async () => {
      await renderApp('/admin/status', { state: appState() });
      expect(await screen.findByText('Home Assistant backs up Kept')).toBeInTheDocument();
      expect(screen.queryByText('No backup configured')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Set up backups' })).not.toBeInTheDocument();
      expect(screen.queryByText(/without a backup/)).not.toBeInTheDocument();
      // Kept's own restic checks don't run in the app.
      expect(screen.queryByText('Restore drill')).not.toBeInTheDocument();
      expect(screen.queryByText('Repository check')).not.toBeInTheDocument();
      // On Kept's own address: the words, no link.
      expect(
        screen.getByText(/in Home Assistant → Settings → System → Backups/),
      ).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Settings → System → Backups' })).toBeNull();
    });

    it('links to Home Assistant’s backups in the top window from the sidebar', async () => {
      const meta = document.createElement('meta');
      meta.name = 'kept-ingress';
      meta.content = '1';
      document.head.append(meta);
      await renderApp('/admin/status', { state: appState() });
      const link = await screen.findByRole('link', { name: 'Settings → System → Backups' });
      expect(link).toHaveAttribute('href', `${window.location.origin}/config/backup`);
      expect(link).toHaveAttribute('target', '_top');
    });
  });

  it('warns when the backups are on the data’s disk', async () => {
    const state = ownerScenario();
    setOpsScenario(state, 'dir_same_disk');
    await renderApp('/admin/status', { state });
    expect(
      await screen.findByText('Backups are on the same disk as your data'),
    ).toBeInTheDocument();
  });

  it('says how old the last good backup is once it is stale', async () => {
    const state = ownerScenario();
    const old = new Date(Date.now() - 3 * DAY).toISOString();
    for (const r of ops(state).runs) {
      if (r.kind === 'manual' || r.kind === 'nightly') {
        r.finishedAt = old;
        r.startedAt = old;
        r.status = 'ok';
        r.error = null;
      }
    }
    await renderApp('/admin/status', { state });
    expect((await screen.findAllByText('Last good backup 3 days ago')).length).toBe(2);
    expect(screen.getByText(/Backups should run every night/)).toBeInTheDocument();
  });

  it('names a rollback and an upgrade without a snapshot', async () => {
    const state = ownerScenario();
    ops(state).status.release.rolledBackFrom = '1.3.0';
    ops(state).status.backup.upgradeWithoutSnapshot = {
      fromVersion: '1.1.0',
      toVersion: '1.2.0',
      at: new Date().toISOString(),
    };
    await renderApp('/admin/status', { state });
    expect(
      await screen.findByText(/Running an older release on a database from/),
    ).toBeInTheDocument();
    expect(screen.getByText(/without a backup/)).toBeInTheDocument();
  });

  it.each([
    ['not_github', "Can't check this build"],
    ['bad_response', "Couldn't read the answer"],
    ['not_found', 'No releases found'],
    ['unreachable', "Couldn't reach GitHub"],
    ['rate_limited', "GitHub's limit reached"],
  ] as [UpdateCheckError, string][])('words the update check’s %s', async (error, words) => {
    const state = ownerScenario();
    ops(state).updates = { ...ops(state).updates, latest: null, error };
    await renderApp('/admin/status', { state });
    expect(await screen.findByText(words)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: "What's new" })).not.toBeInTheDocument();
  });

  it('says when the update check is off, and where to turn it on', async () => {
    const state = ownerScenario();
    ops(state).updates = { ...ops(state).updates, enabled: false, latest: null };
    await renderApp('/admin/status', { state });
    expect(await screen.findByText(/Kept doesn't ask for new versions/)).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('link', { name: 'Settings' })
        .some((a) => a.getAttribute('href') === '/admin/settings'),
    ).toBe(true);
  });

  it('shows what it has when the database didn’t answer (no operations fields)', async () => {
    const state = ownerScenario();
    ops(state).serveStatus = false;
    await renderApp('/admin/status', { state });
    expect(await screen.findByText('Version')).toBeInTheDocument();
    expect(screen.queryByText('Restore drill')).not.toBeInTheDocument();
  });

  it('renders right to left in Arabic', async () => {
    await renderApp('/admin/status', { locale: 'ar' });
    await screen.findAllByText(/٨٨/);
    expect(document.documentElement.dir).toBe('rtl');
    expectLogicalOnly();
  });
});
