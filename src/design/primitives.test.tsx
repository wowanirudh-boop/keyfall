import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppHeader } from './AppHeader';
import { ErrorPanel, GhostButton, Modal, MonoLabel, StatusBanner, TogglePill } from './primitives';

describe('design foundation components', () => {
  it('renders the handoff header typography and cyan mark', () => {
    const { container } = render(<AppHeader />);

    expect(screen.getByText('Piano Practice Player').className).toContain('text-title');
    expect(screen.getByText('LOCAL LIBRARY · NO ACCOUNT').className).toContain('font-mono');
    expect(container.querySelector('[aria-hidden="true"]')?.className).toContain('bg-hand-right');
  });

  it('styles the ghost button from the section 4 contract', () => {
    render(<GhostButton>Back</GhostButton>);

    const button = screen.getByRole('button', { name: 'Back' });
    expect(button.className).toContain('border-border-3');
    expect(button.className).toContain('text-small');
    expect(button.className).toContain('text-secondary');
    expect(button.className).toContain('hover:border-border-5');
    expect(button.className).toContain('hover:text-text');
  });

  it('styles both toggle pill states from the section 4 contract', () => {
    const { rerender } = render(<TogglePill on={false}>Audio</TogglePill>);

    let button = screen.getByRole('button', { name: 'Audio' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.className).toContain('border-border-3');
    expect(button.className).toContain('px-[11px]');
    expect(button.className).toContain('py-[7px]');

    rerender(<TogglePill on>Audio</TogglePill>);
    button = screen.getByRole('button', { name: 'Audio' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.className).toContain('border-hand-right');
    expect(button.className).toContain('bg-hand-right-toggle-on-bg');
    expect(button.className).toContain('text-hand-right');
  });

  it('renders the remaining four styled primitives accessibly', () => {
    render(
      <>
        <StatusBanner>Offline</StatusBanner>
        <MonoLabel>Metadata</MonoLabel>
        <ErrorPanel>Invalid file</ErrorPanel>
        <Modal title="Listen mode">Choose a device</Modal>
      </>,
    );

    expect(screen.getByRole('status').className).toContain('bg-amber-bg');
    expect(screen.getByText('Metadata').className).toContain('font-mono');
    expect(screen.getByRole('alert').className).toContain('bg-error-bg');
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
  });
});
