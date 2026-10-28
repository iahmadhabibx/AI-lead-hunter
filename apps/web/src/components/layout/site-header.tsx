'use client';

import Link from 'next/link';
import { Box, Flex, HStack, Text } from '@chakra-ui/react';
import { SlackButton } from '@/components/ui/slack-button';

export function BrandMark({ href = '/' }: { href?: string }) {
  return (
    <Text
      asChild
      fontWeight="900"
      fontSize="20px"
      letterSpacing="-0.02em"
      color="bg.brand"
      _hover={{ color: 'bg.brand.hover' }}
    >
      <Link href={href}>ForgePath</Link>
    </Text>
  );
}

export function MarketingHeader() {
  return (
    <Flex as="header" align="center" justify="space-between" py="4">
      <BrandMark />
      <HStack gap="3">
        <SlackButton href="/login" variant="secondary">
          Sign in
        </SlackButton>
        <SlackButton href="/register" variant="primary">
          Create account
        </SlackButton>
      </HStack>
    </Flex>
  );
}

export function AppHeader({ right }: { right?: React.ReactNode }) {
  return (
    <Box
      as="header"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      bg="bg.panel"
      boxShadow="elevation.sm"
      mb="6"
      mx={{ base: '-4', md: '0' }}
    >
      <Flex
        align="center"
        justify="space-between"
        maxW="1120px"
        mx="auto"
        py="3"
        px={{ base: '4', md: '4' }}
      >
        <BrandMark href="/app" />
        <HStack gap="3">{right}</HStack>
      </Flex>
    </Box>
  );
}
