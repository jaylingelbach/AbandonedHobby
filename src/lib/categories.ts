export interface CategoryDefinition {
  name: string;
  slug: string;
  color?: string;
  subcategories?: CategoryDefinition[];
}

export const categories: CategoryDefinition[] = [
  {
    name: 'All categories',
    slug: 'all',
    color: '#CCCCCC'
  },
  {
    name: 'Books & Literature',
    slug: 'books-literature',
    color: '#AEDFF7',
    subcategories: [
      { name: 'Book restoration', slug: 'book-restoration' },
      { name: 'Fiction', slug: 'fiction' },
      { name: 'Graphic Novels', slug: 'graphic-novels' },
      { name: 'Manga & Comics', slug: 'manga-comics' },
      { name: 'Non-Fiction', slug: 'non-fiction' }
    ]
  },
  {
    name: 'Collecting',
    slug: 'collecting',
    color: '#C3F584',
    subcategories: [
      { name: 'Action Figures', slug: 'action-figures' },
      { name: 'Button Collecting', slug: 'button-collecting' },
      { name: 'Coins', slug: 'coins' },
      { name: 'Stamps', slug: 'stamps' },
      { name: 'Trading Cards', slug: 'trading-cards' }
    ]
  },
  {
    name: 'Cooking & Baking',
    slug: 'cooking-baking',
    color: '#FFDAC1',
    subcategories: [
      { name: 'Baking', slug: 'baking' },
      { name: 'Bread Making', slug: 'bread-making' },
      { name: 'Cake Decorating', slug: 'cake-decorating' },
      { name: 'Homebrewing', slug: 'homebrewing' },
      { name: 'Meal Prep', slug: 'meal-prep' }
    ]
  },
  {
    name: 'Crafts & Hobbies',
    slug: 'crafts-hobbies',
    color: '#B5B9FF',
    subcategories: [
      { name: 'Astrology', slug: 'astrology' },
      { name: 'Astronomy', slug: 'astronomy' },
      { name: 'Candle making', slug: 'candle-making' },
      { name: 'Crocheting', slug: 'crocheting' },
      { name: 'Cross Stitch', slug: 'cross-stitch' },
      { name: 'Homebrewing', slug: 'homebrewing' },
      { name: 'Homebrewing & Fermentation', slug: 'homebrewing-fermentation' },
      { name: 'Knitting', slug: 'knitting' },
      { name: 'LEGO & Building Blocks', slug: 'lego-building-blocks' },
      { name: 'Model Building', slug: 'model-building' },
      { name: 'Pottery', slug: 'pottery' },
      { name: 'Quilting', slug: 'quilting' },
      { name: 'Scrapbooking', slug: 'scrapbooking' },
      { name: 'Woodworking', slug: 'woodworking' }
    ]
  },
  {
    name: 'Drawing & Painting',
    slug: 'drawing-painting',
    color: '#FFB347',
    subcategories: [
      { name: 'Acrylic', slug: 'acrylic' },
      { name: 'Charcoal', slug: 'charcoal' },
      { name: 'Completed Artwork', slug: 'completed-artwork' },
      { name: 'Oil', slug: 'oil' },
      { name: 'Other Supplies', slug: 'other-supplies' },
      { name: 'Pastel', slug: 'pastel' },
      { name: 'Watercolor', slug: 'watercolor' }
    ]
  },
  {
    name: 'Electronics',
    slug: 'electronics',
    color: '#96E6B3',
    subcategories: [
      {
        name: 'Computers',
        slug: 'computers',
        subcategories: [
          { name: 'Audiophile', slug: 'audiophile' },
          { name: 'Drones & RC', slug: 'drones-rc' },
          { name: 'Single Board Computers', slug: 'single-board-computers' },
          { name: 'VR & Wearables', slug: 'vr-wearables' }
        ]
      },
      { name: 'Components', slug: 'components' }
    ]
  },
  {
    name: 'Fitness & Health',
    slug: 'fitness-health',
    color: '#FF9AA2',
    subcategories: [
      { name: 'Wearable Trackers', slug: 'wearable-trackers' },
      { name: 'Workout Equipment', slug: 'workout-equipment' },
      { name: 'Yoga & Mindfulness', slug: 'yoga-mindfulness' }
    ]
  },
  {
    name: 'Gaming',
    slug: 'gaming',
    color: '#8BD3DD',
    subcategories: [
      { name: 'Board Games', slug: 'board-games' },
      { name: 'Card Games', slug: 'card-games' },
      { name: 'Tabletop RPGs', slug: 'tabletop-rpgs' },
      { name: 'Video Games', slug: 'video-games' }
    ]
  },
  {
    name: 'Language Learning',
    slug: 'language-learning',
    color: '#D3F7AE',
    subcategories: [
      { name: 'Audio Courses', slug: 'audio-courses' },
      { name: 'Flashcards', slug: 'flashcards' },
      { name: 'Textbooks', slug: 'textbooks' }
    ]
  },
  {
    name: 'Mind Games & Puzzles',
    slug: 'mind-games-puzzles',
    color: '#FF6F91',
    subcategories: [
      { name: 'Crossword Puzzles', slug: 'crossword-puzzles' },
      { name: "Rubik's Cubes", slug: 'rubiks-cubes' },
      { name: 'Sudoku', slug: 'sudoku' },
      { name: 'Jigsaw Puzzles', slug: 'jigsaw-puzzles' }
    ]
  },
  {
    name: 'Movies & TV',
    slug: 'movies-tv',
    color: '#F7E9AE',
    subcategories: [
      { name: 'Blu-ray & DVD', slug: 'blu-ray-dvd' },
      { name: 'Posters & Merch', slug: 'posters-merch' },
      { name: 'Streaming Gear', slug: 'streaming-gear' }
    ]
  },
  {
    name: 'Music',
    slug: 'music',
    color: '#FFD700',
    subcategories: [
      { name: 'Cassette Tapes', slug: 'cassette-tapes' },
      { name: 'Compact Discs', slug: 'compact-discs' },
      { name: 'Digital Audio Workstations', slug: 'daws' },
      { name: 'Musical Instruments', slug: 'musical-instruments' },
      { name: 'Other', slug: 'other' },
      { name: 'Records', slug: 'records' }
    ]
  },
  {
    name: 'Musical Instruments',
    slug: 'musical-instruments',
    color: '#BD9B16',
    subcategories: [
      { name: 'Acoustic Guitars & Basses', slug: 'acoustic-guitars' },
      { name: 'Electric Guitars & Basses', slug: 'electric-guitars' },
      { name: 'Other', slug: 'other' },
      { name: 'Pedals & Effects', slug: 'pedals-effects' },
      { name: 'Synthesizers & MIDI', slug: 'synthesizers-midi' }
    ]
  },
  {
    name: 'Outdoors & Adventure',
    slug: 'outdoors-adventure',
    color: '#B5FFB8',
    subcategories: [
      { name: 'Airsoft', slug: 'airsoft' },
      { name: 'Archery', slug: 'archery' },
      { name: 'Backpacking', slug: 'backpacking' },
      { name: 'Beekeeping', slug: 'beekeeping' },
      { name: 'Bicycling', slug: 'bicycling' },
      { name: 'Bird Watching', slug: 'birding' },
      { name: 'Camping', slug: 'camping' },
      { name: 'Caving', slug: 'caving' },
      { name: 'Gardening', slug: 'gardening' },
      { name: 'Hiking', slug: 'hiking' },
      { name: 'Rock Climbing', slug: 'rock-climbing' }
    ]
  },
  {
    name: 'Photography',
    slug: 'photography',
    color: '#FF6B6B',
    subcategories: [
      { name: 'Camera Equipment', slug: 'camera-equipment' },
      { name: 'Cameras', slug: 'cameras' },
      { name: 'Film Photography', slug: 'film-photography' },
      { name: 'Instant Cameras & Film', slug: 'instant-cameras-film' }
    ]
  },
  {
    name: 'Sports and sporting goods',
    slug: 'sporting-goods',
    color: '#FFC09F',
    subcategories: [
      { name: 'Airsoft', slug: 'airsoft' },
      { name: 'Billiards', slug: 'billiards' },
      { name: 'Bicycling', slug: 'bicycling' },
      { name: 'Board sports', slug: 'board-sports' },
      { name: 'Body Building', slug: 'body-building' }
    ]
  },
  {
    name: 'Tech & DIY',
    slug: 'tech-diy',
    color: '#A0E7E5',
    subcategories: [
      { name: '3D Printing', slug: '3d-printing' },
      { name: 'Arduino Projects', slug: 'arduino-projects' },
      { name: 'Electronics Kits', slug: 'electronics-kits' },
      { name: 'Raspberry Pi', slug: 'raspberry-pi' }
    ]
  },
  {
    name: 'Writing & Publishing',
    slug: 'writing-publishing',
    color: '#D8B5FF',
    subcategories: [
      { name: 'Book restoration', slug: 'book-restoration' },
      { name: 'Calligraphy', slug: 'calligraphy' },
      { name: 'Notebooks', slug: 'notebooks' },
      { name: 'Planners & Bullet Journals', slug: 'planners-bullet-journals' },
      { name: 'Writing devices', slug: 'writing-devices' }
    ]
  }
];

const slugToNameMap = new Map<string, string>();
for (const cat of categories) {
  slugToNameMap.set(cat.slug, cat.name);
  for (const sub of cat.subcategories ?? []) {
    slugToNameMap.set(sub.slug, sub.name);
    for (const nested of sub.subcategories ?? []) {
      slugToNameMap.set(nested.slug, nested.name);
    }
  }
}

export function categoryNameFromSlug(slug: string): string | undefined {
  return slugToNameMap.get(slug);
}
