import { describe, expect, it } from 'vitest';
import type { WorkProject } from './portfolio.models';
import {
  foldWorkTitleAndDescription,
  portfolioWorkRowToProject,
  portfolioWorkToInsertRow,
  splitFoldedWorkText,
  type PortfolioWorkRow,
} from './portfolio-work.model';

function work(overrides: Partial<WorkProject> = {}): WorkProject {
  return {
    id: 'work-1',
    title: 'Ванная комната',
    description: '',
    beforeImage: 'https://example.com/before.jpg',
    afterImage: 'https://example.com/after.jpg',
    createdAt: '2026-08-23T00:00:00.000Z',
    verificationStatus: 'not_requested',
    ...overrides,
  };
}

function row(overrides: Partial<PortfolioWorkRow> = {}): PortfolioWorkRow {
  return {
    id: 'work-1',
    description: 'Ванная комната',
    before_image_url: 'https://example.com/before.jpg',
    after_image_url: 'https://example.com/after.jpg',
    created_at: '2026-08-23T00:00:00.000Z',
    ...overrides,
  };
}

describe('portfolio work title folding', () => {
  it('keeps a title with an empty body after save and reload', () => {
    const payload = portfolioWorkToInsertRow({
      ownerId: 'specialist-1',
      ownerType: 'worker',
      work: work({ title: 'Ванная комната', description: '' }),
    });

    expect(payload['description']).toBe('Ванная комната\n');

    const loaded = portfolioWorkRowToProject(
      row({ description: payload['description'] as string }),
    );
    expect(loaded.title).toBe('Ванная комната');
    expect(loaded.description).toBe('');
  });

  it('recovers legacy title-only rows stored as a single line', () => {
    const loaded = portfolioWorkRowToProject(row({ description: 'Кухня под ключ' }));
    expect(loaded.title).toBe('Кухня под ключ');
    expect(loaded.description).toBe('');
  });

  it('round-trips title and body', () => {
    const folded = foldWorkTitleAndDescription('Кухня', 'Плитка и электрика');
    expect(folded).toBe('Кухня\nПлитка и электрика');
    expect(splitFoldedWorkText(folded)).toEqual({
      title: 'Кухня',
      description: 'Плитка и электрика',
    });
  });

  it('stores finished works as a single album without before/after labels', () => {
    const payload = portfolioWorkToInsertRow({
      ownerId: 'specialist-1',
      ownerType: 'worker',
      work: work({
        title: 'Готовые работы',
        description: 'Плитка',
        kind: 'album',
        albumImages: [
          'https://example.com/a.jpg',
          'https://example.com/b.jpg',
        ],
        beforeImage: 'https://example.com/a.jpg',
        afterImage: 'https://example.com/a.jpg',
      }),
    });

    expect(payload['before_image_url']).toBe('https://example.com/a.jpg');
    expect(payload['after_image_url']).toBe('https://example.com/a.jpg');
    expect(String(payload['description'])).toContain('__MD_ALBUM__');

    const loaded = portfolioWorkRowToProject(
      row({
        description: payload['description'] as string,
        before_image_url: payload['before_image_url'] as string,
        after_image_url: payload['after_image_url'] as string,
      }),
    );
    expect(loaded.kind).toBe('album');
    expect(loaded.description).toBe('Плитка');
    expect(loaded.albumImages).toEqual([
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
    ]);
  });
});
