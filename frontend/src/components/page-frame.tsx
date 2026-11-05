'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { frameDocument, readFrameMessage } from '../lib/frame-document';

export default function PageFrame({ html, title, scrollY, onLink, onScroll }: {
  html: string; title: string; scrollY: number;
  onLink: (address: string) => void; onScroll: (scrollY: number) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [token] = useState(() => crypto.randomUUID());
  const [nonce] = useState(() => crypto.randomUUID());
  const [initialScroll] = useState(scrollY);
  const srcDoc = useMemo(() => frameDocument(html, token, nonce, initialScroll), [html, token, nonce, initialScroll]);
  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== 'null') return;
      const message = readFrameMessage(event.data, token);
      if (message?.type === 'link') onLink(message.value);
      if (message?.type === 'scroll') onScroll(message.value);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onLink, onScroll, token]);
  return <iframe ref={frame} title={'Website: ' + title} className="page-frame" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={srcDoc} />;
}
