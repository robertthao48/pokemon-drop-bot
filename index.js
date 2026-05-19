require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const fs = require('fs');

const TRACK_FILE = './tracked.json';

function loadData() {
  return JSON.parse(fs.readFileSync(TRACK_FILE));
}

function saveData(data) {
  fs.writeFileSync(TRACK_FILE, JSON.stringify(data, null, 2));
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log('🚨 Pokémon monitor running every 15 seconds.');
});

function getPrice(text) {
  const match = text.match(/\$([0-9]+(\.[0-9]{2})?)/);
  return match ? parseFloat(match[1]) : null;
}

function detectStatus(text) {
  const lower = text.toLowerCase();

  if (
    lower.includes('store only') ||
    lower.includes('in store only') ||
    lower.includes('available in store')
  ) return 'IN STORE ONLY';

  if (
    lower.includes('online only') ||
    lower.includes('shipping only')
  ) return 'ONLINE ONLY';

  if (
    lower.includes('pickup only')
  ) return 'PICKUP ONLY';

  if (
    lower.includes('add to cart') ||
    lower.includes('in stock') ||
    lower.includes('available now') ||
    lower.includes('pickup today') ||
    lower.includes('shipping available') ||
    lower.includes('available for delivery')
  ) return 'IN STOCK';

  if (
    lower.includes('preorder') ||
    lower.includes('pre-order') ||
    lower.includes('pre order')
  ) return 'PREORDER';

  if (lower.includes('coming soon')) return 'COMING SOON';

  if (
    lower.includes('sold out') ||
    lower.includes('out of stock') ||
    lower.includes('unavailable') ||
    lower.includes('not available')
  ) return 'OUT OF STOCK';

  return 'LISTING FOUND';
}

function isBuyable(status) {
  return [
    'IN STOCK',
    'PREORDER',
    'COMING SOON',
    'LISTING FOUND',
    'IN STORE ONLY',
    'ONLINE ONLY',
    'PICKUP ONLY'
  ].includes(status);
}

