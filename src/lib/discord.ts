const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

export async function sendChannelMessage(channelId: string, content: string) {
  if (!DISCORD_BOT_TOKEN) throw new Error("DISCORD_BOT_TOKEN is not set");
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    throw new Error(`Discord send message failed: ${res.status} ${await res.text()}`);
  }
}

// Interaction follow-up webhooks are authenticated by the token in the URL,
// not by the bot token — no Authorization header here.
export async function sendInteractionFollowup(applicationId: string, interactionToken: string, content: string) {
  const res = await fetch(
    `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }
  );
  if (!res.ok) {
    throw new Error(`Discord follow-up failed: ${res.status} ${await res.text()}`);
  }
}
