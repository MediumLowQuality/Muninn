const {commandAllowedInChannel, commandAllowedByUser} = require('./commandPermissions');

module.exports = {
	name: 'listcommands',
	description: 'Lists what commands this user has access to. Also triggered by pinging the bot.',
	metacommand: true,
	alias(command, args, msg) {
		const BOT = process.env.BOT;
		if(command.startsWith(`<@!${BOT}>`) || command.startsWith(`<@${BOT}>`)) command = 'listcommands';
		return [command, args, msg];
	},
	execute(msg, args) {
		const commands = args.shift();
		const origChannel = msg.channel;
		const server = origChannel.guild;
		if(!server.available) return;
		const author = msg.member, authorID = msg.member.id;
		let munComms = Array.from(commands.keys());
		let messageContents = commands.filter(comm => commandAllowedByUser(comm, author, args, msg))
		.map(comm => `${comm.name}: ${comm.description}${comm.allowedChannels && Array.isArray(comm.allowedChannels)? ' Allowed in ' + comm.allowedChannels.join(', ') + '.':''}`).join('\r\n');
		origChannel.send(`${author}, you have access to the following commands:\r\n${messageContents}`);
	},
};
