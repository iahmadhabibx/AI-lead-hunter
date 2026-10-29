'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Text } from '@chakra-ui/react';
import { PageShell } from '@/components/layout/page-shell';

/** Matches live on the main workspace now — keep this route as a redirect. */
export default function MatchesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/app');
  }, [router]);

  return (
    <PageShell>
      <Text color="fg.muted" py="10">
        Opening your job matches…
      </Text>
    </PageShell>
  );
}
