// Curated news + podcast sources for the daily digest.
//
// Feed URLs are best-effort and validated by `npm run check-feeds`
// (scripts/check-feeds.ts). The fetcher skips any feed that fails, so a
// stale URL degrades gracefully instead of breaking the whole digest.

export const TOPICS = [
  "AI",
  "Tech",
  "Science",
  "Space",
  "Quantum",
  "Biotech",
  "Nuclear",
  "Fusion",
  "Energy",
  "Blockchain",
  "Apple",
  "Nintendo",
] as const;

export type Topic = (typeof TOPICS)[number];

export type SourceType = "article" | "podcast";

/** How a source is fetched. Most are plain RSS; a few need special handling. */
export type SourceKind = "rss" | "reddit" | "hfpapers";

export interface Source {
  /** Human-readable name shown in the UI. */
  name: string;
  /** RSS/Atom feed URL (or JSON API url for custom kinds). */
  url: string;
  /** Website homepage (fallback link + display). */
  homepage: string;
  /** Primary topic bucket (per-item topic may override for combined feeds). */
  topic: Topic;
  type: SourceType;
  /** Fetch strategy; defaults to "rss". */
  kind?: SourceKind;
}

export const SOURCES: Source[] = [
  // ---------------------------------------------------------------------------
  // AI
  // ---------------------------------------------------------------------------
  {
    name: "Import AI (Jack Clark)",
    url: "https://jack-clark.net/feed/",
    homepage: "https://jack-clark.net/",
    topic: "AI",
    type: "article",
  },
  {
    name: "Interconnects (Nathan Lambert)",
    url: "https://www.interconnects.ai/feed",
    homepage: "https://www.interconnects.ai/",
    topic: "AI",
    type: "article",
  },
  {
    name: "Simon Willison",
    url: "https://simonwillison.net/atom/everything/",
    homepage: "https://simonwillison.net/",
    topic: "AI",
    type: "article",
  },
  {
    name: "SemiAnalysis (Dylan Patel)",
    url: "https://www.semianalysis.com/feed",
    homepage: "https://www.semianalysis.com/",
    topic: "AI",
    type: "article",
  },
  {
    name: "Ahead of AI (Sebastian Raschka)",
    url: "https://magazine.sebastianraschka.com/feed",
    homepage: "https://magazine.sebastianraschka.com/",
    topic: "AI",
    type: "article",
  },
  {
    name: "Google DeepMind Blog",
    url: "https://deepmind.google/blog/rss.xml",
    homepage: "https://deepmind.google/",
    topic: "AI",
    type: "article",
  },
  {
    name: "Hugging Face Daily Papers",
    url: "https://huggingface.co/api/daily_papers?limit=30",
    homepage: "https://huggingface.co/papers",
    topic: "AI",
    type: "article",
    kind: "hfpapers",
  },
  {
    // One combined multi-subreddit request (avoids Reddit's per-feed rate limits);
    // each item's topic is remapped from its subreddit in fetch.ts.
    name: "Reddit (frontier subs)",
    url: "https://www.reddit.com/r/LocalLLaMA+MachineLearning+singularity+nuclear+space+Biotechnology+QuantumComputing/top/.rss?t=day&limit=60",
    homepage: "https://www.reddit.com/",
    topic: "AI",
    type: "article",
    kind: "reddit",
  },

  // ---------------------------------------------------------------------------
  // Tech (frontier / general)
  // ---------------------------------------------------------------------------
  {
    name: "Hacker News (best)",
    url: "https://hnrss.org/best",
    homepage: "https://news.ycombinator.com/best",
    topic: "Tech",
    type: "article",
  },
  {
    name: "Ars Technica",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    homepage: "https://arstechnica.com/",
    topic: "Tech",
    type: "article",
  },
  {
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    homepage: "https://www.theverge.com/",
    topic: "Tech",
    type: "article",
  },
  {
    name: "IEEE Spectrum",
    url: "https://spectrum.ieee.org/feeds/feed.rss",
    homepage: "https://spectrum.ieee.org/",
    topic: "Tech",
    type: "article",
  },
  {
    name: "MIT Technology Review",
    url: "https://www.technologyreview.com/feed/",
    homepage: "https://www.technologyreview.com/",
    topic: "Tech",
    type: "article",
  },
  {
    name: "New Atlas",
    url: "https://newatlas.com/index.rss",
    homepage: "https://newatlas.com/",
    topic: "Tech",
    type: "article",
  },
  {
    name: "Construction Physics (Brian Potter)",
    url: "https://www.construction-physics.com/feed",
    homepage: "https://www.construction-physics.com/",
    topic: "Tech",
    type: "article",
  },
  {
    name: "Works in Progress",
    url: "https://www.worksinprogress.news/feed",
    homepage: "https://worksinprogress.co/",
    topic: "Tech",
    type: "article",
  },
  {
    name: "Asterisk Magazine",
    url: "https://asteriskmag.com/feed",
    homepage: "https://asteriskmag.com/",
    topic: "Tech",
    type: "article",
  },

  // ---------------------------------------------------------------------------
  // Science
  // ---------------------------------------------------------------------------
  {
    name: "Quanta Magazine",
    url: "https://api.quantamagazine.org/feed/",
    homepage: "https://www.quantamagazine.org/",
    topic: "Science",
    type: "article",
  },
  {
    name: "Nature (current)",
    url: "https://www.nature.com/nature.rss",
    homepage: "https://www.nature.com/",
    topic: "Science",
    type: "article",
  },
  {
    name: "Science (news)",
    url: "https://www.science.org/rss/news_current.xml",
    homepage: "https://www.science.org/",
    topic: "Science",
    type: "article",
  },
  {
    name: "Phys.org",
    url: "https://phys.org/rss-feed/",
    homepage: "https://phys.org/",
    topic: "Science",
    type: "article",
  },
  {
    name: "Nautilus",
    url: "https://nautil.us/feed/",
    homepage: "https://nautil.us/",
    topic: "Science",
    type: "article",
  },

  // ---------------------------------------------------------------------------
  // Biotech
  // ---------------------------------------------------------------------------
  {
    name: "Asimov Press",
    url: "https://www.asimov.press/feed",
    homepage: "https://www.asimov.press/",
    topic: "Biotech",
    type: "article",
  },
  {
    name: "Ground Truths (Eric Topol)",
    url: "https://erictopol.substack.com/feed",
    homepage: "https://erictopol.substack.com/",
    topic: "Biotech",
    type: "article",
  },
  {
    name: "In the Pipeline (Derek Lowe)",
    url: "https://www.science.org/blogs/pipeline/feed",
    homepage: "https://www.science.org/blogs/pipeline",
    topic: "Biotech",
    type: "article",
  },
  {
    name: "Endpoints News",
    url: "https://endpoints.news/feed/",
    homepage: "https://endpoints.news/",
    topic: "Biotech",
    type: "article",
  },

  // ---------------------------------------------------------------------------
  // Nuclear
  // ---------------------------------------------------------------------------
  {
    name: "World Nuclear News",
    url: "https://www.world-nuclear-news.org/rss",
    homepage: "https://www.world-nuclear-news.org/",
    topic: "Nuclear",
    type: "article",
  },
  {
    name: "Nuclear Engineering International",
    url: "https://www.neimagazine.com/feed/",
    homepage: "https://www.neimagazine.com/",
    topic: "Nuclear",
    type: "article",
  },
  {
    name: "Neutron Bytes (Dan Yurman)",
    url: "https://neutronbytes.com/feed/",
    homepage: "https://neutronbytes.com/",
    topic: "Nuclear",
    type: "article",
  },
  {
    name: "Nuclear Barbarians (Emmet Penney)",
    url: "https://www.nuclearbarbarians.com/feed",
    homepage: "https://www.nuclearbarbarians.com/",
    topic: "Nuclear",
    type: "article",
  },
  {
    name: "POWER Magazine",
    url: "https://www.powermag.com/feed/",
    homepage: "https://www.powermag.com/",
    topic: "Nuclear",
    type: "article",
  },

  // ---------------------------------------------------------------------------
  // Blockchain
  // ---------------------------------------------------------------------------
  {
    name: "The Defiant",
    url: "https://thedefiant.io/feed",
    homepage: "https://thedefiant.io/",
    topic: "Blockchain",
    type: "article",
  },
  {
    name: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    homepage: "https://www.coindesk.com/",
    topic: "Blockchain",
    type: "article",
  },
  {
    name: "Bankless",
    url: "https://www.bankless.com/rss/feed",
    homepage: "https://www.bankless.com/",
    topic: "Blockchain",
    type: "article",
  },

  // ---------------------------------------------------------------------------
  // Apple
  // ---------------------------------------------------------------------------
  {
    name: "Six Colors (Jason Snell)",
    url: "https://sixcolors.com/feed/",
    homepage: "https://sixcolors.com/",
    topic: "Apple",
    type: "article",
  },
  {
    name: "Daring Fireball (John Gruber)",
    url: "https://daringfireball.net/feeds/main",
    homepage: "https://daringfireball.net/",
    topic: "Apple",
    type: "article",
  },
  {
    name: "9to5Mac",
    url: "https://9to5mac.com/feed/",
    homepage: "https://9to5mac.com/",
    topic: "Apple",
    type: "article",
  },

  // ---------------------------------------------------------------------------
  // Nintendo
  // ---------------------------------------------------------------------------
  {
    name: "Nintendo Life",
    url: "https://www.nintendolife.com/feeds/latest",
    homepage: "https://www.nintendolife.com/",
    topic: "Nintendo",
    type: "article",
  },
  {
    name: "Nintendo Everything",
    url: "https://nintendoeverything.com/feed/",
    homepage: "https://nintendoeverything.com/",
    topic: "Nintendo",
    type: "article",
  },

  // ---------------------------------------------------------------------------
  // Space / commercial spaceflight
  // ---------------------------------------------------------------------------
  {
    name: "Ars Technica Space",
    url: "https://arstechnica.com/space/feed/",
    homepage: "https://arstechnica.com/space/",
    topic: "Space",
    type: "article",
  },
  {
    name: "Payload",
    url: "https://payloadspace.com/feed/",
    homepage: "https://payloadspace.com/",
    topic: "Space",
    type: "article",
  },
  {
    name: "SpaceNews",
    url: "https://spacenews.com/feed/",
    homepage: "https://spacenews.com/",
    topic: "Space",
    type: "article",
  },

  // ---------------------------------------------------------------------------
  // Quantum computing
  // ---------------------------------------------------------------------------
  {
    name: "The Quantum Insider",
    url: "https://thequantuminsider.com/feed/",
    homepage: "https://thequantuminsider.com/",
    topic: "Quantum",
    type: "article",
  },
  {
    name: "Shtetl-Optimized (Scott Aaronson)",
    url: "https://scottaaronson.blog/?feed=rss2",
    homepage: "https://scottaaronson.blog/",
    topic: "Quantum",
    type: "article",
  },
  {
    name: "Physics World — Quantum",
    url: "https://physicsworld.com/c/quantum/feed/",
    homepage: "https://physicsworld.com/quantum/",
    topic: "Quantum",
    type: "article",
  },

  // ---------------------------------------------------------------------------
  // Fusion energy
  // ---------------------------------------------------------------------------
  {
    name: "Fusion Industry Association",
    url: "https://www.fusionindustryassociation.org/feed/",
    homepage: "https://www.fusionindustryassociation.org/",
    topic: "Fusion",
    type: "article",
  },
  {
    name: "POWER Magazine — Fusion",
    url: "https://www.powermag.com/tag/fusion/feed/",
    homepage: "https://www.powermag.com/tag/fusion/",
    topic: "Fusion",
    type: "article",
  },

  // ---------------------------------------------------------------------------
  // Energy & batteries / grid
  // ---------------------------------------------------------------------------
  {
    name: "Canary Media",
    url: "https://www.canarymedia.com/feed",
    homepage: "https://www.canarymedia.com/",
    topic: "Energy",
    type: "article",
  },
  {
    name: "Volts (David Roberts)",
    url: "https://www.volts.wtf/feed",
    homepage: "https://www.volts.wtf/",
    topic: "Energy",
    type: "article",
  },
  {
    name: "Latitude Media",
    url: "https://www.latitudemedia.com/rss",
    homepage: "https://www.latitudemedia.com/",
    topic: "Energy",
    type: "article",
  },

  // ---------------------------------------------------------------------------
  // Robotics
  // ---------------------------------------------------------------------------
  {
    name: "The Robot Report",
    url: "https://www.therobotreport.com/feed/",
    homepage: "https://www.therobotreport.com/",
    topic: "Tech",
    type: "article",
  },
  {
    name: "IEEE Spectrum Robotics",
    url: "https://spectrum.ieee.org/feeds/topic/robotics.rss",
    homepage: "https://spectrum.ieee.org/topic/robotics/",
    topic: "Tech",
    type: "article",
  },

  // ---------------------------------------------------------------------------
  // Neuroscience / neural interfaces
  // ---------------------------------------------------------------------------
  {
    name: "The Transmitter",
    url: "https://www.thetransmitter.org/feed/",
    homepage: "https://www.thetransmitter.org/",
    topic: "Science",
    type: "article",
  },
  {
    name: "Neuroscience News",
    url: "https://neurosciencenews.com/feed/",
    homepage: "https://neurosciencenews.com/",
    topic: "Science",
    type: "article",
  },

  // ---------------------------------------------------------------------------
  // Semiconductors / memory (memristors, ReRAM, neuromorphic) & storage tech
  // ---------------------------------------------------------------------------
  {
    name: "Semiconductor Engineering",
    url: "https://semiengineering.com/feed/",
    homepage: "https://semiengineering.com/",
    topic: "Tech",
    type: "article",
  },
  {
    name: "The Next Platform",
    url: "https://www.nextplatform.com/feed/",
    homepage: "https://www.nextplatform.com/",
    topic: "Tech",
    type: "article",
  },
  {
    name: "Energy Storage News",
    url: "https://www.energy-storage.news/feed/",
    homepage: "https://www.energy-storage.news/",
    topic: "Energy",
    type: "article",
  },

  // ---------------------------------------------------------------------------
  // Deep writers / analysis
  // ---------------------------------------------------------------------------
  {
    name: "Astral Codex Ten",
    url: "https://www.astralcodexten.com/feed",
    homepage: "https://www.astralcodexten.com/",
    topic: "Tech",
    type: "article",
  },
  {
    name: "Marginal Revolution",
    url: "https://marginalrevolution.com/feed",
    homepage: "https://marginalrevolution.com/",
    topic: "Tech",
    type: "article",
  },
  {
    name: "Don't Worry About the Vase (Zvi)",
    url: "https://thezvi.substack.com/feed",
    homepage: "https://thezvi.substack.com/",
    topic: "AI",
    type: "article",
  },
  {
    name: "AI Snake Oil",
    url: "https://www.aisnakeoil.com/feed",
    homepage: "https://www.aisnakeoil.com/",
    topic: "AI",
    type: "article",
  },
  {
    name: "One Useful Thing (Ethan Mollick)",
    url: "https://www.oneusefulthing.org/feed",
    homepage: "https://www.oneusefulthing.org/",
    topic: "AI",
    type: "article",
  },

  // ---------------------------------------------------------------------------
  // Journalism / aggregators
  // ---------------------------------------------------------------------------
  {
    name: "404 Media",
    url: "https://www.404media.co/rss/",
    homepage: "https://www.404media.co/",
    topic: "Tech",
    type: "article",
  },
  {
    name: "Rest of World",
    url: "https://restofworld.org/feed/latest/",
    homepage: "https://restofworld.org/",
    topic: "Tech",
    type: "article",
  },
  {
    name: "Techmeme",
    url: "https://www.techmeme.com/feed.xml",
    homepage: "https://www.techmeme.com/",
    topic: "Tech",
    type: "article",
  },
  {
    name: "The Pragmatic Engineer",
    url: "https://newsletter.pragmaticengineer.com/feed",
    homepage: "https://newsletter.pragmaticengineer.com/",
    topic: "Tech",
    type: "article",
  },
  {
    name: "Lobsters",
    url: "https://lobste.rs/rss",
    homepage: "https://lobste.rs/",
    topic: "Tech",
    type: "article",
  },

  // ---------------------------------------------------------------------------
  // Biotech + space fill-ins
  // ---------------------------------------------------------------------------
  {
    name: "STAT News",
    url: "https://www.statnews.com/feed/",
    homepage: "https://www.statnews.com/",
    topic: "Biotech",
    type: "article",
  },
  {
    name: "Century of Bio (Elliot Hershberg)",
    url: "https://centuryofbio.substack.com/feed",
    homepage: "https://www.centuryofbio.com/",
    topic: "Biotech",
    type: "article",
  },
  {
    name: "The Orbital Index",
    url: "https://orbitalindex.com/feed.xml",
    homepage: "https://orbitalindex.com/",
    topic: "Space",
    type: "article",
  },

  // ---------------------------------------------------------------------------
  // Podcasts (lightweight: surface new episodes + their own descriptions)
  // ---------------------------------------------------------------------------
  {
    name: "Dwarkesh Podcast",
    url: "https://api.substack.com/feed/podcast/69345.rss",
    homepage: "https://www.dwarkesh.com/",
    topic: "AI",
    type: "podcast",
  },
  {
    name: "Cheeky Pint (Stripe / John Collison)",
    url: "https://feeds.transistor.fm/cheeky-pint-with-john-collison",
    homepage: "https://cheekypint.substack.com/",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "Latent Space",
    url: "https://api.substack.com/feed/podcast/1084089.rss",
    homepage: "https://www.latent.space/",
    topic: "AI",
    type: "podcast",
  },
  {
    name: "No Priors",
    url: "https://feeds.megaphone.fm/nopriors",
    homepage: "https://www.no-priors.com/",
    topic: "AI",
    type: "podcast",
  },
  {
    name: "The Cognitive Revolution",
    url: "https://feeds.megaphone.fm/RINTP3108857801",
    homepage: "https://www.cognitiverevolution.ai/",
    topic: "AI",
    type: "podcast",
  },
  {
    name: "Machine Learning Street Talk",
    url: "https://anchor.fm/s/1e4a0eac/podcast/rss",
    homepage: "https://www.youtube.com/@MachineLearningStreetTalk",
    topic: "AI",
    type: "podcast",
  },
  {
    name: "Lex Fridman Podcast",
    url: "https://lexfridman.com/feed/podcast/",
    homepage: "https://lexfridman.com/podcast/",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "BG2 Pod",
    url: "https://anchor.fm/s/f06c2370/podcast/rss",
    homepage: "https://www.bg2pod.com/",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "Acquired",
    url: "https://feeds.transistor.fm/acquired",
    homepage: "https://www.acquired.fm/",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "Complex Systems (Patrick McKenzie)",
    url: "https://feeds.transistor.fm/complex-systems-with-patrick-mckenzie-patio11",
    homepage: "https://www.complexsystemspodcast.com/",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "Stratechery / Sharp Tech",
    url: "https://sharptech.fm/feed/podcast",
    homepage: "https://sharptech.fm/",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "ChinaTalk",
    url: "https://feeds.megaphone.fm/CHTAL4990341033",
    homepage: "https://www.chinatalk.media/",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "Moonshots (Peter Diamandis)",
    url: "https://feeds.megaphone.fm/DVVTS2890392624",
    homepage: "https://www.diamandis.com/podcast",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "Titans of Nuclear",
    url: "https://rss.libsyn.com/shows/107828/destinations/585143.xml",
    homepage: "https://www.titansofnuclear.com/",
    topic: "Nuclear",
    type: "podcast",
  },
  {
    name: "Decouple",
    url: "https://anchor.fm/s/23775178/podcast/rss",
    homepage: "https://www.decouple.media/",
    topic: "Nuclear",
    type: "podcast",
  },

  // Founders / VC / tech-business shows
  {
    name: "Founders (David Senra)",
    url: "https://feeds.megaphone.fm/DSLLC6297708582",
    homepage: "https://www.founderspodcast.com/",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "TBPN",
    url: "https://feeds.transistor.fm/technology-brother",
    homepage: "https://www.tbpn.com/",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "All-In",
    url: "https://rss.libsyn.com/shows/254861/destinations/1928300.xml",
    homepage: "https://www.allinpodcast.co/",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "Invest Like the Best",
    url: "https://feeds.megaphone.fm/CLS2859450455",
    homepage: "https://www.joincolossus.com/",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "Odd Lots",
    url: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/8a94442e-5a74-4fa2-8b8d-ae27003a8d6b/982f5071-765c-403d-969d-ae27003a8d83/podcast.rss",
    homepage: "https://www.bloomberg.com/oddlots",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "Hard Fork",
    url: "https://feeds.simplecast.com/6HKOhNgS",
    homepage: "https://www.nytimes.com/column/hard-fork",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "My First Million",
    url: "https://feeds.megaphone.fm/HS2300184645",
    homepage: "https://www.mfmpod.com/",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "The Twenty Minute VC (20VC)",
    url: "https://rss.libsyn.com/shows/61840/destinations/240976.xml",
    homepage: "https://www.thetwentyminutevc.com/",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "This Week in Startups",
    url: "https://rss.libsyn.com/shows/624860/destinations/5500155.xml",
    homepage: "https://thisweekinstartups.com/",
    topic: "Tech",
    type: "podcast",
  },

  // More tech / VC / intellectual + topic-gap fillers (science, space, biotech)
  {
    name: "Conversations with Tyler",
    url: "https://rss.libsyn.com/shows/137081/destinations/850607.xml",
    homepage: "https://conversationswithtyler.com/",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "The Logan Bartlett Show",
    url: "https://rss2.flightcast.com/jlx9l0yn04wt3r710o051jtm.xml",
    homepage: "https://www.theloganbartlettshow.com/",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "In Good Company (Nicolai Tangen)",
    url: "https://feeds.acast.com/public/shows/622618c7057f3400120d15db",
    homepage: "https://www.nbim.no/en/in-good-company/",
    topic: "Tech",
    type: "podcast",
  },
  {
    name: "Training Data (Sequoia)",
    url: "https://feeds.megaphone.fm/trainingdata",
    homepage: "https://www.sequoiacap.com/podcast/",
    topic: "AI",
    type: "podcast",
  },
  {
    name: "Unsupervised Learning (Jacob Effron)",
    url: "https://feeds.simplecast.com/dOSE_bdP",
    homepage: "https://www.redpoint.com/",
    topic: "AI",
    type: "podcast",
  },
  {
    name: "The Gradient Podcast",
    url: "https://rss.beehiiv.com/podcasts/01a03a01-bfe5-71a6-90b6-3bce8d91403e.xml",
    homepage: "https://thegradientpub.substack.com/",
    topic: "AI",
    type: "podcast",
  },
  {
    name: "80,000 Hours Podcast",
    url: "https://feeds.transistor.fm/80000-hours-podcast",
    homepage: "https://80000hours.org/podcast/",
    topic: "AI",
    type: "podcast",
  },
  {
    name: "Sean Carroll's Mindscape",
    url: "https://rss.libsyn.com/shows/604590/destinations/5264190.xml",
    homepage: "https://www.preposterousuniverse.com/podcast/",
    topic: "Science",
    type: "podcast",
  },
  {
    name: "Main Engine Cut Off",
    url: "https://feeds.simplecast.com/Zg9AF5cA",
    homepage: "https://mainenginecutoff.com/",
    topic: "Space",
    type: "podcast",
  },
  {
    name: "Raising Health (a16z Bio + Health)",
    url: "https://feeds.simplecast.com/BXDamaKF",
    homepage: "https://a16z.com/podcasts/",
    topic: "Biotech",
    type: "podcast",
  },
  {
    name: "1000x",
    url: "https://anchor.fm/s/112316ec0/podcast/rss",
    homepage: "https://1000xpod.com/",
    topic: "Blockchain",
    type: "podcast",
  },

  // Science podcasts
  {
    name: "The Quanta Podcast",
    url: "https://quantapodcast.quantamagazine.org/",
    homepage: "https://www.quantamagazine.org/tag/podcast/",
    topic: "Science",
    type: "podcast",
  },
  {
    name: "The Joy of Why (Quanta)",
    url: "https://joy.quantamagazine.org/",
    homepage: "https://www.quantamagazine.org/tag/the-joy-of-why/",
    topic: "Science",
    type: "podcast",
  },
  {
    name: "Nature Podcast",
    url: "https://feeds.acast.com/public/shows/0185cea5-9e3b-4b82-a887-26f91f92765f",
    homepage: "https://www.nature.com/nature/articles?type=nature-podcast",
    topic: "Science",
    type: "podcast",
  },
  {
    name: "Science Magazine Podcast",
    url: "https://feeds.megaphone.fm/AAAS8717073854",
    homepage: "https://www.science.org/podcasts",
    topic: "Science",
    type: "podcast",
  },
  {
    name: "Complexity (Santa Fe Institute)",
    url: "https://feeds.simplecast.com/OzDH_At2",
    homepage: "https://www.santafe.edu/culture/podcasts",
    topic: "Science",
    type: "podcast",
  },
  {
    name: "The Origins Podcast (Lawrence Krauss)",
    url: "https://api.substack.com/feed/podcast/745084.rss",
    homepage: "https://lawrencekrauss.substack.com/",
    topic: "Science",
    type: "podcast",
  },
  {
    name: "Daniel and Jorge Explain the Universe",
    url: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/56cec8f5-8977-4ae9-99c6-b1ed00fe8598/f9937580-972b-4006-b6ca-b1ed00feb864/podcast.rss",
    homepage: "https://www.danielandjorge.com/",
    topic: "Science",
    type: "podcast",
  },
  {
    name: "Physics World Weekly",
    url: "https://physicsworld.com/feed/podcast-weekly/",
    homepage: "https://physicsworld.com/audio-and-video/",
    topic: "Science",
    type: "podcast",
  },
  {
    name: "The Infinite Monkey Cage",
    url: "https://podcasts.files.bbci.co.uk/b00snr0w.rss",
    homepage: "https://www.bbc.co.uk/programmes/b00snr0w",
    topic: "Science",
    type: "podcast",
  },
  {
    name: "Big Biology",
    url: "https://api.substack.com/feed/podcast/120946.rss",
    homepage: "https://www.bigbiology.org/",
    topic: "Science",
    type: "podcast",
  },
  {
    name: "The Smart Economy Podcast",
    url: "https://feeds.fame.so/the-smart-economy-podcast",
    homepage: "https://www.smarteconomypodcast.com/",
    topic: "Blockchain",
    type: "podcast",
  },
];
