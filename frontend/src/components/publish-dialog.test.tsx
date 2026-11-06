// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishDialog } from './publish-dialog';
import { ApiError } from '../lib/api';
import type { Site } from '../lib/browser-types';

const people = [{ _id: 'p1', name: 'First publisher', createdAt: '' }, { _id: 'p2', name: 'Second publisher', createdAt: '' }];
const site: Site = { _id: 's', address: 'new.zz', title: 'New page', html: ' <p>Original</p> ', authorId: 'p2', createdAt: '', updatedAt: '' };
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(cleanup);
function fill(address = ' NEW.ZZ ', html = site.html) {
  fireEvent.change(screen.getByLabelText('Publisher'), { target: { value: 'p2' } });
  fireEvent.change(screen.getByLabelText('Website address'), { target: { value: address } });
  fireEvent.change(screen.getByLabelText('Website title'), { target: { value: ' New page ' } });
  fireEvent.change(screen.getByLabelText('HTML content'), { target: { value: html } });
}
describe('Publishing dialog', () => {
  it('publishes normalized metadata with exact HTML and a separate publisher, then opens the result', async () => {
    const publish = vi.fn(async () => site), onPublished = vi.fn(), onOpenSite = vi.fn();
    render(<PublishDialog open people={people} publish={publish} onClose={vi.fn()} onPublished={onPublished} onOpenSite={onOpenSite} />);
    fill(); fireEvent.click(screen.getByRole('button', { name: 'Publish website' }));
    await screen.findByText('Website published');
    expect(publish).toHaveBeenCalledExactlyOnceWith({ address: 'new.zz', title: 'New page', html: site.html, authorId: 'p2' }, expect.any(AbortSignal));
    expect(onPublished).toHaveBeenCalledExactlyOnceWith(site);
    await userEvent.click(screen.getByRole('button', { name: 'Open published site' }));
    expect(onOpenSite).toHaveBeenCalledExactlyOnceWith('new.zz');
  });
  it('blocks duplicate submissions and closing while the request is in flight', async () => {
    let finish!: (value: Site) => void;
    const publish = vi.fn(() => new Promise<Site>((resolve) => { finish = resolve; }));
    const onClose = vi.fn();
    render(<PublishDialog open people={people} publish={publish} onClose={onClose} onPublished={vi.fn()} onOpenSite={vi.fn()} />);
    fill(); const button = screen.getByRole('button', { name: 'Publish website' });
    fireEvent.click(button); fireEvent.click(button);
    fireEvent.submit(button.closest('form')!);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(publish).toHaveBeenCalledTimes(1); expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('HTML content').hasAttribute('disabled') || screen.getByLabelText('HTML content').closest('fieldset')?.disabled).toBeTruthy();
    finish(site); await screen.findByText('Website published');
  });
  it.each([[409, 'already published'], [404, 'no longer exists'], [413, 'too large'], [400, 'rejected'], [503, 'could not be confirmed']])('preserves the draft after HTTP %s', async (status, message) => {
    render(<PublishDialog open people={people} publish={vi.fn(async () => { throw new ApiError(status, 'failed'); })} onClose={vi.fn()} onPublished={vi.fn()} onOpenSite={vi.fn()} />);
    fill(); fireEvent.click(screen.getByRole('button', { name: 'Publish website' }));
    expect((await screen.findByRole('alert')).textContent).toContain(message);
    expect((screen.getByLabelText('HTML content') as HTMLTextAreaElement).value).toBe(site.html);
    expect((screen.getByLabelText('Website address') as HTMLInputElement).value).toBe(' NEW.ZZ ');
  });
  it('rejects unsafe addresses and whitespace-only HTML without a request', async () => {
    const publish = vi.fn(async () => site);
    render(<PublishDialog open people={people} publish={publish} onClose={vi.fn()} onPublished={vi.fn()} onOpenSite={vi.fn()} />);
    fill('javascript:alert(1)'); fireEvent.click(screen.getByRole('button', { name: 'Publish website' }));
    expect((await screen.findByRole('alert')).textContent).toContain('valid .zz address');
    fill('valid.zz', '   '); fireEvent.click(screen.getByRole('button', { name: 'Publish website' }));
    expect(screen.getByRole('alert').textContent).toContain('Enter HTML'); expect(publish).not.toHaveBeenCalled();
  });
});
