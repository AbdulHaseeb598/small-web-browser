import { FICTIONAL_ADDRESS, normalizeAddress } from '../common/address.js';
import { NAVIGATION_METHODS } from '../visits/navigation-method.js';
import {
  HISTORY_START,
  PEOPLE_IDS,
  SEED_PEOPLE,
  SEED_SITES,
  SEED_VISITS,
} from './seed-data.js';

const pages = new Map(SEED_SITES.map((site) => [site.address, site]));
const links = (html: string) =>
  Array.from(html.matchAll(/href="([^"]+)"/g), (match) => match[1]);

describe('Deterministic fictional web content', () => {
  it('provides five people, ten unique sites, and stable valid author relationships', () => {
    expect(SEED_PEOPLE).toHaveLength(5);
    expect(SEED_SITES).toHaveLength(10);
    expect(new Set(SEED_SITES.map((site) => site.address)).size).toBe(10);
    const people = new Set(SEED_PEOPLE.map((person) => person._id));
    const records = [...SEED_PEOPLE, ...SEED_SITES, ...SEED_VISITS];
    expect(new Set(records.map((record) => record._id)).size).toBe(
      records.length,
    );
    for (const record of records) expect(record._id).toMatch(/^[a-f\d]{24}$/);
    for (const site of SEED_SITES) {
      expect(people.has(site.authorId)).toBe(true);
      expect(site.address).toMatch(FICTIONAL_ADDRESS);
      expect(normalizeAddress(site.address)).toBe(site.address);
    }
    expect(
      SEED_PEOPLE.filter(
        (person) =>
          SEED_SITES.filter((site) => site.authorId === person._id).length >= 2,
      ).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('contains distinct, self-contained HTML documents with original multi-paragraph content', () => {
    expect(new Set(SEED_SITES.map((site) => site.html)).size).toBe(10);
    for (const site of SEED_SITES) {
      expect(site.html).toMatch(/^<!doctype html>\n<html lang="en">/);
      expect(site.html).toContain('<title>' + site.title + '</title>');
      expect(site.html).toMatch(/<\/main><\/body><\/html>$/);
      expect(Array.from(site.html.matchAll(/<p>(.*?)<\/p>/g))).toHaveLength(3);
      expect(site.html.split(/\s+/).length).toBeGreaterThan(140);
      expect(site.html).not.toMatch(
        /<script|<img|<style|<link\b|\bsrc=|https?:|\/\//i,
      );
      expect(links(site.html).length).toBeGreaterThanOrEqual(2);
      for (const address of links(site.html))
        expect(address).toMatch(FICTIONAL_ADDRESS);
    }
    expect(
      SEED_SITES.find((site) => site.address === 'kelp-lab.zz')?.html,
    ).toContain('coastal');
    expect(
      SEED_SITES.find((site) => site.address === 'observatory.zz')?.html,
    ).toContain('astronomy');
    expect(
      SEED_SITES.find((site) => site.address === 'bread-journal.zz')?.html,
    ).toContain('fermentation');
  });

  it('links every site into paths at least four pages deep and retains intentional broken links', () => {
    function hasPath(address: string, seen = new Set<string>()): boolean {
      if (seen.has(address) || !pages.has(address)) return false;
      const nextSeen = new Set([...seen, address]);
      return (
        nextSeen.size >= 4 ||
        links(pages.get(address)!.html).some((next) => hasPath(next, nextSeen))
      );
    }
    for (const site of SEED_SITES)
      expect(hasPath(site.address), site.address).toBe(true);
    const broken = new Set(
      SEED_SITES.flatMap((site) => links(site.html)).filter(
        (address) => !pages.has(address),
      ),
    );
    expect(broken).toEqual(
      new Set([
        'moon-pier.zz',
        'glasshouse.zz',
        'comet-ledger.zz',
        'weather-buoy.zz',
      ]),
    );
    for (const address of broken)
      expect(SEED_VISITS.some((visit) => visit.address === address)).toBe(true);
  });

  it('contains one fixed chronological hour, all navigation methods, and distinct personal trails', () => {
    expect(SEED_VISITS).toHaveLength(60);
    expect(SEED_VISITS[0].visitedAt).toBe(HISTORY_START);
    expect(
      Date.parse(SEED_VISITS.at(-1)!.visitedAt) - Date.parse(HISTORY_START),
    ).toBe(60 * 60000);
    expect(SEED_VISITS.map((visit) => visit.visitedAt)).toEqual(
      SEED_VISITS.map((visit) => visit.visitedAt).sort(),
    );
    expect(new Set(SEED_VISITS.map((visit) => visit.method))).toEqual(
      new Set(NAVIGATION_METHODS),
    );
    for (const person of SEED_PEOPLE) {
      const trail = SEED_VISITS.filter(
        (visit) => visit.personId === person._id,
      );
      expect(trail.length).toBeGreaterThanOrEqual(8);
      expect(new Set(trail.map((visit) => visit.address)).size).toBeLessThan(
        trail.length,
      );
      for (let index = 1; index < trail.length; index++) {
        expect(Date.parse(trail[index].visitedAt)).toBeGreaterThan(
          Date.parse(trail[index - 1].visitedAt),
        );
        if (trail[index].method === 'link') {
          expect(links(pages.get(trail[index - 1].address)!.html)).toContain(
            trail[index].address,
          );
        }
      }
    }
    const explorer = SEED_VISITS.filter(
      (visit) => visit.personId === PEOPLE_IDS.mira,
    );
    expect(explorer).toHaveLength(20);
    expect(
      new Set(
        explorer
          .filter((visit) => pages.has(visit.address))
          .map((visit) => visit.address),
      ).size,
    ).toBe(9);
  });
});
