/* LUMEN8 site - every module on the platform, in the order the wheel shows them.
 *
 * Mirrors the platform's own product list (the Home wheel in the app): the same
 * fifteen modules, the same pitch. Grouped here by the pillar of sustainable
 * development each one serves, so the wheel reads as five arcs rather than a
 * list. `scene` names the diorama in ./dioramas/ when it is not the id; `href`
 * is where the site explains the module in depth.
 *
 * Status is stated plainly: live; early access (it runs, but on demonstration
 * data, one market, or with its heavier stages still to come); or in
 * development (on the roadmap, nothing calculated yet). The platform's own
 * Home is more generous; the site says only what a buyer could use today.
 */
export const PILLARS = [
  { id: 'power', name: 'Clean power', color: 'var(--p-power)', sdgs: [7, 13] },
  { id: 'access', name: 'Energy access', color: 'var(--p-access)', sdgs: [1, 7, 10] },
  { id: 'land', name: 'Food, land & water', color: 'var(--p-land)', sdgs: [2, 6, 14, 15] },
  { id: 'trade', name: 'Connectivity & trade', color: 'var(--p-trade)', sdgs: [9, 12] },
  { id: 'intel', name: 'Intelligence & impact', color: 'var(--p-intel)', sdgs: [13, 17] },
];

export const SDG = {
  1: 'No poverty', 2: 'Zero hunger', 6: 'Clean water and sanitation', 7: 'Affordable and clean energy',
  8: 'Decent work and economic growth', 9: 'Industry, innovation and infrastructure', 10: 'Reduced inequalities',
  12: 'Responsible consumption and production', 13: 'Climate action', 14: 'Life below water', 15: 'Life on land',
  17: 'Partnerships for the goals',
};

export const STATUS = { live: 'Live', early: 'Early access', soon: 'In development' };

