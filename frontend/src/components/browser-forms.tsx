'use client';
import { useState } from 'react';

export function AddressForm({ address, onGo }: { address: string; onGo: (address: string) => void }) {
  const [value, setValue] = useState(address);
  return <form className="address-form" onSubmit={(event) => { event.preventDefault(); onGo(value); }}>
    <label className="sr-only" htmlFor="browser-address">Fictional website address</label>
    <span className="address-prefix" aria-hidden="true">zz /</span>
    <input id="browser-address" name="address" value={value} onChange={(event) => setValue(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Enter a .zz address" maxLength={253} required />
    <button className="go-button" type="submit">Go <span aria-hidden="true">→</span></button>
  </form>;
}

export function SearchForm({ query, onSearch }: { query: string; onSearch: (query: string) => void }) {
  const [value, setValue] = useState(query);
  return <form className="search-form" role="search" onSubmit={(event) => { event.preventDefault(); onSearch(value); }}>
    <label className="sr-only" htmlFor="site-search">Search the small web</label>
    <input id="site-search" type="search" name="q" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Search page text, titles, and addresses" maxLength={100} required />
    <button className="secondary-button" type="submit">Search</button>
  </form>;
}
