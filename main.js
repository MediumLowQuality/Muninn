require('dotenv').config();
const Discord = require('discord.js');
const botCommands = require('./commands');
const util = require('util');
const ADMIN = process.env.ADMIN;
const AUXADMIN = process.env.AUXADMIN;
const BOT = process.env.BOT;
const baseServer = process.env.BASESERVER;
const munLog = process.env.LOGCHANNEL;
let bot = undefined;
let groups = undefined;
process.isAdmin = (id) => (id === process.env.ADMIN || id === process.env.AUXADMIN);

function initializeBot(){
	if(bot !== undefined) return bot;
	
	bot = new Discord.Client();
	bot.commands = new Discord.Collection();
	bot.commandAliases = [];
	Object.keys(botCommands).map(key => {
		bot.commands.set(botCommands[key].name, botCommands[key]);
		if(botCommands[key].alias !== undefined) bot.commandAliases.push(botCommands[key].alias);
	});
	return bot;
}

function loggedIn(){
	groups = bot.commands.get('munset').groups;
	console.info(`Logged in as ${bot.user.tag}!`);
	bot.guilds.fetch(baseServer).then(server => {
		const logChannel = server.channels.resolve(munLog);
		process.log = (str) => logChannel.send(typeof str === 'string'? str: util.format(str))
		.catch(error => console.log(`${str} failed to send.\r\n${error}`));
	});
}

function handleMessage(msg){
	const chan = msg.channel.name;
	const author = msg.author.id;
	if(author === BOT) return;
	if(!msg.content || msg.content === "") return;
	let args = msg.content.trim()//message body, removing extra spaces and such
		.split(/(?<!\\)"/).map(s => s.trim())//split around quotes, such that phrases in quotes are in odd indices, but don't match escaped quotes
		.map((chunk, index) => index % 2 === 0? chunk.split(/ +/): chunk)//return quoted phrases as is, split others around spaces
		.flat().filter(s => s !== "")//condense nested arrays to one array and remove empty strings
		.map(arg => arg.replace(/\\"/, '"'));//replace \" with "
	let command = args.shift().toLowerCase();
	
	//some messages can trigger the bot to run a command in non-standard ways
	[command, args] = bot.commandAliases.reduce((commandArgs, alias) => alias(...commandArgs), [command, args, msg]);
	
	if (!bot.commands.has(command)) return;
	let botCommand = bot.commands.get(command);
	// for commands that need access to other commands
	if (botCommand.metacommand) args.unshift(bot.commands);
	//whitelists
	if (botCommand.allowedChannels !== undefined && !botCommand.allowedChannels.includes(chan) && chan !== 'console'){
		return;
	}
	if (botCommand.allowedUsers !== undefined && !process.isAdmin(author)){
		let allowedUsers = botCommand.allowedUsers;
		if(Array.isArray(allowedUsers) && !allowedUsers.includes(author)){
			return;
		}
		if(typeof allowedUsers === 'function' && !allowedUsers(args, msg, groups)){
			return;
		}
	}
	process.log(`${msg.author.tag} called command: ${command}${args.length > 0? ' with args "' + args.join(' ') + '"' :''}`);
	//cooldown handling - NEEDS TO BE SERVER SPECIFIC
	if(botCommand.cooldown !== undefined) {
		let now = Date.now();
		if(botCommand.lastCall !== undefined && !process.isAdmin(author)){
			let timeSinceLastCall = now - botCommand.lastCall;
			if(timeSinceLastCall < botCommand.cooldown){
				let timeLeft = (botCommand.cooldown - timeSinceLastCall)/1000.0;
				if(timeLeft > 1.0) msg.channel.send(`That command is on cooldown for ${timeLeft.toFixed(1)} seconds.`);
				return;
			}
		} else {
			botCommand.lastCall = now;
		}
	}

	try {
		botCommand.execute(msg, args);
	} catch (error) {
		console.error(error);
		msg.reply(`Error: ${error}`);
	}
}

module.exports = {
	initializeBot,
	loggedIn,
	handleMessage
};
/*
  'raffle' command needs to be reworked to not specifically target the 'premium-raffle' channel.
]*/