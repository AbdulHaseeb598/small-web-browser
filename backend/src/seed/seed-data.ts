import type { NavigationMethod } from '../visits/navigation-method.js';

export interface SeedPerson {
  _id: string;
  name: string;
  createdAt: string;
}

export interface SeedSite {
  _id: string;
  address: string;
  title: string;
  html: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeedVisit {
  _id: string;
  personId: string;
  address: string;
  visitedAt: string;
  method: NavigationMethod;
}

// Explicit numeric identities are reserved for this dataset. Append new identities;
// do not renumber existing ones. No identifier or timestamp depends on the clock.
function seedId(kind: number, index: number): string {
  return (
    '5eed2026' +
    kind.toString(16).padStart(2, '0') +
    index.toString(16).padStart(14, '0')
  );
}

const CREATED_AT = '2026-01-01T00:00:00.000Z';
export const HISTORY_START = '2026-01-15T09:00:00.000Z';
export const PEOPLE_IDS = {
  mira: seedId(1, 1),
  idris: seedId(1, 2),
  sana: seedId(1, 3),
  ellis: seedId(1, 4),
  nora: seedId(1, 5),
} as const;

export const SEED_PEOPLE: readonly SeedPerson[] = [
  { _id: PEOPLE_IDS.mira, name: 'Mira Solis', createdAt: CREATED_AT },
  { _id: PEOPLE_IDS.idris, name: 'Idris Vale', createdAt: CREATED_AT },
  { _id: PEOPLE_IDS.sana, name: 'Sana Park', createdAt: CREATED_AT },
  { _id: PEOPLE_IDS.ellis, name: 'Ellis Reed', createdAt: CREATED_AT },
  { _id: PEOPLE_IDS.nora, name: 'Nora Lin', createdAt: CREATED_AT },
];

function escapeText(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function site(
  index: number,
  address: string,
  title: string,
  authorId: string,
  paragraphs: readonly string[],
  links: readonly (readonly [string, string])[],
): SeedSite {
  // These hrefs are fictional identifiers for the future navigation engine,
  // not external HTTP URLs. This is seed content, not an HTML rendering feature.
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeText(title)}</title></head>
<body><main>
<h1>${escapeText(title)}</h1>
${paragraphs.map((paragraph) => '<p>' + escapeText(paragraph) + '</p>').join('\n')}
<nav aria-label="Related fictional sites"><ul>
${links.map(([href, label]) => '<li><a href="' + escapeText(href) + '">' + escapeText(label) + '</a></li>').join('\n')}
</ul></nav>
</main></body></html>`;
  return {
    _id: seedId(2, index),
    address,
    title,
    html,
    authorId,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

export const SEED_SITES: readonly SeedSite[] = [
  site(
    1,
    'tidepool.zz',
    'Tidepool Field Station',
    PEOPLE_IDS.mira,
    [
      'At low tide, the basalt steps reveal pools no wider than a kitchen table. We record water temperature, salinity, and the height of each anemone colony before the sun reaches the rock. A pool is a temporary island whose borders move twice a day.',
      'Our crab census uses drawings rather than tags. A chipped claw or a pale stripe is enough to recognize a returning animal without handling it. The notebook shows that shaded crevices hold more juvenile crabs during warm afternoons, even when nearby pools have the same depth.',
      'Last winter a storm removed the kelp canopy and exposed the sand beneath it. Watching that small disturbance explains why coastal ecology depends on connections: seaweed slows the current, small grazers shelter in its folds, and fish arrive where grazers gather. Follow the kelp survey to trace the rest of this food web.',
    ],
    [
      ['kelp-lab.zz', 'Read the kelp survey'],
      ['harbor-notes.zz', 'Compare the harbor tide notebooks'],
      ['moon-pier.zz', 'Visit the old moon pier archive (missing)'],
    ],
  ),
  site(
    2,
    'kelp-lab.zz',
    'The Kelp Survey',
    PEOPLE_IDS.mira,
    [
      'A kelp forest begins with a holdfast, a tangled anchor that grips rock without drawing food from it. We sketch each holdfast after the spring tides and count the snails, brittle stars, and shrimp living between its branches. Their shelter is as important as the tall blades overhead.',
      'The survey compares three coves with different exposure to waves. Floating quadrats make counting possible on calm mornings, but a photograph alone cannot measure the forest. We also note blade damage, water clarity, and the time since the previous storm so that seasonal change is not mistaken for a single cause.',
      'Seaweed washed onto land carries nutrients out of the ocean. In the night garden, small additions of composted wrack feed soil organisms without burying the plants. That experiment joins marine ecology to gardening: a coastal food web continues beyond the high-water mark.',
    ],
    [
      ['night-garden.zz', 'Follow nutrients into the night garden'],
      ['tidepool.zz', 'Return to the field station'],
      ['seed-library.zz', 'Read about soil and seed storage'],
    ],
  ),
  site(
    3,
    'harbor-notes.zz',
    'Harbor Voices and Tide Notes',
    PEOPLE_IDS.idris,
    [
      'The harbor archive keeps the ordinary details that official maps leave out. A ferry cook remembered which bench stayed dry in an east wind; a net maker marked a shortcut that disappeared whenever the market stalls expanded. These recollections turn an outline of streets into a lived place.',
      'We record oral histories with dates, consent notes, and a distinction between observation and memory. When two accounts disagree, both remain in the transcript. A scratched tide gauge and a shop receipt can sometimes narrow a date more honestly than a confident retelling of a famous storm.',
      'Bread deliveries provide an unexpected map of the waterfront. The early route passed the bakery, the fish sheds, and the signal workshop before dawn. Reconstructing those walks helps explain how work followed weather, tides, and daylight rather than a neat boundary on a chart.',
    ],
    [
      ['map-room.zz', 'Walk through the map room'],
      ['bread-journal.zz', 'Read the waterfront baking journal'],
      ['signal-workshop.zz', 'Find the signal workshop'],
    ],
  ),
  site(
    4,
    'map-room.zz',
    'The Lantern Map Room',
    PEOPLE_IDS.idris,
    [
      'A useful walking map explains a decision before it decorates a page. Our harbor chart marks steep steps, drinking fountains, and places where a visitor can wait out the rain. Distances are measured along the path a person can actually take, not across the roofs between two points.',
      'Each edition has a transparent overlay for a different hour. Morning deliveries close a lane that is quiet at noon, while the evening ferry opens a route across the water. Cartography becomes more honest when a map admits that its information has a time as well as a location.',
      'The ridge path ends at the observatory. From there, the lamps of the harbor look like a second constellation, bright enough to wash out the faint stars above it. Comparing the sky chart with the town chart raises a practical question: how much light does a safe street really need?',
    ],
    [
      ['observatory.zz', 'Climb to the observatory'],
      ['harbor-notes.zz', 'Read the stories behind the streets'],
      ['night-garden.zz', 'Find a dark place for moths'],
    ],
  ),
  site(
    5,
    'night-garden.zz',
    'Notes from the Night Garden',
    PEOPLE_IDS.sana,
    [
      'The night garden is planted for visitors we usually miss. Pale evening flowers open as the air cools, and moths move between them while beetles work under the leaves. We watch with shaded red lamps and count visits to a flower rather than assuming that every insect is a pollinator.',
      'Two beds receive different compost mixtures. One contains a small amount of washed seaweed from the kelp survey; the other uses only fallen leaves. Soil moisture, worm activity, and flowering dates go into the same ledger, because a vigorous plant is not proof that one ingredient caused the change.',
      'Saving seed starts before a capsule dries. We mark the healthiest plants, leave enough food for birds, and collect only a share of what remains. The seed library keeps those envelopes beside notes about shade, drought, and the insects that carried pollen through the garden.',
    ],
    [
      ['seed-library.zz', 'Open the seed library'],
      ['kelp-lab.zz', 'Compare the seaweed compost survey'],
      ['glasshouse.zz', 'Visit the planned glasshouse (missing)'],
    ],
  ),
  site(
    6,
    'seed-library.zz',
    'The Neighborhood Seed Library',
    PEOPLE_IDS.sana,
    [
      'An envelope of beans is a promise with conditions. At the seed library we label the variety, harvest year, and garden where it grew, then keep the packets cool and dry. A small germination test in spring tells us more than the attractive drawing on the front of the envelope.',
      'Borrowers return observations instead of owing a fixed quantity of seed. Someone may discover that a climbing bean tolerates wind, while another gardener finds that the same plant flowers late beside a warm wall. These local records make the collection useful without pretending that every garden is identical.',
      'Grain connects the library to the kitchen. A heritage wheat can have a remarkable story and still need careful milling and patient hydration to make good bread. The copper kettle notebook follows that journey from a stored seed to a bowl of dough, with failures recorded as carefully as successes.',
    ],
    [
      ['copper-kettle.zz', 'Take grain into the kitchen'],
      ['night-garden.zz', 'Return to the night garden'],
      ['glasshouse.zz', 'Check the future glasshouse catalog (missing)'],
    ],
  ),
  site(
    7,
    'observatory.zz',
    'Ridge Observatory Logbook',
    PEOPLE_IDS.ellis,
    [
      'The ridge telescope is small enough to carry, but the observing log is deliberately precise. We write the time, cloud cover, and the darkest star visible near the target before making a sketch. A difficult night can still produce useful evidence when its limits are recorded honestly.',
      'Light pollution changes the sky gradually. Shielded harbor lamps leave the ground bright while reducing the glow above the ridge, so our astronomy group measures both conditions before asking for a change. The best argument is a repeatable comparison, not a photograph with an impressive exposure setting.',
      'The signal workshop builds simple sensors for those comparisons. A calibrated photodiode cannot replace an observer, but it can reveal a lamp left on after closing time. Combining instrument readings with patient visual notes keeps an elegant circuit from becoming a misleading story about the night.',
    ],
    [
      ['signal-workshop.zz', 'Build a light sensor'],
      ['map-room.zz', 'Compare the harbor lighting map'],
      ['comet-ledger.zz', 'Look for the unfinished comet ledger (missing)'],
    ],
  ),
  site(
    8,
    'signal-workshop.zz',
    'The Signal Workshop',
    PEOPLE_IDS.ellis,
    [
      'A signal is useful only when someone can distinguish it from noise. On the workshop bench, a small radio receiver sits beside a shaded light sensor and a notebook of calibration readings. Both instruments need a reference before their numbers mean anything outside the room.',
      'We test a photodiode with the same lamp at measured distances, keeping its angle and supply voltage constant. Temperature drift is checked before the circuit is carried to the observatory. The exercise teaches electronics through a physical question: which changes belong to the sky, and which belong to the detector?',
      'The proposed weather buoy would send water temperature and battery voltage from the outer cove. Its page is not written yet, because a reliable enclosure has proved harder than a clever transmitter. Until then, the field station records conditions by hand and treats missing measurements as missing, not as zero.',
    ],
    [
      ['tidepool.zz', 'Compare hand-recorded coastal observations'],
      ['observatory.zz', 'Return to the observing log'],
      ['weather-buoy.zz', 'Read the proposed buoy notebook (missing)'],
    ],
  ),
  site(
    9,
    'copper-kettle.zz',
    'The Copper Kettle Notebook',
    PEOPLE_IDS.nora,
    [
      "The kitchen notebook starts with a question rather than a perfect recipe. Why did yesterday's lentils soften quickly while the next batch stayed firm? We note soaking time, water hardness, and the age of the beans before blaming the pan. Cooking is easier to repeat when its small variables have names.",
      'Fermentation makes those variables visible. A jar of vegetables changes flavor as lactic acid bacteria consume available sugars, but salt concentration and room temperature still matter. Clean equipment and measured quantities support observation; an appealing smell is not a substitute for a sound preservation method.',
      'Bread brings the same patience to grain. Flour absorbs water slowly, dough warms under the hands, and a sourdough starter follows its own schedule. The baking journal records texture and timing so that a failed loaf becomes an explanation we can use rather than a result we quietly forget.',
    ],
    [
      ['bread-journal.zz', 'Follow the bread experiment'],
      ['seed-library.zz', 'Trace ingredients back to saved seed'],
      ['harbor-notes.zz', 'Read the harbor delivery stories'],
    ],
  ),
  site(
    10,
    'bread-journal.zz',
    'The Dawn Bread Journal',
    PEOPLE_IDS.nora,
    [
      'Before dawn, the bakery sounds like a room full of slow clocks. A starter rises against a pencil mark on its jar, a covered dough relaxes, and the oven stones collect heat. We follow those changes instead of demanding that every loaf obey the same number of minutes.',
      'This week we compare two wheat flours at the same hydration. One dough stretches easily while the other tears until it has rested, so the next trial changes rest time rather than adding water at random. Notes on fermentation, kneading, and crumb structure keep the comparison useful for the next baker.',
      'The first loaves travel along the harbor route while their crusts are still singing. Delivery stories explain why one customer asks for a firm heel and another saves the soft center for soup. A recipe becomes part of a neighborhood when its measurements meet the lives of the people who eat it.',
    ],
    [
      ['harbor-notes.zz', 'Follow the dawn delivery route'],
      ['copper-kettle.zz', 'Return to the kitchen notebook'],
      ['seed-library.zz', 'Compare heritage wheat notes'],
    ],
  ),
];

type HistoryEntry = readonly [
  minute: number,
  address: string,
  method: NavigationMethod,
];
const TRAILS: readonly (readonly [
  personId: string,
  entries: readonly HistoryEntry[],
])[] = [
  [
    PEOPLE_IDS.mira,
    [
      [0, 'tidepool.zz', 'typed'],
      [3, 'kelp-lab.zz', 'link'],
      [6, 'night-garden.zz', 'link'],
      [9, 'seed-library.zz', 'link'],
      [12, 'copper-kettle.zz', 'link'],
      [15, 'bread-journal.zz', 'link'],
      [18, 'harbor-notes.zz', 'link'],
      [21, 'map-room.zz', 'link'],
      [24, 'observatory.zz', 'link'],
      [27, 'map-room.zz', 'back'],
      [30, 'observatory.zz', 'forward'],
      [33, 'tidepool.zz', 'history'],
      [36, 'moon-pier.zz', 'link'],
      [39, 'tidepool.zz', 'back'],
      [42, 'kelp-lab.zz', 'search'],
      [45, 'night-garden.zz', 'link'],
      [48, 'kelp-lab.zz', 'back'],
      [51, 'bread-journal.zz', 'history'],
      [56, 'observatory.zz', 'search'],
      [60, 'comet-ledger.zz', 'link'],
    ],
  ],
  [
    PEOPLE_IDS.idris,
    [
      [1, 'harbor-notes.zz', 'typed'],
      [6, 'map-room.zz', 'link'],
      [11, 'observatory.zz', 'link'],
      [16, 'signal-workshop.zz', 'link'],
      [21, 'observatory.zz', 'back'],
      [26, 'signal-workshop.zz', 'forward'],
      [31, 'harbor-notes.zz', 'history'],
      [36, 'map-room.zz', 'link'],
      [41, 'tidepool.zz', 'search'],
      [46, 'moon-pier.zz', 'link'],
      [51, 'tidepool.zz', 'back'],
      [58, 'harbor-notes.zz', 'history'],
    ],
  ],
  [
    PEOPLE_IDS.sana,
    [
      [2, 'seed-library.zz', 'typed'],
      [8, 'night-garden.zz', 'link'],
      [14, 'kelp-lab.zz', 'link'],
      [20, 'tidepool.zz', 'link'],
      [26, 'kelp-lab.zz', 'back'],
      [32, 'night-garden.zz', 'history'],
      [38, 'glasshouse.zz', 'link'],
      [44, 'night-garden.zz', 'back'],
      [50, 'seed-library.zz', 'search'],
      [59, 'copper-kettle.zz', 'link'],
    ],
  ],
  [
    PEOPLE_IDS.ellis,
    [
      [4, 'observatory.zz', 'typed'],
      [10, 'signal-workshop.zz', 'link'],
      [16, 'weather-buoy.zz', 'link'],
      [22, 'signal-workshop.zz', 'back'],
      [28, 'weather-buoy.zz', 'forward'],
      [34, 'signal-workshop.zz', 'back'],
      [40, 'observatory.zz', 'history'],
      [46, 'map-room.zz', 'link'],
      [52, 'observatory.zz', 'back'],
      [57, 'signal-workshop.zz', 'search'],
    ],
  ],
  [
    PEOPLE_IDS.nora,
    [
      [5, 'copper-kettle.zz', 'typed'],
      [13, 'bread-journal.zz', 'link'],
      [21, 'harbor-notes.zz', 'link'],
      [29, 'bread-journal.zz', 'back'],
      [37, 'harbor-notes.zz', 'forward'],
      [45, 'copper-kettle.zz', 'history'],
      [53, 'seed-library.zz', 'link'],
      [60, 'glasshouse.zz', 'link'],
    ],
  ],
];

export const SEED_VISITS: readonly SeedVisit[] = TRAILS.flatMap(
  ([personId, entries], personIndex) =>
    entries.map(([minute, address, method], visitIndex) => ({
      _id: seedId(3, personIndex * 1000 + visitIndex + 1),
      personId,
      address,
      method,
      visitedAt: new Date(
        Date.parse(HISTORY_START) + minute * 60000,
      ).toISOString(),
    })),
).sort(
  (a, b) =>
    a.visitedAt.localeCompare(b.visitedAt) || a._id.localeCompare(b._id),
);
