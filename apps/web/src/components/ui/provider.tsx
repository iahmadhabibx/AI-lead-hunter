'use client';

import { ChakraProvider } from '@chakra-ui/react';
import { slackSystem } from '@/theme/slack-system';

export function UiProvider({ children }: { children: React.ReactNode }) {
  return <ChakraProvider value={slackSystem}>{children}</ChakraProvider>;
}