export const MODULES = [
  { id: 'utility', pillar: 'power', title: 'Utility', tag: 'Utility-scale solar + storage', status: 'live', sdgs: [7, 13, 9],
    href: '/utility-scale.html',
    pitch: 'Draw a boundary anywhere on Earth. Get the tracker layout, the electrical design, the yield, the storage, the cost and the drawing set.',
    does: ['Auto-layout from a boundary', 'Hourly yield and storage dispatch', 'Grid connection and cabling'] },
  { id: 'wind', pillar: 'power', title: 'Wind', tag: 'Wind atlas and siting', status: 'live', sdgs: [7, 13],
    href: '/modules.html#wind',
    pitch: 'Wind resource, turbine choice and energy yield from one click on the map, down to the wake each turbine casts on the next.',
    does: ['Wind atlas at 50 to 200 m', '174 turbine models compared', 'Farm layout net of wake losses'] },
  { id: 'hydro', scene: 'hydropower', pillar: 'power', title: 'Hydro', tag: 'Run-of-river hydropower', status: 'early', sdgs: [7, 6, 13],
    href: '/modules.html#hydro',
    pitch: 'Pin a river. The catchment is traced from terrain, the flow is graded, and a weir, waterway and powerhouse are designed and costed.',
    does: ['Catchment traced from terrain', 'Flow-duration curve, graded A to E', 'Auto-designed scheme, CAPEX and LCOE'] },
  { id: 'geothermal', pillar: 'power', title: 'Geothermal', tag: 'Subsurface heat', status: 'early', sdgs: [7, 13],
    href: '/modules.html#geothermal',
    pitch: 'Find the heat underground, from prospect discovery to drill targets, sized statistically before anyone pays for a well.',
    does: ['Thermal, gravity and fault layers', 'P90 · P50 · P10 resource', 'Drill-target shortlist'] },

  { id: 'village', scene: 'energy', pillar: 'access', title: 'Village', tag: 'Rural electrification', status: 'live', sdgs: [7, 1, 8],
    href: '/rural-electrification.html',
    pitch: 'Find, size and finance solar mini-grids for the villages still without reliable power, then engineer them house by house.',
    does: ['8,493 villages screened', 'Mini-grid sizing and 3D twin', 'Bankable feasibility dossier'] },
  { id: 'twin', pillar: 'access', title: 'Behavioural Twin', tag: 'Household simulation', status: 'live', sdgs: [1, 8, 10],
    href: '/modules.html#twin',
    pitch: 'A living model of how a community uses power. Test tariffs and appliances before you build, and measure impact after.',
    does: ['Agent-based households', 'Counterfactual scenarios', 'Hold-out back-testing'] },

  { id: 'agri', pillar: 'land', title: 'Agri', tag: 'Fields from orbit', status: 'live', sdgs: [2, 15, 13],
    href: '/modules.html#agriculture',
    pitch: 'Every field from orbit: what is growing, how stressed it is, and what the pumps, mills and cold stores around it need.',
    does: ['Satellite crop monitoring', 'Field boundaries by crop', 'Water and yield signals'] },
  { id: 'agrivoltaics', pillar: 'land', title: 'Agrivoltaics', tag: 'Crops under solar', status: 'live', sdgs: [2, 7, 15],
    href: '/modules.html#agrivoltaics',
    pitch: 'Grow food and power on the same land, with light, shade, water and yield modelled under the panels, and the farmer’s offer priced.',
    does: ['35 crops, 5 structure types', 'Light, shade and water model', 'Checked against 12 national rule sets'] },
  { id: 'aqua', pillar: 'land', title: 'Aqua', tag: 'Aquaculture', status: 'soon', sdgs: [14, 2],
    href: '/modules.html#aqua',
    pitch: 'On the roadmap: fish and shrimp farms sized and powered, from the water to the market.',
    does: ['Pond, pen and tank screening', 'Aeration and cold-chain energy', 'Floating solar'] },
  { id: 'hydroponics', pillar: 'land', title: 'Hydroponics', tag: 'Soil-free growing', status: 'soon', sdgs: [2, 6, 12],
    href: '/modules.html#hydroponics',
    pitch: 'On the roadmap: soil-free growing designed end to end, with the channels, lighting, climate and power behind it.',
    does: ['NFT and vertical rack layout', 'Lighting and climate energy', 'Crop-cycle economics'] },

  { id: 'telco', pillar: 'trade', title: 'Telco', tag: 'Tower power', status: 'live', sdgs: [9, 13, 7],
    href: '/modules.html#telecoms',
    pitch: 'Take telecom towers off diesel, with coverage gaps, the solar and storage retrofit and the carbon it saves mapped per site.',
    does: ['34,371 tower sites scored', 'Solar and storage retrofit sizing', 'Diesel and carbon displaced'] },
  { id: 'maritime', pillar: 'trade', title: 'Marine', tag: 'Ports and shore power', status: 'live', sdgs: [14, 9, 13],
    href: '/modules.html#maritime',
    pitch: 'Every berth on one map, and shore power sized for the vessels that actually call, with the cable route and the business case.',
    does: ['5,018 port facilities', 'Berth-level 3D twin', 'Shore-power business case'] },
  { id: 'supply', pillar: 'trade', title: 'Supply Chain', tag: 'Factory to site', status: 'early', sdgs: [12, 9, 8],
    href: '/modules.html#supply',
    pitch: 'From factory to site: market prices, quotes compared, landed cost and the shipment, for the equipment every design calls for.',
    does: ['52 equipment families', 'Quotes compared and awarded', 'Landed cost and freight lanes'] },

  { id: 'portfolio', pillar: 'intel', title: 'Portfolio', tag: 'Fleet operations', status: 'early', sdgs: [13, 17, 7],
    href: '/modules.html#portfolio',
    pitch: 'Every site you have built, in one cockpit: generation, storage, load, maintenance, impact and economics, each figure tagged with its source.',
    does: ['Fourteen views of the fleet', 'Impact: households, productive use, carbon', '3D plant with sun playback'] },
  { id: 'jarvis', pillar: 'intel', title: 'Jarvis', tag: 'Voice intelligence', status: 'live', sdgs: [9, 17],
    href: '/modules.html#jarvis',
    pitch: 'Talk to the platform. Jarvis opens any module or place, reads the screen, explains the numbers and answers out loud.',
    does: ['Self-hosted speech and AI', 'Drives every module by voice', 'Never presses pay, send or delete'] },
];

export const pillarOf = (m) => PILLARS.find((p) => p.id === m.pillar);
