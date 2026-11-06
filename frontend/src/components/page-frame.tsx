'use client';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { frameDocument, readFrameMessage } from '../lib/frame-document';

export default function PageFrame({ html, title, searchQuery = '', onLink, onReady }: {
  html: string; title: string; searchQuery?: string;
  onLink: (address: string) => void; onReady?: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [token] = useState(() => crypto.randomUUID());
  const [nonce] = useState(() => crypto.randomUUID());
  const [height, setHeight] = useState(400);
  const { srcDoc, links } = useMemo(() => frameDocument(html, token, nonce, searchQuery), [html, token, nonce, searchQuery]);
  useLayoutEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (!event.isTrusted || event.source !== frame.current?.contentWindow || event.origin !== 'null') return;
      const message = readFrameMessage(event.data, token, links);
      if (message?.type === 'link') onLink(message.value);
      if (message?.type === 'height') { setHeight(message.value); onReady?.(); }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onLink, onReady, token, links]);
  return <iframe ref={frame} title={'Website: ' + title} className="page-frame" style={{ height }} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={srcDoc} />;
}
