/**
 * Home Assistant asks to connect (#376). In the Home Assistant app, the Kept integration offers
 * itself in Home Assistant and asks Kept for a token; the request waits here until someone signed
 * in approves it (New token's choices, in TokenCreateSheet's `link` mode) or declines it. The code
 * is the one Home Assistant shows, so the person approves the request they started. Nothing shows
 * outside the app, or when nothing is waiting.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isApiError } from '@/api/client';
import { connectionsApi, connectionsKeys, useHomeAssistantLinks } from '@/api/connections/queries';
import type { HomeAssistantLinkRequest } from '@/api/connections/types';
import { LinkIcon } from '@/components/icons';
import { IconTile, List, Row, Section, useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useOnline } from '@/lib/online';

/** The words for a request that ended (expired, decided, or Kept restarted). */
export function useLinkEndedText() {
  const { t } = useLingui();
  return t`This request has ended. Start again from Home Assistant.`;
}

export function HomeAssistantRequests({
  onConnect,
}: {
  onConnect: (request: HomeAssistantLinkRequest) => void;
}) {
  const { t } = useLingui();
  const qc = useQueryClient();
  const online = useOnline();
  const errorText = useErrorText();
  const ended = useLinkEndedText();
  const links = useHomeAssistantLinks();
  const decline = useMutation({
    mutationFn: (id: string) => connectionsApi.declineLink(id),
    onSuccess: () => toast({ title: t`Declined. Home Assistant gets nothing.` }),
    onError: (e) =>
      toast({
        title: isApiError(e) && e.code === 'not_found' ? ended : errorText(e),
        tone: 'danger',
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: connectionsKeys.homeAssistant }),
  });
  const items = links.data?.available ? links.data.items : [];
  if (items.length === 0) return null;
  return (
    <Section title={<Trans>Home Assistant</Trans>}>
      <List aria-label={t`Home Assistant`}>
        {items.map((request) => {
          const code = request.code;
          return (
            <li key={request.id}>
              <Row
                leading={
                  <IconTile>
                    <LinkIcon />
                  </IconTile>
                }
                title={<Trans>Home Assistant asks to connect</Trans>}
                subtitle={
                  <Trans>
                    Code <bdi dir="ltr">{code}</bdi>. Check that Home Assistant shows the same.
                  </Trans>
                }
              >
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="small" isDisabled={!online} onPress={() => onConnect(request)}>
                    <Trans>Allow</Trans>
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    isDisabled={!online}
                    isPending={decline.isPending && decline.variables === request.id}
                    onPress={() => decline.mutate(request.id)}
                  >
                    <Trans>Decline</Trans>
                  </Button>
                </div>
              </Row>
            </li>
          );
        })}
      </List>
    </Section>
  );
}
