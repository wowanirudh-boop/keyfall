import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { motion } from './tokens';
import { UpdateNotice } from './UpdateNotice';

describe('UpdateNotice', () => {
  it('[T10a AC1, AC4] reloads only when the learner chooses Reload', () => {
    const onDismiss = vi.fn();
    const onReload = vi.fn();
    render(<UpdateNotice onDismiss={onDismiss} onReload={onReload} />);

    expect(onReload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    expect(onReload).toHaveBeenCalledOnce();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('[T10a AC2] dismisses only on request and never on a timer', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<UpdateNotice onDismiss={onDismiss} onReload={() => undefined} />);

    act(() => vi.advanceTimersByTime(motion.noticeMs * 10));
    expect(screen.getByText('A new version is ready.')).toBeTruthy();
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss update notice' }));
    expect(onDismiss).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('[T10a AC6] stays inset at the top so it cannot cover the player transport', () => {
    render(<UpdateNotice onDismiss={() => undefined} onReload={() => undefined} />);

    const notice = screen.getByTestId('update-notice');
    expect(notice.className).toContain('inset-x-[12px]');
    expect(notice.className).toContain('top-[12px]');
    expect(notice.className).toContain('max-w-[520px]');
  });
});
