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

// Discord caps a message at 2000 characters. Splits on line breaks so a long
// report (e.g. the daily digest) arrives as several messages instead of failing.
export async function sendLongChannelMessage(channelId: string, content: string) {
  const LIMIT = 1900;
  const chunks: string[] = [];
  let current = "";
  for (const line of content.split("\n")) {
    const piece = line.length > LIMIT ? `${line.slice(0, LIMIT - 1)}…` : line;
    if (current && current.length + 1 + piece.length > LIMIT) {
      chunks.push(current);
      current = piece;
    } else {
      current = current ? `${current}\n${piece}` : piece;
    }
  }
  if (current) chunks.push(current);

  for (const chunk of chunks) {
    await sendChannelMessage(channelId, chunk);
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
