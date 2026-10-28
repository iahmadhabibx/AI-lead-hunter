'use client';

import { Box, Container } from '@chakra-ui/react';

export function PageShell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Box minH="100vh" bg="bg.canvas">
      <Container maxW={wide ? '1120px' : '1120px'} px={{ base: '4', md: '6' }} pb="16">
        {children}
      </Container>
    </Box>
  );
}

export function AuthPanel({ children }: { children: React.ReactNode }) {
  return (
    <Box
      maxW="440px"
      w="100%"
      mx="auto"
      mt={{ base: '8', md: '12' }}
      p={{ base: '6', md: '8' }}
      bg="bg.panel"
      borderRadius="slackLg"
      boxShadow="elevation.md"
      borderWidth="1px"
      borderColor="border.subtle"
    >
      {children}
    </Box>
  );
}
