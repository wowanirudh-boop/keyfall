import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from './App';

function renderRoute(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('application routes', () => {
  it('renders the Home route', () => {
    renderRoute('/');

    expect(screen.getByText('Piano Practice Player')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Search catalog' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'My pieces' })).toBeTruthy();
  });

  it('renders the missing-library state for an unknown piece', async () => {
    renderRoute('/pieces/anything');

    expect(
      await screen.findByRole('heading', { name: 'This piece is not in My pieces.' }),
    ).toBeTruthy();
  });

  it('renders the report route shell with its route parameter', () => {
    renderRoute('/reports/attempt-42');

    expect(screen.getByText('Report')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Attempt attempt-42' })).toBeTruthy();
  });

  it('renders not-found for an unknown route', () => {
    renderRoute('/missing');

    expect(screen.getByText('Not found')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'This page does not exist.' })).toBeTruthy();
  });
});
