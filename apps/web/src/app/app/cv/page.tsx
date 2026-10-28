'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect } from 'react';
import {
  Box,
  Field,
  Heading,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react';
import { AppHeader } from '@/components/layout/site-header';
import { PageShell } from '@/components/layout/page-shell';
import { SlackButton } from '@/components/ui/slack-button';
import { useAuthStore } from '@/stores/auth-store';
import { useCvStore } from '@/stores/cv-store';

export default function CvUploadPage() {
  const router = useRouter();
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const task = useCvStore((s) => s.task);
  const doc = useCvStore((s) => s.doc);
  const pending = useCvStore((s) => s.pending);
  const error = useCvStore((s) => s.error);
  const upload = useCvStore((s) => s.upload);
  const refreshStatus = useCvStore((s) => s.refreshStatus);
  const clearError = useCvStore((s) => s.clearError);
  const setError = useCvStore((s) => s.setError);

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

  useEffect(() => {
    if (!task || task.status === 'succeeded' || task.status === 'failed') return;
    const handle = setInterval(async () => {
      try {
        await refreshStatus();
      } catch {
        clearInterval(handle);
      }
    }, 1000);
    return () => clearInterval(handle);
  }, [task, refreshStatus]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearError();
    const form = new FormData(e.currentTarget);
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setError('Choose a PDF or DOCX file');
      return;
    }
    try {
      await upload(file);
    } catch {
      // error stored in cv store
    }
  }

  const done = task?.status === 'succeeded';
  const failed = task?.status === 'failed' || doc?.status === 'failed';

  return (
    <PageShell>
      <AppHeader
        right={
          <SlackButton href="/app/profile" variant="secondary">
            Profile
          </SlackButton>
        }
      />
      <Heading as="h1" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="900" mb="1">
        Upload your CV
      </Heading>
      <Text color="fg.muted" mb="6">
        PDF or DOCX only. Content is validated server-side.
      </Text>

      <Box
        bg="bg.panel"
        borderRadius="slackLg"
        boxShadow="elevation.md"
        borderWidth="1px"
        borderColor="border.subtle"
        p={{ base: '5', md: '6' }}
        maxW="520px"
        mb="6"
      >
        <form onSubmit={onSubmit}>
          <Stack gap="4">
            <Field.Root required>
              <Field.Label fontWeight="700">CV file</Field.Label>
              <Input
                name="file"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                required
                disabled={pending}
                borderRadius="slack"
                borderColor="border.default"
                p="2"
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
            <SlackButton type="submit" variant="primary" disabled={pending}>
              {pending ? 'Uploading…' : 'Upload and process'}
            </SlackButton>
          </Stack>
        </form>
      </Box>

      {task ? (
        <Box
          aria-live="polite"
          bg="bg.panel"
          borderRadius="slackLg"
          boxShadow="elevation.sm"
          borderWidth="1px"
          borderColor="border.subtle"
          p="5"
          maxW="520px"
        >
          <Text mb="2">
            Document:{' '}
            <Text as="span" fontWeight="700">
              {doc?.originalFilename ?? '—'}
            </Text>
          </Text>
          <Text mb="3">
            Processing status:{' '}
            <Text as="span" fontWeight="700" color="bg.brand">
              {task.status}
            </Text>
            {doc ? ` (file: ${doc.status})` : null}
          </Text>
          {failed ? (
            <Box
              role="alert"
              bg="rgba(224, 30, 90, 0.08)"
              color="fg.danger"
              borderRadius="slack"
              px="3"
              py="2"
              fontWeight="700"
              mb="3"
            >
              {task.errorMessage || doc?.errorMessage || 'Processing failed'}
            </Box>
          ) : null}
          {done ? (
            <Box
              bg="rgba(46, 182, 125, 0.12)"
              color="fg.success"
              borderRadius="slack"
              px="3"
              py="2"
              fontWeight="700"
            >
              Extraction complete.{' '}
              <SlackButton href="/app/profile" variant="ghost" size="sm" px="1">
                Review your profile
              </SlackButton>
            </Box>
          ) : null}
          {!done && !failed ? (
            <Text color="fg.muted">Extracting and structuring your CV…</Text>
          ) : null}
        </Box>
      ) : null}
    </PageShell>
  );
}
