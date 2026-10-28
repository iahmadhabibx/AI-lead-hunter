'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Box, Heading, Stack, Text } from '@chakra-ui/react';
import { AppHeader } from '@/components/layout/site-header';
import { PageShell } from '@/components/layout/page-shell';
import { SlackButton } from '@/components/ui/slack-button';
import { useAuthStore } from '@/stores/auth-store';

export default function AppHomePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await fetchMe();
      if (!cancelled && !me) router.replace('/login');
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchMe, router]);

  async function onLogout() {
    try {
      await logout();
      router.push('/');
    } catch {
      // error stored in auth store
    }
  }

  if (status === 'idle' || status === 'loading') {
    return (
      <PageShell>
        <Text color="fg.muted" py="10">
          Loading your workspace…
        </Text>
      </PageShell>
    );
  }

  if (!user) return null;

  return (
    <PageShell>
      <AppHeader
        right={
          <SlackButton variant="secondary" type="button" onClick={onLogout}>
            Sign out
          </SlackButton>
        }
      />
      <Heading as="h1" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="900" mb="1">
        Welcome{user.displayName ? `, ${user.displayName}` : ''}
      </Heading>
      <Text color="fg.muted" mb="6">
        Signed in as {user.email}
      </Text>
      {error ? (
        <Box
          role="alert"
          mb="4"
          bg="rgba(224, 30, 90, 0.08)"
          borderWidth="1px"
          borderColor="rgba(224, 30, 90, 0.25)"
          color="fg.danger"
          borderRadius="slack"
          px="3"
          py="2"
          fontWeight="700"
        >
          {error}
        </Box>
      ) : null}
      <Stack direction={{ base: 'column', sm: 'row' }} gap="3" mb="8">
        <SlackButton href="/app/cv" variant="primary">
          Upload CV
        </SlackButton>
        <SlackButton href="/app/profile" variant="secondary">
          Review profile
        </SlackButton>
      </Stack>
      <Box
        borderWidth="1px"
        borderStyle="dashed"
        borderColor="border.default"
        borderRadius="slackLg"
        bg="bg.panel"
        boxShadow="elevation.sm"
        p="5"
        color="fg.muted"
      >
        Complete your CV profile to unlock matching against permitted job
        sources. Match scores are suitability weights — not hiring predictions.
      </Box>
    </PageShell>
  );
}
