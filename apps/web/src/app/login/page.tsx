'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent } from 'react';
import {
  Box,
  Field,
  Heading,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react';
import { BrandMark } from '@/components/layout/site-header';
import { AuthPanel, PageShell } from '@/components/layout/page-shell';
import { SlackButton } from '@/components/ui/slack-button';
import { useAuthStore } from '@/stores/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const pending = useAuthStore((s) => s.pending);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const clearError = useAuthStore((s) => s.clearError);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearError();
    const form = new FormData(e.currentTarget);
    try {
      await login(
        String(form.get('email') ?? ''),
        String(form.get('password') ?? ''),
      );
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
          Sign in
        </Heading>
        <Text color="fg.muted" mb="6">
          Continue to your private workspace.
        </Text>
        <form onSubmit={onSubmit}>
          <Stack gap="4">
            <Field.Root required>
              <Field.Label fontWeight="700">Email</Field.Label>
              <Input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={320}
                bg="bg.panel"
                borderColor="border.default"
                borderRadius="slack"
                _focusVisible={{ borderColor: 'slack.blue', boxShadow: '0 0 0 1px #1264A3' }}
              />
            </Field.Root>
            <Field.Root required>
              <Field.Label fontWeight="700">Password</Field.Label>
              <Input
                name="password"
                type="password"
                autoComplete="current-password"
                bg="bg.panel"
                borderColor="border.default"
                borderRadius="slack"
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
              {pending ? 'Signing in…' : 'Sign in'}
            </SlackButton>
          </Stack>
        </form>
        <Text color="fg.muted" fontSize="sm" mt="5">
          New here?{' '}
          <Text asChild color="fg.link" fontWeight="700" display="inline">
            <Link href="/register">Create an account</Link>
          </Text>
        </Text>
      </AuthPanel>
    </PageShell>
  );
}
