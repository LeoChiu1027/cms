import { EntityManager, EntityClass } from '@mikro-orm/core';

interface DbMatcherQuery<T> {
  entity: EntityClass<T>;
  id?: string;
  where?: Record<string, unknown>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toExistInDb(em: EntityManager): Promise<R>;
      toNotExistInDb(em: EntityManager): Promise<R>;
      toMatchInDb<T>(em: EntityManager, expected: Partial<T>): Promise<R>;
    }
  }
}

expect.extend({
  async toExistInDb<T extends object>(
    received: DbMatcherQuery<T>,
    em: EntityManager,
  ) {
    const { entity, id, where } = received;
    const query = id ? { id } : where;

    if (!query) {
      return {
        pass: false,
        message: () => 'Either "id" or "where" must be provided',
      };
    }

    em.clear();
    const record = await em.findOne(entity, query as never);

    if (record) {
      return {
        pass: true,
        message: () =>
          `Expected ${entity.name} not to exist in database, but it was found`,
      };
    } else {
      return {
        pass: false,
        message: () =>
          `Expected ${entity.name} to exist in database with ${JSON.stringify(query)}, but it was not found`,
      };
    }
  },

  async toNotExistInDb<T extends object>(
    received: DbMatcherQuery<T>,
    em: EntityManager,
  ) {
    const { entity, id, where } = received;
    const query = id ? { id } : where;

    if (!query) {
      return {
        pass: false,
        message: () => 'Either "id" or "where" must be provided',
      };
    }

    em.clear();
    const record = await em.findOne(entity, query as never);

    if (!record) {
      return {
        pass: true,
        message: () =>
          `Expected ${entity.name} to exist in database, but it was not found`,
      };
    } else {
      return {
        pass: false,
        message: () =>
          `Expected ${entity.name} not to exist in database with ${JSON.stringify(query)}, but it was found`,
      };
    }
  },

  async toMatchInDb<T extends object>(
    received: DbMatcherQuery<T>,
    em: EntityManager,
    expected: Partial<T>,
  ) {
    const { entity, id, where } = received;
    const query = id ? { id } : where;

    if (!query) {
      return {
        pass: false,
        message: () => 'Either "id" or "where" must be provided',
      };
    }

    em.clear();
    const record = await em.findOne(entity, query as never);

    if (!record) {
      return {
        pass: false,
        message: () =>
          `Expected ${entity.name} to exist in database with ${JSON.stringify(query)}, but it was not found`,
      };
    }

    const mismatches: string[] = [];
    for (const [key, expectedValue] of Object.entries(expected)) {
      const actualValue = (record as Record<string, unknown>)[key];

      // Handle Jest asymmetric matchers (expect.any(), expect.stringMatching(), etc.)
      if (
        expectedValue &&
        typeof expectedValue === 'object' &&
        'asymmetricMatch' in expectedValue
      ) {
        const matcher = expectedValue as {
          asymmetricMatch: (v: unknown) => boolean;
        };
        if (!matcher.asymmetricMatch(actualValue)) {
          mismatches.push(
            `  ${key}: expected to match asymmetric matcher, got ${JSON.stringify(actualValue)}`,
          );
        }
      } else if (typeof expectedValue === 'object' && expectedValue !== null) {
        // Deep equality for objects/arrays (like JSONB fields)
        if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
          mismatches.push(
            `  ${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`,
          );
        }
      } else if (actualValue !== expectedValue) {
        mismatches.push(
          `  ${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`,
        );
      }
    }

    if (mismatches.length === 0) {
      return {
        pass: true,
        message: () =>
          `Expected ${entity.name} not to match, but all fields matched`,
      };
    } else {
      return {
        pass: false,
        message: () =>
          `Expected ${entity.name} to match in database:\n${mismatches.join('\n')}`,
      };
    }
  },
});

export { };
