const {Intents} = require('discord.js');
const {FLAGS: bits} = Intents;

const intents = new Intents();
intents.add(
	bits.GUILDS,
	bits.GUILD_BANS,
	bits.GUILD_MESSAGES,
	bits.GUILD_MESSAGE_REACTIONS,
	bits.DIRECT_MESSAGES,
	bits.DIRECT_MESSAGE_REACTIONS
);
intents.freeze();

module.exports = intents;