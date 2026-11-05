import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Site } from '../sites/site.schema.js';
import { visibleText } from './visible-text.js';

const RESULT_LIMIT = 20;
const CACHE_LIMIT = 128;
export interface SearchItem {
  address: string;
  title: string;
  excerpt: string;
  score: number;
}

@Injectable()
export class SearchService {
  private cache = new Map<string, { html: string; text: string }>();
  constructor(@InjectModel(Site.name) private readonly sites: Model<Site>) {}

  async search(query: string) {
    const terms = Array.from(
      query.toLowerCase().matchAll(/"([^"]+)"|(\S+)/g),
      (match) => match[1] ?? match[2],
    );
    if (terms.length > 10)
      throw new BadRequestException(
        'Use at most 10 search terms or quoted phrases',
      );
    const sites = await this.sites
      .find()
      .select('_id address title html')
      .lean()
      .exec();
    const matches: SearchItem[] = [];
    for (const site of sites) {
      const key = site._id.toHexString();
      let cached = this.cache.get(key);
      if (!cached || cached.html !== site.html) {
        cached = { html: site.html, text: visibleText(site.html) };
        this.cache.delete(key);
        if (this.cache.size >= CACHE_LIMIT)
          this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, cached);
      }
      const title = site.title.toLowerCase();
      const address = site.address.toLowerCase();
      const body = cached.text.toLowerCase();
      if (
        !terms.every(
          (term) =>
            title.includes(term) ||
            address.includes(term) ||
            body.includes(term),
        )
      )
        continue;
      let score = 0;
      for (const term of terms) {
        if (title.includes(term)) score += 12;
        if (address.includes(term)) score += 8;
        if (body.includes(term)) score += 3;
      }
      if (title === query.toLowerCase().replaceAll('"', '')) score += 30;
      const positions = terms
        .map((term) => body.indexOf(term))
        .filter((index) => index >= 0);
      const first = positions.length ? Math.min(...positions) : 0;
      const start = Math.max(0, first - 65);
      const end = Math.min(cached.text.length, start + 200);
      matches.push({
        address: site.address,
        title: site.title,
        score,
        excerpt:
          (start > 0 ? '…' : '') +
          cached.text.slice(start, end) +
          (end < cached.text.length ? '…' : ''),
      });
    }
    // Binary address ordering is stable across locales. The unique address index
    // ensures this tie-breaker is sufficient without exposing database IDs.
    matches.sort(
      (a, b) =>
        b.score - a.score ||
        (a.address < b.address ? -1 : a.address > b.address ? 1 : 0),
    );
    return {
      query,
      items: matches.slice(0, RESULT_LIMIT),
      total: matches.length,
      limit: RESULT_LIMIT,
    };
  }
}