function searchLinks(item, zip = '95823') {
  const q = encodeURIComponent(item);
  const nearby = encodeURIComponent(`${item} in stock near ${zip}`);

  return `
Target:
https://www.target.com/s?searchTerm=${q}

Walmart:
https://www.walmart.com/search?q=${q}

Best Buy:
https://www.bestbuy.com/site/searchpage.jsp?st=${q}

GameStop:
https://www.gamestop.com/search/?q=${q}

Amazon:
https://www.amazon.com/s?k=${q}

Costco:
https://www.costco.com/CatalogSearch?keyword=${q}

Sam's Club:
https://www.samsclub.com/s/${q}

Google Nearby:
https://www.google.com/search?q=${nearby}
`;
}

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const args = message.content.trim().split(' ');
  const command = args[0].toLowerCase();
  const data = loadData();

  if (command === '!help') {
    return message.reply(`
**Pokémon Bot Commands**

!test
!track pokemon 151
!untrack pokemon 151
!tracked
!zipcode 95823
!nearby pokemon 151
!instore pokemon 151
!pickup pokemon 151
!costco pokemon
!stores
!monitors
!links
!news
!upcoming
!msrp
!drops
!sets
!retail
!live
!live on
!live off
!checknow
!clearalerts
`);
  }

  if (command === '!test') {
    return message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('🚨 TEST ALERT')
          .setDescription('Bot is working correctly.')
          .setColor('Red')
          .setTimestamp()
      ]
    });
  }

  if (command === '!track') {
    const keyword = args.slice(1).join(' ').toLowerCase();
    if (!keyword) return message.reply('Example: !track pokemon 151');

    if (!data.keywords.includes(keyword)) {
      data.keywords.push(keyword);
      saveData(data);
    }

    return message.reply(`✅ Tracking: ${keyword}`);
  }

  if (command === '!untrack') {
    const keyword = args.slice(1).join(' ').toLowerCase();
    if (!keyword) return message.reply('Example: !untrack pokemon 151');

    data.keywords = data.keywords.filter(k => k !== keyword);
    saveData(data);

    return message.reply(`❌ Removed: ${keyword}`);
  }

  if (command === '!tracked') {
    return message.reply(`📦 **Tracked Keywords:**\n${data.keywords.join('\n')}`);
  }

  if (command === '!zipcode') {
    const zip = args[1];
    if (!zip) return message.reply('Example: !zipcode 95823');

    data.zipcode = zip;
    saveData(data);

    return message.reply(`✅ ZIP saved: ${zip}`);
  }

  if (command === '!nearby') {
    const item = args.slice(1).join(' ');
    if (!item) return message.reply('Example: !nearby pokemon 151');

    return message.reply(`🔎 **Local Search for ${item} near ${data.zipcode || '95823'}**\n${searchLinks(item, data.zipcode || '95823')}`);
  }

  if (command === '!instore') {
    const item = args.slice(1).join(' ');
    if (!item) return message.reply('Example: !instore pokemon 151');

    return message.reply(`🏬 **In-Store / Pickup Search**\n${searchLinks(item, data.zipcode || '95823')}`);
  }

  if (command === '!pickup') {
    const item = args.slice(1).join(' ');
    if (!item) return message.reply('Example: !pickup pokemon 151');

    const q = encodeURIComponent(item);

    return message.reply(`
🛒 **Pickup / Same-Day Options**

Best Buy:
https://www.bestbuy.com/site/searchpage.jsp?st=${q}

Target:
https://www.target.com/s?searchTerm=${q}

GameStop:
https://www.gamestop.com/search/?q=${q}

Walmart:
https://www.walmart.com/search?q=${q}
`);
  }

  if (command === '!costco') {
    const item = args.slice(1).join(' ') || 'pokemon';
    const q = encodeURIComponent(item);
    const google = encodeURIComponent(`Costco ${item} near ${data.zipcode || '95823'}`);

    return message.reply(`
🏪 **Costco Pokémon Search**

Costco:
https://www.costco.com/CatalogSearch?keyword=${q}

Google nearby:
https://www.google.com/search?q=${google}

Tip: Costco Pokémon can be warehouse-only, so online may not show everything.
`);
  }

  if (command === '!stores') {
    const zip = encodeURIComponent(data.zipcode || '95823');

    return message.reply(`
🏪 **Store Locators**

Target:
https://www.target.com/store-locator/find-stores?address=${zip}

Walmart:
https://www.walmart.com/store-finder?location=${zip}

Best Buy:
https://www.bestbuy.com/site/store-locator

GameStop:
https://www.gamestop.com/store/us

Costco:
https://www.costco.com/warehouse-locations

Sam's Club:
https://www.samsclub.com/club-locator
`);
  }

  if (command === '!monitors') {
    return message.reply(`
🏪 **Stores Monitored**

✅ Pokémon Center
✅ Target
✅ Walmart
✅ Best Buy
✅ GameStop
✅ Costco
✅ Sam's Club

Status Detection:
✅ In Stock
✅ Out of Stock
✅ Preorder
✅ Coming Soon
✅ Listing Found
`);
  }

  if (command === '!links') {
    return message.reply(searchLinks('pokemon cards', data.zipcode || '95823'));
  }

  if (command === '!news') {
    return message.reply(`
📰 **Pokémon News**

PokéBeach:
https://www.pokebeach.com/

Official Pokémon News:
https://www.pokemon.com/us/pokemon-news

Reddit Deals:
https://www.reddit.com/r/PKMNTCGDeals/
`);
  }

  if (command === '!upcoming') {
    return message.reply(`
📅 **Upcoming Pokémon Releases**

PokéBeach:
https://www.pokebeach.com/

Pokémon Center:
https://www.pokemoncenter.com/category/trading-card-game

Google:
https://www.google.com/search?q=upcoming+pokemon+tcg+releases
`);
  }

  if (command === '!msrp') {
    return message.reply(`
💰 **Pokémon MSRP Guide**

ETB: $49.99
Booster Bundle: $26.99 - $29.99
Booster Box: $110 - $165
Premium Collection: $39.99 - $59.99
Ultra Premium Collection: $89.99 - $129.99
Collection Box: $21.99 - $34.99
Mini Tin: $8.99 - $12.99

⚠️ Prices way above these are usually reseller/scalper prices.
`);
  }

  if (command === '!drops') {
    return message.reply(`
🔥 **Drop Types Monitored**

✅ Online drops
✅ Restocks
✅ In-stock listings
✅ Preorders
✅ Coming soon listings
✅ In-store search links
✅ Pickup search links
`);
  }

  if (command === '!sets') {
    return message.reply(`
📦 **Popular Pokémon Sets / Products**

✅ Pokémon 151
✅ Prismatic Evolutions
✅ Surging Sparks
✅ Chaos Rising
✅ Mega Evolution
✅ Booster Bundles
✅ ETBs
✅ Booster Boxes
✅ Premium Collections
✅ UPCs
`);
  }

  if (command === '!retail') {
    return message.reply(`
🛒 **Retail Pokémon Stores**

Pokémon Center:
https://www.pokemoncenter.com/

Target:
https://www.target.com/

Walmart:
https://www.walmart.com/

Best Buy:
https://www.bestbuy.com/

GameStop:
https://www.gamestop.com/

Costco:
https://www.costco.com/

Sam's Club:
https://www.samsclub.com/
`);
  }

  if (command === '!live') {
    const option = args[1];

    if (option === 'on') {
      data.live = true;
      saveData(data);
      return message.reply('✅ Live monitoring ON');
    }

    if (option === 'off') {
      data.live = false;
      saveData(data);
      return message.reply('❌ Live monitoring OFF');
    }

    return message.reply(`Live monitoring: ${data.live ? 'ON' : 'OFF'}`);
  }

  if (command === '!clearalerts') {
    data.sent = [];
    data.stockMemory = {};
    saveData(data);
    return message.reply('✅ Alert and stock memory cleared');
  }

  if (command === '!checknow') {
    await runMonitor(true, message.channel);
    return message.reply('🔎 Manual scan complete');
  }
});

