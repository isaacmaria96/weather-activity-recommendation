import { ApolloServer } from '@apollo/server';
import { expect } from 'chai';
import sinon from 'sinon';
import { createResolvers } from '../../../src/presentation/graphql/resolvers.js';
import { typeDefs } from '../../../src/presentation/graphql/schema.js';
import type { LocationSearchService } from '../../../src/application/location/location.service.js';
import { InvalidInputError } from '../../../src/shared/errors/application-errors.js';

describe('GraphQL searchLocations', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('returns candidates from the location service', async () => {
    const locationService: LocationSearchService = {
      search: sinon.stub().resolves([
        {
          id: 'loc_1',
          name: 'London',
          country: 'United Kingdom',
          countryCode: 'GB',
          region: 'England',
          latitude: 51.5,
          longitude: -0.12,
          timezone: 'Europe/London',
        },
      ]),
    };
    const server = createServer(locationService);

    const response = await server.executeOperation({
      query: `#graphql
        query Search($query: String!) {
          searchLocations(query: $query) {
            id
            name
            country
            countryCode
            region
            latitude
            longitude
            timezone
          }
        }
      `,
      variables: { query: 'London' },
    });

    expect(response.body.kind).to.equal('single');
    if (response.body.kind !== 'single') {
      throw new Error('Expected single GraphQL response');
    }
    expect(response.body.singleResult.errors).to.equal(undefined);
    expect(response.body.singleResult.data?.searchLocations).to.deep.equal([
      {
        id: 'loc_1',
        name: 'London',
        country: 'United Kingdom',
        countryCode: 'GB',
        region: 'England',
        latitude: 51.5,
        longitude: -0.12,
        timezone: 'Europe/London',
      },
    ]);
  });

  it('maps application errors to stable GraphQL codes', async () => {
    const locationService: LocationSearchService = {
      search: sinon.stub().rejects(new InvalidInputError('Too long')),
    };
    const server = createServer(locationService);

    const response = await server.executeOperation({
      query: `#graphql
        query Search {
          searchLocations(query: "too long") {
            id
          }
        }
      `,
    });

    expect(response.body.kind).to.equal('single');
    if (response.body.kind !== 'single') {
      throw new Error('Expected single GraphQL response');
    }
    expect(response.body.singleResult.errors?.[0]?.extensions?.code).to.equal(
      'INVALID_INPUT',
    );
  });

  function createServer(locationService: LocationSearchService) {
    return new ApolloServer({
      typeDefs,
      resolvers: createResolvers({ locationService }),
    });
  }
});
