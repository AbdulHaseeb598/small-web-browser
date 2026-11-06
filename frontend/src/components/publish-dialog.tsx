'use client';
import { useEffect, useRef, useState } from 'react';
import { ApiError, publishSite } from '../lib/api';
import { normalizeAddress } from '../lib/address';
import type { Person, Publication, Site } from '../lib/browser-types';

type Props = {
  open: boolean;
  people: Person[];
  onClose: () => void;
  onPublished: (site: Site) => void;
  onOpenSite: (address: string) => void;
  publish?: (input: Publication, signal?: AbortSignal) => Promise<Site>;
};
export function PublishDialog({ open, people, onClose, onPublished, onOpenSite, publish = publishSite }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submission = useRef<AbortController | null>(null);
  const [authorId, setAuthorId] = useState(people[0]?._id ?? '');
  const [address, setAddress] = useState('');
  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Site | null>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  useEffect(() => () => submission.current?.abort(), []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submission.current || created) return;
    const normalized = normalizeAddress(address);
    if (!normalized) { setError('Enter a valid .zz address, without a URL scheme or path.'); return; }
    if (!title.trim() || title.trim().length > 200) { setError('Enter a title between 1 and 200 characters.'); return; }
    if (!html.trim() || html.length > 100000) { setError('Enter HTML between 1 and 100,000 characters.'); return; }
    if (!people.some((person) => person._id === authorId)) { setError('Select an existing publisher.'); return; }
    const abort = new AbortController();
    submission.current = abort;
    setPending(true); setError('');
    try {
      const site = await publish({ address: normalized, title: title.trim(), html, authorId }, abort.signal);
      if (abort.signal.aborted) return;
      setCreated(site); onPublished(site);
    } catch (failure) {
      if (abort.signal.aborted) return;
      const status = failure instanceof ApiError ? failure.status : 0;
      setError(status === 409 ? 'That address is already published. Choose another .zz address.'
        : status === 404 ? 'This publisher no longer exists. Choose another publisher.'
        : status === 413 ? 'The request is too large. Reduce the HTML size; the API accepts at most 100 KiB of JSON.'
        : status === 400 ? 'The publication was rejected. Check the address, title, HTML, and publisher.'
        : 'Publishing could not be confirmed. Your draft is preserved. Check the address before retrying in case the server saved it.');
    } finally {
      if (!abort.signal.aborted) { submission.current = null; setPending(false); }
    }
  }
  return <dialog ref={dialog} className="publish-dialog" aria-labelledby="publish-heading" aria-describedby="publish-description" onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}>
    <div className="publish-heading"><h2 id="publish-heading">Publish a website</h2><button type="button" className="secondary-button" disabled={pending} onClick={onClose} aria-label="Close publishing form">Close</button></div>
    <p id="publish-description">Add a page to the fictional web. The publisher is independent of your browsing identity.</p>
    {created ? <div className="publication-success" role="status"><h3>Website published</h3><p><strong>{created.title}</strong> is available at <code>{created.address}</code>.</p><div className="publish-actions"><button className="primary-button" onClick={() => onOpenSite(created.address)}>Open published site</button><button className="secondary-button" onClick={() => { setCreated(null); setAddress(''); setTitle(''); setHtml(''); }}>Publish another</button></div></div> : <form onSubmit={(event) => void submit(event)} aria-busy={pending}>
      <fieldset disabled={pending}>
        <label htmlFor="publisher">Publisher</label><select id="publisher" value={authorId} onChange={(event) => setAuthorId(event.target.value)} required>{people.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}</select>
        <label htmlFor="publish-address">Website address</label><input id="publish-address" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={253} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="your-page.zz" required />
        <label htmlFor="publish-title">Website title</label><input id="publish-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required />
        <label htmlFor="publish-html">HTML content</label><textarea id="publish-html" value={html} onChange={(event) => setHtml(event.target.value)} maxLength={100000} rows={10} spellCheck={false} aria-describedby="html-help" required />
        <p id="html-help">Basic text, headings, lists, tables, and .zz links are supported. Scripts, forms, styles, media, and external resources are blocked. Up to 100,000 characters; the complete JSON request must fit 100 KiB.</p>
      </fieldset>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="publish-actions"><button type="submit" className="primary-button" disabled={pending}>{pending ? 'Publishing…' : 'Publish website'}</button><span role="status">{pending ? 'Saving your page. Please wait.' : 'Your original HTML is stored without truncation.'}</span></div>
    </form>}
  </dialog>;
}
