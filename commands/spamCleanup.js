module.exports = {
	name: 'munclean',
	description: 'Cleans command and bot spam. Also triggered by munclear, because Victor can\'t remember the actual name half the time.',
	metacommand: true,
	allowedUsers: (args, msg, groups) => groups.isAllowedToSet(msg.guild, groups.HAS_BOT_ACCESS, msg.member),
	alias(command, args, msg) {
		if(command === 'munclear') command = 'munclean';
		return [command, args, msg];
	},
	execute(msg, args) {
		const origChannel = msg.channel;
		const server = origChannel.guild;
		if(!server.available) return;
		let commands = args.shift();
		origChannel.messages.fetch({limit: 100}).then(messages => {
			let deletableMessages = messages.filter(message => {
				if(message.author.bot) return true;
				let messageText = message.content;
				if(messageText.startsWith('?') && messageText.indexOf(' ') + 1 < messageText.length) messageText = messageText.substring(messageText.indexOf(' ') + 1);
				if(messageText.startsWith('!') || messageText.startsWith('$') || messageText.startsWith('<@!718870675921698836>') || messageText.startsWith('<@718870675921698836>') || messageText.toLowerCase().startsWith('munclear')) return true;
				let command = messageText.split(/ +/).shift().toLowerCase();
				return commands.has(command);
			});
			origChannel.bulkDelete(deletableMessages, true).catch(process.log);
		});
	},
};
