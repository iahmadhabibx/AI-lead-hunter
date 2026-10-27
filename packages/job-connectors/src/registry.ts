import type { JobSourceConfig } from '@aijh/contracts';
import { GreenhouseConnector } from './greenhouse';
import { LeverConnector } from './lever';
import type { FetchJson, JobConnector } from './types';

export type RegisteredSource = {
  config: JobSourceConfig;
  connector: JobConnector | null;
  /** Explicit unavailable/disabled without fabricating a live connector */
  unavailableReason?: string;
};

export function createConnectorRegistry(
  configs: JobSourceConfig[],
  opts?: { fetchJson?: FetchJson },
): RegisteredSource[] {
  return configs.map((config) => {
    if (!config.enabled) {
      return {
        config,
        connector: null,
        unavailableReason: 'disabled in configuration',
      };
    }

    if (config.type === 'greenhouse') {
      return {
        config,
        connector: new GreenhouseConnector(config, {
          fetchJson: opts?.fetchJson,
        }),
      };
    }

    if (config.type === 'lever') {
      return {
        config,
        connector: new LeverConnector(config, { fetchJson: opts?.fetchJson }),
      };
    }

    // Exhaustiveness guard — should be unreachable with Zod discriminated union
    return {
      config,
      connector: null,
      unavailableReason: 'unsupported provider',
    };
  });
}

export async function discoverAllPages(
  connector: JobConnector,
  signal?: AbortSignal,
): Promise<import('./types').RawSourceJob[]> {
  const all: import('./types').RawSourceJob[] = [];
  let cursor: import('./types').DiscoverCursor = null;
  let guard = 0;
  do {
    const page = await connector.discover({}, cursor, signal);
    all.push(...page.jobs);
    cursor = page.nextCursor;
    guard += 1;
    if (guard > 200) {
      throw new Error(
        `Pagination guard exceeded for source ${connector.sourceKey}`,
      );
    }
  } while (cursor);
  return all;
}
