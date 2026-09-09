const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!APPLICATION_ID || !BOT_TOKEN) {
  console.error("Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN before running this.");
  process.exit(1);
}

const commands = [
  {
    name: "triage",
    description: "Ask the AI to triage a broken automation",
    options: [
      {
        name: "automation",
        description: "Name of the automation that's broken",
        type: 3, // STRING
        required: true,
      },
      {
        name: "details",
        description: "What's happening — error message, symptoms, when it started",
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: "status",
    description: "List active/paused/erroring automations from Make.com",
  },
];

// Guild-scoped commands show up instantly; global commands can take up to an
// hour to propagate. Set DISCORD_GUILD_ID to register only to your server.
const url = GUILD_ID
  ? `https://discord.com/api/v10/applications/${APPLICATION_ID}/guilds/${GUILD_ID}/commands`
  : `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;

const res = await fetch(url, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${BOT_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commands),
});

if (!res.ok) {
  console.error(`Failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}

console.log(`Registered ${GUILD_ID ? "guild" : "global"} commands:`, await res.json());
