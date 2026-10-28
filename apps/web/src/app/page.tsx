'use client';

import { Box, Heading, Stack, Text } from '@chakra-ui/react';
import { MarketingHeader } from '@/components/layout/site-header';
import { PageShell } from '@/components/layout/page-shell';
import { SlackButton } from '@/components/ui/slack-button';

export default function LandingPage() {
  return (
    <PageShell>
      <MarketingHeader />
      <Box
        as="section"
        aria-labelledby="hero-title"
        minH="calc(100vh - 5rem)"
        display="flex"
        alignItems="center"
        py={{ base: '10', md: '16' }}
      >
        <Stack gap="6" maxW="720px">
          <Text
            fontWeight="900"
            fontSize="sm"
            letterSpacing="0.08em"
            textTransform="uppercase"
            color="bg.brand"
          >
            ForgePath
          </Text>
          <Heading
            id="hero-title"
            as="h1"
            fontSize={{ base: '3xl', md: '5xl' }}
            lineHeight="1.05"
            letterSpacing="-0.03em"
            fontWeight="900"
            color="fg.default"
            maxW="14ch"
          >
            Find roles that fit the evidence on your CV.
          </Heading>
          <Text fontSize="lg" color="fg.muted" maxW="36rem">
            Upload your CV, review a structured profile, and match against
            permitted job sources with explanations — not invented hiring odds.
          </Text>
          <Stack direction={{ base: 'column', sm: 'row' }} gap="3" pt="2">
            <SlackButton href="/register" variant="primary" size="lg">
              Start free
            </SlackButton>
            <SlackButton href="/login" variant="secondary" size="lg">
              I already have an account
            </SlackButton>
          </Stack>
        </Stack>
      </Box>
    </PageShell>
  );
}
