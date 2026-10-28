'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent } from 'react';
import { Box, Field, Heading, Input, Stack, Text } from '@chakra-ui/react';
import { BrandMark } from '@/components/layout/site-header';
import { AuthPanel, PageShell } from '@/components/layout/page-shell';
import { SlackButton } from '@/components/ui/slack-button';
import { useAuthStore } from '@/stores/auth-store';

export default function RegisterPage() {
  const router = useRouter();
  const pending = useAuthStore((s) => s.pending);
  const error = useAuthStore((s) => s.error);
  const register = useAuthStore((s) => s.register);
  const clearError = useAuthStore((s) => s.clearError);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearError();
    const form = new FormData(e.currentTarget);
    try {
      await register({
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
        displayName: String(form.get('displayName') ?? '') || undefined,
      });
      router.push('/app');
    } catch {
      // error stored in auth store
    }
  }

  return (
    <PageShell>
      <Box py="4">
        <BrandMark />
      </Box>
      <AuthPanel>
        <Heading as="h1" size="xl" fontWeight="900" mb="1">
          Create your account
        </Heading>
        <Text color="fg.muted" mb="6">
          Private by default. You control exports and deletion.
        </Text>
        <form onSubmit={onSubmit}>
          <Stack gap="4">
            <Field.Root>
              <Field.Label fontWeight="700">Display name</Field.Label>
              <Input
                name="displayName"
                autoComplete="name"
                maxLength={120}
                borderRadius="slack"
                borderColor="border.default"
                _focusVisible={{ borderColor: 'slack.blue', boxShadow: '0 0 0 1px #1264A3' }}
              />
            </Field.Root>
            <Field.Root required>
              <Field.Label fontWeight="700">Email</Field.Label>
              <Input
                name="email"
                type="email"
                required
                autoComplete="email"
                maxLength={320}
                borderRadius="slack"
                borderColor="border.default"
                _focusVisible={{ borderColor: 'slack.blue', boxShadow: '0 0 0 1px #1264A3' }}
              />
            </Field.Root>
            <Field.Root required>
              <Field.Label fontWeight="700">Password</Field.Label>
              <Input
                name="password"
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                borderRadius="slack"
                borderColor="border.default"
                _focusVisible={{ borderColor: 'slack.blue', boxShadow: '0 0 0 1px #1264A3' }}
              />
            </Field.Root>
            {error ? (
              <Box
                role="alert"
                bg="rgba(224, 30, 90, 0.08)"
                borderWidth="1px"
                borderColor="rgba(224, 30, 90, 0.25)"
                color="fg.danger"
                borderRadius="slack"
                px="3"
                py="2"
                fontSize="sm"
                fontWeight="700"
              >
                {error}
              </Box>
            ) : null}
            <SlackButton type="submit" variant="primary" disabled={pending} w="100%">
              {pending ? 'Creating…' : 'Create account'}
            </SlackButton>
          </Stack>
        </form>
        <Text color="fg.muted" fontSize="sm" mt="5">
          Already registered?{' '}
          <Text asChild color="fg.link" fontWeight="700" display="inline">
            <Link href="/login">Sign in</Link>
          </Text>
        </Text>
      </AuthPanel>
    </PageShell>
  );
}