async function scrapeStore(store, url, baseUrl) {
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const $ = cheerio.load(response.data);
    const products = [];

    $('a').each((i, el) => {
      const title = $(el).text().replace(/\s+/g, ' ').trim();
      const href = $(el).attr('href');
      const surroundingText = $(el).parent().text().replace(/\s+/g, ' ').trim();
      const combinedText = `${title} ${surroundingText}`;
      const price = getPrice(combinedText);
      const status = detectStatus(combinedText);

      if (
        title &&
        href &&
        title.toLowerCase().includes('pokemon') &&
        title.length < 200
      ) {
        products.push({
          title,
          store,
          price,
          status,
          link: href.startsWith('http') ? href : `${baseUrl}${href}`
        });
      }
    });

    return products;
  } catch (err) {
    console.log(`❌ Failed checking ${store}`);
    return [];
  }
}

async function getAllProducts() {
  const all = [];

  all.push(...await scrapeStore('Pokémon Center', 'https://www.pokemoncenter.com/category/trading-card-game', 'https://www.pokemoncenter.com'));
  all.push(...await scrapeStore('Target', 'https://www.target.com/s?searchTerm=pokemon+cards', 'https://www.target.com'));
  all.push(...await scrapeStore('Walmart', 'https://www.walmart.com/search?q=pokemon%20cards', 'https://www.walmart.com'));
  all.push(...await scrapeStore('Best Buy', 'https://www.bestbuy.com/site/searchpage.jsp?st=pokemon%20cards', 'https://www.bestbuy.com'));
  all.push(...await scrapeStore('GameStop', 'https://www.gamestop.com/search/?q=pokemon%20cards', 'https://www.gamestop.com'));
  all.push(...await scrapeStore('Costco', 'https://www.costco.com/CatalogSearch?keyword=pokemon', 'https://www.costco.com'));
  all.push(...await scrapeStore("Sam's Club", 'https://www.samsclub.com/s/pokemon', 'https://www.samsclub.com'));

  return all;
}

async function sendAlert(channel, product, type) {
  const embed = new EmbedBuilder()
    .setTitle(type === 'restock' ? '🔁 POKÉMON RESTOCK ALERT' : '🚨 POKÉMON STOCK ALERT')
    .setDescription(product.title)
    .setURL(product.link)
    .addFields(
      { name: 'Store', value: product.store },
      { name: 'Status', value: product.status || 'Unknown' },
      { name: 'Price', value: product.price ? `$${product.price}` : 'Unknown' }
    )
    .setColor(type === 'restock' ? 'Green' : 'Blue')
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

async function runMonitor(manual = false, manualChannel = null) {
  const data = loadData();

  if (!data.live && !manual) return;

  if (!data.sent) data.sent = [];
  if (!data.stockMemory) data.stockMemory = {};

  const products = await getAllProducts();

  const matches = products.filter(product => {
    const title = product.title.toLowerCase();

    const keywordMatch = data.keywords.some(keyword =>
      title.includes(keyword.toLowerCase())
    );

    return keywordMatch && isBuyable(product.status);
  });

  if (manual && manualChannel) {
    await manualChannel.send(
      matches.length
        ? `Found ${matches.length} possible tracked product(s).`
        : 'No tracked products found right now.'
    );
  }

  for (const guild of client.guilds.cache.values()) {
    const channel =
      manualChannel ||
      guild.channels.cache.find(c => c.name === 'pokemon-alerts');

    if (!channel) continue;

    for (const product of matches) {
      const key = `${product.store}-${product.link}`;
      const wasSeenBefore = data.stockMemory[key] === true;

      data.stockMemory[key] = true;

      if (!data.sent.includes(key)) {
        data.sent.push(key);
        saveData(data);

        await sendAlert(channel, product, wasSeenBefore ? 'restock' : 'stock');
      }
    }
  }

  saveData(data);
}

cron.schedule('*/1 * * * * ', async () => {
  await runMonitor(false);
});

client.login(process.env.DISCORD_TOKEN);